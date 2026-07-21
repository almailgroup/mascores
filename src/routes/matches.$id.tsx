import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, EmptyState, SectionHeader } from "@/components/app-shell";
import { useFootball, fixtureStatusLabel, isLive, formatKickoff } from "@/lib/football";
import { FavoriteButton } from "@/hooks/use-favorites";
import { ShareMatchButton } from "@/components/share-match-button";
import type { Fixture } from "@/components/match-card";

export const Route = createFileRoute("/matches/$id")({
  head: ({ params }) => {
    const title = `Match #${params.id} — MansourAlmailScores`;
    const desc = "Match center: live scores, lineups, statistics and events.";
    const img = `/api/public/share/match/${params.id}`;
    return { meta: [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `/matches/${params.id}` },
      { property: "og:image", content: img },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: img },
    ], links: [{ rel: "canonical", href: `/matches/${params.id}` }] };
  },
  component: MatchPage,
});

type LineupPlayer = { player: { id: number; name: string; number?: number; pos?: string; grid?: string | null } };
type LineupTeam = { team: { id: number; name: string; logo?: string; colors?: unknown }; formation?: string; startXI: LineupPlayer[]; substitutes: LineupPlayer[]; coach?: { id?: number; name: string; photo?: string } };
type EventItem = { time: { elapsed: number; extra?: number | null }; team: { id: number; name: string }; player: { id: number | null; name: string | null }; assist?: { id: number | null; name: string | null }; type: string; detail: string };
type StatTeam = { team: { id: number; name: string; logo?: string }; statistics: Array<{ type: string; value: number | string | null }> };

