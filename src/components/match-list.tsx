import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { FlagIcon } from "@/components/flag";
import { MatchNotificationButton } from "@/hooks/use-favorites";
import { useDates, useNum, useTx } from "@/lib/auto-translate";
import type { Match, Team } from "@/lib/db";
import { matchWinner } from "@/lib/match-result";

export type MatchWithTeams = Match & {
  home: Team | null;
  away: Team | null;
  competition: { slug: string; name: string; logo_url: string | null; country?: string | null; country_code?: string | null } | null;
};

/**
 * Group labels ("Group B") for the competitions in a list, taken from the
 * standings rows so a match card can say "League, Group B" like the reference apps.
 */
export function useMatchGroupLabels(data: MatchWithTeams[]) {
  const compIds = [...new Set(data.map((m) => m.competition_id).filter(Boolean))].sort();
  const q = useQuery({
    enabled: compIds.length > 0,
    queryKey: ["match-group-labels", compIds.join(",")],
    queryFn: async () => {
      const { data: rows } = await supabase.from("standings_rows")
        .select("competition_id,team_id,season,group_label").in("competition_id", compIds);
      const map: Record<string, string> = {};
      for (const row of rows ?? []) {
        if (!row.group_label) continue;
        map[`${row.competition_id}|${row.season ?? ""}|${row.team_id}`] = row.group_label;
      }
      return map;
    },
  });
  const map = q.data ?? {};
  return (m: MatchWithTeams) => {
    const season = m.season ?? "";
    for (const teamId of [m.home_team_id, m.away_team_id]) {
      if (!teamId) continue;
      const hit = map[`${m.competition_id}|${season}|${teamId}`] ?? map[`${m.competition_id}||${teamId}`];
      if (hit) return hit;
    }
    return null;
  };
}

/** Keeps the list in date order: a new card only starts when the competition changes. */
function runs(data: MatchWithTeams[]) {
  const out: { key: string; matches: MatchWithTeams[] }[] = [];
  data.forEach((m, index) => {
    const key = m.competition?.slug ?? "other";
    const last = out[out.length - 1];
    if (last && last.matches[0].competition?.slug === m.competition?.slug) last.matches.push(m);
    else out.push({ key: `${key}|${index}`, matches: [m] });
  });
  return out;
}

/** Sofascore-style grouped list: one card per competition run, compact rows inside. */
export function MatchGroups({ data, highlightTeamId }: { data: MatchWithTeams[]; highlightTeamId?: string }) {
  return (
    <div className="space-y-3">
      {runs(data).map((run) => (
        <div key={run.key} className="overflow-hidden rounded-2xl border border-border bg-card">
          <CompHeader m={run.matches[0]} />
          <div className="divide-y divide-border">
            {run.matches.map((m) => <MatchRow key={m.id} m={m} highlightTeamId={highlightTeamId} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CompHeader({ m, group }: { m: MatchWithTeams; group?: string | null }) {
  const tx = useTx();
  const c = m.competition;
  const name = [tx(c?.name) ?? tx("Matches"), group ? tx(group) : null].filter(Boolean).join(", ");
  const inner = (
    <>
      {c?.logo_url ? <img src={c.logo_url} alt="" className="h-6 w-6 shrink-0 object-contain" /> : <Trophy className="h-5 w-5 shrink-0 text-primary" />}
      <span className="min-w-0">
        <span className="block truncate text-[0.8rem] font-bold">{name}</span>
        {c?.country ? (
          <span className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
            <FlagIcon value={c.country_code ?? c.country} />
            <span className="truncate">{tx(c.country)}</span>
          </span>
        ) : null}
      </span>
    </>
  );
  if (!c) return <div className="flex items-center gap-2 px-3.5 py-2">{inner}</div>;
  return (
    <Link to="/competitions/$slug" params={{ slug: c.slug }} className="flex items-center gap-2 px-3.5 py-2 hover:bg-accent">{inner}</Link>
  );
}

/** One compact fixture row: kickoff / status on the left, teams stacked, score or favourite on the right. */
export function MatchRow({ m, highlightTeamId }: { m: MatchWithTeams; highlightTeamId?: string }) {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const started = ["live", "ht", "ft", "aet", "pen", "awarded"].includes(m.status);
  const isLive = ["live", "ht"].includes(m.status);
  const specialStatus = ["postponed", "cancelled", "interrupted"].includes(m.status);
  const finished = ["ft", "aet", "pen", "awarded"].includes(m.status);
  const winner = matchWinner(m);
  const highlightedSide = highlightTeamId === m.home_team_id ? "home" : highlightTeamId === m.away_team_id ? "away" : null;
  const outcome = highlightedSide ? winner ? winner === highlightedSide ? "W" : "L" : "D" : null;
  const line = (team: Team | null | undefined, score: number | null, _side: "home" | "away", pens: number | null) => (
    <div className="flex min-w-0 items-center gap-1.5">
      <TeamCrest name={team?.name} logo={team?.logo_url} className="h-4.5 w-4.5 shrink-0" />
      <span className={`min-w-0 flex-1 truncate text-[0.8rem] ${highlightTeamId && team?.id === highlightTeamId ? "font-bold" : "font-medium"}`}>{tx(team?.name) ?? "TBD"}</span>
      {started && <span className="shrink-0 text-[0.8rem] font-bold tabular-nums">{num(score ?? 0)}{m.status === "pen" && pens != null && <span className="ms-1 text-[0.7rem] text-muted-foreground">({num(pens)})</span>}</span>}
    </div>
  );
  const shortDate = m.kickoff_at
    ? num(dates.date(m.kickoff_at, { day: "2-digit", month: "2-digit", year: "2-digit" }))
    : m.kickoff_date ? num(dates.date(`${m.kickoff_date}T12:00:00Z`, { day: "2-digit", month: "2-digit", year: "2-digit" })) : "—";
  const timeOnly = m.kickoff_at ? num(dates.time(m.kickoff_at)) : "";
  return (
    <Link data-fixture-id={m.id} to="/matches/$id" params={{ id: m.id }} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-accent">
      <div className="w-[3.6rem] shrink-0 text-center text-[0.65rem] leading-tight text-muted-foreground">
        {isLive ? (
          <span className="font-bold text-primary">{m.status === "live" ? "LIVE" : "HT"}</span>
        ) : specialStatus ? (
          <span className="block font-semibold">{tx(m.status.charAt(0).toUpperCase() + m.status.slice(1))}</span>
        ) : (
          <>
            <div className="tabular-nums">{shortDate}</div>
            {started
              ? <div className="font-semibold uppercase">{m.status === "ft" ? "FT" : m.status.toUpperCase()}</div>
              : timeOnly
                ? <div className="tabular-nums">{timeOnly}</div>
                : <div className="font-semibold uppercase">TBD</div>}
          </>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1 border-s border-border ps-2.5">
        {line(m.home, m.home_score, "home", m.home_pen)}
        {line(m.away, m.away_score, "away", m.away_pen)}
        {m.status === "pen" && winner && <div className="text-[0.65rem] font-medium text-primary">{tx(winner === "home" ? m.home?.name : m.away?.name)} · {tx("Won on penalties")}</div>}
      </div>
       <div className="flex shrink-0 items-center gap-1">
         {finished && outcome ? <span className={`grid h-6 w-6 place-items-center rounded-full text-[0.6rem] font-black ${outcome === "W" ? "bg-emerald-500/15 text-emerald-500" : outcome === "L" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>{outcome}</span> : <MatchNotificationButton matchId={m.id} competitionId={m.competition_id} teamIds={[m.home_team_id, m.away_team_id]} />}
       </div>

    </Link>
  );
}

