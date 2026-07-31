import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, type NewsPost } from "@/lib/db";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/news/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — MansourAlmailScores` },
      { name: "description", content: "Full article on MansourAlmailScores." },
      { property: "og:title", content: "MansourAlmailScores news" },
      { property: "og:description", content: "Full article on MansourAlmailScores." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const q = useQuery({
    queryKey: ["news", slug],
    queryFn: async () => {
      const { data } = await supabase.from("news_posts").select("*").eq("slug", slug).maybeSingle();
      return data as NewsPost | null;
    },
  });
  if (q.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!q.data) return <AppShell><EmptyState title="Article not found" /></AppShell>;
  const n = q.data;
  return (
    <AppShell>
      <Link to="/news" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> News</Link>
      <article className="overflow-hidden rounded-3xl border border-border bg-card">
        {n.cover_url && <img src={n.cover_url} alt="" className="h-64 w-full object-cover" />}
        <div className="p-6 sm:p-8">
          <h1 className="text-2xl font-black tracking-tight sm:text-4xl">{n.title}</h1>
          <div className="mt-2 text-xs text-muted-foreground">
            {n.published_at ? new Date(n.published_at).toLocaleDateString(undefined, { dateStyle: "long" }) : ""}
            {n.author_display ? ` · ${n.author_display}` : ""}
          </div>
          <div className="mt-6 space-y-4 text-[0.95rem] leading-7 text-foreground/90">
            {n.body_markdown.split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-wrap">{para}</p>)}
          </div>
        </div>
      </article>
    </AppShell>
  );
}