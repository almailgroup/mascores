import { createFileRoute } from "@tanstack/react-router";
import { AppShell, EmptyState, SectionHeader } from "@/components/app-shell";
import { Newspaper } from "lucide-react";

export const Route = createFileRoute("/news")({
  head: () => ({ meta: [
    { title: "Football News — MansourAlmailScores" },
    { name: "description", content: "Football news, transfers and headlines." },
    { property: "og:title", content: "Football News — MansourAlmailScores" },
    { property: "og:description", content: "Football news, transfers and headlines." },
  ] }),
  component: NewsPage,
});

function NewsPage() {
  return (
    <AppShell>
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8">
        <Newspaper className="h-10 w-10 text-primary" />
        <h1 className="mt-3 text-3xl font-black">Football news</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Featured headlines, transfer rumours, and long-reads from every top competition.</p>
      </div>
      <div className="mt-8">
        <SectionHeader title="Latest headlines" />
        <EmptyState
          title="News feed coming soon"
          description="A curated news feed is being wired up. Meanwhile, follow match centers and player profiles for live storylines."
        />
      </div>
    </AppShell>
  );
}