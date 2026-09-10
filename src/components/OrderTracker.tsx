import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Search, 
  Package, 
  Truck, 
  Clock, 
  CheckCircle2, 
  Copy, 
  Check, 
  Phone, 
  MapPin, 
  Calendar, 
  ArrowLeft, 
  ExternalLink, 
  ShieldCheck, 
  ShoppingBag, 
  Printer, 
  RefreshCw, 
  CreditCard, 
  QrCode, 
  MessageCircle, 
  Hammer, 
  Sparkles,
  Download,
  AlertCircle,
  X
} from 'lucide-react';
import { StoredOrder, SiteContentConfig } from '../types';
import { 
  formatOrderDateWithoutSeconds, 
  getOrderTrackingNumber, 
  getCarrierTrackingUrl, 
  normalizeOrderStatus,
  getSourceBadgeConfig,
  removeVietnameseTones
} from '../utils/orderFormatters';
import { getOrdersFromFirestore } from '../firebase';
import { printOrderSlipDirectly } from '../utils/printOrderSlip';

interface OrderTrackerProps {
  initialTrackingCode?: string;
  allOrders?: StoredOrder[];
  onNavigateHome: () => void;
  onNavigateCatalog: () => void;
  siteContent?: SiteContentConfig;
}

// Normalize code key for robust deduplication (removes spaces, hyphens, case differences)
const normalizeCodeKey = (str?: string): string => {
  if (!str) return '';
  return str.trim().toUpperCase().replace(/[\s\-_]/g, '');
};

// Canonical order key resolver: treats same NAK- code as the exact same order
const getCanonicalOrderKey = (ord: StoredOrder): string => {
  if (!ord) return '';
  const track = (ord.trackingNumber || '').trim().toUpperCase().replace(/\s+/g, '');
  if (track && track.startsWith('NAK-')) return track;
  if (track && track.startsWith('NAK')) {
    const cleanNum = track.replace(/^NAK[-_ ]*/i, '');
    return `NAK-${cleanNum}`;
  }
  const std = getOrderTrackingNumber(ord).trim().toUpperCase().replace(/\s+/g, '');
  if (std && std !== 'NAK-ORDER') return std;
  if (track) return track;
  if (ord.id) {
    const id = ord.id.trim().toUpperCase().replace(/\s+/g, '');
    if (id.startsWith('NAK-')) return id;
    if (id.startsWith('NAK')) {
      const cleanNum = id.replace(/^NAK[-_ ]*/i, '');
      return `NAK-${cleanNum}`;
    }
    if (id.startsWith('ORD-WEB-') || id.startsWith('ORD-MAN-') || id.startsWith('ORD-0209-')) {
      const suffix = id.replace(/[^A-Z0-9]/g, '').slice(-6);
      return `NAK-${suffix}`;
    }
    return id;
  }
  return '';
};

// Standalone printable invoice HTML generator for new-tab printing and iframe bypass
const generatePrintHtml = (order: StoredOrder, hotline: string, brandName: string): string => {
  const code = getCanonicalOrderKey(order) || order.trackingNumber || order.id || 'NAK-ORDER';
  const dateStr = formatOrderDateWithoutSeconds(order.date || order.createdAt);
  const statusStr = normalizeOrderStatus(order.status);
  const customer = order.customerName || order.name || 'Khách hàng';
  const phone = order.phone || '';
  const address = order.address || 'Đang cập nhật địa chỉ qua tin nhắn';
  const note = order.note ? order.note.trim() : '';
  const items = order.itemDetails && order.itemDetails.length > 0 ? order.itemDetails : [];
  const total = Number(order.totalPrice || order.totalAmount || 0);
  const shippingFee = Number(order.shippingFee || 0);
  const discount = Number(order.discountAmount || 0);
  const carrier = order.shippingCarrier ? `${order.shippingCarrier} ${order.shippingCode ? `(${order.shippingCode})` : ''}` : '';
  const pMethod = order.paymentMethod === 'bank_transfer'
    ? 'Chuyển khoản VietQR'
    : order.paymentMethod === 'cash'
    ? 'Tiền mặt tại xưởng'
    : 'Thu tiền khi nhận hàng (COD)';
  const pStatus = order.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : 'Chờ thanh toán / Thu COD';

  const rowsHtml = items.length > 0
    ? items.map((it, idx) => {
        const p = Number(it.price || (it as any).unitPrice || 0);
        const q = Number(it.quantity || 1);
        const sub = p * q;
        const details = [
          it.selectedSize ? `Size: ${it.selectedSize}` : '',
          it.selectedColor ? `Màu: ${it.selectedColor}` : '',
          it.selectedCharm ? `Charm: ${it.selectedCharm}` : '',
        ].filter(Boolean).join(' | ');
        const customNote = it.customNote ? `<div style="font-size:11px;color:#b45309;font-style:italic;margin-top:2px;">* Ghi chú xưởng: ${it.customNote}</div>` : '';

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">
              <strong style="color:#0f172a;font-size:13px;">${it.productName}</strong>
              ${details ? `<div style="font-size:11px;color:#475569;margin-top:3px;font-weight:600;">${details}</div>` : ''}
              ${customNote}
            </td>
            <td style="padding:10px;text-align:center;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#0f172a;">${q}</td>
            <td style="padding:10px;text-align:right;border-bottom:1px solid #e2e8f0;font-family:monospace;font-weight:bold;color:#0f172a;">${p.toLocaleString('vi-VN')}đ</td>
            <td style="padding:10px;text-align:right;border-bottom:1px solid #e2e8f0;font-family:monospace;font-weight:900;color:#0f172a;">${sub.toLocaleString('vi-VN')}đ</td>
          </tr>
        `;
      }).join('')
    : `
      <tr>
        <td colspan="4" style="padding:12px;border-bottom:1px solid #e2e8f0;color:#0f172a;">
          ${Array.isArray(order.items) ? order.items.join(', ') : (order.items ? String(order.items) : 'Sản phẩm thủ công')}
        </td>
      </tr>
    `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Phiếu Giao Nhận & Hóa Đơn - ${code}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
    .invoice-card { max-width: 720px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .brand { font-size: 24px; font-weight: 900; letter-spacing: 1px; color: #0f172a; }
    .subbrand { font-size: 12px; color: #334155; margin-top: 4px; font-weight: 700; }
    .code-box { text-align: right; }
    .code-title { font-size: 11px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .code-val { font-size: 20px; font-weight: 900; font-family: monospace; color: #0f172a; margin-top: 4px; }
    .grid { display: flex; gap: 16px; margin-bottom: 20px; }
    .col { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
    .col-title { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #475569; margin-bottom: 6px; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    th { background: #f1f5f9; padding: 10px; font-size: 12px; font-weight: 900; text-align: left; color: #0f172a; border-bottom: 1px solid #cbd5e1; }
    .summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .summary-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: #1e293b; font-weight: 600; }
    .summary-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 8px; color: #0f172a; }
    .footer { text-align: center; font-size: 11px; color: #475569; font-style: italic; border-top: 1px dashed #cbd5e1; padding-top: 16px; }
    @media print {
      body { padding: 0; background: #fff; }
      .invoice-card { border: none; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand">${brandName}</div>
        <div class="subbrand">Xưởng Đan Vòng & Phụ Kiện Thủ Công Paracord</div>
        <div style="font-size:12px;color:#1e293b;margin-top:4px;font-weight:700;">Hotline: ${hotline}</div>
      </div>
      <div class="code-box">
        <div class="code-title">MÃ ĐƠN HÀNG</div>
        <div class="code-val">${code}</div>
        <div style="font-size:12px;color:#334155;margin-top:4px;font-weight:600;">Ngày: ${dateStr}</div>
      </div>
    </div>

    <div class="grid">
      <div class="col">
        <div class="col-title">NGƯỜI NHẬN KIỆN HÀNG</div>
        <div style="font-size:15px;font-weight:900;color:#0f172a;">${customer}</div>
        <div style="font-size:14px;font-weight:800;font-family:monospace;color:#0f172a;margin-top:3px;">${phone}</div>
      </div>
      <div class="col">
        <div class="col-title">ĐỊA CHỈ GIAO HÀNG</div>
        <div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.4;">${address}</div>
        ${note ? `<div style="font-size:12px;color:#9a3412;margin-top:6px;font-weight:bold;font-style:italic;">* Ghi chú khách: ${note}</div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Sản phẩm & Thông số chế tác</th>
          <th style="text-align:center;width:60px;">SL</th>
          <th style="text-align:right;width:100px;">Đơn giá</th>
          <th style="text-align:right;width:120px;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-row">
        <span>Tiến trình xử lý:</span>
        <strong style="color:#0f172a;">${statusStr}</strong>
      </div>
      <div class="summary-row">
        <span>Hình thức thanh toán:</span>
        <strong style="color:#0f172a;">${pMethod}</strong>
      </div>
      <div class="summary-row">
        <span>Trạng thái thanh toán:</span>
        <strong style="color:${pStatus.includes('Đã thanh toán') ? '#15803d' : '#b45309'};">${pStatus}</strong>
      </div>
      ${carrier ? `
      <div class="summary-row">
        <span>Đơn vị vận chuyển:</span>
        <strong style="color:#0f172a;">${carrier}</strong>
      </div>` : ''}
      <div class="summary-row">
        <span>Phí vận chuyển:</span>
        <strong style="color:${shippingFee > 0 ? '#0f172a' : '#15803d'};">${shippingFee > 0 ? `${shippingFee.toLocaleString('vi-VN')}đ` : 'Miễn phí (Freeship)'}</strong>
      </div>
      ${discount > 0 ? `
      <div class="summary-row">
        <span>Giảm giá / Ưu đãi:</span>
        <strong style="color:#15803d;">-${discount.toLocaleString('vi-VN')}đ</strong>
      </div>` : ''}
      <div class="summary-total">
        <span>TỔNG TIỀN THANH TOÁN:</span>
        <span style="font-family:monospace;color:#9a3412;">${total.toLocaleString('vi-VN')}đ</span>
      </div>
    </div>

    <div class="footer">
      Cảm ơn bạn đã lựa chọn ${brandName}! Sản phẩm thủ công đan tay được bảo hành chốt khóa trọn đời.
    </div>
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 400);
    });
  </script>
