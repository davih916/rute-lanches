import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFiscalProvider } from "@/lib/fiscal";
import { NuvemFiscalProvider } from "@/lib/fiscal/providers/nuvem-fiscal-provider";

/** Proxy autenticado para baixar o DANFCE — a Nuvem Fiscal exige Bearer token, que o navegador não tem. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const fiscal = await prisma.fiscal.findUnique({ where: { orderId: id } });

  if (!fiscal || !fiscal.externalId || fiscal.status !== "emitida") {
    return NextResponse.json({ error: "Nenhuma NFC-e emitida para este pedido." }, { status: 404 });
  }

  const provider = await getFiscalProvider();
  if (!(provider instanceof NuvemFiscalProvider)) {
    return NextResponse.json({ error: "Provider fiscal não suporta download de PDF." }, { status: 400 });
  }

  const pdf = await provider.fetchPdf(fiscal.externalId);
  if (!pdf) {
    return NextResponse.json({ error: "Não foi possível baixar o DANFCE." }, { status: 502 });
  }

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="nfce-${fiscal.numero ?? id}.pdf"`,
    },
  });
}
