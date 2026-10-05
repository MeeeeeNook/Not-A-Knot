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
  X,
  Mail,
  User
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
import { printOrderSlipDirectly } from '../utils/printOrderSlip';
import { sendOrderConfirmationEmail } from '../utils/emailService';

interface OrderTrackerProps {
  initialTrackingCode?: string;
  allOrders?: StoredOrder[];
  products?: any[];
  onNavigateHome: () => void;
  onNavigateCatalog: () => void;
  siteContent?: SiteContentConfig;
}

// Fallback image resolver for handcrafted items
const resolveOrderItemImage = (it: any, catalog: any[] = []): string => {
  const direct = it?.selectedColorImage || it?.image || it?.imageUrl || it?.productImage;
  if (direct && typeof direct === 'string' && direct.trim() && !direct.startsWith('data:image/')) {
    return direct.trim();
  }

  const name = String(it?.productName || it?.name || '').trim().toLowerCase();
  if (Array.isArray(catalog) && catalog.length > 0) {
    const matched = catalog.find((p: any) => {
      const pName = String(p?.name || p?.title || '').trim().toLowerCase();
      return pName && (pName.includes(name) || name.includes(pName));
    });
    if (matched) {
      if (it?.selectedColor && Array.isArray(matched.colorOptions)) {
        const cOpt = matched.colorOptions.find((c: any) =>
          String(c?.name || '').trim().toLowerCase() === String(it.selectedColor).trim().toLowerCase()
        );
        if (cOpt?.image) return cOpt.image;
      }
      if (matched.image) return matched.image;
      if (Array.isArray(matched.images) && matched.images[0]) return matched.images[0];
    }
  }

  if (name.includes('bo doi') || name.includes('bộ đội')) return '/assets/keychain-bodoi.jpg';
  if (name.includes('mu coi') || name.includes('mũ cối')) return '/assets/keychain-mucoi.jpg';
  if (name.includes('0209') || name.includes('02/09') || name.includes('paracord') || name.includes('co do')) return '/assets/0209/img_3.jpg';
  if (name.includes('butterfly') || name.includes('buom') || name.includes('bướm')) return '/assets/img_4.jpg';
  if (name.includes('lucky') || name.includes('hoa') || name.includes('knot')) return '/assets/img_1.jpg';

  return '/assets/img_1.jpg';
};

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
  const pMethod = (order.paymentMethod === 'bank_transfer' && order.source !== 'website')
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
          it.selectedOmamoris && it.selectedOmamoris.length > 0 ? `Bùa: ${it.selectedOmamoris.map(o => o.name).join(', ')}` : '',
          it.selectedKhoen ? `Khoen: ${it.selectedKhoen}` : '',
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
        <div class="subbrand">Xưởng Đan Vòng & Phụ Kiện Handmade Thủ Công</div>
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
        <span>Hình thức:</span>
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
      Cảm ơn bạn đã lựa chọn ${brandName}! Chúc quý khách một ngày tốt lành.
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

const EMPTY_DEFAULT_ORDERS: StoredOrder[] = [];

