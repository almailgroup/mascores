import { useQuery } from "@tanstack/react-query";
import { Loader2, Clock, Check, X, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Row = {
  id: string;
  entity: string;
  action: string;
  label: string;
  status: string;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

const ENTITY_LABEL: Record<string, string> = {
  player: "Player",
  team: "Team",
  match: "Match",
  competition_team: "Team in competition",
};

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string; Icon: typeof Check }> = {
    approved: { text: "Accepted", cls: "bg-emerald-500/15 text-emerald-500", Icon: Check },
    rejected: { text: "Rejected", cls: "bg-destructive/15 text-destructive", Icon: X },
    pending: { text: "Waiting for review", cls: "bg-amber-500/15 text-amber-500", Icon: Clock },
  };
  const s = map[status] ?? map["pending"]!;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[0.7rem] font-bold ${s.cls}`}>
      <s.Icon className="h-3 w-3" /> {s.text}
    </span>
  );
}

/**
 * What happened to everything this admin sent for review: still waiting,
 * accepted, or turned down with the reason the owner gave.
 */
export function MyRequestsPanel() {
  const { user } = useAuth();
  const changes = useQuery({
    enabled: !!user,
    queryKey: ["my-change-requests", user?.id],
    refetchInterval: 30000,
    queryFn: async () =>
      ((await supabase.from("admin_change_requests").select("id,entity,action,label,status,review_note,created_at,updated_at")
        .order("created_at", { ascending: false }).limit(100)).data ?? []) as Row[],
  });

  const tickets = useQuery({
    enabled: !!user,
    queryKey: ["my-ticket-requests", user?.id],
    refetchInterval: 30000,
    queryFn: async () =>
      ((await supabase.from("ticket_offers").select("id,name,approval_status,review_note,created_at,match:matches(home:teams!matches_home_team_id_fkey(name),away:teams!matches_away_team_id_fkey(name))")
        .eq("created_by", user!.id).order("created_at", { ascending: false }).limit(50)).data ?? []) as unknown as {
          id: string; name: string; approval_status: string; review_note: string | null; created_at: string;
          match: { home: { name: string } | null; away: { name: string } | null } | null;
        }[],
  });

  const ultras = useQuery({
    enabled: !!user,
    queryKey: ["my-ultras-requests", user?.id],
    refetchInterval: 30000,
    queryFn: async () =>
      ((await supabase.from("ultras_posts").select("id,title,status,review_note,created_at")
        .eq("author_id", user!.id).order("created_at", { ascending: false }).limit(50)).data ?? []) as unknown as
        { id: string; title: string; status: string; review_note: string | null; created_at: string }[],
  });

  const loading = changes.isLoading || tickets.isLoading || ultras.isLoading;
  const empty = !loading && !changes.data?.length && !tickets.data?.length && !ultras.data?.length;
  const when = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">My requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">Everything you sent for review, and whether it was accepted or rejected.</p>
        </div>
        <button
          onClick={() => { changes.refetch(); tickets.refetch(); ultras.refetch(); }}
          disabled={refreshing}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold hover:bg-accent disabled:opacity-70"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      {empty && <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">You have not sent anything for review yet. Adding or removing clubs, players and matches goes to the site owner first.</p>}

      <div className="space-y-2">
        {(changes.data ?? []).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{r.label}</div>
              <div className="text-[0.7rem] text-muted-foreground">
                {(ENTITY_LABEL[r.entity] ?? r.entity)} · {r.action === "delete" ? "remove" : "add"} · {when(r.created_at)}
              </div>
              {r.review_note && <div className="mt-1 text-[0.7rem] font-semibold text-muted-foreground">Owner note: {r.review_note}</div>}
            </div>
            <StatusPill status={r.status} />
          </div>
        ))}

        {(tickets.data ?? []).map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">Tickets · {t.name}</div>
              <div className="text-[0.7rem] text-muted-foreground">
                {t.match ? `${t.match.home?.name ?? "Home"} vs ${t.match.away?.name ?? "Away"} · ` : ""}{when(t.created_at)}
              </div>
              {t.review_note && <div className="mt-1 text-[0.7rem] font-semibold text-muted-foreground">Owner note: {t.review_note}</div>}
            </div>
            <StatusPill status={t.approval_status} />
          </div>
        ))}

        {(ultras.data ?? []).map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">Rabta post · {u.title}</div>
              <div className="text-[0.7rem] text-muted-foreground">{when(u.created_at)}</div>
              {u.review_note && <div className="mt-1 text-[0.7rem] font-semibold text-muted-foreground">Owner note: {u.review_note}</div>}
            </div>
            <StatusPill status={u.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
