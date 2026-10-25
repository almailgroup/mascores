import { Play, ExternalLink, BadgeCheck } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { portraitSource } from "@/lib/portrait-source";
import { useTx } from "@/lib/auto-translate";

type Side = { name?: string | null; logo?: string | null; photo?: string | null };

/** Highlight poster: score panel with crests on the left, one featured player per team on the right. */
export function MatchHighlightCard({ href, home, away, score, leagueLogo }: { href: string; home: Side; away: Side; score: string; leagueLogo?: string | null }) {
  const tx = useTx();
  const photo = (src?: string | null, name?: string | null, side: "l" | "r" = "l") => src ? (
    <img src={portraitSource(src) ?? src} alt={name ?? ""} draggable={false}
      className={`h-full w-1/2 object-cover object-top ${side === "l" ? "[mask-image:linear-gradient(to_right,black_75%,transparent)]" : "[mask-image:linear-gradient(to_left,black_75%,transparent)]"}`} />
  ) : (
    <div className="grid h-full w-1/2 place-items-center"><TeamCrest name={name} logo={side === "l" ? home.logo : away.logo} className="h-20 w-20 opacity-60" /></div>
  );
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group relative flex aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative z-10 flex w-[30%] shrink-0 flex-col items-center justify-between bg-primary py-3 text-primary-foreground">
        <TeamCrest name={home.name} logo={home.logo} className="h-14 w-14 drop-shadow" />
        <span className="text-4xl font-black leading-none tracking-tighter tabular-nums">{score}</span>
        <TeamCrest name={away.name} logo={away.logo} className="h-14 w-14 drop-shadow" />
      </div>
      <div className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--primary)_35%,var(--card)),var(--card))]">
        <div className="absolute inset-0 opacity-20 [background:repeating-linear-gradient(90deg,var(--foreground)_0_1px,transparent_1px_36px)]" />
        <div className="absolute inset-0 flex items-end">
          {photo(home.photo, home.name, "l")}
          {photo(away.photo, away.name, "r")}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/80 to-transparent" />
        <span className="absolute end-2 top-2 flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-[0.7rem] font-bold text-foreground backdrop-blur">
          <BadgeCheck className="h-3.5 w-3.5 text-primary" />{tx("Match highlights")}
        </span>
        {leagueLogo && <img src={leagueLogo} alt="" className="absolute start-2 top-2 h-7 w-7 object-contain" />}
        <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-foreground/80 bg-background/40 backdrop-blur transition group-hover:scale-110">
          <Play className="ms-0.5 h-5 w-5 fill-foreground text-foreground" />
        </span>
        <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground">
          {tx("Watch")}<ExternalLink className="h-3.5 w-3.5" />
        </span>
      </div>
    </a>
  );
}
