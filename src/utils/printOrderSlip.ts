import { StoredOrder } from '../types';
import { formatOrderDateWithoutSeconds, normalizeOrderStatus, getCleanOrderNote, getCanonicalOrderKey } from './orderFormatters';

export const DEFAULT_BRAND_NAME = 'NOT A KNOT';
export const DEFAULT_HOTLINE = '0987 654 321';

/**
 * Generates an official, standalone, printable HTML order slip / invoice.
 * Designed to fit standard A4, A5, and thermal receipt paper cleanly.
 */
export const generateOrderSlipHtml = (
  order: StoredOrder,
  hotline: string = DEFAULT_HOTLINE,
  brandName: string = DEFAULT_BRAND_NAME
): string => {
  const code = getCanonicalOrderKey(order) || order.trackingNumber || order.id || 'NAK-ORDER';
  const dateStr = formatOrderDateWithoutSeconds(order.date || order.createdAt);
  const statusStr = normalizeOrderStatus(order.status);
  const customer = order.customerName || order.name || 'Khách hàng';
  const phone = order.phone || 'Chưa cung cấp SĐT';
  const address = order.address || 'Nhận trực tiếp tại xưởng / Thống nhất qua tin nhắn';
  const cleanNote = getCleanOrderNote(order.note);
  const craftingNote = order.craftingStageNote ? order.craftingStageNote.trim() : '';
  const items = order.itemDetails && order.itemDetails.length > 0 ? order.itemDetails : [];
  const itemsSubtotal = items.reduce((sum, it) => sum + Number(it.price || (it as any).unitPrice || 0) * Number(it.quantity || 1), 0);
  const total = Number(order.totalPrice || order.totalAmount || 0);
  const discount = Number(order.discountAmount || 0);
  const shippingFee = order.shippingFee !== undefined && order.shippingFee !== null
    ? Number(order.shippingFee)
    : (items.length > 0 && total > itemsSubtotal ? Math.max(0, total - itemsSubtotal + discount) : 0);
  const carrier = order.shippingCarrier
    ? `${order.shippingCarrier}${order.shippingCode ? ` (${order.shippingCode})` : ''}`
    : (order.shippingCode ? `Mã vận đơn: ${order.shippingCode}` : '');
  const seller = order.sellerName ? order.sellerName : '';

  const pMethod =
    order.paymentMethod === 'bank_transfer'
      ? 'Chuyển khoản VietQR'
      : order.paymentMethod === 'cash'
      ? 'Tiền mặt tại xưởng'
      : 'Thu tiền khi nhận hàng (COD)';
  const pStatus = order.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : 'Chờ thanh toán / Thu COD';

  const rowsHtml =
    items.length > 0
      ? items
          .map((it) => {
            const p = Number(it.price || (it as any).unitPrice || 0);
            const q = Number(it.quantity || 1);
            const sub = p * q;
            const details = [
              it.selectedSize ? `Size: ${it.selectedSize}` : '',
              it.selectedColor ? `Màu: ${it.selectedColor}` : '',
              it.selectedCharm ? `Charm: ${typeof it.selectedCharm === 'object' ? (it.selectedCharm as any).name : it.selectedCharm}${it.selectedCharmPrice ? ` (+${it.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''}` : '',
              it.selectedKhoen ? `Khoen: ${it.selectedKhoen}${it.selectedKhoenPrice ? ` (+${it.selectedKhoenPrice.toLocaleString('vi-VN')}đ)` : ''}` : '',
              it.selectedOmamoris && it.selectedOmamoris.length > 0 ? `Bùa: ${it.selectedOmamoris.map((o) => o.name).join(', ')}${it.selectedOmamoriPrice ? ` (+${it.selectedOmamoriPrice.toLocaleString('vi-VN')}đ)` : ''}` : ''
            ]
              .filter(Boolean)
              .join(' | ');
            const customNote = it.customNote
              ? `<div style="font-size:11px;color:#b45309;font-style:italic;margin-top:2px;">* Ghi chú: ${it.customNote}</div>`
              : '';

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
          })
          .join('')
      : `
      <tr>
        <td colspan="4" style="padding:12px;border-bottom:1px solid #e2e8f0;color:#0f172a;">
          ${Array.isArray(order.items) ? order.items.join(', ') : order.items ? String(order.items) : 'Sản phẩm thủ công Paracord'}
        </td>
      </tr>
    `;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Phiếu Giao Nhận & Hóa Đơn - ${code}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #f8fafc;
    }
    .invoice-card {
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    }
    .print-actions {
      max-width: 760px;
      margin: 0 auto 16px auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      background: #0f172a;
      color: #ffffff;
      border-radius: 12px;
    }
    .print-btn {
      background: #f59e0b;
      color: #0f172a;
      border: none;
      padding: 8px 18px;
      font-weight: 900;
      font-size: 13px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover {
      background: #d97706;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #0f172a;
      text-transform: uppercase;
    }
    .subbrand {
      font-size: 12px;
      color: #334155;
      margin-top: 4px;
      font-weight: 700;
    }
    .code-box {
      text-align: right;
    }
    .code-title {
      font-size: 11px;
      font-weight: 900;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .code-val {
      font-size: 20px;
      font-weight: 900;
      font-family: monospace;
      color: #0f172a;
      margin-top: 4px;
    }
    .grid {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }
    .col {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
    }
    .col-title {
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    th {
      background: #f1f5f9;
      padding: 10px;
      font-size: 12px;
      font-weight: 900;
      text-align: left;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
    }
    .summary {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 8px;
      color: #1e293b;
      font-weight: 600;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      font-size: 16px;
      font-weight: 900;
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      margin-top: 8px;
      color: #0f172a;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #475569;
      font-style: italic;
      border-top: 1px dashed #cbd5e1;
      padding-top: 16px;
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff !important;
      }
      .print-actions {
        display: none !important;
      }
      .invoice-card {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <div>
      <strong>Phiếu đơn hàng: ${code}</strong>
      <span style="font-size:12px;opacity:0.85;margin-left:8px;">(Nhấn nút bên cạnh nếu hộp thoại in chưa hiện)</span>
    </div>
    <button class="print-btn" onclick="window.print()">
      🖨️ In Phiếu Ngay
    </button>
  </div>

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
        ${seller ? `<div style="font-size:11px;color:#b45309;font-weight:700;margin-top:6px;">Phụ trách: ${seller}</div>` : ''}
      </div>
      <div class="col">
        <div class="col-title">ĐỊA CHỈ GIAO HÀNG</div>
        <div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.4;">${address}</div>
        ${cleanNote ? `<div style="font-size:12px;color:#9a3412;margin-top:6px;font-weight:bold;font-style:italic;">* Ghi chú: ${cleanNote}</div>` : ''}
        ${craftingNote ? `<div style="font-size:12px;color:#475569;margin-top:4px;font-weight:600;">* Xưởng note: ${craftingNote}</div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Sản phẩm & Thông số chế tác</th>
          <th style="text-align:center;width:60px;">SL</th>
          <th style="text-align:right;width:110px;">Đơn giá</th>
          <th style="text-align:right;width:130px;">Thành tiền</th>
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
        <span>Tạm tính tiền hàng:</span>
        <strong style="color:#0f172a;">${itemsSubtotal.toLocaleString('vi-VN')}đ</strong>
      </div>
      <div class="summary-row">
        <span>Phí vận chuyển:</span>
        <strong style="color:${shippingFee > 0 ? '#0f172a' : '#15803d'};">${shippingFee > 0 ? `${shippingFee.toLocaleString('vi-VN')}đ` : 'Miễn phí (Freeship)'}</strong>
      </div>
      ${discount > 0 || order.voucherCode ? `
      <div class="summary-row">
        <span>Giảm giá / Voucher${order.voucherCode ? ` (${order.voucherCode})` : ''}:</span>
        <strong style="color:#15803d;">-${(order.voucherDiscountAmount || discount).toLocaleString('vi-VN')}đ</strong>
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
        try {
          window.print();
        } catch (e) {
          console.warn('Auto print trigger error:', e);
        }
      }, 500);
    });
  </script>
</body>
</html>`;
};

/**
 * Plain text representation of the order slip for clipboard copying and .txt download
 */
export const generateOrderSlipPlainText = (
  order: StoredOrder,
  hotline: string = DEFAULT_HOTLINE,
  brandName: string = DEFAULT_BRAND_NAME
): string => {
  const code = getCanonicalOrderKey(order) || order.trackingNumber || order.id || 'NAK-ORDER';
  const dateStr = formatOrderDateWithoutSeconds(order.date || order.createdAt);
  const statusStr = normalizeOrderStatus(order.status);
  const customer = order.customerName || order.name || 'Khách hàng';
  const phone = order.phone || 'Chưa cung cấp SĐT';
  const address = order.address || 'Nhận trực tiếp tại xưởng / Thống nhất qua tin nhắn';
  const cleanNote = getCleanOrderNote(order.note);
  const items = order.itemDetails && order.itemDetails.length > 0 ? order.itemDetails : [];
  const itemsSubtotal = items.reduce((sum, it) => sum + Number(it.price || (it as any).unitPrice || 0) * Number(it.quantity || 1), 0);
  const total = Number(order.totalPrice || order.totalAmount || 0);
  const discount = Number(order.discountAmount || 0);
  const shippingFee = order.shippingFee !== undefined && order.shippingFee !== null
    ? Number(order.shippingFee)
    : (items.length > 0 && total > itemsSubtotal ? Math.max(0, total - itemsSubtotal + discount) : 0);

  const itemsList =
    items.length > 0
      ? items
          .map((it, idx) => {
            const p = Number(it.price || (it as any).unitPrice || 0);
            const q = Number(it.quantity || 1);
            const details = [
              it.selectedSize ? `Size: ${it.selectedSize}` : '',
              it.selectedColor ? `Màu: ${it.selectedColor}` : '',
              it.selectedCharm ? `Charm: ${typeof it.selectedCharm === 'object' ? (it.selectedCharm as any).name : it.selectedCharm}${it.selectedCharmPrice ? ` (+${it.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''}` : '',
              it.selectedKhoen ? `Khoen: ${it.selectedKhoen}${it.selectedKhoenPrice ? ` (+${it.selectedKhoenPrice.toLocaleString('vi-VN')}đ)` : ''}` : '',
              it.selectedOmamoris && it.selectedOmamoris.length > 0 ? `Bùa: ${it.selectedOmamoris.map((o) => o.name).join(', ')}${it.selectedOmamoriPrice ? ` (+${it.selectedOmamoriPrice.toLocaleString('vi-VN')}đ)` : ''}` : ''
            ]
              .filter(Boolean)
              .join(', ');
            return `${idx + 1}. ${it.productName} (SL: ${q}) - ${p.toLocaleString('vi-VN')}đ${details ? `\n   [${details}]` : ''}${it.customNote ? `\n   * Ghi chú: ${it.customNote}` : ''}`;
          })
          .join('\n')
      : Array.isArray(order.items)
      ? order.items.join(', ')
      : order.items
      ? String(order.items)
      : 'Sản phẩm thủ công Paracord';

  return `========================================
${brandName} - PHIẾU GIAO NHẬN & ĐƠN HÀNG
========================================
Mã đơn: ${code}
Ngày đặt: ${dateStr}
Tiến trình: ${statusStr}

KHÁCH HÀNG:
Tên: ${customer}
SĐT: ${phone}
Địa chỉ: ${address}
${cleanNote ? `Ghi chú: ${cleanNote}\n` : ''}${order.sellerName ? `Phụ trách: ${order.sellerName}\n` : ''}
CHI TIẾT SẢN PHẨM:
${itemsList}

THANH TOÁN:
Tạm tính tiền hàng: ${itemsSubtotal.toLocaleString('vi-VN')}đ
Phí vận chuyển: ${shippingFee > 0 ? `${shippingFee.toLocaleString('vi-VN')}đ` : 'Miễn phí (0đ)'}
${discount > 0 || order.voucherCode ? `Giảm giá / Voucher${order.voucherCode ? ` (${order.voucherCode})` : ''}: -${(order.voucherDiscountAmount || discount).toLocaleString('vi-VN')}đ\n` : ''}TỔNG THANH TOÁN: ${total.toLocaleString('vi-VN')}đ
Hình thức: ${order.paymentMethod === 'bank_transfer' ? 'Chuyển khoản VietQR' : order.paymentMethod === 'cash' ? 'Tiền mặt tại xưởng' : 'Thu tiền khi nhận hàng (COD)'}
Trạng thái: ${order.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : 'Chờ thu COD'}

----------------------------------------
Hotline xưởng: ${hotline}
Cam kết bảo hành chốt khóa trọn đời!
========================================`;
};

/**
 * Print order slip directly via a hidden iframe
 * This bypasses iframe sandbox restrictions, popup blockers, and avoids opening unnecessary blank tabs.
 * It is 100% reliable across browsers and devices.
 */
export const printOrderSlipDirectly = (
  order: StoredOrder,
  hotline: string = DEFAULT_HOTLINE,
  brandName: string = DEFAULT_BRAND_NAME
): boolean => {
  try {
    const html = generateOrderSlipHtml(order, hotline, brandName);
    
    // Remove existing hidden print iframe if any
    const oldIframe = document.getElementById('nak-print-iframe');
    if (oldIframe && oldIframe.parentNode) {
      oldIframe.parentNode.removeChild(oldIframe);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'nak-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) {
      return false;
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Hidden iframe print error:', err);
      }
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 60000);
    }, 400);

    return true;
  } catch (err) {
    console.warn('printOrderSlipDirectly error:', err);
    return false;
  }
};

/**
 * Open order print slip in a dedicated new tab via Blob URL or document.write
 */
export const openOrderPrintTab = (
  order: StoredOrder,
  hotline: string = DEFAULT_HOTLINE,
  brandName: string = DEFAULT_BRAND_NAME
): boolean => {
  const html = generateOrderSlipHtml(order, hotline, brandName);

  // 1. Try clean window.open with document.write
  try {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      return true;
    }
  } catch (err) {
    console.warn('window.open with document.write error:', err);
  }

  // 2. Try blob URL
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      return true;
    }
  } catch (err) {
    console.warn('window.open blob error:', err);
  }

  // 3. Fallback: Print directly using hidden iframe so user request succeeds
  return printOrderSlipDirectly(order, hotline, brandName);
};

/**
 * Download printable HTML invoice file (can be opened and printed from any browser)
 */
export const downloadOrderSlipHtml = (
  order: StoredOrder,
  hotline: string = DEFAULT_HOTLINE,
  brandName: string = DEFAULT_BRAND_NAME
): void => {
  const html = generateOrderSlipHtml(order, hotline, brandName);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const code = getCanonicalOrderKey(order) || order.trackingNumber || order.id || 'order';
  const a = document.createElement('a');
  a.href = url;
  a.download = `phieu-don-hang-${code}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Download raw text receipt file (.txt)
 */
export const downloadOrderSlipTxt = (
  order: StoredOrder,
  hotline: string = DEFAULT_HOTLINE,
  brandName: string = DEFAULT_BRAND_NAME
): void => {
  const text = generateOrderSlipPlainText(order, hotline, brandName);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const code = getCanonicalOrderKey(order) || order.trackingNumber || order.id || 'order';
  const a = document.createElement('a');
  a.href = url;
  a.download = `phieu-giao-hang-${code}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Copy text representation of order slip to clipboard
 */
export const copyOrderSlipToClipboard = async (
  order: StoredOrder,
  hotline: string = DEFAULT_HOTLINE,
  brandName: string = DEFAULT_BRAND_NAME
): Promise<boolean> => {
  const text = generateOrderSlipPlainText(order, hotline, brandName);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn('Copy error:', err);
    return false;
  }
};
