import { supabase } from "@/integrations/supabase/client";

/** Shrinks pictures before upload (max 720px WebP) so uploads finish in about a second. */
async function shrinkImage(file: File, max = 720): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch { return file; }
}

export async function uploadMedia(bucket: string, original: File, folder?: string): Promise<string | null> {
  const file = bucket === "voice-recordings" ? original : await shrinkImage(original);
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${folder ? `${folder.replace(/^\/+|\/+$/g, "")}/` : ""}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type, cacheControl: "31536000" });
  if (error) throw error;
  // Recording playback authorizes and signs each request; never persist a long-lived audio token.
  if (bucket === "voice-recordings") return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const { data, error: signingError } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (signingError) throw signingError;
  return data?.signedUrl ?? null;
}
