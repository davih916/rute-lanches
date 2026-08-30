import "server-only";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSettings, currentBillingMonth, confirmMensalidadePaid } from "@/lib/services/settings-service";
import {
  getMensalidadePagamentoConfig,
  getMensalidadePagamentoCredentials,
  isMensalidadePagamentoConfigured,
} from "@/lib/services/mensalidade-payment-config-service";
import { createSharpifyPixCharge, isSharpifyPaymentApproved } from "@/lib/services/sharpify-service";

export interface MensalidadePixState {
  configured: boolean;
  paid: boolean;
  qrCodeText: string | null;
  qrCodeImageUrl: string | null;
}

/**
 * Gera (uma vez por mês) ou reaproveita a cobrança Pix da mensalidade, e
 * aproveita a própria consulta pra checar se já foi paga — mesmo truque de
 * "polling piggybacked" usado no Pix dos pedidos (ver pagbank-service.ts),
 * só que aqui quem confere é a própria Rute vendo o banner no dashboard
 * dela, não o desenvolvedor.
 */
export async function getMensalidadePixState(): Promise<MensalidadePixState> {
  if (!(await isMensalidadePagamentoConfigured())) {
    return { configured: false, paid: false, qrCodeText: null, qrCodeImageUrl: null };
  }

  const settings = await getSettings();
  const month = currentBillingMonth();

  if (settings.mensalidadePagaEm === month) {
    return { configured: true, paid: true, qrCodeText: null, qrCodeImageUrl: null };
  }

  // Cobrança do mês já existe: só confere se foi paga.
  if (settings.mensalidadeChargeMonth === month && settings.mensalidadeChargeExternalId) {
    const config = await getMensalidadePagamentoConfig();
    const approved = await isSharpifyPaymentApproved(
      getMensalidadePagamentoCredentials(config),
      settings.mensalidadeChargeExternalId
    ).catch(() => false);

    if (approved) {
      await confirmMensalidadePaid();
      return { configured: true, paid: true, qrCodeText: null, qrCodeImageUrl: null };
    }

    const qrCodeImageUrl = await QRCode.toDataURL(settings.mensalidadeChargeQrCodeText ?? "", {
      margin: 1,
      width: 320,
    }).catch(() => null);
    return {
      configured: true,
      paid: false,
      qrCodeText: settings.mensalidadeChargeQrCodeText,
      qrCodeImageUrl,
    };
  }

  // Mês novo (ou primeira vez) — gera uma cobrança nova.
  const config = await getMensalidadePagamentoConfig();
  const { externalId, qrCodeText } = await createSharpifyPixCharge(getMensalidadePagamentoCredentials(config), {
    name: `Mensalidade ${month}`,
    description: `Mensalidade do sistema — ${settings.storeName}`,
    amountCents: settings.mensalidadeValorCents,
  });

  await prisma.settings.update({
    where: { id: "default" },
    data: {
      mensalidadeChargeMonth: month,
      mensalidadeChargeExternalId: externalId,
      mensalidadeChargeQrCodeText: qrCodeText,
    },
  });

  const qrCodeImageUrl = await QRCode.toDataURL(qrCodeText, { margin: 1, width: 320 }).catch(() => null);
  return { configured: true, paid: false, qrCodeText, qrCodeImageUrl };
}