</body>
</html>`;
};

// Deep merge two order records of the same canonical order
const mergeOrderRecords = (target: StoredOrder, source: StoredOrder): StoredOrder => {
  const normTarget = normalizeOrderStatus(target.status);
  const normSource = normalizeOrderStatus(source.status);
  const statusPriority: Record<string, number> = {
    'Chờ xác nhận': 1,
    'Đã xác nhận': 2,
    'Knot đang được sản xuất': 3,
    'Đang giao hàng': 4,
    'Đơn hàng giao thành công': 5,
    'Đã hủy': 0
  };
  const preferSourceStatus = (statusPriority[normSource] || 0) >= (statusPriority[normTarget] || 0);

  return {
    ...target,
    ...source,
    id: (source.id?.startsWith('NAK-') ? source.id : target.id?.startsWith('NAK-') ? target.id : source.id || target.id),
    trackingNumber: target.trackingNumber?.startsWith('NAK-') ? target.trackingNumber : (source.trackingNumber || target.trackingNumber),
    itemDetails: (source.itemDetails && source.itemDetails.length > 0) ? source.itemDetails : target.itemDetails,
    items: source.items || target.items,
    status: preferSourceStatus ? source.status : target.status,
    phone: source.phone || target.phone,
    name: source.name || target.name,
    customerName: source.customerName || target.customerName || source.name || target.name,
    address: source.address || target.address,
    note: source.note || target.note,
    shippingCode: source.shippingCode || (source as any).carrierTrackingNumber || target.shippingCode,
    shippingCarrier: source.shippingCarrier || target.shippingCarrier,
    shippingFee: source.shippingFee !== undefined ? source.shippingFee : target.shippingFee,
    discountAmount: source.discountAmount !== undefined ? source.discountAmount : target.discountAmount,
    craftingStageNote: source.craftingStageNote || target.craftingStageNote,
    totalPrice: source.totalPrice || target.totalPrice || source.totalAmount || target.totalAmount,
    totalAmount: source.totalAmount || target.totalAmount || source.totalPrice || target.totalPrice,
    paymentStatus: source.paymentStatus === 'paid' || target.paymentStatus === 'paid' ? 'paid' : (source.paymentStatus || target.paymentStatus),
    paymentMethod: source.paymentMethod || target.paymentMethod
  };
};

export const OrderTracker: React.FC<OrderTrackerProps> = ({
  initialTrackingCode = '',
  allOrders = [],
  onNavigateHome,
  onNavigateCatalog,
  siteContent
}) => {
  const [searchQuery, setSearchQuery] = useState(initialTrackingCode);
  const [activeOrder, setActiveOrder] = useState<StoredOrder | null>(null);
  const [matchedOrders, setMatchedOrders] = useState<StoredOrder[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printSuccessToast, setPrintSuccessToast] = useState<string | null>(null);
  const [liveOrders, setLiveOrders] = useState<StoredOrder[]>(allOrders);

  const allOrdersRef = useRef<StoredOrder[]>(allOrders);
  useEffect(() => {
    allOrdersRef.current = allOrders;
  }, [allOrders]);

  const liveOrdersRef = useRef<StoredOrder[]>(allOrders);
  useEffect(() => {
    liveOrdersRef.current = liveOrders;
  }, [liveOrders]);

  const brandName = siteContent?.brandName || 'NOT A KNOT';
  const facebookUrl = 'https://www.facebook.com/profile.php?id=61593591390851';
  const messengerUrl = 'https://m.me/61593591390851';
  const hotline = siteContent?.phone || '079 655 5636';

  const bankConfig = siteContent?.bankAccount || {
    bankId: 'VCB',
    bankName: 'Vietcombank',
    accountNumber: '1028394859',
    accountHolder: 'VU NGOC MANH CUONG',
    branch: 'Sở Giao Dịch',
    qrTemplate: 'compact2'
  };

  // Load latest orders from local storage with auto-sanitization of legacy ord-web IDs
  const getRecentLocalOrders = useCallback((): StoredOrder[] => {
    try {
      const raw = localStorage.getItem('nak_preorders');
      if (!raw) return [];
      const local = JSON.parse(raw);
      if (!Array.isArray(local)) return [];

      // Auto-migrate any legacy ord-web / ord-man IDs to standard NAK- format
      let hasLegacy = false;
      const sanitized = local.map((ord: StoredOrder) => {
        let changed = false;
        let id = ord.id;
        let trackingNumber = ord.trackingNumber;

        if (id && (id.startsWith('ord-web-') || id.startsWith('ord-man-'))) {
          const suffix = id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
          id = `NAK-${suffix}`;
          changed = true;
        }
        if (trackingNumber && (trackingNumber.startsWith('ord-web-') || trackingNumber.startsWith('ord-man-'))) {
          const suffix = trackingNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
          trackingNumber = `NAK-${suffix}`;
          changed = true;
        }

        if (changed) {
          hasLegacy = true;
          return { ...ord, id, trackingNumber };
        }
        return ord;
      });

      if (hasLegacy) {
        localStorage.setItem('nak_preorders', JSON.stringify(sanitized));
      }
      return sanitized;
    } catch {
      return [];
    }
  }, []);

  // Fetch or refresh orders from Firestore with canonical key merging
  const refreshOrdersData = useCallback(async (): Promise<StoredOrder[]> => {
    try {
      setIsLoading(true);
      const fsOrders = await getOrdersFromFirestore();
      const localOrders = getRecentLocalOrders();
      const orderMap = new Map<string, StoredOrder>();

      // Merge order by normalized canonical tracking key (e.g. NAK2609096132)
      [...allOrdersRef.current, ...localOrders, ...fsOrders].forEach((ord) => {
        if (!ord) return;
        const canonKey = getCanonicalOrderKey(ord) || ord.id || '';
        const key = normalizeCodeKey(canonKey);
        if (!key) return;

        if (orderMap.has(key)) {
          const existing = orderMap.get(key)!;
          orderMap.set(key, mergeOrderRecords(existing, ord));
        } else {
          orderMap.set(key, ord);
        }
      });

      const merged = Array.from(orderMap.values());
      setLiveOrders(merged);
      liveOrdersRef.current = merged;
      return merged;
    } catch (err) {
      console.warn('Cannot refresh orders from Firestore, using local data:', err);
      const localOrders = getRecentLocalOrders();
      const orderMap = new Map<string, StoredOrder>();
      [...allOrdersRef.current, ...localOrders].forEach((ord) => {
        if (!ord) return;
        const canonKey = getCanonicalOrderKey(ord) || ord.id || '';
        const key = normalizeCodeKey(canonKey);
        if (!key) return;
        if (orderMap.has(key)) {
          const existing = orderMap.get(key)!;
          orderMap.set(key, mergeOrderRecords(existing, ord));
        } else {
          orderMap.set(key, ord);
        }
      });
      const fallback = Array.from(orderMap.values());
      setLiveOrders(fallback);
      liveOrdersRef.current = fallback;
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, [getRecentLocalOrders]);

  // Clean phone digits
  const cleanPhone = (p?: string) => {
    if (!p) return '';
    return p.replace(/[^0-9]/g, '');
  };

  // Mask phone for customer privacy
  const maskPhone = (phoneStr?: string) => {
    if (!phoneStr) return '***';
    const digits = cleanPhone(phoneStr);
    if (digits.length < 6) return phoneStr;
    const prefix = digits.slice(0, 3);
    const suffix = digits.slice(-3);
    return `${prefix}****${suffix}`;
  };

  // Copy helper
  const copyToClipboard = async (text: string, fieldKey: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2500);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  // Unified matcher function: searches both tracking number, NAK code, carrier tracking code, and phone number simultaneously
  const matchOrders = useCallback((queryStr: string, dataset: StoredOrder[]): StoredOrder[] => {
    const q = queryStr.trim();
    if (!q) return [];

    const qLower = q.toLowerCase();
    const qClean = qLower.replace(/[^a-z0-9]/g, '');
    const qDigits = cleanPhone(q);

    const rawMatched = dataset.filter((ord) => {
      if (!ord) return false;
      const tracking = (ord.trackingNumber || '').toLowerCase().replace(/\s+/g, '');
      const stdCode = getOrderTrackingNumber(ord).toLowerCase().replace(/\s+/g, '');
      const ordId = (ord.id || '').toLowerCase().replace(/\s+/g, '');
      const shippingCode = (ord.shippingCode || (ord as any).carrierTrackingNumber || '').toLowerCase().replace(/\s+/g, '');
      const phoneDigits = cleanPhone(ord.phone);

      // Search by standard code or tracking number (case-insensitive contains or exact)
      if (tracking && (tracking === qLower || tracking === qClean || tracking.includes(qClean))) return true;
      if (stdCode && (stdCode === qLower || stdCode === qClean || stdCode.includes(qClean))) return true;
      if (ordId && (ordId === qLower || ordId === qClean || ordId.includes(qClean))) return true;

      // Suffix or alphanumeric match (e.g. customer enters 260908-8942 or 8942)
      if (qClean.length >= 4) {
        const trackingClean = tracking.replace(/[^a-z0-9]/g, '');
        const stdClean = stdCode.replace(/[^a-z0-9]/g, '');
        const idClean = ordId.replace(/[^a-z0-9]/g, '');
        if (trackingClean.includes(qClean) || stdClean.includes(qClean) || idClean.includes(qClean)) {
          return true;
        }
      }

      // Search by shipping carrier tracking code (Viettel Post, GHTK, GHN, etc.)
      if (shippingCode && (shippingCode === qLower || shippingCode === qClean || shippingCode.includes(qClean))) return true;

      // Search by customer phone number
      if (qDigits.length >= 4 && phoneDigits) {
        if (phoneDigits === qDigits) return true;
        if (phoneDigits.includes(qDigits)) return true;
        if (phoneDigits.endsWith(qDigits)) return true;
      }

      // Customer name match if query is alphabetical
      if (q.length >= 3 && ord.name && !/\d/.test(q)) {
        if (removeVietnameseTones(ord.name).toLowerCase().includes(removeVietnameseTones(q).toLowerCase())) {
          return true;
        }
      }

      return false;
    });

    // CRITICAL: Deduplicate matches by normalized code so that 1 order code NEVER appears twice!
    const uniqueMatches: StoredOrder[] = [];
    const seenNormalizedKeys = new Set<string>();

    for (const ord of rawMatched) {
      const canonKey = getCanonicalOrderKey(ord) || ord.id || '';
      const normKey = normalizeCodeKey(canonKey);
      if (normKey && !seenNormalizedKeys.has(normKey)) {
        seenNormalizedKeys.add(normKey);
        uniqueMatches.push(ord);
      }
    }

    return uniqueMatches;
  }, []);

  // Perform search (can be triggered by form submit, chip click, or url query)
  const performSearch = useCallback(async (queryStr: string, dataset?: StoredOrder[]) => {
    const q = queryStr.trim();
    if (!q) {
      setActiveOrder(null);
      setMatchedOrders([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    let ordersToSearch = dataset || liveOrdersRef.current;

    // If local dataset is currently empty, load once from Firestore
    if (ordersToSearch.length === 0) {
      ordersToSearch = await refreshOrdersData();
    }

    const matches = matchOrders(q, ordersToSearch);
    setMatchedOrders(matches);
    if (matches.length === 1) {
      setActiveOrder(matches[0]);
    } else {
      setActiveOrder(null);
    }
  }, [matchOrders, refreshOrdersData]);

  // Initial load: fetch once on mount and check initial code without infinite re-render
  useEffect(() => {
    let isMounted = true;
    refreshOrdersData().then((merged) => {
      if (!isMounted) return;
      if (initialTrackingCode && initialTrackingCode.trim()) {
        const q = initialTrackingCode.trim();
        const matches = matchOrders(q, merged);
        setHasSearched(true);
        setMatchedOrders(matches);
        if (matches.length === 1) {
          setActiveOrder(matches[0]);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [initialTrackingCode, matchOrders, refreshOrdersData]);

  // Recent local orders for quick suggestions (deduplicated by canonical tracking code)
  const recentSuggestedOrders = useMemo(() => {
    const local = getRecentLocalOrders();
    const uniqueList: StoredOrder[] = [];
    const seen = new Set<string>();
    for (const ord of local) {
      const code = getCanonicalOrderKey(ord);
      if (code && !seen.has(code)) {
        seen.add(code);
        uniqueList.push(ord);
      }
    }
    return uniqueList.slice(0, 4);
  }, [getRecentLocalOrders]);

  // Generate formatted plain text invoice for copying / sharing
  const generateSlipPlainText = (order: StoredOrder) => {
    const code = getCanonicalOrderKey(order) || order.trackingNumber || order.id || 'NAK-ORDER';
    const date = formatOrderDateWithoutSeconds(order.date || order.createdAt);
    const status = normalizeOrderStatus(order.status);
    const customer = order.customerName || order.name || 'Khách hàng';
    const phone = order.phone || '';
    const address = order.address || 'Đang cập nhật';
    const total = (order.totalPrice || order.totalAmount || 0).toLocaleString('vi-VN');
    const payment = order.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : 'Chờ thanh toán';

    let itemsText = '';
    if (order.itemDetails && order.itemDetails.length > 0) {
      itemsText = order.itemDetails.map((it, idx) => {
        const sub = ((it.price || 0) * (it.quantity || 1)).toLocaleString('vi-VN');
        const specs = [
          it.selectedSize ? `Size: ${it.selectedSize}` : '',
          it.selectedColor ? `Màu: ${it.selectedColor}` : '',
          it.selectedCharm ? `Charm: ${it.selectedCharm}` : '',
        ].filter(Boolean).join(' | ');
        const note = it.customNote ? `\n  - Ghi chú: ${it.customNote}` : '';
        return `${idx + 1}. ${it.productName} (x${it.quantity || 1}) - ${sub}đ\n  ${specs}${note}`;
      }).join('\n');
    } else {
      itemsText = Array.isArray(order.items) ? order.items.join(', ') : String(order.items || '');
    }

    return `========================================
