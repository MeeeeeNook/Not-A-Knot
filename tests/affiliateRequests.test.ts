import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAffiliateRequest, normalizeFacebookUrl } from '../src/utils/affiliateRequests.ts';

test('affiliate application is one unread contact record containing all applicant details', () => {
  const message = buildAffiliateRequest({ name: ' An Nguyễn ', email: ' An@Example.com ', zaloPhone: '+1 202 555 0123', facebookUrl: 'facebook.com/an.nguyen' }, 'request-1', new Date('2026-10-15T08:00:00Z'));
  assert.equal(message.type, 'affiliate_request');
  assert.equal(message.id, 'request-1');
  assert.equal(message.name, 'An Nguyễn');
  assert.equal(message.phone, '+1 202 555 0123');
  assert.equal(message.email, 'an@example.com');
  assert.equal(message.contactInfo, message.email);
  assert.ok(message.message.includes('an@example.com'));
  assert.equal(message.facebookUrl, 'https://facebook.com/an.nguyen');
  assert.equal(message.isRead, false);
  assert.equal(message.status, 'unread');
  assert.ok(message.message.includes(message.phone!));
  assert.ok(message.message.includes(message.facebookUrl!));
});

test('Facebook links accept profile links and reject unsafe protocols, credentials and lookalike domains', () => {
  assert.equal(normalizeFacebookUrl('m.facebook.com/profile.php?id=123'), 'https://m.facebook.com/profile.php?id=123');
  assert.equal(normalizeFacebookUrl('http://fb.me/partner'), 'https://fb.me/partner');
  for (const url of ['javascript:alert(1)', 'https://facebook.com.evil.example/profile', 'https://facebook.com@evil.example', 'https://user:password@facebook.com/me', 'https://facebook.com:8888/me', '']) assert.equal(normalizeFacebookUrl(url), null);
});

test('missing application details are rejected without imposing a Vietnam-only phone format', () => {
  const form = { name: 'Test', email: 'test@example.com', zaloPhone: '0123', facebookUrl: 'facebook.com/test' };
  assert.equal(buildAffiliateRequest(form, 'id').phone, '0123');
  for (const key of ['name', 'email', 'facebookUrl']) assert.throws(() => buildAffiliateRequest({ ...form, [key]: '' }, 'id'));
});

test('Zalo phone is optional; a valid email remains required for contact', () => {
  const form = { name: 'Test', email: 'test@example.com', facebookUrl: 'facebook.com/test' };
  const message = buildAffiliateRequest(form, 'no-phone');
  assert.equal(message.phone, undefined);
  assert.equal(message.contactInfo, form.email);
  assert.ok(!message.message.includes('SĐT Zalo:'));
  assert.equal(buildAffiliateRequest({ ...form, zaloPhone: '   ' }, 'blank-phone').phone, undefined);
  for (const email of ['', 'not-an-email', 'test@', '@example.com']) assert.throws(() => buildAffiliateRequest({ ...form, email }, 'invalid-email'));
});
