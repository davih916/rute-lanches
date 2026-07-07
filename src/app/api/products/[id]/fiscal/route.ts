import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProductFiscalSchema } from "@/lib/validations/fiscal";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateProductFiscalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados fiscais inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const product = await prisma.product.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ product });
}
