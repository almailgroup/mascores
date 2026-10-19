/** Alert sounds for every kind of notification shown in the browser.
 *  Each one is synthesised so nothing has to be downloaded. The iPhone app
 *  uses matching recorded files bundled in ios/App/App/Sounds. */

/** Every moment that can make a sound — each has its own. */
export const ALERT_EVENTS = [
  { key: "goal", label: "Goal" },
  { key: "scorer", label: "Goal scorer added" },
  { key: "penalty", label: "Penalty scored" },
  { key: "ownGoal", label: "Own goal" },
  { key: "miss", label: "Penalty missed" },
  { key: "card", label: "Yellow card" },
  { key: "secondYellow", label: "Second yellow card" },
  { key: "redcard", label: "Red card" },
  { key: "sub", label: "Substitution" },
  { key: "injury", label: "Injury substitution" },
  { key: "var", label: "VAR check" },
  { key: "note", label: "Match update" },
  { key: "kickoff", label: "Kick-off" },
  { key: "halftime", label: "Half time" },
  { key: "secondHalf", label: "Second half" },
  { key: "etWait", label: "Waiting for extra time" },
  { key: "etStart", label: "Extra time started" },
  { key: "etBreak", label: "Extra time break" },
  { key: "etSecond", label: "Extra time second half" },
  { key: "shootout", label: "Penalty shootout" },
  { key: "final", label: "Full time" },
  { key: "finalEt", label: "Full time after extra time" },
  { key: "finalPens", label: "Full time after penalties" },
  { key: "resumed", label: "Match resumed" },
  { key: "reminder", label: "Kick-off reminder" },
  { key: "myReminder", label: "My reminder" },
  { key: "voice", label: "Voice room starts" },
  { key: "postponed", label: "Postponed or cancelled" },
] as const;

export type AlertEventKey = (typeof ALERT_EVENTS)[number]["key"];
export type AlertSoundId = AlertEventKey | "none";
export type AlertSoundMap = Partial<Record<AlertEventKey, AlertSoundId>>;

export const ALERT_SOUNDS: { id: AlertSoundId; label: string }[] = [
  ...ALERT_EVENTS.map((e) => ({ id: e.key as AlertSoundId, label: e.label })),
  { id: "none", label: "Silent" },
];

type Tone = { freq: number; to?: number; at: number; length: number; type: OscillatorType; gain?: number };
const T = (freq: number, at: number, length: number, type: OscillatorType = "sine", gain = 0.1, to?: number): Tone => ({ freq, at, length, type, gain, to });
const whistle = (at: number, length: number, freq = 2400): Tone => T(freq, at, length, "square", 0.05, freq * 1.04);
const beeps = (count: number, gap: number, a: number, b: number, type: OscillatorType = "square", gain = 0.05) =>
  Array.from({ length: count }, (_, i) => T(i % 2 ? b : a, i * gap, gap * 0.7, type, gain));

