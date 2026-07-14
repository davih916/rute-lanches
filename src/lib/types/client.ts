export interface ClientProfile {
  empresaNome: string;
  razaoSocial: string;
  cnpj: string;
  regimeTributario: string;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  email: string;
  telefone: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  codigoIbge: string | null;
  status: string;
  plano: string;
  statusAssinatura: string;
  proximoVencimento: string | null;
}
