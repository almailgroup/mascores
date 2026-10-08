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

/**
 * iPhone app: writes straight into the camera roll (add-only permission).
 * Website: opens the system share sheet, where "Save Image" puts it in Photos.
 */
export async function savePhoto(blob: Blob, fileName: string, title: string): Promise<SaveResult> {
  const native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  if (native) {
    try {
      await PhotoLibrary.save({ base64: await toBase64(blob) });
      return "saved";
    } catch (error) {
      // Older installed builds don't include the camera-roll bridge yet.
      if (!isUnimplemented(error)) throw error;
    }
  }
  const file = new File([blob], fileName, { type: "image/png" });
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) return native ? "update-app" : "unsupported";
  try {
    await navigator.share({ files: [file], title });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    throw error;
  }
}
