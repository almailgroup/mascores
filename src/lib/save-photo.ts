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
    try {
      await PhotoLibrary.save({ base64 });
      return "saved";
    } catch (error) {
      if (!isUnimplemented(error)) throw error;
    }
    try {
      await callNativeSave(base64);
      return "saved";
    } catch (error) {
      if (!isUnimplemented(error)) throw error;
      // The installed build predates the camera-roll bridge.
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
