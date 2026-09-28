#!/usr/bin/env bash
# Backup lógico do PostgreSQL (formato custom do pg_dump) com retenção local.
# Uso: ./scripts/backup.sh [dias_de_retencao]   (padrão: 14)
# Copie a pasta backups/ para fora da VPS (ex.: rclone, armazenamento de objetos) — ver docs/implantacao.md.
set -euo pipefail
cd "$(dirname "$0")/.."
RETENTION_DAYS="${1:-14}"
set -a; . ./.env; set +a
mkdir -p backups
FILE="backups/fpnexus-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-fpnexus}" -d "${POSTGRES_DB:-fpnexus}" -Fc > "$FILE"
[ -s "$FILE" ] || { echo "Backup vazio: $FILE" >&2; exit 1; }
sha256sum "$FILE" > "$FILE.sha256"
find backups -name 'fpnexus-*.dump*' -mtime +"$RETENTION_DAYS" -delete
echo "Backup criado: $FILE ($(du -h "$FILE" | cut -f1))"
