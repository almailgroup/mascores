type Person = { id: string; name: string; photo_url?: string | null };
export function eventPlayers(event: { type: string; player: Person | null; assister?: Person | null; sub_out?: Person | null }) {
  const entries = [{ player: event.player, role: /sub/i.test(event.type) ? "In" : "Scorer" }, { player: event.assister, role: "Assist" }, { player: event.sub_out, role: "Out" }];
  const seen = new Set<string>();
  return entries.flatMap(({player,role}) => {
    if (!player || seen.has(player.id)) return [];
    seen.add(player.id);
    return [{player,role}];
  });
}