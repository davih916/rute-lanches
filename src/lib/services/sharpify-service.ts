import "server-only";
import { getSharpifyConfig, getSharpifyCredentials, SharpifyConfigError } from "@/lib/services/sharpify-config-service";

const SHARPIFY_BASE_URL = "https://api.sharpify.com.br";

export class SharpifyServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_CONFIGURED" | "REQUEST_FAILED"
  ) {
    super(message);
    this.name = "SharpifyServiceError";
  }
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

async function getHeaders(): Promise<Record<string, string>> {
  const config = await getSharpifyConfig();
  let credentials: { clientId: string; clientSecret: string };
  try {
    credentials = getSharpifyCredentials(config);
  } catch (err) {
    if (err instanceof SharpifyConfigError) {
      throw new SharpifyServiceError("Sharpify não configurada. Cadastre em /admin/dev.", "NOT_CONFIGURED");
    }
    throw err;
  }
  return {
    "Content-Type": "application/json",
    "x-sharpify-client-id": credentials.clientId,
    "x-sharpify-client-secret": credentials.clientSecret,
  };
}

/** Cria uma cobrança Pix real via gateway da Sharpify — devolve o código copia-e-cola e o id pra consultar o status depois. */
export async function createSharpifyPixCharge(input: {
  orderNumber: number;
  amountCents: number;
}): Promise<{ externalId: string; qrCodeText: string }> {
  const headers = await getHeaders();

  const response = await fetch(`${SHARPIFY_BASE_URL}/api/v1/checkout/payment-link/create`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Pedido #${String(input.orderNumber).padStart(3, "0")}`,
      description: "Pagamento do pedido",
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
export async function isSharpifyPaymentApproved(paymentLinkId: string): Promise<boolean> {
  const headers = await getHeaders();
  const response = await fetch(
    `${SHARPIFY_BASE_URL}/api/v1/checkout/payment-link/get?paymentLinkId=${encodeURIComponent(paymentLinkId)}`,
    { headers }
  );
  if (!response.ok) return false;
  const data = (await response.json().catch(() => null)) as SharpifyPaymentLinkResponse | null;
  return data?.data?.status === "APPROVED";
}
