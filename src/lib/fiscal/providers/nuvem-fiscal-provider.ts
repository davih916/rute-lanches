import "server-only";
import type { FiscalIssueInput, FiscalIssueResult, FiscalProvider } from "../fiscal-provider.interface";

const AUTH_URL = "https://auth.nuvemfiscal.com.br/oauth/token";
const API_BASE_URL = "https://api.nuvemfiscal.com.br";

export interface NuvemFiscalCredentials {
  clientId: string;
  clientSecret: string;
  ambiente: "homologacao" | "producao";
  cnpj: string;
  regimeTributario: "simples_nacional" | "normal" | "mei";
}

export interface NuvemFiscalCompanyData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  email: string;
  inscricaoEstadual: string;
  inscricaoMunicipal?: string | null;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  municipioCodigo: string;
  uf: string;
  cep: string;
  telefone?: string | null;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

// Cache do token em memória por client_id — evita reautenticar a cada chamada.
// Em múltiplas instâncias (várias lanchonetes rodando processos separados),
// cada processo mantém seu próprio cache; não há necessidade de compartilhar.
const tokenCache = new Map<string, CachedToken>();

/**
 * Código da forma de pagamento (tPag) conforme o Manual de Orientação do
 * Contribuinte da NFC-e.
 */
const PAYMENT_METHOD_TPAG: Record<FiscalIssueInput["paymentMethod"], string> = {
  dinheiro: "01",
  cartao_credito: "03",
  cartao_debito: "04",
  pix: "17",
};

/**
 * indPres (indicador de presença do comprador), conforme Manual da NFC-e:
 * 1 = presencial (retirada no balcão) | 4 = NFC-e com entrega a domicílio.
 */
const DELIVERY_TYPE_IND_PRES: Record<FiscalIssueInput["deliveryType"], number> = {
  retirada: 1,
  entrega: 4,
};

