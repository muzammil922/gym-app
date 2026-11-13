#!/usr/bin/env node
/**
 * Smoke-test authenticated API routes against a live server.
 * Usage:
 *   API_URL=https://app-gym-api.flowlab.fun/api \
 *   SMOKE_PHONE=03001234567 SMOKE_PASSWORD=Owner@12345 \
 *   node scripts/api-smoke.mjs
 */
const BASE = (process.env.API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const PHONE = process.env.SMOKE_PHONE || '03001234567';
const PASSWORD = process.env.SMOKE_PASSWORD || 'Owner@12345';

const checks = [];

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const health = await req('GET', '/health');
  record('GET /health', health.status === 200, String(health.status));

  const login = await req('POST', '/auth/login', { phone: PHONE, password: PASSWORD });
  const token =
    login.json?.accessToken ||
    login.json?.tokens?.accessToken ||
    login.json?.data?.accessToken;
  record('POST /auth/login', login.status === 200 || login.status === 201, login.status);
  if (!token) {
    console.error('\nNo access token — run prisma migrate deploy + seed on server.');
    process.exit(1);
  }

  const authedGets = [
    '/auth/me',
    '/gym',
    '/dashboard/kpis',
    '/members?limit=5',
    '/plans?limit=20',
    '/payments?limit=5',
    '/payments/dues?limit=5',
    '/offers?limit=10',
    '/attendance/live',
    '/attendance/devices',
    '/staff?limit=10',
    '/diet/templates?limit=10',
    '/workouts/exercises?limit=10',
    '/workouts/plans?limit=10',
    '/invoices?limit=5',
    '/notifications?limit=5',
    '/whatsapp/templates',
    '/whatsapp/automation',
    '/whatsapp/settings',
    '/whatsapp/connection',
    '/payments/reports/summary',
  ];

  for (const path of authedGets) {
    const r = await req('GET', path, null, token);
    record(`GET ${path.split('?')[0]}`, r.status >= 200 && r.status < 400, String(r.status));
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
