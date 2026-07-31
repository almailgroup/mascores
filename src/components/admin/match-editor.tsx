import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase, STATUS_LABELS, matchClockSeconds, formatClock,
  type Match, type Team, type Player, type MatchEvent, type Lineup,
} from "@/lib/db";
import { Field, Modal, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { VenueSelect } from "./venue-select";
import { Play, Pause, Plus, Trash2, RotateCcw, Check } from "lucide-react";
import { MediaManager } from "./media-manager";
import type { Database } from "@/integrations/supabase/types";

type MatchStat = Database["public"]["Tables"]["match_stats"]["Row"];
type Channel = Database["public"]["Tables"]["broadcast_channels"]["Row"];

export const EVENT_TYPES = [
  { v: "goal", l: "Goal" },
  { v: "penalty_goal", l: "Penalty goal" },
  { v: "own_goal", l: "Own goal" },
  { v: "penalty_miss", l: "Penalty missed" },
  { v: "yellow", l: "Yellow card" },
  { v: "second_yellow", l: "Second yellow" },
  { v: "red", l: "Red card" },
  { v: "substitution", l: "Substitution" },
  { v: "var", l: "VAR" },
  { v: "note", l: "Note" },
];

const GOAL_KINDS = [
  { v: "goal", l: "Normal goal" },
  { v: "penalty_goal", l: "Penalty" },
  { v: "own_goal", l: "Own goal" },
];

function useLiveClock(match: Match) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!match.timer_running) return;
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [match.timer_running]);
  return matchClockSeconds(match);
}

