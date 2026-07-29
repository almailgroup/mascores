import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
export const btnPrimary = "inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow disabled:opacity-60";
export const btnGhost = "inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-accent";
export const btnDanger = "inline-flex h-9 items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 text-xs font-medium text-destructive hover:bg-destructive/20";

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`my-8 w-full ${wide ? "max-w-4xl" : "max-w-lg"} rounded-3xl border border-border bg-card p-6 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-sm text-muted-foreground hover:bg-accent">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ImageInput({ value, onChange, onFile, placeholder }: { value: string | null; onChange: (v: string | null) => void; onFile: (f: File) => Promise<void>; placeholder?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
        {value ? <img src={value} alt="" className="h-full w-full object-contain" /> : <span className="text-[0.6rem] text-muted-foreground">img</span>}
      </div>
      <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await onFile(f); }} className="text-xs" />
      {value && <button type="button" onClick={() => onChange(null)} className="text-xs text-muted-foreground hover:text-destructive">{placeholder ?? "Clear"}</button>}
    </div>
  );
}