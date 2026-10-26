import { Play } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { useTx } from "@/lib/auto-translate";

type Side = { name?: string | null; logo?: string | null; photo?: string | null };

/** Highlight poster: dark night backdrop, each player as a crisp framed portrait with crest badge, score in the middle. */
export function MatchHighlightCard({ href, home, away, score, leagueLogo }: { href: string; home: Side; away: Side; score: string; leagueLogo?: string | null }) {
  const tx = useTx();
  const [h, a] = score.includes("-") ? score.split("-").map((s) => s.trim()) : [score, ""];
  const portrait = (side: Side, accent: string) => (
    <div className="relative flex flex-col items-center">
      <div className="relative h-24 w-24 rounded-full p-[3px] shadow-2xl sm:h-32 sm:w-32" style={{ background: accent }}>
        <div className="h-full w-full overflow-hidden rounded-full bg-[oklch(0.98_0_0)]">
          {side.photo
            ? <img src={side.photo} alt={side.name ?? ""} draggable={false} className="h-full w-full object-cover object-top" />
            : <div className="grid h-full w-full place-items-center"><TeamCrest name={side.name} logo={side.logo} className="h-14 w-14" /></div>}
        </div>
        <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-[oklch(0.98_0_0)] p-1 shadow-lg">
          <TeamCrest name={side.name} logo={side.logo} className="h-7 w-7" />
        </span>
      </div>
      <span className="mt-2 max-w-[7.5rem] truncate text-center text-xs font-bold text-[oklch(0.98_0_0)]">{tx(side.name)}</span>
    </div>
  );
  return (
    <a href={href} target="_blank" rel="noreferrer" dir="ltr"
      className="group relative block overflow-hidden rounded-3xl bg-[oklch(0.17_0.04_260)] px-4 pb-5 pt-4 shadow-xl ring-1 ring-border">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_60%,color-mix(in_oklab,var(--primary)_45%,transparent),transparent_55%),radial-gradient(circle_at_85%_60%,color-mix(in_oklab,var(--destructive)_40%,transparent),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(90deg,oklch(0.98_0_0)_0_1px,transparent_1px_28px)]" />

      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[0.65rem] font-black uppercase tracking-[0.25em] text-[oklch(0.98_0_0)]">
          <span className="h-2 w-2 rounded-full bg-destructive" />{tx("Highlights")}
        </span>
        {leagueLogo && <img src={leagueLogo} alt="" className="h-7 w-7 rounded-full bg-[oklch(0.98_0_0)] object-contain p-0.5" />}
      </div>

      <div className="relative mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {portrait(home, "linear-gradient(135deg,var(--primary),oklch(0.98_0_0))")}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5 text-4xl font-black tabular-nums leading-none text-[oklch(0.98_0_0)]">
            <span>{h}</span>{a !== "" && <><span className="text-2xl opacity-50">-</span><span>{a}</span></>}
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[oklch(0.98_0_0)] text-[oklch(0.17_0.04_260)] shadow-xl transition group-hover:scale-110">
            <Play className="ms-0.5 h-5 w-5 fill-current" />
          </span>
        </div>
        {portrait(away, "linear-gradient(225deg,var(--destructive),oklch(0.98_0_0))")}
      </div>
    </a>
  );
}
