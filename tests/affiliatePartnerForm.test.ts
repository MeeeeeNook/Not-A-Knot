import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAffiliatePartner, createAffiliatePartnerDraft, validateAffiliatePartnerStep, validateCommissionTiers } from '../src/utils/affiliatePartnerForm';
import type { SellerUser } from '../src/types';

const config = { cookieDurationDays: 30, defaultCommissionRate: 10 };
const existing: SellerUser = { id: 'existing', username: 'legacy_partner', role: 'affiliate', name: 'Old Name', googleEmail: 'old@example.com', googleUid: 'existing-google-uid', isActive: true, createdAt: '2024-01-01', affiliateCode: 'OLD', commissionRate: 0, cookieDurationDays: 90, maxOrdersPerCookieSession: 0, commissionModel: 'by_product', productCommissions: [{ productId: 'live-product', rate: 20 }], phone: '0123', paymentInfo: 'Old bank', lastLoginAt: '2026-10-01', ipHistory: [] };
const validDraft = () => ({ ...createAffiliatePartnerDraft(null, config, 'NEW'), name: 'New Partner', email: 'new@example.com' });

test('identity validation prevents blank or duplicate Google email across all account roles', () => {
  const draft = validDraft();
  assert.match(validateAffiliatePartnerStep({ ...draft, email: '' }, 0, [], null)!, /email/);
  assert.match(validateAffiliatePartnerStep({ ...draft, email: 'not-an-email' }, 0, [], null)!, /email/);
  assert.match(validateAffiliatePartnerStep({ ...draft, name: ' ' }, 0, [], null)!, /tên/);
  const staff = { ...existing, id: 'staff', role: 'member', googleEmail: 'NEW@EXAMPLE.COM' } as SellerUser;
  assert.match(validateAffiliatePartnerStep(draft, 0, [staff], null)!, /tài khoản khác/);
  assert.equal(validateAffiliatePartnerStep(createAffiliatePartnerDraft(existing, config, ''), 0, [existing], existing), null);
});

test('referral codes cannot be silently changed into duplicates or contain unsupported characters', () => {
  const draft = validDraft();
  assert.match(validateAffiliatePartnerStep({ ...draft, code: 'old' }, 1, [existing], null)!, /đã được sử dụng/);
  assert.match(validateAffiliatePartnerStep({ ...draft, code: 'new code?' }, 1, [], null)!, /2–40/);
  assert.equal(validateAffiliatePartnerStep({ ...draft, code: 'NEW-CODE_1' }, 1, [], null), null);
});

test('cookie and order limits reject fractional, empty and out-of-range custom values', () => {
  const draft = validDraft();
  assert.equal(validateAffiliatePartnerStep(draft, 2, [], null), null);
  for (const cookieDays of ['0', '1.5', '366', 'invalid']) assert(validateAffiliatePartnerStep({ ...draft, cookieDays }, 2, [], null));
  for (const maxOrders of ['', '1', '2.5', '101']) assert(validateAffiliatePartnerStep({ ...draft, maxOrdersMode: 'custom', maxOrders }, 2, [], null));
  assert.equal(validateAffiliatePartnerStep({ ...draft, maxOrdersMode: 'custom', maxOrders: '3' }, 2, [], null), null);
  assert.equal(validateAffiliatePartnerStep({ ...draft, maxOrdersMode: 'unlimited' }, 2, [], null), null);
});

test('commission validation keeps 0% and rejects invalid rates', () => {
  const draft = validDraft();
  assert.equal(validateAffiliatePartnerStep({ ...draft, rate: '0' }, 3, [], null), null);
  for (const rate of ['', '-1', '101', 'NaN']) assert(validateAffiliatePartnerStep({ ...draft, rate }, 3, [], null));
  assert(validateAffiliatePartnerStep({ ...draft, model: 'by_product', productRates: [{ productId: 'p', rate: NaN }] }, 3, [], null));
});

test('tiers must cover all values from zero without gaps, overlaps or an early unlimited tier', () => {
  assert.equal(validateCommissionTiers([{ minAmount: 200000, rate: 15 }, { minAmount: 0, maxAmount: 200000, rate: 0 }]), null);
  const invalid = [[], [{ minAmount: 10000, rate: 10 }], [{ minAmount: 0, maxAmount: 200000, rate: 10 }], [{ minAmount: 0, maxAmount: 200000, rate: 10 }, { minAmount: 300000, rate: 15 }], [{ minAmount: 0, maxAmount: 200000, rate: 10 }, { minAmount: 100000, rate: 15 }], [{ minAmount: 0, rate: 10 }, { minAmount: 200000, rate: 15 }]];
  invalid.forEach((tiers) => assert(validateCommissionTiers(tiers)));
});

test('editing preserves account identity/history while clearing optional settings and retaining 0%', () => {
  const draft = { ...createAffiliatePartnerDraft(existing, config, ''), cookieDays: '', phone: '', paymentInfo: '', model: 'standard' as const };
  const result = buildAffiliatePartner(draft, existing, [existing]);
  assert.equal(result.id, existing.id); assert.equal(result.username, existing.username); assert.equal(result.googleUid, existing.googleUid);
  assert.equal(result.lastLoginAt, existing.lastLoginAt); assert.equal(result.createdAt, existing.createdAt);
  assert.equal(result.commissionRate, 0); assert.equal(result.maxOrdersPerCookieSession, 0);
  assert.equal(result.cookieDurationDays, undefined); assert(Object.hasOwn(result, 'cookieDurationDays'));
  assert.equal(result.phone, ''); assert.equal(result.paymentInfo, '');
  assert.deepEqual(result.productCommissions, []); assert.deepEqual(result.tieredCommissions, []);
  assert.equal(buildAffiliatePartner(draft, { ...existing, createdAt: '' }, [existing]).createdAt, '');
});

test('new partners receive unique IDs/usernames and a normalized Google email', () => {
  const draft = { ...validDraft(), email: ' NEW@EXAMPLE.COM ' };
  const occupied = { ...existing, username: 'aff_new' };
  const first = buildAffiliatePartner(draft, null, [occupied]);
  const second = buildAffiliatePartner(draft, null, [occupied]);
  assert.notEqual(first.id, second.id); assert.equal(first.username, 'aff_new_1'); assert.equal(first.googleEmail, 'new@example.com');
  assert.equal(first.linkedGoogleAt, undefined); assert.equal(first.googleUid, undefined);
  assert.ok(Number.isFinite(Date.parse(first.createdAt)));
});
