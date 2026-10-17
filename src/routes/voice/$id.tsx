import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, MicOff, Loader2, Lock, Globe2, Hand, LogOut, Copy, Check, UserPlus, UserCheck, PhoneOff, Radio, EyeOff, Trash2, UserMinus, Volume2, Circle } from "lucide-react";
import { AppShell, BackButton } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { useCompact, useTx } from "@/lib/auto-translate";
import { voiceProfiles, liveFor, roomCover, type VoiceHost, type VoiceRoom } from "@/lib/voice";
import { useVoiceRoom, type VoiceRole } from "@/lib/use-voice-room";
import { suspensionMessage, useMySuspension } from "@/lib/suspension";
import { uploadMedia } from "@/components/admin/upload";
import { VoiceRoomChat } from "@/components/voice-room-chat";
import { VoiceUserBadge } from "@/components/voice-people";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VoiceReactions, useVoiceReactions } from "@/components/voice-reactions";

export const Route = createFileRoute("/voice/$id")({
  head: () => ({
    meta: [
      { title: "Voice room — MA Scores" },
      { name: "description", content: "Live football voice room: listen to the conversation, raise your hand to speak and follow the host." },
      { property: "og:title", content: "Voice room — MA Scores" },
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
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [anon, setAnon] = useState(false);
  const [joining, setJoining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [confirmChoice, setConfirmChoice] = useState<null | "save" | "delete">(null);

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
      const names = await voiceProfiles([room.data!.host_id]);
      return found ? { ...found, ...names[0], followers: Number(found.followers ?? 0) } : null;
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
      const profiles = await voiceProfiles(ids);
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
      const data = (await voiceProfiles([user!.id]))[0];
      return data as { display_name: string | null; avatar_url: string | null } | null;
    },
  });

  const live = room.data?.status === "live";
  const me = user && joined
    ? {
        userId: user.id,
        name: anon ? "Anonymous listener" : (profile.data?.display_name ?? "Guest"),
        avatar: anon ? null : (profile.data?.avatar_url ?? null),
        role: anon ? ("listener" as VoiceRole) : role,
      }
    : null;

  const { roster, remote, muted, toggleMute, forceMute, hand, setHand, micError, retryMic, connected, audioReady, speakerCount, listenerCount, recording, startRecording, stopRecording } = useVoiceRoom({ roomId: id, me, enabled: !!me && live, storedPeers: participants.data ?? [] });

  const { latest: reactions, react } = useVoiceReactions(id, user?.id);
  const hostSpeaking = roster.some((peer) => peer.self && peer.speaking);
  const lastActivitySent = useRef(0);
  useEffect(() => {
    if (!isHost || !joined || !live || !hostSpeaking) return;
    const activity = () => { if (Date.now() - lastActivitySent.current < 15000) return; lastActivitySent.current = Date.now(); void supabase.rpc("voice_host_activity", { _room_id: id }); };
    activity();
    const timer = window.setInterval(activity, 15000);
    return () => window.clearInterval(timer);
  }, [isHost, joined, live, hostSpeaking, id]);

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

  const endRoom = () => setEnding(true);

  const finishRoom = async (keep: boolean) => {
    if (saving || !user) return;
    setSaving(true);
    setActionError(null);
    try {
      if (keep && !recording) {
        const { count, error } = await supabase.from("voice_recordings").select("id", { count: "exact", head: true }).eq("room_id", id).eq("host_id", user.id);
        if (error) throw error;
        if (!count) throw new Error(lang === "ar" ? "سجل الغرفة أولاً لحفظها في ملفك الشخصي." : "Record the room first to save it to your profile.");
      }
      if (keep) {
        if (recording) await saveRecording(true);
        const result = await supabase.from("voice_recordings").update({ is_public: true }).eq("room_id", id).eq("host_id", user.id);
        if (result.error) throw result.error;
        const { error } = await supabase.rpc("voice_end_room", { _room_id: id });
        if (error) throw error;
      } else {
        if (recording) await stopRecording().catch(() => null);
        await supabase.from("voice_recordings").delete().eq("room_id", id).eq("host_id", user.id);
        const { error } = await supabase.rpc("voice_delete_room", { _room_id: id });
        if (error) throw error;
        void qc.invalidateQueries({ queryKey: ["voice-rooms"] });
      }
      await qc.invalidateQueries({ queryKey: ["voice-replays"] });
      setJoined(false);
      void navigate({ to: "/voice" });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : tx("Could not end the room. Please try again."));
    } finally { setSaving(false); }
  };

  const deleteRoom = async () => {
    const { error } = await supabase.rpc("voice_delete_room", { _room_id: id });
    if (error) { setActionError(error.message); return; }
    setJoined(false);
    void qc.invalidateQueries({ queryKey: ["voice-rooms"] });
    void navigate({ to: "/voice" });
  };

  const saveRecording = async (isPublic: boolean) => {
    const result = await stopRecording();
    if (!result || !user || !room.data) throw new Error(tx("No recording is available."));
    const ext = result.blob.type.includes("mp4") ? "m4a" : "webm";
    const file = new File([result.blob], `${crypto.randomUUID()}.${ext}`, { type: result.blob.type });
    if (!isPublic && ending) return;
    const url = await uploadMedia("voice-recordings", file, user.id);
    if (!url) throw new Error(tx("The replay could not be saved."));
    const { error } = await supabase.from("voice_recordings").insert({ room_id: id, host_id: user.id, match_id: room.data.match_id ?? null, title: room.data.title, cover_url: room.data.photo_url, audio_url: url, duration_seconds: result.seconds, is_public: isPublic });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["voice-replays"] });
  };

  const manage = async (userId: string, action: "promote" | "demote" | "mute" | "remove") => {
    const { error } = await supabase.rpc("voice_manage_participant", { _room_id: id, _user_id: userId, _action: action });
    if (error) { setActionError(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["voice-membership", id] });
    await qc.invalidateQueries({ queryKey: ["voice-participants", id] });
  };

  // Room audio is always on: unlock playback on the first touch anywhere in the room.
  useEffect(() => {
    if (!joined) return;
    const unlock = () => {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) { const context = new AudioCtx(); void context.resume().catch(() => undefined).finally(() => void context.close().catch(() => undefined)); }
      window.dispatchEvent(new Event("voice-audio-unlock"));
    };
    unlock();
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, [joined]);

  // Hosts record automatically; the end dialog decides whether the replay is kept.
  const autoRecordStarted = useRef(false);
  useEffect(() => {
    if (!isHost || !joined || !live || recording || autoRecordStarted.current) return;
    autoRecordStarted.current = true;
    void startRecording();
  }, [isHost, joined, live, recording, startRecording]);

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
      <Dialog open={ending} onOpenChange={(open) => { if (!saving) { setEnding(open); setConfirmChoice(null); } }}>
        <DialogContent><DialogHeader><DialogTitle>{confirmChoice ? (lang === "ar" ? "هل أنت متأكد؟" : "Are you sure?") : (lang === "ar" ? "إنهاء الغرفة" : "End room")}</DialogTitle><DialogDescription>{confirmChoice === "save" ? (lang === "ar" ? "سيتم إنهاء الغرفة وحفظ التسجيل في ملفك الشخصي." : "The room will end and the replay will be saved to your profile.") : confirmChoice === "delete" ? (lang === "ar" ? "سيتم إنهاء الغرفة وحذفها مع التسجيل نهائياً." : "The room and its recording will be ended and deleted permanently.") : (lang === "ar" ? "الغرفة تُسجَّل تلقائياً. احفظها في ملفك الشخصي أو احذفها." : "The room is recorded automatically. Save it to your profile or delete it.")}</DialogDescription></DialogHeader>
          {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
          {confirmChoice ? (<>
            <button disabled={saving} onClick={() => void finishRoom(confirmChoice === "save")} className={`inline-flex items-center justify-center gap-2 rounded-xl p-3 font-bold disabled:opacity-50 ${confirmChoice === "save" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{lang === "ar" ? "نعم، تأكيد" : "Yes, confirm"}</button>
            <button disabled={saving} onClick={() => setConfirmChoice(null)} className="rounded-xl border border-border p-3 font-bold disabled:opacity-50">{lang === "ar" ? "رجوع" : "Back"}</button>
          </>) : (<>
            <button onClick={() => setConfirmChoice("save")} className="rounded-xl bg-primary p-3 font-bold text-primary-foreground">{lang === "ar" ? "حفظ في الملف الشخصي" : "Save to profile"}</button>
            <button onClick={() => setConfirmChoice("delete")} className="rounded-xl bg-destructive p-3 font-bold text-destructive-foreground">{lang === "ar" ? "حذف" : "Delete"}</button>
          </>)}
        </DialogContent>
      </Dialog>
      {isHost && live ? (
        <div className="mb-3 flex justify-start">
          <button onClick={endRoom} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-destructive px-4 text-xs font-bold text-destructive-foreground">
            <PhoneOff className="h-3.5 w-3.5" /> {tx("End room")}
          </button>
        </div>
      ) : <BackButton />}
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

        <div className="border-b border-border p-4">
          <div className="flex items-center gap-3">
            {host.data?.avatar_url
              ? <img src={host.data.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              : <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">{(host.data?.display_name ?? "?").slice(0, 1).toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm font-bold leading-snug"><span className="break-words">{host.data?.display_name ?? tx("Host")}</span><VoiceUserBadge userId={room.data.host_id} /></div>
            </div>
            {!isHost && (
              <button onClick={toggleFollow} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${following.data ? "border border-border bg-card text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                {following.data ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                {following.data ? tx("Following") : tx("Follow")}
              </button>
            )}
          </div>
          {isHost && (live || room.data.invite_code) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!live && (
                <button onClick={deleteRoom} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-destructive px-3 text-xs font-bold text-destructive-foreground">
                  <Trash2 className="h-3.5 w-3.5" /> {tx("Delete room")}
                </button>
              )}
              {room.data.invite_code && !showCode && (
                <button onClick={() => setShowCode(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold">
                  {lang === "ar" ? "إظهار رمز الدعوة" : "Show invite code"}
                </button>
              )}
              {room.data.invite_code && showCode && (<>
                <button
                  onClick={async () => { await navigator.clipboard.writeText(room.data!.invite_code!); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold">
                  {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />} {lang === "ar" ? "رمز الدعوة" : "Invite code"}: {room.data.invite_code}
                </button>
                <button onClick={() => setShowCode(false)} className="inline-flex h-9 items-center rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted-foreground">
                  {lang === "ar" ? "إخفاء الرمز" : "Hide code"}
                </button>
              </>)}
            </div>
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
              {micError && (
                <div className="mb-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                  {tx(micError)}
                  <button onClick={retryMic} className="mt-2 inline-flex h-8 items-center rounded-full bg-destructive px-3 text-[0.7rem] font-bold text-destructive-foreground">{tx("Retry microphone")}</button>
                </div>
              )}
              {actionError && <p className="mb-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">{actionError}</p>}

              <h2 className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Speakers")} ({speakerCount})</h2>
              <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-5 sm:gap-5">
                {speakers.map((peer) => (
                  <PeerTile key={peer.userId} peer={peer} reaction={reactions[peer.userId]} canManage={isHost && !peer.self} onDemote={() => manage(peer.userId, "demote")} onMute={() => manage(peer.userId, "mute")} onRemove={() => manage(peer.userId, "remove")} />
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
              <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6 sm:gap-5">
                {listeners.map((peer) => (
                  <PeerTile key={peer.userId} peer={peer} reaction={reactions[peer.userId]} small canManage={isHost && !peer.self} onPromote={() => manage(peer.userId, "promote")} onRemove={() => manage(peer.userId, "remove")} />
                ))}
                {listeners.length === 0 && <p className="col-span-full text-xs text-muted-foreground">{tx("No listeners yet.")}</p>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Written messages sit under the speakers so listeners can join in silently. */}
      <div className="mt-4 pb-40 md:pb-6">
        {live && joined && <VoiceReactions onReact={(emoji) => void react(emoji)} />}
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

            {!isHost && (
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

function PeerTile({ peer, reaction, small = false, canManage = false, onPromote, onDemote, onMute, onRemove }: {
  peer: { userId: string; name: string; avatar: string | null; role: VoiceRole; muted: boolean; speaking: boolean; hand: boolean; self?: boolean };
  reaction?: string; small?: boolean; canManage?: boolean; onPromote?: () => void; onDemote?: () => void; onMute?: () => void; onRemove?: () => void;
}) {
  const tx = useTx();
  const size = small ? "h-11 w-11" : "h-16 w-16";
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className={`relative rounded-full ${peer.speaking ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}>
        {peer.avatar
          ? <img src={peer.avatar} alt="" className={`${size} rounded-full object-cover`} />
          : <span className={`${size} inline-flex items-center justify-center rounded-full bg-muted text-sm font-bold`}>{peer.name.slice(0, 1).toUpperCase()}</span>}
        {peer.role !== "listener" && peer.muted && (
          <span className="absolute -bottom-0.5 -end-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background text-muted-foreground shadow"><MicOff className="h-3 w-3" /></span>
        )}
        {reaction && (
          <span key={reaction} className="absolute -top-2 -start-2 inline-flex h-7 w-7 animate-in zoom-in-50 items-center justify-center rounded-full bg-background text-base shadow-md" aria-label={reaction}>{reaction}</span>
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

