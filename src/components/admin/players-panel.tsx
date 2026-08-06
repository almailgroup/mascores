import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Player, type Team } from "@/lib/db";
import { inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { PlayerEditor } from "./player-editor";
import { releasePlayerToFreeAgent, deletePlayerForever } from "@/lib/player-moves";
import { PlayerAvatar } from "@/components/player-avatar";
import { Plus, Pencil, Trash2, UserMinus, Users } from "lucide-react";

type Row = Player & { team: Pick<Team, "id" | "name"> | null };

/** Every player in the database — edit, release or delete permanently. */
export function PlayersPanel() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [scope, setScope] = useState<"all" | "free">("all");
  const [editing, setEditing] = useState<Partial<Player> | null>(null);

  const q = useQuery({
    queryKey: ["admin", "all-players", term, scope],
    queryFn: async () => {
      let query = supabase.from("players").select("*, team:team_id(id,name)").order("name").limit(300);
      if (term.trim().length > 1) query = query.ilike("name", `%${term.trim()}%`);
      if (scope === "free") query = query.is("team_id", null);
      const { data } = await query;
      return (data ?? []) as unknown as Row[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "all-players"] });

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-5 w-5" /></div>
        <div><h2 className="text-lg font-bold">Player library</h2><p className="text-xs text-muted-foreground">Edit anyone, release players to free agents or remove them from the database.</p></div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Search players…" value={term} onChange={(e) => setTerm(e.target.value)} />
        <button className={scope === "all" ? btnPrimary : btnGhost} onClick={() => setScope("all")}>All players</button>
        <button className={scope === "free" ? btnPrimary : btnGhost} onClick={() => setScope("free")}>Free agents</button>
        <button className={btnPrimary} onClick={() => setEditing({})}><Plus className="h-3.5 w-3.5" /> New player</button>
      </div>

      <div className="grid gap-2">
        {(q.data ?? []).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
            <PlayerAvatar src={p.photo_url} name={p.name} />
            <div className="min-w-0 flex-1 basis-40">
              <div className="truncate text-sm font-semibold">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">{[p.team?.name ?? "Free agent", p.position, p.shirt_number ? `#${p.shirt_number}` : null].filter(Boolean).join(" · ")}</div>
            </div>
            <button className={btnGhost} onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
            {p.team_id && <button className={btnGhost} onClick={async () => { await releasePlayerToFreeAgent(p, p.team?.name ?? null); invalidate(); }}><UserMinus className="h-3.5 w-3.5" /> Release</button>}
            <button className={btnDanger} onClick={async () => { if (!confirm(`Delete ${p.name} from the database permanently?`)) return; await deletePlayerForever(p.id); invalidate(); }}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No players found.</div>}
      </div>

      {editing && <PlayerEditor player={editing} teamId={editing.team_id ?? null} onClose={() => { setEditing(null); invalidate(); }} />}
    </div>
  );
}
