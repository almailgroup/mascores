import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase, type NewsPost } from "@/lib/db";
import { EmptyState } from "@/components/app-shell";
import { useAutoTranslate } from "@/lib/auto-translate";

type Kind = "team" | "competition" | "player";
const COLUMN: Record<Kind, "team_id" | "competition_id" | "player_id"> = {
  team: "team_id",
  competition: "competition_id",
  player: "player_id",
};

/** News articles an admin linked to this club, competition or player. */
export function LinkedNews({ kind, id }: { kind: Kind; id: string }) {
  const q = useQuery({
    queryKey: ["linked-news", kind, id],
    queryFn: async () => {
      const { data } = await supabase
        .from("news_posts")
        .select("*")
        .eq(COLUMN[kind], id)
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(30);
      return (data ?? []) as NewsPost[];
    },
  });

  const posts = q.data ?? [];
  const tx = useAutoTranslate(posts.flatMap((p) => [p.title, p.excerpt]));

  if (q.isLoading) return <div className="h-24 animate-pulse rounded-2xl bg-muted" />;
  if (posts.length === 0) return <EmptyState title="No news yet" />;

  return (
    <div className="grid gap-3">
      {posts.map((p) => (
        <Link key={p.id} to="/news/$slug" params={{ slug: p.slug }} className="flex gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50">
          {p.cover_url && (
            <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
              <img src={p.cover_url} alt="" className="h-full w-full object-contain" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 font-semibold">{tx(p.title)}</div>
            {p.excerpt && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tx(p.excerpt)}</div>}
            {p.published_at && <div className="mt-1 text-[0.65rem] text-muted-foreground">{new Date(p.published_at).toLocaleDateString()}</div>}
          </div>
        </Link>
      ))}
    </div>
  );
}
