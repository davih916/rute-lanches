"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FiscalConfigForAdmin } from "@/lib/services/fiscal-config-service";

export function FiscalCertificateCard({ config }: { config: FiscalConfigForAdmin }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setMessage({ type: "error", text: "Selecione o arquivo do certificado (.pfx)." });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("certificado", file);
      formData.append("password", password);

      const res = await fetch("/api/admin/fiscal/certificado", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Erro ao enviar certificado." });
        setSubmitting(false);
        return;
      }

      setPassword("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage({ type: "success", text: "Certificado enviado com sucesso." });
      setSubmitting(false);
    } catch {
      setMessage({ type: "error", text: "Falha de conexão." });
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-2xl flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5"
    >
      <p className="font-semibold text-neutral-900">Certificado digital A1</p>
      <p className="text-sm text-neutral-500">
        Enviado direto para o provider fiscal — o arquivo e a senha não ficam guardados neste
        sistema.
      </p>

      {config.certificadoEnviadoEm ? (
        <p className="text-sm font-medium text-emerald-600">
          Certificado enviado em {new Date(config.certificadoEnviadoEm).toLocaleString("pt-BR")}
          {config.certificadoValidoAte &&
            ` — válido até ${new Date(config.certificadoValidoAte).toLocaleDateString("pt-BR")}`}
        </p>
      ) : (
        <p className="text-sm font-medium text-amber-600">Nenhum certificado enviado ainda.</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pfx,.p12"
        name="certificado"
        className="text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium"
      />
      <Input
        name="password"
        label="Senha do certificado"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {message && (
        <p
          className={`text-sm font-medium ${
            message.type === "success" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <Button type="submit" size="lg" loading={submitting} className="w-fit">
        Enviar certificado
      </Button>
    </form>
  );
}
