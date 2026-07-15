#!/usr/bin/env bash
set -euo pipefail

# Instalação inicial do Rute Lanches num VPS que já tenha Node.js 20+,
# PostgreSQL e PM2 instalados (ver HANDOFF.md para o guia completo passo a
# passo). Rode a partir da raiz do projeto: ./scripts/install.sh

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Erro: crie o .env (copie de .env.production.example e preencha) antes de continuar." >&2
  exit 1
fi

echo "==> Instalando dependências..."
npm ci

echo "==> Gerando Prisma Client..."
npx prisma generate

echo "==> Aplicando migrations..."
npx prisma migrate deploy

echo "==> Rodando seed (dados iniciais — cardápio, admin, configurações)..."
npx tsx prisma/seed.ts

echo "==> Build de produção..."
npx next build

mkdir -p logs certs backups public/uploads

echo "==> Iniciando com PM2..."
pm2 start ecosystem.config.js --env production
pm2 save

echo ""
echo "==> Instalação concluída."
echo "    Para o PM2 reiniciar a aplicação sozinho depois de um reboot do servidor, rode:"
echo "    pm2 startup"
echo "    (e execute o comando que ele imprimir)"
