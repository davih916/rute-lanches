import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build enxuto para produção (Docker) — copia só o necessário pra rodar,
  // sem precisar de node_modules completo na imagem final. Não afeta o
  // deploy via PM2 (esse continua usando `next start` normalmente).
  output: "standalone",
};

export default nextConfig;
