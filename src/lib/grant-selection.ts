export function grantTeam(scope: string, teamId: string | null): string | null {
  return scope === "club_news" || scope === "rabta" ? teamId : null;
}

export function isSelectedGrant(row: { scope: string; team_id: string | null }, scopes: readonly string[], teamId: string | null): boolean {
  return scopes.includes(row.scope) && row.team_id === grantTeam(row.scope, teamId);
}