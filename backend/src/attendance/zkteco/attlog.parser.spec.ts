import {
  mapVerifyCode,
  parseAttLogBody,
  parseAttLogLine,
  parseZkTime,
} from './attlog.parser';

describe('ATTLOG parser', () => {
  const sn = 'DEVICE001';

  it('parses tab-separated ATTLOG line', () => {
    const line = '1001\t2026-03-15 08:30:00\t0\t15\t0\t0\t0';
    const log = parseAttLogLine(line, sn);
    expect(log).not.toBeNull();
    expect(log!.pin).toBe('1001');
    expect(log!.method).toBe('FACE');
    expect(log!.direction).toBe('IN');
    expect(log!.idempotencyKey).toHaveLength(40);
  });

  it('parses space-separated line with finger verify', () => {
    const line = '1002 2026-03-15 09:00:00 1 2 0';
    const log = parseAttLogLine(line, sn);
    expect(log!.method).toBe('FINGER');
    expect(log!.direction).toBe('OUT');
  });

  it('maps verify codes', () => {
    expect(mapVerifyCode(15)).toBe('FACE');
    expect(mapVerifyCode(4)).toBe('CARD');
    expect(mapVerifyCode(0)).toBe('PASSWORD');
    expect(mapVerifyCode(999)).toBe('UNKNOWN');
  });

  it('parses compact datetime', () => {
    const d = parseZkTime('20260315083000');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2026-03-15T08:30:00.000Z');
  });

  it('parses multi-line body and skips blanks', () => {
    const body = `
1001\t2026-03-15 08:30:00\t0\t15
1002\t2026-03-15 08:31:00\t0\t2

# comment
`.trim();
    const logs = parseAttLogBody(body, sn);
    expect(logs).toHaveLength(2);
    expect(logs[0].pin).toBe('1001');
    expect(logs[1].method).toBe('FINGER');
  });

  it('dedupes via stable idempotency key', () => {
    const line = '1001\t2026-03-15 08:30:00\t0\t15';
    const a = parseAttLogLine(line, sn)!;
    const b = parseAttLogLine(line, sn)!;
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
  });

  it('returns null for invalid lines', () => {
    expect(parseAttLogLine('', sn)).toBeNull();
    expect(parseAttLogLine('onlypin', sn)).toBeNull();
  });
});
