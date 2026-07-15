import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import packageJson from "../../../../package.json";

/**
 * Health check público (sem sessão) — usado pelo healthcheck do Docker,
 * monitoramento externo (uptime) e verificação manual pós-deploy.
 */
export async function GET() {
  const start = Date.now();
  let databaseConnected = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
  } catch (err) {
    // Não devolve err.message no corpo público — pode conter host/porta/credenciais
    // da conexão. Fica só no log do servidor.
    console.error("[GET /api/health] Falha ao conectar no banco:", err);
  }

  const ok = databaseConnected;

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      version: packageJson.version,
      environment: process.env.NODE_ENV ?? "development",
      uptimeSeconds: Math.round(process.uptime()),
      database: {
        connected: databaseConnected,
        latencyMs: Date.now() - start,
      },
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
