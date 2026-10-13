import React, { useState, useMemo } from 'react';
import {
  Search, Filter, ArrowUpDown, Download, Eye, X, ChevronLeft, ChevronRight,
  ShoppingBag, TrendingUp, Wallet, Percent, Calendar, Check, AlertCircle,
  ExternalLink, ChevronDown, RefreshCw, Sparkles, Tag, HelpCircle, Layers,
  ShieldCheck
} from 'lucide-react';
import { StoredOrder, SellerUser, OrderItemDetail } from '../types';
import { normalizeOrderStatus, getStatusBadgeConfig } from '../utils/orderFormatters';
import { AffiliateCommissionPaymentBadge } from './AffiliateCommissionPaymentBadge';

export type OrdersDateRangePreset = 'all' | '7days' | '30days' | '90days' | 'custom';

interface AffiliateOrdersPageProps {
  orders: StoredOrder[];
  affiliateUser: SellerUser | null;
  clicksCount: number;
  prevClicksCount: number;
  dateRange: OrdersDateRangePreset;
  setDateRange: (range: OrdersDateRangePreset) => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
  dateRangeLabel: string;
  comparisonBounds: {
    hasComparison: boolean;
    prevStart: number;
    prevEnd: number;
  };
  allBaseOrders: StoredOrder[];
}

