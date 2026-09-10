import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NewsSubmissionsPanel } from "./news-submissions-panel";
import { btnGhost } from "./ui";

type PendingPost = { id: string; team_id: string; title: string; body: string; photo_url: string | null; meeting_place: string | null; created_at: string };

/**
 * One place for everything waiting on the owner: news sent in by contributors
 * and Rabta posts. Editing existing entries never needs approval.
 */
export function ApprovalsPanel() {
  const qc = useQueryClient();
  const teams = useQuery({
    queryKey: ["approval-teams"],
    queryFn: async () => (await supabase.from("teams").select("id,name").order("name")).data ?? [],
  });
  const posts = useQuery({
    queryKey: ["approval-rabta"],
    queryFn: async () =>
      ((await supabase.from("ultras_posts").select("id,team_id,title,body,photo_url,meeting_place,created_at").eq("status", "pending").order("created_at", { ascending: false })).data ?? []) as PendingPost[],
  });
  const teamName = new Map((teams.data ?? []).map((t) => [t.id, t.name]));
  const decide = async (id: string, status: "approved" | "rejected") => {
    await supabase.from("ultras_posts").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["approval-rabta"] });
    qc.invalidateQueries({ queryKey: ["ultras-posts"] });
  };

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-bold">Waiting for approval</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything someone sent in for a yes or no. Approve it and it goes live straight away.
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">Rabta posts</h3>
        {posts.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        <div className="space-y-2">
          {(posts.data ?? []).map((post) => (
            <div key={post.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
              {post.photo_url && <img src={post.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1 basis-[55%]">
                <div className="truncate text-sm font-bold">{post.title}</div>
                <div className="truncate text-[0.7rem] text-muted-foreground">
                  {teamName.get(post.team_id) ?? "Club"}{post.meeting_place ? ` · ${post.meeting_place}` : ""}
                </div>
                <div className="line-clamp-2 text-[0.7rem] text-muted-foreground">{post.body}</div>
              </div>
              <button className={btnGhost} onClick={() => decide(post.id, "approved")}><Check className="h-3.5 w-3.5" /> Approve</button>
              <button className={btnGhost} onClick={() => decide(post.id, "rejected")}><X className="h-3.5 w-3.5" /> Reject</button>
            </div>
          ))}
          {!posts.isLoading && (posts.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No Rabta posts are waiting.</p>}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">News sent in</h3>
        <NewsSubmissionsPanel />
      </div>
    </div>
  );
}
