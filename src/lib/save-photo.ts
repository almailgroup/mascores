import { Capacitor, registerPlugin } from "@capacitor/core";

const PhotoLibrary = registerPlugin<{ save(options: { base64: string }): Promise<void> }>("PhotoLibrary");

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

function withTimeout<T>(p: Promise<T>, ms = 20000) {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Saving took too long. Check Photos permission in iPhone Settings and try again.")), ms)),
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
    // Call the native bridge directly first: plugins registered at runtime are
    // often missing from the JS plugin list, which made us wrongly say "update app".
    try {
      await withTimeout(callNativeSave(base64));
      return "saved";
    } catch (error) {
      if (!isUnimplemented(error)) throw error;
    }
    try {
      await withTimeout(PhotoLibrary.save({ base64 }));
      return "saved";
    } catch (error) {
      if (!isUnimplemented(error)) throw error;
      return "update-app";
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
