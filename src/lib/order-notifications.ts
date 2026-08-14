import { toWhatsAppDigits } from "@/lib/whatsapp";
import { formatOrderNumber } from "@/lib/format";
import { formatCentsToBRL } from "@/lib/money";
import { getPaymentMethodLabel, type OrderStatus } from "@/lib/constants";

interface NotifiableOrder {
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  storeName: string;
}

interface ApprovedOrderInfo extends NotifiableOrder {
  items: { productName: string; quantity: number }[];
  totalCents: number;
}

interface CancelledOrderInfo extends ApprovedOrderInfo {
  paymentMethod: string;
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

/** Mensagem quando o admin ACEITA a entrega — já sai com o pedido, prazo estimado e agradecimento. */
export function getDeliveryApprovedMessage(order: ApprovedOrderInfo): string {
  const num = formatOrderNumber(order.orderNumber);
  const itemsList = order.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ");
  return `Olá, ${order.customerName}! Seu pedido ${num} (${itemsList}) na ${order.storeName} foi confirmado e já entrou em preparo. Total: ${formatCentsToBRL(order.totalCents)}. O prazo estimado é de cerca de 30 minutos. Agradecemos muito a sua preferência!`;
}

/** Mensagem quando o admin recusa a entrega (endereço fora de área, etc). */
export function getDeliveryRejectionMessage(order: NotifiableOrder, reason?: string | null): string {
  const num = formatOrderNumber(order.orderNumber);
  const reasonText = reason?.trim() ? ` Motivo: ${reason.trim()}.` : "";
  return `Olá, ${order.customerName}. Infelizmente a ${order.storeName} não conseguiu aceitar a entrega do pedido ${num} para o endereço informado.${reasonText} Entre em contato conosco caso queira verificar outra possibilidade. Agradecemos a sua preferência e esperamos atendê-lo em breve.`;
}

/**
 * Mensagem quando um pedido JÁ aceito é cancelado depois (falta de produto,
 * pedido em duplicidade, a pedido do cliente, etc — diferente da recusa de
 * entrega, que é ANTES de aceitar, ver `getDeliveryRejectionMessage`). Traz
 * todos os dados do pedido pra servir de confirmação por escrito do
 * cancelamento, não só um aviso genérico.
 */
export function getOrderCancelledMessage(order: CancelledOrderInfo, reason?: string | null): string {
  const num = formatOrderNumber(order.orderNumber);
  const itemsList = order.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ");
  const reasonText = reason?.trim() ? ` Motivo: ${reason.trim()}.` : "";
  return `Olá, ${order.customerName}. Seu pedido ${num} (${itemsList}) na ${order.storeName} foi CANCELADO.${reasonText} Forma de pagamento: ${getPaymentMethodLabel(order.paymentMethod)}. Total: ${formatCentsToBRL(order.totalCents)}. Se você já pagou e tiver qualquer dúvida sobre o cancelamento, fale com a gente. Pedimos desculpas pelo transtorno.`;
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
