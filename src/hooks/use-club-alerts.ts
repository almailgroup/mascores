import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const CLUB_ALERT_KEY = "mas.club_alert_overrides";
export function readClubAlerts(): Record<string, boolean> {
  try { const value = JSON.parse(localStorage.getItem(CLUB_ALERT_KEY) ?? "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
export function useClubAlerts() {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const sync = () => setOverrides(readClubAlerts());
    sync(); window.addEventListener("mas:alerts-changed", sync);
    let cancelled = false;
    if (user) void supabase.from("profiles").select("notification_preferences").eq("id", user.id).maybeSingle().then(({ data }) => {
      const prefs = data?.notification_preferences;
      if (cancelled || !prefs || typeof prefs !== "object" || Array.isArray(prefs)) return;
      const saved = prefs.club_alert_overrides;
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        try { localStorage.setItem(CLUB_ALERT_KEY, JSON.stringify(saved)); } catch { /* optional persistence */ }
        setOverrides(saved as Record<string, boolean>);
      }
    });
    return () => { cancelled = true; window.removeEventListener("mas:alerts-changed", sync); };
  }, [user]);
  const setClubAlert = async (teamId: string, enabled: boolean) => {
    setSaving(true);
    const next = { ...readClubAlerts(), [teamId]: enabled };
    if (user) {
      const { data, error: readError } = await supabase.from("profiles").select("notification_preferences").eq("id", user.id).maybeSingle();
      if (readError) { setSaving(false); throw readError; }
      const prefs = data?.notification_preferences;
      const { error } = await supabase.from("profiles").update({ notification_preferences: { ...(prefs && typeof prefs === "object" && !Array.isArray(prefs) ? prefs : {}), club_alert_overrides: next } }).eq("id", user.id);
      if (error) { setSaving(false); throw error; }
    }
    try { localStorage.setItem(CLUB_ALERT_KEY, JSON.stringify(next)); } catch { /* optional persistence */ }
    setOverrides(next); setSaving(false); window.dispatchEvent(new Event("mas:alerts-changed"));
  };
  return { overrides, saving, setClubAlert };
}