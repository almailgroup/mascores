import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { supabase, formatKickoff, type Competition, type Team, type Match, type StandingRow } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { FlagIcon } from "@/components/flag";
import { LinkedNews } from "@/components/linked-news";
import { useDates, useNum, useTx } from "@/lib/auto-translate";
import { useI18n } from "@/lib/i18n";
import type { Database } from "@/integrations/supabase/types";

type PositionLabel = Database["public"]["Tables"]["standings_position_labels"]["Row"];
type Row = StandingRow & { team: Team | null };

function groupsOf(rows: Row[]): [string | null, Row[]][] {
  const map = new Map<string | null, Row[]>();
  for (const r of rows) {
    const key = r.group_label ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return [...map.entries()];
}

export const Route = createFileRoute("/competitions/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — MansourAlmailScores` }] }),
  component: CompetitionPage,
});

function CompetitionPage() {
  const { slug } = Route.useParams();
  const [tab, setTab] = useState<"overview" | "matches" | "standings" | "teams" | "awards" | "media" | "news">("overview");
  const [season, setSeason] = useState<string | null>(null);
  useRealtime(["competitions", "teams", "matches", "standings_rows", "competition_awards", "media_items"]);

  const comp = useQuery({
    queryKey: ["comp", slug],
    queryFn: async () => {
      const { data } = await supabase.from("competitions").select("*").eq("slug", slug).maybeSingle();
      return data as Competition | null;
    },
  });

  const teams = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-teams", comp.data?.id],
    queryFn: async () => {
      const { data: links } = await supabase.from("competition_teams").select("team_id").eq("competition_id", comp.data!.id);
      const ids = (links ?? []).map((link) => link.team_id);
      const { data } = ids.length ? await supabase.from("teams").select("*").in("id", ids).order("name") : await supabase.from("teams").select("*").eq("competition_id", comp.data!.id).order("name");
      return (data ?? []) as Team[];
    },
  });

  const matches = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-matches", comp.data?.id, season],
    queryFn: async () => {
      let query = supabase.from("matches")
        .select("*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)")
        .eq("competition_id", comp.data!.id);
       const selectedSeason = season ?? comp.data!.season;
       if (selectedSeason) query = query.or(`season.eq.${selectedSeason},season.is.null`);
      const { data } = await query.order("kickoff_at");
      return (data ?? []) as unknown as (Match & { home: Team | null; away: Team | null })[];
    },
  });

  const standings = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-standings", comp.data?.id, season],
    queryFn: async () => {
      let query = supabase.from("standings_rows")
        .select("*, team:team_id(id,name,logo_url,short_name)")
        .eq("competition_id", comp.data!.id);
       const selectedSeason = season ?? comp.data!.season;
       // Rows created before seasons existed carry a null season — still show them.
       if (selectedSeason) query = query.or(`season.eq.${selectedSeason},season.is.null`);
      const { data } = await query
        .order("group_label", { ascending: true, nullsFirst: true })
        .order("sort_order");
      return (data ?? []) as unknown as (StandingRow & { team: Team | null })[];
    },
  });

  const posLabels = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-position-labels", comp.data?.id],
    queryFn: async () => {
      const { data } = await supabase.from("standings_position_labels").select("*").eq("competition_id", comp.data!.id);
      return (data ?? []) as PositionLabel[];
    },
  });
  const media = useQuery({ enabled: !!comp.data, queryKey: ["competition-media", comp.data?.id], queryFn: async () => (await supabase.from("media_items").select("*").eq("owner_type", "competition").eq("owner_id", comp.data!.id).order("sort_order")).data ?? [] });
  const awards = useQuery({ enabled: !!comp.data, queryKey: ["competition-awards", comp.data?.id], queryFn: async () => (await supabase.from("competition_awards").select("*, player:players(id,name,photo_url)").eq("competition_id", comp.data!.id).order("created_at", { ascending: false })).data ?? [] });
  const titleHolder = teams.data?.find((team) => team.id === comp.data?.title_holder_team_id);
  const compTitles = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-titles", comp.data?.id],
    queryFn: async () => {
      const { data } = await supabase.from("competition_teams").select("team_id,titles").eq("competition_id", comp.data!.id).order("titles", { ascending: false });
      return (data ?? []) as { team_id: string; titles: number }[];
    },
  });
  const divisions = useQuery({
    enabled: !!comp.data && !!(comp.data.higher_division_id || comp.data.lower_division_id),
    queryKey: ["comp-divisions", comp.data?.higher_division_id, comp.data?.lower_division_id],
    queryFn: async () => {
      const ids = [comp.data!.higher_division_id, comp.data!.lower_division_id].filter((v): v is string => !!v);
      const { data } = await supabase.from("competitions").select("id,name,slug").in("id", ids);
      return (data ?? []) as { id: string; name: string; slug: string }[];
    },
  });
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { t } = useI18n();

  if (comp.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!comp.data) return <AppShell><EmptyState title="Competition not found" /></AppShell>;
  const c = comp.data;

  return (
    <AppShell>
       <div className="mb-4 flex items-center gap-4 border-b border-border pb-5">
         <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl text-primary">
          {c.logo_url && <img src={c.logo_url} alt="" className="h-full w-full object-contain" />}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{tx(c.name)}</h1>
           <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <FlagIcon value={c.country_code ?? c.country} />
             <span>{[tx(c.country), tx(c.category)].filter(Boolean).join(" · ")}</span>
             {(c.seasons?.length ?? 0) > 0 && <select aria-label="Season" className="ml-2 rounded-full border border-border bg-background px-3 py-1 font-semibold text-foreground" value={season ?? c.season ?? c.seasons[0]} onChange={(e) => setSeason(e.target.value)}>{c.seasons.map((item) => <option key={item} value={item}>{num(item)}</option>)}</select>}
          </div>
          {c.description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{tx(c.description)}</p>}
        </div>
      </div>

      <div className="mb-6 flex max-w-full gap-1 overflow-x-auto border-b border-border pb-2 text-sm">
         {(["overview", "matches", "standings", "teams", "awards", "media", "news"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 px-4 py-2 font-semibold capitalize ${tab === item ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>{item === "awards" ? tx("Awards") : t(`tab.${item}`)}</button>)}
      </div>

      {tab === "overview" && <CompetitionOverviewTab c={c} season={season} teams={teams.data ?? []} titleHolder={titleHolder ?? null} titles={compTitles.data ?? []} divisions={divisions.data ?? []} />}

      {tab === "matches" && <><SectionHeader title={t("tab.matches")} />
      {matches.data && matches.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.data.map((m) => (
            <Link key={m.id} to="/matches/$id" params={{ id: m.id }} className="rounded-2xl border border-border bg-card p-4 hover:border-primary/50">
                 <div className="text-[0.65rem] uppercase text-muted-foreground">{m.round_number ? `${tx("Round")} ${num(m.round_number)}` : tx(m.round) ?? "—"}</div>
              <div className="mt-2 grid items-center gap-2" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                <div className="truncate text-right font-semibold">{tx(m.home?.name) ?? "TBD"}</div>
                <div className="text-center text-sm font-bold">{m.home_score != null ? `${m.home_score} – ${m.away_score}` : num(dates.kickoff(m.kickoff_at))}</div>
                <div className="truncate font-semibold">{tx(m.away?.name) ?? "TBD"}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : <EmptyState title={tx("No matches yet")} />}</>}

      {tab === "standings" && <><SectionHeader title={t("tab.standings")} action={<div />} />
      {standings.data && standings.data.length > 0 ? (
        <div className="space-y-6">
          {groupsOf(standings.data).map(([group, rows]) => {
            const labels = (posLabels.data ?? []).filter((l) => (l.group_label ?? null) === group);
            const used = rows
              .map((_, i) => labels.find((l) => l.position === i + 1))
              .filter((l): l is PositionLabel => !!l)
              .filter((l, i, arr) => arr.findIndex((x) => x.label === l.label) === i);
            return (
              <div key={group ?? "single"}>
                {group && <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{tx(group)}</div>}
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground"><tr>
                       <th className="p-3 text-left">#</th><th className="text-left">{tx("Team")}</th>
                      <th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Pts</th>
                    </tr></thead>
                    <tbody>{rows.map((r, i) => {
                      const lbl = labels.find((l) => l.position === i + 1);
                      return (
                        <tr key={r.id} className="border-t border-border" style={{ borderLeft: lbl ? `4px solid ${lbl.color}` : "4px solid transparent" }}>
                           <td className="p-3 tabular-nums">{num(i + 1)}</td>
                          <td className="p-3">
                            {r.team ? (
                              <Link to="/teams/$id" params={{ id: r.team.id }} className="flex items-center gap-2 font-medium hover:text-primary">
                                {r.team.logo_url && <img src={r.team.logo_url} alt="" className="h-5 w-5 object-contain" />}
                                <span className="truncate">{tx(r.team.name)}</span>
                              </Link>
                            ) : "—"}
                          </td>
                           <td className="text-center">{num(r.played)}</td><td className="text-center">{num(r.won)}</td><td className="text-center">{num(r.drawn)}</td>
                           <td className="text-center">{num(r.lost)}</td><td className="text-center">{num(r.gf)}</td><td className="text-center">{num(r.ga)}</td>
                           <td className="text-center font-bold">{num(r.points + r.points_adjust)}</td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
                {used.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {used.map((l) => (
                      <span key={l.id} className="inline-flex items-center gap-1.5">
                         <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{tx(l.label)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : <EmptyState title={tx("No standings yet")} />}</>}

      {tab === "teams" && <><SectionHeader title={tx("Teams")} />
      {teams.data && teams.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {teams.data.map((t) => (
            <Link key={t.id} to="/teams/$id" params={{ id: t.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50">
              {t.logo_url && <img src={t.logo_url} alt="" className="h-8 w-8 object-contain" />}
              <div className="min-w-0"><div className="truncate font-medium">{tx(t.name)}</div><div className="truncate text-xs text-muted-foreground">{tx(t.country)}</div></div>
            </Link>
          ))}
        </div>
      ) : <EmptyState title={tx("No teams yet")} />}</>}
      {tab === "awards" && <>{awards.data && awards.data.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{awards.data.map((award) => <div key={award.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">{award.player?.photo_url ? <img src={award.player.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="h-12 w-12 rounded-full bg-muted" />}<div><div className="font-bold">{tx(award.player?.name) ?? tx("Player")}</div><div className="text-xs text-muted-foreground">{award.award_type === "player_of_round" ? `${tx("Player of round")} ${award.round_number ?? "—"}` : tx("Player of the season")}{award.season ? ` · ${award.season}` : ""}</div></div></div>)}</div> : <EmptyState title={tx("No competition awards yet")} />}</>}
      {tab === "media" && <>{media.data && media.data.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{media.data.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-card p-4 hover:border-primary"><div className="text-xs font-bold uppercase text-primary">{item.source}</div><div className="mt-1 font-semibold">{tx(item.title) || tx("Open media")}</div><div className="mt-1 truncate text-xs text-muted-foreground">{item.url}</div></a>)}</div> : <EmptyState title={tx("No competition media yet")} />}</>}
      {tab === "news" && <LinkedNews kind="competition" id={c.id} />}
    </AppShell>
  );
}

function CompetitionOverviewTab({ c, season, teams, titleHolder, titles, divisions }: {
  c: Competition;
  season: string | null;
  teams: Team[];
  titleHolder: Team | null;
  titles: { team_id: string; titles: number }[];
  divisions: { id: string; name: string; slug: string }[];
}) {
  const tx = useTx();
  const winners = titles.filter((r) => r.titles > 0);
  const best = winners[0];
  const bestTeam = best ? teams.find((team) => team.id === best.team_id) : undefined;
  const higher = divisions.find((d) => d.id === c.higher_division_id);
  const lower = divisions.find((d) => d.id === c.lower_division_id);
  const cells: [string, string][] = [
    ["Sport", c.sport], ["Format", c.format], ["Teams", String(teams.length)],
    ["Duration", [c.starts_on, c.ends_on].filter(Boolean).join(" — ") || "—"],
    ["Season", season ?? c.season ?? "—"],
    ...(higher ? [["Higher division", tx(higher.name) ?? "—"] as [string, string]] : []),
    ...(lower ? [["Lower division", tx(lower.name) ?? "—"] as [string, string]] : []),
    ["Country", c.country ?? "—"],
  ];
  return (
    <>
      <div className="mb-px grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        <TeamCell label={tx("Title holder")} team={titleHolder} />
        <TeamCell label={tx("Most titles")} team={bestTeam ?? null} note={best ? String(best.titles) : null} />
      </div>
      <div className="mt-3 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {cells.map(([label, value]) => (
          <div key={label} className="bg-card p-4">
             <div className="text-[0.65rem] font-bold uppercase text-muted-foreground">{tx(label)}</div>
             <div className="mt-1 font-semibold">{tx(value)}</div>
          </div>
        ))}
      </div>
      {winners.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-bold">{tx("Title winners")}</div>
          <div className="divide-y divide-border">
            {winners.map((r) => {
              const team = teams.find((tm) => tm.id === r.team_id);
              return (
                <Link key={r.team_id} to="/teams/$id" params={{ id: r.team_id }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent">
                  {team?.logo_url ? <img src={team.logo_url} alt="" className="h-5 w-5 object-contain" /> : <span className="h-5 w-5 rounded bg-muted" />}
                  <span className="min-w-0 flex-1 truncate font-medium">{tx(team?.name) ?? "Team"}</span>
                  <span className="font-black tabular-nums">{r.titles}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function TeamCell({ label, team, note }: { label: string; team: Team | null; note?: string | null }) {
  const tx = useTx();
  return (
    <div className="bg-card p-4">
      <div className="text-[0.65rem] font-bold uppercase text-muted-foreground">{tx(label)}</div>
      {team ? (
        <Link to="/teams/$id" params={{ id: team.id }} className="mt-2 flex items-center gap-2 font-semibold hover:text-primary">
          {team.logo_url ? <img src={team.logo_url} alt="" className="h-7 w-7 object-contain" /> : <span className="h-7 w-7 rounded bg-muted" />}
          <span className="min-w-0 truncate">{tx(team.name)}</span>
          {note && <span className="ml-auto font-black tabular-nums">{note}</span>}
        </Link>
      ) : <div className="mt-2 font-semibold">—</div>}
    </div>
  );
}
