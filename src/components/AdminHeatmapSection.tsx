import React, { useState, useMemo } from 'react';
import { StoredOrder } from '../firebase';
import { parseAnyDate } from '../utils/orderFormatters';
import { 
  Flame, 
  Clock, 
  MapPin, 
  TrendingUp, 
  Sparkles, 
  Calendar, 
  Zap, 
  Compass,
  Search,
  Filter,
  ArrowUpDown
} from 'lucide-react';

interface AdminHeatmapSectionProps {
  orders: StoredOrder[];
}

const DAY_NAMES = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật'
];

const NORTH_PROVINCES = [
  'Hà Nội', 'Hải Phòng', 'Quảng Ninh', 'Bắc Ninh', 'Bắc Giang', 'Hải Dương', 'Hưng Yên', 
  'Thái Bình', 'Nam Định', 'Ninh Bình', 'Vĩnh Phúc', 'Phú Thọ', 'Thái Nguyên', 'Lạng Sơn',
  'Tuyên Quang', 'Hà Giang', 'Cao Bằng', 'Bắc Kạn', 'Yên Bái', 'Lào Cai', 'Sơn La', 'Hòa Bình', 'Điện Biên', 'Lai Châu', 'Hà Nam'
];

const CENTRAL_PROVINCES = [
  'Đà Nẵng', 'Huế', 'Thừa Thiên Huế', 'Quảng Nam', 'Quảng Ngãi', 'Bình Định', 'Phú Yên', 
  'Khánh Hòa', 'Ninh Thuận', 'Bình Thuận', 'Kon Tum', 'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Lâm Đồng',
  'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị'
];

