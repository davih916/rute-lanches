import "server-only";
import { prisma } from "@/lib/prisma";
import type { CreateDeliveryZoneInput, UpdateDeliveryZoneInput } from "@/lib/validations/delivery-zone";

export class DeliveryZoneServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "DUPLICATE" | "HAS_ORDERS"
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

/** Usado pelo checkout público — só bairros ativos E visíveis pro cliente, ordenados por nome. */
export async function listActiveDeliveryZones() {
  return prisma.deliveryZone.findMany({
    where: { active: true, visibleToCustomers: true },
    orderBy: { neighborhood: "asc" },
  });
}

/**
 * Usado pela Venda no Balcão (admin) — todos os bairros ativos, incluindo os
 * marcados como "só admin" (ex: endereço específico de um cliente com taxa
 * combinada à parte). Diferente de `listActiveDeliveryZones`, que o site
 * público usa e não deve mostrar essas entradas.
 */
export async function listActiveDeliveryZonesForStaff() {
  return prisma.deliveryZone.findMany({
    where: { active: true },
    orderBy: { neighborhood: "asc" },
  });
}

export async function createDeliveryZone(input: CreateDeliveryZoneInput) {
  const existing = await prisma.deliveryZone.findUnique({
    where: { neighborhood: input.neighborhood },
  });
  if (existing) {
    throw new DeliveryZoneServiceError("Já existe um bairro cadastrado com esse nome.", "DUPLICATE");
  }

  const maxOrder = await prisma.deliveryZone.aggregate({ _max: { order: true } });
  return prisma.deliveryZone.create({
    data: {
      neighborhood: input.neighborhood,
      feeCents: input.feeCents,
      visibleToCustomers: input.visibleToCustomers ?? true,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
}

export async function updateDeliveryZone(id: string, input: UpdateDeliveryZoneInput) {
  const existing = await prisma.deliveryZone.findUnique({ where: { id } });
  if (!existing) {
    throw new DeliveryZoneServiceError("Bairro não encontrado.", "NOT_FOUND");
  }

  if (input.neighborhood && input.neighborhood !== existing.neighborhood) {
    const duplicate = await prisma.deliveryZone.findFirst({
      where: { neighborhood: input.neighborhood, NOT: { id } },
    });
    if (duplicate) {
      throw new DeliveryZoneServiceError("Já existe um bairro cadastrado com esse nome.", "DUPLICATE");
    }
  }

  return prisma.deliveryZone.update({ where: { id }, data: input });
}

/** Só permite excluir bairros nunca usados em pedidos (FK orders.deliveryZoneId é RESTRICT) — use `active` para os demais. */
export async function deleteDeliveryZone(id: string): Promise<void> {
  const existing = await prisma.deliveryZone.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!existing) {
    throw new DeliveryZoneServiceError("Bairro não encontrado.", "NOT_FOUND");
  }
  if (existing._count.orders > 0) {
    throw new DeliveryZoneServiceError(
      "Este bairro já foi usado em pedidos e não pode ser excluído — desative-o em vez disso.",
      "HAS_ORDERS"
    );
  }
  await prisma.deliveryZone.delete({ where: { id } });
}
