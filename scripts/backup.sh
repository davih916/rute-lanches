#!/usr/bin/env bash
set -euo pipefail

# Backup do banco de dados PostgreSQL, compactado, salvo em backups/.
# Rode a partir da raiz do projeto: ./scripts/backup.sh
# Dica: agende no cron pra rodar diariamente, ex:
#   0 3 * * * cd /caminho/do/projeto && ./scripts/backup.sh >> logs/backup.log 2>&1

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Erro: .env não encontrado." >&2
  exit 1
fi

set -a
source .env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Erro: DATABASE_URL não definida no .env" >&2
  exit 1
fi

mkdir -p backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="backups/rute-lanches_${TIMESTAMP}.sql.gz"

echo "==> Gerando backup do PostgreSQL..."
pg_dump "$DATABASE_URL" | gzip > "$FILENAME"
echo "==> Backup salvo em $FILENAME ($(du -h "$FILENAME" | cut -f1))"

# Mantém só os 14 backups mais recentes — ajuste conforme a rotina real de retenção.
KEEP=14
COUNT=$(ls -1 backups/*.sql.gz 2>/dev/null | wc -l)
if [ "$COUNT" -gt "$KEEP" ]; then
  ls -1t backups/*.sql.gz | tail -n +"$((KEEP + 1))" | xargs rm --
  echo "==> Backups antigos (além dos $KEEP mais recentes) removidos."
fi
