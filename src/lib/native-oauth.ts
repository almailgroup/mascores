import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isNativeApp } from "@/lib/native-notify";
import { supabase } from "@/integrations/supabase/client";

// Must be on the auth allow-list (https), so the sheet lands on our callback
// page, which hands the code back to the app via the custom URL scheme.
const CALLBACK_URL = "https://mascores.live/auth/callback?native=1";

/**
 * Native iOS OAuth: open the provider sign-in in the system Safari sheet
 * (SFSafariViewController) — it has a Done button, correct sizing, and
 * Face ID support — then return to the app via the custom URL scheme and
 * exchange the code for a session.
 *
 * Returns true when the native flow handled the sign-in; false means the
 * caller should fall back to the web flow.
 */
export async function nativeOAuthSignIn(provider: "google" | "apple"): Promise<{ handled: boolean; error?: string }> {
  if (!isNativeApp()) return { handled: false };
  // Builds without the Browser plugin: use the in-app web sign-in instead of
  // failing with "Browser plugin is not implemented on ios".
  if (!Capacitor.isPluginAvailable("Browser")) return { handled: false };

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: CALLBACK_URL,
      skipBrowserRedirect: true,
      ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
    },
  });
  if (error || !data?.url) return { handled: true, error: error?.message ?? "Could not start sign-in" };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { handled: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      void listener.then((l) => l.remove());
      void Browser.close().catch(() => undefined);
      resolve(result);
    };

    const listener = App.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith("com.almailgroup.mascores://")) return;
      try {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);
        finish(exchangeError ? { handled: true, error: exchangeError.message } : { handled: true });
      } catch (e) {
        finish({ handled: true, error: e instanceof Error ? e.message : "Sign-in failed" });
      }
    });

    void Browser.open({ url: data.url, presentationStyle: "popover" }).catch(() => {
      // Sheet unavailable: continue sign-in inside the app's own view.
      settled = true;
      void listener.then((l) => l.remove());
      window.location.href = data.url;
    });

    // If the user dismisses the sheet without signing in, unblock the UI.
    void Browser.addListener("browserFinished", () => {
      finish({ handled: true, error: "Sign in was cancelled" });
    });
  });
}
