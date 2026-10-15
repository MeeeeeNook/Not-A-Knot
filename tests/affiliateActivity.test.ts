import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAffiliateActivity, formatAffiliateAccountDate, validAccountDate, AFFILIATE_ACTIVITY_LIMIT } from '../src/utils/affiliateActivity.ts';
import clientIpHandler from '../api/client-ip.ts';

test('activity is chronological, deduplicated and bounded without changing earlier timestamps', () => {
  const history = Array.from({ length: 110 }, (_, i) => ({ id: `event-${i}`, action: 'tab_view' as const, tab: 'orders', timestamp: new Date(1_790_000_000_000 + i * 1000).toISOString() }));
  const latest = history.at(-1)!;
  const result = mergeAffiliateActivity([...history, null, { id: 'bad', action: 'toString', timestamp: latest.timestamp }], latest);
  assert.equal(result.length, AFFILIATE_ACTIVITY_LIMIT);
  assert.deepEqual(result[0], latest);
  assert.equal(new Set(result.map(row => row.id)).size, result.length);
  assert.equal(history.length, 110);
  assert.deepEqual(mergeAffiliateActivity(undefined), []);
});

test('unknown account dates stay unknown; timestamps display in Vietnam time', () => {
  for (const date of [undefined, '', 'bad-date']) assert.equal(formatAffiliateAccountDate(date), 'Chưa ghi nhận');
  assert.equal(validAccountDate({ toDate: () => new Date('2026-10-15T09:24:00Z') }), '2026-10-15T09:24:00.000Z');
  assert.match(formatAffiliateAccountDate('2026-10-15T09:24:00Z'), /16:24/);
});

test('client IP endpoint reads proxy headers, rejects malformed addresses and never shares cached IPs', () => {
  const call = (req: any) => {
    const headers: Record<string, string> = {}; let code = 0, data: any;
    const res = { setHeader: (key: string, value: string) => { headers[key] = value; }, status: (value: number) => { code = value; return res; }, json: (value: any) => { data = value; } };
    clientIpHandler({ method: 'GET', ...req }, res);
    return { headers, code, data };
  };
  const ipv4 = call({ headers: { 'x-vercel-forwarded-for': '203.0.113.5', 'x-forwarded-for': '198.51.100.9' }, query: { ip: '1.2.3.4' } });
  assert.equal(ipv4.code, 200); assert.equal(ipv4.data.ip, '203.0.113.5');
  assert.match(ipv4.headers['Cache-Control'], /no-store/);
  assert.equal(call({ headers: { 'x-real-ip': '2001:db8::1' } }).data.ip, '2001:db8::1');
  assert.equal(call({ headers: { 'x-forwarded-for': 'not an IP' } }).data.ip, '');
  assert.equal(call({ headers: {}, socket: { remoteAddress: '::ffff:127.0.0.1' } }).data.ip, '127.0.0.1');
  assert.equal(call({ method: 'POST' }).code, 405);
});
