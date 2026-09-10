import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTx } from "@/lib/translate";
import { toast } from "sonner";

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
    if (chosen.has(minutes)) {
      await supabase.from("match_reminders").delete().eq("match_id", matchId).eq("user_id", user.id).eq("minutes_before", minutes);
    } else {
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
      await supabase.from("match_reminders").insert({ match_id: matchId, user_id: user.id, minutes_before: minutes });
      toast.success(tx("Reminder set"));
    }
    qc.invalidateQueries({ queryKey: key });
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

/** While the app is open, fires the reminders the signed-in user asked for. */
export function useReminderAlerts() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const fired = new Set<string>();
    const tick = async () => {
      const { data } = await supabase
        .from("match_reminders")
        .select("id,minutes_before,match:matches(id,kickoff_at,home:teams!matches_home_team_id_fkey(name),away:teams!matches_away_team_id_fkey(name))")
        .eq("user_id", user.id);
      for (const row of data ?? []) {
        const match = row.match as { id: string; kickoff_at: string | null; home: { name: string } | null; away: { name: string } | null } | null;
        if (!match?.kickoff_at || fired.has(row.id)) continue;
        const minutesLeft = (new Date(match.kickoff_at).getTime() - Date.now()) / 60000;
        if (minutesLeft <= row.minutes_before && minutesLeft > row.minutes_before - 2) {
          fired.add(row.id);
          const title = `${match.home?.name ?? "Home"} vs ${match.away?.name ?? "Away"}`;
          const body = `Kick-off in ${Math.max(1, Math.round(minutesLeft))} minutes`;
          if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
          else toast.info(`${title} — ${body}`);
        }
      }
    };
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [user]);
}
