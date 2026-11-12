# IronForge Gym — Mobile (Expo Go)

Production-oriented **mobile-only** gym management app for Pakistan (PKR · Asia/Karachi).

Path: `frontend/`

## Requirements

- Node 20+
- Expo Go **58.0.5** (SDK 58)
- No custom native modules / no dev-client / no prebuild required for the current feature set

## Quick start

```bash
cd frontend
cp .env.example .env
npm install
npx expo start
```

Scan the QR code with **Expo Go** (SDK 58).

Mock API is on by default (`EXPO_PUBLIC_USE_MOCK=true`), so every screen works without a backend.

## Demo logins (mock)

| Role         | Phone       | Password       |
|--------------|-------------|----------------|
| Owner        | 03001234001 | owner123       |
| Manager      | 03001234002 | manager123     |
| Trainer      | 03001234003 | trainer123     |
| Receptionist | 03001234004 | reception123   |
| Member       | 03001234005 | member123      |

OTP demo code: `123456`

## Stack

- Expo SDK 58 + Expo Router
- TypeScript
- Zustand (session/settings)
- TanStack Query (server state)
- react-hook-form + zod
- axios API layer (`src/api`) + mock adapter (`src/mocks`)
- expo-secure-store (tokens) / AsyncStorage (cache)
- expo-print + expo-sharing (invoice PDF)
- react-native-svg (fee charts)

## Env

See `.env.example`:

```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_USE_MOCK=true
```

Set `EXPO_PUBLIC_USE_MOCK=false` to hit a real backend that implements `docs/API.md`.

## Modules

1. Auth (phone+password / OTP, persistent session, refresh, logout)
2. Staff dashboard
3. Members (search, filters, infinite scroll, add with photo, profile actions, device sync)
4. Attendance (live 10s poll, history calendar strip, manual check-in, devices)
5. Fees (plans CRUD, collect payment, dues, invoice PDF/share/WhatsApp, reports)
6. Offers CRUD + auto-suggest
7. Diet templates / assign / check-offs
8. Workout library / plans / assign / streak
9. Staff CRUD + attendance + salary
10. WhatsApp settings + message log
11. Notifications (in-app + local)
12. Settings (gym profile, theme, EN / Roman Urdu, logout)

## Expo Go limitations / later Dev Client

- **Remote push notifications** with production credentials need a custom Dev Client / EAS build (local notifications work in Expo Go).
- Attendance **machine vendor SDKs** are intentionally not embedded; devices are configured/displayed via API only.
- Any future BLE/USB/native biometric SDKs will require a Dev Client (not Expo Go).

## API docs

See [`docs/API.md`](./docs/API.md) and types in `src/api/types.ts`.

## Scripts

```bash
npx expo start
npm run typecheck
```
