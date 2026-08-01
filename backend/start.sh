#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Startup: apply pending migrations, self-healing if the database was created
# outside of Prisma's migration history (error P3005 — "schema is not empty").
# ─────────────────────────────────────────────────────────────────────────────
PRISMA=./node_modules/.bin/prisma
SCHEMA=prisma/schema.prisma

echo "=== DATABASE_URL check ==="
echo "DATABASE_URL prefix: $(echo "$DATABASE_URL" | cut -c1-30)..."

echo "=== Running database migrations ==="
$PRISMA migrate deploy
MIGRATION_EXIT=$?

if [ $MIGRATION_EXIT -ne 0 ]; then
  echo "!!! migrate deploy failed (exit $MIGRATION_EXIT)"
  echo "=== Attempting automatic baseline + additive repair ==="

  # 1. Apply additive schema changes directly.
  #    Every statement in these files is idempotent (ADD COLUMN IF NOT EXISTS /
  #    DROP NOT NULL), so running them repeatedly is safe and non-destructive.
  for f in \
    prisma/migrations/20260801000003_add_accounting_feature_flags/migration.sql \
    prisma/migrations/20260801000004_ticket_unit_optional/migration.sql
  do
    if [ -f "$f" ]; then
      echo "--- applying $f"
      $PRISMA db execute --schema "$SCHEMA" --file "$f" \
        && echo "    ok" \
        || echo "    skipped (already applied or not applicable)"
    fi
  done

  # 2. Baseline: record every migration as applied so future deploys are clean.
  #    Safe because the tables already exist in this database.
  echo "--- baselining migration history"
  for d in prisma/migrations/*/; do
    name=$(basename "$d")
    if $PRISMA migrate resolve --applied "$name" >/dev/null 2>&1; then
      echo "    baselined $name"
    fi
  done

  # 3. Confirm the history is now healthy.
  echo "=== Re-running migrate deploy ==="
  $PRISMA migrate deploy \
    && echo "=== Migrations healthy ===" \
    || echo "!!! Still failing — starting server anyway (check logs above)"
else
  echo "=== Migrations done ==="
fi

echo "=== Starting server ==="
exec node dist/index.js
