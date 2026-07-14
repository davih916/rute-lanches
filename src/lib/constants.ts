export const ORDER_STATUSES = [
  "recebido",
  "preparando",
  "saiu_entrega",
  "entregue",
  "cancelado",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  recebido: "Novo pedido",
  preparando: "Preparando",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const ORDER_STATUS_EMOJI: Record<OrderStatus, string> = {
  recebido: "\u{1F534}",
  preparando: "\u{1F7E1}",
  saiu_entrega: "\u{1F535}",
  entregue: "\u{1F7E2}",
  cancelado: "❌",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, { bg: string; text: string; dot: string }> = {
  recebido: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  preparando: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  saiu_entrega: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  entregue: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelado: { bg: "bg-neutral-100", text: "text-neutral-500", dot: "bg-neutral-400" },
};

/** Próximo status sugerido no fluxo normal do Kanban (null = status final). */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  recebido: "preparando",
  preparando: "saiu_entrega",
  saiu_entrega: "entregue",
  entregue: null,
  cancelado: null,
};

/** Texto do botão de ação principal de cada status (mais claro que o nome do próximo status). */
export const NEXT_STATUS_ACTION_LABEL: Record<OrderStatus, string | null> = {
  recebido: "Aceitar pedido",
  preparando: "Saiu para entrega",
  saiu_entrega: "Marcar como entregue",
  entregue: null,
  cancelado: null,
};

export const PAYMENT_METHODS = ["pix", "dinheiro", "cartao_credito", "cartao_debito"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
};

/** Label com fallback seguro — pedidos antigos podem ter um valor que não existe mais aqui. */
export function getPaymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
}

/**
 * `Settings.acceptedPaymentMethods` é um JSON array salvo como string (mesmo padrão de
 * `openingHours`). Se estiver vazio/corrompido, assume todas as formas — nunca queremos
 * derrubar o checkout por um dado de configuração inválido.
 */
export function parseAcceptedPaymentMethods(raw: string): PaymentMethod[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...PAYMENT_METHODS];
    const valid = parsed.filter((m): m is PaymentMethod => PAYMENT_METHODS.includes(m));
    return valid.length > 0 ? valid : [...PAYMENT_METHODS];
  } catch {
    return [...PAYMENT_METHODS];
  }
}

export const DELIVERY_TYPES = ["entrega", "retirada"] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  entrega: "Entrega",
  retirada: "Retirada no local",
};

export const FISCAL_STATUSES = ["aguardando_emissao", "emitida", "erro"] as const;
export type FiscalStatus = (typeof FISCAL_STATUSES)[number];

export const FISCAL_STATUS_LABELS: Record<FiscalStatus, string> = {
  aguardando_emissao: "Aguardando emissão",
  emitida: "Emitida",
  erro: "Erro na emissão",
};

export const RECEIPT_WIDTHS = ["58mm", "80mm"] as const;
export type ReceiptWidth = (typeof RECEIPT_WIDTHS)[number];

export const FISCAL_PROVIDERS = ["pending", "nuvem_fiscal"] as const;
export type FiscalProviderName = (typeof FISCAL_PROVIDERS)[number];

export const FISCAL_PROVIDER_LABELS: Record<FiscalProviderName, string> = {
  pending: "Nenhum (não emite notas)",
  nuvem_fiscal: "Nuvem Fiscal",
};

export const FISCAL_AMBIENTES = ["homologacao", "producao"] as const;
export type FiscalAmbiente = (typeof FISCAL_AMBIENTES)[number];

export const FISCAL_AMBIENTE_LABELS: Record<FiscalAmbiente, string> = {
  homologacao: "Homologação (testes, sem valor fiscal)",
  producao: "Produção (valor fiscal real)",
};

export const REGIMES_TRIBUTARIOS = ["simples_nacional", "normal", "mei"] as const;
export type RegimeTributario = (typeof REGIMES_TRIBUTARIOS)[number];

export const REGIME_TRIBUTARIO_LABELS: Record<RegimeTributario, string> = {
  simples_nacional: "Simples Nacional",
  normal: "Regime Normal (Lucro Presumido/Real)",
  mei: "MEI",
};

export const PAGBANK_AMBIENTES = ["sandbox", "producao"] as const;
export type PagBankAmbiente = (typeof PAGBANK_AMBIENTES)[number];

export const PAGBANK_AMBIENTE_LABELS: Record<PagBankAmbiente, string> = {
  sandbox: "Sandbox (testes, sem valor real)",
  producao: "Produção (cobranças reais)",
};

export const SESSION_COOKIE_NAME = "rl_session";
export const CLIENT_SESSION_COOKIE_NAME = "rl_client_session";