NOT A KNOT - PHIẾU GIAO NHẬN & ĐƠN HÀNG
========================================
Mã đơn: ${code}
Ngày đặt: ${date}
Trạng thái: ${status}

THÔNG TIN KHÁCH HÀNG:
Người nhận: ${customer}
Số điện thoại: ${phone}
Địa chỉ: ${address}
${order.note ? `Ghi chú đơn: ${order.note}\n` : ''}
DANH SÁCH SẢN PHẨM:
${itemsText}

THANH TOÁN:
Tổng tiền: ${total}đ
Trạng thái: ${payment}
Phương thức: ${order.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 'Chuyển khoản VietQR'}
${order.shippingCarrier ? `Vận chuyển: ${order.shippingCarrier} ${order.shippingCode ? `(Mã: ${order.shippingCode})` : ''}\n` : ''}
----------------------------------------
Hotline xưởng: ${hotline}
Cam kết bảo hành chốt khóa trọn đời!
========================================`;
  };

  // Print in a new clean window (bypasses iframe sandbox print blocking)
  const handleOpenPrintTab = useCallback((order: StoredOrder) => {
    try {
      const htmlContent = generatePrintHtml(order, hotline, brandName);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setPrintSuccessToast('Đã mở tab in riêng và gửi lệnh in!');
        setTimeout(() => setPrintSuccessToast(null), 3500);
      } else {
        // Popups might be blocked in some sandboxes -> download text receipt fallback
        handleDownloadInvoice(order);
      }
    } catch (err) {
      console.warn('Cannot open print tab, downloading invoice text instead:', err);
      handleDownloadInvoice(order);
    }
  }, [brandName, hotline]);

  // Download raw receipt text file
  const handleDownloadInvoice = useCallback((order: StoredOrder) => {
    try {
      const text = generateSlipPlainText(order);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phieu_Don_${getCanonicalOrderKey(order) || order.trackingNumber || 'NAK'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPrintSuccessToast('Đã tải xuống file hóa đơn (.txt)!');
      setTimeout(() => setPrintSuccessToast(null), 3000);
    } catch (e) {
      console.warn('Download txt error:', e);
    }
  }, []);

  // Safe print trigger
  const handleTriggerPrint = (order: StoredOrder) => {
    setIsPrintModalOpen(true);
  };

  // Direct print attempt inside current window with fallback
  const handleDirectPrint = () => {
    if (!activeOrder) return;
    const ok = printOrderSlipDirectly(activeOrder, hotline, brandName);
    if (ok) {
      setPrintSuccessToast('Đang gọi hộp thoại in phiếu...');
      setTimeout(() => setPrintSuccessToast(null), 3000);
    } else {
      try {
        window.print();
      } catch (err) {
        console.warn('Direct print inside window blocked, falling back to dedicated print tab:', err);
        handleOpenPrintTab(activeOrder);
      }
    }
  };

  // Timeline steps definition
  const getTimelineSteps = (order: StoredOrder) => {
    const norm = normalizeOrderStatus(order.status);
    
    const steps = [
      {
        id: 'received',
        label: 'Tiếp nhận đơn',
        desc: 'Đã nhận yêu cầu đan dây',
        icon: Package,
        isDone: true,
        isCurrent: norm === 'Chờ xác nhận'
      },
      {
        id: 'confirmed',
        label: 'Xác nhận đơn',
        desc: 'Đã chốt mẫu charm & chi tiết',
        icon: CheckCircle2,
        isDone: ['Đã xác nhận', 'Knot đang được sản xuất', 'Đang giao hàng', 'Đơn hàng giao thành công'].includes(norm),
        isCurrent: norm === 'Đã xác nhận'
      },
      {
        id: 'crafting',
        label: 'Đang đan Paracord',
        desc: 'Nghệ nhân thắt dây thủ công',
        icon: Hammer,
        isDone: ['Knot đang được sản xuất', 'Đang giao hàng', 'Đơn hàng giao thành công'].includes(norm),
        isCurrent: norm === 'Knot đang được sản xuất'
      },
      {
        id: 'shipping',
        label: 'Đang giao hàng',
        desc: order.shippingCarrier ? `${order.shippingCarrier}` : 'Đã bàn giao cho bưu tá',
        icon: Truck,
        isDone: ['Đang giao hàng', 'Đơn hàng giao thành công'].includes(norm),
        isCurrent: norm === 'Đang giao hàng'
      },
      {
        id: 'delivered',
        label: 'Giao thành công',
        desc: 'Kích hoạt bảo hành trọn đời',
        icon: ShieldCheck,
        isDone: norm === 'Đơn hàng giao thành công',
        isCurrent: norm === 'Đơn hàng giao thành công'
      }
    ];

    return steps;
  };

  // Build VietQR for active order if unpaid and bank transfer
  const activeOrderAmount = Math.round(Number(activeOrder?.totalPrice || activeOrder?.totalAmount || 0));
  const activeCustomerName = (activeOrder?.customerName || activeOrder?.name || '').trim();
  const activeCustomerPhone = (activeOrder?.phone || '').trim();

  // User requirement: "Nội dung ck là Họ và tên người mua + số điện thoại"
  const rawTransferMemo = `${activeCustomerName} ${activeCustomerPhone}`.trim();
  const cleanAsciiMemo = removeVietnameseTones(rawTransferMemo).toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim() || `NOTAKNOT ${activeCustomerPhone}`;

  const cleanBankId = (bankConfig.bankId || 'VCB').toUpperCase().trim();
  const cleanAccountNo = (bankConfig.accountNumber || '').replace(/[^0-9a-zA-Z]/g, '');
  const cleanAccountHolder = (bankConfig.accountHolder || 'NOT A KNOT').toUpperCase().trim();
  const qrTemplate = bankConfig.qrTemplate || 'compact2';

  const activeVietQrUrl = `https://img.vietqr.io/image/${cleanBankId}-${cleanAccountNo}-${qrTemplate}.png?amount=${activeOrderAmount}&addInfo=${encodeURIComponent(cleanAsciiMemo)}&accountName=${encodeURIComponent(cleanAccountHolder)}`;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 pb-20 pt-6 sm:pt-10 font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back Link */}
        <div className="mb-6 flex items-center justify-between pb-4 border-b border-slate-200/80">
          <button
            onClick={onNavigateCatalog}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-amber-700 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Quay lại cửa hàng</span>
          </button>

          <div className="text-xs font-bold text-slate-400">
            Hệ thống tra cứu đơn xưởng {brandName}
          </div>
        </div>

        {/* ============================================================ */}
        {/* REFINED SEARCH CONSOLE (ANTI-SLOP: CLEAN & CRAFTED)          */}
        {/* ============================================================ */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs mb-8">
          <div className="max-w-2xl mx-auto text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-display">
              Tra Cứu Tiến Độ Đơn Hàng
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Nhập mã tra cứu (ví dụ: <span className="font-mono font-bold text-slate-700">NAK-260908-1234</span>) hoặc số điện thoại bạn đã dùng khi đặt hàng.
            </p>
          </div>

          {/* Search Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              performSearch(searchQuery);
            }}
            className="max-w-2xl mx-auto"
          >
            <div className="relative flex items-center shadow-xs rounded-2xl border-2 border-slate-200 focus-within:border-amber-400 transition-colors bg-white overflow-hidden">
              <div className="pl-4 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nhập mã đơn NAK, mã vận đơn bưu cục hoặc số điện thoại..."
                className="w-full px-4 py-3.5 sm:py-4 text-sm font-medium text-slate-900 focus:outline-hidden placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveOrder(null);
                    setMatchedOrders([]);
                    setHasSearched(false);
                  }}
                  className="p-2 mr-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                  title="Xóa ô tìm kiếm"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={isLoading || !searchQuery.trim()}
                className="mr-2 px-5 py-2.5 sm:py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 flex-shrink-0"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang tìm...</span>
                  </>
                ) : (
                  <span>Tra cứu</span>
                )}
              </button>
            </div>
          </form>

          {/* Compact Recent Orders Chips */}
          {recentSuggestedOrders.length > 0 && !activeOrder && (
            <div className="max-w-2xl mx-auto mt-3.5 flex items-center justify-center gap-2 text-xs">
              <span className="text-slate-400 font-medium text-[11px] shrink-0">Đơn gần đây:</span>
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {recentSuggestedOrders.slice(0, 3).map((ord) => {
                  const displayCode = getOrderTrackingNumber(ord);
                  return (
                    <button
                      key={displayCode}
                      type="button"
                      onClick={() => {
                        setSearchQuery(displayCode);
                        performSearch(displayCode);
                      }}
                      className="px-2.5 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 font-mono font-bold text-xs transition-colors cursor-pointer border border-amber-200/60"
                      title={`Tra cứu nhanh ${displayCode}`}
                    >
                      {displayCode}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* SEARCH RESULT: MULTIPLE MATCHES (E.G. PHONE SEARCH)          */}
        {/* ============================================================ */}
        {!activeOrder && matchedOrders.length > 1 && (
          <div className="space-y-4 mb-8">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-xs sm:text-sm">
                <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>Tìm thấy <strong>{matchedOrders.length}</strong> đơn hàng phù hợp với thông tin tra cứu của bạn:</span>
              </div>
              <span className="text-xs text-amber-800 font-medium">Nhấn vào đơn để xem tiến độ</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matchedOrders.map((ord) => {
                const code = getOrderTrackingNumber(ord);
                const normStatus = normalizeOrderStatus(ord.status);
                const total = ord.totalPrice || ord.totalAmount || 0;

                return (
                  <div
                    key={ord.id || code}
                    onClick={() => setActiveOrder(ord)}
                    className="bg-white rounded-3xl border border-slate-200 hover:border-amber-400 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-black text-sm text-slate-950 tracking-wider group-hover:text-amber-600 transition-colors">
                          {code}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                          {normStatus}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 mb-3 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatOrderDateWithoutSeconds(ord.date || ord.createdAt)}</span>
                      </div>

                      <div className="space-y-1 mb-4">
                        {ord.itemDetails && ord.itemDetails.length > 0 ? (
                          ord.itemDetails.map((it, idx) => (
                            <div key={idx} className="text-xs text-slate-700 font-medium line-clamp-1">
                              • {it.productName} (x{it.quantity})
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-700 line-clamp-2">
                            {Array.isArray(ord.items) ? ord.items.join(', ') : (ord.items ? String(ord.items) : '')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Tổng tiền</span>
                        <span className="text-sm font-black text-slate-900 font-mono">
                          {total.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <span className="text-xs font-bold text-amber-700 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Xem chi tiết & mã QR →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SEARCH RESULT: NOT FOUND                                     */}
        {/* ============================================================ */}
        {!activeOrder && matchedOrders.length === 0 && hasSearched && (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs max-w-lg mx-auto mb-8">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">
              Không tìm thấy đơn hàng phù hợp
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Hệ thống chưa tìm thấy đơn nào khớp với từ khóa <strong>"{searchQuery}"</strong>. Bạn vui lòng kiểm tra lại mã đơn hàng (NAK-...), mã vận đơn bưu điện hoặc số điện thoại đã đặt hàng.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={messengerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-amber-400" />
                <span>Nhắn xưởng để kiểm tra</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setHasSearched(false);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Nhập lại thông tin
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ACTIVE ORDER: DETAILED CRAFT & PROGRESS VIEW                 */}
        {/* ============================================================ */}
        {activeOrder && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Top Order Card Header */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-black text-xl sm:text-2xl text-slate-950 tracking-wider">
                      {getCanonicalOrderKey(activeOrder) || activeOrder.trackingNumber || activeOrder.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(getCanonicalOrderKey(activeOrder) || activeOrder.trackingNumber || activeOrder.id || '', 'activeCode')}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      title="Sao chép mã đơn"
                    >
                      {copiedField === 'activeCode' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200/60">
                      {getSourceBadgeConfig(activeOrder.source).label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 mt-2.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatOrderDateWithoutSeconds(activeOrder.date || activeOrder.createdAt)}
                    </span>
                    <span>•</span>
                    <span>Khách nhận: <strong className="text-slate-800">{activeOrder.customerName || activeOrder.name}</strong></span>
                    <span>•</span>
                    <span>Hotline: <strong className="text-slate-700">{hotline}</strong></span>
                  </div>
                </div>

                {/* Status Badge & Actions */}
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <div className={`px-4 py-2.5 rounded-2xl border font-black text-xs sm:text-sm flex items-center gap-2 ${
                    normalizeOrderStatus(activeOrder.status) === 'Đơn hàng giao thành công'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : normalizeOrderStatus(activeOrder.status) === 'Đang giao hàng'
                      ? 'bg-blue-50 border-blue-300 text-blue-900'
                      : normalizeOrderStatus(activeOrder.status) === 'Knot đang được sản xuất'
                      ? 'bg-purple-50 border-purple-300 text-purple-900'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}>
                    {normalizeOrderStatus(activeOrder.status) === 'Đơn hàng giao thành công' ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    ) : normalizeOrderStatus(activeOrder.status) === 'Đang giao hàng' ? (
                      <Truck className="w-4 h-4 text-blue-600" />
                    ) : normalizeOrderStatus(activeOrder.status) === 'Knot đang được sản xuất' ? (
                      <Hammer className="w-4 h-4 text-purple-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600" />
                    )}
                    <span>{normalizeOrderStatus(activeOrder.status)}</span>
                  </div>

                  {/* Print Button */}
                  <button
                    type="button"
                    onClick={() => handleTriggerPrint(activeOrder)}
                    className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 shadow-xs hover:shadow-md"
                    title="In phiếu giao nhận và hóa đơn đơn hàng"
                  >
                    <Printer className="w-4 h-4 text-amber-400" />
                    <span>In Phiếu Đơn</span>
                  </button>
                </div>
              </div>

              {/* Crafting & Shipping Timeline */}
              <div className="pt-6">
                <div className="text-xs font-black uppercase tracking-wider text-slate-800 mb-5 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Tiến trình chế tác & vận chuyển thủ công</span>
                </div>

                {/* Desktop/Tablet Connected Stepper */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
                  {getTimelineSteps(activeOrder).map((step, idx) => {
                    const IconComponent = step.icon;
                    const isDone = step.isDone;
                    const isCurrent = step.isCurrent;

                    return (
                      <div
                        key={step.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between relative ${
                          isCurrent
                            ? 'bg-amber-50/90 border-2 border-amber-500 shadow-sm ring-2 ring-amber-300/50'
                            : isDone
                            ? 'bg-white border-2 border-slate-900 shadow-xs'
                            : 'bg-slate-50 border border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-mono font-black text-slate-600">
                            BƯỚC 0{idx + 1}
                          </span>
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                            isCurrent
                              ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400/60'
                              : isDone
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {isDone && !isCurrent ? (
                              <Check className="w-4 h-4 stroke-[3]" />
                            ) : (
                              <IconComponent className="w-4 h-4" />
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className={`text-xs font-black leading-tight ${isCurrent ? 'text-amber-950 font-black' : isDone ? 'text-slate-950 font-black' : 'text-slate-800 font-bold'}`}>
                            {step.label}
                          </h4>
                          <p className={`text-[11px] mt-1 leading-tight line-clamp-2 ${isCurrent ? 'text-amber-900 font-medium' : isDone ? 'text-slate-700 font-medium' : 'text-slate-600'}`}>
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Crafting Stage Note Callout (if set by admin) */}
                {activeOrder.craftingStageNote && (
                  <div className="mt-5 p-4 rounded-2xl bg-amber-50/90 border border-amber-300 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-950 block">
                        Ghi chú từ thợ đan xưởng:
                      </span>
                      <p className="text-sm font-bold text-slate-900 mt-1 leading-relaxed">
                        {activeOrder.craftingStageNote}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Shipping Carrier Banner (if carrier assigned) */}
              {(activeOrder.shippingCarrier || activeOrder.shippingCode) && (
                <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px] font-bold">Đơn vị vận chuyển:</span>
                      <strong className="text-slate-900 text-sm">{activeOrder.shippingCarrier || 'Chuyển phát nhanh'}</strong>
                      {activeOrder.shippingCode && (
                        <span className="ml-2 font-mono text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 font-black">
                          {activeOrder.shippingCode}
                        </span>
                      )}
                    </div>
                  </div>

                  {activeOrder.shippingCode && getCarrierTrackingUrl(activeOrder.shippingCarrier, activeOrder.shippingCode) && (
                    <a
                      href={getCarrierTrackingUrl(activeOrder.shippingCarrier, activeOrder.shippingCode)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl font-bold text-slate-900 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <span>Tra cứu trên website hãng vận chuyển</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Asymmetric 2-Column Split: Items (Left) vs Payment & QR (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column (7 cols): Items list & Custom Specs */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Handcrafted Items List */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-slate-500" />
                      <span>Sản phẩm chế tác</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-xs font-bold">
                      {activeOrder.itemDetails?.length || (Array.isArray(activeOrder.items) ? activeOrder.items.length : 1)} sản phẩm
                    </span>
                  </h3>

                  <div className="divide-y divide-slate-100">
                    {activeOrder.itemDetails && activeOrder.itemDetails.length > 0 ? (
                      activeOrder.itemDetails.map((it, idx) => {
                        const price = it.price || (it as any).unitPrice || 0;
                        const qty = it.quantity || 1;
                        const sub = price * qty;
                        const itemImg = it.selectedColorImage || (it as any).image;

                        return (
                          <div key={idx} className="py-4 first:pt-0 last:pb-0 flex gap-4 items-start">
                            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                              {itemImg ? (
                                <img src={itemImg} alt={it.productName} className="w-full h-full object-cover" />
                              ) : (
                                <ShoppingBag className="w-7 h-7 text-slate-300" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[72px]">
                              <div>
                                <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                                  {it.productName}
                                </h4>

                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-slate-500">
                                  {it.selectedSize && (
                                    <span className="bg-slate-100 px-2 py-0.5 rounded-md font-bold text-[11px] text-slate-800">
                                      Size: {it.selectedSize}
                                    </span>
                                  )}
                                  {it.selectedColor && (
                                    <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-700">
                                      Màu: {it.selectedColor}
                                    </span>
                                  )}
                                  {it.selectedCharm && (
                                    <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
                                      Charm: {it.selectedCharm}
                                    </span>
                                  )}
                                </div>

                                {it.customNote && (
                                  <div className="mt-2 p-2 rounded-xl bg-amber-50/80 border border-amber-200/70 text-xs text-amber-900 leading-tight">
                                    <span className="font-bold">Ghi chú xưởng:</span> "{it.customNote}"
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-xs">
                                <span className="text-slate-500 font-medium">Số lượng: <strong>x{qty}</strong></span>
                                <span className="font-mono font-black text-slate-900 text-sm sm:text-base">
                                  {sub.toLocaleString('vi-VN')}đ
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="space-y-2 py-2">
                        {Array.isArray(activeOrder.items) ? (
                          activeOrder.items.map((it, idx) => (
                            <div key={idx} className="text-xs text-slate-700 py-1 border-b border-slate-50 last:border-0">
                              • {it}
                            </div>
                          ))
                        ) : activeOrder.items ? (
                          <div className="text-xs text-slate-700">
                            • {String(activeOrder.items)}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Delivery Info */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>Địa chỉ & người nhận kiện hàng</span>
                  </h3>

                  <div className="space-y-4 text-xs sm:text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[11px] text-slate-400 font-bold uppercase block mb-1">Người nhận:</span>
                        <strong className="text-slate-900 text-sm sm:text-base block">
                          {activeOrder.customerName || activeOrder.name}
                        </strong>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-400 font-bold uppercase block mb-1">Số điện thoại:</span>
                          <span className="font-mono font-bold text-slate-900 text-sm sm:text-base block">
                            {maskPhone(activeOrder.phone)}
                          </span>
                        </div>
                        {activeOrder.phone && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(activeOrder.phone || '', 'phone')}
                            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                            title="Sao chép số điện thoại"
                          >
                            {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-400 font-bold uppercase block mb-1">Địa chỉ giao hàng:</span>
                      <p className="text-slate-800 font-medium leading-relaxed">
                        {activeOrder.address || 'Đang cập nhật địa chỉ giao hàng qua tin nhắn'}
                      </p>
                    </div>

                    {activeOrder.note && (
                      <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/50">
                        <span className="text-[11px] text-amber-900 font-bold uppercase block mb-1">Ghi chú của khách hàng:</span>
                        <p className="text-xs text-slate-700 italic">
                          "{activeOrder.note}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column (5 cols): Payment, VietQR Code, Actions */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Payment Overview Card */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-700" />
                      <span>Thanh toán & Hóa đơn</span>
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-black ${
                      activeOrder.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                        : 'bg-amber-100 text-amber-950 border border-amber-300'
                    }`}>
                      {activeOrder.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : 'Chờ thanh toán'}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs sm:text-sm">
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Hình thức thanh toán:</span>
                      <strong className="text-slate-950 font-bold">
                        {activeOrder.paymentMethod === 'bank_transfer'
                          ? 'Chuyển khoản VietQR'
                          : activeOrder.paymentMethod === 'cash'
                          ? 'Tiền mặt tại xưởng'
                          : 'Thanh toán COD khi nhận hàng'}
                      </strong>
                    </div>

                    {/* Phí vận chuyển */}
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Phí giao hàng:</span>
                      <strong className="text-emerald-800 font-bold font-mono">
                        {(activeOrder.shippingFee && activeOrder.shippingFee > 0)
                          ? `${activeOrder.shippingFee.toLocaleString('vi-VN')}đ`
                          : 'Miễn phí (Freeship)'}
                      </strong>
                    </div>

                    {/* Giảm giá nếu có */}
                    {activeOrder.discountAmount && activeOrder.discountAmount > 0 ? (
                      <div className="flex items-center justify-between text-emerald-800 font-bold">
                        <span>Giảm giá / Ưu đãi:</span>
                        <span className="font-mono">-{activeOrder.discountAmount.toLocaleString('vi-VN')}đ</span>
                      </div>
                    ) : null}

                    <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
                      <span className="text-sm font-black text-slate-950 uppercase tracking-tight">
                        Tổng tiền đơn hàng:
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-amber-950 font-mono">
                        {activeOrderAmount.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>
                </div>

                {/* ======================================================= */}
                {/* IF UNPAID & BANK TRANSFER: RENDER LARGE VIETQR CARD      */}
                {/* ======================================================= */}
                {activeOrder.paymentStatus !== 'paid' && activeOrder.paymentMethod === 'bank_transfer' && (
                  <div className="bg-white rounded-3xl border-2 border-amber-400 p-5 sm:p-6 shadow-md space-y-4">
                    <div className="text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-100 text-amber-950 text-xs font-black mb-2">
                        <QrCode className="w-3.5 h-3.5 text-amber-700" />
                        <span>Quét mã VietQR chuyển khoản</span>
                      </div>
                      <h4 className="text-base font-black text-slate-900">
                        Thanh Toán Đơn Hàng Nhanh 24/7
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Quét mã bằng ứng dụng ngân hàng để tự động điền đúng số tiền và nội dung.
                      </p>
                    </div>

                    {/* QR Code Container (Crisp & Scannable) */}
                    <div className="flex flex-col items-center justify-center pt-2">
                      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-md">
                        <img
                          src={activeVietQrUrl}
                          alt="VietQR Code"
                          className="w-52 h-52 sm:w-60 sm:h-60 object-contain rounded-xl"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <a
                        href={activeVietQrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 text-xs font-bold text-amber-700 hover:underline flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Mở ảnh QR kích thước lớn</span>
                      </a>
                    </div>

                    {/* Copyable Details */}
                    <div className="space-y-2.5 text-xs pt-2">
                      {/* STK */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">STK {bankConfig.bankName}</span>
                          <span className="font-mono font-black text-slate-900 text-sm sm:text-base">{cleanAccountNo}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(cleanAccountNo, 'stk')}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          {copiedField === 'stk' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : 'Sao chép'}
                        </button>
                      </div>

                      {/* Exact Amount */}
                      <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-800 uppercase font-bold block">Số tiền chính xác</span>
                          <span className="font-mono font-black text-emerald-900 text-sm sm:text-base">{activeOrderAmount.toLocaleString('vi-VN')}đ</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(activeOrderAmount), 'amount')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                        >
                          {copiedField === 'amount' ? <Check className="w-3.5 h-3.5" /> : 'Sao chép'}
                        </button>
                      </div>

                      {/* Transfer Memo - MANDATED: "Họ và tên người mua + số điện thoại" */}
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-amber-900 uppercase font-black">Nội dung chuyển khoản</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(cleanAsciiMemo, 'memo')}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black cursor-pointer"
                          >
                            {copiedField === 'memo' ? <Check className="w-3.5 h-3.5" /> : 'Sao chép'}
                          </button>
                        </div>
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          {rawTransferMemo || cleanAsciiMemo}
                        </span>
                        <span className="text-[10px] text-amber-800 italic">
                          (Dạng ngân hàng: <span className="font-mono font-bold">{cleanAsciiMemo}</span>)
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 italic text-center leading-tight">
                      Vui lòng giữ nguyên nội dung chuyển khoản để hệ thống tự động cập nhật đơn.
                    </p>
                  </div>
                )}

                {/* Support Actions */}
                <div className="bg-slate-50 rounded-3xl border border-slate-200/80 p-5 space-y-3">
                  <a
                    href={messengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4 text-amber-400" />
                    <span>Hỗ trợ nhanh qua Messenger</span>
                  </a>

                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Phone className="w-3.5 h-3.5 text-amber-600" />
                    <span>Hotline xưởng đan: <strong className="text-slate-800">{hotline}</strong></span>
                  </div>
                </div>

                {/* Lifetime Warranty Pledge */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 flex items-center gap-3 text-xs text-slate-600">
                  <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Cam kết bảo hành chốt khóa trọn đời & đồng kiểm khi nhận hàng.</span>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* PRINT / INVOICE MODAL (OFFICIAL SLIP)                        */}
        {/* ============================================================ */}
        {isPrintModalOpen && activeOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
              
              {/* Modal Top Bar */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between no-print">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-black text-slate-900">
                    Phiếu Giao Nhận & Hóa Đơn Đơn Hàng
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable Area */}
              <div className="p-6 sm:p-8 space-y-6 printable-order-slip bg-white text-slate-900 font-sans">
                
                {/* Header with store brand */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-900 pb-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-wider font-display">
                      {brandName}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tiệm Đan Vòng Thủ Công & Phụ Kiện Paracord
                    </p>
                    <p className="text-xs text-slate-500">
                      Hotline: {hotline}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">Mã đơn hàng</span>
                    <span className="text-lg sm:text-xl font-mono font-black text-slate-950">
                      {getCanonicalOrderKey(activeOrder) || activeOrder.trackingNumber || activeOrder.id}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ngày đặt: {formatOrderDateWithoutSeconds(activeOrder.date || activeOrder.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Người nhận hàng</span>
                    <strong className="text-slate-900 text-sm block">{activeOrder.customerName || activeOrder.name}</strong>
                    <span className="font-mono text-slate-700 font-bold block mt-1">{activeOrder.phone}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Địa chỉ nhận hàng</span>
                    <p className="text-slate-800 font-medium leading-relaxed">
                      {activeOrder.address || 'Đang cập nhật qua tin nhắn'}
                    </p>
                    {activeOrder.note && (
                      <p className="text-[11px] text-slate-500 italic mt-1">
                        Ghi chú: {activeOrder.note}
                      </p>
                    )}
                  </div>
                </div>

                {/* Itemized Table */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                    Chi tiết sản phẩm chế tác
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-2.5">Sản phẩm & Chi tiết tuỳ biến</th>
                          <th className="p-2.5 text-center w-16">SL</th>
                          <th className="p-2.5 text-right w-24">Đơn giá</th>
                          <th className="p-2.5 text-right w-28">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeOrder.itemDetails && activeOrder.itemDetails.length > 0 ? (
                          activeOrder.itemDetails.map((it, idx) => {
                            const price = it.price || (it as any).unitPrice || 0;
                            const qty = it.quantity || 1;
                            const sub = price * qty;
                            return (
                              <tr key={idx}>
                                <td className="p-2.5">
                                  <strong className="text-slate-900 block">{it.productName}</strong>
                                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-1.5 mt-0.5">
                                    {it.selectedSize && <span>Size: {it.selectedSize}</span>}
                                    {it.selectedColor && <span>• Màu: {it.selectedColor}</span>}
                                    {it.selectedCharm && <span>• Charm: {it.selectedCharm}</span>}
                                  </div>
                                  {it.customNote && (
                                    <div className="text-[10px] text-amber-800 italic mt-0.5">
                                      * Ghi chú: {it.customNote}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2.5 text-center font-bold">{qty}</td>
                                <td className="p-2.5 text-right font-mono">{price.toLocaleString('vi-VN')}đ</td>
                                <td className="p-2.5 text-right font-mono font-bold">{sub.toLocaleString('vi-VN')}đ</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-3 text-slate-700">
                              {Array.isArray(activeOrder.items) ? activeOrder.items.join(', ') : String(activeOrder.items || '')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Trạng thái đơn hàng:</span>
                    <strong className="text-slate-900">{normalizeOrderStatus(activeOrder.status)}</strong>
                  </div>
                  {activeOrder.craftingStageNote && (
                    <div className="flex justify-between text-slate-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      <span className="font-bold text-amber-900">Ghi chú xưởng:</span>
                      <span className="text-slate-900 font-medium">{activeOrder.craftingStageNote}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Hình thức thanh toán:</span>
                    <strong className="text-slate-900">
                      {activeOrder.paymentMethod === 'cod' ? 'Thu hộ COD khi nhận hàng' : 'Chuyển khoản VietQR'}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Phí vận chuyển:</span>
                    <strong className="text-emerald-800 font-bold font-mono">
                      {(activeOrder.shippingFee && activeOrder.shippingFee > 0)
                        ? `${activeOrder.shippingFee.toLocaleString('vi-VN')}đ`
                        : 'Miễn phí'}
                    </strong>
                  </div>
                  {activeOrder.discountAmount && activeOrder.discountAmount > 0 ? (
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>Giảm giá / Ưu đãi:</span>
                      <strong className="font-mono">-{activeOrder.discountAmount.toLocaleString('vi-VN')}đ</strong>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-slate-600">
                    <span>Trạng thái thanh toán:</span>
                    <strong className={activeOrder.paymentStatus === 'paid' ? 'text-emerald-700 font-bold' : 'text-amber-800 font-bold'}>
                      {activeOrder.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : 'Chờ thu tiền COD'}
                    </strong>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline text-sm">
                    <strong className="text-slate-900 uppercase">Tổng tiền thanh toán:</strong>
                    <strong className="text-base font-black text-amber-900 font-mono">
                      {activeOrderAmount.toLocaleString('vi-VN')}đ
                    </strong>
                  </div>
                </div>

                {/* Guarantee note */}
                <div className="text-[11px] text-slate-500 text-center italic border-t border-dashed border-slate-200 pt-3">
                  Cảm ơn bạn đã lựa chọn Not A Knot! Sản phẩm thủ công được bảo hành chốt khóa trọn đời.
                </div>
              </div>

              {/* Modal Bottom Actions */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
                <span className="text-xs text-slate-600 font-medium">
                  {printSuccessToast || 'Chọn "In Phiếu" hoặc "Mở Tab In" nếu trình duyệt chặn popup.'}
                </span>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const text = generateSlipPlainText(activeOrder);
                      copyToClipboard(text, 'fullSlip');
                      setPrintSuccessToast('Đã sao chép toàn bộ thông tin phiếu đơn hàng!');
                      setTimeout(() => setPrintSuccessToast(null), 3000);
                    }}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    title="Sao chép toàn bộ chữ của phiếu"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadInvoice(activeOrder)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    title="Tải hóa đơn văn bản .txt"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải .txt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenPrintTab(activeOrder)}
                    className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    title="Mở sang tab mới để in độc lập không bị chặn"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở Tab In</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectPrint}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                    title="In trực tiếp"
                  >
                    <Printer className="w-4 h-4 text-amber-400" />
                    <span>In Phiếu Ngay</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
