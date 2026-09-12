import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { playAlertSound, soundFor, type AlertEventKey, type AlertSoundMap } from "@/lib/alert-sounds";


const ALERT_KEY = "mas.match_notification_ids";

type EventRow = {
  id: string;
  match_id: string;
  type: string;
  minute: number | null;
  extra: number | null;
  team_id: string | null;
  player_id: string | null;
  description: string | null;
};

type Info = {
  homeId: string | null;
  awayId: string | null;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  competition: string | null;
};

/** How each moment of the match is announced. */
const EVENT_TEXT: Record<string, { emoji: string; label: string }> = {
  goal: { emoji: "⚽", label: "Goal" },
  own_goal: { emoji: "🥴", label: "Own goal" },
  penalty_goal: { emoji: "⚽", label: "Penalty scored" },
  penalty: { emoji: "⚽", label: "Penalty scored" },
  penalty_missed: { emoji: "❌", label: "Penalty missed" },
  missed_penalty: { emoji: "❌", label: "Penalty missed" },
  yellow_card: { emoji: "🟨", label: "Yellow card" },
  yellow: { emoji: "🟨", label: "Yellow card" },
  second_yellow: { emoji: "🟨🟥", label: "Second yellow" },
  red_card: { emoji: "🟥", label: "Red card" },
  red: { emoji: "🟥", label: "Red card" },
  substitution: { emoji: "🔁", label: "Substitution" },
  sub: { emoji: "🔁", label: "Substitution" },
  var: { emoji: "📺", label: "VAR check" },
  assist: { emoji: "🎯", label: "Assist" },
  injury: { emoji: "🩹", label: "Injury" },
  save: { emoji: "🧤", label: "Save" },
};

const STATUS_TEXT: Record<string, { emoji: string; label: string }> = {
  live: { emoji: "🟢", label: "Kick-off" },
  "1h": { emoji: "🟢", label: "Kick-off" },
  ht: { emoji: "⏸️", label: "Half time" },
  "2h": { emoji: "🟢", label: "Second half" },
  ft: { emoji: "🏁", label: "Full time" },
  aet: { emoji: "🏁", label: "After extra time" },
  pen: { emoji: "🥊", label: "Penalty shoot-out" },
  postponed: { emoji: "⏳", label: "Postponed" },
  cancelled: { emoji: "🚫", label: "Cancelled" },
};

type AlertPreferences = { goals?: boolean; cards?: boolean; kickoff?: boolean; final?: boolean; sound?: string; sounds?: AlertSoundMap };

function announce(title: string, body: string, sound?: string) {
  playAlertSound(sound);

  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: title + body });
      return;
    }
  } catch { /* falls back to the in-app message */ }
  toast(title, { description: body, duration: 7000 });
}

/**
 * Live match alerts: goals, cards, substitutions, kick-off and full time for the
 * matches the person follows — either a single match they switched alerts on for,
 * or any match of a club they favourited.
 */
