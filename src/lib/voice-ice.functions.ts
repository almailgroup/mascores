import { createServerFn } from "@tanstack/react-start";

/**
 * Connection helpers for voice rooms. STUN alone fails between many mobile
 * networks, so a relay (TURN) server is added when its credentials are saved.
 */
export const getVoiceIceServers = createServerFn({ method: "GET" }).handler(async () => {
  const servers: { urls: string[]; username?: string; credential?: string }[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
  ];
  const urls = (process.env["TURN_URLS"] ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  const username = process.env["TURN_USERNAME"];
  const credential = process.env["TURN_CREDENTIAL"];
  if (urls.length && username && credential) servers.push({ urls, username, credential });
  return { servers, relay: servers.length > 1 };
});
