import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import type { CompetitionTheme } from "@/lib/competition-theme";

const DURATION = 3000;

/** Plucked oud/qanun-style flourish on a Hijaz scale, synthesised in the browser. */
function playArabianFlourish() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);

    // Hijaz-flavoured run, then a held root/fifth chord.
    const notes: [number, number][] = [
      [293.66, 0], [311.13, 0.13], [369.99, 0.26], [392.0, 0.39],
      [440.0, 0.52], [466.16, 0.65], [554.37, 0.78], [587.33, 0.95],
    ];
    for (const [freq, at] of notes) pluck(ctx, master, freq, at, 0.9);
    pluck(ctx, master, 293.66, 1.35, 1.7);
    pluck(ctx, master, 440.0, 1.38, 1.7);
    pluck(ctx, master, 587.33, 1.42, 1.7);

    // Soft frame-drum accents.
    for (const at of [0, 0.78, 1.35]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120, ctx.currentTime + at);
      osc.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + at + 0.22);
      gain.gain.setValueAtTime(0.5, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.3);
      osc.connect(gain).connect(master);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.32);
    }

    window.setTimeout(() => void ctx.close(), 3400);
  } catch {
    /* audio is decorative */
  }
}

function pluck(ctx: AudioContext, out: GainNode, freq: number, at: number, decay: number) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = "triangle";
  osc2.type = "sawtooth";
  osc.frequency.value = freq;
  osc2.frequency.value = freq * 2.01;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3200, t);
  filter.frequency.exponentialRampToValueAtTime(700, t + decay);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.32, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(out);
  osc.start(t); osc2.start(t);
  osc.stop(t + decay + 0.05); osc2.stop(t + decay + 0.05);
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
    playArabianFlourish();
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
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.22),transparent_60%)]" />

      <div className="relative flex flex-col items-center gap-6 px-8 text-center">
        <div className="animate-comp-ring pointer-events-none absolute -top-6 h-40 w-40 rounded-full border border-white/40 sm:h-52 sm:w-52" />
        <div
          className="animate-mas-logo-in relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[1.75rem] bg-white/95 p-4 sm:h-36 sm:w-36"
          style={{ boxShadow: `0 0 90px 0 ${theme.glow}, 0 18px 40px rgba(0,0,0,0.25)` }}
        >
          {logoUrl
            ? <img src={logoUrl} alt="" className="h-full w-full object-contain" />
            : <Trophy className="h-12 w-12 text-primary" />}
        </div>

        <div className="animate-mas-text-in">
          <div className="text-2xl font-black uppercase leading-tight tracking-[0.12em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)] sm:text-4xl">{name}</div>
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
