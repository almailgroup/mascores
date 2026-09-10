import { useCallback, useEffect, useRef, useState } from "react";
import { Share2, X, ImageDown, Download, Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Share sheet for a purpose-built picture. The caller draws the picture, so the
 * result is a designed card - never a screenshot of the page.
 */
export function ShareCardButton({ render, title, label: buttonLabel }: {
  render: () => Promise<Blob | null>;
  title: string;
  label?: string;
}) {
  const { lang } = useI18n();
  const label = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const fileName = `${title.replace(/[^\w\u0600-\u06FF -]/g, "").replace(/\s+/g, "-") || "image"}.png`;

  const build = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await render();
      blobRef.current = blob;
      setPreview(blob ? URL.createObjectURL(blob) : null);
    } finally { setBusy(false); }
  }, [render]);

  useEffect(() => { if (open) void build(); }, [open, build]);

  const saveToFile = () => {
    const blob = blobRef.current;
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  };

  /** The share sheet is where "Save Image" puts it in the camera roll. */
  const saveToPhotos = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title }); return; } catch { return; }
    }
    saveToFile();
  };

  const sendByEmail = () => {
    saveToFile();
    const body = `${title}\n\n${label("The image has been saved to your device - attach it to this email.", "تم حفظ الصورة على جهازك - أضفها كمرفق لهذه الرسالة.")}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={label("Share image", "مشاركة صورة")}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold">
        <Share2 className="h-3.5 w-3.5" /> {buttonLabel ?? label("Share", "مشاركة")}
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-bold">{title}</div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-muted">
              {busy || !preview
                ? <div className="grid h-56 place-items-center text-xs text-muted-foreground">{label("Creating image…", "جارٍ إنشاء الصورة…")}</div>
                : <img src={preview} alt="" className="mx-auto max-h-[34vh] w-full object-contain" />}
            </div>
            <button type="button" disabled={busy || !preview} onClick={saveToPhotos}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
              <ImageDown className="h-4 w-4" /> {label("Save to photos", "حفظ في الصور")}
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy || !preview} onClick={sendByEmail}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                <Mail className="h-4 w-4" /> {label("Email image", "إرسال بالبريد")}
              </button>
              <button type="button" disabled={busy || !preview} onClick={saveToFile}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                <Download className="h-4 w-4" /> {label("Save file", "حفظ الملف")}
              </button>
            </div>
            <div className="h-24 sm:h-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
          </div>
        </div>
      )}
    </>
  );
}
