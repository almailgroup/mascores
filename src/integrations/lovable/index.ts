import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      try {
        const redirectUri = opts?.redirect_uri || window.location.origin;

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: provider === "lovable" ? "google" : provider,
          options: {
            redirectTo: redirectUri,
            skipBrowserWarning: true,
          },
        });

        if (error) {
          console.error("OAuth error:", error);
          return { error };
        }

        if (data?.url) {
          window.location.href = data.url;
          return { redirected: true };
        }

        return data;
      } catch (e) {
        console.error("OAuth exception:", e);
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
  },
};
