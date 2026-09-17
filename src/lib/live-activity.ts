/**
 * Lock Screen / Dynamic Island live scores, backed by the native
 * LiveActivityPlugin (see ios/App/App/LiveActivityPlugin.swift).
 *
 * Every function is a no-op on the web, so callers do not need to branch.
 */

export type MatchActivity = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  /** Three-letter codes for the Dynamic Island; derived from the name if omitted. */
  homeShort?: string;
  awayShort?: string;
  homeScore: number;
  awayScore: number;
  /** Display clock, e.g. "67'" or "45+2'". */
  minute: string;
  status: "live" | "ht" | "ft";
};

type LiveActivityBridge = {
  start(options: MatchActivity): Promise<{ id: string }>;
  update(options: Partial<MatchActivity> & { matchId: string }): Promise<void>;
  end(options: { matchId: string }): Promise<void>;
};

function bridge(): LiveActivityBridge | null {
  if (typeof window === "undefined") return null;
  const cap = (window as {
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> };
  }).Capacitor;
  if (cap?.isNativePlatform?.() !== true) return null;
  return (cap.Plugins?.LiveActivity as LiveActivityBridge | undefined) ?? null;
}

/**
 * Puts a match on the Lock Screen.
 *
 * Rejections are swallowed deliberately: the user may have Live Activities
 * turned off, or be on iOS 16.0, and neither should surface as an error in a
 * screen that is only incidentally showing a score.
 */
export async function startMatchActivity(match: MatchActivity): Promise<void> {
  try {
    await bridge()?.start(match);
  } catch {
    /* Live Activities unavailable — the app works the same without them. */
  }
}

export async function updateMatchActivity(
  update: Partial<MatchActivity> & { matchId: string },
): Promise<void> {
  try {
    await bridge()?.update(update);
  } catch {
    /* ignore */
  }
}

export async function endMatchActivity(matchId: string): Promise<void> {
  try {
    await bridge()?.end({ matchId });
  } catch {
    /* ignore */
  }
}
