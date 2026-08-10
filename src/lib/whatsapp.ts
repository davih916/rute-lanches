import { formatCentsToBRL } from "@/lib/money";

export interface WhatsAppOrderItem {
  productName: string;
  quantity: number;
  unitPriceCents: number;
  addons: { name: string }[];
  notes?: string | null;
}

export interface WhatsAppOrderSummary {
  orderNumber: number;
  storeName: string;
  deliveryType: string;
  items: WhatsAppOrderItem[];
  totalCents: number;
  customerName: string;
  customerPhone: string;
  address?: string | null;
  addressNumber?: string | null;
  neighborhood?: string | null;
  notes?: string | null;
}

/** Só dígitos, com DDI 55 na frente (aceita o número já com ou sem o 55). */
export function toWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length <= 11 ? `55${digits}` : digits;
}

function buildWhatsAppOrderMessage(order: WhatsAppOrderSummary): string {
  const lines: string[] = [`Pedido #${String(order.orderNumber).padStart(3, "0")} — ${order.storeName}`, ""];

  for (const item of order.items) {
    lines.push(`${item.quantity}x ${item.productName} (${formatCentsToBRL(item.unitPriceCents * item.quantity)})`);
    for (const addon of item.addons) lines.push(`  + ${addon.name}`);
    if (item.notes) lines.push(`  obs: ${item.notes}`);
  }

  lines.push("");
  if (order.deliveryType === "entrega") {
    const street = [order.address, order.addressNumber].filter(Boolean).join(", ");
    lines.push(`Entrega: ${street}${order.neighborhood ? ` - ${order.neighborhood}` : ""}`);
  } else if (order.deliveryType === "retirada") {
    lines.push("Retirada no local");
  }
  lines.push(`Total: ${formatCentsToBRL(order.totalCents)}`);
  lines.push("");
  lines.push(`Cliente: ${order.customerName}`);
  lines.push(`Telefone: ${order.customerPhone}`);
  if (order.notes) lines.push(`Obs. do pedido: ${order.notes}`);

  return lines.join("\n");
}

/** Link "wa.me" com o pedido já formatado no texto — o cliente só confirma o envio. */
export function buildWhatsAppOrderLink(storeWhatsapp: string, order: WhatsAppOrderSummary): string {
  const message = buildWhatsAppOrderMessage(order);
  return `https://wa.me/${toWhatsAppDigits(storeWhatsapp)}?text=${encodeURIComponent(message)}`;
}

/** Formato compartilhado entre o pedido recém-criado (resposta da API) e o `OrderWithRelations` do banco. */
interface OrderLike {
  orderNumber: number;
  deliveryType: string;
  totalCents: number;
  notes: string | null;
  // Snapshot do endereço no momento do pedido (ver Order.address* no schema)
  // — pode ser null em respostas antigas de antes desses campos existirem,
  // por isso ainda caímos no cadastro do cliente como reserva.
  address?: string | null;
  addressNumber?: string | null;
  neighborhood?: string | null;
  items: {
    productName: string;
    quantity: number;
    unitPriceCents: number;
    notes: string | null;
    addons: { name: string }[];
  }[];
  customer: {
    name: string;
    phone: string;
    address: string | null;
    addressNumber: string | null;
    neighborhood: string | null;
  };
}

export function orderToWhatsAppSummary(order: OrderLike, storeName: string): WhatsAppOrderSummary {
  return {
    orderNumber: order.orderNumber,
    storeName,
    deliveryType: order.deliveryType,
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      addons: item.addons,
      notes: item.notes,
    })),
    totalCents: order.totalCents,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    address: order.address ?? order.customer.address,
    addressNumber: order.addressNumber ?? order.customer.addressNumber,
    neighborhood: order.neighborhood ?? order.customer.neighborhood,
    notes: order.notes,
  };
}
