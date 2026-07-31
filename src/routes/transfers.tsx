import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { supabase, type Transfer } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/transfers")({
  head: () => ({
    meta: [
      { title: "Transfers — MansourAlmailScores" },
      { name: "description", content: "Every player and coach move tracked across the competitions you follow." },
      { property: "og:title", content: "Transfers — MansourAlmailScores" },
      { property: "og:description", content: "Every player and coach move tracked across the competitions you follow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransfersPage,
});

type Row = Transfer & { player?: { id: string; name: string; photo_url: string | null } | null };

function TransfersPage() {
  useRealtime(["transfers"]);
  const q = useQuery({
    queryKey: ["transfers", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transfers")
        .select("*")
        .order("moved_on", { ascending: false, nullsFirst: false })
        .limit(200);
      const rows = (data ?? []) as Transfer[];
      const playerIds = rows.filter((r) => r.person_type === "player").map((r) => r.person_id);
      let people: Record<string, { id: string; name: string; photo_url: string | null }> = {};
      if (playerIds.length) {
        const { data: pl } = await supabase.from("players").select("id,name,photo_url").in("id", playerIds);
        people = Object.fromEntries((pl ?? []).map((p) => [p.id, p]));
      }
      const coachIds = rows.filter((r) => r.person_type === "coach").map((r) => r.person_id);
      if (coachIds.length) {
        const { data: co } = await supabase.from("coaches").select("id,name,photo_url").in("id", coachIds);
        for (const c of co ?? []) people[c.id] = c;
      }
      return rows.map((r) => ({ ...r, player: people[r.person_id] ?? null })) as Row[];
    },
  });

  return (
    <AppShell>
      <SectionHeader title="Transfers" />
      {q.isLoading ? <LoadingSkeleton /> : !q.data || q.data.length === 0 ? (
        <EmptyState title="No transfers yet" />
      ) : (
        <div className="grid gap-2">
          {q.data.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold">
                {r.player?.photo_url ? <img src={r.player.photo_url} alt="" className="h-full w-full object-cover" /> : (r.player?.name ?? "?").slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {r.person_type === "player" && r.player
                    ? <Link to="/players/$id" params={{ id: r.person_id }} className="hover:text-primary">{r.player.name}</Link>
                    : (r.player?.name ?? "Unknown")}
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-muted-foreground">{r.person_type}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
                  <span>{r.from_club ?? "—"}</span><ArrowRight className="h-3 w-3" /><span>{r.to_club ?? "—"}</span>
                </div>
              </div>
              <div className="shrink-0 text-right text-xs">
                <div className="font-medium">{r.fee ?? r.transfer_type ?? ""}</div>
                <div className="text-muted-foreground">{r.moved_on ? new Date(r.moved_on).toLocaleDateString() : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}