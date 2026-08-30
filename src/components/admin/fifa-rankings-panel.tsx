import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Team } from "@/lib/db";
import { Field, Modal, inputCls, btnPrimary, btnGhost } from "./ui";
import { FlagIcon } from "@/components/flag";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Minus } from "lucide-react";

type Ranking = {
  id: string;
  team_id: string;
  rank: number;
  points: number;
  previous_rank: number | null;
  season: string | null;
  note: string | null;
};

/** Official FIFA national-team rankings, fully editable by the admin. */
export function FifaRankingsPanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Ranking> | null>(null);
  const [removing, setRemoving] = useState<Ranking | null>(null);
  const [search, setSearch] = useState("");

  const rankingsQ = useQuery({
    queryKey: ["admin", "fifa-rankings"],
    queryFn: async () => ((await supabase.from("fifa_rankings").select("*").order("rank")).data ?? []) as Ranking[],
  });
  const teamsQ = useQuery({
    queryKey: ["admin", "national-teams"],
    queryFn: async () => ((await supabase.from("teams").select("*").eq("is_national", true).order("name")).data ?? []) as Team[],
  });

  const teams = teamsQ.data ?? [];
  const teamOf = (id: string) => teams.find((t) => t.id === id);
  const rows = useMemo(() => {
    const list = rankingsQ.data ?? [];
    if (!search.trim()) return list;
    const term = search.trim().toLowerCase();
    return list.filter((r) => (teamOf(r.team_id)?.name ?? "").toLowerCase().includes(term));
  }, [rankingsQ.data, search, teams]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "fifa-rankings"] });

  const save = async () => {
    if (!editing?.team_id || !editing.rank) return;
    const payload = {
      team_id: editing.team_id,
      rank: Number(editing.rank),
      points: Number(editing.points ?? 0),
      previous_rank: editing.previous_rank ? Number(editing.previous_rank) : null,
      season: editing.season?.trim() || null,
      note: editing.note?.trim() || null,
    };
    if (editing.id) await supabase.from("fifa_rankings").update(payload).eq("id", editing.id);
    else await supabase.from("fifa_rankings").insert(payload as never);
    setEditing(null);
    invalidate();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold">FIFA world ranking</h3>
          <p className="text-xs text-muted-foreground">Official national-team ranking — edit any position at any time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input className={`${inputCls} max-w-44`} placeholder="Search country" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className={btnPrimary} onClick={() => setEditing({ rank: (rankingsQ.data?.length ?? 0) + 1 })}><Plus className="h-3.5 w-3.5" /> Add ranking</button>
        </div>
      </div>

      <div className="grid gap-2">
        {rows.map((r) => {
          const team = teamOf(r.team_id);
          const move = r.previous_rank == null ? 0 : r.previous_rank - r.rank;
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="w-8 text-center text-sm font-bold">{r.rank}</div>
              <FlagIcon value={team?.country_code ?? null} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{team?.name ?? "Unknown team"}</div>
                <div className="text-[0.65rem] text-muted-foreground">{r.points} pts{r.season ? ` · ${r.season}` : ""}{r.note ? ` · ${r.note}` : ""}</div>
              </div>
              <div className={`flex items-center gap-1 text-xs font-semibold ${move > 0 ? "text-emerald-500" : move < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {move > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : move < 0 ? <ArrowDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                {move !== 0 && Math.abs(move)}
              </div>
              <button className={btnGhost} onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></button>
              <button className={btnGhost} onClick={() => setRemoving(r)}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          );
        })}
        {rows.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No rankings yet.</p>}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit ranking" : "Add ranking"}>
        <Field label="National team">
          <select className={inputCls} value={editing?.team_id ?? ""} onChange={(e) => setEditing({ ...editing, team_id: e.target.value })}>
            <option value="">Choose a national team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rank"><input type="number" className={inputCls} value={editing?.rank ?? ""} onChange={(e) => setEditing({ ...editing, rank: Number(e.target.value) })} /></Field>
          <Field label="Points"><input type="number" step="0.01" className={inputCls} value={editing?.points ?? ""} onChange={(e) => setEditing({ ...editing, points: Number(e.target.value) })} /></Field>
          <Field label="Previous rank"><input type="number" className={inputCls} value={editing?.previous_rank ?? ""} onChange={(e) => setEditing({ ...editing, previous_rank: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Season / date"><input className={inputCls} placeholder="2026" value={editing?.season ?? ""} onChange={(e) => setEditing({ ...editing, season: e.target.value })} /></Field>
        </div>
        <Field label="Note"><input className={inputCls} value={editing?.note ?? ""} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></Field>
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setEditing(null)}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Save</button>
        </div>
      </Modal>

      <ConfirmDelete
        open={!!removing}
        title="Delete ranking"
        confirmWord="DELETE"
        description={`Remove ${teamOf(removing?.team_id ?? "")?.name ?? "this team"} from the FIFA ranking?`}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => { await supabase.from("fifa_rankings").delete().eq("id", removing!.id); setRemoving(null); invalidate(); }}
      />
    </div>
  );
}
