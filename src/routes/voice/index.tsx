import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, Loader2, Lock, Globe2, Users, Plus, Radio, UserPlus, UserCheck, ImagePlus, Link2 } from "lucide-react";
import { VoiceReplays } from "@/components/voice-replays";
import { AppShell, BackButton, EmptyState, SectionHeader } from "@/components/app-shell";
import { ImageCropper } from "@/components/image-cropper";
import { uploadMedia } from "@/components/admin/upload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { useCompact, useTx } from "@/lib/auto-translate";
import { generatedCover, liveFor, roomCover, type VoiceHost, type VoiceRoom } from "@/lib/voice";
import { suspensionMessage, useMySuspension } from "@/lib/suspension";

export const Route = createFileRoute("/voice/")({
  head: () => ({
    meta: [
      { title: "Voice rooms — MansourAlmailScores" },
      { name: "description", content: "Join live football voice rooms, listen to fans and pundits, host your own room and follow the voices you like." },
      { property: "og:title", content: "Voice rooms — MansourAlmailScores" },
      { property: "og:description", content: "Live football talk rooms: listen, speak and follow your favourite hosts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { code?: string; match?: string } => ({
    ...(typeof search["code"] === "string" ? { code: search["code"] as string } : {}),
    ...(typeof search["match"] === "string" ? { match: search["match"] as string } : {}),
  }),
  component: VoicePage,
});

type RoomWithCount = VoiceRoom & { listeners: number };

function VoicePage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const tx = useTx();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { code, match } = Route.useSearch();
  const [creating, setCreating] = useState(!!match);
  const [joinCode, setJoinCode] = useState(code ?? "");
  const [codeError, setCodeError] = useState<string | null>(null);
  const suspension = useMySuspension(user?.id);

  const rooms = useQuery({
    queryKey: ["voice-rooms"],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data } = await supabase
        .from("voice_rooms")
        .select("id, host_id, title, description, photo_url, visibility, invite_code, status, started_at, ended_at")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(60);
      const list = (data ?? []) as unknown as VoiceRoom[];
      if (list.length === 0) return { list: [] as RoomWithCount[], hosts: {} as Record<string, VoiceHost> };
      const [{ data: hostRows }, { data: counts }] = await Promise.all([
        supabase.rpc("voice_host_profiles", { _ids: list.map((r) => r.host_id) }),
        supabase.from("voice_room_participants").select("room_id").in("room_id", list.map((r) => r.id)).is("left_at", null),
      ]);
      const hosts: Record<string, VoiceHost> = {};
      ((hostRows ?? []) as VoiceHost[]).forEach((host) => { hosts[host.id] = { ...host, followers: Number(host.followers ?? 0) }; });
      const tally: Record<string, number> = {};
      ((counts ?? []) as { room_id: string }[]).forEach((row) => { tally[row.room_id] = (tally[row.room_id] ?? 0) + 1; });
      const withCounts: RoomWithCount[] = list.map((room) => ({ ...room, listeners: tally[room.id] ?? 0 }));
      // Feed order: most-followed hosts first, then busiest rooms.
      withCounts.sort((a, b) => (hosts[b.host_id]?.followers ?? 0) - (hosts[a.host_id]?.followers ?? 0) || b.listeners - a.listeners);
      return { list: withCounts, hosts };
    },
  });

  const following = useQuery({
    enabled: !!user,
    queryKey: ["voice-following", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profile_follows").select("following_id").eq("follower_id", user!.id);
      return ((data ?? []) as { following_id: string }[]).map((row) => row.following_id);
    },
  });

  const toggleFollow = async (hostId: string) => {
    if (!user) { void navigate({ to: "/auth" }); return; }
    if ((following.data ?? []).includes(hostId)) await supabase.from("profile_follows").delete().eq("follower_id", user.id).eq("following_id", hostId);
    else await supabase.from("profile_follows").insert({ follower_id: user.id, following_id: hostId });
    await qc.invalidateQueries({ queryKey: ["voice-following"] });
  };

  const openCode = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 8) { setCodeError(tx("That invite code looks too short.")); return; }
    const { data } = await supabase.rpc("voice_room_by_code", { _code: trimmed });
    const room = ((data ?? []) as { id: string; status: string }[])[0];
    if (!room) { setCodeError(tx("No room matches that invite code.")); return; }
    setCodeError(null);
    void navigate({ to: "/voice/$id", params: { id: room.id } });
  };

  useEffect(() => { if (code) void openCode(code); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const followed = useMemo(() => {
    const ids = following.data ?? [];
    return (rooms.data?.list ?? []).filter((room) => ids.includes(room.host_id));
  }, [rooms.data, following.data]);

  return (
    <AppShell>
      <BackButton />
      <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-7">
        <div className="inline-flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-widest text-primary">
          <Radio className="h-4 w-4" /> {tx("Voice rooms")}
        </div>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{tx("Live football talk")}</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{tx("Join a room to listen, raise your hand to speak, or start your own room. Follow hosts to know when they go live.")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => (user ? (suspension.data ? setCodeError(tx(suspensionMessage(suspension.data))) : setCreating(true)) : navigate({ to: "/auth" }))} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow">
            <Plus className="h-4 w-4" /> {tx("Start a room")}
          </button>
          <div className="flex items-center gap-2">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder={tx("Invite code")}
              className="h-10 w-40 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            <button onClick={() => openCode(joinCode)} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-semibold">
              <Link2 className="h-3.5 w-3.5" /> {tx("Open")}
            </button>
          </div>
        </div>
        {codeError && <p className="mt-2 text-xs font-semibold text-destructive">{codeError}</p>}
      </div>

      {followed.length > 0 && (
        <section className="mt-8">
          <SectionHeader title={tx("From people you follow")} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {followed.map((room) => <RoomCard key={room.id} room={room} host={rooms.data?.hosts[room.host_id]} lang={lang} following onFollow={() => toggleFollow(room.host_id)} isSelf={room.host_id === user?.id} />)}
          </div>
        </section>
      )}

      <section className="mt-8">
        <SectionHeader title={tx("Live now")} />
        {rooms.isLoading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {!rooms.isLoading && (rooms.data?.list.length ?? 0) === 0 && (
          <EmptyState title={tx("No live rooms right now")} description={tx("Start the first one and fans can join in seconds.")} />
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(rooms.data?.list ?? []).map((room) => (
            <RoomCard key={room.id} room={room} host={rooms.data?.hosts[room.host_id]} lang={lang}
              following={(following.data ?? []).includes(room.host_id)}
              onFollow={() => toggleFollow(room.host_id)}
              isSelf={room.host_id === user?.id} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader title={tx("Replays")} />
        <VoiceReplays />
      </section>

      {creating && <CreateRoom matchId={match ?? null} onClose={() => setCreating(false)} onCreated={(id) => navigate({ to: "/voice/$id", params: { id } })} />}
    </AppShell>
  );
}

function RoomCard({ room, host, lang, following, onFollow, isSelf }: {
  room: RoomWithCount; host?: VoiceHost; lang: "en" | "ar"; following: boolean; onFollow: () => void; isSelf: boolean;
}) {
  const tx = useTx();
  const compact = useCompact();
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md">
      <Link to="/voice/$id" params={{ id: room.id }} className="block">
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <img src={roomCover(room)} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-widest text-white">
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> {tx("Live")}</span>
              <span>{liveFor(room.started_at, lang)}</span>
              {room.visibility === "private" ? <Lock className="h-3 w-3" /> : <Globe2 className="h-3 w-3" />}
            </div>
          </div>
        </div>
        <div className="p-3">
          <div className="line-clamp-2 text-sm font-bold">{room.title}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {host?.avatar_url ? <img src={host.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[0.6rem] font-bold">{(host?.display_name ?? "?").slice(0, 1).toUpperCase()}</span>}
            <span className="truncate">{host?.display_name ?? tx("Host")}</span>
            <span className="ms-auto inline-flex items-center gap-1"><Users className="h-3 w-3" /> {room.listeners}</span>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="text-[0.65rem] text-muted-foreground">{tx("Followers")}: {compact(host?.followers ?? 0)}</span>
        {!isSelf && (
          <button onClick={onFollow} className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${following ? "border border-border bg-card text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
            {following ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            {following ? tx("Following") : tx("Follow")}
          </button>
        )}
      </div>
    </div>
  );
}

function CreateRoom({ onClose, onCreated, matchId = null }: { onClose: () => void; onCreated: (id: string) => void; matchId?: string | null }) {
  const { user } = useAuth();
  const tx = useTx();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [photo, setPhoto] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedMatch, setLinkedMatch] = useState<string>(matchId ?? "");

  // Optional: attach the room to a match so it shows on that match page.
  const matches = useQuery({
    enabled: !matchId,
    queryKey: ["voice-match-options"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, kickoff_at, home:home_team_id(name), away:away_team_id(name)")
        .order("kickoff_at", { ascending: false })
        .limit(40);
      return (data ?? []) as unknown as { id: string; kickoff_at: string | null; home: { name: string } | null; away: { name: string } | null }[];
    },
  });

  const create = async () => {
    if (!user || !title.trim()) return;
    setBusy(true); setError(null);
    const { data: restricted } = await supabase.rpc("is_suspended", { _uid: user.id });
    if (restricted) { setError(tx("This account cannot start a voice room right now.")); setBusy(false); return; }
    const { data, error: insertError } = await supabase
      .from("voice_rooms")
      .insert({ host_id: user.id, title: title.trim(), description: description.trim() || null, photo_url: photo, visibility, match_id: linkedMatch || null })
      .select("id")
      .maybeSingle();
    if (insertError || !data) { setError(tx("Could not start the room. Please try again.")); setBusy(false); return; }
    const { error: participantError } = await supabase.from("voice_room_participants").insert({ room_id: data.id, user_id: user.id, role: "host", is_muted: true });
    if (participantError) {
      await supabase.from("voice_rooms").delete().eq("id", data.id);
      setError(tx("The room was not started. Please try again."));
      setBusy(false);
      return;
    }
    setBusy(false);
    onCreated(data.id);
  };

  const preview = photo ?? generatedCover(title || "Voice room");

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" onClick={onClose}>
      {/* Scrolls inside itself and clears the phone tab bar so "Go live" is always reachable. */}
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-background p-5 sm:max-h-[85vh] sm:rounded-3xl"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{tx("Start a voice room")}</h2>
        {matchId && <p className="mt-1 text-xs font-semibold text-primary">{tx("This room will appear on the match page.")}</p>}
        <div className="mt-4 flex gap-3">
          <img src={preview} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
          <div className="flex-1 space-y-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx("Room title")}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold">
              <ImagePlus className="h-3.5 w-3.5" /> {photo ? tx("Change photo") : tx("Add photo (optional)")}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setCropFile(file); e.currentTarget.value = ""; }} />
            </label>
            {!photo && <p className="text-[0.65rem] text-muted-foreground">{tx("No photo? We generate cover art from your title.")}</p>}
          </div>
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={tx("What is this room about? (optional)")}
          className="mt-3 w-full rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
        {!matchId && (
          <label className="mt-3 block">
            <span className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Link to a match (optional)")}</span>
            <select value={linkedMatch} onChange={(e) => setLinkedMatch(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">{tx("No match")}</option>
              {(matches.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {(m.home?.name ?? "?") + " v " + (m.away?.name ?? "?")}{m.kickoff_at ? ` — ${new Date(m.kickoff_at).toLocaleDateString()}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([["public", Globe2, tx("Public — anyone can join")], ["private", Lock, tx("Private — invite link only")]] as const).map(([value, Icon, label]) => (
            <button key={value} onClick={() => setVisibility(value)}
              className={`flex items-start gap-2 rounded-2xl border p-3 text-start text-xs font-semibold ${visibility === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" /> {label}
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={create} disabled={busy || !title.trim()} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} {tx("Go live")}
          </button>
          <button onClick={onClose} className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold">{tx("Cancel")}</button>
        </div>
      </div>
      {cropFile && (
        <ImageCropper file={cropFile} aspect={16 / 9} onCancel={() => setCropFile(null)}
          onDone={async (file) => { const url = await uploadMedia("news-covers", file); setPhoto(url); setCropFile(null); }} />
      )}
    </div>
  );
}