export const OrderTracker: React.FC<OrderTrackerProps> = ({
  initialTrackingCode = '',
  allOrders = EMPTY_DEFAULT_ORDERS,
  products = [],
  onNavigateHome,
  onNavigateCatalog,
  siteContent
}) => {
  const [orderCodeInput, setOrderCodeInput] = useState(initialTrackingCode || '');
  const [phoneInput, setPhoneInput] = useState('');
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printSuccessToast, setPrintSuccessToast] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Email modal state for interactive order email dispatch
  const [emailModalOrder, setEmailModalOrder] = useState<any | null>(null);
  const [emailModalInput, setEmailModalInput] = useState('');
  const [emailModalMessage, setEmailModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSendEmail = (order: any) => {
    if (!order) return;
    setEmailModalOrder(order);
    setEmailModalInput((order.email || order.customerEmail || '').trim());
    setEmailModalMessage(null);
  };

  const handleExecuteSendEmail = async () => {
    if (!emailModalOrder) return;
    const cleanEmail = emailModalInput.trim();
    if (!cleanEmail) {
      setEmailModalMessage({ type: 'error', text: 'Vui lòng nhập địa chỉ email hợp lệ.' });
      return;
    }

    setIsSendingEmail(true);
    setEmailModalMessage(null);
    try {
      const payload = {
        ...emailModalOrder,
        id: emailModalOrder.id || emailModalOrder.orderCode || emailModalOrder.trackingNumber || `NAK-${Date.now()}`,
        email: cleanEmail,
        customerEmail: cleanEmail,
        isManualAdmin: true
      } as unknown as StoredOrder;
      
      const res = await sendOrderConfirmationEmail(payload);
      if (res.success) {
        setEmailModalMessage({ type: 'success', text: `✓ Đã gửi email xác nhận thành công tới ${cleanEmail}!` });
        setPrintSuccessToast(`✓ Đã gửi email xác nhận thành công tới ${cleanEmail}!`);
        setTimeout(() => {
          setEmailModalOrder(null);
          setPrintSuccessToast(null);
        }, 2200);
      } else {
        setEmailModalMessage({ type: 'error', text: `Lỗi gửi thư: ${res.error || res.message || 'Không thể phản hồi'}` });
      }
    } catch (err: any) {
      setEmailModalMessage({ type: 'error', text: `Lỗi kết nối: ${err?.message || 'Không thể kết nối máy chủ'}` });
    } finally {
      setIsSendingEmail(false);
    }
  };

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

  // Pre-fill order tracking code from URL or last order, but NEVER prefill or display phone/order info
  useEffect(() => {
    if (initialTrackingCode && initialTrackingCode.trim()) {
      setOrderCodeInput(initialTrackingCode.trim().toUpperCase());
    } else {
      try {
        const lastCode = localStorage.getItem('nak_last_order_code');
        if (lastCode && lastCode.trim()) {
          setOrderCodeInput(lastCode.trim().toUpperCase());
        }
      } catch {}
    }
  }, [initialTrackingCode]);

  // Handle Order Tracking Verification via Server Gatekeeper
  const handleTrackSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = (orderCodeInput || '').trim().toUpperCase();
    const cleanPhone = (phoneInput || '').trim();

    if (!cleanCode || !cleanPhone) {
      setSearchError('Vui lòng nhập cả mã đơn hàng và số điện thoại đã dùng khi đặt hàng.');
      return;
    }

    setIsLoading(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode: cleanCode, phone: cleanPhone })
      });

      // 1. Intercept HTTP 429 before attempting to read JSON (WAF response may be plain text/HTML)
      if (res.status === 429) {
        setActiveOrder(null);
        const retryAfter = res.headers.get('Retry-After');
        let errorMsg = 'Bạn đã tra cứu quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.';
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds) && seconds > 0) {
            const minutes = Math.ceil(seconds / 60);
            errorMsg = `Bạn đã tra cứu quá nhiều lần. Vui lòng chờ ${minutes > 1 ? `${minutes} phút` : `${seconds} giây`} rồi thử lại.`;
          }
        }
        setSearchError(errorMsg);
        return;
      }

      // 2. Safe parse in case edge WAF or gateway returns non-JSON body
      let data: any = null;
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : null;
      } catch {
        setActiveOrder(null);
        setSearchError('Máy chủ đang bận hoặc phản hồi không hợp lệ. Vui lòng thử lại sau.');
        return;
      }

      if (!data) {
        setActiveOrder(null);
        setSearchError('Không nhận được dữ liệu từ máy chủ. Vui lòng thử lại sau.');
        return;
      }

      if (data.success && data.order) {
        setActiveOrder(data.order);
        setSearchError(null);
        try {
          // Remember order code for convenience (NEVER store phone number!)
          localStorage.setItem('nak_last_order_code', cleanCode);
        } catch {}
      } else {
        // Fallback: If customer placed an order in this browser, check nak_preorders with phone match
        let localFoundOrder: any = null;
        try {
          const raw = localStorage.getItem('nak_preorders');
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const matched = list.find((it: any) => {
                const c = String(it?.id || it?.trackingNumber || '').trim().toUpperCase();
                const p = String(it?.phone || it?.customerPhone || '').trim().replace(/[^\d+]/g, '');
                const cleanPhoneDigits = cleanPhone.replace(/[^\d+]/g, '');
                const codeMatch = c === cleanCode || c === `NAK-${cleanCode}` || cleanCode === `NAK-${c}`;
                const phoneMatch = p && cleanPhoneDigits && (p.endsWith(cleanPhoneDigits.slice(-9)) || cleanPhoneDigits.endsWith(p.slice(-9)));
                return codeMatch && phoneMatch;
              });
              if (matched) {
                localFoundOrder = matched;
              }
            }
          }
        } catch {}

        if (localFoundOrder) {
          setActiveOrder(localFoundOrder);
          setSearchError(null);
        } else {
          setActiveOrder(null);
          setSearchError(data.message || 'Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn và số điện thoại.');
        }
      }
    } catch {
      setActiveOrder(null);
      setSearchError('Không thể kết nối máy chủ tra cứu. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
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
          it.selectedOmamoris && it.selectedOmamoris.length > 0 ? `Bùa: ${it.selectedOmamoris.map(o => o.name).join(', ')}` : '',
          it.selectedKhoen ? `Khoen: ${it.selectedKhoen}` : '',
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
Phương thức: ${order.paymentMethod === 'bank_transfer' && order.source !== 'website' ? 'Chuyển khoản VietQR' : order.paymentMethod === 'cash' ? 'Tiền mặt tại xưởng' : 'Thanh toán khi nhận hàng (COD)'}
${order.shippingCarrier ? `Vận chuyển: ${order.shippingCarrier} ${order.shippingCode ? `(Mã: ${order.shippingCode})` : ''}\n` : ''}
----------------------------------------
Hotline xưởng: ${hotline}
Cảm ơn quý khách đã tin tưởng và ủng hộ!
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
        label: 'Đang đan thủ công',
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
        desc: 'Đơn hàng đã hoàn thành',
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
  const activeOrderCode = (activeOrder?.orderCode || activeOrder?.trackingNumber || activeOrder?.id || '').trim();

  const rawTransferMemo = `${activeCustomerName} ${activeOrderCode}`.trim();
  const cleanAsciiMemo = removeVietnameseTones(rawTransferMemo).toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim() || `NOTAKNOT ${activeOrderCode || 'ORDER'}`;

  const cleanBankId = (bankConfig.bankId || 'VCB').toUpperCase().trim();
  const cleanAccountNo = (bankConfig.accountNumber || '').replace(/[^0-9a-zA-Z]/g, '');
  const cleanAccountHolder = (bankConfig.accountHolder || 'NOT A KNOT').toUpperCase().trim();
  const qrTemplate = bankConfig.qrTemplate || 'compact2';

  const activeVietQrUrl = `https://img.vietqr.io/image/${cleanBankId}-${cleanAccountNo}-${qrTemplate}.png?amount=${activeOrderAmount}&addInfo=${encodeURIComponent(cleanAsciiMemo)}&accountName=${encodeURIComponent(cleanAccountHolder)}`;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 pb-20 pt-6 sm:pt-10 font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back Link & Header */}
        <div className="mb-6 flex items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
          <button
            onClick={onNavigateCatalog}
            className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-amber-700 transition-colors cursor-pointer group whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform shrink-0" />
            <span>Quay lại cửa hàng</span>
          </button>

          <div className="text-xs font-bold text-slate-400 whitespace-nowrap text-right">
            Tra cứu đơn
          </div>
        </div>

        {/* ============================================================ */}
        {/* REFINED SEARCH CONSOLE (ANTI-SLOP: CLEAN & CRAFTED)          */}
        {/* ============================================================ */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-8 shadow-xs mb-8">
          <div className="max-w-2xl mx-auto text-center mb-6">
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight font-display">
              Tra Cứu Đơn Hàng
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Nhập mã đơn hàng và số điện thoại bạn đã dùng khi đặt hàng để kiểm tra trạng thái đơn hàng
            </p>
          </div>

          {/* Secure Dual-Input Tracking Form */}
          <form onSubmit={handleTrackSubmit} className="max-w-2xl mx-auto space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* 1. Mã đơn hàng */}
              <div className="relative flex items-center shadow-xs rounded-2xl border-2 border-slate-200 focus-within:border-amber-500 transition-colors bg-white overflow-hidden">
                <div className="pl-3.5 text-slate-400">
                  <Package className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={orderCodeInput}
                  onChange={(e) => setOrderCodeInput(e.target.value)}
                  placeholder="Mã đơn hàng (VD: NAK-260908-1234)"
                  className="w-full px-3 py-3 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden placeholder:text-slate-400 font-mono"
                  required
                />
                {orderCodeInput && (
                  <button
                    type="button"
                    onClick={() => setOrderCodeInput('')}
                    className="p-1.5 mr-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                    title="Xóa mã đơn"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 2. Số điện thoại */}
              <div className="relative flex items-center shadow-xs rounded-2xl border-2 border-slate-200 focus-within:border-amber-500 transition-colors bg-white overflow-hidden">
                <div className="pl-3.5 text-slate-400">
                  <Phone className="w-5 h-5" />
                </div>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="Số điện thoại đặt hàng (VD: 0796555636)"
                  className="w-full px-3 py-3 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden placeholder:text-slate-400 font-mono"
                  required
                />
                {phoneInput && (
                  <button
                    type="button"
                    onClick={() => setPhoneInput('')}
                    className="p-1.5 mr-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                    title="Xóa số điện thoại"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isLoading || !orderCodeInput.trim() || !phoneInput.trim()}
                className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang tra cứu...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Tra cứu đơn hàng</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Error Alert */}
          {searchError && (
            <div className="max-w-2xl mx-auto mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs sm:text-sm animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="font-semibold">{searchError}</span>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* ACTIVE ORDER: DETAILED CRAFT & PROGRESS VIEW                 */}
        {/* ============================================================ */}
        {activeOrder && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Top Order Card Header */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-7 shadow-xs">
              <div className="pb-5 sm:pb-6 border-b border-slate-100">
                
                {/* Row 1 on mobile: Badges (Source + Status) neatly aligned */}
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200/60 inline-flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    {getSourceBadgeConfig(activeOrder.source).label}
                  </span>

                  {/* Status Badge */}
                  <div className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl border font-bold text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    normalizeOrderStatus(activeOrder.status) === 'Đơn hàng giao thành công'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : normalizeOrderStatus(activeOrder.status) === 'Đang giao hàng'
                      ? 'bg-blue-50 border-blue-300 text-blue-900'
                      : normalizeOrderStatus(activeOrder.status) === 'Knot đang được sản xuất'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}>
                    {normalizeOrderStatus(activeOrder.status) === 'Đơn hàng giao thành công' ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : normalizeOrderStatus(activeOrder.status) === 'Đang giao hàng' ? (
                      <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : normalizeOrderStatus(activeOrder.status) === 'Knot đang được sản xuất' ? (
                      <Hammer className="w-4 h-4 text-indigo-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{normalizeOrderStatus(activeOrder.status)}</span>
                  </div>
                </div>

                {/* Row 2: Large Order Code & Copy Button */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-xl sm:text-3xl text-slate-950 tracking-tight">
                      {activeOrder.orderCode || activeOrder.trackingNumber || activeOrder.id || getCanonicalOrderKey(activeOrder)}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeOrder.orderCode || activeOrder.trackingNumber || activeOrder.id || getCanonicalOrderKey(activeOrder) || '', 'activeCode')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
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
                  </div>
                </div>

                {/* Row 3: Key Info Grid (Clean structured cards with no awkward wrap or dangling dots) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-3.5 pt-3.5 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center gap-2 p-2.5 sm:p-0 rounded-xl bg-slate-50/80 sm:bg-transparent">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500">Thời gian:</span>
                    <strong className="text-slate-900 font-bold ml-auto sm:ml-0 font-mono">
                      {formatOrderDateWithoutSeconds(activeOrder.date || activeOrder.createdAt)}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 sm:p-0 rounded-xl bg-slate-50/80 sm:bg-transparent">
                    <User className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-slate-500">Khách nhận:</span>
                    <strong className="text-slate-900 font-bold truncate max-w-[150px] sm:max-w-none ml-auto sm:ml-0">
                      {activeOrder.customerName || activeOrder.name}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 sm:p-0 rounded-xl bg-slate-50/80 sm:bg-transparent">
                    <Phone className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-slate-500">Hotline:</span>
                    <a href={`tel:${hotline.replace(/\s+/g, '')}`} className="text-amber-800 hover:underline font-bold font-mono ml-auto sm:ml-0">
                      {hotline}
                    </a>
                  </div>
                </div>

                {/* Row 4: Action Buttons (Print & Email) - balanced touch targets */}
                <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleTriggerPrint(activeOrder)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                    title="In phiếu giao nhận và hóa đơn"
                  >
                    <Printer className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">In phiếu đơn</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendEmail(activeOrder)}
                    disabled={isSendingEmail}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-500 active:scale-98 text-slate-950 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                    title="Gửi email xác nhận đơn hàng"
                  >
                    {isSendingEmail ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                        <span className="truncate">Đang gửi...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 text-slate-950 shrink-0" />
                        <span className="truncate">Gửi email</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Crafting & Shipping Timeline */}
              <div className="pt-5 sm:pt-6">
                <div className="text-xs font-black uppercase tracking-wider text-slate-800 mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Trạng thái</span>
                </div>

                {/* MOBILE VIEW: SLEEK CONNECTED VERTICAL STEPPER */}
                <div className="sm:hidden relative pl-2 pr-1 py-1">
                  {/* Continuous Vertical Connecting Line */}
                  <div className="absolute left-[26px] top-6 bottom-6 w-0.5 bg-slate-200 -z-0"></div>

                  <div className="space-y-3 relative z-10">
                    {getTimelineSteps(activeOrder).map((step, idx) => {
                      const IconComponent = step.icon;
                      const isDone = step.isDone;
                      const isCurrent = step.isCurrent;

                      return (
                        <div
                          key={step.id}
                          className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                            isCurrent
                              ? 'bg-amber-50/95 border-amber-400 shadow-sm ring-2 ring-amber-300/60'
                              : isDone
                              ? 'bg-white border-slate-200/90 shadow-2xs'
                              : 'bg-slate-50/70 border-slate-200/60 opacity-80'
                          }`}
                        >
                          {/* Step Icon Node */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isCurrent
                              ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-200/70 font-bold shadow-xs'
                              : isDone
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}>
                            {isDone && !isCurrent ? (
                              <Check className="w-4 h-4 stroke-[3]" />
                            ) : (
                              <IconComponent className="w-4 h-4" />
                            )}
                          </div>

                          {/* Step Text Info */}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider">
                                Bước 0{idx + 1}
                              </span>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-black text-[10px] tracking-wide">
                                  Đang xử lý
                                </span>
                              )}
                              {isDone && !isCurrent && (
                                <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Hoàn tất
                                </span>
                              )}
                            </div>

                            <h4 className={`text-sm font-black mt-0.5 leading-snug ${
                              isCurrent ? 'text-amber-950' : isDone ? 'text-slate-950' : 'text-slate-600'
                            }`}>
                              {step.label}
                            </h4>
                            <p className={`text-xs mt-0.5 leading-relaxed ${
                              isCurrent ? 'text-amber-900/90' : isDone ? 'text-slate-600' : 'text-slate-400'
                            }`}>
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* DESKTOP/TABLET VIEW: 5-COLUMN HORIZONTAL STEPPER */}
                <div className="hidden sm:grid sm:grid-cols-5 gap-3 relative">
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
                <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-7 shadow-xs">
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
                        const itemImg = resolveOrderItemImage(it, products);

                        return (
                          <div key={idx} className="py-4 first:pt-0 last:pb-0 flex gap-4 items-start">
                            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                              {itemImg && typeof itemImg === 'string' && itemImg.trim().length > 0 ? (
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

                                {it.selectedComboItems && it.selectedComboItems.length > 0 ? (
                                  <div className="mt-2 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 space-y-1.5 text-xs">
                                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                                      <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 rounded text-[10px] font-black">
                                        COMBO {it.selectedComboItems.length} MÓN
                                      </span>
                                    </div>
                                    <div className="space-y-1.5 pl-1">
                                      {it.selectedComboItems.map((ci, cIdx) => (
                                        <div key={cIdx} className="bg-white/90 p-1.5 rounded-lg border border-amber-100 text-xs space-y-0.5">
                                          <div className="font-bold text-slate-900 flex items-center gap-1">
                                            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-neutral-950 text-[9px] font-black flex items-center justify-center shrink-0">
                                              {cIdx + 1}
                                            </span>
                                            <span>{ci.itemTitle || `Món ${cIdx + 1}`}</span>
                                          </div>
                                          <div className="flex flex-wrap gap-1 text-[11px] text-slate-600 pl-4.5">
                                            {ci.selectedColor && (
                                              <span className="bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                                                Màu: {ci.selectedColor}
                                              </span>
                                            )}
                                            {ci.selectedCharms && ci.selectedCharms.length > 0 && (
                                              <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-1.5 py-0.2 rounded font-medium">
                                                Charm: {ci.selectedCharms.map(c => c.name).join(', ')}
                                              </span>
                                            )}
                                            {ci.selectedOmamoris && ci.selectedOmamoris.length > 0 && (
                                              <span className="bg-rose-50 text-rose-900 border border-rose-200 px-1.5 py-0.2 rounded font-medium">
                                                Bùa: {ci.selectedOmamoris.map(o => o.name).join(', ')}
                                              </span>
                                            )}
                                            {ci.selectedKhoen && (
                                              <span className="bg-sky-50 text-sky-900 border border-sky-200 px-1.5 py-0.2 rounded font-medium">
                                                Khoen: {ci.selectedKhoen}
                                              </span>
                                            )}
                                            {ci.selectedSize && (
                                              <span className="bg-blue-50 text-blue-900 border border-blue-200 px-1.5 py-0.2 rounded font-medium">
                                                Size: {ci.selectedSize}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
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
                                    {it.selectedOmamoris && it.selectedOmamoris.length > 0 && (
                                      <span className="bg-rose-50 text-rose-900 border border-rose-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
                                        Bùa: {it.selectedOmamoris.map(o => o.name).join(', ')}
                                      </span>
                                    )}
                                    {it.selectedKhoen && (
                                      <span className="bg-sky-50 text-sky-900 border border-sky-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
                                        Khoen: {it.selectedKhoen}
                                      </span>
                                    )}
                                    {it.customPhotoUrl && (
                                      <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-900 border border-rose-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
                                        <a href={it.customPhotoUrl} target="_blank" rel="noreferrer" title="Bấm để xem ảnh bạn đã tải">
                                          <img src={it.customPhotoUrl} alt="Ảnh custom" className="w-3.5 h-3.5 rounded object-cover border border-rose-300 inline" />
                                        </a>
                                        <span>Ảnh in custom</span>
                                        {it.customPhotoPrice && it.customPhotoPrice > 0 ? (
                                          <span className="text-rose-700">(+{it.customPhotoPrice.toLocaleString('vi-VN')}đ)</span>
                                        ) : null}
                                      </span>
                                    )}
                                  </div>
                                )}

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
                <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-7 shadow-xs">
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

                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[11px] text-slate-400 font-bold uppercase block mb-1">Số điện thoại (đã ẩn):</span>
                        <span className="font-mono font-bold text-slate-900 text-sm sm:text-base block">
                          {activeOrder.maskedPhone || (activeOrder.phone ? `******${String(activeOrder.phone).slice(-4)}` : '******')}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-400 font-bold uppercase block mb-1">Khu vực giao hàng:</span>
                      <p className="text-slate-800 font-medium leading-relaxed">
                        {activeOrder.maskedLocation || activeOrder.address || 'Đang cập nhật khu vực giao hàng'}
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
                <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-7 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-700" />
                      <span>Hóa đơn</span>
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-black whitespace-nowrap shrink-0 ${
                      activeOrder.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                        : 'bg-amber-100 text-amber-950 border border-amber-300'
                    }`}>
                      {activeOrder.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : 'Chờ thanh toán'}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs sm:text-sm">
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Hình thức:</span>
                      <strong className="text-slate-950 font-bold">
                        {activeOrder.paymentMethod === 'bank_transfer' && activeOrder.source !== 'website'
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
                {activeOrder.paymentStatus !== 'paid' && activeOrder.paymentMethod === 'bank_transfer' && activeOrder.source !== 'website' && (
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

                {/* IF UNPAID & COD: RENDER FRIENDLY COD NOTICE */}
                {activeOrder.paymentStatus !== 'paid' && (activeOrder.paymentMethod === 'cod' || !activeOrder.paymentMethod || activeOrder.source === 'website') && (
                  <div className="bg-emerald-50/70 rounded-3xl border border-emerald-200 p-4 sm:p-5 shadow-xs space-y-2">
                    <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs sm:text-sm">
                      <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Thanh toán khi nhận hàng (COD)</span>
                    </div>
                    <p className="text-xs text-emerald-900 leading-relaxed">
                      Quý khách vui lòng chuẩn bị số tiền <strong className="font-bold text-emerald-950">{activeOrderAmount.toLocaleString('vi-VN')}đ</strong> để thanh toán trực tiếp cho nhân viên giao hàng khi nhận hàng.
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
                  <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Cảm ơn quý khách đã tin tưởng & lựa chọn sản phẩm thủ công NOT A KNOT.</span>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* PRINT / INVOICE MODAL (OFFICIAL SLIP)                        */}
        {/* ============================================================ */}
        {isPrintModalOpen && activeOrder && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn cursor-pointer"
            onClick={() => setIsPrintModalOpen(false)}
          >
            <div
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Modal Top Bar */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between no-print bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-black text-slate-900">
                    Phiếu Giao Nhận & Hóa Đơn Đơn Hàng
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 hover:text-slate-900 transition-all cursor-pointer border border-slate-200 shadow-2xs"
                  title="Đóng (hoặc nhấn ra ngoài để thoát)"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
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
                      Tiệm Đan Vòng Thủ Công & Phụ Kiện Handmade
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
                                  {it.selectedComboItems && it.selectedComboItems.length > 0 ? (
                                    <div className="text-[11px] text-slate-700 bg-amber-50/70 p-1.5 rounded border border-amber-200/60 mt-1 space-y-1">
                                      <span className="font-bold text-amber-950 block">Combo {it.selectedComboItems.length} món:</span>
                                      {it.selectedComboItems.map((ci, cIdx) => (
                                        <div key={cIdx} className="pl-1.5 border-l-2 border-amber-300">
                                          <span className="font-bold">{cIdx + 1}. {ci.itemTitle || `Món ${cIdx + 1}`}:</span>{' '}
                                          {[
                                            ci.selectedColor ? `Màu: ${ci.selectedColor}` : '',
                                            ci.selectedCharms && ci.selectedCharms.length > 0 ? `Charm: ${ci.selectedCharms.map(c => c.name).join(', ')}` : '',
                                            ci.selectedOmamoris && ci.selectedOmamoris.length > 0 ? `Bùa: ${ci.selectedOmamoris.map(o => o.name).join(', ')}` : '',
                                            ci.selectedKhoen ? `Khoen: ${ci.selectedKhoen}` : '',
                                            ci.selectedSize ? `Size: ${ci.selectedSize}` : ''
                                          ].filter(Boolean).join(' | ')}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-1.5 mt-0.5">
                                      {it.selectedSize && <span>Size: {it.selectedSize}</span>}
                                      {it.selectedColor && <span>• Màu: {it.selectedColor}</span>}
                                      {it.selectedCharm && <span>• Charm: {it.selectedCharm}</span>}
                                      {it.selectedOmamoris && it.selectedOmamoris.length > 0 && <span>• Bùa: {it.selectedOmamoris.map(o => o.name).join(', ')}</span>}
                                      {it.selectedKhoen && <span>• Khoen: {it.selectedKhoen}</span>}
                                    </div>
                                  )}
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
                    <span>Hình thức:</span>
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
                  Cảm ơn bạn đã lựa chọn Not A Knot! Chúc quý khách một ngày tốt lành.
                </div>
              </div>

              {/* Modal Bottom Actions - ONLY 3 CLEAN BUTTONS */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
                <span className="text-xs text-slate-500 font-medium truncate max-w-xs">
                  {printSuccessToast || 'Phiếu đơn hàng chính thức'}
                </span>

                <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
                  {/* 1. Nút Tải file text */}
                  <button
                    type="button"
                    onClick={() => handleDownloadInvoice(activeOrder)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs whitespace-nowrap"
                    title="Tải file văn bản chi tiết phiếu đơn hàng (.txt)"
                  >
                    <Download className="w-4 h-4 text-slate-600" />
                    <span>Tải .txt</span>
                  </button>

                  {/* 2. Nút In (Tự động mở tab in chuẩn) */}
                  <button
                    type="button"
                    onClick={() => handleOpenPrintTab(activeOrder)}
                    className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs whitespace-nowrap"
                    title="In phiếu giao nhận & hóa đơn"
                  >
                    <Printer className="w-4 h-4 text-slate-950" />
                    <span>In Phiếu</span>
                  </button>

                  {/* 3. Nút Email */}
                  <button
                    type="button"
                    onClick={() => activeOrder && handleSendEmail(activeOrder)}
                    disabled={isSendingEmail}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 whitespace-nowrap"
                    title="Gửi email xác nhận thông tin đơn hàng"
                  >
                    {isSendingEmail ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Đang gửi...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 text-amber-400" />
                        <span>Gửi Email</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* EMAIL SENDER MODAL */}
        {emailModalOrder && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn cursor-pointer"
            onClick={() => !isSendingEmail && setEmailModalOrder(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 cursor-default animate-scaleUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-black text-slate-900">
                    Nhận Email Xác Nhận Đơn Hàng
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !isSendingEmail && setEmailModalOrder(null)}
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer border border-slate-200"
                  title="Đóng"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Nhập địa chỉ email để hệ thống gửi hóa đơn và chi tiết đơn hàng <strong>#{emailModalOrder.trackingNumber || emailModalOrder.id}</strong> tới hộp thư của bạn.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">Địa chỉ Email nhận tin:</label>
                <input
                  type="email"
                  value={emailModalInput}
                  onChange={(e) => setEmailModalInput(e.target.value)}
                  disabled={isSendingEmail}
                  placeholder="ví dụ: tenban@gmail.com"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none disabled:opacity-60"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleExecuteSendEmail();
                  }}
                />
              </div>

              {emailModalMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold ${
                    emailModalMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {emailModalMessage.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={() => setEmailModalOrder(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={handleExecuteSendEmail}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isSendingEmail ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 text-amber-400" />
                      <span>Gửi Email Ngay</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
