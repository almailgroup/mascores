import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { supabase, type NewsPost } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/news")({
  head: () => ({ meta: [{ title: "News — MansourAlmailScores" }, { name: "description", content: "Latest football news from MansourAlmailScores." }] }),
  component: NewsPage,
});

function NewsPage() {
  useRealtime(["news_posts"]);
  const q = useQuery({ queryKey: ["news"], queryFn: async () => {
    const { data } = await supabase.from("news_posts").select("*").not("published_at", "is", null).order("published_at", { ascending: false });
    return (data ?? []) as NewsPost[];
  }});
  return (
    <AppShell>
      <SectionHeader title="News" />
      {q.isLoading ? <LoadingSkeleton /> : !q.data || q.data.length === 0 ? (
        <EmptyState title="No news yet" description="Add posts from the admin panel." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((n) => (
            <article key={n.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              {n.cover_url && <img src={n.cover_url} alt="" className="h-40 w-full object-cover" />}
              <div className="p-4">
                <h2 className="font-semibold">{n.title}</h2>
                {n.excerpt && <p className="mt-1 text-sm text-muted-foreground">{n.excerpt}</p>}
                <div className="mt-2 text-xs text-muted-foreground">{n.published_at ? new Date(n.published_at).toLocaleDateString() : ""}{n.author_display ? ` · ${n.author_display}` : ""}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}