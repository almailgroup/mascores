import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Save, Trash2, Pencil } from "lucide-react";
import { inputCls } from "./ui";

export function TitleHistoryEditor({ competitionId, teams }: { competitionId: string; teams: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [season, setSeason] = useState("");
  const [teamId, setTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const history = useQuery({ queryKey: ["competition-title-history", competitionId], queryFn: async () => {
    const { data, error } = await supabase.from("competition_title_history").select("id,season,team_id,team:teams(id,name,logo_url)").eq("competition_id", competitionId).order("season", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }});
  const save = async () => {
    if (!season.trim() || !teamId || busy) return;
    setBusy(true); setError("");
    const { error } = await supabase.from("competition_title_history").upsert({ competition_id: competitionId, season: season.trim(), team_id: teamId }, { onConflict: "competition_id,season" });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setSeason(""); setTeamId("");
    await qc.invalidateQueries({ queryKey: ["competition-title-history", competitionId] });
  };
  const remove = async (id: string) => {
    setError("");
    const { error } = await supabase.from("competition_title_history").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["competition-title-history", competitionId] });
  };
  return <div className="space-y-3 border-t border-border pt-4">
    <h3 className="text-sm font-bold">Title history</h3>
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2">
      <input aria-label="Winner year or season" placeholder="2025/2026" maxLength={30} className={inputCls} value={season} onChange={e => setSeason(e.target.value)} />
      <select aria-label="Winning team" className={inputCls} value={teamId} onChange={e => setTeamId(e.target.value)}><option value="">Winning team</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      <Button type="button" size="icon" title="Save winner" aria-label="Save winner" disabled={busy || !season.trim() || !teamId} onClick={() => void save()}><Save className="h-4 w-4" /></Button>
    </div>
    {(error || history.isError) && <p role="alert" className="text-xs text-destructive">{error || "Unable to load title history"}</p>}
    <div className="divide-y divide-border">{history.data?.map(row => <div key={row.id} className="flex items-center gap-2 py-2 text-xs">
      <span className="w-20 shrink-0">{row.season}</span><span className="min-w-0 flex-1 break-words">{row.team?.name}</span>
      <Button type="button" variant="ghost" size="icon" title="Edit winner" aria-label={`Edit ${row.season} winner`} onClick={() => { setSeason(row.season); setTeamId(row.team_id); }}><Pencil className="h-3.5 w-3.5" /></Button>
      <Button type="button" variant="ghost" size="icon" title="Remove winner" aria-label={`Remove ${row.season} winner`} onClick={() => void remove(row.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
    </div>)}</div>
  </div>;
}