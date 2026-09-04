import { Link } from "@tanstack/react-router";
import { TeamCrest } from "@/components/team-crest";
import type { Team, StandingRow } from "@/lib/db";
import type { Database } from "@/integrations/supabase/types";
import { useNum, useTx } from "@/lib/auto-translate";

type Label = Database["public"]["Tables"]["standings_position_labels"]["Row"];
export type PublicStandingRow = StandingRow & { team: Pick<Team, "id" | "name" | "logo_url" | "short_name"> | null };

function grouped(rows: PublicStandingRow[]) {
  const groups = new Map<string | null, PublicStandingRow[]>();
  rows.forEach((row) => {
    const key = row.group_label ?? null;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  return [...groups.entries()];
}

export function StandingsTable({ rows, labels, highlightTeamId }: { rows: PublicStandingRow[]; labels: Label[]; highlightTeamId?: string }) {
  const tx = useTx();
  const num = useNum();
  return <div className="space-y-6">
    {grouped(rows).map(([group, groupRows]) => {
      const groupLabels = labels.filter((label) => (label.group_label ?? null) === group);
      const used = groupRows.map((_, index) => groupLabels.find((label) => label.position === index + 1)).filter((label): label is Label => !!label).filter((label, index, list) => list.findIndex((item) => item.label === label.label) === index);
      return <section key={group ?? "single"}>
        {group && <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{tx(group)}</h3>}
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {/* Phone layout: no sideways scrolling, one tappable row per club. */}
          <div className="sm:hidden">
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2rem_2.25rem_2.5rem] items-center gap-1 bg-gradient-to-r from-primary/10 via-muted/40 to-primary/10 px-3 py-2 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
              <span>#</span><span>{tx("Team")}</span><span className="text-center">P</span><span className="text-center">GD</span><span className="text-center">Pts</span>
            </div>
            <div className="divide-y divide-border">
              {groupRows.map((row, index) => {
                const label = groupLabels.find((item) => item.position === index + 1);
                const selected = row.team_id === highlightTeamId;
                const inner = <>
                  <span className="flex items-center gap-1.5">
                    <span className="h-6 w-1 rounded-full" style={{ backgroundColor: label?.color ?? "transparent" }} />
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[0.7rem] font-bold tabular-nums">{num(index + 1)}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <TeamCrest name={row.team?.name} logo={row.team?.logo_url ?? null} className="h-6 w-6 shrink-0" />
                    <span className="truncate text-sm font-semibold">{tx(row.team?.short_name || row.team?.name || "—")}</span>
                  </span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.played)}</span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.gf - row.ga)}</span>
                  <span className="text-center text-sm font-black tabular-nums text-primary">{num(row.points + row.points_adjust)}</span>
                </>;
                const cls = `grid grid-cols-[2.75rem_minmax(0,1fr)_2rem_2.25rem_2.5rem] items-center gap-1 px-3 py-2.5 active:bg-muted/60 ${selected ? "bg-primary/10" : ""}`;
                return row.team
                  ? <Link key={row.id} to="/teams/$id" params={{ id: row.team.id }} className={cls}>{inner}</Link>
                  : <div key={row.id} className={cls}>{inner}</div>;
              })}
            </div>
          </div>
          {/* Tablet and up: the full statistics grid. */}
          <div className="hidden sm:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-gradient-to-r from-primary/10 via-muted/40 to-primary/10 text-[0.65rem] font-semibold uppercase text-muted-foreground"><tr>
                <th className="w-10 py-2.5 text-center">#</th><th className="py-2.5 ps-1 text-start">{tx("Team")}</th>
                <th className="w-9 py-2.5 text-center">P</th><th className="w-9 py-2.5 text-center">W</th><th className="w-9 py-2.5 text-center">D</th><th className="w-9 py-2.5 text-center">L</th>
                <th className="w-9 py-2.5 text-center">GF</th><th className="w-9 py-2.5 text-center">GA</th><th className="w-9 py-2.5 text-center">GD</th><th className="w-12 py-2.5 pe-3 text-center">Pts</th>
              </tr></thead>
              <tbody>{groupRows.map((row, index) => {
                const label = groupLabels.find((item) => item.position === index + 1);
                const selected = row.team_id === highlightTeamId;
                return <tr key={row.id} className={`border-t border-border align-middle transition-colors hover:bg-muted/40 ${selected ? "bg-primary/10 font-semibold" : ""}`} style={{ borderInlineStart: label ? `4px solid ${label.color}` : "4px solid transparent" }}>
                  <td className="py-2.5 text-center"><span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-muted text-xs font-bold tabular-nums">{num(index + 1)}</span></td>
                  <td className="py-2.5 ps-1">{row.team ? <Link to="/teams/$id" params={{ id: row.team.id }} className="flex min-w-0 items-center gap-2 font-medium hover:text-primary"><TeamCrest name={row.team.name} logo={row.team.logo_url} className="h-5 w-5 shrink-0" /><span className="truncate">{tx(row.team.name)}</span></Link> : "—"}</td>
                  <td className="py-2.5 text-center tabular-nums">{num(row.played)}</td><td className="py-2.5 text-center tabular-nums">{num(row.won)}</td><td className="py-2.5 text-center tabular-nums">{num(row.drawn)}</td><td className="py-2.5 text-center tabular-nums">{num(row.lost)}</td>
                  <td className="py-2.5 text-center tabular-nums">{num(row.gf)}</td><td className="py-2.5 text-center tabular-nums">{num(row.ga)}</td><td className="py-2.5 text-center tabular-nums">{num(row.gf - row.ga)}</td><td className="py-2.5 pe-3 text-center font-black tabular-nums text-primary">{num(row.points + row.points_adjust)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
        {used.length > 0 && <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">{used.map((label) => <span key={label.id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />{tx(label.label)}</span>)}</div>}
      </section>;
    })}
  </div>;
}
