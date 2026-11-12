# gym-app (API)

This GitHub repository contains **only the NestJS backend** for the gym admin system.

The **Expo mobile app** is developed and run locally (Expo Go) and is intentionally **not** pushed here.

## Quick start

```bash
cd backend
cp .env.example .env   # Windows: copy .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

- API base: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`

See [backend/README.md](backend/README.md) for database, Docker, WhatsApp/Evolution, and worker setup.

## Dokploy deploy

The repo root only contains `backend/` — Nixpacks alone cannot auto-detect the app. This repo includes:

| File | Use |
|------|-----|
| `nixpacks.toml` | **Nixpacks** build — installs/builds `backend/` |
| `Dockerfile` (root) | **Dockerfile** build type — same result, often more reliable |

1. Create application → GitHub `muzammil922/gym-app`, branch `main`.
2. Build: **Nixpacks** (uses root `nixpacks.toml`) **or** **Dockerfile** (root `Dockerfile`).
3. Do **not** need a custom root directory if using these files (repo root is fine).
4. Add environment variables in Dokploy (copy `backend/.env.vps.template` into Dokploy env UI — **never commit real secrets to Git**).
5. Required: `DATABASE_URL`, `REDIS_HOST` + `REDIS_PASSWORD` (+ `REDIS_USERNAME=default` on Dokploy Redis), `JWT_*`, `STORAGE_DRIVER=cloudinary` + `CLOUDINARY_URL`, `EVOLUTION_*` if WhatsApp is on.
6. Port **3000**, health: `GET /api/health` (if exposed).
7. WhatsApp queue jobs: run a **second** service with command `node dist/worker.js` (same image, `backend` workdir) if you use BullMQ workers.

Redeploy after pushing config fixes to GitHub.

## Frontend (local only)

Keep the Expo project on your machine. Point `frontend/.env` at this API:

```env
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_API_URL=http://<LAN-IP>:3000/api
```

Use your PC LAN IP on a physical device; `localhost` works in the emulator only.
