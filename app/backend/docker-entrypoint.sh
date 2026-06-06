#!/bin/sh
set -e

echo "Aplicando migrations..."
node /app/app/backend/dist/database/migrate.js

echo "Rodando seed..."
node /app/app/backend/dist/database/seed.js

echo "Iniciando backend..."
exec node /app/app/backend/dist/main.js
