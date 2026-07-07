import { z } from "zod";
import { RECEIPT_WIDTHS, PAYMENT_METHODS } from "@/lib/constants";
import { WEEKDAYS } from "@/lib/opening-hours";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:mm)");

const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  open: timeSchema,
  close: timeSchema,
});

export const weeklyScheduleSchema = z.object(
  Object.fromEntries(WEEKDAYS.map((day) => [day, dayScheduleSchema])) as Record<
    (typeof WEEKDAYS)[number],
    typeof dayScheduleSchema
  >
);

export const updateSettingsSchema = z.object({
  storeName: z.string().trim().min(2).max(80),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB)"),
  secondaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB)"),
  whatsapp: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  storeOpen: z.boolean(),
  openingHours: weeklyScheduleSchema,
  acceptedPaymentMethods: z
    .array(z.enum(PAYMENT_METHODS))
    .min(1, "Selecione ao menos uma forma de pagamento"),
  minOrderCents: z.number().int().min(0),
  receiptWidth: z.enum(RECEIPT_WIDTHS),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
