import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, slugify, type Competition } from "@/lib/db";
import { Field, Modal, ImageInput, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { uploadMedia } from "./upload";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { CountrySelect } from "@/components/country-select";
import { ArabicNameField } from "./arabic-name-field";
import { useAdminAbility } from "@/lib/admin-ability";
import { ConfirmDelete } from "@/components/confirm-delete";

type Form = Partial<Competition>;
const empty: Form = { name: "", slug: "", sport: "football", format: "league", featured: false, sort_order: 0 };

export function CompetitionsPanel({ onOpen }: { onOpen: (c: Competition) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "national" | "continental" | "regional" | "international">("all");
  const { isOwner } = useAdminAbility();
  const [deleteComp, setDeleteComp] = useState<Competition | null>(null);

  const q = useQuery({
    queryKey: ["admin", "competitions"],
    queryFn: async () => {
      const { data } = await supabase.from("competitions").select("*").order("sort_order").order("name");
      return (data ?? []) as Competition[];
    },
  });
  const teams = useQuery({
    queryKey: ["admin", "team-library-picker"],
    queryFn: async () => (await supabase.from("teams").select("id,name,country,country_code,is_national").order("name")).data ?? [],
  });
  /** Only teams that belong to the competition's country (and the right kind) may hold its title. */
  const titleHolderTeams = (teams.data ?? []).filter((team) => {
    if (form.is_national && !team.is_national) return false;
    if (!form.is_national && team.is_national) return false;
    const scope = form.scope ?? "national";
    if (scope !== "national") return true;
    if (!form.country && !form.country_code) return true;
    return form.country_code ? team.country_code === form.country_code : team.country === form.country;
  });

  const save = async () => {
    const payload = { ...form, slug: form.slug || slugify(form.name ?? ""), seasons: form.seasons ?? (form.season ? [form.season] : []) };
    if (!payload.name) return;
    if (form.id) await supabase.from("competitions").update(payload).eq("id", form.id);
    else await supabase.from("competitions").insert(payload as never);
    setOpen(false);
    setForm(empty);
    qc.invalidateQueries({ queryKey: ["admin", "competitions"] });
  };

  // Only the site owner may wipe a competition, and only after typing the word twice.
  const remove = async (id: string) => {
    await supabase.from("competitions").delete().eq("id", id);
    setDeleteComp(null);
    qc.invalidateQueries({ queryKey: ["admin", "competitions"] });
  };

  const term = search.trim().toLowerCase();
  const visible = (q.data ?? []).filter((c) =>
    (scope === "all" || (c.scope ?? "national") === scope) &&
    (!term || c.name.toLowerCase().includes(term) || (c.country ?? "").toLowerCase().includes(term)),
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Competitions</h2>
        <button className={btnPrimary} onClick={() => { setForm(empty); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> New competition
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} max-w-56`} placeholder="Search competitions" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 text-[0.7rem]">
          {(["all", "national", "continental", "regional", "international"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setScope(k)}
              className={`shrink-0 rounded-full px-3 py-1 font-semibold capitalize ${scope === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{k}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        {visible.map((c) => (
          
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 sm:gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
              {c.logo_url ? <img src={c.logo_url} className="h-full w-full object-contain" alt="" /> : <span className="text-xs">🏆</span>}
            </div>
            <div className="min-w-0 flex-1 basis-[60%]">
              <div className="truncate font-semibold">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">{[c.scope && c.scope !== "national" ? c.region ?? c.scope : c.country, c.season, c.format].filter(Boolean).join(" · ")}</div>
            </div>
            <button className={btnGhost} onClick={() => onOpen(c)}>Manage <ChevronRight className="h-3.5 w-3.5" /></button>
            <button className={btnGhost} onClick={() => { setForm(c); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
            {isOwner && <button className={btnDanger} onClick={() => setDeleteComp(c)}><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No competitions yet. Create one to get started.</div>}
      </div>

      <ConfirmDelete
        open={!!deleteComp}
        twice
        title={`Delete ${deleteComp?.name ?? "competition"}`}
        description="This removes the competition and everything inside it — matches, standings and team links. It cannot be undone, so you are asked to type the word twice."
        confirmWord="delete"
        actionLabel="Delete competition"
        onCancel={() => setDeleteComp(null)}
        onConfirm={() => remove(deleteComp!.id)}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit competition" : "New competition"} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} /></Field>
          <ArabicNameField englishName={form.name} />
          <Field label="Slug"><input className={inputCls} value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
          <Field label="Sport"><select className={inputCls} value={form.sport ?? "football"} onChange={(e) => setForm({ ...form, sport: e.target.value })}><option value="football">Football</option><option value="basketball">Basketball</option><option value="american_football">American football</option><option value="hockey">Hockey</option><option value="volleyball">Volleyball</option><option value="handball">Handball</option></select></Field>
          <Field label="Scope">
            <select className={inputCls} value={form.scope ?? "national"} onChange={(e) => setForm({ ...form, scope: e.target.value, region: e.target.value === "national" ? null : form.region })}>
              <option value="national">National (one country)</option>
              <option value="continental">Continental (e.g. AFC, UEFA)</option>
              <option value="regional">Regional (e.g. GCC, Middle East)</option>
              <option value="international">International (worldwide)</option>
            </select>
          </Field>
          {(form.scope ?? "national") === "national" ? (
            <Field label="Country"><CountrySelect value={form.country} onChange={(name, country) => setForm({ ...form, country: name, country_code: country?.code ?? null })} /></Field>
          ) : (
            <Field label="Region or confederation">
              <input className={inputCls} list="mas-regions" placeholder="GCC, Middle East, Asia, Europe…" value={form.region ?? ""} onChange={(e) => setForm({ ...form, region: e.target.value || null })} />
              <datalist id="mas-regions">
                {["GCC", "Middle East", "Arab world", "North Africa", "West Asia", "Asia (AFC)", "Europe (UEFA)", "Africa (CAF)", "South America (CONMEBOL)", "North America (CONCACAF)", "Oceania (OFC)", "World (FIFA)"].map((r) => <option key={r} value={r} />)}
              </datalist>
            </Field>
          )}
          <Field label="Category">
            <select className={inputCls} value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value || null })}>
              <option value="">Choose a category</option>
              {["Professional", "Amateur", "Youth", "Women", "Reserves", "International", "Club", "Cup", "Futsal", "Friendly", "Other"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Season"><input className={inputCls} placeholder="2025/2026" value={form.season ?? ""} onChange={(e) => setForm({ ...form, season: e.target.value })} /></Field>
          <Field label="Seasons"><div className="space-y-2"><div className="flex flex-wrap gap-2">{(form.seasons ?? []).map((season) => <button type="button" key={season} className="rounded-full border border-border px-3 py-1 text-xs" onClick={() => setForm({ ...form, seasons: (form.seasons ?? []).filter((item) => item !== season) })}>{season} ×</button>)}</div><input className={inputCls} placeholder="Add a season, for example 25/26, then press Enter" onKeyDown={(e) => { if (e.key !== "Enter") return; e.preventDefault(); const season = e.currentTarget.value.trim(); if (season && !(form.seasons ?? []).includes(season)) setForm({ ...form, seasons: [...(form.seasons ?? []), season] }); e.currentTarget.value = ""; }} /></div></Field>
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
          <Field label="Higher division"><select className={inputCls} value={form.higher_division_id ?? ""} onChange={(e) => setForm({ ...form, higher_division_id: e.target.value || null })}><option value="">None</option>{(q.data ?? []).filter((item) => item.id !== form.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Lower division"><select className={inputCls} value={form.lower_division_id ?? ""} onChange={(e) => setForm({ ...form, lower_division_id: e.target.value || null })}><option value="">None</option>{(q.data ?? []).filter((item) => item.id !== form.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Parent competition"><select className={inputCls} value={form.parent_competition_id ?? ""} onChange={(e) => setForm({ ...form, parent_competition_id: e.target.value || null })}><option value="">None</option>{(q.data ?? []).filter((item) => item.id !== form.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Title holder"><select className={inputCls} value={form.title_holder_team_id ?? ""} onChange={(e) => setForm({ ...form, title_holder_team_id: e.target.value || null })}><option value="">None</option>{titleHolderTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
          <Field label="Standings mode"><select className={inputCls} value={form.standings_mode ?? "table"} onChange={(e) => setForm({ ...form, standings_mode: e.target.value })}><option value="table">League table</option><option value="groups">Groups</option><option value="knockout">Knockout</option></select></Field>
          <div className="sm:col-span-2">
            <Field label="Logo (light mode)">
              <ImageInput value={form.logo_url ?? null} onChange={(v) => setForm({ ...form, logo_url: v })} onFile={async (f) => { const url = await uploadMedia("competition-logos", f); if (url) setForm({ ...form, logo_url: url }); }} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Logo (dark mode) — optional">
              <ImageInput value={form.logo_url_dark ?? null} onChange={(v) => setForm({ ...form, logo_url_dark: v })} onFile={async (f) => { const url = await uploadMedia("competition-logos", f); if (url) setForm({ ...form, logo_url_dark: url }); }} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description"><textarea rows={3} className={inputCls} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured ?? false} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
          <label className="flex items-start gap-2 rounded-xl border border-border bg-background/50 p-3 text-xs sm:col-span-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.is_national ?? false} onChange={(e) => setForm({ ...form, is_national: e.target.checked })} />
            <span><strong className="block">National teams competition</strong>Squads are call-ups: a player keeps his club and can wear a different national photo and shirt number.</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Save</button>
        </div>
      </Modal>
    </div>
  );
}