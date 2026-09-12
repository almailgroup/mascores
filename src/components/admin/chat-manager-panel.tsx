import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessagesSquare, Send, Trash2, Loader2, Search } from "lucide-react";
import { supabase } from "@/lib/db";
import { postChatMessage, adminDeleteChatMessage, getChatAuthorProfiles } from "@/lib/chat.functions";
import { btnGhost, btnPrimary, inputCls } from "./ui";

type MatchRow = {
  id: string;
  kickoff_at: string | null;
  status: string;
  home: { name: string } | null;
  away: { name: string } | null;
  competition: { name: string } | null;
};

type Message = { id: string; user_id: string; body: string; created_at: string };

/**
 * Match chat from the control centre: pick a match, write a message as yourself,
 * and take down anything that should not be there.
 */
export function ChatManagerPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [matchId, setMatchId] = useState<string>("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const post = useServerFn(postChatMessage);
  const remove = useServerFn(adminDeleteChatMessage);
  const authorsFn = useServerFn(getChatAuthorProfiles);

  const matchesQ = useQuery({
    queryKey: ["admin", "chat-matches"],
    queryFn: async () =>
      ((await supabase
        .from("matches")
        .select("id,kickoff_at,status,home:teams!matches_home_team_id_fkey(name),away:teams!matches_away_team_id_fkey(name),competition:competitions(name)")
        .order("kickoff_at", { ascending: false })
        .limit(200)).data ?? []) as unknown as MatchRow[],
  });

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = matchesQ.data ?? [];
    if (!q) return rows.slice(0, 40);
    return rows
      .filter((m) => `${m.home?.name ?? ""} ${m.away?.name ?? ""} ${m.competition?.name ?? ""}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [matchesQ.data, search]);

  const messagesKey = ["admin", "chat-messages", matchId];
  const messagesQ = useQuery({
    enabled: !!matchId,
    queryKey: messagesKey,
    refetchInterval: 15000,
    queryFn: async () =>
      ((await supabase.from("match_chat_messages").select("id,user_id,body,created_at")
        .eq("match_id", matchId).order("created_at", { ascending: false }).limit(300)).data ?? []) as Message[],
  });

  const authorIds = [...new Set((messagesQ.data ?? []).map((m) => m.user_id))];
  const authorsQ = useQuery({
    enabled: authorIds.length > 0,
    queryKey: ["admin", "chat-authors", authorIds.join(",")],
    queryFn: () => authorsFn({ data: { ids: authorIds } }),
  });
  const nameOf = (id: string) =>
    (authorsQ.data ?? []).find((a: { id: string; display_name: string | null }) => a.id === id)?.display_name ?? "Supporter";

  const send = async () => {
    if (!matchId || !body.trim()) return;
    setBusy(true); setError(null);
    try {
      await post({ data: { matchId, body: body.trim() } });
      setBody("");
      qc.invalidateQueries({ queryKey: messagesKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send that message.");
    } finally { setBusy(false); }
  };

  const del = async (id: string) => {
    setError(null);
    try {
      await remove({ data: { messageId: id } });
      qc.invalidateQueries({ queryKey: messagesKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete that message.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2"><MessagesSquare className="h-4 w-4 text-primary" /><h2 className="font-bold">Match chat</h2></div>
      <p className="mb-3 text-sm text-muted-foreground">Pick a match to write in its chat and to remove any message.</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Competition</span>
          <select className={inputCls} value={competition} onChange={(e) => { setCompetition(e.target.value); setMatchId(""); }}>
            <option value="">All competitions</option>
            {competitions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="relative block">
          <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Search</span>
          <Search className="pointer-events-none absolute left-3 top-[2.15rem] h-3.5 w-3.5 text-muted-foreground" />
          <input className={`${inputCls} pl-9`} placeholder="Search clubs" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      {/* Matches are listed inside the page, not in the phone's own dropdown. */}
      <div className="mt-3 max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
        {matches.map((m) => (
          <button key={m.id} type="button" onClick={() => setMatchId(m.id)}
            className={`flex w-full items-center gap-2 rounded-xl border p-2 text-start ${matchId === m.id ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent"}`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{(m.home?.name ?? "Home")} vs {(m.away?.name ?? "Away")}</span>
              <span className="block truncate text-[0.65rem] text-muted-foreground">{[m.competition?.name, m.kickoff_at ? new Date(m.kickoff_at).toLocaleDateString() : null, m.status.toUpperCase()].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
        ))}
        {matches.length === 0 && <div className="p-3 text-center text-xs text-muted-foreground">{matchesQ.isLoading ? "Loading matches…" : "No match matches those filters."}</div>}
      </div>


      {matchId && (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <textarea rows={2} className={`${inputCls} min-w-[16rem] flex-1`} placeholder="Write a message" value={body} onChange={(e) => setBody(e.target.value)} />
            <button className={btnPrimary} disabled={busy || !body.trim()} onClick={send}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
            </button>
          </div>
          {error && <div className="mt-2 text-sm text-destructive">{error}</div>}

          <div className="mt-4 grid gap-2">
            {messagesQ.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            {(messagesQ.data ?? []).map((m) => (
              <div key={m.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">{nameOf(m.user_id)} · {new Date(m.created_at).toLocaleString()}</div>
                  <p className="mt-1 break-words">{m.body}</p>
                </div>
                <button className={btnGhost} onClick={() => del(m.id)}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </div>
            ))}
            {messagesQ.data && messagesQ.data.length === 0 && (
              <div className="rounded border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No messages in this match chat yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
