import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, X, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls, btnPrimary, btnGhost, btnDanger, Modal, ImageInput } from "./ui";
import { uploadMedia } from "./upload";

type Post = {
  id: string; team_id: string; title: string; body: string; photo_url: string | null;
  meeting_place: string | null; status: string; created_at: string;
};

/** Rabta / Ultras posts: where the ultras will gather, waiting for approval. */
export function UltrasPanel({ isOwner = false }: { isOwner?: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Post> | null>(null);

  const teams = useQuery({
    queryKey: ["ultras-teams"],
    queryFn: async () => (await supabase.from("teams").select("id,name").order("name")).data ?? [],
  });
  const posts = useQuery({
    queryKey: ["ultras-posts"],
    queryFn: async () =>
      ((await supabase.from("ultras_posts").select("id,team_id,title,body,photo_url,meeting_place,status,created_at").order("created_at", { ascending: false })).data ?? []) as Post[],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["ultras-posts"] });
  const teamName = new Map((teams.data ?? []).map((t) => [t.id, t.name]));

  const setStatus = async (id: string, status: string) => {
    await supabase.from("ultras_posts").update({ status }).eq("id", id);
    refresh();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Rabta / Ultras</h2>
          <p className="mt-1 text-sm text-muted-foreground">Where each club's ultras will meet. Only approved posts show on the club page.</p>
        </div>
        <button className={btnPrimary} onClick={() => setEditing({ status: isOwner ? "approved" : "pending" })}><Plus className="h-3.5 w-3.5" /> New post</button>
      </div>

      {posts.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      <div className="space-y-2">
        {(posts.data ?? []).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
            {p.photo_url && <img src={p.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />}
            <div className="min-w-0 flex-1 basis-[55%]">
              <div className="truncate text-sm font-bold">{p.title}</div>
              <div className="truncate text-[0.7rem] text-muted-foreground">{teamName.get(p.team_id) ?? "Club"}{p.meeting_place ? ` · ${p.meeting_place}` : ""}</div>
              <div className={`text-[0.65rem] font-bold ${p.status === "approved" ? "text-emerald-600" : p.status === "pending" ? "text-amber-600" : "text-destructive"}`}>{p.status}</div>
            </div>
            {isOwner && p.status !== "approved" && <button className={btnGhost} onClick={() => setStatus(p.id, "approved")}><Check className="h-3.5 w-3.5" /> Approve</button>}
            {isOwner && p.status !== "rejected" && <button className={btnGhost} onClick={() => setStatus(p.id, "rejected")}><X className="h-3.5 w-3.5" /> Reject</button>}
            <button className={btnGhost} onClick={() => setEditing(p)}>Edit</button>
            <button className={btnDanger} onClick={async () => { await supabase.from("ultras_posts").delete().eq("id", p.id); refresh(); }}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {!posts.isLoading && (posts.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No ultras posts yet.</p>}
      </div>

      {editing && (
        <UltrasEditor
          post={editing}
          teams={teams.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function UltrasEditor({ post, teams, onClose, onSaved }: {
  post: Partial<Post>;
  teams: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Post>>(post);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Post>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.team_id || !form.title) { setError("Pick a club and add a title."); return; }
    setBusy(true); setError(null);
    const { data: session } = await supabase.auth.getUser();
    const payload = {
      team_id: form.team_id,
      title: form.title,
      body: form.body ?? "",
      photo_url: form.photo_url ?? null,
      meeting_place: form.meeting_place ?? null,
      status: form.status ?? "approved",
      author_id: form.id ? undefined : session.user?.id ?? null,
    };
    const res = form.id
      ? await supabase.from("ultras_posts").update(payload).eq("id", form.id)
      : await supabase.from("ultras_posts").insert(payload as never);
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={form.id ? "Edit ultras post" : "New ultras post"}>
      <div className="space-y-3">
        <Field label="Club">
          <select className={inputCls} value={form.team_id ?? ""} onChange={(e) => set({ team_id: e.target.value })}>
            <option value="">Pick a club…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Title"><input className={inputCls} value={form.title ?? ""} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Where will they meet?"><input className={inputCls} value={form.meeting_place ?? ""} onChange={(e) => set({ meeting_place: e.target.value })} placeholder="North stand, gate 4" /></Field>
        <Field label="Details"><textarea rows={5} className={inputCls} value={form.body ?? ""} onChange={(e) => set({ body: e.target.value })} /></Field>
        <Field label="Photo">
          <ImageInput
            value={form.photo_url ?? null}
            onChange={(v) => set({ photo_url: v })}
            onFile={async (f) => { const url = await uploadMedia("news-covers", f); if (url) set({ photo_url: url }); }}
          />
        </Field>
        <Field label="Status">
          <select className={inputCls} value={form.status ?? "approved"} onChange={(e) => set({ status: e.target.value })}>
            <option value="approved">Approved (visible)</option>
            <option value="pending">Waiting for approval</option>
            <option value="rejected">Rejected</option>
          </select>
        </Field>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button className={btnPrimary} disabled={busy} onClick={save}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save</button>
          <button className={btnGhost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
