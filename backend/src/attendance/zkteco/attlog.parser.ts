import { createHash } from 'crypto';
import { PulledAttendanceLog } from '../adapters/attendance-device.adapter';

/**
 * ZKTeco ATTLOG line formats (ADMS / iclock):
 *   PIN\tTime\tStatus\tVerify\tWorkcode\tReserved1\tReserved2
 *   or space / tab separated variants
 *
 * Verify codes (common):
 *   0/1 password, 2/3/4 finger, 15 face, 4/5/11 card (varies by firmware)
 */
const VERIFY_MAP: Record<number, PulledAttendanceLog['method']> = {
  0: 'PASSWORD',
  1: 'PASSWORD',
  2: 'FINGER',
  3: 'FINGER',
  4: 'CARD',
  5: 'CARD',
  6: 'FINGER',
  7: 'FINGER',
  8: 'FINGER',
  11: 'CARD',
  15: 'FACE',
  16: 'FACE',
  17: 'FACE',
  20: 'FACE',
  21: 'FACE',
};

const STATUS_DIR: Record<number, PulledAttendanceLog['direction']> = {
  0: 'IN',
  1: 'OUT',
  2: 'OUT',
  3: 'OUT',
  4: 'IN',
  5: 'OUT',
};

export function parseAttLogLine(
  line: string,
  serialNumber: string,
): PulledAttendanceLog | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  // Prefer tab-separated (keeps "YYYY-MM-DD HH:mm:ss" intact); else space-split
  // and rejoin date+time when needed.
  let pin: string;
  let timeStr: string;
  let status = 0;
  let verify = -1;

  if (trimmed.includes('\t')) {
    const parts = trimmed.split('\t').map((p) => p.trim());
    if (parts.length < 2) return null;
    pin = parts[0];
    timeStr = parts[1];
    status = parts.length > 2 ? Number(parts[2]) : 0;
    verify = parts.length > 3 ? Number(parts[3]) : -1;
  } else {
    const parts = trimmed.split(/ +/);
    if (parts.length < 2) return null;
    pin = parts[0];
    // "YYYY-MM-DD HH:mm:ss STATUS VERIFY ..."
    if (
      parts.length >= 3 &&
      /^\d{4}-\d{2}-\d{2}$/.test(parts[1]) &&
      /^\d{2}:\d{2}:\d{2}$/.test(parts[2])
    ) {
      timeStr = `${parts[1]} ${parts[2]}`;
      status = parts.length > 3 ? Number(parts[3]) : 0;
      verify = parts.length > 4 ? Number(parts[4]) : -1;
    } else {
      timeStr = parts[1];
      status = parts.length > 2 ? Number(parts[2]) : 0;
      verify = parts.length > 3 ? Number(parts[3]) : -1;
    }
  }

  const punchedAt = parseZkTime(timeStr);
  if (!punchedAt || !pin) return null;

  const method = VERIFY_MAP[verify] || 'UNKNOWN';
  const direction = STATUS_DIR[status] || 'UNKNOWN';
  const idempotencyKey = createHash('sha256')
    .update(`${serialNumber}|${pin}|${punchedAt.toISOString()}|${verify}|${status}`)
    .digest('hex')
    .slice(0, 40);

  return {
    pin,
    punchedAt,
    method,
    direction,
    raw: trimmed,
    idempotencyKey,
  };
}

export function parseAttLogBody(
  body: string,
  serialNumber: string,
): PulledAttendanceLog[] {
  const lines = body.split(/\r?\n/);
  const logs: PulledAttendanceLog[] = [];
  for (const line of lines) {
    const parsed = parseAttLogLine(line, serialNumber);
    if (parsed) logs.push(parsed);
  }
  return logs;
}

export function parseZkTime(value: string): Date | null {
  // Formats: YYYY-MM-DD HH:mm:ss | YYYY-MM-DDTHH:mm:ss | YYYYMMDDHHmmss
  const normalized = value.replace('T', ' ').trim();
  const m1 = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2}):(\d{2})$/,
  );
  if (m1) {
    return new Date(
      Date.UTC(
        Number(m1[1]),
        Number(m1[2]) - 1,
        Number(m1[3]),
        Number(m1[4]),
        Number(m1[5]),
        Number(m1[6]),
      ),
    );
  }
  const m2 = normalized.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (m2) {
    return new Date(
      Date.UTC(
        Number(m2[1]),
        Number(m2[2]) - 1,
        Number(m2[3]),
        Number(m2[4]),
        Number(m2[5]),
        Number(m2[6]),
      ),
    );
  }
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapVerifyCode(code: number): PulledAttendanceLog['method'] {
  return VERIFY_MAP[code] || 'UNKNOWN';
}
