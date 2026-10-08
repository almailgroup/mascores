import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isNativeApp } from "@/lib/native-notify";
import { supabase } from "@/integrations/supabase/client";

// Must be on the auth allow-list (https), so the sheet lands on our callback
// page, which hands the code back to the app via the custom URL scheme.
const CALLBACK_URL = "https://mascores.live/auth/callback?native=1";
const APP_SCHEME = "com.almailgroup.mascores";

// Apple's compact sign-in sheet (ASWebAuthenticationSession), built into the app.
const AuthSheet = registerPlugin<{
  open(options: { url: string; callbackScheme: string }): Promise<{ url: string }>;
}>("AuthSheet");

/** Pull the one-time sign-in code out of the return link and finish sign-in. */
async function finishWithReturnUrl(url: string): Promise<{ handled: boolean; error?: string }> {
  let code: string | null = null;
  let providerError: string | null = null;
  try {
    const parsed = new URL(url);
    code = parsed.searchParams.get("code");
    providerError = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
  } catch {
    /* fall through */
  }
  if (!code) return { handled: true, error: providerError ?? "Sign-in failed. Please try again." };
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? { handled: true, error: error.message } : { handled: true };
}

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
  const hasSheet = Capacitor.isPluginAvailable("AuthSheet");
  const hasBrowser = Capacitor.isPluginAvailable("Browser");
  // Older builds without either: use the in-app web sign-in instead of
  // failing with "plugin is not implemented on ios".
  if (!hasSheet && !hasBrowser) return { handled: false };

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: CALLBACK_URL,
      skipBrowserRedirect: true,
      ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
    },
  });
  if (error || !data?.url) return { handled: true, error: error?.message ?? "Could not start sign-in" };

  if (hasSheet) {
    try {
      const result = await AuthSheet.open({ url: data.url, callbackScheme: APP_SCHEME });
      return await finishWithReturnUrl(result.url);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "CANCELLED") return { handled: true, error: "Sign in was cancelled" };
      if (!hasBrowser) return { handled: true, error: e instanceof Error ? e.message : "Sign-in failed" };
      // Otherwise try the Safari sheet below.
    }
  }

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
      if (!url.startsWith(`${APP_SCHEME}://`)) return;
      try {
        finish(await finishWithReturnUrl(url));
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
