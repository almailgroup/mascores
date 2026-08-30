import { useEffect, useState } from "react";

/** Renders a scannable QR code for the given value, drawn fully in the browser. */
export function QrCode({ value, size = 160, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const QR = await import("qrcode");
      const url = await QR.toDataURL(value, { margin: 1, width: size * 2, color: { dark: "#0b0b0f", light: "#ffffff" } });
      if (alive) setSrc(url);
    })();
    return () => { alive = false; };
  }, [value, size]);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt="Ticket QR code" className="h-full w-full" /> : <span className="text-[0.6rem] text-muted-foreground">QR</span>}
    </div>
  );
}
