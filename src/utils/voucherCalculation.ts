import type { Voucher } from '../types';

export interface VoucherProductContext {
  id: string; name: string; price: number;
  maxPercentVouchers?: number;
  applyAllVouchers?: boolean;
  applicableVoucherIds?: string[];
  disallowedVoucherIds?: string[];
  [key: string]: any;
}
export interface VoucherCartItemContext {
  product: VoucherProductContext;
  quantity: number;
  selectedCharmPrice?: number;
  selectedOmamoriPrice?: number;
  selectedKhoenPrice?: number;
  customPhotoPrice?: number;
  [key: string]: any;
}
export interface VoucherValidationResult {
  isValid: boolean; voucher?: Voucher; discountAmount: number; isFreeShipping: boolean;
  message?: string; eligibleItemCount?: number; discountedItemCount?: number;
}
export const INVALID_VOUCHER_MESSAGE = 'Voucher không tồn tại/đã hết lượt sử dụng';
export const getProductPercentVoucherLimit = (product: { maxPercentVouchers?: number }) =>
  Number.isSafeInteger(product.maxPercentVouchers) && product.maxPercentVouchers! >= 0 ? product.maxPercentVouchers! : 1;

export function isProductEligibleForVoucher(product: VoucherProductContext, voucher: Voucher): boolean {
  if (!product || !voucher) return false;
  if (voucher.type === 'percent' && getProductPercentVoucherLimit(product) === 0) return false;
  if ((voucher.applyToAllProducts === false || voucher.applicableProductIds?.length) && !(voucher.applicableProductIds || []).includes(product.id)) return false;
  const identifiers = [String(voucher.id || '').toUpperCase().trim(), voucher.code.toUpperCase().trim()].filter(Boolean);
  const allows = (product.applicableVoucherIds || []).map((v) => String(v).toUpperCase().trim());
  if (product.applyAllVouchers === false && !identifiers.some((id) => allows.includes(id))) return false;
  const denies = (product.disallowedVoucherIds || []).map((v) => String(v).toUpperCase().trim());
  return !identifiers.some((id) => denies.includes(id));
}

// Both checkout and the order API use this engine. Limits are per physical unit;
// each percentage code discounts the remaining eligible merchandise, never shipping.
export function calculateVoucherStack(vouchers: Voucher[], subtotal: number, shippingFee: number, cartItems?: VoucherCartItemContext[], now = new Date()) {
  const units: { product: VoucherProductContext; remaining: number; used: number; line: number }[] = [];
  const hasItems = cartItems !== undefined;
  (cartItems || [{ product: { id: '__order__', name: '', price: subtotal }, quantity: 1 }]).forEach((item, line) => {
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 50) return;
    const price = Math.max(0, Number(item.product.price) + (Number(item.selectedCharmPrice) || 0) + (Number(item.selectedOmamoriPrice) || 0) + (Number(item.selectedKhoenPrice) || 0) + (Number(item.customPhotoPrice) || 0));
    for (let i = 0; i < quantity; i++) units.push({ product: item.product, remaining: Number.isFinite(price) ? Math.round(price) : 0, used: 0, line });
  });
  const results: VoucherValidationResult[] = [];
  const seen = new Set<string>();
  let totalDiscount = 0, freeShipping = false;
  for (const voucher of vouchers) {
    const code = voucher.code.toUpperCase().trim();
    const reject = (message = INVALID_VOUCHER_MESSAGE) => results.push({ isValid: false, voucher, discountAmount: 0, isFreeShipping: false, message });
    if (seen.has(code)) { reject('Mã này đã được áp dụng.'); continue; }
    seen.add(code);
    const start = voucher.startDate ? new Date(voucher.startDate) : null;
    const end = voucher.endDate ? new Date(voucher.endDate) : null;
    start?.setHours(0, 0, 0, 0); end?.setHours(23, 59, 59, 999);
    const usedCount = Math.max(Number(voucher.usageCount) || 0, Number((voucher as any).usedCount) || 0);
    if (!voucher.isActive || (start && (isNaN(start.getTime()) || now < start)) || (end && (isNaN(end.getTime()) || now > end)) || (voucher.minOrderValue && subtotal < voucher.minOrderValue) || (voucher.usageLimit && voucher.usageLimit > 0 && usedCount >= voucher.usageLimit)) { reject(); continue; }
    const eligible = units.filter((unit) => !hasItems || isProductEligibleForVoucher(unit.product, voucher));
    if (!eligible.length) { reject(voucher.type === 'percent' ? 'Mã giảm % không áp dụng cho sản phẩm trong giỏ hàng.' : INVALID_VOUCHER_MESSAGE); continue; }
    if (voucher.type === 'freeship') {
      if (freeShipping) { reject('Chỉ được áp dụng 1 mã freeship cho mỗi đơn hàng.'); continue; }
      freeShipping = true;
      results.push({ isValid: true, voucher, discountAmount: 0, isFreeShipping: true, message: 'Áp dụng miễn phí vận chuyển thành công!' });
      continue;
    }
    const percent = Number(voucher.discountPercent);
    if (voucher.type !== 'percent' || !Number.isFinite(percent) || percent <= 0 || percent > 100) { reject(); continue; }
    const available = eligible.filter((unit) => unit.remaining > 0 && unit.used < getProductPercentVoucherLimit(unit.product)).sort((a, b) => b.remaining - a.remaining);
    if (!available.length) { reject('Sản phẩm đã đạt giới hạn mã giảm %. Hãy gỡ một mã trước khi áp dụng mã khác.'); continue; }
    const quota = Number.isSafeInteger(voucher.maxApplicableQuantity) && voucher.maxApplicableQuantity! > 0 ? voucher.maxApplicableQuantity! : available.length;
    const selected = available.slice(0, quota);
    const basis = selected.reduce((sum, unit) => sum + unit.remaining, 0);
    let amount = Math.min(Math.round(basis * percent / 100), Math.max(0, subtotal - totalDiscount), basis);
    if (voucher.maxDiscountAmount && voucher.maxDiscountAmount > 0) amount = Math.min(amount, Math.floor(voucher.maxDiscountAmount));
    // Distribute the cap/rounding exactly so later coupons see the correct balance.
    let allocated = 0;
    const shares = selected.map((unit) => { const raw = amount * unit.remaining / basis; const value = Math.floor(raw); allocated += value; return { unit, value, remainder: raw - value }; });
    [...shares].sort((a, b) => b.remainder - a.remainder).slice(0, amount - allocated).forEach((share) => share.value++);
    shares.forEach(({ unit, value }) => { unit.remaining -= value; unit.used++; });
    totalDiscount += amount;
    results.push({ isValid: true, voucher, discountAmount: amount, isFreeShipping: false, eligibleItemCount: new Set(selected.map((unit) => unit.line)).size, discountedItemCount: selected.length, message: `Giảm ${percent}% cho ${selected.length} sản phẩm áp dụng (-${amount.toLocaleString('vi-VN')}đ)` });
  }
  return { results, discountAmount: totalDiscount, isFreeShipping: freeShipping, shippingFee: freeShipping ? 0 : shippingFee, appliedVouchers: results.filter((r) => r.isValid).map((r) => r.voucher!) };
}
