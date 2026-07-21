import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Activity, Trophy, Globe2, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_20%_10%,color-mix(in_oklab,var(--primary)_25%,transparent),transparent_55%),radial-gradient(circle_at_85%_80%,color-mix(in_oklab,var(--primary)_15%,transparent),transparent_60%)]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <BrandLogo variant="horizontal" className="h-10 w-auto rounded-md" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {!loading && (
            user ? (
              <Link
                to="/profile"
                className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-accent"
              >
                Profile
              </Link>
            ) : (
              <Link
                to="/auth"
                className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow hover:brightness-110"
              >
                Sign in
              </Link>
            )
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pt-16">
        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              Live football coverage
            </div>
            <h1 className="mt-6 text-5xl font-black tracking-tight sm:text-6xl">
              Live Scores.
              <br />
              <span className="text-primary">Real Passion.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Follow every kick of the FIFA World Cup 2026, Premier League 2025/26, and
              LaLiga 2025/26 — with match centers, lineups, player profiles, and country
              hubs, all in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110"
              >
                Explore matches
              </button>
              {!user && (
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
                >
                  Create an account
                </Link>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-3xl bg-primary/10 blur-3xl" />
            <div className="relative rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <BrandLogo
                variant="icon"
                className="mx-auto h-40 w-40 rounded-2xl"
              />
              <div className="mt-6 text-center">
                <div className="text-2xl font-bold tracking-tight">
                  MansourAlmail<span className="text-primary">Scores</span>
                </div>
                <div className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.35em] text-muted-foreground">
                  Live Scores. Real Passion.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Activity, title: "Live match center", desc: "Timeline, stats, xG, commentary." },
            { icon: Trophy, title: "World Cup 2026", desc: "Groups, knockouts, awards." },
            { icon: Globe2, title: "Country hubs", desc: "Flags, rankings, national teams." },
            { icon: Search, title: "Global search", desc: "Players, teams, coaches, stadiums." },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur transition hover:border-primary/50"
            >
              <Icon className="h-6 w-6 text-primary" />
              <div className="mt-4 text-base font-semibold">{title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} MansourAlmailScores
      </footer>
    </div>
  );
}
