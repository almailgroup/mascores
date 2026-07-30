import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, POSITIONS, type Team, type Player, type Coach } from "@/lib/db";
import { Field, Modal, ImageInput, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { uploadMedia } from "./upload";
import { CountrySelect } from "@/components/country-select";
import { DateWheel } from "@/components/date-wheel";
import { TransfersEditor } from "./transfers-editor";
import { VenueSelect } from "./venue-select";
import { Plus, Pencil, Trash2, Users, UserCog } from "lucide-react";

type TeamForm = Partial<Team>;
type PlayerForm = Partial<Player>;
type CoachForm = Partial<Coach>;

export function TeamsPanel({ competitionId }: { competitionId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TeamForm>({});
  const [squadOf, setSquadOf] = useState<Team | null>(null);
  const [staffOf, setStaffOf] = useState<Team | null>(null);

  const q = useQuery({
    queryKey: ["admin", "teams", competitionId],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("*").eq("competition_id", competitionId).order("name");
      return (data ?? []) as Team[];
    },
  });

  const save = async () => {
    if (!form.name) return;
    const payload = { ...form, competition_id: competitionId };
    if (form.id) await supabase.from("teams").update(payload).eq("id", form.id);
    else await supabase.from("teams").insert(payload as never);
    setOpen(false); setForm({});
    qc.invalidateQueries({ queryKey: ["admin", "teams", competitionId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this team?")) return;
    await supabase.from("teams").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "teams", competitionId] });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold">Teams</h3>
        <button className={btnPrimary} onClick={() => { setForm({}); setOpen(true); }}><Plus className="h-3.5 w-3.5" /> Add team</button>
      </div>
      <div className="grid gap-2">
        {(q.data ?? []).map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded bg-primary/10">
              {t.logo_url ? <img src={t.logo_url} alt="" className="h-full w-full object-contain" /> : <span className="text-xs">⚽</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-sm">{t.name}</div>
              <div className="truncate text-xs text-muted-foreground">{[t.country, t.venue_name].filter(Boolean).join(" · ")}</div>
            </div>
            <button className={btnGhost} onClick={() => setSquadOf(t)}><Users className="h-3.5 w-3.5" /> Squad</button>
            <button className={btnGhost} onClick={() => setStaffOf(t)}><UserCog className="h-3.5 w-3.5" /> Coaches</button>
            <button className={btnGhost} onClick={() => { setForm(t); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
            <button className={btnDanger} onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No teams yet.</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit team" : "New team"} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Short name"><input className={inputCls} value={form.short_name ?? ""} onChange={(e) => setForm({ ...form, short_name: e.target.value })} /></Field>
          <Field label="Country">
            <CountrySelect value={form.country} onChange={(name, c) => setForm({ ...form, country: name, country_code: c?.code ?? null })} />
          </Field>
          <Field label="Home venue">
            <VenueSelect venue={form.venue_name} city={form.venue_city} onChange={(v, city) => setForm({ ...form, venue_name: v, venue_city: city })} />
          </Field>
          <div className="sm:col-span-2"><Field label="Team logo">
            <ImageInput value={form.logo_url ?? null} onChange={(v) => setForm({ ...form, logo_url: v })} onFile={async (f) => { const url = await uploadMedia("team-logos", f); if (url) setForm({ ...form, logo_url: url }); }} />
          </Field></div>
        </div>
        <p className="mt-3 text-[0.65rem] text-muted-foreground">Groups are managed from the Standings tab. Coaches are added from the Coaches button.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Save</button>
        </div>
      </Modal>

      {squadOf && <SquadModal team={squadOf} onClose={() => setSquadOf(null)} />}
      {staffOf && <CoachesModal team={staffOf} onClose={() => setStaffOf(null)} />}
    </div>
  );
}

function SquadModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PlayerForm>({});
  const [editing, setEditing] = useState(false);

  const q = useQuery({
    queryKey: ["admin", "players", team.id],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("*").eq("team_id", team.id).order("shirt_number", { nullsFirst: false });
      return (data ?? []) as Player[];
    },
  });

  const save = async () => {
    if (!form.name) return;
    const payload = { ...form, team_id: team.id };
    if (form.id) await supabase.from("players").update(payload).eq("id", form.id);
    else {
      const { data } = await supabase.from("players").insert(payload as never).select("*").maybeSingle();
      if (data) setForm(data as Player);
    }
    qc.invalidateQueries({ queryKey: ["admin", "players", team.id] });
    if (form.id) { setForm({}); setEditing(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove player?")) return;
    await supabase.from("players").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "players", team.id] });
  };

  return (
    <Modal open onClose={onClose} title={`${team.name} — squad`} wide>
      <div className="mb-4 grid gap-2">
        {(q.data ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/10">
              {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-[0.6rem]">{p.shirt_number ?? "?"}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="truncate text-[0.65rem] text-muted-foreground">{[p.position, p.nationality, p.shirt_number ? `#${p.shirt_number}` : null].filter(Boolean).join(" · ")}</div>
            </div>
            <button className={btnGhost} onClick={() => { setForm(p); setEditing(true); }}><Pencil className="h-3 w-3" /></button>
            <button className={btnDanger} onClick={() => remove(p.id)}><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No players yet.</div>}
      </div>

      {editing ? (
        <div className="rounded-2xl border border-border bg-background/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Position">
              <select className={inputCls} value={form.position ?? "Unknown"} onChange={(e) => setForm({ ...form, position: e.target.value })}>
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Shirt #"><input type="number" className={inputCls} value={form.shirt_number ?? ""} onChange={(e) => setForm({ ...form, shirt_number: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Height (cm)"><input type="number" className={inputCls} value={form.height_cm ?? ""} onChange={(e) => setForm({ ...form, height_cm: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Market value"><input className={inputCls} placeholder="€12m" value={form.market_value ?? ""} onChange={(e) => setForm({ ...form, market_value: e.target.value })} /></Field>
            <Field label="Date of birth"><DateWheel value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} /></Field>
            <Field label="Nationality">
              <CountrySelect value={form.nationality} onChange={(name, c) => setForm({ ...form, nationality: name, nationality_code: c?.code ?? null })} />
            </Field>
            <div className="sm:col-span-2"><Field label="Photo">
              <ImageInput value={form.photo_url ?? null} onChange={(v) => setForm({ ...form, photo_url: v })} onFile={async (f) => { const url = await uploadMedia("player-photos", f); if (url) setForm({ ...form, photo_url: url }); }} />
            </Field></div>
            <div className="sm:col-span-2"><Field label="Media gallery">
              <MediaEditor urls={form.media_urls ?? []} onChange={(v) => setForm({ ...form, media_urls: v })} />
            </Field></div>
          </div>
          {form.id && <div className="mt-4"><TransfersEditor personType="player" personId={form.id} /></div>}
          <div className="mt-4 flex justify-end gap-2">
            <button className={btnGhost} onClick={() => { setEditing(false); setForm({}); }}>{form.id ? "Done" : "Cancel"}</button>
            <button className={btnPrimary} onClick={save}>{form.id ? "Save player" : "Create player"}</button>
          </div>
        </div>
      ) : (
        <button className={btnPrimary} onClick={() => { setForm({}); setEditing(true); }}><Plus className="h-3.5 w-3.5" /> Add player</button>
      )}
    </Modal>
  );
}

function MediaEditor({ urls, onChange }: { urls: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {urls.map((u) => (
          <div key={u} className="relative h-14 w-14 overflow-hidden rounded-lg border border-border">
            <img src={u} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(urls.filter((x) => x !== u))}
              className="absolute right-0 top-0 bg-black/60 px-1 text-[0.6rem] text-white">✕</button>
          </div>
        ))}
      </div>
      <input type="file" accept="image/*" className="text-xs" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const url = await uploadMedia("player-photos", f);
        if (url) onChange([...urls, url]);
      }} />
    </div>
  );
}

function CoachesModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CoachForm>({});
  const [editing, setEditing] = useState(false);
  const key = ["admin", "coaches", team.id];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("coaches").select("*").eq("team_id", team.id).order("created_at");
      return (data ?? []) as Coach[];
    },
  });

  const save = async () => {
    if (!form.name) return;
    const payload = { ...form, team_id: team.id };
    if (form.id) await supabase.from("coaches").update(payload).eq("id", form.id);
    else {
      const { data } = await supabase.from("coaches").insert(payload as never).select("*").maybeSingle();
      if (data) setForm(data as Coach);
    }
    qc.invalidateQueries({ queryKey: key });
    if (form.id) { setForm({}); setEditing(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove coach?")) return;
    await supabase.from("coaches").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <Modal open onClose={onClose} title={`${team.name} — coaches`} wide>
      <div className="mb-4 grid gap-2">
        {(q.data ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/10">
              {c.photo_url ? <img src={c.photo_url} alt="" className="h-full w-full object-cover" /> : <UserCog className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.name}</div>
              <div className="truncate text-[0.65rem] text-muted-foreground">{[c.nationality, c.dob].filter(Boolean).join(" · ")}</div>
            </div>
            <button className={btnGhost} onClick={() => { setForm(c); setEditing(true); }}><Pencil className="h-3 w-3" /></button>
            <button className={btnDanger} onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No coaches yet.</div>}
      </div>

      {editing ? (
        <div className="rounded-2xl border border-border bg-background/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Nationality">
              <CountrySelect value={form.nationality} onChange={(name, c) => setForm({ ...form, nationality: name, nationality_code: c?.code ?? null })} />
            </Field>
            <Field label="Date of birth"><DateWheel value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} /></Field>
            <Field label="Photo">
              <ImageInput value={form.photo_url ?? null} onChange={(v) => setForm({ ...form, photo_url: v })} onFile={async (f) => { const url = await uploadMedia("team-logos", f); if (url) setForm({ ...form, photo_url: url }); }} />
            </Field>
          </div>
          {form.id && <div className="mt-4"><TransfersEditor personType="coach" personId={form.id} /></div>}
          <div className="mt-4 flex justify-end gap-2">
            <button className={btnGhost} onClick={() => { setEditing(false); setForm({}); }}>{form.id ? "Done" : "Cancel"}</button>
            <button className={btnPrimary} onClick={save}>{form.id ? "Save coach" : "Create coach"}</button>
          </div>
        </div>
      ) : (
        <button className={btnPrimary} onClick={() => { setForm({}); setEditing(true); }}><Plus className="h-3.5 w-3.5" /> Add coach</button>
      )}
    </Modal>
  );
}