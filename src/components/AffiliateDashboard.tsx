import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutDashboard, ShoppingBag, BarChart3, Link2, BookOpen, Settings, Copy, Check, QrCode, ExternalLink, ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, MousePointerClick, ArrowLeft, LogOut, Search, ChevronRight, X, Sparkles, CheckCircle2, Clock, Share2, Send, Smartphone, MessageSquare, Download, Lock, Tag, Save, RefreshCw
} from 'lucide-react';
import QRCode from 'qrcode';
import { SellerUser, StoredOrder, AffiliateSystemConfig, Product, CategoryItem, CollectionInfo } from '../types';
import {
  calculateAffiliateStats,
  calculateDetailedAffiliateCommission,
  getAffiliateReferralUrl,
  fetchAffiliateSystemConfig,
  fetchAffiliateClicks,
  DEFAULT_AFFILIATE_CONFIG,
  AffiliateClickRecord
} from '../utils/affiliateManager';
import { fetchOrdersFromFirestore, saveSellerToFirestore } from '../firebase';
import { getStorefrontCategoryOptions, getVisibleCollections, isProductMatchingCategory } from '../utils/storefrontCatalog';
import { AffiliateGuide } from './AffiliateGuide';
import { getAffiliateCommissionDisplay } from '../utils/affiliateCommissionDisplay';
import { AffiliatePaymentSettings } from './AffiliatePaymentSettings';
import { emptyAffiliatePaymentAccount, formatAffiliatePayment, validateAffiliatePayment } from '../utils/affiliatePayment';
import { getAffiliateCommissionPayments, isAffiliateOrder } from '../utils/affiliateCommissionPayments';
import { AffiliateCommissionPaymentBadge } from './AffiliateCommissionPaymentBadge';
import { AffiliateOrdersPage, OrdersDateRangePreset } from './AffiliateOrdersPage';

export interface AffiliateDashboardProps {
  products: Product[];
  categories: CategoryItem[];
  collections: CollectionInfo[];
  isCatalogLoading?: boolean;
  currentSeller: SellerUser | null;
  orders?: StoredOrder[];
  onLoginSuccess?: (user: SellerUser) => void;
  onLogout: () => void;
  onNavigateHome: () => void;
  brandName?: string;
  logoUrl?: string;
  preview?: { config: AffiliateSystemConfig; clicks: AffiliateClickRecord[] };
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
  products,
  categories,
  collections,
  isCatalogLoading = false,
  orders,
  onLoginSuccess,
  onLogout,
  onNavigateHome,
  brandName = 'NOT A KNOT',
  logoUrl,
  preview
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

