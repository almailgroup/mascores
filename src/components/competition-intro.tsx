import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import type { CompetitionTheme } from "@/lib/competition-theme";

const DURATION = 5000;

/**
 * Smooth, airy intro music: a slowly swelling pad chord plus a soft bell
 * arpeggio. No percussion, no sharp attacks — it fades in and out with the
 * animation.
 */
function playSmoothTheme() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    const air = ctx.createBiquadFilter();
    air.type = "lowpass";
    air.frequency.value = 2600;
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 1.2);
    master.gain.setValueAtTime(0.22, ctx.currentTime + 3.4);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 5);
    master.connect(air).connect(ctx.destination);

    // Warm pad: root, fifth, octave, ninth — a calm, open chord.
    for (const freq of [146.83, 220, 293.66, 329.63]) pad(ctx, master, freq, 0, 4.8);
    // Gentle bell arpeggio floating on top.
    const bells: [number, number][] = [[587.33, 0.9], [739.99, 1.5], [880, 2.1], [1174.66, 2.9]];
    for (const [freq, at] of bells) bell(ctx, master, freq, at);

    window.setTimeout(() => void ctx.close(), 5400);
  } catch {
    /* audio is decorative */
  }
}

function pad(ctx: AudioContext, out: GainNode, freq: number, at: number, length: number) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const detuned = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  detuned.type = "triangle";
  osc.frequency.value = freq;
  detuned.frequency.value = freq * 1.004;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.16, t + 1.6);
  gain.gain.linearRampToValueAtTime(0.0001, t + length);
  osc.connect(gain);
  detuned.connect(gain);
  gain.connect(out);
  osc.start(t); detuned.start(t);
  osc.stop(t + length + 0.1); detuned.stop(t + length + 0.1);
}

function bell(ctx: AudioContext, out: GainNode, freq: number, at: number) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.1, t + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 2.3);
}

/**
 * Short branded intro played when a themed competition is opened. It runs once
 * per competition and season for each browsing session, then unmounts itself.
 */
export function CompetitionIntro({ theme, name, season, logoUrl }: {
  theme: CompetitionTheme;
  name: string;
  season: string | null;
  logoUrl: string | null;
}) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `comp-intro:${theme.key}:${name}:${season ?? ""}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    setPlaying(true);
    playSmoothTheme();
  }, [theme.key, name, season]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPlaying(false), DURATION);
    return () => window.clearTimeout(timer);
  }, [playing]);

  if (!playing) return null;

  return (
    <div
      aria-hidden
      className="animate-comp-intro fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      style={{ ...theme.vars, background: theme.hero }}
    >
      <span className="animate-comp-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.28),transparent_62%)]" />

      <div className="relative flex flex-col items-center gap-7 px-8 text-center">
        <div className="animate-comp-ring pointer-events-none absolute -top-8 h-44 w-44 rounded-full border border-white/40 sm:h-56 sm:w-56" />
        <div
          className="animate-mas-logo-in relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[1.75rem] bg-white/95 p-4 sm:h-36 sm:w-36"
          style={{ boxShadow: `0 0 110px 0 ${theme.glow}, 0 18px 44px rgba(0,0,0,0.22)` }}
        >
          {logoUrl
            ? <img src={logoUrl} alt="" className="h-full w-full object-contain" />
            : <Trophy className="h-12 w-12 text-primary" />}
        </div>

        <div className="animate-mas-text-in">
          <div className="text-2xl font-black uppercase leading-tight tracking-[0.12em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.3)] sm:text-4xl">{name}</div>
          {season && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-white/90 backdrop-blur-sm sm:text-sm">
              {season}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-10 h-0.5 w-40 overflow-hidden rounded-full bg-white/25 sm:w-56">
        <span className="animate-comp-progress block h-full w-full origin-left bg-white/90" />
      </div>
    </div>
  );
}
