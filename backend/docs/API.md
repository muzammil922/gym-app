# Gym Management API

Base URL: `http://localhost:3000`  
Swagger UI: [`/docs`](http://localhost:3000/docs)  
OpenAPI JSON: [`/docs-json`](http://localhost:3000/docs-json) and `docs/openapi.json`

Timezone: **Asia/Karachi** (app). Timestamps stored in **UTC**. Currency: **PKR**.

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public (rate-limited) | Phone + password → access + refresh |
| POST | `/api/auth/refresh` | Public | Refresh tokens |
| POST | `/api/auth/logout` | Bearer | Revoke refresh |
| POST | `/api/auth/change-password` | Bearer | Change password |
| POST | `/api/auth/otp` | Bearer | Toggle OTP flag |
| GET | `/api/auth/me` | Bearer | Current user |

```json
POST /api/auth/login
{ "phone": "03001234567", "password": "Owner@12345" }
```

## Members

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/members` | members.read |
| GET | `/api/members/:id` | members.read |
| GET | `/api/members/:id/profile` | members.read |
| POST | `/api/members` | members.write |
| POST | `/api/members/add` | members.write (transactional add) |
| PATCH | `/api/members/:id` | members.write |
| DELETE | `/api/members/:id` | members.delete (soft) |
| POST | `/api/members/:id/freeze` | members.write |
| POST | `/api/members/:id/unfreeze` | members.write |
| POST | `/api/members/:id/renew` | members.write |
| POST | `/api/members/:id/change-plan` | members.write |
| POST | `/api/members/:id/photo` | members.write (multipart) |

`POST /api/members/add` creates member + subscription + optional offer + payment + invoice, then enqueues device sync + welcome WhatsApp. Supports `idempotencyKey`.

## Plans / Payments / Invoices / Offers

- `GET/POST/PATCH/DELETE /api/plans`
- `GET/POST /api/payments`, `GET /api/payments/dues`, `GET /api/payments/reports/summary`
- `GET /api/invoices`, `GET /api/invoices/:id`, `GET /api/invoices/:id/pdf`
- `GET/POST/PATCH/DELETE /api/offers`, `GET /api/offers/applicable?planId=`

## Attendance & devices

- `GET /api/attendance/live|history|unmapped`
- `GET /api/attendance/calendar/:memberId?year=&month=`
- `POST /api/attendance/manual` (idempotent)
- `POST /api/attendance/sync`, `POST /api/attendance/sync/:memberId`
- `GET/POST/PATCH/DELETE /api/attendance/devices`

### ZKTeco ADMS (no JWT)

| Method | Path |
|--------|------|
| GET/POST | `/iclock/cdata?SN=...&table=ATTLOG` |
| GET | `/iclock/getrequest?SN=...` |
| POST | `/iclock/devicecmd?SN=...` |

## WhatsApp

- Templates, automation, logs, retry, cost, send under `/api/whatsapp/*`
- Webhook: `GET/POST /api/whatsapp/webhook` (public)

## Diet / Workouts / Staff / Dashboard

- `/api/diet/templates`, `/api/diet/assign`, `/api/diet/schedule/:memberId`
- `/api/workouts/exercises|plans|assign|logs|streak/:memberId`
- `/api/staff`, salaries, assign-trainer
- `/api/dashboard/kpis`

## Roles

`OWNER`, `MANAGER`, `TRAINER`, `RECEPTIONIST`, `MEMBER`

- Trainer: assigned members only  
- Member: own data only  
- Soft delete on members, plans, staff  
- Audit log on payments, freezes, manual check-ins, deletes  

## Pagination

Query: `page`, `limit`, `search`, `sortBy`, `sortOrder`
