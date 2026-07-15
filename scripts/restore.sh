#!/usr/bin/env bash
set -euo pipefail

# Restaura um backup do PostgreSQL gerado por scripts/backup.sh.
# Uso: ./scripts/restore.sh backups/rute-lanches_20260101_030000.sql.gz
#
# ATENÇÃO: isso SOBRESCREVE todo o conteúdo atual do banco de dados.

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

FILE="${1:-}"
if [ -z "$FILE" ]; then
  echo "Uso: scripts/restore.sh <arquivo_de_backup.sql.gz>" >&2
  echo "" >&2
  echo "Backups disponíveis:" >&2
  ls -1t backups/*.sql.gz 2>/dev/null >&2 || echo "(nenhum backup encontrado em backups/)" >&2
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "Erro: arquivo '$FILE' não encontrado." >&2
  exit 1
fi

echo "ATENÇÃO: isso vai SOBRESCREVER o banco de dados atual com o conteúdo de:"
echo "  $FILE"
read -r -p "Digite 'sim' para confirmar: " CONFIRM
if [ "$CONFIRM" != "sim" ]; then
  echo "Cancelado."
  exit 1
fi

echo "==> Restaurando $FILE..."
gunzip -c "$FILE" | psql "$DATABASE_URL"
echo "==> Restauração concluída."
