import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, slugify, type Competition } from "@/lib/db";
import { Field, ImageInput, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { uploadMedia } from "./upload";
import { Plus, Pencil, Trash2, ChevronRight, ChevronLeft, X, Loader2, Trophy, Globe2, CalendarDays, Eye, Link2, ImageIcon, type LucideIcon } from "lucide-react";
import { CountrySelect } from "@/components/country-select";
import { useAdminAbility } from "@/lib/admin-ability";
import { ConfirmDelete } from "@/components/confirm-delete";
import { TitleHistoryEditor } from "./title-history-editor";

type Form = Partial<Competition>;
const empty: Form = { name: "", slug: "", sport: "football", format: "league", featured: false, sort_order: 0 };

type EditorPage = "root" | "identity" | "country" | "seasons" | "public" | "related" | "media";

const SECTION_META: { key: Exclude<EditorPage, "root">; label: string; title: string; hint: string; icon: LucideIcon }[] = [
  { key: "identity", label: "Identity", title: "Identity", hint: "Name, Arabic name, season, format and logo", icon: Trophy },
  { key: "country", label: "Country & type", title: "Country & type", hint: "Where it is played, category and national teams", icon: Globe2 },
  { key: "seasons", label: "Seasons & dates", title: "Seasons & dates", hint: "Past seasons, start and end dates, order in lists", icon: CalendarDays },
  { key: "public", label: "Public page", title: "Public page", hint: "Hide sections, standings style, knockout, featured", icon: Eye },
  { key: "related", label: "Related competitions & titles", title: "Related competitions & titles", hint: "Divisions, youth leagues, title holder", icon: Link2 },
  { key: "media", label: "Media & description", title: "Media & description", hint: "Dark logo, video thumbnail, description, link name", icon: ImageIcon },
];

const FORMAT_LABEL: Record<string, string> = {
  league: "League", knockout: "Knockout", "group+knockout": "Groups + Knockout", cup: "Cup", friendly: "Friendly",
};

export function CompetitionsPanel({ onOpen }: { onOpen: (c: Competition) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<EditorPage>("root");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "national" | "continental" | "regional" | "international">("all");
  const { isOwner, competitionIds } = useAdminAbility();
  const [deleteComp, setDeleteComp] = useState<Competition | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  // Lock the page behind the full-screen editor, like a native settings page.
  useEffect(() => {
    if (!open) return;
    let locked = 0;
    const previous = document.body.style.overflow;
    if (locked++ === 0) document.body.style.overflow = "hidden";
    return () => { if (--locked === 0) document.body.style.overflow = previous; };
  }, [open]);

  const save = async () => {
    const payload = { ...form, slug: form.slug || slugify(form.name ?? ""), seasons: form.seasons ?? (form.season ? [form.season] : []) };
    if (!payload.name) { setPage("identity"); return; }
    setSaving(true);
    try {
      if (form.id) await supabase.from("competitions").update(payload).eq("id", form.id);
      else await supabase.from("competitions").insert(payload as never);
      setOpen(false);
      setPage("root");
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["admin", "competitions"] });
    } finally {
      setSaving(false);
    }
  };

  // Only the site owner may wipe a competition, and only after typing the word twice.
  const remove = async (id: string) => {
    await supabase.from("competitions").delete().eq("id", id);
    setDeleteComp(null);
    qc.invalidateQueries({ queryKey: ["admin", "competitions"] });
  };

  const term = search.trim().toLowerCase();
  // A helper the owner tied to certain competitions only ever sees those.
  const limited = competitionIds.length > 0;
  const visible = (q.data ?? []).filter((c) =>
    (!limited || competitionIds.includes(c.id)) &&
    (scope === "all" || (c.scope ?? "national") === scope) &&
    (!term || c.name.toLowerCase().includes(term) || (c.country ?? "").toLowerCase().includes(term)),
  );

  const meta = SECTION_META.find((item) => item.key === page);
  const sectionTitle = meta ? meta.title : "";

  const header = (
    <div
      className="sticky top-0 z-10 flex items-center gap-1 border-b border-border/70 bg-background/85 px-2 backdrop-blur-xl"
      style={{ paddingTop: "calc(0.375rem + env(safe-area-inset-top, 0px))", paddingBottom: "0.375rem" }}
    >
      <button
        type="button"
        aria-label={page === "root" ? "Close" : "Back"}
        onClick={() => (page === "root" ? setOpen(false) : setPage("root"))}
        className="grid h-11 w-11 place-items-center rounded-full text-foreground hover:bg-accent"
      >
        {page === "root" ? <X className="h-5 w-5" /> : <ChevronLeft className="h-6 w-6" />}
      </button>
      <div className="min-w-0 flex-1 truncate text-center text-sm font-bold">{page === "root" ? (form.id ? "Edit competition" : "New competition") : sectionTitle}</div>
      <button type="button" onClick={save} disabled={saving} className={`${btnPrimary} min-w-16 justify-center`}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </button>
    </div>
  );

  const editor = open && mounted && typeof document !== "undefined" && createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-background text-foreground">
      {header}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
        <div key={page} className="mas-editor-page mx-auto w-full max-w-2xl px-4 pb-16 pt-4">
          {page === "root" && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10">
                  {form.logo_url ? <img src={form.logo_url} alt="" className="h-full w-full object-contain" /> : <Trophy className="h-7 w-7 text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-bold">{form.name || "Untitled competition"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[form.name_ar, form.season, form.format ? FORMAT_LABEL[form.format] ?? form.format : ""].filter(Boolean).join(" · ") || "Nothing set yet"}
                  </div>
                </div>
                <button type="button" onClick={() => setPage("identity")} className={btnGhost}>Edit</button>
              </div>
              <div className="overflow-hidden rounded-3xl border border-border bg-card">
                {SECTION_META.map((item, index) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPage(item.key)}
                    className={`flex w-full items-center gap-3 p-4 text-start hover:bg-accent/40 ${index > 0 ? "border-t border-border/60" : ""}`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><item.icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
              <p className="px-1 text-center text-xs text-muted-foreground">Everything is saved together when you press Save.</p>
            </div>
          )}

          {page === "identity" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} /></Field>
                <Field label="Arabic name"><input dir="rtl" className={inputCls} placeholder="الاسم بالعربية" value={form.name_ar ?? ""} onChange={(e) => setForm({ ...form, name_ar: e.target.value || null })} /></Field>
                <Field label="Season"><input className={inputCls} placeholder="2025/2026" value={form.season ?? ""} onChange={(e) => setForm({ ...form, season: e.target.value })} /></Field>
                <Field label="Format">
                  <select className={inputCls} value={form.format ?? "league"} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                    <option value="league">League</option>
                    <option value="knockout">Knockout</option>
                    <option value="group+knockout">Groups + Knockout</option>
                    <option value="cup">Cup</option>
                    <option value="friendly">Friendly</option>
                  </select>
                </Field>
              </div>
              <Field label="Logo (light mode)">
                <ImageInput value={form.logo_url ?? null} onChange={(v) => setForm({ ...form, logo_url: v })} onFile={async (f) => { const url = await uploadMedia("competition-logos", f); if (url) setForm({ ...form, logo_url: url }); }} />
              </Field>
            </div>
          )}

          {page === "country" && (
            <div className="grid gap-3 sm:grid-cols-2">
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
              <Field label="Sport"><select className={inputCls} value={form.sport ?? "football"} onChange={(e) => setForm({ ...form, sport: e.target.value })}><option value="football">Football</option><option value="basketball">Basketball</option><option value="american_football">American football</option><option value="hockey">Hockey</option><option value="volleyball">Volleyball</option><option value="handball">Handball</option></select></Field>
              <label className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-xs sm:col-span-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.is_national ?? false} onChange={(e) => setForm({ ...form, is_national: e.target.checked })} />
                <span><strong className="block">National teams competition</strong>Squads are call-ups: a player keeps his club and can wear a different national photo and shirt number.</span>
              </label>
            </div>
          )}

          {page === "seasons" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Seasons">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {(form.seasons ?? []).map((season) => (
                      <button type="button" key={season} className="rounded-full border border-border px-3 py-1 text-xs" onClick={() => setForm({ ...form, seasons: (form.seasons ?? []).filter((item) => item !== season) })}>{season} ×</button>
                    ))}
                  </div>
                  <input className={inputCls} placeholder="Add a season, for example 25/26, then press Enter" onKeyDown={(e) => { if (e.key !== "Enter") return; e.preventDefault(); const season = e.currentTarget.value.trim(); if (season && !(form.seasons ?? []).includes(season)) setForm({ ...form, seasons: [...(form.seasons ?? []), season] }); e.currentTarget.value = ""; }} />
                </div>
              </Field></div>
              <Field label="Sort order"><input type="number" className={inputCls} value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field>
              <Field label="Starts on"><input type="date" className={inputCls} value={form.starts_on ?? ""} onChange={(e) => setForm({ ...form, starts_on: e.target.value || null })} /></Field>
              <Field label="Ends on"><input type="date" className={inputCls} value={form.ends_on ?? ""} onChange={(e) => setForm({ ...form, ends_on: e.target.value || null })} /></Field>
            </div>
          )}

          {page === "public" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Standings mode">
                <select className={inputCls} value={form.standings_mode ?? "table"} onChange={(e) => setForm({ ...form, standings_mode: e.target.value })}>
                  <option value="table">League table</option>
                  <option value="groups">Groups</option>
                  <option value="knockout">Knockout</option>
                </select>
              </Field>
              <div className="sm:col-span-2"><Field label="Sections to hide on the public page">
                <div className="flex flex-wrap gap-2">
                  {["standings", "knockout", "stats", "teams", "awards", "media", "news", "round team"].map((section) => {
                    const hidden = (form.hidden_tabs ?? []).includes(section);
                    return (
                      <button type="button" key={section} onClick={() => setForm({ ...form, hidden_tabs: hidden ? (form.hidden_tabs ?? []).filter((item) => item !== section) : [...(form.hidden_tabs ?? []), section] })}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${hidden ? "border-destructive bg-destructive/10 text-destructive" : "border-border"}`}>
                        {section}{hidden ? " · hidden" : ""}
                      </button>
                    );
                  })}
                </div>
              </Field></div>
              <label className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-xs sm:col-span-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.has_knockout ?? false} onChange={(e) => setForm({ ...form, has_knockout: e.target.checked })} />
                <span><strong className="block">Has knockout rounds</strong>Adds a Knockout section next to the table, where the ties can be set even before the clubs are known.</span>
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured ?? false} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
              {isOwner && (
                <Field label="Followers shown (leave empty for the real count)">
                  <div className="flex gap-2">
                    <input type="number" className={inputCls} value={form.followers_override ?? ""} onChange={(e) => setForm({ ...form, followers_override: e.target.value === "" ? null : Number(e.target.value) })} />
                    <button type="button" className={btnGhost} onClick={() => setForm({ ...form, followers_override: null })}>Reset</button>
                  </div>
                </Field>
              )}
            </div>
          )}

          {page === "related" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Parent competition"><select className={inputCls} value={form.parent_competition_id ?? ""} onChange={(e) => setForm({ ...form, parent_competition_id: e.target.value || null })}><option value="">None</option>{(q.data ?? []).filter((item) => item.id !== form.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="Higher division"><select className={inputCls} value={form.higher_division_id ?? ""} onChange={(e) => setForm({ ...form, higher_division_id: e.target.value || null })}><option value="">None</option>{(q.data ?? []).filter((item) => item.id !== form.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="Lower division"><select className={inputCls} value={form.lower_division_id ?? ""} onChange={(e) => setForm({ ...form, lower_division_id: e.target.value || null })}><option value="">None</option>{(q.data ?? []).filter((item) => item.id !== form.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <div className="sm:col-span-2"><Field label="Youth leagues">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {(form.youth_competition_ids ?? []).map((youthId) => {
                      const youth = (q.data ?? []).find((item) => item.id === youthId);
                      return (
                        <button type="button" key={youthId} className="rounded-full border border-border px-3 py-1 text-xs"
                          onClick={() => setForm({ ...form, youth_competition_ids: (form.youth_competition_ids ?? []).filter((item) => item !== youthId) })}>
                          {youth?.name ?? "Unknown"} ×
                        </button>
                      );
                    })}
                  </div>
                  <select className={inputCls} value="" onChange={(e) => {
                    if (!e.target.value) return;
                    setForm({ ...form, youth_competition_ids: [...new Set([...(form.youth_competition_ids ?? []), e.target.value])] });
                  }}>
                    <option value="">Add a youth league</option>
                    {(q.data ?? []).filter((item) => item.id !== form.id && !(form.youth_competition_ids ?? []).includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
              </Field></div>
              <Field label="Title holder">
                <select className={inputCls} value={form.title_holder_team_id ?? ""} onChange={(e) => setForm({ ...form, title_holder_team_id: e.target.value || null })}>
                  <option value="">None</option>
                  {titleHolderTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </Field>
              {isOwner && form.id && <div className="sm:col-span-2"><TitleHistoryEditor competitionId={form.id} teams={teams.data ?? []} /></div>}
            </div>
          )}

          {page === "media" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Logo (dark mode) — optional">
                  <ImageInput value={form.logo_url_dark ?? null} onChange={(v) => setForm({ ...form, logo_url_dark: v })} onFile={async (f) => { const url = await uploadMedia("competition-logos", f); if (url) setForm({ ...form, logo_url_dark: url }); }} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Video thumbnail background — match logos and score are added automatically">
                  <ImageInput value={form.video_thumbnail_url ?? null} onChange={(v) => setForm({ ...form, video_thumbnail_url: v })} onFile={async (f) => { const url = await uploadMedia("competition-logos", f); if (url) setForm({ ...form, video_thumbnail_url: url }); }} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Description"><textarea rows={3} className={inputCls} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              </div>
              <Field label="Slug"><input className={inputCls} value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Competitions</h2>
        {!limited && (
          <button className={btnPrimary} onClick={() => { setForm(empty); setPage("root"); setOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> New competition
          </button>
        )}
      </div>
      {limited && <p className="mb-3 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">You can manage only the competitions the site owner chose for you.</p>}

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
            <button type="button" onClick={() => { setForm(c); setPage("root"); setOpen(true); }} className="min-w-0 flex-1 basis-[60%] text-start">
              <div className="truncate font-semibold">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">{[c.scope && c.scope !== "national" ? c.region ?? c.scope : c.country, c.season, c.format].filter(Boolean).join(" · ")}</div>
            </button>
            <button className={btnGhost} onClick={() => onOpen(c)}>Manage <ChevronRight className="h-3.5 w-3.5" /></button>
            <button className={btnGhost} onClick={() => { setForm(c); setPage("root"); setOpen(true); }} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
            {isOwner && <button className={btnDanger} onClick={() => setDeleteComp(c)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No competitions yet. Create one to get started.</div>}
      </div>

      {editor}

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
    </div>
  );
}
