import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { syncAfcChampionsLeagueTwo, type SyncChange } from "@/lib/afc-sync.functions";
import { Modal, btnGhost, btnPrimary } from "./ui";

export const AFC_CL2_SLUG = "afc-champions-league-two";

type Result = { applied: boolean; results: SyncChange[]; unmatchedFixtures: string[]; remaining: number | null };

export function AfcSyncButton({ competitionId, onSynced }: { competitionId: string; onSynced: () => void }) {
  const run = useServerFn(syncAfcChampionsLeagueTwo);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const timer = useRef<number | null>(null);

  async function go(apply: boolean) {
    setBusy(true); setError(null);
    try {
      const r = await run({ data: { competitionId, apply } });
      setResult(r);
      if (apply) onSynced();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally { setBusy(false); }
  }

  // Live mode: apply every 3 minutes while this window stays open (about 30 requests per match).
  useEffect(() => {
    if (!auto || !open) return;
    timer.current = window.setInterval(() => { void go(true); }, 180000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, open]);

  return (
    <>
      <button className={btnGhost} onClick={() => { setOpen(true); setResult(null); void go(false); }}>
        <RefreshCw className="h-3.5 w-3.5" /> Sync AFC
      </button>
      <Modal open={open} onClose={() => { setOpen(false); setAuto(false); }} title="Sync AFC Champions League Two" wide>
        <div className="grid gap-3 text-sm">
          <p className="text-muted-foreground">Reads AFC matches from yesterday, today and tomorrow (the free plan limit) and updates scores, status, minute, kickoff times and events. Your players, photos and names are never changed — events link to existing players only.</p>
          {busy && <p className="font-semibold">Checking…</p>}
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 font-semibold text-destructive">{error}</p>}
          {result && (
            <>
              {result.results.length === 0 && <p className="font-semibold">Everything is already up to date.</p>}
              {result.results.map((r) => (
                <div key={r.matchId} className="rounded-xl border border-border bg-card p-3">
                  <p className="font-bold">{r.label}</p>
                  {r.changes.map((c) => <p key={c} className="text-xs text-muted-foreground">{c}</p>)}
                  {r.newEvents > 0 && <p className="text-xs text-muted-foreground">{r.newEvents} new match events</p>}
                  {r.unmatchedPlayers.length > 0 && (
                    <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">Not found in squad (saved as name only): {r.unmatchedPlayers.join(", ")}</p>
                  )}
                </div>
              ))}
              {result.unmatchedFixtures.length > 0 && (
                <p className="text-xs text-muted-foreground">Not in MaScores yet: {result.unmatchedFixtures.join(" · ")}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {result.applied ? "Saved." : "Preview only — nothing saved yet."}
                {result.remaining != null && ` ${result.remaining} of 100 daily requests left.`}
              </p>
            </>
          )}
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Live mode: save automatically every 3 minutes while this window is open
          </label>
          <div className="flex justify-end gap-2">
            <button className={btnGhost} disabled={busy} onClick={() => go(false)}>Preview again</button>
            <button className={btnPrimary} disabled={busy || !result || (!result.applied && result.results.length === 0)} onClick={() => go(true)}>Confirm &amp; save</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
