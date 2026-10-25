import { Play } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { useTx } from "@/lib/auto-translate";

type Side = { name?: string | null; logo?: string | null; photo?: string | null };

/** "Split duel" highlight poster: dark stadium night, each player inside a slanted team panel, score badge on the seam. */
export function MatchHighlightCard({ href, home, away, score, leagueLogo }: { href: string; home: Side; away: Side; score: string; leagueLogo?: string | null }) {
  const tx = useTx();
  const [h, a] = score.includes("-") ? score.split("-") : [score, ""];
  const panel = (side: Side, left: boolean) => (
    <div className="absolute inset-y-0 w-[56%] overflow-hidden"
      style={{ [left ? "left" : "right"]: 0, clipPath: left ? "polygon(0 0,100% 0,82% 100%,0 100%)" : "polygon(18% 0,100% 0,100% 100%,0 100%)" }}>
      <div className={`absolute inset-0 ${left ? "bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_70%,black),color-mix(in_oklab,var(--primary)_25%,black))]" : "bg-[linear-gradient(225deg,color-mix(in_oklab,var(--destructive)_60%,black),color-mix(in_oklab,var(--destructive)_20%,black))]"}`} />
      {side.logo && <img src={side.logo} alt="" className={`absolute top-1/2 h-[120%] -translate-y-1/2 object-contain opacity-[0.13] ${left ? "-left-[15%]" : "-right-[15%]"}`} />}
      <div className="absolute inset-0 opacity-20 [background:repeating-linear-gradient(0deg,transparent_0_3px,black_3px_4px)]" />
      {side.photo ? (
        <img src={side.photo} alt={side.name ?? ""} draggable={false}
          className={`absolute bottom-0 h-[95%] w-auto max-w-none object-contain object-bottom transition duration-500 group-hover:scale-105 ${left ? "left-[4%]" : "right-[4%]"}`} />
      ) : (
        <TeamCrest name={side.name} logo={side.logo} className={`absolute top-1/2 h-24 w-24 -translate-y-1/2 ${left ? "left-[18%]" : "right-[18%]"}`} />
      )}
    </div>
  );
  return (
    <a href={href} target="_blank" rel="noreferrer"
      style={{ imageRendering: "auto" }} className="group relative block aspect-[16/10] overflow-hidden rounded-3xl bg-[oklch(0.16_0.03_260)] shadow-xl ring-1 ring-border">
      {panel(home, true)}
      {panel(away, false)}
      {/* seam glow */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 skew-x-[-10deg] bg-[oklch(0.98_0_0)] opacity-80 blur-[1px]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[oklch(0.1_0.02_260)]/70 to-transparent" />

      <div className="absolute inset-x-3 top-3 flex items-center justify-between">
        {leagueLogo ? <img src={leagueLogo} alt="" className="h-8 w-8 rounded-full bg-[oklch(0.98_0_0)] object-contain p-1 shadow" /> : <span />}
        <span className="rounded-md bg-[oklch(0.98_0_0)] px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.25em] text-[oklch(0.16_0.03_260)]">{tx("Highlights")}</span>
      </div>

      {/* score medallion on the seam */}
      <div dir="ltr" className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
        <TeamCrest name={home.name} logo={home.logo} className="h-10 w-10 drop-shadow-lg" />
        <div className="flex items-stretch overflow-hidden rounded-xl text-3xl font-black tabular-nums leading-none shadow-2xl">
          <span className="grid min-w-[2.75rem] place-items-center bg-primary px-2 py-2 text-primary-foreground">{h.trim()}</span>
          {a !== "" && <span className="grid min-w-[2.75rem] place-items-center bg-[oklch(0.98_0_0)] px-2 py-2 text-[oklch(0.16_0.03_260)]">{a.trim()}</span>}
        </div>
        <TeamCrest name={away.name} logo={away.logo} className="h-10 w-10 drop-shadow-lg" />
      </div>

      <span className="absolute left-1/2 top-[42%] grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[oklch(0.98_0_0)] text-[oklch(0.16_0.03_260)] shadow-2xl transition group-hover:scale-110">
        <span className="absolute inset-0 animate-ping rounded-full bg-[oklch(0.98_0_0)] opacity-20" />
        <Play className="ms-0.5 h-6 w-6 fill-current" />
      </span>
    </a>
  );
}
