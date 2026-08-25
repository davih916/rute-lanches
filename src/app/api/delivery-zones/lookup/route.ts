import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findZoneForCep } from "@/lib/services/delivery-zone-service";
import { sanitizeCep, isValidCep } from "@/lib/cep";
import { checkRequestRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Consulta a taxa de entrega pelo CEP — usado tanto pelo checkout público
 * quanto pela Venda no Balcão (mesmo CheckoutForm, ver §7 do HANDOFF). Sem
 * sessão de admin, só considera zonas `visibleToCustomers=true` — zonas "só
 * admin" (endereço específico com taxa combinada à parte) só aparecem pra
 * quem está logado no painel.
 */
export async function GET(request: Request) {
  const rateLimit = checkRequestRateLimit(`${getClientIp(request)}:cep-lookup`, 30, 60_000);
  if (rateLimit.blocked) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const cep = sanitizeCep(searchParams.get("cep") ?? "");

  if (!isValidCep(cep)) {
    return NextResponse.json({ error: "CEP inválido." }, { status: 400 });
  }

  const session = await getSession();
  const zone = await findZoneForCep(cep);
  if (!zone || (!zone.visibleToCustomers && !session)) {
    return NextResponse.json({ error: "Não entregamos nesse CEP." }, { status: 404 });
  }

  return NextResponse.json({ neighborhood: zone.neighborhood, feeCents: zone.feeCents });
}
