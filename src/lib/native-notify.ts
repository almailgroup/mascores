/**
 * Phone notifications inside the iOS app. The app's web view has no browser
 * Notification support, so alerts go through the native local-notification
 * plugin instead. Every function is a no-op on the website.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

let ready: Promise<boolean> | null = null;

async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

/** Asks for permission once; resolves true when alerts may be shown. */
export function ensureNativePermission(): Promise<boolean> {
  if (!isNativeApp()) return Promise.resolve(false);
  if (!ready) {
    ready = (async () => {
      try {
        const ln = await plugin();
        let s = await ln.checkPermissions();
        if (s.display !== "granted") s = await ln.requestPermissions();
        const ok = s.display === "granted";
        if (!ok) ready = null; // ask again next time (e.g. after enabling in Settings)
        return ok;
      } catch {
        ready = null;
        return false;
      }
    })();
  }
  return ready;
}

/** Stable positive 31-bit id from a string, so re-scheduling replaces instead of duplicating. */
export function notifId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647 || 1;
}

/** Shows an alert right now. Returns true when the phone showed it. */
export async function nativeNotify(title: string, body: string, key = title + body, path?: string): Promise<boolean> {
  if (!(await ensureNativePermission())) return false;
  try {
    const ln = await plugin();
    await ln.schedule({ notifications: [{ id: notifId(key), title, body, extra: path ? { path } : undefined }] });
    return true;
  } catch {
    return false;
  }
}

/** Schedules an alert for later — fires even if the app is closed. */
/** Returns true when the phone accepted the alert. */
export async function nativeSchedule(key: string, at: Date, title: string, body: string, path?: string): Promise<boolean> {
  if (at.getTime() <= Date.now()) return false;
  if (!(await ensureNativePermission())) return false;
  try {
    const ln = await plugin();
    await ln.schedule({ notifications: [{ id: notifId(key), title, body, sound: "default", schedule: { at, allowWhileIdle: true }, extra: path ? { path } : undefined }] });
    return true;
  } catch {
    return false; /* plugin missing in an older build */
  }
}

export async function nativeCancel(keys: string[]): Promise<void> {
  if (!isNativeApp() || keys.length === 0) return;
  try {
    const ln = await plugin();
    await ln.cancel({ notifications: keys.map((k) => ({ id: notifId(k) })) });
  } catch { /* nothing to cancel */ }
}

/** Opens the tapped alert's page. */
export async function onNativeNotificationTap(open: (path: string) => void): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const ln = await plugin();
    await ln.addListener("localNotificationActionPerformed", (a) => {
      const p = a.notification.extra?.path;
      if (typeof p === "string" && p.startsWith("/")) open(p);
    });
  } catch { /* older build */ }
}
