/**
 * Sends iOS push alerts via APNs.
 *
 * Callers:
 *  - Database triggers / reminders post `{ queueId }` (match alerts in push_queue).
 *  - The admin broadcast RPC posts `{ broadcastId }` (custom / news alerts in push_broadcasts).
 *  - An admin may post `{ userIds, title, body, path }` with their bearer token.
 *
 * Queue/broadcast callers only pass an id; the content and audience come from
 * the stored row, so a caller can never choose who receives what.
 *
 * Required secrets: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY, APNS_BUNDLE_ID,
 * optional APNS_HOST (defaults to production; sandbox is tried automatically).
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Strips the PEM armour and decodes the base64 body to DER. */
function pemToDer(pem: string): Uint8Array {
  // Tolerates keys pasted with literal "\n", quotes, or any BEGIN/END label.
  const body = pem.replace(/\\n/g, "\n").replace(/["']/g, "").replace(/-----[^-]+-----/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

// Apple rejects tokens refreshed more than once per 20 minutes and treats them
// as valid for an hour, so reuse one across invocations of a warm instance.
let cachedToken: { jwt: string; madeAt: number } | null = null;
const TOKEN_TTL_MS = 45 * 60 * 1000;

/** Finds the 32-byte private scalar (04 20 ..) and the uncompressed public point (03 42 00 04 ..). */
function derToJwk(der: Uint8Array): JsonWebKey | null {
  let d: Uint8Array | null = null;
  let pub: Uint8Array | null = null;
  for (let i = 0; i < der.length - 2; i++) {
    if (!d && der[i] === 0x04 && der[i + 1] === 0x20 && i + 34 <= der.length) d = der.slice(i + 2, i + 34);
    if (!pub && der[i] === 0x03 && der[i + 1] === 0x42 && der[i + 2] === 0x00 && der[i + 3] === 0x04 && i + 68 <= der.length) pub = der.slice(i + 4, i + 68);
  }
  if (!d || !pub) return null;
  return { kty: "EC", crv: "P-256", d: base64url(d), x: base64url(pub.slice(0, 32)), y: base64url(pub.slice(32)), ext: true };
}

async function apnsJwt(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.madeAt < TOKEN_TTL_MS) return cachedToken.jwt;

  const keyId = (Deno.env.get("APNS_KEY_ID") ?? "").trim();
  const teamId = (Deno.env.get("APNS_TEAM_ID") ?? "").trim();
  const pem = Deno.env.get("APNS_PRIVATE_KEY") ?? "";
  if (!keyId || !teamId || !pem) throw new Error("APNs secrets missing");

  let der: Uint8Array;
  try { der = pemToDer(pem); } catch { throw new Error(`APNS_PRIVATE_KEY is not valid base64 (length ${pem.length})`); }
  // Trim anything pasted after the key: the DER header states the real length.
  if (der[0] === 0x30 && der[1] === 0x81 && der.length > der[2] + 3) der = der.slice(0, der[2] + 3);
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  } catch {
    // Some exports wrap the key with extra curve fields the runtime rejects;
    // pull the raw private scalar and public point out and import as JWK.
    const jwk = derToJwk(der);
    if (!jwk) {
      const label = pem.match(/-----BEGIN ([^-]+)-----/)?.[1] ?? "none";
      throw new Error(`APNS_PRIVATE_KEY is not a valid .p8 key (label ${label}, ${der.length} bytes, text length ${pem.length})`);
    }
    key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  }
  const header = base64url(encoder.encode(JSON.stringify({ alg: "ES256", kid: keyId })));
  const payload = base64url(encoder.encode(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })));
  // WebCrypto ECDSA already returns the raw r||s form APNs expects.
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(`${header}.${payload}`));

  const jwt = `${header}.${payload}.${base64url(sig)}`;
  cachedToken = { jwt, madeAt: Date.now() };
  return jwt;
}

type AlertRequest = { userIds: string[]; title: string; body: string; path?: string };
type SendResult = { token: string; ok: boolean; status: number; reason: string | null };
type Msg = { title_en: string; body_en: string; title_ar: string; body_ar: string };

