/** Shared helpers for voice rooms: generated covers, invite links and labels. */

export type VoiceRoom = {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  visibility: "public" | "private";
  invite_code?: string;
  status: "live" | "ended";
  started_at: string;
  ended_at: string | null;
};

export type VoiceHost = { id: string; display_name: string | null; avatar_url: string | null; followers: number };

const PALETTES = [
  ["#0f172a", "#2563eb"],
  ["#1b1035", "#7c3aed"],
  ["#0b2a23", "#059669"],
  ["#2b1008", "#ea580c"],
  ["#2a0a1c", "#db2777"],
  ["#082032", "#0891b2"],
];

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic cover art for rooms with no uploaded photo — no AI credits needed. */
export function generatedCover(title: string) {
  const seed = hash(title || "voice room");
  const [from, to] = PALETTES[seed % PALETTES.length]!;
  const initials = (title || "V")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  const angle = seed % 90;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="${120 + (seed % 300)}" cy="${90 + (seed % 200)}" r="180" fill="#ffffff" opacity="0.08"/><circle cx="${420 - (seed % 250)}" cy="${520 - (seed % 180)}" r="140" fill="#ffffff" opacity="0.06"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="220" font-weight="800" fill="#ffffff" opacity="0.9">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function roomCover(room: { title: string; photo_url: string | null }) {
  return room.photo_url && room.photo_url.trim() ? room.photo_url : generatedCover(room.title);
}

export function inviteLink(code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/voice?code=${code}`;
}

export function liveFor(startedAt: string, lang: "en" | "ar") {
  const mins = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  if (mins < 60) return lang === "ar" ? `${mins} د` : `${mins} min`;
  const hours = Math.floor(mins / 60);
  return lang === "ar" ? `${hours} س ${mins % 60} د` : `${hours}h ${mins % 60}m`;
}
