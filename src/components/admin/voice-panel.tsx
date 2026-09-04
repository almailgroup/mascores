import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PhoneOff, Radio, Trash2 } from "lucide-react";
import { supabase } from "@/lib/db";
import { btnDanger, btnGhost } from "./ui";

type Room = {
  id: string;
  title: string;
  host_id: string;
  visibility: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  match_id: string | null;
};

type Recording = {
  id: string;
  title: string;
  audio_url: string;
  duration_seconds: number;
  created_at: string;
};

/** Voice rooms and saved replays with admin removal controls. */
export function VoicePanel() {
  const qc = useQueryClient();

  const rooms = useQuery({
    queryKey: ["admin", "voice-rooms"],
    queryFn: async () =>
      ((await supabase.from("voice_rooms").select("id,title,host_id,visibility,status,started_at,ended_at,match_id").order("started_at", { ascending: false }).limit(200)).data ?? []) as Room[],
  });

  const recordings = useQuery({
    queryKey: ["admin", "voice-recordings"],
    queryFn: async () =>
      ((await supabase.from("voice_recordings").select("id,title,audio_url,duration_seconds,created_at").order("created_at", { ascending: false }).limit(200)).data ?? []) as Recording[],
  });

  const endRoom = async (id: string) => {
    await supabase.rpc("voice_end_room", { _room_id: id });
    await qc.invalidateQueries({ queryKey: ["admin", "voice-rooms"] });
  };

  const deleteRoom = async (id: string) => {
    if (!window.confirm("Delete this voice room permanently?")) return;
    await supabase.rpc("voice_delete_room", { _room_id: id });
    await qc.invalidateQueries({ queryKey: ["admin", "voice-rooms"] });
  };

  const deleteRecording = async (id: string) => {
    if (!window.confirm("Delete this replay permanently?")) return;
    await supabase.from("voice_recordings").delete().eq("id", id);
    await qc.invalidateQueries({ queryKey: ["admin", "voice-recordings"] });
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /><h2 className="font-bold">Voice rooms</h2></div>
        <div className="grid gap-2">
          {(rooms.data ?? []).map((room) => (
            <div key={room.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                <span className={`rounded-full px-2 py-0.5 font-bold ${room.status === "live" ? "bg-destructive/15 text-destructive" : "bg-muted"}`}>{room.status}</span>
                <span>{room.visibility}</span>
                <span>{new Date(room.started_at).toLocaleString()}</span>
                {room.match_id && <Link to="/matches/$id" params={{ id: room.match_id }} className="font-semibold text-primary">Match</Link>}
              </div>
              <div className="mt-1 font-semibold">{room.title}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link to="/voice/$id" params={{ id: room.id }} className={btnGhost}>Open</Link>
                {room.status === "live" && <button onClick={() => endRoom(room.id)} className={btnGhost}><PhoneOff className="h-3 w-3" /> End</button>}
                <button onClick={() => deleteRoom(room.id)} className={btnDanger}><Trash2 className="h-3 w-3" /> Delete</button>
              </div>
            </div>
          ))}
          {(rooms.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No voice rooms yet.</p>}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /><h2 className="font-bold">Saved replays</h2></div>
        <div className="grid gap-2">
          {(recordings.data ?? []).map((rec) => (
            <div key={rec.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{rec.title}</div>
                  <div className="text-[0.65rem] text-muted-foreground">{Math.round(rec.duration_seconds / 60)} min · {new Date(rec.created_at).toLocaleString()}</div>
                </div>
                <button onClick={() => deleteRecording(rec.id)} className={btnDanger}><Trash2 className="h-3 w-3" /> Delete</button>
              </div>
              <audio controls preload="none" src={rec.audio_url} className="mt-2 w-full" />
            </div>
          ))}
          {(recordings.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No replays saved yet.</p>}
        </div>
      </section>
    </div>
  );
}
