import "server-only";
import { prisma } from "@/lib/prisma";
import type { CreateDeliveryZoneInput, UpdateDeliveryZoneInput } from "@/lib/validations/delivery-zone";

export class DeliveryZoneServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "DUPLICATE" | "DUPLICATE_CEP" | "HAS_ORDERS"
  ) {
    super(message);
    this.name = "DeliveryZoneServiceError";
  }
}

export async function listDeliveryZonesForAdmin() {
  return prisma.deliveryZone.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { orders: true } } },
  });
}

/**
 * Encontra a zona de entrega pro CEP digitado — usa o prefixo mais
 * LONGO/específico entre os cadastrados que bater com o início do CEP (ex:
 * com "18095" e "180950" cadastrados, um CEP "18095001" cai em "180950" se
 * bater, senão em "18095"). Só considera zonas ativas.
 */
export async function findZoneForCep(cepDigits: string) {
  const zones = await prisma.deliveryZone.findMany({
    where: { active: true, cepPrefix: { not: null } },
  });

  let best: (typeof zones)[number] | null = null;
  for (const zone of zones) {
    if (!zone.cepPrefix) continue;
    if (!cepDigits.startsWith(zone.cepPrefix)) continue;
    if (!best || zone.cepPrefix.length > best.cepPrefix!.length) {
      best = zone;
    }
  }
  return best;
}

/**
 * Usado pela Venda no Balcão (admin) — todos os bairros ativos, incluindo os
 * marcados como "só admin" (ex: endereço específico de um cliente com taxa
 * combinada à parte).
 */
export async function listActiveDeliveryZonesForStaff() {
  return prisma.deliveryZone.findMany({
    where: { active: true },
    orderBy: { neighborhood: "asc" },
  });
}

async function assertNoDuplicates(neighborhood: string, cepPrefix: string, excludeId?: string) {
  const [duplicateName, duplicateCep] = await Promise.all([
    prisma.deliveryZone.findFirst({ where: { neighborhood, NOT: excludeId ? { id: excludeId } : undefined } }),
    prisma.deliveryZone.findFirst({ where: { cepPrefix, NOT: excludeId ? { id: excludeId } : undefined } }),
  ]);
  if (duplicateName) {
    throw new DeliveryZoneServiceError("Já existe uma zona cadastrada com esse nome.", "DUPLICATE");
  }
  if (duplicateCep) {
    throw new DeliveryZoneServiceError("Já existe uma zona cadastrada com esse prefixo de CEP.", "DUPLICATE_CEP");
  }
}

export async function createDeliveryZone(input: CreateDeliveryZoneInput) {
  await assertNoDuplicates(input.neighborhood, input.cepPrefix);

  const maxOrder = await prisma.deliveryZone.aggregate({ _max: { order: true } });
  return prisma.deliveryZone.create({
    data: {
      neighborhood: input.neighborhood,
      cepPrefix: input.cepPrefix,
      feeCents: input.feeCents,
      visibleToCustomers: input.visibleToCustomers ?? true,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
}

export async function updateDeliveryZone(id: string, input: UpdateDeliveryZoneInput) {
  const existing = await prisma.deliveryZone.findUnique({ where: { id } });
  if (!existing) {
    throw new DeliveryZoneServiceError("Zona não encontrada.", "NOT_FOUND");
  }

  const nextNeighborhood = input.neighborhood ?? existing.neighborhood;
  const nextCepPrefix = input.cepPrefix ?? existing.cepPrefix;
  if (
    (input.neighborhood && input.neighborhood !== existing.neighborhood) ||
    (input.cepPrefix && input.cepPrefix !== existing.cepPrefix)
  ) {
    await assertNoDuplicates(nextNeighborhood, nextCepPrefix ?? "", id);
  }

  return prisma.deliveryZone.update({ where: { id }, data: input });
}

/** Só permite excluir zonas nunca usadas em pedidos (FK orders.deliveryZoneId é RESTRICT) — use `active` para as demais. */
export async function deleteDeliveryZone(id: string): Promise<void> {
  const existing = await prisma.deliveryZone.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!existing) {
    throw new DeliveryZoneServiceError("Zona não encontrada.", "NOT_FOUND");
  }
  if (existing._count.orders > 0) {
    throw new DeliveryZoneServiceError(
      "Esta zona já foi usada em pedidos e não pode ser excluída — desative-a em vez disso.",
      "HAS_ORDERS"
    );
  }
  await prisma.deliveryZone.delete({ where: { id } });
}
