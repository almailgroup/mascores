/** Low-cost Google image editing (Gemini 3.1 Flash Lite Image) via the AI gateway. */
export const CHEAP_IMAGE_MODEL = "google/gemini-3.1-flash-lite-image";

export async function cheapImageEdit(blob: Blob, prompt: string): Promise<{ b64?: string; status: number; error?: string }> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: CHEAP_IMAGE_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: blob.type || "image/png", data: btoa(bin) } }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });
  const json = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[]; error?: { message?: string }; message?: string } | null;
  if (!res.ok) {
    const error = res.status === 402 ? "AI credits have run out." : res.status === 429 ? "Too many requests, try again shortly." : (json?.error?.message ?? json?.message ?? "Photo edit failed.");
    return { status: res.status, error };
  }
  const b64 = json?.data?.[0]?.b64_json;
  return b64 ? { status: 200, b64 } : { status: 502, error: "No image returned." };
}