/** Every match alert title (English) and the sound bundled for it in ios/App/App/Sounds. */
const TITLE_SOUNDS: Record<string, string> = {
  "Goal": "goal", "Goal scorer": "scorer", "Penalty scored": "penalty_goal", "Own goal": "own_goal",
  "Penalty missed": "miss", "Yellow card": "yellow", "Second yellow card": "second_yellow", "Red card": "card",
  "Substitution": "sub", "Injury substitution": "injury",
  "VAR check": "var", "Goal VAR": "var_goal", "Penalty VAR": "var_penalty", "Red card VAR": "var_red", "Match update": "note",
  "Kick-off": "kickoff", "Half time": "halftime", "Second half": "second_half", "Waiting for extra time": "et_wait",
  "Extra time started": "et_start", "Extra time break": "et_break", "Extra time second half": "et_second",
  "Penalty shootout": "shootout", "Full time": "fulltime", "Full time after extra time": "fulltime_et",
  "Full time after penalties": "fulltime_pens", "Match resumed": "resumed", "Highlights available": "highlights",
};
const CATEGORY_SOUNDS: Record<string, string> = {
  goals: "goal", scorer: "scorer", cards: "yellow", kickoff: "kickoff", final: "fulltime", reminder: "reminder", other: "note",
};
const KIND_SOUNDS: Record<string, string> = {
  reminder: "my_reminder", transfer: "transfer", news: "news", custom: "custom", voice: "voice", highlights: "highlights",
};

/** Sound for a queued match alert: matched by its English title, then its category. */
function soundFor(category: string, titleEn: string): string {
  const exact = TITLE_SOUNDS[titleEn.split(" · ")[0].trim()];
  return `${exact ?? CATEGORY_SOUNDS[category] ?? "note"}.caf`;
}

async function pushOne(host: string, jwt: string, topic: string, token: string, payload: string) {
  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: "POST",
    headers: { authorization: `bearer ${jwt}`, "apns-topic": topic, "apns-push-type": "alert", "apns-priority": "10" },
    body: payload,
  });
  const reason = res.ok ? null : await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, reason };
}

async function sendTo(tokens: string[], title: string, body: string, path: string | undefined, threadId?: string, sound = "default"): Promise<SendResult[]> {
  const jwt = await apnsJwt();
  const host = (Deno.env.get("APNS_HOST") ?? "api.push.apple.com").trim();
  const topic = (Deno.env.get("APNS_BUNDLE_ID") ?? "").trim();
  const payload = JSON.stringify({ aps: { alert: { title, body }, sound, "thread-id": threadId }, path });
  return Promise.all(tokens.map(async (token) => {
    let r = await pushOne(host, jwt, topic, token, payload);
    // Builds run straight from Xcode use Apple's test servers; TestFlight/App Store use production.
    if (!r.ok && r.status === 400 && (r.reason ?? "").includes("BadDeviceToken")) {
      const other = host.includes("sandbox") ? "api.push.apple.com" : "api.sandbox.push.apple.com";
      r = await pushOne(other, jwt, topic, token, payload);
    }
    return { token, ...r };
  }));
}

// deno-lint-ignore no-explicit-any
async function deliver(admin: any, userIds: string[], msg: Msg, path: string | undefined, threadId: string | undefined, sound: string, soundAr = sound) {
  if (!userIds.length) return { sent: 0, failed: 0, recipients: 0, devices: 0, errors: [] as string[] };
  const { data: devices } = await admin.from("device_tokens").select("token,locale").in("user_id", userIds);
  const all = (devices ?? []) as { token: string; locale: string }[];
  const ar = all.filter((d) => d.locale === "ar").map((d) => d.token);
  const en = all.filter((d) => d.locale !== "ar").map((d) => d.token);
  const results = [
    ...(en.length ? await sendTo(en, msg.title_en, msg.body_en, path, threadId, sound) : []),
    ...(ar.length ? await sendTo(ar, msg.title_ar, msg.body_ar, path, threadId, soundAr) : []),
  ];
  // Only tokens Apple reports as dead (410, or invalid on both servers) are removed.
  const stale = results.filter((r) => r.status === 410 || (r.status === 400 && (r.reason ?? "").includes("BadDeviceToken"))).map((r) => r.token);
  if (stale.length) await admin.from("device_tokens").delete().in("token", stale);
  const errors = [...new Set(results.filter((r) => !r.ok).map((r) => `${r.status} ${r.reason ?? ""}`.trim()))].slice(0, 5);
  return { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, recipients: userIds.length, devices: all.length, errors };
}

