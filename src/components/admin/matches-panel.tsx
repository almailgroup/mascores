import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Match, type Team, type Player, type MatchEvent, type Lineup, STATUS_LABELS, formatKickoff } from "@/lib/db";
import { Field, Modal, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { Plus, Pencil, Trash2, Radio } from "lucide-react";

type MatchForm = Partial<Match>;

export function MatchesPanel({ competitionId }: { competitionId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MatchForm>({});
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

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

  const save = async () => {
    const payload = { ...form, competition_id: competitionId };
    if (form.id) await supabase.from("matches").update(payload).eq("id", form.id);
    else await supabase.from("matches").insert(payload as never);
    setOpen(false); setForm({});
    qc.invalidateQueries({ queryKey: ["admin", "matches", competitionId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this match?")) return;
    await supabase.from("matches").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "matches", competitionId] });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold">Matches</h3>
        <button className={btnPrimary} onClick={() => { setForm({ status: "scheduled" }); setOpen(true); }}><Plus className="h-3.5 w-3.5" /> Add match</button>
      </div>

      <div className="grid gap-2">
        {(matchesQ.data ?? []).map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="w-16 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{m.status.toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{teamName(m.home_team_id)} <span className="mx-1 text-muted-foreground">vs</span> {teamName(m.away_team_id)}</div>
              <div className="truncate text-xs text-muted-foreground">{m.round ? `${m.round} · ` : ""}{formatKickoff(m.kickoff_at)}{m.venue ? ` · ${m.venue}` : ""}</div>
            </div>
            {(m.home_score != null || m.away_score != null) && <div className="text-sm font-black tabular-nums">{m.home_score ?? 0}–{m.away_score ?? 0}</div>}
            <button className={btnGhost} onClick={() => setEditingMatch(m)}><Radio className="h-3.5 w-3.5" /> Live</button>
            <button className={btnGhost} onClick={() => { setForm(m); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
            <button className={btnDanger} onClick={() => remove(m.id)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {matchesQ.data && matchesQ.data.length === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No matches yet.</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit match" : "New match"} wide>
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
          <Field label="Kick-off (local)"><input type="datetime-local" className={inputCls} value={form.kickoff_at ? new Date(form.kickoff_at).toISOString().slice(0, 16) : ""} onChange={(e) => setForm({ ...form, kickoff_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Field>
          <Field label="Round"><input className={inputCls} placeholder="Matchday 1 / QF / Group A" value={form.round ?? ""} onChange={(e) => setForm({ ...form, round: e.target.value })} /></Field>
          <Field label="Venue"><input className={inputCls} value={form.venue ?? ""} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></Field>
          <Field label="City"><input className={inputCls} value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="Status">
            <select className={inputCls} value={form.status ?? "scheduled"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Live minute"><input type="number" className={inputCls} value={form.live_minute ?? ""} onChange={(e) => setForm({ ...form, live_minute: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Home score"><input type="number" className={inputCls} value={form.home_score ?? ""} onChange={(e) => setForm({ ...form, home_score: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          <Field label="Away score"><input type="number" className={inputCls} value={form.away_score ?? ""} onChange={(e) => setForm({ ...form, away_score: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          <Field label="Home penalties"><input type="number" className={inputCls} value={form.home_pen ?? ""} onChange={(e) => setForm({ ...form, home_pen: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          <Field label="Away penalties"><input type="number" className={inputCls} value={form.away_pen ?? ""} onChange={(e) => setForm({ ...form, away_pen: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          <div className="sm:col-span-2"><Field label="Notes"><textarea rows={2} className={inputCls} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Save</button>
        </div>
      </Modal>

      {editingMatch && <LiveMatchEditor match={editingMatch} teams={teams} onClose={() => setEditingMatch(null)} />}
    </div>
  );
}

const EVENT_TYPES = ["goal", "own_goal", "penalty_goal", "penalty_miss", "yellow", "red", "second_yellow", "substitution", "var", "note"];

function LiveMatchEditor({ match, teams, onClose }: { match: Match; teams: Team[]; onClose: () => void }) {
  const qc = useQueryClient();
  const teamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[];

  const eventsQ = useQuery({
    queryKey: ["admin", "events", match.id],
    queryFn: async () => {
      const { data } = await supabase.from("match_events").select("*").eq("match_id", match.id).order("minute", { nullsFirst: true });
      return (data ?? []) as MatchEvent[];
    },
  });

  const playersQ = useQuery({
    enabled: teamIds.length > 0,
    queryKey: ["admin", "players-of-match", match.id],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("*").in("team_id", teamIds);
      return (data ?? []) as Player[];
    },
  });

  const lineupsQ = useQuery({
    queryKey: ["admin", "lineups", match.id],
    queryFn: async () => {
      const { data } = await supabase.from("match_lineups").select("*").eq("match_id", match.id);
      return (data ?? []) as Lineup[];
    },
  });

  const [ev, setEv] = useState<Partial<MatchEvent>>({ type: "goal" });
  const players = playersQ.data ?? [];
  const playerName = (id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "";
  const teamName = (id: string | null | undefined) => teams.find((t) => t.id === id)?.name ?? "";

  const addEvent = async () => {
    if (!ev.type) return;
    await supabase.from("match_events").insert({ ...ev, match_id: match.id } as never);
    setEv({ type: "goal" });
    qc.invalidateQueries({ queryKey: ["admin", "events", match.id] });
  };
  const delEvent = async (id: string) => {
    await supabase.from("match_events").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "events", match.id] });
  };

  const toggleLineup = async (playerId: string, teamId: string, starting: boolean) => {
    const existing = (lineupsQ.data ?? []).find((l) => l.player_id === playerId && l.match_id === match.id);
    if (existing) {
      if (existing.is_starting === starting) await supabase.from("match_lineups").delete().eq("id", existing.id);
      else await supabase.from("match_lineups").update({ is_starting: starting }).eq("id", existing.id);
    } else {
      await supabase.from("match_lineups").insert({ match_id: match.id, team_id: teamId, player_id: playerId, is_starting: starting } as never);
    }
    qc.invalidateQueries({ queryKey: ["admin", "lineups", match.id] });
  };

  const lineupState = (playerId: string) => (lineupsQ.data ?? []).find((l) => l.player_id === playerId)?.is_starting;

  return (
    <Modal open onClose={onClose} title={`Live: ${teamName(match.home_team_id)} vs ${teamName(match.away_team_id)}`} wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-bold">Events</h4>
          <div className="mb-3 grid gap-2 rounded-xl border border-border bg-background/40 p-3">
            <div className="grid grid-cols-2 gap-2">
              <select className={inputCls} value={ev.type ?? "goal"} onChange={(e) => setEv({ ...ev, type: e.target.value })}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
              <input type="number" placeholder="Minute" className={inputCls} value={ev.minute ?? ""} onChange={(e) => setEv({ ...ev, minute: e.target.value ? Number(e.target.value) : null })} />
              <select className={inputCls} value={ev.team_id ?? ""} onChange={(e) => setEv({ ...ev, team_id: e.target.value || null })}>
                <option value="">Team</option>
                {teamIds.map((id) => <option key={id} value={id}>{teamName(id)}</option>)}
              </select>
              <select className={inputCls} value={ev.player_id ?? ""} onChange={(e) => setEv({ ...ev, player_id: e.target.value || null })}>
                <option value="">Player</option>
                {players.filter((p) => !ev.team_id || p.team_id === ev.team_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <input className={inputCls} placeholder="Description (optional)" value={ev.description ?? ""} onChange={(e) => setEv({ ...ev, description: e.target.value })} />
            <button className={btnPrimary} onClick={addEvent}><Plus className="h-3.5 w-3.5" /> Add event</button>
          </div>
          <div className="grid gap-1">
            {(eventsQ.data ?? []).map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-2 text-xs">
                <span className="w-10 font-mono text-muted-foreground">{e.minute ?? "?"}'</span>
                <span className="w-24 font-semibold uppercase tracking-widest text-[0.65rem]">{e.type.replace("_", " ")}</span>
                <span className="flex-1 truncate">{playerName(e.player_id)} {e.description ? `— ${e.description}` : ""}</span>
                <button onClick={() => delEvent(e.id)} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-bold">Lineups</h4>
          {teamIds.map((tid) => (
            <div key={tid} className="mb-4 rounded-xl border border-border bg-background/40 p-3">
              <div className="mb-2 text-xs font-semibold">{teamName(tid)}</div>
              <div className="grid gap-1">
                {players.filter((p) => p.team_id === tid).map((p) => {
                  const st = lineupState(p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate">{p.name} {p.shirt_number ? `· #${p.shirt_number}` : ""}</span>
                      <button onClick={() => toggleLineup(p.id, tid, true)} className={`rounded px-2 py-0.5 ${st === true ? "bg-primary text-primary-foreground" : "bg-muted"}`}>XI</button>
                      <button onClick={() => toggleLineup(p.id, tid, false)} className={`rounded px-2 py-0.5 ${st === false ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Bench</button>
                    </div>
                  );
                })}
                {players.filter((p) => p.team_id === tid).length === 0 && <div className="text-[0.65rem] text-muted-foreground">Add players to this team's squad first.</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}