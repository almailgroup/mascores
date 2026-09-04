/**
 * Lineup-friendly player name.
 *
 * When no short name is stored, build one automatically: "Ali Aziz" -> "A. Aziz",
 * keeping the last word whole and initialising every earlier word. Arabic names
 * are returned as-is because initials are not used there.
 */
export function autoShortName(full?: string | null): string {
  const name = (full ?? "").trim().replace(/\s+/g, " ");
  if (!name) return "";
  if (/[\u0600-\u06FF]/.test(name)) return name;
  const parts = name.split(" ");
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1]!;
  const initials = parts.slice(0, -1).map((word) => `${word[0]!.toUpperCase()}.`).join("");
  return `${initials} ${last}`;
}

/** Stored short name when present, otherwise an automatic one. */
export function displayShortName(short?: string | null, full?: string | null): string {
  const stored = (short ?? "").trim();
  return stored || autoShortName(full);
}
