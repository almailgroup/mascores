import type { Provider } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

/** Always shaped the same so callers can read `.error` / `.redirected` unconditionally. */
type OAuthResult = { redirected: boolean; error?: Error };

/** The UI still speaks the old Lovable provider names; map them onto Supabase's. */
const PROVIDERS: Record<string, Provider> = {
  google: "google",
  apple: "apple",
  microsoft: "azure",
  lovable: "google",
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      opts?: SignInOptions,
    ): Promise<OAuthResult> => {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: PROVIDERS[provider] ?? "google",
          options: {
            redirectTo: opts?.redirect_uri || window.location.origin,
            queryParams: opts?.extraParams,
            // Navigate ourselves so a missing URL surfaces as an error instead of a silent no-op.
            skipBrowserRedirect: true,
          },
        });

        if (error) return { redirected: false, error };
        if (!data?.url) {
          return { redirected: false, error: new Error("Sign-in provider did not return a redirect URL.") };
        }

        window.location.href = data.url;
        return { redirected: true };
      } catch (e) {
        return { redirected: false, error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
  },
};
