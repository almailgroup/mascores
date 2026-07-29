import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, slugify, type NewsPost } from "@/lib/db";
import { Field, Modal, ImageInput, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { uploadMedia } from "./upload";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Form = Partial<NewsPost>;

export function NewsPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>({});

  const q = useQuery({
    queryKey: ["admin", "news"],
    queryFn: async () => {
      const { data } = await supabase.from("news_posts").select("*").order("created_at", { ascending: false });
      return (data ?? []) as NewsPost[];
    },
  });

  const save = async () => {
    if (!form.title) return;
    const payload = { ...form, slug: form.slug || slugify(form.title), body_markdown: form.body_markdown ?? "" };
    if (form.id) await supabase.from("news_posts").update(payload).eq("id", form.id);
    else await supabase.from("news_posts").insert(payload as never);
    setOpen(false); setForm({});
    qc.invalidateQueries({ queryKey: ["admin", "news"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("news_posts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "news"] });
  };

  const togglePublish = async (p: NewsPost) => {
    await supabase.from("news_posts").update({ published_at: p.published_at ? null : new Date().toISOString() }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["admin", "news"] });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">News</h2>
        <button className={btnPrimary} onClick={() => { setForm({}); setOpen(true); }}><Plus className="h-3.5 w-3.5" /> New post</button>
      </div>
      <div className="grid gap-2">
        {(q.data ?? []).map((n) => (
          <div key={n.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            {n.cover_url && <img src={n.cover_url} alt="" className="h-12 w-16 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{n.title}</div>
              <div className="truncate text-xs text-muted-foreground">{n.published_at ? `Published · ${new Date(n.published_at).toLocaleString()}` : "Draft"}</div>
            </div>
            <button className={btnGhost} onClick={() => togglePublish(n)}>{n.published_at ? "Unpublish" : "Publish"}</button>
            <button className={btnGhost} onClick={() => { setForm(n); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
            <button className={btnDanger} onClick={() => remove(n.id)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No posts yet.</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit post" : "New post"} wide>
        <div className="grid gap-3">
          <Field label="Title"><input className={inputCls} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Slug"><input className={inputCls} value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
            <Field label="Author"><input className={inputCls} value={form.author_display ?? ""} onChange={(e) => setForm({ ...form, author_display: e.target.value })} /></Field>
          </div>
          <Field label="Cover">
            <ImageInput value={form.cover_url ?? null} onChange={(v) => setForm({ ...form, cover_url: v })} onFile={async (f) => { const url = await uploadMedia("news-covers", f); if (url) setForm({ ...form, cover_url: url }); }} />
          </Field>
          <Field label="Excerpt"><textarea rows={2} className={inputCls} value={form.excerpt ?? ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></Field>
          <Field label="Body (Markdown)"><textarea rows={8} className={inputCls} value={form.body_markdown ?? ""} onChange={(e) => setForm({ ...form, body_markdown: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.checked ? new Date().toISOString() : null })} /> Publish now</label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Save</button>
        </div>
      </Modal>
    </div>
  );
}