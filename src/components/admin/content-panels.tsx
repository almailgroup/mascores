import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus, Radio, Repeat2, Sparkles, Stadium, Trash2 } from "lucide-react";
import { supabase, type Venue, type Transfer } from "@/lib/db";
import { CountrySelect } from "@/components/country-select";
import { Field, ImageInput, inputCls, btnPrimary, btnDanger } from "./ui";
import { uploadMedia } from "./upload";
import type { Database } from "@/integrations/supabase/types";

type Channel = Database["public"]["Tables"]["broadcast_channels"]["Row"];

export function VenuesPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Venue>>({});
  const q = useQuery({ queryKey: ["admin", "venues"], queryFn: async () => (await supabase.from("venues").select("*").order("name")).data as Venue[] ?? [] });
  const save = async () => {
    if (!form.name?.trim()) return;
    if (form.id) await supabase.from("venues").update(form).eq("id", form.id); else await supabase.from("venues").insert(form as never);
    setForm({}); qc.invalidateQueries({ queryKey: ["admin", "venues"] });
  };
  return <LibraryPanel icon={<Stadium className="h-5 w-5" />} title="Venue library" subtitle="Save stadiums once and reuse them in every match.">
    <div className="grid gap-2 sm:grid-cols-2">{q.data?.map((v) => <Item key={v.id} title={v.name} subtitle={[v.city, v.country, v.capacity ? `${v.capacity.toLocaleString()} seats` : null].filter(Boolean).join(" · ")} onEdit={() => setForm(v)} onDelete={async () => { await supabase.from("venues").delete().eq("id", v.id); qc.invalidateQueries({ queryKey: ["admin", "venues"] }); }} />)}</div>
    <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
      <Field label="Venue name"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="City"><input className={inputCls} value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
      <Field label="Country"><CountrySelect value={form.country} onChange={(name, country) => setForm({ ...form, country: name, country_code: country?.code ?? null })} /></Field>
      <Field label="Capacity"><input type="number" className={inputCls} value={form.capacity ?? ""} onChange={(e) => setForm({ ...form, capacity: e.target.value ? Number(e.target.value) : null })} /></Field>
      <Field label="Image"><ImageInput value={form.image_url ?? null} onChange={(image_url) => setForm({ ...form, image_url })} onFile={async (file) => { const image_url = await uploadMedia("competition-logos", file); if (image_url) setForm({ ...form, image_url }); }} /></Field>
      <Field label="Description"><textarea className={inputCls} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <button className={btnPrimary} onClick={save}><Plus className="h-3.5 w-3.5" /> {form.id ? "Save venue" : "Add venue"}</button>
    </div>
  </LibraryPanel>;
}

export function ChannelsPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Channel>>({});
  const q = useQuery({ queryKey: ["admin", "channels"], queryFn: async () => (await supabase.from("broadcast_channels").select("*").order("name")).data as Channel[] ?? [] });
  const save = async () => { if (!form.name?.trim()) return; if (form.id) await supabase.from("broadcast_channels").update(form).eq("id", form.id); else await supabase.from("broadcast_channels").insert(form as never); setForm({}); qc.invalidateQueries({ queryKey: ["admin", "channels"] }); };
  return <LibraryPanel icon={<Radio className="h-5 w-5" />} title="Broadcast channels" subtitle="Create channel records and attach them to matches.">
    <div className="grid gap-2 sm:grid-cols-2">{q.data?.map((c) => <Item key={c.id} title={c.name} subtitle={c.country_code ?? "Global"} image={c.logo_url} onEdit={() => setForm(c)} onDelete={async () => { await supabase.from("broadcast_channels").delete().eq("id", c.id); qc.invalidateQueries({ queryKey: ["admin", "channels"] }); }} />)}</div>
    <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"><Field label="Channel name"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Country"><CountrySelect value={form.country_code} onChange={(_, country) => setForm({ ...form, country_code: country?.code ?? null })} /></Field><Field label="Logo"><ImageInput value={form.logo_url ?? null} onChange={(logo_url) => setForm({ ...form, logo_url })} onFile={async (file) => { const logo_url = await uploadMedia("competition-logos", file); if (logo_url) setForm({ ...form, logo_url }); }} /></Field><div className="self-end"><button className={btnPrimary} onClick={save}><Plus className="h-3.5 w-3.5" /> {form.id ? "Save channel" : "Add channel"}</button></div></div>
  </LibraryPanel>;
}

