"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Copy, Check } from "lucide-react";

const DEV_WHATSAPP = "5515991584811";
// A partir desse dia do mês (inclusive) o banner passa a aparecer, até o fim
// do mês — cobre meses com 28 a 31 dias sem precisar calcular o último dia.
const BILLING_REMINDER_FROM_DAY = 25;

interface BillingReminderBannerProps {
  storeName: string;
  /** "YYYY-MM" do mês já confirmado como pago — ver Settings.mensalidadePagaEm. */
  mensalidadePagaEm: string | null;
  /** Liga/desliga o banner por completo, independente do dia do mês — controlado em /admin/dev. */
  reminderEnabled: boolean;
}

interface MensalidadePixState {
  configured: boolean;
  paid: boolean;
  qrCodeText: string | null;
  qrCodeImageUrl: string | null;
}

/**
 * Lembrete de mensalidade do sistema pra dona da loja, no fim de cada mês.
 * Se o desenvolvedor configurou pagamento automático (ver
 * /admin/dev — mensalidade-pix-service.ts), mostra o QR Code Pix real aqui
 * dentro e confirma sozinho (polling) quando cai — sem depender de ninguém
 * clicar em nada. Sem essa configuração, cai no botão de WhatsApp de sempre.
 */
export function BillingReminderBanner({ storeName, mensalidadePagaEm, reminderEnabled }: BillingReminderBannerProps) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isEndOfMonth = now.getDate() >= BILLING_REMINDER_FROM_DAY;
  const alreadyPaidInitially = mensalidadePagaEm === currentMonth;

  const [pix, setPix] = useState<MensalidadePixState | null>(null);
  const [paidNow, setPaidNow] = useState(false);
  const [copied, setCopied] = useState(false);
  const shouldShow = reminderEnabled && isEndOfMonth && !alreadyPaidInitially && !paidNow;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!shouldShow) return;

    let cancelled = false;
    async function fetchPix() {
      try {
        const res = await fetch("/api/admin/mensalidade-pix");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setPix(data);
          if (data.paid) {
            setPaidNow(true);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        // Falha de rede num poll: ignora e tenta de novo no próximo ciclo.
      }
    }

    fetchPix();
    pollRef.current = setInterval(fetchPix, 8000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [shouldShow]);

  async function handleCopy() {
    if (!pix?.qrCodeText) return;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(pix.qrCodeText);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = pix.qrCodeText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!shouldShow) return null;

  const message = `Oi Davi! Aqui é a ${storeName}. Vim confirmar o pagamento da mensalidade do sistema desse mês 🙂`;
  const waLink = `https://wa.me/${DEV_WHATSAPP}?text=${encodeURIComponent(message)}`;

  return (
    <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <CreditCard className="size-4 shrink-0 text-amber-600" />
        <p className="flex-1 text-sm font-medium text-amber-800">
          Já estamos no fim do mês — não esqueça de confirmar o pagamento da mensalidade do
          sistema.
        </p>
        {!pix?.configured && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
          >
            Pagar mensalidade
          </a>
        )}
      </div>

      {pix?.configured && pix.qrCodeText && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-amber-200 bg-white p-3">
          {pix.qrCodeImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pix.qrCodeImageUrl} alt="QR Code Pix da mensalidade" className="size-32 rounded-lg" />
          )}
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-xs text-neutral-500">Pague pelo Pix — a página atualiza sozinha quando cair.</p>
            <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-neutral-600">
                {pix.qrCodeText}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
