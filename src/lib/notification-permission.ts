import { toast } from "sonner";
import { isNativeApp } from "./native-notify";
import { initNativePush, syncPushToken } from "./native-push";

export async function requestAlertPermission(): Promise<boolean> {
  if (isNativeApp()) {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let status = await PushNotifications.checkPermissions();
    if (status.receive === "prompt" || status.receive === "prompt-with-rationale") status = await PushNotifications.requestPermissions();
    if (status.receive === "granted") { await initNativePush(); await syncPushToken(); return true; }
    toast.error("Notifications are blocked", { description: "Open iPhone Settings → Notifications → MaScores and turn on Allow Notifications." });
    return false;
  }
  if (!("Notification" in window)) { toast.error("Notifications are unavailable in this browser"); return false; }
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") toast.error("Notifications are blocked", { description: "Allow notifications in this site's browser settings, then tap the bell again." });
  return permission === "granted";
}