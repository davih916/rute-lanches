import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.FISCAL_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "FISCAL_ENCRYPTION_KEY ausente ou muito curta. Defina uma string aleatória de pelo menos 32 caracteres no .env"
    );
  }
  // Deriva uma chave de 32 bytes a partir do segredo — não depende do segredo
  // já vir no tamanho exato.
  return scryptSync(secret, "rute-lanches-fiscal", 32);
}

/** Criptografa um segredo (ex: client_secret da API fiscal) para guardar no banco. */
export function encryptSecret(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/** Reverte encryptSecret. Lança erro se o valor estiver corrompido ou a chave tiver mudado. */
export function decryptSecret(cipherText: string): string {
  const raw = Buffer.from(cipherText, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = raw.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
