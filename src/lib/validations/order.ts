import { z } from "zod";
import { PAYMENT_METHODS, DELIVERY_TYPES } from "@/lib/constants";

export const orderItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
  notes: z.string().trim().max(300).optional(),
  addonIds: z.array(z.string().min(1)).max(20).default([]),
});

export const createOrderSchema = z
  .object({
    deliveryType: z.enum(DELIVERY_TYPES),
    customer: z.object({
      name: z.string().trim().min(2, "Informe seu nome completo").max(120),
      phone: z
        .string()
        .trim()
        .min(8, "Telefone inválido")
        .max(20)
        .regex(/^[0-9()+\-.\s]+$/, "Telefone inválido"),
      address: z.string().trim().max(200).optional(),
      addressNumber: z.string().trim().max(20).optional(),
      neighborhood: z.string().trim().max(100).optional(),
      complement: z.string().trim().max(120).optional(),
      reference: z.string().trim().max(200).optional(),
    }),
    paymentMethod: z.enum(PAYMENT_METHODS),
    // Bairro escolhido (só entrega) — a taxa nunca vem do cliente, é sempre
    // recalculada no order-service a partir do DeliveryZone no banco.
    deliveryZoneId: z.string().min(1).optional(),
    // Valor (em centavos) com que o cliente vai pagar em dinheiro — usado só
    // para calcular o troco. A conferência de que é >= total é feita no
    // order-service, pois o total só é conhecido depois de recalcular preços.
    cashChangeForCents: z.number().int().positive().max(100_000_00, "Valor de troco inválido").optional(),
    cpfCnpj: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v.length === 0 || v.length === 11 || v.length === 14, "CPF/CNPJ inválido")
      .optional(),
    wantsInvoice: z.boolean().optional().default(false),
    notes: z.string().trim().max(500).optional(),
    items: z.array(orderItemInputSchema).min(1, "O carrinho está vazio"),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryType === "entrega" && (!data.customer.address || data.customer.address.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customer", "address"],
        message: "Informe o endereço para entrega",
      });
    }
    if (data.deliveryType === "entrega" && !data.deliveryZoneId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deliveryZoneId"],
        message: "Selecione o bairro de entrega",
      });
    }
    if (data.cashChangeForCents !== undefined && data.paymentMethod !== "dinheiro") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashChangeForCents"],
        message: "Troco só se aplica ao pagamento em dinheiro",
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(["recebido", "preparando", "saiu_entrega", "entregue", "cancelado"]),
  // Status que o cliente acredita que o pedido está no momento do clique —
  // usado para evitar sobrescrever uma mudança concorrente feita por outro
  // admin (ver updateOrderStatus). Opcional para não quebrar chamadores antigos.
  previousStatus: z.enum(["recebido", "preparando", "saiu_entrega", "entregue", "cancelado"]).optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
