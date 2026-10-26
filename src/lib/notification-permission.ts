import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "./native-notify";
import { initNativePush, syncPushToken } from "./native-push";

/** Once permission is granted, later bell taps answer instantly instead of
 *  waiting on the phone again (which made a tap feel ignored). */
let granted = false;

type Status = "granted" | "denied" | "prompt" | "unavailable";

export async function alertPermissionStatus(): Promise<Status> {
  if (typeof window === "undefined") return "unavailable";
  if (isNativeApp()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const s = await PushNotifications.checkPermissions();
      return s.receive === "granted" ? "granted" : s.receive === "denied" ? "denied" : "prompt";
    } catch { return "unavailable"; }
  }
  if (!("Notification" in window)) return "unavailable";
  return Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : "prompt";
}

/** iPhone only shows its own permission prompt once; after that the app can only
 *  send people to Settings. The native confirm() renders as an iPhone system alert. */
function askToOpenSettings() {
  if (isNativeApp()) {
    const open = window.confirm("Notifications are off for MaScores.\n\nTurn on notifications in Settings to use alerts.\n\nOpen Settings now?");
    if (open) window.location.href = "app-settings:";
    return;
  }
  toast.error("Notifications are blocked", { description: "Allow notifications in this site's browser settings, then tap the bell again." });
}

/** Switches every bell off on this device and for the signed-in account. */
export async function muteAllBells(): Promise<void> {
  for (const key of ["mas.match_notification_ids"]) { try { localStorage.setItem(key, "[]"); } catch { /* optional */ } }
  for (const key of ["mas.club_alert_overrides", "mas.player_alert_overrides"]) {
    try {
      const cur = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, boolean>;
      localStorage.setItem(key, JSON.stringify(Object.fromEntries(Object.keys(cur).map((k) => [k, false]))));
    } catch { /* optional */ }
  }
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await supabase.rpc("mute_all_alerts");
    // Pull the muted copy (including favourite clubs/players now set to off) back down.
    const { data: p } = await supabase.from("profiles").select("notification_preferences").eq("id", data.session.user.id).maybeSingle();
    const prefs = p?.notification_preferences as Record<string, unknown> | null;
    try {
      if (prefs?.club_alert_overrides) localStorage.setItem("mas.club_alert_overrides", JSON.stringify(prefs.club_alert_overrides));
      if (prefs?.player_alert_overrides) localStorage.setItem("mas.player_alert_overrides", JSON.stringify(prefs.player_alert_overrides));
    } catch { /* optional */ }
  }
  window.dispatchEvent(new Event("mas:alerts-muted"));
  window.dispatchEvent(new Event("mas:alerts-changed"));
}

/** On launch, return to the app and sign-in: if the phone's notifications are off, every bell goes off. */
export async function syncBellsWithPermission(): Promise<void> {
  if (!isNativeApp()) return;
  if ((await alertPermissionStatus()) !== "denied") return;
  granted = false;
  await muteAllBells();
}

/** Returns true only when alerts may be delivered. Bells must stay off when false. */
export async function requestAlertPermission(): Promise<boolean> {
  if (granted && (await alertPermissionStatus()) === "granted") return true;
  granted = false;
  if (isNativeApp()) {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let status = await PushNotifications.checkPermissions();
    if (status.receive === "prompt" || status.receive === "prompt-with-rationale") status = await PushNotifications.requestPermissions();
    if (status.receive === "granted") {
      granted = true;
      // Registering with Apple can take a moment; never hold up the tap for it.
      void initNativePush().then(() => syncPushToken()).catch(() => { /* retried on next launch */ });
      return true;
    }
    askToOpenSettings();
    return false;
  }
  if (!("Notification" in window)) { toast.error("Notifications are unavailable in this browser"); return false; }
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") askToOpenSettings();
  granted = permission === "granted";
  return granted;
}

/** Called before a bell turns on. In the iPhone app the bell only lights when
 *  notifications are allowed; on the website in-page alerts still work, so it never blocks. */
export async function allowBellOn(): Promise<boolean> {
  if (!isNativeApp()) { void requestAlertPermission(); return true; }
  return requestAlertPermission();
}
