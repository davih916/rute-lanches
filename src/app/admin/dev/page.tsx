"use client";

import { useState } from "react";
import { Lock, Check, CreditCard, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DevStatus {
  mensalidadePagaEm: string | null;
  mensalidadeReminderEnabled: boolean;
  sharpifyConfigured: boolean;
}

/**
 * Painel de manutenção do desenvolvedor — não faz parte do sistema da loja
 * (não aparece na sidebar dela, não usa a sessão de admin dela). Duas áreas
 * TOTALMENTE separadas uma da outra, cada uma com sua própria API:
 * - Mensalidade: cobrança do sistema pra loja, controlada só aqui.
 * - Pedidos (Sharpify): credenciais do gateway de pagamento usado nos
 *   pedidos dos clientes — não tem nenhuma relação com a mensalidade.
 * Autenticado por senha própria (DEV_PANEL_PASSWORD no .env do servidor).
 */
export default function DevPanelPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [status, setStatus] = useState<DevStatus | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await fetch("/api/dev/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setUnlockError(data?.error ?? "Falha ao entrar.");
        return;
      }
      setStatus(data);
      setUnlocked(true);
    } catch {
      setUnlockError("Falha de conexão.");
    } finally {
      setUnlocking(false);
    }
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <form
          onSubmit={handleUnlock}
          className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-6"
        >
          <div className="flex items-center gap-2">
            <Lock className="size-5 text-neutral-400" />
            <h1 className="text-base font-bold text-neutral-900">Painel do desenvolvedor</h1>
          </div>
          <Input
            type="password"
            label="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {unlockError && <p className="text-sm font-medium text-red-600">{unlockError}</p>}
          <Button type="submit" loading={unlocking} disabled={!password}>
            Entrar
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-10">
      <div className="flex items-center gap-2">
        <Lock className="size-5 text-neutral-400" />
        <h1 className="text-lg font-bold text-neutral-900">Painel do desenvolvedor</h1>
      </div>

      <MensalidadeSection password={password} status={status!} onStatusChange={setStatus} />
      <SharpifySection password={password} status={status!} onStatusChange={setStatus} />
    </div>
  );
}

function MensalidadeSection({
  password,
  status,
  onStatusChange,
}: {
  password: string;
  status: DevStatus;
  onStatusChange: (s: DevStatus) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleConfirmPayment() {
    setConfirming(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dev/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ ok: false, text: data?.error ?? "Falha ao confirmar." });
        return;
      }
      onStatusChange({ ...status, mensalidadePagaEm: data.mensalidadePagaEm });
      setMessage({ ok: true, text: "Mensalidade confirmada — o banner some até o mês que vem." });
    } catch {
      setMessage({ ok: false, text: "Falha de conexão." });
    } finally {
      setConfirming(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dev/mensalidade-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, enabled: !status.mensalidadeReminderEnabled }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ ok: false, text: data?.error ?? "Falha ao atualizar." });
        return;
      }
      onStatusChange({ ...status, mensalidadeReminderEnabled: data.mensalidadeReminderEnabled });
    } catch {
      setMessage({ ok: false, text: "Falha de conexão." });
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <CreditCard className="size-4 text-amber-600" />
        <p className="font-semibold text-neutral-900">Mensalidade do sistema</p>
      </div>
      <p className="text-sm text-neutral-500">
        Cobrança pra loja, mostrada no dashboard dela do dia 25 ao fim do mês. Totalmente separado
        dos pedidos dela.
      </p>

      <button
        type="button"
        onClick={handleToggle}
        disabled={toggling}
        className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
          status.mensalidadeReminderEnabled
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-neutral-200 bg-neutral-50 text-neutral-500"
        }`}
      >
        Banner de cobrança {status.mensalidadeReminderEnabled ? "ligado" : "desligado"}
        <span className="text-xs underline">{status.mensalidadeReminderEnabled ? "Desligar" : "Ligar"}</span>
      </button>

      <p className="text-xs text-neutral-400">
        {status.mensalidadePagaEm
          ? `Mês confirmado como pago: ${status.mensalidadePagaEm}`
          : "Nenhum mês confirmado ainda."}
      </p>

      <Button type="button" variant="outline" loading={confirming} onClick={handleConfirmPayment}>
        Confirmar mensalidade paga esse mês
      </Button>

      {message && (
        <p className={`flex items-center gap-1.5 text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>
          {message.ok && <Check className="size-4" />}
          {message.text}
        </p>
      )}
    </div>
  );
}

function SharpifySection({
  password,
  status,
  onStatusChange,
}: {
  password: string;
  status: DevStatus;
  onStatusChange: (s: DevStatus) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dev/sharpify-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, clientId, clientSecret }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ ok: false, text: data?.error ?? "Falha ao salvar." });
        return;
      }
      onStatusChange({ ...status, sharpifyConfigured: true });
      setClientId("");
      setClientSecret("");
      setMessage({ ok: true, text: "Credenciais salvas — pedidos Pix novos já usam a Sharpify." });
    } catch {
      setMessage({ ok: false, text: "Falha de conexão." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5"
    >
      <div className="flex items-center gap-2">
        <Package className="size-4 text-blue-600" />
        <p className="font-semibold text-neutral-900">Pagamento dos pedidos (Sharpify)</p>
      </div>
      <p className="text-sm text-neutral-500">
        Credenciais do gateway de pagamento usado pra gerar o Pix real dos pedidos dos clientes,
        com confirmação automática. Totalmente separado da mensalidade acima.
      </p>

      <p
        className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${
          status.sharpifyConfigured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {status.sharpifyConfigured ? "Configurada" : "Não configurada — Pix cai no fallback (chave simples)"}
      </p>

      <Input
        label="Client ID"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        placeholder="SHARPIFY_CLIENT_ID_..."
        autoComplete="off"
      />
      <Input
        label="Client Secret"
        type="password"
        value={clientSecret}
        onChange={(e) => setClientSecret(e.target.value)}
        placeholder="SHARPIFY_CLIENT_SECRET_..."
        autoComplete="off"
      />

      {message && (
        <p className={`flex items-center gap-1.5 text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>
          {message.ok && <Check className="size-4" />}
          {message.text}
        </p>
      )}

      <Button type="submit" loading={saving} disabled={!clientId || !clientSecret}>
        Salvar credenciais
      </Button>
    </form>
  );
}
