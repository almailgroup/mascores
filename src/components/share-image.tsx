import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Share2, X, ImageDown, LoaderCircle, Check, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { savePhoto } from "@/lib/save-photo";

/** One accessible, memory-safe image sheet for results, lineups and standings. */
export function ShareCardButton({ render, title, label: buttonLabel, iconOnly = false, disabled = false }: {
  render: () => Promise<Blob | null>;
  title: string;
  label?: string;
  iconOnly?: boolean;
  disabled?: boolean;
}) {
  const { lang } = useI18n();
  const label = (en: string, ar: string) => lang === "ar" ? ar : en;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const renderRef = useRef(render);
  renderRef.current = render;
  const fileName = `${title.replace(/[^\w\u0600-\u06FF -]/g, "").replace(/\s+/g, "-") || "image"}.png`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let url: string | null = null;
    blobRef.current = null;
    setPreview(null);
    setBusy(true);
    setError(false);
    setSaved(false);
    setNotice(null);
    void renderRef.current().then(blob => {
      if (cancelled) return;
      if (!blob) throw new Error("No image");
      blobRef.current = blob;
      url = URL.createObjectURL(blob);
      setPreview(url);
    }).catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => {
      cancelled = true;
      blobRef.current = null;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, retry]);

  const [holdToSave, setHoldToSave] = useState(false);
  const saveToPhotos = async () => {
    const blob = blobRef.current;
    if (!blob || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await savePhoto(blob, fileName, title);
      setSaved(result === "saved");
      if (result === "update-app") {
        setHoldToSave(true);
        // Show the installed build so it's clear whether the new one is on the phone.
        let build = "";
        try {
          const { App } = await import("@capacitor/app");
          const info = await App.getInfo();
          build = ` (${info.version} · ${info.build})`;
        } catch { /* unknown */ }
        setNotice(label(`This installed app${build} doesn't include the camera-roll saver. Delete it, install the newest TestFlight build, then tap Save again.`, `هذه النسخة المثبتة${build} لا تحتوي على ميزة الحفظ في ألبوم الكاميرا. احذف التطبيق وثبّت أحدث نسخة من TestFlight ثم اضغط حفظ مجددًا.`));
      } else if (result === "unsupported") {
        setHoldToSave(true);
        setNotice(label("This browser can’t save to Photos. Open MA Scores on your iPhone to save it to your camera roll.", "هذا المتصفح لا يدعم الحفظ في الصور. افتح MA Scores على جهازك لحفظها في ألبوم الكاميرا."));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      setNotice(/Allow MA Scores/i.test(msg)
        ? label("Allow MA Scores to add photos: iPhone Settings → MA Scores → Photos → Add Photos Only.", "اسمح لـ MA Scores بإضافة الصور: الإعدادات ← MA Scores ← الصور ← إضافة الصور فقط.")
        : label("Couldn’t save the photo. Please try again.", "تعذّر حفظ الصورة. حاول مرة أخرى."));
    } finally { setSaving(false); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button disabled={disabled} variant="outline" size={iconOnly ? "icon" : "sm"} aria-label={buttonLabel ?? label("Share image", "مشاركة صورة")}
          className={iconOnly ? "rounded-full border-primary-foreground/20 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 hover:text-primary-foreground" : "rounded-full"}>
          <Share2 />{!iconOnly && (buttonLabel ?? label("Share", "مشاركة"))}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-foreground/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-[121] flex max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-card p-5 shadow-xl">
          <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
            <Dialog.Title className="min-w-0 text-sm font-bold">{title}</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label={label("Close", "إغلاق")} className="shrink-0"><X /></Button></Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              {error ? <div className="flex h-56 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><span>{label("Couldn’t create the image", "تعذّر إنشاء الصورة")}</span><Button variant="outline" onClick={() => setRetry(n => n + 1)}><RefreshCw />{label("Try again", "حاول مجددًا")}</Button></div>
                : busy || !preview ? <div className="grid h-56 place-items-center" role="status"><LoaderCircle className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">{label("Creating image", "جارٍ إنشاء الصورة")}</span></div>
                : <img src={preview} alt={title} style={holdToSave ? { WebkitTouchCallout: "default" } : undefined} className="mx-auto max-h-[45dvh] w-full object-contain" />}
            </div>
            {notice && <p role="status" className="mt-3 text-sm text-muted-foreground">{notice}</p>}
          </div>
          <div className="mt-4 shrink-0 space-y-2">
            <Button disabled={busy || !preview || saving} onClick={saveToPhotos} className="h-12 w-full rounded-lg text-sm font-bold transition-colors">
              {saving ? <LoaderCircle className="animate-spin" /> : saved ? <Check /> : <ImageDown />}
              {saving ? label("Saving…", "جارٍ الحفظ…") : saved ? label("Saved to Photos", "تم الحفظ في الصور") : label("Save to photos", "حفظ في الصور")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
