import { z } from "zod";

const imageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dataUrl: z.string().max(8_000_000).refine((value) => /^data:image\/(png|jpeg|webp);base64,/i.test(value), "Unsupported image"),
});

export const almailInputSchema = z.object({
  notes: z.string().trim().max(10_000),
  images: z.array(imageSchema).max(6),
});