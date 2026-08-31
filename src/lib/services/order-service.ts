import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/services/settings-service";
import { findZoneForCep } from "@/lib/services/delivery-zone-service";
import { isStoreOpenNow } from "@/lib/opening-hours";
import { parseAcceptedPaymentMethods, getNextStatus } from "@/lib/constants";
import { parseNotifiedStatuses } from "@/lib/order-notifications";
import type { CreateOrderInput } from "@/lib/validations/order";
import type { OrderStatus, DeliveryType } from "@/lib/constants";
import { Prisma } from "@prisma/client";

export class OrderServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "STORE_CLOSED"
      | "PAYMENT_METHOD_DISABLED"
      | "PRODUCT_NOT_FOUND"
      | "ADDON_NOT_FOUND"
      | "ORDER_NOT_FOUND"
      | "INVALID_CASH_AMOUNT"
      | "STATUS_CONFLICT"
      | "INVALID_STATUS_TRANSITION"
      | "NOT_PENDING_APPROVAL"
      | "NOT_PENDING_PAYMENT"
      | "CEP_NOT_COVERED"
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

  // Entrega usa a zona encontrada pelo CEP digitado, SE existir uma
  // cadastrada que bata — mas não bloqueia o pedido se não achar (zona por
  // CEP é opcional: enquanto a loja não cadastra a lista completa em
  // Configurações, cai de volta pro fluxo antigo — taxa 0, admin define ao
  // aprovar a entrega, ver approveDelivery). Bloquear aqui sem nenhuma zona
  // cadastrada travaria TODO pedido de entrega.
  let deliveryZoneMatch: Awaited<ReturnType<typeof findZoneForCep>> = null;
  if (input.deliveryType === "entrega") {
    const cep = input.customer.cep ?? "";
    deliveryZoneMatch = cep ? await findZoneForCep(cep) : null;
  }
  const deliveryFeeCents = deliveryZoneMatch?.feeCents ?? 0;
  const totalCents = itemsTotalCents + deliveryFeeCents;

  if (input.cashChangeForCents !== undefined && input.cashChangeForCents < totalCents) {
    throw new OrderServiceError(
      "O valor informado para troco é menor que o total do pedido.",
      "INVALID_CASH_AMOUNT"
    );
  }

  const customer = await prisma.customer.upsert({
    where: { phone: input.customer.phone },
    update: {
      name: input.customer.name,
      address: input.customer.address,
      addressNumber: input.customer.addressNumber,
      neighborhood: deliveryZoneMatch?.neighborhood ?? input.customer.neighborhood,
      complement: input.customer.complement,
      reference: input.customer.reference,
      cep: input.customer.cep,
    },
    create: {
      name: input.customer.name,
      phone: input.customer.phone,
      address: input.customer.address,
      addressNumber: input.customer.addressNumber,
      neighborhood: deliveryZoneMatch?.neighborhood ?? input.customer.neighborhood,
      complement: input.customer.complement,
      reference: input.customer.reference,
      cep: input.customer.cep,
    },
  });

  // Pedido de Pix entra no Kanban igual a qualquer outro, direto em
  // "recebido" — não fica escondido esperando confirmação manual (testado e
  // revertido: confundia a loja, que não sabia que precisava ir atrás dos
  // pedidos Pix num lugar separado). "aguardando_pagamento" continua existindo
  // como valor de status (histórico/isValidStatusTransition), só não é mais
  // usado na criação de pedidos novos.
  const initialStatus: OrderStatus = "recebido";

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
        status: initialStatus,
        deliveryType: input.deliveryType,
        paymentMethod: input.paymentMethod,
        wantsInvoice: input.wantsInvoice,
        cashChangeForCents: input.cashChangeForCents ?? null,
        itemsTotalCents,
        // Snapshot do endereço no momento do pedido — independente do
        // cadastro (mutável) do cliente, pra comanda/reimpressão sempre
        // mostrarem o endereço de QUANDO o pedido foi feito.
        address: input.deliveryType === "entrega" ? input.customer.address || null : null,
        addressNumber: input.deliveryType === "entrega" ? input.customer.addressNumber || null : null,
        neighborhood:
          input.deliveryType === "entrega"
            ? (deliveryZoneMatch?.neighborhood ?? input.customer.neighborhood ?? null)
            : null,
        complement: input.deliveryType === "entrega" ? input.customer.complement || null : null,
        reference: input.deliveryType === "entrega" ? input.customer.reference || null : null,
        cep: input.deliveryType === "entrega" ? input.customer.cep || null : null,
        deliveryZoneId: deliveryZoneMatch?.id ?? null,
        deliveryFeeCents,
        totalCents,
        notes: input.notes || null,
        items: { create: itemsData },
        statusHistory: { create: { status: initialStatus } },
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
      status: { not: "aguardando_pagamento" },
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

