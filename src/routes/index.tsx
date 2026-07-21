import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, SectionHeader, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { MatchCard, type Fixture } from "@/components/match-card";
import { useFootball, FEATURED_LEAGUES, todayISO } from "@/lib/football";
import { useFavorites } from "@/hooks/use-favorites";
import { Trophy, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MansourAlmailScores — Live Football Scores" },
      { name: "description", content: "Live scores, match centers, lineups, and coverage of the best leagues of the world." },
      { property: "og:title", content: "MansourAlmailScores — Live Football Scores" },
      { property: "og:description", content: "Live scores, match centers, lineups, and coverage of the best leagues of the world." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { favorites } = useFavorites();
  const today = todayISO();
  const live = useFootball<Fixture[]>("fixtures", { live: "all" }, { select: (d) => (d.response as unknown as Fixture[]).slice(0, 12), refetchInterval: 30_000 });
  const todays = useFootball<Fixture[]>("fixtures", { date: today }, { select: (d) => (d.response as unknown as Fixture[]).slice(0, 12) });
  const finished = useFootball<Fixture[]>("fixtures", { date: todayISO(-1) }, {
    select: (d) => (d.response as unknown as Fixture[]).filter((f) => f.fixture.status.short === "FT").slice(0, 8),
  });
  const upcoming = useFootball<Fixture[]>("fixtures", { date: todayISO(1) }, {
    select: (d) => (d.response as unknown as Fixture[]).slice(0, 8),
  });

  const favTeamSet = new Set(favorites.team);
  const favMatches = (todays.data ?? []).filter(
    (f) => favTeamSet.has(String(f.teams.home.id)) || favTeamSet.has(String(f.teams.away.id)),
  );

  return (
    <AppShell>
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Live football
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
          Live Scores. <span className="text-primary">Real Passion.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Every kick of the FIFA World Cup 2026, Premier League 2025/26 and LaLiga 2025/26 — with match centers, lineups, and player profiles.
        </p>
      </div>

      <Section title="Live now" data={live.data} loading={live.isLoading} error={live.error} empty="No live matches right now." />
      {favMatches.length > 0 && <Section title="Favorite matches today" data={favMatches} loading={false} error={null} empty="" />}
      <Section title="Today's matches" data={todays.data} loading={todays.isLoading} error={todays.error} empty="No matches scheduled today." />
      <Section title="Upcoming" data={upcoming.data} loading={upcoming.isLoading} error={upcoming.error} empty="No upcoming fixtures." />
      <Section title="Recently finished" data={finished.data} loading={finished.isLoading} error={finished.error} empty="No finished matches." />

      <section className="mt-10">
        <SectionHeader title="Featured competitions" />
        <div className="grid gap-3 sm:grid-cols-3">
          {FEATURED_LEAGUES.map((l) => (
            l.id === 1 ? (
              <Link key={l.id} to="/world-cup-2026" className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-lg">
                <FeatureIcon />
                <div><div className="font-semibold">{l.name}</div><div className="text-xs text-muted-foreground">Season {l.season}</div></div>
              </Link>
            ) : (
              <Link key={l.id} to="/competitions/$id" params={{ id: String(l.id) }} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-lg">
                <FeatureIcon />
                <div><div className="font-semibold">{l.name}</div><div className="text-xs text-muted-foreground">Season {l.season}</div></div>
              </Link>
            )
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeader title="Trending" action={<TrendingUp className="h-5 w-5 text-primary" />} />
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Explore players, teams, coaches, stadiums, and countries via{" "}
          <Link to="/search" className="font-semibold text-primary hover:underline">global search</Link>.
        </div>
      </section>
    </AppShell>
  );
}

function FeatureIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Trophy className="h-6 w-6" />
    </div>
  );
}

function Section({ title, data, loading, error, empty }: { title: string; data: Fixture[] | undefined; loading: boolean; error: Error | null; empty: string }) {
  return (
    <section className="mt-8">
      <SectionHeader title={title} />
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <EmptyState title="Couldn't load matches" description={error.message} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((f) => (
            <MatchCard key={f.fixture.id} fixture={f} />
          ))}
        </div>
      )}
    </section>
  );
}