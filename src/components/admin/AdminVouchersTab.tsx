import React, { useState, useEffect, useMemo } from 'react';
import { Voucher, VoucherType, StoredOrder, Product, SellerUser } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';
import {
  getVouchers,
  saveVoucher,
  deleteVoucher,
  verifyVoucherIntegrity,
  generateVoucherEncryption
} from '../../utils/voucherManager';
import { getOrdersFromFirestore } from '../../firebase';
import { isRootAdminUser, getAdminSession } from '../../utils/auth';
import { formatOrderDateWithoutSeconds } from '../../utils/orderFormatters';
import { AdminTabHeader } from './AdminTabHeader';
import {
  Ticket,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Percent,
  Truck,
  Calendar,
  AlertCircle,
  RefreshCw,
  Search,
  Check,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Eye,
  ArrowUpDown,
  FileText,
  User,
  Phone,
  Clock,
  Sparkles,
  Package,
  Layers,
  HelpCircle
} from 'lucide-react';

interface AdminVouchersTabProps {
  orders?: StoredOrder[];
  products?: Product[];
  currentSeller?: Partial<SellerUser> | null;
  isRootAdmin?: boolean;
  onInspectOrder?: (order: StoredOrder) => void;
}

interface VoucherStats {
  usageCount: number;
  cancelledCount: number;
  totalDiscountAmount: number;
  totalRevenue: number;
  orders: StoredOrder[];
}

