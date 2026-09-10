import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlayCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTx } from "@/lib/auto-translate";
import { generatedCover } from "@/lib/voice";

export type Replay = {
  id: string;
  host_id: string;
  title: string;
  cover_url: string | null;
  audio_url: string;
  duration_seconds: number;
  created_at: string;
  match_id: string | null;
  is_public: boolean;
};

function length(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${mins}:${String(rest).padStart(2, "0")}`;
}

/** Saved voice rooms anyone can play back again. */
export function VoiceReplays({ hostId, matchId, mine = false, limit = 12, publicOnly = false }: { hostId?: string; matchId?: string; mine?: boolean; limit?: number; publicOnly?: boolean }) {
  const tx = useTx();
  const { user } = useAuth();
  const qc = useQueryClient();

  const admin = useQuery({
    enabled: !!user,
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _uid: user!.id });
      return !!data;
    },
  });

  const owner = mine ? user?.id : hostId;

  const replays = useQuery({
    queryKey: ["voice-replays", owner ?? null, matchId ?? null, limit, publicOnly],
    enabled: !mine || !!user,
    queryFn: async () => {
      let query = supabase
        .from("voice_recordings")
        .select("id, host_id, title, cover_url, audio_url, duration_seconds, created_at, match_id, is_public")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (owner) query = query.eq("host_id", owner);
      if (matchId) query = query.eq("match_id", matchId);
      if (publicOnly) query = query.eq("is_public", true);
      const { data } = await query;
      return (data ?? []) as Replay[];
    },
  });

  const remove = async (replay: Replay) => {
    if (!window.confirm(tx("Delete this replay permanently?"))) return;
    await supabase.from("voice_recordings").delete().eq("id", replay.id);
    await qc.invalidateQueries({ queryKey: ["voice-replays"] });
  };

  if (replays.isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if ((replays.data?.length ?? 0) === 0) {
    return <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">{tx("No saved voice chats yet. Hosts can record a room and it appears here to replay.")}</p>;
  }

  return (
    <div className="space-y-3">
      {(replays.data ?? []).map((replay) => (
        <div key={replay.id} className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-3">
            <img src={replay.cover_url ?? generatedCover(replay.title)} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{replay.title}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                <PlayCircle className="h-3 w-3" /> {length(replay.duration_seconds)}
                <span>· {new Date(replay.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            {replay.host_id === user?.id && (
              <button
                onClick={async () => {
                  await supabase.from("voice_recordings").update({ is_public: !replay.is_public }).eq("id", replay.id);
                  await qc.invalidateQueries({ queryKey: ["voice-replays"] });
                }}
                className={`shrink-0 rounded-full px-3 py-1 text-[0.6rem] font-bold ${replay.is_public ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}
              >
                {replay.is_public ? tx("On my profile") : tx("Private")}
              </button>
            )}
            {(replay.host_id === user?.id || admin.data) && (
              <button onClick={() => remove(replay)} aria-label={tx("Delete replay")} className="shrink-0 text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <audio controls preload="none" src={replay.audio_url} className="mt-3 w-full" />
        </div>
      ))}
    </div>
  );
}
