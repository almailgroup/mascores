import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ignoreCollidingOffer } from "./voice-negotiation";
import { getVoiceIceServers } from "./voice-ice.functions";

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

/** `sid`/`toSid` identify each side's current session, so a reload or role change never talks to a stale connection. */
/** `pid`/`toPid` identify each audio link, so messages for a replaced link are ignored. */
type SignalPayload = { from: string; to: string; sid: string; toSid?: string; pid?: string; toPid?: string; kind: "offer" | "answer" | "ice"; data: unknown };

const newSid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

type Me = { userId: string; name: string; avatar: string | null; role: VoiceRole };

let ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }];
let iceLoaded: Promise<void> | null = null;
function loadIce() {
  iceLoaded ??= getVoiceIceServers().then((r) => { if (r?.servers?.length) ICE = r.servers; }).catch(() => undefined);
  return iceLoaded;
}

export type SpeakerMoment = { t: number; ids: string[] };
export type SpeakerPerson = { id: string; name: string; avatar: string | null };

function publishes(role: VoiceRole) {
  return role === "host" || role === "speaker";
}

/**
 * Peer-to-peer audio room over Supabase Realtime: presence lists everyone in the
 * room, broadcast carries WebRTC offers/answers/ICE, and speakers publish a mic
 * track that every other member receives.
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
  /** Retry microphone capture after the listener fixes browser permissions. */
  const retryMic = useCallback(() => { setMicError(null); setMicNonce((n) => n + 1); }, []);
  const [connected, setConnected] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [recording, setRecording] = useState(false);


  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  /** Our own id for each audio link, and the other side's, so stale messages from a replaced link are dropped. */
  const pcIdRef = useRef<Map<string, string>>(new Map());
  const remotePidRef = useRef<Map<string, string>>(new Map());
  const pcBornRef = useRef<Map<string, number>>(new Map());
  const remoteTracksRef = useRef<Map<string, MediaStreamTrack[]>>(new Map());
  const iceOutRef = useRef<Map<string, { list: RTCIceCandidateInit[]; timer: number; pid: string }>>(new Map());
  const localRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Set<string>>(new Set());
  const ignoredOffersRef = useRef<Set<string>>(new Set());
  const settingAnswerRef = useRef<Set<string>>(new Set());
  const signalQueuesRef = useRef<Map<string, Promise<void>>>(new Map());
  const meRef = useRef<Me | null>(me);
  const mutedRef = useRef(true);
  const handRef = useRef(false);
  const peersRef = useRef<VoicePeer[]>([]);
  const mixRef = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode; added: Set<string> } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef(0);
  const sidRef = useRef(newSid());
  const remoteSidRef = useRef<Map<string, string>>(new Map());
  const [channelNonce, setChannelNonce] = useState(0);

  meRef.current = me;
  mutedRef.current = muted;
  handRef.current = hand;
  peersRef.current = peers;

  const roleOf = (userId: string) => (peersRef.current.find((p) => p.userId === userId)?.role ?? "speaker") as VoiceRole;

  const sendSignal = useCallback((payload: SignalPayload) => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event: "signal", payload }).catch(() => undefined);
  }, []);

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
      sid: sidRef.current,
      muted: mutedRef.current,
      hand: handRef.current,
    }).catch(() => undefined);
  }, []);

  const closePeer = useCallback((userId: string, keepSid = false) => {
    pcsRef.current.get(userId)?.close();
    pcsRef.current.delete(userId);
    pcIdRef.current.delete(userId);
    remotePidRef.current.delete(userId);
    pcBornRef.current.delete(userId);
    remoteTracksRef.current.delete(userId);
    const out = iceOutRef.current.get(userId);
    if (out) window.clearTimeout(out.timer);
    iceOutRef.current.delete(userId);
    makingOfferRef.current.delete(userId);
    ignoredOffersRef.current.delete(userId);
    settingAnswerRef.current.delete(userId);
    pendingIceRef.current.delete(userId);
    if (!keepSid) remoteSidRef.current.delete(userId);
    setRemote((prev) => prev.filter((entry) => entry.userId !== userId));
  }, []);

  /** The audio slot actually agreed with the other side (falls back to any audio slot). */
  const audioTransceiver = (pc: RTCPeerConnection) => {
    const list = pc.getTransceivers().filter((t) => t.currentDirection !== "stopped" && t.receiver.track?.kind === "audio");
    return list.find((t) => t.mid !== null) ?? list[0];
  };

  /** Put our mic (or nothing, for listeners) on the link. Returns true when renegotiation is needed. */
  const syncSender = useCallback(async (pc: RTCPeerConnection) => {
    const current = meRef.current;
    if (!current) return false;
    const tr = audioTransceiver(pc);
    if (!tr) return false;
    const pub = publishes(current.role);
    const mic = pub ? localRef.current?.getAudioTracks()[0] ?? null : null;
    if (tr.sender.track !== mic) await tr.sender.replaceTrack(mic).catch(() => undefined);
    if (mic && localRef.current) { try { tr.sender.setStreams?.(localRef.current); } catch { /* optional */ } }
    const direction: RTCRtpTransceiverDirection = pub ? "sendrecv" : "recvonly";
    if (tr.direction !== direction) { tr.direction = direction; return true; }
    return false;
  }, []);

  const queueIce = useCallback((otherId: string, pid: string, candidate: RTCIceCandidateInit) => {
    const current = meRef.current;
    if (!current) return;
    let out = iceOutRef.current.get(otherId);
    if (!out || out.pid !== pid) {
      if (out) window.clearTimeout(out.timer);
      out = { list: [], timer: 0, pid };
      iceOutRef.current.set(otherId, out);
    }
    out.list.push(candidate);
    if (out.timer) return;
    // Send candidates in small batches instead of one message each, so busy rooms are not throttled.
    out.timer = window.setTimeout(() => {
      const batch = iceOutRef.current.get(otherId);
      if (!batch || batch.pid !== pid) return;
      iceOutRef.current.delete(otherId);
      if (pcIdRef.current.get(otherId) !== pid) return;
      sendSignal({ from: current.userId, to: otherId, sid: sidRef.current, toSid: remoteSidRef.current.get(otherId), pid, toPid: remotePidRef.current.get(otherId), kind: "ice", data: batch.list });
    }, 150);
  }, [sendSignal]);

  const ensurePeer = useCallback((otherId: string, otherRole: VoiceRole, answering = false) => {
    const current = meRef.current;
    if (!current || !channelRef.current) return null;
    // Only connect when at least one side can publish audio.
    if (!publishes(current.role) && !publishes(otherRole)) return null;
    const existing = pcsRef.current.get(otherId);
    if (existing && existing.connectionState !== "closed") return existing;
    if (existing) closePeer(otherId, true);

    const pc = new RTCPeerConnection({ iceServers: ICE });
    const pid = newSid();
    pcsRef.current.set(otherId, pc);
    pcIdRef.current.set(otherId, pid);
    pcBornRef.current.set(otherId, Date.now());
    if (!answering) {
      // The answering side lets the offer create the audio slot, so each link has exactly one.
      const pub = publishes(current.role);
      const mic = pub ? localRef.current?.getAudioTracks()[0] : undefined;
      pc.addTransceiver(mic ?? "audio", { direction: pub ? "sendrecv" : "recvonly", streams: mic && localRef.current ? [localRef.current] : [] });
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate || pcsRef.current.get(otherId) !== pc) return;
      queueIce(otherId, pid, event.candidate.toJSON());
    };
    pc.ontrack = (event) => {
      if (pcsRef.current.get(otherId) !== pc) return;
      const prev = remoteTracksRef.current.get(otherId) ?? [];
      const next = [...prev.filter((t) => t.readyState === "live" && t.id !== event.track.id), event.track];
      remoteTracksRef.current.set(otherId, next);
      track(otherId, new MediaStream(next));
    };
    pc.onnegotiationneeded = () => { if (pcsRef.current.get(otherId) === pc) void negotiateRef.current(otherId, roleOf(otherId), true); };
    pc.onconnectionstatechange = () => {
      if (pcsRef.current.get(otherId) !== pc) return;
      if (pc.connectionState === "connected") pcBornRef.current.set(otherId, Date.now());
      if (pc.connectionState === "failed") void negotiateRef.current(otherId, roleOf(otherId), true, true);
      if (pc.connectionState === "disconnected") window.setTimeout(() => {
        if (pcsRef.current.get(otherId) === pc && pc.connectionState === "disconnected") void negotiateRef.current(otherId, roleOf(otherId), true, true);
      }, 4000);
    };
    return pc;
  }, [closePeer, queueIce, track]); // eslint-disable-line react-hooks/exhaustive-deps

  const negotiate = useCallback(async (otherId: string, otherRole: VoiceRole, force = false, restart = false) => {
    const current = meRef.current;
    if (!current || !channelRef.current) return;
    if (!force && current.userId >= otherId) return; // lower id initiates initially, avoiding glare
    if (!force && pcsRef.current.has(otherId)) return; // already linked; presence updates never restart audio
    const pc = ensurePeer(otherId, otherRole);
    if (!pc || pc.signalingState !== "stable" || makingOfferRef.current.has(otherId)) return;
    makingOfferRef.current.add(otherId);
    try {
      const offer = await pc.createOffer(restart ? { iceRestart: true } : undefined);
      if (pc.signalingState !== "stable") return;
      await pc.setLocalDescription(offer);
      sendSignal({ from: current.userId, to: otherId, sid: sidRef.current, toSid: remoteSidRef.current.get(otherId), pid: pcIdRef.current.get(otherId), toPid: remotePidRef.current.get(otherId), kind: "offer", data: pc.localDescription ?? offer });
    } catch (error) {
      console.warn("Voice offer failed", error);
    } finally {
      makingOfferRef.current.delete(otherId);
    }
  }, [ensurePeer, sendSignal]);
  const negotiateRef = useRef(negotiate);
  negotiateRef.current = negotiate;

  const startMicrophone = useCallback(async () => {
    if (localRef.current?.getAudioTracks().length) return true;
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
      if (!stream.getAudioTracks()[0]) return false;
      // Plug the mic into every open link without dropping anyone's audio.
      for (const [otherId, pc] of pcsRef.current) {
        if (!audioTransceiver(pc)) {
          const mic = stream.getAudioTracks()[0];
          if (mic) pc.addTrack(mic, stream);
          continue; // negotiationneeded fires
        }
        if (await syncSender(pc)) void negotiateRef.current(otherId, roleOf(otherId), true);
      }
      await sendPresence();
      peersRef.current.forEach((peer) => {
        if (peer.userId !== meRef.current?.userId && !pcsRef.current.has(peer.userId)) void negotiateRef.current(peer.userId, peer.role, true);
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
  }, [sendPresence, syncSender]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop the microphone when leaving or becoming a listener. Capture starts from
  // the user's Unmute gesture, which is required by Safari and embedded browsers.
  useEffect(() => {
    if (enabled && me && publishes(me.role)) return;
    localRef.current?.getTracks().forEach((t) => t.stop());
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

  // Audio links live for the whole visit; a reconnecting room channel never drops them.
  useEffect(() => {
    if (!enabled || !me) return;
    sidRef.current = newSid();
    const pcs = pcsRef.current;
    return () => {
      pcs.forEach((pc) => pc.close());
      pcs.clear();
      pcIdRef.current.clear();
      remotePidRef.current.clear();
      pcBornRef.current.clear();
      remoteTracksRef.current.clear();
      iceOutRef.current.forEach((o) => window.clearTimeout(o.timer));
      iceOutRef.current.clear();
      pendingIceRef.current.clear();
      makingOfferRef.current.clear();
      ignoredOffersRef.current.clear();
      settingAnswerRef.current.clear();
      signalQueuesRef.current.clear();
      remoteSidRef.current.clear();
      setRemote([]);
    };
  }, [enabled, roomId, me?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Presence + signalling channel, rebuilt automatically whenever it drops or never joins.
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
      // The client reuses a channel with the same name, even one that is still closing.
      // Fully remove any leftover first, or this device stays on "Connecting…".
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
        peersRef.current = list;
        // Someone reloaded or rejoined: drop the old link so a fresh one is made.
        list.forEach((peer) => {
          const sid = (peer as VoicePeer & { sid?: string }).sid;
          const known = remoteSidRef.current.get(peer.userId);
          if (sid && known && known !== sid) closePeer(peer.userId);
          if (sid) remoteSidRef.current.set(peer.userId, sid);
        });
        const ids = new Set(list.map((p) => p.userId));
        pcsRef.current.forEach((_, id) => { if (!ids.has(id)) closePeer(id); });
        list.forEach((peer) => { if (peer.userId !== me.userId) void negotiateRef.current(peer.userId, peer.role); });
      });

      ch.on("broadcast", { event: "moderate" }, ({ payload }) => {
        const p = payload as { to: string; action: string };
        if (p.to !== me.userId) return;
        if (p.action === "mute") { localRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; }); setMuted(true); }
        onModerationRef.current?.(p.action);
      });

      ch.on("broadcast", { event: "signal" }, async ({ payload }) => {
        const signal = payload as SignalPayload;
        if (signal.to !== me.userId) return;
        if (signal.toSid && signal.toSid !== sidRef.current) return; // meant for an old session of mine
        const processSignal = async () => {
          const knownSid = remoteSidRef.current.get(signal.from);
          if (signal.sid && knownSid && knownSid !== signal.sid) {
            if (signal.kind !== "offer") return; // stale answer/ice from their old session
            closePeer(signal.from);
          }
          if (signal.sid) remoteSidRef.current.set(signal.from, signal.sid);
          const otherRole = roleOf(signal.from);
          if (signal.kind === "offer") {
            // The other side replaced its link: start over with a fresh one instead of mixing the two.
            const knownPid = remotePidRef.current.get(signal.from);
            if (signal.pid && knownPid && knownPid !== signal.pid) closePeer(signal.from, true);
          } else if (signal.toPid && pcIdRef.current.get(signal.from) && signal.toPid !== pcIdRef.current.get(signal.from)) {
            return; // answer/ice for a link we already replaced
          }
          if (signal.kind === "ice" && signal.pid && remotePidRef.current.get(signal.from) && signal.pid !== remotePidRef.current.get(signal.from)) return;
          const pc = signal.kind === "offer" ? ensurePeer(signal.from, otherRole, true) : pcsRef.current.get(signal.from);
          if (!pc) return;
          try {
            if (signal.kind === "offer") {
              const ignore = ignoreCollidingOffer(me.userId, signal.from, makingOfferRef.current.has(signal.from), pc.signalingState, settingAnswerRef.current.has(signal.from));
              if (ignore) { ignoredOffersRef.current.add(signal.from); return; }
              ignoredOffersRef.current.delete(signal.from);
              if (signal.pid) remotePidRef.current.set(signal.from, signal.pid);
              if (pc.signalingState === "have-local-offer") await pc.setLocalDescription({ type: "rollback" });
              await pc.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));
              // Keep one audio slot per link: drop any unpaired extra, then attach our mic to the agreed one.
              const agreed = pc.getTransceivers().find((t) => t.mid !== null && t.receiver.track?.kind === "audio");
              if (agreed) pc.getTransceivers().forEach((t) => { if (t.mid === null) { try { t.stop(); } catch { /* ignore */ } } });
              await syncSender(pc);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendSignal({ from: me.userId, to: signal.from, sid: sidRef.current, toSid: signal.sid, pid: pcIdRef.current.get(signal.from), toPid: signal.pid, kind: "answer", data: pc.localDescription ?? answer });
              const waiting = pendingIceRef.current.get(signal.from) ?? [];
              pendingIceRef.current.delete(signal.from);
              for (const candidate of waiting) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
            } else if (signal.kind === "answer") {
              if (pc.signalingState === "have-local-offer") {
                if (signal.pid) remotePidRef.current.set(signal.from, signal.pid);
                settingAnswerRef.current.add(signal.from);
                await pc.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));
                settingAnswerRef.current.delete(signal.from);
                ignoredOffersRef.current.delete(signal.from);
                const waiting = pendingIceRef.current.get(signal.from) ?? [];
                pendingIceRef.current.delete(signal.from);
                for (const candidate of waiting) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
              }
            } else {
              if (ignoredOffersRef.current.has(signal.from)) return;
              const list = (Array.isArray(signal.data) ? signal.data : [signal.data]) as RTCIceCandidateInit[];
              for (const candidate of list) {
                if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
                else pendingIceRef.current.set(signal.from, [...(pendingIceRef.current.get(signal.from) ?? []), candidate]);
              }
            }
          } catch (error) {
            settingAnswerRef.current.delete(signal.from);
            console.warn("Voice negotiation retry", error);
            window.setTimeout(() => void negotiateRef.current(signal.from, otherRole, true), 700);
          }
        };
        const queued = (signalQueuesRef.current.get(signal.from) ?? Promise.resolve()).catch(() => {}).then(processSignal);
        signalQueuesRef.current.set(signal.from, queued);
        await queued;
      });

      await loadIce();
      if (cancelled) return;
      // Never sit on "Connecting…": if joining takes too long, start a fresh channel.
      const joinTimer = window.setTimeout(() => { if (ch.state !== "joined") rebuild(0); }, 10000);
      ch.subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          window.clearTimeout(joinTimer);
          setConnected(true);
          void sendPresence();
        }
        if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnected(false);
          rebuild(1500);
        }
      });
    };
    void setup();

    const wake = () => {
      if (document.visibilityState === "visible" && channelRef.current?.state !== "joined") rebuild(0);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);

    return () => {
      cancelled = true;
      window.clearTimeout(rebuildTimer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      setConnected(false);
      if (channelRef.current === channel) channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled, roomId, me?.userId, channelNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Heal audio links that never connect (a lost message, a network switch).
  useEffect(() => {
    if (!enabled || !me) return;
    const timer = window.setInterval(() => {
      const current = meRef.current;
      if (!current || !channelRef.current || channelRef.current.state !== "joined") return;
      const now = Date.now();
      for (const [otherId, pc] of [...pcsRef.current]) {
        if (pc.connectionState === "connected") continue;
        const age = now - (pcBornRef.current.get(otherId) ?? now);
        // The side that starts links retries first; the other side steps in if that never happens.
        const limit = current.userId < otherId ? 12000 : 25000;
        if (age < limit) continue;
        closePeer(otherId, true);
        void negotiateRef.current(otherId, roleOf(otherId), true);
      }
      // Anyone we should hear (or who should hear us) but have no link with yet.
      peersRef.current.forEach((peer) => {
        if (peer.userId === current.userId || pcsRef.current.has(peer.userId)) return;
        if (!publishes(current.role) && !publishes(peer.role)) return;
        void negotiateRef.current(peer.userId, peer.role, true);
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [enabled, me?.userId, closePeer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void sendPresence(); }, [muted, hand, me?.role, sendPresence]);
  useEffect(() => {
    const current = meRef.current;
    if (!enabled || !current) return;
    void (async () => {
      for (const [otherId, pc] of [...pcsRef.current]) {
        // A listener-to-listener link is no longer needed.
        if (!publishes(current.role) && !publishes(roleOf(otherId))) { closePeer(otherId, true); continue; }
        if (await syncSender(pc)) void negotiateRef.current(otherId, roleOf(otherId), true);
      }
      // A new speaker must also reach listeners it had no link with yet.
      if (publishes(current.role)) peersRef.current.forEach((peer) => {
        if (peer.userId !== current.userId && !pcsRef.current.has(peer.userId)) void negotiateRef.current(peer.userId, peer.role, true);
      });
      void sendPresence();
    })();
  }, [enabled, me?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Host moderation reaches the person instantly instead of waiting for a refresh. */
  const sendModeration = useCallback((to: string, action: string) => {
    void channelRef.current?.send({ type: "broadcast", event: "moderate", payload: { to, action } });
  }, []);

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

  /** Mix every voice in the room into one track so hosts can save a replay. */
  const addToMix = useCallback((id: string, stream: MediaStream) => {
    const mix = mixRef.current;
    if (!mix || mix.added.has(id) || stream.getAudioTracks().length === 0) return;
    try {
      mix.ctx.createMediaStreamSource(stream).connect(mix.dest);
      mix.added.add(id);
    } catch { /* stream not ready yet */ }
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

  // Keep late joiners in the recording.
  useEffect(() => {
    if (!recording) return;
    if (localRef.current) addToMix("self", localRef.current);
    remote.forEach((entry) => addToMix(entry.userId, entry.stream));
  }, [recording, remote, addToMix, audioReady]);


  // Simple speaking meter for the local mic and every remote stream.
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
  }, [enabled, remote, me?.userId, muted]); // eslint-disable-line react-hooks/exhaustive-deps

  const roster = useMemo(() => {
    const liveById = new Map(peers.map((peer) => [peer.userId, peer]));
    const merged = storedPeers.map((stored) => ({ ...stored, ...(liveById.get(stored.userId) ?? {}), name: stored.name, avatar: stored.avatar, role: stored.role }));
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

  rosterRef.current = roster;

  // Remember who talked when, so replays can show the speaker's picture.
  useEffect(() => {
    if (!recording) return;
    const ids = roster.filter((p) => p.speaking && p.role !== "listener").map((p) => p.userId).sort();
    const key = ids.join(",");
    if (key === lastSpeakKeyRef.current) return;
    lastSpeakKeyRef.current = key;
    timelineRef.current.push({ t: Math.round((Date.now() - recordStartRef.current) / 100) / 10, ids });
  }, [roster, recording]);

  const speakerCount = roster.filter((p) => p.role !== "listener").length;
  const listenerCount = roster.length - speakerCount;
  return { roster, remote, muted, toggleMute, forceMute, hand, setHand, micError, retryMic, connected, audioReady, speakerCount, listenerCount, recording, startRecording, stopRecording, sendModeration };
}