  const dashboardRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (preview) dashboardRef.current?.parentElement?.scrollTo({ top: 0 }); else window.scrollTo({ top: 0, behavior: 'instant' }); }, [activeTab, Boolean(preview)]);

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

  // Toast notification for link copying and actions
  const [linksToast, setLinksToast] = useState<string | null>(null);
  const showLinksToast = (msg: string) => {
    setLinksToast(msg);
    setTimeout(() => setLinksToast(null), 3000);
  };

  // Custom affiliate link generator states
  const [destType, setDestType] = useState<'home' | 'catalog' | 'category' | 'collection' | 'custom'>('home');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [customPathInput, setCustomPathInput] = useState<string>('');
  const [copiedCustomLink, setCopiedCustomLink] = useState<boolean>(false);

  // Product link generator states
  const [productSearch, setProductSearch] = useState<string>('');
  const [productCategoryTab, setProductCategoryTab] = useState<string>('all');
  const [copiedProductId, setCopiedProductId] = useState<string | null>(null);

  // Dedicated QR Code Tool state
  const [qrMode, setQrMode] = useState<'home' | 'product'>('home');
  const [qrSelectedProductId, setQrSelectedProductId] = useState('');
  const qrSelectedProduct = products.find((p) => p.id === qrSelectedProductId) || products[0] || null;
  const [dedicatedQrDataUrl, setDedicatedQrDataUrl] = useState<string>('');
  const [copiedDedicatedQrLink, setCopiedDedicatedQrLink] = useState<boolean>(false);
  const qrSectionRef = useRef<HTMLDivElement | null>(null);
  // Profile Settings state (affiliate can edit name, phone, paymentInfo; affiliateCode and commissionRate are read-only)
  const [profileName, setProfileName] = useState<string>(() => affiliateUser?.name || '');
  const [profilePhone, setProfilePhone] = useState<string>(() => affiliateUser?.phone || '');
  const [profilePaymentAccount, setProfilePaymentAccount] = useState(() => affiliateUser?.paymentAccount || emptyAffiliatePaymentAccount());
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [refreshingOrders, setRefreshingOrders] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<{ error: boolean; text: string } | null>(null);
  const refreshInFlight = useRef(false);
  const refreshOrders = async (showFeedback = true) => {
    if (preview || refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshingOrders(true);
    setRefreshMessage(null);
    try {
      setFetchedOrders(await fetchOrdersFromFirestore(true, { requireServer: true }) as StoredOrder[]);
      if (showFeedback) setRefreshMessage({ error: false, text: 'Đơn hàng và hoa hồng đã được cập nhật.' });
    } catch {
      setRefreshMessage({ error: true, text: 'Không thể cập nhật đơn hàng. Dữ liệu trước đó vẫn được giữ nguyên. Vui lòng thử lại.' });
    } finally {
      refreshInFlight.current = false;
      setRefreshingOrders(false);
    }
  };
  useEffect(() => {
    if (preview || orders) return;
    const refresh = () => { void refreshOrders(false); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [preview, orders]);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Build full origin
  const siteOrigin = useMemo(() => {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
    return 'https://notaknot.id.vn';
  }, []);

  const categoryOptions = useMemo(
    () => getStorefrontCategoryOptions(products, categories, collections),
    [products, categories, collections]
  );
  const linkCategories = categoryOptions.filter((c) => c.id !== 'all');
  const visibleCollections = useMemo(() => getVisibleCollections(collections, categories), [collections, categories]);
  const categoryKey = linkCategories.some((c) => c.id === selectedCategoryKey) ? selectedCategoryKey : (linkCategories[0]?.id || '');
  const collectionId = visibleCollections.some((c) => c.id === selectedCollectionId) ? selectedCollectionId : (visibleCollections[0]?.id || '');
  const activeProductCategory = categoryOptions.some((c) => c.id === productCategoryTab) ? productCategoryTab : 'all';
  const cookieDays = affiliateUser?.cookieDurationDays || systemConfig.cookieDurationDays || 30;
  const commissionRate = affiliateUser?.commissionRate ?? systemConfig.defaultCommissionRate;
  const commissionDisplay = getAffiliateCommissionDisplay(affiliateUser, systemConfig.defaultCommissionRate);
  const maxOrders = affiliateUser?.maxOrdersPerCookieSession ?? 1;
  const orderLimitLabel = maxOrders === 0 ? 'Không giới hạn trong thời hạn cookie' : maxOrders === 1 ? '1 đơn đầu tiên' : `Tối đa ${maxOrders} đơn trong thời hạn cookie`;
  const commissionModelLabel = affiliateUser?.commissionModel === 'by_product' ? 'Theo từng sản phẩm' : affiliateUser?.commissionModel === 'tiered' ? 'Theo giá trị từng đơn' : 'Tỷ lệ cố định';

  // Compute custom destination URL
  const customGeneratedUrl = useMemo(() => {
    if (destType === 'home') {
      return `${siteOrigin}/?ref=${affiliateCode}`;
    }
    if (destType === 'catalog') {
      return `${siteOrigin}/?page=catalog&ref=${affiliateCode}`;
    }
    if (destType === 'category' && categoryKey) {
      return `${siteOrigin}/?page=catalog&category=${encodeURIComponent(categoryKey)}&ref=${affiliateCode}`;
    }
    if (destType === 'collection' && collectionId) {
      return `${siteOrigin}/?collection=${encodeURIComponent(collectionId)}&ref=${affiliateCode}`;
    }
    if (destType === 'custom') {
      let p = customPathInput.trim();
      if (!p) return `${siteOrigin}/?ref=${affiliateCode}`;
      if (!p.startsWith('/')) p = `/${p}`;
      const sep = p.includes('?') ? '&' : '?';
      return `${siteOrigin}${p}${sep}ref=${affiliateCode}`;
    }
    return `${siteOrigin}/?ref=${affiliateCode}`;
  }, [destType, categoryKey, collectionId, customPathInput, siteOrigin, affiliateCode]);

  // Helper: get product affiliate URL
  const getProductAffiliateUrl = (productId: string) => {
    return `${siteOrigin}/?product=${encodeURIComponent(productId)}&ref=${affiliateCode}`;
  };

  // QR Code active target URL
  const activeQrTargetUrl = useMemo(() => {
    if (qrMode === 'product' && qrSelectedProduct) {
      return getProductAffiliateUrl(qrSelectedProduct.id);
    }
    return referralUrl;
  }, [qrMode, qrSelectedProduct, referralUrl, siteOrigin, affiliateCode]);

  // Generate high-res QR for active QR tool
  useEffect(() => {
    let cancelled = false;
    setDedicatedQrDataUrl('');
    if (activeQrTargetUrl) {
      QRCode.toDataURL(activeQrTargetUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#1c1917',
          light: '#ffffff'
        }
      })
        .then((url) => { if (!cancelled) setDedicatedQrDataUrl(url); })
        .catch((e) => console.warn('QR Code generation error:', e));
    }
    return () => { cancelled = true; };
  }, [activeQrTargetUrl]);

  // Keep profile form synced if currentSeller changes
  useEffect(() => {
    if (affiliateUser) {
      setProfileName(affiliateUser.name || '');
      setProfilePhone(affiliateUser.phone || '');
      setProfilePaymentAccount(affiliateUser.paymentAccount || emptyAffiliatePaymentAccount());
    }
  }, [affiliateUser]);

  // Load config & clicks & orders
  useEffect(() => {
    if (preview) {
      setSystemConfig(preview.config);
      setClicks(preview.clicks);
      setFetchedOrders(orders || []);
      setIsLoading(false);
      return;
    }
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
  }, [affiliateCode, orders, preview]);

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

  // Active orders list (from props or Firestore) with zero-trust customer privacy sanitization
  const activeOrdersList = useMemo(() => {
    const rawList = fetchedOrders;
    // Strictly sanitize orders: customer name, customer phone, address, and items composition are omitted
    return rawList.map((ord) => ({
      id: ord.id,
      date: ord.date,
      createdAt: ord.createdAt,
      status: ord.status,
      affiliateCode: ord.affiliateCode,
      affiliateCommissionRate: ord.affiliateCommissionRate,
      affiliateCommissionAmount: ord.affiliateCommissionAmount,
      affiliateMerchandiseValue: ord.affiliateMerchandiseValue,
      affiliateCommissionPaid: ord.affiliateCommissionPaid,
      affiliateCommissionPaidAmount: ord.affiliateCommissionPaidAmount,
      affiliateCommissionPaidAt: ord.affiliateCommissionPaidAt,
      affiliateCommissionPaidBy: ord.affiliateCommissionPaidBy,
      subtotal: ord.subtotal,
      totalPrice: ord.totalPrice,
      discountAmount: ord.discountAmount,
      shippingFee: ord.shippingFee,
      isDeleted: ord.isDeleted,
      // Strip confidential customer and product composition details
      customerName: undefined,
      customerPhone: undefined,
      phone: undefined,
      address: undefined,
      customerAddress: undefined,
      shippingAddress: undefined,
      note: undefined,
      items: [],
      itemDetails: []
    } as unknown as StoredOrder));
  }, [fetchedOrders]);

  // Base attributed orders for this affiliate (removes deleted/cancelled orders)
  const baseStats = useMemo(() => {
    if (!affiliateUser) {
      return { totalOrders: 0, totalMerchandiseValue: 0, totalCommission: 0, attributedOrders: [] };
    }
    return calculateAffiliateStats(affiliateUser, activeOrdersList);
  }, [affiliateUser, activeOrdersList]);
  const commissionPayments = useMemo(() => getAffiliateCommissionPayments(affiliateUser, activeOrdersList, systemConfig.defaultCommissionRate), [affiliateUser, activeOrdersList, systemConfig.defaultCommissionRate]);

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
  }, [dateRange, customStartDate, customEndDate, fetchedOrders]);

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
    const max = Math.max(...chartData.flatMap((d) => [d.revenue, d.commission]), 0);
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
      <aside className={`w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-neutral-200/80 shrink-0 flex flex-col justify-between select-none lg:fixed lg:left-0 lg:z-30 lg:overflow-y-auto lg:overscroll-contain ${preview ? 'lg:top-12 lg:bottom-0 lg:h-[calc(100dvh-3rem)]' : 'lg:inset-y-0 lg:h-dvh'}`}>
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
              onClick={() => setConfirmLogout(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-500" />
              <span>{preview ? 'Thoát bản xem thử' : 'Đăng xuất tài khoản'}</span>
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
          {(activeTab === 'overview' || activeTab === 'analytics') && <div className="flex items-center rounded-xl bg-neutral-100 p-1 border border-neutral-200/70 text-xs" aria-label="Lọc ngày thống kê">
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
          </div>}

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
                Xin chào, {affiliateUser?.name || affiliateUser?.username || 'bạn'}!
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
            Chia sẻ liên kết giới thiệu độc quyền của bạn để nhận <strong className="text-rose-700 font-semibold">{commissionDisplay.description}</strong> trên giá trị sản phẩm sau giảm giá (không tính phí vận chuyển). Số đơn ghi nhận: {orderLimitLabel.toLowerCase()}.
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
              <span>Thời hạn cookie: <strong className="text-neutral-800 font-medium">{cookieDays} ngày</strong></span>
              <span className="text-neutral-300">&bull;</span>
              <span>Ghi nhận: <strong className="text-neutral-800 font-medium">Last-Click</strong></span>
              <span className="text-neutral-300">&bull;</span>
              <span>{commissionDisplay.label}: <strong className="text-rose-700 font-semibold">{commissionDisplay.value}</strong></span>
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
        subtext: `Cơ chế: ${commissionModelLabel.toLowerCase()}`,
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
                  const revHeight = maxChartRevenue > 0 ? Math.min(100, Math.max(0, (d.revenue / maxChartRevenue) * 100)) : 0;
                  const commHeight = maxChartRevenue > 0 ? Math.min(100, Math.max(0, (d.commission / maxChartRevenue) * 100)) : 0;
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
                  <th className="py-3 px-4 text-center">Thanh toán hoa hồng</th>
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
                      <td className="py-3.5 px-4 text-center"><AffiliateCommissionPaymentBadge order={ord} /></td>
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

  // ----------------------------------------------------
  // RENDER: REDESIGNED "LINK & CÔNG CỤ" MARKETING TOOLKIT
  // ----------------------------------------------------
  const renderLinksSection = () => {
    const commissionRate = affiliateUser?.commissionRate !== undefined
      ? affiliateUser.commissionRate
      : systemConfig.defaultCommissionRate;

    // Filtered products for Product Link Generator
    const filteredCatalogProducts = products.filter((p) => {
      // 1. Search filter
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase().trim();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchId = (p.id || '').toLowerCase().includes(q);
        if (!matchName && !matchId) return false;
      }
      return isProductMatchingCategory(p, activeProductCategory, collections);
    });

    // Quick sharing handlers
    const handleShareFacebook = () => {
      const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`;
      window.open(shareUrl, '_blank', 'width=600,height=500,scrollbars=yes,resizable=yes');
    };

    const handleShareMessenger = () => {
      // Direct Facebook send dialog or prompt copy
      const messengerUrl = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(referralUrl)}&app_id=291494419107518&redirect_uri=${encodeURIComponent(referralUrl)}`;
      try {
        window.open(messengerUrl, '_blank', 'width=600,height=500');
      } catch {
        handleCopyLink();
        showLinksToast('Đã sao chép liên kết để gửi qua Messenger!');
      }
    };

    const handleShareZalo = () => {
      const zaloUrl = `https://zalo.me/share?url=${encodeURIComponent(referralUrl)}`;
      window.open(zaloUrl, '_blank', 'width=600,height=500');
      showLinksToast('Đang mở Zalo chia sẻ liên kết...');
    };

    const handleShareWhatsApp = () => {
      const text = `Khám phá các mẫu phụ kiện thủ công Not a Knot cực xinh: ${referralUrl}`;
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    };

    const handleShareNative = async () => {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: `Not a Knot - Phụ kiện handmade thủ công`,
            text: `Khám phá bộ sưu tập vòng tay & phụ kiện handmade tinh xảo của Not a Knot:`,
            url: referralUrl
          });
          showLinksToast('Đã chia sẻ thành công!');
        } catch {
          // Fallback to copy link
          handleCopyLink();
        }
      } else {
        handleCopyLink();
        showLinksToast('Thiết bị không hỗ trợ chia sẻ gốc, đã sao chép liên kết vào clipboard!');
      }
    };

    const handleCopyCustomLink = async () => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(customGeneratedUrl);
        } else {
          const ta = document.createElement('textarea');
          ta.value = customGeneratedUrl;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setCopiedCustomLink(true);
        showLinksToast('Đã sao chép liên kết tùy chỉnh!');
        setTimeout(() => setCopiedCustomLink(false), 2500);
      } catch {
        showLinksToast(`Liên kết: ${customGeneratedUrl}`);
      }
    };

    const handleCopyProductLink = async (prod: Product) => {
      const url = getProductAffiliateUrl(prod.id);
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
        setCopiedProductId(prod.id);
        showLinksToast(`Đã sao chép link sản phẩm "${prod.name}"!`);
        setTimeout(() => setCopiedProductId(null), 2500);
      } catch {
        showLinksToast(`Liên kết: ${url}`);
      }
    };

    const handleSelectProductForQr = (prod: Product) => {
      setQrMode('product');
      setQrSelectedProductId(prod.id);
      if (qrSectionRef.current) {
        qrSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      showLinksToast(`Đã tải sản phẩm "${prod.name}" vào công cụ tạo mã QR!`);
    };

    const handleCopyDedicatedQrLink = async () => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(activeQrTargetUrl);
        } else {
          const ta = document.createElement('textarea');
          ta.value = activeQrTargetUrl;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setCopiedDedicatedQrLink(true);
        showLinksToast('Đã sao chép liên kết mã QR!');
        setTimeout(() => setCopiedDedicatedQrLink(false), 2500);
      } catch {
        showLinksToast(`Liên kết: ${activeQrTargetUrl}`);
      }
    };

    return (
      <div className="space-y-8 max-w-5xl">
        {/* Toast Feedback Notification */}
        {linksToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-xs sm:text-sm px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-fadeIn border border-neutral-700/80">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{linksToast}</span>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* 1. MAIN AFFILIATE LINK HERO CARD */}
        {/* ---------------------------------------------------- */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-2xs p-6 sm:p-8 relative overflow-hidden space-y-6">
          <div className="absolute top-0 right-0 w-80 h-80 bg-rose-50/60 rounded-full blur-3xl pointer-events-none" />

          <div className="relative space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 tracking-wide uppercase">
              <Sparkles className="w-4 h-4" />
              <span>Liên kết tiếp thị chính thức</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
              Liên kết giới thiệu & Công cụ tiếp thị
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-2xl leading-relaxed">
              Sử dụng liên kết này để chia sẻ trên tiểu sử mạng xã hội, tin nhắn hoặc bài viết review. Bất kỳ khách hàng nào nhấn vào liên kết sẽ được ghi nhận cookie đối tác trong vòng {cookieDays} ngày.
            </p>
          </div>

          {/* URL Box & Actions */}
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50/90 border border-neutral-200/80 space-y-3">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Liên kết giới thiệu của bạn (Cố định mã đối tác)
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-xl border border-neutral-200/90 shadow-2xs">
              <div className="flex items-center gap-2.5 font-mono text-xs sm:text-sm text-neutral-900 break-all px-2 min-w-0">
                <Link2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="truncate">{referralUrl}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
                <a
                  href={referralUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl transition-colors cursor-pointer"
                  title="Mở thử liên kết trên tab mới"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (qrSectionRef.current) {
                      qrSectionRef.current.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      setShowQrModal(true);
                    }
                  }}
                  className="p-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl transition-colors cursor-pointer"
                  title="Xem mã QR"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* System Attributes Pill Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-neutral-50/80 border border-neutral-200/70">
              <span className="text-[11px] text-neutral-500 block">Mã đối tác cá nhân</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-rose-700 text-sm">{affiliateCode}</span>
                <span title="Mã tiếp thị cố định của bạn" className="cursor-help">
                  <Lock className="w-3 h-3 text-neutral-400" />
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-50/80 border border-neutral-200/70">
              <span className="text-[11px] text-neutral-500 block">{commissionDisplay.label}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-neutral-900 text-sm">{commissionDisplay.value}</span>
                <span title={commissionDisplay.tooltip} className="cursor-help">
                  <Lock className="w-3 h-3 text-neutral-400" />
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-50/80 border border-neutral-200/70">
              <span className="text-[11px] text-neutral-500 block">Thời hạn Cookie</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-neutral-900 text-sm">{cookieDays} ngày</span>
                <Clock className="w-3 h-3 text-neutral-400" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/70 flex flex-col justify-center">
              <span className="text-[11px] text-rose-800 font-medium block">Quy chế tiếp thị</span>
              <button
                type="button"
                onClick={() => setActiveTab('guide')}
                className="text-left text-xs text-rose-700 hover:text-rose-900 font-bold hover:underline underline-offset-4 mt-0.5 flex items-center gap-1 cursor-pointer"
              >
                <span>Xem quy chế chi tiết</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {/* ---------------------------------------------------- */}
        {/* 2. QUICK SHARING TOOLS ("Công cụ chia sẻ nhanh") */}
        {/* ---------------------------------------------------- */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-2xs p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-rose-600" />
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                  Công cụ chia sẻ nhanh
                </h3>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Gửi liên kết tiếp thị đến bạn bè và cộng đồng qua các kênh mạng xã hội chỉ với một chạm.
              </p>
            </div>
          </div>

          {/* Social Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Facebook */}
            <button
              type="button"
              onClick={handleShareFacebook}
              className="p-3.5 rounded-2xl border border-neutral-200 hover:border-blue-300 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-neutral-800">Facebook</span>
            </button>

            {/* Messenger */}
            <button
              type="button"
              onClick={handleShareMessenger}
              className="p-3.5 rounded-2xl border border-neutral-200 hover:border-blue-300 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-neutral-800">Messenger</span>
            </button>

            {/* Zalo */}
            <button
              type="button"
              onClick={handleShareZalo}
              className="p-3.5 rounded-2xl border border-neutral-200 hover:border-blue-300 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                Zalo
              </div>
              <span className="text-xs font-semibold text-neutral-800">Zalo Chat</span>
            </button>

            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="p-3.5 rounded-2xl border border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50/50 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Send className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-neutral-800">WhatsApp</span>
            </button>

            {/* Device Native Share */}
            <button
              type="button"
              onClick={handleShareNative}
              className="p-3.5 rounded-2xl border border-neutral-200 hover:border-purple-300 hover:bg-purple-50/50 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-neutral-800">Thiết bị</span>
            </button>

            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-3.5 rounded-2xl border border-neutral-200 hover:border-rose-300 hover:bg-rose-50/50 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Copy className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-neutral-800">Sao chép link</span>
            </button>
          </div>

          {/* Social Bio Practical Helper Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-neutral-50/80 border border-neutral-200/70 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900">
                  <span>Tiểu sử Instagram (Bio Link)</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Đặt link vào phần "Trang web" ở hồ sơ cá nhân để người theo dõi ấn vào mua sắm.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl text-xs font-medium text-neutral-800 shrink-0 cursor-pointer shadow-2xs"
              >
                Sao chép URL Bio
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50/80 border border-neutral-200/70 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900">
                  <span>Tiểu sử TikTok (Bio Link)</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Dán liên kết vào Bio hoặc ghim link dưới video review đồ thủ công.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl text-xs font-medium text-neutral-800 shrink-0 cursor-pointer shadow-2xs"
              >
                Sao chép URL Bio
              </button>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* 3. CUSTOM AFFILIATE LINK GENERATOR */}
        {/* ---------------------------------------------------- */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-2xs p-6 sm:p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-rose-600" />
              <h3 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                Tạo liên kết tiếp thị tùy chỉnh
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Dẫn khách hàng trực tiếp đến đúng trang sản phẩm, danh mục hoặc bộ sưu tập mà bạn muốn giới thiệu.
            </p>
          </div>

          {/* Destination Selector Tabs */}
          <div className="space-y-4">
            <label className="block text-xs font-bold text-neutral-700">
              Chọn điểm đến trên cửa hàng:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {[
                { id: 'home', label: 'Trang chủ' },
                { id: 'catalog', label: 'Tất cả sản phẩm' },
                { id: 'category', label: 'Theo danh mục' },
                { id: 'collection', label: 'Bộ sưu tập' },
                { id: 'custom', label: 'Đường dẫn tùy chọn' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDestType(tab.id as any)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                    destType === tab.id
                      ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs'
                      : 'bg-neutral-50/70 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Dynamic Dropdown when Category selected */}
            {destType === 'category' && (
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2 animate-fadeIn">
                <label className="block text-xs font-bold text-neutral-700">
                  Chọn danh mục mong muốn:
                </label>
                <select
                  value={categoryKey}
                  onChange={(e) => setSelectedCategoryKey(e.target.value)}
                  className="w-full sm:w-80 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-800 outline-none focus:border-rose-500 font-medium"
                >
                  {linkCategories.length === 0 && <option value="">Chưa có danh mục đang hiển thị</option>}
                  {linkCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dynamic Dropdown when Collection selected */}
            {destType === 'collection' && (
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2 animate-fadeIn">
                <label className="block text-xs font-bold text-neutral-700">
                  Chọn bộ sưu tập chủ đề:
                </label>
                <select
                  value={collectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="w-full sm:w-80 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-800 outline-none focus:border-rose-500 font-medium"
                >
                  {visibleCollections.length === 0 && <option value="">Chưa có bộ sưu tập đang hiển thị</option>}
                  {visibleCollections.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Path Input */}
            {destType === 'custom' && (
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2 animate-fadeIn">
                <label className="block text-xs font-bold text-neutral-700">
                  Nhập đường dẫn trang web:
                </label>
                <input
                  type="text"
                  value={customPathInput}
                  onChange={(e) => setCustomPathInput(e.target.value)}
                  placeholder="VD: /about hoặc /contact"
                  className="w-full sm:w-96 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-800 outline-none focus:border-rose-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Generated URL Box */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/90 space-y-2">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
              Liên kết tùy chỉnh đã tạo (tự động gắn ?ref={affiliateCode}):
            </span>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-neutral-200 shadow-2xs">
              <span className="font-mono text-xs sm:text-sm text-neutral-900 break-all truncate">
                {customGeneratedUrl}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyCustomLink}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copiedCustomLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép link</span>
                    </>
                  )}
                </button>
                <a
                  href={customGeneratedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 border border-neutral-200 hover:bg-neutral-50 rounded-xl text-neutral-700 transition-colors cursor-pointer"
                  title="Mở thử liên kết trên tab mới"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* 4. PRODUCT LINK GENERATOR ("Tạo link cho từng sản phẩm") */}
        {/* ---------------------------------------------------- */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-2xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-rose-600" />
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                  Tạo liên kết cho từng sản phẩm
                </h3>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Lựa chọn sản phẩm cụ thể để lấy link tiếp thị trực tiếp, xem mức hoa hồng ước tính nhận được cho mỗi đơn hàng.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Tìm sản phẩm theo tên..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-800 outline-none focus:border-rose-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {categoryOptions.map((catTab) => (
              <button
                key={catTab.id}
                type="button"
                onClick={() => setProductCategoryTab(catTab.id)}
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeProductCategory === catTab.id
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {catTab.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-neutral-500">Hoa hồng minh họa cho 1 sản phẩm ở giá hiện tại, chưa áp dụng giảm giá hoặc tùy chọn thêm. Số thực tế được tính khi đặt đơn.</p>
          {isCatalogLoading ? <p role="status" className="text-sm text-neutral-500">Đang cập nhật sản phẩm...</p> : filteredCatalogProducts.length === 0 && <p role="status" className="text-sm text-neutral-500">Không có sản phẩm phù hợp.</p>}
          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalogProducts.map((prod) => {
              const estimate = calculateDetailedAffiliateCommission(affiliateUser || { commissionRate } as SellerUser,
                [{ productId: prod.id, price: prod.price, quantity: 1 }], prod.price, 0, commissionRate);
              const estimatedComm = estimate.commissionAmount;
              const isCopied = copiedProductId === prod.id;

              return (
                <div
                  key={prod.id}
                  className="bg-white rounded-2xl border border-neutral-200/80 p-4 space-y-3 hover:border-neutral-300 hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-100 border border-neutral-100">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          (e.target as any).src = '/assets/logo.png';
                        }}
                      />
                      {prod.discountBadge && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-600 text-white">
                          {prod.discountBadge}
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold text-neutral-900 text-xs sm:text-sm line-clamp-2 leading-snug">
                        {prod.name}
                      </h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono font-bold text-neutral-900 text-xs sm:text-sm">
                          {prod.price.toLocaleString('vi-VN')}đ
                        </span>
                        <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                          +{estimatedComm.toLocaleString('vi-VN')}đ ({estimate.effectiveRate}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Product Link Action Buttons */}
                  <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => handleCopyProductLink(prod)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs active:scale-95'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã sao chép link</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép link sản phẩm</span>
                        </>
                      )}
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectProductForQr(prod)}
                        className="flex-1 py-1.5 px-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1"
                        title="Tạo mã QR riêng cho sản phẩm này"
                      >
                        <QrCode className="w-3 h-3 text-neutral-500" />
                        <span>Tạo mã QR</span>
                      </button>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* 5. QR CODE GENERATOR ("Mã QR Tiếp thị") */}
        {/* ---------------------------------------------------- */}
        <div
          ref={qrSectionRef}
          id="qr-generator-section"
          className="bg-white rounded-3xl border border-neutral-200/90 shadow-2xs p-6 sm:p-8 space-y-6"
        >
          <div>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-rose-600" />
              <h3 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                Tạo mã QR tiếp thị
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Quét mã QR bằng camera điện thoại để truy cập ngay vào cửa hàng hoặc sản phẩm kèm cookie tiếp thị {affiliateCode}.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setQrMode('home')}
              className={`py-2 px-3.5 rounded-xl border font-semibold transition-colors cursor-pointer ${
                qrMode === 'home'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Mã QR Trang chủ chung
            </button>
            <button
              type="button"
              onClick={() => setQrMode('product')}
              disabled={!qrSelectedProduct}
              className={`py-2 px-3.5 rounded-xl border font-semibold transition-colors cursor-pointer ${
                qrMode === 'product'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Mã QR Sản phẩm: {qrSelectedProduct?.name ? qrSelectedProduct.name.slice(0, 24) + '...' : 'Chọn sản phẩm'}
            </button>
          </div>

          {/* QR Display Card */}
          <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200/90 flex flex-col md:flex-row items-center gap-8">
            <div className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-xs shrink-0">
              {dedicatedQrDataUrl ? (
                <img
                  src={dedicatedQrDataUrl}
                  alt="Mã QR Tiếp thị Not a Knot"
                  className="w-48 h-48 rounded-xl object-contain"
                />
              ) : (
                <div className="w-48 h-48 rounded-xl bg-neutral-100 animate-pulse flex items-center justify-center text-xs text-neutral-400">
                  Đang nạp mã QR...
                </div>
              )}
            </div>

            <div className="space-y-4 flex-1 text-center md:text-left">
              <div>
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Đích đến của mã QR
                </span>
                <h4 className="text-sm sm:text-base font-bold text-neutral-900 mt-0.5">
                  {qrMode === 'product' && qrSelectedProduct ? qrSelectedProduct.name : 'Trang chủ Not a Knot'}
                </h4>
                <div className="font-mono text-xs text-neutral-600 break-all mt-1 bg-white p-2 rounded-lg border border-neutral-200">
                  {activeQrTargetUrl}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                {dedicatedQrDataUrl && (
                  <a
                    href={dedicatedQrDataUrl}
                    download={`qrcode-notaknot-${affiliateCode}${qrMode === 'product' ? '-product' : ''}.png`}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải ảnh mã QR (PNG)</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleCopyDedicatedQrLink}
                  className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {copiedDedicatedQrLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã sao chép link</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép link mã QR</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  };

  // ----------------------------------------------------
  // RENDER: EDITABLE SETTINGS SECTION
  // ----------------------------------------------------
  const renderSettingsSection = () => {
    const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!affiliateUser) return;
      setIsSavingProfile(true);
      setProfileSuccessMsg(null);

      try {
        const hasPayment = Object.values(profilePaymentAccount).some(value => value.trim());
        const paymentError = hasPayment ? validateAffiliatePayment(profilePaymentAccount) : null;
        if (paymentError) throw new Error(paymentError);
        const updatedUser: SellerUser = {
          ...affiliateUser,
          name: profileName.trim() || affiliateUser.name,
          phone: profilePhone.trim() || affiliateUser.phone,
          paymentInfo: hasPayment ? formatAffiliatePayment(profilePaymentAccount) : affiliateUser.paymentInfo,
          paymentAccount: hasPayment ? { ...profilePaymentAccount, accountNumber: profilePaymentAccount.accountNumber.trim(), accountName: profilePaymentAccount.accountName.trim() } : undefined
        };

        if (!preview) await saveSellerToFirestore(updatedUser);
        onLoginSuccess?.(updatedUser);
        setProfileSuccessMsg(preview ? 'Đã cập nhật bản xem thử. Dữ liệu thật không thay đổi.' : 'Đã lưu thông tin tài khoản thành công!');
        setTimeout(() => setProfileSuccessMsg(null), 3000);
      } catch (err: any) {
        alert(err?.message || 'Có lỗi khi lưu thông tin tài khoản.');
      } finally {
        setIsSavingProfile(false);
      }
    };

    return (
      <div className="space-y-6 max-w-4xl">
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-neutral-200/90 shadow-2xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                Cài đặt tài khoản đối tác
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Chỉnh sửa tên hiển thị, số điện thoại và thông tin nhận chuyển khoản hoa hồng.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </div>

          {profileSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          <div className="space-y-4 text-xs">
            {/* Editable Name */}
            <div>
              <label className="block font-bold text-neutral-800 mb-1">
                Họ và tên đối tác <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Nhập họ và tên hiển thị..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-900 focus:bg-white focus:border-rose-500 outline-none transition-colors"
              />
            </div>

            {/* Editable Phone */}
            <div>
              <label className="block font-bold text-neutral-800 mb-1">
                Số điện thoại liên hệ
              </label>
              <input
                type="text"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                placeholder="Nhập số điện thoại..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-900 focus:bg-white focus:border-rose-500 outline-none transition-colors"
              />
            </div>

            {/* Editable Payment Info */}
            <AffiliatePaymentSettings value={profilePaymentAccount} onChange={setProfilePaymentAccount} availableCommission={commissionPayments.available} affiliateCode={affiliateCode} legacyPaymentInfo={affiliateUser?.paymentInfo} preview={Boolean(preview)} />

            {/* Read-only system values */}
            <div className="pt-4 border-t border-neutral-100 space-y-3">
              <h3 className="font-bold text-neutral-900 text-xs uppercase tracking-wider text-neutral-400">
                Thông số hệ thống
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70">
                  <span className="text-[11px] text-neutral-500 block">Mã tiếp thị (Referral Code)</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono font-bold text-rose-700 text-sm">{affiliateCode}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-200 text-neutral-700 font-medium">Cố định</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70">
                  <span className="text-[11px] text-neutral-500 block">{commissionDisplay.label}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono font-bold text-neutral-900 text-sm">{commissionDisplay.value}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-200 text-neutral-700 font-medium">
                      {affiliateUser?.commissionModel === 'by_product' ? 'Có SP riêng' : (affiliateUser?.commissionModel === 'tiered' ? 'Theo giá trị đơn' : 'Cố định')}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70">
                  <span className="text-[11px] text-neutral-500 block">Email Google liên kết</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono font-medium text-neutral-800 text-xs truncate">
                      {affiliateUser?.googleEmail || (affiliateUser as any)?.email || 'Chưa liên kết'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70">
                  <span className="text-[11px] text-neutral-500 block">Thời hạn lưu Cookie</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono font-bold text-neutral-900 text-sm">
                      {affiliateUser?.cookieDurationDays ? `${affiliateUser.cookieDurationDays} ngày` : `${systemConfig.cookieDurationDays || 30} ngày (chuẩn)`}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70">
                  <span className="text-[11px] text-neutral-500 block">Số đơn ghi nhận / Session</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono font-bold text-neutral-900 text-sm">
                      {affiliateUser?.maxOrdersPerCookieSession === 0
                        ? 'Không giới hạn đơn'
                        : (affiliateUser?.maxOrdersPerCookieSession && affiliateUser.maxOrdersPerCookieSession > 1
                          ? `Tối đa ${affiliateUser.maxOrdersPerCookieSession} đơn`
                          : '1 đơn đầu tiên')}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70">
                  <span className="text-[11px] text-neutral-500 block">Cơ chế tính hoa hồng</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-bold text-neutral-900 text-xs truncate">
                      {affiliateUser?.commissionModel === 'by_product'
                        ? `Theo SP (${affiliateUser.productCommissions?.length || 0} SP riêng)`
                        : (affiliateUser?.commissionModel === 'tiered'
                          ? `Bậc doanh thu (${affiliateUser.tieredCommissions?.length || 0} mức)`
                          : 'Cố định theo đơn')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  };

  const renderCommissionPayments = () => (
    <section aria-label="Sổ hoa hồng" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-neutral-900">Thanh toán hoa hồng</h2>
        {!preview && <button type="button" disabled={refreshingOrders} onClick={() => refreshOrders()} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshingOrders ? 'animate-spin' : ''}`} />{refreshingOrders ? 'Đang cập nhật...' : 'Cập nhật'}</button>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([['Hoa hồng ghi nhận', commissionPayments.earned], ['Đã thanh toán', commissionPayments.paid], ['Hoa hồng đang có', commissionPayments.available]] as const).map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">{label}</p>
            <strong className="text-lg text-rose-800">{value.toLocaleString('vi-VN')}đ</strong>
            <p className="text-[10px] text-neutral-400 mt-1">Toàn thời gian</p>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setShowPaymentHistory(!showPaymentHistory)} className="text-xs text-rose-700 font-semibold underline">{showPaymentHistory ? 'Ẩn' : 'Xem'} {commissionPayments.paidOrders} đơn đã trả hoa hồng</button>
      {showPaymentHistory && <div className="rounded-xl border bg-white p-4 space-y-2">
        <h3 className="font-bold text-sm">Lịch sử trả hoa hồng</h3>
        {activeOrdersList.filter(order => affiliateUser && order.affiliateCommissionPaid && isAffiliateOrder(affiliateUser, order)).map(order => <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs"><span className="font-mono">{order.id}</span><AffiliateCommissionPaymentBadge order={order} /></div>)}
        {commissionPayments.paidOrders === 0 && <p className="text-xs text-neutral-500">Chưa có đơn được admin đánh dấu đã trả.</p>}
      </div>}
    </section>
  );

  return (
    <div ref={dashboardRef} className="min-h-screen bg-neutral-50/50 text-neutral-900 flex flex-col lg:flex-row selection:bg-rose-500 selection:text-white font-sans">
      {/* 1. Left Sidebar Navigation */}
      {renderSidebar()}

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Top Header - Rendered on Overview and other pages */}
        {activeTab !== 'orders' && renderHeader()}

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full">
          {refreshMessage && <p role={refreshMessage.error ? 'alert' : 'status'} className={`rounded-xl border p-3 text-xs ${refreshMessage.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{refreshMessage.text}</p>}
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
                  onRefresh={preview ? undefined : () => refreshOrders()}
                  isRefreshing={refreshingOrders}
                />
              )}

              {activeTab === 'analytics' && <>{renderAnalyticsSection()}{renderCommissionPayments()}</>}
              {activeTab === 'links' && renderLinksSection()}
              {activeTab === 'guide' && <AffiliateGuide affiliate={affiliateUser} config={systemConfig} products={products} onOpenLinks={() => setActiveTab('links')} onOpenSettings={() => setActiveTab('settings')} onOpenOrders={() => setActiveTab('orders')} />}
              {activeTab === 'settings' && renderSettingsSection()}
            </>
          )}
        </main>
      </div>

      {/* QR Code Modal Shortcut */}
      {confirmLogout && <div role="dialog" aria-modal="true" aria-label="Xác nhận đăng xuất" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div className="rounded-2xl bg-white p-6 max-w-sm w-full space-y-4"><h2 className="font-bold text-lg">{preview ? 'Thoát bản xem thử?' : 'Đăng xuất tài khoản?'}</h2><p className="text-sm text-neutral-600">{preview ? 'Phiên đăng nhập admin vẫn được giữ nguyên.' : 'Bạn cần đăng nhập lại để xem đơn hàng và hoa hồng của mình.'}</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setConfirmLogout(false)} className="rounded-xl border px-4 py-2 text-sm">Hủy</button><button type="button" onClick={() => { setConfirmLogout(false); onLogout(); }} className="rounded-xl bg-rose-700 text-white px-4 py-2 text-sm">{preview ? 'Thoát preview' : 'Đăng xuất'}</button></div></div></div>}
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
