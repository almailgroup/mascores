import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const unlockAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { password: string }) => input)
  .handler(async ({ data, context }) => {
    const expected = process.env.ADMIN_UNLOCK_PASSWORD;
    if (!expected) throw new Error("Admin password not configured");
    if (data.password !== expected) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("grant_admin", { _uid: context.userId });
    return { ok: true as const };
  });