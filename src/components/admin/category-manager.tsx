"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CategoryRow {
  id: string;
  name: string;
  active: boolean;
  productCount: number;
}

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setName("");
    setError(null);
    setModalOpen(true);
  }

  function openEdit(category: CategoryRow) {
    setEditingId(category.id);
    setName(category.name);
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = editingId ? `/api/categories/${editingId}` : "/api/categories";
    const method = editingId ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar categoria.");
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

  async function handleToggleActive(category: CategoryRow) {
    await fetch(`/api/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !category.active }),
    });
    window.location.reload();
  }

  async function handleDelete(category: CategoryRow) {
    if (!confirm(`Excluir a categoria "${category.name}"? Essa ação não pode ser desfeita.`)) return;

    const res = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Não foi possível excluir esta categoria.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">{categories.length} categorias</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> Nova categoria
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase text-neutral-400">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Produtos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-b border-neutral-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-neutral-900">{category.name}</td>
                <td className="px-4 py-2.5 text-neutral-500">{category.productCount}</td>
                <td className="px-4 py-2.5">
                  <Badge
                    className={
                      category.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-neutral-100 text-neutral-500"
                    }
                  >
                    {category.active ? "Ativa" : "Inativa"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(category)}
                      aria-label="Editar"
                      className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleActive(category)}>
                      {category.active ? "Desativar" : "Ativar"}
                    </Button>
                    <button
                      onClick={() => handleDelete(category)}
                      aria-label="Excluir"
                      disabled={category.productCount > 0}
                      title={
                        category.productCount > 0
                          ? "Só é possível excluir categorias sem produtos"
                          : undefined
                      }
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <h2 className="text-lg font-bold text-neutral-900">
            {editingId ? "Editar categoria" : "Nova categoria"}
          </h2>
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <Button type="submit" loading={submitting}>
            {editingId ? "Salvar" : "Criar categoria"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
