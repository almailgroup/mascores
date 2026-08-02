import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  texts: z.array(z.string().max(6000)).max(40),
  locale: z.enum(["ar", "en"]),
});

export const translateContent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    if (data.locale === "en") return {} as Record<string, string>;
    const { translateTexts } = await import("./translate.server");
    try {
      return await translateTexts(data.texts, data.locale);
    } catch {
      return {} as Record<string, string>;
    }
  });
