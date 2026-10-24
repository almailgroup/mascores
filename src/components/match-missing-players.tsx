import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import { useTx } from "@/lib/auto-translate";
import { Plus, Trash2 } from "lucide-react";
import type { Player } from "@/lib/db";

export function MatchMissingPlayers({ matchId, teamId, players }: { matchId: string; teamId: string; players?: Player[] }) {
  const tx = useTx(); const qc = useQueryClient();
  const [adding, setAdding] = useState(false); const [playerId, setPlayerId] = useState("");
  const [reason, setReason] = useState("Injury"); const [custom, setCustom] = useState(""); const [error, setError] = useState("");
  const key = ["match-missing-players", matchId, teamId];
  const q = useQuery({ queryKey: key, queryFn: async () => {
    const { data, error } = await supabase.from("match_missing_players").select("*, player:player_id(id,name,photo_url)").eq("match_id", matchId).eq("team_id", teamId);
    if (error) throw error; return data ?? [];
  }});
  if (!players && !q.data?.length) return null;
  return <section className="mt-3 border-t border-border pt-3">
    <div className="flex items-center justify-between"><h4 className="text-xs font-bold text-muted-foreground">{tx("Missing players")}</h4>{players && <Button size="icon" variant="ghost" aria-label="Add missing player" onClick={() => setAdding(!adding)}><Plus className="h-4 w-4" /></Button>}</div>
    {q.data?.map(row => <div key={row.id} className="flex items-center gap-2 py-2"><Link to="/players/$id" params={{ id: row.player_id }} className="flex min-w-0 flex-1 items-center gap-2"><PlayerAvatar src={row.player?.photo_url} name={row.player?.name} className="h-8 w-8" /><span className="min-w-0"><span className="block text-sm font-semibold">{tx(row.player?.name)}</span><span className="block text-xs text-muted-foreground">{tx(row.reason === "Custom" ? row.custom_reason : row.reason)}</span></span></Link>{players && <Button variant="ghost" size="icon" aria-label="Remove missing player" onClick={async () => { const {error} = await supabase.from("match_missing_players").delete().eq("id",row.id); if(error) setError(error.message); else void qc.invalidateQueries({queryKey:key}); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div>)}
    {adding && players && <div className="mt-2 grid gap-2"><select aria-label="Missing player" className="rounded border border-border bg-background p-2 text-base" value={playerId} onChange={e=>setPlayerId(e.target.value)}><option value="">{tx("Choose player")}</option>{players.filter(p=>p.team_id===teamId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label="Absence reason" className="rounded border border-border bg-background p-2 text-base" value={reason} onChange={e=>setReason(e.target.value)}>{["Injury","Suspension","Personal reason","Illness","International duty","Custom"].map(r=><option key={r}>{r}</option>)}</select>{reason==="Custom" && <input aria-label="Custom reason" className="rounded border border-border bg-background p-2 text-base" value={custom} onChange={e=>setCustom(e.target.value)} />}<Button disabled={!playerId || (reason==="Custom" && !custom.trim())} onClick={async()=>{ const {error}=await supabase.from("match_missing_players").upsert({match_id:matchId,team_id:teamId,player_id:playerId,reason,custom_reason:reason==="Custom"?custom.trim():null},{onConflict:"match_id,player_id"}); if(error) setError(error.message); else {setAdding(false);void qc.invalidateQueries({queryKey:key});} }}>Save changes</Button></div>}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </section>;
}