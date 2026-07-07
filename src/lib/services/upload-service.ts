import "server-only";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "products");
const PUBLIC_PATH_PREFIX = "/uploads/products/";

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class UploadServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadServiceError";
  }
}

/** Salva a foto enviada em disco (`public/uploads/products/`) e retorna a URL pública. */
export async function saveProductImage(file: File): Promise<string> {
  const ext = ALLOWED_MIME_TO_EXT[file.type];
  if (!ext) {
    throw new UploadServiceError("Formato de imagem não suportado. Use JPG, PNG ou WEBP.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `${PUBLIC_PATH_PREFIX}${filename}`;
}

/** Remove uma foto enviada anteriormente. Best-effort — nunca lança erro (arquivo pode já não existir). */
export async function deleteProductImageIfLocal(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith(PUBLIC_PATH_PREFIX)) return;

  const filename = url.slice(PUBLIC_PATH_PREFIX.length);
  // Nunca deve conter separador de caminho — evita apagar arquivo fora da pasta de uploads.
  if (filename.includes("/") || filename.includes("\\")) return;

  try {
    await unlink(path.join(UPLOAD_DIR, filename));
  } catch {
    // arquivo já removido ou inacessível — ignora
  }
}
