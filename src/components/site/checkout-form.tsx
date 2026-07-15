"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCentsToBRL, reaisToCents } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  DELIVERY_TYPE_LABELS,
  type PaymentMethod,
  type DeliveryType,
} from "@/lib/constants";
import {
  useCartStore,
  getCartSubtotalCents,
  getCartItemLineTotal,
  type CartStoreHook,
} from "@/store/cart-store";

function generatePlaceholderPhone(): string {
  // Telefone é único no cadastro do cliente — precisa de entropia suficiente
  // pra duas vendas no balcão no mesmo milissegundo não colidirem e serem
  // silenciosamente tratadas como o mesmo cliente (upsert por telefone).
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return `${Date.now()}${random.toString().padStart(6, "0")}`;
}

interface DeliveryZoneOption {
  id: string;
  neighborhood: string;
  feeCents: number;
}

interface CheckoutFormProps {
  storeOpen: boolean;
  acceptedPaymentMethods: PaymentMethod[];
  deliveryZones: DeliveryZoneOption[];
  /** Qual carrinho usar — o do site (padrão) ou o da tela "Nova Venda" (admin). */
  useCartStoreHook?: CartStoreHook;
  /** Quais botões de "como quer receber" mostrar — o site nunca mostra "Balcão". */
  deliveryTypeOptions?: DeliveryType[];
  /** No site, nome/telefone do cliente são obrigatórios; na Venda no Balcão são opcionais. */
  requireCustomerContact?: boolean;
  submitLabel?: string;
  /** Se informado, é chamado no lugar do redirecionamento padrão para /pedido/[id]. */
  onOrderCreated?: (order: { id: string; paymentMethod: string }) => void;
  /** O site redireciona pra home se o carrinho estiver vazio; a Venda no Balcão começa vazia de propósito. */
  redirectIfEmpty?: boolean;
}

