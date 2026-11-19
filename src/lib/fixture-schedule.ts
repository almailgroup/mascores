type Schedule = { kickoff_at: string | null; kickoff_date?: string | null };

/** An announced calendar date is not a confirmed kickoff instant. */
export function scheduleTime(fixture: Schedule): number {
  const value = fixture.kickoff_at ?? (fixture.kickoff_date ? `${fixture.kickoff_date}T12:00:00` : null);
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : Infinity;
}

export function formatAnnouncedDate(date: string, locale?: string, estimated = false, hour12 = false): string {
  const day = new Date(`${date}T12:00:00`);
  const label = day.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
  const time = day.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", hour12 });
  const prefix = estimated ? (locale?.startsWith("ar") ? "تقديري: " : "Est. ") : "";
  return `${prefix}${label} · ${time}`;
}