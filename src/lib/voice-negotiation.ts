/** Deterministic perfect-negotiation collision ownership for every independent pair. */
export function ignoreCollidingOffer(self: string, other: string, makingOffer: boolean, signalingState: string, settingAnswer: boolean) {
  const ready = !makingOffer && (signalingState === "stable" || settingAnswer);
  return self < other && !ready;
}