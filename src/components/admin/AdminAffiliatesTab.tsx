import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Share2, Plus, Settings, Search, Edit3, Trash2, 
  Copy, Check, ExternalLink, TrendingUp, ShoppingBag, 
  DollarSign, Percent, AlertCircle, Eye, CheckCircle2, 
  X, RefreshCw, Lock, UserCheck, UserX, Shield, Clock,
  ChevronRight, Building, Tag, Layers, Sparkles
} from 'lucide-react';
import { SellerUser, StoredOrder, AffiliateSystemConfig, ProductCommissionOverride, RevenueTierCommission } from '../../types';
import { PRODUCTS } from '../../data/products';
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

  // Per-affiliate Custom Configuration States
  const [formCookieDays, setFormCookieDays] = useState(''); // Empty = system default
  const [formMaxOrdersMode, setFormMaxOrdersMode] = useState<'first_only' | 'custom' | 'unlimited'>('first_only');
  const [formMaxOrdersCustom, setFormMaxOrdersCustom] = useState('3');
  const [formCommissionModel, setFormCommissionModel] = useState<'standard' | 'by_product' | 'tiered'>('standard');
  const [formProductCommissions, setFormProductCommissions] = useState<ProductCommissionOverride[]>([]);
  const [formTieredCommissions, setFormTieredCommissions] = useState<RevenueTierCommission[]>([]);

  // Add Product Override Temporary Inputs
  const [productToAddId, setProductToAddId] = useState('');
  const [productToAddRate, setProductToAddRate] = useState('15');

  // Add Revenue Tier Temporary Inputs
  const [tierMinInput, setTierMinInput] = useState('0');
  const [tierMaxInput, setTierMaxInput] = useState('200000');
  const [tierRateInput, setTierRateInput] = useState('8');

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
    setFormCookieDays('');
    setFormMaxOrdersMode('first_only');
    setFormMaxOrdersCustom('3');
    setFormCommissionModel('standard');
    setFormProductCommissions([]);
    setFormTieredCommissions([]);
    setProductToAddId('');
    setProductToAddRate('15');
    setTierMinInput('0');
    setTierMaxInput('200000');
    setTierRateInput('8');
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

    // Load custom settings
    setFormCookieDays(aff.cookieDurationDays ? String(aff.cookieDurationDays) : '');
    if (aff.maxOrdersPerCookieSession === 0) {
      setFormMaxOrdersMode('unlimited');
    } else if (typeof aff.maxOrdersPerCookieSession === 'number' && aff.maxOrdersPerCookieSession > 1) {
      setFormMaxOrdersMode('custom');
      setFormMaxOrdersCustom(String(aff.maxOrdersPerCookieSession));
    } else {
      setFormMaxOrdersMode('first_only');
      setFormMaxOrdersCustom('3');
    }
    setFormCommissionModel(aff.commissionModel || 'standard');
    setFormProductCommissions(Array.isArray(aff.productCommissions) ? [...aff.productCommissions] : []);
    setFormTieredCommissions(Array.isArray(aff.tieredCommissions) ? [...aff.tieredCommissions] : []);

    setProductToAddId('');
    setProductToAddRate('15');
    setTierMinInput('0');
    setTierMaxInput('200000');
    setTierRateInput('8');
    setFormError('');
    setIsAddEditModalOpen(true);
  };

  // Helper to add a product commission override
  const handleAddProductOverride = () => {
    if (!productToAddId) {
      alert('Vui lòng chọn sản phẩm cần đặt mức hoa hồng riêng.');
      return;
    }
    const rate = Math.max(0, Math.min(100, parseFloat(productToAddRate) || 0));
    const targetProduct = PRODUCTS.find((p) => p.id === productToAddId);
    const prodName = targetProduct?.name || productToAddId;

    setFormProductCommissions((prev) => {
      const filtered = prev.filter((p) => p.productId !== productToAddId);
      return [...filtered, { productId: productToAddId, productName: prodName, rate }];
    });
    setProductToAddId('');
    setProductToAddRate('15');
  };

  // Helper to remove a product override
  const handleRemoveProductOverride = (productId: string) => {
    setFormProductCommissions((prev) => prev.filter((p) => p.productId !== productId));
  };

  // Helper to add a revenue tier
  const handleAddRevenueTier = () => {
    const min = Math.max(0, parseInt(tierMinInput, 10) || 0);
    const max = tierMaxInput.trim() ? Math.max(min + 1000, parseInt(tierMaxInput, 10) || 0) : undefined;
    const rate = Math.max(0, Math.min(100, parseFloat(tierRateInput) || 0));

    setFormTieredCommissions((prev) => {
      const updated = [...prev, { minAmount: min, maxAmount: max, rate }];
      return updated.sort((a, b) => a.minAmount - b.minAmount);
    });
    setTierMinInput(String(max || min + 200000));
    setTierMaxInput(max ? String(max + 300000) : '');
    setTierRateInput(String(Math.min(100, rate + 2)));
  };

  // Helper to remove a revenue tier
  const handleRemoveRevenueTier = (index: number) => {
    setFormTieredCommissions((prev) => prev.filter((_, idx) => idx !== index));
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

    // Custom configuration parameters
    const customDays = formCookieDays.trim() ? Math.max(1, parseInt(formCookieDays, 10)) : undefined;
    const maxOrdersVal = formMaxOrdersMode === 'unlimited' ? 0 : (formMaxOrdersMode === 'custom' ? Math.max(1, parseInt(formMaxOrdersCustom, 10) || 1) : 1);

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
        cookieDurationDays: customDays,
        maxOrdersPerCookieSession: maxOrdersVal,
        commissionModel: formCommissionModel,
        productCommissions: formCommissionModel === 'by_product' ? formProductCommissions : undefined,
        tieredCommissions: formCommissionModel === 'tiered' ? formTieredCommissions : undefined,
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
                            {rate}%
                          </span>
                          {aff.commissionModel === 'by_product' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-50 text-amber-700 font-bold border border-amber-200 whitespace-nowrap" title={`${aff.productCommissions?.length || 0} sản phẩm có % riêng`}>
                              SP riêng ({aff.productCommissions?.length || 0})
                            </span>
                          )}
                          {aff.commissionModel === 'tiered' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 whitespace-nowrap" title={`${aff.tieredCommissions?.length || 0} bậc doanh thu`}>
                              Bậc DT ({aff.tieredCommissions?.length || 0})
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                            <span title="Thời hạn cookie">{aff.cookieDurationDays ? `${aff.cookieDurationDays}d` : `${config.cookieDurationDays || 30}d`}</span>
                            <span>&bull;</span>
                            <span title="Số đơn ghi nhận">{aff.maxOrdersPerCookieSession === 0 ? 'Vô hạn' : (aff.maxOrdersPerCookieSession && aff.maxOrdersPerCookieSession > 1 ? `${aff.maxOrdersPerCookieSession} đơn` : '1 đơn')}</span>
                          </div>
                        </div>
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
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  {editingAffiliate ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingAffiliate ? 'Chỉnh Sửa Đối Tác Tiếp Thị' : 'Tạo Đối Tác Tiếp Thị Mới'}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Cấp tài khoản đăng nhập, link tiếp thị và chính sách hoa hồng riêng
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

            <form onSubmit={handleSaveAffiliate} className="p-6 space-y-5 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Basic Partner Info */}
              <div className="space-y-4">
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
                      Email Google (đăng nhập Firebase) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formGoogleEmail}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormGoogleEmail(val);
                        if (!editingAffiliate && val.includes('@')) {
                          const googleAccName = val.split('@')[0].trim();
                          if (!formName) {
                            setFormName(googleAccName);
                          }
                          const cleanCode = googleAccName.toUpperCase().replace(/[^A-Z0-9]/g, '');
                          if (cleanCode && (!formAffiliateCode || formAffiliateCode.startsWith('NAK') || formAffiliateCode.startsWith('AN'))) {
                            setFormAffiliateCode(cleanCode);
                          }
                        }
                      }}
                      placeholder="VD: doitao@gmail.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Chỉ email này mới có quyền đăng nhập vào cổng Affiliate
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
                      Tỷ lệ hoa hồng cơ bản (%) <span className="text-rose-500">*</span>
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
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Áp dụng chung hoặc làm mức sàn cho các sản phẩm chưa có mức riêng
                    </p>
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
              </div>

              {/* 2. SECTION: COOKIE DURATION & MAX ORDERS SETTINGS */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-4">
                <div className="flex items-center gap-2 text-amber-900">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    Cài Đặt Cookie & Giới Hạn Đơn Hàng Cho Đối Tác
                  </h4>
                </div>

                {/* Cookie Duration */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      Thời hạn lưu Cookie trên trình duyệt khách (ngày)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Mặc định shop: <strong>{config.cookieDurationDays || 30} ngày</strong>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formCookieDays}
                      onChange={(e) => setFormCookieDays(e.target.value)}
                      placeholder={`Mặc định (${config.cookieDurationDays || 30} ngày)`}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:border-amber-500 outline-none font-mono font-bold"
                    />
                    {formCookieDays && (
                      <button
                        type="button"
                        onClick={() => setFormCookieDays('')}
                        className="px-2.5 py-2 text-[11px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl whitespace-nowrap cursor-pointer"
                        title="Dùng mặc định hệ thống"
                      >
                        Đặt lại
                      </button>
                    )}
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: `Mặc định (${config.cookieDurationDays || 30}d)`, val: '' },
                      { label: '7 ngày', val: '7' },
                      { label: '30 ngày', val: '30' },
                      { label: '60 ngày', val: '60' },
                      { label: '90 ngày', val: '90' }
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setFormCookieDays(chip.val)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          formCookieDays === chip.val
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-amber-100/80 border border-slate-200'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Sau khi khách hàng nhấp link tiếp thị, cookie sẽ có hiệu lực trong số ngày này trước khi tự động hết hạn.
                  </p>
                </div>

                {/* Max orders per cookie session */}
                <div className="pt-3 border-t border-amber-200/60">
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Số đơn hàng được ghi nhận hoa hồng trên một Session Cookie
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Mode 1: First order only */}
                    <button
                      type="button"
                      onClick={() => setFormMaxOrdersMode('first_only')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        formMaxOrdersMode === 'first_only'
                          ? 'bg-white border-amber-500 shadow-sm ring-1 ring-amber-400'
                          : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-slate-900">1 đơn đầu tiên</span>
                        {formMaxOrdersMode === 'first_only' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Sau khi khách đặt thành công đơn thứ nhất, cookie sẽ kết thúc.
                      </p>
                    </button>

                    {/* Mode 2: Custom max orders */}
                    <button
                      type="button"
                      onClick={() => setFormMaxOrdersMode('custom')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        formMaxOrdersMode === 'custom'
                          ? 'bg-white border-amber-500 shadow-sm ring-1 ring-amber-400'
                          : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-slate-900">Số đơn cụ thể</span>
                        {formMaxOrdersMode === 'custom' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Ghi nhận tối đa X đơn trong suốt thời gian cookie còn hạn.
                      </p>
                    </button>

                    {/* Mode 3: Unlimited */}
                    <button
                      type="button"
                      onClick={() => setFormMaxOrdersMode('unlimited')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        formMaxOrdersMode === 'unlimited'
                          ? 'bg-white border-amber-500 shadow-sm ring-1 ring-amber-400'
                          : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-slate-900">Không giới hạn</span>
                        {formMaxOrdersMode === 'unlimited' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Mọi đơn hàng phát sinh trong thời hạn cookie đều được tính hoa hồng.
                      </p>
                    </button>
                  </div>

                  {/* Input for custom number of orders */}
                  {formMaxOrdersMode === 'custom' && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-white border border-amber-300 flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-700 shrink-0">
                        Số lượng đơn tối đa:
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="100"
                        value={formMaxOrdersCustom}
                        onChange={(e) => setFormMaxOrdersCustom(e.target.value)}
                        placeholder="3"
                        className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-900 bg-slate-50 focus:bg-white focus:border-amber-500 outline-none"
                      />
                      <span className="text-[11px] text-slate-500">
                        (VD: 2 đơn, 3 đơn, 5 đơn...)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. SECTION: ADVANCED COMMISSION MODEL */}
              <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80 space-y-4">
                <div className="flex items-center gap-2 text-purple-900">
                  <Sparkles className="w-4 h-4 text-purple-700" />
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    Cài Đặt Hoa Hồng Nâng Cao
                  </h4>
                </div>

                {/* Model Selector Tabs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormCommissionModel('standard')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formCommissionModel === 'standard'
                        ? 'bg-white border-purple-500 shadow-sm ring-1 ring-purple-400'
                        : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900">Cố định cơ bản</span>
                      {formCommissionModel === 'standard' && <Check className="w-3.5 h-3.5 text-purple-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Áp dụng {formCommissionRate}% cho mọi sản phẩm và đơn hàng.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormCommissionModel('by_product')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formCommissionModel === 'by_product'
                        ? 'bg-white border-purple-500 shadow-sm ring-1 ring-purple-400'
                        : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900">Theo từng sản phẩm</span>
                      {formCommissionModel === 'by_product' && <Check className="w-3.5 h-3.5 text-purple-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Cấu hình % hoa hồng riêng cho từng sản phẩm cụ thể.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormCommissionModel('tiered')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formCommissionModel === 'tiered'
                        ? 'bg-white border-purple-500 shadow-sm ring-1 ring-purple-400'
                        : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900">Theo mức doanh thu</span>
                      {formCommissionModel === 'tiered' && <Check className="w-3.5 h-3.5 text-purple-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Hoa hồng lũy tiến theo giá trị đơn hàng (VNĐ).
                    </p>
                  </button>
                </div>

                {/* Sub-view: Product-specific commissions */}
                {formCommissionModel === 'by_product' && (
                  <div className="p-3 bg-white rounded-xl border border-purple-200 space-y-3">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Thiết lập hoa hồng riêng cho từng sản phẩm</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        Còn lại tính {formCommissionRate}%
                      </span>
                    </div>

                    {/* Add Product Row */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={productToAddId}
                        onChange={(e) => setProductToAddId(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-purple-500 outline-none"
                      >
                        <option value="">-- Chọn sản phẩm cần đặt % riêng --</option>
                        {PRODUCTS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.price.toLocaleString('vi-VN')}đ)
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2">
                        <div className="relative w-24">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={productToAddRate}
                            onChange={(e) => setProductToAddRate(e.target.value)}
                            placeholder="15"
                            className="w-full px-3 py-2 pr-7 rounded-xl border border-slate-200 text-xs font-mono font-bold bg-slate-50 focus:bg-white outline-none"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddProductOverride}
                          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
                        >
                          Thêm SP
                        </button>
                      </div>
                    </div>

                    {/* List of configured product overrides */}
                    {formProductCommissions.length > 0 ? (
                      <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto border border-slate-100 rounded-xl">
                        {formProductCommissions.map((p) => (
                          <div key={p.productId} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                            <div>
                              <span className="font-bold text-slate-800">{p.productName || p.productId}</span>
                              <span className="text-[10px] text-slate-400 font-mono ml-2">ID: {p.productId}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono font-bold text-xs">
                                {p.rate}%
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveProductOverride(p.productId)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                title="Xóa mức riêng"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic text-center py-2">
                        Chưa có sản phẩm nào được đặt % riêng. Chọn sản phẩm phía trên để thêm.
                      </p>
                    )}
                  </div>
                )}

                {/* Sub-view: Tiered by Revenue */}
                {formCommissionModel === 'tiered' && (
                  <div className="p-3 bg-white rounded-xl border border-purple-200 space-y-3">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Bậc hoa hồng theo giá trị tiền hàng (VNĐ)</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        Chưa bao gồm phí ship
                      </span>
                    </div>

                    {/* Add Tier Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Từ mức (VNĐ)</span>
                        <input
                          type="number"
                          min="0"
                          step="10000"
                          value={tierMinInput}
                          onChange={(e) => setTierMinInput(e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-slate-50 focus:bg-white outline-none"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Đến mức (bỏ trống = vô hạn)</span>
                        <input
                          type="number"
                          min="0"
                          step="10000"
                          value={tierMaxInput}
                          onChange={(e) => setTierMaxInput(e.target.value)}
                          placeholder="Không giới hạn"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-slate-50 focus:bg-white outline-none"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">% Hoa hồng</span>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={tierRateInput}
                            onChange={(e) => setTierRateInput(e.target.value)}
                            placeholder="8"
                            className="w-full px-2.5 py-1.5 pr-6 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-slate-50 focus:bg-white outline-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                        </div>
                      </div>

                      <div className="sm:pt-4">
                        <button
                          type="button"
                          onClick={handleAddRevenueTier}
                          className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors cursor-pointer"
                        >
                          Thêm bậc
                        </button>
                      </div>
                    </div>

                    {/* List of configured tiers */}
                    {formTieredCommissions.length > 0 ? (
                      <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto border border-slate-100 rounded-xl">
                        {formTieredCommissions.map((tier, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                            <div className="font-mono">
                              <span className="font-bold text-slate-900">
                                {tier.minAmount.toLocaleString('vi-VN')}đ
                              </span>
                              <span className="text-slate-400 mx-1.5">&rarr;</span>
                              <span className="font-bold text-slate-900">
                                {tier.maxAmount && tier.maxAmount > 0 ? `${tier.maxAmount.toLocaleString('vi-VN')}đ` : 'Trở lên (&infin;)'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono font-bold text-xs">
                                {tier.rate}%
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveRevenueTier(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                title="Xóa bậc"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic text-center py-2">
                        Chưa có bậc doanh thu nào. Thêm các bậc từ thấp đến cao ở trên.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 sticky bottom-0 bg-white">
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
