import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, ordinal, type Team, type StandingRow, type StandingLabel } from "@/lib/db";
import { inputCls, btnPrimary, btnGhost, Modal, Field } from "./ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Tag, BarChart3, ArrowUpDown, RefreshCw, MoreVertical, ChevronUp, ChevronDown, Layers } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type PositionLabel = Database["public"]["Tables"]["standings_position_labels"]["Row"];

const SINGLE = "__single__";

export function StandingsPanel({ competitionId, season = null }: { competitionId: string; season?: string | null }) {
  const qc = useQueryClient();
  const [labelTarget, setLabelTarget] = useState<{ group: string | null; position: number } | null>(null);

  const teamsQ = useQuery({
    queryKey: ["admin", "teams", competitionId, season],
    queryFn: async () => {
      let linkQuery = supabase.from("competition_teams").select("team_id").eq("competition_id", competitionId);
      if (season) linkQuery = linkQuery.eq("season", season);
      const { data: links } = await linkQuery;
      const ids = (links ?? []).map((link) => link.team_id);
      const { data } = ids.length ? await supabase.from("teams").select("*").in("id", ids).order("name") : { data: [] };
      return (data ?? []) as Team[];
    },
  });

  const rowsQ = useQuery({
    queryKey: ["admin", "standings", competitionId, season],
    queryFn: async () => {
      let query = supabase.from("standings_rows").select("*").eq("competition_id", competitionId);
      if (season) query = query.eq("season", season);
      const { data } = await query.order("sort_order");
      return (data ?? []) as StandingRow[];
    },
  });

  const labelsQ = useQuery({
    queryKey: ["admin", "position-labels", competitionId, season],
    queryFn: async () => {
      let query = supabase.from("standings_position_labels").select("*").eq("competition_id", competitionId);
      if (season) query = query.eq("season", season);
      const { data } = await query;
      return (data ?? []) as PositionLabel[];
    },
  });

  const libraryQ = useQuery({
    queryKey: ["admin", "label-library"],
    queryFn: async () => {
      const { data } = await supabase.from("standing_labels").select("*").order("label");
      return (data ?? []) as StandingLabel[];
    },
  });

  const teams = teamsQ.data ?? [];
  const rows = rowsQ.data ?? [];
  const posLabels = labelsQ.data ?? [];
  const synced = useRef(false);

  // Auto-add every competition team to the table — no manual syncing.
  useEffect(() => {
    if (synced.current || teamsQ.isLoading || rowsQ.isLoading) return;
    const missing = teams.filter((t) => !rows.some((r) => r.team_id === t.id));
    if (missing.length === 0) return;
    synced.current = true;
    (async () => {
      await supabase.from("standings_rows").insert(
        missing.map((t, i) => ({ competition_id: competitionId, team_id: t.id, sort_order: rows.length + i, season })) as never,
      );
      qc.invalidateQueries({ queryKey: ["admin", "standings", competitionId, season] });
      synced.current = false;
    })();
  }, [teams, rows, teamsQ.isLoading, rowsQ.isLoading, competitionId, season, qc]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.group_label ?? SINGLE);
    if (set.size === 0) set.add(SINGLE);
    return [...set].sort((a, b) => (a === SINGLE ? -1 : b === SINGLE ? 1 : a.localeCompare(b)));
  }, [rows]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "standings", competitionId, season] });
    qc.invalidateQueries({ queryKey: ["admin", "position-labels", competitionId, season] });
  };

  const reorder = async (group: string, fromId: string, toId: string) => {
    const list = rows.filter((r) => (r.group_label ?? SINGLE) === group);
    const from = list.findIndex((r) => r.id === fromId);
    const to = list.findIndex((r) => r.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    qc.setQueryData<StandingRow[]>(["admin", "standings", competitionId, season], (old) =>
      (old ?? []).map((r) => {
        const idx = next.findIndex((n) => n.id === r.id);
        return idx >= 0 ? { ...r, sort_order: idx } : r;
      }),
    );
    await Promise.all(next.map((r, i) => supabase.from("standings_rows").update({ sort_order: i }).eq("id", r.id)));
    invalidate();
  };

  /** Asked for in the app itself — a browser pop-up is blocked inside the app frame. */
  const [groupName, setGroupName] = useState<string | null>(null);
  const [groupBusy, setGroupBusy] = useState(false);

  const addGroup = async (name: string) => {
    const label = name.trim();
    if (!label) return;
    setGroupBusy(true);
    // The first group takes over the un-grouped table; later groups start empty and teams are moved into them.
    if (groups.length === 1 && groups[0] === SINGLE && rows.length > 0) {
      let update = supabase.from("standings_rows").update({ group_label: label }).eq("competition_id", competitionId).is("group_label", null);
      if (season) update = update.eq("season", season);
      await update;
    }
    setPendingGroups((g) => (g.includes(label) ? g : [...g, label]));
    setGroupBusy(false);
    setGroupName(null);
    invalidate();
  };

  const [pendingGroups, setPendingGroups] = useState<string[]>([]);
  const allGroups = useMemo(() => {
    const hasUngrouped = rows.some((r) => !r.group_label);
    const set = new Set(groups.filter((g) => g !== SINGLE || hasUngrouped || (pendingGroups.length === 0 && rows.length === 0)));
    for (const g of pendingGroups) set.add(g);
    return [...set].sort((a, b) => (a === SINGLE ? -1 : b === SINGLE ? 1 : a.localeCompare(b)));
  }, [groups, pendingGroups, rows]);

  const toSingleTable = async () => {
    let update = supabase.from("standings_rows").update({ group_label: null }).eq("competition_id", competitionId);
    if (season) update = update.eq("season", season);
    await update;
    setPendingGroups([]);
    invalidate();
  };

  const setRowGroup = async (rowId: string, group: string | null) => {
    await supabase.from("standings_rows").update({ group_label: group }).eq("id", rowId);
    invalidate();
  };

  const setAdjust = async (rowId: string, value: number) => {
    await supabase.from("standings_rows").update({ points_adjust: value }).eq("id", rowId);
    invalidate();
  };

  const removeRow = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    await supabase.from("standings_rows").delete().eq("id", id);
    if (row) {
      let unlink = supabase.from("competition_teams").delete().eq("competition_id", competitionId).eq("team_id", row.team_id);
      if (season) unlink = unlink.eq("season", season);
      await unlink;
      qc.invalidateQueries({ queryKey: ["admin", "teams", competitionId, season] });
    }
    invalidate();
  };

  const [addTo, setAddTo] = useState<string | null>(null);

  const labelFor = (group: string, position: number) =>
    posLabels.find((l) => (l.group_label ?? SINGLE) === group && l.position === position) ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">Standings</h3>
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} onClick={() => setGroupName("")}><Plus className="h-3.5 w-3.5" /> Add group</button>
          {allGroups.some((g) => g !== SINGLE) && <button className={btnGhost} onClick={toSingleTable}>Single table</button>}
        </div>
      </div>

      {allGroups.map((group) => {
        const list = rows.filter((r) => (r.group_label ?? SINGLE) === group);
        return (
          <GroupTable
            key={group}
            title={group === SINGLE ? "Table" : group}
            rows={list}
            teams={teams}
            groups={allGroups}
            groupKey={group}
            labelFor={(pos) => labelFor(group, pos)}
            onLabelClick={(pos) => setLabelTarget({ group: group === SINGLE ? null : group, position: pos })}
            onReorder={(fromId, toId) => reorder(group, fromId, toId)}
            onGroupChange={setRowGroup}
            onAdjust={setAdjust}
            onRemove={removeRow}
            onAdd={group === SINGLE ? undefined : () => setAddTo(group)}
            onRecalc={async () => { await supabase.rpc("recompute_standings", { _comp: competitionId }); invalidate(); }}
          />
        );
      })}

      {rows.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
          Add teams to this competition and they appear here automatically.
        </div>
      )}

      <p className="text-[0.65rem] text-muted-foreground">
        P/W/D/L/GF/GA/Pts are computed from finished matches. Use Manage to edit points, labels, order or remove a team. Labels stay attached to the
        position (1st place, 2nd place…), not to the team.
      </p>

      <Modal open={groupName !== null} onClose={() => setGroupName(null)} title="Add a group">
        <Field label="Group name">
          <input
            autoFocus
            className={inputCls}
            placeholder="Group A"
            value={groupName ?? ""}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && groupName?.trim()) addGroup(groupName); }}
          />
        </Field>
        <p className="mt-2 text-[0.65rem] text-muted-foreground">The first group takes the teams already in the table. Later groups start empty — use “Add teams” inside the group to move clubs across.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setGroupName(null)}>Cancel</button>
          <button className={btnPrimary} disabled={groupBusy || !groupName?.trim()} onClick={() => addGroup(groupName ?? "")}>{groupBusy ? "Adding…" : "Add group"}</button>
        </div>
      </Modal>


      {addTo && (
        <GroupTeamsModal
          group={addTo}
          rows={rows}
          teams={teams}
          onClose={() => setAddTo(null)}
          onSave={async (ids) => {
            await Promise.all(ids.map((id) => supabase.from("standings_rows").update({ group_label: addTo }).eq("id", id)));
            setAddTo(null);
            invalidate();
          }}
        />
      )}

      <LabelModal
        open={!!labelTarget}
        onClose={() => setLabelTarget(null)}
        competitionId={competitionId}
        season={season}
        target={labelTarget}
        library={libraryQ.data ?? []}
        existing={labelTarget ? labelFor(labelTarget.group ?? SINGLE, labelTarget.position) : null}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin", "position-labels", competitionId, season] });
          qc.invalidateQueries({ queryKey: ["admin", "label-library"] });
          setLabelTarget(null);
        }}
      />
    </div>
  );
}

