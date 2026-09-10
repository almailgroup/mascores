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
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
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
