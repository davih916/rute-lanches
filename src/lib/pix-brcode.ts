/**
 * Gera o "Pix Copia e Cola" (BR Code / EMV QR Code estático do Banco Central)
 * a partir da chave Pix da loja — sem depender de nenhuma API externa
 * (PagBank ou outra). Qualquer app de banco lê esse texto e monta a cobrança
 * com o valor certo.
 */

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

/** Remove acentos e caracteres fora do alfabeto aceito pelo padrão (letras/números/espaço). */
function sanitize(text: string, maxLength: number): string {
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .toUpperCase();
  return normalized.slice(0, maxLength) || "LOJA";
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export const PIX_KEY_TYPES = ["cpf_cnpj", "email", "telefone", "aleatoria"] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf_cnpj: "CPF ou CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
};

/**
 * Normaliza a chave pro formato exato que o Pix exige — digitar com
 * espaço/traço/parênteses (como alguém digitaria um telefone normalmente,
 * ex: "15 99610-9624") gera uma chave inválida que o banco do cliente
 * rejeita na hora de pagar ("chave Pix inválida"). Cada tipo tem um formato
 * fixo definido pelo Banco Central, sem ambiguidade — por isso pede o tipo
 * explicitamente em vez de tentar adivinhar.
 */
export function normalizePixKey(rawKey: string, keyType: PixKeyType): string {
  const trimmed = rawKey.trim();
  switch (keyType) {
    case "email":
    case "aleatoria":
      // Chave aleatória já vem no formato certo (UUID com hífens) — não mexe.
      return trimmed;
    case "cpf_cnpj":
      return trimmed.replace(/\D/g, "");
    case "telefone": {
      const digits = trimmed.replace(/\D/g, "");
      // Já digitado com código do país (13 dígitos: 55 + DDD + 9 dígitos)?
      const local = digits.length > 11 ? digits.slice(-11) : digits;
      return `+55${local}`;
    }
  }
}

export interface PixBRCodeInput {
  pixKey: string;
  pixKeyType: PixKeyType;
  merchantName: string;
  merchantCity: string;
  amountCents: number;
  /** Identificador do pedido — vira o txid, usado só de referência (sem consulta automática de status). */
  txid: string;
}

/** Monta o payload EMV completo (com CRC16 no final) pronto para virar QR Code. */
export function generatePixBRCode({
  pixKey,
  pixKeyType,
  merchantName,
  merchantCity,
  amountCents,
  txid,
}: PixBRCodeInput): string {
  const amount = (amountCents / 100).toFixed(2);
  const sanitizedTxid = txid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";

  const merchantAccountInfo = [
    tlv("00", "br.gov.bcb.pix"),
    tlv("01", normalizePixKey(pixKey, pixKeyType)),
  ].join("");

  const additionalData = tlv("05", sanitizedTxid);

  const payloadWithoutCrc =
    tlv("00", "01") + // Payload Format Indicator
    tlv("01", "12") + // Point of Initiation Method: 12 = dinâmico (valor definido)
    tlv("26", merchantAccountInfo) +
    tlv("52", "0000") + // Merchant Category Code
    tlv("53", "986") + // Moeda: BRL
    tlv("54", amount) +
    tlv("58", "BR") +
    tlv("59", sanitize(merchantName, 25)) +
    tlv("60", sanitize(merchantCity, 15)) +
    tlv("62", additionalData) +
    "6304";

  return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`;
}
