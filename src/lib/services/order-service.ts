import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/services/settings-service";
import { isStoreOpenNow } from "@/lib/opening-hours";
import { parseAcceptedPaymentMethods } from "@/lib/constants";
import type { CreateOrderInput } from "@/lib/validations/order";
import type { OrderStatus } from "@/lib/constants";
import { Prisma } from "@prisma/client";

export class OrderServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "STORE_CLOSED"
      | "PAYMENT_METHOD_DISABLED"
      | "DELIVERY_ZONE_REQUIRED"
      | "DELIVERY_ZONE_UNAVAILABLE"
      | "PRODUCT_NOT_FOUND"
      | "ADDON_NOT_FOUND"
      | "ORDER_NOT_FOUND"
      | "INVALID_CASH_AMOUNT"
      | "STATUS_CONFLICT"
  ) {
    super(message);
    this.name = "OrderServiceError";
  }
}

export const orderInclude = {
  customer: true,
  items: { include: { addons: true } },
  statusHistory: { orderBy: { changedAt: "asc" as const } },
  fiscal: true,
  deliveryZone: true,
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export async function createOrder(input: CreateOrderInput): Promise<OrderWithRelations> {
  const settings = await getSettings();
  if (!isStoreOpenNow(settings)) {
    throw new OrderServiceError("A loja está fechada no momento.", "STORE_CLOSED");
  }

  const acceptedPaymentMethods = parseAcceptedPaymentMethods(settings.acceptedPaymentMethods);
  if (!acceptedPaymentMethods.includes(input.paymentMethod)) {
    throw new OrderServiceError(
      "Esta forma de pagamento não está disponível no momento.",
      "PAYMENT_METHOD_DISABLED"
    );
  }

  let deliveryZone = null;
  if (input.deliveryType === "entrega") {
    if (!input.deliveryZoneId) {
      throw new OrderServiceError("Selecione o bairro de entrega.", "DELIVERY_ZONE_REQUIRED");
    }
    deliveryZone = await prisma.deliveryZone.findUnique({ where: { id: input.deliveryZoneId } });
    if (!deliveryZone || !deliveryZone.active) {
      throw new OrderServiceError(
        "Este bairro não está mais disponível para entrega.",
        "DELIVERY_ZONE_UNAVAILABLE"
      );
    }
  }

  const productIds = input.items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
    include: { addons: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let itemsTotalCents = 0;
  const itemsData: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = [];

  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new OrderServiceError(`Produto indisponível: ${item.productId}`, "PRODUCT_NOT_FOUND");
    }

    const addonMap = new Map(product.addons.filter((a) => a.active).map((a) => [a.id, a]));
    const selectedAddons = item.addonIds.map((addonId) => {
      const addon = addonMap.get(addonId);
      if (!addon) {
        throw new OrderServiceError(
          `Adicional indisponível para ${product.name}`,
          "ADDON_NOT_FOUND"
        );
      }
      return addon;
    });

    const addonsCentsPerUnit = selectedAddons.reduce((sum, a) => sum + a.priceCents, 0);
    const lineTotal = (product.priceCents + addonsCentsPerUnit) * item.quantity;
    itemsTotalCents += lineTotal;

    itemsData.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPriceCents: product.priceCents,
      notes: item.notes || null,
      addons: {
        create: selectedAddons.map((a) => ({
          addonId: a.id,
          name: a.name,
          priceCents: a.priceCents,
        })),
      },
    });
  }

  // Snapshot: a taxa é gravada agora e nunca recalculada depois, mesmo que o bairro mude de preço.
  const deliveryFeeCents = deliveryZone?.feeCents ?? 0;
  const totalCents = itemsTotalCents + deliveryFeeCents;

  if (input.cashChangeForCents !== undefined && input.cashChangeForCents < totalCents) {
    throw new OrderServiceError(
      "O valor informado para troco é menor que o total do pedido.",
      "INVALID_CASH_AMOUNT"
    );
  }

  // O bairro escolhido no select é a fonte da verdade do nome — nunca texto livre do cliente.
  const neighborhood = deliveryZone?.neighborhood ?? input.customer.neighborhood;

  const customer = await prisma.customer.upsert({
    where: { phone: input.customer.phone },
    update: {
      name: input.customer.name,
      address: input.customer.address,
      addressNumber: input.customer.addressNumber,
      neighborhood,
      complement: input.customer.complement,
      reference: input.customer.reference,
    },
    create: {
      name: input.customer.name,
      phone: input.customer.phone,
      address: input.customer.address,
      addressNumber: input.customer.addressNumber,
      neighborhood,
      complement: input.customer.complement,
      reference: input.customer.reference,
    },
  });

  const order = await prisma.$transaction(async (tx) => {
    // Seguro contra pedidos concorrentes gerarem o mesmo número: o UPDATE do
    // Postgres bloqueia a linha "default" até a transação concorrente
    // terminar (first-updater-wins), então cada transação sempre lê o valor
    // já incrementado pela anterior.
    const updatedSettings = await tx.settings.update({
      where: { id: "default" },
      data: { lastOrderNumber: { increment: 1 } },
    });

    return tx.order.create({
      data: {
        orderNumber: updatedSettings.lastOrderNumber,
        customerId: customer.id,
        status: "recebido",
        deliveryType: input.deliveryType,
        paymentMethod: input.paymentMethod,
        wantsInvoice: input.wantsInvoice,
        cashChangeForCents: input.cashChangeForCents ?? null,
        itemsTotalCents,
        deliveryZoneId: deliveryZone?.id ?? null,
        deliveryFeeCents,
        totalCents,
        notes: input.notes || null,
        items: { create: itemsData },
        statusHistory: { create: { status: "recebido" } },
        fiscal: {
          create: {
            customerDocument: input.cpfCnpj || null,
            status: "aguardando_emissao",
          },
        },
      },
      include: orderInclude,
    });
  });

  return order;
}

