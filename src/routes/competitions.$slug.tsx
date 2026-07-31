import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { supabase, formatKickoff, type Competition, type Team, type Match, type StandingRow } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { FlagIcon } from "@/components/flag";
import type { Database } from "@/integrations/supabase/types";

type PositionLabel = Database["public"]["Tables"]["standings_position_labels"]["Row"];

export const Route = createFileRoute("/competitions/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — MansourAlmailScores` }] }),
  component: CompetitionPage,
});

function CompetitionPage() {
  const { slug } = Route.useParams();
  useRealtime(["competitions", "teams", "matches", "standings_rows"]);

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
      const { data } = await supabase.from("teams").select("*").eq("competition_id", comp.data!.id).order("name");
      return (data ?? []) as Team[];
    },
  });

  const matches = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-matches", comp.data?.id],
    queryFn: async () => {
      const { data } = await supabase.from("matches")
        .select("*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)")
        .eq("competition_id", comp.data!.id)
        .order("kickoff_at");
      return (data ?? []) as unknown as (Match & { home: Team | null; away: Team | null })[];
    },
  });

  const standings = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-standings", comp.data?.id],
    queryFn: async () => {
      const { data } = await supabase.from("standings_rows")
        .select("*, team:team_id(id,name,logo_url,short_name)")
        .eq("competition_id", comp.data!.id)
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

  if (comp.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!comp.data) return <AppShell><EmptyState title="Competition not found" /></AppShell>;
  const c = comp.data;

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-4 rounded-3xl border border-border bg-card p-6">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
          {c.logo_url && <img src={c.logo_url} alt="" className="h-full w-full object-contain" />}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FlagIcon value={c.country_code ?? c.country} />
            <span>{[c.country, c.season, c.category].filter(Boolean).join(" · ")}</span>
          </div>
          {c.description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{c.description}</p>}
        </div>
      </div>

      <SectionHeader title="Matches" />
      {matches.data && matches.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.data.map((m) => (
            <Link key={m.id} to="/matches/$id" params={{ id: m.id }} className="rounded-2xl border border-border bg-card p-4 hover:border-primary/50">
              <div className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">{m.round ?? "—"}</div>
              <div className="mt-2 grid items-center gap-2" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                <div className="truncate text-right font-semibold">{m.home?.name ?? "TBD"}</div>
                <div className="text-center text-sm font-bold">{m.home_score != null ? `${m.home_score} – ${m.away_score}` : formatKickoff(m.kickoff_at)}</div>
                <div className="truncate font-semibold">{m.away?.name ?? "TBD"}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : <EmptyState title="No matches yet" />}

      <SectionHeader title="Standings" action={<div />} />
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
                {group && <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{group}</div>}
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground"><tr>
                      <th className="p-3 text-left">#</th><th className="text-left">Team</th>
                      <th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Pts</th>
                    </tr></thead>
                    <tbody>{rows.map((r, i) => {
                      const lbl = labels.find((l) => l.position === i + 1);
                      return (
                        <tr key={r.id} className="border-t border-border" style={{ borderLeft: lbl ? `4px solid ${lbl.color}` : "4px solid transparent" }}>
                          <td className="p-3 tabular-nums">{i + 1}</td>
                          <td className="p-3">
                            {r.team ? (
                              <Link to="/teams/$id" params={{ id: r.team.id }} className="flex items-center gap-2 font-medium hover:text-primary">
                                {r.team.logo_url && <img src={r.team.logo_url} alt="" className="h-5 w-5 object-contain" />}
                                <span className="truncate">{r.team.name}</span>
                              </Link>
                            ) : "—"}
                          </td>
                          <td className="text-center">{r.played}</td><td className="text-center">{r.won}</td><td className="text-center">{r.drawn}</td>
                          <td className="text-center">{r.lost}</td><td className="text-center">{r.gf}</td><td className="text-center">{r.ga}</td>
                          <td className="text-center font-bold">{r.points + r.points_adjust}</td>
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
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{l.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : <EmptyState title="No standings yet" />}

      <SectionHeader title="Teams" />
      {teams.data && teams.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {teams.data.map((t) => (
            <Link key={t.id} to="/teams/$id" params={{ id: t.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50">
              {t.logo_url && <img src={t.logo_url} alt="" className="h-8 w-8 object-contain" />}
              <div className="min-w-0"><div className="truncate font-medium">{t.name}</div><div className="truncate text-xs text-muted-foreground">{t.country}</div></div>
            </Link>
          ))}
        </div>
      ) : <EmptyState title="No teams yet" />}
    </AppShell>
  );
}