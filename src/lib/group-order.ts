/**
 * Group labels ("Group A", "Group B", "المجموعة أ") come from the standings
 * rows and are typed by hand, so the app sorts them itself: Group A first,
 * Group B second, and so on. Ungrouped tables (`null`) sit first when there is
 * a single league table, or last when a group stage runs before the knockouts.
 */
export function compareGroupLabels(a: string | null, b: string | null, nullsFirst = true) {
  if (a === b) return 0;
  if (!a) return nullsFirst ? -1 : 1;
  if (!b) return nullsFirst ? 1 : -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Sort `[label, rows]` pairs from a grouped table into A, B, C… order. */
export function sortGroupEntries<T>(entries: [string | null, T][], nullsFirst = true) {
  return [...entries].sort(([a], [b]) => compareGroupLabels(a, b, nullsFirst));
}
