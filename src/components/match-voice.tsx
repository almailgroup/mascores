import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mic, Plus, Radio, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTx } from "@/lib/auto-translate";
import { VoiceReplays } from "@/components/voice-replays";
import { roomCover, type VoiceRoom } from "@/lib/voice";

type RoomRow = VoiceRoom & { listeners: number };

/** Live voice rooms attached to this match, plus a shortcut to host one. */
export function MatchVoice({ matchId }: { matchId: string }) {
  const tx = useTx();
  const rooms = useQuery({
    queryKey: ["match-voice-rooms", matchId],
    refetchInterval: 20000,
    queryFn: async (): Promise<RoomRow[]> => {
      const { data } = await supabase
        .from("voice_rooms")
        .select("id, host_id, title, description, photo_url, visibility, invite_code, status, started_at, ended_at")
        .eq("match_id", matchId)
        .eq("status", "live")
        .order("started_at", { ascending: false });
      const list = (data ?? []) as unknown as VoiceRoom[];
      if (list.length === 0) return [];
      const { data: counts } = await supabase
        .from("voice_room_participants")
        .select("room_id")
        .in("room_id", list.map((room) => room.id))
        .is("left_at", null);
      const tally: Record<string, number> = {};
      ((counts ?? []) as { room_id: string }[]).forEach((row) => { tally[row.room_id] = (tally[row.room_id] ?? 0) + 1; });
      return list.map((room) => ({ ...room, listeners: tally[room.id] ?? 0 }));
    },
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="inline-flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-primary" /> {tx("Match voice rooms")}
        </span>
        <Link to="/voice" search={{ match: matchId }} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[0.7rem] font-bold text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> {tx("Start a room")}
        </Link>
      </div>
      {(rooms.data?.length ?? 0) === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">{tx("No live room for this match yet. Start one and fans can join in seconds.")}</p>
      ) : (
        <div className="divide-y divide-border">
          {(rooms.data ?? []).map((room) => (
            <Link key={room.id} to="/voice/$id" params={{ id: room.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
              <img src={roomCover(room)} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{room.title}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-destructive">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" /> {tx("Live")}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> {room.listeners}</span>
              <Mic className="h-4 w-4 shrink-0 text-primary" />
            </Link>
          ))}
        </div>
      )}
      <div className="border-t border-border p-4">
        <div className="mb-2 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Replays")}</div>
        <VoiceReplays matchId={matchId} limit={5} />
      </div>
    </section>
  );
}
