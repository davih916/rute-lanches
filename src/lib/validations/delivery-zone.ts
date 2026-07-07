import { z } from "zod";

export const createDeliveryZoneSchema = z.object({
  neighborhood: z.string().trim().min(2).max(100),
  feeCents: z.number().int().min(0),
});

export type CreateDeliveryZoneInput = z.infer<typeof createDeliveryZoneSchema>;

export const updateDeliveryZoneSchema = z.object({
  neighborhood: z.string().trim().min(2).max(100).optional(),
  feeCents: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export type UpdateDeliveryZoneInput = z.infer<typeof updateDeliveryZoneSchema>;
