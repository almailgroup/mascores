export type SocialLinkDraft = { player_id: string; network: string; url: string };
export function validateSocialDrafts(raw: unknown, allowedIds: Set<string>, notes: string): SocialLinkDraft[] {
  if (!Array.isArray(raw)) return [];
  const networks = new Set(["instagram","x","facebook","youtube","tiktok","telegram","website"]);
  return raw.flatMap(row => {
    if (!row || typeof row !== "object") return [];
    const {player_id,network,url} = row as Record<string,unknown>;
    if (typeof player_id!=="string" || !allowedIds.has(player_id) || typeof network!=="string" || !networks.has(network) || typeof url!=="string" || !notes.includes(url)) return [];
    try { const parsed=new URL(url); if(parsed.protocol!=="https:" && parsed.protocol!=="http:")return []; } catch { return []; }
    return [{player_id,network,url}];
  });
}