import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateDeliveryZoneSchema } from "@/lib/validations/delivery-zone";
import {
  updateDeliveryZone,
  deleteDeliveryZone,
  DeliveryZoneServiceError,
} from "@/lib/services/delivery-zone-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateDeliveryZoneSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const zone = await updateDeliveryZone(id, parsed.data);
    return NextResponse.json({ zone });
  } catch (error) {
    if (error instanceof DeliveryZoneServiceError) {
      const status = error.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: error.message }, { status });
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
    await deleteDeliveryZone(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DeliveryZoneServiceError) {
      const status = error.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
