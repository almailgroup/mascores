import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, type Team, type Player } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/teams/$id")({
  head: () => ({ meta: [{ title: "Team — MansourAlmailScores" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { id } = Route.useParams();
  useRealtime(["teams", "players"]);
  const team = useQuery({ queryKey: ["team", id], queryFn: async () => {
    const { data } = await supabase.from("teams").select("*").eq("id", id).maybeSingle();
    return data as Team | null;
  }});
  const squad = useQuery({ queryKey: ["squad", id], queryFn: async () => {
    const { data } = await supabase.from("players").select("*").eq("team_id", id).order("shirt_number");
    return (data ?? []) as Player[];
  }});
  if (team.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!team.data) return <AppShell><EmptyState title="Team not found" /></AppShell>;
  const t = team.data;
  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-4 rounded-3xl border border-border bg-card p-6">
        {t.logo_url && <img src={t.logo_url} className="h-16 w-16 object-contain" alt="" />}
        <div>
          <h1 className="text-2xl font-bold">{t.name}</h1>
          <div className="text-xs text-muted-foreground">{[t.country, t.venue_name].filter(Boolean).join(" · ")}</div>
          {t.coach_name && <div className="mt-1 text-sm">Coach: {t.coach_name}</div>}
        </div>
      </div>
      <div className="mb-3 text-sm font-semibold">Squad</div>
      {squad.data && squad.data.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {squad.data.map((p) => (
            <Link key={p.id} to="/players/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
                {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : (p.shirt_number ?? "?")}
              </div>
              <div className="min-w-0"><div className="truncate font-medium">{p.name}</div><div className="truncate text-xs text-muted-foreground">{p.position ?? "—"}</div></div>
            </Link>
          ))}
        </div>
      ) : <EmptyState title="No players yet" />}
    </AppShell>
  );
}