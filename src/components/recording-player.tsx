import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Moment = { t: number; ids: string[] };
type Person = { id: string; name: string; avatar: string | null };

function parseTimeline(raw: unknown): { moments: Moment[]; people: Map<string, Person> } {
  const value = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as { moments?: Moment[]; people?: Person[] };
  const moments = Array.isArray(value.moments) ? value.moments.filter((m) => typeof m?.t === "number" && Array.isArray(m.ids)) : [];
  return { moments, people: new Map((value.people ?? []).map((p) => [p.id, p])) };
}

/** Who was talking at a given second; short silences keep the last speaker visible. */
export function speakersAt(moments: Moment[], time: number, hold = 1.2) {
  let current: Moment | undefined;
  let lastWithSpeakers: Moment | undefined;
  for (const m of moments) {
    if (m.t > time) break;
    current = m;
    if (m.ids.length) lastWithSpeakers = m;
  }
  if (current?.ids.length) return current.ids;
  if (current && lastWithSpeakers && time - current.t < hold) return lastWithSpeakers.ids;
  return [];
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The app's own replay player: play/pause, skip, a seek bar and the current speaker's picture. */
export function RecordingPlayer({ src, loading, failed, onRetry, duration, cover, timeline }: {
  src?: string; loading?: boolean; failed?: boolean; onRetry: () => void; duration: number; cover: string | null; timeline?: unknown;
}) {
  const { lang } = useI18n();
  const label = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(duration || 0);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);
  const { moments, people } = useMemo(() => parseTimeline(timeline), [timeline]);
  const ids = speakersAt(moments, time);
  const talking = ids.map((id) => people.get(id)).filter(Boolean) as Person[];

  useEffect(() => { setError(false); }, [src]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (!el.paused) { el.pause(); return; }
    try { setBuffering(true); await el.play(); } catch { setError(true); } finally { setBuffering(false); }
  };
  const seek = (to: number) => { const el = audioRef.current; if (!el) return; el.currentTime = Math.max(0, Math.min(length || el.duration || 0, to)); setTime(el.currentTime); };

  const unavailable = failed || error;
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-3 flex min-h-14 items-center gap-3">
        {talking.length && playing ? (
          <>
            <div className="flex -space-x-2">
              {talking.slice(0, 3).map((p) => (
                <span key={p.id} className="relative">
                  <span className="pointer-events-none absolute -inset-1 animate-ping rounded-full border-2 border-primary/50" />
                  {p.avatar
                    ? <img src={p.avatar} alt="" className="relative h-12 w-12 rounded-full border-2 border-primary object-cover" />
                    : <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-muted text-sm font-bold">{p.name.slice(0, 1).toUpperCase()}</span>}
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{talking.map((p) => p.name).join(", ")}</div>
              <div className="text-xs font-semibold text-primary">{label("Speaking", "يتحدث")}</div>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <Mic className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="text-xs font-semibold text-muted-foreground">
              {unavailable ? label("This recording can't play right now", "تعذر تشغيل هذا التسجيل الآن") : playing ? label("Listening…", "جارٍ الاستماع…") : label("Tap play to listen", "اضغط تشغيل للاستماع")}
            </div>
          </>
        )}
      </div>

      <input
        type="range" min={0} max={Math.max(1, length)} step={0.1} value={Math.min(time, length || time)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label={label("Seek", "تقديم")}
        disabled={!src}
        className="h-1.5 w-full cursor-pointer accent-primary"
      />
      <div className="mt-1 flex justify-between text-[0.65rem] font-semibold tabular-nums text-muted-foreground"><span>{fmt(time)}</span><span>{fmt(length)}</span></div>

      <div className="mt-2 flex items-center justify-center gap-5">
        <button type="button" disabled={!src} onClick={() => seek(time - 10)} aria-label={label("Back 10 seconds", "رجوع 10 ثوانٍ")} className="text-muted-foreground disabled:opacity-40"><RotateCcw className="h-5 w-5" /></button>
        {unavailable ? (
          <button type="button" onClick={() => { setError(false); onRetry(); }} className="inline-flex h-12 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">{label("Retry", "إعادة المحاولة")}</button>
        ) : (
          <button type="button" disabled={!src || loading} onClick={() => void toggle()} aria-label={playing ? label("Pause", "إيقاف") : label("Play", "تشغيل")} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow disabled:opacity-50">
            {loading || buffering ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
          </button>
        )}
        <button type="button" disabled={!src} onClick={() => seek(time + 10)} aria-label={label("Forward 10 seconds", "تقديم 10 ثوانٍ")} className="text-muted-foreground disabled:opacity-40"><RotateCw className="h-5 w-5" /></button>
      </div>

      {src && (
        <audio
          ref={audioRef} src={src} preload="metadata" playsInline className="hidden"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setLength(d); }}
          onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)}
          onError={() => { setPlaying(false); setError(true); }}
        />
      )}
    </div>
  );
}