export const AdminHeatmapSection: React.FC<AdminHeatmapSectionProps> = ({ orders }) => {
  const [activeTab, setActiveTab] = useState<'time' | 'geo'>('time');
  const [hoveredCell, setHoveredCell] = useState<{ dayIdx: number; hour: number; count: number; revenue: number } | null>(null);
  const [geoSortBy, setGeoSortBy] = useState<'orders' | 'revenue'>('orders');
  const [geoSearchQuery, setGeoSearchQuery] = useState('');

  // ----------------------------------------------------
  // 1. COMPUTE TIME HEATMAP (24 Hours x 7 Days)
  // ----------------------------------------------------
  const timeMatrixData = useMemo(() => {
    // 7 rows (Mon-Sun), 24 cols (0-23)
    const grid = Array.from({ length: 7 }, () => 
      Array.from({ length: 24 }, () => ({ count: 0, revenue: 0 }))
    );

    let validOrderCount = 0;
    let maxCellCount = 0;
    const hourTotals = Array(24).fill(0);
    const dayTotals = Array(7).fill(0);
    const hourRevenues = Array(24).fill(0);
    const dayRevenues = Array(7).fill(0);

    orders.forEach((order) => {
      // Exclude cancelled / trash orders
      if (order.status === 'Đã hủy' || (order as any).isTrash) return;

      const dateObj = parseAnyDate(order.createdAt || order.date);
      if (!dateObj) return;

      // JS getDay(): 0 is Sunday, 1 is Monday... 6 is Saturday
      // Convert to Mon=0, Tue=1, ... Sun=6
      const jsDay = dateObj.getDay();
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
      const hour = dateObj.getHours();

      const rev = Number(order.totalPrice || order.totalAmount || 0);

      grid[dayIdx][hour].count += 1;
      grid[dayIdx][hour].revenue += rev;

      hourTotals[hour] += 1;
      dayTotals[dayIdx] += 1;
      hourRevenues[hour] += rev;
      dayRevenues[dayIdx] += rev;

      validOrderCount += 1;
      if (grid[dayIdx][hour].count > maxCellCount) {
        maxCellCount = grid[dayIdx][hour].count;
      }
    });

    // Find peak hour
    let peakHour = 0;
    let maxHourOrders = 0;
    hourTotals.forEach((cnt, h) => {
      if (cnt > maxHourOrders) {
        maxHourOrders = cnt;
        peakHour = h;
      }
    });

    // Find peak day
    let peakDayIdx = 0;
    let maxDayOrders = 0;
    dayTotals.forEach((cnt, d) => {
      if (cnt > maxDayOrders) {
        maxDayOrders = cnt;
        peakDayIdx = d;
      }
    });

    // Evening orders (18h to 23h) percentage
    const eveningOrders = hourTotals.slice(18, 24).reduce((sum, c) => sum + c, 0);
    const eveningPercent = validOrderCount > 0 ? Math.round((eveningOrders / validOrderCount) * 100) : 0;

    return {
      grid,
      maxCellCount,
      validOrderCount,
      peakHour,
      maxHourOrders,
      peakDayIdx,
      maxDayOrders,
      eveningPercent,
      hourTotals,
      dayTotals
    };
  }, [orders]);

  // ----------------------------------------------------
  // 2. COMPUTE GEOGRAPHIC HEATMAP (Provinces & Macro Regions)
  // ----------------------------------------------------
  const geoHeatmapData = useMemo(() => {
    const provinceMap = new Map<string, { count: number; revenue: number }>();
    let totalGeoOrders = 0;
    let totalGeoRevenue = 0;

    let northOrders = 0;
    let centralOrders = 0;
    let southOrders = 0;

    orders.forEach((order) => {
      if (order.status === 'Đã hủy' || (order as any).isTrash) return;

      let prov = (order.province || '').trim();
      if (!prov && order.address) {
        // Fallback: extract last token from comma separated address
        const parts = order.address.split(',');
        if (parts.length > 0) {
          prov = parts[parts.length - 1].trim();
        }
      }

      if (!prov || prov === 'Chưa chọn' || prov === 'N/A') {
        prov = 'Khách đặt trực tiếp / Chưa xác định';
      }

      // Normalization
      if (/Hà Nội|Ha Noi/i.test(prov)) prov = 'Hà Nội';
      else if (/Hồ Chí Minh|TP\.?HCM|Sài Gòn|Saigon/i.test(prov)) prov = 'TP. Hồ Chí Minh';
      else if (/Đà Nẵng|Da Nang/i.test(prov)) prov = 'Đà Nẵng';
      else if (/Hải Phòng|Hai Phong/i.test(prov)) prov = 'Hải Phòng';
      else if (/Cần Thơ|Can Tho/i.test(prov)) prov = 'Cần Thơ';

      const rev = Number(order.totalPrice || order.totalAmount || 0);

      const existing = provinceMap.get(prov) || { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += rev;
      provinceMap.set(prov, existing);

      totalGeoOrders += 1;
      totalGeoRevenue += rev;

      // Region categorization
      if (NORTH_PROVINCES.some(p => prov.includes(p))) {
        northOrders += 1;
      } else if (CENTRAL_PROVINCES.some(p => prov.includes(p))) {
        centralOrders += 1;
      } else {
        southOrders += 1;
      }
    });

    const list = Array.from(provinceMap.entries()).map(([province, stats]) => ({
      province,
      count: stats.count,
      revenue: stats.revenue,
      orderPercent: totalGeoOrders > 0 ? (stats.count / totalGeoOrders) * 100 : 0,
      revPercent: totalGeoRevenue > 0 ? (stats.revenue / totalGeoRevenue) * 100 : 0,
      aov: stats.count > 0 ? Math.round(stats.revenue / stats.count) : 0
    }));

    // Find max for scaling heat bar
    const maxOrdersInProvince = list.reduce((max, item) => Math.max(max, item.count), 0);

    return {
      list,
      totalGeoOrders,
      totalGeoRevenue,
      maxOrdersInProvince,
      northOrders,
      centralOrders,
      southOrders,
      northPercent: totalGeoOrders > 0 ? Math.round((northOrders / totalGeoOrders) * 100) : 0,
      centralPercent: totalGeoOrders > 0 ? Math.round((centralOrders / totalGeoOrders) * 100) : 0,
      southPercent: totalGeoOrders > 0 ? Math.round((southOrders / totalGeoOrders) * 100) : 0
    };
  }, [orders]);

  // Filtered & sorted provinces
  const sortedProvinces = useMemo(() => {
    let result = [...geoHeatmapData.list];
    if (geoSearchQuery.trim()) {
      const q = geoSearchQuery.toLowerCase().trim();
      result = result.filter(item => item.province.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      if (geoSortBy === 'orders') {
        return b.count - a.count || b.revenue - a.revenue;
      } else {
        return b.revenue - a.revenue || b.count - a.count;
      }
    });
    return result;
  }, [geoHeatmapData.list, geoSortBy, geoSearchQuery]);

  // Heat color helper for cell
  const getCellColor = (count: number, maxCount: number) => {
    if (count === 0) return 'bg-slate-50 border-slate-100 text-slate-300';
    if (maxCount <= 1) return 'bg-amber-300 border-amber-400 text-amber-950 font-bold';

    const ratio = count / maxCount;
    if (ratio < 0.25) {
      return 'bg-amber-100 border-amber-200 text-amber-900 font-semibold';
    } else if (ratio < 0.5) {
      return 'bg-amber-300 border-amber-400 text-amber-950 font-bold';
    } else if (ratio < 0.75) {
      return 'bg-orange-400 border-orange-500 text-white font-bold shadow-xs';
    } else {
      return 'bg-rose-600 border-rose-700 text-white font-black shadow-sm ring-1 ring-rose-400';
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
      {/* Section Header with Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-800">
            <Flame className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Bản Đồ Nhiệt Bán Hàng &amp; Hoạt Động Khách Hàng
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                Heatmap Analytics
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Phân tích mật độ đặt hàng theo ma trận 24 giờ x 7 ngày và phân bổ địa lý 63 tỉnh thành.
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('time')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'time'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Khung Giờ Vàng (24h x 7D)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('geo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'geo'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            <span>Phân Bổ Tỉnh / Thành</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: TIME HEATMAP (24 Hours x 7 Days) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'time' && (
        <div className="space-y-4">
          {/* 3 Insight Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Khung Giờ Đỉnh Điểm
                </span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  {timeMatrixData.peakHour}:00 - {timeMatrixData.peakHour}:59
                </span>
                <span className="text-[11px] text-amber-700 font-semibold">
                  {timeMatrixData.maxHourOrders} đơn hàng ghi nhận
                </span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <Zap className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Ngày Sôi Động Nhất
                </span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  {DAY_NAMES[timeMatrixData.peakDayIdx]}
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold">
                  {timeMatrixData.maxDayOrders} đơn hàng ({timeMatrixData.validOrderCount > 0 ? Math.round((timeMatrixData.maxDayOrders / timeMatrixData.validOrderCount) * 100) : 0}%)
                </span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Tỷ Lệ Mua Sắm Buổi Tối
                </span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  {timeMatrixData.eveningPercent}% Đơn Hàng
                </span>
                <span className="text-[11px] text-indigo-700 font-semibold">
                  Tập trung khung 18:00 - 23:59
                </span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-800">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Interactive Heat Matrix Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white p-3">
            <div className="min-w-[760px]">
              {/* Column Header: Hours (0 to 23) */}
              <div className="grid grid-cols-[90px_repeat(24,minmax(24px,1fr))] gap-1 mb-1.5 items-center text-[10px] font-bold text-slate-600">
                <div className="text-center font-bold text-slate-600">Thứ / Giờ</div>
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={`col-hour-${h}`} className="text-center text-[10px] text-slate-500">
                    {h}h
                  </div>
                ))}
              </div>

              {/* Rows for each day */}
              <div className="space-y-1">
                {DAY_NAMES.map((dayName, dayIdx) => (
                  <div
                    key={`heatmap-row-${dayName}`}
                    className="grid grid-cols-[90px_repeat(24,minmax(24px,1fr))] gap-1 items-center"
                  >
                    {/* Day label */}
                    <div className="text-xs font-bold text-slate-700 pr-2 truncate">
                      {dayName}
                    </div>

                    {/* 24 Cells */}
                    {Array.from({ length: 24 }).map((_, hour) => {
                      const cell = timeMatrixData.grid[dayIdx][hour];
                      const colorClass = getCellColor(cell.count, timeMatrixData.maxCellCount);

                      return (
                        <div
                          key={`cell-${dayIdx}-${hour}`}
                          onMouseEnter={() =>
                            setHoveredCell({
                              dayIdx,
                              hour,
                              count: cell.count,
                              revenue: cell.revenue
                            })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`h-7 rounded-md border text-center flex items-center justify-center transition-transform hover:scale-115 hover:z-10 cursor-pointer ${colorClass}`}
                          title={`${dayName}, ${hour}:00: ${cell.count} đơn (${cell.revenue.toLocaleString('vi-VN')}đ)`}
                        >
                          <span className="text-[10px]">
                            {cell.count > 0 ? cell.count : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Heatmap Tooltip & Legend Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
            {/* Live Hover Info */}
            <div className="min-h-[22px] flex items-center gap-2">
              {hoveredCell ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-950 px-3 py-1 rounded-lg font-medium text-xs">
                  <span>
                    <strong>{DAY_NAMES[hoveredCell.dayIdx]}</strong> lúc{' '}
                    <strong>{hoveredCell.hour}:00 - {hoveredCell.hour}:59</strong>:
                  </span>
                  <span className="text-rose-700 font-extrabold">
                    {hoveredCell.count} đơn hàng
                  </span>
                  <span>•</span>
                  <span className="text-slate-900 font-bold">
                    {hoveredCell.revenue.toLocaleString('vi-VN')}đ doanh thu
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 text-[11px] italic">
                  Di chuột vào từng ô vuông để xem chi tiết số đơn và doanh thu trong khung giờ đó.
                </span>
              )}
            </div>

            {/* Visual Color Scale Legend */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 self-end sm:self-auto">
              <span className="font-semibold">Mật độ:</span>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-slate-50 border border-slate-200 inline-block" /> 0 đơn
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block" /> Thấp
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-300 border border-amber-400 inline-block" /> Trung bình
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-orange-400 inline-block" /> Cao
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-rose-600 inline-block" /> Giờ vàng
                </span>
              </div>
            </div>
          </div>

          {/* Strategic Recommendation Box */}
          <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 leading-relaxed">
              <strong>Chiến Lược Tối Ưu Bán Hàng:</strong> Lượng đặt hàng bùng nổ nhất vào{' '}
              <strong>{DAY_NAMES[timeMatrixData.peakDayIdx]}</strong> và khung giờ{' '}
              <strong>{timeMatrixData.peakHour}:00 - {timeMatrixData.peakHour + 2}:00</strong>. Đội ngũ nên lên bài TikTok / Facebook trước khung giờ này 45 phút, đồng thời chuẩn bị sẵn sàng nhân sự trực tin nhắn tư vấn và đóng gói để tối ưu trải nghiệm giao hàng cho khách.
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: GEOGRAPHIC HEATMAP (63 Provinces) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'geo' && (
        <div className="space-y-4">
          {/* Macro 3-Region Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
                <span>Miền Bắc</span>
                <span className="text-blue-700 font-extrabold">{geoHeatmapData.northPercent}%</span>
              </div>
              <div className="text-base font-black text-slate-900">
                {geoHeatmapData.northOrders.toLocaleString('vi-VN')} đơn
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${geoHeatmapData.northPercent}%` }} />
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
                <span>Miền Trung &amp; Tây Nguyên</span>
                <span className="text-amber-700 font-extrabold">{geoHeatmapData.centralPercent}%</span>
              </div>
              <div className="text-base font-black text-slate-900">
                {geoHeatmapData.centralOrders.toLocaleString('vi-VN')} đơn
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${geoHeatmapData.centralPercent}%` }} />
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
                <span>Miền Nam</span>
                <span className="text-emerald-700 font-extrabold">{geoHeatmapData.southPercent}%</span>
              </div>
              <div className="text-base font-black text-slate-900">
                {geoHeatmapData.southOrders.toLocaleString('vi-VN')} đơn
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${geoHeatmapData.southPercent}%` }} />
              </div>
            </div>
          </div>

          {/* Controls: Search & Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={geoSearchQuery}
                onChange={(e) => setGeoSearchQuery(e.target.value)}
                placeholder="Tìm tỉnh / thành phố..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto text-xs font-bold text-slate-600">
              <span className="px-2 text-slate-400 text-[11px]">Sắp xếp:</span>
              <button
                type="button"
                onClick={() => setGeoSortBy('orders')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  geoSortBy === 'orders' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Số lượng đơn
              </button>
              <button
                type="button"
                onClick={() => setGeoSortBy('revenue')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  geoSortBy === 'revenue' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Doanh thu
              </button>
            </div>
          </div>

          {/* Province Ranked List with Visual Heat Gauges */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
            {sortedProvinces.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Không tìm thấy tỉnh thành nào phù hợp với từ khóa "{geoSearchQuery}".
              </div>
            ) : (
              sortedProvinces.map((item, idx) => {
                const heatPercent = geoHeatmapData.maxOrdersInProvince > 0
                  ? Math.round((item.count / geoHeatmapData.maxOrdersInProvince) * 100)
                  : 0;

                const heatBadge = heatPercent >= 75
                  ? { label: 'Rất Sôi Động', color: 'bg-rose-100 text-rose-800 border-rose-200' }
                  : heatPercent >= 40
                  ? { label: 'Tiềm Năng Cao', color: 'bg-amber-100 text-amber-800 border-amber-200' }
                  : { label: 'Đang Tăng Trưởng', color: 'bg-slate-100 text-slate-700 border-slate-200' };

                return (
                  <div key={`geo-row-${item.province}-${idx}`} className="p-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 text-center font-bold text-xs text-slate-400">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-xs text-slate-900">
                          {item.province}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${heatBadge.color}`}>
                          {heatBadge.label}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-xs text-slate-900">
                          {item.count} đơn
                        </span>
                        <span className="text-[11px] text-slate-500 ml-2">
                          ({item.revenue.toLocaleString('vi-VN')}đ)
                        </span>
                      </div>
                    </div>

                    {/* Heat Intensity Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex items-center">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-400 to-rose-500"
                        style={{ width: `${Math.max(3, heatPercent)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                      <span>Đóng góp: {item.orderPercent.toFixed(1)}% tổng đơn</span>
                      <span>Giá trị đơn TB (AOV): {item.aov.toLocaleString('vi-VN')}đ</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
