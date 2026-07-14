"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  FISCAL_PROVIDERS,
  FISCAL_PROVIDER_LABELS,
  FISCAL_AMBIENTES,
  FISCAL_AMBIENTE_LABELS,
  REGIMES_TRIBUTARIOS,
  REGIME_TRIBUTARIO_LABELS,
  type FiscalProviderName,
  type FiscalAmbiente,
  type RegimeTributario,
} from "@/lib/constants";
import type { FiscalConfigForAdmin } from "@/lib/services/fiscal-config-service";

interface FiscalConfigFormProps {
  config: FiscalConfigForAdmin;
}

export function FiscalConfigForm({ config }: FiscalConfigFormProps) {
  const [provider, setProvider] = useState<FiscalProviderName>(config.provider as FiscalProviderName);
  const [ambiente, setAmbiente] = useState<FiscalAmbiente>(config.ambiente as FiscalAmbiente);
  const [clientId, setClientId] = useState(config.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [cnpj, setCnpj] = useState(config.cnpj ?? "");
  const [razaoSocial, setRazaoSocial] = useState(config.razaoSocial ?? "");
  const [nomeFantasia, setNomeFantasia] = useState(config.nomeFantasia ?? "");
  const [inscricaoEstadual, setInscricaoEstadual] = useState(config.inscricaoEstadual ?? "");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState(config.inscricaoMunicipal ?? "");
  const [regimeTributario, setRegimeTributario] = useState<RegimeTributario>(
    (config.regimeTributario as RegimeTributario) ?? "simples_nacional"
  );
  const [email, setEmail] = useState(config.email ?? "");
  const [telefone, setTelefone] = useState(config.telefone ?? "");
  const [cnaePrincipal, setCnaePrincipal] = useState(config.cnaePrincipal ?? "");
  const [cnaeDescricao, setCnaeDescricao] = useState(config.cnaeDescricao ?? "");
  const [logradouro, setLogradouro] = useState(config.logradouro ?? "");
  const [numero, setNumero] = useState(config.numero ?? "");
  const [complemento, setComplemento] = useState(config.complemento ?? "");
  const [bairro, setBairro] = useState(config.bairro ?? "");
  const [municipioCodigo, setMunicipioCodigo] = useState(config.municipioCodigo ?? "");
  const [municipioNome, setMunicipioNome] = useState(config.municipioNome ?? "");
  const [uf, setUf] = useState(config.uf ?? "");
  const [cep, setCep] = useState(config.cep ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [registering, setRegistering] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/fiscal/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          ambiente,
          clientId,
          clientSecret,
          cnpj,
          razaoSocial,
          nomeFantasia,
          inscricaoEstadual,
          inscricaoMunicipal,
          regimeTributario,
          email,
          telefone,
          cnaePrincipal,
          cnaeDescricao,
          logradouro,
          numero,
          complemento,
          bairro,
          municipioCodigo,
          municipioNome,
          uf,
          cep,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Erro ao salvar." });
        setSubmitting(false);
        return;
      }

      setClientSecret("");
      setMessage({ type: "success", text: "Configurações fiscais salvas." });
      setSubmitting(false);
    } catch {
      setMessage({ type: "error", text: "Falha de conexão." });
      setSubmitting(false);
    }
  }

  async function handleRegisterCompany() {
    setRegistering(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/fiscal/registrar-empresa", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Erro ao cadastrar empresa." });
      } else {
        setMessage({ type: "success", text: "Empresa cadastrada no provider fiscal." });
      }
    } catch {
      setMessage({ type: "error", text: "Falha de conexão." });
    } finally {
      setRegistering(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <p className="font-semibold text-neutral-900">Provider e ambiente</p>
        <Select
          name="provider"
          label="Provider fiscal"
          value={provider}
          onChange={(e) => setProvider(e.target.value as FiscalProviderName)}
        >
          {FISCAL_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {FISCAL_PROVIDER_LABELS[p]}
            </option>
          ))}
        </Select>

        <Select
          name="ambiente"
          label="Ambiente"
          value={ambiente}
          onChange={(e) => setAmbiente(e.target.value as FiscalAmbiente)}
        >
          {FISCAL_AMBIENTES.map((a) => (
            <option key={a} value={a}>
              {FISCAL_AMBIENTE_LABELS[a]}
            </option>
          ))}
        </Select>
        {ambiente === "producao" && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            Atenção: em produção, toda NFC-e emitida tem valor fiscal real perante a SEFAZ. Teste
            antes em homologação.
          </p>
        )}

        {provider === "nuvem_fiscal" && (
          <>
            <Input
              name="clientId"
              label="Client ID (Nuvem Fiscal)"
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
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <p className="font-semibold text-neutral-900">Dados da empresa</p>
        <div className="grid grid-cols-2 gap-3">
          <Input name="cnpj" label="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          <Select
            name="regimeTributario"
            label="Regime tributário"
            value={regimeTributario}
            onChange={(e) => setRegimeTributario(e.target.value as RegimeTributario)}
          >
            {REGIMES_TRIBUTARIOS.map((r) => (
              <option key={r} value={r}>
                {REGIME_TRIBUTARIO_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
        <Input
          name="razaoSocial"
          label="Razão social"
          value={razaoSocial}
          onChange={(e) => setRazaoSocial(e.target.value)}
        />
        <Input
          name="nomeFantasia"
          label="Nome fantasia"
          value={nomeFantasia}
          onChange={(e) => setNomeFantasia(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            name="inscricaoEstadual"
            label="Inscrição estadual"
            value={inscricaoEstadual}
            onChange={(e) => setInscricaoEstadual(e.target.value)}
          />
          <Input
            name="inscricaoMunicipal"
            label="Inscrição municipal"
            value={inscricaoMunicipal}
            onChange={(e) => setInscricaoMunicipal(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            name="email"
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            name="telefone"
            label="Telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input
            name="cnaePrincipal"
            label="CNAE principal"
            className="col-span-1"
            value={cnaePrincipal}
            onChange={(e) => setCnaePrincipal(e.target.value)}
          />
          <Input
            name="cnaeDescricao"
            label="Descrição da atividade"
            className="col-span-2"
            value={cnaeDescricao}
            onChange={(e) => setCnaeDescricao(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <p className="font-semibold text-neutral-900">Endereço da empresa</p>
        <div className="grid grid-cols-3 gap-3">
          <Input
            name="logradouro"
            label="Logradouro"
            className="col-span-2"
            value={logradouro}
            onChange={(e) => setLogradouro(e.target.value)}
          />
          <Input name="numero" label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} />
        </div>
        <Input
          name="complemento"
          label="Complemento"
          value={complemento}
          onChange={(e) => setComplemento(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input name="bairro" label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
          <Input
            name="municipioNome"
            label="Município"
            value={municipioNome}
            onChange={(e) => setMunicipioNome(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input
            name="municipioCodigo"
            label="Código IBGE"
            value={municipioCodigo}
            onChange={(e) => setMunicipioCodigo(e.target.value)}
          />
          <Input
            name="uf"
            label="UF"
            maxLength={2}
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase())}
          />
          <Input name="cep" label="CEP" value={cep} onChange={(e) => setCep(e.target.value)} />
        </div>
      </div>

      {message && (
        <p
          className={`text-sm font-medium ${
            message.type === "success" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" loading={submitting}>
          Salvar configurações
        </Button>
        {provider === "nuvem_fiscal" && (
          <Button type="button" variant="outline" size="lg" loading={registering} onClick={handleRegisterCompany}>
            {config.empresaRegistradaEm ? "Atualizar cadastro da empresa" : "Cadastrar empresa no provider"}
          </Button>
        )}
      </div>
      {config.empresaRegistradaEm && (
        <p className="text-xs text-neutral-400">
          Empresa cadastrada em {new Date(config.empresaRegistradaEm).toLocaleString("pt-BR")}
        </p>
      )}
    </form>
  );
}
