import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Share2, Plus, Settings, Search, Edit3, Trash2, Copy, Check, ExternalLink, TrendingUp, ShoppingBag, DollarSign, Eye, CheckCircle2, X
} from 'lucide-react';
import { SellerUser, StoredOrder, AffiliateSystemConfig, Product, CategoryItem, CollectionInfo } from '../../types';
import { AffiliatePartnerWizard } from './AffiliatePartnerWizard';
import { AffiliateHubPreview } from './AffiliateHubPreview';
import { AffiliateCommissionPolicy } from '../AffiliateCommissionPolicy';
import { getAffiliateCommissionDisplay } from '../../utils/affiliateCommissionDisplay';
import { 
  fetchAffiliateSystemConfig, 
  saveAffiliateSystemConfig, 
  calculateAffiliateStats, 
  getAffiliateReferralUrl, 
  DEFAULT_AFFILIATE_CONFIG
} from '../../utils/affiliateManager';
import { db, saveSellerToFirestore, deleteSellerFromFirestore } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getAffiliateCommissionPayments, isAffiliateOrder, setOrderCommissionPaid } from '../../utils/affiliateCommissionPayments';

interface AdminAffiliatesTabProps {
  products: Product[];
  categories: CategoryItem[];
  collections: CollectionInfo[];
  sellers: SellerUser[];
  orders: StoredOrder[];
  onUpdateOrders: (orders: StoredOrder[]) => void;
  onUpdateSellers: (updatedSellers: SellerUser[]) => void;
  currentAdmin?: SellerUser | null;
  isRootAdmin: boolean;
}

