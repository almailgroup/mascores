import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, MicOff, Loader2, Lock, Globe2, Hand, LogOut, Copy, Check, UserPlus, UserCheck, PhoneOff, Radio, EyeOff } from "lucide-react";
import { AppShell, BackButton } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { useTx } from "@/lib/auto-translate";
import { inviteLink, liveFor, roomCover, type VoiceHost, type VoiceRoom } from "@/lib/voice";
import { useVoiceRoom, type VoiceRole } from "@/lib/use-voice-room";

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
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [joined, setJoined] = useState(false);
  const [anon, setAnon] = useState(false);

  const room = useQuery({
    queryKey: ["voice-room", id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("voice_rooms")
        .select("id, host_id, title, description, photo_url, visibility, invite_code, status, started_at, ended_at")
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
      const { data } = await supabase.from("voice_room_participants").select("id, role, is_muted, hand_raised").eq("room_id", id).eq("user_id", user!.id).maybeSingle();
      return data as { id: string; role: VoiceRole; is_muted: boolean; hand_raised: boolean } | null;
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

  const { roster, remote, muted, toggleMute, hand, setHand, micError, connected, speakerCount, listenerCount } = useVoiceRoom({ roomId: id, me, enabled: !!me && live });

  // Join the room roster (host joins automatically when the room is created).
  const join = async (anonymous = false) => {
    if (!user) { void navigate({ to: "/auth" }); return; }
    setAnon(anonymous);
    await supabase.from("voice_room_participants")
      .upsert({ room_id: id, user_id: user.id, role: isHost ? "host" : "listener", is_muted: !isHost, left_at: null }, { onConflict: "room_id,user_id" });
    await qc.invalidateQueries({ queryKey: ["voice-membership", id] });
    setJoined(true);
  };

  const leave = async () => {
    setJoined(false);
    if (user) await supabase.from("voice_room_participants").delete().eq("room_id", id).eq("user_id", user.id);
    void navigate({ to: "/voice" });
  };

  const endRoom = async () => {
    await supabase.from("voice_rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", id);
    setJoined(false);
    void navigate({ to: "/voice" });
  };

  const setRole = async (userId: string, next: VoiceRole) => {
    await supabase.from("voice_room_participants").update({ role: next, is_muted: next === "listener", hand_raised: false }).eq("room_id", id).eq("user_id", userId);
    await qc.invalidateQueries({ queryKey: ["voice-membership", id] });
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
              <button onClick={() => join(false)} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow">
                <Radio className="h-4 w-4" /> {tx("Join to listen")}
              </button>
              <button onClick={() => join(true)} className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-bold">
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
              {micError && <p className="mb-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">{tx(micError)}</p>}

              <h2 className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Speakers")} ({speakerCount})</h2>
              <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {speakers.map((peer) => (
                  <PeerTile key={peer.userId} peer={peer} canManage={isHost && !peer.self} onDemote={() => setRole(peer.userId, "listener")} />
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
                        <button onClick={() => setRole(peer.userId, "speaker")} className="ms-auto inline-flex h-8 items-center rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground">{tx("Let them speak")}</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h2 className="mt-5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Listeners")} ({listenerCount})</h2>
              <div className="mt-2 grid grid-cols-4 gap-3 sm:grid-cols-6">
                {listeners.map((peer) => (
                  <PeerTile key={peer.userId} peer={peer} small canManage={isHost && !peer.self} onPromote={() => setRole(peer.userId, "speaker")} />
                ))}
                {listeners.length === 0 && <p className="col-span-full text-xs text-muted-foreground">{tx("No listeners yet.")}</p>}
              </div>
            </>
          )}
        </div>
      </div>

      {live && joined && (
        <div className="fixed inset-x-0 bottom-16 z-40 mx-auto flex max-w-md items-center justify-center gap-2 px-4 md:bottom-6">
          <div className="flex w-full items-center gap-2 rounded-full border border-border bg-background/95 p-2 shadow-lg backdrop-blur">
            {role === "listener" ? (
              <button onClick={() => setHand(!hand)} className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold ${hand ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                <Hand className="h-4 w-4" /> {hand ? tx("Hand raised") : tx("Raise hand")}
              </button>
            ) : (
              <button onClick={toggleMute} className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold ${muted ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {muted ? tx("Unmute") : tx("Mute")}
              </button>
            )}
            {isHost ? (
              <button onClick={endRoom} className="inline-flex h-11 items-center gap-2 rounded-full bg-destructive px-4 text-sm font-bold text-destructive-foreground">
                <PhoneOff className="h-4 w-4" /> {tx("End")}
              </button>
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

function PeerTile({ peer, small = false, canManage = false, onPromote, onDemote }: {
  peer: { userId: string; name: string; avatar: string | null; role: VoiceRole; muted: boolean; speaking: boolean; hand: boolean; self?: boolean };
  small?: boolean; canManage?: boolean; onPromote?: () => void; onDemote?: () => void;
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
      {canManage && onPromote && <button onClick={onPromote} className="text-[0.6rem] font-bold text-primary">{tx("Add as speaker")}</button>}
      {canManage && onDemote && peer.role === "speaker" && <button onClick={onDemote} className="text-[0.6rem] font-bold text-destructive">{tx("Remove")}</button>}
    </div>
  );
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  return (
    <audio
      autoPlay
      playsInline
      className="hidden"
      ref={(node) => { if (node && node.srcObject !== stream) node.srcObject = stream; }}
    />
  );
}
