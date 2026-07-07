import { getFiscalConfigForAdmin } from "@/lib/services/fiscal-config-service";
import { FiscalConfigForm } from "@/components/admin/fiscal-config-form";
import { FiscalCertificateCard } from "@/components/admin/fiscal-certificate-card";

export default async function AdminFiscalPage() {
  const config = await getFiscalConfigForAdmin();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-bold text-neutral-900">Fiscal</h1>
        <p className="text-sm text-neutral-500">
          Configure a empresa e o certificado digital para emitir NFC-e de verdade. Nenhuma nota é
          emitida automaticamente — a emissão é sempre uma ação manual no pedido.
        </p>
      </div>

      <FiscalConfigForm config={config} />
      <FiscalCertificateCard config={config} />
    </div>
  );
}
