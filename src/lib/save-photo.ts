import { Capacitor } from "@capacitor/core";


export type SaveResult = "saved" | "shared" | "cancelled" | "update-app" | "unsupported";

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

function isUnimplemented(error: unknown) {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "UNIMPLEMENTED" || /not implemented|unimplemented/i.test(e?.message ?? "");
}

const TIMEOUT = "SAVE_TIMEOUT";
function isTimeout(error: unknown) {
  return (error as { code?: string } | null)?.code === TIMEOUT;
}

function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject({ code: TIMEOUT }), ms)),
  ]);
}

/** Calls the native bridge directly, in case the plugin header wasn't exported to JS. */
function callNativeSave(base64: string) {
  const cap = (window as unknown as { Capacitor?: { nativePromise?: (p: string, m: string, o: unknown) => Promise<void> } }).Capacitor;
  if (!cap?.nativePromise) return Promise.reject({ code: "UNIMPLEMENTED" });
  return cap.nativePromise("PhotoLibrary", "save", { base64 });
}

/**
 * iPhone app: writes straight into the camera roll. iOS asks "Allow MA Scores
 * to add photos" the first time; afterwards it saves silently. The app never
 * falls back to the share sheet — that only offered "Save to Files".
 * Website: opens the system share sheet, where "Save Image" puts it in Photos.
 */
export async function savePhoto(blob: Blob, fileName: string, title: string): Promise<SaveResult> {
  const native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  if (native) {
    const base64 = await toBase64(blob);
    // The native side never answers a call to a plugin it doesn't have, so a
    // missing bridge shows up as a timeout — treat that as "update the app".
    try {
      await withTimeout(callNativeSave(base64), 12000);
      return "saved";
    } catch (error) {
      if (isUnimplemented(error) || isTimeout(error)) return "update-app";
      throw error;
    }
  }
  const file = new File([blob], fileName, { type: "image/png" });
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) return "unsupported";
  try {
    await navigator.share({ files: [file], title });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    throw error;
  }
}