/** Pedidos Pix ainda não confirmados manualmente — ficam fora do Kanban até o admin confirmar. */
export async function listPendingPixPayments(): Promise<OrderWithRelations[]> {
  return prisma.order.findMany({
    where: { status: "aguardando_pagamento" },
    include: orderInclude,
    orderBy: { createdAt: "asc" },
  });
}

export async function getOrderById(id: string): Promise<OrderWithRelations | null> {
  return prisma.order.findUnique({ where: { id }, include: orderInclude });
}

/**
 * Confere se a transição faz sentido pro tipo de pedido — nunca confia só no
 * que o cliente (frontend) mandou. "cancelado" é sempre permitido (menos de
 * um pedido já finalizado ou já a caminho — ver abaixo) por ser uma saída de
 * emergência fora do fluxo normal; pedidos de entrega em "recebido" só saem
 * daí via approveDelivery/rejectDelivery (não pelo endpoint genérico de
 * status).
 */
function isValidStatusTransition(
  current: OrderStatus,
  next: OrderStatus,
  deliveryType: DeliveryType
): boolean {
  if (current === "entregue" || current === "cancelado") return false;
  // "aguardando_pagamento" só sai via confirmPixPayment (pagamento confirmado)
  // ou cancelamento — nunca pelo fluxo genérico de "próximo status".
  if (current === "aguardando_pagamento") return next === "cancelado";
  // Pedido já saiu com o entregador — cancelar nesse ponto não impede a
  // entrega de acontecer, só some com o registro. Depois disso só dá pra
  // resolver por fora (ligando pro entregador), não pelo painel.
  if (current === "saiu_entrega") return next === "entregue";
  if (next === "cancelado") return true;
  if (current === "recebido" && deliveryType === "entrega") return false;
  return getNextStatus(current, deliveryType) === next;
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

  if (!isValidStatusTransition(existing.status as OrderStatus, status, existing.deliveryType as DeliveryType)) {
    throw new OrderServiceError(
      "Essa mudança de status não é permitida para esse pedido.",
      "INVALID_STATUS_TRANSITION"
    );
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

/**
 * Aprova a entrega de um pedido "recebido" (sem bairro pré-cadastrado, o
 * admin decide a taxa real ao aceitar) e o move pra "preparando". Só vale
 * pra deliveryType="entrega" — retirada/balcão nunca passam por aprovação.
 */
export async function approveDelivery(
  orderId: string,
  feeCents: number,
  adminId: string
): Promise<OrderWithRelations> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new OrderServiceError("Pedido não encontrado.", "ORDER_NOT_FOUND");
  }
  if (existing.deliveryType !== "entrega" || existing.status !== "recebido") {
    throw new OrderServiceError(
      "Este pedido não está aguardando aprovação de entrega.",
      "NOT_PENDING_APPROVAL"
    );
  }

  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: "recebido" },
    data: {
      status: "preparando",
      deliveryFeeCents: feeCents,
      totalCents: existing.itemsTotalCents + feeCents,
      // Só marca como confirmada se o admin digitou um valor > 0 — deixar em
      // R$0,00 nessa etapa quase sempre é distração (o prompt já vem
      // pré-preenchido com 0 quando não achou zona pelo CEP), não uma
      // escolha real de "entrega grátis". Ver botão dedicado abaixo
      // (setDeliveryFee) pra confirmar de propósito, inclusive com valor 0.
      deliveryFeeConfirmed: feeCents > 0,
    },
  });
  if (updated.count === 0) {
    throw new OrderServiceError(
      "Este pedido já foi atualizado por outra pessoa. Atualize a tela e tente de novo.",
      "STATUS_CONFLICT"
    );
  }
  await prisma.orderStatusHistory.create({
    data: { orderId, status: "preparando", changedById: adminId },
  });
  return (await getOrderById(orderId))!;
}

