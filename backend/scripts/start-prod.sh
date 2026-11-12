#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG=/tmp/prisma-migrate.err

run_migrate() {
  npx prisma migrate deploy 2>"$LOG"
}

if run_migrate; then
  exec node dist/main.js
fi

if grep -q P3009 "$LOG" || grep -qi "failed migrations" "$LOG"; then
  echo "[start-prod] P3009: marking failed init as rolled back..."
  npx prisma migrate resolve --rolled-back "20260315000000_init"

  if run_migrate; then
    exec node dist/main.js
  fi

  if grep -qi "already exists" "$LOG"; then
    echo "[start-prod] Partial schema — resetting public schema (empty DB only)."
    npx prisma db execute --file scripts/reset-public-schema.sql
    npx prisma migrate resolve --rolled-back "20260315000000_init" 2>/dev/null || true
    run_migrate
    exec node dist/main.js
  fi
fi

cat "$LOG" >&2
exit 1
