import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TeamCrest } from "@/components/team-crest";
import { supabase } from "@/integrations/supabase/client";
import type { Team, StandingRow } from "@/lib/db";
import type { Database } from "@/integrations/supabase/types";
import { useNum, useTx } from "@/lib/auto-translate";

type Label = Database["public"]["Tables"]["standings_position_labels"]["Row"];
export type PublicStandingRow = StandingRow & { team: Pick<Team, "id" | "name" | "logo_url" | "short_name"> | null };
type View = "full" | "form" | "short";

function grouped(rows: PublicStandingRow[]) {
  const groups = new Map<string | null, PublicStandingRow[]>();
  rows.forEach((row) => {
    const key = row.group_label ?? null;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  return [...groups.entries()];
}

/** Last five finished results per team, taken from the same competition/season as the table. */
function useForm(rows: PublicStandingRow[], enabled: boolean) {
  const competitionId = rows[0]?.competition_id ?? null;
  const season = rows[0]?.season ?? null;
  return useQuery({
    enabled: enabled && !!competitionId,
    queryKey: ["standings-form", competitionId, season],
    queryFn: async () => {
      let query = supabase
        .from("matches")
        .select("home_team_id,away_team_id,home_score,away_score,kickoff_at,status")
        .eq("competition_id", competitionId!)
        .in("status", ["finished", "awarded"])
        .order("kickoff_at", { ascending: false })
        .limit(400);
      if (season) query = query.eq("season", season);
      const { data } = await query;
      const map = new Map<string, ("W" | "D" | "L")[]>();
      for (const match of data ?? []) {
        const hs = match.home_score ?? 0;
        const as = match.away_score ?? 0;
        const add = (teamId: string | null, own: number, other: number) => {
          if (!teamId) return;
          const list = map.get(teamId) ?? [];
          if (list.length >= 5) return;
          list.push(own > other ? "W" : own < other ? "L" : "D");
          map.set(teamId, list);
        };
        add(match.home_team_id, hs, as);
        add(match.away_team_id, as, hs);
      }
      // Oldest first inside each strip, like the reference screenshots.
      return Object.fromEntries([...map.entries()].map(([id, list]) => [id, list.reverse()]));
    },
  });
}

function FormStrip({ results }: { results: ("W" | "D" | "L")[] }) {
  const tone = { W: "bg-emerald-500", D: "bg-muted-foreground/60", L: "bg-red-500" } as const;
  return (
    <span className="flex h-6 w-full max-w-[10rem] overflow-hidden rounded-md bg-muted">
      {results.map((result, index) => (
        <span key={index} className={`grid w-7 shrink-0 place-items-center text-[0.65rem] font-bold text-white ${tone[result]}`}>{result}</span>
      ))}
    </span>
  );
}

export function StandingsTable({ rows, labels, highlightTeamId, highlightTeamIds, liveTeamIds }: {
  rows: PublicStandingRow[];
  labels: Label[];
  highlightTeamId?: string;
  highlightTeamIds?: string[];
  liveTeamIds?: string[];
}) {
  const tx = useTx();
  const num = useNum();
  const [view, setView] = useState<View>("short");
  const form = useForm(rows, view === "form");
  const highlights = [...(highlightTeamIds ?? []), ...(highlightTeamId ? [highlightTeamId] : [])];
  const views: View[] = ["full", "form", "short"];
  const viewName: Record<View, string> = { full: tx("Full"), form: tx("Form"), short: tx("Short") };

  return <div className="space-y-4">
    <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs font-semibold">
      {views.map((item) => (
        <button key={item} type="button" onClick={() => setView(item)}
          className={`rounded-full px-3 py-1.5 transition-colors ${view === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          {viewName[item]}
        </button>
      ))}
    </div>
    {grouped(rows).map(([group, groupRows]) => {
      const groupLabels = labels.filter((label) => (label.group_label ?? null) === group);
      const used = groupRows.map((_, index) => groupLabels.find((label) => label.position === index + 1)).filter((label): label is Label => !!label).filter((label, index, list) => list.findIndex((item) => item.label === label.label) === index);
      const cols = view === "full"
        ? "grid-cols-[2.75rem_minmax(0,1fr)_1.75rem_1.75rem_1.75rem_1.75rem_2.75rem_2.5rem]"
        : view === "form"
          ? "grid-cols-[2.75rem_minmax(0,1fr)_10rem]"
          : "grid-cols-[2.75rem_minmax(0,1fr)_2rem_2.25rem_2.5rem]";
      return <section key={group ?? "single"}>
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className={`grid ${cols} items-center gap-1 bg-gradient-to-r from-primary/10 via-muted/40 to-primary/10 px-3 py-2 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground`}>
            <span>#</span>
            <span>{group ? tx(group) : tx("Team")}</span>
            {view === "full" && <><span className="text-center">P</span><span className="text-center">W</span><span className="text-center">D</span><span className="text-center">L</span><span className="text-center">GLS</span><span className="text-center">PTS</span></>}
            {view === "form" && <span className="text-end">{tx("Last 5")}</span>}
            {view === "short" && <><span className="text-center">P</span><span className="text-center">GD</span><span className="text-center">PTS</span></>}
          </div>
          <div className="divide-y divide-border">
            {groupRows.map((row, index) => {
              const label = groupLabels.find((item) => item.position === index + 1);
              const live = row.team_id ? (liveTeamIds ?? []).includes(row.team_id) : false;
              const selected = row.team_id ? highlights.includes(row.team_id) : false;
              const inner = <>
                <span className="flex items-center gap-1.5">
                  <span className="h-6 w-1 rounded-full" style={{ backgroundColor: label?.color ?? "transparent" }} />
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[0.7rem] font-bold tabular-nums">{num(index + 1)}</span>
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <TeamCrest name={row.team?.name} logo={row.team?.logo_url ?? null} className="h-6 w-6 shrink-0" />
                  <span className="truncate text-sm font-semibold">{tx((view === "full" ? row.team?.short_name || row.team?.name : row.team?.name || row.team?.short_name) || "—")}</span>
                  {live && <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase text-primary">{tx("Live")}</span>}
                </span>
                {view === "full" && <>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.played)}</span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.won)}</span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.drawn)}</span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.lost)}</span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.gf)}:{num(row.ga)}</span>
                  <span className="text-center text-sm font-black tabular-nums text-primary">{num(row.points + row.points_adjust)}</span>
                </>}
                {view === "form" && <span className="flex justify-end">
                  <FormStrip results={(form.data?.[row.team_id] ?? []) as ("W" | "D" | "L")[]} />
                </span>}
                {view === "short" && <>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.played)}</span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.gf - row.ga)}</span>
                  <span className="text-center text-sm font-black tabular-nums text-primary">{num(row.points + row.points_adjust)}</span>
                </>}
              </>;
              const cls = `grid ${cols} items-center gap-1 px-3 py-2.5 active:bg-muted/60 ${live ? "bg-primary/15" : selected ? "bg-primary/10" : ""}`;
              return row.team
                ? <Link key={row.id} to="/teams/$id" params={{ id: row.team.id }} className={cls}>{inner}</Link>
                : <div key={row.id} className={cls}>{inner}</div>;
            })}
          </div>
        </div>
        {used.length > 0 && <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">{used.map((label) => <span key={label.id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />{tx(label.label)}</span>)}</div>}
      </section>;
    })}
  </div>;
}
