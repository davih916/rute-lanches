import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createCategorySchema } from "@/lib/validations/category";
import { createCategory } from "@/lib/services/category-service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const category = await createCategory(parsed.data);

  return NextResponse.json({ category }, { status: 201 });
}