/** The Settings switch that controls each alert type. */
const prefKey = (category: string) => (category === "reminder" ? "kickoff" : category === "scorer" ? "goals" : category);

/** Sofascore-style automatic alert for everyone following the match, club or player. */
// deno-lint-ignore no-explicit-any
async function dispatchQueued(admin: any, queueId: string) {
  const { data: rows } = await admin.from("push_queue").update({ sent_at: new Date().toISOString() })
    .eq("id", queueId).is("sent_at", null).select("*");
  const q = rows?.[0] as Record<string, string> | undefined;
  if (!q) return Response.json({ skipped: true });
  const { data: m } = await admin.from("matches").select("home_team_id,away_team_id").eq("id", q.match_id).single();
  const teams = [m?.home_team_id, m?.away_team_id].filter(Boolean) as string[];
  const ors = [`match_notification_ids.cs.{${q.match_id}}`, ...teams.map((t) => `favorite_team_ids.cs.{${t}}`)];
  if (q.player_id) ors.push(`favorite_player_ids.cs.{${q.player_id}}`);
  const { data: profiles } = await admin.from("profiles")
    .select("id,match_notification_ids,favorite_team_ids,favorite_player_ids,notification_preferences").or(ors.join(","));
  // Users whose club bell is on without starring the club.
  const bellOn = new Set<string>();
  for (const t of teams) {
    const { data } = await admin.from("profiles").select("id").eq(`notification_preferences->club_alert_overrides->>${t}`, "true");
    for (const p of data ?? []) bellOn.add(p.id);
  }
  const extra = [...bellOn].filter((id) => !(profiles ?? []).some((p: { id: string }) => p.id === id));
  let everyone = profiles ?? [];
  if (extra.length) {
    const { data } = await admin.from("profiles").select("id,match_notification_ids,favorite_team_ids,favorite_player_ids,notification_preferences").in("id", extra);
    everyone = [...everyone, ...(data ?? [])];
  }
  // deno-lint-ignore no-explicit-any
  const userIds = everyone.filter((p: any) => {
    const prefs = p.notification_preferences ?? {};
    if (prefs[prefKey(q.category)] === false) return false;
    const clubOv = prefs.club_alert_overrides ?? {};
    // A followed club (or a club whose bell is on) covers all its matches; the
    // match bell is then a per-match mute, exactly as the app's bell shows it.
    const viaClub = teams.some((t) => clubOv[t] === true || ((p.favorite_team_ids ?? []).includes(t) && clubOv[t] !== false));
    const matchMarked = (p.match_notification_ids ?? []).includes(q.match_id);
    if (viaClub) return !matchMarked;
    if (matchMarked) return true;
    const plOv = prefs.player_alert_overrides ?? {};
    return !!q.player_id && (p.favorite_player_ids ?? []).includes(q.player_id) && plOv[q.player_id] !== false;
  }).map((p: { id: string }) => p.id);
  const sound = soundFor(q.category, q.title_en);
  const result = await deliver(admin, userIds, q as unknown as Msg, `/matches/${q.match_id}`, q.match_id, sound, sound);
  await admin.from("push_queue").update({ result }).eq("id", queueId);
  return Response.json(result);
}

