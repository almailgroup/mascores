import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** AI looks at a news photo and returns where the main subject (faces) is, as a CSS object-position. */
export const detectCoverFocus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().url().max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (!allowed) throw new Error("Admins only.");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { focus: null };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Find the visual center of the most important subject in this sports photo (prioritise players' faces; if several people, the center of their faces). Reply ONLY with JSON {\"x\":0-100,\"y\":0-100} as percentages from the left and top." },
            { type: "image_url", image_url: { url: data.url } },
          ],
        }],
      }),
    });
    if (!res.ok) return { focus: null };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const match = json.choices?.[0]?.message?.content?.match(/\{[^}]*\}/);
    if (!match) return { focus: null };
    try {
      const p = JSON.parse(match[0]) as { x: number; y: number };
      const c = (n: number) => Math.min(100, Math.max(0, Math.round(Number(n) || 50)));
      return { focus: `${c(p.x)}% ${c(p.y)}%` };
    } catch { return { focus: null }; }
  });
