"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { reaisToCents } from "@/lib/money";
import {
  RECEIPT_WIDTHS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  parseAcceptedPaymentMethods,
  type ReceiptWidth,
  type PaymentMethod,
} from "@/lib/constants";
import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  parseWeeklySchedule,
  defaultWeeklySchedule,
  type WeeklySchedule,
  type DaySchedule,
} from "@/lib/opening-hours";
import { PIX_KEY_TYPES, PIX_KEY_TYPE_LABELS, type PixKeyType } from "@/lib/pix-brcode";
import type { Settings } from "@prisma/client";

const PIX_KEY_PLACEHOLDERS: Record<PixKeyType, string> = {
  cpf_cnpj: "Só números — ex: 12345678900",
  email: "ex: rute@email.com",
  telefone: "Com DDD — ex: 15 99610-9624 (o sistema formata sozinho)",
  aleatoria: "ex: 123e4567-e89b-12d3-a456-426614174000",
};

interface SettingsFormProps {
  settings: Settings;
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const router = useRouter();
  const [storeName, setStoreName] = useState(settings.storeName);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [pixKey, setPixKey] = useState(settings.pixKey ?? "");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>(
    (settings.pixKeyType as PixKeyType) ?? "telefone"
  );
  const [pixCity, setPixCity] = useState(settings.pixCity ?? "SOROCABA");
  const [storeOpen, setStoreOpen] = useState(settings.storeOpen);
  const [schedule, setSchedule] = useState<WeeklySchedule>(
    () => parseWeeklySchedule(settings.openingHours) ?? defaultWeeklySchedule()
  );
  const [minOrder, setMinOrder] = useState((settings.minOrderCents / 100).toFixed(2));
  const [receiptWidth, setReceiptWidth] = useState<ReceiptWidth>(
    settings.receiptWidth as ReceiptWidth
  );

