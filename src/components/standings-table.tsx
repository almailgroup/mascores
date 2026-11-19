import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TeamCrest } from "@/components/team-crest";
import { supabase } from "@/integrations/supabase/client";
import type { Team, StandingRow } from "@/lib/db";
import type { Database } from "@/integrations/supabase/types";
import { ShareCardButton } from "@/components/share-image";
import { drawStandingsCard } from "@/lib/share-cards";
import { useNum, useTx } from "@/lib/auto-translate";
import { compareGroupLabels } from "@/lib/group-order";
import { Button } from "@/components/ui/button";

type Label = Database["public"]["Tables"]["standings_position_labels"]["Row"];
export type PublicStandingRow = StandingRow & { team: Pick<Team, "id" | "name" | "logo_url" | "short_name"> | null };
type View = "full" | "form" | "short";

function grouped(rows: PublicStandingRow[]) {
  const groups = new Map<string | null, PublicStandingRow[]>();
  rows.forEach((row) => {
    const key = row.group_label ?? null;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  // Group A first, Group B second, whatever order the rows were saved in.
  return [...groups.entries()].sort(([a], [b]) => compareGroupLabels(a, b));
}

/** Last five finished results per team, taken from the same competition/season as the table. */
function useForm(rows: PublicStandingRow[], enabled: boolean) {
  const competitionId = rows[0]?.competition_id ?? null;
  const season = rows[0]?.season ?? null;
  return useQuery({
    enabled: enabled && !!competitionId,
    queryKey: ["standings-form", competitionId, season],
    queryFn: async () => {
      if (!competitionId) return {};
      let query = supabase
        .from("matches")
        .select("home_team_id,away_team_id,home_score,away_score,kickoff_at,status")
        .eq("competition_id", competitionId)
        .in("status", ["ft", "aet", "pen", "awarded"])
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
  const tone = { W: "bg-success text-success-foreground", D: "bg-muted-foreground text-background", L: "bg-destructive text-destructive-foreground" } as const;
  return (
    <span className="flex h-6 w-full max-w-[10rem] overflow-hidden rounded-md">
      {results.map((result, index) => (
        <span key={index} className={`grid min-w-0 flex-1 place-items-center text-[0.65rem] font-bold ${tone[result]}`}>{result}</span>
      ))}
    </span>
  );
}

type LiveMatch = { home_team_id: string | null; away_team_id: string | null; home_score: number | null; away_score: number | null };

/** Adds in-progress results to the table so points and positions move live; returns movement per team. */
export function applyLiveResults(rows: PublicStandingRow[], live: LiveMatch[]) {
  const moves = new Map<string, number>();
  if (!live.length || rows.some((r) => (r as { is_final?: boolean }).is_final)) return { rows, moves, liveIds: [] as string[] };
  const liveIds: string[] = [];
  const next = rows.map((r) => ({ ...r }));
  for (const m of live) {
    const h = next.find((r) => r.team_id === m.home_team_id);
    const a = next.find((r) => r.team_id === m.away_team_id && r.group_label === h?.group_label);
    if (!h || !a) continue;
    const hs = m.home_score ?? 0, as = m.away_score ?? 0;
    liveIds.push(h.team_id, a.team_id);
    h.played++; a.played++; h.gf += hs; h.ga += as; a.gf += as; a.ga += hs;
    if (hs > as) { h.won++; a.lost++; h.points += 3; } else if (hs < as) { a.won++; h.lost++; a.points += 3; } else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  if (!liveIds.length) return { rows, moves, liveIds };
  const out: PublicStandingRow[] = [];
  for (const [, groupRows] of grouped(rows)) {
    const before = groupRows.map((r) => r.team_id);
    const sorted = next.filter((r) => (r.group_label ?? null) === (groupRows[0].group_label ?? null))
      .sort((x, y) => (y.points + (y.points_adjust ?? 0)) - (x.points + (x.points_adjust ?? 0)) || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || before.indexOf(x.team_id) - before.indexOf(y.team_id));
    sorted.forEach((r, i) => { const d = before.indexOf(r.team_id) - i; if (d) moves.set(r.team_id, d); });
    out.push(...sorted);
  }
  return { rows: out, moves, liveIds };
}

export function StandingsTable({ rows: savedRows, labels, highlightTeamId, highlightTeamIds, liveTeamIds, modern = true, showCompetition = false }: {
  showCompetition?: boolean;
  rows: PublicStandingRow[];
  labels: Label[];
  highlightTeamId?: string;
  highlightTeamIds?: string[];
  liveTeamIds?: string[];
  modern?: boolean;
}) {
  const tx = useTx();
  const num = useNum();
  const liveQ = useQuery({
    enabled: !!savedRows[0]?.competition_id,
    queryKey: ["standings-live", savedRows[0]?.competition_id, savedRows[0]?.season],
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = supabase.from("matches").select("home_team_id,away_team_id,home_score,away_score").eq("competition_id", savedRows[0].competition_id).in("status", ["live", "ht"]);
      if (savedRows[0].season) q = q.eq("season", savedRows[0].season);
      return ((await q).data ?? []) as LiveMatch[];
    },
  });
  const { rows, moves, liveIds } = applyLiveResults(savedRows, liveQ.data ?? []);
  liveTeamIds = [...new Set([...(liveTeamIds ?? []), ...liveIds])];
  const [view, setView] = useState<View>("short");
  const shotRef = useRef<HTMLDivElement>(null);
  const form = useForm(rows, view === "form");
  // The shared picture carries the league name, so it makes sense on its own.
  const competitionId = rows[0]?.competition_id ?? null;
  const competition = useQuery({
    enabled: !!competitionId,
    queryKey: ["standings-competition-info", competitionId],
    queryFn: async () => {
      if (!competitionId) return null;
      const { data } = await supabase.from("competitions").select("name,slug").eq("id", competitionId).maybeSingle();
      return data ?? null;
    },
  });
  const shareTitle = competition.data ? tx(competition.data.name) : tx("Standings");
  const highlights = [...(highlightTeamIds ?? []), ...(highlightTeamId ? [highlightTeamId] : [])];
  const views: View[] = ["full", "form", "short"];
  const viewName: Record<View, string> = { full: tx("Full"), form: tx("Form"), short: tx("Short") };

  const renderCard = (groups: ReturnType<typeof grouped>) => drawStandingsCard({
        title: shareTitle,
        subtitle: [tx("Standings"), rows[0]?.season ?? null].filter(Boolean).join(" · "),
        withForm: view === "form",
         withFull: view === "full",
        groups: groups.map(([group, groupRows]) => ({
          label: group ? tx(group) : null,
          rows: groupRows.map((row, index) => ({
            position: index + 1,
            name: tx(row.team?.name) ?? "",
            logo: row.team?.logo_url ?? null,
            played: row.played, won: row.won, drawn: row.drawn, lost: row.lost, gf: row.gf, ga: row.ga,
            goalDifference: row.gf - row.ga,
            points: row.points + (row.points_adjust ?? 0),
            form: (form.data?.[row.team_id] ?? []) as ("W" | "D" | "L")[],
            highlight: highlights.includes(row.team_id),
          })),
        })),
      });
  const groupList = grouped(rows);
  return <div ref={shotRef} className="space-y-4">
    <div className="flex items-center justify-between gap-2">
    <div className={modern ? "inline-flex gap-1 text-xs font-semibold" : "inline-flex rounded-full border border-border bg-card p-1 text-xs font-semibold"}>
      {views.map((item) => (
        <Button key={item} variant="ghost" size="sm" type="button" aria-pressed={view === item} onClick={() => setView(item)}
          className={`h-8 rounded-lg px-3 text-xs transition-colors ${view === item ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
          {viewName[item]}
        </Button>
      ))}
    </div>
    <ShareCardButton
      disabled={competition.isLoading}
      title={shareTitle}
      render={() => renderCard(grouped(rows))}
    />
    </div>
    {showCompetition && competition.data && <Link to="/competitions/$slug" params={{ slug: competition.data.slug }} className="block text-[1.35rem] font-black leading-tight hover:text-primary">
      {tx(competition.data.name)}{rows[0]?.season ? ` ${num(rows[0].season)}` : ""}
    </Link>}
    {groupList.map(([group, groupRows]) => {
      const positionLabel = (index: number) => labels.find((label) => (label.group_label ?? null) === group && label.position === index + 1)
        ?? labels.find((label) => !label.group_label && label.position === index + 1);
      const rowLabel = (row: PublicStandingRow, index: number) => {
        const saved = positionLabel(index);
        return saved ? { label: saved.label, color: saved.color } : row.qualification_label ? { label: row.qualification_label, color: row.qualification_color } : null;
      };
      const used = groupRows.map(rowLabel).filter((label): label is { label: string; color: string | null } => !!label).filter((label, index, list) => list.findIndex((item) => item.label === label.label && item.color === label.color) === index);
      const cols = view === "full"
        ? "grid-cols-[1.25rem_minmax(4rem,1fr)_1rem_1rem_1rem_1rem_2.5rem_1.5rem_1.75rem]"
        : view === "form"
          ? "grid-cols-[2.75rem_minmax(0,1fr)_10rem]"
        : modern ? "grid-cols-[1.5rem_minmax(0,1fr)_1.75rem_2rem_2rem]" : "grid-cols-[2.75rem_minmax(0,1fr)_2rem_2.25rem_2.5rem]";
      return <section key={group ?? "single"}>
        <div className={modern ? "overflow-hidden rounded-lg border border-border bg-card" : "overflow-hidden rounded-3xl border border-border bg-card shadow-sm"}>
          <div className={`grid ${cols} items-center gap-1 ${modern ? "bg-card" : "bg-muted/40"} px-3 py-2 text-[0.6rem] font-semibold text-muted-foreground`}>
            <span />
            <span className="flex min-w-0 items-center gap-1.5">
              {group && (competition.data
                ? <Link to="/competitions/$slug" params={{ slug: competition.data.slug }} className="truncate text-[0.7rem] font-bold text-foreground hover:text-primary">{tx(group)}</Link>
                : <span className="truncate text-[0.7rem] font-bold text-foreground">{tx(group)}</span>)}
              {group && groupList.length > 1 && <ShareCardButton iconOnly onSurface title={`${shareTitle} · ${tx(group)}`} render={() => renderCard([[group, groupRows]])} />}
            </span>
            {view === "full" && <><span className="text-center">P</span><span className="text-center">W</span><span className="text-center">D</span><span className="text-center">L</span><span className="text-center">GLS</span><span className="text-center">GD</span><span className="text-center">PTS</span></>}
            {view === "form" && <span className="text-end">{tx("Last 5")}</span>}
            {view === "short" && <><span className="text-center">P</span><span className="text-center">GD</span><span className="text-center">PTS</span></>}
          </div>
          <div className="divide-y divide-border">
            {groupRows.map((row, index) => {
              const label = rowLabel(row, index);
              const live = row.team_id ? (liveTeamIds ?? []).includes(row.team_id) : false;
              const selected = row.team_id ? highlights.includes(row.team_id) : false;
              const inner = <>
                <span className="flex items-center gap-1" title={label ? tx(label.label) : undefined}>
                  <span aria-label={label ? tx(label.label) : undefined} className="h-5 w-1 shrink-0 rounded-full" style={{ backgroundColor: label?.color ?? "transparent" }} />
                  <span className={`grid h-5 min-w-4 place-items-center ${modern ? "" : "rounded-full bg-muted"} text-[0.7rem] font-semibold tabular-nums`}>{num(index + 1)}</span>
                  {moves.get(row.team_id) ? <span className={`text-[0.6rem] font-black leading-none ${moves.get(row.team_id)! > 0 ? "text-emerald-500" : "text-match-live"}`} aria-label={moves.get(row.team_id)! > 0 ? "Moved up" : "Moved down"}>{moves.get(row.team_id)! > 0 ? "▲" : "▼"}</span> : null}
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <TeamCrest name={row.team?.name} logo={row.team?.logo_url ?? null} className={modern && view === "short" ? "h-5 w-5 shrink-0" : "h-6 w-6 shrink-0"} />
                  <span className={`${modern ? "truncate text-[0.75rem]" : "truncate text-sm"} font-semibold`}>{tx((view === "full" ? row.team?.short_name || row.team?.name : row.team?.name || row.team?.short_name) || "—")}</span>
                  {live && <span className="shrink-0 rounded-full bg-match-live px-1.5 py-0.5 text-[0.55rem] font-bold uppercase text-match-foreground">{tx("Live")}</span>}
                </span>
                {view === "full" && <>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.played)}</span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.won)}</span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.drawn)}</span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.lost)}</span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.gf)}:{num(row.ga)}</span>
                  <span className="text-center text-xs tabular-nums text-muted-foreground">{num(row.gf - row.ga)}</span>
                  <span className="text-center text-sm font-black tabular-nums text-primary">{num(row.points + row.points_adjust)}</span>
                </>}
                {view === "form" && <span className="flex justify-end">
                  <FormStrip results={(form.data?.[row.team_id] ?? []) as ("W" | "D" | "L")[]} />
                </span>}
                {view === "short" && <>
                  <span className="text-center text-[0.7rem] tabular-nums text-muted-foreground">{num(row.played)}</span>
                  <span className="text-center text-[0.7rem] tabular-nums text-muted-foreground">{num(row.gf - row.ga)}</span>
                  <span className="text-center text-xs font-black tabular-nums text-primary">{num(row.points + row.points_adjust)}</span>
                </>}
              </>;
              const cls = `grid ${cols} items-center gap-1 px-3 ${modern ? "py-2" : "py-2.5"} active:bg-muted/60 ${selected ? "font-semibold" : ""}`;
              return row.team
                ? <Link key={row.id} to="/teams/$id" params={{ id: row.team.id }} className={cls}>{inner}</Link>
                : <div key={row.id} className={cls}>{inner}</div>;
            })}
          </div>
        </div>
        {used.length > 0 && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{used.map((label) => <span key={`${label.label}-${label.color}`} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: label.color ?? undefined }} />{tx(label.label)}</span>)}</div>}
      </section>;
    })}
  </div>;
}
