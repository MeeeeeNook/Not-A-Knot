import type { SellerUser, StoredOrder } from '../types';
import { calculateDetailedAffiliateCommission } from './affiliateManager';

export function isAffiliateOrder(affiliate: SellerUser, order: StoredOrder) {
  const code = (affiliate.affiliateCode || affiliate.username || '').trim().toUpperCase();
  return Boolean(code && (order.affiliateCode || '').trim().toUpperCase() === code || affiliate.id && order.affiliateId === affiliate.id);
}

export function getOrderAffiliateCommission(order: StoredOrder, affiliate: SellerUser, defaultRate = 10) {
  if (typeof order.affiliateCommissionAmount === 'number') return Math.max(0, order.affiliateCommissionAmount);
  const merchandise = typeof order.affiliateMerchandiseValue === 'number' ? order.affiliateMerchandiseValue : Math.max(0, (order.subtotal || order.totalPrice || 0) - (order.discountAmount || 0));
  if (typeof order.affiliateCommissionRate === 'number') return Math.round(merchandise * order.affiliateCommissionRate / 100);
  return calculateDetailedAffiliateCommission(affiliate, order.itemDetails || [], merchandise, 0, defaultRate).commissionAmount;
}

export function getAffiliateCommissionPayments(affiliate: SellerUser | null, orders: StoredOrder[], defaultRate = 10) {
  if (!affiliate) return { earned: 0, paid: 0, available: 0, paidOrders: 0 };
  let earned = 0, paid = 0, paidOrders = 0;
  for (const order of orders) {
    if (!isAffiliateOrder(affiliate, order)) continue;
    const amount = getOrderAffiliateCommission(order, affiliate, defaultRate);
    const cancelled = /hủy|huỷ|từ chối|cancelled|rejected/i.test(order.status || '');
    if (!order.isDeleted && !cancelled) earned += amount;
    if (order.affiliateCommissionPaid) { paid += Math.max(0, order.affiliateCommissionPaidAmount ?? amount); paidOrders++; }
  }
  return { earned, paid, available: Math.max(0, earned - paid), paidOrders };
}

export function setOrderCommissionPaid(order: StoredOrder, affiliate: SellerUser, paid: boolean, adminName: string, defaultRate = 10): StoredOrder {
  if (!isAffiliateOrder(affiliate, order)) throw new Error('Đơn không thuộc đối tác này.');
  if (paid && (order.isDeleted || /hủy|huỷ|từ chối|cancelled|rejected/i.test(order.status || ''))) throw new Error('Không đánh dấu trả hoa hồng cho đơn đã hủy hoặc xóa.');
  // Check again leaves the original payment amount/date intact; uncheck explicitly clears fields.
  if (paid && order.affiliateCommissionPaid) return order;
  return { ...order, affiliateCommissionPaid: paid, affiliateCommissionPaidAmount: paid ? getOrderAffiliateCommission(order, affiliate, defaultRate) : 0, affiliateCommissionPaidAt: paid ? new Date().toISOString() : '', affiliateCommissionPaidBy: paid ? adminName : '' };
}
