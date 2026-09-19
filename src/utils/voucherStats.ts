import type { StoredOrder } from '../firebase';
import type { Voucher } from '../types';

export interface VoucherUsageStats {
  usageCount: number;
  totalDiscount: number;
  unknownDiscountCount: number;
}

// Input orders must be deduplicated; amounts are historical snapshots, never
// recalculated from today's voucher percentage or shipping policy.
export function calculateVoucherUsage(orders: StoredOrder[], vouchers: Voucher[]): Map<string, VoucherUsageStats> {
  const stats = new Map<string, VoucherUsageStats>();
  const normalize = (code: string) => code.trim().toUpperCase();
  const byCode = new Map(vouchers.map(v => [normalize(v.code), v]));
  for (const voucher of vouchers) stats.set(voucher.id, { usageCount: 0, totalDiscount: 0, unknownDiscountCount: 0 });
  for (const order of orders) {
    const status = (order.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
    if (order.isDeleted || ['cancelled', 'canceled', 'da huy', 'huy', 'deleted'].includes(status)) continue;
    const seen = new Set<string>();
    const add = (id: string, amount: unknown) => {
      const entry = stats.get(id);
      if (!entry || seen.has(id)) return;
      seen.add(id);
      entry.usageCount += 1;
      if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) entry.totalDiscount += amount;
      else entry.unknownDiscountCount += 1;
    };
    if (Array.isArray(order.appliedVouchers) && order.appliedVouchers.length > 0) {
      for (const applied of order.appliedVouchers) add(applied.voucherId, applied.discountAmount);
      continue;
    }
    const codes = [...new Set((order.voucherCode || '').split('+').map(normalize).filter(Boolean))];
    const percentCodes = codes.filter(code => byCode.get(code)?.type === 'percent');
    for (const code of codes) {
      const voucher = byCode.get(code);
      if (!voucher) continue;
      // Old orders have no pre-voucher shipping fee. Never guess shipping savings.
      const knownPercent = voucher.type === 'percent' && percentCodes.length === 1 &&
        order.voucherType !== 'freeship';
      add(voucher.id, knownPercent ? order.voucherDiscountAmount : undefined);
    }
  }
  return stats;
}
