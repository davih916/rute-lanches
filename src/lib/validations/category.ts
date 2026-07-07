import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  order: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
