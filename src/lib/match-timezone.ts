let timezone: string | undefined;
const listeners = new Set<() => void>();
export function getMatchTimezone() { return timezone; }
export function setMatchTimezone(value: string | null) {
  const next = value ?? undefined;
  if (next === timezone) return;
  if (next) { try { new Intl.DateTimeFormat("en", { timeZone: next }); } catch { return; } }
  timezone = next;
  listeners.forEach((listener) => listener());
}
export function subscribeMatchTimezone(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }