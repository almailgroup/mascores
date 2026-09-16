import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { FlagIcon } from "@/components/flag";
import { MatchNotificationButton } from "@/hooks/use-favorites";
import { useDates, useNum, useTx } from "@/lib/auto-translate";
import type { Match, Team } from "@/lib/db";
import { matchClockSeconds } from "@/lib/db";
import { useEffect, useState } from "react";

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
      {c?.logo_url ? <img src={c.logo_url} alt="" className="h-7 w-7 shrink-0 object-contain" /> : <Trophy className="h-6 w-6 shrink-0 text-primary" />}
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{name}</span>
        {c?.country ? (
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <FlagIcon value={c.country_code ?? c.country} />
            <span className="truncate">{tx(c.country)}</span>
          </span>
        ) : null}
      </span>
    </>
  );
  if (!c) return <div className="flex items-center gap-2.5 px-4 py-3">{inner}</div>;
  return (
    <Link to="/competitions/$slug" params={{ slug: c.slug }} className="flex items-center gap-2.5 px-4 py-3 hover:bg-accent">{inner}</Link>
  );
}

/** One compact fixture row: kickoff / status on the left, teams stacked, score or favourite on the right. */
export function MatchRow({ m, highlightTeamId }: { m: MatchWithTeams; highlightTeamId?: string }) {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const started = ["live", "ht", "ft", "aet", "pen", "awarded"].includes(m.status);
  const isLive = ["live", "ht"].includes(m.status);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!m.timer_running) return;
    const interval = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [m.timer_running]);
  const seconds = matchClockSeconds(m);
  const minute = Math.max(m.live_minute ?? 0, Math.floor(seconds / 60) + (seconds % 60 > 0 ? 1 : 0));
  const specialStatus = ["postponed", "cancelled", "interrupted"].includes(m.status);
  const finished = ["ft", "aet", "pen", "awarded"].includes(m.status);
  const highlightedScore = highlightTeamId === m.home_team_id ? [m.home_score, m.away_score] : highlightTeamId === m.away_team_id ? [m.away_score, m.home_score] : null;
  const outcome = highlightedScore && highlightedScore[0] != null && highlightedScore[1] != null
    ? highlightedScore[0] > highlightedScore[1] ? "W" : highlightedScore[0] < highlightedScore[1] ? "L" : "D"
    : null;
  const line = (team: Team | null | undefined, score: number | null) => (
    <div className="flex min-w-0 items-center gap-2">
      <TeamCrest name={team?.name} logo={team?.logo_url} className="h-5 w-5 shrink-0" />
      <span className={`min-w-0 flex-1 truncate text-sm ${highlightTeamId && team?.id === highlightTeamId ? "font-bold" : "font-medium"}`}>{tx(team?.name) ?? "TBD"}</span>
      {started && <span className="shrink-0 text-sm font-bold tabular-nums">{num(score ?? 0)}</span>}
    </div>
  );
  return (
    <Link to="/matches/$id" params={{ id: m.id }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent">
      <div className="w-14 shrink-0 text-center text-[0.7rem] leading-tight text-muted-foreground">
        {isLive ? (
          <span className="font-bold text-destructive">{m.status === "live" ? `${num(minute)}'` : "HT"}</span>
        ) : (
          <>
            <div className="tabular-nums">{num(dates.kickoff(m.kickoff_at))}</div>
            {(started || specialStatus) && <div className="font-semibold uppercase">{m.status === "ft" ? "FT" : m.status.toUpperCase()}</div>}
          </>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 border-s border-border ps-3">
        {line(m.home, m.home_score)}
        {line(m.away, m.away_score)}
      </div>
       <div className="flex shrink-0 items-center gap-1">
         {finished && outcome ? <span className={`grid h-7 w-7 place-items-center rounded-full text-[0.65rem] font-black ${outcome === "W" ? "bg-emerald-500/15 text-emerald-500" : outcome === "L" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>{outcome}</span> : <MatchNotificationButton matchId={m.id} teamIds={[m.home_team_id, m.away_team_id]} />}
       </div>

    </Link>
  );
}

