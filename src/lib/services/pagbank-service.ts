import "server-only";
import { prisma } from "@/lib/prisma";
import { getOrderById } from "@/lib/services/order-service";
import { getPagBankConfig, getPagBankBaseUrl, getPagBankToken } from "@/lib/services/pagbank-config-service";
import type { PixCharge } from "@prisma/client";

export class PagBankServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "ORDER_NOT_FOUND" | "NOT_PIX"
  ) {
    super(message);
    this.name = "PagBankServiceError";
  }
}

function getAppBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

interface PagBankOrderResponse {
  id: string;
  qr_codes?: Array<{
    id?: string;
    text?: string;
    amount?: { value?: number };
    expiration_date?: string;
    links?: Array<{ rel?: string; href?: string; media?: string }>;
  }>;
  charges?: Array<{ id?: string; status?: string }>;
}

/** Cria (ou retorna) a cobrança Pix de um pedido. Nunca lança por falha do PagBank — grava o erro no registro. */
export async function getOrCreatePixCharge(orderId: string): Promise<PixCharge> {
  const existing = await prisma.pixCharge.findUnique({ where: { orderId } });
  if (existing) {
    return existing;
  }

  const order = await getOrderById(orderId);
  if (!order) {
    throw new PagBankServiceError("Pedido não encontrado.", "ORDER_NOT_FOUND");
  }
  if (order.paymentMethod !== "pix") {
    throw new PagBankServiceError("Este pedido não usa pagamento Pix.", "NOT_PIX");
  }

  await prisma.pixCharge.create({
    data: { orderId, amountCents: order.totalCents, status: "aguardando_pagamento" },
  });

  const config = await getPagBankConfig();
  let token: string;
  try {
    token = getPagBankToken(config);
  } catch (err) {
    return prisma.pixCharge.update({
      where: { orderId },
      data: {
        status: "erro",
        errorMessage: err instanceof Error ? err.message : "PagBank não configurado.",
      },
    });
  }

  const baseUrl = getPagBankBaseUrl(config);
  const payload = {
    reference_id: order.id,
    customer: { name: order.customer.name },
    items: [
      {
        reference_id: order.id,
        name: `Pedido #${order.orderNumber}`,
        quantity: 1,
        unit_amount: order.totalCents,
      },
    ],
    qr_codes: [{ amount: { value: order.totalCents } }],
    notification_urls: [`${getAppBaseUrl()}/api/webhooks/pagbank`],
  };

  try {
    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as PagBankOrderResponse | null;

    if (!response.ok || !data) {
      return prisma.pixCharge.update({
        where: { orderId },
        data: { status: "erro", errorMessage: `PagBank recusou a cobrança (HTTP ${response.status}).` },
      });
    }

    const qrCode = data.qr_codes?.[0];
    const qrImageLink = qrCode?.links?.find((l) => l.rel === "QRCODE.PNG")?.href;

    return prisma.pixCharge.update({
      where: { orderId },
      data: {
        externalId: data.id,
        qrCodeText: qrCode?.text ?? null,
        qrCodeImageUrl: qrImageLink ?? null,
        expiresAt: qrCode?.expiration_date ? new Date(qrCode.expiration_date) : null,
      },
    });
  } catch (err) {
    return prisma.pixCharge.update({
      where: { orderId },
      data: {
        status: "erro",
        errorMessage: err instanceof Error ? err.message : "Erro ao gerar cobrança Pix.",
      },
    });
  }
}

/**
 * Confirma no próprio PagBank (server-to-server) se uma cobrança já foi paga —
 * usado pelo webhook em vez de confiar direto no corpo da notificação recebida.
 */
export async function confirmPixChargePaid(externalId: string): Promise<boolean> {
  const config = await getPagBankConfig();
  const token = getPagBankToken(config);
  const baseUrl = getPagBankBaseUrl(config);

  const response = await fetch(`${baseUrl}/orders/${externalId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json().catch(() => null)) as PagBankOrderResponse | null;
  return data?.charges?.some((c) => c.status === "PAID") ?? false;
}

/** Marca a cobrança e o pedido como pagos. Idempotente. */
export async function markPixChargePaid(orderId: string): Promise<void> {
  await prisma.$transaction([
    prisma.pixCharge.update({
      where: { orderId },
      data: { status: "pago", paidAt: new Date() },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: "pago" },
    }),
  ]);
}
