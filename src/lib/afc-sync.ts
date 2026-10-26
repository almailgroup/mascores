// Pure helpers for the AFC Champions League Two sync (shared by server code and tests).

const NOISE = new Set(["fc", "sc", "fk", "cf", "club", "al", "the", "afc", "sporting", "sports"]);

export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t));
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

export function similarity(a: string, b: string): number {
  const x = bigrams(a), y = bigrams(b);
  if (!x.length || !y.length) return a === b ? 1 : 0;
  const pool = [...y];
  let hit = 0;
  for (const g of x) {
    const i = pool.indexOf(g);
    if (i >= 0) { hit++; pool.splice(i, 1); }
  }
  return (2 * hit) / (x.length + y.length);
}

/** Score how well an API team name matches one of our team names (0..1). */
export function teamScore(apiName: string, ourName: string): number {
  const a = nameTokens(apiName), o = nameTokens(ourName);
  if (!a.length || !o.length) return 0;
  if (o.every((t) => a.includes(t)) || a.every((t) => o.includes(t))) return 1;
  return similarity(a.join(""), o.join(""));
}

export function bestTeam<T extends { id: string; name: string }>(apiName: string, teams: T[]): T | null {
  let best: T | null = null, score = 0;
  for (const t of teams) {
    const s = teamScore(apiName, t.name);
    if (s > score) { score = s; best = t; }
  }
  return score >= 0.75 ? best : null;
}

/** Match a player name from the feed to one of the club's existing players; never invents players. */
export function bestPlayer<T extends { id: string; name: string; short_name?: string | null; shirt_number?: number | null }>(
  apiName: string | null | undefined,
  players: T[],
  shirt?: number | null,
): T | null {
  if (!apiName) return null;
  const a = nameTokens(apiName);
  if (!a.length) return null;
  let best: T | null = null, score = 0;
  for (const p of players) {
    for (const candidate of [p.name, p.short_name].filter(Boolean) as string[]) {
      const o = nameTokens(candidate);
      if (!o.length) continue;
      let s = 0;
      if (a.join(" ") === o.join(" ")) s = 1;
      else {
        // "J. Smith" style: compare the surname, the most reliable token across spellings.
        const surnameA = a[a.length - 1], surnameO = o[o.length - 1];
        const surname = similarity(surnameA, surnameO);
        const overall = similarity(a.join(""), o.join(""));
        s = Math.max(overall, surname >= 0.85 ? 0.8 : 0);
      }
      if (shirt != null && p.shirt_number === shirt) s += 0.1;
      if (s > score) { score = s; best = p; }
    }
  }
  return score >= 0.8 ? best : null;
}

export function mapStatus(short: string): string {
  switch (short) {
    case "1H": case "2H": case "ET": case "BT": case "P": case "LIVE": return "live";
    case "HT": return "ht";
    case "FT": return "ft";
    case "AET": return "aet";
    case "PEN": return "pen";
    case "PST": return "postponed";
    case "CANC": case "ABD": return "cancelled";
    case "AWD": case "WO": return "awarded";
    case "SUSP": case "INT": return "interrupted";
    default: return "scheduled";
  }
}

export function mapEventType(type: string, detail: string): string | null {
  const t = type.toLowerCase(), d = detail.toLowerCase();
  if (t === "goal") {
    if (d.includes("own")) return "own_goal";
    if (d.includes("missed")) return "penalty_miss";
    if (d.includes("penalty")) return "penalty_goal";
    return "goal";
  }
  if (t === "card") {
    if (d.includes("second")) return "second_yellow";
    if (d.includes("red")) return "red";
    return "yellow";
  }
  if (t === "subst") return "substitution";
  if (t === "var") return "var";
  return null;
}
