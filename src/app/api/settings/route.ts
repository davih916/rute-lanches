import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateSettingsSchema } from "@/lib/validations/settings";
import { updateSettings } from "@/lib/services/settings-service";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const settings = await updateSettings({
    ...parsed.data,
    whatsapp: parsed.data.whatsapp || undefined,
    address: parsed.data.address || undefined,
    openingHours: JSON.stringify(parsed.data.openingHours),
    acceptedPaymentMethods: JSON.stringify(parsed.data.acceptedPaymentMethods),
  });

  return NextResponse.json({ settings });
}
