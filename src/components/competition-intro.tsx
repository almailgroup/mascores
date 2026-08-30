import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import type { CompetitionTheme } from "@/lib/competition-theme";

const DURATION = 2600;

/**
 * Short branded intro played when a themed competition is opened. It runs once
 * per competition and season for each browsing session, then unmounts itself.
 */
export function CompetitionIntro({ theme, name, season, logoUrl }: {
  theme: CompetitionTheme;
  name: string;
  season: string | null;
  logoUrl: string | null;
}) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `comp-intro:${theme.key}:${name}:${season ?? ""}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    setPlaying(true);
  }, [theme.key, name, season]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPlaying(false), DURATION);
    return () => window.clearTimeout(timer);
  }, [playing]);

  if (!playing) return null;

  return (
    <div
      aria-hidden
      className="animate-comp-intro fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5"
      style={{ ...theme.vars, background: theme.hero }}
      onAnimationEnd={() => setPlaying(false)}
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
