import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/db";
import { TeamCrest } from "@/components/team-crest";
import { useNum, useTx } from "@/lib/auto-translate";

export function CompetitionTitleHistory({ competitionId }: { competitionId: string }) {
  const tx = useTx();
  const num = useNum();
  const history = useQuery({ queryKey: ["competition-title-history", competitionId], queryFn: async () => {
    const { data, error } = await supabase.from("competition_title_history").select("id,season,team_id,team:teams(id,name,logo_url)").eq("competition_id", competitionId).order("season", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }});
  return <section className="overflow-hidden rounded-lg border border-border bg-card">
    <h2 className="border-b border-border px-3 py-3 text-sm font-bold">{tx("Title history")}</h2>
    <div className="divide-y divide-border">{history.data?.map(row => <Link key={row.id} to="/teams/$id" params={{ id: row.team_id }} className="flex items-center gap-3 px-3 py-3 text-xs hover:bg-accent">
      <span className="w-20 shrink-0 font-semibold tabular-nums">{num(row.season)}</span>
      <TeamCrest name={row.team?.name} logo={row.team?.logo_url} className="h-6 w-6 shrink-0" />
      <span className="min-w-0 break-words font-semibold">{tx(row.team?.name)}</span>
    </Link>)}</div>
    {!history.data?.length && <p className="p-4 text-xs text-muted-foreground">{tx(history.isError ? "Unable to load title history" : "No title history yet")}</p>}
  </section>;
}