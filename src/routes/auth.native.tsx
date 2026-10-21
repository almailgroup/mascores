import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const APP_SCHEME = "com.almailgroup.mascores";

export const Route = createFileRoute("/auth/native")({
  head: () => ({ meta: [
    { title: "Returning to MaScores" },
    { name: "description", content: "Finishing sign-in and returning to the MaScores app." },
    { property: "og:title", content: "Returning to MaScores" },
    { property: "og:description", content: "Finishing sign-in and returning to the MaScores app." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: NativeReturnPage,
});

/**
 * iPhone sign-in return page. Never signs in here (the sheet's storage is
 * separate from the app) — it only hands the code/tokens back to the app.
 */
function NativeReturnPage() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    // The start step (?start=google) is handled by the early script in the
    // page head, which is already moving on to the sign-in service.
    if (new URLSearchParams(window.location.search).has("start")) return;
    const t = `${APP_SCHEME}://auth/callback${window.location.search}${window.location.hash}`;
    setTarget(t);
    if (!(window as { __masNativeHandoff?: number }).__masNativeHandoff) window.location.replace(t);
  }, []);
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Returning to the app…</p>
        {target && (
          <a href={target} className="inline-block rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
            Return to MaScores
          </a>
        )}
      </div>
    </div>
  );
}
