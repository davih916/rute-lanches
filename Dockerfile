# syntax=docker/dockerfile:1

# Build feito inteiro dentro do container (mesma imagem base em todos os
# estágios) — garante que os binários nativos do Prisma sejam gerados pro SO
# certo, sem precisar mexer em binaryTargets no schema.

FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# --- deps: instala dependências (cache separado do código-fonte) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: gera o Prisma Client e o build de produção do Next.js ---
# Não roda `prisma migrate deploy` aqui — o banco não é alcançável durante o
# build da imagem. As migrations rodam no start do container (ver CMD).
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder só pra `prisma generate`/`next build` não falharem por falta de
# DATABASE_URL — a URL real de verdade vem do ambiente em runtime.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate
RUN npx next build

# --- runner: imagem final, só com o necessário pra rodar ---
FROM base AS runner
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# O standalone do Next já traz um node_modules enxuto só com o que o SERVIDOR
# precisa em runtime — mas `npx prisma migrate deploy` no CMD abaixo roda o
# CLI do Prisma, que tem suas próprias dependências (dotenv, c12, effect...)
# não incluídas ali. Mais simples e confiável copiar o node_modules completo
# do builder (perde um pouco do ganho de tamanho do standalone, mas evita
# quebrar o `migrate deploy` por dependência faltando).
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p /app/certs /app/logs

# Roda como root de propósito (sem USER dedicado): certs/ e public/uploads/
# são bind mounts do host (docker-compose.yml) e um usuário não-root dentro
# do container quase nunca bate com o dono/UID desses arquivos no host — isso
# bloquearia a leitura do certificado A1 e a escrita de fotos de produto
# enviadas pelo admin. Mesmo modelo de confiança do deploy via PM2 (processo
# já roda com o usuário que o iniciou no host, sem usuário dedicado).
EXPOSE 3000
ENV PORT=3000

# Aplica migrations pendentes (idempotente) e só então sobe o servidor.
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
