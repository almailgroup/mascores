import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NewsSubmissionsPanel } from "./news-submissions-panel";
import { btnGhost } from "./ui";
import { useServerFn } from "@tanstack/react-start";
import { listChangeRequests, decideChangeRequest } from "@/lib/review.functions";

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

      <PendingChanges />

      <PendingTickets />

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">News sent in</h3>
        <NewsSubmissionsPanel />
      </div>
    </div>
  );
}

type PendingOffer = {
  id: string; name: string; stand: string | null; price: number; currency: string; is_free: boolean;
  capacity: number | null; match_id: string; created_at: string;
};

/** Tickets a limited admin created — they stay off sale until the owner says yes. */
function PendingTickets() {
  const qc = useQueryClient();
  const offers = useQuery({
    queryKey: ["approval-tickets"],
    queryFn: async () =>
      ((await supabase
        .from("ticket_offers")
        .select("id,name,stand,price,currency,is_free,capacity,match_id,created_at")
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false })).data ?? []) as PendingOffer[],
  });
  const matches = useQuery({
    queryKey: ["approval-ticket-matches"],
    queryFn: async () =>
      (await supabase.from("matches").select("id, kickoff_at, home:home_team_id(name), away:away_team_id(name)").limit(500)).data ?? [],
  });
  const matchLabel = (id: string) => {
    const m = (matches.data ?? []).find((row) => row.id === id) as { home?: { name?: string } | null; away?: { name?: string } | null; kickoff_at?: string | null } | undefined;
    if (!m) return "Match";
    return `${m.home?.name ?? "TBD"} vs ${m.away?.name ?? "TBD"}${m.kickoff_at ? ` · ${new Date(m.kickoff_at).toLocaleString()}` : ""}`;
  };

  const decide = async (id: string, approve: boolean) => {
    await supabase
      .from("ticket_offers")
      .update(approve ? { approval_status: "approved", is_active: true } : { approval_status: "rejected", is_active: false })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["approval-tickets"] });
    qc.invalidateQueries({ queryKey: ["admin-ticket-offers"] });
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">Tickets</h3>
      {offers.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      <div className="space-y-2">
        {(offers.data ?? []).map((offer) => (
          <div key={offer.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
            <div className="min-w-0 flex-1 basis-[55%]">
              <div className="truncate text-sm font-bold">
                {offer.name}{offer.stand ? ` · ${offer.stand}` : ""} <span className="text-muted-foreground">{offer.is_free ? "· Free" : `· ${offer.price} ${offer.currency}`}</span>
              </div>
              <div className="truncate text-[0.7rem] text-muted-foreground">{matchLabel(offer.match_id)}</div>
              {offer.capacity ? <div className="text-[0.65rem] text-muted-foreground">{offer.capacity} places</div> : null}
            </div>
            <button className={btnGhost} onClick={() => decide(offer.id, true)}><Check className="h-3.5 w-3.5" /> Approve</button>
            <button className={btnGhost} onClick={() => decide(offer.id, false)}><X className="h-3.5 w-3.5" /> Reject</button>
          </div>
        ))}
        {!offers.isLoading && (offers.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No tickets are waiting.</p>}
      </div>
    </div>
  );
}


const ENTITY_LABEL: Record<string, string> = { player: "Player", team: "Team", match: "Match", competition_team: "Team in competition" };

/** Additions and removals a limited admin asked for: players, teams and matches. */
function PendingChanges() {
  const qc = useQueryClient();
  const list = useServerFn(listChangeRequests);
  const decideFn = useServerFn(decideChangeRequest);
  const [error, setError] = useState<string | null>(null);
  const requests = useQuery({ queryKey: ["approval-changes"], queryFn: () => list({}) });

  const decide = async (id: string, approve: boolean) => {
    setError(null);
    try {
      await decideFn({ data: { id, approve } });
      qc.invalidateQueries({ queryKey: ["approval-changes"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that.");
    }
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">Players, teams and matches</h3>
      {error && <p className="mb-2 text-xs font-semibold text-destructive">{error}</p>}
      <div className="space-y-3">
        {requests.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {(requests.data ?? []).map((row) => (
          <div key={row.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
              {ENTITY_LABEL[row.entity] ?? row.entity} · {row.action === "create" ? "Add" : "Remove"}
            </div>
            <div className="mt-1 font-semibold">{row.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{row.requester_email ?? "an admin"} · {new Date(row.created_at).toLocaleString()}</div>
            <div className="mt-3 flex gap-2">
              <button className={btnGhost} onClick={() => decide(row.id, true)}><Check className="h-3.5 w-3.5" /> Approve</button>
              <button className={btnGhost} onClick={() => decide(row.id, false)}><X className="h-3.5 w-3.5" /> Reject</button>
            </div>
          </div>
        ))}
        {!requests.isLoading && (requests.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nothing is waiting.</p>}
      </div>
    </div>
  );
}
