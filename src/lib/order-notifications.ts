import { toWhatsAppDigits } from "@/lib/whatsapp";
import { formatOrderNumber } from "@/lib/format";
import { formatCentsToBRL } from "@/lib/money";
import { getPaymentMethodLabel, type OrderStatus } from "@/lib/constants";

interface NotifiableOrder {
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  storeName: string;
  items: { productName: string; quantity: number }[];
  totalCents: number;
}

interface ApprovedOrderInfo extends NotifiableOrder {
  orderId: string;
  paymentMethod: string;
}

type CancelledOrderInfo = ApprovedOrderInfo;

function formatItemsList(items: { productName: string; quantity: number }[]): string {
  return items.map((i) => `${i.quantity}x ${i.productName}`).join(", ");
}

/**
 * Mensagem de avanço de status pro cliente, por status. `null` = esse status
 * não tem aviso automático (ex: "recebido" já é avisado pela própria
 * confirmação do pedido no site, "cancelado" tem sua própria mensagem — ver
 * `getDeliveryRejectionMessage`). Sempre traz o resumo do pedido (itens +
 * total), não só um aviso genérico de status.
 */
export function getStatusNotificationMessage(order: NotifiableOrder, status: OrderStatus): string | null {
  const num = formatOrderNumber(order.orderNumber);
  const resumo = `Pedido ${num}: ${formatItemsList(order.items)} — Total: ${formatCentsToBRL(order.totalCents)}.`;
  switch (status) {
    case "preparando":
      return `Olá, ${order.customerName}! Seu pedido ${num} da ${order.storeName} já está sendo preparado. ${resumo} Assim que tivermos uma atualização, avisaremos você.`;
    case "saiu_entrega":
      return `Olá, ${order.customerName}! Seu pedido ${num} já saiu para entrega. ${resumo} Em breve ele chegará até você.`;
    case "pronto_retirada":
      return `Olá, ${order.customerName}! Seu pedido ${num} já está pronto para retirada na ${order.storeName}. ${resumo}`;
    case "entregue":
      return `Olá, ${order.customerName}! Seu pedido ${num} foi entregue. ${resumo} Obrigado por pedir com a ${order.storeName}!`;
    default:
      return null;
  }
}

/**
 * Mensagem quando o admin ACEITA a entrega — já sai com o pedido, prazo
 * estimado e agradecimento. Pra pedidos Pix, a cobrança só é gerada DEPOIS
 * dessa aprovação (o total só fica certo com a taxa já definida — ver
 * getOrCreatePixCharge em pagbank-service.ts), então a mensagem já manda o
 * link de volta pro cliente pagar.
 */
export function getDeliveryApprovedMessage(order: ApprovedOrderInfo, appUrl: string): string {
  const num = formatOrderNumber(order.orderNumber);
  const itemsList = order.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ");
  const pixNote =
    order.paymentMethod === "pix"
      ? ` Agora você já pode pagar pelo Pix, acesse: ${appUrl}/pedido/${order.orderId}`
      : "";
  return `Olá, ${order.customerName}! Seu pedido ${num} (${itemsList}) na ${order.storeName} foi confirmado e já entrou em preparo. Total: ${formatCentsToBRL(order.totalCents)}. O prazo estimado é de cerca de 30 minutos. Agradecemos muito a sua preferência!${pixNote}`;
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