/**
 * Botão dedicado "Definir taxa e enviar Pix" — corrige um pedido de entrega
 * que ficou com `deliveryFeeConfirmed=false` (aprovado com R$0,00 sem
 * querer, ou pedido antigo de antes dessa trava existir). Diferente de
 * `approveDelivery`, funciona em QUALQUER status (não só "recebido", já que
 * o pedido pode já estar em preparo) e SEMPRE marca como confirmada, mesmo
 * que o valor digitado seja 0 — aqui a ação é sempre intencional.
 */
export async function setDeliveryFee(
  orderId: string,
  feeCents: number,
  _adminId: string
): Promise<OrderWithRelations> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new OrderServiceError("Pedido não encontrado.", "ORDER_NOT_FOUND");
  }
  if (existing.deliveryType !== "entrega") {
    throw new OrderServiceError("Este pedido não é de entrega.", "NOT_PENDING_APPROVAL");
  }
  if (existing.status === "cancelado") {
    throw new OrderServiceError("Este pedido está cancelado.", "INVALID_STATUS_TRANSITION");
  }

  // Não grava OrderStatusHistory aqui — só ajusta a taxa, o status do
  // Kanban não muda (evitaria um registro de auditoria enganoso, como se o
  // pedido tivesse "mudado de status" pro mesmo status que já estava).
  await prisma.order.update({
    where: { id: orderId },
    data: {
      deliveryFeeCents: feeCents,
      totalCents: existing.itemsTotalCents + feeCents,
      deliveryFeeConfirmed: true,
    },
  });
  return (await getOrderById(orderId))!;
}

/**
 * Confirma manualmente que o Pix de um pedido "aguardando_pagamento" caiu —
 * o admin confere no aplicativo do banco e clica em "Confirmar pagamento" no
 * Kanban (não existe confirmação automática, ver src/lib/pix-brcode.ts).
 * Move o pedido pra "recebido", de onde segue o fluxo normal (ou aprovação de
 * entrega, se for o caso).
 */
export async function confirmPixPayment(orderId: string): Promise<OrderWithRelations> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new OrderServiceError("Pedido não encontrado.", "ORDER_NOT_FOUND");
  }
  if (existing.paymentMethod !== "pix") {
    throw new OrderServiceError("Este pedido não é pago por Pix.", "NOT_PENDING_PAYMENT");
  }

  // Não mexe no `status` do pedido (Kanban) — só marca que o dinheiro caiu.
  // O pedido pode já estar em qualquer etapa do preparo nesse momento (a
  // cozinha não fica esperando a confirmação do Pix pra começar).
  await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { not: "pago" } },
    data: { paymentStatus: "pago" },
  });
  await prisma.pixCharge.updateMany({ where: { orderId }, data: { status: "pago", paidAt: new Date() } });
  return (await getOrderById(orderId))!;
}

// Pedido só pode ser cancelado pelo próprio cliente (sem admin envolvido)
// enquanto ainda não saiu pra entrega/ficou pronto pra retirada — depois
// disso a loja já pode ter preparado/despachado, então só o admin decide.
const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = ["recebido", "preparando"];

