import "server-only";
import { prisma } from "@/lib/prisma";
import type { Settings } from "@prisma/client";

const DEFAULT_SETTINGS_ID = "default";

/** Garante que sempre exista exatamente uma linha de configurações. */
export async function getSettings(): Promise<Settings> {
  const settings = await prisma.settings.upsert({
    where: { id: DEFAULT_SETTINGS_ID },
    update: {},
    create: { id: DEFAULT_SETTINGS_ID },
  });
  return settings;
}

export interface UpdateSettingsData {
  storeName: string;
  primaryColor: string;
  secondaryColor: string;
  whatsapp?: string;
  address?: string;
  storeOpen: boolean;
  openingHours: string; // JSON serializado (ver src/lib/opening-hours.ts)
  acceptedPaymentMethods: string; // JSON array serializado (ver src/lib/constants.ts)
  minOrderCents: number;
  receiptWidth: string;
}

export async function updateSettings(data: UpdateSettingsData): Promise<Settings> {
  return prisma.settings.upsert({
    where: { id: DEFAULT_SETTINGS_ID },
    update: data,
    create: { id: DEFAULT_SETTINGS_ID, ...data },
  });
}
