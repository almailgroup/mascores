import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** AI reads a screenshot of match statistics and returns each row as home/away values. */
export const readStatsPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    image: z.string().startsWith("data:image/").max(6_000_000),
    home: z.string().max(200), away: z.string().max(200),
    labels: z.array(z.string().max(60)).max(40),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (!allowed) throw new Error("Admins only.");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not available.");
    const prompt = `This image shows football match statistics. Home team (left): ${data.home}. Away team (right): ${data.away}. Extract every statistic row. Use these exact labels when a row matches one: ${data.labels.join(", ")}. Otherwise use a short English label. Keep values as shown (e.g. "58%", "12"). Translate Arabic labels to English.`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" },
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: data.image }] }],
        text: { format: { type: "json_schema", name: "stats", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["stats"],
          properties: { stats: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "home", "away"],
            properties: { label: { type: "string" }, home: { type: "string" }, away: { type: "string" } } } } },
        } } },
      }),
    });
    if (res.status === 429) throw new Error("Too many requests — try again in a minute.");
    if (res.status === 402) throw new Error("AI credits are used up.");
    if (!res.ok || !res.body) throw new Error("Could not read the photo.");
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
        } catch { /* keep-alive */ }
      }
    }
    try {
      const p = JSON.parse(out) as { stats: { label: string; home: string; away: string }[] };
      return { stats: p.stats.filter((s) => s.label).slice(0, 40).map((s) => ({ label: s.label.slice(0, 60), home: s.home.slice(0, 20), away: s.away.slice(0, 20) })) };
    } catch { throw new Error("Could not read the photo."); }
  });
