let timezone: string | undefined;
const listeners = new Set<() => void>();
export function getMatchTimezone() { return timezone; }
export function setMatchTimezone(value: string | null) {
  if (!value || value === timezone) return;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); } catch { return; }
  timezone = value;
  listeners.forEach((listener) => listener());
}
export function subscribeMatchTimezone(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }