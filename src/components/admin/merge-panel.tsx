import { useState } from "react";
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
      const { data, error } = await supabase.rpc("merge_suggestions", { _kind: kind, _limit: 20 });
      if (error) throw error;
      return data ?? [];
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
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background p-2">
      <div className="mb-1 flex items-center gap-2">
        {q.data?.img ? <img src={q.data.img} alt="" className="h-9 w-9 shrink-0 rounded-full bg-muted object-cover" /> : <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />}
        <b className="min-w-0 break-words text-sm leading-tight">{name}</b>
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {(q.data?.lines ?? []).filter(Boolean).map((l, i) => <div key={i} className="break-words">{String(l)}</div>)}
      </div>
      <a href={href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-primary">Open profile</a>
    </div>
  );
}
function SuggestionCard({ kind, s, onApprove }: { kind: Kind; s: Sug; onApprove: (keepId: string, keepName: string, dropId: string, dropName: string) => void }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-2.5 text-sm">
      <div className="mb-2 text-xs text-muted-foreground">{Math.round(s.score * 100)}% similar</div>
      <div className="grid grid-cols-2 gap-2">
        <Profile kind={kind} id={s.a_id} name={s.a_name} />
        <Profile kind={kind} id={s.b_id} name={s.b_name} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={() => onApprove(s.a_id, s.a_name, s.b_id, s.b_name)}>Keep left</button>
        <button className={btnPrimary} onClick={() => onApprove(s.b_id, s.b_name, s.a_id, s.a_name)}>Keep right</button>
        <button className={btnGhost} onClick={() => setHidden(true)}>Not the same</button>
      </div>
    </div>
  );
}
