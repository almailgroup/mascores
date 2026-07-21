import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { MatchCard, type Fixture } from "@/components/match-card";
import { useFavorites } from "@/hooks/use-favorites";
import { useFootball } from "@/lib/football";
import { useAuth } from "@/hooks/use-auth";
import { useQueries } from "@tanstack/react-query";
import { callFootball } from "@/lib/football.functions";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [
    { title: "Favorites — MansourAlmailScores" },
    { name: "description", content: "Your favorite teams, players, competitions and matches, all in one place." },
  ] }),
  component: FavoritesPage,
});

type TeamPayload = { team: { id: number; name: string; logo?: string; country?: string } };
type PlayerPayload = { player: { id: number; name: string; photo?: string; nationality?: string } };
type LeaguePayload = { league: { id: number; name: string; logo?: string }; country: { name?: string } };

function FavoritesPage() {
  const { user, loading } = useAuth();
  const { favorites, ready } = useFavorites();

  const teamQueries = useQueries({
    queries: favorites.team.map((id) => ({
      queryKey: ["football", "teams", { id }],
      queryFn: () => callFootball({ data: { endpoint: "teams" as const, params: { id } } }),
      staleTime: 5 * 60_000,
    })),
  });
  const playerQueries = useQueries({
    queries: favorites.player.map((id) => ({
      queryKey: ["football", "players", { id, season: 2025 }],
      queryFn: () => callFootball({ data: { endpoint: "players" as const, params: { id, season: 2025 } } }),
      staleTime: 5 * 60_000,
    })),
  });
  const leagueQueries = useQueries({
    queries: favorites.competition.map((id) => ({
      queryKey: ["football", "leagues", { id }],
      queryFn: () => callFootball({ data: { endpoint: "leagues" as const, params: { id } } }),
      staleTime: 5 * 60_000,
    })),
  });
  const matchFx = useFootball<Fixture[]>("fixtures", { ids: favorites.match.join("-") }, {
    enabled: favorites.match.length > 0,
    select: (d) => d.response as unknown as Fixture[],
  });

  if (loading || !ready) return <AppShell><LoadingSkeleton /></AppShell>;

  return (
    <AppShell>
      {!user && (
        <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <Link to="/auth" className="font-semibold text-primary hover:underline">Sign in</Link> to save teams, players and competitions to your profile.
        </div>
      )}

      <SectionHeader title="Favorite teams" />
      {favorites.team.length === 0 ? <EmptyState title="No favorite teams yet" description="Tap the star on any team page." /> :
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {teamQueries.map((q, i) => {
            const t = (q.data?.response?.[0] as unknown as TeamPayload | undefined)?.team;
            if (!t) return <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card/50" />;
            return (
              <Link key={t.id} to="/teams/$id" params={{ id: String(t.id) }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50">
                {t.logo && <img src={t.logo} alt="" className="h-10 w-10 object-contain" />}
                <div><div className="font-medium">{t.name}</div><div className="text-xs text-muted-foreground">{t.country}</div></div>
              </Link>
            );
          })}
        </div>}

      <div className="mt-10"><SectionHeader title="Favorite players" /></div>
      {favorites.player.length === 0 ? <EmptyState title="No favorite players yet" /> :
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {playerQueries.map((q, i) => {
            const p = (q.data?.response?.[0] as unknown as PlayerPayload | undefined)?.player;
            if (!p) return <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card/50" />;
            return (
              <Link key={p.id} to="/players/$id" params={{ id: String(p.id) }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50">
                {p.photo && <img src={p.photo} alt="" className="h-10 w-10 rounded-full object-cover" />}
                <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.nationality}</div></div>
              </Link>
            );
          })}
        </div>}

      <div className="mt-10"><SectionHeader title="Favorite competitions" /></div>
      {favorites.competition.length === 0 ? <EmptyState title="No favorite competitions yet" /> :
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {leagueQueries.map((q, i) => {
            const l = (q.data?.response?.[0] as unknown as LeaguePayload | undefined);
            if (!l) return <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card/50" />;
            return (
              <Link key={l.league.id} to="/competitions/$id" params={{ id: String(l.league.id) }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50">
                {l.league.logo && <img src={l.league.logo} alt="" className="h-10 w-10 object-contain" />}
                <div><div className="font-medium">{l.league.name}</div><div className="text-xs text-muted-foreground">{l.country?.name}</div></div>
              </Link>
            );
          })}
        </div>}

      <div className="mt-10"><SectionHeader title="Favorite matches" /></div>
      {favorites.match.length === 0 ? <EmptyState title="No favorite matches yet" description="Star a match in the match center." /> :
        matchFx.isLoading ? <LoadingSkeleton /> :
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(matchFx.data ?? []).map((f) => <MatchCard key={f.fixture.id} fixture={f} />)}
        </div>}
    </AppShell>
  );
}