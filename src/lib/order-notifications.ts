import { toWhatsAppDigits } from "@/lib/whatsapp";
import { formatOrderNumber } from "@/lib/format";
import type { OrderStatus } from "@/lib/constants";

interface NotifiableOrder {
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  storeName: string;
}

/**
 * Mensagem de avanço de status pro cliente, por status. `null` = esse status
 * não tem aviso automático (ex: "recebido" já é avisado pela própria
 * confirmação do pedido no site, "cancelado" tem sua própria mensagem — ver
 * `getDeliveryRejectionMessage`).
 */
export function getStatusNotificationMessage(order: NotifiableOrder, status: OrderStatus): string | null {
  const num = formatOrderNumber(order.orderNumber);
  switch (status) {
    case "preparando":
      return `Olá, ${order.customerName}! Seu pedido ${num} da ${order.storeName} já está sendo preparado. Assim que tivermos uma atualização, avisaremos você.`;
    case "saiu_entrega":
      return `Olá, ${order.customerName}! Seu pedido ${num} já saiu para entrega. Em breve ele chegará até você.`;
    case "pronto_retirada":
      return `Olá, ${order.customerName}! Seu pedido ${num} já está pronto para retirada na ${order.storeName}.`;
    case "entregue":
      return `Olá, ${order.customerName}! Seu pedido ${num} foi entregue. Obrigado por pedir com a ${order.storeName}!`;
    default:
      return null;
  }
}

/** Mensagem quando o admin recusa a entrega (endereço fora de área, etc). */
export function getDeliveryRejectionMessage(order: NotifiableOrder, reason?: string | null): string {
  const num = formatOrderNumber(order.orderNumber);
  const reasonText = reason?.trim() ? ` Motivo: ${reason.trim()}.` : "";
  return `Olá, ${order.customerName}. Infelizmente a ${order.storeName} não conseguiu aceitar a entrega do pedido ${num} para o endereço informado.${reasonText} Entre em contato conosco caso queira verificar outra possibilidade.`;
}

/** Link "wa.me" pro número do CLIENTE (diferente de whatsapp.ts, que manda pro número da loja). */
export function buildCustomerNotificationLink(customerPhone: string, message: string): string {
  return `https://wa.me/${toWhatsAppDigits(customerPhone)}?text=${encodeURIComponent(message)}`;
}

export function parseNotifiedStatuses(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}
