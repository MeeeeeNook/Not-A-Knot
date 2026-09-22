import React, { useState, useEffect, useMemo } from 'react';
import { Voucher, VoucherType, StoredOrder } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';
import {
  getVouchers,
  saveVoucher,
  deleteVoucher,
  verifyVoucherIntegrity,
  generateVoucherEncryption
} from '../../utils/voucherManager';
import { getOrdersFromFirestore } from '../../firebase';
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
  Sparkles
} from 'lucide-react';

interface AdminVouchersTabProps {
  orders?: StoredOrder[];
  onInspectOrder?: (order: StoredOrder) => void;
}

interface VoucherStats {
  usageCount: number;
  cancelledCount: number;
  totalDiscountAmount: number;
  totalRevenue: number;
  orders: StoredOrder[];
}

export const AdminVouchersTab: React.FC<AdminVouchersTabProps> = ({ orders: propsOrders, onInspectOrder }) => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [internalOrders, setInternalOrders] = useState<StoredOrder[]>(propsOrders || []);
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
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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
          setInternalOrders(fsOrders);
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

    setIsSaving(true);
    try {
      const voucherId = editingVoucher ? editingVoucher.id : `VOUCHER_${Date.now()}`;
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
        createdAt: editingVoucher?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
            <Ticket className="w-5 h-5 text-amber-800" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-neutral-950">Quản Lý & Thống Kê Voucher</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Đo lường tự động
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">
              Theo dõi chính xác số lượt áp dụng, tổng tiền đã giảm và doanh thu mang lại của từng mã giảm giá.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadVouchers}
            className="p-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-colors cursor-pointer"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Tạo Mã Mới</span>
          </button>
        </div>
      </div>

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
                      {stats.usageCount} <span className="text-xs font-normal text-neutral-500">lượt</span>
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
                  <p className="text-xs text-neutral-500 font-medium">
                    Danh sách {inspectingVoucherStats.stats.orders.length} đơn hàng đã áp dụng mã này
                  </p>
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
                  {inspectingVoucherStats.stats.usageCount} đơn
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
                            {ord.date ? new Date(ord.date).toLocaleDateString('vi-VN') : 'Mới đây'}
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
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
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
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
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
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
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

