#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ensure_dist() {
  if [ -f dist/main.js ]; then
    return 0
  fi
  echo "[start-prod] dist/main.js missing — running production build..."
  NPM_CONFIG_PRODUCTION=false npx prisma generate
  NPM_CONFIG_PRODUCTION=false npx nest build
  if [ ! -f dist/main.js ]; then
    echo "[start-prod] Build failed: dist/main.js still missing." >&2
    exit 1
  fi
}

LOG=/tmp/prisma-migrate.err

run_migrate() {
  npx prisma migrate deploy 2>"$LOG"
}

recover_and_reset() {
  echo "[start-prod] Recovering failed init migration..."
  npx prisma migrate resolve --rolled-back "20260315000000_init" 2>/dev/null || true
  echo "[start-prod] Resetting public schema (fresh / empty DB only)."
  npx prisma db execute --file scripts/reset-public-schema.sql
  npx prisma migrate resolve --rolled-back "20260315000000_init" 2>/dev/null || true
}

needs_recovery() {
  grep -q P3009 "$LOG" 2>/dev/null || \
    grep -q P3018 "$LOG" 2>/dev/null || \
    grep -qi "failed migrations" "$LOG" 2>/dev/null || \
    grep -qi "syntax error" "$LOG" 2>/dev/null || \
    grep -qi "already exists" "$LOG" 2>/dev/null
}

if run_migrate; then
  ensure_dist
  exec node dist/main.js
fi

if needs_recovery; then
  npx prisma migrate resolve --rolled-back "20260315000000_init" 2>/dev/null || true
  if run_migrate; then
    ensure_dist
    exec node dist/main.js
  fi
  if needs_recovery; then
    recover_and_reset
    run_migrate
    ensure_dist
    exec node dist/main.js
  fi
fi

cat "$LOG" >&2
exit 1
