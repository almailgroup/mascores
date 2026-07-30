import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Competition = Database["public"]["Tables"]["competitions"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Player = Database["public"]["Tables"]["players"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type MatchEvent = Database["public"]["Tables"]["match_events"]["Row"];
export type Lineup = Database["public"]["Tables"]["match_lineups"]["Row"];
export type StandingRow = Database["public"]["Tables"]["standings_rows"]["Row"];
export type NewsPost = Database["public"]["Tables"]["news_posts"]["Row"];
export type Coach = Database["public"]["Tables"]["coaches"]["Row"];
export type Transfer = Database["public"]["Tables"]["transfers"]["Row"];
export type Venue = Database["public"]["Tables"]["venues"]["Row"];
export type StandingLabel = Database["public"]["Tables"]["standing_labels"]["Row"];

export const POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward", "Unknown"] as const;

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function formatHeight(cm: number | null | undefined, unit: "cm" | "ft"): string {
  if (!cm) return "—";
  if (unit === "cm") return `${cm} cm`;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}′ ${inch}″`;
}

/** Live match clock in seconds, derived from the stored timer state. */
export function matchClockSeconds(m: Pick<Match, "timer_elapsed_seconds" | "timer_running" | "timer_started_at">, nowMs = Date.now()): number {
  const base = m.timer_elapsed_seconds ?? 0;
  if (!m.timer_running || !m.timer_started_at) return base;
  return base + Math.max(0, Math.floor((nowMs - new Date(m.timer_started_at).getTime()) / 1000));
}

export function formatClock(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  live: "Live",
  ht: "Half-time",
  ft: "Full-time",
  aet: "After extra time",
  pen: "After penalties",
  postponed: "Postponed",
  cancelled: "Cancelled",
  awarded: "Awarded",
  interrupted: "Interrupted",
};

export function formatKickoff(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `x-${Date.now()}`;
}

export async function signMediaUrl(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? null;
}

export { supabase };