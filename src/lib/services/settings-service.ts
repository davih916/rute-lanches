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

/**
 * Usado nas páginas públicas (layout raiz, site). Se o banco estiver
 * inacessível (DATABASE_URL ausente/errada, banco fora do ar), retorna um
 * fallback razoável em vez de derrubar a página com erro 500 — `storeOpen:
 * false` é proposital: sem conseguir confirmar o estado real, é mais seguro
 * mostrar "fechado" do que aceitar pedidos que vão falhar de qualquer forma.
 */
export async function getSettingsSafe(): Promise<Settings> {
  try {
    return await getSettings();
  } catch (error) {
    console.error(
      "[settings-service] Falha ao carregar configurações — usando fallback. Verifique DATABASE_URL e se as migrations foram aplicadas (prisma migrate deploy).",
      error
    );
    return {
      id: DEFAULT_SETTINGS_ID,
      storeName: "Rute Lanches",
      logoUrl: null,
      primaryColor: "#F97316",
      secondaryColor: "#16A34A",
      whatsapp: null,
      address: null,
      storeOpen: false,
      openingHours: "{}",
      acceptedPaymentMethods: "[]",
      pixKey: null,
      pixCity: "SOROCABA",
      deliveryFeeCents: 0,
      minOrderCents: 0,
      receiptWidth: "80mm",
      lastOrderNumber: 0,
      updatedAt: new Date(),
    };
  }
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
  pixKey?: string;
  pixCity?: string;
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
