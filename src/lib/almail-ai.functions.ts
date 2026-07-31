import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const imageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dataUrl: z.string().max(8_000_000).refine((value) => /^data:image\/(png|jpeg|webp);base64,/i.test(value), "Unsupported image"),
});

const inputSchema = z.object({
  notes: z.string().trim().max(10_000),
  images: z.array(imageSchema).max(6),
});

export const createPlayerDraftWithAlmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (error || !isAdmin) throw new Error("Administrator access required.");
    const { generatePlayerDraft } = await import("./almail-ai.server");
    return generatePlayerDraft(data.notes, data.images);
  });

export const createArticleDraftWithAlmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (error || !isAdmin) throw new Error("Administrator access required.");
    const { generateArticleDraft } = await import("./almail-ai.server");
    return generateArticleDraft(data.notes, data.images);
  });