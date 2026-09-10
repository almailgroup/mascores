import { useEffect, useRef, useState } from "react";
import { Send, Trash2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTx } from "@/lib/auto-translate";

type Message = { id: string; user_id: string; body: string; created_at: string };
type Author = { display_name: string | null; avatar_url: string | null; username: string | null };

/** Live written messages beside the voice, so listeners can join in without speaking. */
export function VoiceRoomChat({ roomId }: { roomId: string }) {
  const tx = useTx();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [body, setBody] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reload = useRef<() => void>(() => undefined);
  const listRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("voice_room_messages")
        .select("id,user_id,body,created_at")
        .eq("room_id", roomId)
        .order("created_at")
        .limit(200);
      if (!alive) return;
      const rows = (data ?? []) as Message[];
      setMessages(rows);
      const ids = [...new Set(rows.map((m) => m.user_id))];
      if (ids.length) {
        const { data: people } = await supabase.from("profiles").select("id,display_name,avatar_url,username").in("id", ids);
        if (alive) setAuthors(Object.fromEntries((people ?? []).map((p) => [p.id, p as Author])));
      }
    };
    void load();
    const channel = supabase
      .channel(`voice-chat-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_room_messages", filter: `room_id=eq.${roomId}` }, () => void load())
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [roomId]);

  useEffect(() => {
    if (!user) return;
    void supabase.rpc("is_admin", { _uid: user.id }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const send = async () => {
    const text = body.trim();
    if (!text || !user) return;
    setBody("");
    await supabase.from("voice_room_messages").insert({ room_id: roomId, user_id: user.id, body: text } as never);
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" /> {tx("Messages")}
      </div>
      <div ref={listRef} className="max-h-64 space-y-2 overflow-y-auto pe-1">
        {messages.map((m) => {
          const author = authors[m.user_id];
          return (
            <div key={m.id} className="flex items-start gap-2">
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted text-center text-[0.65rem] font-bold leading-7">
                {author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" /> : (author?.display_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[0.65rem] font-bold text-muted-foreground">{author?.display_name ?? author?.username ?? tx("Fan")}</div>
                <div className="break-words text-sm">{m.body}</div>
              </div>
              {(isAdmin || m.user_id === user?.id) && (
                <button
                  aria-label={tx("Delete message")}
                  className="shrink-0 text-destructive"
                  onClick={async () => { await supabase.from("voice_room_messages").delete().eq("id", m.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {messages.length === 0 && <p className="text-xs text-muted-foreground">{tx("No messages yet.")}</p>}
      </div>
      {user ? (
        <form className="mt-3 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={tx("Write a message") ?? ""}
            className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-base outline-none focus:border-primary sm:text-sm" />
          <button type="submit" aria-label={tx("Send")} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Send className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{tx("Sign in to write a message.")}</p>
      )}
    </div>
  );
}
