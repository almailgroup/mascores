import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Trophy } from "lucide-react";
import { supabase } from "@/lib/db";
import { TeamCrest } from "@/components/team-crest";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNum, useTx } from "@/lib/auto-translate";

export function CompetitionTitleHistory({ competitionId }: { competitionId: string }) {
  const tx = useTx();
  const num = useNum();
  const history = useQuery({ queryKey: ["competition-title-history", competitionId], queryFn: async () => {
    const { data, error } = await supabase.from("competition_title_history").select("id,season,team_id,team:teams(id,name,logo_url)").eq("competition_id", competitionId).order("season", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }});
  const rows = history.data ?? [];
  const latest = rows[0];
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-start hover:bg-accent">
        <Trophy className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{tx("Title history")}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {rows.length ? `${num(rows.length)} ${tx("seasons")}${latest ? ` · ${num(latest.season)} ${tx(latest.team?.name)}` : ""}` : tx(history.isError ? "Unable to load title history" : "No title history yet")}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
      </button>
    </DialogTrigger>
    <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden p-0">
      <DialogTitle className="border-b border-border px-4 py-3 text-sm font-bold">{tx("Title history")}</DialogTitle>
      <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain">
        {rows.map(row => <Link key={row.id} to="/teams/$id" params={{ id: row.team_id }} className="flex items-center gap-3 px-4 py-3 text-xs hover:bg-accent">
          <span className="w-20 shrink-0 font-semibold tabular-nums">{num(row.season)}</span>
          <TeamCrest name={row.team?.name} logo={row.team?.logo_url} className="h-6 w-6 shrink-0" />
          <span className="min-w-0 break-words font-semibold">{tx(row.team?.name)}</span>
        </Link>)}
        {!rows.length && <p className="p-4 text-xs text-muted-foreground">{tx("No title history yet")}</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