const RECIPES: Record<AlertEventKey, Tone[]> = {
  goal: [T(220, 0, 0.5, "sawtooth", 0.1, 520), T(330, 0.12, 0.55, "triangle", 0.08, 660), T(523, 0.6, 0.5, "triangle", 0.08), T(784, 0.6, 0.5, "triangle", 0.06)],
  scorer: [T(659, 0, 0.18), T(784, 0.09, 0.18), T(988, 0.18, 0.2), T(1319, 0.27, 0.35)],
  penalty: [whistle(0, 0.2), T(90, 0.3, 0.3, "sine", 0.16, 50), T(587, 0.5, 0.5, "triangle", 0.08), T(880, 0.5, 0.5, "triangle", 0.06)],
  ownGoal: [T(500, 0, 0.8, "sawtooth", 0.07, 220), T(300, 0.8, 0.5, "triangle", 0.08, 150)],
  miss: [whistle(0, 0.18), T(320, 0.25, 0.45, "sine", 0.1, 170), T(260, 0.7, 0.55, "sine", 0.08, 120)],
  card: [whistle(0, 0.3, 2600), T(1200, 0.38, 0.12, "square", 0.05, 1500)],
  secondYellow: [whistle(0, 0.15, 2600), whistle(0.25, 0.15, 2600), T(900, 0.5, 0.25, "square", 0.06, 600), T(220, 0.8, 0.4, "sawtooth", 0.06, 180)],
  redcard: [whistle(0, 0.4, 2700), T(180, 0.5, 0.22, "square", 0.1), T(180, 0.78, 0.22, "square", 0.1), T(140, 1.06, 0.4, "square", 0.1)],
  sub: [T(660, 0, 0.18, "triangle", 0.1, 880), T(880, 0.22, 0.18, "triangle", 0.1, 660), T(990, 0.45, 0.25, "sine", 0.06)],
  injury: [T(700, 0, 0.35, "sine", 0.08, 900), T(900, 0.4, 0.35, "sine", 0.08, 700), T(600, 0.8, 0.3, "triangle", 0.07)],
  var: [...beeps(6, 0.13, 1400, 1000), T(500, 0.85, 0.4, "triangle", 0.07)],
  note: [T(880, 0, 0.4, "sine", 0.09), T(1320, 0.15, 0.4, "sine", 0.05)],
  kickoff: [whistle(0, 0.8), T(330, 0.85, 0.5, "triangle", 0.06, 440)],
  halftime: [whistle(0, 0.22), whistle(0.32, 0.55)],
  secondHalf: [whistle(0, 0.6, 2500), T(523, 0.7, 0.3, "triangle", 0.07), T(659, 0.9, 0.4, "triangle", 0.07)],
  etWait: beeps(6, 0.25, 2000, 1600, "square", 0.04),
  etStart: [whistle(0, 0.5), T(110, 0.6, 0.3, "sine", 0.16, 50), T(110, 0.85, 0.3, "sine", 0.16, 50)],
  etBreak: [whistle(0, 0.22, 2300), whistle(0.32, 0.22, 2300), T(440, 0.65, 0.4, "triangle", 0.06)],
  etSecond: [whistle(0, 0.5, 2300), T(130, 0.6, 0.3, "sine", 0.16, 60), T(784, 0.8, 0.4, "triangle", 0.07)],
  shootout: [...Array.from({ length: 12 }, (_, i) => T(180, i * 0.07, 0.06, "square", 0.02 + i * 0.004)), T(80, 0.9, 0.4, "sine", 0.18, 45), T(392, 0.9, 0.5, "sawtooth", 0.05)],
  final: [whistle(0, 0.22), whistle(0.32, 0.22), whistle(0.64, 0.65)],
  finalEt: [whistle(0, 0.22, 2300), whistle(0.32, 0.22, 2300), whistle(0.64, 0.6, 2300), T(392, 1.3, 0.5, "triangle", 0.07), T(523, 1.3, 0.5, "triangle", 0.06)],
  finalPens: [whistle(0, 0.5), T(523, 0.6, 0.6, "triangle", 0.07), T(659, 0.6, 0.6, "triangle", 0.06), T(1047, 0.6, 0.6, "triangle", 0.05)],
  resumed: [whistle(0, 0.3), T(523, 0.4, 0.2, "triangle", 0.07), T(659, 0.5, 0.2, "triangle", 0.07), T(784, 0.6, 0.3, "triangle", 0.07)],
  reminder: [T(988, 0, 0.35, "sine", 0.1), T(784, 0.4, 0.5, "sine", 0.1)],
  myReminder: [...beeps(4, 0.18, 1568, 1319, "sine", 0.07), T(1047, 0.8, 0.5, "sine", 0.09)],
  voice: [T(440, 0, 0.25, "sine", 0.08, 660), T(880, 0.25, 0.5, "sine", 0.08)],
  postponed: [T(440, 0, 0.3, "triangle", 0.08, 330), T(330, 0.35, 0.5, "triangle", 0.08, 220)],
};

/** Plays one of the alert sounds. Silent when the browser blocks audio. */
export function playAlertSound(sound: AlertSoundId | string | undefined | null) {
  if (!sound || sound === "none") return;
  const recipe = RECIPES[sound as AlertEventKey] ?? RECIPES.note;
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
    window.setTimeout(() => { void context.close(); }, 2500);
  } catch { /* audio may need a tap first */ }
}

/** The sound for one moment — its own sound unless the person picked another. */
export function soundFor(map: AlertSoundMap | undefined, key: AlertEventKey): AlertSoundId {
  return map?.[key] ?? key;
}