export const AffiliateOrdersPage: React.FC<AffiliateOrdersPageProps> = ({
  orders,
  affiliateUser,
  clicksCount,
  prevClicksCount,
  dateRange,
  setDateRange,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  dateRangeLabel,
  comparisonBounds,
  allBaseOrders
}) => {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'value_desc' | 'value_asc' | 'comm_desc' | 'comm_asc'>('newest');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(6);

  // Selected Order for Detail Drawer
  const [selectedOrder, setSelectedOrder] = useState<StoredOrder | null>(null);

  // Checkbox selection (for potential bulk visual / UI fidelity like screenshot)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Custom date picker dropdown state
  const [showDatePickerDropdown, setShowDatePickerDropdown] = useState(false);

  // Actual distinct order statuses from current dataset
  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((ord) => {
      const norm = normalizeOrderStatus(ord.status);
      set.add(norm);
    });
    return Array.from(set);
  }, [orders]);

  // Performance Summary calculations for selected date range
  const summaryMetrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCommission = 0;

    orders.forEach((ord) => {
      const merchVal = typeof ord.affiliateMerchandiseValue === 'number'
        ? ord.affiliateMerchandiseValue
        : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));

      const rate = typeof ord.affiliateCommissionRate === 'number'
        ? ord.affiliateCommissionRate
        : (affiliateUser?.commissionRate || 10);

      const commAmount = typeof ord.affiliateCommissionAmount === 'number'
        ? ord.affiliateCommissionAmount
        : Math.round((merchVal * rate) / 100);

      totalRevenue += merchVal;
      totalCommission += commAmount;
    });

    // Conversion rate: orders / clicks (only if clicks > 0)
    const totalOrdersCount = orders.length;
    const conversionRate = clicksCount > 0
      ? ((totalOrdersCount / clicksCount) * 100).toFixed(1)
      : null;

    return {
      orderCount: totalOrdersCount,
      revenue: totalRevenue,
      commission: totalCommission,
      conversionRate,
      clicksCount
    };
  }, [orders, affiliateUser, clicksCount]);

  // Previous period comparison metrics (if comparison window exists)
  const prevSummaryMetrics = useMemo(() => {
    if (!comparisonBounds.hasComparison) return null;

    let prevOrdersCount = 0;
    let prevRevenue = 0;
    let prevCommission = 0;

    allBaseOrders.forEach((ord) => {
      const t = new Date(ord.createdAt || ord.date || 0).getTime();
      if (t >= comparisonBounds.prevStart && t < comparisonBounds.prevEnd) {
        prevOrdersCount++;
        const merchVal = typeof ord.affiliateMerchandiseValue === 'number'
          ? ord.affiliateMerchandiseValue
          : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));

        const rate = typeof ord.affiliateCommissionRate === 'number'
          ? ord.affiliateCommissionRate
          : (affiliateUser?.commissionRate || 10);

        const commAmount = typeof ord.affiliateCommissionAmount === 'number'
          ? ord.affiliateCommissionAmount
          : Math.round((merchVal * rate) / 100);

        prevRevenue += merchVal;
        prevCommission += commAmount;
      }
    });

    const calcChange = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? { diff: 100, isUp: true } : null;
      const diff = Math.round(((cur - prev) / prev) * 100);
      return { diff: Math.abs(diff), isUp: diff >= 0 };
    };

    return {
      orderCountChange: calcChange(summaryMetrics.orderCount, prevOrdersCount),
      revenueChange: calcChange(summaryMetrics.revenue, prevRevenue),
      commissionChange: calcChange(summaryMetrics.commission, prevCommission)
    };
  }, [allBaseOrders, comparisonBounds, summaryMetrics, affiliateUser]);

  // Combined Filtering & Sorting
  const filteredAndSortedOrders = useMemo(() => {
    let result = orders.filter((ord) => {
      // 1. Search by Order ID
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim().replace(/^#/, '');
        const idMatches = ord.id && ord.id.toLowerCase().includes(q);
        const codeMatches = ord.orderCode && ord.orderCode.toLowerCase().includes(q);
        if (!idMatches && !codeMatches) return false;
      }

      // 2. Filter by status
      if (statusFilter !== 'all') {
        const norm = normalizeOrderStatus(ord.status);
        if (norm !== statusFilter) return false;
      }

      return true;
    });

    // 3. Sort
    result.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date || 0).getTime();
      const timeB = new Date(b.createdAt || b.date || 0).getTime();

      const valA = typeof a.affiliateMerchandiseValue === 'number'
        ? a.affiliateMerchandiseValue
        : Math.max(0, (a.subtotal || a.totalPrice || 0) - (a.discountAmount || 0));
      const valB = typeof b.affiliateMerchandiseValue === 'number'
        ? b.affiliateMerchandiseValue
        : Math.max(0, (b.subtotal || b.totalPrice || 0) - (b.discountAmount || 0));

      const commA = typeof a.affiliateCommissionAmount === 'number'
        ? a.affiliateCommissionAmount
        : Math.round((valA * (a.affiliateCommissionRate || affiliateUser?.commissionRate || 10)) / 100);
      const commB = typeof b.affiliateCommissionAmount === 'number'
        ? b.affiliateCommissionAmount
        : Math.round((valB * (b.affiliateCommissionRate || affiliateUser?.commissionRate || 10)) / 100);

      if (sortBy === 'newest') return timeB - timeA;
      if (sortBy === 'oldest') return timeA - timeB;
      if (sortBy === 'value_desc') return valB - valA;
      if (sortBy === 'value_asc') return valA - valB;
      if (sortBy === 'comm_desc') return commB - commA;
      if (sortBy === 'comm_asc') return commA - commB;
      return timeB - timeA;
    });

    return result;
  }, [orders, searchQuery, statusFilter, sortBy, affiliateUser]);

  // Pagination calculation
  const totalItems = filteredAndSortedOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedOrders = filteredAndSortedOrders.slice(startIndex, startIndex + pageSize);

  // Reset pagination when filter criteria changes
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  // CSV Export handler
  const handleExportCsv = () => {
    if (filteredAndSortedOrders.length === 0) {
      alert('Không có dữ liệu đơn hàng để xuất danh sách.');
      return;
    }

    const headers = [
      'Mã đơn hàng',
      'Ngày đặt',
      'Trạng thái',
      'Số lượng sản phẩm',
      'Tạm tính',
      'Giảm giá',
      'Phí vận chuyển',
      'Giá trị tính hoa hồng (không gồm ship)',
      'Tỷ lệ hoa hồng (%)',
      'Hoa hồng ghi nhận (VNĐ)', 'Thanh toán hoa hồng', 'Hoa hồng đã trả (VNĐ)', 'Ngày trả hoa hồng'
    ];

    const rows = filteredAndSortedOrders.map((ord) => {
      const merchVal = typeof ord.affiliateMerchandiseValue === 'number'
        ? ord.affiliateMerchandiseValue
        : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));

      const commRate = typeof ord.affiliateCommissionRate === 'number'
        ? ord.affiliateCommissionRate
        : (affiliateUser?.commissionRate || 10);

      const commAmount = typeof ord.affiliateCommissionAmount === 'number'
        ? ord.affiliateCommissionAmount
        : Math.round((merchVal * commRate) / 100);

      const itemCount = ord.itemDetails?.length || ord.items?.length || 1;
      const dateStr = ord.createdAt
        ? new Date(ord.createdAt).toLocaleString('vi-VN')
        : (ord.date || '');

      return [
        `"${ord.id}"`,
        `"${dateStr}"`,
        `"${normalizeOrderStatus(ord.status)}"`,
        itemCount,
        ord.subtotal || ord.totalPrice || 0,
        ord.discountAmount || 0,
        ord.shippingFee || 0,
        merchVal,
        commRate,
        commAmount,
        ord.affiliateCommissionPaid ? 'Đã trả' : 'Chưa trả',
        ord.affiliateCommissionPaid ? (ord.affiliateCommissionPaidAmount ?? commAmount) : 0,
        `"${ord.affiliateCommissionPaidAt || ''}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `affiliate-orders-${affiliateUser?.affiliateCode || 'export'}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Checkbox toggle helpers
  const handleToggleSelectAll = () => {
    if (selectedOrderIds.length === paginatedOrders.length && paginatedOrders.length > 0) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(paginatedOrders.map((o) => o.id));
    }
  };

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- */}
      {/* A. PAGE HEADER WITH TITLE & ADVANCED DATE RANGE BAR */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
            Đơn hàng
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Danh sách các đơn hàng được ghi nhận từ link affiliate của bạn.
          </p>
        </div>

        {/* Date presets & Custom Date trigger */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Custom Date Display Pill / Dropdown Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDatePickerDropdown((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-neutral-200 text-xs font-medium text-neutral-800 hover:border-neutral-300 shadow-2xs transition-colors cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-neutral-500" />
              <span>{dateRangeLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            {/* Custom Date Range Popover */}
            {showDatePickerDropdown && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-neutral-200 p-4 z-40 animate-scaleUp">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <span className="text-xs font-semibold text-neutral-900">Chọn khoảng ngày</span>
                  <button
                    type="button"
                    onClick={() => setShowDatePickerDropdown(false)}
                    className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 pt-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Từ ngày:
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => {
                        setCustomStartDate(e.target.value);
                        setDateRange('custom');
                      }}
                      className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-800 outline-none focus:border-rose-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Đến ngày:
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => {
                        setCustomEndDate(e.target.value);
                        setDateRange('custom');
                      }}
                      className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-800 outline-none focus:border-rose-500 focus:bg-white"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomStartDate('');
                        setCustomEndDate('');
                        setDateRange('30days');
                        setShowDatePickerDropdown(false);
                      }}
                      className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 font-medium"
                    >
                      Đặt lại
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (customStartDate && customEndDate) {
                          setDateRange('custom');
                        }
                        setShowDatePickerDropdown(false);
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Preset Buttons (Matching Visual Reference) */}
          <div className="flex items-center rounded-xl bg-neutral-100 p-1 border border-neutral-200/70 text-xs">
            {(['all', '7days', '30days', '90days', 'custom'] as OrdersDateRangePreset[]).map((preset) => {
              const labelMap: Record<OrdersDateRangePreset, string> = {
                'all': 'Tất cả',
                '7days': '7 ngày',
                '30days': '30 ngày',
                '90days': '90 ngày',
                'custom': 'Tùy chọn'
              };
              const isSelected = dateRange === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDateRange(preset);
                    if (preset === 'custom') {
                      setShowDatePickerDropdown(true);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {labelMap[preset]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* B. COMPACT PERFORMANCE SUMMARY CARDS */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng đơn ghi nhận */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-neutral-500 block">
                Tổng đơn ghi nhận
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-neutral-900 font-mono tracking-tight">
                  {summaryMetrics.orderCount}
                </span>
                {prevSummaryMetrics?.orderCountChange && (
                  <span className={`text-[11px] font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${
                    prevSummaryMetrics.orderCountChange.isUp
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    {prevSummaryMetrics.orderCountChange.isUp ? '↑' : '↓'} {prevSummaryMetrics.orderCountChange.diff}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-neutral-400 mt-3 pt-2.5 border-t border-neutral-100">
            {comparisonBounds.hasComparison ? `so với chu kỳ trước` : `trong thời gian đã chọn`}
          </p>
        </div>

        {/* Card 2: Tổng doanh thu sản phẩm */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-neutral-500 block">
                Tổng doanh thu sản phẩm
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl sm:text-2xl font-bold text-neutral-900 font-mono tracking-tight">
                  {summaryMetrics.revenue.toLocaleString('vi-VN')}đ
                </span>
                {prevSummaryMetrics?.revenueChange && (
                  <span className={`text-[11px] font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${
                    prevSummaryMetrics.revenueChange.isUp
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    {prevSummaryMetrics.revenueChange.isUp ? '↑' : '↓'} {prevSummaryMetrics.revenueChange.diff}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-neutral-400 mt-3 pt-2.5 border-t border-neutral-100">
            Không bao gồm phí vận chuyển
          </p>
        </div>

        {/* Card 3: Tổng hoa hồng */}
        <div className="bg-white rounded-2xl border border-rose-200/80 p-5 shadow-2xs ring-1 ring-rose-100/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-rose-900 block">
                Tổng hoa hồng
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl sm:text-2xl font-bold text-rose-700 font-mono tracking-tight">
                  {summaryMetrics.commission.toLocaleString('vi-VN')}đ
                </span>
                {prevSummaryMetrics?.commissionChange && (
                  <span className={`text-[11px] font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${
                    prevSummaryMetrics.commissionChange.isUp
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    {prevSummaryMetrics.commissionChange.isUp ? '↑' : '↓'} {prevSummaryMetrics.commissionChange.diff}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 mt-3 pt-2.5 border-t border-rose-100/80">
            Theo tỷ lệ {affiliateUser?.commissionRate || 10}% của bạn
          </p>
        </div>

        {/* Card 4: Tỷ lệ đơn / lượt nhấp */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-neutral-500 flex items-center gap-1">
                <span>Tỷ lệ đơn / lượt nhấp</span>
                <span title="Tỷ lệ chuyển đổi đơn hàng từ lượt click link giới thiệu" className="inline-flex items-center">
                  <HelpCircle className="w-3 h-3 text-neutral-400 cursor-help" />
                </span>
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-neutral-900 font-mono tracking-tight">
                  {summaryMetrics.conversionRate !== null ? `${summaryMetrics.conversionRate}%` : '0%'}
                </span>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-neutral-400 mt-3 pt-2.5 border-t border-neutral-100">
            {summaryMetrics.orderCount} đơn / {summaryMetrics.clicksCount} lượt nhấp
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* C. ADVANCED SEARCH, STATUS FILTERS, PRODUCT & EXPORT */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search by Order ID */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm theo mã đơn hàng (ví dụ: NAK-...)"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs sm:text-sm bg-neutral-50/70 focus:bg-white focus:border-rose-500 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns & Export Button */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-3.5 pr-8 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:border-neutral-300 outline-none focus:border-rose-500 cursor-pointer shadow-2xs"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Chờ xác nhận">Chờ xác nhận</option>
                <option value="Đã xác nhận">Đã xác nhận</option>
                <option value="Knot đang được sản xuất">Đang sản xuất</option>
                <option value="Đang giao hàng">Đang giao hàng</option>
                <option value="Đơn hàng giao thành công">Đã giao thành công</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-3.5 pr-8 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:border-neutral-300 outline-none focus:border-rose-500 cursor-pointer shadow-2xs"
              >
                <option value="newest">Sắp xếp: Mới nhất</option>
                <option value="oldest">Sắp xếp: Cũ nhất</option>
                <option value="value_desc">Giá trị: Cao &rarr; Thấp</option>
                <option value="value_asc">Giá trị: Thấp &rarr; Cao</option>
                <option value="comm_desc">Hoa hồng: Cao &rarr; Thấp</option>
                <option value="comm_asc">Hoa hồng: Thấp &rarr; Cao</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Export CSV Button (Matching Visual Reference) */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>Xuất danh sách</span>
            </button>

            {/* Reset Filters if active */}
            {(searchQuery || statusFilter !== 'all' || sortBy !== 'newest') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-4 px-2 cursor-pointer"
              >
                Đặt lại
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* D. DETAILED ORDERS TABLE (DESKTOP) & CARDS (MOBILE) */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden">
        {filteredAndSortedOrders.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-800">
              Không tìm thấy đơn hàng nào
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
              {searchQuery || statusFilter !== 'all'
                ? 'Không có đơn hàng nào khớp với điều kiện lọc hiện tại. Thử chọn mốc thời gian khác hoặc đặt lại bộ lọc.'
                : 'Chưa có đơn hàng nào được ghi nhận từ liên kết tiếp thị của bạn.'}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold shadow-2xs hover:bg-rose-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Xem tất cả đơn hàng</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50/70 border-b border-neutral-100 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    <th className="py-3.5 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.length === paginatedOrders.length && paginatedOrders.length > 0}
                        onChange={handleToggleSelectAll}
                        className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3.5 px-4">Mã đơn hàng</th>
                    <th className="py-3.5 px-4">Ngày đặt</th>
                    <th className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1">
                        <span>Giá trị tính HH</span>
                        <span title="Giá trị sản phẩm sau giảm giá, không gồm phí ship" className="inline-flex items-center">
                          <HelpCircle className="w-3 h-3 text-neutral-400 cursor-help" />
                        </span>
                      </span>
                    </th>
                    <th className="py-3.5 px-4 text-center">Tỷ lệ HH</th>
                    <th className="py-3.5 px-4 text-right">Hoa hồng</th>
                    <th className="py-3.5 px-4 text-center">Thanh toán HH</th>
                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                    <th className="py-3.5 px-4 text-center w-16">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {paginatedOrders.map((ord) => {
                    const merchVal = typeof ord.affiliateMerchandiseValue === 'number'
                      ? ord.affiliateMerchandiseValue
                      : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));

                    const commRate = typeof ord.affiliateCommissionRate === 'number'
                      ? ord.affiliateCommissionRate
                      : (affiliateUser?.commissionRate || 10);

                    const commAmount = typeof ord.affiliateCommissionAmount === 'number'
                      ? ord.affiliateCommissionAmount
                      : Math.round((merchVal * commRate) / 100);

                    const badgeConfig = getStatusBadgeConfig(ord.status);
                    const isSelected = selectedOrderIds.includes(ord.id);
                    const isCurrentDetail = selectedOrder?.id === ord.id;

                    return (
                      <tr
                        key={ord.id}
                        onClick={() => setSelectedOrder(ord)}
                        className={`transition-colors cursor-pointer group ${
                          isCurrentDetail
                            ? 'bg-rose-50/40'
                            : isSelected
                            ? 'bg-rose-50/20'
                            : 'hover:bg-neutral-50/80'
                        }`}
                      >
                        {/* Checkbox */}
                        <td
                          className="py-3.5 px-4 text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelectOrder(ord.id);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOrder(ord.id)}
                            className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                        </td>

                        {/* Order ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-neutral-900 whitespace-nowrap">
                          {ord.id}
                        </td>

                        {/* Order Date */}
                        <td className="py-3.5 px-4 text-neutral-600 whitespace-nowrap">
                          {ord.createdAt ? (
                            <div>
                              <div className="font-medium text-neutral-800">
                                {new Date(ord.createdAt).toLocaleDateString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </div>
                              <div className="text-[11px] text-neutral-400">
                                {new Date(ord.createdAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          ) : (
                            ord.date || '—'
                          )}
                        </td>

                        {/* Merchandise Value */}
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-neutral-900 whitespace-nowrap">
                          {merchVal.toLocaleString('vi-VN')}đ
                        </td>

                        {/* Commission Rate */}
                        <td className="py-3.5 px-4 text-center font-mono text-neutral-600 whitespace-nowrap">
                          {commRate}%
                        </td>

                        {/* Commission Amount (Bold highlight) */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-900 whitespace-nowrap text-xs sm:text-sm">
                          {commAmount.toLocaleString('vi-VN')}đ
                        </td>

                        {/* Order Status Badge */}
                        <td className="py-3.5 px-4 text-center"><AffiliateCommissionPaymentBadge order={ord} /></td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${badgeConfig.badgeClass}`}>
                            {badgeConfig.label}
                          </span>
                        </td>

                        {/* Detail action */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(ord);
                            }}
                            className="p-1.5 text-neutral-400 group-hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
                            title="Xem chi tiết đơn"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (Responsive adaptation) */}
            <div className="md:hidden divide-y divide-neutral-100">
              {paginatedOrders.map((ord) => {
                const merchVal = typeof ord.affiliateMerchandiseValue === 'number'
                  ? ord.affiliateMerchandiseValue
                  : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));

                const commRate = typeof ord.affiliateCommissionRate === 'number'
                  ? ord.affiliateCommissionRate
                  : (affiliateUser?.commissionRate || 10);

                const commAmount = typeof ord.affiliateCommissionAmount === 'number'
                  ? ord.affiliateCommissionAmount
                  : Math.round((merchVal * commRate) / 100);

                const badgeConfig = getStatusBadgeConfig(ord.status);

                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className="p-4 space-y-3 cursor-pointer active:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-neutral-900 text-xs">
                        {ord.id}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${badgeConfig.badgeClass}`}>
                        {badgeConfig.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>
                        {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : ord.date}
                      </span>
                      <span className="text-[11px] text-neutral-400">Xem chi tiết &rarr;</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs">
                      <div>
                        <span className="text-neutral-400 text-[11px] block">Giá trị tính HH:</span>
                        <span className="font-mono font-medium text-neutral-800">
                          {merchVal.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-neutral-400 text-[11px] block">Hoa hồng ({commRate}%):</span>
                        <span className="font-mono font-bold text-rose-700 text-sm">
                          +{commAmount.toLocaleString('vi-VN')}đ
                        </span>
                        <div className="mt-1"><AffiliateCommissionPaymentBadge order={ord} /></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ---------------------------------------------------- */}
            {/* PAGINATION CONTROLS (Matching Visual Reference) */}
            {/* ---------------------------------------------------- */}
            <div className="p-4 sm:p-5 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-500">
              {/* Display range text */}
              <div>
                Hiển thị <span className="font-semibold text-neutral-800">{totalItems === 0 ? 0 : startIndex + 1}</span> - <span className="font-semibold text-neutral-800">{Math.min(startIndex + pageSize, totalItems)}</span> trên <span className="font-semibold text-neutral-800">{totalItems}</span> đơn hàng
              </div>

              {/* Page buttons & Page Size selector */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={validCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Page Numbers */}
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    const isCurrent = validCurrentPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-rose-100 text-rose-800 font-bold'
                            : 'hover:bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={validCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Page Size Selector (Matching Visual Reference) */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-neutral-400">Số dòng mỗi trang</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="py-1 px-2 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-700 outline-none cursor-pointer"
                  >
                    <option value={6}>6</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* E. ORDER DETAILS PANEL / DRAWER */}
      {/* ---------------------------------------------------- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-fadeIn">
          {/* Backdrop Click to close */}
          <div
            className="flex-1"
            onClick={() => setSelectedOrder(null)}
          />

          {/* Drawer content (Responsive: Full-screen on mobile, Elegant side panel on Desktop) */}
          <div className="w-full sm:w-[480px] lg:w-[520px] bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-slideInRight">
            {/* Drawer Header */}
            <div className="p-5 sm:p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                  Chi tiết đơn hàng
                </h3>
                <span className="font-mono text-xs text-neutral-500 font-semibold">
                  {selectedOrder.id}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeConfig(selectedOrder.status).badgeClass}`}>
                  {getStatusBadgeConfig(selectedOrder.status).label}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs">
              {/* Order Meta Info */}
              <div className="space-y-3 bg-neutral-50/70 p-4 rounded-2xl border border-neutral-100">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Ngày đặt hàng</span>
                  </span>
                  <span className="font-medium text-neutral-800">
                    {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : (selectedOrder.date || '—')}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Trạng thái</span>
                  <span className="font-medium text-neutral-800">
                    {normalizeOrderStatus(selectedOrder.status)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <span>Tỷ lệ hoa hồng áp dụng</span>
                    <span title="Tỷ lệ hoa hồng cá nhân tại thời điểm đơn hàng được đặt" className="inline-flex items-center">
                      <HelpCircle className="w-3 h-3 text-neutral-400 cursor-help" />
                    </span>
                  </span>
                  <span className="font-mono font-bold text-neutral-800">
                    {selectedOrder.affiliateCommissionRate || affiliateUser?.commissionRate || 10}%
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-neutral-200/60">
                  <span className="font-semibold text-rose-950">Hoa hồng ghi nhận</span>
                  <span className="font-mono font-bold text-rose-700 text-sm">
                    {(() => {
                      const merch = typeof selectedOrder.affiliateMerchandiseValue === 'number'
                        ? selectedOrder.affiliateMerchandiseValue
                        : Math.max(0, (selectedOrder.subtotal || selectedOrder.totalPrice || 0) - (selectedOrder.discountAmount || 0));
                      const rate = typeof selectedOrder.affiliateCommissionRate === 'number'
                        ? selectedOrder.affiliateCommissionRate
                        : (affiliateUser?.commissionRate || 10);
                      const comm = typeof selectedOrder.affiliateCommissionAmount === 'number'
                        ? selectedOrder.affiliateCommissionAmount
                        : Math.round((merch * rate) / 100);
                      return `${comm.toLocaleString('vi-VN')}đ`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Privacy Protection Notice (Customer name, phone, and order items hidden) */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                <div className="flex items-center gap-2 text-neutral-900 font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Bảo mật danh tính & thành phần đơn hàng</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed font-normal">
                  Theo cam kết bảo mật quyền riêng tư của Not a Knot, thông tin cá nhân khách hàng (họ tên, số điện thoại, địa chỉ nhận hàng) và thành phần chi tiết từng sản phẩm được ẩn tuyệt đối. Đối tác được đối soát và hưởng hoa hồng minh bạch qua Mã đơn hàng và Giá trị đơn hàng ghi nhận.
                </p>
              </div>

              {/* Transparent Financial & Commission Breakdown */}
              <div className="space-y-2.5 pt-2 border-t border-neutral-100">
                <div className="flex justify-between text-neutral-600">
                  <span>Tạm tính sản phẩm</span>
                  <span className="font-mono font-medium">
                    {((selectedOrder.subtotal || selectedOrder.totalPrice || 0) + (selectedOrder.discountAmount || 0)).toLocaleString('vi-VN')}đ
                  </span>
                </div>

                {Boolean(selectedOrder.discountAmount && selectedOrder.discountAmount > 0) && (
                  <div className="flex justify-between text-rose-600">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      <span>Giảm giá / Voucher {selectedOrder.voucherCode ? `(${selectedOrder.voucherCode})` : ''}</span>
                    </span>
                    <span className="font-mono font-semibold">
                      -{(selectedOrder.discountAmount || 0).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-neutral-600">
                  <span>Tạm tính (sau giảm giá)</span>
                  <span className="font-mono font-medium">
                    {(() => {
                      const merch = typeof selectedOrder.affiliateMerchandiseValue === 'number'
                        ? selectedOrder.affiliateMerchandiseValue
                        : Math.max(0, (selectedOrder.subtotal || selectedOrder.totalPrice || 0) - (selectedOrder.discountAmount || 0));
                      return `${merch.toLocaleString('vi-VN')}đ`;
                    })()}
                  </span>
                </div>

                <div className="flex justify-between text-neutral-500">
                  <span>Phí vận chuyển (không tính hoa hồng)</span>
                  <span className="font-mono">
                    {(selectedOrder.shippingFee || 0).toLocaleString('vi-VN')}đ
                  </span>
                </div>

                {/* Final Eligible Commission Base */}
                <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between mt-2">
                  <span className="font-semibold text-rose-950">
                    Giá trị tính hoa hồng (không gồm ship)
                  </span>
                  <span className="font-mono font-bold text-rose-900 text-sm">
                    {(() => {
                      const merch = typeof selectedOrder.affiliateMerchandiseValue === 'number'
                        ? selectedOrder.affiliateMerchandiseValue
                        : Math.max(0, (selectedOrder.subtotal || selectedOrder.totalPrice || 0) - (selectedOrder.discountAmount || 0));
                      return `${merch.toLocaleString('vi-VN')}đ`;
                    })()}
                  </span>
                </div>

                {/* Informative notice badge */}
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/70 flex items-start gap-2 text-blue-800 text-[11px] leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Hoa hồng được tính chính xác trên giá trị sản phẩm sau giảm giá, loại trừ phí vận chuyển theo đúng cam kết chính sách tiếp thị liên kết Not a Knot.
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 sm:p-5 border-t border-neutral-100 bg-neutral-50/60 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
