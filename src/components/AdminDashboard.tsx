import React, { useState, useMemo } from 'react';
import { Product, CategoryItem, SellerUser } from '../types';
import { StoredOrder } from '../firebase';
import { deduplicateSellers } from '../utils/auth';
import { Award, UserCheck, TrendingUp, Users, ShoppingBag, ArrowUpDown, ArrowUp, ArrowDown, PieChart, ExternalLink, BarChart3 } from 'lucide-react';

const SLICE_COLORS = [
  '#2563EB', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#64748B', // Slate
];

function getDonutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.99) {
    return [
      'M', cx, cy - rOuter,
      'A', rOuter, rOuter, 0, 1, 1, cx, cy + rOuter,
      'A', rOuter, rOuter, 0, 1, 1, cx, cy - rOuter,
      'M', cx, cy - rInner,
      'A', rInner, rInner, 0, 1, 0, cx, cy + rInner,
      'A', rInner, rInner, 0, 1, 0, cx, cy - rInner,
      'Z'
    ].join(' ');
  }

  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180.0;
  const startOuter = { x: cx + rOuter * Math.cos(rad(startAngle)), y: cy + rOuter * Math.sin(rad(startAngle)) };
  const endOuter = { x: cx + rOuter * Math.cos(rad(endAngle)), y: cy + rOuter * Math.sin(rad(endAngle)) };
  const startInner = { x: cx + rInner * Math.cos(rad(endAngle)), y: cy + rInner * Math.sin(rad(endAngle)) };
  const endInner = { x: cx + rInner * Math.cos(rad(startAngle)), y: cy + rInner * Math.sin(rad(startAngle)) };
  const largeArcFlag = sweep <= 180 ? 0 : 1;

  return [
    'M', startOuter.x, startOuter.y,
    'A', rOuter, rOuter, 0, largeArcFlag, 1, endOuter.x, endOuter.y,
    'L', startInner.x, startInner.y,
    'A', rInner, rInner, 0, largeArcFlag, 0, endInner.x, endInner.y,
    'Z'
  ].join(' ');
}

interface AdminDashboardProps {
  orders: StoredOrder[];
  products: Product[];
  categories: CategoryItem[];
  sellers?: SellerUser[];
  onNavigateToOrders: () => void;
  onNavigateToManualOrder: () => void;
}

// Helper to calculate net merchandise revenue strictly excluding shipping fees
function getOrderNetRevenue(o: StoredOrder): number {
  const rawTotal = o.totalPrice ?? o.totalAmount ?? 0;
  const shipping = Number(o.shippingFee) || 0;
  return Math.max(0, rawTotal - shipping);
}

