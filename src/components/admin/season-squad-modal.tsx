import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Modal, Field, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { PlayerAvatar } from "@/components/player-avatar";
import type { Player, Team } from "@/lib/db";

const POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward", "Unknown"] as const;

type SeasonRow = {
  id: string;
  player_id: string;
  shirt_number: number | null;
  position: string | null;
  player: Pick<Player, "id" | "name" | "photo_url" | "position" | "nationality"> | null;
};

/**
 * Squad for a past season. It starts empty and never touches the club's current
 * squad: rows live in team_season_players so history stays frozen.
 */
export function SeasonSquadModal({ team, season, onClose }: { team: Team; season: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [pick, setPick] = useState("");
  const [shirt, setShirt] = useState("");

  const key = ["admin", "season-squad", team.id, season];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase
        .from("team_season_players")
        .select("id, player_id, shirt_number, position, player:player_id(id,name,photo_url,position,nationality)")
        .eq("team_id", team.id)
        .eq("season", season)
        .order("shirt_number", { nullsFirst: false });
      return (data ?? []) as unknown as SeasonRow[];
    },
  });

  const pool = useQuery({
    enabled: adding,
    queryKey: ["admin", "season-squad-pool", team.id],
    queryFn: async () => {
      const current = await supabase.from("players").select("id,name,photo_url,position,nationality").eq("team_id", team.id).order("name");
      const others = await supabase.from("players").select("id,name,photo_url,position,nationality").neq("team_id", team.id).order("name").limit(500);
      const free = await supabase.from("players").select("id,name,photo_url,position,nationality").is("team_id", null).order("name");
      const rows = [...(current.data ?? []), ...(free.data ?? []), ...(others.data ?? [])] as SeasonRow["player"][];
      return rows.filter((row, i, all) => !!row && all.findIndex((r) => r?.id === row?.id) === i) as NonNullable<SeasonRow["player"]>[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });
  const taken = new Set((q.data ?? []).map((row) => row.player_id));
  const term = search.trim().toLowerCase();

  const add = async () => {
    const player = (pool.data ?? []).find((p) => p.id === pick);
    if (!player) return;
    await supabase.from("team_season_players").insert({
      team_id: team.id,
      season,
      player_id: player.id,
      position: player.position ?? null,
      shirt_number: shirt ? Number(shirt) : null,
    } as never);
    setPick(""); setShirt(""); setSearch(""); setAdding(false);
    invalidate();
  };

  return (
    <Modal open onClose={onClose} title={`${team.name} — ${season} squad`} wide>
      <p className="mb-3 rounded-xl border border-border bg-background/50 p-3 text-xs text-muted-foreground">
        This is the squad for the {season} season only. Adding or removing players here never changes the club's current squad.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add player to {season}</button>
      </div>

      {adding && (
        <div className="mb-4 rounded-2xl border border-border bg-background/50 p-3">
          <Field label="Pick from the current squad, free agents or any player in the database">
            <input autoFocus className={inputCls} placeholder="Type a player name" value={search} onChange={(e) => { setSearch(e.target.value); setPick(""); }} />
          </Field>
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {(pool.data ?? []).filter((p) => !taken.has(p.id) && p.name.toLowerCase().includes(term)).slice(0, 60).map((p) => (
              <button key={p.id} type="button" onClick={() => setPick(p.id)}
                className={`flex w-full items-center gap-2 rounded-lg border p-2 text-start ${pick === p.id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"}`}>
                <PlayerAvatar src={p.photo_url} name={p.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-[0.65rem] text-muted-foreground">{[p.position, p.nationality].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            ))}
            {(pool.data ?? []).filter((p) => !taken.has(p.id) && p.name.toLowerCase().includes(term)).length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">{pool.isLoading ? "Loading players…" : "No player matches that name"}</div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-end gap-2">
            <Field label="Shirt number"><input className={`${inputCls} max-w-24`} inputMode="numeric" value={shirt} onChange={(e) => setShirt(e.target.value.replace(/\D/g, ""))} /></Field>
            <button className={btnGhost} onClick={() => { setAdding(false); setPick(""); setSearch(""); }}>Cancel</button>
            <button className={btnPrimary} disabled={!pick} onClick={add}>Add to {season}</button>
          </div>
        </div>
      )}

      <div className="grid gap-5">
        {POSITIONS.map((position) => {
          const rows = (q.data ?? []).filter((row) => ((row.position ?? row.player?.position) ?? "Unknown") === position);
          if (position === "Unknown" && rows.length === 0) return null;
          return (
            <section key={position}>
              <h4 className="mb-2 text-xs font-bold uppercase text-muted-foreground">{position}</h4>
              <div className="grid gap-2">
                {rows.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
                    <PlayerAvatar src={row.player?.photo_url ?? null} name={row.player?.name ?? "?"} />
                    <div className="min-w-0 flex-1 basis-32">
                      <div className="truncate text-sm font-medium">{row.player?.name ?? "Unknown player"}</div>
                      <div className="truncate text-[0.65rem] text-muted-foreground">{[row.position ?? row.player?.position, row.player?.nationality].filter(Boolean).join(" · ")}</div>
                    </div>
                    <input className={`${inputCls} max-w-20`} inputMode="numeric" placeholder="#" defaultValue={row.shirt_number ?? ""}
                      onBlur={async (e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        await supabase.from("team_season_players").update({ shirt_number: value ? Number(value) : null }).eq("id", row.id);
                        invalidate();
                      }} />
                    <button className={btnDanger} onClick={async () => { await supabase.from("team_season_players").delete().eq("id", row.id); invalidate(); }}><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
                {rows.length === 0 && <div className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No {position.toLowerCase()}s</div>}
              </div>
            </section>
          );
        })}
      </div>

      {(q.data ?? []).length === 0 && !adding && (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Users className="h-5 w-5" /> This season starts with no players. Add the ones who played in {season}.
        </div>
      )}
    </Modal>
  );
}
