import { z } from "zod";

export const productAddonInputSchema = z.object({
  // Presente = adicional já existe (atualiza); ausente = adicional novo (cria).
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  priceCents: z.number().int().min(0),
});

export const productInputSchema = z.object({
  categoryId: z.string().min(1, "Selecione uma categoria"),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  ingredients: z.string().trim().max(300).optional().or(z.literal("")),
  priceCents: z.number().int().min(0),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  active: z.boolean(),
  addons: z.array(productAddonInputSchema).max(40).default([]),
});

export type ProductInput = z.infer<typeof productInputSchema>;
