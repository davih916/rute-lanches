import "server-only";
import QRCode from "qrcode";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrderById } from "@/lib/services/order-service";
import { getSettings } from "@/lib/services/settings-service";
import { getPagBankConfig, getPagBankBaseUrl, getPagBankToken } from "@/lib/services/pagbank-config-service";
import { getSharpifyConfig, getSharpifyCredentials, isSharpifyConfigured } from "@/lib/services/sharpify-config-service";
import { createSharpifyPixCharge, isSharpifyPaymentApproved, SharpifyServiceError } from "@/lib/services/sharpify-service";
import { confirmPixPayment } from "@/lib/services/order-service";
import { generatePixBRCode, type PixKeyType } from "@/lib/pix-brcode";
import type { PixCharge } from "@prisma/client";

// Cliente reclamou do fluxo de Pix automático via Sharpify e pediu pra
// voltar a usar a chave Pix simples dela mesma na cobrança dos pedidos —
// ver uso abaixo em getOrCreatePixCharge. Não mexe na mensalidade (config
// Sharpify separada, do revendedor) nem apaga a config salva em
// /admin/dev, só desliga esse caminho até decidirem reativar.
const SHARPIFY_ORDER_PIX_ENABLED = false;

export class PagBankServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "ORDER_NOT_FOUND" | "NOT_PIX" | "DELIVERY_PENDING"
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

/**
 * Confere na Sharpify se uma cobrança específica já foi paga e confirma
 * sozinho se sim. Chamada em dois lugares — ver comentários nos chamadores —
 * porque nenhum dos dois sozinho é confiável: o cliente pode fechar a aba
 * assim que paga (parando o polling da tela dele), então o Kanban (que fica
 * aberto o dia todo com a loja) também varre as cobranças pendentes.
 */
async function checkAndConfirmSharpifyCharge(charge: PixCharge): Promise<boolean> {
  if (charge.status !== "aguardando_pagamento" || charge.provider !== "sharpify" || !charge.externalId) {
    return false;
  }
  const approved = await getSharpifyConfig()
    .then((config) => isSharpifyPaymentApproved(getSharpifyCredentials(config), charge.externalId!))
    .catch((err) => {
      console.error(`Erro ao consultar status Sharpify do pedido ${charge.orderId}:`, err);
      return false;
    });
  if (approved) {
    await confirmPixPayment(charge.orderId);
  }
  return approved;
}

/**
 * Varre todas as cobranças Sharpify ainda pendentes e confirma as que já
 * foram pagas — chamada a cada consulta do Kanban (GET /api/orders, a cada
 * 5s enquanto o admin está com a tela aberta). Complementa (não substitui) a
 * checagem em getOrCreatePixCharge, que só roda enquanto a tela do CLIENTE
 * está aberta.
 */
export async function syncPendingSharpifyPixCharges(): Promise<void> {
  if (!(await isSharpifyConfigured())) return;

  const pending = await prisma.pixCharge.findMany({
    where: { status: "aguardando_pagamento", provider: "sharpify", externalId: { not: null } },
  });
  await Promise.all(pending.map((charge) => checkAndConfirmSharpifyCharge(charge)));
}

