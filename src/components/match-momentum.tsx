import { type Team } from "@/lib/db";
import { EventIcon } from "@/components/event-icon";
import { TeamCrest } from "@/components/team-crest";
import { useTx } from "@/lib/auto-translate";

export type MomentumEvent = { minute: number | null; type: string; team_id: string | null };

/** How strongly each event type pushes momentum, and how long its influence lasts (minutes). */
const WEIGHTS: Record<string, number> = {
  goal: 100, penalty_goal: 100, penalty: 100,
  penalty_miss: 55, missed_penalty: 55,
  own_goal: -85, var: 45, assist: 60,
  yellow: -35, second_yellow: -60, red: -75,
  substitution: 20, sub: 20,
};
const SPREAD = 7;

/** Momentum derived automatically from the match events — no manual drawing needed. */
function deriveMomentum(events: MomentumEvent[], total: number, homeId?: string, awayId?: string) {
  const values = new Array(total).fill(0) as number[];
  for (const e of events) {
    if (e.minute == null || !e.team_id) continue;
    const weight = WEIGHTS[e.type];
    if (!weight) continue;
    // positive = home pressure (blue, on top), negative = away pressure (green, below)
    const side = e.team_id === homeId ? 1 : e.team_id === awayId ? -1 : 0;
    if (!side) continue;
    const at = Math.min(Math.max(e.minute, 1), total);
    for (let m = Math.max(1, at - SPREAD); m <= Math.min(total, at + SPREAD); m++) {
      const falloff = 1 - Math.abs(m - at) / (SPREAD + 1);
      values[m - 1] += side * weight * falloff;
    }
  }
  return values.map((v, i) => ({ minute: i + 1, value: Math.max(-100, Math.min(100, Math.round(v))) }));
}

/** Match momentum: brand blue for home, green for away, theme-aware half-time line. */
export function MatchMomentum({
  home, away, minutes = 90, events = [],
}: { matchId: string; home: Team | null; away: Team | null; minutes?: number; events?: MomentumEvent[] }) {
  const tx = useTx();
  const total = Math.max(minutes, 90, ...events.map((e) => e.minute ?? 0));
  const list = deriveMomentum(events, total, home?.id, away?.id);
  if (list.every((item) => item.value === 0)) return null;
  const marks = events.filter((e) => e.minute != null && ["goal", "penalty_goal", "own_goal"].includes(e.type));

  // Normalise so the strongest spell fills the chart, then lightly smooth for a clean wave.
  const peak = Math.max(1, ...list.map((x) => Math.abs(x.value)));
  const vals = list.map((_, i) => {
    const w = [list[i - 1]?.value ?? 0, list[i].value * 2, list[i + 1]?.value ?? 0];
    return (w[0] + w[1] + w[2]) / 4 / peak;
  });
  const W = 300, H = 120, mid = H / 2;
  const x = (i: number) => ((i + 0.5) / total) * W;


  // Stack icons that would overlap (closer than ~5% of the width) into extra rows.
  const lane = (side: "home" | "away") => {
    const list2 = marks.filter((e) => (side === "home" ? e.team_id === home?.id : e.team_id === away?.id))
      .map((e) => ({ e, pos: ((Math.min(e.minute ?? 0, total) - 0.5) / total) * 100 })).sort((a, b) => a.pos - b.pos);
    const rows: number[] = [];
    const placed = list2.map((m) => {
      let r = rows.findIndex((last) => m.pos - last >= 5);
      if (r === -1) { r = rows.length; rows.push(m.pos); } else rows[r] = m.pos;
      return { ...m, row: r };
    });
    const n = Math.max(1, rows.length);
    return (
      <div className="relative" style={{ height: `${n * 18}px` }}>
        {placed.map(({ e, pos, row }, i) => (
          <span key={i} className="absolute -translate-x-1/2" style={{ left: `${pos}%`, [side === "home" ? "bottom" : "top"]: `${row * 18}px` }}>
            <EventIcon type={e.type} className="h-3.5 w-3.5" />
          </span>
        ))}
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-wide">{tx("Match momentum")}</h3>
      <div className="flex items-stretch gap-2">
        <div className="flex w-7 shrink-0 flex-col justify-between">
          <TeamCrest name={home?.name} logo={home?.logo_url} className="h-6 w-6" />
          <TeamCrest name={away?.name} logo={away?.logo_url} className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          {lane("home")}
          <div className="relative my-1 h-32 overflow-hidden rounded-lg bg-muted/40">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              {vals.map((value, i) => value !== 0 && (
                <line key={i} x1={x(i)} x2={x(i)} y1={mid} y2={mid - value * (mid - 4)} className={value > 0 ? "stroke-primary" : "stroke-success"} strokeWidth={1.6} />
              ))}
              <line x1="0" x2={W} y1={mid} y2={mid} className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1={(45 / total) * W} x2={(45 / total) * W} y1="0" y2={H} className="stroke-muted-foreground" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="absolute bottom-0.5 text-[0.55rem] font-semibold text-muted-foreground" style={{ left: `calc(${(45 / total) * 100}% + 3px)` }}>HT</span>
          </div>
          {lane("away")}
        </div>
      </div>
    </section>
  );
}