/** Cancelamento feito pelo próprio cliente (tela /pedido/[id], sem login) — ex: pediu por engano, desistiu do Pix. */
export async function cancelOrderByCustomer(orderId: string): Promise<OrderWithRelations> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new OrderServiceError("Pedido não encontrado.", "ORDER_NOT_FOUND");
  }
  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(existing.status as OrderStatus)) {
    throw new OrderServiceError(
      "Este pedido já está a caminho ou foi finalizado — não é mais possível cancelar por aqui. Fale com a loja.",
      "INVALID_STATUS_TRANSITION"
    );
  }

  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: { in: CUSTOMER_CANCELLABLE_STATUSES } },
    data: { status: "cancelado" },
  });
  if (updated.count === 0) {
    throw new OrderServiceError(
      "Este pedido já foi atualizado — atualize a página e confira o status.",
      "STATUS_CONFLICT"
    );
  }
  await prisma.orderStatusHistory.create({ data: { orderId, status: "cancelado" } });
  return (await getOrderById(orderId))!;
}

/** Recusa a entrega de um pedido "recebido" — cancela e registra o motivo. */
export async function rejectDelivery(
  orderId: string,
  reason: string | undefined,
  adminId: string
): Promise<OrderWithRelations> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new OrderServiceError("Pedido não encontrado.", "ORDER_NOT_FOUND");
  }
  if (existing.deliveryType !== "entrega" || existing.status !== "recebido") {
    throw new OrderServiceError(
      "Este pedido não está aguardando aprovação de entrega.",
      "NOT_PENDING_APPROVAL"
    );
  }

  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: "recebido" },
    data: { status: "cancelado", rejectionReason: reason || null },
  });
  if (updated.count === 0) {
    throw new OrderServiceError(
      "Este pedido já foi atualizado por outra pessoa. Atualize a tela e tente de novo.",
      "STATUS_CONFLICT"
    );
  }
  await prisma.orderStatusHistory.create({
    data: { orderId, status: "cancelado", changedById: adminId },
  });
  return (await getOrderById(orderId))!;
}

/**
 * Marca que o aviso de WhatsApp pra esse status já foi gerado/enviado —
 * idempotente (adicionar um status já presente não duplica). O envio em si é
 * manual (link wa.me clicado pelo admin); isso só evita que a tela ofereça
 * "avisar" de novo pro mesmo status sem querer.
 */
export async function markStatusNotified(orderId: string, status: OrderStatus): Promise<OrderWithRelations> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    throw new OrderServiceError("Pedido não encontrado.", "ORDER_NOT_FOUND");
  }
  const notified = new Set(parseNotifiedStatuses(existing.notifiedStatuses));
  notified.add(status);
  return prisma.order.update({
    where: { id: orderId },
    data: { notifiedStatuses: JSON.stringify([...notified]) },
    include: orderInclude,
  });
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

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
}

export interface TodayStats {
  orderCount: number;
  revenueCents: number;
  averageTicketCents: number;
  /** Pedidos ainda em andamento (não entregues nem cancelados) — de qualquer dia, não só hoje. */
  pendingOrders: number;
  /** Top 5 produtos por quantidade vendida hoje. */
  topProducts: TopProduct[];
}

/** Estatísticas da tela inicial do admin. Cancelados não contam como venda. */
export async function getTodayStats(): Promise<TodayStats> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [orders, pendingOrders, topItems] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: startOfToday }, status: { notIn: ["cancelado", "aguardando_pagamento"] } },
      select: { totalCents: true },
    }),
    prisma.order.count({
      where: { status: { notIn: ["entregue", "cancelado", "aguardando_pagamento"] } },
    }),
    prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: { order: { createdAt: { gte: startOfToday }, status: { notIn: ["cancelado", "aguardando_pagamento"] } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const orderCount = orders.length;
  const revenueCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const averageTicketCents = orderCount > 0 ? Math.round(revenueCents / orderCount) : 0;
  const topProducts: TopProduct[] = topItems.map((item) => ({
    productId: item.productId,
    name: item.productName,
    quantity: item._sum.quantity ?? 0,
  }));

  return { orderCount, revenueCents, averageTicketCents, pendingOrders, topProducts };
}
