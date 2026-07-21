import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { MatchCard, type Fixture } from "@/components/match-card";
import { useFootball, CLUB_SEASON } from "@/lib/football";
import { FavoriteButton } from "@/hooks/use-favorites";

export const Route = createFileRoute("/teams/$id")({
  head: ({ params }) => ({ meta: [
    { title: `Team #${params.id} — MansourAlmailScores` },
    { name: "description", content: "Team profile: squad, fixtures, results, and coaching staff." },
  ] }),
  component: TeamPage,
});

type TeamInfo = { team: { id: number; name: string; logo?: string; country?: string; founded?: number; national?: boolean }; venue: { name?: string; city?: string; capacity?: number; image?: string } };
type SquadItem = { players: Array<{ id: number; name: string; age?: number; number?: number; position?: string; photo?: string }> };
type Coach = { id: number; name: string; photo?: string; age?: number; nationality?: string; career: Array<{ team: { id: number; name: string; logo?: string }; start: string; end: string | null }> };

function TeamPage() {
  const { id } = Route.useParams();
  const teamId = Number(id);

  const info = useFootball<TeamInfo | undefined>("teams", { id: teamId }, { select: (d) => d.response[0] as unknown as TeamInfo });
  const squad = useFootball<SquadItem | undefined>("players/squads", { team: teamId }, { select: (d) => d.response[0] as unknown as SquadItem });
  const nextFx = useFootball<Fixture[]>("fixtures", { team: teamId, next: 8 }, { select: (d) => d.response as unknown as Fixture[] });
  const lastFx = useFootball<Fixture[]>("fixtures", { team: teamId, last: 8 }, { select: (d) => d.response as unknown as Fixture[] });
  const coaches = useFootball<Coach[]>("coachs", { team: teamId }, { select: (d) => d.response as unknown as Coach[] });

  const team = info.data?.team;
  const venue = info.data?.venue;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row sm:items-center">
        {team?.logo && <img src={team.logo} alt="" className="h-20 w-20 object-contain" />}
        <div className="flex-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{team?.country} {team?.founded && `· Est. ${team.founded}`}</div>
          <h1 className="text-3xl font-black">{team?.name ?? `Team ${teamId}`}</h1>
          {venue?.name && <div className="text-sm text-muted-foreground">{venue.name}, {venue.city} · Cap {venue.capacity?.toLocaleString() ?? "—"}</div>}
        </div>
        <FavoriteButton kind="team" id={teamId} size="md" />
      </div>

      <section className="mt-8">
        <SectionHeader title="Squad" />
        {squad.isLoading ? <LoadingSkeleton /> :
          (squad.data?.players?.length ?? 0) === 0 ? <EmptyState title="Squad list unavailable" /> :
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {squad.data!.players.map((p) => (
              <Link key={p.id} to="/players/$id" params={{ id: String(p.id) }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50">
                {p.photo && <img src={p.photo} alt="" className="h-10 w-10 rounded-full object-cover" />}
                <div className="flex-1"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.position} · #{p.number ?? "—"}</div></div>
              </Link>
            ))}
          </div>}
      </section>

      <section className="mt-10">
        <SectionHeader title="Coaching staff & transfers" />
        {coaches.isLoading ? <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/50" /> :
          (coaches.data?.length ?? 0) === 0 ? <EmptyState title="No coach records yet" /> :
          <div className="space-y-4">
            {coaches.data!.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  {c.photo && <img src={c.photo} alt="" className="h-14 w-14 rounded-full object-cover" />}
                  <div className="flex-1">
                    <div className="font-bold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.nationality}{c.age ? ` · Age ${c.age}` : ""}</div>
                  </div>
                </div>
                {c.career?.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Coaching transfers</div>
                    <ul className="space-y-1 text-sm">
                      {c.career.map((step, i) => (
                        <li key={i} className="flex items-center gap-2">
                          {step.team.logo && <img src={step.team.logo} alt="" className="h-4 w-4" />}
                          <Link to="/teams/$id" params={{ id: String(step.team.id) }} className="font-medium hover:text-primary">{step.team.name}</Link>
                          <span className="text-xs text-muted-foreground">{step.start} → {step.end ?? "Present"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>}
      </section>

      <section className="mt-10">
        <SectionHeader title="Next fixtures" />
        {nextFx.isLoading ? <LoadingSkeleton /> :
          (nextFx.data?.length ?? 0) === 0 ? <EmptyState title="No upcoming fixtures" /> :
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nextFx.data!.map((f) => <MatchCard key={f.fixture.id} fixture={f} />)}
          </div>}
      </section>

      <section className="mt-8">
        <SectionHeader title="Recent results" />
        {lastFx.isLoading ? <LoadingSkeleton /> :
          (lastFx.data?.length ?? 0) === 0 ? <EmptyState title="No recent results" /> :
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lastFx.data!.map((f) => <MatchCard key={f.fixture.id} fixture={f} />)}
          </div>}
      </section>
    </AppShell>
  );
}