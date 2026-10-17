import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { uploadMedia } from "@/components/admin/upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
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
  const { lang } = useI18n();
  const label = (en: string, ar: string) => lang === "ar" ? ar : en;
  const [editing, setEditing] = useState<Replay | null>(null);
  const [title, setTitle] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
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
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Replay[];
    },
  });

  const remove = async (replay: Replay) => {
    if (!window.confirm(tx("Delete this replay permanently?"))) return;
    const { error } = await supabase.from("voice_recordings").delete().eq("id", replay.id);
    if (error) { toast.error(label("Could not delete replay", "تعذر حذف التسجيل")); return; }
    await qc.invalidateQueries({ queryKey: ["voice-replays"] });
  };

  if (replays.isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if ((replays.data?.length ?? 0) === 0) {
    return <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">{tx("No saved voice chats yet. Hosts can record a room and it appears here to replay.")}</p>;
  }

  return (
    <div className="space-y-3">
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open && !busy) setEditing(null); }}>
        <DialogContent><DialogHeader><DialogTitle>{label("Edit replay", "تعديل التسجيل")}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={async (event) => {
            event.preventDefault();
            if (!editing || !user || !title.trim() || busy) return;
            setBusy(true);
            try {
              let cover = editing.cover_url;
              if (photo) { cover = await uploadMedia("voice-photos", photo, user.id); if (!cover) throw new Error("Upload failed"); }
              const { error } = await supabase.from("voice_recordings").update({ title: title.trim(), cover_url: cover }).eq("id", editing.id).eq("host_id", user.id);
              if (error) throw error;
              await qc.invalidateQueries({ queryKey: ["voice-replays"] });
              setEditing(null);
            } catch { toast.error(label("Could not save replay", "تعذر حفظ التسجيل")); }
            finally { setBusy(false); }
          }}>
            <label className="block text-sm">{label("Title", "العنوان")}<input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-base" /></label>
            <label className="block text-sm">{label("Photo", "الصورة")}<input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-base" /></label>
            <button disabled={busy || !title.trim()} className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">{label("Save", "حفظ")}</button>
          </form>
        </DialogContent>
      </Dialog>
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
            {replay.host_id === user?.id && <button className="text-sm font-semibold text-primary" onClick={() => { setEditing(replay); setTitle(replay.title); setPhoto(null); }}>{label("Edit", "تعديل")}</button>}
            {replay.host_id === user?.id && (
              <button
                onClick={async () => {
                  await supabase.from("voice_recordings").update({ is_public: !replay.is_public }).eq("id", replay.id);
                  await qc.invalidateQueries({ queryKey: ["voice-replays"] });
                }}
                className={`shrink-0 rounded-full px-3 py-1 text-[0.6rem] font-bold ${replay.is_public ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
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
