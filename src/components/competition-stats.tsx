import { EventIcon } from "@/components/event-icon";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { TeamCrest } from "@/components/team-crest";
import { PlayerAvatar } from "@/components/player-avatar";
import { fetchCompetitionStats, type PlayerStat, type TeamStat } from "@/lib/comp-stats";
import { ratingClass } from "@/lib/db";
import { useNum, useTx } from "@/lib/auto-translate";

type Mode = "players" | "teams";

/** Season-scoped statistics for a competition: player leaderboards and team averages. */
export function CompetitionStats({ competitionId, season }: { competitionId: string; season: string | null }) {
  const tx = useTx();
  const [mode, setMode] = useState<Mode>("players");
  const q = useQuery({
    queryKey: ["comp-stats", competitionId, season],
    queryFn: () => fetchCompetitionStats(competitionId, season),
  });

  return (
    <div>
      <div className="mb-4 inline-flex gap-1 rounded-full border border-border bg-card p-1 text-xs">
        {(["players", "teams"] as const).map((item) => (
          <button key={item} onClick={() => setMode(item)}
            className={`rounded-full px-4 py-1.5 font-semibold capitalize ${mode === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {tx(item === "players" ? "Players" : "Teams")}
          </button>
        ))}
      </div>

      {q.isLoading ? <LoadingSkeleton /> : !q.data || q.data.matches === 0 ? (
        <EmptyState title={tx("No statistics yet")} />
      ) : mode === "players" ? <PlayerStats rows={q.data.players} /> : <TeamStats rows={q.data.teams} />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const tx = useTx();
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <h3 className="border-b border-border px-4 py-3 text-sm font-bold">{tx(title)}</h3>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function PlayerRow({ p, value, rank }: { p: PlayerStat; value: React.ReactNode; rank: number }) {
  const tx = useTx();
  const num = useNum();
  return (
    <Link to="/players/$id" params={{ id: p.player_id }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50">
      <span className="w-4 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{num(rank)}</span>
      <PlayerAvatar src={p.photo_url} name={p.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{tx(p.name)}</span>
        <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          {p.team_logo && <img src={p.team_logo} alt="" className="h-3.5 w-3.5 object-contain" />}
          {tx(p.team_name) || "—"} · {num(p.appearances)} {tx("matches")}
        </span>
      </span>
      <span className="shrink-0">{value}</span>
    </Link>
  );
}

function PlayerStats({ rows }: { rows: PlayerStat[] }) {
  const num = useNum();
  const rated = rows.filter((p) => p.avg_rating != null).sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0)).slice(0, 10);
  const scorers = rows.filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 10);
  const assisters = rows.filter((p) => p.assists > 0).sort((a, b) => b.assists - a.assists).slice(0, 10);
  const booked = rows.filter((p) => p.yellow + p.red > 0).sort((a, b) => b.red - a.red || b.yellow - a.yellow).slice(0, 10);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Average match rating">
        {rated.map((p, i) => (
          <PlayerRow key={p.player_id} p={p} rank={i + 1}
            value={<span className={`rounded-md px-2 py-1 text-xs font-bold tabular-nums ${ratingClass(p.avg_rating ?? 0)}`}>{num((p.avg_rating ?? 0).toFixed(2))}</span>} />
        ))}
      </Card>
      <Card title="Goals scored">
        {scorers.map((p, i) => <PlayerRow key={p.player_id} p={p} rank={i + 1} value={<span className="text-sm font-bold tabular-nums">{num(p.goals)}</span>} />)}
      </Card>
      <Card title="Assists">
        {assisters.map((p, i) => <PlayerRow key={p.player_id} p={p} rank={i + 1} value={<span className="text-sm font-bold tabular-nums">{num(p.assists)}</span>} />)}
      </Card>
      <Card title="Cards">
        {booked.map((p, i) => (
          <PlayerRow key={p.player_id} p={p} rank={i + 1}
            value={<span className="flex items-center justify-end gap-1 text-xs font-semibold tabular-nums">{p.yellow > 0 && <><EventIcon type="yellow" className="h-4 w-4" />{num(p.yellow)}</>}{p.red > 0 && <><EventIcon type="red" className="h-4 w-4" />{num(p.red)}</>}</span>} />
        ))}
      </Card>
    </div>
  );
}

function TeamStats({ rows }: { rows: TeamStat[] }) {
  const tx = useTx();
  const num = useNum();
  const sorted = [...rows].sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0) || b.goals_for - a.goals_for);
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/50 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2.5 ps-4 text-start">{tx("Team")}</th>
            <th className="w-10 py-2.5 text-center">P</th>
            <th className="w-16 py-2.5 text-center">{tx("Rating")}</th>
            <th className="w-14 py-2.5 text-center">{tx("Goals")}</th>
            <th className="w-16 py-2.5 text-center">{tx("Per match")}</th>
            <th className="w-16 py-2.5 text-center">{tx("Conceded")}</th>
            <th className="w-20 py-2.5 text-center">{tx("Possession")}</th>
            <th className="w-14 py-2.5 text-center">{tx("Shots")}</th>
            <th className="w-16 py-2.5 pe-4 text-center">{tx("Cards")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.team_id} className="border-t border-border">
              <td className="py-2.5 ps-4">
                <Link to="/teams/$id" params={{ id: t.team_id }} className="flex min-w-0 items-center gap-2 font-medium hover:text-primary">
                  <TeamCrest name={t.name} logo={t.logo_url} className="h-5 w-5 shrink-0" />
                  <span className="truncate">{tx(t.name)}</span>
                </Link>
              </td>
              <td className="py-2.5 text-center tabular-nums">{num(t.played)}</td>
              <td className="py-2.5 text-center">
                {t.avg_rating == null ? "—" : <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${ratingClass(t.avg_rating)}`}>{num(t.avg_rating.toFixed(2))}</span>}
              </td>
              <td className="py-2.5 text-center font-semibold tabular-nums">{num(t.goals_for)}</td>
              <td className="py-2.5 text-center tabular-nums">{num(t.goals_per_match.toFixed(2))}</td>
              <td className="py-2.5 text-center tabular-nums">{num(t.goals_against)}</td>
              <td className="py-2.5 text-center tabular-nums">{t.avg_possession == null ? "—" : `${num(Math.round(t.avg_possession))}%`}</td>
              <td className="py-2.5 text-center tabular-nums">{t.avg_shots == null ? "—" : num(t.avg_shots.toFixed(1))}</td>
              <td className="py-2.5 pe-4 text-xs tabular-nums"><span className="flex items-center justify-center gap-1"><EventIcon type="yellow" className="h-4 w-4" />{num(t.yellow)}<EventIcon type="red" className="h-4 w-4" />{num(t.red)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
