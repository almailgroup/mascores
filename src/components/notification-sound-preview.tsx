import { useEffect, useRef, useState } from "react";
import { Play, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const sounds = [
  ["goal", "Goal", "هدف"],
  ["scorer", "Goal scorer added", "إضافة مسجل الهدف"],
  ["penalty_goal", "Penalty scored", "تسجيل ركلة جزاء"],
  ["own_goal", "Own goal", "هدف عكسي"],
  ["miss", "Penalty missed", "إضاعة ركلة جزاء"],
  ["yellow", "Yellow card", "بطاقة صفراء"],
  ["second_yellow", "Second yellow card", "البطاقة الصفراء الثانية"],
  ["card", "Red card", "بطاقة حمراء"],
  ["sub", "Substitution", "تبديل"],
  ["injury", "Injury substitution", "تبديل بسبب الإصابة"],
  ["var", "VAR check", "مراجعة الفيديو"],
  ["var_goal", "VAR goal review", "مراجعة هدف"],
  ["var_penalty", "VAR penalty review", "مراجعة ركلة جزاء"],
  ["var_red", "VAR red card review", "مراجعة بطاقة حمراء"],
  ["kickoff", "Kick-off", "انطلاق المباراة"],
  ["halftime", "Half time", "نهاية الشوط الأول"],
  ["second_half", "Second half", "الشوط الثاني"],
  ["et_wait", "Waiting for extra time", "انتظار الوقت الإضافي"],
  ["et_start", "Extra time started", "بداية الوقت الإضافي"],
  ["et_break", "Extra time break", "استراحة الوقت الإضافي"],
  ["et_second", "Extra time second half", "الشوط الإضافي الثاني"],
  ["shootout", "Penalty shootout", "ركلات الترجيح"],
  ["fulltime", "Full time", "نهاية المباراة"],
  ["fulltime_et", "Full time after extra time", "نهاية المباراة بعد الوقت الإضافي"],
  ["fulltime_pens", "Full time after penalties", "نهاية المباراة بعد الترجيح"],
  ["resumed", "Match resumed", "استئناف المباراة"],
  ["reminder", "Kick-off reminder", "تذكير بانطلاق المباراة"],
  ["my_reminder", "My reminder", "تذكيري"],
  ["note", "Match update", "تحديث المباراة"],
  ["whistle", "Whistle", "صافرة"],
  ["voice", "Voice room starts", "بداية غرفة صوتية"],
  ["news", "News", "الأخبار"],
  ["transfer", "Transfer", "انتقال"],
  ["highlights", "Highlights", "ملخص المباراة"],
  ["custom", "Other alerts", "تنبيهات أخرى"],
] as const;

export function NotificationSoundPreview() {
  const { lang } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => () => { audioRef.current?.pause(); }, []);
  const preview = (id: string) => {
    audioRef.current?.pause();
    if (playing === id) { setPlaying(null); return; }
    const audio = new Audio(`/sounds/${id}.mp3?v=20261019-clear`);
    audioRef.current = audio;
    setError(false);
    setPlaying(id);
    audio.onended = () => { if (audioRef.current === audio) setPlaying(null); };
    void audio.play().catch(() => {
      if (audioRef.current === audio) { setPlaying(null); setError(true); }
    });
  };
  return (
    <section className="mt-6 border-y border-border py-5" aria-labelledby="sound-preview-heading">
      <h2 id="sound-preview-heading" className="flex items-center gap-2 text-sm font-semibold">
        <Volume2 className="h-4 w-4 text-primary" />{lang === "ar" ? "أصوات التنبيهات" : "Notification sounds"}
      </h2>
      <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
        {sounds.map(([id, en, ar]) => {
          const active = playing === id;
          const label = lang === "ar" ? ar : en;
          const action = active ? (lang === "ar" ? "إيقاف" : "Stop") : (lang === "ar" ? "تشغيل" : "Play");
          return <div key={id} className="flex min-h-12 items-center justify-between gap-3 border-b border-border py-1">
            <span className="min-w-0 text-sm">{label}</span>
            <Button type="button" variant={active ? "secondary" : "ghost"} size="icon"
              className="h-10 w-10 shrink-0 text-primary" aria-label={`${action} · ${label}`}
              title={`${action} · ${label}`} aria-pressed={active} onClick={() => preview(id)}>
              {active ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </div>;
        })}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{lang === "ar" ? "تعذّر تشغيل الصوت. حاول مرة أخرى." : "Could not play the sound. Please try again."}</p>}
    </section>
  );
}