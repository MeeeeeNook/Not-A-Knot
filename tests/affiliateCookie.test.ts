import test from 'node:test';
import assert from 'node:assert/strict';
import { AFFILIATE_COOKIE_NAME, getActiveAffiliateReferral, setAffiliateReferral, recordOrderOnAffiliateCookie } from '../src/utils/affiliateCookie';
const cookies = new Map<string, string>();
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'document', { value: { get cookie() { return [...cookies].map(([k, v]) => `${k}=${v}`).join('; '); }, set cookie(value: string) { const [entry, ...attrs] = value.split(';'); const i = entry.indexOf('='); if (attrs.some((attr) => attr.trim().toLowerCase() === 'max-age=0')) cookies.delete(entry.slice(0, i)); else cookies.set(entry.slice(0, i), entry.slice(i + 1)); } }, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) }, configurable: true });
const reset = () => { cookies.clear(); storage.clear(); };
const rawCookie = () => JSON.parse(decodeURIComponent(cookies.get(AFFILIATE_COOKIE_NAME)!));

test('unlimited referral attributes three successive orders without clicking again', () => {
  reset(); setAffiliateReferral('A', 30, 0);
  const originalExpiry = getActiveAffiliateReferral()!.expiresAt;
  for (let i = 1; i <= 3; i++) {
    assert.equal(getActiveAffiliateReferral()!.code, 'A');
    assert.deepEqual(recordOrderOnAffiliateCookie(0, `order-${i}`), { shouldClear: false, orderCount: i });
  }
  assert.equal(getActiveAffiliateReferral()!.expiresAt, originalExpiry);
  assert.equal(getActiveAffiliateReferral()!.maxOrders, 0);
});

test('a repeated link cannot reset the exhausted quota or extend the first expiry', () => {
  reset(); setAffiliateReferral('A', 7, 1); const original = rawCookie();
  recordOrderOnAffiliateCookie(1, 'first'); assert.equal(getActiveAffiliateReferral(), null);
  setAffiliateReferral('A', 90, 1); assert.equal(getActiveAffiliateReferral(), null);
  assert.equal(rawCookie().expiresAt, original.expiresAt); assert.equal(rawCookie().clickedAt, original.clickedAt);
  assert.equal(rawCookie().orderCount, 1);
});

test('another affiliate remains eligible; switching back retains the original quota and expiry', () => {
  reset(); setAffiliateReferral('A', 30, 1); const firstExpiry = rawCookie().expiresAt;
  recordOrderOnAffiliateCookie(1, 'first'); setAffiliateReferral('B', 14, 3);
  assert.equal(getActiveAffiliateReferral()!.code, 'B'); recordOrderOnAffiliateCookie(3, 'second');
  setAffiliateReferral('A', 60, 1); assert.equal(getActiveAffiliateReferral(), null); assert.equal(rawCookie().expiresAt, firstExpiry);
  setAffiliateReferral('B', 60, 3); assert.equal(getActiveAffiliateReferral()!.orderCount, 1);
});

test('verified policy can upgrade an old default cookie to unlimited; the same order counts once', () => {
  reset(); setAffiliateReferral('A', 30, 1);
  recordOrderOnAffiliateCookie(0, 'first'); recordOrderOnAffiliateCookie(undefined, 'first');
  assert.equal(getActiveAffiliateReferral()!.maxOrders, 0); assert.equal(getActiveAffiliateReferral()!.orderCount, 1);
  recordOrderOnAffiliateCookie(undefined, 'second'); assert.equal(getActiveAffiliateReferral()!.orderCount, 2);
});

test('a new period begins only after the original affiliate session expires', () => {
  reset(); const expired = { code: 'A', clickedAt: '2020-01-01', expiresAt: '2020-02-01', maxOrders: 1, orderCount: 1 };
  cookies.set(AFFILIATE_COOKIE_NAME, encodeURIComponent(JSON.stringify(expired)));
  storage.set('nak_affiliate_sessions_v1', JSON.stringify({ A: expired }));
  setAffiliateReferral('A', 30, 1); assert.equal(getActiveAffiliateReferral()!.orderCount, 0);
  assert.notEqual(getActiveAffiliateReferral()!.expiresAt, expired.expiresAt);
});
