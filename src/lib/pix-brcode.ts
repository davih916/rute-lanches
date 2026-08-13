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

export interface PixBRCodeInput {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amountCents: number;
  /** Identificador do pedido — vira o txid, usado só de referência (sem consulta automática de status). */
  txid: string;
}

/** Monta o payload EMV completo (com CRC16 no final) pronto para virar QR Code. */
export function generatePixBRCode({ pixKey, merchantName, merchantCity, amountCents, txid }: PixBRCodeInput): string {
  const amount = (amountCents / 100).toFixed(2);
  const sanitizedTxid = txid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";

  const merchantAccountInfo = [tlv("00", "br.gov.bcb.pix"), tlv("01", pixKey.trim())].join("");

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
