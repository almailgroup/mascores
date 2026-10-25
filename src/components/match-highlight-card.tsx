import { Play } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { portraitSource } from "@/lib/portrait-source";
import { useTx } from "@/lib/auto-translate";

type Side = { name?: string | null; logo?: string | null; photo?: string | null };

/** Cinematic highlight poster: featured player per team facing each other, score plate at the bottom. */
export function MatchHighlightCard({ href, home, away, score, leagueLogo }: { href: string; home: Side; away: Side; score: string; leagueLogo?: string | null }) {
  const tx = useTx();
  const player = (side: Side, align: "l" | "r") => (
    <div className={`absolute bottom-0 h-[92%] w-[52%] ${align === "l" ? "left-0" : "right-0"}`}>
      {side.photo ? (
        <img src={portraitSource(side.photo) ?? side.photo} alt={side.name ?? ""} draggable={false}
          className={`h-full w-full object-cover object-top drop-shadow-2xl ${align === "l" ? "[mask-image:linear-gradient(to_right,black_60%,transparent)]" : "[mask-image:linear-gradient(to_left,black_60%,transparent)]"}`} />
      ) : (
        <div className="grid h-full place-items-center"><TeamCrest name={side.name} logo={side.logo} className="h-24 w-24 opacity-40" /></div>
      )}
    </div>
  );
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="group relative block aspect-[16/10] overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
      {/* backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_oklab,var(--primary)_55%,transparent),transparent_70%),linear-gradient(160deg,color-mix(in_oklab,var(--primary)_25%,var(--background)),var(--background))]" />
      <div className="absolute inset-0 opacity-[0.12] [background:repeating-linear-gradient(115deg,var(--foreground)_0_2px,transparent_2px_22px)]" />
      {home.logo && <img src={home.logo} alt="" className="absolute -left-6 top-4 h-40 w-40 object-contain opacity-15 blur-[1px]" />}
      {away.logo && <img src={away.logo} alt="" className="absolute -right-6 top-4 h-40 w-40 object-contain opacity-15 blur-[1px]" />}

      {player(home, "l")}
      {player(away, "r")}

      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background via-background/70 to-transparent" />

      {/* top bar */}
      <div className="absolute inset-x-3 top-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[0.65rem] font-black uppercase tracking-widest text-primary-foreground shadow">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />{tx("Highlights")}
        </span>
        {leagueLogo && <img src={leagueLogo} alt="" className="h-8 w-8 rounded-full bg-background/70 object-contain p-1 backdrop-blur" />}
      </div>

      {/* play */}
      <span className="absolute left-1/2 top-[40%] grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-primary/30 transition group-hover:scale-110">
        <Play className="ms-0.5 h-6 w-6 fill-current" />
      </span>

      {/* score plate */}
      <div dir="ltr" className="absolute inset-x-0 bottom-3 flex justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/85 px-4 py-2 shadow-lg backdrop-blur">
          <TeamCrest name={home.name} logo={home.logo} className="h-9 w-9" />
          <span className="text-3xl font-black leading-none tracking-tight tabular-nums text-foreground">{score}</span>
          <TeamCrest name={away.name} logo={away.logo} className="h-9 w-9" />
        </div>
      </div>
    </a>
  );
}
