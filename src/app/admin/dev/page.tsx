"use client";

import { useState } from "react";
import { Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Painel de manutenção do desenvolvedor — não faz parte do sistema da loja
 * (não aparece na sidebar dela, não usa a sessão de admin dela). Único
 * propósito: marcar a mensalidade do mês corrente como paga, o que faz o
 * banner de cobrança sumir do dashboard até o próximo mês (ver
 * src/app/admin/(protected)/dashboard/page.tsx). Autenticado por senha própria
 * (DEV_PANEL_PASSWORD no .env do servidor).
 */
export default function DevPanelPage() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleConfirmPayment(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/dev/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setResult({ ok: false, message: data?.error ?? "Falha ao confirmar." });
        return;
      }
      setResult({ ok: true, message: "Mensalidade confirmada — o banner de cobrança some até o mês que vem." });
      setPassword("");
    } catch {
      setResult({ ok: false, message: "Falha de conexão." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <form
        onSubmit={handleConfirmPayment}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-6"
      >
        <div className="flex items-center gap-2">
          <Lock className="size-5 text-neutral-400" />
          <h1 className="text-base font-bold text-neutral-900">Painel do desenvolvedor</h1>
        </div>
        <p className="text-sm text-neutral-500">
          Confirma que a mensalidade do mês foi paga e remove o banner de cobrança do
          dashboard da loja.
        </p>
        <Input
          type="password"
          label="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {result && (
          <p className={`flex items-center gap-1.5 text-sm ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
            {result.ok && <Check className="size-4" />}
            {result.message}
          </p>
        )}
        <Button type="submit" loading={submitting} disabled={!password}>
          Confirmar mensalidade paga
        </Button>
      </form>
    </div>
  );
}
