import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently removes the signed-in user's account and profile data. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: deviceError } = await context.supabase.from("device_tokens").delete().eq("user_id", context.userId);
    if (deviceError) throw new Error("We could not disconnect your notifications. Please try again.");
    const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", context.userId);
    if (profileError) throw new Error("We could not delete your account. Please try again.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error("We could not delete your account. Please try again.");
    return { ok: true };
  });
