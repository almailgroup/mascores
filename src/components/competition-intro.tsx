import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import type { CompetitionTheme } from "@/lib/competition-theme";

/**
 * Short branded intro played when a themed competition is opened. It runs once
 * per competition and season for each browsing session.
 */
export function CompetitionIntro({ theme, name, season, logoUrl }: {
  theme: CompetitionTheme;
  name: string;
  season: string | null;
  logoUrl: string | null;
}) {
  const [phase, setPhase] = useState<"hidden" | "playing" | "closing">("hidden");

  useEffect(() => {
    const key = `comp-intro:${theme.key}:${name}:${season ?? ""}`;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    setPhase("playing");
    const close = window.setTimeout(() => setPhase("closing"), 2100);
    const done = window.setTimeout(() => setPhase("hidden"), 2700);
    return () => { window.clearTimeout(close); window.clearTimeout(done); };
  }, [theme.key, name, season]);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 transition-opacity duration-500 ${phase === "closing" ? "opacity-0" : "opacity-100"}`}
      style={{ ...theme.vars, background: theme.hero }}
    >
      <div
        className="animate-mas-logo-in flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-background/95 p-3 sm:h-36 sm:w-36"
        style={{ boxShadow: `0 0 60px 0 ${theme.glow}` }}
      >
        {logoUrl
          ? <img src={logoUrl} alt="" className="h-full w-full object-contain" />
          : <Trophy className="h-12 w-12 text-primary" />}
      </div>
      <div className="animate-mas-text-in px-6 text-center">
        <div className="text-xl font-black uppercase tracking-wide text-primary-foreground sm:text-3xl">{name}</div>
        {season && <div className="mt-1 text-sm font-semibold text-primary-foreground/85 sm:text-lg">{season} season</div>}
      </div>
    </div>
  );
}
