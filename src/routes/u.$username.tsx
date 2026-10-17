import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, UserPlus, UserCheck, Lock, BadgeCheck, Pencil } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { VoiceReplays } from "@/components/voice-replays";
import { BackButton } from "@/components/app-shell";
import { useCompact } from "@/lib/auto-translate";
import { VoiceBadge } from "@/components/voice-people";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — Mansour Almail Scores` },
      { name: "description", content: `Football profile of @${params.username}: followers and published voice rooms.` },
      { property: "og:title", content: `@${params.username} on Mansour Almail Scores` },
      { property: "og:description", content: "Followers, published voice rooms and favourite clubs." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type Person = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

/** Followers / following list popup with a search box. */
function FollowListDialog({ userId, kind, open, onClose }: { userId: string; kind: "followers" | "following"; open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const people = useQuery({
    enabled: open,
    queryKey: ["follow-list", userId, kind],
    queryFn: async () => {
      const column = kind === "followers" ? "following_id" : "follower_id";
      const other = kind === "followers" ? "follower_id" : "following_id";
      const { data: rows } = await supabase.from("profile_follows").select(other).eq(column, userId).limit(200);
      const ids = (rows ?? []).map((r) => (r as Record<string, string>)[other]).filter(Boolean);
      if (ids.length === 0) return [] as Person[];
      const { data: profiles } = await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", ids);
      return (profiles ?? []) as Person[];
    },
  });
  const list = (people.data ?? []).filter((p) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (p.display_name ?? "").toLowerCase().includes(needle) || (p.username ?? "").toLowerCase().includes(needle);
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="capitalize">{kind}</DialogTitle></DialogHeader>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…"
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
        {people.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        <div className="mt-2 space-y-1">
          {list.map((p) => (
            <Link key={p.id} to="/u/$username" params={{ username: p.username ?? p.id }} onClick={onClose}
              className="flex items-center gap-3 rounded-xl p-2 hover:bg-accent">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-bold">
                {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p.display_name ?? p.username ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{p.display_name ?? p.username}</div>
                {p.username && <div className="truncate text-xs text-muted-foreground">@{p.username}</div>}
              </div>
            </Link>
          ))}
          {!people.isLoading && list.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No one here yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [following, setFollowing] = useState(false);
  const [followList, setFollowList] = useState<"followers" | "following" | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,bio,is_public")
        .ilike("username", username)
        .maybeSingle();
      if (!data) return null;
      const [{ count: followers }, { count: followingCount }, { count: recordings }] = await Promise.all([
        supabase.from("profile_follows").select("id", { count: "exact", head: true }).eq("following_id", data.id),
        supabase.from("profile_follows").select("id", { count: "exact", head: true }).eq("follower_id", data.id),
        supabase.from("voice_recordings").select("id", { count: "exact", head: true }).eq("host_id", data.id),
      ]);
      return { ...data, followers: followers ?? 0, following: followingCount ?? 0, recordings: recordings ?? 0 };
    },
  });

  const compactNum = useCompact();
  const target = profile.data;
  const badge = useQuery({ queryKey: ["voice-badge", target?.id], enabled: !!target, queryFn: async () => { if (!target) return null; const { data } = await supabase.from("voice_user_badges").select("badge").eq("user_id", target.id).maybeSingle(); return data?.badge; } });

  useEffect(() => {
    if (!user || !target) return;
    (async () => {
      const { data } = await supabase
        .from("profile_follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", target.id)
        .maybeSingle();
      setFollowing(!!data);
    })();
  }, [user, target]);

  const toggleFollow = async () => {
    if (!user || !target) return;
    if (following) {
      await supabase.from("profile_follows").delete().eq("follower_id", user.id).eq("following_id", target.id);
    } else {
      await supabase.from("profile_follows").insert({ follower_id: user.id, following_id: target.id } as never);
    }
    setFollowing(!following);
    qc.invalidateQueries({ queryKey: ["profile", username] });
  };

  const saveProfile = async () => {
    if (!user || !target || saving) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: editName.trim() || null,
      bio: editBio.trim() || null,
      is_public: editPublic,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error("Could not save profile"); return; }
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["profile", username] });
  };

  if (profile.isLoading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  if (!target) return <AppShell><BackButton /><p className="mt-6 text-sm text-muted-foreground">No profile with that username.</p></AppShell>;

  const hidden = !target.is_public && target.id !== user?.id;
  const own = target.id === user?.id;

  return (
    <AppShell>
      <BackButton />
      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-card p-5">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-bold">
          {target.avatar_url ? <img src={target.avatar_url} alt="" className="h-full w-full object-cover" /> : (target.display_name ?? target.username ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold"><span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">{target.display_name ?? target.username}</span><VoiceBadge badge={badge.data} /></h1>
          <div className="text-sm text-muted-foreground">@{target.username}</div>
          <div className="mt-1 flex gap-4 text-xs">
            <button onClick={() => setFollowList("followers")} className="hover:text-primary"><b>{compactNum(target.followers)}</b> followers</button>
            <button onClick={() => setFollowList("following")} className="hover:text-primary"><b>{compactNum(target.following)}</b> following</button>
            <span><b>{compactNum(target.recordings)}</b> recordings</span>
          </div>
          {target.bio && <p className="mt-2 text-sm">{target.bio}</p>}
        </div>
        {own && (
          <div className="flex flex-col items-end gap-2">
            <button onClick={() => { setEditName(target.display_name ?? ""); setEditBio(target.bio ?? ""); setEditPublic(target.is_public); setEditing(true); }}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-bold">
              <Pencil className="h-4 w-4" /> Edit profile
            </button>
            <Link to="/verify" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
              <BadgeCheck className="h-3.5 w-3.5" /> Request verification
            </Link>
          </div>
        )}
        {user && !own && !hidden && (
          <button onClick={toggleFollow}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold ${following ? "border border-border bg-card" : "bg-primary text-primary-foreground"}`}>
            {following ? <><UserCheck className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
          </button>
        )}
      </div>

      {followList && <FollowListDialog userId={target.id} kind={followList} open onClose={() => setFollowList(null)} />}

      <Dialog open={editing} onOpenChange={(o) => { if (!o && !saving) setEditing(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <label className="block text-sm">Display name
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-base" />
            </label>
            <label className="block text-sm">Bio
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-base" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editPublic} onChange={(e) => setEditPublic(e.target.checked)} />
              Public account — others can find and follow me
            </label>
            <button onClick={saveProfile} disabled={saving} className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {hidden ? (
        <div className="mt-6 flex items-center gap-2 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> This profile is private.
        </div>
      ) : (
        <section className="mt-8">
          <h2 className="text-sm font-bold">Voice rooms</h2>
          <p className="mb-3 text-xs text-muted-foreground">Recordings this person chose to publish.</p>
          <VoiceReplays hostId={target.id} publicOnly={!own} />
        </section>
      )}
    </AppShell>
  );
}
