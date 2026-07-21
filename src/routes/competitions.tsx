import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, SectionHeader } from "@/components/app-shell";
import { FEATURED_LEAGUES } from "@/lib/football";
import { Trophy } from "lucide-react";

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
            <Link key={l.id} to="/world-cup-2026" className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary/50 hover:shadow-lg">
              <Trophy className="h-8 w-8 text-primary" />
              <div className="mt-4 text-xl font-bold">{l.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">Season {l.season}</div>
            </Link>
          ) : (
            <Link key={l.id} to="/competitions/$id" params={{ id: String(l.id) }} className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary/50 hover:shadow-lg">
              <Trophy className="h-8 w-8 text-primary" />
              <div className="mt-4 text-xl font-bold">{l.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">Season {l.season}</div>
            </Link>
          )
        ))}
      </div>
    </AppShell>
  );
}