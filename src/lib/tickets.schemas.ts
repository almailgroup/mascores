import { z } from "zod";

export const holderSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
});

export const claimTicketSchema = z.object({
  offerId: z.string().uuid(),
  /** How many passes the fan wants from the generated code pool. */
  quantity: z.number().int().min(1).max(10).default(1),
  /** One entry per pass for paid tickets; free tickets need no details. */
  holders: z.array(holderSchema).max(10).optional(),
  accessCode: z.string().trim().max(120).optional(),
  /** Online payment is not live yet: fans can skip it and still receive their pass. */
  skipPayment: z.boolean().optional(),
});

export const scanTicketSchema = z.object({
  code: z.string().trim().min(4).max(120),
});

/** Reselling requires a phone number and an email so buyers can reach the seller. */
export const sellTicketSchema = z.object({
  ticketId: z.string().uuid(),
  price: z.number().min(0),
  phone: z.string().trim().min(6, "Please add a phone number buyers can reach you on.").max(40),
  email: z.string().trim().email("Please add a valid email address.").max(120),
});

export const ticketPoolSchema = z.object({
  offerId: z.string().uuid(),
  capacity: z.number().int().min(1).max(5000),
});

export const availabilitySchema = z.object({
  offerIds: z.array(z.string().uuid()).max(200),
});
