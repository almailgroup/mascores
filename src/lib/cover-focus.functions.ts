import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROMPT = "Find the visual center of the most important subject in this sports photo (prioritise players' faces; if several people, the center of their faces). Return x and y as percentages (0-100) from the left and top, as json.";

/** AI looks at a news photo and returns where the main subject (faces) is, as a CSS object-position. */
export const detectCoverFocus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().url().max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (!allowed) throw new Error("Admins only.");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { focus: null };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        input: [{ role: "user", content: [
          { type: "input_text", text: PROMPT },
          { type: "input_image", image_url: data.url },
        ] }],
        text: { format: { type: "json_schema", name: "focus", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["x", "y"],
          properties: { x: { type: "number" }, y: { type: "number" } },
        } } },
      }),
    });
    if (!res.ok || !res.body) return { focus: null };
    // Read the streamed answer and collect the text.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(line.slice(5).trim()) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
        } catch { /* ignore keep-alives */ }
      }
    }
    try {
      const p = JSON.parse(out) as { x: number; y: number };
      const c = (n: number) => Math.min(100, Math.max(0, Math.round(Number(n) || 50)));
      return { focus: `${c(p.x)}% ${c(p.y)}%` };
    } catch { return { focus: null }; }
  });
