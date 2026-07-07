/**
 * Contrato que qualquer integração fiscal (Nuvem Fiscal, Focus NFe, PlugNotas...)
 * precisa implementar. Hoje só existe `PendingProvider` (nenhuma nota emitida)
 * e `NuvemFiscalProvider` (emissão real de NFC-e).
 */
export interface FiscalIssueItem {
  productId: string;
  name: string;
  quantity: number;
  /** Preço unitário já somado com os adicionais escolhidos naquele item. */
  unitPriceCents: number;
  ncm: string;
  cfop: string;
  /** CSOSN (Simples Nacional) ou CST (regime normal), conforme FiscalConfig.regimeTributario. */
  csosnCst: string;
  unidadeComercial: string;
}

export interface FiscalIssueInput {
  orderId: string;
  orderNumber: number;
  itemsTotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentMethod: "pix" | "dinheiro" | "cartao_credito" | "cartao_debito";
  deliveryType: "entrega" | "retirada";
  customerName: string;
  customerDocument?: string | null;
  items: FiscalIssueItem[];
}

export interface FiscalIssueResult {
  status: "emitida" | "erro";
  externalId?: string;
  numero?: number;
  serie?: number;
  chaveAcesso?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  xmlContent?: string;
  errorMessage?: string;
}

export interface FiscalProvider {
  /** Identificador estável usado para preencher `fiscal.provider` no banco. */
  readonly name: string;
  issue(input: FiscalIssueInput): Promise<FiscalIssueResult>;
}
