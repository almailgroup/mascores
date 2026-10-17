import { supabase } from "@/integrations/supabase/client";

export async function uploadMedia(bucket: string, file: File, folder?: string): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${folder ? `${folder.replace(/^\/+|\/+$/g, "")}/` : ""}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  // Recording playback authorizes and signs each request; never persist a long-lived audio token.
  if (bucket === "voice-recordings") return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const { data, error: signingError } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (signingError) throw signingError;
  return data?.signedUrl ?? null;
}