import { CreditCard } from "lucide-react";

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

/**
 * Lembrete de mensalidade do sistema pra dona da loja, no fim de cada mês —
 * mostra um botão que abre o WhatsApp já com uma mensagem pronta pro
 * desenvolvedor. Some sozinho quando o desenvolvedor confirma o pagamento
 * pelo painel próprio (/admin/dev — ver src/app/admin/dev/page.tsx), ou pode
 * ser desligado por completo por lá a qualquer momento.
 */
export function BillingReminderBanner({ storeName, mensalidadePagaEm, reminderEnabled }: BillingReminderBannerProps) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isEndOfMonth = now.getDate() >= BILLING_REMINDER_FROM_DAY;
  const alreadyPaid = mensalidadePagaEm === currentMonth;

  if (!reminderEnabled || !isEndOfMonth || alreadyPaid) return null;

  const message = `Oi Davi! Aqui é a ${storeName}. Vim confirmar o pagamento da mensalidade do sistema desse mês 🙂`;
  const waLink = `https://wa.me/${DEV_WHATSAPP}?text=${encodeURIComponent(message)}`;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-3">
      <CreditCard className="size-4 shrink-0 text-amber-600" />
      <p className="flex-1 text-sm font-medium text-amber-800">
        Já estamos no fim do mês — não esqueça de confirmar o pagamento da mensalidade do
        sistema.
      </p>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
      >
        Pagar mensalidade
      </a>
    </div>
  );
}
