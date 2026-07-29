import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, slugify, type Competition } from "@/lib/db";
import { Field, Modal, ImageInput, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { uploadMedia } from "./upload";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";

type Form = Partial<Competition>;
const empty: Form = { name: "", slug: "", sport: "football", format: "league", featured: false, sort_order: 0 };

export function CompetitionsPanel({ onOpen }: { onOpen: (c: Competition) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const q = useQuery({
    queryKey: ["admin", "competitions"],
    queryFn: async () => {
      const { data } = await supabase.from("competitions").select("*").order("sort_order").order("name");
      return (data ?? []) as Competition[];
    },
  });

  const save = async () => {
    const payload = { ...form, slug: form.slug || slugify(form.name ?? "") };
    if (!payload.name) return;
    if (form.id) await supabase.from("competitions").update(payload).eq("id", form.id);
    else await supabase.from("competitions").insert(payload as never);
    setOpen(false);
    setForm(empty);
    qc.invalidateQueries({ queryKey: ["admin", "competitions"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this competition and everything inside?")) return;
    await supabase.from("competitions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "competitions"] });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Competitions</h2>
        <button className={btnPrimary} onClick={() => { setForm(empty); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> New competition
        </button>
      </div>

      <div className="grid gap-2">
        {(q.data ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
              {c.logo_url ? <img src={c.logo_url} className="h-full w-full object-contain" alt="" /> : <span className="text-xs">🏆</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">{[c.country, c.season, c.format].filter(Boolean).join(" · ")}</div>
            </div>
            <button className={btnGhost} onClick={() => onOpen(c)}>Manage <ChevronRight className="h-3.5 w-3.5" /></button>
            <button className={btnGhost} onClick={() => { setForm(c); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
            <button className={btnDanger} onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No competitions yet. Create one to get started.</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit competition" : "New competition"} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} /></Field>
          <Field label="Slug"><input className={inputCls} value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
          <Field label="Sport"><input className={inputCls} value={form.sport ?? ""} onChange={(e) => setForm({ ...form, sport: e.target.value })} /></Field>
          <Field label="Country"><input className={inputCls} value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
          <Field label="Category"><input className={inputCls} placeholder="Club / International / Youth" value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Season"><input className={inputCls} placeholder="2025/26" value={form.season ?? ""} onChange={(e) => setForm({ ...form, season: e.target.value })} /></Field>
          <Field label="Format">
            <select className={inputCls} value={form.format ?? "league"} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              <option value="league">League</option>
              <option value="knockout">Knockout</option>
              <option value="group+knockout">Groups + Knockout</option>
              <option value="cup">Cup</option>
              <option value="friendly">Friendly</option>
            </select>
          </Field>
          <Field label="Sort order"><input type="number" className={inputCls} value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field>
          <Field label="Starts on"><input type="date" className={inputCls} value={form.starts_on ?? ""} onChange={(e) => setForm({ ...form, starts_on: e.target.value || null })} /></Field>
          <Field label="Ends on"><input type="date" className={inputCls} value={form.ends_on ?? ""} onChange={(e) => setForm({ ...form, ends_on: e.target.value || null })} /></Field>
          <div className="sm:col-span-2">
            <Field label="Logo">
              <ImageInput value={form.logo_url ?? null} onChange={(v) => setForm({ ...form, logo_url: v })} onFile={async (f) => { const url = await uploadMedia("competition-logos", f); if (url) setForm({ ...form, logo_url: url }); }} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description"><textarea rows={3} className={inputCls} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured ?? false} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Save</button>
        </div>
      </Modal>
    </div>
  );
}