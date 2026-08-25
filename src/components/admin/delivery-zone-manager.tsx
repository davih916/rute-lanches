"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCentsToBRL, reaisToCents } from "@/lib/money";
import { sanitizeCep } from "@/lib/cep";

interface DeliveryZoneRow {
  id: string;
  neighborhood: string;
  cepPrefix: string | null;
  feeCents: number;
  active: boolean;
  visibleToCustomers: boolean;
  orderCount: number;
}

export function DeliveryZoneManager({ zones }: { zones: DeliveryZoneRow[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [neighborhood, setNeighborhood] = useState("");
  const [cepPrefix, setCepPrefix] = useState("");
  const [fee, setFee] = useState("");
  const [visibleToCustomers, setVisibleToCustomers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setNeighborhood("");
    setCepPrefix("");
    setFee("");
    setVisibleToCustomers(true);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(zone: DeliveryZoneRow) {
    setEditingId(zone.id);
    setNeighborhood(zone.neighborhood);
    setCepPrefix(zone.cepPrefix ?? "");
    setFee((zone.feeCents / 100).toFixed(2));
    setVisibleToCustomers(zone.visibleToCustomers);
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = editingId ? `/api/delivery-zones/${editingId}` : "/api/delivery-zones";
    const method = editingId ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          neighborhood,
          cepPrefix: sanitizeCep(cepPrefix),
          feeCents: reaisToCents(fee),
          visibleToCustomers,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar zona.");
        setSubmitting(false);
        return;
      }

      setModalOpen(false);
      setSubmitting(false);
      toast.success(editingId ? "Zona atualizada." : "Zona criada.");
      router.refresh();
    } catch {
      setError("Falha de conexão.");
      setSubmitting(false);
    }
  }

  async function handleToggleActive(zone: DeliveryZoneRow) {
    const res = await fetch(`/api/delivery-zones/${zone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !zone.active }),
    });
    if (!res.ok) {
      toast.error("Não foi possível atualizar a zona.");
      return;
    }
    toast.success(zone.active ? "Zona desativada." : "Zona ativada.");
    router.refresh();
  }

  async function handleDelete(zone: DeliveryZoneRow) {
    if (!confirm(`Excluir a zona "${zone.neighborhood}"? Essa ação não pode ser desfeita.`)) return;

    const res = await fetch(`/api/delivery-zones/${zone.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível excluir esta zona.");
      return;
    }
    toast.success("Zona excluída.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-neutral-900">Área de entrega por CEP</p>
          <p className="text-sm text-neutral-500">
            O cliente digita o CEP no checkout — o sistema encaixa no prefixo cadastrado aqui
            (ex: <span className="font-mono">18095</span> cobre qualquer CEP que comece com
            esses dígitos) e já preenche a taxa automaticamente. CEP fora de qualquer prefixo
            cadastrado é bloqueado no checkout — o cliente não consegue nem enviar o pedido.
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="size-4" /> Nova zona
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase text-neutral-400">
              <th className="px-4 py-3">Bairro</th>
              <th className="px-4 py-3">Prefixo do CEP</th>
              <th className="px-4 py-3">Taxa</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Visibilidade</th>
              <th className="px-4 py-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.id} className="border-b border-neutral-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-neutral-900">{zone.neighborhood}</td>
                <td className="px-4 py-2.5 font-mono text-neutral-700">
                  {zone.cepPrefix ?? <span className="text-red-500">sem CEP</span>}
                </td>
                <td className="px-4 py-2.5 text-neutral-700">{formatCentsToBRL(zone.feeCents)}</td>
                <td className="px-4 py-2.5">
                  <Badge
                    className={
                      zone.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                    }
                  >
                    {zone.active ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Badge
                    className={
                      zone.visibleToCustomers
                        ? "bg-blue-50 text-blue-700"
                        : "bg-amber-50 text-amber-700"
                    }
                  >
                    {zone.visibleToCustomers ? "Visível pro cliente" : "Só admin"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(zone)}
                      aria-label="Editar"
                      className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleActive(zone)}>
                      {zone.active ? "Desativar" : "Ativar"}
                    </Button>
                    <button
                      onClick={() => handleDelete(zone)}
                      aria-label="Excluir"
                      disabled={zone.orderCount > 0}
                      title={zone.orderCount > 0 ? "Já foi usado em pedidos" : undefined}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {zones.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-neutral-400">
                  Nenhuma zona cadastrada ainda — sem isso, o checkout bloqueia qualquer pedido
                  de entrega.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <h2 className="text-lg font-bold text-neutral-900">
            {editingId ? "Editar zona" : "Nova zona"}
          </h2>
          <Input
            label="Bairro (nome de exibição)"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Prefixo do CEP"
            placeholder="Ex: 18095"
            value={cepPrefix}
            onChange={(e) => setCepPrefix(e.target.value)}
            required
          />
          <p className="-mt-2 text-xs text-neutral-400">
            Quanto menos dígitos, mais CEPs cobertos de uma vez. Use mais dígitos pra uma rua
            específica ter uma taxa diferente do resto do bairro.
          </p>
          <Input
            label="Taxa de entrega (R$)"
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            required
          />
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200 px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-neutral-300"
              checked={visibleToCustomers}
              onChange={(e) => setVisibleToCustomers(e.target.checked)}
            />
            <span className="text-sm text-neutral-700">
              <span className="font-medium">Visível para o cliente no site</span>
              <br />
              <span className="text-xs text-neutral-500">
                Desmarque para zonas de uso interno (ex: endereço específico de um cliente com
                taxa combinada à parte) — continua disponível na Venda no Balcão, mas o CEP não
                entra na busca do checkout público.
              </span>
            </span>
          </label>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <Button type="submit" loading={submitting}>
            {editingId ? "Salvar" : "Criar zona"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
