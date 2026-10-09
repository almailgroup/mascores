import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [
    { title: "Completing sign-in — MaScores" },
    { name: "description", content: "Complete your MaScores sign-in and return to the app." },
    { property: "og:title", content: "Completing sign-in — MaScores" },
    { property: "og:description", content: "Complete your MaScores sign-in and return to the app." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AuthCallbackPage,
});

/**
 * OAuth return page. Two modes:
 * - native=1: opened inside the iPhone sign-in sheet — hand the code back to
 *   the app through its custom URL scheme, which closes the sheet.
 * - otherwise: a normal web redirect — exchange the code and go home.
 */
function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isNativeReturn = params.get("native") === "1";

    if (isNativeReturn) {
      params.delete("native");
      const target = `com.almailgroup.mascores://auth/callback?${params.toString()}${window.location.hash}`;
      setMessage("Returning to the app…");
      window.location.replace(target);
      return;
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const at = hash.get("access_token"), rt = hash.get("refresh_token");
    if (at && rt) {
      void supabase.auth.setSession({ access_token: at, refresh_token: rt }).then(({ error }) => error ? setMessage(error.message) : navigate({ to: "/" }));
      return;
    }
    const code = params.get("code");
    if (!code) {
      setMessage("Missing sign-in code. You can close this page and try again.");
      return;
    }
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          setMessage(error.message);
        } else {
          navigate({ to: "/" });
        }
      });
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
