export type TimeFormat = "12" | "24";

/** Preferred clock display for kickoff times. Device-local default, synced with the profile. */
let current: TimeFormat = "12";
const listeners = new Set<() => void>();

export function getTimeFormat(): TimeFormat {
  return current;
}

export function setTimeFormat(f: TimeFormat): void {
  if (f === current) return;
  current = f;
  try {
    localStorage.setItem("mas:time-format", f);
  } catch {
    /* storage unavailable — keep in memory */
  }
  listeners.forEach((l) => l());
}

/** Client-only: adopt the stored format once after mount so SSR and first render agree. */
export function initTimeFormat(): void {
  try {
    const stored = localStorage.getItem("mas:time-format");
    if ((stored === "12" || stored === "24") && stored !== current) {
      current = stored;
      listeners.forEach((l) => l());
    }
  } catch {
    /* ignore */
  }
}

export function subscribeTimeFormat(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
