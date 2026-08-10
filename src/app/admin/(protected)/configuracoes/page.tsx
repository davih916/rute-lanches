import { getSettings } from "@/lib/services/settings-service";
import { getPagBankConfigForAdmin } from "@/lib/services/pagbank-config-service";
import { SettingsForm } from "@/components/admin/settings-form";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { PagBankConfigForm } from "@/components/admin/pagbank-config-form";

// DeliveryZoneManager (bairro pré-cadastrado com taxa fixa) saiu desta tela —
// o checkout agora usa endereço/bairro digitados livremente pelo cliente, e o
// admin decide a taxa real ao aprovar cada entrega (ver order-card.tsx). O
// componente/serviço/API de DeliveryZone continuam existindo no código (não
// foram apagados, só não fazem mais parte do fluxo de pedido).

export default async function AdminConfiguracoesPage() {
  const [settings, pagbankConfig] = await Promise.all([getSettings(), getPagBankConfigForAdmin()]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-lg font-bold text-neutral-900">Configurações</h1>
      <SettingsForm settings={settings} />
      <div className="mt-6 max-w-2xl">
        <PagBankConfigForm config={pagbankConfig} />
      </div>
      <div className="mt-6 max-w-xl">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
