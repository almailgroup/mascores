import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, SectionHeader, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { MatchCard, type Fixture } from "@/components/match-card";
import { useFootball, FEATURED_LEAGUES, todayISO } from "@/lib/football";
import { useFavorites } from "@/hooks/use-favorites";
import {
  CURATED_ALL,
  CURATED_FEATURED,
  CURATED_PL_2025_26,
  CURATED_LALIGA_2025_26,
  CURATED_WC_2026,
} from "@/lib/football-fallback";
import { Info } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MansourAlmailScores — Live Football Scores, World Cup 2026 & Top Leagues" },
      { name: "description", content: "Live scores, match centers, lineups, and coverage of the FIFA World Cup 2026, Premier League and LaLiga." },
      { property: "og:title", content: "MansourAlmailScores — Live Scores. Real Passion." },
      { property: "og:description", content: "Live football scores and comprehensive coverage of the World Cup 2026, Premier League and LaLiga." },
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

  const liveFeedDown =
    Boolean(live.error || todays.error || upcoming.error || finished.error) ||
    (!live.isLoading && !todays.isLoading && !upcoming.isLoading &&
      (live.data?.length ?? 0) === 0 &&
      (todays.data?.length ?? 0) === 0 &&
      (upcoming.data?.length ?? 0) === 0);

  return (
    <AppShell>
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-[radial-gradient(ellipse_at_top_left,theme(colors.primary/20),transparent_60%),radial-gradient(ellipse_at_bottom_right,theme(colors.primary/10),transparent_55%)] bg-card p-6 sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Matchday coverage
        </div>
        <h1 className="mt-4 max-w-3xl text-3xl font-black leading-[1.05] tracking-tight sm:text-5xl">
          Every match. Every moment. <span className="text-primary">One scoreboard.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          FIFA World Cup 2026, Premier League 2025/26 and LaLiga 2025/26 — with match centers, lineups, and player profiles built for real supporters.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          <Link to="/world-cup-2026" className="rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:opacity-90">World Cup 2026</Link>
          <Link to="/competitions/$id" params={{ id: "39" }} className="rounded-full border border-border bg-background/60 px-3 py-1.5 font-semibold hover:border-primary/50">Premier League</Link>
          <Link to="/competitions/$id" params={{ id: "140" }} className="rounded-full border border-border bg-background/60 px-3 py-1.5 font-semibold hover:border-primary/50">LaLiga</Link>
        </div>
      </div>

      {liveFeedDown && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <div className="font-semibold text-foreground">Live feed warming up</div>
            The live data feed is temporarily unavailable — showing curated fixtures for the FIFA World Cup 2026, Premier League 2025/26 and LaLiga 2025/26.
          </div>
        </div>
      )}

      {liveFeedDown ? (
        <>
          <Section title="FIFA World Cup 2026" data={CURATED_WC_2026} loading={false} error={null} empty="" disabled />
          <Section title="Premier League 2025/26 — opening weekend" data={CURATED_PL_2025_26} loading={false} error={null} empty="" disabled />
          <Section title="LaLiga 2025/26 — Jornada 1" data={CURATED_LALIGA_2025_26} loading={false} error={null} empty="" disabled />
          <Section title="Featured fixtures" data={CURATED_ALL.slice(0, 6)} loading={false} error={null} empty="" disabled />
        </>
      ) : (
        <>
          <Section title="Live now" data={live.data} loading={live.isLoading} error={live.error} empty="No live matches right now." />
          {favMatches.length > 0 && <Section title="Favorite matches today" data={favMatches} loading={false} error={null} empty="" />}
          <Section title="Today's matches" data={todays.data} loading={todays.isLoading} error={todays.error} empty="No matches scheduled today." />
          <Section title="Upcoming" data={upcoming.data} loading={upcoming.isLoading} error={upcoming.error} empty="No upcoming fixtures." />
          <Section title="Recently finished" data={finished.data} loading={finished.isLoading} error={finished.error} empty="No finished matches." />
        </>
      )}

      <section className="mt-10">
        <SectionHeader title="Featured competitions" />
        <div className="grid gap-3 sm:grid-cols-3">
          {FEATURED_LEAGUES.map((l) => {
            const logo = `https://media.api-sports.io/football/leagues/${l.id}.png`;
            const content = (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-background">
                  <img src={logo} alt="" className="h-10 w-10 object-contain" loading="lazy" />
                </div>
                <div>
                  <div className="font-semibold">{l.name}</div>
                  <div className="text-xs text-muted-foreground">Season {l.season}</div>
                </div>
              </>
            );
            return l.id === 1 ? (
              <Link key={l.id} to="/world-cup-2026" className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-lg">
                {content}
              </Link>
            ) : (
              <Link key={l.id} to="/competitions/$id" params={{ id: String(l.id) }} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-lg">
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeader title="Explore" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/search" className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50">
            <div className="text-sm font-semibold">Global search</div>
            <div className="mt-1 text-xs text-muted-foreground">Players, teams, coaches, stadiums, countries.</div>
          </Link>
          <Link to="/news" className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50">
            <div className="text-sm font-semibold">News</div>
            <div className="mt-1 text-xs text-muted-foreground">Latest headlines across your favorite competitions.</div>
          </Link>
          <Link to="/favorites" className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50">
            <div className="text-sm font-semibold">Favorites</div>
            <div className="mt-1 text-xs text-muted-foreground">Follow teams, players, matches and competitions.</div>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

function Section({ title, data, loading, error, empty, disabled }: { title: string; data: Fixture[] | undefined; loading: boolean; error: Error | null; empty: string; disabled?: boolean }) {
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
            <MatchCard key={f.fixture.id} fixture={f} disabled={disabled} />
          ))}
        </div>
      )}
    </section>
  );
}