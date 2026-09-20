import nodemailer from 'nodemailer';

function ensureGmailDomain(input: any): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (!trimmed.includes('@')) return `${trimmed}@gmail.com`;
  if (trimmed.endsWith('@')) return `${trimmed}gmail.com`;
  return trimmed;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown): string {
  return `${numberValue(value).toLocaleString('vi-VN')}đ`;
}

function safeBaseUrl(value?: string): string {
  const OFFICIAL_SITE = 'https://www.notaknot.id.vn';
  if (!value) return OFFICIAL_SITE;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== 'https:' || url.username || url.password ||
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        url.hostname.includes('run.app') || url.hostname.includes('ai.studio') || url.hostname.includes('google')) {
      return OFFICIAL_SITE;
    }
    return url.origin;
  } catch {
    return OFFICIAL_SITE;
  }
}

function normalizeText(txt: string): string {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function findMatchedProduct(item: any, productsList: any[]): any {
  if (!item || !Array.isArray(productsList) || productsList.length === 0) return null;
  const productId = String(item.productId || item.id || '').trim();
  const rawName = String(item.productName || item.name || '').trim();
  const normName = normalizeText(rawName);

  if (productId) {
    const byId = productsList.find((p: any) => p && String(p.id).trim() === productId);
    if (byId) return byId;
  }
  if (rawName) {
    const byName = productsList.find((p: any) => p && p.name && String(p.name).trim().toLowerCase() === rawName.toLowerCase());
    if (byName) return byName;
  }
  if (normName) {
    const byNorm = productsList.find((p: any) => p && p.name && normalizeText(p.name) === normName);
    if (byNorm) return byNorm;
  }
  return null;
}

function resolveProductCandidate(item: any, matchedProduct: any): string | null {
  if (typeof item?.selectedColorImage === 'string' && item.selectedColorImage.trim() && !item.selectedColorImage.startsWith('data:image/')) {
    return item.selectedColorImage.trim();
  }
  if (item?.selectedColor && matchedProduct?.colorOptions && Array.isArray(matchedProduct.colorOptions)) {
    const normColor = normalizeText(item.selectedColor);
    const colorOpt = matchedProduct.colorOptions.find((c: any) => {
      if (!c || !c.name) return false;
      const cNorm = normalizeText(c.name);
      return cNorm === normColor || cNorm.includes(normColor) || normColor.includes(cNorm);
    });
    const colorImg = colorOpt?.image || colorOpt?.img;
    if (typeof colorImg === 'string' && colorImg.trim() && !colorImg.startsWith('data:image/')) {
      return colorImg.trim();
    }
  }
  const itemImg = (typeof item?.imageUrl === 'string' && item.imageUrl.trim()) ||
                  (typeof item?.image === 'string' && item.image.trim()) ||
                  (typeof item?.productImage === 'string' && item.productImage.trim()) || null;
  if (itemImg && !itemImg.startsWith('data:image/')) {
    return itemImg;
  }
  const prodImg = (typeof matchedProduct?.image === 'string' && matchedProduct.image.trim()) ||
                  (typeof matchedProduct?.img === 'string' && matchedProduct.img.trim()) ||
                  (Array.isArray(matchedProduct?.images) && typeof matchedProduct.images[0] === 'string' && matchedProduct.images[0].trim()) || null;
  if (prodImg && !prodImg.startsWith('data:image/')) {
    return prodImg;
  }
  return null;
}

function getLocalFallbackAsset(name: string): string | null {
  const norm = normalizeText(name);
  if (norm.includes('bo doi') || norm.includes('chu bo doi')) return '/assets/keychain-bodoi.jpg';
  if (norm.includes('mu coi')) return '/assets/keychain-mucoi.jpg';
  if (norm.includes('0209') || norm.includes('02/09') || norm.includes('paracord') || norm.includes('co do')) return '/assets/0209/img_3.jpg';
  if (norm.includes('butterfly') || norm.includes('buom')) return '/assets/img_4.jpg';
  if (norm.includes('lucky') || norm.includes('luu ly') || norm.includes('knot')) return '/assets/img_1.jpg';
  return '/assets/img_1.jpg';
}

function buildHtml(order: any, reqHost: string, productsCatalog: any[] = []): string {
  const baseUrl = safeBaseUrl(reqHost);
  const BRAND = {
    burgundy: '#681820',
    burgundyDark: '#531219',
    ink: '#241a18',
    muted: '#776762',
    canvas: '#f5f1e9',
    cream: '#f6f0e7',
    soft: '#fcfaf7',
    creamStrong: '#f1e7d8',
    border: '#e8dccb',
    green: '#2f7d48'
  };
  const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

  const orderCode = String(order?.id || order?.trackingNumber || 'NAK-ORDER');
  const customerName = String(order?.customerName || order?.name || 'Quý khách');
  const phone = String(order?.phone || 'Chưa cung cấp');
  const address = String(order?.address || 'Nhận tại xưởng NOT A KNOT');
  const note = String(order?.note || '').trim();
  const date = String(order?.date || new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const estimatedDelivery = String(order?.estimatedDelivery || '2–3 ngày làm việc');

  const paymentMethod =
    order?.paymentMethod === 'bank_transfer' || order?.paymentMethod === 'vietqr'
      ? 'Chuyển khoản VietQR'
      : order?.paymentMethod === 'cash'
      ? 'Tiền mặt'
      : 'COD (Khi nhận hàng)';

  const items = Array.isArray(order?.itemDetails) && order.itemDetails.length > 0
    ? order.itemDetails
    : Array.isArray(order?.items)
    ? order.items.map((item: any) =>
        typeof item === 'string' ? { productName: item, quantity: 1, price: 0 } : item
      )
    : [];

  const totalAmount = numberValue(order?.totalPrice ?? order?.totalAmount);
  const shippingFee = numberValue(order?.shippingFee);
  const discountAmount = numberValue(order?.discountAmount ?? order?.voucherDiscountAmount);
  const computedItemsSubtotal = items.reduce(
    (sum: number, item: any) => sum + numberValue(item?.price ?? item?.unitPrice) * Math.max(1, numberValue(item?.quantity)),
    0
  );
  const subtotal = computedItemsSubtotal || Math.max(0, totalAmount - shippingFee + discountAmount);

  const logoSrc = `${baseUrl}/assets/logo.jpg`;
  const facebookSrc = `${baseUrl}/assets/icons/facebook.png`;
  const instagramSrc = `${baseUrl}/assets/icons/instagram.png`;
  const threadsSrc = `${baseUrl}/assets/email/threads.png`;
  const messengerSrc = `${baseUrl}/assets/email/messenger.png`;
  const trackingUrl = `${baseUrl}/#tracking?code=${encodeURIComponent(orderCode)}`;

  const renderedRows = items.map((item: any) => {
    const productName = String(item?.productName || item?.name || 'Sản phẩm thủ công');
    const quantity = Math.max(1, numberValue(item?.quantity));
    const unitPrice = numberValue(item?.price ?? item?.unitPrice);
    const rowTotal = unitPrice * quantity;

    const matchedProduct = findMatchedProduct(item, productsCatalog);
    let candidate = resolveProductCandidate(item, matchedProduct);
    if (!candidate) {
      candidate = getLocalFallbackAsset(productName);
    }
    const resolvedImgSrc = candidate && candidate.startsWith('http')
      ? candidate
      : candidate && candidate.startsWith('/')
      ? `${baseUrl}${candidate}`
      : `${baseUrl}/assets/img_1.jpg`;

    const variants: string[] = [];
    if (item?.selectedColor) variants.push(String(item.selectedColor));
    if (Array.isArray(item?.selectedCharms) && item.selectedCharms.length) {
      variants.push(`Charm ${item.selectedCharms.map((charm: any) => charm?.name || charm).join(', ')}`);
    } else if (item?.selectedCharm) {
      variants.push(`Charm ${item.selectedCharm?.name || item.selectedCharm}`);
    }
    if (Array.isArray(item?.selectedOmamoris) && item.selectedOmamoris.length) {
      variants.push(`Bùa ${item.selectedOmamoris.map((omamori: any) => omamori?.name || omamori).join(', ')}`);
    } else if (item?.selectedOmamori) {
      variants.push(`Bùa ${item.selectedOmamori?.name || item.selectedOmamori}`);
    }
    if (item?.selectedKhoen) variants.push(`Khoen ${item.selectedKhoen}`);
    if (item?.selectedSize) variants.push(`Size ${item.selectedSize}`);

    const variantLine = variants.length ? variants.join(' • ') : 'Phiên bản tiêu chuẩn';

    return `
      <tr>
        <td width="66" valign="top" style="width:66px;padding:14px 0;border-bottom:1px solid ${BRAND.border};">
          <img src="${escapeHtml(resolvedImgSrc)}" width="54" height="54" alt="${escapeHtml(productName)}" style="display:block;width:54px;height:54px;border:1px solid ${BRAND.border};border-radius:10px;object-fit:cover;background:${BRAND.creamStrong};" />
        </td>
        <td valign="top" style="padding:14px 10px;border-bottom:1px solid ${BRAND.border};">
          <div style="font-size:16px;line-height:24px;font-weight:700;color:${BRAND.ink};">${escapeHtml(productName)}</div>
          <div style="padding-top:2px;font-size:13px;line-height:20px;color:${BRAND.muted};">${escapeHtml(variantLine)}</div>
          <div style="padding-top:4px;font-size:13px;line-height:19px;color:${BRAND.muted};">Số lượng: <strong style="color:${BRAND.ink};">${quantity}</strong></div>
        </td>
        <td width="105" align="right" valign="top" style="width:105px;padding:14px 0;border-bottom:1px solid ${BRAND.border};font-size:15px;line-height:23px;font-weight:700;color:${BRAND.burgundy};white-space:nowrap;">
          ${money(rowTotal)}
        </td>
      </tr>
    `;
  }).join('');

  const discountRow = discountAmount > 0
    ? `<tr><td style="padding:2px 0;color:${BRAND.muted};">Giảm giá voucher:</td><td align="right" style="padding:2px 0;font-weight:700;color:${BRAND.green};">-${money(discountAmount)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Xác nhận đơn hàng #${escapeHtml(orderCode)} - NOT A KNOT</title>
</head>
<body style="margin:0;padding:24px 12px;background:${BRAND.canvas};font-family:${BODY_FONT};color:${BRAND.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;box-shadow:0 8px 32px rgba(104,24,32,0.06);">
          <tr>
            <td style="padding:32px 28px 24px;background:linear-gradient(180deg, ${BRAND.cream} 0%, #ffffff 100%);border-bottom:1px solid ${BRAND.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <img src="${logoSrc}" width="48" height="48" alt="NOT A KNOT" style="display:block;border-radius:10px;object-fit:cover;background:${BRAND.creamStrong};" />
                    <div style="padding-top:10px;font-size:20px;font-weight:800;letter-spacing:1px;color:${BRAND.burgundy};">NOT A KNOT</div>
                    <div style="font-size:12px;color:${BRAND.muted};font-style:italic;">Handmade Studio • Chế tác thủ công</div>
                  </td>
                  <td align="right" valign="top">
                    <span style="display:inline-block;padding:6px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;font-size:12px;font-weight:700;color:${BRAND.green};">
                      ✓ Đã xác nhận đơn
                    </span>
                    <div style="padding-top:6px;font-size:11px;color:${BRAND.muted};">Mã: <strong>#${escapeHtml(orderCode)}</strong></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 28px 20px;">
              <div style="font-size:18px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">
                Cảm ơn bạn, ${escapeHtml(customerName)}!
              </div>
              <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:${BRAND.muted};">
                Đơn hàng thủ công của bạn đã được ghi nhận vào hệ thống NOT A KNOT. Chúng mình đang chuẩn bị nguyên liệu và tỉ mỉ hoàn thiện từng chi tiết cho bạn.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.soft};border:1px solid ${BRAND.border};border-radius:12px;padding:16px;margin-bottom:24px;">
                <tr>
                  <td style="font-size:13px;line-height:20px;color:${BRAND.muted};padding-bottom:6px;">
                    <strong>Người nhận:</strong> ${escapeHtml(customerName)} (${escapeHtml(phone)})<br />
                    <strong>Địa chỉ giao:</strong> ${escapeHtml(address)}<br />
                    <strong>Thanh toán:</strong> ${escapeHtml(paymentMethod)}<br />
                    <strong>Thời gian đặt:</strong> ${escapeHtml(date)}
                    ${note ? `<br /><strong>Ghi chú:</strong> <em style="color:${BRAND.ink};">${escapeHtml(note)}</em>` : ''}
                  </td>
                </tr>
              </table>

              <div style="font-size:15px;font-weight:700;color:${BRAND.ink};padding-bottom:8px;border-bottom:2px solid ${BRAND.burgundy};">
                Chi tiết sản phẩm
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                ${renderedRows}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BRAND.border};padding-top:14px;font-size:14px;line-height:22px;">
                <tr>
                  <td style="color:${BRAND.muted};padding:3px 0;">Tạm tính sản phẩm:</td>
                  <td align="right" style="font-weight:600;padding:3px 0;">${money(subtotal)}</td>
                </tr>
                <tr>
                  <td style="color:${BRAND.muted};padding:3px 0;">Phí vận chuyển:</td>
                  <td align="right" style="font-weight:600;padding:3px 0;color:${shippingFee === 0 ? BRAND.green : BRAND.ink};">
                    ${shippingFee === 0 ? 'MIỄN PHÍ' : money(shippingFee)}
                  </td>
                </tr>
                ${discountRow}
                <tr>
                  <td style="padding-top:10px;font-size:16px;font-weight:800;color:${BRAND.ink};border-top:1px dashed ${BRAND.border};">Tổng thanh toán:</td>
                  <td align="right" style="padding-top:10px;font-size:18px;font-weight:800;color:${BRAND.burgundy};border-top:1px dashed ${BRAND.border};">${money(totalAmount)}</td>
                </tr>
              </table>

              <div style="text-align:center;padding:24px 0 10px;">
                <a href="${trackingUrl}" style="display:inline-block;padding:12px 28px;background:${BRAND.burgundy};color:#ffffff;text-decoration:none;border-radius:24px;font-size:14px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(104,24,32,0.25);">
                  Tra cứu tiến độ đơn hàng →
                </a>
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:24px 20px;background:${BRAND.soft};border-top:1px solid ${BRAND.border};">
              <div style="font-size:12px;line-height:18px;color:${BRAND.muted};margin-bottom:12px;">
                Cần hỗ trợ gấp? Hotline / Zalo: <strong style="color:${BRAND.burgundy};">079 655 5636</strong><br />
                Website: <a href="${baseUrl}" style="color:${BRAND.burgundy};font-weight:600;text-decoration:none;">www.notaknot.id.vn</a>
              </div>
              <div style="padding-bottom:12px;">
                <a href="https://www.facebook.com/profile.php?id=61593591390851" style="display:inline-block;margin:0 4px;"><img src="${facebookSrc}" width="24" height="24" alt="Facebook" /></a>
                <a href="https://www.instagram.com/notaknot.handmade" style="display:inline-block;margin:0 4px;"><img src="${instagramSrc}" width="24" height="24" alt="Instagram" /></a>
                <a href="https://m.me/61593591390851" style="display:inline-block;margin:0 4px;"><img src="${messengerSrc}" width="24" height="24" alt="Messenger" /></a>
                <a href="https://www.threads.com/@notaknot.handmade" style="display:inline-block;margin:0 4px;"><img src="${threadsSrc}" width="24" height="24" alt="Threads" /></a>
              </div>
              <div style="font-size:11px;color:#94a3b8;">
                © 2026 NOT A KNOT Studio. Dự án nghiên cứu thực hành môn QTTN Thương mại điện tử – NEU.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseErr) {
        console.warn('[Vercel Handler] Body JSON parse warning:', parseErr);
      }
    } else if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf-8'));
      } catch (parseErr) {
        console.warn('[Vercel Handler] Buffer body parse warning:', parseErr);
      }
    }

    const order = (body && typeof body === 'object' && (body.orderData || body.order)) || body;
    if (!order || typeof order !== 'object' || (!order.id && !order.trackingNumber)) {
      return res.status(400).json({ error: 'Dữ liệu đơn hàng không hợp lệ hoặc thiếu mã đơn.' });
    }

    const orderCode = String(order.id || order.trackingNumber);
    const rawExplicit = typeof body?.recipientEmail === 'string' && body.recipientEmail.trim()
      ? body.recipientEmail
      : typeof body?.targetEmail === 'string' && body.targetEmail.trim()
      ? body.targetEmail
      : typeof body?.email === 'string' && body.email.trim()
      ? body.email
      : null;

    const explicitRecipient = rawExplicit ? ensureGmailDomain(rawExplicit) : null;

    const customerEmail = explicitRecipient || (
      typeof order.email === 'string' && order.email.trim()
        ? ensureGmailDomain(order.email)
        : typeof order.customerEmail === 'string' && order.customerEmail.trim()
        ? ensureGmailDomain(order.customerEmail)
        : typeof order.recipientEmail === 'string' && order.recipientEmail.trim()
        ? ensureGmailDomain(order.recipientEmail)
        : null
    );

    if (!customerEmail) {
      return res.status(400).json({ error: 'Không tìm thấy địa chỉ email người nhận. Vui lòng kiểm tra lại thông tin email khách hàng.' });
    }

    const productsList = Array.isArray(body?.products) ? body.products : Array.isArray(order?.products) ? order.products : [];
    const reqHost = (req.headers && req.headers['x-forwarded-host'] as string) || (req.headers && req.headers.host) || 'www.notaknot.id.vn';

    const html = buildHtml(order, reqHost, productsList);
    const subject = `[NOT A KNOT] Xác nhận đơn hàng #${orderCode} - ${order.customerName || order.name || 'Quý khách'}`;

    const SMTP_USER = process.env.SMTP_USER || 'noreply.notaknot@gmail.com';
    const SMTP_PASS = process.env.SMTP_PASS || 'nioymdoezmrflsmr';

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"NOT A KNOT" <${SMTP_USER}>`,
      to: customerEmail,
      subject,
      html
    });

    return res.status(200).json({
      success: true,
      mode: 'sent_real_email',
      recipients: [customerEmail],
      orderCode,
      message: `Đã gửi thành công email xác nhận đơn hàng #${orderCode} tới ${customerEmail}!`
    });
  } catch (err: any) {
    console.error('[Vercel Email Handler Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Lỗi gửi email xác nhận.'
    });
  }
}
