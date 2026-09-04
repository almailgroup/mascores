import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

type SignalPayload = { from: string; to: string; kind: "offer" | "answer" | "ice"; data: unknown };

type Me = { userId: string; name: string; avatar: string | null; role: VoiceRole };

const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }];

function publishes(role: VoiceRole) {
  return role === "host" || role === "speaker";
}

/**
 * Peer-to-peer audio room over Supabase Realtime: presence lists everyone in the
 * room, broadcast carries WebRTC offers/answers/ICE, and speakers publish a mic
 * track that every other member receives.
 */
export function useVoiceRoom({ roomId, me, enabled, storedPeers = [] }: { roomId: string; me: Me | null; enabled: boolean; storedPeers?: VoicePeer[] }) {
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [remote, setRemote] = useState<{ userId: string; stream: MediaStream }[]>([]);
  const [muted, setMuted] = useState(true);
  const [hand, setHand] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micNonce, setMicNonce] = useState(0);
  /** Retry microphone capture after the listener fixes browser permissions. */
  const retryMic = useCallback(() => { setMicError(null); setMicNonce((n) => n + 1); }, []);
  const [connected, setConnected] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Set<string>>(new Set());
  const meRef = useRef<Me | null>(me);
  const mutedRef = useRef(true);
  const handRef = useRef(false);
  const peersRef = useRef<VoicePeer[]>([]);
  meRef.current = me;
  mutedRef.current = muted;
  handRef.current = hand;
  peersRef.current = peers;

  const track = useCallback((userId: string, stream: MediaStream) => {
    setRemote((prev) => (prev.some((entry) => entry.userId === userId) ? prev.map((e) => (e.userId === userId ? { userId, stream } : e)) : [...prev, { userId, stream }]));
  }, []);

  const sendPresence = useCallback(async () => {
    const channel = channelRef.current;
    const current = meRef.current;
    if (!channel || !current) return;
    await channel.track({
      userId: current.userId,
      name: current.name,
      avatar: current.avatar,
      role: current.role,
      muted: mutedRef.current,
      hand: handRef.current,
    });
  }, []);

  const closePeer = useCallback((userId: string) => {
    pcsRef.current.get(userId)?.close();
    pcsRef.current.delete(userId);
    pendingIceRef.current.delete(userId);
    setRemote((prev) => prev.filter((entry) => entry.userId !== userId));
  }, []);

  const ensurePeer = useCallback((otherId: string, otherRole: VoiceRole) => {
    const current = meRef.current;
    const channel = channelRef.current;
    if (!current || !channel) return null;
    // Only connect when at least one side can publish audio.
    if (!publishes(current.role) && !publishes(otherRole)) return null;
    const existing = pcsRef.current.get(otherId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcsRef.current.set(otherId, pc);
    const localStream = localRef.current;
    if (localStream) localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    else if (publishes(current.role)) pc.addTransceiver("audio", { direction: "sendrecv" });
    else pc.addTransceiver("audio", { direction: "recvonly" });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void channel.send({ type: "broadcast", event: "signal", payload: { from: current.userId, to: otherId, kind: "ice", data: event.candidate.toJSON() } satisfies SignalPayload });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      track(otherId, stream);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        pc.restartIce();
        void negotiateRef.current(otherId, otherRole, true);
      }
      if (pc.connectionState === "closed") closePeer(otherId);
    };
    return pc;
  }, [closePeer, track]);

  const negotiate = useCallback(async (otherId: string, otherRole: VoiceRole, force = false) => {
    const current = meRef.current;
    const channel = channelRef.current;
    if (!current || !channel) return;
    if (!force && current.userId >= otherId) return; // lower id initiates initially, avoiding glare
    const pc = ensurePeer(otherId, otherRole);
    if (!pc || pc.signalingState !== "stable" || makingOfferRef.current.has(otherId)) return;
    makingOfferRef.current.add(otherId);
    try {
      const offer = await pc.createOffer({ iceRestart: force });
      await pc.setLocalDescription(offer);
      await channel.send({ type: "broadcast", event: "signal", payload: { from: current.userId, to: otherId, kind: "offer", data: pc.localDescription ?? offer } satisfies SignalPayload });
    } finally {
      makingOfferRef.current.delete(otherId);
    }
  }, [ensurePeer]);
  const negotiateRef = useRef(negotiate);
  negotiateRef.current = negotiate;

  const startMicrophone = useCallback(async () => {
    if (localRef.current?.getAudioTracks().length) return true;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicError("This browser cannot capture the microphone here. Open the site over https and try again.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      stream.getAudioTracks().forEach((track) => { track.enabled = false; });
      localRef.current = stream;
      setAudioReady(true);
      setMicError(null);
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      setRemote([]);
      await sendPresence();
      peersRef.current.forEach((peer) => {
        if (peer.userId !== meRef.current?.userId) void negotiateRef.current(peer.userId, peer.role, true);
      });
      return true;
    } catch (error) {
      const name = (error as { name?: string } | null)?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") setMicError("Microphone access is blocked. Allow the microphone for this site, then tap Retry microphone.");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setMicError("No microphone was found on this device.");
      else if (name === "NotReadableError") setMicError("Your microphone is already in use by another app. Close it and tap Retry microphone.");
      else setMicError("The microphone could not be started. Tap Retry microphone to try again.");
      return false;
    }
  }, [sendPresence]);

  // Stop the microphone when leaving or becoming a listener. Capture starts from
  // the user's Unmute gesture, which is required by Safari and embedded browsers.
  useEffect(() => {
    if (enabled && me && publishes(me.role)) return;
    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;
    setAudioReady(false);
    setMuted(true);
  }, [enabled, me?.role, me?.userId]);

  useEffect(() => {
    return () => {
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (micNonce > 0 && enabled && me && publishes(me.role)) void startMicrophone();
  }, [micNonce, enabled, me?.role, me?.userId, startMicrophone]);

  // Presence + signalling channel.
  useEffect(() => {
    if (!enabled || !me) return;
    const channel = supabase.channel(`voice:${roomId}`, { config: { presence: { key: me.userId } } });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<VoicePeer>();
      const list: VoicePeer[] = [];
      Object.values(state).forEach((entries) => {
        const entry = entries[entries.length - 1] as unknown as VoicePeer | undefined;
        if (entry?.userId) list.push(entry);
      });
      setPeers(list);
      const ids = new Set(list.map((p) => p.userId));
      pcsRef.current.forEach((_, id) => { if (!ids.has(id)) closePeer(id); });
      list.forEach((peer) => { if (peer.userId !== me.userId) void negotiate(peer.userId, peer.role); });
    });

    channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const signal = payload as SignalPayload;
      if (signal.to !== me.userId) return;
      const otherRole = (peersRef.current.find((p) => p.userId === signal.from)?.role ?? "speaker") as VoiceRole;
      const pc = ensurePeer(signal.from, otherRole);
      if (!pc) return;
      try {
        if (signal.kind === "offer") {
          if (pc.signalingState !== "stable") await pc.setLocalDescription({ type: "rollback" });
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await channel.send({ type: "broadcast", event: "signal", payload: { from: me.userId, to: signal.from, kind: "answer", data: pc.localDescription ?? answer } satisfies SignalPayload });
          const waiting = pendingIceRef.current.get(signal.from) ?? [];
          for (const candidate of waiting) await pc.addIceCandidate(new RTCIceCandidate(candidate));
          pendingIceRef.current.delete(signal.from);
        } else if (signal.kind === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));
            const waiting = pendingIceRef.current.get(signal.from) ?? [];
            for (const candidate of waiting) await pc.addIceCandidate(new RTCIceCandidate(candidate));
            pendingIceRef.current.delete(signal.from);
          }
        } else {
          const candidate = signal.data as RTCIceCandidateInit;
          if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(candidate));
          else pendingIceRef.current.set(signal.from, [...(pendingIceRef.current.get(signal.from) ?? []), candidate]);
        }
      } catch (error) {
        console.warn("Voice negotiation retry", error);
        window.setTimeout(() => void negotiateRef.current(signal.from, otherRole, true), 700);
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") { setConnected(true); void sendPresence(); }
      if (status === "CLOSED" || status === "CHANNEL_ERROR") setConnected(false);
    });

    return () => {
      setConnected(false);
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      setRemote([]);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [enabled, roomId, me?.userId, me?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void sendPresence(); }, [muted, hand, me?.role, sendPresence]);

  const toggleMute = useCallback(async () => {
    if (!mutedRef.current) {
      localRef.current?.getAudioTracks().forEach((track) => { track.enabled = false; });
      setMuted(true);
      return;
    }
    const ready = await startMicrophone();
    if (!ready) return;
    localRef.current?.getAudioTracks().forEach((track) => { track.enabled = true; });
    setMuted(false);
  }, [startMicrophone]);

  const forceMute = useCallback(() => {
    localRef.current?.getAudioTracks().forEach((track) => { track.enabled = false; });
    setMuted(true);
  }, []);

  // Simple speaking meter for the local mic and every remote stream.
  useEffect(() => {
    if (!enabled) return;
    const AudioCtx = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
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
    const tick = () => {
      const next: Record<string, boolean> = {};
      nodes.forEach(({ id, analyser }) => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 1) sum += buffer[i]!;
        next[id] = sum / buffer.length > 12;
      });
      setSpeaking(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); void ctx.close(); };
  }, [enabled, remote, me?.userId, muted]); // eslint-disable-line react-hooks/exhaustive-deps

  const roster = useMemo(() => {
    const liveById = new Map(peers.map((peer) => [peer.userId, peer]));
    const merged = storedPeers.map((stored) => ({ ...stored, ...(liveById.get(stored.userId) ?? {}) }));
    peers.forEach((peer) => { if (!merged.some((item) => item.userId === peer.userId)) merged.push(peer); });
    return merged.map((peer) => ({
    ...peer,
    self: peer.userId === me?.userId,
    speaking: !peer.muted && !!speaking[peer.userId],
  })).sort((a, b) => {
    const rank = (r: VoiceRole) => (r === "host" ? 0 : r === "speaker" ? 1 : 2);
    return rank(a.role) - rank(b.role) || a.name.localeCompare(b.name);
  });
  }, [peers, storedPeers, speaking, me?.userId]);

  const speakerCount = roster.filter((p) => p.role !== "listener").length;
  const listenerCount = roster.length - speakerCount;
  return { roster, remote, muted, toggleMute, forceMute, hand, setHand, micError, retryMic, connected, audioReady, speakerCount, listenerCount };
}
