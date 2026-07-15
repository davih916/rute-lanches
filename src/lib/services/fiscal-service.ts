import "server-only";
import { prisma } from "@/lib/prisma";
import { getFiscalProvider } from "@/lib/fiscal";
import { getFiscalEnvConfig } from "@/lib/fiscal/env-config";
import { getOrderById } from "@/lib/services/order-service";
import type { FiscalIssueItem } from "@/lib/fiscal/fiscal-provider.interface";
import type { Fiscal } from "@prisma/client";

export class FiscalServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "ORDER_NOT_FOUND" | "ALREADY_ISSUED" | "MISSING_FISCAL_DATA"
  ) {
    super(message);
    this.name = "FiscalServiceError";
  }
}

/**
 * Emite a NFC-e de um pedido. Chamada tanto manualmente (botão "Emitir NFC-e"
 * no admin) quanto automaticamente quando o pedido sai para
 * entrega/retirada e o cliente marcou "quero nota fiscal" no checkout (ver
 * src/app/api/orders/[id]/status/route.ts). Segura contra as duas chamadas
 * acontecerem ao mesmo tempo — ver a reivindicação atômica logo abaixo.
 */
export async function issueFiscalDocumentForOrder(orderId: string): Promise<Fiscal> {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new FiscalServiceError("Pedido não encontrado.", "ORDER_NOT_FOUND");
  }
  if (order.fiscal?.status === "emitida") {
    throw new FiscalServiceError("Este pedido já tem uma NFC-e emitida.", "ALREADY_ISSUED");
  }

  // Reivindica a linha atomicamente antes de qualquer trabalho lento — fecha a
  // janela de corrida entre o disparo automático (mudança de status) e o botão
  // manual "Emitir NFC-e" rodando ao mesmo tempo, que de outra forma poderia
  // gerar duas NFC-e reais para o mesmo pedido.
  const claimed = await prisma.fiscal.updateMany({
    where: { orderId, status: { notIn: ["emitida", "emitindo"] } },
    data: { status: "emitindo" },
  });
  if (claimed.count === 0) {
    throw new FiscalServiceError(
      "Este pedido já está sendo emitido (ou já foi emitido) em outra requisição.",
      "ALREADY_ISSUED"
    );
  }

  const productIds = [...new Set(order.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const missingProductNames = new Set<string>();
  const items: FiscalIssueItem[] = [];

  for (const item of order.items) {
    const product = productMap.get(item.productId);
    if (!product || !product.ncm || !product.cfop || !product.csosnCst) {
      missingProductNames.add(item.productName);
      continue;
    }
    const addonsCentsPerUnit = item.addons.reduce((sum, a) => sum + a.priceCents, 0);
    items.push({
      productId: item.productId,
      name: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents + addonsCentsPerUnit,
      ncm: product.ncm,
      cfop: product.cfop,
      csosnCst: product.csosnCst,
      unidadeComercial: product.unidadeComercial,
    });
  }

  if (missingProductNames.size > 0) {
    // Libera a reivindicação acima — senão o pedido ficaria travado em
    // "emitindo" para sempre e nenhuma tentativa futura conseguiria emitir.
    await prisma.fiscal.update({ where: { orderId }, data: { status: "aguardando_emissao" } });
    throw new FiscalServiceError(
      `Preencha os dados fiscais (NCM, CFOP e CSOSN/CST) destes produtos antes de emitir: ${[...missingProductNames].join(", ")}`,
      "MISSING_FISCAL_DATA"
    );
  }

  const provider = await getFiscalProvider();

  const result = await provider.issue({
    orderId: order.id,
    orderNumber: order.orderNumber,
    itemsTotalCents: order.itemsTotalCents,
    deliveryFeeCents: order.deliveryFeeCents,
    totalCents: order.totalCents,
    paymentMethod: order.paymentMethod as "pix" | "dinheiro" | "cartao_credito" | "cartao_debito",
    deliveryType: order.deliveryType as "entrega" | "retirada" | "balcao",
    customerName: order.customer.name,
    customerDocument: order.fiscal?.customerDocument ?? null,
    items,
  });

  return prisma.fiscal.update({
    where: { orderId: order.id },
    data: {
      status: result.status,
      provider: provider.name,
      ambiente: getFiscalEnvConfig().ambiente,
      externalId: result.externalId ?? null,
      numero: result.numero ?? null,
      serie: result.serie ?? null,
      chaveAcesso: result.chaveAcesso ?? null,
      pdfUrl: result.pdfUrl ?? null,
      xmlUrl: result.xmlUrl ?? null,
      xmlContent: result.xmlContent ?? null,
      errorMessage: result.errorMessage ?? null,
      issuedAt: result.status === "emitida" ? new Date() : null,
    },
  });
}
