import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, UserPlus, UserCheck, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { VoiceReplays } from "@/components/voice-replays";
import { BackButton } from "@/components/app-shell";

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

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [following, setFollowing] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,bio,is_public")
        .ilike("username", username)
        .maybeSingle();
      if (!data) return null;
      const [{ count: followers }, { count: followingCount }] = await Promise.all([
        supabase.from("profile_follows").select("id", { count: "exact", head: true }).eq("following_id", data.id),
        supabase.from("profile_follows").select("id", { count: "exact", head: true }).eq("follower_id", data.id),
      ]);
      return { ...data, followers: followers ?? 0, following: followingCount ?? 0 };
    },
  });

  const target = profile.data;

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

  if (profile.isLoading) return <AppShell><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  if (!target) return <AppShell><BackButton /><p className="mt-6 text-sm text-muted-foreground">No profile with that username.</p></AppShell>;

  const hidden = !target.is_public && target.id !== user?.id;

  return (
    <AppShell>
      <BackButton />
      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-card p-5">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-bold">
          {target.avatar_url ? <img src={target.avatar_url} alt="" className="h-full w-full object-cover" /> : (target.display_name ?? target.username ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{target.display_name ?? target.username}</h1>
          <div className="text-sm text-muted-foreground">@{target.username}</div>
          <div className="mt-1 flex gap-4 text-xs">
            <span><b>{compactNum(target.followers)}</b> followers</span>
            <span><b>{compactNum(target.following)}</b> following</span>
          </div>
          {target.bio && <p className="mt-2 text-sm">{target.bio}</p>}
        </div>
        {user && target.id !== user.id && !hidden && (
          <button onClick={toggleFollow}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold ${following ? "border border-border bg-card" : "bg-primary text-primary-foreground"}`}>
            {following ? <><UserCheck className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
          </button>
        )}
      </div>

      {hidden ? (
        <div className="mt-6 flex items-center gap-2 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> This profile is private.
        </div>
      ) : (
        <section className="mt-8">
          <h2 className="text-sm font-bold">Voice rooms</h2>
          <p className="mb-3 text-xs text-muted-foreground">Recordings this person chose to publish.</p>
          <VoiceReplays hostId={target.id} publicOnly />
        </section>
      )}
    </AppShell>
  );
}
