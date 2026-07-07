import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createDeliveryZoneSchema } from "@/lib/validations/delivery-zone";
import { createDeliveryZone, DeliveryZoneServiceError } from "@/lib/services/delivery-zone-service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createDeliveryZoneSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const zone = await createDeliveryZone(parsed.data);
    return NextResponse.json({ zone }, { status: 201 });
  } catch (error) {
    if (error instanceof DeliveryZoneServiceError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