export function useLiveEventAlerts() {
  const { user } = useAuth();
  const { favorites, ready } = useFavorites();
  const teamIds = favorites.team.join(",");
  const matchIds = favorites.match.join(",");
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const info = new Map<string, Info>();
    const followedTeams = new Set(teamIds ? teamIds.split(",") : []);
    let explicit = new Set<string>(matchIds ? matchIds.split(",") : []);
    let preferences: AlertPreferences = {};

    try {
      const local = JSON.parse(localStorage.getItem(ALERT_KEY) ?? "[]");
      if (Array.isArray(local)) explicit = new Set([...explicit, ...local.map(String)]);
    } catch { /* nothing saved yet */ }

    const loadAlerts = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("match_notification_ids,notification_preferences").eq("id", user.id).maybeSingle();
      for (const id of data?.match_notification_ids ?? []) explicit.add(String(id));
      if (data?.notification_preferences && typeof data.notification_preferences === "object" && !Array.isArray(data.notification_preferences)) preferences = data.notification_preferences as AlertPreferences;
    };

    const loadMatch = async (matchId: string): Promise<Info | null> => {
      const cached = info.get(matchId);
      if (cached) return cached;
      const { data } = await supabase
        .from("matches")
        .select("id,home_score,away_score,home_team_id,away_team_id,home:teams!matches_home_team_id_fkey(name),away:teams!matches_away_team_id_fkey(name),competition:competitions(name)")
        .eq("id", matchId)
        .maybeSingle();
      if (!data) return null;
      const row = data as unknown as {
        home_score: number | null; away_score: number | null; home_team_id: string | null; away_team_id: string | null;
        home: { name: string } | null; away: { name: string } | null; competition: { name: string } | null;
      };
      const value: Info = {
        homeId: row.home_team_id, awayId: row.away_team_id,
        home: row.home?.name ?? "Home", away: row.away?.name ?? "Away",
        homeScore: row.home_score, awayScore: row.away_score,
        competition: row.competition?.name ?? null,
      };
      info.set(matchId, value);
      return value;
    };

    /** Only matches the person asked about, or their clubs' matches. */
    const wanted = (m: Info | null, matchId: string) => {
      if (explicit.has(matchId)) return true;
      if (!m) return false;
      return Boolean((m.homeId && followedTeams.has(m.homeId)) || (m.awayId && followedTeams.has(m.awayId)));
    };

    const playerName = async (id: string | null) => {
      if (!id) return null;
      const { data } = await supabase.from("players").select("short_name,name").eq("id", id).maybeSingle();
      return data?.short_name || data?.name || null;
    };

    const onEvent = async (row: EventRow) => {
      if (seen.current.has(row.id)) return;
      seen.current.add(row.id);
      const m = await loadMatch(row.match_id);
      if (cancelled || !wanted(m, row.match_id)) return;
      const meta = EVENT_TEXT[row.type] ?? { emoji: "🔔", label: row.type.replace(/_/g, " ") };
      const category: "cards" | "goals" | null = ["yellow", "yellow_card", "second_yellow", "red", "red_card"].includes(row.type) ? "cards" : ["goal", "own_goal", "penalty", "penalty_goal", "penalty_missed", "missed_penalty"].includes(row.type) ? "goals" : null;
      if (category && preferences[category] === false) return;
      const side = m && row.team_id ? (row.team_id === m.homeId ? m.home : row.team_id === m.awayId ? m.away : null) : null;
      const who = await playerName(row.player_id);
      const minute = row.minute != null ? `${row.minute}${row.extra ? `+${row.extra}` : ""}'` : "";
      const isGoal = meta.emoji === "⚽" || row.type === "own_goal";
      const fresh = isGoal ? await refreshScore(row.match_id) : m;
      const score = fresh && fresh.homeScore != null && fresh.awayScore != null ? `${fresh.homeScore} - ${fresh.awayScore}` : "";
      const title = `${meta.emoji} ${meta.label}${side ? ` · ${side}` : ""}`;
      const body = [
        m ? `${m.home} ${score || "vs"} ${m.away}` : "",
        [minute, who, row.description].filter(Boolean).join(" · "),
      ].filter(Boolean).join("\n");
      announce(title, body, preferences.sound);
    };

    const refreshScore = async (matchId: string) => {
      info.delete(matchId);
      return loadMatch(matchId);
    };

    const onMatch = async (row: { id: string; status: string; home_score: number | null; away_score: number | null }) => {
      const meta = STATUS_TEXT[row.status];
      if (!meta) return;
      const category: "final" | "kickoff" | null = ["ft", "aet", "pen"].includes(row.status) ? "final" : ["live", "1h", "2h"].includes(row.status) ? "kickoff" : null;
      if (category && preferences[category] === false) return;
      const key = `${row.id}:${row.status}`;
      if (seen.current.has(key)) return;
      const m = await loadMatch(row.id);
      if (cancelled || !wanted(m, row.id)) return;
      seen.current.add(key);
      info.set(row.id, { ...(m as Info), homeScore: row.home_score, awayScore: row.away_score });
      const score = row.home_score != null && row.away_score != null ? `${row.home_score} - ${row.away_score}` : "vs";
      announce(`${meta.emoji} ${meta.label}`, `${m?.home ?? "Home"} ${score} ${m?.away ?? "Away"}`, preferences.sound);
    };

    loadAlerts();
    // Picks up a newly switched-on match without re-subscribing.
    const refreshExplicit = () => {
      try {
        const local = JSON.parse(localStorage.getItem(ALERT_KEY) ?? "[]");
        if (Array.isArray(local)) for (const id of local) explicit.add(String(id));
      } catch { /* nothing saved yet */ }
      void loadAlerts();
    };
    window.addEventListener("mas:alerts-changed", refreshExplicit);
    const channel = supabase.channel("mas-live-alerts");
    channel.on("postgres_changes" as never, { event: "INSERT", schema: "public", table: "match_events" },
      (payload: { new: EventRow }) => { void onEvent(payload.new); });
    channel.on("postgres_changes" as never, { event: "UPDATE", schema: "public", table: "matches" },
      (payload: { new: { id: string; status: string; home_score: number | null; away_score: number | null } }) => { void onMatch(payload.new); });
    channel.subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener("mas:alerts-changed", refreshExplicit);
      supabase.removeChannel(channel);
    };
  }, [user, ready, teamIds, matchIds]);

}

/** Asks once, politely, so alerts can appear even when the tab is in the background. */
export function useAskForAlerts() {
  const { favorites, ready } = useFavorites();
  const follows = favorites.team.length + favorites.match.length > 0;
  useEffect(() => {
    if (!ready || !follows) return;
    if (!("Notification" in window) || Notification.permission !== "default") return;
    const asked = localStorage.getItem("mas.alerts_asked");
    if (asked) return;
    localStorage.setItem("mas.alerts_asked", "1");
    const timer = setTimeout(() => { void Notification.requestPermission(); }, 4000);
    return () => clearTimeout(timer);
  }, [ready, follows]);
}
