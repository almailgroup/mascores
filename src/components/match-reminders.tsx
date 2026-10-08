import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTx } from "@/lib/auto-translate";
import { toast } from "sonner";
import { isNativeApp, nativeSchedule, nativeCancel, nativeNotify, ensureNativePermission } from "@/lib/native-notify";

const PRESETS = [45, 30, 15];

/** Kick-off reminders: 45/30/15 minutes before, plus a custom time. */
export function MatchReminders({ matchId, kickoffAt }: { matchId: string; kickoffAt: string | null }) {
  const { user } = useAuth();
  const tx = useTx();
  const qc = useQueryClient();
  const [custom, setCustom] = useState("");
  const key = ["match-reminders", matchId, user?.id];

  const reminders = useQuery({
    enabled: !!user,
    queryKey: key,
    queryFn: async () =>
      ((await supabase.from("match_reminders").select("id,minutes_before").eq("match_id", matchId).eq("user_id", user!.id)).data ?? []),
  });

  const chosen = new Set((reminders.data ?? []).map((r) => r.minutes_before));

  const toggle = async (minutes: number) => {
    if (!user) { toast.error(tx("Sign in to set a reminder")); return; }
    const reminderKey = `reminder:${matchId}:${minutes}`;
    if (chosen.has(minutes)) {
      const { error } = await supabase.from("match_reminders").delete().eq("match_id", matchId).eq("user_id", user.id).eq("minutes_before", minutes);
      if (error) { toast.error(tx("Could not remove the reminder. Please try again.")); return; }
      void nativeCancel([reminderKey]);
      toast.success(tx("Reminder removed"));
      qc.invalidateQueries({ queryKey: key });
      return;
    }
    if (!kickoffAt) return;
    const at = new Date(new Date(kickoffAt).getTime() - minutes * 60000);
    if (at.getTime() <= Date.now()) { toast.error(tx("That time has already passed — pick a shorter reminder.")); return; }

    let allowed = true;
    if (isNativeApp()) allowed = await ensureNativePermission();
    else if ("Notification" in window) {
      if (Notification.permission === "default") await Notification.requestPermission();
      allowed = Notification.permission === "granted";
    }

    const { error } = await supabase.from("match_reminders").insert({ match_id: matchId, user_id: user.id, minutes_before: minutes });
    if (error && error.code !== "23505") { toast.error(tx("Could not save the reminder. Please try again.")); return; }
    qc.invalidateQueries({ queryKey: key });

    if (isNativeApp()) {
      // Schedule on the phone right away so it fires even if the app is closed.
      const { data: m } = await supabase.from("matches")
        .select("home:teams!matches_home_team_id_fkey(name),away:teams!matches_away_team_id_fkey(name)")
        .eq("id", matchId).maybeSingle();
      const names = m as { home: { name: string } | null; away: { name: string } | null } | null;
      const ok = await nativeSchedule(reminderKey, at,
        `⏰ ${names?.home?.name ?? "Home"} vs ${names?.away?.name ?? "Away"}`,
        `Kick-off in ${minutes} minutes`, `/matches/${matchId}`);
      if (!ok) {
        toast.warning(allowed
          ? tx("Reminder saved, but this app version can't schedule alerts. Install the latest TestFlight build.")
          : tx("Reminder saved. Turn on notifications for MA Scores in iPhone Settings to get it."));
        return;
      }
    } else if (!allowed) {
      toast.success(tx("Reminder set — you'll see it here while the site is open. Allow notifications to get a pop-up."));
      return;
    }
    toast.success(tx("Reminder set"));
  };

  if (!kickoffAt) return null;
  const past = new Date(kickoffAt).getTime() < Date.now();
  if (past) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">
        <BellRing className="h-3.5 w-3.5" /> {tx("Kick-off reminders")}
      </div>
      <div className="flex flex-wrap items-center gap-2 p-4">
        {PRESETS.map((m) => (
          <button key={m} onClick={() => toggle(m)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-bold ${chosen.has(m) ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}>
            <Bell className="h-3.5 w-3.5" /> {m} {tx("min")}
          </button>
        ))}
        <div className="flex items-center gap-1.5">
          <input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
            placeholder={tx("Custom")} className="h-9 w-24 rounded-full border border-border bg-background px-3 text-xs outline-none focus:border-primary" />
          <button onClick={() => { const m = Number(custom); if (m > 0) { toggle(m); setCustom(""); } }}
            className="h-9 rounded-full border border-border px-3 text-xs font-bold">{tx("Add")}</button>
        </div>
      </div>
      {(reminders.data ?? []).filter((r) => !PRESETS.includes(r.minutes_before)).length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          {(reminders.data ?? []).filter((r) => !PRESETS.includes(r.minutes_before)).map((r) => (
            <button key={r.id} onClick={() => toggle(r.minutes_before)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground">
              {r.minutes_before} {tx("min")} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const FIRED_KEY = "mas.reminders.fired";
function loadFired(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]")); } catch { return new Set(); }
}
function saveFired(set: Set<string>) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-200))); } catch { /* ignore */ }
}

/**
 * Keeps the signed-in user's reminders working: on the phone they're scheduled
 * as real alerts (fire with the app closed); on the website they pop up while
 * the site is open.
 */
export function useReminderAlerts() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const fired = loadFired();
    const scheduled = new Map<string, boolean>();
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const { data, error } = await supabase
          .from("match_reminders")
          .select("id,minutes_before,match:matches(id,kickoff_at,home:teams!matches_home_team_id_fkey(name),away:teams!matches_away_team_id_fkey(name))")
          .eq("user_id", user.id);
        if (error) return;
        for (const row of data ?? []) {
          const match = row.match as { id: string; kickoff_at: string | null; home: { name: string } | null; away: { name: string } | null } | null;
          if (!match?.kickoff_at || fired.has(row.id)) continue;
          const title = `${match.home?.name ?? "Home"} vs ${match.away?.name ?? "Away"}`;
          const kickoff = new Date(match.kickoff_at).getTime();
          const at = new Date(kickoff - row.minutes_before * 60000);
          const schedKey = `${row.id}:${match.kickoff_at}`;

          if (isNativeApp() && !scheduled.has(schedKey) && at.getTime() > Date.now()) {
            // Real phone alert; re-done when the kickoff time changes.
            scheduled.set(schedKey, await nativeSchedule(`reminder:${match.id}:${row.minutes_before}`, at,
              `⏰ ${title}`, `Kick-off in ${row.minutes_before} minutes`, `/matches/${match.id}`));
          }

          const minutesLeft = (kickoff - Date.now()) / 60000;
          if (minutesLeft <= row.minutes_before && minutesLeft > -5) {
            fired.add(row.id);
            saveFired(fired);
            // The phone already showed its scheduled alert.
            if (isNativeApp() && scheduled.get(schedKey)) continue;
            const body = minutesLeft > 0 ? `Kick-off in ${Math.max(1, Math.round(minutesLeft))} minutes` : "Kick-off now";
            if (isNativeApp()) { if (!(await nativeNotify(`⏰ ${title}`, body, `reminder-now:${row.id}`, `/matches/${match.id}`))) toast.info(`${title} — ${body}`); }
            else if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
            else toast.info(`${title} — ${body}`, { duration: 15000 });
          }
        }
      } finally {
        running = false;
      }
    };
    void tick();
    const timer = setInterval(tick, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [user]);
}
