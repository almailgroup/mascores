import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ImageCropper } from "@/components/image-cropper";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

// 16px minimum font-size on touch widths keeps iOS Safari from auto-zooming on focus.
export const inputCls = "w-full max-w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-primary sm:py-2 sm:text-sm";
export const btnPrimary = "inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow disabled:opacity-60 sm:h-9";
export const btnGhost = "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-accent sm:h-9";
export const btnDanger = "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 text-xs font-medium text-destructive hover:bg-destructive/20 sm:h-9";

export function Modal({ open, onClose, title, children, wide, fullPage }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; fullPage?: boolean }) {
  // Rendered through a portal so a sheet opened from inside another sheet
  // (e.g. editing an event while the match manager is open) is never trapped
  // by the parent's scroll container or stacking context — that was why
  // "Edit event" appeared to do nothing on iPhone.
  const [mounted, setMounted] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => setMounted(true), []);
  // Opening a sheet always starts at the top, so the editor is right there
  // instead of somewhere below the previous scroll position.
  useEffect(() => {
    if (open && scroller.current) scroller.current.scrollTop = 0;
  }, [open]);
  if (!open || !mounted || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={scroller}
      className={`fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain bg-foreground/60 ${fullPage ? "p-0" : "p-2 backdrop-blur-sm sm:p-4"}`}
      onClick={onClose}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div
        className={`${fullPage ? "min-h-screen max-w-6xl rounded-none border-x sm:my-4 sm:min-h-0 sm:rounded-lg" : `my-3 ${wide ? "max-w-4xl" : "max-w-lg"} rounded-3xl sm:my-8`} w-full min-w-0 border border-border bg-card p-4 shadow-2xl sm:p-6`}
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between border-b border-border bg-card px-4 pb-2 pt-1 sm:-mx-6 sm:px-6">
          <h3 className="min-w-0 truncate text-base font-bold sm:text-lg">{title}</h3>
          <button onClick={onClose} className="-me-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm text-muted-foreground hover:bg-accent">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ImageInput({ value, onChange, onFile, placeholder, aspect = 1 }: { value: string | null; onChange: (v: string | null) => void; onFile: (f: File) => Promise<void>; placeholder?: string; aspect?: number }) {
  const [cropExisting, setCropExisting] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finish = async (file: File) => {
    setUploading(true);
    setError(null);
    try { await onFile(file); } catch { setError("Upload failed. Please try again."); }
    finally { setUploading(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
        {value ? <img src={value} alt="" className="h-full w-full object-contain" /> : <span className="text-[0.6rem] text-muted-foreground">img</span>}
      </div>
       <label className="inline-flex h-10 cursor-pointer items-center rounded-full border border-border bg-background px-3 text-xs font-medium">
         {uploading ? "Uploading…" : "Choose image"}
         <input type="file" accept="image/*" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setPending(f); }} className="sr-only" />
       </label>
      {value && <button type="button" onClick={() => setCropExisting(true)} className="text-xs font-semibold text-primary">Crop</button>}
      {value && <button type="button" onClick={() => onChange(null)} className="text-xs text-muted-foreground hover:text-destructive">{placeholder ?? "Clear"}</button>}
      {/* A freshly chosen picture opens the crop box first; skipping it keeps the original. */}
      {pending && (
        <ImageCropper
          file={pending}
          aspect={aspect}
          cancelLabel="Skip crop"
          onCancel={async () => { const original = pending; setPending(null); if (original) await finish(original); }}
          onDone={async (f) => { setPending(null); await finish(f); }}
        />
      )}
      {cropExisting && value && (
         <ImageCropper src={value} aspect={aspect} onCancel={() => setCropExisting(false)} onDone={async (f) => { await finish(f); setCropExisting(false); }} />
      )}
       {error && <span className="basis-full text-xs text-destructive">{error}</span>}
    </div>
  );
}