import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase, formatRating, ratingClass } from "@/lib/db";
import { useNum, useTx } from "@/lib/auto-translate";
import { PlayerAvatar } from "@/components/player-avatar";
import { TeamCrest } from "@/components/team-crest";
import { SeasonMenu } from "@/components/season-menu";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type RoundPlayer = { id: string; name: string; photo_url: string | null; rating: number; position: string; team_id: string; team_name: string; team_logo: string | null };
type RoundTeam = { key: string; round_number: number | null; round_label: string | null; available_at: string | null; ready: boolean; players: RoundPlayer[] };

export function CompetitionRoundTeam({ competitionId, season }: { competitionId: string; season: string | null }) {
  const tx = useTx();
  const num = useNum();
  const [selected, setSelected] = useState("");
  const [showInfo, setShowInfo] = useState(true);
  const rounds = useQuery({
    queryKey: ["competition-round-team", competitionId, season],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("competition_round_teams", { _competition_id: competitionId, _season: season ?? undefined });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as unknown as RoundTeam[];
    },
  });
  // Refresh precisely at the next availability deadline while the page is open, not with a recurring job.
  useEffect(() => {
    const next = (rounds.data ?? []).filter(r => !r.ready && r.available_at && new Date(r.available_at).getTime() > Date.now()).map(r => new Date(r.available_at ?? "").getTime()).sort((a,b) => a-b)[0];
    if (!next) return;
    const timer = setTimeout(() => void rounds.refetch(), Math.min(2147483647, next-Date.now()+1000));
    return () => clearTimeout(timer);
  }, [rounds.data]);
  const available = rounds.data ?? [];
  const round = available.find(r => r.key === selected) ?? available.find(r => r.ready && r.players.length === 11) ?? available.find(r => r.ready) ?? available[0];
  return <section aria-label={tx("Team of the Round")} className="overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3">
      <h2 className="text-sm font-bold">{tx("Team of the Round")}</h2>
      {available.length > 0 && <SeasonMenu label="Round" seasons={available.map(r => r.key)} value={round?.key} onChange={setSelected} formatValue={key => {
        const option = available.find(r => r.key === key);
        return option?.round_number != null ? `${tx("Round")} ${num(option.round_number)}` : tx(option?.round_label) ?? tx("Round");
      }} />}
    </div>
    {showInfo && <div className="mx-3 my-3 flex items-start gap-2 rounded-lg bg-muted p-3 text-[0.65rem] leading-relaxed"><span className="min-w-0 flex-1">{tx("Top-rated players at each position, based on their rating from that round’s match.")}</span><Button variant="ghost" size="icon" aria-label={tx("Close")} onClick={() => setShowInfo(false)} className="h-6 w-6 shrink-0"><X className="h-3 w-3" /></Button></div>}
    {rounds.isError ? <p className="p-4 text-xs text-destructive">{tx("Unable to load round ratings")}</p> : round?.ready && round.players.length === 11 ? <div className="round-team-pitch px-2 pb-4 pt-3">
      {["Forward","Midfielder","Defender","Goalkeeper"].map(position => <div key={position} className="relative z-10 flex min-h-24 items-start justify-around gap-1">
        {round.players.filter(p => p.position === position).map(player => <Link key={player.id} to="/players/$id" params={{ id: player.id }} className="flex w-20 min-w-0 flex-col items-center pt-2 text-center">
          <div className="relative h-11 w-11">
            <PlayerAvatar src={player.photo_url} name={player.name} className="h-11 w-11" />
            <span className={`absolute -bottom-1 -start-2 rounded-sm px-1 text-[0.65rem] font-bold ${ratingClass(player.rating)}`}>{num(formatRating(player.rating))}</span>
            <TeamCrest name={player.team_name} logo={player.team_logo} className="absolute -bottom-1 -end-2 h-5 w-5" />
          </div>
          <span className="mt-2 w-full text-balance break-words text-[0.65rem] font-semibold leading-tight">{tx(player.name)}</span>
        </Link>)}
      </div>)}
      <div className="text-center text-[0.65rem] text-muted-foreground">4-3-3</div>
    </div> : <p className="p-5 text-center text-xs text-muted-foreground">{tx(round?.ready ? "Not enough rated players for a complete team" : "Available one hour after the round ends")}</p>}
  </section>;
}