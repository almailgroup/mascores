import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const EMOJIS = ["👏", "❤️", "😂", "🔥", "⚽"] as const;
type Burst = { id: string; emoji: string };

export function VoiceReactions({ roomId, userId }: { roomId: string; userId: string | undefined }) {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    const channel = supabase.channel(`voice-reactions-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "voice_room_reactions", filter: `room_id=eq.${roomId}` }, ({ new: row }) => {
        const burst = row as Burst;
        setBursts((current) => [...current.slice(-7), burst]);
        window.setTimeout(() => setBursts((current) => current.filter((item) => item.id !== burst.id)), 2200);
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [roomId]);

  const react = async (emoji: string) => {
    if (!userId) return;
    await supabase.from("voice_room_reactions").insert({ room_id: roomId, user_id: userId, emoji } as never);
  };

  return <div className="relative mt-4">
    <div className="pointer-events-none absolute -top-20 inset-x-0 flex justify-center gap-2" aria-hidden>
      {bursts.map((burst) => <span key={burst.id} className="animate-bounce text-2xl">{burst.emoji}</span>)}
    </div>
    <div className="flex items-center justify-center gap-1 rounded-full border border-border bg-card p-1.5 shadow-sm">
      {EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => void react(emoji)} className="grid h-9 w-9 place-items-center rounded-full text-lg transition hover:bg-muted active:scale-90" aria-label={`React ${emoji}`}>{emoji}</button>)}
    </div>
  </div>;
}