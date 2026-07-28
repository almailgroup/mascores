import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, type Player, type Team } from "@/lib/db";

export const Route = createFileRoute("/players/$id")({
  head: () => ({ meta: [{ title: "Player — MansourAlmailScores" }] }),
  component: PlayerPage,
});

function PlayerPage() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["player", id], queryFn: async () => {
    const { data } = await supabase.from("players").select("*, team:team_id(id,name,logo_url)").eq("id", id).maybeSingle();
    return data as (Player & { team: Team | null }) | null;
  }});
  if (q.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!q.data) return <AppShell><EmptyState title="Player not found" /></AppShell>;
  const p = q.data;
  return (
    <AppShell>
      <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-6">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-muted">
          {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl font-bold">{p.shirt_number ?? "?"}</span>}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <div className="text-sm text-muted-foreground">{[p.position, p.nationality, p.team?.name].filter(Boolean).join(" · ")}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {p.dob && <span>DOB: {new Date(p.dob).toLocaleDateString()} </span>}
            {p.height_cm && <span>· {p.height_cm}cm </span>}
            {p.shirt_number != null && <span>· #{p.shirt_number}</span>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}