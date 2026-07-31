import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/db";
import type { Database } from "@/integrations/supabase/types";
import { Field, inputCls, btnPrimary, btnDanger } from "./ui";

type MediaItem = Database["public"]["Tables"]["media_items"]["Row"];
const SOURCES = ["youtube", "instagram", "facebook", "tiktok", "upload", "website"];

export function MediaManager({ ownerType, ownerId }: { ownerType: string; ownerId: string }) {
  const qc = useQueryClient();
  const key = ["admin", "media", ownerType, ownerId];
  const [source, setSource] = useState("youtube");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("media_items").select("*").eq("owner_type", ownerType).eq("owner_id", ownerId).order("sort_order");
      return (data ?? []) as MediaItem[];
    },
  });

  const add = async () => {
    if (!url.trim()) return;
    await supabase.from("media_items").insert({ owner_type: ownerType, owner_id: ownerId, source, title: title.trim() || null, url: url.trim(), sort_order: q.data?.length ?? 0 } as never);
    setTitle(""); setUrl("");
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {(q.data ?? []).map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            <span className="rounded bg-muted px-2 py-1 text-[0.65rem] font-bold uppercase">{item.source}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{item.title || item.url}</div><div className="truncate text-xs text-muted-foreground">{item.url}</div></div>
            <a href={item.url} target="_blank" rel="noreferrer" className="text-muted-foreground" aria-label="Open media"><ExternalLink className="h-4 w-4" /></a>
            <button className={btnDanger} onClick={async () => { await supabase.from("media_items").delete().eq("id", item.id); qc.invalidateQueries({ queryKey: key }); }}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="grid gap-2 rounded-lg border border-border bg-background/50 p-3 sm:grid-cols-3">
        <Field label="Platform"><select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>{SOURCES.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional title" /></Field>
        <Field label="Link"><input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
        <div className="sm:col-span-3"><button className={btnPrimary} onClick={add}><Plus className="h-3.5 w-3.5" /> Add media</button></div>
      </div>
    </div>
  );
}