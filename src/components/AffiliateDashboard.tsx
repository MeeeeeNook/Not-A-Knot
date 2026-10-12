import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard, ShoppingBag, BarChart3, Link2, BookOpen, Settings,
  Copy, Check, QrCode, ExternalLink, ArrowUpRight, ArrowDownRight,
  TrendingUp, Wallet, MousePointerClick, Calendar, ArrowLeft, LogOut,
  Search, ShieldCheck, ChevronRight, X, AlertCircle, RefreshCw,
  Sparkles, CheckCircle2, Clock, Truck, XCircle, HelpCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import { SellerUser, StoredOrder, AffiliateSystemConfig } from '../types';
import {
  calculateAffiliateStats,
  getAffiliateReferralUrl,
  fetchAffiliateSystemConfig,
  fetchAffiliateClicks,
  DEFAULT_AFFILIATE_CONFIG,
  AffiliateClickRecord
} from '../utils/affiliateManager';
import { fetchOrdersFromFirestore } from '../firebase';
import { AffiliateOrdersPage, OrdersDateRangePreset } from './AffiliateOrdersPage';

export interface AffiliateDashboardProps {
  currentSeller: SellerUser | null;
  orders?: StoredOrder[];
  onLoginSuccess?: (user: SellerUser) => void;
  onLogout: () => void;
  onNavigateHome: () => void;
  brandName?: string;
  logoUrl?: string;
}

export type AffiliateSidebarTab =
  | 'overview'
  | 'orders'
  | 'analytics'
  | 'links'
  | 'guide'
  | 'settings';

