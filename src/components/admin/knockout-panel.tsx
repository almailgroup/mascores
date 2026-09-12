import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { Field, inputCls, btnPrimary, btnGhost } from "./ui";
import { Plus, Trash2 } from "lucide-react";

type Tie = {
  id: string;
  competition_id: string;
  season: string | null;
  round_label: string;
  sort_order: number;
  home_team_id: string | null;
  away_team_id: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_score: number | null;
  away_score: number | null;
  note: string | null;
};

const ROUNDS = ["Round of 16", "Quarter-finals", "Semi-finals", "Third place", "Final"];

/** Knockout ties for one competition and season. A tie can be created before the
 *  clubs are known by writing where each side comes from, e.g. "1st from Group A". */
export function KnockoutPanel({ competitionId, season }: { competitionId: string; season: string | null }) {
  const qc = useQueryClient();
  const [round, setRound] = useState(ROUNDS[0]);

  const ties = useQuery({
    queryKey: ["admin", "knockout", competitionId, season],
    queryFn: async () => {
      let query = supabase.from("competition_knockout_ties").select("*").eq("competition_id", competitionId);
      if (season) query = query.or(`season.eq.${season},season.is.null`);
      const { data } = await query.order("sort_order");
      return (data ?? []) as unknown as Tie[];
    },
  });
  const teams = useQuery({
    queryKey: ["admin", "knockout-teams", competitionId, season],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id,name").order("name");
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "knockout", competitionId, season] });

  const addTie = async () => {
    const list = ties.data ?? [];
    await supabase.from("competition_knockout_ties").insert({
      competition_id: competitionId, season, round_label: round,
      sort_order: list.length, home_placeholder: "", away_placeholder: "",
    } as never);
    refresh();
  };

  const patch = async (id: string, values: Partial<Tie>) => {
    await supabase.from("competition_knockout_ties").update(values as never).eq("id", id);
    refresh();
  };

  const remove = async (id: string) => {
    await supabase.from("competition_knockout_ties").delete().eq("id", id);
    refresh();
  };

  const rounds = new Map<string, Tie[]>();
  for (const tie of ties.data ?? []) rounds.set(tie.round_label, [...(rounds.get(tie.round_label) ?? []), tie]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <Field label="Round">
          <select className={inputCls} value={round} onChange={(e) => setRound(e.target.value)}>
            {ROUNDS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <button className={btnPrimary} onClick={addTie}><Plus className="h-4 w-4" /> Add tie</button>
      </div>

      {(ties.data ?? []).length === 0 && (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No ties yet. Pick a round and add one.</p>
      )}

      {[...rounds.entries()].map(([label, list]) => (
        <section key={label} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="divide-y divide-border">
            {list.map((tie) => (
              <div key={tie.id} className="space-y-2 p-3">
                {(["home", "away"] as const).map((side) => (
                  <div key={side} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem]">
                    <select className={inputCls} value={(side === "home" ? tie.home_team_id : tie.away_team_id) ?? ""}
                      onChange={(e) => patch(tie.id, side === "home" ? { home_team_id: e.target.value || null } : { away_team_id: e.target.value || null })}>
                      <option value="">{side === "home" ? "Home club — not known yet" : "Away club — not known yet"}</option>
                      {(teams.data ?? []).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                    <input className={inputCls} placeholder="Comes from, e.g. 1st from Group A"
                      defaultValue={(side === "home" ? tie.home_placeholder : tie.away_placeholder) ?? ""}
                      onBlur={(e) => patch(tie.id, side === "home" ? { home_placeholder: e.target.value } : { away_placeholder: e.target.value })} />
                    <input type="number" className={inputCls} placeholder="—"
                      defaultValue={(side === "home" ? tie.home_score : tie.away_score) ?? ""}
                      onBlur={(e) => patch(tie.id, side === "home"
                        ? { home_score: e.target.value === "" ? null : Number(e.target.value) }
                        : { away_score: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                ))}
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input className={inputCls} placeholder="Note, for example won on penalties" defaultValue={tie.note ?? ""}
                    onBlur={(e) => patch(tie.id, { note: e.target.value || null })} />
                  <button className={btnGhost} onClick={() => remove(tie.id)}><Trash2 className="h-4 w-4" /> Remove</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