function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Adapter real para a API da Nuvem Fiscal (https://dev.nuvemfiscal.com.br).
 *
 * IMPORTANTE — antes de usar em produção:
 * Os códigos fiscais de PIS/COFINS abaixo usam uma simplificação comum para
 * pequenas empresas do Simples Nacional (CST 49, sem tributação destacada
 * por item — o recolhimento acontece via DAS). Regimes normais ou casos com
 * substituição tributária exigem configuração específica que só o contador
 * da empresa pode validar. Teste sempre em homologação antes de emitir notas
 * reais, e revise o payload junto com o contador responsável.
 */
export class NuvemFiscalProvider implements FiscalProvider {
  readonly name = "nuvem_fiscal";

  constructor(private readonly credentials: NuvemFiscalCredentials) {}

  private async getAccessToken(): Promise<string> {
    const cached = tokenCache.get(this.credentials.clientId);
    if (cached && cached.expiresAt > Date.now() + 30_000) {
      return cached.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
      scope: "empresa nfce",
    });

    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Falha ao autenticar na Nuvem Fiscal (HTTP ${res.status}): ${detail}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    const token: CachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    tokenCache.set(this.credentials.clientId, token);
    return token.accessToken;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const message =
        (data && (data.message || data.error_description || JSON.stringify(data))) ||
        `HTTP ${res.status}`;
      throw new Error(message);
    }

    return data as T;
  }

  /** Retorna o XML bruto de uma NFC-e já emitida (para arquivamento local). */
  async fetchXml(externalId: string): Promise<string | null> {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`${API_BASE_URL}/nfce/${externalId}/xml`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  /** Baixa o DANFCE (PDF) — usado pela rota de download autenticada do admin. */
  async fetchPdf(externalId: string): Promise<ArrayBuffer | null> {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`${API_BASE_URL}/nfce/${externalId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return await res.arrayBuffer();
    } catch {
      return null;
    }
  }

  /** Cadastra (ou atualiza) a empresa emitente na Nuvem Fiscal. Idempotente. */
  async ensureCompanyRegistered(company: NuvemFiscalCompanyData): Promise<void> {
    const payload = {
      cpf_cnpj: onlyDigits(company.cnpj),
      nome_razao_social: company.razaoSocial,
      nome_fantasia: company.nomeFantasia || undefined,
      email: company.email,
      inscricao_estadual: company.inscricaoEstadual,
      inscricao_municipal: company.inscricaoMunicipal || undefined,
      fone: company.telefone ? onlyDigits(company.telefone) : undefined,
      endereco: {
        logradouro: company.logradouro,
        numero: company.numero,
        complemento: company.complemento || undefined,
        bairro: company.bairro,
        codigo_municipio: company.municipioCodigo,
        uf: company.uf,
        cep: onlyDigits(company.cep),
      },
    };

    try {
      await this.request("/empresas", { method: "POST", body: JSON.stringify(payload) });
    } catch {
      // Provavelmente já cadastrada — tenta atualizar em vez de criar.
      await this.request(`/empresas/${onlyDigits(company.cnpj)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    }
  }

  /** Envia o certificado A1 (.pfx em base64 + senha) para a Nuvem Fiscal. */
  async uploadCertificado(
    cnpj: string,
    pfxBase64: string,
    password: string
  ): Promise<{ validoAte?: string }> {
    const data = await this.request<{ valido_ate?: string }>(
      `/empresas/${onlyDigits(cnpj)}/certificado`,
      {
        method: "PUT",
        body: JSON.stringify({ certificado: pfxBase64, password }),
      }
    );
    return { validoAte: data?.valido_ate };
  }

  private buildIcmsNode(csosnCst: string): Record<string, unknown> {
    const isSimplesNacional = this.credentials.regimeTributario === "simples_nacional";
    if (isSimplesNacional) {
      // CSOSN de 3 dígitos (ex: 102 = tributada pelo Simples Nacional sem
      // permissão de crédito — o mais comum para lanchonetes/restaurantes).
      return { [`ICMSSN${csosnCst}`]: { orig: "0", CSOSN: csosnCst } };
    }
    // CST de 2 dígitos (regime normal).
    return { [`ICMS${csosnCst}`]: { orig: "0", CST: csosnCst } };
  }

  private buildPayload(input: FiscalIssueInput): Record<string, unknown> {
    const det = input.items.map((item, index) => {
      const vProd = centsToDecimalString(item.unitPriceCents * item.quantity);
      return {
        nItem: index + 1,
        prod: {
          cProd: item.productId,
          cEAN: "SEM GTIN",
          xProd: item.name,
          NCM: onlyDigits(item.ncm),
          CFOP: item.cfop,
          uCom: item.unidadeComercial,
          qCom: item.quantity,
          vUnCom: centsToDecimalString(item.unitPriceCents),
          vProd,
          cEANTrib: "SEM GTIN",
          uTrib: item.unidadeComercial,
          qTrib: item.quantity,
          vUnTrib: centsToDecimalString(item.unitPriceCents),
          indTot: 1,
        },
        imposto: {
          ICMS: this.buildIcmsNode(item.csosnCst),
          // Simplificação para Simples Nacional: PIS/COFINS recolhidos via
          // DAS, sem destaque por item. Ver aviso na documentação da classe.
          PIS: { PISOutr: { CST: "49", vBC: "0.00", pPIS: "0.00", vPIS: "0.00" } },
          COFINS: { COFINSOutr: { CST: "49", vBC: "0.00", pCOFINS: "0.00", vCOFINS: "0.00" } },
        },
      };
    });

    return {
      ambiente: this.credentials.ambiente,
      cpf_cnpj: onlyDigits(this.credentials.cnpj),
      referencia: input.orderId,
      infNFce: {
        ide: {
          natOp: "Venda de mercadoria",
          mod: 65,
          serie: 1,
          tpAmb: this.credentials.ambiente === "producao" ? 1 : 2,
          indPres: DELIVERY_TYPE_IND_PRES[input.deliveryType],
        },
        dest: input.customerDocument
          ? {
              [onlyDigits(input.customerDocument).length > 11 ? "CNPJ" : "CPF"]: onlyDigits(
                input.customerDocument
              ),
            }
          : undefined,
        det,
        total: {
          ICMSTot: {
            vProd: centsToDecimalString(input.itemsTotalCents),
            vFrete: centsToDecimalString(input.deliveryFeeCents),
            vDesc: "0.00",
            vOutro: "0.00",
            vNF: centsToDecimalString(input.totalCents),
          },
        },
        pag: {
          detPag: [
            {
              tPag: PAYMENT_METHOD_TPAG[input.paymentMethod],
              vPag: centsToDecimalString(input.totalCents),
            },
          ],
        },
      },
    };
  }

  async issue(input: FiscalIssueInput): Promise<FiscalIssueResult> {
    try {
      const payload = this.buildPayload(input);

      const response = await this.request<{
        id: string;
        status?: string;
        situacao?: string;
        numero?: number;
        serie?: number;
        chave_acesso?: string;
        motivo_status?: string;
        motivo?: string;
      }>("/nfce", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const situacao = (response.status || response.situacao || "").toLowerCase();
      const rejected = situacao.includes("rejeit") || situacao.includes("denega") || situacao.includes("erro");

      if (rejected) {
        return {
          status: "erro",
          externalId: response.id,
          errorMessage: response.motivo_status || response.motivo || "NFC-e rejeitada pela SEFAZ.",
        };
      }

      const xmlContent = response.id ? await this.fetchXml(response.id) : null;

      return {
        status: "emitida",
        externalId: response.id,
        numero: response.numero,
        serie: response.serie,
        chaveAcesso: response.chave_acesso,
        pdfUrl: response.id ? `${API_BASE_URL}/nfce/${response.id}/pdf` : undefined,
        xmlUrl: response.id ? `${API_BASE_URL}/nfce/${response.id}/xml` : undefined,
        xmlContent: xmlContent ?? undefined,
      };
    } catch (err) {
      return {
        status: "erro",
        errorMessage: err instanceof Error ? err.message : "Erro desconhecido ao emitir NFC-e.",
      };
    }
  }
}