export const AffiliateDashboard: React.FC<AffiliateDashboardProps> = ({
  currentSeller,
  orders,
  onLogout,
  onNavigateHome,
  brandName = 'NOT A KNOT',
  logoUrl
}) => {
  // Navigation tab (Support starting at 'orders' if route URL is /affiliate/orders)
  const [activeTab, setActiveTab] = useState<AffiliateSidebarTab>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (p.includes('/affiliate/orders') || p.includes('/affiliate-orders')) return 'orders';
      if (p.includes('/affiliate/guide')) return 'guide';
      if (p.includes('/affiliate/links')) return 'links';
    }
    return 'overview';
  });

  // Date range filter: 'all' | '7days' | '30days' | '90days' | 'custom'
  const [dateRange, setDateRange] = useState<OrdersDateRangePreset>('30days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // QR Modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Link copy feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [sidebarPromoCopied, setSidebarPromoCopied] = useState(false);

  // Search filter for overview recent orders
  const [overviewSearchQuery, setOverviewSearchQuery] = useState('');

  // Data states
  const [systemConfig, setSystemConfig] = useState<AffiliateSystemConfig>(DEFAULT_AFFILIATE_CONFIG);
  const [fetchedOrders, setFetchedOrders] = useState<StoredOrder[]>(orders || []);
  const [clicks, setClicks] = useState<AffiliateClickRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Affiliate user & code
  const affiliateUser = currentSeller;
  const affiliateCode = useMemo(() => {
    if (!affiliateUser) return 'AN001';
    return (affiliateUser.affiliateCode || affiliateUser.username || 'AN001').toUpperCase().trim();
  }, [affiliateUser]);

  const referralUrl = useMemo(() => {
    return getAffiliateReferralUrl(affiliateCode);
  }, [affiliateCode]);

  // Load config & clicks & orders
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const loadAll = async () => {
      try {
        const [cfg, clks] = await Promise.all([
          fetchAffiliateSystemConfig().catch(() => DEFAULT_AFFILIATE_CONFIG),
          fetchAffiliateClicks(affiliateCode).catch(() => [] as AffiliateClickRecord[])
        ]);
        if (!isMounted) return;
        setSystemConfig(cfg);
        setClicks(clks);

        if (!orders || orders.length === 0) {
          const ords = await fetchOrdersFromFirestore().catch(() => []);
          if (isMounted && ords && ords.length > 0) {
            setFetchedOrders(ords as StoredOrder[]);
          }
        } else {
          setFetchedOrders(orders);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadAll();
    return () => {
      isMounted = false;
    };
  }, [affiliateCode, orders]);

  // Generate QR code for referral URL
  useEffect(() => {
    if (referralUrl) {
      QRCode.toDataURL(referralUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#1c1917',
          light: '#ffffff'
        }
      })
        .then(setQrDataUrl)
        .catch((e) => console.warn('QR Code generation error:', e));
    }
  }, [referralUrl]);

  // Active orders list (from props or Firestore)
  const activeOrdersList = useMemo(() => {
    return orders && orders.length > 0 ? orders : fetchedOrders;
  }, [orders, fetchedOrders]);

  // Base attributed orders for this affiliate (removes deleted/cancelled orders)
  const baseStats = useMemo(() => {
    if (!affiliateUser) {
      return { totalOrders: 0, totalMerchandiseValue: 0, totalCommission: 0, attributedOrders: [] };
    }
    return calculateAffiliateStats(affiliateUser, activeOrdersList);
  }, [affiliateUser, activeOrdersList]);

  // Date range cutoff timestamps & previous period comparison window
  const dateRangeBounds = useMemo(() => {
    const now = Date.now();

    if (dateRange === 'custom') {
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate).getTime();
        const end = new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
        const dur = Math.max(1, end - start);
        const prevStart = start - dur;
        const prevEnd = start;
        const startStr = new Date(start).toLocaleDateString('vi-VN');
        const endStr = new Date(end).toLocaleDateString('vi-VN');
        return {
          currentStart: start,
          currentEnd: end,
          prevStart,
          prevEnd,
          hasComparison: true,
          label: `${startStr} - ${endStr}`,
          days: Math.round(dur / (24 * 60 * 60 * 1000))
        };
      }
      return {
        currentStart: 0,
        currentEnd: now,
        prevStart: 0,
        prevEnd: 0,
        hasComparison: false,
        label: 'Tùy chọn ngày',
        days: 0
      };
    }

    let days = 0;
    if (dateRange === '7days') days = 7;
    else if (dateRange === '30days') days = 30;
    else if (dateRange === '90days') days = 90;

    if (days === 0) {
      return {
        currentStart: 0,
        currentEnd: now,
        prevStart: 0,
        prevEnd: 0,
        hasComparison: false,
        label: 'Toàn thời gian',
        days: 0
      };
    }

    const durationMs = days * 24 * 60 * 60 * 1000;
    const currentStart = now - durationMs;
    const prevStart = currentStart - durationMs;
    const prevEnd = currentStart;

    const startFormatted = new Date(currentStart).toLocaleDateString('vi-VN');
    const endFormatted = new Date(now).toLocaleDateString('vi-VN');

    return {
      currentStart,
      currentEnd: now,
      prevStart,
      prevEnd,
      hasComparison: true,
      label: `${startFormatted} - ${endFormatted}`,
      days
    };
  }, [dateRange, customStartDate, customEndDate]);

  // Filter current period orders & previous period orders
  const { currentAttributedOrders, prevAttributedOrders } = useMemo(() => {
    const all = baseStats.attributedOrders;
    if (!dateRangeBounds.hasComparison) {
      return { currentAttributedOrders: all, prevAttributedOrders: [] };
    }

    const current: StoredOrder[] = [];
    const prev: StoredOrder[] = [];

    all.forEach((ord) => {
      const t = new Date(ord.createdAt || ord.date || 0).getTime();
      if (t >= dateRangeBounds.currentStart && t <= dateRangeBounds.currentEnd) {
        current.push(ord);
      } else if (t >= dateRangeBounds.prevStart && t < dateRangeBounds.prevEnd) {
        prev.push(ord);
      }
    });

    return { currentAttributedOrders: current, prevAttributedOrders: prev };
  }, [baseStats.attributedOrders, dateRangeBounds]);

  // Filter clicks by date range
  const { currentClicksCount, prevClicksCount } = useMemo(() => {
    if (!dateRangeBounds.hasComparison) {
      return { currentClicksCount: clicks.length, prevClicksCount: 0 };
    }
    let cur = 0;
    let prev = 0;
    clicks.forEach((c) => {
      const t = c.timestamp || new Date(c.clickedAt || 0).getTime();
      if (t >= dateRangeBounds.currentStart && t <= dateRangeBounds.currentEnd) {
        cur++;
      } else if (t >= dateRangeBounds.prevStart && t < dateRangeBounds.prevEnd) {
        prev++;
      }
    });
    return { currentClicksCount: cur, prevClicksCount: prev };
  }, [clicks, dateRangeBounds]);

  // Current period metrics
  const currentMetrics = useMemo(() => {
    let rev = 0;
    let comm = 0;
    currentAttributedOrders.forEach((ord) => {
      const merch = typeof ord.affiliateMerchandiseValue === 'number'
        ? ord.affiliateMerchandiseValue
        : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));
      const rate = typeof ord.affiliateCommissionRate === 'number'
        ? ord.affiliateCommissionRate
        : (affiliateUser?.commissionRate || 10);
      const cAmount = typeof ord.affiliateCommissionAmount === 'number'
        ? ord.affiliateCommissionAmount
        : Math.round((merch * rate) / 100);

      rev += merch;
      comm += cAmount;
    });

    return {
      orderCount: currentAttributedOrders.length,
      revenue: rev,
      commission: comm,
      clicks: currentClicksCount
    };
  }, [currentAttributedOrders, affiliateUser, currentClicksCount]);

  // Previous period metrics for comparison
  const prevMetrics = useMemo(() => {
    if (!dateRangeBounds.hasComparison) return null;
    let rev = 0;
    let comm = 0;
    prevAttributedOrders.forEach((ord) => {
      const merch = typeof ord.affiliateMerchandiseValue === 'number'
        ? ord.affiliateMerchandiseValue
        : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));
      const rate = typeof ord.affiliateCommissionRate === 'number'
        ? ord.affiliateCommissionRate
        : (affiliateUser?.commissionRate || 10);
      const cAmount = typeof ord.affiliateCommissionAmount === 'number'
        ? ord.affiliateCommissionAmount
        : Math.round((merch * rate) / 100);

      rev += merch;
      comm += cAmount;
    });

    return {
      orderCount: prevAttributedOrders.length,
      revenue: rev,
      commission: comm,
      clicks: prevClicksCount
    };
  }, [prevAttributedOrders, affiliateUser, prevClicksCount, dateRangeBounds.hasComparison]);

  // Comparison percentage calculation
  const calcChange = (current: number, prev: number) => {
    if (!dateRangeBounds.hasComparison) return null;
    if (prev === 0) {
      return current > 0 ? { diff: 100, isUp: true } : null;
    }
    const diff = Math.round(((current - prev) / prev) * 100);
    return { diff: Math.abs(diff), isUp: diff >= 0 };
  };

  // Trend Chart Data (Bucket orders & commission over time)
  const chartData = useMemo(() => {
    const daysCount = dateRangeBounds.days || 30;
    const buckets: { dateLabel: string; shortDate: string; revenue: number; commission: number; orders: number }[] = [];

    const numPoints = Math.min(12, Math.max(6, Math.min(daysCount, 14)));
    const now = Date.now();
    const intervalMs = (daysCount === 0 ? 30 : daysCount) * 24 * 60 * 60 * 1000 / numPoints;
    const startTime = daysCount === 0 ? (now - 30 * 24 * 60 * 60 * 1000) : dateRangeBounds.currentStart;

    for (let i = 0; i < numPoints; i++) {
      const bucketStart = startTime + i * intervalMs;
      const bucketEnd = bucketStart + intervalMs;
      const dateObj = new Date(bucketStart + intervalMs / 2);
      const shortDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

      let bRev = 0;
      let bComm = 0;
      let bOrders = 0;

      currentAttributedOrders.forEach((ord) => {
        const t = new Date(ord.createdAt || ord.date || 0).getTime();
        if (t >= bucketStart && t < bucketEnd) {
          const merch = typeof ord.affiliateMerchandiseValue === 'number'
            ? ord.affiliateMerchandiseValue
            : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));
          const rate = typeof ord.affiliateCommissionRate === 'number'
            ? ord.affiliateCommissionRate
            : (affiliateUser?.commissionRate || 10);
          const cAmount = typeof ord.affiliateCommissionAmount === 'number'
            ? ord.affiliateCommissionAmount
            : Math.round((merch * rate) / 100);

          bRev += merch;
          bComm += cAmount;
          bOrders += 1;
        }
      });

      buckets.push({
        dateLabel: dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        shortDate,
        revenue: bRev,
        commission: bComm,
        orders: bOrders
      });
    }

    return buckets;
  }, [currentAttributedOrders, dateRangeBounds, affiliateUser]);

  // Order status distribution
  const orderStatusDistribution = useMemo(() => {
    const counts: Record<string, { label: string; count: number; color: string }> = {
      pending: { label: 'Chờ xác nhận', count: 0, color: '#f59e0b' },
      delivering: { label: 'Đang giao hàng', count: 0, color: '#3b82f6' },
      delivered: { label: 'Đã giao thành công', count: 0, color: '#10b981' },
      cancelled: { label: 'Đã hủy / Từ chối', count: 0, color: '#ef4444' }
    };

    currentAttributedOrders.forEach((ord) => {
      const rawStatus = (ord.status || '').toLowerCase().trim();
      if (rawStatus.includes('hủy') || rawStatus.includes('từ chối') || rawStatus === 'cancelled') {
        counts.cancelled.count++;
      } else if (rawStatus.includes('thành công') || rawStatus.includes('đã giao') || rawStatus.includes('hoàn tất') || rawStatus === 'delivered' || rawStatus === 'completed') {
        counts.delivered.count++;
      } else if (rawStatus.includes('đang giao') || rawStatus.includes('vận chuyển') || rawStatus.includes('giao')) {
        counts.delivering.count++;
      } else {
        counts.pending.count++;
      }
    });

    const total = currentAttributedOrders.length;
    return Object.values(counts).map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
    }));
  }, [currentAttributedOrders]);

  // Filtered orders table for overview
  const recentOrdersList = useMemo(() => {
    return currentAttributedOrders.filter((ord) => {
      if (!overviewSearchQuery.trim()) return true;
      const q = overviewSearchQuery.toLowerCase().trim().replace(/^#/, '');
      return ord.id && ord.id.toLowerCase().includes(q);
    });
  }, [currentAttributedOrders, overviewSearchQuery]);

  // Copy referral link handler
  const handleCopyLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = referralUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch (err) {
      console.warn('Copy link error:', err);
    }
  };

  const handleSidebarCopyPromo = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralUrl);
      }
      setSidebarPromoCopied(true);
      setTimeout(() => setSidebarPromoCopied(false), 2200);
    } catch {}
  };

  const maxChartRevenue = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.revenue), 100000);
    return max;
  }, [chartData]);

  // Render Sidebar (Matching Visual Reference With Promo Card)
  const renderSidebar = () => {
    const navItems: { id: AffiliateSidebarTab; label: string; icon: React.FC<{ className?: string }> }[] = [
      { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
      { id: 'orders', label: 'Đơn hàng', icon: ShoppingBag },
      { id: 'analytics', label: 'Thống kê', icon: BarChart3 },
      { id: 'links', label: 'Link & Công cụ', icon: Link2 },
      { id: 'guide', label: 'Hướng dẫn', icon: BookOpen },
      { id: 'settings', label: 'Cài đặt', icon: Settings }
    ];

    return (
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-neutral-200/80 shrink-0 flex flex-col justify-between select-none">
        <div>
          {/* Brand & Portal Header */}
          <div className="p-5 lg:p-6 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={brandName} className="w-9 h-9 object-contain rounded-xl shadow-xs" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 text-white font-black text-sm flex items-center justify-center shadow-xs">
                  NK
                </div>
              )}
              <div>
                <span className="font-bold text-sm tracking-tight text-neutral-900 block">
                  {brandName}
                </span>
                <span className="text-[11px] text-rose-600 font-medium block">
                  Affiliate Hub
                </span>
              </div>
            </div>

            {/* Back to store on mobile */}
            <button
              type="button"
              onClick={onNavigateHome}
              className="lg:hidden p-2 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              title="Về cửa hàng"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 lg:p-4 space-y-1">
            <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400 hidden lg:block">
              Quản lý đối tác
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-rose-50 text-rose-700 font-bold shadow-2xs border border-rose-100/60'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-rose-600' : 'text-neutral-400'}`} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.id === 'orders' && baseStats.attributedOrders.length > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-mono font-medium">
                      {baseStats.attributedOrders.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Lower Sidebar: Promo Card (Matching User's Reference Screenshot) & Footer Links */}
        <div className="p-3 lg:p-4 border-t border-neutral-100 space-y-3">
          {/* Subtle Pink Promotion Card (Matching image.png) */}
          <div className="hidden lg:block rounded-2xl bg-gradient-to-br from-rose-50/90 to-amber-50/60 border border-rose-100/80 p-3.5 text-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-white/90 border border-rose-200/60 p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                <img src="/assets/logo.png" alt="Not a Knot" className="w-full h-full object-contain" onError={(e) => { (e.target as any).src = logoUrl || ''; }} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-neutral-900 text-xs truncate">Chia sẻ Not a Knot</div>
                <div className="text-[11px] text-neutral-500 leading-tight">Lan toả phong cách & nhận hoa hồng</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSidebarCopyPromo}
              className="w-full py-2 px-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <span>{sidebarPromoCopied ? 'Đã sao chép link!' : 'Sao chép link ngay'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            {/* Back to Store Link */}
            <button
              type="button"
              onClick={onNavigateHome}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-600 hover:text-neutral-900 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-neutral-400" />
              <span>Về trang chủ cửa hàng</span>
            </button>

            {/* Logout Action */}
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-500" />
              <span>Đăng xuất tài khoản</span>
            </button>
          </div>
        </div>
      </aside>
    );
  };

  // Render Top Header for Overview & other tabs (Note: Orders page has its own dedicated Header as per design)
  const renderHeader = () => {
    return (
      <header className="bg-white border-b border-neutral-200/80 px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-20 backdrop-blur-md bg-white/95">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight">
            {activeTab === 'overview' && 'Tổng quan đối tác'}
            {activeTab === 'analytics' && 'Phân tích doanh số & hiệu quả'}
            {activeTab === 'links' && 'Liên kết & Công cụ tiếp thị'}
            {activeTab === 'guide' && 'Hướng dẫn cơ chế tiếp thị'}
            {activeTab === 'settings' && 'Cài đặt tài khoản đối tác'}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Theo dõi doanh số, hoa hồng và hiệu quả liên kết tiếp thị
          </p>
        </div>

        {/* Controls: Date range filter & Profile snapshot */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Date range filter segmented control */}
          <div className="flex items-center rounded-xl bg-neutral-100 p-1 border border-neutral-200/70 text-xs">
            {(['7days', '30days', '90days', 'all'] as OrdersDateRangePreset[]).map((preset) => {
              const labelMap: Record<OrdersDateRangePreset, string> = {
                '7days': '7 ngày',
                '30days': '30 ngày',
                '90days': '90 ngày',
                'all': 'Tất cả',
                'custom': 'Tùy chọn'
              };
              const isSelected = dateRange === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDateRange(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
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

          {/* User profile summary pill */}
          <div className="flex items-center gap-2.5 pl-2 sm:border-l border-neutral-200">
            <div
              className="w-8 h-8 rounded-xl text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0"
              style={{ backgroundColor: affiliateUser?.avatarColor || '#991b1b' }}
            >
              {affiliateUser?.name ? affiliateUser.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-neutral-900 leading-tight">
                {affiliateUser?.name || 'Đối tác'}
              </div>
              <div className="text-[10px] text-neutral-500 font-mono leading-tight">
                Mã: <span className="font-semibold text-rose-700">{affiliateCode}</span>
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  };

  // Render Hero Section (Overview Tab)
  const renderHeroSection = () => {
    const commissionRate = affiliateUser?.commissionRate !== undefined
      ? affiliateUser.commissionRate
      : systemConfig.defaultCommissionRate;

    return (
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-5 sm:p-6 lg:p-7 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-50/50 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Chương trình Tiếp thị liên kết chính thức</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                Xin chào, {affiliateUser?.name || 'Đối tác'}!
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className="inline-flex items-center gap-1.5 text-xs text-rose-700 hover:text-rose-800 font-medium hover:underline underline-offset-4 self-start sm:self-auto cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Xem hướng dẫn chi tiết &rarr;</span>
            </button>
          </div>

          <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-3xl">
            Chia sẻ liên kết giới thiệu độc quyền của bạn để nhận <strong className="text-rose-700 font-semibold">{commissionRate}% hoa hồng</strong> trên giá trị sản phẩm sau giảm giá (không tính phí vận chuyển) cho đơn hàng hợp lệ đầu tiên sau khi khách hàng nhấn link.
          </p>

          <div className="pt-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-mono text-neutral-800 select-all overflow-x-auto whitespace-nowrap">
                <Link2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{referralUrl}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer shadow-2xs ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white active:scale-98'
                  }`}
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã chép link!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép link</span>
                    </>
                  )}
                </button>

                {qrDataUrl && (
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="p-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition-colors cursor-pointer"
                    title="Mã QR liên kết"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                )}

                <a
                  href={referralUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition-colors cursor-pointer"
                  title="Mở liên kết kiểm tra"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500 pt-2 font-normal">
              <span>Thời hạn cookie: <strong className="text-neutral-800 font-medium">{systemConfig.cookieDurationDays} ngày</strong></span>
              <span className="text-neutral-300">&bull;</span>
              <span>Ghi nhận: <strong className="text-neutral-800 font-medium">Last-Click</strong></span>
              <span className="text-neutral-300">&bull;</span>
              <span>Tỷ lệ áp dụng: <strong className="text-rose-700 font-semibold">{commissionRate}%</strong></span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render 4 KPI Summary Cards (Overview Tab)
  const renderKpiCards = () => {
    const commissionRate = affiliateUser?.commissionRate !== undefined
      ? affiliateUser.commissionRate
      : systemConfig.defaultCommissionRate;

    const cards = [
      {
        id: 'orders',
        title: 'Đơn ghi nhận',
        value: currentMetrics.orderCount.toLocaleString('vi-VN'),
        unit: 'đơn',
        subtext: 'Đơn hàng hợp lệ đã ghi nhận',
        icon: ShoppingBag,
        color: 'rose',
        change: prevMetrics ? calcChange(currentMetrics.orderCount, prevMetrics.orderCount) : null
      },
      {
        id: 'revenue',
        title: 'Doanh thu sản phẩm',
        value: currentMetrics.revenue.toLocaleString('vi-VN'),
        unit: 'đ',
        subtext: 'Sau giảm giá, trừ phí ship',
        icon: TrendingUp,
        color: 'emerald',
        change: prevMetrics ? calcChange(currentMetrics.revenue, prevMetrics.revenue) : null
      },
      {
        id: 'commission',
        title: 'Hoa hồng ghi nhận',
        value: currentMetrics.commission.toLocaleString('vi-VN'),
        unit: 'đ',
        subtext: `Theo tỷ lệ hoa hồng ${commissionRate}%`,
        icon: Wallet,
        color: 'amber',
        highlight: true,
        change: prevMetrics ? calcChange(currentMetrics.commission, prevMetrics.commission) : null
      },
      {
        id: 'clicks',
        title: 'Lượt nhấp link',
        value: currentMetrics.clicks.toLocaleString('vi-VN'),
        unit: 'lượt',
        subtext: 'Lượt mở liên kết giới thiệu',
        icon: MousePointerClick,
        color: 'blue',
        change: prevMetrics ? calcChange(currentMetrics.clicks, prevMetrics.clicks) : null
      }
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className={`rounded-2xl border p-5 transition-shadow bg-white ${
                card.highlight
                  ? 'border-rose-200/90 shadow-xs ring-1 ring-rose-100/70'
                  : 'border-neutral-200/80 shadow-2xs hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-neutral-500">
                  {card.title}
                </span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  card.color === 'rose' ? 'bg-rose-50 text-rose-600' :
                  card.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                  card.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                  'bg-blue-50 text-blue-600'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-neutral-900 font-mono">
                  {card.value}
                </span>
                <span className="text-xs text-neutral-500 font-medium">
                  {card.unit}
                </span>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px]">
                <span className="text-neutral-500 truncate">
                  {card.subtext}
                </span>

                {card.change && (
                  <span className={`inline-flex items-center gap-0.5 font-medium shrink-0 ml-1 ${
                    card.change.isUp ? 'text-emerald-600' : 'text-neutral-500'
                  }`}>
                    {card.change.isUp ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    <span>{card.change.diff}%</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Analytics Section (Overview Tab)
  const renderAnalyticsSection = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                Xu hướng doanh thu & hoa hồng
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Biểu đồ diễn biến theo khoảng thời gian ({dateRangeBounds.label})
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-neutral-600">Doanh thu sản phẩm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-neutral-600">Hoa hồng ghi nhận</span>
              </div>
            </div>
          </div>

          {currentMetrics.orderCount === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center p-6 bg-neutral-50/50 rounded-xl border border-dashed border-neutral-200">
              <BarChart3 className="w-8 h-8 text-neutral-300 mb-2" />
              <p className="text-xs font-medium text-neutral-600">Chưa có dữ liệu đơn hàng trong khoảng thời gian này</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">Dữ liệu biểu đồ sẽ tự động hiển thị khi phát sinh đơn hàng hợp lệ.</p>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              <div className="h-52 w-full flex items-end gap-1.5 sm:gap-3 px-2 pt-6 pb-2 border-b border-neutral-100">
                {chartData.map((d, idx) => {
                  const revHeight = maxChartRevenue > 0 ? Math.min(100, Math.max(8, Math.round((d.revenue / maxChartRevenue) * 100))) : 8;
                  const commHeight = maxChartRevenue > 0 ? Math.min(100, Math.max(4, Math.round((d.commission / maxChartRevenue) * 100))) : 4;
                  return (
                    <div key={idx} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                      <div className="absolute -top-14 bg-neutral-900 text-white text-[10px] rounded-lg py-1 px-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap shadow-md">
                        <div>{d.dateLabel}</div>
                        <div>Doanh thu: {d.revenue.toLocaleString('vi-VN')}đ</div>
                        <div>Hoa hồng: {d.commission.toLocaleString('vi-VN')}đ</div>
                        <div>Đơn: {d.orders}</div>
                      </div>

                      <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full">
                        <div
                          className="w-1/2 max-w-[14px] bg-rose-400 hover:bg-rose-500 rounded-t transition-all"
                          style={{ height: `${revHeight}%` }}
                        />
                        <div
                          className="w-1/2 max-w-[14px] bg-amber-400 hover:bg-amber-500 rounded-t transition-all"
                          style={{ height: `${commHeight}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-neutral-400 mt-2 truncate max-w-full font-mono">
                        {d.shortDate}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                <span>0đ</span>
                <span>Giá trị cao nhất: {maxChartRevenue.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
              Phân bổ trạng thái đơn
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Tỷ lệ trạng thái các đơn hàng ghi nhận
            </p>
          </div>

          {currentMetrics.orderCount === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center p-6 bg-neutral-50/50 rounded-xl border border-dashed border-neutral-200">
              <ShoppingBag className="w-8 h-8 text-neutral-300 mb-2" />
              <p className="text-xs font-medium text-neutral-600">Chưa có đơn hàng để phân tích</p>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="w-full h-3 rounded-full bg-neutral-100 overflow-hidden flex">
                {orderStatusDistribution.map((item, idx) => (
                  item.percentage > 0 && (
                    <div
                      key={idx}
                      className="h-full transition-all"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color
                      }}
                      title={`${item.label}: ${item.count} đơn (${item.percentage}%)`}
                    />
                  )
                ))}
              </div>

              <div className="space-y-2.5 pt-1">
                {orderStatusDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-neutral-700 font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-neutral-900 font-semibold">{item.count}</span>
                      <span className="text-neutral-400 text-[11px]">({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-neutral-100 text-[11px] text-neutral-500">
                Đơn hàng đã xóa trong quản trị hệ thống sẽ tự động bị loại bỏ khỏi thống kê.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Attributed Orders Table (Overview Tab)
  const renderOverviewRecentOrdersTable = () => {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-neutral-900 tracking-tight">
                Đơn hàng ghi nhận gần đây
              </h3>
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-neutral-100 text-neutral-600 font-mono">
                {recentOrdersList.length}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Bảo mật tuyệt đối thông tin riêng tư khách hàng (ẩn tên, SĐT, địa chỉ)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={overviewSearchQuery}
                onChange={(e) => setOverviewSearchQuery(e.target.value)}
                placeholder="Tìm mã đơn hàng..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 text-xs bg-neutral-50/70 focus:bg-white focus:border-rose-500 outline-none transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className="text-xs text-rose-700 hover:text-rose-800 font-medium whitespace-nowrap cursor-pointer hover:underline underline-offset-4"
            >
              Xem tất cả &rarr;
            </button>
          </div>
        </div>

        {recentOrdersList.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h4 className="text-xs sm:text-sm font-semibold text-neutral-800">
              Chưa có đơn hàng nào
            </h4>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              {overviewSearchQuery
                ? 'Không tìm thấy đơn hàng phù hợp với từ khóa tìm kiếm.'
                : 'Chia sẻ liên kết tiếp thị của bạn để bắt đầu ghi nhận đơn hàng đầu tiên.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50/80 border-b border-neutral-100 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                  <th className="py-3 px-4 sm:px-6">Mã đơn hàng</th>
                  <th className="py-3 px-4">Ngày đặt</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Giá trị tính hoa hồng</th>
                  <th className="py-3 px-4 text-center">Tỷ lệ áp dụng</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Hoa hồng ghi nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {recentOrdersList.slice(0, 6).map((ord) => {
                  const merchVal = typeof ord.affiliateMerchandiseValue === 'number'
                    ? ord.affiliateMerchandiseValue
                    : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));

                  const commRate = typeof ord.affiliateCommissionRate === 'number'
                    ? ord.affiliateCommissionRate
                    : (affiliateUser?.commissionRate || 10);

                  const commAmount = typeof ord.affiliateCommissionAmount === 'number'
                    ? ord.affiliateCommissionAmount
                    : Math.round((merchVal * commRate) / 100);

                  const rawStatus = (ord.status || 'Chờ xác nhận').toLowerCase();
                  let statusBadgeClass = 'bg-neutral-100 text-neutral-700';
                  if (rawStatus.includes('hủy') || rawStatus.includes('từ chối') || rawStatus === 'cancelled') {
                    statusBadgeClass = 'bg-rose-50 text-rose-700';
                  } else if (rawStatus.includes('thành công') || rawStatus.includes('đã giao') || rawStatus.includes('hoàn tất') || rawStatus === 'delivered') {
                    statusBadgeClass = 'bg-emerald-50 text-emerald-700';
                  } else if (rawStatus.includes('giao')) {
                    statusBadgeClass = 'bg-blue-50 text-blue-700';
                  } else {
                    statusBadgeClass = 'bg-amber-50 text-amber-800';
                  }

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => setActiveTab('orders')}
                      className="hover:bg-neutral-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 sm:px-6 font-mono font-medium text-neutral-900">
                        {ord.id}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-500">
                        {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }) : (ord.date || '—')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${statusBadgeClass}`}>
                          {ord.status || 'Chờ xác nhận'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-neutral-800">
                        {merchVal.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-neutral-600 font-medium">
                          {commRate}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-semibold text-rose-700 text-xs sm:text-sm">
                        +{commAmount.toLocaleString('vi-VN')}đ
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Render Detailed Guide Page (/affiliate/guide tab)
  const renderGuideSection = () => {
    const commissionRate = affiliateUser?.commissionRate !== undefined
      ? affiliateUser.commissionRate
      : systemConfig.defaultCommissionRate;

    return (
      <div className="space-y-6 max-w-4xl">
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2.5 text-rose-700">
            <BookOpen className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-semibold text-neutral-900 tracking-tight">
              Hướng dẫn cơ chế Tiếp thị liên kết (Affiliate Program)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
            Hệ thống affiliate của Not a Knot vận hành theo nguyên tắc minh bạch, tự động và công bằng, giúp các đối tác an tâm phát triển nội dung và nhận hoa hồng xứng đáng.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/70 space-y-2">
              <div className="flex items-center gap-2 text-neutral-900 font-semibold text-xs sm:text-sm">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs">1</span>
                <span>Thời hạn Cookie ({systemConfig.cookieDurationDays} ngày)</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Khi khách hàng nhấn vào link giới thiệu của bạn, trình duyệt sẽ lưu trữ cookie trong <strong className="text-neutral-900">{systemConfig.cookieDurationDays} ngày</strong>. Nếu khách hàng quay lại mua sắm trong thời hạn này, đơn hàng vẫn được ghi nhận cho bạn.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/70 space-y-2">
              <div className="flex items-center gap-2 text-neutral-900 font-semibold text-xs sm:text-sm">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs">2</span>
                <span>Nguyên tắc Last-Click Attribution</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Nếu khách hàng nhấp vào nhiều liên kết tiếp thị của các đối tác khác nhau, đối tác mà khách hàng nhấp vào <strong className="text-neutral-900">gần nhất</strong> trước khi đặt hàng sẽ là người được ghi nhận đơn và hưởng hoa hồng.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/70 space-y-2">
              <div className="flex items-center gap-2 text-neutral-900 font-semibold text-xs sm:text-sm">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs">3</span>
                <span>Chỉ tính đơn đầu tiên sau lượt nhấp</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Hoa hồng được tính cho <strong className="text-neutral-900">đơn hàng đầu tiên</strong> hợp lệ phát sinh sau lượt click. Sau khi hoàn tất đơn đầu tiên, cookie giới thiệu sẽ được giải phóng để bảo đảm tính khách quan.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/70 space-y-2">
              <div className="flex items-center gap-2 text-neutral-900 font-semibold text-xs sm:text-sm">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs">4</span>
                <span>Công thức tính hoa hồng</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Hoa hồng = <strong className="text-neutral-900">(Giá trị sản phẩm - Voucher giảm giá) × {commissionRate}%</strong>. Phí vận chuyển không nằm trong giá trị tính hoa hồng. Đơn bị xóa hoặc hủy sẽ tự động loại khỏi thống kê.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-1">
            <span className="font-semibold block">Quy định đối soát & thanh toán</span>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Bộ phận kế toán của Not a Knot sẽ định kỳ kiểm tra các đơn hàng đã giao thành công và liên hệ đối soát, chuyển khoản hoa hồng trực tiếp vào tài khoản ngân hàng của đối tác.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render Links & Tools Section
  const renderLinksSection = () => {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-6 space-y-4">
          <h2 className="text-base font-semibold text-neutral-900 tracking-tight">
            Liên kết giới thiệu & Mã QR cá nhân
          </h2>
          <p className="text-xs text-neutral-600">
            Sử dụng liên kết này để đặt trên tiểu sử mạng xã hội (Bio TikTok, Instagram, Threads, Facebook) hoặc gửi trực tiếp cho bạn bè.
          </p>

          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/70 space-y-3">
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Liên kết gốc
            </div>
            <div className="flex items-center gap-2 font-mono text-xs sm:text-sm text-neutral-900 break-all">
              <Link2 className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{referralUrl}</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                {copiedLink ? 'Đã sao chép!' : 'Sao chép liên kết'}
              </button>
              {qrDataUrl && (
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="px-4 py-2 border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Xem mã QR
                </button>
              )}
            </div>
          </div>

          {qrDataUrl && (
            <div className="flex items-center gap-6 p-4 rounded-xl border border-neutral-100 bg-white">
              <img src={qrDataUrl} alt="Mã QR Affiliate" className="w-28 h-28 rounded-lg border border-neutral-200 shadow-2xs shrink-0" />
              <div className="space-y-1 text-xs">
                <span className="font-semibold text-neutral-900 block">Mã QR Tiếp thị</span>
                <p className="text-neutral-500 text-[11px] leading-relaxed">
                  Quét mã QR bằng camera điện thoại để truy cập ngay vào cửa hàng kèm cookie tiếp thị {affiliateCode}.
                </p>
                <a
                  href={qrDataUrl}
                  download={`qrcode-affiliate-${affiliateCode}.png`}
                  className="inline-block text-rose-700 hover:text-rose-800 font-medium pt-1"
                >
                  Tải ảnh mã QR &darr;
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Settings Section
  const renderSettingsSection = () => {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-6 space-y-4">
          <h2 className="text-base font-semibold text-neutral-900 tracking-tight">
            Thông tin tài khoản đối tác
          </h2>
          <div className="divide-y divide-neutral-100 text-xs">
            <div className="py-3 flex justify-between items-center">
              <span className="text-neutral-500">Họ và tên:</span>
              <span className="font-semibold text-neutral-900">{affiliateUser?.name}</span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-neutral-500">Mã tiếp thị (Referral Code):</span>
              <span className="font-mono font-semibold text-rose-700">{affiliateCode}</span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-neutral-500">Tỷ lệ hoa hồng cá nhân:</span>
              <span className="font-semibold text-neutral-900">{affiliateUser?.commissionRate || systemConfig.defaultCommissionRate}%</span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-neutral-500">Email Google liên kết:</span>
              <span className="font-mono text-neutral-800">{affiliateUser?.googleEmail || (affiliateUser as any)?.email || 'Chưa liên kết'}</span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-neutral-500">Cơ chế xác thực:</span>
              <span className="text-emerald-700 font-medium">Google Firebase Auth</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 text-neutral-900 flex flex-col lg:flex-row selection:bg-rose-500 selection:text-white font-sans">
      {/* 1. Left Sidebar Navigation */}
      {renderSidebar()}

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header - Rendered on Overview and other pages */}
        {activeTab !== 'orders' && renderHeader()}

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full">
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-44 bg-neutral-200/60 rounded-2xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="h-28 bg-neutral-200/60 rounded-2xl" />
                <div className="h-28 bg-neutral-200/60 rounded-2xl" />
                <div className="h-28 bg-neutral-200/60 rounded-2xl" />
                <div className="h-28 bg-neutral-200/60 rounded-2xl" />
              </div>
              <div className="h-64 bg-neutral-200/60 rounded-2xl" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <>
                  {renderHeroSection()}
                  {renderKpiCards()}
                  {renderAnalyticsSection()}
                  {renderOverviewRecentOrdersTable()}
                </>
              )}

              {/* Dedicated Orders Management Page */}
              {activeTab === 'orders' && (
                <AffiliateOrdersPage
                  orders={currentAttributedOrders}
                  affiliateUser={affiliateUser}
                  clicksCount={currentClicksCount}
                  prevClicksCount={prevClicksCount}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  customStartDate={customStartDate}
                  setCustomStartDate={setCustomStartDate}
                  customEndDate={customEndDate}
                  setCustomEndDate={setCustomEndDate}
                  dateRangeLabel={dateRangeBounds.label}
                  comparisonBounds={{
                    hasComparison: dateRangeBounds.hasComparison,
                    prevStart: dateRangeBounds.prevStart,
                    prevEnd: dateRangeBounds.prevEnd
                  }}
                  allBaseOrders={baseStats.attributedOrders}
                />
              )}

              {activeTab === 'analytics' && renderAnalyticsSection()}
              {activeTab === 'links' && renderLinksSection()}
              {activeTab === 'guide' && renderGuideSection()}
              {activeTab === 'settings' && renderSettingsSection()}
            </>
          )}
        </main>
      </div>

      {/* QR Code Modal Shortcut */}
      {showQrModal && qrDataUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative border border-neutral-100 text-center space-y-4">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-neutral-900">
                Mã QR Liên Kết Của Bạn
              </h3>
              <p className="text-xs text-neutral-500">
                Mã đối tác: <strong className="text-rose-700 font-mono">{affiliateCode}</strong>
              </p>
            </div>

            <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 inline-block shadow-inner">
              <img src={qrDataUrl} alt="Mã QR Affiliate" className="w-56 h-56 mx-auto rounded-xl" />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium transition-colors cursor-pointer"
              >
                {copiedLink ? 'Đã sao chép link' : 'Sao chép link'}
              </button>
              <a
                href={qrDataUrl}
                download={`qrcode-affiliate-${affiliateCode}.png`}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors cursor-pointer inline-flex items-center justify-center"
              >
                Tải ảnh mã QR
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
