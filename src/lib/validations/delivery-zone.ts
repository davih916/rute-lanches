import { z } from "zod";

const cepPrefixSchema = z
  .string()
  .trim()
  .regex(/^\d{3,8}$/, "Use só números, de 3 a 8 dígitos (ex: 18095)");

export const createDeliveryZoneSchema = z.object({
  neighborhood: z.string().trim().min(2).max(100),
  cepPrefix: cepPrefixSchema,
  feeCents: z.number().int().min(0),
  visibleToCustomers: z.boolean().optional(),
});

export type CreateDeliveryZoneInput = z.infer<typeof createDeliveryZoneSchema>;

export const updateDeliveryZoneSchema = z.object({
  neighborhood: z.string().trim().min(2).max(100).optional(),
  cepPrefix: cepPrefixSchema.optional(),
  feeCents: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  visibleToCustomers: z.boolean().optional(),
});

export type UpdateDeliveryZoneInput = z.infer<typeof updateDeliveryZoneSchema>;