function getOrderPaidRevenue(o: StoredOrder): number {
  const netTotal = getOrderNetRevenue(o);
  if (o.paymentStatus === 'paid') {
    return netTotal;
  }
  const rawTotal = o.totalPrice ?? o.totalAmount ?? 0;
  const paidRaw = Number(o.paidAmount) || 0;
  if (rawTotal > 0) {
    if (paidRaw >= rawTotal) return netTotal;
    return Math.max(0, Math.round(paidRaw * (netTotal / rawTotal)));
  }
  return Math.max(0, paidRaw - (Number(o.shippingFee) || 0));
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  products,
  categories,
  sellers = [],
  onNavigateToOrders,
  onNavigateToManualOrder
}) => {
  const [timeRange, setTimeRange] = useState<'all' | 'today' | '7days' | '30days' | 'this_month'>('all');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('all');
  const [productRankingSortBy, setProductRankingSortBy] = useState<'revenue' | 'quantity' | 'orders'>('revenue');

  type SellerSortField = 'rank' | 'name' | 'orderCount' | 'totalRevenue' | 'percent';
  const [sellerSortField, setSellerSortField] = useState<SellerSortField>('totalRevenue');
  const [sellerSortOrder, setSellerSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hoveredSellerKey, setHoveredSellerKey] = useState<string | null>(null);

  const handleSellerSort = (field: SellerSortField) => {
    if (sellerSortField === field) {
      setSellerSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSellerSortField(field);
      setSellerSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  // Filter orders by time range
  const timeFilteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return orders.filter((ord) => {
      let orderTime = 0;
      if (ord.createdAt) {
        orderTime = new Date(ord.createdAt).getTime();
      } else if (ord.date) {
        orderTime = new Date(ord.date).getTime();
      }

      if (isNaN(orderTime) || orderTime === 0) return true;

      switch (timeRange) {
        case 'today':
          return orderTime >= todayStart;
        case '7days':
          return orderTime >= sevenDaysAgo;
        case '30days':
          return orderTime >= thirtyDaysAgo;
        case 'this_month':
          return orderTime >= monthStart;
        case 'all':
        default:
          return true;
      }
    });
  }, [orders, timeRange]);

  // Valid orders before seller filtering (for team-wide seller ranking)
  const teamValidOrders = useMemo(() => {
    return timeFilteredOrders.filter((o) => o.status !== 'cancelled' && o.status !== 'Đã hủy');
  }, [timeFilteredOrders]);

  // Overall Team Gross Revenue (excluding shipping fees)
  const teamGrossRevenue = useMemo(() => {
    return teamValidOrders.reduce((sum, o) => {
      return sum + getOrderNetRevenue(o);
    }, 0);
  }, [teamValidOrders]);

  // Seller Leaderboard & Ranking Calculation
  const sellerRanking = useMemo(() => {
    const cleanSellers = deduplicateSellers(sellers);
    const map: Record<string, {
      id: string;
      name: string;
      username: string;
      avatarColor: string;
      isRootAdmin: boolean;
      orderCount: number;
      completedCount: number;
      totalRevenue: number;
      paidRevenue: number;
    }> = {};

    // 1. Initialize from known deduplicated sellers list keyed by s.id
    cleanSellers.forEach((s) => {
      const sId = s.id || `seller-${(s.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
      map[sId] = {
        id: sId,
        name: s.name,
        username: s.username,
        avatarColor: s.avatarColor || '#B41C1A',
        isRootAdmin: !!s.isRootAdmin,
        orderCount: 0,
        completedCount: 0,
        totalRevenue: 0,
        paidRevenue: 0
      };
    });

    // Helper for normalized string comparison
    const norm = (str: string) =>
      str.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 2. Tally from orders (net revenue excluding shipping fees)
    teamValidOrders.forEach((o) => {
      const amt = getOrderNetRevenue(o);
      const paid = getOrderPaidRevenue(o);
      const isCompleted = o.status === 'completed' || o.status === 'Đã giao';

      const isLockedSource = o.source === 'website' || o.source === 'mạng xã hội' || o.source === 'facebook' || o.source === 'tiktok' || o.source === 'instagram' || o.source === 'zalo' || o.source === 'shopee';

      if (isLockedSource) {
        // Online / Website / Social Media Direct (No individual salesperson tracking)
        const isSocial = o.source === 'mạng xã hội' || o.source === 'facebook' || o.source === 'tiktok' || o.source === 'instagram' || o.source === 'zalo';
        const key = isSocial ? 'seller-social-media' : 'seller-website';
        if (!map[key]) {
          map[key] = {
            id: key,
            name: isSocial ? 'Mạng Xã Hội (Tự Động)' : 'Website (Tự Động)',
            username: isSocial ? 'social_media' : 'website',
            avatarColor: isSocial ? '#3B82F6' : '#64748B',
            isRootAdmin: false,
            orderCount: 0,
            completedCount: 0,
            totalRevenue: 0,
            paidRevenue: 0
          };
        }
        map[key].orderCount += 1;
        map[key].totalRevenue += amt;
        map[key].paidRevenue += paid;
        if (isCompleted) map[key].completedCount += 1;
        return;
      }

      const sName = o.sellerName ? o.sellerName.trim() : '';
      const normSName = norm(sName);

      // Match against cleanSellers
      const matched = cleanSellers.find(
        (s) => (o.sellerId && s.id === o.sellerId) ||
               (normSName && norm(s.name) === normSName) ||
               (normSName && norm(s.username) === normSName)
      );

      if (matched) {
        const sId = matched.id;
        if (!map[sId]) {
          map[sId] = {
            id: sId,
            name: matched.name,
            username: matched.username,
            avatarColor: matched.avatarColor || '#B41C1A',
            isRootAdmin: !!matched.isRootAdmin,
            orderCount: 0,
            completedCount: 0,
            totalRevenue: 0,
            paidRevenue: 0
          };
        }
        map[sId].orderCount += 1;
        map[sId].totalRevenue += amt;
        map[sId].paidRevenue += paid;
        if (isCompleted) map[sId].completedCount += 1;
      } else if (sName || o.sellerId) {
        // Unknown/manual seller name or sellerId
        const slug = (sName || o.sellerId || 'seller').toLowerCase().trim().replace(/[^a-z0-9_]/g, '') || 'manual';
        const targetId = o.sellerId || `seller-${slug}`;

        // If targetId or slug already exists in map, add to existing
        if (!map[targetId]) {
          map[targetId] = {
            id: targetId,
            name: sName || targetId,
            username: slug,
            avatarColor: '#D97706',
            isRootAdmin: false,
            orderCount: 0,
            completedCount: 0,
            totalRevenue: 0,
            paidRevenue: 0
          };
        }
        map[targetId].orderCount += 1;
        map[targetId].totalRevenue += amt;
        map[targetId].paidRevenue += paid;
        if (isCompleted) map[targetId].completedCount += 1;
      } else {
        // Online / Website Direct
        const key = 'seller-website';
        if (!map[key]) {
          map[key] = {
            id: 'seller-website',
            name: 'Website / Tự Động',
            username: 'website',
            avatarColor: '#2563EB',
            isRootAdmin: false,
            orderCount: 0,
            completedCount: 0,
            totalRevenue: 0,
            paidRevenue: 0
          };
        }
        map[key].orderCount += 1;
        map[key].totalRevenue += amt;
        map[key].paidRevenue += paid;
        if (isCompleted) map[key].completedCount += 1;
      }
    });

    // Deduplicate and merge any identically keyed items
    const mergedMap: Record<string, typeof map[string]> = {};
    Object.values(map).forEach((item) => {
      if (!item) return;
      const cleanId = item.id || `seller-${(item.username || '').toLowerCase()}`;
      if (!mergedMap[cleanId]) {
        mergedMap[cleanId] = { ...item, id: cleanId };
      } else {
        mergedMap[cleanId].orderCount += item.orderCount;
        mergedMap[cleanId].completedCount += item.completedCount;
        mergedMap[cleanId].totalRevenue += item.totalRevenue;
        mergedMap[cleanId].paidRevenue += item.paidRevenue;
      }
    });

    const totalRev = teamGrossRevenue || 1;
    return Object.values(mergedMap)
      .map((item) => ({
        ...item,
        percent: totalRev > 0 ? Number(((item.totalRevenue / totalRev) * 100).toFixed(1)) : 0,
        completionRate: item.orderCount > 0 ? Math.round((item.completedCount / item.orderCount) * 100) : 0
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
        sliceColor: SLICE_COLORS[idx % SLICE_COLORS.length]
      }));
  }, [sellers, teamValidOrders, teamGrossRevenue]);

  const sortedSellerRanking = useMemo(() => {
    const list = [...sellerRanking];
    list.sort((a, b) => {
      let comparison = 0;
      if (sellerSortField === 'rank') {
        comparison = a.rank - b.rank;
      } else if (sellerSortField === 'name') {
        comparison = a.name.localeCompare(b.name, 'vi');
      } else if (sellerSortField === 'orderCount') {
        comparison = a.orderCount - b.orderCount;
      } else if (sellerSortField === 'totalRevenue') {
        comparison = a.totalRevenue - b.totalRevenue;
      } else if (sellerSortField === 'percent') {
        comparison = a.percent - b.percent;
      }
      return sellerSortOrder === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [sellerRanking, sellerSortField, sellerSortOrder]);

  const pieSlices = useMemo(() => {
    const sellersWithRevenue = sellerRanking.filter((s) => s.totalRevenue > 0);
    const totalRev = sellersWithRevenue.reduce((acc, s) => acc + s.totalRevenue, 0);
    if (totalRev === 0) return [];

    let currentAngle = 0;
    return sellersWithRevenue.map((seller) => {
      const sliceAngle = (seller.totalRevenue / totalRev) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      return {
        seller,
        startAngle,
        endAngle,
        percent: Number(((seller.totalRevenue / totalRev) * 100).toFixed(1))
      };
    });
  }, [sellerRanking]);

  // Filter orders by selected seller (if a seller is chosen)
  const filteredOrders = useMemo(() => {
    if (selectedSellerFilter === 'all') return timeFilteredOrders;

    return timeFilteredOrders.filter((ord) => {
      const isLockedSource = ord.source === 'website' || ord.source === 'mạng xã hội' || ord.source === 'facebook' || ord.source === 'tiktok' || ord.source === 'instagram' || ord.source === 'zalo' || ord.source === 'shopee';
      const sName = ord.sellerName ? ord.sellerName.toLowerCase().trim() : '';

      if (selectedSellerFilter === 'website') {
        return ord.source === 'website' || (!ord.sellerId && (!sName || sName === 'website' || sName.includes('tự động')));
      }
      if (selectedSellerFilter === 'social_media') {
        return ord.source === 'mạng xã hội' || ord.source === 'facebook' || ord.source === 'tiktok' || ord.source === 'instagram' || ord.source === 'zalo';
      }

      if (isLockedSource) return false;

      return (
        sName === selectedSellerFilter.toLowerCase() ||
        ord.sellerId === selectedSellerFilter ||
        sellers.some(
          (s) => (s.id === selectedSellerFilter || s.username.toLowerCase() === selectedSellerFilter.toLowerCase()) &&
                 (s.name.toLowerCase() === sName || s.username.toLowerCase() === sName)
        )
      );
    });
  }, [timeFilteredOrders, selectedSellerFilter, sellers]);

  // Valid orders for active view
  const validOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status !== 'cancelled' && o.status !== 'Đã hủy');
  }, [filteredOrders]);

  // 1. Total Gross Revenue (merchandise revenue excluding shipping fees)
  const totalGrossRevenue = useMemo(() => {
    return validOrders.reduce((sum, o) => {
      return sum + getOrderNetRevenue(o);
    }, 0);
  }, [validOrders]);

  // 2. Real Collected Revenue (excluding shipping fees)
  const totalPaidRevenue = useMemo(() => {
    return validOrders.reduce((sum, o) => {
      return sum + getOrderPaidRevenue(o);
    }, 0);
  }, [validOrders]);

  // 3. Pending COD / Uncollected Revenue
  const pendingRevenue = useMemo(() => {
    return Math.max(0, totalGrossRevenue - totalPaidRevenue);
  }, [totalGrossRevenue, totalPaidRevenue]);

  // 4. Completed Orders Count
  const completedOrdersCount = useMemo(() => {
    return validOrders.filter((o) => o.status === 'completed' || o.status === 'Đã giao').length;
  }, [validOrders]);

  // 5. Total Units Sold
  const totalUnitsSold = useMemo(() => {
    return validOrders.reduce((sum, ord) => {
      if (ord.itemDetails && ord.itemDetails.length > 0) {
        return sum + ord.itemDetails.reduce((sub, it) => sub + (it.quantity || 1), 0);
      }
      return sum + (ord.items ? ord.items.length : 1);
    }, 0);
  }, [validOrders]);

  // 6. Average Order Value (AOV - merchandise value excluding shipping)
  const averageOrderValue = useMemo(() => {
    if (validOrders.length === 0) return 0;
    return Math.round(totalGrossRevenue / validOrders.length);
  }, [validOrders, totalGrossRevenue]);

  // 7. Completion Rate
  const completionRate = useMemo(() => {
    if (validOrders.length === 0) return 0;
    return Math.round((completedOrdersCount / validOrders.length) * 100);
  }, [validOrders, completedOrdersCount]);

  // 8. Revenue by Channel (excluding shipping fees)
  const sourceMetrics = useMemo(() => {
    const counts: Record<string, { count: number; revenue: number; label: string }> = {
      website: { count: 0, revenue: 0, label: 'Website Trực Tuyến' },
      'mạng xã hội': { count: 0, revenue: 0, label: 'Mạng Xã Hội' },
      'trực tiếp': { count: 0, revenue: 0, label: 'Trực Tiếp / Xưởng' }
    };

    validOrders.forEach((o) => {
      const src = o.source || 'website';
      const amt = getOrderNetRevenue(o);
      if (src === 'website') {
        counts.website.count++;
        counts.website.revenue += amt;
      } else if (src === 'mạng xã hội' || src === 'facebook' || src === 'zalo' || src === 'instagram') {
        counts['mạng xã hội'].count++;
        counts['mạng xã hội'].revenue += amt;
      } else {
        counts['trực tiếp'].count++;
        counts['trực tiếp'].revenue += amt;
      }
    });

    const totalRev = totalGrossRevenue || 1;
    return Object.entries(counts).map(([k, v]) => ({
      key: k,
      ...v,
      percent: Math.round((v.revenue / totalRev) * 100)
    }));
  }, [validOrders, totalGrossRevenue]);

  // 9. Payment Methods Breakdown (excluding shipping fees)
  const paymentMetrics = useMemo(() => {
    let bankTransfer = { count: 0, revenue: 0 };
    let cod = { count: 0, revenue: 0 };
    let cash = { count: 0, revenue: 0 };
    let billAttachedCount = 0;

    validOrders.forEach((o) => {
      const amt = getOrderNetRevenue(o);
      if (o.bankReceiptImage) billAttachedCount++;

      const method = o.paymentMethod || (o.bankReceiptImage ? 'bank_transfer' : 'cash');
      if (method === 'bank_transfer') {
        bankTransfer.count++;
        bankTransfer.revenue += amt;
      } else if (method === 'cod') {
        cod.count++;
        cod.revenue += amt;
      } else {
        cash.count++;
        cash.revenue += amt;
      }
    });

    return { bankTransfer, cod, cash, billAttachedCount };
  }, [validOrders]);

  // 10. Status Funnel
  const statusFunnel = useMemo(() => {
    const counts = {
      'Đã đặt': 0,
      'Đã tiếp nhận': 0,
      'Đã thanh toán': 0,
      'Đã giao': 0
    };

    filteredOrders.forEach((o) => {
      const rawSt = (o.status || 'Đã đặt').toLowerCase().trim();
      if (['đã giao', 'shipping', 'completed', 'delivered', 'đang giao', 'hoàn thành'].includes(rawSt)) {
        counts['Đã giao']++;
      } else if (['đã thanh toán', 'paid', 'confirmed'].includes(rawSt)) {
        counts['Đã thanh toán']++;
      } else if (['đã tiếp nhận', 'tiếp nhận', 'received', 'acknowledged', 'processing', 'crafting'].includes(rawSt)) {
        counts['Đã tiếp nhận']++;
      } else {
        counts['Đã đặt']++;
      }
    });

    return [
      { id: 'Đã đặt', label: 'Đã đặt (Mới)', count: counts['Đã đặt'], color: 'border-amber-200 bg-amber-50/70 text-amber-950' },
      { id: 'Đã tiếp nhận', label: 'Đã tiếp nhận', count: counts['Đã tiếp nhận'], color: 'border-sky-200 bg-sky-50/70 text-sky-950' },
      { id: 'Đã thanh toán', label: 'Đã thanh toán', count: counts['Đã thanh toán'], color: 'border-emerald-200 bg-emerald-50/70 text-emerald-950' },
      { id: 'Đã giao', label: 'Đã giao', count: counts['Đã giao'], color: 'border-indigo-200 bg-indigo-50/70 text-indigo-950' }
    ];
  }, [filteredOrders]);

  // 11. Best Selling Products Ranking
  const topProductsRanking = useMemo(() => {
    const prodMap: Record<
      string,
      {
        id: string;
        name: string;
        image?: string;
        price: number;
        quantitySold: number;
        totalRevenue: number;
        ordersCount: number;
        stock: number;
      }
    > = {};

    products.forEach((p) => {
      prodMap[p.id] = {
        id: p.id,
        name: p.name,
        image: p.image,
        price: p.price,
        quantitySold: 0,
        totalRevenue: 0,
        ordersCount: 0,
        stock: p.stock ?? 15,
      };
    });

    validOrders.forEach((ord) => {
      if (ord.itemDetails && ord.itemDetails.length > 0) {
        const productsInOrder = new Set<string>();
        ord.itemDetails.forEach((it) => {
          let targetId = '';
          if (prodMap[it.productId]) {
            targetId = it.productId;
          } else {
            const found = products.find((p) => p.name === it.productName);
            if (found && prodMap[found.id]) {
              targetId = found.id;
            }
          }

          if (targetId && prodMap[targetId]) {
            prodMap[targetId].quantitySold += it.quantity;
            prodMap[targetId].totalRevenue += it.price * it.quantity;
            productsInOrder.add(targetId);
          }
        });

        productsInOrder.forEach((pid) => {
          if (prodMap[pid]) {
            prodMap[pid].ordersCount += 1;
          }
        });
      }
    });

    return Object.values(prodMap).sort((a, b) => {
      if (productRankingSortBy === 'revenue') {
        return b.totalRevenue - a.totalRevenue || b.quantitySold - a.quantitySold;
      }
      if (productRankingSortBy === 'quantity') {
        return b.quantitySold - a.quantitySold || b.totalRevenue - a.totalRevenue;
      }
      if (productRankingSortBy === 'orders') {
        return b.ordersCount - a.ordersCount || b.totalRevenue - a.totalRevenue;
      }
      return 0;
    });
  }, [validOrders, products, productRankingSortBy]);

  // 12. Category Breakdown
  const categoryRevenueMetrics = useMemo(() => {
    const catMap: Record<string, { label: string; revenue: number; count: number }> = {};

    categories.forEach((c) => {
      catMap[c.id] = {
        label: c.label,
        revenue: 0,
        count: 0
      };
    });

    validOrders.forEach((ord) => {
      if (ord.itemDetails && ord.itemDetails.length > 0) {
        ord.itemDetails.forEach((it) => {
          const prod = products.find((p) => p.id === it.productId || p.name === it.productName);
          const catId = prod?.category || it.category || 'other';
          if (catMap[catId]) {
            catMap[catId].revenue += it.price * it.quantity;
            catMap[catId].count += it.quantity;
          }
        });
      }
    });

    return Object.entries(catMap)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [validOrders, categories, products]);

  return (
    <div id="admin-dashboard-section" className="space-y-5">
      
      {/* Top Controls & Time Range & Seller Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              Báo Cáo Doanh Thu & Chỉ Số Kinh Doanh
            </h3>
            {selectedSellerFilter !== 'all' && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                Đang xem: {sellers.find(s => s.username === selectedSellerFilter || s.id === selectedSellerFilter)?.name || selectedSellerFilter}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Thống kê số liệu kinh doanh từ các kênh bán hàng trực tuyến và theo từng nhân sự bán hàng
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seller Filter Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-amber-600" />
            <select
              value={selectedSellerFilter}
              onChange={(e) => setSelectedSellerFilter(e.target.value)}
              className="bg-transparent border-none text-slate-800 font-bold text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">Toàn bộ nhóm (Tất cả người bán)</option>
              {deduplicateSellers(sellers).map((s, sIdx) => (
                <option key={`dashboard-seller-opt-${s.id || s.username}-${sIdx}`} value={s.username}>
                  Người bán: {s.name}
                </option>
              ))}
              <option value="website">Kênh trực tuyến (Website)</option>
            </select>
          </div>

          {/* Time Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto">
            {[
              { id: 'today', label: 'Hôm nay' },
              { id: '7days', label: '7 ngày' },
              { id: '30days', label: '30 ngày' },
              { id: 'this_month', label: 'Tháng này' },
              { id: 'all', label: 'Tất cả' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeRange(t.id as any)}
                className={`px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap transition-all ${
                  timeRange === t.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Highlight Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        
        {/* Total Gross Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Tổng Doanh Thu
            </span>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
              Không tính phí ship
            </span>
          </div>
          <span className="text-2xl font-bold text-slate-900 block mt-2">
            {totalGrossRevenue.toLocaleString('vi-VN')}đ
          </span>
          <div className="text-xs text-slate-500 mt-1">
            Doanh thu sản phẩm trên <strong>{validOrders.length} đơn hợp lệ</strong>
          </div>
        </div>

        {/* Real Collected / Paid Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Doanh Thu Thực Thu
            </span>
            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
              Sản phẩm
            </span>
          </div>
          <span className="text-2xl font-bold text-slate-900 block mt-2">
            {totalPaidRevenue.toLocaleString('vi-VN')}đ
          </span>
          <div className="text-xs text-slate-500 mt-1">
            Đã thu: <strong>{totalGrossRevenue > 0 ? Math.round((totalPaidRevenue / totalGrossRevenue) * 100) : 0}% tổng giá trị</strong>
          </div>
        </div>

        {/* Pending COD / Uncollected Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Tiền Chờ Thu
          </span>
          <span className="text-2xl font-bold text-slate-900 block mt-2">
            {pendingRevenue.toLocaleString('vi-VN')}đ
          </span>
          <div className="text-xs text-slate-500 mt-1">
            Chờ giao & thu tiền
          </div>
        </div>

        {/* Total Orders Count */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Tổng Số Đơn Hàng
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-900">{validOrders.length}</span>
            <span className="text-xs text-slate-500">đơn</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Đã hoàn thành: <strong>{completedOrdersCount} ({completionRate}%)</strong>
          </div>
        </div>

        {/* Average Order Value */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Giá Trị Đơn Trung Bình
          </span>
          <span className="text-2xl font-bold text-slate-900 block mt-2">
            {averageOrderValue.toLocaleString('vi-VN')}đ
          </span>
          <div className="text-xs text-slate-500 mt-1">
            ~{(totalUnitsSold / Math.max(1, validOrders.length)).toFixed(1)} món/đơn
          </div>
        </div>

        {/* Total Units Sold */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Số Lượng Sản Phẩm Đã Bán
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-900">{totalUnitsSold}</span>
            <span className="text-xs text-slate-500">chiếc / phụ kiện</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Được gia công & giao từ xưởng
          </div>
        </div>

      </div>

      {/* Row 2: Status Pipeline */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h4 className="font-bold text-sm text-slate-900">
            Quy Trình Xử Lý Đơn Hàng
          </h4>
          <button
            type="button"
            onClick={onNavigateToOrders}
            className="text-xs text-slate-700 hover:text-black font-bold"
          >
            Xem danh sách đơn &gt;
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statusFunnel.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border flex items-center justify-between shadow-2xs ${item.color || 'border-slate-200 bg-slate-50'}`}
            >
              <span className="text-xs font-bold">{item.label}</span>
              <div className="text-right">
                <span className="text-lg font-black">{item.count}</span>
                <span className="text-[10px] opacity-70 block font-medium">đơn</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 3: Channels & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Revenue by Channel */}
        <div className="lg:col-span-6 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-900">
              Doanh Thu Theo Nguồn Đơn
            </h4>
            <span className="text-xs text-slate-500 font-medium">
              {validOrders.length} đơn
            </span>
          </div>

          <div className="space-y-3">
            {sourceMetrics.map((src) => (
              <div key={src.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800">{src.label}</span>
                    <span className="text-slate-500 text-[11px]">({src.count} đơn)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 text-xs">
                      {src.revenue.toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-slate-500 text-[10px] ml-1">({src.percent}%)</span>
                  </div>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-slate-800 rounded-full"
                    style={{ width: `${Math.max(3, src.percent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        {(() => {
          const totalPaymentRev = (paymentMetrics.bankTransfer.revenue + paymentMetrics.cod.revenue + paymentMetrics.cash.revenue) || 1;
          const totalPaymentOrders = (paymentMetrics.bankTransfer.count + paymentMetrics.cod.count + paymentMetrics.cash.count) || 1;

          const bankTransferRevPercent = Math.round((paymentMetrics.bankTransfer.revenue / totalPaymentRev) * 100);
          const codRevPercent = Math.round((paymentMetrics.cod.revenue / totalPaymentRev) * 100);
          const cashRevPercent = Math.round((paymentMetrics.cash.revenue / totalPaymentRev) * 100);

          const bankTransferOrderPercent = Math.round((paymentMetrics.bankTransfer.count / totalPaymentOrders) * 100);
          const codOrderPercent = Math.round((paymentMetrics.cod.count / totalPaymentOrders) * 100);
          const cashOrderPercent = Math.round((paymentMetrics.cash.count / totalPaymentOrders) * 100);

          return (
            <div className="lg:col-span-6 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-bold text-sm text-slate-900">
                  Phương Thức Thanh Toán
                </h4>
                <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  Tổng {totalPaymentOrders.toLocaleString('vi-VN')} đơn
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Chuyển Khoản</span>
                    <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                      {bankTransferRevPercent}%
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 block">
                    {paymentMetrics.bankTransfer.revenue.toLocaleString('vi-VN')}đ
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{paymentMetrics.bankTransfer.count} đơn</span>
                    <span>{bankTransferOrderPercent}% số đơn</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.max(2, bankTransferRevPercent)}%` }} />
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Thu Tiền COD</span>
                    <span className="text-[11px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      {codRevPercent}%
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 block">
                    {paymentMetrics.cod.revenue.toLocaleString('vi-VN')}đ
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{paymentMetrics.cod.count} đơn</span>
                    <span>{codOrderPercent}% số đơn</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.max(2, codRevPercent)}%` }} />
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Tiền Mặt</span>
                    <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      {cashRevPercent}%
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 block">
                    {paymentMetrics.cash.revenue.toLocaleString('vi-VN')}đ
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{paymentMetrics.cash.count} đơn</span>
                    <span>{cashOrderPercent}% số đơn</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.max(2, cashRevPercent)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      </div>

      {/* Row 4: Top Best-Selling Products Ranking */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-sm text-slate-900">
              Xếp Hạng Sản Phẩm
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">
              Sắp xếp theo {productRankingSortBy === 'revenue' ? 'doanh thu' : productRankingSortBy === 'quantity' ? 'số lượng bán' : 'số đơn hàng chứa sản phẩm'}
            </span>
          </div>

          {/* Sort Selector Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setProductRankingSortBy('revenue')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                productRankingSortBy === 'revenue'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Doanh thu
            </button>
            <button
              type="button"
              onClick={() => setProductRankingSortBy('quantity')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                productRankingSortBy === 'quantity'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Số lượng bán
            </button>
            <button
              type="button"
              onClick={() => setProductRankingSortBy('orders')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                productRankingSortBy === 'orders'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Số đơn hàng
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-2.5">Hạng</th>
                <th className="p-2.5">Sản Phẩm</th>
                <th className="p-2.5">Giá Bán</th>
                <th className={`p-2.5 text-center ${productRankingSortBy === 'quantity' ? 'bg-amber-100/70 text-amber-950 font-black' : ''}`}>
                  Đã Bán
                </th>
                <th className={`p-2.5 text-center ${productRankingSortBy === 'orders' ? 'bg-indigo-100/70 text-indigo-950 font-black' : ''}`}>
                  Số Đơn Hàng
                </th>
                <th className={`p-2.5 ${productRankingSortBy === 'revenue' ? 'bg-emerald-100/70 text-emerald-950 font-black' : ''}`}>
                  Doanh Thu
                </th>
                <th className="p-2.5 text-right">Tồn Kho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topProductsRanking.slice(0, 10).map((prod, idx) => (
                <tr key={prod.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-900">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
                      idx === 0 ? 'bg-amber-400 text-slate-950 shadow-2xs' : idx === 1 ? 'bg-slate-200 text-slate-800' : idx === 2 ? 'bg-amber-200 text-amber-900' : 'text-slate-600'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      {prod.image && (
                        <img
                          src={prod.image}
                          alt={prod.name}
                          className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0"
                        />
                      )}
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">{prod.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{prod.id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-2.5 whitespace-nowrap text-slate-700">
                    {prod.price.toLocaleString('vi-VN')}đ
                  </td>
                  <td className="p-2.5 text-center whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                      productRankingSortBy === 'quantity' ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300 font-black' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {prod.quantitySold} cái
                    </span>
                  </td>
                  <td className="p-2.5 text-center whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                      productRankingSortBy === 'orders' ? 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300 font-black' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {prod.ordersCount} đơn
                    </span>
                  </td>
                  <td className={`p-2.5 whitespace-nowrap font-bold ${
                    productRankingSortBy === 'revenue' ? 'text-emerald-700 bg-emerald-50/60 font-black' : 'text-slate-900'
                  }`}>
                    {prod.totalRevenue.toLocaleString('vi-VN')}đ
                  </td>
                  <td className="p-2.5 text-right whitespace-nowrap">
                    {prod.stock > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        Còn {prod.stock}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                        Hết hàng
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 5: Revenue by Category */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h4 className="font-bold text-sm text-slate-900">
            Doanh Thu Theo Danh Mục
          </h4>
          <span className="text-xs text-slate-500 font-medium">
            {categories.length} danh mục
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categoryRevenueMetrics.map((cat) => (
            <div
              key={cat.id}
              className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <span className="font-bold text-slate-900 text-xs truncate block">{cat.label}</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Đã bán: <strong>{cat.count} cái</strong>
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-bold text-slate-900 text-xs block">
                  {cat.revenue.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 6: Seller Ranking & Contribution Donut Chart */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-slate-800" />
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                Bảng Xếp Hạng & Doanh Số Người Bán
              </h4>
              <span className="text-xs text-slate-500">
                Hiệu suất bán hàng, biểu đồ đóng góp doanh thu và thứ hạng người bán
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Left: Circular Pie / Donut Chart with Legend; Right: Sortable Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Biểu đồ tròn đóng góp doanh số */}
          <div className="lg:col-span-5 bg-slate-50/60 p-4 rounded-xl border border-slate-200/80 flex flex-col items-center">
            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 self-start">
              Biểu Đồ Tròn Đóng Góp Doanh Số
            </h5>

            {/* Donut Chart Canvas */}
            <div className="relative w-52 h-52 my-1">
              <svg viewBox="0 0 240 240" className="w-full h-full transform -rotate-90">
                {pieSlices.length === 0 ? (
                  <circle
                    cx="120"
                    cy="120"
                    r="80"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="35"
                  />
                ) : (
                  pieSlices.map((slice, sliceIdx) => {
                    const isHovered = hoveredSellerKey === slice.seller.username;
                    const rOut = isHovered ? 98 : 92;
                    const rIn = 60;
                    const pathD = getDonutSlicePath(120, 120, rOut, rIn, slice.startAngle, slice.endAngle);

                    return (
                      <path
                        key={`pie-slice-${slice.seller.id || slice.seller.username}-${sliceIdx}`}
                        d={pathD}
                        fill={slice.seller.sliceColor}
                        className="transition-all duration-200 cursor-pointer"
                        opacity={hoveredSellerKey && !isHovered ? 0.45 : 1}
                        onMouseEnter={() => setHoveredSellerKey(slice.seller.username)}
                        onMouseLeave={() => setHoveredSellerKey(null)}
                      />
                    );
                  })
                )}
              </svg>

              {/* Center Content in Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
                {(() => {
                  if (hoveredSellerKey) {
                    const matched = sellerRanking.find((s) => s.username === hoveredSellerKey);
                    if (matched) {
                      return (
                        <>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider max-w-[110px] truncate">
                            {matched.name}
                          </span>
                          <span className="text-sm font-black text-slate-900 mt-0.5">
                            {matched.totalRevenue.toLocaleString('vi-VN')}đ
                          </span>
                          <span className="text-[11px] font-bold text-emerald-600 mt-0.5">
                            {matched.percent}% ({matched.orderCount} đơn)
                          </span>
                        </>
                      );
                    }
                  }

                  return (
                    <>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Tổng Doanh Số
                      </span>
                      <span className="text-sm font-black text-slate-900 mt-0.5">
                        {teamGrossRevenue.toLocaleString('vi-VN')}đ
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 mt-0.5">
                        {teamValidOrders.length} đơn hợp lệ
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Legend for Pie Chart */}
            <div className="w-full mt-3 pt-3 border-t border-slate-200/80 space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {sellerRanking
                .filter((s) => s.totalRevenue > 0 || s.orderCount > 0)
                .map((seller, sIdx) => {
                  const isHovered = hoveredSellerKey === seller.username;
                  return (
                    <div
                      key={`dashboard-legend-${seller.id || seller.username}-${sIdx}`}
                      onMouseEnter={() => setHoveredSellerKey(seller.username)}
                      onMouseLeave={() => setHoveredSellerKey(null)}
                      className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                        isHovered ? 'bg-amber-100/70 font-semibold' : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: seller.sliceColor }}
                        />
                        <span className="text-slate-800 truncate text-[11px] font-medium">
                          {seller.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {seller.totalRevenue.toLocaleString('vi-VN')}đ
                        </span>
                        <span className="text-xs font-bold text-slate-900 min-w-[36px] text-right">
                          {seller.percent}%
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Right (Col 6-12): Sortable Leaderboard Table */}
          <div className="lg:col-span-7 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  {/* Col 1: Hạng */}
                  <th
                    onClick={() => handleSellerSort('rank')}
                    className="p-2.5 text-center w-14 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    title="Bấm để sắp xếp theo thứ hạng"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Hạng</span>
                      {sellerSortField === 'rank' ? (
                        sellerSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-800" /> : <ArrowDown className="w-3 h-3 text-slate-800" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Col 2: Người Bán */}
                  <th
                    onClick={() => handleSellerSort('name')}
                    className="p-2.5 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    title="Bấm để sắp xếp theo tên người bán"
                  >
                    <div className="flex items-center gap-1">
                      <span>Người Bán</span>
                      {sellerSortField === 'name' ? (
                        sellerSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-800" /> : <ArrowDown className="w-3 h-3 text-slate-800" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Col 3: Số Đơn */}
                  <th
                    onClick={() => handleSellerSort('orderCount')}
                    className="p-2.5 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    title="Bấm để sắp xếp theo số đơn"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Số Đơn</span>
                      {sellerSortField === 'orderCount' ? (
                        sellerSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-800" /> : <ArrowDown className="w-3 h-3 text-slate-800" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Col 4: Doanh Thu */}
                  <th
                    onClick={() => handleSellerSort('totalRevenue')}
                    className="p-2.5 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    title="Bấm để sắp xếp theo doanh thu"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Doanh Thu</span>
                      {sellerSortField === 'totalRevenue' ? (
                        sellerSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-800" /> : <ArrowDown className="w-3 h-3 text-slate-800" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Col 5: Đóng Góp (%) */}
                  <th
                    onClick={() => handleSellerSort('percent')}
                    className="p-2.5 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    title="Bấm để sắp xếp theo phần trăm đóng góp"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Đóng Góp (%)</span>
                      {sellerSortField === 'percent' ? (
                        sellerSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-800" /> : <ArrowDown className="w-3 h-3 text-slate-800" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSellerRanking.map((seller, sIdx) => {
                  const isHovered = hoveredSellerKey === seller.username;
                  return (
                    <tr
                      key={`dashboard-rank-row-${seller.id || seller.username}-${sIdx}`}
                      onMouseEnter={() => setHoveredSellerKey(seller.username)}
                      onMouseLeave={() => setHoveredSellerKey(null)}
                      className={`transition-colors ${
                        isHovered ? 'bg-amber-50/70 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Col 1: Hạng (Clean numbers, no 1, 2, 3 logo/medals) */}
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                          {seller.rank}
                        </span>
                      </td>

                      {/* Col 2: Người Bán (No avatar) */}
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 text-xs">{seller.name}</span>
                      </td>

                      {/* Col 3: Số Đơn */}
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-xs">
                          {seller.orderCount} đơn
                        </span>
                      </td>

                      {/* Col 4: Doanh Thu */}
                      <td className="p-2.5 text-right whitespace-nowrap font-bold text-slate-900">
                        {seller.totalRevenue.toLocaleString('vi-VN')}đ
                      </td>

                      {/* Col 5: Đóng Góp (%) */}
                      <td className="p-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: seller.sliceColor }}
                          />
                          <span className="font-bold text-slate-900 text-xs">
                            {seller.percent}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Google Analytics 4 Dashboard External Link Button */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent p-5 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-900">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Google Analytics 4</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300/80">
                G-G8Z5Z8R1CF
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Theo dõi realtime khách truy cập, lưu lượng truy cập, tỷ lệ chuyển đổi và hành vi người dùng trên Google Analytics chính thức.
            </p>
          </div>
        </div>

        <a
          href="https://analytics.google.com/analytics/web/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
        >
          <span>Mở Google Analytics</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

    </div>
  );
};
