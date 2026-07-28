import { createFileRoute } from "@tanstack/react-router";
import { AppShell, EmptyState } from "@/components/app-shell";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Favorites — MansourAlmailScores" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AppShell>
      <EmptyState title="Favorites coming online" description="Save teams, players, competitions and matches from their pages — they'll appear here." />
    </AppShell>
  ),
});