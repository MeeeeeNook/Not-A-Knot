import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateVoucherStack, type VoucherCartItemContext } from '../src/utils/voucherCalculation';
import type { Voucher } from '../src/types';
const voucher = (code: string, overrides: Partial<Voucher> = {}): Voucher => ({ id: code, code, type: 'percent', discountPercent: 10, isActive: true, createdAt: '2026-01-01', ...overrides });
const item = (id: string, price: number, maxPercentVouchers?: number, quantity = 1): VoucherCartItemContext => ({ product: { id, name: id, price, maxPercentVouchers }, quantity });

test('default is one percentage code per unit plus one freeship; repeats never stack', () => {
  const result = calculateVoucherStack([voucher('A'), voucher('B'), voucher('SHIP', { type: 'freeship' }), voucher('SHIP2', { type: 'freeship' })], 100000, 30000, [item('p', 100000)]);
  assert.deepEqual(result.results.map((r) => r.isValid), [true, false, true, false]);
  assert.equal(result.discountAmount, 10000); assert.equal(result.shippingFee, 0);
  assert.equal(calculateVoucherStack([voucher('A'), voucher('A')], 100000, 0, [item('p', 100000, 3)]).discountAmount, 10000);
});

test('zero disables percentage discounts without disabling freeship', () => {
  const result = calculateVoucherStack([voucher('A'), voucher('SHIP', { type: 'freeship' })], 100000, 30000, [item('p', 100000, 0)]);
  assert.equal(result.discountAmount, 0); assert.deepEqual(result.results.map((r) => r.isValid), [false, true]);
});

test('mixed cart stacks only on products with remaining slots and computes sequential percentages', () => {
  const result = calculateVoucherStack([voucher('A'), voucher('B')], 300000, 30000, [item('one', 100000), item('two', 200000, 2)]);
  assert.equal(result.results[0].discountAmount, 30000); assert.equal(result.results[1].discountAmount, 18000);
  assert.equal(result.discountAmount, 48000); assert.equal(result.shippingFee, 30000);
});

test('different scoped codes can discount different products in the same order', () => {
  const result = calculateVoucherStack([voucher('A', { applicableProductIds: ['one'] }), voucher('B', { applicableProductIds: ['two'] })], 150000, 0, [item('one', 100000), item('two', 50000)]);
  assert.deepEqual(result.results.map((r) => r.isValid), [true, true]); assert.equal(result.discountAmount, 15000);
});

test('quantity caps consume slots only on units actually discounted', () => {
  const result = calculateVoucherStack([voucher('A', { maxApplicableQuantity: 1 }), voucher('B', { maxApplicableQuantity: 1 })], 200000, 0, [item('same', 100000, 1, 2)]);
  assert.equal(result.discountAmount, 20000); assert.equal(result.results[1].discountedItemCount, 1);
});

test('voucher caps and rounding allocate exactly; later discounts and shipping stay nonnegative', () => {
  const result = calculateVoucherStack([voucher('A', { discountPercent: 100, maxDiscountAmount: 101 }), voucher('B', { discountPercent: 100 })], 301, 30000, [item('one', 100, 2), item('two', 201, 2)]);
  assert.equal(result.results[0].discountAmount, 101); assert.equal(result.results[1].discountAmount, 200);
  assert.equal(result.discountAmount, 301); assert.equal(result.shippingFee, 30000);
});

test('product allow/deny lists, minimum, usage quota and validity dates all remain enforced', () => {
  const product = item('p', 100000, 4); product.product.applyAllVouchers = false; product.product.applicableVoucherIds = ['A', 'B']; product.product.disallowedVoucherIds = ['B'];
  const result = calculateVoucherStack([voucher('A'), voucher('B'), voucher('C')], 100000, 0, [product]);
  assert.deepEqual(result.results.map((r) => r.isValid), [true, false, false]);
  for (const overrides of [{ minOrderValue: 200000 }, { usageLimit: 1, usageCount: 1 }, { isActive: false }, { endDate: '2025-01-01' }, { startDate: '2099-01-01' }, { discountPercent: 101 }]) assert.equal(calculateVoucherStack([voucher('A', overrides)], 100000, 0, [item('p', 100000)]).results[0].isValid, false);
});

test('add-on prices are eligible once and quantity discounts prefer the highest remaining prices', () => {
  const expensive = { ...item('p', 50000), selectedCharmPrice: 10000, customPhotoPrice: 20000 };
  const result = calculateVoucherStack([voucher('A', { maxApplicableQuantity: 1 })], 100000, 0, [expensive, item('cheap', 20000)]);
  assert.equal(result.discountAmount, 8000);
});