export const AdminVouchersTab: React.FC<AdminVouchersTabProps> = ({
  orders: propsOrders,
  products: propsProducts,
  currentSeller: propsSeller,
  isRootAdmin: propsIsRoot,
  onInspectOrder
}) => {
  const sessionUser = propsSeller || getAdminSession();
  const isRoot = Boolean(propsIsRoot ?? isRootAdminUser(sessionUser));

  // Format order date safely to eliminate "Invalid Date"
  const formatOrderDateSafe = (ord: any): string => {
    const rawDate = ord.date || ord.createdAt || ord.timestamp;
    if (rawDate) {
      const formatted = formatOrderDateWithoutSeconds(rawDate);
      if (formatted && formatted !== 'N/A' && !formatted.includes('Invalid') && !formatted.includes('NaN')) {
        return formatted;
      }
    }

    // Fallback: extract date from order ID pattern (e.g. NAK-260924-3219 -> 24/09/2026)
    const ordId = String(ord.id || ord.trackingNumber || '');
    const match = ordId.match(/NAK-(\d{2})(\d{2})(\d{2})-/i);
    if (match) {
      const day = match[3];
      const month = match[2];
      const year = `20${match[1]}`;
      return `${day}/${month}/${year}`;
    }

    return 'Mới đây';
  };

  // Format voucher creation date safely (never display Invalid Date or fake fallback)
  const formatVoucherDateSafe = (rawDate?: string): string => {
    if (!rawDate) return 'Không có';
    const formatted = formatOrderDateWithoutSeconds(rawDate);
    if (formatted && formatted !== 'N/A' && !formatted.includes('Invalid') && !formatted.includes('NaN')) {
      return formatted;
    }
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return 'Không có';
  };

  // Get authentic human creator name, never showing fake titles (Tổng bí thư, Bộ trưởng, Hệ thống)
  const getDisplayCreator = (creator?: string, voucherCode?: string): string | null => {
    if (voucherCode && voucherCode.toUpperCase().includes('HUY')) {
      return 'Trần Việt Huy';
    }
    if (!creator) return null;
    const trimmed = creator.trim();
    const fakeTitles = ['tổng bí thư', 'bộ trưởng', 'chủ tịch nước', 'quản trị viên', 'hệ thống', 'admin'];
    if (fakeTitles.includes(trimmed.toLowerCase())) return null;
    return trimmed;
  };

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [internalOrders, setInternalOrders] = useState<StoredOrder[]>(propsOrders || []);
  const [availableProducts, setAvailableProducts] = useState<Product[]>(propsProducts || []);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [filterType, setFilterType] = useState<'all' | 'has_usage' | 'no_usage' | 'active' | 'percent' | 'freeship'>('all');
  const [sortBy, setSortBy] = useState<'usage_desc' | 'discount_desc' | 'revenue_desc' | 'newest' | 'code_asc'>('usage_desc');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [inspectingVoucherStats, setInspectingVoucherStats] = useState<{ voucher: Voucher; stats: VoucherStats } | null>(null);

  // Verification status map: voucherId -> boolean
  const [integrityMap, setIntegrityMap] = useState<Record<string, boolean>>({});

  // Form states
  const [code, setCode] = useState<string>('');
  const [type, setType] = useState<VoucherType>('percent');
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [minOrderValue, setMinOrderValue] = useState<number>(0);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [applyToAllProducts, setApplyToAllProducts] = useState<boolean>(true);
  const [applicableProductIds, setApplicableProductIds] = useState<string[]>([]);
  const [maxApplicableQuantity, setMaxApplicableQuantity] = useState<number>(0);
  const [usageLimit, setUsageLimit] = useState<number>(0);
  const [createdByInput, setCreatedByInput] = useState<string>('');
  const [productSearchInModal, setProductSearchInModal] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load products if not supplied via props
  useEffect(() => {
    if (propsProducts && propsProducts.length > 0) {
      setAvailableProducts(propsProducts);
    } else {
      try {
        const local = JSON.parse(localStorage.getItem('nak_custom_products') || '[]');
        if (Array.isArray(local) && local.length > 0) {
          setAvailableProducts(local);
        }
      } catch {}
    }
  }, [propsProducts]);

  // Sync props orders if available or load fallback
  useEffect(() => {
    if (propsOrders && propsOrders.length > 0) {
      setInternalOrders(propsOrders);
    } else {
      try {
        const local = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
        if (Array.isArray(local) && local.length > 0) {
          setInternalOrders(local);
        }
      } catch {}
      getOrdersFromFirestore().then((fsOrders) => {
        if (fsOrders && fsOrders.length > 0) {
          setInternalOrders(fsOrders as any);
        }
      }).catch(() => {});
    }
  }, [propsOrders]);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const data = await getVouchers();
      setVouchers(data);

      // Verify integrity for all vouchers
      const map: Record<string, boolean> = {};
      for (const v of data) {
        map[v.id] = await verifyVoucherIntegrity(v);
      }
      setIntegrityMap(map);
    } catch (err) {
      console.error('Lỗi tải mã giảm giá:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVouchers();
  }, []);

  // Helper to check if a product is hidden
  const isProductHidden = (prod: Product) => {
    if (prod.isHidden === true || String(prod.isHidden) === 'true') return true;
    try {
      const localCats = JSON.parse(localStorage.getItem('nak_custom_categories') || '[]');
      if (Array.isArray(localCats) && prod.category) {
        const cat = localCats.find((c: any) => c.id === prod.category);
        if (cat && (cat.isHidden === true || String(cat.isHidden) === 'true')) return true;
      }
    } catch {}
    return false;
  };

  // Products filtered in modal - sản phẩm bị ẩn đẩy xuống dưới cùng
  const filteredProductsInModal = useMemo(() => {
    let list = availableProducts;
    if (productSearchInModal.trim()) {
      const q = productSearchInModal.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const aHidden = isProductHidden(a);
      const bHidden = isProductHidden(b);
      if (aHidden !== bHidden) {
        return aHidden ? 1 : -1; // Sản phẩm hiển thị ở trên, sản phẩm bị ẩn đẩy xuống dưới
      }
      return 0;
    });
  }, [availableProducts, productSearchInModal]);

  // Compute usage counts, discounts, and revenue per voucher
  const voucherStatsMap = useMemo(() => {
    const statsMap: Record<string, VoucherStats> = {};
    const activeOrders = (internalOrders || []).filter((o) => !o.isDeleted);

    vouchers.forEach((v) => {
      statsMap[v.id] = {
        usageCount: 0,
        cancelledCount: 0,
        totalDiscountAmount: 0,
        totalRevenue: 0,
        orders: []
      };
    });

    const isMatchVoucher = (orderVoucherCode: string | undefined, targetCode: string) => {
      if (!orderVoucherCode) return false;
      const target = targetCode.toUpperCase().trim();
      const raw = orderVoucherCode.toUpperCase().trim();
      if (raw === target) return true;
      const tokens = raw.split(/[\s,+&/|]+/).map((t) => t.trim()).filter(Boolean);
      return tokens.includes(target);
    };

    activeOrders.forEach((ord) => {
      if (!ord.voucherCode) return;
      const isCancelled = ord.status === 'cancelled' || ord.status === 'Đã hủy';

      vouchers.forEach((v) => {
        if (isMatchVoucher(ord.voucherCode, v.code)) {
          const stats = statsMap[v.id];
          if (!stats) return;

          stats.orders.push(ord);

          if (isCancelled) {
            stats.cancelledCount += 1;
          } else {
            stats.usageCount += 1;
            stats.totalRevenue += (ord.totalPrice || ord.totalAmount || 0);

            // Calculate discount amount given for this voucher
            let discount = 0;
            if (v.type === 'percent') {
              if (ord.voucherDiscountAmount !== undefined && ord.voucherDiscountAmount > 0) {
                discount = ord.voucherDiscountAmount;
              } else if (ord.discountAmount !== undefined && ord.discountAmount > 0) {
                discount = ord.discountAmount;
              } else {
                const baseVal = ord.totalPrice || ord.totalAmount || 0;
                if (baseVal > 0 && v.discountPercent) {
                  let est = Math.round((baseVal * v.discountPercent) / 100);
                  if (v.maxDiscountAmount && v.maxDiscountAmount > 0) {
                    est = Math.min(est, v.maxDiscountAmount);
                  }
                  discount = est;
                }
              }
            } else if (v.type === 'freeship') {
              if (ord.voucherType === 'freeship' && ord.voucherDiscountAmount && ord.voucherDiscountAmount > 0) {
                discount = ord.voucherDiscountAmount;
              }
            } else {
              discount = ord.voucherDiscountAmount || ord.discountAmount || 0;
            }

            stats.totalDiscountAmount += discount;
          }
        }
      });
    });

    return statsMap;
  }, [vouchers, internalOrders]);

  // Global aggregate metrics
  const globalMetrics = useMemo(() => {
    let totalUsages = 0;
    let totalDiscount = 0;
    let totalRev = 0;
    let activeVouchersCount = 0;

    vouchers.forEach((v) => {
      if (v.isActive) activeVouchersCount++;
      const s = voucherStatsMap[v.id];
      if (s) {
        totalUsages += s.usageCount;
        totalDiscount += s.totalDiscountAmount;
        totalRev += s.totalRevenue;
      }
    });

    return {
      totalVouchers: vouchers.length,
      activeVouchersCount,
      totalUsages,
      totalDiscount,
      totalRev
    };
  }, [vouchers, voucherStatsMap]);

  const handleOpenAddModal = () => {
    setEditingVoucher(null);
    setCode('');
    setType('percent');
    setDiscountPercent(10);
    setMinOrderValue(100000);
    setMaxDiscountAmount(50000);
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    // Default 30 days from now
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    setEndDate(nextMonth.toISOString().split('T')[0]);
    setIsActive(true);
    setApplyToAllProducts(true);
    setApplicableProductIds([]);
    setMaxApplicableQuantity(0);
    setUsageLimit(0);
    const realUserName = sessionUser?.name && !['tổng bí thư', 'bộ trưởng', 'chủ tịch nước', 'quản trị viên', 'hệ thống', 'admin'].includes(sessionUser.name.trim().toLowerCase())
      ? sessionUser.name
      : '';
    setCreatedByInput(realUserName);
    setProductSearchInModal('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (v: Voucher) => {
    setEditingVoucher(v);
    setCode(v.code);
    setType(v.type);
    setDiscountPercent(v.discountPercent || 10);
    setMinOrderValue(v.minOrderValue || 0);
    setMaxDiscountAmount(v.maxDiscountAmount || 0);
    setStartDate(v.startDate ? v.startDate.split('T')[0] : '');
    setEndDate(v.endDate ? v.endDate.split('T')[0] : '');
    setIsActive(v.isActive);
    setApplyToAllProducts(v.applyToAllProducts ?? true);
    setApplicableProductIds(v.applicableProductIds || []);
    setMaxApplicableQuantity(v.maxApplicableQuantity || 0);
    setUsageLimit(v.usageLimit || 0);
    const existingCreator = v.createdBy && !['tổng bí thư', 'bộ trưởng', 'chủ tịch nước', 'quản trị viên', 'hệ thống', 'admin'].includes(v.createdBy.trim().toLowerCase())
      ? v.createdBy
      : (v.code.toUpperCase().includes('HUY') ? 'Trần Việt Huy' : '');
    setCreatedByInput(existingCreator);
    setProductSearchInModal('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setFormError('Vui lòng nhập mã giảm giá.');
      return;
    }

    if (type === 'percent' && (discountPercent <= 0 || discountPercent > 100)) {
      setFormError('Phần trăm giảm giá phải từ 1% đến 100%.');
      return;
    }

    if (!applyToAllProducts && applicableProductIds.length === 0) {
      setFormError('Bạn đang chọn "Chỉ áp dụng cho sản phẩm cụ thể", vui lòng tick chọn ít nhất 1 sản phẩm.');
      return;
    }

    setIsSaving(true);
    try {
      const voucherId = editingVoucher ? editingVoucher.id : `VOUCHER_${Date.now()}`;
      const cleanCreator = createdByInput.trim();
      const isFakeTitle = ['tổng bí thư', 'bộ trưởng', 'chủ tịch nước', 'quản trị viên', 'hệ thống', 'admin'].includes(cleanCreator.toLowerCase());
      let creatorName: string | undefined = undefined;
      if (cleanCreator && !isFakeTitle) {
        creatorName = cleanCreator;
      } else if (cleanCode.includes('HUY')) {
        creatorName = 'Trần Việt Huy';
      } else if (editingVoucher?.createdBy && !['tổng bí thư', 'bộ trưởng', 'chủ tịch nước', 'quản trị viên', 'hệ thống', 'admin'].includes(editingVoucher.createdBy.trim().toLowerCase())) {
        creatorName = editingVoucher.createdBy;
      }

      const createdAtVal = editingVoucher?.createdAt || new Date().toISOString();
      const realUpdater = sessionUser?.name && !['tổng bí thư', 'bộ trưởng', 'chủ tịch nước', 'quản trị viên', 'hệ thống', 'admin'].includes(sessionUser.name.trim().toLowerCase())
        ? sessionUser.name
        : undefined;

      const payloadWithoutEncrypt: Omit<Voucher, 'encryptedData'> = {
        id: voucherId,
        code: cleanCode,
        type,
        discountPercent: type === 'percent' ? Number(discountPercent) : 0,
        minOrderValue: Number(minOrderValue) || 0,
        maxDiscountAmount: type === 'percent' ? Number(maxDiscountAmount) || 0 : 0,
        startDate,
        endDate,
        isActive,
        applyToAllProducts,
        applicableProductIds: applyToAllProducts ? [] : applicableProductIds,
        maxApplicableQuantity: Number(maxApplicableQuantity) > 0 ? Number(maxApplicableQuantity) : 0,
        usageLimit: Number(usageLimit) > 0 ? Number(usageLimit) : undefined,
        createdAt: createdAtVal,
        createdBy: creatorName,
        updatedAt: new Date().toISOString(),
        updatedBy: realUpdater
      };

      const encryptedData = await generateVoucherEncryption(payloadWithoutEncrypt);
      const finalVoucher: Voucher = {
        ...payloadWithoutEncrypt,
        encryptedData
      };

      await saveVoucher(finalVoucher);
      setIsModalOpen(false);
      await loadVouchers();
    } catch (err) {
      console.error('Lỗi khi lưu voucher:', err);
      setFormError('Không thể lưu mã giảm giá. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (v: Voucher) => {
    try {
      const updated = { ...v, isActive: !v.isActive };
      await saveVoucher(updated);
      await loadVouchers();
    } catch (err) {
      alert('Không thể cập nhật trạng thái mã.');
    }
  };

  const handleDelete = async (voucherId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mã giảm giá này?')) return;
    try {
      await deleteVoucher(voucherId);
      await loadVouchers();
    } catch (err) {
      alert('Không thể xóa mã giảm giá.');
    }
  };

  // Filter & Sort
  const processedVouchers = useMemo(() => {
    let list = vouchers.filter((v) =>
      !debouncedSearchQuery || v.code.toLowerCase().includes(debouncedSearchQuery.toLowerCase().trim())
    );

    if (filterType === 'has_usage') {
      list = list.filter((v) => (voucherStatsMap[v.id]?.usageCount || 0) > 0);
    } else if (filterType === 'no_usage') {
      list = list.filter((v) => (voucherStatsMap[v.id]?.usageCount || 0) === 0);
    } else if (filterType === 'active') {
      list = list.filter((v) => v.isActive);
    } else if (filterType === 'percent') {
      list = list.filter((v) => v.type === 'percent');
    } else if (filterType === 'freeship') {
      list = list.filter((v) => v.type === 'freeship');
    }

    return list.sort((a, b) => {
      const sA = voucherStatsMap[a.id] || { usageCount: 0, totalDiscountAmount: 0, totalRevenue: 0 };
      const sB = voucherStatsMap[b.id] || { usageCount: 0, totalDiscountAmount: 0, totalRevenue: 0 };

      if (sortBy === 'usage_desc') {
        if (sB.usageCount !== sA.usageCount) return sB.usageCount - sA.usageCount;
        return sB.totalDiscountAmount - sA.totalDiscountAmount;
      }
      if (sortBy === 'discount_desc') {
        return sB.totalDiscountAmount - sA.totalDiscountAmount;
      }
      if (sortBy === 'revenue_desc') {
        return sB.totalRevenue - sA.totalRevenue;
      }
      if (sortBy === 'code_asc') {
        return a.code.localeCompare(b.code);
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return 0;
    });
  }, [vouchers, debouncedSearchQuery, filterType, sortBy, voucherStatsMap]);

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <AdminTabHeader
        icon={<Ticket className="w-5 h-5 text-amber-800" />}
        iconBgColor="bg-amber-100 text-amber-900 border-amber-200"
        eyebrow="Khuyến Mãi & Giảm Giá"
        title="Quản Lý & Thống Kê Voucher"
        badge={
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold flex items-center gap-1 shadow-2xs">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Đo lường tự động
          </span>
        }
        description="Theo dõi chính xác số lượt áp dụng, tổng tiền đã giảm và doanh thu mang lại của từng mã giảm giá."
        actions={
          <>
            <button
              type="button"
              onClick={loadVouchers}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all shadow-2xs cursor-pointer"
              title="Tải lại danh sách"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Tạo Mã Mới</span>
            </button>
          </>
        }
      />

      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Vouchers */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Tổng Số Voucher
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-800">
              <Ticket className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900">{globalMetrics.totalVouchers}</span>
            <span className="text-xs text-slate-500 font-medium">mã</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Đang kích hoạt: <strong className="text-emerald-700">{globalMetrics.activeVouchersCount} mã</strong>
          </div>
        </div>

        {/* Total Usages */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Tổng Lượt Sử Dụng
            </span>
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-800">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-sky-700">{globalMetrics.totalUsages}</span>
            <span className="text-xs text-slate-500 font-medium">lượt đặt hàng</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Trên các đơn hàng hợp lệ của cửa hàng
          </div>
        </div>

        {/* Total Discount Amount */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Tổng Tiền Đã Giảm
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
            {globalMetrics.totalDiscount.toLocaleString('vi-VN')}đ
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ưu đãi trực tiếp đến khách hàng
          </div>
        </div>

        {/* Total Generated Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Doanh Thu Kích Cầu
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-800">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-2 font-mono">
            {globalMetrics.totalRev.toLocaleString('vi-VN')}đ
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tổng giá trị từ các đơn áp mã voucher
          </div>
        </div>
      </div>

      {/* Search, Filters, & Sorting Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo mã voucher (VD: KNOT10, NAKNEW)..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-neutral-950 transition-colors shadow-2xs"
            />
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-2.5 pointer-events-none" />
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-500 flex items-center gap-1 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5" /> Sắp xếp:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 focus:outline-none focus:border-neutral-950 cursor-pointer"
            >
              <option value="usage_desc">Lượt dùng nhiều nhất</option>
              <option value="discount_desc">Tổng tiền giảm nhiều nhất</option>
              <option value="revenue_desc">Doanh thu cao nhất</option>
              <option value="newest">Mới tạo nhất</option>
              <option value="code_asc">Mã voucher (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-neutral-100">
          {[
            { id: 'all', label: `Tất cả (${vouchers.length})` },
            { id: 'has_usage', label: `Đã có lượt dùng (${vouchers.filter((v) => (voucherStatsMap[v.id]?.usageCount || 0) > 0).length})` },
            { id: 'no_usage', label: `Chưa có lượt dùng (${vouchers.filter((v) => (voucherStatsMap[v.id]?.usageCount || 0) === 0).length})` },
            { id: 'active', label: `Đang bật (${vouchers.filter((v) => v.isActive).length})` },
            { id: 'percent', label: `Giảm % (${vouchers.filter((v) => v.type === 'percent').length})` },
            { id: 'freeship', label: `Freeship (${vouchers.filter((v) => v.type === 'freeship').length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                filterType === tab.id
                  ? 'bg-neutral-950 text-white shadow-2xs'
                  : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vouchers Grid / Table */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-xs text-neutral-500 font-medium">Đang tải danh sách voucher và dữ liệu sử dụng...</p>
        </div>
      ) : processedVouchers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-3">
          <Ticket className="w-10 h-10 text-neutral-300 mx-auto" />
          <p className="text-sm font-bold text-neutral-700">Không tìm thấy mã giảm giá nào phù hợp</p>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {searchQuery ? 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.' : 'Bấm "Tạo Mã Mới" để tạo chương trình ưu đãi đầu tiên.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {processedVouchers.map((v) => {
            const isVerified = integrityMap[v.id] ?? false;
            const now = new Date();
            const isExpired = v.endDate && new Date(v.endDate).setHours(23, 59, 59, 999) < now.getTime();
            const isNotStartedYet = v.startDate && new Date(v.startDate).setHours(0, 0, 0, 0) > now.getTime();
            const stats = voucherStatsMap[v.id] || { usageCount: 0, cancelledCount: 0, totalDiscountAmount: 0, totalRevenue: 0, orders: [] };

            return (
              <div
                key={v.id}
                className={`bg-white rounded-2xl border ${
                  v.isActive && !isExpired ? 'border-neutral-200 shadow-2xs hover:border-amber-400' : 'border-neutral-200/60 opacity-80 bg-neutral-50/50'
                } p-5 space-y-4 flex flex-col justify-between relative overflow-hidden transition-all`}
              >
                {/* Header Tag & Active Toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-lg text-neutral-950 tracking-wider bg-amber-100 text-amber-950 px-3 py-1 rounded-lg border border-amber-300">
                        {v.code}
                      </span>
                      {v.type === 'freeship' ? (
                        <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-sky-200">
                          <Truck className="w-3 h-3 text-sky-600" />
                          Freeship
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                          <Percent className="w-3 h-3 text-emerald-600" />
                          Giảm {v.discountPercent}%
                        </span>
                      )}

                      {v.applyToAllProducts === false && v.applicableProductIds && v.applicableProductIds.length > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-purple-200">
                          <Layers className="w-3 h-3 text-purple-600" />
                          Chỉ {v.applicableProductIds.length} SP
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-700 text-[11px] font-bold px-2 py-0.5 rounded-md">
                          <Package className="w-3 h-3 text-neutral-500" />
                          Tất cả SP
                        </span>
                      )}

                      {v.maxApplicableQuantity && v.maxApplicableQuantity > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-blue-200">
                          Tối đa {v.maxApplicableQuantity} món
                        </span>
                      ) : null}

                      {v.usageLimit && v.usageLimit > 0 ? (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          stats.usageCount >= v.usageLimit
                            ? 'bg-rose-50 text-rose-800 border-rose-300 font-black'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}>
                          {stats.usageCount >= v.usageLimit ? 'Hết lượt dùng' : `Tối đa ${v.usageLimit} lượt`}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(v)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                      v.isActive
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                    }`}
                  >
                    {v.isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-neutral-500" />}
                    <span>{v.isActive ? 'Đang bật' : 'Tắt'}</span>
                  </button>
                </div>

                {/* PROMINENT USAGE & DISCOUNT STATS BOX */}
                <div className="p-3 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/40 rounded-xl border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-amber-200/50">
                    <span className="font-bold text-neutral-600 flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-amber-700" /> Số lượt sử dụng:
                    </span>
                    <span className="font-black text-sm text-neutral-950 font-mono">
                      {stats.usageCount}
                      {v.usageLimit && v.usageLimit > 0 ? (
                        <span className="text-xs font-bold text-neutral-600"> / {v.usageLimit}</span>
                      ) : null}
                      <span className="text-xs font-normal text-neutral-500"> lượt</span>
                      {v.usageLimit && v.usageLimit > 0 && stats.usageCount >= v.usageLimit && (
                        <span className="text-[10px] text-rose-600 font-bold ml-1.5 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          HẾT LƯỢT
                        </span>
                      )}
                      {stats.cancelledCount > 0 && (
                        <span className="text-[10px] text-rose-600 font-normal ml-1">({stats.cancelledCount} hủy)</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pb-2 border-b border-amber-200/50">
                    <span className="font-bold text-neutral-600 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-700" /> Tổng tiền đã giảm:
                    </span>
                    <span className="font-black text-sm text-emerald-700 font-mono">
                      {stats.totalDiscountAmount > 0 ? `-${stats.totalDiscountAmount.toLocaleString('vi-VN')}đ` : '0đ'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-600 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-700" /> Doanh thu kích cầu:
                    </span>
                    <span className="font-bold text-xs text-indigo-950 font-mono">
                      {stats.totalRevenue.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  {stats.orders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setInspectingVoucherStats({ voucher: v, stats })}
                      className="w-full mt-1.5 py-1.5 px-2 bg-white hover:bg-amber-100/60 border border-amber-300/80 rounded-lg text-[11px] font-bold text-amber-950 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-800" />
                      <span>Xem {stats.orders.length} đơn hàng đã áp dụng</span>
                    </button>
                  )}
                </div>

                {/* Configuration Details */}
                <div className="space-y-1.5 text-xs text-neutral-600 bg-neutral-50/80 p-3 rounded-xl border border-neutral-100">
                  {v.type === 'percent' && (
                    <div className="flex justify-between">
                      <span>Mức giảm tối đa:</span>
                      <strong className="text-neutral-900 font-mono">
                        {v.maxDiscountAmount ? `${v.maxDiscountAmount.toLocaleString('vi-VN')}đ` : 'Không giới hạn'}
                      </strong>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Đơn tối thiểu:</span>
                    <strong className="text-neutral-900 font-mono">
                      {v.minOrderValue ? `${v.minOrderValue.toLocaleString('vi-VN')}đ` : '0đ'}
                    </strong>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Sản phẩm áp dụng:</span>
                    <span className="font-bold text-neutral-900">
                      {v.applyToAllProducts === false && v.applicableProductIds && v.applicableProductIds.length > 0
                        ? `Chỉ ${v.applicableProductIds.length} sản phẩm chỉ định`
                        : 'Tất cả sản phẩm'}
                    </span>
                  </div>

                  {v.maxApplicableQuantity && v.maxApplicableQuantity > 0 ? (
                    <div className="flex justify-between items-center text-blue-900 bg-blue-50/80 px-2 py-1 rounded-lg">
                      <span className="font-bold">Giới hạn số lượng:</span>
                      <span className="font-mono font-black">Tối đa {v.maxApplicableQuantity} SP/đơn</span>
                    </div>
                  ) : null}

                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-neutral-200/60">
                    <span className="flex items-center gap-1 text-neutral-500">
                      <Calendar className="w-3 h-3" /> Hạn dùng:
                    </span>
                    <span className="font-medium text-neutral-800">
                      {v.startDate ? new Date(v.startDate).toLocaleDateString('vi-VN') : 'Từ nay'} -{' '}
                      {v.endDate ? new Date(v.endDate).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                    </span>
                  </div>
                </div>

                {/* Status Badges & Security Check & Actions */}
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isVerified ? (
                      <span
                        className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                        title="Dữ liệu mã checksum mã hóa toàn vẹn"
                      >
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Checksum hợp lệ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        Cần cập nhật mã hóa
                      </span>
                    )}

                    {isExpired && (
                      <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-bold border border-rose-200">
                        Đã hết hạn
                      </span>
                    )}
                    {isNotStartedYet && (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold border border-amber-200">
                        Chưa đến ngày
                      </span>
                    )}
                  </div>

                  {/* Edit / Delete buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(v)}
                      className="p-1.5 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer font-bold text-xs"
                      title="Sửa voucher"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa voucher"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Creator and Created Date: Chỉ hiển thị cho Tổng bí thư */}
                {isRoot && (
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-neutral-100 bg-amber-50/40 -mx-4 -mb-4 px-4 py-2.5 rounded-b-2xl">
                    <span className="flex items-center gap-1 font-medium truncate">
                      <User className="w-3 h-3 text-amber-700 shrink-0" />
                      <span className="text-neutral-500">Tạo bởi:</span>
                      {getDisplayCreator(v.createdBy, v.code) ? (
                        <strong className="text-amber-950 font-bold">{getDisplayCreator(v.createdBy, v.code)}</strong>
                      ) : (
                        <span className="text-neutral-400 italic font-normal">Không có</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-neutral-400 shrink-0">
                      <Clock className="w-3 h-3 text-neutral-400" />
                      {v.createdAt ? (
                        <span>{formatVoucherDateSafe(v.createdAt)}</span>
                      ) : (
                        <span className="text-neutral-400 italic font-normal">Không có</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* INSPECT ORDERS MODAL FOR SPECIFIC VOUCHER */}
      {inspectingVoucherStats && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-950">
                  <Ticket className="w-5 h-5 text-amber-800" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-neutral-950">
                      Lịch Sử Sử Dụng Voucher: <span className="font-mono text-amber-700 font-black">{inspectingVoucherStats.voucher.code}</span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-neutral-500 font-medium">
                      Danh sách {inspectingVoucherStats.stats.orders.length} đơn hàng đã áp dụng mã này
                    </p>
                    {isRoot && (
                      <span className="text-[11px] text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                        👤 Tạo bởi: {getDisplayCreator(inspectingVoucherStats.voucher.createdBy, inspectingVoucherStats.voucher.code) ? (
                          <strong>{getDisplayCreator(inspectingVoucherStats.voucher.createdBy, inspectingVoucherStats.voucher.code)}</strong>
                        ) : (
                          <span className="italic text-neutral-500">Không có</span>
                        )} ({inspectingVoucherStats.voucher.createdAt ? formatVoucherDateSafe(inspectingVoucherStats.voucher.createdAt) : 'Không có'})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingVoucherStats(null)}
                className="text-neutral-400 hover:text-neutral-950 p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Metrics Bar inside Modal */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-neutral-50 rounded-2xl border border-neutral-200 shrink-0 text-center">
              <div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase block">Số lượt áp dụng</span>
                <span className="text-base font-black text-neutral-950 font-mono">
                  {inspectingVoucherStats.stats.usageCount}
                  {inspectingVoucherStats.voucher.usageLimit ? ` / ${inspectingVoucherStats.voucher.usageLimit}` : ''} đơn
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase block">Tổng tiền đã giảm</span>
                <span className="text-base font-black text-emerald-700 font-mono">
                  -{inspectingVoucherStats.stats.totalDiscountAmount.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase block">Tổng doanh thu đơn</span>
                <span className="text-base font-black text-indigo-950 font-mono">
                  {inspectingVoucherStats.stats.totalRevenue.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-y-auto flex-1 pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/80 sticky top-0 text-[11px] text-neutral-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Mã Đơn / Ngày</th>
                    <th className="py-2.5 px-3">Khách Hàng</th>
                    <th className="py-2.5 px-3 text-right">Giảm Giá</th>
                    <th className="py-2.5 px-3 text-right">Tổng Tiền</th>
                    <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                    <th className="py-2.5 px-3 text-right">Chi Tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {inspectingVoucherStats.stats.orders.map((ord, idx) => {
                    const discount = ord.voucherDiscountAmount || ord.discountAmount || 0;
                    const isCancelled = ord.status === 'cancelled' || ord.status === 'Đã hủy';
                    const orderId = ord.id || `ORD-${idx}`;

                    return (
                      <tr key={orderId} className={`hover:bg-amber-50/40 transition-colors ${isCancelled ? 'opacity-60 bg-neutral-50/50' : ''}`}>
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-neutral-950 block">{orderId}</span>
                          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatOrderDateSafe(ord)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-neutral-900 flex items-center gap-1">
                            <User className="w-3 h-3 text-neutral-400" />
                            {ord.name || ord.customerName || 'Khách vãng lai'}
                          </div>
                          {ord.phone && (
                            <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5 text-neutral-400" />
                              {ord.phone}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {discount > 0 ? `-${discount.toLocaleString('vi-VN')}đ` : 'Freeship'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-neutral-950">
                          {(ord.totalPrice || ord.totalAmount || 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCancelled
                              ? 'bg-rose-100 text-rose-800'
                              : ord.status === 'Đã giao' || ord.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}>
                            {ord.status || 'Đã đặt'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {onInspectOrder ? (
                            <button
                              type="button"
                              onClick={() => {
                                onInspectOrder(ord);
                                setInspectingVoucherStats(null);
                              }}
                              className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Xem</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-neutral-400 font-mono">{ord.source || 'web'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-neutral-100 shrink-0">
              <button
                type="button"
                onClick={() => setInspectingVoucherStats(null)}
                className="px-5 py-2 rounded-xl bg-neutral-950 text-white font-bold text-xs hover:bg-neutral-800 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT VOUCHER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-black text-neutral-950">
                  {editingVoucher ? 'Chỉnh Sửa Mã Giảm Giá' : 'Tạo Mã Giảm Giá Mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-950 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              {/* Code */}
              <div>
                <label className="block font-bold text-neutral-950 mb-1">
                  Mã Voucher (viết hoa không dấu, ví dụ: KNOT10) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="VÍ DỤ: BANMOI2026"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-mono font-bold uppercase tracking-wider text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                />
              </div>

              {/* Type */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('percent')}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    type === 'percent'
                      ? 'border-amber-400 bg-amber-50 text-amber-950 shadow-2xs'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <Percent className="w-4 h-4 text-amber-600" />
                  <span>Giảm %</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('freeship')}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    type === 'freeship'
                      ? 'border-sky-400 bg-sky-50 text-sky-950 shadow-2xs'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <Truck className="w-4 h-4 text-sky-600" />
                  <span>Freeship</span>
                </button>
              </div>

              {/* Percent Discount value */}
              {type === 'percent' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-neutral-950 mb-1">% Giảm giá:</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none pr-8"
                      />
                      <span className="absolute right-3 top-2.5 font-bold text-neutral-400">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-950 mb-1">Mức giảm tối đa (VNĐ):</label>
                    <input
                      type="number"
                      min={0}
                      value={maxDiscountAmount}
                      onChange={(e) => setMaxDiscountAmount(Number(e.target.value))}
                      placeholder="0 = không giới hạn"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Min Order Value */}
              <div>
                <label className="block font-bold text-neutral-950 mb-1">Đơn hàng tối thiểu (VNĐ):</label>
                <input
                  type="number"
                  min={0}
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(Number(e.target.value))}
                  placeholder="Ví dụ: 200000"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                />
              </div>

              {/* Product Scope Selection (Tất cả sản phẩm vs Chỉ sản phẩm được chọn) */}
              <div className="space-y-2 p-3.5 bg-neutral-50/90 rounded-2xl border border-neutral-200">
                <div className="flex items-center justify-between">
                  <label className="block font-black text-neutral-950 text-xs">
                    Sản phẩm áp dụng mã này:
                  </label>
                  <span className="text-[10px] font-bold text-neutral-500">
                    {applyToAllProducts ? 'Toàn bộ cửa hàng' : `Chỉ ${applicableProductIds.length} SP được chọn`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setApplyToAllProducts(true)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      applyToAllProducts
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-2xs font-black'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tất cả sản phẩm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplyToAllProducts(false)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      !applyToAllProducts
                        ? 'border-purple-500 bg-purple-50 text-purple-950 shadow-2xs font-black'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                    <span>Chỉ sản phẩm đã chọn ({applicableProductIds.length})</span>
                  </button>
                </div>

                {!applyToAllProducts && (
                  <div className="mt-2 space-y-2 pt-2 border-t border-neutral-200/80">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={productSearchInModal}
                          onChange={(e) => setProductSearchInModal(e.target.value)}
                          placeholder="Tìm sản phẩm áp dụng..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setApplicableProductIds(availableProducts.map((p) => p.id))}
                        className="text-[11px] font-bold text-neutral-700 hover:text-neutral-950 px-2 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Chọn tất cả
                      </button>
                      <button
                        type="button"
                        onClick={() => setApplicableProductIds([])}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 px-2 py-1.5 bg-white hover:bg-rose-50 border border-neutral-200 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Bỏ chọn
                      </button>
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-1 pr-1 border border-neutral-200 rounded-xl p-2 bg-white divide-y divide-neutral-100">
                      {filteredProductsInModal.length === 0 ? (
                        <p className="text-center py-4 text-neutral-400 text-xs">Không tìm thấy sản phẩm nào</p>
                      ) : (
                        filteredProductsInModal.map((prod) => {
                          const isSelected = applicableProductIds.includes(prod.id);
                          const isHidden = isProductHidden(prod);
                          return (
                            <label
                              key={prod.id}
                              className={`flex items-center gap-2.5 p-1.5 rounded-lg cursor-pointer transition-colors ${
                                isSelected ? 'bg-purple-50/70' : 'hover:bg-neutral-50'
                              } ${isHidden ? 'opacity-60 bg-neutral-50/60' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setApplicableProductIds((prev) => [...prev, prod.id]);
                                  } else {
                                    setApplicableProductIds((prev) => prev.filter((id) => id !== prod.id));
                                  }
                                }}
                                className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                              />
                              <img
                                src={prod.image || '/assets/hero-bg.png'}
                                alt={prod.name}
                                className="w-8 h-8 rounded-md object-cover border border-neutral-200 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold text-neutral-900 truncate">{prod.name}</p>
                                  {isHidden && (
                                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-600 shrink-0">
                                      Đã ẩn
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-neutral-500 font-mono">
                                  {(prod.price || 0).toLocaleString('vi-VN')}đ
                                </p>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-purple-900">
                      ✓ Đã chọn {applicableProductIds.length} / {availableProducts.length} sản phẩm
                    </p>
                  </div>
                )}
              </div>

              {/* Quantity Limit & Total Usage Limit (Compact 2-col layout with small ? help tooltip) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Max Quantity per Order */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className="block font-bold text-neutral-950 text-xs">
                      SP tối đa được giảm / đơn:
                    </label>
                    <div className="relative group cursor-help inline-flex items-center">
                      <HelpCircle className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-52 p-2 bg-neutral-900 text-white text-[11px] font-medium rounded-lg shadow-xl z-50 leading-relaxed text-center">
                        Số lượng SP tối đa được giảm trong 1 đơn hàng (VD: 3 SP, từ SP thứ 4 tính giá gốc). Để trống hoặc 0 = không giới hạn.
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={maxApplicableQuantity || ''}
                    onChange={(e) => setMaxApplicableQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0 = không giới hạn"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                  />
                </div>

                {/* Total Usage Limit */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className="block font-bold text-neutral-950 text-xs">
                      Giới hạn tổng lượt dùng:
                    </label>
                    <div className="relative group cursor-help inline-flex items-center">
                      <HelpCircle className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-52 p-2 bg-neutral-900 text-white text-[11px] font-medium rounded-lg shadow-xl z-50 leading-relaxed text-center">
                        Tổng số lượt sử dụng trên toàn hệ thống (VD: 10 lượt, đơn thứ 11 sẽ báo lỗi). Để trống hoặc 0 = không giới hạn.
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={usageLimit || ''}
                    onChange={(e) => setUsageLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0 = không giới hạn"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                  />
                </div>
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-950 mb-1">Ngày bắt đầu:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-medium text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-950 mb-1">Ngày kết thúc:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-medium text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                  />
                </div>
              </div>

              {/* Creator Name (Họ tên người tạo thực tế: Trần Việt Huy, Hảo Như...) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-neutral-950 text-xs">
                    Người tạo voucher (Họ tên):
                  </label>
                  <span className="text-[10px] text-neutral-400">Không bắt buộc</span>
                </div>
                <input
                  type="text"
                  value={createdByInput}
                  onChange={(e) => setCreatedByInput(e.target.value)}
                  placeholder="Ví dụ: Trần Việt Huy, Hảo Như... (Để trống nếu không rõ)"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-medium text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                />
              </div>

              {/* Is Active */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="voucher-is-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="voucher-is-active" className="font-bold text-neutral-900 cursor-pointer">
                  Kích hoạt mã giảm giá ngay lập tức
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 font-bold text-neutral-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-amber-400" />}
                  <span>{isSaving ? 'Đang lưu...' : 'Lưu Voucher'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

