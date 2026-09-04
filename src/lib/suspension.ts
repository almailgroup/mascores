import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Suspension = { banned: boolean; suspended_until: string | null; reason: string | null };

/** The signed-in user's own restriction, or null when the account is in good standing. */
export function useMySuspension(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["my-suspension", userId],
    queryFn: async (): Promise<Suspension | null> => {
      const { data } = await supabase.from("user_suspensions").select("banned, suspended_until, reason").eq("user_id", userId!).maybeSingle();
      const row = (data ?? null) as Suspension | null;
      if (!row) return null;
      if (row.banned) return row;
      if (row.suspended_until && new Date(row.suspended_until).getTime() > Date.now()) return row;
      return null;
    },
  });
}

/** Human sentence for a restriction notice. */
export function suspensionMessage(row: Suspension) {
  const base = row.banned
    ? "Your account is banned from posting and hosting."
    : `Your account is suspended until ${new Date(row.suspended_until!).toLocaleString()}.`;
  return row.reason ? `${base} Reason: ${row.reason}` : base;
}
