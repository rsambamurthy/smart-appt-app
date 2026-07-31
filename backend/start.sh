#!/bin/sh
set -e
echo "=== Running database migrations ==="
./node_modules/.bin/prisma migrate deploy
echo "=== Migrations done. Starting server ==="
exec node dist/index.js
