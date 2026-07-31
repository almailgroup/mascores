import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { almailInputSchema } from "./almail-ai.schemas";

export const createPlayerDraftWithAlmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => almailInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (error || !isAdmin) throw new Error("Administrator access required.");
    const { generatePlayerDraft } = await import("./almail-ai.server");
    return generatePlayerDraft(data.notes, data.images);
  });

export const createArticleDraftWithAlmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => almailInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (error || !isAdmin) throw new Error("Administrator access required.");
    const { generateArticleDraft } = await import("./almail-ai.server");
    return generateArticleDraft(data.notes, data.images);
  });