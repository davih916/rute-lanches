import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { productInputSchema } from "@/lib/validations/product";
import { createProduct, ProductServiceError } from "@/lib/services/product-service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const product = await createProduct(parsed.data);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductServiceError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
