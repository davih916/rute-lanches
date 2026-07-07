"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ProductFiscalRow {
  id: string;
  name: string;
  categoryName: string;
  ncm: string | null;
  cfop: string | null;
  csosnCst: string | null;
  unidadeComercial: string;
}

interface RowState {
  ncm: string;
  cfop: string;
  csosnCst: string;
  unidadeComercial: string;
}

function isComplete(row: RowState): boolean {
  return row.ncm.length === 8 && row.cfop.length === 4 && row.csosnCst.length >= 2;
}

export function ProductFiscalTable({ products }: { products: ProductFiscalRow[] }) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      products.map((p) => [
        p.id,
        {
          ncm: p.ncm ?? "",
          cfop: p.cfop ?? "",
          csosnCst: p.csosnCst ?? "",
          unidadeComercial: p.unidadeComercial,
        },
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  function updateField(productId: string, field: keyof RowState, value: string) {
    setRows((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }));
    setSavedId(null);
    setErrorId(null);
  }

  async function handleSave(productId: string) {
    setSavingId(productId);
    setErrorId(null);
    try {
      const res = await fetch(`/api/products/${productId}/fiscal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows[productId]),
      });
      if (!res.ok) {
        setErrorId(productId);
        setSavingId(null);
        return;
      }
      setSavedId(productId);
      setSavingId(null);
    } catch {
      setErrorId(productId);
      setSavingId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase text-neutral-400">
            <th className="px-4 py-3">Produto</th>
            <th className="px-4 py-3 w-28">NCM</th>
            <th className="px-4 py-3 w-24">CFOP</th>
            <th className="px-4 py-3 w-28">CSOSN/CST</th>
            <th className="px-4 py-3 w-24">Unidade</th>
            <th className="px-4 py-3 w-32"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const row = rows[product.id];
            const complete = isComplete(row);
            return (
              <tr key={product.id} className="border-b border-neutral-50 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {complete ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium text-neutral-900">{product.name}</p>
                      <p className="text-xs text-neutral-400">{product.categoryName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Input
                    value={row.ncm}
                    maxLength={8}
                    placeholder="00000000"
                    onChange={(e) => updateField(product.id, "ncm", e.target.value.replace(/\D/g, ""))}
                    className="h-9"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Input
                    value={row.cfop}
                    maxLength={4}
                    placeholder="5102"
                    onChange={(e) => updateField(product.id, "cfop", e.target.value.replace(/\D/g, ""))}
                    className="h-9"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Input
                    value={row.csosnCst}
                    maxLength={3}
                    placeholder="102"
                    onChange={(e) => updateField(product.id, "csosnCst", e.target.value.replace(/\D/g, ""))}
                    className="h-9"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Input
                    value={row.unidadeComercial}
                    maxLength={6}
                    onChange={(e) => updateField(product.id, "unidadeComercial", e.target.value.toUpperCase())}
                    className="h-9"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={savingId === product.id}
                    onClick={() => handleSave(product.id)}
                  >
                    Salvar
                  </Button>
                  {savedId === product.id && (
                    <span className="ml-2 text-xs font-medium text-emerald-600">Salvo!</span>
                  )}
                  {errorId === product.id && (
                    <span className="ml-2 text-xs font-medium text-red-600">Erro</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
