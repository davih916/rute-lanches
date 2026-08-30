import "server-only";

const SHARPIFY_BASE_URL = "https://api.sharpify.com.br";

export class SharpifyServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "REQUEST_FAILED"
  ) {
    super(message);
    this.name = "SharpifyServiceError";
  }
}

export interface SharpifyCredentials {
  clientId: string;
  clientSecret: string;
}

interface SharpifyPaymentLinkResponse {
  data: {
    id: string;
    status: "PENDING" | "APPROVED" | "CANCELLED";
    payment: {
      id: string;
      gateway: {
        data: {
          hasQrCode: boolean;
          code: string; // Pix "copia e cola"
          paymentLink: string;
        };
      };
    } | null;
  };
}

function getHeaders(credentials: SharpifyCredentials): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-sharpify-client-id": credentials.clientId,
    "x-sharpify-client-secret": credentials.clientSecret,
  };
}

/**
 * Cria uma cobrança Pix real via gateway da Sharpify — devolve o código
 * copia-e-cola e o id pra consultar o status depois. Recebe as credenciais
 * explicitamente porque essa função é usada tanto pra Pix dos pedidos
 * (SharpifyConfig) quanto pra Pix da mensalidade (MensalidadePagamentoConfig)
 * — duas contas/credenciais completamente independentes.
 */
export async function createSharpifyPixCharge(
  credentials: SharpifyCredentials,
  input: { name: string; description: string; amountCents: number }
): Promise<{ externalId: string; qrCodeText: string }> {
  const response = await fetch(`${SHARPIFY_BASE_URL}/api/v1/checkout/payment-link/create`, {
    method: "POST",
    headers: getHeaders(credentials),
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      amount: input.amountCents / 100,
      gatewayMethod: "PIX",
    }),
  });

  const data = (await response.json().catch(() => null)) as SharpifyPaymentLinkResponse | null;

  if (!response.ok || !data?.data?.payment) {
    throw new SharpifyServiceError(
      `Sharpify recusou a cobrança (HTTP ${response.status}).`,
      "REQUEST_FAILED"
    );
  }

  return {
    externalId: data.data.id,
    qrCodeText: data.data.payment.gateway.data.code,
  };
}

/** Consulta se um link de pagamento já foi aprovado. */
export async function isSharpifyPaymentApproved(
  credentials: SharpifyCredentials,
  paymentLinkId: string
): Promise<boolean> {
  const response = await fetch(
    `${SHARPIFY_BASE_URL}/api/v1/checkout/payment-link/get?paymentLinkId=${encodeURIComponent(paymentLinkId)}`,
    { headers: getHeaders(credentials) }
  );
  if (!response.ok) return false;
  const data = (await response.json().catch(() => null)) as SharpifyPaymentLinkResponse | null;
  return data?.data?.status === "APPROVED";
}
