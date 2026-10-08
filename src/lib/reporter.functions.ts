import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z.object({ code: z.string().trim().min(4).max(40) });

const applicationSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(40), email: z.string().trim().email().max(160),
  platform: z.enum(['instagram', 'tiktok', 'x', 'snapchat', 'youtube', 'facebook', 'other']),
  handle: z.string().trim().min(1).max(120), entity_type: z.enum(['individual', 'company']),
  company_name: z.string().trim().max(160).nullable(),
  social_links: z.record(z.string().max(120)), civil_id_photo_path: z.string().max(300),
});

export const applyAsReporter = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => applicationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: suspended, error: suspensionError } = await context.supabase.rpc('is_suspended', { _uid: context.userId });
    if (suspensionError || suspended) throw new Error('This account cannot submit a news request.');
    if (data.entity_type === 'company' && !data.company_name) throw new Error('Company name is required.');
    const parts = data.civil_id_photo_path.split('/');
    if (parts.length !== 2 || parts[0] !== context.userId) throw new Error('Upload your civil ID photo first.');
    const { data: files, error: fileError } = await context.supabase.storage.from('reporter-identity').list(context.userId, { search: parts[1], limit: 100 });
    if (fileError || !files?.some((file) => file.name === parts[1])) throw new Error('Civil ID photo not found. Please upload it again.');
    const { error } = await context.supabase.from('news_reporters').insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const viewReporterIdentity = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: owner, error: roleError } = await context.supabase.rpc('is_main_admin', { _uid: context.userId });
    if (roleError || !owner) throw new Error('Owner access only.');
    const { data: row } = await context.supabase.from('news_reporters').select('civil_id_photo_path').eq('id', data.id).maybeSingle();
    if (!row?.civil_id_photo_path) throw new Error('No civil ID photo supplied.');
    const { data: link, error } = await context.supabase.storage.from('reporter-identity').createSignedUrl(row.civil_id_photo_path, 300);
    if (error || !link) throw new Error('Could not open the identity photo.');
    return { url: link.signedUrl };
  });

/** A reporter redeems the access code the main admin sent them. */
export const redeemReporterCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => codeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("news_reporters")
      .select("id, access_code")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) return { ok: false as const, reason: "no-application" };
    if (!row.access_code || row.access_code.trim().toUpperCase() !== data.code.toUpperCase()) {
      return { ok: false as const, reason: "invalid-code" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("news_reporters")
      .update({ status: "active", code_redeemed_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: true as const };
  });