/** Admin custom message or news alert, sent to everyone or one club's followers. */
// deno-lint-ignore no-explicit-any
async function dispatchBroadcast(admin: any, id: string) {
  const { data: rows } = await admin.from("push_broadcasts").update({ sent_at: new Date().toISOString() })
    .eq("id", id).is("sent_at", null).select("*");
  const b = rows?.[0];
  if (!b) return Response.json({ skipped: true });
  let userIds: string[];
  if (b.audience_type === "followers" && b.audience_user_id) {
    // Voice room went live: everyone following the host, minus anyone who turned voice alerts off.
    const { data: f } = await admin.from("profile_follows").select("follower_id").eq("following_id", b.audience_user_id);
    const ids = [...new Set((f ?? []).map((r: { follower_id: string }) => r.follower_id))] as string[];
    const { data: off } = ids.length
      ? await admin.from("profiles").select("id").in("id", ids).eq("notification_preferences->>voice", "false")
      : { data: [] };
    const muted = new Set((off ?? []).map((p: { id: string }) => p.id));
    userIds = ids.filter((id) => !muted.has(id));
  } else if (b.audience_type === "player" && b.audience_user_id) {
    // Transfer: followers of the player plus fans of the new club (if it is saved).
    const { data: pf } = await admin.from("profiles").select("id").contains("favorite_player_ids", [b.audience_user_id]);
    const { data: tf } = b.audience_team_id
      ? await admin.from("profiles").select("id").contains("favorite_team_ids", [b.audience_team_id])
      : { data: [] };
    userIds = [...new Set([...(pf ?? []), ...(tf ?? [])].map((p: { id: string }) => p.id))] as string[];
  } else if (b.audience_type === "team" && b.audience_team_id) {
    const t = b.audience_team_id as string;
    const { data } = await admin.from("profiles").select("id,notification_preferences").contains("favorite_team_ids", [t]);
    // deno-lint-ignore no-explicit-any
    const fans = (data ?? []).filter((p: any) => (p.notification_preferences?.club_alert_overrides ?? {})[t] !== false).map((p: { id: string }) => p.id);
    const { data: bell } = await admin.from("profiles").select("id").eq(`notification_preferences->club_alert_overrides->>${t}`, "true");
    userIds = [...new Set([...fans, ...(bell ?? []).map((p: { id: string }) => p.id)])];
  } else {
    const { data } = await admin.from("device_tokens").select("user_id");
    userIds = [...new Set((data ?? []).map((d: { user_id: string }) => d.user_id))] as string[];
  }
  const result = await deliver(admin, userIds, b, b.path ?? undefined, b.kind, "default");
  await admin.from("push_broadcasts").update({ result }).eq("id", id);
  return Response.json(result);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const raw = await req.text();
  // deno-lint-ignore no-explicit-any
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch { /* handled below */ }

  const uuid = /^[0-9a-f-]{36}$/i;
  const queueId = parsed && typeof parsed.queueId === "string" && uuid.test(parsed.queueId) ? parsed.queueId : null;
  const broadcastId = parsed && typeof parsed.broadcastId === "string" && uuid.test(parsed.broadcastId) ? parsed.broadcastId : null;
  if (queueId || broadcastId) {
    try {
      return queueId ? await dispatchQueued(admin, queueId) : await dispatchBroadcast(admin, broadcastId);
    } catch (e) {
      const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error("[send-match-alert] dispatch failed", message);
      await admin.from(queueId ? "push_queue" : "push_broadcasts").update({ result: { error: message } }).eq("id", queueId ?? broadcastId);
      return Response.json({ error: message }, { status: 500 });
    }
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
  const { data: caller, error: callerError } = await admin.auth.getUser(authHeader.slice(7));
  if (callerError || !caller.user) return new Response("Unauthorized", { status: 401 });
  const { data: isAdmin } = await admin.rpc("is_admin", { _uid: caller.user.id });
  if (!isAdmin) return new Response("Forbidden", { status: 403 });

  if (!parsed) return new Response("Invalid JSON", { status: 400 });
  const payload = parsed as AlertRequest;
  if (!Array.isArray(payload.userIds) || !payload.title || !payload.body) {
    return new Response("userIds, title and body are required", { status: 400 });
  }
  const msg = { title_en: payload.title, body_en: payload.body, title_ar: payload.title, body_ar: payload.body };
  return Response.json(await deliver(admin, payload.userIds, msg, payload.path, undefined, "default"));
});
