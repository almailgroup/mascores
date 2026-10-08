import { Capacitor, registerPlugin } from "@capacitor/core";

const PhotoLibrary = registerPlugin<{ save(options: { base64: string }): Promise<void> }>("PhotoLibrary");

export async function savePhoto(blob: Blob, fileName: string, title: string): Promise<"saved" | "shared" | "cancelled" | "unsupported"> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("PhotoLibrary")) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("Could not read image"));
      reader.readAsDataURL(blob);
    });
    await PhotoLibrary.save({ base64 });
    return "saved";
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

export function downloadPhoto(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}