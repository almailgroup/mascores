/** Alert sounds used for goals, cards, kick-off, full time and voice rooms.
 *  Each one is synthesised in the browser so nothing has to be downloaded. */
export type AlertSoundId = "stadium" | "whistle" | "soft" | "horn" | "drum" | "bell" | "none";

export const ALERT_SOUNDS: { id: AlertSoundId; label: string }[] = [
  { id: "stadium", label: "Stadium roar" },
  { id: "horn", label: "Air horn" },
  { id: "whistle", label: "Referee whistle" },
  { id: "drum", label: "Ultras drum" },
  { id: "bell", label: "Bell" },
  { id: "soft", label: "Soft chime" },
  { id: "none", label: "Silent" },
];

/** Which moments can have their own sound. */
export const ALERT_EVENTS = [
  { key: "goal", label: "Goal", fallback: "stadium" as AlertSoundId },
  { key: "penalty", label: "Penalty", fallback: "horn" as AlertSoundId },
  { key: "card", label: "Yellow or red card", fallback: "whistle" as AlertSoundId },
  { key: "kickoff", label: "Kick-off and reminders", fallback: "bell" as AlertSoundId },
  { key: "final", label: "Full time", fallback: "whistle" as AlertSoundId },
  { key: "voice", label: "Voice room starts", fallback: "soft" as AlertSoundId },
] as const;

export type AlertEventKey = (typeof ALERT_EVENTS)[number]["key"];
export type AlertSoundMap = Partial<Record<AlertEventKey, AlertSoundId>>;

type Tone = { freq: number; to?: number; at: number; length: number; type: OscillatorType; gain?: number };

const RECIPES: Record<Exclude<AlertSoundId, "none">, Tone[]> = {
  stadium: [
    { freq: 220, to: 520, at: 0, length: 0.5, type: "sawtooth", gain: 0.1 },
    { freq: 330, to: 660, at: 0.12, length: 0.55, type: "triangle", gain: 0.08 },
  ],
  horn: [
    { freq: 440, at: 0, length: 0.28, type: "square", gain: 0.09 },
    { freq: 330, at: 0.3, length: 0.4, type: "square", gain: 0.09 },
  ],
  whistle: [
    { freq: 1900, to: 2100, at: 0, length: 0.18, type: "square", gain: 0.06 },
    { freq: 1900, to: 1600, at: 0.22, length: 0.22, type: "square", gain: 0.06 },
  ],
  drum: [
    { freq: 150, to: 60, at: 0, length: 0.18, type: "sine", gain: 0.16 },
    { freq: 150, to: 60, at: 0.24, length: 0.18, type: "sine", gain: 0.14 },
    { freq: 150, to: 60, at: 0.44, length: 0.2, type: "sine", gain: 0.12 },
  ],
  bell: [
    { freq: 880, at: 0, length: 0.45, type: "sine", gain: 0.1 },
    { freq: 1320, at: 0.02, length: 0.4, type: "sine", gain: 0.05 },
  ],
  soft: [
    { freq: 520, to: 700, at: 0, length: 0.35, type: "sine", gain: 0.08 },
  ],
};

/** Plays one of the alert sounds. Silent when the browser blocks audio. */
export function playAlertSound(sound: AlertSoundId | string | undefined | null) {
  if (!sound || sound === "none") return;
  const recipe = RECIPES[sound as Exclude<AlertSoundId, "none">] ?? RECIPES.soft;
  try {
    const context = new AudioContext();
    for (const tone of recipe) {
      const start = context.currentTime + tone.at;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.freq, start);
      if (tone.to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, tone.to), start + tone.length);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(tone.gain ?? 0.1, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.length);
      osc.connect(gain).connect(context.destination);
      osc.start(start);
      osc.stop(start + tone.length + 0.02);
    }
    window.setTimeout(() => { void context.close(); }, 2000);
  } catch { /* audio may need a tap first */ }
}

/** The sound saved for one moment, falling back to a sensible default. */
export function soundFor(map: AlertSoundMap | undefined, key: AlertEventKey): AlertSoundId {
  const fallback = ALERT_EVENTS.find((event) => event.key === key)?.fallback ?? "soft";
  return map?.[key] ?? fallback;
}
