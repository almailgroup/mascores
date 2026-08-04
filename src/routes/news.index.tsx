import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { supabase, type NewsPost } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { useAutoTranslate } from "@/lib/auto-translate";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/news/")({
  head: () => ({ meta: [{ title: "News — MansourAlmailScores" }, { name: "description", content: "Latest football news from MansourAlmailScores." }] }),
  component: NewsPage,
});

function NewsPage() {
  useRealtime(["news_posts"]);
  const q = useQuery({ queryKey: ["news"], queryFn: async () => {
    const { data } = await supabase.from("news_posts").select("*").not("published_at", "is", null).lte("published_at", new Date().toISOString()).order("published_at", { ascending: false });
    return (data ?? []) as NewsPost[];
  }});
  const posts = q.data ?? [];
  const { lang, t } = useI18n();
  const tx = useAutoTranslate(posts.flatMap((n) => [n.title, n.excerpt]));
  return (
    <AppShell>
       <SectionHeader title={t("nav.news")} />
      {q.isLoading ? <LoadingSkeleton /> : !q.data || q.data.length === 0 ? (
        <EmptyState title="No news yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((n) => (
            <Link key={n.id} to="/news/$slug" params={{ slug: n.slug }} className="block overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/50 hover:shadow-lg">
              {n.cover_url && (
                <div className="flex aspect-video w-full items-center justify-center bg-muted/60">
                  <img src={n.cover_url} alt="" className="h-full w-full object-contain" />
                </div>
              )}
              <div className="p-4">
                 <h2 className="font-semibold">{lang === "ar" && n.title_ar ? n.title_ar : tx(n.title)}</h2>
                 {(n.excerpt || n.excerpt_ar) && <p className="mt-1 text-sm text-muted-foreground">{lang === "ar" && n.excerpt_ar ? n.excerpt_ar : tx(n.excerpt)}</p>}
                <div className="mt-2 text-xs text-muted-foreground">{n.published_at ? new Date(n.published_at).toLocaleDateString() : ""}{n.author_display ? ` · ${n.author_display}` : ""}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}