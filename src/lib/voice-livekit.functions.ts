import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const b64url = (bytes: Uint8Array | string) => {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let s = "";
  raw.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/**
 * Issues a short-lived LiveKit access token for a voice room. Only people who
 * joined the room get one, and only hosts/speakers may publish audio.
 */
export const getVoiceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => {
    if (!input || typeof input.roomId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.roomId)) throw new Error("Invalid room");
    return input;
  })
  .handler(async ({ data, context }) => {
    const url = process.env["LIVEKIT_URL"];
    const key = process.env["LIVEKIT_API_KEY"];
    const secret = process.env["LIVEKIT_API_SECRET"];
    if (!url || !key || !secret) return { ok: false as const, error: "Voice service is not configured" };
    const { data: part } = await context.supabase
      .from("voice_room_participants")
      .select("role")
      .eq("room_id", data.roomId)
      .eq("user_id", context.userId)
      .is("left_at", null)
      .maybeSingle();
    if (!part) return { ok: false as const, error: "Join the room first" };
    const canPublish = part.role === "host" || part.role === "speaker";
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = b64url(JSON.stringify({
      iss: key, sub: context.userId, nbf: now - 10, exp: now + 6 * 3600,
      video: { room: `voice-${data.roomId}`, roomJoin: true, canPublish, canSubscribe: true, canPublishData: false, canPublishSources: ["microphone"] },
    }));
    const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${header}.${payload}`)));
    return { ok: true as const, url, token: `${header}.${payload}.${b64url(sig)}`, canPublish };
  });
