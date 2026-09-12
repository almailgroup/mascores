import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2 } from "lucide-react";
import { scanTicket } from "@/lib/tickets.functions";

const btnPrimary = "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow";
const btnGhost = "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold";
const inputCls = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm";

type ScanResult = {
  result: string;
  ticket?: { code: string; holder_name: string | null; row_label: string | null; seat_label: string | null };
};

/** Gate scanning: reads a QR code with the camera, or checks a typed code. */
export function TicketScanner() {
  const scan = useServerFn(scanTicket);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [camera, setCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const busyRef = useRef(false);

  const check = async (value: string) => {
    if (!value.trim() || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { setResult(await scan({ data: { code: value.trim() } }) as ScanResult); }
    catch { setResult({ result: "error" }); }
    finally { busyRef.current = false; setBusy(false); }
  };

  // Live QR scanning with jsQR, so any phone or laptop camera works.
  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");

    (async () => {
      const jsQR = (await import("jsqr")).default;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch { setCamera(false); setResult({ result: "no_camera" }); return; }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});
      const tick = () => {
        if (stopped) return;
        const v = videoRef.current;
        if (v && v.readyState === v.HAVE_ENOUGH_DATA) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx && canvas.width && canvas.height) {
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
            if (found?.data) {
              stopped = true;
              setCamera(false);
              void check(found.data);
              return;
            }
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    })();

    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach((t) => t.stop()); };
  }, [camera]); // eslint-disable-line react-hooks/exhaustive-deps

  const tone = result?.result === "valid"
    ? "bg-primary/10 text-primary"
    : result?.result === "already_used" || result?.result === "void" || result?.result === "not_found"
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-muted-foreground";
  const text: Record<string, string> = {
    valid: "Valid ticket — entry allowed. This code is now used.",
    already_used: "Already scanned — this code is no longer valid.",
    void: "This ticket was cancelled.",
    not_sold: "This code has not been purchased yet.",
    not_found: "Unknown code — no ticket matches this QR.",
    no_camera: "Camera access was blocked. Allow the camera or type the code instead.",
    error: "Scan failed. Please try again.",
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold">Scan a ticket</h3>
        <p className="mt-1 text-xs text-muted-foreground">Point the camera at the fan's QR code — it reads automatically. Each code works once.</p>
        <button className={`${btnPrimary} mt-3`} onClick={() => { setResult(null); setCamera((v) => !v); }}>
          <Camera className="h-3.5 w-3.5" /> {camera ? "Stop scanner" : "Start QR scanner"}
        </button>
        {camera && (
          <div className="relative mt-3 overflow-hidden rounded-xl bg-foreground/80">
            <video ref={videoRef} muted playsInline autoPlay className="aspect-[3/4] w-full object-cover sm:aspect-video" />
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-primary/80" />
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input className={inputCls} placeholder="Or type MAS-XXXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void check(code); }} />
          <button className={btnGhost} disabled={busy} onClick={() => check(code)}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Check"}</button>
        </div>
      </div>
      {result && (
        <div className={`rounded-2xl p-4 ${tone}`}>
          <div className="text-sm font-bold">{text[result.result] ?? result.result}</div>
          {result.ticket && (
            <div className="mt-1 text-xs">
              <span className="font-mono">{result.ticket.code}</span>
              {result.ticket.holder_name ? ` \u00b7 ${result.ticket.holder_name}` : ""}
              {result.ticket.row_label ? ` \u00b7 Row ${result.ticket.row_label}` : ""}
              {result.ticket.seat_label ? ` \u00b7 Seat ${result.ticket.seat_label}` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
