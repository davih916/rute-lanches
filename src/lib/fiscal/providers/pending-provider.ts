import type { FiscalIssueInput, FiscalIssueResult, FiscalProvider } from "../fiscal-provider.interface";

/**
 * Provider padrão enquanto a integração fiscal não está totalmente configurada
 * (sem provider escolhido, sem credenciais ou sem certificado enviado).
 * NÃO emite nota fiscal nenhuma — apenas sinaliza o motivo exato pelo qual a
 * emissão não pode prosseguir, para orientar o admin em Configurações → Fiscal.
 */
export class PendingProvider implements FiscalProvider {
  readonly name = "pending";

  constructor(
    private readonly reason: string = "Nenhuma integração fiscal configurada. Configure a empresa, o certificado digital e as credenciais em Configurações → Fiscal."
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async issue(_input: FiscalIssueInput): Promise<FiscalIssueResult> {
    return {
      status: "erro",
      errorMessage: this.reason,
    };
  }
}
