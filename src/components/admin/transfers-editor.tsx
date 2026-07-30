import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Transfer } from "@/lib/db";
import { inputCls, btnPrimary } from "./ui";
import { Plus, Trash2 } from "lucide-react";

const TYPES = ["Transfer", "Loan", "Loan return", "Free agent", "Youth promotion", "Retired", "Appointed", "Left"];

export function TransfersEditor({ personType, personId }: { personType: "player" | "coach"; personId: string }) {
  const qc = useQueryClient();
  const key = ["admin", "transfers", personType, personId];
  const [draft, setDraft] = useState<Partial<Transfer>>({ transfer_type: "Transfer" });

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("transfers").select("*").eq("person_type", personType).eq("person_id", personId).order("moved_on", { ascending: false, nullsFirst: false });
      return (data ?? []) as Transfer[];
    },
  });

  const add = async () => {
    if (!draft.from_club && !draft.to_club) return;
    await supabase.from("transfers").insert({ ...draft, person_type: personType, person_id: personId } as never);
    setDraft({ transfer_type: "Transfer" });
    qc.invalidateQueries({ queryKey: key });
  };
  const remove = async (id: string) => {
    await supabase.from("transfers").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div>
      <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Transfer history</div>
      <div className="grid gap-1">
        {(q.data ?? []).map((tr) => (
          <div key={tr.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-2 text-xs">
            <span className="w-24 shrink-0 text-muted-foreground">{tr.moved_on ?? "—"}</span>
            <span className="flex-1 truncate">{tr.from_club ?? "—"} → {tr.to_club ?? "—"}</span>
            <span className="shrink-0 text-muted-foreground">{[tr.transfer_type, tr.fee].filter(Boolean).join(" · ")}</span>
            <button onClick={() => remove(tr.id)} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded border border-dashed border-border p-2 text-center text-[0.65rem] text-muted-foreground">No transfers recorded.</div>}
      </div>
      <div className="mt-2 grid gap-2 rounded-lg border border-border bg-background/40 p-2 sm:grid-cols-2">
        <input className={inputCls} placeholder="From club" value={draft.from_club ?? ""} onChange={(e) => setDraft({ ...draft, from_club: e.target.value })} />
        <input className={inputCls} placeholder="To club" value={draft.to_club ?? ""} onChange={(e) => setDraft({ ...draft, to_club: e.target.value })} />
        <input type="date" className={inputCls} value={draft.moved_on ?? ""} onChange={(e) => setDraft({ ...draft, moved_on: e.target.value || null })} />
        <input className={inputCls} placeholder="Fee (optional)" value={draft.fee ?? ""} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} />
        <select className={inputCls} value={draft.transfer_type ?? "Transfer"} onChange={(e) => setDraft({ ...draft, transfer_type: e.target.value })}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className={btnPrimary} onClick={add}><Plus className="h-3.5 w-3.5" /> Add transfer</button>
      </div>
    </div>
  );
}