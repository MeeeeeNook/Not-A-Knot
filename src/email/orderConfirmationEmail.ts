import fs from 'fs';
import path from 'path';

export interface OrderEmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer;
  contentType?: string;
  cid: string;
  contentDisposition: 'inline';
}

export interface OrderEmailResult {
  html: string;
  attachments: OrderEmailAttachment[];
}

interface OrderEmailOptions {
  baseUrl?: string;
  publicDir?: string;
  year?: number;
  products?: any[];
}

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
const DISPLAY_FONT = BODY_FONT;

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

  // 1. By ID
  if (productId) {
    const byId = productsList.find((p: any) => p && String(p.id).trim() === productId);
    if (byId) return byId;
  }

  // 2. By exact name
  if (rawName) {
    const byName = productsList.find((p: any) => p && p.name && String(p.name).trim().toLowerCase() === rawName.toLowerCase());
    if (byName) return byName;
  }

  // 3. By normalized name
  if (normName) {
    const byNorm = productsList.find((p: any) => p && p.name && normalizeText(p.name) === normName);
    if (byNorm) return byNorm;
  }

  // 4. By keyword / substring
  if (normName) {
    const bySub = productsList.find((p: any) => {
      if (!p || !p.name) return false;
      const pNorm = normalizeText(p.name);
      return pNorm.includes(normName) || normName.includes(pNorm);
    });
    if (bySub) return bySub;
  }

  return null;
}

function resolveProductCandidate(item: any, matchedProduct: any): string | null {
  // Priority 1: Variant image specified directly on item
  if (typeof item?.selectedColorImage === 'string' && item.selectedColorImage.trim() && !item.selectedColorImage.startsWith('data:image/')) {
    return item.selectedColorImage.trim();
  }

  // Priority 2: Variant image from matched product colorOptions
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

  // Priority 3: Product image on item
  const itemImg = (typeof item?.imageUrl === 'string' && item.imageUrl.trim()) ||
                  (typeof item?.image === 'string' && item.image.trim()) ||
                  (typeof item?.productImage === 'string' && item.productImage.trim()) || null;
  if (itemImg && !itemImg.startsWith('data:image/')) {
    return itemImg;
  }

  // Priority 4: Product image from matchedProduct
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
  if (norm.includes('vong') || norm.includes('khoa') || norm.includes('keychain')) return '/assets/keychain-bodoi.jpg';
  return null;
}

/**
 * Builds the customer-facing order email from plain order data.
 * Embeds images directly as inline attachments (CID) for instant display in all email clients.
 */