export function MatchEditor({ match: initial, teams, onClose }: { match: Match; teams: Team[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"main" | "lineups" | "live" | "extras">("main");

  const matchQ = useQuery({
    queryKey: ["admin", "match", initial.id],
    initialData: initial,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("*").eq("id", initial.id).maybeSingle();
      return (data ?? initial) as Match;
    },
  });
  const match = matchQ.data;
  const teamName = (id: string | null | undefined) => teams.find((t) => t.id === id)?.name ?? "TBD";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "match", initial.id] });
    qc.invalidateQueries({ queryKey: ["admin", "matches", initial.competition_id] });
  };

  return (
    <Modal open onClose={onClose} title={`${teamName(match.home_team_id)} vs ${teamName(match.away_team_id)}`} wide>
      <div className="mb-5 flex w-fit gap-1 rounded-full border border-border bg-background p-1 text-xs">
        {([["main", "Match details"], ["lineups", "Lineups"], ["live", "Live centre"], ["extras", "Stats, TV & media"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-4 py-1.5 font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>
      {tab === "main" && <MainTab match={match} teams={teams} onSaved={refresh} />}
      {tab === "lineups" && <LineupsTab match={match} teams={teams} onSaved={refresh} />}
      {tab === "live" && <LiveTab match={match} teams={teams} onSaved={refresh} />}
      {tab === "extras" && <ExtrasTab match={match} teams={teams} />}
    </Modal>
  );
}

function ExtrasTab({ match, teams }: { match: Match; teams: Team[] }) {
  const qc = useQueryClient();
  const [stat, setStat] = useState({ label: "", home_value: "", away_value: "" });
  const [prediction, setPrediction] = useState({ home_percent: 33, draw_percent: 34, away_percent: 33 });
  const statsQ = useQuery({ queryKey: ["admin", "match-stats", match.id], queryFn: async () => (await supabase.from("match_stats").select("*").eq("match_id", match.id).order("sort_order")).data as MatchStat[] ?? [] });
  const channelsQ = useQuery({ queryKey: ["admin", "channels"], queryFn: async () => (await supabase.from("broadcast_channels").select("*").order("name")).data as Channel[] ?? [] });
  const selectedQ = useQuery({ queryKey: ["admin", "match-channels", match.id], queryFn: async () => (await supabase.from("match_broadcasts").select("channel_id").eq("match_id", match.id)).data ?? [] });
  const predictionQ = useQuery({ queryKey: ["admin", "match-prediction", match.id], queryFn: async () => (await supabase.from("match_predictions").select("*").eq("match_id", match.id).maybeSingle()).data });
  useEffect(() => { if (predictionQ.data) setPrediction(predictionQ.data); }, [predictionQ.data]);
  const selected = new Set((selectedQ.data ?? []).map((item) => item.channel_id));
  const home = teams.find((team) => team.id === match.home_team_id)?.name ?? "Home";
  const away = teams.find((team) => team.id === match.away_team_id)?.name ?? "Away";
  return <div className="space-y-8">
    <section><h4 className="mb-3 font-bold">Match statistics</h4><div className="grid gap-2">{statsQ.data?.map((item) => <div key={item.id} className="grid grid-cols-[1fr_2fr_1fr_auto] items-center gap-2 rounded-lg border border-border p-2 text-sm"><span className="text-center font-bold">{item.home_value}</span><span className="text-center text-muted-foreground">{item.label}</span><span className="text-center font-bold">{item.away_value}</span><button className="text-destructive" onClick={async () => { await supabase.from("match_stats").delete().eq("id", item.id); qc.invalidateQueries({ queryKey: ["admin", "match-stats", match.id] }); }}><Trash2 className="h-4 w-4" /></button></div>)}</div><div className="mt-2 grid gap-2 sm:grid-cols-4"><input className={inputCls} placeholder="Statistic, e.g. Possession" value={stat.label} onChange={(e) => setStat({ ...stat, label: e.target.value })} /><input className={inputCls} placeholder={home} value={stat.home_value} onChange={(e) => setStat({ ...stat, home_value: e.target.value })} /><input className={inputCls} placeholder={away} value={stat.away_value} onChange={(e) => setStat({ ...stat, away_value: e.target.value })} /><button className={btnPrimary} onClick={async () => { if (!stat.label) return; await supabase.from("match_stats").insert({ ...stat, match_id: match.id, sort_order: statsQ.data?.length ?? 0 } as never); setStat({ label: "", home_value: "", away_value: "" }); qc.invalidateQueries({ queryKey: ["admin", "match-stats", match.id] }); }}><Plus className="h-4 w-4" /> Add stat</button></div></section>
    <section><h4 className="mb-3 font-bold">Win prediction</h4><div className="grid gap-3 sm:grid-cols-3"><Field label={home}><input type="number" className={inputCls} value={prediction.home_percent} onChange={(e) => setPrediction({ ...prediction, home_percent: Number(e.target.value) })} /></Field><Field label="Draw"><input type="number" className={inputCls} value={prediction.draw_percent} onChange={(e) => setPrediction({ ...prediction, draw_percent: Number(e.target.value) })} /></Field><Field label={away}><input type="number" className={inputCls} value={prediction.away_percent} onChange={(e) => setPrediction({ ...prediction, away_percent: Number(e.target.value) })} /></Field></div><button className={`${btnPrimary} mt-2`} onClick={async () => { if (prediction.home_percent + prediction.draw_percent + prediction.away_percent !== 100) return alert("Prediction must total 100%."); await supabase.from("match_predictions").upsert({ match_id: match.id, ...prediction } as never); qc.invalidateQueries({ queryKey: ["admin", "match-prediction", match.id] }); }}>Save prediction</button></section>
    <section><h4 className="mb-3 font-bold">Where to watch</h4><div className="flex flex-wrap gap-2">{channelsQ.data?.map((channel) => <button key={channel.id} onClick={async () => { if (selected.has(channel.id)) await supabase.from("match_broadcasts").delete().eq("match_id", match.id).eq("channel_id", channel.id); else await supabase.from("match_broadcasts").insert({ match_id: match.id, channel_id: channel.id } as never); qc.invalidateQueries({ queryKey: ["admin", "match-channels", match.id] }); }} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${selected.has(channel.id) ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{channel.logo_url && <img src={channel.logo_url} alt="" className="h-5 w-5 object-contain" />}{channel.name}</button>)}</div>{channelsQ.data?.length === 0 && <p className="text-xs text-muted-foreground">Create channels from the main Admin → Channels section first.</p>}</section>
    <section><h4 className="mb-3 font-bold">Videos and media</h4><MediaManager ownerType="match" ownerId={match.id} /></section>
  </div>;
}

/* ---------------- Main ---------------- */

function MainTab({ match, teams, onSaved }: { match: Match; teams: Team[]; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Match>>(match);
  useEffect(() => setForm(match), [match.id]);

  const save = async () => {
    await supabase.from("matches").update({
      home_team_id: form.home_team_id ?? null,
      away_team_id: form.away_team_id ?? null,
      kickoff_at: form.kickoff_at ?? null,
      round_number: form.round_number ?? null,
      round: form.round_number != null ? `Round ${form.round_number}` : null,
      venue: form.venue ?? null,
      city: form.city ?? null,
      referee: form.referee ?? null,
      highlight_url: form.highlight_url ?? null,
      notes: form.notes ?? null,
    }).eq("id", match.id);
    onSaved();
  };

  const local = form.kickoff_at ? new Date(new Date(form.kickoff_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

  return (
    <div>
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
          <input type="datetime-local" className={inputCls} value={local}
            onChange={(e) => setForm({ ...form, kickoff_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </Field>
        <Field label="Round number"><input type="number" min={1} inputMode="numeric" className={inputCls} placeholder="1" value={form.round_number ?? ""} onChange={(e) => setForm({ ...form, round_number: e.target.value ? Number(e.target.value) : null })} /></Field>
        <div className="sm:col-span-2">
          <Field label="Venue"><VenueSelect venue={form.venue} city={form.city} onChange={(v, c) => setForm({ ...form, venue: v, city: c })} /></Field>
        </div>
        <Field label="Referee"><input className={inputCls} value={form.referee ?? ""} onChange={(e) => setForm({ ...form, referee: e.target.value })} /></Field>
        <Field label="Highlights link"><input className={inputCls} placeholder="YouTube link" value={form.highlight_url ?? ""} onChange={(e) => setForm({ ...form, highlight_url: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Notes"><textarea rows={2} className={inputCls} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
      </div>
      <div className="mt-4 flex justify-end"><button className={btnPrimary} onClick={save}>Save details</button></div>
    </div>
  );
}

/* ---------------- Lineups ---------------- */

const FORMATIONS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2", "4-1-4-1", "4-5-1"];

/** Slot keys for a formation, goalkeeper first then each outfield line. */
function formationSlots(formation: string | null | undefined): string[] {
  const lines = (formation ?? "4-4-2").split("-").map((n) => Number(n)).filter((n) => n > 0);
  const slots = ["GK"];
  lines.forEach((count, li) => {
    for (let i = 0; i < count; i++) slots.push(`L${li + 1}-${i + 1}`);
  });
  return slots;
}

function formationRows(formation: string | null | undefined): string[][] {
  const slots = formationSlots(formation);
  const lines = (formation ?? "4-4-2").split("-").map((n) => Number(n)).filter((n) => n > 0);
  const rows: string[][] = [["GK"]];
  let idx = 1;
  for (const count of lines) {
    rows.push(slots.slice(idx, idx + count));
    idx += count;
  }
  return rows.reverse();
}

function LineupsTab({ match, teams, onSaved }: { match: Match; teams: Team[]; onSaved: () => void }) {
  const qc = useQueryClient();
  const teamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[];

  const playersQ = useQuery({
    enabled: teamIds.length > 0,
    queryKey: ["admin", "players-of-match", match.id, teamIds.join(",")],
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

  const players = playersQ.data ?? [];
  const lineups = lineupsQ.data ?? [];
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "";

  const setMode = async (mode: string) => {
    await supabase.from("matches").update({ lineup_mode: mode }).eq("id", match.id);
    onSaved();
  };
  const setFormation = async (side: "home" | "away", v: string) => {
    await supabase.from("matches").update(side === "home" ? { home_formation: v } : { away_formation: v }).eq("id", match.id);
    onSaved();
  };

  const toggle = async (playerId: string, teamId: string, starting: boolean) => {
    const existing = lineups.find((l) => l.player_id === playerId);
    if (existing) {
      if (existing.is_starting === starting) await supabase.from("match_lineups").delete().eq("id", existing.id);
      else await supabase.from("match_lineups").update({ is_starting: starting }).eq("id", existing.id);
    } else {
      await supabase.from("match_lineups").insert({ match_id: match.id, team_id: teamId, player_id: playerId, is_starting: starting } as never);
    }
    qc.invalidateQueries({ queryKey: ["admin", "lineups", match.id] });
  };

  const assignSlot = async (teamId: string, slot: string, playerId: string | null) => {
    const current = lineups.find((l) => l.team_id === teamId && l.position_code === slot);
    if (current) await supabase.from("match_lineups").delete().eq("id", current.id);
    if (playerId) {
      const dupe = lineups.find((l) => l.player_id === playerId);
      if (dupe) await supabase.from("match_lineups").delete().eq("id", dupe.id);
      const p = players.find((x) => x.id === playerId);
      await supabase.from("match_lineups").insert({
        match_id: match.id, team_id: teamId, player_id: playerId,
        is_starting: true, position_code: slot, shirt_number: p?.shirt_number ?? null,
      } as never);
    }
    qc.invalidateQueries({ queryKey: ["admin", "lineups", match.id] });
  };

  const publish = async (value: boolean) => {
    await supabase.from("matches").update({ lineups_published: value }).eq("id", match.id);
    onSaved();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Display as</span>
        {(["list", "formation"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${match.lineup_mode === m ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
            {m === "list" ? "Names & numbers" : "Formation pitch"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {teamIds.map((tid, i) => {
          const side = i === 0 ? "home" : "away";
          const formation = side === "home" ? match.home_formation : match.away_formation;
          const squad = players.filter((p) => p.team_id === tid);
          return (
            <div key={tid} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold">{teamName(tid)}</div>
                {match.lineup_mode === "formation" && (
                  <select className="rounded border border-border bg-background px-2 py-1 text-xs" value={formation ?? ""} onChange={(e) => setFormation(side as "home" | "away", e.target.value)}>
                    <option value="">Formation</option>
                    {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                )}
              </div>
              {match.lineup_mode === "formation" && formation ? (
                <div className="rounded-lg bg-emerald-900/25 p-2">
                  {formationRows(formation).map((row, ri) => (
                    <div key={ri} className="mb-2 flex justify-around gap-1">
                      {row.map((slot) => {
                        const assigned = lineups.find((l) => l.team_id === tid && l.position_code === slot);
                        const p = players.find((x) => x.id === assigned?.player_id);
                        return (
                          <select key={slot} value={assigned?.player_id ?? ""}
                            onChange={(e) => assignSlot(tid, slot, e.target.value || null)}
                            className="max-w-[6.5rem] flex-1 truncate rounded-md border border-emerald-400/40 bg-background/90 px-1 py-1 text-[0.6rem] font-semibold">
                            <option value="">{slot}</option>
                            {squad.map((s) => <option key={s.id} value={s.id}>{s.shirt_number ? `${s.shirt_number} ` : ""}{s.name}</option>)}
                          </select>
                        );
                      })}
                    </div>
                  ))}
                  <div className="mt-1 text-center text-[0.6rem] text-muted-foreground">{formation} · tap a slot to pick a player</div>
                  {squad.length === 0 && <div className="text-center text-[0.6rem] text-muted-foreground">Add players to this squad first.</div>}
                </div>
              ) : (
              <div className="grid gap-1">
                {squad.map((p) => {
                  const st = lineups.find((l) => l.player_id === p.id)?.is_starting;
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate">{p.shirt_number ? `#${p.shirt_number} ` : ""}{p.name}</span>
                      <button onClick={() => toggle(p.id, tid, true)} className={`rounded px-2 py-0.5 ${st === true ? "bg-primary text-primary-foreground" : "bg-muted"}`}>XI</button>
                      <button onClick={() => toggle(p.id, tid, false)} className={`rounded px-2 py-0.5 ${st === false ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Bench</button>
                    </div>
                  );
                })}
                {squad.length === 0 && <div className="text-[0.65rem] text-muted-foreground">Add players to this squad first.</div>}
              </div>
              )}
            </div>
          );
        })}
        {teamIds.length === 0 && <div className="text-xs text-muted-foreground">Pick both teams in Match details first.</div>}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/40 p-3">
        <span className="text-xs text-muted-foreground">
          {match.lineups_published ? "Lineups are live on the match page." : "Lineups stay hidden until you confirm them."}
        </span>
        {match.lineups_published
          ? <button className={btnGhost} onClick={() => publish(false)}>Unpublish</button>
          : <button className={btnPrimary} onClick={() => publish(true)}><Check className="h-3.5 w-3.5" /> Confirm lineups</button>}
      </div>
    </div>
  );
}

/* ---------------- Live ---------------- */

function LiveTab({ match, teams, onSaved }: { match: Match; teams: Team[]; onSaved: () => void }) {
  const qc = useQueryClient();
  const seconds = useLiveClock(match);
  const minute = Math.floor(seconds / 60) + (seconds % 60 > 0 ? 1 : 0);
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
    queryKey: ["admin", "players-of-match", match.id, teamIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("*").in("team_id", teamIds);
      return (data ?? []) as Player[];
    },
  });
  const players = playersQ.data ?? [];
  const teamName = (id: string | null | undefined) => teams.find((t) => t.id === id)?.name ?? "";
  const playerName = (id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "";

  const [composer, setComposer] = useState<{ type: string } | null>(null);
  const [editing, setEditing] = useState<MatchEvent | null>(null);

  const patchMatch = async (patch: Partial<Match>) => {
    await supabase.from("matches").update(patch as never).eq("id", match.id);
    onSaved();
  };

  const start = () => patchMatch({ timer_running: true, timer_started_at: new Date().toISOString(), status: match.status === "scheduled" ? "live" : match.status });
  const pause = () => patchMatch({ timer_running: false, timer_elapsed_seconds: matchClockSeconds(match), timer_started_at: null });
  const setMinute = (m: number) => patchMatch({ timer_elapsed_seconds: m * 60, timer_started_at: match.timer_running ? new Date().toISOString() : null, live_minute: m });

  const scores = useMemo(() => {
    let h = 0, a = 0;
    for (const e of eventsQ.data ?? []) {
      const scoring = e.type === "goal" || e.type === "penalty_goal";
      const own = e.type === "own_goal";
      if (!scoring && !own) continue;
      const forHome = own ? e.team_id !== match.home_team_id : e.team_id === match.home_team_id;
      if (forHome) h++; else a++;
    }
    return { h, a };
  }, [eventsQ.data, match.home_team_id]);

  // Score always mirrors the logged events — no manual sync.
  useEffect(() => {
    if (eventsQ.isLoading) return;
    if ((match.home_score ?? 0) === scores.h && (match.away_score ?? 0) === scores.a) return;
    supabase.from("matches").update({ home_score: scores.h, away_score: scores.a }).eq("id", match.id).then(onSaved);
  }, [scores.h, scores.a, eventsQ.isLoading, match.id, match.home_score, match.away_score]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        {/* Clock */}
        <div className="rounded-2xl border border-border bg-background/50 p-4 text-center">
          <div className="text-4xl font-black tabular-nums">{formatClock(seconds)}</div>
          <div className="mt-1 text-[0.65rem] uppercase tracking-widest text-muted-foreground">{minute}′ · {STATUS_LABELS[match.status] ?? match.status}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {match.timer_running
              ? <button className={btnGhost} onClick={pause}><Pause className="h-3.5 w-3.5" /> Stop clock</button>
              : <button className={btnPrimary} onClick={start}><Play className="h-3.5 w-3.5" /> {seconds > 0 ? "Resume" : "Start match"}</button>}
            <button className={btnGhost} onClick={() => patchMatch({ timer_running: false, timer_elapsed_seconds: 0, timer_started_at: null })}><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
            <input type="number" placeholder="Set minute" className="h-9 w-28 rounded-full border border-border bg-background px-3 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") setMinute(Number((e.target as HTMLInputElement).value || 0)); }} />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <select className="rounded-lg border border-border bg-background px-2 py-1 text-xs" value={match.status} onChange={(e) => patchMatch({ status: e.target.value })}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="text-sm font-bold tabular-nums">{match.home_score ?? 0} – {match.away_score ?? 0}</span>
          </div>
        </div>

        {/* Quick event buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <button key={t.v} className={btnGhost} onClick={() => setComposer({ type: t.v })}>{t.l}</button>
          ))}
        </div>

        {composer && (
          <EventForm
            title={EVENT_TYPES.find((t) => t.v === composer.type)?.l ?? "Event"}
            initial={{ type: composer.type, minute }}
            teamIds={teamIds}
            teams={teams}
            players={players}
            onCancel={() => setComposer(null)}
            onSubmit={async (ev) => {
              await supabase.from("match_events").insert({ ...ev, match_id: match.id } as never);
              setComposer(null);
              qc.invalidateQueries({ queryKey: ["admin", "events", match.id] });
            }}
          />
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold">Match events</h4>
        <div className="grid gap-1">
          {(eventsQ.data ?? []).map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-2 text-xs">
              <span className="w-10 font-mono text-muted-foreground">{e.minute ?? "?"}{e.extra ? `+${e.extra}` : ""}′</span>
              <span className="w-28 shrink-0 text-[0.65rem] font-semibold uppercase tracking-widest">{(EVENT_TYPES.find((t) => t.v === e.type)?.l ?? e.type)}</span>
              <span className="flex-1 truncate">{playerName(e.player_id)}{e.assist_player_id ? ` (assist ${playerName(e.assist_player_id)})` : ""} {e.description ? `— ${e.description}` : ""}</span>
              <span className="shrink-0 text-[0.6rem] text-muted-foreground">{teamName(e.team_id)}</span>
              <button onClick={() => setEditing(e)} className="text-primary">Edit</button>
              <button onClick={async () => { await supabase.from("match_events").delete().eq("id", e.id); qc.invalidateQueries({ queryKey: ["admin", "events", match.id] }); }} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          {eventsQ.data && eventsQ.data.length === 0 && <div className="rounded border border-dashed border-border p-3 text-center text-[0.65rem] text-muted-foreground">No events yet.</div>}
        </div>

        {editing && (
          <div className="mt-3">
            <EventForm
              title="Edit event"
              initial={editing}
              teamIds={teamIds}
              teams={teams}
              players={players}
              onCancel={() => setEditing(null)}
              onSubmit={async (ev) => {
                await supabase.from("match_events").update(ev as never).eq("id", editing.id);
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["admin", "events", match.id] });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function EventForm({
  title, initial, teamIds, teams, players, onSubmit, onCancel,
}: {
  title: string;
  initial: Partial<MatchEvent>;
  teamIds: string[];
  teams: Team[];
  players: Player[];
  onSubmit: (ev: Partial<MatchEvent>) => Promise<void>;
  onCancel: () => void;
}) {
  const [ev, setEv] = useState<Partial<MatchEvent>>(initial);
  const isGoal = ev.type === "goal" || ev.type === "penalty_goal" || ev.type === "own_goal";
  const isSub = ev.type === "substitution";
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "";
  const pool = players.filter((p) => !ev.team_id || p.team_id === ev.team_id);

  return (
    <div className="mt-4 grid gap-2 rounded-xl border border-primary/40 bg-background/60 p-3">
      <div className="text-xs font-bold">{title}</div>
      {isGoal && (
        <div className="flex gap-2">
          {GOAL_KINDS.map((g) => (
            <button key={g.v} type="button" onClick={() => setEv({ ...ev, type: g.v })}
              className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold ${ev.type === g.v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{g.l}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Minute" className={inputCls} value={ev.minute ?? ""} onChange={(e) => setEv({ ...ev, minute: e.target.value ? Number(e.target.value) : null })} />
        <input type="number" placeholder="Added time (+)" className={inputCls} value={ev.extra ?? ""} onChange={(e) => setEv({ ...ev, extra: e.target.value ? Number(e.target.value) : null })} />
        <select className={inputCls} value={ev.team_id ?? ""} onChange={(e) => setEv({ ...ev, team_id: e.target.value || null, player_id: null })}>
          <option value="">Team</option>
          {teamIds.map((id) => <option key={id} value={id}>{teamName(id)}</option>)}
        </select>
        <select className={inputCls} value={ev.player_id ?? ""} onChange={(e) => setEv({ ...ev, player_id: e.target.value || null })}>
          <option value="">{isSub ? "Player coming on" : "Player"}</option>
          {pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {ev.type === "goal" && (
          <select className={inputCls} value={ev.assist_player_id ?? ""} onChange={(e) => setEv({ ...ev, assist_player_id: e.target.value || null })}>
            <option value="">Assist (optional)</option>
            {pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {isSub && (
          <select className={inputCls} value={ev.sub_out_player_id ?? ""} onChange={(e) => setEv({ ...ev, sub_out_player_id: e.target.value || null })}>
            <option value="">Player going off</option>
            {pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      <input className={inputCls} placeholder="Description (optional)" value={ev.description ?? ""} onChange={(e) => setEv({ ...ev, description: e.target.value })} />
      <div className="flex justify-end gap-2">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button className={btnPrimary} onClick={() => onSubmit(ev)}><Plus className="h-3.5 w-3.5" /> Save event</button>
      </div>
    </div>
  );
}

export { btnDanger };