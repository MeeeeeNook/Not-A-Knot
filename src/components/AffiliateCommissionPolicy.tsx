import React from 'react';
import type { SellerUser, Product } from '../types';
import { getAffiliateCommissionDisplay } from '../utils/affiliateCommissionDisplay';

export function AffiliateCommissionPolicy({ affiliate, products = [], defaultRate = 10 }: { affiliate: SellerUser | null; products?: Product[]; defaultRate?: number }) {
  if (!affiliate) return null;
  const display = getAffiliateCommissionDisplay(affiliate, defaultRate);
  const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`;
  const tiers = [...(affiliate.tieredCommissions || [])].sort((a, b) => a.minAmount - b.minAmount);
  return <section aria-label="Cấu hình hoa hồng của bạn" className="bg-white border border-rose-100 rounded-2xl p-4 sm:p-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold text-neutral-900">Cách tính hoa hồng của bạn</h2><span className="text-xs font-semibold text-rose-700">{display.value}</span></div>
    {affiliate.commissionModel === 'tiered' ? <>
      <p className="text-xs text-neutral-600">Chọn bậc theo tiền sản phẩm sau giảm giá của từng đơn, không gồm phí vận chuyển. Tỷ lệ của bậc áp dụng cho toàn bộ giá trị đó, không cộng dồn doanh thu tháng.</p>
      {tiers.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{tiers.map((tier, index) => <div key={index} className="rounded-xl bg-rose-50/60 border border-rose-100 px-3 py-2 text-xs"><span className="block text-neutral-600">Từ {money(tier.minAmount)}{tier.maxAmount ? ` đến dưới ${money(tier.maxAmount)}` : ' trở lên'}</span><strong className="text-rose-800 text-sm">{tier.rate}%</strong></div>)}</div> : <p className="text-xs text-neutral-500">Chưa có bậc riêng; tỷ lệ dự phòng {affiliate.commissionRate ?? defaultRate}%.</p>}
    </> : affiliate.commissionModel === 'by_product' ? <>
      <p className="text-xs text-neutral-600">Sản phẩm chưa có tỷ lệ riêng dùng {affiliate.commissionRate ?? defaultRate}%. Hoa hồng tính trên tiền sản phẩm sau giảm giá, không gồm phí vận chuyển.</p>
      <div className="flex flex-wrap gap-2">{affiliate.productCommissions?.map(item => <span key={item.productId} className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-neutral-700">{products.find(p => p.id === item.productId)?.name || item.productName || item.productId}: <strong>{item.rate}%</strong></span>)}</div>
    </> : <p className="text-xs text-neutral-600">Hoa hồng bằng tiền sản phẩm sau giảm giá × {affiliate.commissionRate ?? defaultRate}%, không gồm phí vận chuyển.</p>}
  </section>;
}