export async function buildOrderConfirmationEmail(order: any, options: OrderEmailOptions = {}): Promise<OrderEmailResult> {
  const baseUrl = safeBaseUrl(options.baseUrl);
  const publicDir = path.resolve(options.publicDir || path.join(process.cwd(), 'public'));
  const attachments: OrderEmailAttachment[] = [];
  const cidByPath = new Map<string, string>();

  const inlineAsset = (assetPath: string, label: string): string => {
    const relativePath = assetPath.replace(/^\/+/, '');
    const absolutePath = path.resolve(publicDir, relativePath);

    if (!/\.(?:png|jpe?g|gif|webp)$/i.test(relativePath)) return '';
    try {
      if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return '';

      const existingCid = cidByPath.get(absolutePath);
      if (existingCid) return `cid:${existingCid}`;

      const buffer = fs.readFileSync(absolutePath);
      const ext = path.extname(absolutePath).toLowerCase().replace('.', '');
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const cid = `nak-${label}-${attachments.length + 1}@notaknot.email`;
      cidByPath.set(absolutePath, cid);
      attachments.push({
        filename: path.basename(absolutePath),
        content: buffer,
        contentType,
        cid,
        contentDisposition: 'inline'
      });
      return `cid:${cid}`;
    } catch {
      return '';
    }
  };

  const embedRemoteOrLocal = async (sourceUrl: string, label: string): Promise<string> => {
    if (!sourceUrl) return '';

    // If local path:
    if (sourceUrl.startsWith('/')) {
      const inlined = inlineAsset(sourceUrl, label);
      if (inlined) return inlined;
      return `${baseUrl}${sourceUrl}`;
    }

    // If HTTP / HTTPS URL:
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        // Return direct CDN/HTTPS URL immediately without blocking or downloading
        return parsed.href;
      }
    } catch {
      // ignore
    }
    return '';
  };

  const emailImage = (rawValue: unknown, fallback: string, label: string): string => {
    const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (raw) {
      try {
        const url = new URL(raw, `${baseUrl}/`);
        if (url.protocol === 'https:' && !url.username && !url.password) {
          if (url.origin !== baseUrl) return url.href;
          const localImage = inlineAsset(decodeURIComponent(url.pathname), label);
          if (localImage) return localImage;
        }
      } catch {
        // Fallback
      }
    }
    return inlineAsset(fallback, label) || `${baseUrl}${fallback}`;
  };

  const orderCode = String(order?.id || order?.trackingNumber || 'NAK-ORDER');
  const customerName = String(order?.customerName || order?.name || 'Quý khách');
  const phone = String(order?.phone || 'Chưa cung cấp');
  const address = String(order?.address || 'Nhận tại xưởng NOT A KNOT');
  const note = String(order?.note || '').trim();
  const date = String(
    order?.date || new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  );
  const estimatedDelivery = String(order?.estimatedDelivery || '2–3 ngày làm việc');
  const status = String(order?.emailStatusLabel || 'Đang chuẩn bị hàng');

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
  const totalQuantity = items.reduce(
    (sum: number, item: any) => sum + Math.max(1, numberValue(item?.quantity)),
    0
  );

  const logoSrc = emailImage(null, '/assets/logo.jpg', 'logo');
  const facebookSrc = emailImage(null, '/assets/icons/facebook.png', 'facebook');
  const instagramSrc = emailImage(null, '/assets/icons/instagram.png', 'instagram');
  const threadsSrc = emailImage(null, '/assets/email/threads.png', 'threads');
  const messengerSrc = emailImage(null, '/assets/email/messenger.png', 'messenger');
  const trackingUrl = `${baseUrl}/#tracking?code=${encodeURIComponent(orderCode)}`;

  const productsCatalog = Array.isArray(options?.products) && options.products.length > 0
    ? options.products
    : (Array.isArray(order?.products) && order.products.length > 0 ? order.products : []);

  const renderedRows = await Promise.all(
    items.map(async (item: any, index: number) => {
      const productName = String(item?.productName || item?.name || 'Sản phẩm thủ công');
      const quantity = Math.max(1, numberValue(item?.quantity));
      const unitPrice = numberValue(item?.price ?? item?.unitPrice);
      const rowTotal = unitPrice * quantity;

      // 1. Match product in catalog
      const matchedProduct = findMatchedProduct(item, productsCatalog);

      // 2. Resolve candidate URL or path (prioritizing variant color)
      let candidate = resolveProductCandidate(item, matchedProduct);

      // 3. Fallback to local bundled asset matching product name
      if (!candidate) {
        candidate = getLocalFallbackAsset(productName);
      }

      // 4. Embed image directly as CID attachment
      let embeddedSrc = '';
      if (candidate) {
        embeddedSrc = await embedRemoteOrLocal(candidate, `item-${index + 1}`);
      }

      const imageCellHtml = embeddedSrc
        ? `<img src="${escapeHtml(embeddedSrc)}" width="54" height="54" alt="${escapeHtml(productName)}" style="display:block;width:54px;height:54px;border:1px solid ${BRAND.border};border-radius:10px;object-fit:cover;background:${BRAND.creamStrong};" />`
        : `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="54" height="54" style="width:54px;height:54px;border:1px solid ${BRAND.border};border-radius:10px;background:${BRAND.creamStrong};table-layout:fixed;">
            <tr>
              <td align="center" valign="middle" style="font-family:${BODY_FONT};font-size:10px;line-height:13px;color:${BRAND.muted};font-weight:500;text-align:center;padding:2px;">
                Chưa có ảnh
              </td>
            </tr>
          </table>`;

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
      const customNote = item?.customNote
        ? `<div style="padding-top:4px;font-size:14px;line-height:21px;color:${BRAND.muted};">• ${escapeHtml(item.customNote)}</div>`
        : '';

      return `
        <tr>
          <td width="66" valign="top" style="width:66px;padding:14px 0;border-bottom:1px solid ${BRAND.border};">
            ${imageCellHtml}
          </td>
          <td valign="top" style="padding:14px 10px;border-bottom:1px solid ${BRAND.border};">
            <div style="font-size:16px;line-height:24px;font-weight:400;color:${BRAND.ink};">${escapeHtml(productName)}</div>
            <div style="padding-top:3px;font-size:14px;line-height:21px;color:${BRAND.muted};">Phân loại: <span style="color:${BRAND.burgundy};">${escapeHtml(variantLine)}</span></div>
            ${customNote}
          </td>
          <td width="95" valign="top" align="right" style="width:95px;padding:14px 0;border-bottom:1px solid ${BRAND.border};white-space:nowrap;">
            <div style="font-size:13px;line-height:19px;color:${BRAND.muted};">SL: ${quantity}</div>
            <div style="padding-top:2px;font-size:16px;line-height:23px;font-weight:700;color:${BRAND.burgundy};">${money(rowTotal)}</div>
          </td>
        </tr>`;
    })
  );

  const itemRows = renderedRows.join('');

  const noteBlock = note
    ? `<tr>
        <td colspan="2" style="padding:12px 14px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:8px;font-family:${BODY_FONT};font-size:14px;line-height:22px;color:${BRAND.muted};">
          <strong style="color:${BRAND.burgundy};">Ghi chú đơn hàng:</strong> “${escapeHtml(note)}”
        </td>
      </tr>`
    : '';

  const discountRow = discountAmount > 0
    ? `<tr>
        <td style="padding:2px 0;color:${BRAND.muted};">Giảm giá:</td>
        <td align="right" style="padding:2px 0;color:${BRAND.green};font-weight:700;">-${money(discountAmount)}</td>
      </tr>`
    : '';

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>Xác nhận đơn hàng #${escapeHtml(orderCode)}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    table { border-collapse:collapse !important; }
    body { width:100% !important; min-width:100% !important; height:100% !important; margin:0 !important; padding:0 !important; background:${BRAND.canvas}; }
    @media only screen and (max-width:620px) {
      .shell-pad { padding:0 !important; }
      .email-card { border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
      .hero { padding:24px 18px !important; }
      .hero-logo { width:66px !important; }
      .hero-copy { padding-left:14px !important; }
      .hero-title { font-size:24px !important; line-height:30px !important; }
      .content { padding-left:18px !important; padding-right:18px !important; }
      .stack { display:block !important; width:100% !important; box-sizing:border-box !important; }
      .stack-gap { padding-left:18px !important; padding-top:16px !important; border-left:0 !important; }
      .cta { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; margin-top:12px !important; }
      .mobile-left { text-align:left !important; }
      .totals { width:100% !important; }
      .trust-copy { font-size:13px !important; line-height:19px !important; }
    }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Đơn hàng #${escapeHtml(orderCode)} đang được chuẩn bị.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${BRAND.canvas};">
    <tr>
      <td class="shell-pad" align="center" style="padding:22px 12px;">
        <table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:720px;margin:0 auto;background:#ffffff;border:1px solid ${BRAND.border};border-radius:15px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:10px 20px;background:${BRAND.burgundy};font-family:${BODY_FONT};font-size:14px;line-height:20px;font-weight:700;color:#ffffff;">
              Cảm ơn bạn đã đồng hành cùng Not A Knot
            </td>
          </tr>

          <tr>
            <td class="hero" style="padding:25px 28px 20px;background:${BRAND.cream};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="hero-logo" width="84" valign="middle" style="width:84px;">
                    <img src="${logoSrc}" width="70" height="70" alt="Not A Knot" style="display:block;width:70px;height:70px;border-radius:10px;object-fit:cover;background:${BRAND.creamStrong};" />
                  </td>
                  <td class="hero-copy" valign="middle" style="padding-left:18px;">
                    <h1 class="hero-title" style="margin:0;font-family:${DISPLAY_FONT};font-size:28px;line-height:35px;font-weight:700;color:${BRAND.burgundy};">Đơn hàng của bạn đang được xử lý!</h1>
                    <p style="margin:5px 0 0;font-family:${BODY_FONT};font-size:15px;line-height:23px;color:${BRAND.muted};">Chúng tôi đã nhận được đơn hàng và đang chuẩn bị các sản phẩm thủ công tinh tế dành riêng cho bạn.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="content" style="padding:0 28px 22px;background:${BRAND.cream};border-bottom:1px solid ${BRAND.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BRAND.border};">
                <tr>
                  <td class="stack mobile-left" valign="middle" style="padding-top:17px;font-family:${BODY_FONT};">
                    <span style="font-size:14px;line-height:20px;color:${BRAND.muted};">Mã đơn hàng:&nbsp;</span>
                    <span style="font-family:${BODY_FONT};font-size:24px;line-height:30px;font-weight:700;color:${BRAND.burgundy};">#${escapeHtml(orderCode)}</span>
                  </td>
                  <td class="stack" align="right" valign="middle" style="padding-top:17px;">
                    <a class="cta" href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:11px 20px;background:${BRAND.burgundy};border-radius:7px;font-family:${BODY_FONT};font-size:14px;line-height:19px;font-weight:700;color:#ffffff;text-decoration:none;">TRA CỨU ĐƠN HÀNG</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="content" style="padding:24px 28px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.soft};border:1px solid ${BRAND.border};border-radius:12px;">
                <tr>
                  <td class="stack" width="50%" valign="top" style="width:50%;padding:18px;font-family:${BODY_FONT};">
                    <div style="padding-bottom:8px;font-size:13px;line-height:19px;letter-spacing:.3px;color:${BRAND.muted};">THÔNG TIN ĐƠN HÀNG</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${BODY_FONT};font-size:14px;line-height:23px;color:${BRAND.ink};">
                      <tr><td width="100" style="color:${BRAND.muted};">Ngày đặt:</td><td><strong>${escapeHtml(date)}</strong></td></tr>
                      <tr><td style="color:${BRAND.muted};">Dự kiến nhận:</td><td><strong>${escapeHtml(estimatedDelivery)}</strong></td></tr>
                      <tr><td style="color:${BRAND.muted};">Trạng thái:</td><td><span style="display:inline-block;padding:2px 7px;background:${BRAND.creamStrong};border-radius:4px;color:${BRAND.burgundy};font-size:13px;font-weight:700;">${escapeHtml(status)}</span></td></tr>
                    </table>
                  </td>
                  <td class="stack stack-gap" width="50%" valign="top" style="width:50%;padding:18px;font-family:${BODY_FONT};">
                    <div style="padding-bottom:8px;font-size:13px;line-height:19px;letter-spacing:.3px;color:${BRAND.muted};">ĐỊA CHỈ GIAO HÀNG</div>
                    <div style="font-size:15px;line-height:23px;font-weight:700;color:${BRAND.ink};">${escapeHtml(customerName)}</div>
                    <div style="padding-top:3px;font-size:15px;line-height:23px;color:${BRAND.muted};">SĐT: ${escapeHtml(phone)}</div>
                    <div style="padding-top:3px;font-size:14px;line-height:22px;color:${BRAND.muted};">${escapeHtml(address)}</div>
                  </td>
                </tr>
                ${noteBlock}
              </table>
            </td>
          </tr>

          <tr>
            <td class="content" style="padding:0 28px 24px;font-family:${BODY_FONT};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid ${BRAND.border};"><tr>
                <td style="padding:0 0 12px;font-family:${BODY_FONT};font-size:17px;line-height:25px;font-weight:700;color:${BRAND.ink};">Chi tiết đơn hàng</td>
              </tr></table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-family:${BODY_FONT};">
                ${itemRows || `<tr><td style="padding:18px 0;color:${BRAND.muted};font-size:15px;">Chi tiết sản phẩm sẽ được cập nhật trên trang tra cứu đơn hàng.</td></tr>`}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="right" style="padding-top:14px;">
              <table class="totals" role="presentation" width="52%" cellpadding="0" cellspacing="0" border="0" style="width:52%;font-family:${BODY_FONT};font-size:14px;line-height:23px;color:${BRAND.ink};">
                <tr><td style="padding:2px 0;color:${BRAND.muted};">Tạm tính (${totalQuantity} món):</td><td align="right" style="padding:2px 0;font-weight:700;">${money(subtotal)}</td></tr>
                <tr><td style="padding:2px 0;color:${BRAND.muted};">Phí vận chuyển:</td><td align="right" style="padding:2px 0;font-weight:700;color:${shippingFee === 0 ? BRAND.green : BRAND.ink};">${shippingFee === 0 ? 'MIỄN PHÍ' : money(shippingFee)}</td></tr>
                ${discountRow}
                <tr><td style="padding:2px 0;color:${BRAND.muted};">Phương thức thanh toán:</td><td align="right" style="padding:2px 0;font-weight:700;">${escapeHtml(paymentMethod)}</td></tr>
                <tr><td style="padding:11px 0 0;border-top:1px solid ${BRAND.border};font-size:17px;font-weight:700;">Tổng cộng:</td><td align="right" style="padding:11px 0 0;border-top:1px solid ${BRAND.border};font-family:${BODY_FONT};font-size:20px;font-weight:700;color:${BRAND.burgundy};">${money(totalAmount)}</td></tr>
              </table>
              </td></tr></table>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 20px;background:${BRAND.soft};border-top:1px solid ${BRAND.border};border-bottom:1px solid ${BRAND.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${BODY_FONT};">
                <tr>
                  <td width="33.33%" align="center" valign="top" style="width:33.33%;padding:0 7px;">
                    <div style="width:32px;height:32px;margin:0 auto 5px;border-radius:50%;background:${BRAND.cream};font-size:20px;line-height:32px;color:${BRAND.burgundy};">◷</div>
                    <div class="trust-copy" style="padding-top:4px;font-size:14px;line-height:21px;font-weight:700;color:${BRAND.ink};">Hỗ trợ tận tâm</div>
                    <div class="trust-copy" style="font-size:12px;line-height:18px;color:${BRAND.muted};">08:00–21:00 hằng ngày</div>
                  </td>
                  <td width="33.33%" align="center" valign="top" style="width:33.33%;padding:0 7px;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};">
                    <div style="width:32px;height:32px;margin:0 auto 5px;border-radius:50%;background:${BRAND.cream};font-size:20px;line-height:32px;color:${BRAND.burgundy};">✓</div>
                    <div class="trust-copy" style="padding-top:4px;font-size:14px;line-height:21px;font-weight:700;color:${BRAND.ink};">Thủ công tinh xảo</div>
                    <div class="trust-copy" style="font-size:12px;line-height:18px;color:${BRAND.muted};">Tỉ mỉ từng mối thắt</div>
                  </td>
                  <td width="33.33%" align="center" valign="top" style="width:33.33%;padding:0 7px;">
                    <div style="width:32px;height:32px;margin:0 auto 5px;border-radius:50%;background:${BRAND.cream};font-size:20px;line-height:32px;color:${BRAND.burgundy};">↻</div>
                    <div class="trust-copy" style="padding-top:4px;font-size:14px;line-height:21px;font-weight:700;color:${BRAND.ink};">Đổi trả linh hoạt</div>
                    <div class="trust-copy" style="font-size:12px;line-height:18px;color:${BRAND.muted};">Trong 7 ngày nhận hàng</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:11px 20px;background:${BRAND.burgundy};font-family:${BODY_FONT};font-size:14px;line-height:21px;color:#ffffff;">
              Cần hỗ trợ gấp về đơn hàng? Hotline / Zalo: <a href="tel:0796555636" style="color:#ffffff;font-weight:700;text-decoration:underline;">079 655 5636</a>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:25px 24px 18px;background:${BRAND.soft};font-family:${BODY_FONT};">
              <img src="${logoSrc}" width="54" height="54" alt="Not A Knot" style="display:block;width:54px;height:54px;margin:0 auto 8px;border-radius:9px;object-fit:cover;background:${BRAND.creamStrong};" />
              <div style="font-family:${DISPLAY_FONT};font-size:20px;line-height:26px;font-weight:700;letter-spacing:1.7px;color:${BRAND.burgundy};">NOT A KNOT STUDIO</div>
              <div style="padding-top:2px;font-family:${DISPLAY_FONT};font-size:13px;line-height:19px;font-style:italic;color:${BRAND.muted};">Even more • Est 2026</div>

              <div style="padding:14px 0 12px;">
                <a href="https://www.facebook.com/profile.php?id=61593591390851" style="display:inline-block;width:38px;height:38px;margin:0 3px;border:1px solid ${BRAND.border};border-radius:50%;background:#ffffff;line-height:38px;text-decoration:none;"><img src="${facebookSrc}" width="20" height="20" alt="Facebook" style="display:inline-block;vertical-align:middle;width:20px;height:20px;" /></a>
                <a href="https://www.instagram.com/notaknot.handmade" style="display:inline-block;width:30px;height:30px;margin:0 3px;border:1px solid ${BRAND.border};border-radius:50%;background:#ffffff;line-height:30px;text-decoration:none;"><img src="${instagramSrc}" width="20" height="20" alt="Instagram" style="display:inline-block;vertical-align:middle;width:20px;height:20px;" /></a>
                <a href="https://m.me/61593591390851" style="display:inline-block;width:30px;height:30px;margin:0 3px;border:1px solid ${BRAND.border};border-radius:50%;background:#ffffff;line-height:30px;text-decoration:none;"><img src="${messengerSrc}" width="20" height="20" alt="Messenger" style="display:inline-block;vertical-align:middle;width:20px;height:20px;" /></a>
                <a href="https://www.threads.com/@notaknot.handmade" style="display:inline-block;width:30px;height:30px;margin:0 3px;border:1px solid ${BRAND.border};border-radius:50%;background:#ffffff;line-height:30px;text-decoration:none;"><img src="${threadsSrc}" width="20" height="20" alt="Threads" style="display:inline-block;vertical-align:middle;width:20px;height:20px;" /></a>
              </div>

              <div style="font-size:13px;line-height:21px;color:${BRAND.muted};">
                Hotline / Zalo hỗ trợ: <strong style="color:${BRAND.burgundy};">079 655 5636</strong><br />
                Email tự động từ <a href="mailto:noreply.notaknot@gmail.com" style="color:${BRAND.burgundy};text-decoration:none;">noreply.notaknot@gmail.com</a> — vui lòng không phản hồi trực tiếp.<br />
                Website chính thức: <a href="${baseUrl}" style="color:${BRAND.burgundy};font-weight:700;text-decoration:none;">www.notaknot.id.vn</a><br />
                © ${options.year || new Date().getFullYear()} NOT A KNOT Studio. Tự hào chế tác thủ công tại Việt Nam.
              </div>

              <div style="margin-top:14px;padding:12px 14px;background:#efe9df;border:1px solid #dfd5c6;border-radius:9px;text-align:left;font-size:12px;line-height:19px;color:${BRAND.muted};">
                <strong style="color:${BRAND.burgundy};">Not A Knot</strong> cùng hệ thống website và các kênh truyền thông liên quan là dự án học tập thuộc khuôn khổ môn Quản trị tác nghiệp Thương mại điện tử – Đại học Kinh tế Quốc dân. Dự án được triển khai nhằm mục đích nghiên cứu, thực hành môn học và không mang tính chất kinh doanh thương mại.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, attachments };
}
