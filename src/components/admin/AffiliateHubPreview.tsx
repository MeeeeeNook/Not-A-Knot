import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AffiliateDashboard } from '../AffiliateDashboard';
import type { AffiliateSystemConfig, CategoryItem, CollectionInfo, Product, SellerUser, StoredOrder } from '../../types';
import { calculateDetailedAffiliateCommission } from '../../utils/affiliateManager';

export function AffiliateHubPreview({ admin, config, products, categories, collections, onClose }: { admin?: SellerUser | null; config: AffiliateSystemConfig; products: Product[]; categories: CategoryItem[]; collections: CollectionInfo[]; onClose: () => void }) {
  const [model, setModel] = useState<SellerUser['commissionModel']>('tiered');
  const [profile, setProfile] = useState({ name: admin?.name || admin?.username || 'Quản trị viên', phone: '', paymentInfo: '', paymentAccount: undefined as SellerUser['paymentAccount'] });
  useEffect(() => {
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', escape); };
  }, [onClose]);
  const user = useMemo<SellerUser>(() => ({ id: 'affiliate-preview-only', username: 'preview', name: profile.name, role: 'affiliate', isRootAdmin: false, isActive: true, createdAt: new Date().toISOString(), avatarColor: admin?.avatarColor, affiliateCode: 'PREVIEW-DEMO', cookieDurationDays: 30, maxOrdersPerCookieSession: 0, commissionRate: 10, commissionModel: model, tieredCommissions: [{ minAmount: 0, maxAmount: 200000, rate: 5 }, { minAmount: 200000, maxAmount: 500000, rate: 10 }, { minAmount: 500000, rate: 15 }], productCommissions: products.slice(0, 3).map((p, i) => ({ productId: p.id, productName: p.name, rate: 8 + i * 4 })), ...profile }), [profile, model, products, admin?.avatarColor]);
  const orders = useMemo<StoredOrder[]>(() => Array.from({ length: 12 }, (_, index) => {
    const merchandise = [120000, 240000, 560000, 180000][index % 4];
    const commission = calculateDetailedAffiliateCommission(user, [{ productId: products[index % Math.max(1, products.length)]?.id || 'preview-product', price: merchandise, quantity: 1 }], merchandise, 0, 10);
    return { id: `DEMO-${String(index + 1).padStart(3, '0')}`, createdAt: new Date(Date.now() - (index * 2 + 1) * 86400000).toISOString(), status: index === 11 ? 'Đã hủy' : ['Chờ xác nhận', 'Đang giao hàng', 'Đơn hàng giao thành công'][index % 3], affiliateCode: user.affiliateCode, affiliateId: user.id, affiliateName: user.name, subtotal: merchandise, totalPrice: merchandise, affiliateMerchandiseValue: merchandise, affiliateCommissionRate: commission.effectiveRate, affiliateCommissionAmount: commission.commissionAmount, affiliateCommissionPaid: index < 3, affiliateCommissionPaidAmount: index < 3 ? commission.commissionAmount : 0, affiliateCommissionPaidAt: index < 3 ? new Date().toISOString() : '', affiliateCommissionPaidBy: index < 3 ? 'Admin (mẫu)' : '', name: 'Dữ liệu mẫu', phone: '', address: '', items: [], itemDetails: [], source: 'website', date: new Date().toLocaleString('vi-VN') } as StoredOrder;
  }), [user.commissionModel, products]);
  const preview = useMemo(() => ({ config, clicks: Array.from({ length: 80 }, (_, index) => ({ timestamp: Date.now() - index * 8 * 3600000, affiliateCode: 'PREVIEW-DEMO' })) as any }), [config]);
  return createPortal(<div role="dialog" aria-modal="true" aria-label="Preview giao diện affiliate hub" className="fixed inset-0 z-[100] bg-neutral-50">
    <div className="h-12 bg-slate-950 text-white px-3 sm:px-5 flex items-center justify-between gap-2">
      <span className="text-xs font-semibold truncate">Preview · Dữ liệu mẫu · {admin?.name || 'Admin'}</span>
      <div className="flex items-center gap-2 shrink-0"><select aria-label="Cơ chế hoa hồng xem thử" value={model} onChange={e => setModel(e.target.value as SellerUser['commissionModel'])} className="text-xs rounded-lg bg-slate-800 px-2 py-1.5"><option value="tiered">Theo bậc</option><option value="standard">Cố định</option><option value="by_product">Theo sản phẩm</option></select><button type="button" onClick={onClose} aria-label="Đóng preview affiliate hub" className="rounded-lg bg-white/10 p-2"><X className="w-4 h-4" /></button></div>
    </div>
    <div className="absolute inset-x-0 bottom-0 top-12 overflow-y-auto"><AffiliateDashboard products={products} categories={categories} collections={collections} currentSeller={user} orders={orders} preview={preview} onLoginSuccess={updated => setProfile({ name: updated.name, phone: updated.phone || '', paymentInfo: updated.paymentInfo || '', paymentAccount: updated.paymentAccount })} onLogout={onClose} onNavigateHome={onClose} /></div>
  </div>, document.body);
}
