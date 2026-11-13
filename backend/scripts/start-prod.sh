#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

main_entry() {
  if [ -f dist/main.js ]; then
    echo dist/main.js
  elif [ -f dist/src/main.js ]; then
    echo dist/src/main.js
  else
    echo ""
  fi
}

ensure_dist() {
  if [ -n "$(main_entry)" ]; then
    return 0
  fi
  echo "[start-prod] dist/main.js missing — installing dev deps and building..."
  NPM_CONFIG_PRODUCTION=false npm install --include=dev --no-audit --no-fund
  NPM_CONFIG_PRODUCTION=false npx prisma generate
  if ! NPM_CONFIG_PRODUCTION=false npm run build; then
    echo "[start-prod] npm run build failed." >&2
    exit 1
  fi
  if [ -z "$(main_entry)" ]; then
    echo "[start-prod] Build failed: main.js not found in dist." >&2
    ls -la dist 2>/dev/null || echo "(no dist directory)"
    exit 1
  fi
}

run_app() {
  ENTRY="$(main_entry)"
  exec node "$ENTRY"
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
  run_app
fi

if needs_recovery; then
  npx prisma migrate resolve --rolled-back "20260315000000_init" 2>/dev/null || true
  if run_migrate; then
    ensure_dist
    run_app
  fi
  if needs_recovery; then
    recover_and_reset
    run_migrate
    ensure_dist
    run_app
  fi
fi

cat "$LOG" >&2
exit 1
