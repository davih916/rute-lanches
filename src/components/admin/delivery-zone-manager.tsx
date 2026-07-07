"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCentsToBRL, reaisToCents } from "@/lib/money";

interface DeliveryZoneRow {
  id: string;
  neighborhood: string;
  feeCents: number;
  active: boolean;
  orderCount: number;
}

export function DeliveryZoneManager({ zones }: { zones: DeliveryZoneRow[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [neighborhood, setNeighborhood] = useState("");
  const [fee, setFee] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setNeighborhood("");
    setFee("");
    setError(null);
    setModalOpen(true);
  }

  function openEdit(zone: DeliveryZoneRow) {
    setEditingId(zone.id);
    setNeighborhood(zone.neighborhood);
    setFee((zone.feeCents / 100).toFixed(2));
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
        body: JSON.stringify({ neighborhood, feeCents: reaisToCents(fee) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar bairro.");
        setSubmitting(false);
        return;
      }

      setModalOpen(false);
      setSubmitting(false);
      window.location.reload();
    } catch {
      setError("Falha de conexão.");
      setSubmitting(false);
    }
  }

  async function handleToggleActive(zone: DeliveryZoneRow) {
    await fetch(`/api/delivery-zones/${zone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !zone.active }),
    });
    window.location.reload();
  }

  async function handleDelete(zone: DeliveryZoneRow) {
    if (!confirm(`Excluir o bairro "${zone.neighborhood}"? Essa ação não pode ser desfeita.`)) return;

    const res = await fetch(`/api/delivery-zones/${zone.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Não foi possível excluir este bairro.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-neutral-900">Bairros e taxa de entrega</p>
          <p className="text-sm text-neutral-500">
            Só bairros ativos aparecem no checkout. Sem nenhum bairro cadastrado, só
            retirada fica disponível para o cliente.
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="size-4" /> Novo bairro
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase text-neutral-400">
              <th className="px-4 py-3">Bairro</th>
              <th className="px-4 py-3">Taxa</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.id} className="border-b border-neutral-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-neutral-900">{zone.neighborhood}</td>
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
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-400">
                  Nenhum bairro cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <h2 className="text-lg font-bold text-neutral-900">
            {editingId ? "Editar bairro" : "Novo bairro"}
          </h2>
          <Input
            label="Bairro"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Taxa de entrega (R$)"
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            required
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <Button type="submit" loading={submitting}>
            {editingId ? "Salvar" : "Criar bairro"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