type Mode = "view" | "points" | "label" | "reorder" | "remove" | "group";

function GroupTable({
  title, rows, teams, groups, groupKey, labelFor, onLabelClick, onReorder, onGroupChange, onAdjust, onRemove, onAdd, onRecalc,
}: {
  title: string;
  rows: StandingRow[];
  teams: Team[];
  groups: string[];
  groupKey: string;
  labelFor: (position: number) => PositionLabel | null;
  onLabelClick: (position: number) => void;
  onReorder: (fromId: string, toId: string) => void;
  onGroupChange: (rowId: string, group: string | null) => void;
  onAdjust: (rowId: string, value: number) => void;
  onRemove: (rowId: string) => void;
  onAdd?: () => void;
  onRecalc: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const items: { m: Mode | "recalc"; l: string; Icon: typeof BarChart3 }[] = [
    { m: "points", l: "Edit points", Icon: BarChart3 },
    { m: "label", l: "Label", Icon: Tag },
    { m: "reorder", l: "Reorder teams", Icon: ArrowUpDown },
    ...(groups.length > 1 ? [{ m: "group" as const, l: "Move to group", Icon: Layers }] : []),
    { m: "remove", l: "Remove team", Icon: Trash2 },
    { m: "recalc", l: "Recalculate standings", Icon: RefreshCw },
  ];
  const move = (i: number, d: number) => { const t = rows[i + d]; if (t) onReorder(rows[i].id, t.id); };

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="relative mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0 break-words text-sm font-bold">{title}</div>
        <div className="flex shrink-0 items-center gap-2">
          {onAdd && <button type="button" onClick={onAdd} className={btnGhost}><Plus className="h-3.5 w-3.5" /> Add teams</button>}
          {mode !== "view"
            ? <button type="button" onClick={() => setMode("view")} className={btnPrimary}>Done</button>
            : <button type="button" onClick={() => setMenu((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-muted px-3 text-xs font-semibold">{busy ? "Working…" : "Manage"} <MoreVertical className="h-4 w-4" /></button>}
        </div>
        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-2xl border border-border bg-popover py-1 shadow-xl">
              {items.map(({ m, l, Icon }) => (
                <button key={m} type="button" onClick={async () => {
                  setMenu(false);
                  if (m === "recalc") { setBusy(true); try { await onRecalc(); } finally { setBusy(false); } }
                  else setMode(m);
                }} className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent ${m === "remove" ? "text-destructive" : ""}`}>
                  <Icon className="h-4 w-4 shrink-0" /> {l}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {mode !== "view" && <p className="mb-2 text-[0.65rem] text-muted-foreground">{{ points: "Type a bonus or deduction for each team.", label: "Tap a position number to set its label.", reorder: "Use the arrows to move teams.", remove: "Tap the bin to remove a team from this table.", group: "Pick a group for each team." }[mode]}</p>}
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 px-1 pb-1 text-[0.65rem] text-muted-foreground">
        <span>#</span><span>Teams</span>
        <span className="flex gap-3 tabular-nums"><span className="w-6 text-center">P</span><span className="w-8 text-center">DIFF</span><span className="w-7 text-center">PTS</span></span>
      </div>
      {rows.map((r, i) => {
        const team = teams.find((t) => t.id === r.team_id);
        const lbl = labelFor(i + 1);
        const diff = r.gf - r.ga;
        return (
          <div key={r.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 border-t border-border/50 px-1 py-2 text-sm">
            <button type="button" disabled={mode !== "label"} onClick={() => onLabelClick(i + 1)}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${mode === "label" ? "ring-2 ring-primary/40" : ""}`}
              style={lbl ? { background: lbl.color, color: "white" } : undefined}>{i + 1}</button>
            <div className="flex min-w-0 items-center gap-2">
              {team?.logo_url && <img src={team.logo_url} alt="" className="h-6 w-6 shrink-0 object-contain" />}
              <span className="min-w-0 truncate">{team?.name ?? "?"}</span>
            </div>
            {mode === "points" ? (
              <div className="flex items-center gap-2">
                <input type="number" defaultValue={r.points_adjust} onBlur={(e) => onAdjust(r.id, Number(e.target.value) || 0)}
                  className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-center text-base" />
                <span className="w-7 text-center font-bold tabular-nums">{r.points + r.points_adjust}</span>
              </div>
            ) : mode === "reorder" ? (
              <div className="flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              </div>
            ) : mode === "remove" ? (
              <button type="button" onClick={() => { if (confirm(`Remove ${team?.name ?? "this team"} from the standings?`)) onRemove(r.id); }}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
            ) : mode === "group" ? (
              <select value={groupKey} onChange={(e) => onGroupChange(r.id, e.target.value === SINGLE ? null : e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-base">
                {groups.map((g) => <option key={g} value={g}>{g === SINGLE ? "No group" : g}</option>)}
              </select>
            ) : (
              <span className="flex gap-3 tabular-nums"><span className="w-6 text-center">{r.played}</span><span className="w-8 text-center">{diff > 0 ? `+${diff}` : diff}</span><span className="w-7 text-center font-bold">{r.points + r.points_adjust}</span></span>
            )}
          </div>
        );
      })}
      {rows.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No teams in this table yet.</div>}
    </div>
  );
}

function LabelModal({
  open, onClose, competitionId, season, target, library, existing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  competitionId: string;
  season: string | null;
  target: { group: string | null; position: number } | null;
  library: StandingLabel[];
  existing: PositionLabel | null;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLabel(existing?.label ?? "");
    setColor(existing?.color ?? "#2563eb");
  }, [existing, open]);

  if (!open || !target) return null;

  const apply = async (text: string, hex: string, store: boolean) => {
    setBusy(true);
    try {
      if (existing) {
        await supabase.from("standings_position_labels").update({ label: text, color: hex }).eq("id", existing.id);
      } else {
        await supabase.from("standings_position_labels").insert({
          competition_id: competitionId, season, group_label: target.group, position: target.position, label: text, color: hex,
        } as never);
      }
      if (store && !library.some((l) => l.label.toLowerCase() === text.toLowerCase())) {
        await supabase.from("standing_labels").insert({ competition_id: competitionId, label: text, color: hex } as never);
      }
      onSaved();
    } finally { setBusy(false); }
  };

  const clear = async () => {
    if (!existing) return onClose();
    setBusy(true);
    try {
      await supabase.from("standings_position_labels").delete().eq("id", existing.id);
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${ordinal(target.position)} place — qualification label`}>
      <div className="space-y-5">
        {library.length > 0 && (
          <div>
            <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Use an existing label</div>
            <div className="flex flex-wrap gap-2">
              {library.map((l) => (
                <button key={l.id} disabled={busy} onClick={() => apply(l.label, l.color, false)}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <div className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">New label</div>
          <Field label="Label">
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="AFC Champions League Two" />
          </Field>
          <Field label="Label color">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
              className="h-9 w-16 rounded border border-border bg-background" />
          </Field>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} />
            Save this label for future use
          </label>
          <div className="flex items-center gap-2">
            <button disabled={busy || !label.trim()} className={btnPrimary} onClick={() => apply(label.trim(), color, saveToLibrary)}>Save label</button>
            {existing && <button disabled={busy} className={btnGhost} onClick={clear}>Remove label</button>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Move competition teams into a group — groups start empty, so teams are assigned here. */
function GroupTeamsModal({ group, rows, teams, onClose, onSave }: {
  group: string;
  rows: StandingRow[];
  teams: Team[];
  onClose: () => void;
  onSave: (rowIds: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const available = rows.filter((r) => r.group_label !== group);
  const term = q.trim().toLowerCase();
  const list = available.filter((r) => {
    const name = teams.find((t) => t.id === r.team_id)?.name ?? "";
    return !term || name.toLowerCase().includes(term);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-4 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold">Add teams to {group}</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams"
          className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <div className="mt-3 space-y-1">
          {list.map((r) => {
            const team = teams.find((t) => t.id === r.team_id);
            const on = picked.includes(r.id);
            return (
              <button key={r.id} type="button"
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== r.id) : [...p, r.id]))}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold ${on ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                {team?.logo_url && <img src={team.logo_url} alt="" className="h-5 w-5 object-contain" />}
                <span className="min-w-0 flex-1 truncate">{team?.name ?? "Team"}</span>
                <span className="text-[0.65rem] text-muted-foreground">{r.group_label ?? "No group"}</span>
              </button>
            );
          })}
          {list.length === 0 && <p className="text-xs text-muted-foreground">Every team is already in this group.</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="button" disabled={picked.length === 0} onClick={() => onSave(picked)}
            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50">
            Add {picked.length || ""}
          </button>
        </div>
      </div>
    </div>
  );
}