export function CheckoutForm({
  storeOpen,
  acceptedPaymentMethods,
  deliveryZones,
  useCartStoreHook = useCartStore,
  deliveryTypeOptions = ["entrega", "retirada"],
  requireCustomerContact = true,
  submitLabel = "Enviar pedido",
  onOrderCreated,
  redirectIfEmpty = true,
}: CheckoutFormProps) {
  const router = useRouter();
  const items = useCartStoreHook((s) => s.items);
  const clear = useCartStoreHook((s) => s.clear);

  const hasDeliveryZones = deliveryZones.length > 0;
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(() => {
    if (hasDeliveryZones && deliveryTypeOptions.includes("entrega")) return "entrega";
    // "entrega" indisponível (sem bairro cadastrado) — não pode ser a opção
    // inicial, senão o formulário abre com os campos de endereço de uma
    // opção que está desabilitada e não pode ser enviada.
    return deliveryTypeOptions.find((type) => type !== "entrega") ?? deliveryTypeOptions[0];
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [deliveryZoneId, setDeliveryZoneId] = useState(deliveryZones[0]?.id ?? "");
  const [complement, setComplement] = useState("");
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    acceptedPaymentMethods[0] ?? "pix"
  );
  const [needsChange, setNeedsChange] = useState(false);
  const [cashPayValue, setCashPayValue] = useState("");
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (!redirectIfEmpty) return;
    // O carrinho persistido (zustand + localStorage) só é reidratado depois
    // da primeira renderização — sem esse atraso, todo cliente seria
    // redirecionado de volta pro cardápio antes do carrinho real carregar.
    const timer = setTimeout(() => {
      if (items.length === 0 && !hasSubmitted) {
        router.replace("/");
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, hasSubmitted, redirectIfEmpty]);

  const subtotal = getCartSubtotalCents(items);
  const isDelivery = deliveryType === "entrega";
  const selectedZone = deliveryZones.find((z) => z.id === deliveryZoneId);
  const effectiveDeliveryFee = isDelivery ? (selectedZone?.feeCents ?? 0) : 0;
  const total = subtotal + effectiveDeliveryFee;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cashChangeForCents =
      paymentMethod === "dinheiro" && needsChange && cashPayValue
        ? reaisToCents(cashPayValue)
        : undefined;

    if (cashChangeForCents !== undefined && cashChangeForCents < total) {
      setError("O valor para troco deve ser maior ou igual ao total do pedido.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryType,
          customer: {
            name: name || "Cliente Balcão",
            // Telefone é obrigatório/único no cadastro do cliente — quando não
            // informado (venda no balcão), gera um valor sintético só de
            // dígitos (o campo aceita esse formato) pra não colidir com outro
            // cliente sem telefone.
            phone: phone || generatePlaceholderPhone(),
            address: isDelivery ? address : undefined,
            addressNumber: isDelivery ? addressNumber || undefined : undefined,
            complement: isDelivery ? complement || undefined : undefined,
            reference: isDelivery ? reference || undefined : undefined,
          },
          paymentMethod,
          deliveryZoneId: isDelivery ? deliveryZoneId : undefined,
          cashChangeForCents,
          cpfCnpj: cpfCnpj || undefined,
          wantsInvoice,
          notes: notes || undefined,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            notes: item.notes,
            addonIds: item.addons.map((a) => a.id),
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Não foi possível enviar seu pedido.");
        setSubmitting(false);
        return;
      }

      setHasSubmitted(true);
      clear();
      if (onOrderCreated) {
        onOrderCreated(data.order);
      } else {
        router.push(`/pedido/${data.order.id}`);
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  if (redirectIfEmpty && items.length === 0 && !hasSubmitted) return null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {!storeOpen && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          A loja está fechada no momento — não é possível enviar pedidos até reabrir.
        </p>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-neutral-800">Resumo do pedido</p>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.cartItemId} className="flex justify-between text-sm text-neutral-600">
              <span>
                {item.quantity}x {item.name}
              </span>
              <span>{formatCentsToBRL(getCartItemLineTotal(item))}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-sm">
          <div className="flex justify-between text-neutral-500">
            <span>Subtotal</span>
            <span>{formatCentsToBRL(subtotal)}</span>
          </div>
          {isDelivery && selectedZone && (
            <div className="flex justify-between text-neutral-500">
              <span>Entrega ({selectedZone.neighborhood})</span>
              <span>
                {selectedZone.feeCents > 0 ? formatCentsToBRL(selectedZone.feeCents) : "Grátis"}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-neutral-900">
            <span>Total</span>
            <span>{formatCentsToBRL(total)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-neutral-800">Como você quer receber?</p>
        <div className={`grid gap-2 ${deliveryTypeOptions.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {deliveryTypeOptions.map((type) => {
            const disabled = type === "entrega" && !hasDeliveryZones;
            return (
              <button
                key={type}
                type="button"
                disabled={disabled}
                onClick={() => setDeliveryType(type)}
                className={
                  "rounded-lg border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
                  (deliveryType === type
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50")
                }
              >
                {DELIVERY_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
        {!hasDeliveryZones && (
          <p className="text-xs text-neutral-400">
            Entrega indisponível no momento — só retirada no local.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-neutral-800">Seus dados</p>
        <Input
          name="name"
          label={requireCustomerContact ? "Nome completo" : "Nome do cliente (opcional)"}
          required={requireCustomerContact}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          name="phone"
          label={requireCustomerContact ? "Telefone / WhatsApp" : "Telefone (opcional)"}
          required={requireCustomerContact}
          autoComplete="tel"
          placeholder="(11) 91234-5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {isDelivery && (
          <>
            <Input
              name="address"
              label="Endereço"
              required
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                name="addressNumber"
                label="Número"
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.target.value)}
              />
              <Select
                name="deliveryZoneId"
                label="Bairro"
                required
                value={deliveryZoneId}
                onChange={(e) => setDeliveryZoneId(e.target.value)}
              >
                {deliveryZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.neighborhood} —{" "}
                    {zone.feeCents > 0 ? formatCentsToBRL(zone.feeCents) : "Grátis"}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              name="complement"
              label="Complemento"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
            />
            <Input
              name="reference"
              label="Ponto de referência"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Select
          name="paymentMethod"
          label="Forma de pagamento"
          value={paymentMethod}
          onChange={(e) => {
            setPaymentMethod(e.target.value as PaymentMethod);
            setNeedsChange(false);
            setCashPayValue("");
          }}
        >
          {acceptedPaymentMethods.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </Select>

        {paymentMethod === "dinheiro" && (
          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="mb-2 text-sm font-medium text-neutral-700">Precisa de troco?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNeedsChange(false)}
                className={
                  "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors " +
                  (!needsChange
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50")
                }
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => setNeedsChange(true)}
                className={
                  "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors " +
                  (needsChange
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50")
                }
              >
                Sim
              </button>
            </div>
            {needsChange && (
              <Input
                name="cashPayValue"
                label="Vou pagar com quanto?"
                inputMode="decimal"
                placeholder="Ex: 50,00"
                className="mt-3"
                value={cashPayValue}
                onChange={(e) => setCashPayValue(e.target.value)}
              />
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            className="size-4 rounded border-neutral-300"
            checked={wantsInvoice}
            onChange={(e) => setWantsInvoice(e.target.checked)}
          />
          Desejo nota fiscal (NFC-e)
        </label>
        {wantsInvoice && (
          <Input
            name="cpfCnpj"
            label="CPF/CNPJ (opcional, aparece na nota)"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
          />
        )}
        <Textarea
          name="notes"
          label="Observações do pedido"
          placeholder="Ex: sem cebola, retirar embalagem separada..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <Button type="submit" size="lg" loading={submitting} disabled={!storeOpen} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
