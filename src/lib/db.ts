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