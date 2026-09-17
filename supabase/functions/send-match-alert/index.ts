/**
 * Sends a match alert (goal, kickoff, full time) to a user's iOS devices via APNs.
 *
 * Auth: the caller must be an admin. The Authorization bearer token is verified
 * against Supabase and then checked with the existing public.is_admin() RPC, so
 * push sending reuses the same admin list as the rest of the app rather than
 * introducing a second notion of privilege.
 *
 * Required secrets (supabase secrets set ...):
 *   APNS_KEY_ID       the 10-character key id of the .p8 auth key
 *   APNS_TEAM_ID      the 10-character Apple developer team id
 *   APNS_PRIVATE_KEY  contents of the .p8 file, including BEGIN/END lines
 *   APNS_BUNDLE_ID    com.almailgroup.mascores
 *   APNS_HOST         api.sandbox.push.apple.com | api.push.apple.com
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Strips the PEM armour and decodes the base64 body to DER. */
function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

// Apple rejects tokens refreshed more than once per 20 minutes and treats them
// as valid for an hour, so reuse one across invocations of a warm instance.
let cachedToken: { jwt: string; madeAt: number } | null = null;
const TOKEN_TTL_MS = 45 * 60 * 1000;

async function apnsJwt(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.madeAt < TOKEN_TTL_MS) return cachedToken.jwt;

  const keyId = Deno.env.get("APNS_KEY_ID")!;
  const teamId = Deno.env.get("APNS_TEAM_ID")!;
  const pem = Deno.env.get("APNS_PRIVATE_KEY")!;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(pem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const header = base64url(encoder.encode(JSON.stringify({ alg: "ES256", kid: keyId })));
  const payload = base64url(
    encoder.encode(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })),
  );
  // WebCrypto ECDSA already returns the raw r||s form APNs expects.
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(`${header}.${payload}`),
  );

  const jwt = `${header}.${payload}.${base64url(sig)}`;
  cachedToken = { jwt, madeAt: Date.now() };
  return jwt;
}

type AlertRequest = {
  /** Accounts to notify. Every registered device of each is sent the alert. */
  userIds: string[];
  title: string;
  body: string;
  /** In-app path the notification opens, e.g. "/match/123". */
  path?: string;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Only an existing admin may send pushes to other people's devices.
  const { data: caller, error: callerError } = await admin.auth.getUser(authHeader.slice(7));
  if (callerError || !caller.user) return new Response("Unauthorized", { status: 401 });

  const { data: isAdmin } = await admin.rpc("is_admin", { _uid: caller.user.id });
  if (!isAdmin) return new Response("Forbidden", { status: 403 });

  let payload: AlertRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!Array.isArray(payload.userIds) || !payload.title || !payload.body) {
    return new Response("userIds, title and body are required", { status: 400 });
  }

  const { data: devices, error: devicesError } = await admin
    .from("device_tokens")
    .select("token")
    .in("user_id", payload.userIds);
  if (devicesError) return new Response(devicesError.message, { status: 500 });
  if (!devices?.length) return Response.json({ sent: 0, failed: 0, stale: [] });

  const jwt = await apnsJwt();
  const host = Deno.env.get("APNS_HOST") ?? "api.push.apple.com";
  const topic = Deno.env.get("APNS_BUNDLE_ID")!;

  const results = await Promise.all(
    devices.map(async ({ token }) => {
      const res = await fetch(`https://${host}/3/device/${token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": topic,
          "apns-push-type": "alert",
          // Match alerts are time-critical but not interruption-level.
          "apns-priority": "10",
        },
        body: JSON.stringify({
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: "default",
          },
          path: payload.path,
        }),
      });
      return { token, ok: res.ok, status: res.status };
    }),
  );

  // 410 means Apple has retired the token — drop it so we stop paying for it.
  const stale = results.filter((r) => r.status === 410).map((r) => r.token);
  if (stale.length) await admin.from("device_tokens").delete().in("token", stale);

  return Response.json({
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    stale: stale.length,
  });
});
