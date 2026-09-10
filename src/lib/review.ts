import { supabase } from "@/integrations/supabase/client";

export type ReviewEntity = "player" | "team" | "match" | "competition_team";
export type ReviewAction = "create" | "delete";

/**
 * A limited admin does not change big things straight away: the request is put in
 * front of the site owner, who says yes or no.
 */
export async function requestReview(input: {
  entity: ReviewEntity;
  action: ReviewAction;
  label: string;
  payload?: Record<string, unknown>;
  targetId?: string | null;
}) {
  // Read the stored session first: asking the server who you are can fail on a flaky
  // connection, and that must never look like being signed out.
  let userId: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user?.id;
  } catch { /* fall through to the server check */ }
  if (!userId) {
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id;
    } catch { /* handled below */ }
  }
  if (!userId) throw new Error("Please sign in again.");
  const { error } = await supabase.from("admin_change_requests").insert({
    requester_id: userId,
    entity: input.entity,
    action: input.action,
    label: input.label,
    payload: (input.payload ?? {}) as never,
    target_id: input.targetId ?? null,
  } as never);
  if (error) throw new Error(error.message);
}
