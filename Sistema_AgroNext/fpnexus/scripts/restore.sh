#!/usr/bin/env bash
# Restauração EM PRODUÇÃO (substitui os dados atuais). Faz um backup de segurança antes.
# Uso: ./scripts/restore.sh backups/fpnexus-AAAAMMDD-HHMMSS.dump
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:?Informe o arquivo .dump}"
set -a; . ./.env; set +a
U="${POSTGRES_USER:-fpnexus}"; DB="${POSTGRES_DB:-fpnexus}"
read -r -p "Isto substitui os dados de produção por $FILE. Digite RESTAURAR para continuar: " OK
[ "$OK" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }
./scripts/backup.sh
docker compose stop backend frontend
docker compose exec -T db pg_restore -U "$U" -d "$DB" --clean --if-exists --no-owner < "$FILE"
docker compose start backend frontend
echo "Restauração concluída. Verifique /api/health e o login."
