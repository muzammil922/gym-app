# Gym Management API

NestJS + Prisma + PostgreSQL + Redis/BullMQ multi-gym backend.

- **Timezone:** Asia/Karachi (app) · **Timestamps:** UTC · **Currency:** PKR  
- **Swagger:** http://localhost:3000/docs  
- **Docs:** [API](docs/API.md) · [Devices](docs/DEVICE_SETUP.md) · [WhatsApp](docs/WHATSAPP_SETUP.md)

## Folder

```
backend/          ← this API
frontend/         ← mobile/web (separate)
```

## Database: remote vs local

Both URLs are defined in `.env` / `.env.example`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | **Active** connection Prisma uses |
| `DATABASE_URL_LOCAL` | Documented local/docker Postgres URL |

**Remote (default on your machine):**

```env
DATABASE_URL=postgresql://gy:k1972004pro@gym-gy-atstal:5432/gy
DATABASE_URL_LOCAL=postgresql://postgres:postgres@localhost:5432/gym
```

**Switch to local:**

1. Comment out the remote `DATABASE_URL`
2. Set `DATABASE_URL` to the local value (same as `DATABASE_URL_LOCAL`)
3. Or run `docker compose up` — compose **overrides** `DATABASE_URL` to `postgres:5432/gym`

## Quick start (remote DB)

Requires Node 20+, Redis (local or remote), network access to `gym-gy-atstal`.

```bash
cd backend
cp .env.example .env   # if needed — .env already defaults to remote
npm install
npx prisma generate
npx prisma migrate deploy   # or: npx prisma migrate dev --name init
npm run prisma:seed
# start Redis locally if needed
npm run start:dev
```

Swagger: http://localhost:3000/docs

## Docker Compose (local Postgres + Redis + API + worker)

```bash
cd backend
docker compose up --build
# then seed once:
docker compose exec api npx prisma db seed
```

Compose forces local DB credentials (`postgres/postgres@postgres:5432/gym`).

## Seed credentials

| Field | Value |
|-------|-------|
| Owner phone | `03001234567` |
| Owner password | `Owner@12345` |
| Gym | Demo Fitness Club |

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"03001234567","password":"Owner@12345"}'
```

## Modules

Auth · Members (transactional add) · Plans · Payments/Invoices/PDF · Offers · Attendance + ZKTeco ADMS · WhatsApp (Meta) · Diet · Workouts · Staff · Dashboard · Audit · BullMQ jobs

## Tests

```bash
npm test                 # includes ATTLOG parser unit tests
npm run test:e2e         # optional
```

Simulate device punch:

```bash
curl -X POST "http://localhost:3000/iclock/cdata?SN=ZKTECODEMO001&table=ATTLOG" \
  -H "Content-Type: text/plain" \
  --data-binary $'1001\t2026-03-15 08:30:00\t0\t15\n'
```

## VPS + Nginx + SSL

1. Point DNS to VPS; open 80/443.
2. Install Docker or Node 20 + Postgres client + Redis.
3. Set production `.env` (`JWT_*`, `DATABASE_URL`, WhatsApp, `APP_URL=https://api.example.com`).
4. `npx prisma migrate deploy && npm run build && npm run start:prod` (and a worker process).
5. Nginx reverse proxy:

```nginx
server {
  server_name api.example.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
  location /iclock/ {
    proxy_pass http://127.0.0.1:3000/iclock/;
    proxy_request_buffering off;
  }
}
```

6. `certbot --nginx -d api.example.com`

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | API watch mode |
| `npm run start:worker` | BullMQ worker context |
| `npm run prisma:seed` | Seed demo data |
| `npm run openapi:export` | Write `docs/openapi.json` (also on API boot) |
