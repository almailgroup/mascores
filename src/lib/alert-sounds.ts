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

export const ALERT_RECIPES: Record<AlertEventKey, Tone[]> = {
  goal: [T(220,0,0.5,"sawtooth",0.035,520),T(330,0.12,0.55,"triangle",0.028,660)],
  scorer: [T(659,0,0.2,"sine",0.035),T(784,0.12,0.25,"sine",0.025)],
  penalty: [T(440,0,0.28,"triangle",0.035),T(330,0.3,0.35,"triangle",0.03)],
  ownGoal: [T(440,0,0.3,"sine",0.035,330),T(330,0.2,0.35,"sine",0.025,220)],
  miss: [T(320,0,0.4,"sine",0.035,170),T(260,0.42,0.5,"sine",0.028,130)],
  card: [T(1900,0,0.18,"sine",0.02,2100),T(1900,0.22,0.22,"sine",0.02,1600)],
  secondYellow: [T(880,0,0.18,"sine",0.03),T(660,0.2,0.22,"sine",0.025)],
  redcard: [T(180,0,0.22,"triangle",0.035),T(180,0.28,0.22,"triangle",0.035),T(140,0.56,0.3,"triangle",0.03)],
  sub: [T(660,0,0.2,"sine",0.03),T(880,0.2,0.25,"sine",0.025)],
  injury: [T(600,0,0.3,"sine",0.03),T(440,0.25,0.3,"sine",0.025)],
  var: [T(660,0,0.15,"sine",0.025),T(660,0.2,0.2,"sine",0.025)],
  note: [T(520,0,0.35,"sine",0.028,700)],
  kickoff: [T(880,0,0.45,"sine",0.035),T(1320,0.02,0.4,"sine",0.018)],
  halftime: [T(660,0,0.3,"sine",0.03),T(520,0.2,0.35,"sine",0.025)],
  secondHalf: [T(520,0,0.25,"sine",0.03),T(660,0.2,0.3,"sine",0.025)],
  etWait: [T(440,0,0.35,"sine",0.03)],
  etStart: [T(440,0,0.25,"sine",0.03),T(784,0.2,0.3,"sine",0.025)],
  etBreak: [T(784,0,0.25,"sine",0.03),T(440,0.2,0.3,"sine",0.025)],
  etSecond: [T(587,0,0.25,"sine",0.03),T(784,0.2,0.3,"sine",0.025)],
  shootout: [T(523,0,0.2,"sine",0.03),T(659,0.2,0.25,"sine",0.025)],
  final: [T(1900,0,0.18,"sine",0.02,2100),T(1900,0.22,0.22,"sine",0.02,1600)],
  finalEt: [T(659,0,0.3,"sine",0.03),T(523,0.2,0.35,"sine",0.025)],
  finalPens: [T(784,0,0.3,"sine",0.03),T(523,0.2,0.35,"sine",0.025)],
  resumed: [T(520,0,0.25,"sine",0.03),T(700,0.2,0.3,"sine",0.025)],
  reminder: [T(880,0,0.45,"sine",0.035),T(1320,0.02,0.4,"sine",0.018)],
  myReminder: [T(784,0,0.3,"sine",0.03),T(988,0.2,0.35,"sine",0.025)],
  voice: [T(520,0,0.35,"sine",0.028,700)],
  postponed: [T(440,0,0.3,"sine",0.03,330),T(330,0.25,0.3,"sine",0.025,220)],
};
const RECIPES = ALERT_RECIPES;

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
