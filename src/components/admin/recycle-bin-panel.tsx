import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: number; batch_id: number; table_name: string; label: string | null; deleted_at: string; restored_at: string | null };

/** Everything deleted from the app, grouped by the single action that removed it. */
export function RecycleBinPanel() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["recycle-bin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deleted_records")
        .select("id,batch_id,table_name,label,deleted_at,restored_at")
        .order("id", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const batches = new Map<number, Row[]>();
  for (const r of q.data ?? []) batches.set(r.batch_id, [...(batches.get(r.batch_id) ?? []), r]);

  const restore = async (batch: number) => {
    setBusy(batch);
    const { data, error } = await supabase.rpc("restore_deleted_batch", { _batch_id: batch });
    setBusy(null);
    if (error) return toast.error(`Could not restore: ${error.message}`);
    toast.success(`Restored ${data} item${data === 1 ? "" : "s"}`);
    qc.invalidateQueries();
  };

  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">Anything deleted in the app is kept here. Restore brings back the item and everything removed with it.</p>
      {batches.size === 0 && <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Nothing deleted yet.</p>}
      <div className="space-y-2">
        {[...batches.entries()].map(([batch, rows]) => {
          const main = rows[rows.length - 1];
          const restored = rows.every((r) => r.restored_at);
          return (
            <div key={batch} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{main.label ?? "Untitled"}</div>
                <div className="text-[0.7rem] text-muted-foreground">
                  {main.table_name.replace(/_/g, " ")}{rows.length > 1 ? ` + ${rows.length - 1} linked` : ""} · {new Date(main.deleted_at).toLocaleString()}
                </div>
              </div>
              {restored ? <span className="text-xs text-muted-foreground">Restored</span> : (
                <button disabled={busy === batch} onClick={() => restore(batch)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">
                  {busy === batch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