export async function listOrders(): Promise<OrderWithRelations[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return prisma.order.findMany({
    where: {
      OR: [
        { status: { notIn: ["entregue", "cancelado"] } },
        { createdAt: { gte: startOfToday } },
      ],
    },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getOrderById(id: string): Promise<OrderWithRelations | null> {
  return prisma.order.findUnique({ where: { id }, include: orderInclude });
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  adminId: string,
  previousStatus?: OrderStatus
): Promise<OrderWithRelations> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new OrderServiceError("Pedido não encontrado.", "ORDER_NOT_FOUND");
  }

  // Quando o chamador informa o status que esperava encontrar (ex: o Kanban
  // sabe o que tinha na tela), faz a troca de forma condicional — protege
  // contra dois admins mudando o mesmo pedido ao mesmo tempo: o segundo a
  // chegar recebe STATUS_CONFLICT em vez de sobrescrever silenciosamente.
  if (previousStatus) {
    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: previousStatus },
      data: { status },
    });
    if (updated.count === 0) {
      throw new OrderServiceError(
        "Este pedido já foi atualizado por outra pessoa. Atualize a tela e tente de novo.",
        "STATUS_CONFLICT"
      );
    }
    await prisma.orderStatusHistory.create({ data: { orderId, status, changedById: adminId } });
    return (await getOrderById(orderId))!;
  }

  const [order] = await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: orderInclude,
    }),
    prisma.orderStatusHistory.create({
      data: { orderId, status, changedById: adminId },
    }),
  ]);

  return order;
}

export async function markOrderPrinted(orderId: string): Promise<OrderWithRelations> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new OrderServiceError("Pedido não encontrado.", "ORDER_NOT_FOUND");
  }
  if (order.printedAt) {
    return (await getOrderById(orderId))!;
  }
  return prisma.order.update({
    where: { id: orderId },
    data: { printedAt: new Date() },
    include: orderInclude,
  });
}

export interface TodayStats {
  orderCount: number;
  revenueCents: number;
  averageTicketCents: number;
}

/** Estatísticas simples do dia para a tela inicial do admin. Cancelados não contam como venda. */
export async function getTodayStats(): Promise<TodayStats> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: startOfToday }, status: { not: "cancelado" } },
    select: { totalCents: true },
  });

  const orderCount = orders.length;
  const revenueCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const averageTicketCents = orderCount > 0 ? Math.round(revenueCents / orderCount) : 0;

  return { orderCount, revenueCents, averageTicketCents };
}
