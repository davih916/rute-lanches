import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { productInputSchema } from "@/lib/validations/product";
import { updateProduct, deleteProduct, ProductServiceError } from "@/lib/services/product-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const product = await updateProduct(id, parsed.data);
    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof ProductServiceError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteProduct(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProductServiceError) {
      const status = error.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
