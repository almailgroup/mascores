import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, MessageSquare, Search, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listModeratedUsers, clearUserSuspension, type ModeratedUser } from "@/lib/moderation.functions";
import { inputCls, btnGhost } from "./ui";

type Feedback = { id: string; user_id: string | null; email: string | null; message: string; created_at: string };

/**
 * Appeals and account health: what restricted people wrote back, the state of
 * every restricted account, and everything else sent through the feedback box.
 */
export function AppealsPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const load = useServerFn(listModeratedUsers);
  const clear = useServerFn(clearUserSuspension);

  const feedback = useQuery({
    queryKey: ["admin-appeals"],
    refetchInterval: 60000,
    queryFn: async () =>
      ((await supabase.from("app_feedback").select("id,user_id,email,message,created_at")
        .order("created_at", { ascending: false }).limit(200)).data ?? []) as Feedback[],
  });

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => load({ data: {} }) });

  const byId = new Map((users.data ?? []).map((u) => [u.id, u]));
  const appeals = (feedback.data ?? []).filter((f) => f.message.startsWith("APPEAL:"));
  const other = (feedback.data ?? []).filter((f) => !f.message.startsWith("APPEAL:"));
  const term = search.trim().toLowerCase();
  const restricted = (users.data ?? [])
    .filter((u) => u.banned || (u.suspendedUntil && new Date(u.suspendedUntil).getTime() > Date.now()))
    .filter((u) => !term || (u.email ?? "").toLowerCase().includes(term) || (u.displayName ?? "").toLowerCase().includes(term));

  const state = (u: ModeratedUser) => {
    if (u.banned) return "Banned";
    if (u.suspendedUntil) return `Suspended until ${new Date(u.suspendedUntil).toLocaleString()}`;
    return "Active";
  };
  const lift = async (id: string) => {
    await clear({ data: { userId: id } });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  const when = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-bold">Appeals</h2>
        <p className="mt-1 text-sm text-muted-foreground">Messages from people who were banned or suspended, with their current account state.</p>

        {feedback.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {!feedback.isLoading && appeals.length === 0 && (
          <p className="mt-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No appeals right now.</p>
        )}
        <div className="mt-3 space-y-2">
          {appeals.map((a) => {
            const u = a.user_id ? byId.get(a.user_id) : undefined;
            const still = u && (u.banned || (u.suspendedUntil && new Date(u.suspendedUntil).getTime() > Date.now()));
            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{u?.displayName ?? u?.email ?? a.email ?? "Account"}</span>
                  {u?.email && <span className="text-[0.7rem] text-muted-foreground">{u.email}</span>}
                  <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold ${still ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-500"}`}>
                    {u ? state(u) : "Account not found"}
                  </span>
                  <span className="ms-auto text-[0.65rem] text-muted-foreground">{when(a.created_at)}</span>
                </div>
                {u?.reason && <p className="mt-1 text-[0.7rem] font-semibold text-muted-foreground">Reason given: {u.reason}</p>}
                <p className="mt-2 whitespace-pre-wrap text-sm">{a.message.replace(/^APPEAL:\s*/, "")}</p>
                {still && (
                  <button className={`${btnGhost} mt-3`} onClick={() => lift(u!.id)}>
                    <ShieldCheck className="h-3.5 w-3.5" /> Lift restriction
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-base font-bold">Restricted accounts</h3>
        <p className="mt-1 text-sm text-muted-foreground">Everyone currently banned or suspended.</p>
        <div className="relative mb-3 mt-3 max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input className={`${inputCls} ps-8`} placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {users.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {!users.isLoading && restricted.length === 0 && (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No restricted accounts.</p>
        )}
        <div className="space-y-2">
          {restricted.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{u.displayName ?? u.email ?? "Account"}</div>
                <div className="truncate text-[0.7rem] text-muted-foreground">{u.email}</div>
                <div className="mt-0.5 text-[0.65rem] font-semibold text-destructive">{state(u)}{u.reason ? ` · ${u.reason}` : ""}</div>
              </div>
              <button className={btnGhost} onClick={() => lift(u.id)}><ShieldCheck className="h-3.5 w-3.5" /> Lift</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-base font-bold"><Inbox className="h-4 w-4" /> Other feedback</h3>
        <p className="mt-1 text-sm text-muted-foreground">Everything else people sent from Settings.</p>
        {!feedback.isLoading && other.length === 0 && (
          <p className="mt-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No feedback yet.</p>
        )}
        <div className="mt-3 space-y-2">
          {other.map((f) => {
            const u = f.user_id ? byId.get(f.user_id) : undefined;
            return (
              <div key={f.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="font-semibold text-foreground">{u?.displayName ?? f.email ?? u?.email ?? "Someone"}</span>
                  {(u?.email ?? f.email) && <span>{u?.email ?? f.email}</span>}
                  <span className="ms-auto">{when(f.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{f.message}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
