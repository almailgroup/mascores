import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, SectionHeader } from "@/components/app-shell";
import { FEATURED_LEAGUES } from "@/lib/football";

export const Route = createFileRoute("/competitions")({
  head: () => ({ meta: [
    { title: "Competitions — MansourAlmailScores" },
    { name: "description", content: "Browse featured football competitions: FIFA World Cup 2026, Premier League and LaLiga." },
    { property: "og:title", content: "Competitions — MansourAlmailScores" },
    { property: "og:description", content: "Every featured football competition in one place." },
  ] }),
  component: CompetitionsPage,
});

function CompetitionsPage() {
  return (
    <AppShell>
      <SectionHeader title="Featured competitions" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURED_LEAGUES.map((l) => (
          l.id === 1 ? (
            <Link key={l.id} to="/world-cup-2026" className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-6 transition hover:border-primary/50 hover:shadow-lg">
              <img src={`https://media.api-sports.io/football/leagues/${l.id}.png`} alt={`${l.name} logo`} className="h-14 w-14 shrink-0 object-contain" />
              <div className="min-w-0">
                <div className="text-lg font-bold sm:text-xl">{l.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">Season {l.season}</div>
              </div>
            </Link>
          ) : (
            <Link key={l.id} to="/competitions/$id" params={{ id: String(l.id) }} className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-6 transition hover:border-primary/50 hover:shadow-lg">
              <img src={`https://media.api-sports.io/football/leagues/${l.id}.png`} alt={`${l.name} logo`} className="h-14 w-14 shrink-0 object-contain" />
              <div className="min-w-0">
                <div className="text-lg font-bold sm:text-xl">{l.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">Season {l.season}</div>
              </div>
            </Link>
          )
        ))}
      </div>
    </AppShell>
  );
}