import React, { useState, useMemo } from 'react';
import { Product, CategoryItem } from '../types';
import { StoredOrder } from '../firebase';

interface AdminDashboardProps {
  orders: StoredOrder[];
  products: Product[];
  categories: CategoryItem[];
  onNavigateToOrders: () => void;
  onNavigateToManualOrder: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  products,
  categories,
  onNavigateToOrders,
  onNavigateToManualOrder
}) => {
  const [timeRange, setTimeRange] = useState<'all' | 'today' | '7days' | '30days' | 'this_month'>('all');

  // Filter orders by time range
  const filteredOrders = useMemo(() => {
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

  // Valid orders
  const validOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status !== 'cancelled' && o.status !== 'Đã hủy');
  }, [filteredOrders]);

  // 1. Total Gross Revenue
  const totalGrossRevenue = useMemo(() => {
    return validOrders.reduce((sum, o) => {
      const amt = o.totalPrice ?? o.totalAmount ?? 0;
      return sum + amt;
    }, 0);
  }, [validOrders]);

  // 2. Real Collected Revenue
  const totalPaidRevenue = useMemo(() => {
    return validOrders.reduce((sum, o) => {
      if (o.paymentStatus === 'paid') {
        const amt = o.totalPrice ?? o.totalAmount ?? 0;
        return sum + amt;
      }
      return sum + (o.paidAmount || 0);
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

  // 6. Average Order Value (AOV)
  const averageOrderValue = useMemo(() => {
    if (validOrders.length === 0) return 0;
    return Math.round(totalGrossRevenue / validOrders.length);
  }, [validOrders, totalGrossRevenue]);

  // 7. Completion Rate
  const completionRate = useMemo(() => {
    if (validOrders.length === 0) return 0;
    return Math.round((completedOrdersCount / validOrders.length) * 100);
  }, [validOrders, completedOrdersCount]);

  // 8. Revenue by Channel
  const sourceMetrics = useMemo(() => {
    const counts: Record<string, { count: number; revenue: number; label: string }> = {
      website: { count: 0, revenue: 0, label: 'Website Trực Tuyến' },
      'mạng xã hội': { count: 0, revenue: 0, label: 'Mạng Xã Hội' },
      'trực tiếp': { count: 0, revenue: 0, label: 'Trực Tiếp / Xưởng' }
    };

    validOrders.forEach((o) => {
      const src = o.source || 'website';
      const amt = o.totalPrice ?? o.totalAmount ?? 0;
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

  // 9. Payment Methods Breakdown
  const paymentMetrics = useMemo(() => {
    let bankTransfer = { count: 0, revenue: 0 };
    let cod = { count: 0, revenue: 0 };
    let cash = { count: 0, revenue: 0 };
    let billAttachedCount = 0;

    validOrders.forEach((o) => {
      const amt = o.totalPrice ?? o.totalAmount ?? 0;
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
      'Đã thanh toán': 0,
      'Đã giao': 0
    };

    filteredOrders.forEach((o) => {
      const st = o.status || 'Đã đặt';
      if (st in counts) {
        counts[st as keyof typeof counts]++;
      } else {
        counts['Đã đặt']++;
      }
    });

    return [
      { id: 'Đã đặt', label: 'Đã đặt', count: counts['Đã đặt'] },
      { id: 'Đã thanh toán', label: 'Đã thanh toán', count: counts['Đã thanh toán'] },
      { id: 'Đã giao', label: 'Đã giao', count: counts['Đã giao'] }
    ];
  }, [filteredOrders]);

  // 11. Best Selling Products Ranking
  const topProductsRanking = useMemo(() => {
    const prodMap: Record<string, { id: string; name: string; image?: string; price: number; quantitySold: number; totalRevenue: number; stock: number }> = {};

    products.forEach((p) => {
      prodMap[p.id] = {
        id: p.id,
        name: p.name,
        image: p.image,
        price: p.price,
        quantitySold: 0,
        totalRevenue: 0,
        stock: p.stock ?? 15
      };
    });

    validOrders.forEach((ord) => {
      if (ord.itemDetails && ord.itemDetails.length > 0) {
        ord.itemDetails.forEach((it) => {
          if (prodMap[it.productId]) {
            prodMap[it.productId].quantitySold += it.quantity;
            prodMap[it.productId].totalRevenue += it.price * it.quantity;
          } else {
            const found = products.find((p) => p.name === it.productName);
            if (found && prodMap[found.id]) {
              prodMap[found.id].quantitySold += it.quantity;
              prodMap[found.id].totalRevenue += it.price * it.quantity;
            }
          }
        });
      }
    });

    return Object.values(prodMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue || b.quantitySold - a.quantitySold);
  }, [validOrders, products]);

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
      
      {/* Top Controls & Time Range Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Báo Cáo Doanh Thu & Chỉ Số Kinh Doanh
          </h3>
          <p className="text-xs text-slate-500">
            Thống kê số liệu kinh doanh từ các kênh bán hàng trực tuyến và tại xưởng
          </p>
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

      {/* KPI Highlight Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        
        {/* Total Gross Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Tổng Doanh Thu
          </span>
          <span className="text-2xl font-bold text-slate-900 block mt-2">
            {totalGrossRevenue.toLocaleString('vi-VN')}đ
          </span>
          <div className="text-xs text-slate-500 mt-1">
            Tính trên <strong>{validOrders.length} đơn hợp lệ</strong>
          </div>
        </div>

        {/* Real Collected / Paid Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Doanh Thu Thực Thu
          </span>
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

        {/* Average Order Value (AOV) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Giá Trị Đơn Trung Bình (AOV)
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {statusFunnel.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between"
            >
              <span className="text-xs font-bold text-slate-800">{item.label}</span>
              <div className="text-right">
                <span className="text-lg font-bold text-slate-900">{item.count}</span>
                <span className="text-[10px] text-slate-500 block">đơn</span>
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
        <div className="lg:col-span-6 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-900">
              Phương Thức Thanh Toán
            </h4>
            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              {paymentMetrics.billAttachedCount} đơn có ảnh Bill
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-800 block">Chuyển Khoản</span>
              <span className="text-sm font-bold text-slate-900 block">
                {paymentMetrics.bankTransfer.revenue.toLocaleString('vi-VN')}đ
              </span>
              <span className="text-[10px] text-slate-500 block">
                {paymentMetrics.bankTransfer.count} đơn
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-800 block">Thu Tiền COD</span>
              <span className="text-sm font-bold text-slate-900 block">
                {paymentMetrics.cod.revenue.toLocaleString('vi-VN')}đ
              </span>
              <span className="text-[10px] text-slate-500 block">
                {paymentMetrics.cod.count} đơn
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-800 block">Tiền Mặt</span>
              <span className="text-sm font-bold text-slate-900 block">
                {paymentMetrics.cash.revenue.toLocaleString('vi-VN')}đ
              </span>
              <span className="text-[10px] text-slate-500 block">
                {paymentMetrics.cash.count} đơn
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Kiểm tra hình ảnh chứng từ bill chuyển khoản trong mục Quản Lý Đơn Hàng
            </span>
            <button
              type="button"
              onClick={onNavigateToOrders}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-[11px] whitespace-nowrap transition-colors"
            >
              Mở Đơn Hàng
            </button>
          </div>
        </div>

      </div>

      {/* Row 4: Top Best-Selling Products Ranking */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h4 className="font-bold text-sm text-slate-900">
            Xếp Hạng Sản Phẩm Bán Chạy
          </h4>
          <span className="text-xs text-slate-500 font-medium">
            Theo doanh thu
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-2.5">Hạng</th>
                <th className="p-2.5">Sản Phẩm</th>
                <th className="p-2.5">Giá Bán</th>
                <th className="p-2.5 text-center">Đã Bán</th>
                <th className="p-2.5">Doanh Thu</th>
                <th className="p-2.5 text-right">Tồn Kho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topProductsRanking.slice(0, 8).map((prod, idx) => (
                <tr key={prod.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-900">
                    #{idx + 1}
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
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-xs">
                      {prod.quantitySold} cái
                    </span>
                  </td>
                  <td className="p-2.5 whitespace-nowrap font-bold text-slate-900">
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

    </div>
  );
};
