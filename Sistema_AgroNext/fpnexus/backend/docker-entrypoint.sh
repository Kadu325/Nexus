#!/bin/sh
# Inicialização da API: migrações -> provisionamento idempotente do admin -> servidor.
set -e
echo "[fpnexus] aplicando migrações do banco..."
./node_modules/.bin/prisma migrate deploy
echo "[fpnexus] provisionamento inicial (idempotente)..."
node dist/provision.js
echo "[fpnexus] iniciando API..."
exec node dist/main.js