export const AdminAffiliatesTab: React.FC<AdminAffiliatesTabProps> = ({
  sellers,
  products,
  categories,
  collections,
  orders,
  onUpdateOrders,
  onUpdateSellers,
  currentAdmin,
  isRootAdmin
}) => {
  // System Configuration State
  const [config, setConfig] = useState<AffiliateSystemConfig>(DEFAULT_AFFILIATE_CONFIG);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [cookieDaysInput, setCookieDaysInput] = useState('30');
  const [defaultRateInput, setDefaultRateInput] = useState('10');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [policyAffiliate, setPolicyAffiliate] = useState<SellerUser | null>(null);
  const [savingPayment, setSavingPayment] = useState<string | null>(null);
  const canManagePayments = Boolean(currentAdmin && currentAdmin.isActive !== false && ['root_admin', 'deputy_admin', 'member'].includes(currentAdmin.role));
  const markCommissionPaid = async (order: StoredOrder, affiliate: SellerUser, paid: boolean) => {
    if (!canManagePayments || !currentAdmin) return;
    setSavingPayment(order.id);
    try {
      const updated = setOrderCommissionPaid(order, affiliate, paid, currentAdmin.name || currentAdmin.username, config.defaultCommissionRate);
      await updateDoc(doc(db, 'orders', order.id), {
        affiliateCommissionPaid: updated.affiliateCommissionPaid,
        affiliateCommissionPaidAmount: updated.affiliateCommissionPaidAmount,
        affiliateCommissionPaidAt: updated.affiliateCommissionPaidAt,
        affiliateCommissionPaidBy: updated.affiliateCommissionPaidBy
      });
      onUpdateOrders(orders.map(item => item.id === updated.id ? updated : item));
      showToast(paid ? `Đã ghi nhận trả hoa hồng đơn ${order.id}.` : `Đã bỏ đánh dấu trả hoa hồng đơn ${order.id}.`);
    } catch (error: any) { showToast(error.message || 'Chưa lưu được trạng thái thanh toán.'); }
    finally { setSavingPayment(null); }
  };

  // Modal States
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<SellerUser | null>(null);
  const [viewOrdersAffiliate, setViewOrdersAffiliate] = useState<SellerUser | null>(null);

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load System Config on Mount
  useEffect(() => {
    fetchAffiliateSystemConfig().then((cfg) => {
      setConfig(cfg);
      setCookieDaysInput(String(cfg.cookieDurationDays || 30));
      setDefaultRateInput(String(cfg.defaultCommissionRate ?? 10));
    }).catch(() => {});
  }, []);

  // Filter affiliates list from sellers
  const affiliatesList = useMemo(() => {
    return sellers.filter((s) => s.role === 'affiliate');
  }, [sellers]);

  // Active non-deleted orders
  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.isDeleted !== true && o.status !== 'cancelled' && o.status !== 'Đã hủy');
  }, [orders]);

  // Overall KPIs for Affiliate System
  const systemKPIs = useMemo(() => {
    let totalOrders = 0;
    let totalRevenue = 0;
    let totalCommission = 0;

    affiliatesList.forEach((aff) => {
      const stats = calculateAffiliateStats(aff, activeOrders);
      totalOrders += stats.totalOrders;
      totalRevenue += stats.totalMerchandiseValue;
      totalCommission += stats.totalCommission;
    });

    const activeCount = affiliatesList.filter((a) => a.isActive !== false).length;

    return {
      totalAffiliates: affiliatesList.length,
      activeAffiliates: activeCount,
      totalOrders,
      totalRevenue,
      totalCommission
    };
  }, [affiliatesList, activeOrders]);

  // Filtered Affiliates by search and status
  const filteredAffiliates = useMemo(() => {
    return affiliatesList.filter((aff) => {
      if (modelFilter !== 'all' && (aff.commissionModel || 'standard') !== modelFilter) return false;
      // Status filter
      if (statusFilter === 'active' && aff.isActive === false) return false;
      if (statusFilter === 'inactive' && aff.isActive !== false) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (aff.affiliateCode || '').toLowerCase();
        const name = (aff.name || '').toLowerCase();
        const username = (aff.username || '').toLowerCase();
        return code.includes(q) || name.includes(q) || username.includes(q) || (aff.googleEmail || aff.email || '').toLowerCase().includes(q);
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'vi');
      if (sortBy === 'commission') return calculateAffiliateStats(b, activeOrders).totalCommission - calculateAffiliateStats(a, activeOrders).totalCommission;
      if (sortBy === 'revenue') return calculateAffiliateStats(b, activeOrders).totalMerchandiseValue - calculateAffiliateStats(a, activeOrders).totalMerchandiseValue;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [affiliatesList, statusFilter, searchQuery, modelFilter, sortBy, activeOrders]);

  // Copy referral link
  const handleCopyLink = async (code: string) => {
    const url = getAffiliateReferralUrl(code);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedCode(code);
      showToast(`Đã sao chép liên kết: ${url}`);
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      showToast(`Liên kết: ${url}`);
    }
  };

  const handleOpenAddModal = () => {
    setEditingAffiliate(null);
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (aff: SellerUser) => {
    setEditingAffiliate(aff);
    setIsAddEditModalOpen(true);
  };

  const handleSaveAffiliate = async (updatedUser: SellerUser) => {
    await saveSellerToFirestore(updatedUser);
    onUpdateSellers(editingAffiliate
      ? sellers.map((s) => s.id === updatedUser.id ? updatedUser : s)
      : [...sellers, updatedUser]);
    setIsAddEditModalOpen(false);
    showToast(editingAffiliate ? 'Đã cập nhật đối tác thành công!' : 'Đã tạo đối tác tiếp thị mới!');
  };

  // Toggle Active Status
  const handleToggleStatus = async (aff: SellerUser) => {
    const nextStatus = aff.isActive === false;
    const updated: SellerUser = {
      ...aff,
      isActive: nextStatus
    };
    try {
      await saveSellerToFirestore(updated);
      onUpdateSellers(sellers.map((s) => (s.id === updated.id ? updated : s)));
      showToast(nextStatus ? `Đã kích hoạt đối tác ${aff.name}` : `Đã tạm khóa đối tác ${aff.name}`);
    } catch {
      showToast('Lỗi khi cập nhật trạng thái đối tác.');
    }
  };

  // Delete Affiliate
  const handleDeleteAffiliate = async (aff: SellerUser) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản đối tác "${aff.name}" (@${aff.username})?`)) {
      return;
    }
    try {
      await deleteSellerFromFirestore(aff.id, aff.googleEmail);
      onUpdateSellers(sellers.filter((s) => s.id !== aff.id));
      showToast(`Đã xóa đối tác ${aff.name}`);
    } catch {
      showToast('Lỗi khi xóa đối tác.');
    }
  };

  // Save System Settings (Cookie Duration & Default Rate)
  const handleSaveSystemConfig = async () => {
    const days = Math.max(1, parseInt(cookieDaysInput, 10) || 30);
    const rate = Math.max(0, Math.min(100, parseFloat(defaultRateInput) || 10));

    setIsSavingConfig(true);
    try {
      const nextConfig: AffiliateSystemConfig = {
        cookieDurationDays: days,
        defaultCommissionRate: rate,
        updatedAt: new Date().toISOString(),
        updatedBy: currentAdmin?.name || 'admin'
      };
      await saveAffiliateSystemConfig(nextConfig);
      setConfig(nextConfig);
      setIsConfigModalOpen(false);
      showToast(`Đã lưu cấu hình: Cookie ${days} ngày, Hoa hồng mặc định ${rate}%`);
    } catch (err: any) {
      alert(`Lỗi khi lưu cấu hình: ${err?.message || 'Lỗi mạng'}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {isPreviewOpen && <AffiliateHubPreview admin={currentAdmin} config={config} products={products} categories={categories} collections={collections} onClose={() => setIsPreviewOpen(false)} />}
      {policyAffiliate && <div role="dialog" aria-modal="true" aria-label={`Thông số đối tác ${policyAffiliate.name}`} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[90dvh] overflow-y-auto space-y-4"><div className="flex justify-between items-center gap-2"><h2 className="font-bold">Thông số · {policyAffiliate.name}</h2><button type="button" onClick={() => setPolicyAffiliate(null)} aria-label="Đóng thông số"><X className="w-4 h-4" /></button></div><AffiliateCommissionPolicy affiliate={policyAffiliate} products={products} defaultRate={config.defaultCommissionRate} /><p className="text-xs text-slate-600">Cookie: {policyAffiliate.cookieDurationDays || config.cookieDurationDays} ngày · {policyAffiliate.maxOrdersPerCookieSession === 0 ? 'Không giới hạn đơn' : `${policyAffiliate.maxOrdersPerCookieSession ?? 1} đơn mỗi kỳ cookie`}</p><p className="text-xs text-slate-600 break-words">Thông tin thanh toán: {policyAffiliate.paymentInfo || 'Chưa cập nhật'}</p></div></div>}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER & QUICK ACTIONS */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Quản Lý Tiếp Thị Liên Kết (Affiliate)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Thiết lập đối tác, tỷ lệ hoa hồng riêng, thời hạn cookie và kiểm tra doanh số tiếp thị
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => setIsPreviewOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold"><Eye className="w-4 h-4" />Preview giao diện affiliate hub</button>
          {/* Configure System Settings button */}
          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-98"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Cấu hình Cookie & Hoa hồng</span>
          </button>

          {/* Add New Affiliate button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Đối Tác Mới</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Đối Tác</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{systemKPIs.totalAffiliates}</span>
            <span className="text-xs text-emerald-600 font-bold">({systemKPIs.activeAffiliates} đang chạy)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Được cấp mã tiếp thị độc quyền</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đơn Hàng Ghi Nhận</span>
            <ShoppingBag className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">{systemKPIs.totalOrders}</span>
            <span className="text-xs font-bold text-slate-500">đơn</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Đơn hàng đầu tiên hợp lệ sau click</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Doanh Thu Tiếp Thị</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-2xl font-black text-slate-900">
              {systemKPIs.totalRevenue.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-bold text-slate-500">đ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sau trừ voucher, loại trừ ship</p>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-amber-900 uppercase tracking-wider">Hoa Hồng Phải Trả</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-2xl font-black text-rose-800">
              {systemKPIs.totalCommission.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-bold text-rose-800">đ</span>
          </div>
          <p className="text-[11px] text-amber-800 font-semibold mt-1">
            Cookie: {config.cookieDurationDays} ngày &bull; Trả thủ công
          </p>
        </div>
      </div>

      {/* AFFILIATES TABLE & LIST */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-black text-slate-900">
              Danh Sách Đối Tác Affiliate
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 font-mono">
              {filteredAffiliates.length}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên, email, mã tiếp thị..."
                className="w-44 sm:w-56 pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 outline-none transition-colors"
              />
            </div>

            {/* Filter by status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-700 font-bold outline-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đang tạm khóa</option>
            </select>
            <select aria-label="Lọc cơ chế hoa hồng" value={modelFilter} onChange={e => setModelFilter(e.target.value)} className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs bg-slate-50"><option value="all">Mọi cơ chế hoa hồng</option><option value="standard">Cố định</option><option value="by_product">Theo sản phẩm</option><option value="tiered">Theo bậc giá trị</option></select>
            <select aria-label="Sắp xếp đối tác" value={sortBy} onChange={e => setSortBy(e.target.value)} className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs bg-slate-50"><option value="newest">Mới nhất</option><option value="name">Tên A–Z</option><option value="commission">Hoa hồng cao nhất</option><option value="revenue">Doanh thu cao nhất</option></select>
          </div>
        </div>

        {/* Table Body */}
        {filteredAffiliates.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Chưa có đối tác nào</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery ? 'Không tìm thấy kết quả phù hợp.' : 'Nhấn nút "+ Thêm Đối Tác Mới" phía trên để cấp mã tiếp thị đầu tiên.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 sm:px-6">Đối Tác</th>
                  <th className="py-3 px-4">Mã Tiếp Thị</th>
                  <th className="py-3 px-4 text-center">Hoa Hồng (%)</th>
                  <th className="py-3 px-4 text-center">Số Đơn</th>
                  <th className="py-3 px-4 text-right">Doanh Số Hàng</th>
                  <th className="py-3 px-4 text-right">Hoa Hồng</th>
                  <th className="py-3 px-4 text-center">Trạng Thái</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredAffiliates.map((aff) => {
                  const stats = calculateAffiliateStats(aff, activeOrders);
                  const affCode = (aff.affiliateCode || aff.username).toUpperCase();
                  const isActive = aff.isActive !== false;
                  const rate = aff.commissionRate !== undefined ? aff.commissionRate : config.defaultCommissionRate;

                  return (
                    <tr key={aff.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Username */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-8 h-8 rounded-xl text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0"
                            style={{ backgroundColor: aff.avatarColor || '#991B1B' }}
                          >
                            {aff.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-tight">{aff.name}</div>
                            <div className="text-[11px] text-slate-500 leading-tight flex items-center gap-1.5 flex-wrap mt-0.5">
                              {aff.googleEmail ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200" title={`Tài khoản Google: ${aff.googleEmail}`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="font-medium truncate max-w-[170px]">{aff.googleEmail}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Chưa liên kết Google</span>
                              )}
                              {aff.phone && (
                                <span className="text-[10px] text-slate-400 font-mono">&bull; {aff.phone}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Code & Referral Link */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            {affCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(affCode)}
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Sao chép link tiếp thị"
                          >
                            {copiedCode === affCode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={getAffiliateReferralUrl(affCode)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Mở link tiếp thị trong tab mới (không ảnh hưởng đăng nhập admin)"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      {/* Commission rate & policy */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold font-mono text-[11px] border border-purple-200">
                            {getAffiliateCommissionDisplay(aff, config.defaultCommissionRate).value}
                          </span>
                          {aff.commissionModel === 'by_product' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-50 text-amber-700 font-bold border border-amber-200 whitespace-nowrap" title={`${aff.productCommissions?.length || 0} sản phẩm có % riêng`}>
                              SP riêng ({aff.productCommissions?.length || 0})
                            </span>
                          )}
                          {aff.commissionModel === 'tiered' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 whitespace-nowrap" title={`${aff.tieredCommissions?.length || 0} bậc doanh thu`}>
                              Bậc giá trị đơn ({aff.tieredCommissions?.length || 0})
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                            <span title="Thời hạn cookie">{aff.cookieDurationDays ? `${aff.cookieDurationDays}d` : `${config.cookieDurationDays || 30}d`}</span>
                            <span>&bull;</span>
                            <span title="Số đơn ghi nhận">{aff.maxOrdersPerCookieSession === 0 ? 'Vô hạn' : (aff.maxOrdersPerCookieSession && aff.maxOrdersPerCookieSession > 1 ? `${aff.maxOrdersPerCookieSession} đơn` : '1 đơn')}</span>
                          </div>
                          <button type="button" onClick={() => setPolicyAffiliate(aff)} className="text-[10px] font-semibold text-rose-700 underline">Xem thông số & bậc</button>
                        </div>
                      </td>

                      {/* Orders Count */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                          <button
                            type="button"
                            onClick={() => setViewOrdersAffiliate(aff)}
                            className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-mono text-xs transition-colors cursor-pointer underline"
                            title="Xem danh sách đơn"
                          >
                            {stats.totalOrders} đơn
                          </button>
                      </td>

                      {/* Merchandise Value */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                        {stats.totalMerchandiseValue.toLocaleString('vi-VN')}đ
                      </td>

                      {/* Commission Earned */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-rose-800">
                        {stats.totalCommission.toLocaleString('vi-VN')}đ
                        <p className="text-[10px] font-normal text-slate-500 mt-1">Đã trả: {getAffiliateCommissionPayments(aff, orders, config.defaultCommissionRate).paid.toLocaleString('vi-VN')}đ</p>
                        <p className="text-[10px] font-normal text-emerald-700">Còn: {getAffiliateCommissionPayments(aff, orders, config.defaultCommissionRate).available.toLocaleString('vi-VN')}đ</p>
                      </td>

                      {/* Active Status Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(aff)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Nhấp để đổi trạng thái"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                          <span>{isActive ? 'Hoạt động' : 'Tạm khóa'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View orders */}
                          <button
                            type="button"
                            onClick={() => setViewOrdersAffiliate(aff)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Xem đơn hàng ghi nhận"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(aff)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button (Root Admin only) */}
                          {isRootAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAffiliate(aff)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Xóa đối tác"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: CREATE / EDIT AFFILIATE MODAL */}
      {/* ======================================================== */}
      {isAddEditModalOpen && (
        <AffiliatePartnerWizard
          affiliate={editingAffiliate}
          sellers={sellers}
          products={products}
          categories={categories}
          collections={collections}
          config={config}
          onSave={handleSaveAffiliate}
          onClose={() => setIsAddEditModalOpen(false)}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 2: VIEW ATTRIBUTED ORDERS MODAL */}
      {/* ======================================================== */}
      {viewOrdersAffiliate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div 
            className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Đơn Hàng Ghi Nhận: {viewOrdersAffiliate.name}
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  Mã tiếp thị: <strong className="text-rose-800">{viewOrdersAffiliate.affiliateCode || viewOrdersAffiliate.username}</strong> &bull; {getAffiliateCommissionDisplay(viewOrdersAffiliate, config.defaultCommissionRate).value}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewOrdersAffiliate(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const stats = calculateAffiliateStats(viewOrdersAffiliate, activeOrders);
                const payment = getAffiliateCommissionPayments(viewOrdersAffiliate, orders, config.defaultCommissionRate);
                const paymentOrders = [...stats.attributedOrders, ...orders.filter(order => order.affiliateCommissionPaid && isAffiliateOrder(viewOrdersAffiliate, order) && !stats.attributedOrders.some(item => item.id === order.id))];
                if (paymentOrders.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Chưa có đơn hàng nào được ghi nhận cho đối tác này.
                    </div>
                  );
                }
                return (
                  <div className="overflow-x-auto">
                    <p className="text-xs mb-3 text-slate-600">Đã trả: <strong>{payment.paid.toLocaleString('vi-VN')}đ</strong> · Còn nhận: <strong>{payment.available.toLocaleString('vi-VN')}đ</strong>. Chỉ tích sau khi đã chuyển tiền; bỏ tích nếu đánh dấu nhầm.</p>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                          <th className="py-2.5 px-3">Mã Đơn</th>
                          <th className="py-2.5 px-3">Ngày Đặt</th>
                          <th className="py-2.5 px-3">Khách Hàng</th>
                          <th className="py-2.5 px-3 text-right">Giá Trị Tính Hoa Hồng</th>
                          <th className="py-2.5 px-3 text-center">Tỷ Lệ</th>
                          <th className="py-2.5 px-3 text-right">Hoa Hồng</th>
                          <th className="py-2.5 px-3 text-center">Đã trả hoa hồng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {paymentOrders.map((ord) => {
                          const merchVal = typeof ord.affiliateMerchandiseValue === 'number'
                            ? ord.affiliateMerchandiseValue
                            : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));

                          const rate = typeof ord.affiliateCommissionRate === 'number'
                            ? ord.affiliateCommissionRate
                            : (viewOrdersAffiliate.commissionRate ?? config.defaultCommissionRate);

                          const comm = typeof ord.affiliateCommissionAmount === 'number'
                            ? ord.affiliateCommissionAmount
                            : Math.round((merchVal * rate) / 100);

                          return (
                            <tr key={ord.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-3 font-mono font-bold text-slate-900">{ord.id}</td>
                              <td className="py-3 px-3 text-slate-600">{ord.createdAt?.slice(0, 10) || ord.date}</td>
                              <td className="py-3 px-3 text-slate-800 font-semibold">{ord.customerName || ord.name}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold">{merchVal.toLocaleString('vi-VN')}đ</td>
                              <td className="py-3 px-3 text-center font-mono">{rate}%</td>
                              <td className="py-3 px-3 text-right font-mono font-black text-rose-800">+{comm.toLocaleString('vi-VN')}đ</td>
                              <td className="py-3 px-3 text-center"><label className="inline-flex flex-col items-center gap-1 text-[10px]"><input type="checkbox" aria-label={`Đã trả hoa hồng ${ord.id}`} checked={Boolean(ord.affiliateCommissionPaid)} disabled={Boolean(savingPayment) || !canManagePayments} onChange={e => markCommissionPaid(ord, viewOrdersAffiliate, e.target.checked)} className="h-4 w-4 accent-emerald-600" /><span>{ord.affiliateCommissionPaid ? `${(ord.affiliateCommissionPaidAmount ?? comm).toLocaleString('vi-VN')}đ · ${ord.affiliateCommissionPaidAt?.slice(0, 10) || ''}` : 'Chưa trả'}</span></label></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: GLOBAL CONFIGURATION MODAL */}
      {/* ======================================================== */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div 
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Cấu Hình Hệ Thống Tiếp Thị
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Thời hạn lưu trữ cookie & hoa hồng mặc định
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Thời hạn lưu trữ cookie referral (ngày)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={cookieDaysInput}
                    onChange={(e) => setCookieDaysInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 outline-none font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ngày</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mặc định: 30 ngày. Khách hàng ghé thăm qua link sẽ được lưu referral trong khoảng thời gian này.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tỷ lệ hoa hồng mặc định (%) cho đối tác mới
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={defaultRateInput}
                    onChange={(e) => setDefaultRateInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 outline-none font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mặc định: 10%. Bạn vẫn có thể tùy biến tỷ lệ riêng cho từng đối tác cụ thể.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={isSavingConfig}
                  onClick={handleSaveSystemConfig}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xs transition-all active:scale-98 disabled:opacity-50"
                >
                  {isSavingConfig ? 'Đang lưu...' : 'Lưu Cấu Hình'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
