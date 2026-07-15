#!/usr/bin/env bash
set -euo pipefail

# Atualiza uma instalação já existente do Rute Lanches (deploy de uma nova
# versão). Rode a partir da raiz do projeto: ./scripts/update.sh

cd "$(dirname "$0")/.."

echo "==> Atualizando código (git pull)..."
git pull

echo "==> Instalando dependências..."
npm install

echo "==> Aplicando migrations pendentes..."
npx prisma generate
npx prisma migrate deploy

echo "==> Build de produção..."
npx next build

echo "==> Reiniciando aplicação (PM2)..."
pm2 restart ecosystem.config.js --env production

echo ""
echo "==> Atualização concluída."
