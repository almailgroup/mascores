import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: provider === "lovable" ? "google" : provider,
          options: {
            redirectTo: opts?.redirect_uri,
          },
        });

        if (error) {
          return { error };
        }

        if (data?.url) {
          window.location.href = data.url;
          return { redirected: true };
        }

        return data;
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
  },
};
