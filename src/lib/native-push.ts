/**
 * Push notifications for the native iOS shell (goal, kickoff and full-time alerts).
 *
 * Everything here is a no-op on the web: the plugin is imported dynamically so
 * @capacitor/push-notifications never lands in the browser bundle, and every
 * entry point bails out unless it is running inside the native app.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * `device_tokens` is created by a migration that has not been applied to the
 * project `integrations/supabase/types.ts` was generated from, so the generated
 * Database type does not contain it yet. That file is regenerated from the live
 * schema, so describing the table here rather than editing it keeps this working
 * across regenerations. Once the migration is applied and types are regenerated,
 * this block and the `withDeviceTokens()` cast can both go.
 */
type DeviceTokenInsert = {
  user_id: string;
  token: string;
  platform: string;
  locale: string;
  updated_at: string;
};

type DeviceTokensDb = {
  public: {
    Tables: {
      device_tokens: {
        Row: DeviceTokenInsert & { id: string; created_at: string };
        Insert: DeviceTokenInsert;
        Update: Partial<DeviceTokenInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const withDeviceTokens = () => supabase as unknown as SupabaseClient<DeviceTokensDb>;

/** The APNs token for this device, once APNs has handed one over. */
let deviceToken: string | null = null;

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor injects this global into the WebView; on the web it is absent.
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

function currentLocale(): string {
  try {
    return localStorage.getItem("mas.lang") === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

/**
 * Attaches this device's token to the signed-in account.
 *
 * Safe to call repeatedly — the row is keyed by token, so signing in on a shared
 * phone moves the device to the new account rather than leaving alerts going to
 * the previous one. Silently does nothing while signed out, because the table's
 * RLS policies require an authenticated owner.
 */
export async function syncPushToken(): Promise<void> {
  if (!deviceToken) return;

  const { data } = await supabase.auth.getUser();
  if (!data.user) return;

  await withDeviceTokens().from("device_tokens").upsert(
    {
      user_id: data.user.id,
      token: deviceToken,
      platform: "ios",
      locale: currentLocale(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
}

/**
 * Requests permission, registers with APNs and wires up the listeners.
 *
 * @param onOpen called when a notification is tapped, with the in-app path to
 *   open (the sender puts it in the payload's `path`, e.g. `/match/123`).
 */
export async function initNativePush(onOpen?: (path: string) => void): Promise<void> {
  if (!isNative()) return;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  let status = await PushNotifications.checkPermissions();
  if (status.receive === "prompt" || status.receive === "prompt-with-rationale") {
    status = await PushNotifications.requestPermissions();
  }
  if (status.receive !== "granted") return;

  await PushNotifications.addListener("registration", (token) => {
    deviceToken = token.value;
    // The user may already be signed in by the time APNs answers.
    void syncPushToken();
  });

  await PushNotifications.addListener("registrationError", (err) => {
    console.error("[push] APNs registration failed", err);
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const path = action.notification.data?.path;
    if (typeof path === "string" && path.startsWith("/")) onOpen?.(path);
  });

  // Asks iOS for a token; the "registration" listener above receives it.
  await PushNotifications.register();
}

/** Detaches this device so a signed-out account stops receiving its alerts. */
export async function clearPushToken(): Promise<void> {
  if (!deviceToken) return;
  await withDeviceTokens().from("device_tokens").delete().eq("token", deviceToken);
}
