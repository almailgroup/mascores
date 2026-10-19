import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Room, RoomEvent, Track, type LocalTrackPublication, type RemoteTrack, type RemoteParticipant } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { getVoiceToken } from "./voice-livekit.functions";

export type VoiceRole = "host" | "speaker" | "listener";

export type VoicePeer = {
  userId: string;
  name: string;
  avatar: string | null;
  role: VoiceRole;
  muted: boolean;
  hand: boolean;
  speaking: boolean;
  self?: boolean;
};

type Me = { userId: string; name: string; avatar: string | null; role: VoiceRole };

export type SpeakerMoment = { t: number; ids: string[] };
export type SpeakerPerson = { id: string; name: string; avatar: string | null };

function publishes(role: VoiceRole) {
  return role === "host" || role === "speaker";
}

/**
 * Voice room: audio flows through the LiveKit cloud (each phone sends one
 * stream, so rooms scale to 100+ people and work behind carrier firewalls).
 * A realtime presence channel still carries the roster, hands and host moderation.
 */
export function useVoiceRoom({ roomId, me, enabled, storedPeers = [], onModeration }: { roomId: string; me: Me | null; enabled: boolean; storedPeers?: VoicePeer[]; onModeration?: (action: string) => void }) {
  const onModerationRef = useRef(onModeration);
  onModerationRef.current = onModeration;
  const timelineRef = useRef<SpeakerMoment[]>([]);
  const lastSpeakKeyRef = useRef("");
  const rosterRef = useRef<VoicePeer[]>([]);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [remote, setRemote] = useState<{ userId: string; stream: MediaStream }[]>([]);
  const [muted, setMuted] = useState(true);
  const [hand, setHand] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micNonce, setMicNonce] = useState(0);
  const retryMic = useCallback(() => { setMicError(null); setMicNonce((n) => n + 1); }, []);
  const [channelUp, setChannelUp] = useState(false);
  const [audioUp, setAudioUp] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [recording, setRecording] = useState(false);
  const [channelNonce, setChannelNonce] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const roomRef = useRef<Room | null>(null);
  const micPubRef = useRef<LocalTrackPublication | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const meRef = useRef<Me | null>(me);
  const mutedRef = useRef(true);
  const handRef = useRef(false);
  const mixRef = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode; added: Set<string> } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef(0);

  meRef.current = me;
  mutedRef.current = muted;
  handRef.current = hand;

  const sendPresence = useCallback(async () => {
    const channel = channelRef.current;
    const current = meRef.current;
    if (!channel || !current) return;
    await channel.track({ userId: current.userId, name: current.name, avatar: current.avatar, role: current.role, muted: mutedRef.current, hand: handRef.current }).catch(() => undefined);
  }, []);

  /** Publish our mic into the cloud room (once per room connection). */
  const publishMic = useCallback(async () => {
    const room = roomRef.current;
    const mic = localRef.current?.getAudioTracks()[0];
    if (!room || !mic || micPubRef.current || room.state !== "connected") return;
    try {
      micPubRef.current = await room.localParticipant.publishTrack(mic, { source: Track.Source.Microphone, dtx: true, red: true });
      if (mutedRef.current) await micPubRef.current.mute();
    } catch (error) { console.warn("Voice publish failed", error); }
  }, []);

  const startMicrophone = useCallback(async () => {
    if (localRef.current?.getAudioTracks().length) { await publishMic(); return true; }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicError(/Safari\/604/.test(navigator.userAgent) && (window as unknown as { Capacitor?: unknown }).Capacitor
        ? "This installed app version can't use the microphone yet. Install the newest TestFlight build, then allow the microphone."
        : "This browser cannot capture the microphone here. Open the site over https and try again.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      stream.getAudioTracks().forEach((t) => { t.enabled = false; });
      localRef.current = stream;
      setAudioReady(true);
      setMicError(null);
      await publishMic();
      return !!stream.getAudioTracks()[0];
    } catch (error) {
      const name = (error as { name?: string } | null)?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") setMicError("Microphone access is blocked. Allow the microphone for this site, then tap Retry microphone.");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setMicError("No microphone was found on this device.");
      else if (name === "NotReadableError") setMicError("Your microphone is already in use by another app. Close it and tap Retry microphone.");
      else setMicError("The microphone could not be started. Tap Retry microphone to try again.");
      return false;
    }
  }, [publishMic]);

  // Stop the microphone when leaving or becoming a listener.
  useEffect(() => {
    if (enabled && me && publishes(me.role)) return;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setAudioReady(false);
    setMuted(true);
  }, [enabled, me?.role, me?.userId]);

  useEffect(() => () => { localRef.current?.getTracks().forEach((t) => t.stop()); localRef.current = null; }, []);

  useEffect(() => {
    if (micNonce > 0 && enabled && me && publishes(me.role)) void startMicrophone();
  }, [micNonce, enabled, me?.role, me?.userId, startMicrophone]);

  // Cloud audio room. Reconnects with a fresh pass when the role changes (speaker ⇄ listener).
  useEffect(() => {
    if (!enabled || !me) return;
    let cancelled = false;
    let retry = 0;
    const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
    roomRef.current = room;
    micPubRef.current = null;

    const addTrack = (t: RemoteTrack, p: RemoteParticipant) => {
      if (t.kind !== Track.Kind.Audio) return;
      const stream = new MediaStream([t.mediaStreamTrack]);
      setRemote((prev) => [...prev.filter((e) => e.userId !== p.identity), { userId: p.identity, stream }]);
    };
    const dropUser = (id: string) => setRemote((prev) => prev.filter((e) => e.userId !== id));

    room
      .on(RoomEvent.TrackSubscribed, (t, _pub, p) => addTrack(t, p))
      .on(RoomEvent.TrackUnsubscribed, (_t, _pub, p) => dropUser(p.identity))
      .on(RoomEvent.ParticipantDisconnected, (p) => dropUser(p.identity))
      .on(RoomEvent.Reconnecting, () => setAudioUp(false))
      .on(RoomEvent.Reconnected, () => setAudioUp(true))
      .on(RoomEvent.Disconnected, () => {
        setAudioUp(false);
        setRemote([]);
        micPubRef.current = null;
        if (!cancelled) retry = window.setTimeout(() => void connect(), 2000);
      });

    const connect = async () => {
      if (cancelled) return;
      try {
        const res = await getVoiceToken({ data: { roomId } });
        if (cancelled) return;
        if (!res.ok) { retry = window.setTimeout(() => void connect(), 3000); return; }
        await room.connect(res.url, res.token, { autoSubscribe: true });
        if (cancelled) { void room.disconnect(); return; }
        setAudioUp(true);
        room.remoteParticipants.forEach((p) => p.audioTrackPublications.forEach((pub) => { if (pub.track) addTrack(pub.track, p); }));
        if (res.canPublish) await publishMic();
      } catch (error) {
        console.warn("Voice connect failed", error);
        if (!cancelled) retry = window.setTimeout(() => void connect(), 3000);
      }
    };
    void connect();

    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      setAudioUp(false);
      setRemote([]);
      micPubRef.current = null;
      if (roomRef.current === room) roomRef.current = null;
      room.removeAllListeners();
      void room.disconnect();
    };
  }, [enabled, roomId, me?.userId, me?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Presence + moderation channel, rebuilt automatically whenever it drops.
  useEffect(() => {
    if (!enabled || !me) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let rebuildTimer = 0;
    const rebuild = (delay: number) => {
      if (cancelled || rebuildTimer) return;
      rebuildTimer = window.setTimeout(() => { if (!cancelled) setChannelNonce((n) => n + 1); }, delay);
    };
    const topic = `voice:${roomId}`;

    const setup = async () => {
      // The realtime client reuses closing channels with the same topic; clear them first.
      const realtime = supabase.realtime as unknown as { channels: RealtimeChannel[] };
      const stale = supabase.getChannels().filter((c) => c.topic === `realtime:${topic}`);
      await Promise.all(stale.map(async (c) => {
        await Promise.race([supabase.removeChannel(c), new Promise((r) => window.setTimeout(r, 1500))]).catch(() => undefined);
        try { c.teardown(); } catch { /* already gone */ }
      }));
      realtime.channels = realtime.channels.filter((c) => c.topic !== `realtime:${topic}`);
      if (cancelled) return;

      channel = supabase.channel(topic, { config: { presence: { key: me.userId }, broadcast: { self: false, ack: false } } });
      channelRef.current = channel;
      const ch = channel;
      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<VoicePeer>();
        const list: VoicePeer[] = [];
        Object.values(state).forEach((entries) => {
          const entry = entries[entries.length - 1] as unknown as VoicePeer | undefined;
          if (entry?.userId) list.push(entry);
        });
        setPeers(list);
      });
      ch.on("broadcast", { event: "moderate" }, ({ payload }) => {
        const p = payload as { to: string; action: string };
        if (p.to !== me.userId) return;
        if (p.action === "mute") {
          localRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
          void micPubRef.current?.mute();
          setMuted(true);
        }
        onModerationRef.current?.(p.action);
      });
      const joinTimer = window.setTimeout(() => { if (ch.state !== "joined") rebuild(0); }, 10000);
      ch.subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") { window.clearTimeout(joinTimer); setChannelUp(true); void sendPresence(); }
        if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") { setChannelUp(false); rebuild(1500); }
      });
    };
    void setup();

    const wake = () => { if (document.visibilityState === "visible" && channelRef.current?.state !== "joined") rebuild(0); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      cancelled = true;
      window.clearTimeout(rebuildTimer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      setChannelUp(false);
      if (channelRef.current === channel) channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled, roomId, me?.userId, channelNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void sendPresence(); }, [muted, hand, me?.role, sendPresence]);

  /** Host moderation reaches the person instantly instead of waiting for a refresh. */
  const sendModeration = useCallback((to: string, action: string) => {
    void channelRef.current?.send({ type: "broadcast", event: "moderate", payload: { to, action } });
  }, []);

  const toggleMute = useCallback(async () => {
    if (!mutedRef.current) {
      localRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
      void micPubRef.current?.mute();
      setMuted(true);
      return;
    }
    const ready = await startMicrophone();
    if (!ready) return;
    localRef.current?.getAudioTracks().forEach((t) => { t.enabled = true; });
    mutedRef.current = false;
    await micPubRef.current?.unmute().catch(() => undefined);
    setMuted(false);
  }, [startMicrophone]);

  const forceMute = useCallback(() => {
    localRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
    void micPubRef.current?.mute();
    setMuted(true);
  }, []);

  /** Mix every voice in the room into one track so hosts can save a replay. */
  const addToMix = useCallback((id: string, stream: MediaStream) => {
    const mix = mixRef.current;
    if (!mix || mix.added.has(id) || stream.getAudioTracks().length === 0) return;
    try { mix.ctx.createMediaStreamSource(stream).connect(mix.dest); mix.added.add(id); } catch { /* not ready */ }
  }, []);

  const startRecording = useCallback(async () => {
    if (recorderRef.current) return true;
    if (typeof MediaRecorder === "undefined") return false;
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;
    const ctx = new AudioCtx();
    await ctx.resume().catch(() => undefined);
    mixRef.current = { ctx, dest: ctx.createMediaStreamDestination(), added: new Set() };
    if (localRef.current) addToMix("self", localRef.current);
    remote.forEach((entry) => addToMix(entry.userId, entry.stream));
    const mime = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(mixRef.current.dest.stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
    recorder.start(2000);
    recorderRef.current = recorder;
    recordStartRef.current = Date.now();
    timelineRef.current = [];
    lastSpeakKeyRef.current = "";
    setRecording(true);
    return true;
  }, [addToMix, remote]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });
    recorderRef.current = null;
    setRecording(false);
    const seconds = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
    await mixRef.current?.ctx.close().catch(() => undefined);
    mixRef.current = null;
    chunksRef.current = [];
    const timeline = timelineRef.current.slice(0, 4000);
    const ids = new Set(timeline.flatMap((m) => m.ids));
    const people: SpeakerPerson[] = rosterRef.current.filter((p) => ids.has(p.userId)).map((p) => ({ id: p.userId, name: p.name, avatar: p.avatar }));
    timelineRef.current = [];
    return { blob, seconds, timeline, people };
  }, []);

  useEffect(() => {
    if (!recording) return;
    if (localRef.current) addToMix("self", localRef.current);
    remote.forEach((entry) => addToMix(entry.userId, entry.stream));
  }, [recording, remote, addToMix, audioReady]);

  // Speaking meter for the local mic and every remote stream.
  useEffect(() => {
    if (!enabled) return;
    const AudioCtx = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    void ctx.resume().catch(() => {});
    const nodes: { id: string; analyser: AnalyserNode }[] = [];
    const add = (id: string, stream: MediaStream) => {
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        nodes.push({ id, analyser });
      } catch { /* stream not ready */ }
    };
    if (localRef.current && me) add(me.userId, localRef.current);
    remote.forEach((entry) => add(entry.userId, entry.stream));
    const buffer = new Uint8Array(256);
    let raf = 0;
    let lastMeterKey = "";
    const tick = () => {
      const next: Record<string, boolean> = {};
      nodes.forEach(({ id, analyser }) => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] ?? 0;
        next[id] = sum / buffer.length > 12;
      });
      const key = Object.keys(next).filter((k) => next[k]).sort().join(",");
      if (key !== lastMeterKey) { lastMeterKey = key; setSpeaking(next); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); void ctx.close(); };
  }, [enabled, remote, me?.userId, muted, audioReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const roster = useMemo(() => {
    const liveById = new Map(peers.map((peer) => [peer.userId, peer]));
    const merged = storedPeers.map((stored) => ({ ...stored, ...(liveById.get(stored.userId) ?? {}), name: stored.name, avatar: stored.avatar, role: stored.role }));
    peers.forEach((peer) => { if (!merged.some((item) => item.userId === peer.userId)) merged.push(peer); });
    return merged.map((peer) => ({ ...peer, self: peer.userId === me?.userId, speaking: !peer.muted && !!speaking[peer.userId] })).sort((a, b) => {
      const rank = (r: VoiceRole) => (r === "host" ? 0 : r === "speaker" ? 1 : 2);
      return rank(a.role) - rank(b.role) || a.name.localeCompare(b.name);
    });
  }, [peers, storedPeers, speaking, me?.userId]);

  rosterRef.current = roster;

  useEffect(() => {
    if (!recording) return;
    const ids = roster.filter((p) => p.speaking && p.role !== "listener").map((p) => p.userId).sort();
    const key = ids.join(",");
    if (key === lastSpeakKeyRef.current) return;
    lastSpeakKeyRef.current = key;
    timelineRef.current.push({ t: Math.round((Date.now() - recordStartRef.current) / 100) / 10, ids });
  }, [roster, recording]);

  const connected = channelUp && audioUp;
  const speakerCount = roster.filter((p) => p.role !== "listener").length;
  const listenerCount = roster.length - speakerCount;
  return { roster, remote, muted, toggleMute, forceMute, hand, setHand, micError, retryMic, connected, audioReady, speakerCount, listenerCount, recording, startRecording, stopRecording, sendModeration };
}
