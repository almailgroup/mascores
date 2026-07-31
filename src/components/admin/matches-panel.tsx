import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Match, type Team, STATUS_LABELS, formatKickoff, roundLabel } from "@/lib/db";
import { Field, Modal, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { VenueSelect } from "./venue-select";
import { MatchEditor } from "./match-editor";
import { Plus, Trash2, SlidersHorizontal, Flag } from "lucide-react";

export function MatchesPanel({ competitionId }: { competitionId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Match>>({ status: "scheduled" });
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [resultOf, setResultOf] = useState<Match | null>(null);

  const teamsQ = useQuery({
    queryKey: ["admin", "teams", competitionId],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("*").eq("competition_id", competitionId).order("name");
      return (data ?? []) as Team[];
    },
  });

  const matchesQ = useQuery({
    queryKey: ["admin", "matches", competitionId],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("*").eq("competition_id", competitionId).order("kickoff_at", { nullsFirst: true });
      return (data ?? []) as Match[];
    },
  });

  const teams = teamsQ.data ?? [];
  const teamName = (id: string | null | undefined) => teams.find((t) => t.id === id)?.name ?? "TBD";
  const matches = matchesQ.data ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const k = roundLabel(m.round_number, m.round) ?? "Unassigned round";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return [...map.entries()];
  }, [matches]);

  const create = async () => {
    if (!form.home_team_id || !form.away_team_id) { alert("Pick both teams first."); return; }
    await supabase.from("matches").insert({
      competition_id: competitionId,
      home_team_id: form.home_team_id,
      away_team_id: form.away_team_id,
      kickoff_at: form.kickoff_at ?? null,
      round_number: form.round_number ?? null,
      round: form.round_number != null ? `Round ${form.round_number}` : null,
      venue: form.venue ?? null,
      city: form.city ?? null,
      status: "scheduled",
    } as never);
    setOpen(false); setForm({ status: "scheduled" });
    qc.invalidateQueries({ queryKey: ["admin", "matches", competitionId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this match?")) return;
    await supabase.from("matches").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "matches", competitionId] });
  };

  const isPast = (m: Match) => !!m.kickoff_at && new Date(m.kickoff_at).getTime() < Date.now();
  const noResult = (m: Match) => m.home_score == null && m.away_score == null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold">Matches</h3>
        <button className={btnPrimary} onClick={() => { setForm({ status: "scheduled" }); setOpen(true); }}><Plus className="h-3.5 w-3.5" /> Add match</button>
      </div>

      <div className="grid gap-5">
        {grouped.map(([round, list]) => (
          <div key={round}>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-primary">{round}</span>
              <span className="text-[0.65rem] text-muted-foreground">{list.length} match{list.length === 1 ? "" : "es"}</span>
            </div>
            <div className="grid gap-2">
              {list.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="w-16 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{(STATUS_LABELS[m.status] ?? m.status)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{teamName(m.home_team_id)} <span className="mx-1 text-muted-foreground">vs</span> {teamName(m.away_team_id)}</div>
                    <div className="truncate text-xs text-muted-foreground">{formatKickoff(m.kickoff_at)}{m.venue ? ` · ${m.venue}` : ""}</div>
                  </div>
                  {(m.home_score != null || m.away_score != null) && <div className="text-sm font-black tabular-nums">{m.home_score ?? 0}–{m.away_score ?? 0}</div>}
                  {isPast(m) && noResult(m) && (
                    <button className={btnPrimary} onClick={() => setResultOf(m)}><Flag className="h-3.5 w-3.5" /> End result</button>
                  )}
                  <button className={btnGhost} onClick={() => setEditingMatch(m)}><SlidersHorizontal className="h-3.5 w-3.5" /> Manage</button>
                  <button className={btnDanger} onClick={() => remove(m.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {matches.length === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No matches yet.</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New match" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Home team">
            <select className={inputCls} value={form.home_team_id ?? ""} onChange={(e) => setForm({ ...form, home_team_id: e.target.value || null })}>
              <option value="">— select —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Away team">
            <select className={inputCls} value={form.away_team_id ?? ""} onChange={(e) => setForm({ ...form, away_team_id: e.target.value || null })}>
              <option value="">— select —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Date & time">
            <input type="datetime-local" className={inputCls}
              value={form.kickoff_at ? new Date(new Date(form.kickoff_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
              onChange={(e) => setForm({ ...form, kickoff_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </Field>
          <Field label="Round number"><input type="number" min={1} inputMode="numeric" className={inputCls} placeholder="1" value={form.round_number ?? ""} onChange={(e) => setForm({ ...form, round_number: e.target.value ? Number(e.target.value) : null })} /></Field>
          <div className="sm:col-span-2">
            <Field label="Venue"><VenueSelect venue={form.venue} city={form.city} onChange={(v, c) => setForm({ ...form, venue: v, city: c })} /></Field>
          </div>
        </div>
        <p className="mt-3 text-[0.65rem] text-muted-foreground">Lineups, live events and the match clock become available once the match is created — open it with “Manage”.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={create}>Create match</button>
        </div>
      </Modal>

      {resultOf && <ResultModal match={resultOf} teamName={teamName} onClose={() => setResultOf(null)} onSaved={() => { setResultOf(null); qc.invalidateQueries({ queryKey: ["admin", "matches", competitionId] }); }} />}
      {editingMatch && <MatchEditor match={editingMatch} teams={teams} onClose={() => setEditingMatch(null)} />}
    </div>
  );
}

function ResultModal({ match, teamName, onClose, onSaved }: { match: Match; teamName: (id: string | null) => string; onClose: () => void; onSaved: () => void }) {
  const [hs, setHs] = useState<string>("");
  const [as, setAs] = useState<string>("");
  const [hp, setHp] = useState<string>("");
  const [ap, setAp] = useState<string>("");
  const [status, setStatus] = useState("ft");

  const save = async () => {
    await supabase.from("matches").update({
      home_score: hs === "" ? null : Number(hs),
      away_score: as === "" ? null : Number(as),
      home_pen: hp === "" ? null : Number(hp),
      away_pen: ap === "" ? null : Number(ap),
      status,
      timer_running: false,
    }).eq("id", match.id);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="End result">
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={teamName(match.home_team_id)}><input type="number" className={inputCls} value={hs} onChange={(e) => setHs(e.target.value)} /></Field>
          <Field label={teamName(match.away_team_id)}><input type="number" className={inputCls} value={as} onChange={(e) => setAs(e.target.value)} /></Field>
        </div>
        <Field label="How did it end?">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(STATUS_LABELS).filter(([k]) => !["scheduled", "live", "ht"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        {status === "pen" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Home penalties"><input type="number" className={inputCls} value={hp} onChange={(e) => setHp(e.target.value)} /></Field>
            <Field label="Away penalties"><input type="number" className={inputCls} value={ap} onChange={(e) => setAp(e.target.value)} /></Field>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Save result</button>
        </div>
      </div>
    </Modal>
  );
}
