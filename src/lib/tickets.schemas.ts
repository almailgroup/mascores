import { z } from "zod";

export const claimTicketSchema = z.object({
  offerId: z.string().uuid(),
  holderName: z.string().trim().max(80).optional(),
  holderEmail: z.string().trim().max(120).optional(),
  holderPhone: z.string().trim().max(40).optional(),
  accessCode: z.string().trim().max(120).optional(),
});

export const scanTicketSchema = z.object({
  code: z.string().trim().min(4).max(120),
});
