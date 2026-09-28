#!/usr/bin/env bash
# Teste de restauração: restaura um backup num banco TEMPORÁRIO (fpnexus_restore_test),
# compara contagens com a base de produção e remove o banco temporário. Não altera a produção.
# Uso: ./scripts/restore-test.sh backups/fpnexus-AAAAMMDD-HHMMSS.dump
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:?Informe o arquivo .dump}"
set -a; . ./.env; set +a
U="${POSTGRES_USER:-fpnexus}"; DB="${POSTGRES_DB:-fpnexus}"; T="fpnexus_restore_test"
[ -f "$FILE.sha256" ] && sha256sum -c "$FILE.sha256"
docker compose exec -T db dropdb -U "$U" --if-exists "$T"
docker compose exec -T db createdb -U "$U" "$T"
docker compose exec -T db pg_restore -U "$U" -d "$T" --no-owner < "$FILE"
Q='SELECT (SELECT count(*) FROM "User") AS usuarios, (SELECT count(*) FROM "Project") AS projetos, (SELECT count(*) FROM "Task") AS tarefas, (SELECT count(*) FROM "AuditLog") AS auditoria;'
echo "Restaurado:"; docker compose exec -T db psql -U "$U" -d "$T" -c "$Q"
echo "Produção (pode ter mudado desde o backup):"; docker compose exec -T db psql -U "$U" -d "$DB" -c "$Q"
docker compose exec -T db dropdb -U "$U" "$T"
echo "Teste de restauração concluído; banco temporário removido."
