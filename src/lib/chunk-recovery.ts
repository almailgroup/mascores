/**
 * After an update, an open page may ask for page files that no longer exist
 * ("Importing a module script failed"). A full reload fetches the fresh ones.
 */
const CHUNK_ERROR = /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|Loading chunk \d+ failed/i;
const KEY = "mas-chunk-reload";

export function isChunkLoadError(error: unknown): boolean {
  const msg = String((error as Error | null)?.message ?? error ?? "");
  return CHUNK_ERROR.test(msg);
}

/** Reloads at most once every 10 seconds, so a real outage can't loop. Returns true if reloading. */
export function reloadForFreshFiles(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage blocked: still reload once */ }
  window.location.reload();
  return true;
}
