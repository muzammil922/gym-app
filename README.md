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

## Frontend (local only)

Keep the Expo project on your machine. Point `frontend/.env` at this API:

```env
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_API_URL=http://<LAN-IP>:3000/api
```

Use your PC LAN IP on a physical device; `localhost` works in the emulator only.
