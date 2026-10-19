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
type ChatLine = { t: number; name: string; avatar: string | null; body: string };
export const SPEEDS = [0.5, 1, 1.5, 2, 3] as const;

export function RecordingPlayer({ src, loading, failed, onRetry, duration, cover, timeline, chat }: {
  src?: string; loading?: boolean; failed?: boolean; onRetry: () => void; duration: number; cover: string | null; timeline?: unknown; chat?: unknown;
}) {
  const [speed, setSpeed] = useState<number>(1);
  const chatLines = useMemo(() => (Array.isArray(chat) ? (chat as ChatLine[]).filter((c) => typeof c?.t === "number" && typeof c?.body === "string") : []), [chat]);
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
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed, src]);
  const visibleChat = chatLines.filter((c) => c.t <= time).slice(-4);

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

      <div className="mt-3 flex items-center justify-center gap-1.5" role="group" aria-label={label("Playback speed", "سرعة التشغيل")}>
        {SPEEDS.map((v) => (
          <button key={v} type="button" onClick={() => setSpeed(v)} aria-pressed={speed === v}
            className={`h-8 min-w-11 rounded-full px-2 text-xs font-bold tabular-nums ${speed === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{v}x</button>
        ))}
      </div>

      {chatLines.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-muted/50 p-2.5">
          <div className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">{label("Live chat", "الدردشة المباشرة")}</div>
          {visibleChat.length === 0 && <p className="text-xs text-muted-foreground">{label("Messages appear as you listen", "تظهر الرسائل أثناء الاستماع")}</p>}
          {visibleChat.map((c, i) => (
            <div key={`${c.t}-${i}`} className="flex items-start gap-2">
              {c.avatar ? <img src={c.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" /> : <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-[0.6rem] font-bold">{c.name.slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0 text-xs"><span className="font-bold">{c.name}</span> <span className="break-words">{c.body}</span></div>
            </div>
          ))}
        </div>
      )}

      {src && (
        <audio
          ref={audioRef} src={src} preload="metadata" playsInline className="hidden"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => { e.currentTarget.playbackRate = speed; const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setLength(d); }}
          onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)}
          onError={() => { setPlaying(false); setError(true); }}
        />
      )}
    </div>
  );
}