export function TransfersAdminPanel() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<Transfer>>({ person_type: "player", transfer_type: "Transfer", season: "26/27" });
  const q = useQuery({ queryKey: ["admin", "all-transfers"], queryFn: async () => (await supabase.from("transfers").select("*").order("moved_on", { ascending: false })).data as Transfer[] ?? [] });
  const add = async () => { if (!draft.person_id || (!draft.from_club && !draft.to_club)) return; await supabase.from("transfers").insert(draft as never); setDraft({ person_type: "player", transfer_type: "Transfer", season: "26/27" }); qc.invalidateQueries({ queryKey: ["admin", "all-transfers"] }); };
  return <LibraryPanel icon={<Repeat2 className="h-5 w-5" />} title="Transfer manager" subtitle="Add moves to any club, including clubs outside the database.">
    <div className="grid gap-3 sm:grid-cols-3"><Field label="Player or coach ID"><input className={inputCls} value={draft.person_id ?? ""} onChange={(e) => setDraft({ ...draft, person_id: e.target.value })} /></Field><Field label="From club"><input className={inputCls} value={draft.from_club ?? ""} onChange={(e) => setDraft({ ...draft, from_club: e.target.value })} /></Field><Field label="To club"><input className={inputCls} value={draft.to_club ?? ""} onChange={(e) => setDraft({ ...draft, to_club: e.target.value })} /></Field><Field label="Date"><input type="date" className={inputCls} value={draft.moved_on ?? ""} onChange={(e) => setDraft({ ...draft, moved_on: e.target.value || null })} /></Field><Field label="Season"><input className={inputCls} value={draft.season ?? ""} onChange={(e) => setDraft({ ...draft, season: e.target.value })} /></Field><div className="self-end"><button className={btnPrimary} onClick={add}><Plus className="h-3.5 w-3.5" /> Add transfer</button></div></div>
    <div className="mt-4 grid gap-2">{q.data?.slice(0, 50).map((t) => <Item key={t.id} title={`${t.from_club ?? "Free agent"} → ${t.to_club ?? "—"}`} subtitle={[t.moved_on, t.transfer_type, t.season].filter(Boolean).join(" · ")} onDelete={async () => { await supabase.from("transfers").delete().eq("id", t.id); qc.invalidateQueries({ queryKey: ["admin", "all-transfers"] }); }} />)}</div>
  </LibraryPanel>;
}

export function AlmailAiPanel({ onNews, onCompetitions }: { onNews: () => void; onCompetitions: () => void }) {
  return <LibraryPanel icon={<Bot className="h-5 w-5" />} title="Almail AI studio" subtitle="AI tools are active and create editable drafts—nothing publishes without your review."><div className="grid gap-3 md:grid-cols-2"><button onClick={onCompetitions} className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-left hover:border-primary"><Sparkles className="mt-0.5 h-5 w-5 text-primary" /><span><strong className="block">Create a player with AI</strong><span className="text-xs text-muted-foreground">Open a competition → Teams → Squad → Create with Almail AI. Add text and up to six images.</span></span></button><button onClick={onNews} className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-left hover:border-primary"><Sparkles className="mt-0.5 h-5 w-5 text-primary" /><span><strong className="block">Write news with AI</strong><span className="text-xs text-muted-foreground">Generate a full editable article from reporting notes and photos.</span></span></button></div></LibraryPanel>;
}

function LibraryPanel({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) { return <div><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div><div><h2 className="text-lg font-bold">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div></div>{children}</div>; }
function Item({ title, subtitle, image, onEdit, onDelete }: { title: string; subtitle?: string; image?: string | null; onEdit?: () => void; onDelete: () => void }) { return <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">{image && <img src={image} alt="" className="h-9 w-9 object-contain" />}<button className="min-w-0 flex-1 text-left" onClick={onEdit}><div className="truncate text-sm font-semibold">{title}</div>{subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}</button><button className={btnDanger} onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></button></div>; }