import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls, btnPrimary, ImageInput } from "./ui";
import { uploadMedia } from "./upload";
import { CountrySelect } from "@/components/country-select";

type Staff = { id: string; name: string; role: string; photo_url: string | null; nationality_code: string | null; sort_order: number };

/** Everyone around the team besides the coach: assistants, doctors, kit staff. */
export function StaffManager({ teamId }: { teamId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<Staff>>({});
  const key = ["team-staff", teamId];

  const staff = useQuery({
    queryKey: key,
    queryFn: async () =>
      ((await supabase.from("team_staff").select("id,name,role,photo_url,nationality_code,sort_order").eq("team_id", teamId).order("sort_order")).data ?? []) as Staff[],
  });

  const add = async () => {
    if (!draft.name || !draft.role) return;
    await supabase.from("team_staff").insert({
      team_id: teamId, name: draft.name, role: draft.role,
      photo_url: draft.photo_url ?? null, nationality_code: draft.nationality_code ?? null,
      sort_order: (staff.data?.length ?? 0) + 1,
    } as never);
    setDraft({});
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="text-sm font-bold">Staff</div>
      <p className="mb-3 text-xs text-muted-foreground">Assistant coaches, goalkeeping coach, physio, doctor, kit manager — anyone you want shown on the club page.</p>
      <div className="space-y-2">
        {(staff.data ?? []).map((person) => (
          <div key={person.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
            {person.photo_url && <img src={person.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />}
            <div className="min-w-0 flex-1 basis-[55%]">
              <div className="truncate text-sm font-semibold">{person.name}</div>
              <div className="truncate text-[0.7rem] text-muted-foreground">{person.role}</div>
            </div>
            <button className="text-destructive" aria-label="Remove"
              onClick={async () => { await supabase.from("team_staff").delete().eq("id", person.id); qc.invalidateQueries({ queryKey: key }); }}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label="Name"><input className={inputCls} value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
        <Field label="Role"><input className={inputCls} placeholder="Assistant coach" value={draft.role ?? ""} onChange={(e) => setDraft({ ...draft, role: e.target.value })} /></Field>
        <Field label="Nationality"><CountrySelect value={draft.nationality_code} onChange={(_, c) => setDraft({ ...draft, nationality_code: c?.code ?? null })} /></Field>
        <Field label="Photo">
          <ImageInput value={draft.photo_url ?? null} onChange={(v) => setDraft({ ...draft, photo_url: v })}
            onFile={async (f) => { const url = await uploadMedia("player-photos", f); if (url) setDraft({ ...draft, photo_url: url }); }} />
        </Field>
        <div className="self-end sm:col-span-2">
          <button className={btnPrimary} onClick={add}><Plus className="h-3.5 w-3.5" /> Add staff member</button>
        </div>
      </div>
    </div>
  );
}
