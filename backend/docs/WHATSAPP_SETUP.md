# WhatsApp Setup — Meta Cloud API

The backend uses a **provider interface** (`WhatsAppProvider`) with a Meta Cloud API implementation.

## Environment

```env
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=meta
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=gym-wa-verify-token
WHATSAPP_API_VERSION=v21.0
WHATSAPP_COST_PER_MESSAGE=0.005
```

When `WHATSAPP_ENABLED=false` (default), sends are **stubbed** (logged + recorded as SENT) so local/dev works without Meta credentials.

## Webhook

1. In Meta Developer Console → WhatsApp → Configuration → Webhook:
   - Callback URL: `https://YOUR_DOMAIN/api/whatsapp/webhook`
   - Verify token: same as `WHATSAPP_VERIFY_TOKEN`
2. Subscribe to `messages` status fields.

Verification: `GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`

## Templates & automation

Seed creates templates: `welcome`, `fee_reminder`, `diet_reminder`.

| Key | Job |
|-----|-----|
| `welcome` | On `POST /api/members/add` |
| `fee_reminder` | Hourly + due-invoice tick |
| `diet_reminder` | Every-minute tick (fires at Karachi meal hours 08/13/20) |

Manage via:

- `PUT /api/whatsapp/templates`
- `PUT /api/whatsapp/automation/:key` `{ "enabled": true, "config": {} }`

## Idempotency & retry

Queue rows use unique `(gymId, idempotencyKey)`. BullMQ retries with exponential backoff.  
`POST /api/whatsapp/retry/:queueId` re-queues failed items.  
`GET /api/whatsapp/cost` returns estimated spend.

## Manual send

```http
POST /api/whatsapp/send
Authorization: Bearer ...
{ "toPhone": "03001234567", "body": "Hello", "idempotencyKey": "manual-1" }
```

Phones are normalized to Pakistan `92…` format for Meta.