/** Cria (ou retorna) a cobrança Pix de um pedido. Nunca lança por falha do PagBank — grava o erro no registro. */
export async function getOrCreatePixCharge(orderId: string): Promise<PixCharge> {
  const existing = await prisma.pixCharge.findUnique({ where: { orderId } });
  if (existing) {
    // Ver checkAndConfirmSharpifyCharge — aproveita a consulta do cliente
    // (polling da tela /pedido/[id]) pra já checar se foi aprovada.
    const approved = await checkAndConfirmSharpifyCharge(existing);
    if (approved) {
      return (await prisma.pixCharge.findUnique({ where: { orderId } })) ?? existing;
    }
    return existing;
  }

  const order = await getOrderById(orderId);
  if (!order) {
    throw new PagBankServiceError("Pedido não encontrado.", "ORDER_NOT_FOUND");
  }
  if (order.paymentMethod !== "pix") {
    throw new PagBankServiceError("Este pedido não usa pagamento Pix.", "NOT_PIX");
  }
  // Entrega ainda não aprovada, ou taxa nunca foi confirmada de propósito
  // (deliveryFeeConfirmed false — inclui o caso de a taxa ter ficado em
  // R$0,00 por engano): gerar o Pix agora arriscaria cobrar um valor errado.
  // Só libera o pagamento depois que a loja confirmar o endereço e definir
  // a taxa de entrega (ver approveDelivery / setDeliveryFee).
  if (order.deliveryType === "entrega" && (order.status === "recebido" || !order.deliveryFeeConfirmed)) {
    throw new PagBankServiceError(
      "A loja ainda está confirmando o endereço e a taxa de entrega.",
      "DELIVERY_PENDING"
    );
  }

  try {
    await prisma.pixCharge.create({
      data: { orderId, amountCents: order.totalCents, status: "aguardando_pagamento" },
    });
  } catch (err) {
    // Duas requisições concorrentes (ex: duas abas) podem passar pelo findUnique
    // acima antes de qualquer uma criar a linha — o unique constraint em orderId
    // pega a segunda tentativa aqui; devolve a cobrança que a primeira já criou.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raceWinner = await prisma.pixCharge.findUnique({ where: { orderId } });
      if (raceWinner) return raceWinner;
    }
    throw err;
  }

  if (SHARPIFY_ORDER_PIX_ENABLED && (await isSharpifyConfigured())) {
    try {
      const sharpifyConfig = await getSharpifyConfig();
      const { externalId, qrCodeText } = await createSharpifyPixCharge(getSharpifyCredentials(sharpifyConfig), {
        name: `Pedido #${String(order.orderNumber).padStart(3, "0")}`,
        description: "Pagamento do pedido",
        amountCents: order.totalCents,
      });
      const qrCodeImageUrl = await QRCode.toDataURL(qrCodeText, { margin: 1, width: 320 }).catch(() => null);
      return prisma.pixCharge.update({
        where: { orderId },
        data: { provider: "sharpify", externalId, qrCodeText, qrCodeImageUrl },
      });
    } catch (err) {
      const message =
        err instanceof SharpifyServiceError ? err.message : "Erro ao gerar cobrança Pix pela Sharpify.";
      return prisma.pixCharge.update({ where: { orderId }, data: { status: "erro", errorMessage: message } });
    }
  }

  // Caminho seguinte: chave Pix simples cadastrada em Configurações — gera o
  // BR Code na hora, sem depender de nenhuma API externa. Confirmação de
  // pagamento é manual (o admin confere no app do banco e clica "Confirmar
  // pagamento" no Kanban — ver confirmPixPayment em order-service.ts).
  const settings = await getSettings();
  if (settings.pixKey?.trim()) {
    const qrCodeText = generatePixBRCode({
      pixKey: settings.pixKey.trim(),
      pixKeyType: settings.pixKeyType as PixKeyType,
      merchantName: settings.storeName,
      merchantCity: settings.pixCity,
      amountCents: order.totalCents,
      txid: order.id,
    });
    const qrCodeImageUrl = await QRCode.toDataURL(qrCodeText, { margin: 1, width: 320 }).catch(() => null);

    return prisma.pixCharge.update({
      where: { orderId },
      data: { qrCodeText, qrCodeImageUrl },
    });
  }

  // Sem chave Pix cadastrada: tenta o PagBank (integração legada, mantida
  // pra quem já tinha configurado antes) — se também não estiver configurado,
  // devolve erro claro pro cliente.
  const config = await getPagBankConfig();
  let token: string;
  try {
    token = getPagBankToken(config);
  } catch {
    return prisma.pixCharge.update({
      where: { orderId },
      data: {
        status: "erro",
        errorMessage: "Pix não configurado. Fale com a loja para combinar o pagamento.",
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
  try {
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
  } catch (err) {
    console.error("Erro ao confirmar pagamento Pix com o PagBank:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Marca a cobrança como paga. Idempotente (a query já ignora se `status` já é
 * "pago" — ver chamador). Não marca o pedido como pago se ele já foi
 * cancelado nesse meio-tempo — fica registrado na própria cobrança para o
 * lojista decidir sobre reembolso manualmente.
 */
export async function markPixChargePaid(orderId: string): Promise<void> {
  // updateMany (não update) porque não deve lançar se a cobrança já estiver
  // paga — webhooks de pagamento chegam mais de uma vez com frequência.
  await prisma.pixCharge.updateMany({
    where: { orderId, status: { not: "pago" } },
    data: { status: "pago", paidAt: new Date() },
  });

  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: { not: "cancelado" } },
    data: { paymentStatus: "pago" },
  });

  if (updated.count === 0) {
    console.error(
      `Pix confirmado pelo PagBank para um pedido já cancelado (${orderId}) — verifique se precisa de reembolso.`
    );
  }
}
