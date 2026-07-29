import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Team, type StandingRow } from "@/lib/db";
import { inputCls, btnPrimary, btnGhost } from "./ui";
import { useState, useEffect } from "react";

export function StandingsPanel({ competitionId }: { competitionId: string }) {
  const qc = useQueryClient();

  const teamsQ = useQuery({
    queryKey: ["admin", "teams", competitionId],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("*").eq("competition_id", competitionId);
      return (data ?? []) as Team[];
    },
  });

  const rowsQ = useQuery({
    queryKey: ["admin", "standings", competitionId],
    queryFn: async () => {
      const { data } = await supabase.from("standings_rows").select("*").eq("competition_id", competitionId).order("group_label").order("sort_order");
      return (data ?? []) as StandingRow[];
    },
  });

  const teams = teamsQ.data ?? [];
  const rows = rowsQ.data ?? [];

  const ensureRow = async (teamId: string) => {
    const existing = rows.find((r) => r.team_id === teamId);
    if (existing) return;
    const team = teams.find((t) => t.id === teamId);
    await supabase.from("standings_rows").insert({ competition_id: competitionId, team_id: teamId, group_label: team?.group_label ?? null } as never);
    qc.invalidateQueries({ queryKey: ["admin", "standings", competitionId] });
  };

  const seedAll = async () => {
    const missing = teams.filter((t) => !rows.find((r) => r.team_id === t.id));
    if (missing.length === 0) return;
    await supabase.from("standings_rows").insert(missing.map((t) => ({ competition_id: competitionId, team_id: t.id, group_label: t.group_label })) as never);
    qc.invalidateQueries({ queryKey: ["admin", "standings", competitionId] });
  };

  const removeRow = async (id: string) => {
    await supabase.from("standings_rows").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "standings", competitionId] });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold">Standings</h3>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={seedAll}>Sync all teams</button>
          <select className={`${inputCls} h-9 w-auto`} onChange={(e) => { if (e.target.value) { void ensureRow(e.target.value); e.target.value = ""; } }}>
            <option value="">+ Add team to table…</option>
            {teams.filter((t) => !rows.find((r) => r.team_id === t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="bg-background/50 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Order</th>
              <th className="p-2 text-left">Group</th>
              <th className="p-2 text-left">Team</th>
              <th className="p-2">P</th><th className="p-2">W</th><th className="p-2">D</th><th className="p-2">L</th>
              <th className="p-2">GF</th><th className="p-2">GA</th><th className="p-2">Adj</th><th className="p-2">Pts</th>
              <th className="p-2 text-left">Qualification label</th>
              <th className="p-2 text-left">Color</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => <StandingRowEditor key={r.id} row={r} teams={teams} onRemove={() => removeRow(r.id)} />)}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No table rows yet.</div>}
      </div>
      <p className="mt-3 text-[0.65rem] text-muted-foreground">P/W/D/L/GF/GA/Pts are recomputed automatically from finished matches. Use “Adj” to add or deduct points manually.</p>
    </div>
  );
}

function StandingRowEditor({ row, teams, onRemove }: { row: StandingRow; teams: Team[]; onRemove: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(row);
  useEffect(() => setDraft(row), [row]);

  const save = async () => {
    await supabase.from("standings_rows").update({
      sort_order: draft.sort_order,
      group_label: draft.group_label,
      points_adjust: draft.points_adjust,
      qualification_label: draft.qualification_label,
      qualification_color: draft.qualification_color,
    }).eq("id", row.id);
    qc.invalidateQueries({ queryKey: ["admin", "standings", row.competition_id] });
  };

  const team = teams.find((t) => t.id === row.team_id);
  return (
    <tr className="border-t border-border">
      <td className="p-1"><input type="number" className="w-14 rounded border border-border bg-background px-2 py-1 text-xs" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} onBlur={save} /></td>
      <td className="p-1"><input className="w-20 rounded border border-border bg-background px-2 py-1 text-xs" value={draft.group_label ?? ""} onChange={(e) => setDraft({ ...draft, group_label: e.target.value || null })} onBlur={save} /></td>
      <td className="p-2 font-semibold">{team?.name ?? "?"}</td>
      <td className="p-2 text-center tabular-nums">{row.played}</td>
      <td className="p-2 text-center tabular-nums">{row.won}</td>
      <td className="p-2 text-center tabular-nums">{row.drawn}</td>
      <td className="p-2 text-center tabular-nums">{row.lost}</td>
      <td className="p-2 text-center tabular-nums">{row.gf}</td>
      <td className="p-2 text-center tabular-nums">{row.ga}</td>
      <td className="p-1"><input type="number" className="w-14 rounded border border-border bg-background px-2 py-1 text-xs" value={draft.points_adjust} onChange={(e) => setDraft({ ...draft, points_adjust: Number(e.target.value) })} onBlur={save} /></td>
      <td className="p-2 text-center font-bold">{row.points + draft.points_adjust}</td>
      <td className="p-1"><input className="w-36 rounded border border-border bg-background px-2 py-1 text-xs" placeholder="Champions League" value={draft.qualification_label ?? ""} onChange={(e) => setDraft({ ...draft, qualification_label: e.target.value || null })} onBlur={save} /></td>
      <td className="p-1"><input type="color" className="h-7 w-10 rounded border border-border bg-background" value={draft.qualification_color ?? "#3B82F6"} onChange={(e) => setDraft({ ...draft, qualification_color: e.target.value })} onBlur={save} /></td>
      <td className="p-1"><button onClick={onRemove} className="text-xs text-destructive">Remove</button></td>
    </tr>
  );
}