import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { inputCls, btnPrimary, btnGhost } from "./ui";
import { GitMerge, Sparkles, ArrowRight, X } from "lucide-react";

type Kind = "player" | "team";
type Pick = { id: string; name: string; sub?: string | null };

function RecordSearch({ kind, value, onPick, label }: { kind: Kind; value: Pick | null; onPick: (p: Pick | null) => void; label: string }) {
  const [term, setTerm] = useState("");
  const q = useQuery({
    queryKey: ["merge-search", kind, term], enabled: term.trim().length > 1,
    queryFn: async () => {
      const t = `%${term.trim()}%`;
      if (kind === "player") {
        const { data } = await supabase.from("players").select("id,name,team:team_id(name)").or(`name.ilike.${t},name_ar.ilike.${t}`).limit(15);
        return (data ?? []).map((p) => ({ id: p.id, name: p.name, sub: (p.team as { name: string } | null)?.name ?? "Free agent" }));
      }
      const { data } = await supabase.from("teams").select("id,name,country").or(`name.ilike.${t},name_ar.ilike.${t}`).limit(15);
      return (data ?? []).map((x) => ({ id: x.id, name: x.name, sub: x.country }));
    },
  });
  return (
    <div className="flex-1 rounded-xl border border-border bg-card p-3">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">{label}</div>
      {value ? (
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="min-w-0 flex-1 break-words">{value.name}{value.sub ? <span className="font-normal text-muted-foreground"> · {value.sub}</span> : null}</span>
          <button onClick={() => onPick(null)} aria-label="Clear"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <>
          <input className={inputCls} placeholder="Search…" value={term} onChange={(e) => setTerm(e.target.value)} />
          <div className="mt-1 max-h-48 overflow-y-auto">
            {(q.data ?? []).map((r) => (
              <button key={r.id} className="block w-full break-words rounded-lg px-2 py-1.5 text-start text-sm hover:bg-accent" onClick={() => { onPick(r); setTerm(""); }}>
                {r.name} <span className="text-xs text-muted-foreground">· {r.sub ?? ""}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Owner-only: combine duplicate players or teams, with automatically detected duplicate suggestions. */
export function MergePanel() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("player");
  const [keep, setKeep] = useState<Pick | null>(null);
  const [drop, setDrop] = useState<Pick | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const suggestions = useQuery({
    queryKey: ["merge-suggestions", kind],
    queryFn: async () => {
      const [{ data, error }, dismissed] = await Promise.all([
        supabase.rpc("merge_suggestions", { _kind: kind, _limit: 80 }),
        supabase.from("merge_dismissals").select("a_id,b_id").eq("kind", kind),
      ]);
      if (error) throw error;
      // Pairs marked "Not the same" never come back.
      const skip = new Set((dismissed.data ?? []).map((d) => `${d.a_id}|${d.b_id}`));
      return (data ?? []).filter((s) => !skip.has(pairKey(s.a_id, s.b_id))).slice(0, 20);
    },
  });
  const switchKind = (k: Kind) => { setKind(k); setKeep(null); setDrop(null); setMsg(null); };
  const merge = async () => {
    if (!keep || !drop) return;
    if (!window.confirm(`Merge "${drop.name}" into "${keep.name}"? Everything linked to "${drop.name}" moves to "${keep.name}". It can be restored from the Recycle bin.`)) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("merge_records", { _kind: kind, _keep: keep.id, _drop: drop.id });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(`Merged "${drop.name}" into "${keep.name}".`);
    setKeep(null); setDrop(null);
    void qc.invalidateQueries();
  };
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><GitMerge className="h-5 w-5" /></div>
        <div><h2 className="text-lg font-bold">Merge duplicates</h2><p className="text-xs text-muted-foreground">Combine two players or teams into one. Matches, squads, stats and followers move to the one you keep.</p></div>
      </div>
      <div className="mb-4 flex gap-2">
        <button className={kind === "player" ? btnPrimary : btnGhost} onClick={() => switchKind("player")}>Players</button>
        <button className={kind === "team" ? btnPrimary : btnGhost} onClick={() => switchKind("team")}>Teams</button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <RecordSearch kind={kind} value={drop} onPick={setDrop} label="Duplicate (will be removed)" />
        <ArrowRight className="mx-auto h-5 w-5 shrink-0 text-muted-foreground max-sm:rotate-90" />
        <RecordSearch kind={kind} value={keep} onPick={setKeep} label="Keep this one" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={btnPrimary} disabled={!keep || !drop || busy} onClick={merge}><GitMerge className="h-3.5 w-3.5" /> {busy ? "Merging…" : "Merge"}</button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>

      <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-primary" /> Suggested merges</div>
        {suggestions.isLoading && <p className="text-xs text-muted-foreground">Looking for similar names…</p>}
        {suggestions.error && <p className="text-xs text-destructive">{(suggestions.error as Error).message}</p>}
        {suggestions.data?.length === 0 && <p className="text-xs text-muted-foreground">No likely duplicates found.</p>}
        <div className="grid gap-2">
          {(suggestions.data ?? []).map((s) => (
            <SuggestionCard key={`${s.a_id}-${s.b_id}`} kind={kind} s={s} onApprove={(keepId, keepName, dropId, dropName) => { setKeep({ id: keepId, name: keepName }); setDrop({ id: dropId, name: dropName }); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

type Sug = { a_id: string; a_name: string; b_id: string; b_name: string; score: number };
function Profile({ kind, id, name }: { kind: Kind; id: string; name: string }) {
  const q = useQuery({
    queryKey: ["merge-profile", kind, id],
    queryFn: async () => {
      if (kind === "player") {
        const { data } = await supabase.from("players").select("name,name_ar,position,nationality,dob,shirt_number,photo_url,team:team_id(name)").eq("id", id).maybeSingle();
        const d = data as Record<string, unknown> | null;
        return d ? { img: d.photo_url as string | null, lines: [d.name_ar, (d.team as { name: string } | null)?.name ?? "Free agent", d.position, d.nationality, d.dob, d.shirt_number != null ? `No. ${d.shirt_number}` : null] } : null;
      }
      const { data } = await supabase.from("teams").select("name,name_ar,short_name,country,logo_url").eq("id", id).maybeSingle();
      const d = data as Record<string, unknown> | null;
      return d ? { img: d.logo_url as string | null, lines: [d.name_ar, d.short_name, d.country] } : null;
    },
  });
  const href = kind === "player" ? `/players/${id}` : `/teams/${id}`;
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background p-2">
      <div className="mb-1 flex items-center gap-2">
        {q.data?.img ? <img src={q.data.img} alt="" className="h-9 w-9 shrink-0 rounded-full bg-muted object-cover" /> : <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />}
        <b className="min-w-0 break-words text-sm leading-tight">{name}</b>
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {(q.data?.lines ?? []).filter(Boolean).map((l, i) => <div key={i} className="break-words">{String(l)}</div>)}
      </div>
      <button type="button" onClick={() => setOpen(true)} className="mt-1 inline-block text-xs font-semibold text-primary">Open profile</button>
      {open && createPortal(
        <div className="fixed inset-0 z-[200] flex flex-col bg-background">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 pb-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <b className="min-w-0 truncate text-sm">{name}</b>
            <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted" aria-label="Close profile"><X className="h-5 w-5" /></button>
          </div>
          <iframe src={href} title={name} className="min-h-0 w-full flex-1 border-0" />
        </div>,
        document.body,
      )}
    </div>
  );
}
function SuggestionCard({ kind, s, onApprove }: { kind: Kind; s: Sug; onApprove: (keepId: string, keepName: string, dropId: string, dropName: string) => void }) {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (hidden) return null;
  const label = kind === "player" ? "Merge players" : "Merge teams";
  const doMerge = async (keepId: string, keepName: string, dropId: string, dropName: string) => {
    if (!window.confirm(`Merge "${dropName}" into "${keepName}"? It can be restored from the Recycle bin.`)) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("merge_records", { _kind: kind, _keep: keepId, _drop: dropId });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setHidden(true);
    void qc.invalidateQueries();
  };
  void onApprove;
  return (
    <div className="rounded-xl border border-border bg-card p-2.5 text-sm">
      <div className="mb-2 text-xs text-muted-foreground">{Math.round(s.score * 100)}% similar</div>
      <div className="grid grid-cols-2 gap-2">
        <Profile kind={kind} id={s.a_id} name={s.a_name} />
        <Profile kind={kind} id={s.b_id} name={s.b_name} />
      </div>
      {choosing ? (
        <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
          <p className="mb-2 text-xs font-semibold">{kind === "player" ? "Which photo should be kept for his face?" : "Which logo should be kept?"}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={btnPrimary} disabled={busy} onClick={() => doMerge(s.a_id, s.a_name, s.b_id, s.b_name)}>Keep left photo</button>
            <button className={btnPrimary} disabled={busy} onClick={() => doMerge(s.b_id, s.b_name, s.a_id, s.a_name)}>Keep right photo</button>
          </div>
          <button className={`${btnGhost} mt-2`} disabled={busy} onClick={() => setChoosing(false)}>Cancel</button>
          {busy && <p className="mt-1 text-xs text-muted-foreground">Merging…</p>}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={btnPrimary} onClick={() => setChoosing(true)}><GitMerge className="h-3.5 w-3.5" /> {label}</button>
          <button className={btnGhost} disabled={busy} onClick={async () => {
            setHidden(true);
            const [a_id, b_id] = s.a_id < s.b_id ? [s.a_id, s.b_id] : [s.b_id, s.a_id];
            const { error } = await supabase.from("merge_dismissals").upsert({ kind, a_id, b_id }, { onConflict: "kind,a_id,b_id", ignoreDuplicates: true });
            if (error) { setHidden(false); setErr("Could not save. Try again."); return; }
            void qc.invalidateQueries({ queryKey: ["merge-suggestions", kind] });
          }}>Not the same</button>
        </div>
      )}
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  );
}
