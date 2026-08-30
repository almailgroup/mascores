import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { EventIcon } from "@/components/event-icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { fetchCompetitionStats, type PlayerStat } from "@/lib/comp-stats";
import { ratingClass } from "@/lib/db";
import { useNum, useTx } from "@/lib/auto-translate";

export type TeamComp = { id: string; name: string; logo_url: string | null; season: string | null };

/** Club-page statistics: the same leaderboards as the competition Stats tab, filtered to one club. */
export function TeamStats({ teamId, comps }: { teamId: string; comps: TeamComp[] }) {
  const tx = useTx();
  const num = useNum();
  const [active, setActive] = useState(comps[0]?.id ?? "");
  const comp = comps.find((c) => c.id === active) ?? comps[0] ?? null;

  const q = useQuery({
    enabled: !!comp,
    queryKey: ["team-stats", comp?.id, comp?.season, teamId],
    queryFn: () => fetchCompetitionStats(comp!.id, comp!.season ?? null),
  });

  if (comps.length === 0) return <EmptyState title={tx("No statistics yet")} />;

  const players = (q.data?.players ?? []).filter((p) => p.team_id === teamId);
  const team = (q.data?.teams ?? []).find((t) => t.team_id === teamId);

  return (
    <div className="space-y-4">
      {comps.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {comps.map((c) => (
            <button key={c.id} onClick={() => setActive(c.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${c.id === comp?.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {c.logo_url && <img src={c.logo_url} alt="" className="h-4 w-4 object-contain" />}
              {tx(c.name)}
            </button>
          ))}
        </div>
      )}

      {q.isLoading ? <LoadingSkeleton /> : !team && players.length === 0 ? (
        <EmptyState title={tx("No statistics yet")} />
      ) : (
        <>
          {team && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {([
                [tx("Played"), num(team.played)],
                [tx("Goals"), num(team.goals_for)],
                [tx("Conceded"), num(team.goals_against)],
                [tx("Per match"), num(team.goals_per_match.toFixed(2))],
                [tx("Possession"), team.avg_possession == null ? "—" : `${num(Math.round(team.avg_possession))}%`],
                [tx("Clean sheets"), num(team.clean_sheets)],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-3">
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="mt-1 text-lg font-black tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Board title={tx("Average match rating")} rows={players.filter((p) => p.avg_rating != null).sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))}
              value={(p) => <span className={`rounded-md px-2 py-1 text-xs font-bold tabular-nums ${ratingClass(p.avg_rating ?? 0)}`}>{num((p.avg_rating ?? 0).toFixed(2))}</span>} />
            <Board title={tx("Goals scored")} rows={players.filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals)}
              value={(p) => <span className="text-sm font-bold tabular-nums">{num(p.goals)}</span>} />
            <Board title={tx("Assists")} rows={players.filter((p) => p.assists > 0).sort((a, b) => b.assists - a.assists)}
              value={(p) => <span className="text-sm font-bold tabular-nums">{num(p.assists)}</span>} />
            <Board title={tx("Cards")} rows={players.filter((p) => p.yellow + p.red > 0).sort((a, b) => b.red - a.red || b.yellow - a.yellow)}
              value={(p) => (
                <span className="flex items-center justify-end gap-1 text-xs font-semibold tabular-nums">
                  {p.yellow > 0 && <><EventIcon type="yellow" className="h-4 w-4" />{num(p.yellow)}</>}
                  {p.red > 0 && <><EventIcon type="red" className="h-4 w-4" />{num(p.red)}</>}
                </span>
              )} />
          </div>
        </>
      )}
    </div>
  );
}

function Board({ title, rows, value }: { title: string; rows: PlayerStat[]; value: (p: PlayerStat) => React.ReactNode }) {
  const tx = useTx();
  const num = useNum();
  if (rows.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <h3 className="border-b border-border px-4 py-3 text-sm font-bold">{title}</h3>
      <div className="divide-y divide-border">
        {rows.slice(0, 10).map((p, i) => (
          <Link key={p.player_id} to="/players/$id" params={{ id: p.player_id }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50">
            <span className="w-4 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{num(i + 1)}</span>
            <PlayerAvatar src={p.photo_url} name={p.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{tx(p.name)}</span>
              <span className="truncate text-xs text-muted-foreground">{num(p.appearances)} {tx("matches")}</span>
            </span>
            <span className="shrink-0">{value(p)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
