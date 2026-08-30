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
  const [connected, setConnected] = useState(false);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localRef = useRef<MediaStream | null>(null);
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
    if (localRef.current) localRef.current.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));
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
      if (pc.connectionState === "failed" || pc.connectionState === "closed") closePeer(otherId);
    };
    return pc;
  }, [closePeer, track]);

  const negotiate = useCallback(async (otherId: string, otherRole: VoiceRole) => {
    const current = meRef.current;
    const channel = channelRef.current;
    if (!current || !channel) return;
    if (current.userId >= otherId) return; // lower id initiates, avoids glare
    const pc = ensurePeer(otherId, otherRole);
    if (!pc || pc.signalingState !== "stable" || pc.currentRemoteDescription) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await channel.send({ type: "broadcast", event: "signal", payload: { from: current.userId, to: otherId, kind: "offer", data: offer } satisfies SignalPayload });
  }, [ensurePeer]);

  // Mic capture for hosts and speakers.
  useEffect(() => {
    if (!enabled || !me || !publishes(me.role)) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicError("This browser cannot capture the microphone here. Open the site over https and try again.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        stream.getAudioTracks().forEach((t) => { t.enabled = false; });
        localRef.current = stream;
        setMicError(null);
        // Rebuild peer connections so the fresh mic track is actually published.
        pcsRef.current.forEach((pc) => pc.close());
        pcsRef.current.clear();
        setRemote([]);
        await sendPresence();
        peersRef.current.forEach((peer) => {
          if (peer.userId !== me.userId) void negotiate(peer.userId, peer.role);
        });
      } catch {
        if (!cancelled) setMicError("Microphone access is blocked. Allow it in your browser to speak.");
      }
    })();
    return () => {
      cancelled = true;
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
    };
  }, [enabled, me?.role, me?.userId, negotiate, sendPresence]);

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
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await channel.send({ type: "broadcast", event: "signal", payload: { from: me.userId, to: signal.from, kind: "answer", data: answer } satisfies SignalPayload });
        } else if (signal.kind === "answer") {
          if (!pc.currentRemoteDescription) await pc.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));
        } else {
          await pc.addIceCandidate(new RTCIceCandidate(signal.data as RTCIceCandidateInit));
        }
      } catch { /* transient negotiation races are recovered by the next presence sync */ }
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

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      const tracks = localRef.current?.getAudioTracks() ?? [];
      if (!next && tracks.length === 0) setMicError("Microphone is not ready yet. Allow access and try again.");
      tracks.forEach((t) => { t.enabled = !next; });
      return next;
    });
  }, []);

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
  return { roster, remote, muted, toggleMute, forceMute, hand, setHand, micError, connected, speakerCount, listenerCount };
}
