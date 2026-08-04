import { streamText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

type ImageInput = { dataUrl: string; name: string };

export type PlayerDraft = {
  name: string;
  position: string | null;
  shirt_number: number | null;
  height_cm: number | null;
  dob: string | null;
  nationality: string | null;
  nationality_code: string | null;
  market_value: string | null;
};

export type ArticleDraft = {
  title: string;
  excerpt: string;
  body_markdown: string;
  title_ar: string;
  excerpt_ar: string;
  body_markdown_ar: string;
};

function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Almail AI returned an invalid draft.");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

async function runAlmail(prompt: string, images: ImageInput[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Almail AI is not configured.");
  const provider = createLovableAiGatewayProvider(apiKey);
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string; mediaType: string }
  > = [{ type: "text", text: prompt }];

  for (const image of images) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i.exec(image.dataUrl);
    if (!match?.[1] || !match[2]) continue;
    content.push({ type: "image", image: match[2], mediaType: match[1] });
  }

  const result = streamText({
    model: provider("openai/gpt-5.6-sol"),
    providerOptions: { lovable: { reasoningEffort: "none" } },
    messages: [{ role: "user", content }],
  });
  return result.text;
}

export async function generatePlayerDraft(notes: string, images: ImageInput[]): Promise<PlayerDraft> {
  const text = await runAlmail(
    `You are Almail AI, a careful football data editor. Extract a proposed player record from the notes and attached images. Never invent a fact that is not visible or stated. Return JSON only with exactly these keys: name, position, shirt_number, height_cm, dob, nationality, nationality_code, market_value. Position must be Goalkeeper, Defender, Midfielder, Forward, Unknown, or null. dob must be YYYY-MM-DD or null. nationality_code must be a two-letter ISO country code or null. Numeric fields must be numbers or null. Notes: ${notes || "No notes supplied."}`,
    images,
  );
  const draft = parseJson<PlayerDraft>(text);
  return {
    name: String(draft.name ?? "").slice(0, 160),
    position: ["Goalkeeper", "Defender", "Midfielder", "Forward", "Unknown"].includes(String(draft.position)) ? String(draft.position) : null,
    shirt_number: Number.isInteger(draft.shirt_number) && Number(draft.shirt_number) >= 0 && Number(draft.shirt_number) <= 999 ? Number(draft.shirt_number) : null,
    height_cm: Number.isInteger(draft.height_cm) && Number(draft.height_cm) >= 80 && Number(draft.height_cm) <= 260 ? Number(draft.height_cm) : null,
    dob: /^\d{4}-\d{2}-\d{2}$/.test(String(draft.dob)) ? String(draft.dob) : null,
    nationality: draft.nationality ? String(draft.nationality).slice(0, 100) : null,
    nationality_code: /^[A-Za-z]{2}$/.test(String(draft.nationality_code)) ? String(draft.nationality_code).toUpperCase() : null,
    market_value: draft.market_value ? String(draft.market_value).slice(0, 80) : null,
  };
}

export async function generateArticleDraft(notes: string, images: ImageInput[]): Promise<ArticleDraft> {
  const text = await runAlmail(
    `You are Almail AI, the bilingual newsroom assistant for a professional football scores platform. Draft the same factual, neutral article in English and Modern Standard Arabic from only the supplied notes and visible image information. Do not invent quotes, scores, dates, identities, or events. Return JSON only with exactly these keys: title, excerpt, body_markdown, title_ar, excerpt_ar, body_markdown_ar. Both bodies should use clean Markdown and a journalistic structure. The Arabic must be a complete natural translation, including the headline and summary. Notes: ${notes}`,
    images,
  );
  const draft = parseJson<ArticleDraft>(text);
  return {
    title: String(draft.title ?? "").slice(0, 180),
    excerpt: String(draft.excerpt ?? "").slice(0, 320),
    body_markdown: String(draft.body_markdown ?? "").slice(0, 30000),
    title_ar: String(draft.title_ar ?? "").slice(0, 180),
    excerpt_ar: String(draft.excerpt_ar ?? "").slice(0, 320),
    body_markdown_ar: String(draft.body_markdown_ar ?? "").slice(0, 30000),
  };
}

export type VenueDraft = { name: string; city: string | null; country: string | null; country_code: string | null; capacity: number | null; description: string | null };

export async function generateVenueDraft(notes: string): Promise<VenueDraft> {
  const text = await runAlmail(
    `You are Almail AI, a careful football venue data editor. Extract stadium information only from the supplied text. Never invent missing facts. Return JSON only with exactly these keys: name, city, country, country_code, capacity, description. country_code is a two-letter ISO code or null, capacity is an integer or null, and description is a concise factual summary or null. Text: ${notes}`,
    [],
  );
  const draft = parseJson<VenueDraft>(text);
  return {
    name: String(draft.name ?? "").slice(0, 160),
    city: draft.city ? String(draft.city).slice(0, 120) : null,
    country: draft.country ? String(draft.country).slice(0, 100) : null,
    country_code: /^[A-Za-z]{2}$/.test(String(draft.country_code)) ? String(draft.country_code).toUpperCase() : null,
    capacity: Number.isInteger(draft.capacity) && Number(draft.capacity) > 0 ? Number(draft.capacity) : null,
    description: draft.description ? String(draft.description).slice(0, 3000) : null,
  };
}
export type FixtureDraft = {
  home: string;
  away: string;
  kickoff_at: string | null;
  round_number: number | null;
  venue: string | null;
  city: string | null;
};

export async function generateFixtureDrafts(notes: string, images: ImageInput[], teams: string[]): Promise<FixtureDraft[]> {
  const text = await runAlmail(
    `You are Almail AI, a fixture-list parser for a football platform. Read the notes and images and extract every match you can see. Only use these known team names when a name clearly matches one of them: ${teams.join(", ") || "(none supplied)"}. Never invent matches, dates or venues. Return JSON only in the shape {"matches":[{"home":string,"away":string,"kickoff_at":string|null,"round_number":number|null,"venue":string|null,"city":string|null}]}. kickoff_at must be a full ISO 8601 timestamp or null. Notes: ${notes || "No notes supplied."}`,
    images,
  );
  const parsed = parseJson<{ matches?: unknown }>(text);
  const list = Array.isArray(parsed.matches) ? parsed.matches : [];
  return list.slice(0, 60).map((raw) => {
    const row = raw as Partial<FixtureDraft>;
    return {
      home: String(row.home ?? "").slice(0, 160),
      away: String(row.away ?? "").slice(0, 160),
      kickoff_at: row.kickoff_at && !Number.isNaN(new Date(String(row.kickoff_at)).getTime()) ? new Date(String(row.kickoff_at)).toISOString() : null,
      round_number: Number.isInteger(row.round_number) && Number(row.round_number) > 0 && Number(row.round_number) <= 200 ? Number(row.round_number) : null,
      venue: row.venue ? String(row.venue).slice(0, 160) : null,
      city: row.city ? String(row.city).slice(0, 120) : null,
    };
  }).filter((row) => row.home && row.away);
}
