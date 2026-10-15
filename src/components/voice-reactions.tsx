import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const EMOJIS = ["👏", "❤️", "😂", "🔥", "⚽"] as const;
const SHOW_MS = 3000;

/**
 * Room reactions: each person's latest emoji shows as a single badge on their
 * own picture for a few seconds, then disappears.
 */
export function useVoiceReactions(roomId: string, userId: string | undefined) {
  const [latest, setLatest] = useState<Record<string, string>>({});
  const timers = useRef<Map<string, number>>(new Map());

  const show = useCallback((who: string, emoji: string) => {
    setLatest((current) => ({ ...current, [who]: emoji }));
    const old = timers.current.get(who);
    if (old) window.clearTimeout(old);
    timers.current.set(who, window.setTimeout(() => {
      setLatest((current) => {
        const next = { ...current };
        delete next[who];
        return next;
      });
      timers.current.delete(who);
    }, SHOW_MS));
  }, []);

  useEffect(() => {
    const channel = supabase.channel(`voice-reactions-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "voice_room_reactions", filter: `room_id=eq.${roomId}` }, ({ new: row }) => {
        const r = row as { user_id: string; emoji: string };
        if (r.user_id && r.emoji) show(r.user_id, r.emoji);
      }).subscribe();
    const pending = timers.current;
    return () => {
      void supabase.removeChannel(channel);
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, [roomId, show]);

  const react = useCallback(async (emoji: string) => {
    if (!userId) return;
    show(userId, emoji); // appear on my picture straight away
    await supabase.from("voice_room_reactions").insert({ room_id: roomId, user_id: userId, emoji } as never);
  }, [roomId, userId, show]);

  return { latest, react };
}

export function VoiceReactions({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="mt-4 flex items-center justify-center gap-1 rounded-full border border-border bg-card p-1.5 shadow-sm">
      {EMOJIS.map((emoji) => (
        <button key={emoji} type="button" onClick={() => onReact(emoji)}
          className="grid h-9 w-9 place-items-center rounded-full text-lg transition hover:bg-muted active:scale-90" aria-label={`React ${emoji}`}>
          {emoji}
        </button>
      ))}
    </div>
  );
}
