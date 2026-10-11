import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Share2, Plus, Settings, Search, Edit3, Trash2, 
  Copy, Check, ExternalLink, TrendingUp, ShoppingBag, 
  DollarSign, Percent, AlertCircle, Eye, CheckCircle2, 
  X, RefreshCw, Lock, UserCheck, UserX, Shield, Clock,
  ChevronRight, Building
} from 'lucide-react';
import { SellerUser, StoredOrder, AffiliateSystemConfig } from '../../types';
import { 
  fetchAffiliateSystemConfig, 
  saveAffiliateSystemConfig, 
  calculateAffiliateStats, 
  getAffiliateReferralUrl, 
  generateAffiliateCode,
  DEFAULT_AFFILIATE_CONFIG
} from '../../utils/affiliateManager';
import { saveSellerToFirestore, deleteSellerFromFirestore } from '../../firebase';
import { generateSalt, hashPassword } from '../../utils/auth';

interface AdminAffiliatesTabProps {
  sellers: SellerUser[];
  orders: StoredOrder[];
  onUpdateSellers: (updatedSellers: SellerUser[]) => void;
  currentAdmin?: SellerUser | null;
  isRootAdmin: boolean;
}

export const AdminAffiliatesTab: React.FC<AdminAffiliatesTabProps> = ({
  sellers,
  orders,
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

  // Modal States
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<SellerUser | null>(null);
  const [viewOrdersAffiliate, setViewOrdersAffiliate] = useState<SellerUser | null>(null);

  // Form Fields for Add/Edit
  const [formName, setFormName] = useState('');
  const [formGoogleEmail, setFormGoogleEmail] = useState('');
  const [formAffiliateCode, setFormAffiliateCode] = useState('');
  const [formCommissionRate, setFormCommissionRate] = useState('10');
  const [formPhone, setFormPhone] = useState('');
  const [formPaymentInfo, setFormPaymentInfo] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

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
      setDefaultRateInput(String(cfg.defaultCommissionRate || 10));
    }).catch(() => {});
  }, []);

  // Filter affiliates list from sellers
  const affiliatesList = useMemo(() => {
    return sellers.filter((s) => s.role === 'affiliate' || Boolean(s.affiliateCode));
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
      // Status filter
      if (statusFilter === 'active' && aff.isActive === false) return false;
      if (statusFilter === 'inactive' && aff.isActive !== false) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (aff.affiliateCode || '').toLowerCase();
        const name = (aff.name || '').toLowerCase();
        const username = (aff.username || '').toLowerCase();
        return code.includes(q) || name.includes(q) || username.includes(q);
      }

      return true;
    });
  }, [affiliatesList, statusFilter, searchQuery]);

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

  // Open Add Affiliate Modal
  const handleOpenAddModal = () => {
    setEditingAffiliate(null);
    setFormName('');
    setFormGoogleEmail('');
    const suggestedCode = generateAffiliateCode('', affiliatesList);
    setFormAffiliateCode(suggestedCode);
    setFormCommissionRate(String(config.defaultCommissionRate || 10));
    setFormPhone('');
    setFormPaymentInfo('');
    setFormIsActive(true);
    setFormError('');
    setIsAddEditModalOpen(true);
  };

  // Open Edit Affiliate Modal
  const handleOpenEditModal = (aff: SellerUser) => {
    setEditingAffiliate(aff);
    setFormName(aff.name || '');
    setFormGoogleEmail(aff.googleEmail || (aff as any).email || '');
    setFormAffiliateCode(aff.affiliateCode || aff.username.toUpperCase());
    setFormCommissionRate(String(aff.commissionRate !== undefined ? aff.commissionRate : config.defaultCommissionRate));
    setFormPhone(aff.phone || '');
    setFormPaymentInfo(aff.paymentInfo || '');
    setFormIsActive(aff.isActive !== false);
    setFormError('');
    setIsAddEditModalOpen(true);
  };

  // Save Affiliate (Create or Edit)
  const handleSaveAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = formName.trim();
    const cleanGoogleEmail = formGoogleEmail.trim().toLowerCase();
    const cleanCode = formAffiliateCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const cleanRate = Math.max(0, Math.min(100, parseFloat(formCommissionRate) || 10));

    if (!cleanName) {
      setFormError('Vui lòng nhập họ và tên đối tác.');
      return;
    }
    if (cleanGoogleEmail && !cleanGoogleEmail.includes('@')) {
      setFormError('Email Google không đúng định dạng (VD: doitao@gmail.com).');
      return;
    }
    if (!cleanCode) {
      setFormError('Vui lòng nhập mã tiếp thị độc quyền (VD: AN001).');
      return;
    }

    const duplicateCode = affiliatesList.find(
      (s) => (s.affiliateCode || '').toUpperCase() === cleanCode && s.id !== editingAffiliate?.id
    );
    if (duplicateCode) {
      setFormError(`Mã tiếp thị "${cleanCode}" đã được sử dụng bởi đối tác khác.`);
      return;
    }

    // Automatically derive internal username from email or name without requiring user input
    const derivedUsername = editingAffiliate?.username || (
      cleanGoogleEmail
        ? cleanGoogleEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '')
        : cleanName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
    ) || cleanCode.toLowerCase();

    setIsSavingUser(true);
    try {
      const nowIso = new Date().toISOString();

      const updatedUser: SellerUser = {
        id: editingAffiliate?.id || `affiliate-${Date.now().toString().slice(-6)}`,
        username: derivedUsername,
        name: cleanName,
        role: 'affiliate',
        isActive: formIsActive,
        affiliateCode: cleanCode,
        commissionRate: cleanRate,
        googleEmail: cleanGoogleEmail || editingAffiliate?.googleEmail || undefined,
        googleUid: editingAffiliate?.googleUid,
        phone: formPhone.trim() || undefined,
        paymentInfo: formPaymentInfo.trim() || undefined,
        avatarColor: editingAffiliate?.avatarColor || '#991B1B',
        createdAt: editingAffiliate?.createdAt || nowIso,
        linkedGoogleAt: editingAffiliate?.linkedGoogleAt || (cleanGoogleEmail ? nowIso : undefined)
      };

      // Save to Firestore
      await saveSellerToFirestore(updatedUser);

      // Update local state
      const updatedSellersList = editingAffiliate
        ? sellers.map((s) => (s.id === updatedUser.id ? updatedUser : s))
        : [...sellers, updatedUser];

      onUpdateSellers(updatedSellersList);
      setIsAddEditModalOpen(false);
      showToast(editingAffiliate ? 'Đã cập nhật đối tác thành công!' : 'Đã tạo đối tác tiếp thị mới!');
    } catch (err: any) {
      setFormError(err?.message || 'Có lỗi khi lưu đối tác vào cơ sở dữ liệu.');
    } finally {
      setIsSavingUser(false);
    }
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
                placeholder="Tìm tên, mã tiếp thị..."
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
                        </div>
                      </td>

                      {/* Commission rate */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold font-mono text-[11px] border border-purple-200">
                          {rate}%
                        </span>
                      </td>

                      {/* Orders Count */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        {stats.totalOrders > 0 ? (
                          <button
                            type="button"
                            onClick={() => setViewOrdersAffiliate(aff)}
                            className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-mono text-xs transition-colors cursor-pointer underline"
                            title="Xem danh sách đơn"
                          >
                            {stats.totalOrders} đơn
                          </button>
                        ) : (
                          <span className="text-slate-400 font-mono">0</span>
                        )}
                      </td>

                      {/* Merchandise Value */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                        {stats.totalMerchandiseValue.toLocaleString('vi-VN')}đ
                      </td>

                      {/* Commission Earned */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-rose-800">
                        {stats.totalCommission.toLocaleString('vi-VN')}đ
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div 
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  {editingAffiliate ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingAffiliate ? 'Chỉnh Sửa Đối Tác Tiếp Thị' : 'Tạo Đối Tác Tiếp Thị Mới'}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Cấp tài khoản đăng nhập và liên kết tiếp thị riêng
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAffiliate} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Họ và tên đối tác <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: An Nguyễn"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Google (đăng nhập Firebase)
                  </label>
                  <input
                    type="email"
                    value={formGoogleEmail}
                    onChange={(e) => setFormGoogleEmail(e.target.value)}
                    placeholder="VD: doitao@gmail.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Tài khoản Google đối tác dùng để đăng nhập qua Firebase
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã tiếp thị (Referral Code) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={formAffiliateCode}
                      onChange={(e) => setFormAffiliateCode(e.target.value.toUpperCase())}
                      placeholder="VD: AN001"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 outline-none font-mono font-bold uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => setFormAffiliateCode(generateAffiliateCode(formName, affiliatesList))}
                      className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 whitespace-nowrap cursor-pointer"
                      title="Gợi ý mã ngẫu nhiên"
                    >
                      Tạo mã
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Link: ?ref={formAffiliateCode || 'CODE'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tỷ lệ hoa hồng (%) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      step="0.5"
                      value={formCommissionRate}
                      onChange={(e) => setFormCommissionRate(e.target.value)}
                      placeholder="10"
                      className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 outline-none font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số điện thoại / Zalo (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="VD: 0912345678"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-slate-700">Kích hoạt tài khoản đối tác</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Thông tin thanh toán ngân hàng (đối soát thủ công)
                </label>
                <textarea
                  rows={2}
                  value={formPaymentInfo}
                  onChange={(e) => setFormPaymentInfo(e.target.value)}
                  placeholder="VD: MB Bank - 0987654321 - NGUYEN VAN AN"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xs transition-all active:scale-98 disabled:opacity-50"
                >
                  {isSavingUser ? 'Đang lưu...' : (editingAffiliate ? 'Cập Nhật Đối Tác' : 'Tạo Đối Tác')}
                </button>
              </div>
            </form>
          </div>
        </div>
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
                  Mã tiếp thị: <strong className="text-rose-800">{viewOrdersAffiliate.affiliateCode || viewOrdersAffiliate.username}</strong> &bull; Tỷ lệ: {viewOrdersAffiliate.commissionRate || 10}%
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
                if (stats.attributedOrders.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Chưa có đơn hàng nào được ghi nhận cho đối tác này.
                    </div>
                  );
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                          <th className="py-2.5 px-3">Mã Đơn</th>
                          <th className="py-2.5 px-3">Ngày Đặt</th>
                          <th className="py-2.5 px-3">Khách Hàng</th>
                          <th className="py-2.5 px-3 text-right">Giá Trị Tính Hoa Hồng</th>
                          <th className="py-2.5 px-3 text-center">Tỷ Lệ</th>
                          <th className="py-2.5 px-3 text-right">Hoa Hồng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {stats.attributedOrders.map((ord) => {
                          const merchVal = typeof ord.affiliateMerchandiseValue === 'number'
                            ? ord.affiliateMerchandiseValue
                            : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));

                          const rate = typeof ord.affiliateCommissionRate === 'number'
                            ? ord.affiliateCommissionRate
                            : (viewOrdersAffiliate.commissionRate || 10);

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
