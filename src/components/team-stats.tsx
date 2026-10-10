import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { EventIcon } from "@/components/event-icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { fetchCompetitionStats, type PlayerStat } from "@/lib/comp-stats";
import { ratingClass } from "@/lib/db";
import { useNum, useTx } from "@/lib/auto-translate";
import { SeasonMenu } from "@/components/season-menu";
import { Button } from "@/components/ui/button";
import { BarChart3, Goal, ShieldCheck, Activity } from "lucide-react";

export type TeamComp = { id: string; name: string; logo_url: string | null; season: string | null };

/** Club-page statistics: the same leaderboards as the competition Stats tab, filtered to one club. */
export function TeamStats({ teamId, comps }: { teamId: string; comps: TeamComp[] }) {
  const tx = useTx();
  const num = useNum();
  const [active, setActive] = useState(comps[0]?.id ?? "");
  const [metric, setMetric] = useState<"rating" | "goals" | "assists" | "cards">("rating");
  const comp = comps.find((c) => c.id === active) ?? comps[0] ?? null;

  const q = useQuery({
    enabled: !!comp,
    queryKey: ["team-stats", comp?.id, comp?.season, teamId],
    queryFn: () => comp ? fetchCompetitionStats(comp.id, comp.season ?? null) : Promise.reject(new Error("No competition")),
  });

  if (comps.length === 0) return <EmptyState title={tx("No statistics yet")} />;

  const players = (q.data?.players ?? []).filter((p) => p.team_id === teamId);
  const team = (q.data?.teams ?? []).find((t) => t.team_id === teamId);

  return (
    <div className="space-y-4">
      <div data-no-gesture className="flex min-w-0 items-center justify-between gap-2 border-b border-border pb-3">
        <SeasonMenu label="Competition" seasons={comps.map(c => c.id)} value={comp?.id} onChange={setActive} className="min-w-0 max-w-full" formatValue={id => tx(comps.find(c => c.id === id)?.name) ?? ""} renderIcon={id => { const url=comps.find(c=>c.id===id)?.logo_url; return url ? <img src={url} alt="" className="h-5 w-5 shrink-0 object-contain" /> : null; }} />
        <span dir="ltr" className="shrink-0 text-xs font-medium text-muted-foreground">{comp?.season?.replace(/^(\d{2})\/(\d{2})$/, "20$1/20$2")}</span>
      </div>

      {q.isLoading ? <LoadingSkeleton /> : !team && players.length === 0 ? (
        <EmptyState title={tx("No statistics yet")} />
      ) : (
        <>
          {team && (
            <div className="grid grid-cols-3 gap-x-3 gap-y-5 border-b border-border pb-5 lg:grid-cols-6">
              {([
                [tx("Played"), num(team.played)],
                [tx("Goals"), num(team.goals_for)],
                [tx("Conceded"), num(team.goals_against)],
                [tx("Per match"), num(team.goals_per_match.toFixed(2))],
                [tx("Possession"), team.avg_possession == null ? "—" : `${num(Math.round(team.avg_possession))}%`],
                [tx("Clean sheets"), num(team.clean_sheets)],
              ] as const).map(([label, value]) => (
                <div key={label} className="min-w-0 border-s-2 border-border ps-3">
                  <div className="text-[0.65rem] font-medium text-muted-foreground">{label}</div>
                  <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          )}

          <div data-no-gesture className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
            {([['rating','Rating',BarChart3],['goals','Goals',Goal],['assists','Assists',Activity],['cards','Cards',ShieldCheck]] as const).map(([key,label,Icon]) => <Button key={key} variant="ghost" onClick={()=>setMetric(key)} aria-pressed={metric===key} className={`h-12 min-w-0 flex-col gap-1 rounded-md px-1 text-[0.65rem] ${metric===key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}><Icon className="h-4 w-4" />{tx(label)}</Button>)}
          </div>
          <div>
            {metric === "rating" && <Board title={tx("Average match rating")} rows={players.filter((p) => p.avg_rating != null).sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))}
              value={(p) => <span className={`rounded-md px-2 py-1 text-xs font-bold tabular-nums ${ratingClass(p.avg_rating ?? 0)}`}>{num((p.avg_rating ?? 0).toFixed(2))}</span>} />}
            {metric === "goals" && <Board title={tx("Goals scored")} rows={players.filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals)}
              value={(p) => <span className="text-sm font-bold tabular-nums">{num(p.goals)}</span>} />}
            {metric === "assists" && <Board title={tx("Assists")} rows={players.filter((p) => p.assists > 0).sort((a, b) => b.assists - a.assists)}
              value={(p) => <span className="text-sm font-bold tabular-nums">{num(p.assists)}</span>} />}
            {metric === "cards" && <Board title={tx("Cards")} rows={players.filter((p) => p.yellow + p.red > 0).sort((a, b) => b.red - a.red || b.yellow - a.yellow)}
              value={(p) => (
                <span className="flex items-center justify-end gap-1 text-xs font-semibold tabular-nums">
                  {p.yellow > 0 && <><EventIcon type="yellow" className="h-4 w-4" />{num(p.yellow)}</>}
                  {p.red > 0 && <><EventIcon type="red" className="h-4 w-4" />{num(p.red)}</>}
                </span>
              )} />}
          </div>
        </>
      )}
    </div>
  );
}

function Board({ title, rows, value }: { title: string; rows: PlayerStat[]; value: (p: PlayerStat) => React.ReactNode }) {
  const tx = useTx();
  const num = useNum();
  if (rows.length === 0) return <EmptyState title={tx("No statistics yet")} />;
  return (
    <section>
      <h3 className="border-b border-border py-3 text-sm font-bold">{title}</h3>
      <div className="divide-y divide-border">
        {rows.slice(0, 10).map((p, i) => (
          <Link key={p.player_id} to="/players/$id" params={{ id: p.player_id }} className="flex items-center gap-3 py-3 hover:bg-accent/50">
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
