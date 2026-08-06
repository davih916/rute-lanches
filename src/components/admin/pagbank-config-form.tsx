"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PAGBANK_AMBIENTES, PAGBANK_AMBIENTE_LABELS, type PagBankAmbiente } from "@/lib/constants";
import type { PagBankConfigForAdmin } from "@/lib/services/pagbank-config-service";

interface PagBankConfigFormProps {
  config: PagBankConfigForAdmin;
}

export function PagBankConfigForm({ config }: PagBankConfigFormProps) {
  const [ambiente, setAmbiente] = useState<PagBankAmbiente>(config.ambiente as PagBankAmbiente);
  const [clientId, setClientId] = useState(config.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [token, setToken] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testadoEm, setTestadoEm] = useState(config.testadoEm);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/pagbank/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ambiente, clientId, clientSecret, token }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Erro ao salvar.");
        setSubmitting(false);
        return;
      }

      setClientSecret("");
      setToken("");
      toast.success("Configurações do PagBank salvas.");
      setSubmitting(false);
    } catch {
      toast.error("Falha de conexão.");
      setSubmitting(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/pagbank/testar-conexao", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao testar conexão.");
      } else {
        toast.success("Conexão com o PagBank funcionando.");
        setTestadoEm(new Date());
      }
    } catch {
      toast.error("Falha de conexão.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <p className="font-semibold text-neutral-900">PagBank (Pix)</p>
        <Select
          name="ambiente"
          label="Ambiente"
          value={ambiente}
          onChange={(e) => setAmbiente(e.target.value as PagBankAmbiente)}
        >
          {PAGBANK_AMBIENTES.map((a) => (
            <option key={a} value={a}>
              {PAGBANK_AMBIENTE_LABELS[a]}
            </option>
          ))}
        </Select>

        <Input
          name="clientId"
          label="Client ID"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        <Input
          name="clientSecret"
          label={
            config.hasClientSecret
              ? "Client Secret (preenchido — deixe em branco para manter)"
              : "Client Secret"
          }
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
        />
        <Input
          name="token"
          label={config.hasToken ? "Token (preenchido — deixe em branco para manter)" : "Token"}
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>


      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" loading={submitting}>
          Salvar configurações
        </Button>
        <Button type="button" variant="outline" size="lg" loading={testing} onClick={handleTestConnection}>
          Testar conexão
        </Button>
      </div>
      {testadoEm && (
        <p className="text-xs text-neutral-400">
          Última conexão testada em {new Date(testadoEm).toLocaleString("pt-BR")}
        </p>
      )}
    </form>
  );
}