  function updateDay(day: keyof WeeklySchedule, patch: Partial<DaySchedule>) {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<PaymentMethod[]>(() =>
    parseAcceptedPaymentMethods(settings.acceptedPaymentMethods)
  );

  function togglePaymentMethod(method: PaymentMethod) {
    setAcceptedPaymentMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  }

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (acceptedPaymentMethods.length === 0) {
      toast.error("Selecione ao menos uma forma de pagamento.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          primaryColor,
          secondaryColor,
          whatsapp,
          address,
          pixKey,
          pixKeyType,
          pixCity,
          storeOpen,
          openingHours: schedule,
          acceptedPaymentMethods,
          minOrderCents: reaisToCents(minOrder),
          receiptWidth,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Erro ao salvar.");
        setSubmitting(false);
        return;
      }

      toast.success("Configurações salvas com sucesso.");
      setSubmitting(false);
      // Atualiza os dados do servidor (cores/nome refletem em toda a aplicação) sem recarregar a página inteira.
      router.refresh();
    } catch {
      toast.error("Falha de conexão.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-neutral-900">Status da loja</p>
            <p className="text-sm text-neutral-500">
              Pausa manual — desligue para fechar a loja imediatamente, mesmo dentro do
              horário de funcionamento configurado abaixo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStoreOpen((v) => !v)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
              storeOpen ? "bg-emerald-500" : "bg-neutral-300"
            }`}
          >
            <span
              className={`absolute top-1 size-6 rounded-full bg-white shadow transition-transform ${
                storeOpen ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <p className={`text-sm font-medium ${storeOpen ? "text-emerald-600" : "text-red-500"}`}>
          {storeOpen ? "Loja aberta — recebendo pedidos" : "Loja fechada — pedidos bloqueados"}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <div>
          <p className="font-semibold text-neutral-900">Horário de funcionamento</p>
          <p className="text-sm text-neutral-500">
            Fora desses horários, o site mostra que a loja está fechada e bloqueia novos
            pedidos automaticamente — mesmo com a pausa manual acima desligada (aberta).
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {WEEKDAYS.map((day) => {
            const daySchedule = schedule[day];
            return (
              <div key={day} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => updateDay(day, { enabled: !daySchedule.enabled })}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    daySchedule.enabled ? "bg-emerald-500" : "bg-neutral-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 size-4 rounded-full bg-white shadow transition-transform ${
                      daySchedule.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="w-20 shrink-0 text-sm font-medium text-neutral-700">
                  {WEEKDAY_LABELS[day]}
                </span>
                {daySchedule.enabled ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={daySchedule.open}
                      onChange={(e) => updateDay(day, { open: e.target.value })}
                      className="h-9 w-28"
                    />
                    <span className="text-sm text-neutral-400">até</span>
                    <Input
                      type="time"
                      value={daySchedule.close}
                      onChange={(e) => updateDay(day, { close: e.target.value })}
                      className="h-9 w-28"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-neutral-400">Fechado</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <div>
          <p className="font-semibold text-neutral-900">Formas de pagamento aceitas</p>
          <p className="text-sm text-neutral-500">
            Só as formas marcadas aparecem no checkout do cliente. Nenhuma delas processa
            pagamento online — é só controle de quais opções a loja aceita hoje.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {PAYMENT_METHODS.map((method) => {
            const active = acceptedPaymentMethods.includes(method);
            return (
              <label
                key={method}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => togglePaymentMethod(method)}
                  className="size-4 accent-[var(--brand-primary)]"
                />
                <span className="text-sm font-medium text-neutral-700">
                  {PAYMENT_METHOD_LABELS[method]}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <div>
          <p className="font-semibold text-neutral-900">Chave Pix</p>
          <p className="text-sm text-neutral-500">
            Cadastre aqui a chave Pix da loja (CPF, CNPJ, e-mail, telefone ou chave aleatória).
            O sistema gera automaticamente o QR Code com o valor certo de cada pedido — o
            pagamento cai direto na sua conta, sem taxas ou conta em outro banco. Você confirma
            manualmente no Kanban quando o dinheiro cair.
          </p>
        </div>
        <Select
          name="pixKeyType"
          label="Tipo da chave"
          value={pixKeyType}
          onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
        >
          {PIX_KEY_TYPES.map((type) => (
            <option key={type} value={type}>
              {PIX_KEY_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <Input
          name="pixKey"
          label="Chave Pix"
          placeholder={PIX_KEY_PLACEHOLDERS[pixKeyType]}
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
        />
        <p className="text-xs text-neutral-400">
          Digite igual está no seu banco — pode usar espaço/traço no telefone, o sistema
          formata sozinho. O importante é escolher o tipo certo acima (é isso que estava
          errado antes e causava o erro ao pagar).
        </p>
        <Input
          name="pixCity"
          label="Cidade (para o QR Code)"
          value={pixCity}
          onChange={(e) => setPixCity(e.target.value.toUpperCase())}
        />
        {!pixKey && (
          <p className="text-xs text-amber-600">
            Sem chave Pix cadastrada, os clientes não conseguem pagar por Pix pelo site.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <p className="font-semibold text-neutral-900">Identidade</p>
        <Input
          name="storeName"
          label="Nome da loja"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            name="primaryColor"
            label="Cor primária"
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-11 px-1.5"
          />
          <Input
            name="secondaryColor"
            label="Cor secundária"
            type="color"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="h-11 px-1.5"
          />
        </div>
        <Input
          name="whatsapp"
          label="WhatsApp"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
        />
        <Input
          name="address"
          label="Endereço"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <p className="font-semibold text-neutral-900">Pedido e impressão</p>
        <Input
          name="minOrder"
          label="Pedido mínimo (R$)"
          inputMode="decimal"
          value={minOrder}
          onChange={(e) => setMinOrder(e.target.value)}
        />
        <p className="text-xs text-neutral-400">
          A taxa de entrega é definida caso a caso: o cliente digita o próprio endereço no
          checkout, e você confirma o valor da entrega ao aceitar o pedido no Kanban.
        </p>
        <Select
          name="receiptWidth"
          label="Largura da bobina da impressora"
          value={receiptWidth}
          onChange={(e) => setReceiptWidth(e.target.value as ReceiptWidth)}
        >
          {RECEIPT_WIDTHS.map((width) => (
            <option key={width} value={width}>
              {width}
            </option>
          ))}
        </Select>
      </div>

      <Button type="submit" size="lg" loading={submitting} className="w-full sm:w-fit">
        Salvar configurações
      </Button>
    </form>
  );
}
