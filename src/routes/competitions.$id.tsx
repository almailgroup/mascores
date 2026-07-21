import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { MatchCard, type Fixture } from "@/components/match-card";
import { useFootball, CLUB_SEASON, WC_SEASON, LEAGUES } from "@/lib/football";
import { FavoriteButton } from "@/hooks/use-favorites";

export const Route = createFileRoute("/competitions/$id")({
  head: ({ params }) => ({ meta: [
    { title: `Competition #${params.id} — MansourAlmailScores` },
    { name: "description", content: "Competition standings, fixtures and top scorers." },
  ] }),
  component: CompetitionPage,
});

type Standing = { rank: number; team: { id: number; name: string; logo?: string }; points: number; goalsDiff: number; all: { played: number; win: number; draw: number; lose: number } };
type LeagueInfo = { league: { id: number; name: string; logo?: string; season?: number }; country: { name: string; flag?: string }; league_standings?: unknown };

function CompetitionPage() {
  const { id } = Route.useParams();
  const leagueId = Number(id);
  const season = leagueId === LEAGUES.WORLD_CUP ? WC_SEASON : CLUB_SEASON;

  const info = useFootball<LeagueInfo | undefined>("leagues", { id: leagueId }, { select: (d) => d.response[0] as never });
  const standings = useFootball<Standing[][]>("standings", { league: leagueId, season }, {
    select: (d) => {
      const first = d.response[0] as { league?: { standings?: Standing[][] } } | undefined;
      return first?.league?.standings ?? [];
    },
  });
  const fixtures = useFootball<Fixture[]>("fixtures", { league: leagueId, season, next: 20 }, { select: (d) => d.response as unknown as Fixture[] });

  const league = info.data;

  return (
    <AppShell>
      <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-6">
        {league?.league.logo && <img src={league.league.logo} alt="" className="h-16 w-16 object-contain" />}
        <div className="flex-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{league?.country?.name}</div>
          <h1 className="text-2xl font-black">{league?.league.name ?? `Competition ${leagueId}`}</h1>
          <div className="text-sm text-muted-foreground">Season {season}</div>
        </div>
        <FavoriteButton kind="competition" id={leagueId} size="md" />
      </div>

      <section className="mt-8">
        <SectionHeader title="Standings" />
        {standings.isLoading ? <div className="h-64 animate-pulse rounded-2xl border border-border bg-card/50" /> :
          (standings.data?.length ?? 0) === 0 ? <EmptyState title="No standings yet" /> :
          <div className="space-y-6">
            {standings.data!.map((group, gi) => (
              <div key={gi} className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full min-w-[500px] text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Team</th><th className="p-3">P</th><th className="p-3">W</th><th className="p-3">D</th><th className="p-3">L</th><th className="p-3">GD</th><th className="p-3">Pts</th></tr>
                  </thead>
                  <tbody>
                    {group.map((row) => (
                      <tr key={row.team.id} className="border-b border-border/60 last:border-0">
                        <td className="p-3 font-medium">{row.rank}</td>
                        <td className="p-3">
                          <Link to="/teams/$id" params={{ id: String(row.team.id) }} className="flex items-center gap-2 hover:text-primary">
                            {row.team.logo && <img src={row.team.logo} alt="" className="h-5 w-5" />}
                            {row.team.name}
                          </Link>
                        </td>
                        <td className="p-3 text-center">{row.all.played}</td>
                        <td className="p-3 text-center">{row.all.win}</td>
                        <td className="p-3 text-center">{row.all.draw}</td>
                        <td className="p-3 text-center">{row.all.lose}</td>
                        <td className="p-3 text-center">{row.goalsDiff}</td>
                        <td className="p-3 text-center font-bold">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        }
      </section>

      <section className="mt-10">
        <SectionHeader title="Upcoming fixtures" />
        {fixtures.isLoading ? <LoadingSkeleton /> :
          (fixtures.data?.length ?? 0) === 0 ? <EmptyState title="No upcoming fixtures" /> :
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fixtures.data!.slice(0, 12).map((f) => <MatchCard key={f.fixture.id} fixture={f} />)}
          </div>}
      </section>
    </AppShell>
  );
}