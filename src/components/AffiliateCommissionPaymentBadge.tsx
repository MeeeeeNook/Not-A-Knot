import React from 'react';
import type { StoredOrder } from '../types';

export function AffiliateCommissionPaymentBadge({ order }: { order: StoredOrder }) {
  const paid = Boolean(order.affiliateCommissionPaid);
  return <span className={`inline-flex flex-col rounded-lg px-2 py-1 text-[10px] font-semibold ${paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
    <span>{paid ? `Đã trả ${(order.affiliateCommissionPaidAmount ?? order.affiliateCommissionAmount ?? 0).toLocaleString('vi-VN')}đ` : 'Chưa trả hoa hồng'}</span>
    {paid && order.affiliateCommissionPaidAt && <span className="font-normal">{new Date(order.affiliateCommissionPaidAt).toLocaleDateString('vi-VN')}</span>}
  </span>;
}
