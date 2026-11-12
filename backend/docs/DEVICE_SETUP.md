# Device Setup — ZKTeco ADMS & Hikvision

## ZKTeco ADMS / iClock

The API implements ADMS push endpoints (no device-side JWT):

| Endpoint | Purpose |
|----------|---------|
| `GET /iclock/cdata?SN={SN}&options=all` | Handshake / options |
| `POST /iclock/cdata?SN={SN}&table=ATTLOG` | Push attendance (ATTLOG body) |
| `GET /iclock/getrequest?SN={SN}` | Device polls for commands (USER push/delete) |
| `POST /iclock/devicecmd?SN={SN}` | Command ACK |

### Device configuration

1. Create device in API: `POST /api/attendance/devices` with `serialNumber` = device SN (sticker / firmware).
2. On the terminal (or ZKBio / ADMS settings):
   - **Server URL / Cloud Server**: `http://YOUR_PUBLIC_IP_OR_DOMAIN:3000`
   - Enable **ADMS** / **Push** mode
   - Ensure outbound HTTP to your VPS is allowed (port 80/443 via Nginx preferred)
3. Point device **Domain** to your host without path prefix — firmware appends `/iclock/...`.
4. Sync members: `POST /api/attendance/sync` queues `DATA USER` commands; device picks them up via `getrequest`.

### ATTLOG format

```
PIN\tYYYY-MM-DD HH:mm:ss\tStatus\tVerify\t...
```

Verify codes mapped: FACE (15/16/17/20/21), FINGER (2/3/6/7/8), CARD (4/5/11), PASSWORD (0/1).

Logs are deduped by SHA256 idempotency key `(SN|PIN|time|verify|status)`.

Unmapped PINs appear in `GET /api/attendance/unmapped`. Non-ACTIVE members get `alertReason`.

### Nginx note

```nginx
location /iclock/ {
  proxy_pass http://127.0.0.1:3000/iclock/;
  proxy_set_header Host $host;
  proxy_request_buffering off;
}
```

## Hikvision ISAPI (stub)

`HikvisionIsapiAdapter` is registered but **stubbed**. Planned surface:

- UserInfo CRUD via `/ISAPI/AccessControl/UserInfo`
- Event notification webhook for door events
- Secondary vendor behind the same `AttendanceDeviceAdapter` interface

Set device `vendor: HIKVISION` when creating a device; push/pull currently log warnings only.

## Testing without hardware

```bash
# Simulate ATTLOG push
curl -X POST "http://localhost:3000/iclock/cdata?SN=ZKTECODEMO001&table=ATTLOG" \
  -H "Content-Type: text/plain" \
  --data-binary $'1001\t2026-03-15 08:30:00\t0\t15\n'
```

Parser unit tests: `npm test -- attlog.parser`
