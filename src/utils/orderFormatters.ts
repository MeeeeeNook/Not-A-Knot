import { StoredOrder } from '../types';

/**
 * Format date string without seconds (e.g. "16:15 31/08/2026")
 */
export const formatOrderDateWithoutSeconds = (dateStr?: string): string => {
  if (!dateStr) return 'N/A';

  const clean = dateStr.trim();

  // Pattern 1: "16:15:29 31/8/2026" or "16:15:29, 31/8/2026" or "16:15:29 31/08/2026"
  const timeSecRegex = /(\d{1,2}):(\d{2}):\d{2}/;
  if (timeSecRegex.test(clean)) {
    return clean.replace(timeSecRegex, '$1:$2').replace(/,\s*/g, ' ').trim();
  }

  // Pattern 2: ISO string or standard parseable Date
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime()) && clean.length >= 10 && (clean.includes('-') || clean.includes('T'))) {
    const hours = String(parsed.getHours()).padStart(2, '0');
    const mins = String(parsed.getMinutes()).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${hours}:${mins} ${day}/${month}/${year}`;
  }

  return clean;
};

/**
 * Source badge styling with clear, elegant distinction for Web, MXH, and Trực tiếp
 */
export interface SourceBadgeConfig {
  label: string;
  shortLabel: string;
  badgeClass: string;
  pillClass: string;
}

export const getSourceBadgeConfig = (source?: string): SourceBadgeConfig => {
  const s = (source || 'website').toLowerCase();
  
  if (['mạng xã hội', 'facebook', 'zalo', 'instagram', 'tiktok', 'social'].includes(s)) {
    return {
      label: 'Mạng Xã Hội',
      shortLabel: 'MXH',
      badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200 font-medium',
      pillClass: 'bg-blue-50 text-blue-700 border-blue-200 font-medium'
    };
  }

  if (['hotline', 'phone', 'direct', 'trực tiếp', 'offline', 'store', 'other', 'cash'].includes(s)) {
    return {
      label: 'Trực Tiếp',
      shortLabel: 'Trực tiếp',
      badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200 font-medium',
      pillClass: 'bg-amber-50 text-amber-800 border-amber-200 font-medium'
    };
  }

  // Default: Website
  return {
    label: 'Website',
    shortLabel: 'Web',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium',
    pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium'
  };
};

/**
 * Status normalization supporting 5 core statuses requested by user:
 * 'Chờ xác nhận' | 'Đã xác nhận' | 'Knot đang được sản xuất' | 'Đang giao hàng' | 'Đơn hàng giao thành công'
 */
export type NormalizedOrderStatus = 
  | 'Chờ xác nhận' 
  | 'Đã xác nhận' 
  | 'Knot đang được sản xuất' 
  | 'Đang giao hàng' 
  | 'Đơn hàng giao thành công';

export const normalizeOrderStatus = (st?: string): NormalizedOrderStatus => {
  if (!st) return 'Chờ xác nhận';
  const s = st.toLowerCase().trim();

  if (s.includes('giao thành công') || s.includes('hoàn thành') || s.includes('delivered') || s.includes('completed') || s === 'đã giao') {
    return 'Đơn hàng giao thành công';
  }
  if (s.includes('đang giao') || s.includes('shipping') || s.includes('vận chuyển')) {
    return 'Đang giao hàng';
  }
  if (s.includes('sản xuất') || s.includes('đã làm') || s.includes('đang làm') || s.includes('chế tác') || s.includes('crafting') || s.includes('gia công')) {
    return 'Knot đang được sản xuất';
  }
  if (s.includes('đã xác nhận') || s.includes('confirmed') || s.includes('tiếp nhận') || s.includes('received') || s.includes('acknowledged') || s.includes('thanh toán') || s.includes('paid')) {
    return 'Đã xác nhận';
  }
  return 'Chờ xác nhận';
};

/**
 * Status badge styling with refined, subtle color coding
 */
export const getStatusBadgeConfig = (status?: string) => {
  const normalized = normalizeOrderStatus(status);

  switch (normalized) {
    case 'Đã xác nhận':
      return {
        label: 'Đã xác nhận',
        badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200 font-medium',
        pillClass: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
        selectClass: 'bg-blue-50 text-blue-800 border-blue-200'
      };
    case 'Knot đang được sản xuất':
      return {
        label: 'Knot đang được sản xuất',
        badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200 font-medium',
        pillClass: 'bg-purple-50 text-purple-700 border-purple-200 font-medium',
        selectClass: 'bg-purple-50 text-purple-800 border-purple-200'
      };
    case 'Đang giao hàng':
      return {
        label: 'Đang giao hàng',
        badgeClass: 'bg-sky-50 text-sky-700 border border-sky-200 font-medium',
        pillClass: 'bg-sky-50 text-sky-700 border-sky-200 font-medium',
        selectClass: 'bg-sky-50 text-sky-800 border-sky-200'
      };
    case 'Đơn hàng giao thành công':
      return {
        label: 'Đơn hàng giao thành công',
        badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium',
        pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium',
        selectClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
      };
    case 'Chờ xác nhận':
    default:
      return {
        label: 'Chờ xác nhận',
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200 font-medium',
        pillClass: 'bg-amber-50 text-amber-800 border-amber-200 font-medium',
        selectClass: 'bg-amber-50 text-amber-800 border-amber-200'
      };
  }
};

/**
 * Làm sạch ghi chú đơn hàng, loại bỏ tiền tố tự sinh cũ [Nguồn: ...] hoặc (Đặt qua Web) nếu có.
 * Nếu không có ghi chú thực tế từ khách thì trả về chuỗi rỗng.
 */
export const getCleanOrderNote = (note?: string | null): string => {
  if (!note) return '';
  let cleaned = note.trim();
  cleaned = cleaned.replace(/^\[Nguồn:\s*[^\]]+\]\s*/i, '');
  cleaned = cleaned.replace(/\(?\s*Đặt qua Web\s*\)?/gi, '');
  return cleaned.trim();
};

/**
 * Kiểm tra xem đơn hàng có phải là đơn hàng tự nhập thủ công từ admin/seller
 * ("đơn hàng tự nhập") -> Không cần thông báo
 */
export const isManualOrder = (order?: Partial<StoredOrder> | null): boolean => {
  if (!order) return false;
  if ((order as any).isManual === true) return true;
  if (order.type === 'manual_order') return true;
  if (order.id && order.id.startsWith('ord-man-')) return true;

  // Kiểm tra tiền tố nguồn do form Nhập đơn thủ công gắn vào note: [Nguồn: Mạng xã hội], [Nguồn: Trực tiếp], [Nguồn: Website]
  if (order.note && /^\[Nguồn:\s*(Mạng xã hội|Trực tiếp|Website|MXH)/i.test(order.note.trim())) {
    return true;
  }

  const s = (order.source || '').toLowerCase().trim();
  if (['trực tiếp', 'offline', 'hotline', 'store'].includes(s)) {
    return true;
  }

  return false;
};

/**
 * Kiểm tra xem đơn hàng có phải là đơn hàng phát sinh từ web khách hàng
 * ("đơn hàng từ web") -> Cần thông báo cho quản trị viên
 */
export const isWebOrder = (order?: Partial<StoredOrder> | null): boolean => {
  if (!order) return false;
  // Tuyệt đối không tính các đơn tự nhập
  if (isManualOrder(order)) return false;

  // Nguồn website do khách đặt online
  const s = (order.source || '').toLowerCase().trim();
  if (s === 'website' || s === 'web') {
    return true;
  }

  // Đơn hàng tạo từ giỏ hàng web hoặc trang chiến dịch 02/09 web
  if (order.id && (order.id.startsWith('NAK-') || order.id.startsWith('ord-web-') || order.id.startsWith('ord-0209-'))) {
    return true;
  }

  // Không có sellerId chỉ định và sellerName không phải người bán cụ thể
  if (!order.sellerId && (!order.sellerName || order.sellerName.toLowerCase() === 'website')) {
    return true;
  }

  return false;
};

/**
 * Âm thanh chuông thông báo nhẹ nhàng cho đơn hàng mới từ web (Web Audio API)
 */
export const playWebOrderChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Chime melodious chord: C5 -> E5 -> G5
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.25);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  } catch {
    // Trình duyệt có thể chặn autoplay âm thanh nếu chưa có tương tác
  }
};

/**
 * Tạo mã tra cứu đơn hàng chuyên nghiệp (vd: NAK-260904-8942)
 */
export const generateTrackingNumber = (): string => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `NAK-${yy}${mm}${dd}-${rand}`;
};

/**
 * Lấy mã tra cứu đơn hàng tiêu chuẩn (ưu tiên trackingNumber, fallback tạo từ id)
 */
export const getOrderTrackingNumber = (order?: Partial<StoredOrder> | null): string => {
  if (!order) return 'NAK-ORDER';
  if (order.trackingNumber && order.trackingNumber.trim()) {
    const tn = order.trackingNumber.trim().toUpperCase();
    if (tn.startsWith('ORD-WEB-') || tn.startsWith('ORD-MAN-')) {
      const suffix = tn.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
      return `NAK-${suffix || 'ORDER'}`;
    }
    return tn;
  }
  if (order.id) {
    const idUpper = order.id.trim().toUpperCase();
    if (idUpper.startsWith('NAK-')) {
      return idUpper;
    }
    const cleanId = order.id.replace(/[^a-zA-Z0-9]/g, '');
    const suffix = cleanId.slice(-6).toUpperCase();
    return `NAK-${suffix || 'ORDER'}`;
  }
  return 'NAK-ORDER';
};

export const getCanonicalOrderKey = (order?: Partial<StoredOrder> | null): string => {
  return getOrderTrackingNumber(order);
};

/**
 * Đường dẫn tra cứu trực tiếp theo mã vận đơn của các đơn vị vận chuyển phổ biến tại Việt Nam
 */
export const getCarrierTrackingUrl = (carrier?: string, code?: string): string | null => {
  if (!code || !code.trim()) return null;
  const c = (carrier || '').toLowerCase().trim();
  const cleanCode = encodeURIComponent(code.trim());
  if (c.includes('viettel')) {
    return `https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/?order_number=${cleanCode}`;
  }
  if (c.includes('ghtk') || c.includes('tiết kiệm')) {
    return `https://khachhang.giaohangtietkiem.vn/tra-cuu-van-don?id=${cleanCode}`;
  }
  if (c.includes('ghn') || c.includes('nhanh')) {
    return `https://donhang.ghn.vn/?order_code=${cleanCode}`;
  }
  if (c.includes('j&t') || c.includes('jt')) {
    return `https://jtexpress.vn/vi/tracking?billcode=${cleanCode}`;
  }
  if (c.includes('vnpost') || c.includes('bưu điện') || c.includes('ems')) {
    return `https://www.vnpost.vn/vi-vn/dinh-vi/buu-pham?key=${cleanCode}`;
  }
  return null;
};

/**
 * Chuyển tiếng Việt có dấu thành không dấu (ASCII) để tương thích 100% với chuẩn VietQR/Napas
 */
export const removeVietnameseTones = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};


