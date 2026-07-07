import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveProductImage, UploadServiceError } from "@/lib/services/upload-service";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Imagem muito grande (máx. 5MB)." }, { status: 400 });
  }

  try {
    const url = await saveProductImage(file);
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof UploadServiceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Erro ao enviar imagem do produto:", error);
    return NextResponse.json({ error: "Erro ao enviar imagem." }, { status: 500 });
  }
}
