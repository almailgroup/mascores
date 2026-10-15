import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const CLUB_ALERT_KEY = "mas.club_alert_overrides";
let alertRevision = 0;
let alertSaveQueue: Promise<unknown> = Promise.resolve();
export function readClubAlerts(): Record<string, boolean> {
  try { const value = JSON.parse(localStorage.getItem(CLUB_ALERT_KEY) ?? "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
export function useClubAlerts() {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const pending = useRef(0);
  useEffect(() => {
    const loadRevision = alertRevision;
    const sync = () => setOverrides(readClubAlerts());
    sync(); window.addEventListener("mas:alerts-changed", sync);
    let cancelled = false;
    if (user) void supabase.from("profiles").select("notification_preferences").eq("id", user.id).maybeSingle().then(({ data }) => {
      const prefs = data?.notification_preferences;
      if (cancelled || loadRevision !== alertRevision || !prefs || typeof prefs !== "object" || Array.isArray(prefs)) return;
      const saved = prefs.club_alert_overrides;
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        try { localStorage.setItem(CLUB_ALERT_KEY, JSON.stringify(saved)); } catch { /* optional persistence */ }
        setOverrides(saved as Record<string, boolean>);
      }
    });
    return () => { cancelled = true; window.removeEventListener("mas:alerts-changed", sync); };
  }, [user?.id]);
  const setClubAlert = async (teamId: string, enabled: boolean) => {
    const previous = readClubAlerts();
    const next = { ...previous, [teamId]: enabled };
    const write = (value: Record<string, boolean>) => {
      try { localStorage.setItem(CLUB_ALERT_KEY, JSON.stringify(value)); } catch { /* optional persistence */ }
      setOverrides(value); window.dispatchEvent(new Event("mas:alerts-changed"));
    };
    const writeRevision = ++alertRevision;
    write(next);
    pending.current += 1;
    setSaving(true);
    try {
      if (user) {
        const save = alertSaveQueue.catch(() => {}).then(async () => {
          const { error } = await supabase.rpc("set_club_notification", { _team_id: teamId, _enabled: enabled });
          if (error) throw error;
        });
        alertSaveQueue = save;
        await save;
      }
    } catch (error) {
      if (alertRevision === writeRevision) write(previous);
      throw error;
    } finally {
      pending.current -= 1;
      setSaving(pending.current > 0);
    }
  };
  return { overrides, saving, setClubAlert };
}