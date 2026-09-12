import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, MicOff, Loader2, Lock, Globe2, Hand, LogOut, Copy, Check, UserPlus, UserCheck, PhoneOff, Radio, EyeOff, Trash2, UserMinus, Volume2, Circle } from "lucide-react";
import { AppShell, BackButton } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { useCompact, useTx } from "@/lib/auto-translate";
import { inviteLink, liveFor, roomCover, type VoiceHost, type VoiceRoom } from "@/lib/voice";
import { useVoiceRoom, type VoiceRole } from "@/lib/use-voice-room";
import { suspensionMessage, useMySuspension } from "@/lib/suspension";
import { uploadMedia } from "@/components/admin/upload";
import { VoiceRoomChat } from "@/components/voice-room-chat";
import { VoiceReactions } from "@/components/voice-reactions";

export const Route = createFileRoute("/voice/$id")({
  head: () => ({
    meta: [
      { title: "Voice room — MansourAlmailScores" },
      { name: "description", content: "Live football voice room: listen to the conversation, raise your hand to speak and follow the host." },
      { property: "og:title", content: "Voice room — MansourAlmailScores" },
      { property: "og:description", content: "Live football talk with fans and hosts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VoiceRoomPage,
});

function VoiceRoomPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { lang } = useI18n();
  const tx = useTx();
  const compact = useCompact();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [anon, setAnon] = useState(false);
  const [joining, setJoining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const room = useQuery({
    queryKey: ["voice-room", id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("voice_rooms")
        .select("id, host_id, title, description, photo_url, visibility, invite_code, status, started_at, ended_at, match_id")
        .eq("id", id)
        .maybeSingle();
      if (data) return data as unknown as VoiceRoom;
      // Private rooms are reachable through their invite code lookup.
      const { data: viaCode } = await supabase.rpc("voice_room_by_code", { _code: new URLSearchParams(window.location.search).get("code") ?? "" });
      return (((viaCode ?? []) as VoiceRoom[]).find((entry) => entry.id === id) ?? null) as VoiceRoom | null;
    },
  });

  const host = useQuery({
    enabled: !!room.data,
    queryKey: ["voice-host", room.data?.host_id],
    queryFn: async () => {
      const { data } = await supabase.rpc("voice_host_profiles", { _ids: [room.data!.host_id] });
      const found = ((data ?? []) as VoiceHost[])[0];
      return found ? { ...found, followers: Number(found.followers ?? 0) } : null;
    },
  });

  const membership = useQuery({
    enabled: !!user && !!room.data,
    queryKey: ["voice-membership", id, user?.id],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase.from("voice_room_participants").select("id, role, is_muted, hand_raised, anonymous").eq("room_id", id).eq("user_id", user!.id).maybeSingle();
      return data as { id: string; role: VoiceRole; is_muted: boolean; hand_raised: boolean; anonymous: boolean } | null;
    },
  });

  const participants = useQuery({
    enabled: !!room.data && joined,
    queryKey: ["voice-participants", id],
    refetchInterval: 3000,
    queryFn: async () => {
      const { data } = await supabase.from("voice_room_participants").select("user_id,role,is_muted,hand_raised,anonymous").eq("room_id", id).is("left_at", null);
      const ids = (data ?? []).filter((row) => !row.anonymous).map((row) => row.user_id);
      const { data: profiles } = ids.length ? await supabase.rpc("chat_author_profiles", { _ids: ids }) : { data: [] };
      const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      return (data ?? []).map((row) => ({
        userId: row.user_id,
        name: row.anonymous ? "Anonymous listener" : (byId.get(row.user_id)?.display_name ?? "Listener"),
        avatar: row.anonymous ? null : (byId.get(row.user_id)?.avatar_url ?? null),
        role: row.role as VoiceRole,
        muted: row.is_muted,
        hand: row.hand_raised,
        speaking: false,
      }));
    },
  });

  const following = useQuery({
    enabled: !!user && !!room.data,
    queryKey: ["voice-follow", room.data?.host_id, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profile_follows").select("id").eq("follower_id", user!.id).eq("following_id", room.data!.host_id).maybeSingle();
      return !!data;
    },
  });

  const isHost = !!user && room.data?.host_id === user.id;
  const suspension = useMySuspension(user?.id);
  const role: VoiceRole = isHost ? "host" : (membership.data?.role ?? "listener");

  const profile = useQuery({
    enabled: !!user,
    queryKey: ["voice-me", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", user!.id).maybeSingle();
      return data as { display_name: string | null; avatar_url: string | null } | null;
    },
  });

  const live = room.data?.status === "live";
  const me = user && joined
    ? {
        userId: user.id,
        name: anon ? "Anonymous listener" : (profile.data?.display_name ?? user.email?.split("@")[0] ?? "Guest"),
        avatar: anon ? null : (profile.data?.avatar_url ?? null),
        role: anon ? ("listener" as VoiceRole) : role,
      }
    : null;

  const { roster, remote, muted, toggleMute, forceMute, hand, setHand, micError, retryMic, connected, audioReady, speakerCount, listenerCount, recording, startRecording, stopRecording } = useVoiceRoom({ roomId: id, me, enabled: !!me && live, storedPeers: participants.data ?? [] });

  // Join the room roster (host joins automatically when the room is created).
  const join = async (anonymous = false) => {
    if (!user) { void navigate({ to: "/auth" }); return; }
    if (suspension.data) { setActionError(tx(suspensionMessage(suspension.data))); return; }
    setJoining(true);
    setActionError(null);
    setAnon(anonymous);
    const existingRole = membership.data?.role;
    const { error } = await supabase.from("voice_room_participants")
      .upsert({ room_id: id, user_id: user.id, role: isHost ? "host" : (anonymous ? "listener" : (existingRole ?? "listener")), is_muted: true, left_at: null, anonymous: anonymous }, { onConflict: "room_id,user_id" });
    if (error) {
      setActionError(tx("Could not join this room. Please try again."));
      setJoining(false);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["voice-membership", id] });
    setJoined(true);
    setJoining(false);
    window.dispatchEvent(new Event("voice-audio-unlock"));
  };

  const leave = async () => {
    setJoined(false);
    if (user) await supabase.from("voice_room_participants").delete().eq("room_id", id).eq("user_id", user.id);
    void navigate({ to: "/voice" });
  };

  const endRoom = async () => {
    const { error } = await supabase.rpc("voice_end_room", { _room_id: id });
    if (error) { setActionError(error.message); return; }
    setJoined(false);
    void navigate({ to: "/voice" });
  };

  const deleteRoom = async () => {
    if (!window.confirm(tx("Delete this voice room permanently?"))) return;
    const { error } = await supabase.rpc("voice_delete_room", { _room_id: id });
    if (error) { setActionError(error.message); return; }
    setJoined(false);
    void qc.invalidateQueries({ queryKey: ["voice-rooms"] });
    void navigate({ to: "/voice" });
  };

  const toggleRecording = async () => {
    if (!recording) {
      const ok = await startRecording();
      if (!ok) setActionError(tx("This browser cannot record voice rooms."));
      return;
    }
    setSaving(true);
    const result = await stopRecording();
    if (result && user && room.data) {
      const ext = result.blob.type.includes("mp4") ? "m4a" : "webm";
      const file = new File([result.blob], `${crypto.randomUUID()}.${ext}`, { type: result.blob.type });
      const url = await uploadMedia("voice-recordings", file, user.id);
      if (url) {
        await supabase.from("voice_recordings").insert({
          room_id: id,
          host_id: user.id,
          match_id: room.data.match_id ?? null,
          title: room.data.title,
          cover_url: room.data.photo_url,
          audio_url: url,
          duration_seconds: result.seconds,
          is_public: false,
        });
        await qc.invalidateQueries({ queryKey: ["voice-replays"] });
      } else {
        setActionError(tx("The replay could not be saved."));
      }
    }
    setSaving(false);
  };

  const manage = async (userId: string, action: "promote" | "demote" | "mute" | "remove") => {
    const { error } = await supabase.rpc("voice_manage_participant", { _room_id: id, _user_id: userId, _action: action });
    if (error) { setActionError(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["voice-membership", id] });
    await qc.invalidateQueries({ queryKey: ["voice-participants", id] });
  };

  const unlockAudio = async () => {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const context = new AudioCtx();
      await context.resume().catch(() => undefined);
      await context.close().catch(() => undefined);
    }
    window.dispatchEvent(new Event("voice-audio-unlock"));
    setAudioUnlocked(true);
  };

  const toggleFollow = async () => {
    if (!user || !room.data) { void navigate({ to: "/auth" }); return; }
    if (following.data) await supabase.from("profile_follows").delete().eq("follower_id", user.id).eq("following_id", room.data.host_id);
    else await supabase.from("profile_follows").insert({ follower_id: user.id, following_id: room.data.host_id });
    await qc.invalidateQueries({ queryKey: ["voice-follow"] });
    await qc.invalidateQueries({ queryKey: ["voice-host"] });
  };

  // Reflect mute / hand state on the stored participant row so hosts see it after refresh.
  useEffect(() => {
    if (!user || !joined) return;
    void supabase.from("voice_room_participants").update({ is_muted: muted, hand_raised: hand, last_seen_at: new Date().toISOString() }).eq("room_id", id).eq("user_id", user.id);
  }, [muted, hand, joined, user, id]);

  // React only to a stored mute-state change (for example a host moderation
  // action). Including local `muted` here caused the initial stored `true`
  // value to immediately undo a speaker's own Unmute gesture.
  useEffect(() => { if (membership.data?.is_muted) forceMute(); }, [membership.data?.is_muted, forceMute]);

  useEffect(() => { if (membership.data?.anonymous) setAnon(true); }, [membership.data?.anonymous]);

  useEffect(() => { if (isHost && live && !joined) setJoined(true); }, [isHost, live, joined]);

  if (room.isLoading) {
    return <AppShell><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppShell>;
  }
  if (!room.data) {
    return (
      <AppShell>
        <BackButton />
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <div className="text-sm font-bold">{tx("This room is not available")}</div>
          <p className="mt-1 text-xs text-muted-foreground">{tx("It may be private or already finished.")}</p>
          <Link to="/voice" className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground">{tx("Browse rooms")}</Link>
        </div>
      </AppShell>
    );
  }

  const speakers = roster.filter((peer) => peer.role !== "listener");
  const listeners = roster.filter((peer) => peer.role === "listener");
  const hands = roster.filter((peer) => peer.hand && peer.role === "listener");

  return (
    <AppShell>
      <BackButton />
      {remote.map((entry) => <RemoteAudio key={entry.userId} stream={entry.stream} />)}

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="relative h-40 w-full overflow-hidden sm:h-52">
          <img src={roomCover(room.data)} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-widest">
              {live
                ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> {tx("Live")}</span>
                : <span className="rounded-full bg-white/20 px-2 py-0.5">{tx("Ended")}</span>}
              {live && <span>{liveFor(room.data.started_at, lang)}</span>}
              {room.data.visibility === "private" ? <Lock className="h-3 w-3" /> : <Globe2 className="h-3 w-3" />}
            </div>
            <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">{room.data.title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          {host.data?.avatar_url
            ? <img src={host.data.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
            : <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">{(host.data?.display_name ?? "?").slice(0, 1).toUpperCase()}</span>}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{host.data?.display_name ?? tx("Host")}</div>
            <div className="text-[0.7rem] text-muted-foreground">{tx("Followers")}: {host.data?.followers ?? 0}</div>
          </div>
          {!isHost && (
            <button onClick={toggleFollow} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${following.data ? "border border-border bg-card text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
              {following.data ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
              {following.data ? tx("Following") : tx("Follow")}
            </button>
          )}
          {isHost && live && (
            <button onClick={endRoom} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-destructive px-3 text-xs font-bold text-destructive-foreground">
              <PhoneOff className="h-3.5 w-3.5" /> {tx("End room")}
            </button>
          )}
           {isHost && !live && (
            <button onClick={deleteRoom} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-destructive px-3 text-xs font-bold text-destructive-foreground">
              <Trash2 className="h-3.5 w-3.5" /> {tx("Delete room")}
            </button>
          )}
          {isHost && room.data.invite_code && (
            <button
              onClick={async () => { await navigator.clipboard.writeText(inviteLink(room.data!.invite_code!)); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold">
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />} {tx("Invite link")}
            </button>
          )}
        </div>

        {room.data.description && <p className="border-b border-border p-4 text-sm text-muted-foreground">{room.data.description}</p>}

        <div className="p-4">
          {!live && <p className="text-sm text-muted-foreground">{tx("This room has ended.")}</p>}
          {live && !joined && (
            <div className="flex flex-wrap gap-2">
              <button disabled={joining} onClick={() => join(false)} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow disabled:opacity-60">
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />} {tx("Join to listen")}
              </button>
              <button disabled={joining} onClick={() => join(true)} className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-bold disabled:opacity-60">
                <EyeOff className="h-4 w-4" /> {tx("Listen anonymously")}
              </button>
            </div>
          )}

          {live && joined && (
            <>
              <div className="mb-3 flex items-center gap-2 text-[0.7rem] font-semibold text-muted-foreground">
                {connected ? <span className="inline-flex items-center gap-1 text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> {tx("Connected")}</span> : <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {tx("Connecting…")}</span>}
                <span>· {roster.length} {tx("in the room")}</span>
                <span>· {speakerCount} {tx("speaking")}</span>
                <span>· {listenerCount} {tx("listening")}</span>
              </div>
              {!audioUnlocked && (
                <button onClick={unlockAudio} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
                  <Volume2 className="h-4 w-4" /> {tx("Tap to enable room audio")}
                </button>
              )}
              {micError && (
                <div className="mb-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                  {tx(micError)}
                  <button onClick={retryMic} className="mt-2 inline-flex h-8 items-center rounded-full bg-destructive px-3 text-[0.7rem] font-bold text-destructive-foreground">{tx("Retry microphone")}</button>
                </div>
              )}
              {actionError && <p className="mb-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">{actionError}</p>}

              <h2 className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Speakers")} ({speakerCount})</h2>
              <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {speakers.map((peer) => (
                  <PeerTile key={peer.userId} peer={peer} canManage={isHost && !peer.self} onDemote={() => manage(peer.userId, "demote")} onMute={() => manage(peer.userId, "mute")} onRemove={() => manage(peer.userId, "remove")} />
                ))}
                {speakers.length === 0 && <p className="col-span-full text-xs text-muted-foreground">{tx("No one is speaking yet.")}</p>}
              </div>

              {isHost && hands.length > 0 && (
                <div className="mt-5 rounded-2xl border border-primary/40 bg-primary/5 p-3">
                  <h3 className="text-[0.7rem] font-bold uppercase tracking-widest text-primary">{tx("Raised hands")}</h3>
                  <div className="mt-2 space-y-2">
                    {hands.map((peer) => (
                      <div key={peer.userId} className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{peer.name}</span>
                        <button onClick={() => manage(peer.userId, "promote")} className="ms-auto inline-flex h-8 items-center rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground">{tx("Let them speak")}</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h2 className="mt-5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Listeners")} ({listenerCount})</h2>
              <div className="mt-2 grid grid-cols-4 gap-3 sm:grid-cols-6">
                {listeners.map((peer) => (
                  <PeerTile key={peer.userId} peer={peer} small canManage={isHost && !peer.self} onPromote={() => manage(peer.userId, "promote")} onRemove={() => manage(peer.userId, "remove")} />
                ))}
                {listeners.length === 0 && <p className="col-span-full text-xs text-muted-foreground">{tx("No listeners yet.")}</p>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Written messages sit under the speakers so listeners can join in silently. */}
      <div className="mt-4 pb-40 md:pb-6">
        {live && joined && <VoiceReactions roomId={id} userId={user?.id} />}
        <VoiceRoomChat roomId={id} />
      </div>

      {live && joined && (
        <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center justify-center gap-2 px-4 md:bottom-6">
          <div className="flex w-full flex-wrap items-center justify-center gap-2 rounded-3xl border border-border bg-background/95 p-2 shadow-lg backdrop-blur">

            {role === "listener" ? (
              <button onClick={() => setHand(!hand)} className={`inline-flex h-11 min-w-[9rem] flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold ${hand ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                <Hand className="h-4 w-4" /> {hand ? tx("Hand raised") : tx("Raise hand")}
              </button>
            ) : (
              <button onClick={() => void toggleMute()} className={`inline-flex h-11 min-w-[9rem] flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold ${muted ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
                 {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {muted ? tx(audioReady ? "Unmute" : "Start microphone") : tx("Mute")}
              </button>
            )}

            {isHost ? (
              <>
                <button onClick={() => void toggleRecording()} disabled={saving}
                  className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold disabled:opacity-60 ${recording ? "bg-destructive/15 text-destructive" : "border border-border bg-card"}`}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Circle className={`h-4 w-4 ${recording ? "fill-destructive" : ""}`} />}
                  {recording ? tx("Save replay") : tx("Record")}
                </button>
                <button onClick={endRoom} className="inline-flex h-11 items-center gap-2 rounded-full bg-destructive px-4 text-sm font-bold text-destructive-foreground">
                  <PhoneOff className="h-4 w-4" /> {tx("End")}
                </button>
              </>
            ) : (
              <button onClick={leave} className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-bold">
                <LogOut className="h-4 w-4" /> {tx("Leave")}
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function PeerTile({ peer, small = false, canManage = false, onPromote, onDemote, onMute, onRemove }: {
  peer: { userId: string; name: string; avatar: string | null; role: VoiceRole; muted: boolean; speaking: boolean; hand: boolean; self?: boolean };
  small?: boolean; canManage?: boolean; onPromote?: () => void; onDemote?: () => void; onMute?: () => void; onRemove?: () => void;
}) {
  const tx = useTx();
  const size = small ? "h-11 w-11" : "h-16 w-16";
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className={`relative rounded-full ${peer.speaking ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}>
        {peer.avatar
          ? <img src={peer.avatar} alt="" className={`${size} rounded-full object-cover`} />
          : <span className={`${size} inline-flex items-center justify-center rounded-full bg-muted text-sm font-bold`}>{peer.name.slice(0, 1).toUpperCase()}</span>}
        {peer.role !== "listener" && peer.muted && (
          <span className="absolute -bottom-0.5 -end-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background text-muted-foreground shadow"><MicOff className="h-3 w-3" /></span>
        )}
        {peer.hand && <span className="absolute -top-1 -end-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"><Hand className="h-3 w-3" /></span>}
      </div>
      <div className="w-full truncate text-[0.65rem] font-semibold">{peer.self ? tx("You") : peer.name}</div>
      {peer.role === "host" && <div className="text-[0.6rem] font-bold uppercase tracking-wider text-primary">{tx("Host")}</div>}
      {canManage && <div className="flex flex-wrap justify-center gap-1">
        {onPromote && <button onClick={onPromote} className="text-[0.6rem] font-bold text-primary">{tx("Add as speaker")}</button>}
        {onMute && peer.role === "speaker" && !peer.muted && <button onClick={onMute} aria-label={tx("Mute speaker")} className="text-muted-foreground"><MicOff className="h-3 w-3" /></button>}
        {onDemote && peer.role === "speaker" && <button onClick={onDemote} className="text-[0.6rem] font-bold text-destructive">{tx("Listener")}</button>}
        {onRemove && <button onClick={onRemove} aria-label={tx("Remove from room")} className="text-destructive"><UserMinus className="h-3 w-3" /></button>}
      </div>}
    </div>
  );
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (node.srcObject !== stream) node.srcObject = stream;
    node.muted = false;
    node.volume = 1;
    const play = () => { void node.play().catch(() => undefined); };
    play();
    // Mobile browsers block autoplay until the listener interacts with the page.
    window.addEventListener("voice-audio-unlock", play);
    document.addEventListener("click", play, { passive: true });
    document.addEventListener("touchstart", play, { passive: true });
    const timer = window.setInterval(() => { if (node.paused) play(); }, 1500);
    return () => {
      window.removeEventListener("voice-audio-unlock", play);
      document.removeEventListener("click", play);
      document.removeEventListener("touchstart", play);
      window.clearInterval(timer);
    };
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