function MatchPage() {
  const { id } = Route.useParams();
  const fx = useFootball<Fixture | undefined>("fixtures", { id }, {
    select: (d) => d.response[0] as unknown as Fixture,
    refetchInterval: (q) => (q.state.data && isLive((q.state.data.response[0] as unknown as Fixture)?.fixture.status.short) ? 30_000 : false),
  });
  const lineups = useFootball<LineupTeam[]>("fixtures/lineups", { fixture: id }, { select: (d) => d.response as unknown as LineupTeam[] });
  const events = useFootball<EventItem[]>("fixtures/events", { fixture: id }, { select: (d) => d.response as unknown as EventItem[] });
  const stats = useFootball<StatTeam[]>("fixtures/statistics", { fixture: id }, { select: (d) => d.response as unknown as StatTeam[] });

  const f = fx.data;
  if (fx.isLoading) return <AppShell><div className="h-64 animate-pulse rounded-2xl border border-border bg-card/50" /></AppShell>;
  if (!f) return <AppShell><EmptyState title="Match not found" /></AppShell>;

  const status = fixtureStatusLabel(f.fixture.status.short, f.fixture.status.elapsed);
  const live = isLive(f.fixture.status.short);
  const started = !["NS", "PST", "CANC", "TBD"].includes(f.fixture.status.short);

  return (
    <AppShell>
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
          <span>{f.league.name} · {f.league.round}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${live ? "bg-primary/15 text-primary" : "bg-muted"}`}>
            {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
            {status}
          </span>
        </div>

        <div className="mt-6 grid items-center gap-4" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
          <Link to="/teams/$id" params={{ id: String(f.teams.home.id) }} className="flex flex-col items-center gap-2 text-center">
            {f.teams.home.logo && <img src={f.teams.home.logo} alt="" className="h-16 w-16 object-contain" />}
            <div className="font-bold">{f.teams.home.name}</div>
          </Link>
          <div className="text-center">
            {started ? (
              <div className="text-5xl font-black tabular-nums">
                {f.goals.home ?? 0}<span className="mx-2 text-muted-foreground">–</span>{f.goals.away ?? 0}
              </div>
            ) : (
              <div className="text-sm font-semibold">{formatKickoff(f.fixture.date)}</div>
            )}
          </div>
          <Link to="/teams/$id" params={{ id: String(f.teams.away.id) }} className="flex flex-col items-center gap-2 text-center">
            {f.teams.away.logo && <img src={f.teams.away.logo} alt="" className="h-16 w-16 object-contain" />}
            <div className="font-bold">{f.teams.away.name}</div>
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          {f.fixture.venue?.name && <span>{f.fixture.venue.name}{f.fixture.venue.city ? `, ${f.fixture.venue.city}` : ""}</span>}
          <FavoriteButton kind="match" id={f.fixture.id} />
          <ShareMatchButton matchId={f.fixture.id} title={`${f.teams.home.name} vs ${f.teams.away.name} — ${f.league.name}`} />
        </div>
      </div>

      <section className="mt-8">
        <SectionHeader title="Timeline" />
        {events.isLoading ? <div className="h-32 animate-pulse rounded-2xl border border-border bg-card/50" /> :
          (events.data?.length ?? 0) === 0 ? <EmptyState title="No events yet" /> :
          <div className="rounded-2xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {events.data!.map((e, i) => (
                <li key={i} className="flex items-center gap-3 p-3 text-sm">
                  <div className="w-10 shrink-0 text-right font-bold tabular-nums text-primary">{e.time.elapsed}'</div>
                  <div className="flex-1"><span className="font-medium">{e.player.name ?? "—"}</span> <span className="text-xs text-muted-foreground">· {e.detail || e.type}</span></div>
                  <div className="text-xs text-muted-foreground">{e.team.name}</div>
                </li>
              ))}
            </ul>
          </div>}
      </section>

      <section className="mt-8">
        <SectionHeader title="Lineups" />
        {lineups.isLoading ? <div className="h-32 animate-pulse rounded-2xl border border-border bg-card/50" /> :
          (lineups.data?.length ?? 0) === 0 ? <EmptyState title="Lineups will publish before kickoff." /> :
          <div className="grid gap-4 md:grid-cols-2">
            {lineups.data!.map((lu) => (
              <div key={lu.team.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  {lu.team.logo && <img src={lu.team.logo} alt="" className="h-6 w-6" />}
                  <div className="flex-1 font-bold">{lu.team.name}</div>
                  <div className="text-xs text-muted-foreground">{lu.formation}</div>
                </div>
                <div className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">Starting XI</div>
                <ul className="mt-1 space-y-1">
                  {lu.startXI.map((p) => (
                    <li key={p.player.id} className="flex items-center gap-2 text-sm">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{p.player.number}</span>
                      <Link to="/players/$id" params={{ id: String(p.player.id) }} className="flex-1 truncate hover:text-primary">{p.player.name}</Link>
                      <span className="text-xs text-muted-foreground">{p.player.pos}</span>
                    </li>
                  ))}
                </ul>
                {lu.substitutes.length > 0 && <>
                  <div className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">Bench</div>
                  <ul className="mt-1 space-y-1">
                    {lu.substitutes.map((p) => (
                      <li key={p.player.id} className="flex items-center gap-2 text-sm">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">{p.player.number}</span>
                        <Link to="/players/$id" params={{ id: String(p.player.id) }} className="flex-1 truncate hover:text-primary">{p.player.name}</Link>
                        <span className="text-xs text-muted-foreground">{p.player.pos}</span>
                      </li>
                    ))}
                  </ul>
                </>}
                {lu.coach && <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Coach: <span className="font-medium text-foreground">{lu.coach.name}</span></div>}
              </div>
            ))}
          </div>}
      </section>

      <section className="mt-8">
        <SectionHeader title="Statistics" />
        {stats.isLoading ? <div className="h-32 animate-pulse rounded-2xl border border-border bg-card/50" /> :
          (stats.data?.length ?? 0) < 2 ? <EmptyState title="Stats appear once the match kicks off." /> :
          <div className="rounded-2xl border border-border bg-card p-4">
            {stats.data![0].statistics.map((s, i) => {
              const away = stats.data![1].statistics[i];
              return (
                <div key={s.type} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>{String(s.value ?? 0)}</span><span>{s.type}</span><span>{String(away?.value ?? 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>}
      </section>
    </AppShell>
  );
}