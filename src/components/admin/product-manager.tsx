"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCentsToBRL, reaisToCents } from "@/lib/money";

interface AddonRow {
  id?: string;
  name: string;
  priceCents: number;
}

interface ProductRow {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  ingredients: string;
  priceCents: number;
  imageUrl: string | null;
  active: boolean;
  addons: AddonRow[];
}

interface CategoryOption {
  id: string;
  name: string;
}

interface ProductForm {
  categoryId: string;
  name: string;
  description: string;
  ingredients: string;
  price: string;
  imageUrl: string;
  active: boolean;
  addons: AddonRow[];
}

function emptyForm(defaultCategoryId: string): ProductForm {
  return {
    categoryId: defaultCategoryId,
    name: "",
    description: "",
    ingredients: "",
    price: "",
    imageUrl: "",
    active: true,
    addons: [],
  };
}

export function ProductManager({
  products,
  categories,
}: {
  products: ProductRow[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(() => emptyForm(categories[0]?.id ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.categoryName.toLowerCase().includes(term)
    );
  }, [products, search]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(categories[0]?.id ?? ""));
    setError(null);
    setImageError(null);
    setModalOpen(true);
  }

  function openEdit(product: ProductRow) {
    setEditingId(product.id);
    setForm({
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      ingredients: product.ingredients,
      price: (product.priceCents / 100).toFixed(2),
      imageUrl: product.imageUrl ?? "",
      active: product.active,
      addons: product.addons,
    });
    setError(null);
    setImageError(null);
    setModalOpen(true);
  }

  function addAddonRow() {
    setForm((f) => ({ ...f, addons: [...f.addons, { name: "", priceCents: 0 }] }));
  }

  function updateAddonRow(index: number, patch: Partial<AddonRow>) {
    setForm((f) => ({
      ...f,
      addons: f.addons.map((addon, i) => (i === index ? { ...addon, ...patch } : addon)),
    }));
  }

  function removeAddonRow(index: number) {
    setForm((f) => ({ ...f, addons: f.addons.filter((_, i) => i !== index) }));
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setImageError(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/products/upload-image", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        setImageError(data.error ?? "Erro ao enviar imagem.");
        return;
      }
      setForm((f) => ({ ...f, imageUrl: data.url }));
    } catch {
      setImageError("Falha de conexão.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      categoryId: form.categoryId,
      name: form.name,
      description: form.description,
      ingredients: form.ingredients,
      priceCents: reaisToCents(form.price),
      imageUrl: form.imageUrl,
      active: form.active,
      addons: form.addons
        .filter((addon) => addon.name.trim())
        .map((addon) => ({ id: addon.id, name: addon.name, priceCents: addon.priceCents })),
    };

    const url = editingId ? `/api/products/${editingId}` : "/api/products";
    const method = editingId ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar produto.");
        setSubmitting(false);
        return;
      }

      setModalOpen(false);
      setSubmitting(false);
      toast.success(editingId ? "Produto atualizado." : "Produto criado.");
      router.refresh();
    } catch {
      setError("Falha de conexão.");
      setSubmitting(false);
    }
  }

  async function handleToggleActive(product: ProductRow) {
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !product.active }),
    });
    if (!res.ok) {
      toast.error("Não foi possível atualizar o produto.");
      return;
    }
    toast.success(product.active ? "Produto desativado." : "Produto ativado.");
    router.refresh();
  }

  async function handleDelete(product: ProductRow) {
    if (!confirm(`Excluir "${product.name}"? Essa ação não pode ser desfeita.`)) return;

    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível excluir este produto.");
      return;
    }
    toast.success("Produto excluído.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          {search ? `${filteredProducts.length} de ${products.length}` : products.length} produtos
          cadastrados
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> Novo produto
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto por nome ou categoria..."
          className="h-10 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3.5 text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase text-neutral-400">
              <th className="px-4 py-3 w-14"></th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral-400">
                  Nenhum produto encontrado para &ldquo;{search}&rdquo;.
                </td>
              </tr>
            )}
            {filteredProducts.map((product) => (
              <tr key={product.id} className="border-b border-neutral-50 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="relative size-9 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-sm">🍔</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 font-medium text-neutral-900">{product.name}</td>
                <td className="px-4 py-2.5 text-neutral-500">{product.categoryName}</td>
                <td className="px-4 py-2.5 text-neutral-700">
                  {formatCentsToBRL(product.priceCents)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge
                    className={
                      product.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-neutral-100 text-neutral-500"
                    }
                  >
                    {product.active ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(product)}
                      aria-label="Editar"
                      className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleActive(product)}>
                      {product.active ? "Desativar" : "Ativar"}
                    </Button>
                    <button
                      onClick={() => handleDelete(product)}
                      aria-label="Excluir"
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} className="max-w-2xl">
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-6">
          <h2 className="text-lg font-bold text-neutral-900">
            {editingId ? "Editar produto" : "Novo produto"}
          </h2>

          <Select
            label="Categoria"
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>

          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />

          <Input
            label="Preço (R$)"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            required
          />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-700">Foto do produto</span>
            <div className="flex items-center gap-3">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                {form.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-2xl">🍔</div>
                )}
              </div>
              <div className="flex flex-col items-start gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {form.imageUrl ? "Trocar foto" : "Enviar foto"}
                </Button>
                {form.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
            {imageError && <p className="text-xs font-medium text-red-600">{imageError}</p>}
          </div>

          <Textarea
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Textarea
            label="Ingredientes"
            value={form.ingredients}
            onChange={(e) => setForm((f) => ({ ...f, ingredients: e.target.value }))}
          />

          <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
            <span className="text-sm font-medium text-neutral-700">
              Produto ativo (visível no cardápio)
            </span>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                form.active ? "bg-emerald-500" : "bg-neutral-300"
              }`}
            >
              <span
                className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${
                  form.active ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-700">Adicionais</p>
              <Button type="button" size="sm" variant="outline" onClick={addAddonRow}>
                <Plus className="size-3.5" /> Adicionar
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {form.addons.map((addon, i) => (
                <div key={addon.id ?? `new-${i}`} className="flex items-center gap-2">
                  <Input
                    value={addon.name}
                    onChange={(e) => updateAddonRow(i, { name: e.target.value })}
                    placeholder="Nome do adicional"
                    className="h-9 flex-1"
                  />
                  <Input
                    value={(addon.priceCents / 100).toFixed(2)}
                    onChange={(e) => updateAddonRow(i, { priceCents: reaisToCents(e.target.value) })}
                    inputMode="decimal"
                    className="h-9 w-24"
                  />
                  <button
                    type="button"
                    onClick={() => removeAddonRow(i)}
                    aria-label="Remover adicional"
                    className="shrink-0 rounded-md p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {form.addons.length === 0 && (
                <p className="text-xs text-neutral-400">Nenhum adicional cadastrado.</p>
              )}
            </div>
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <Button type="submit" size="lg" loading={submitting} disabled={uploadingImage}>
            {editingId ? "Salvar alterações" : "Criar produto"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
