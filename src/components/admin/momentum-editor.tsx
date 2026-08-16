import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, type Match, type Team } from "@/lib/db";
import { TeamCrest } from "@/components/team-crest";
import { btnGhost, btnPrimary } from "./ui";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

/** Draw the momentum bars for a match: drag up (red = home) or down (blue = away). */
export function MomentumEditor({ match, teams }: { match: Match; teams: Team[] }) {
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);
  const total = match.momentum_minutes || 90;
  const [values, setValues] = useState<number[]>(() => Array.from({ length: total }, () => 0));
  const [busy, setBusy] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const q = useQuery({
    queryKey: ["admin", "momentum", match.id],
    queryFn: async () => (await supabase.from("match_momentum").select("minute,value").eq("match_id", match.id)).data ?? [],
  });

  useEffect(() => {
    if (!q.data) return;
    const map = new Map(q.data.map((r) => [r.minute, r.value]));
    setValues(Array.from({ length: total }, (_, i) => map.get(i + 1) ?? 0));
  }, [q.data, total]);

  const applyAt = (clientX: number, clientY: number) => {
    const el = areaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const idx = Math.min(total - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * total)));
    const rel = (clientY - rect.top) / rect.height; // 0 top .. 1 bottom
    const value = Math.round(Math.max(-100, Math.min(100, (0.5 - rel) * 200)));
    setValues((prev) => { const next = [...prev]; next[idx] = value; return next; });
  };

  const save = async () => {
    setBusy(true);
    const rows = values.map((value, i) => ({ match_id: match.id, minute: i + 1, value }));
    const { error } = await supabase.from("match_momentum").upsert(rows as never, { onConflict: "match_id,minute" });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Momentum saved");
  };

  const clear = async () => {
    setValues(Array.from({ length: total }, () => 0));
    await supabase.from("match_momentum").delete().eq("match_id", match.id);
    toast.success("Momentum cleared");
  };

  return (
    <section className="rounded-lg border border-border bg-background/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Match momentum</h3>
          <p className="text-[0.7rem] text-muted-foreground">One bar = one minute. Drag up for {home?.name ?? "home"} (red), down for {away?.name ?? "away"} (blue).</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">Minutes
            <input type="number" min={45} max={150} defaultValue={total} className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-xs"
              onBlur={async (e) => { const v = Number(e.target.value || 90); if (v !== total) { await supabase.from("matches").update({ momentum_minutes: v }).eq("id", match.id); toast.success("Length updated — reopen the tab"); } }} />
          </label>
          <button type="button" className={btnGhost} onClick={clear}><RotateCcw className="h-3.5 w-3.5" /> Clear</button>
          <button type="button" className={btnPrimary} disabled={busy} onClick={save}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save</button>
        </div>
      </div>
      <div className="flex items-stretch gap-2">
        <div className="flex w-8 shrink-0 flex-col justify-between">
          <TeamCrest name={home?.name} logo={home?.logo_url} className="h-7 w-7" />
          <TeamCrest name={away?.name} logo={away?.logo_url} className="h-7 w-7" />
        </div>
        <div
          ref={areaRef}
          onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); applyAt(e.clientX, e.clientY); }}
          onPointerMove={(e) => { if (dragging.current) applyAt(e.clientX, e.clientY); }}
          onPointerUp={() => { dragging.current = false; }}
          onPointerLeave={() => { dragging.current = false; }}
          className="relative flex h-44 min-w-0 flex-1 touch-none select-none items-stretch overflow-hidden rounded-lg bg-muted/40"
        >
          <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-border" />
          <span className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-foreground" style={{ left: `${(45 / total) * 100}%` }} />
          {values.map((value, i) => (
            <div key={i} className="pointer-events-none relative flex-1">
              {value > 0 && <span className="absolute bottom-1/2 left-px right-px rounded-t-sm bg-destructive" style={{ height: `${Math.abs(value) / 2}%` }} />}
              {value < 0 && <span className="absolute left-px right-px top-1/2 rounded-b-sm bg-primary" style={{ height: `${Math.abs(value) / 2}%` }} />}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[0.7rem] text-muted-foreground">Goals and cards you log in the timeline appear automatically on the matching minute.</p>
    </section>
  );
}