#!/bin/sh
echo "=== DATABASE_URL check ==="
echo "DATABASE_URL prefix: $(echo $DATABASE_URL | cut -c1-30)..."

echo "=== Running database migrations ==="
./node_modules/.bin/prisma migrate deploy
MIGRATION_EXIT=$?

if [ $MIGRATION_EXIT -ne 0 ]; then
  echo "!!! Migration failed with exit code $MIGRATION_EXIT — starting server anyway"
else
  echo "=== Migrations done ==="
fi

echo "=== Starting server ==="
exec node dist/index.js
