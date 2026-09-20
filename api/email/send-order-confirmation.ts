import nodemailer from 'nodemailer';
import { buildOrderConfirmationEmail } from '../../src/email/orderConfirmationEmail';

function ensureGmailDomain(input: any): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (!trimmed.includes('@')) return `${trimmed}@gmail.com`;
  if (trimmed.endsWith('@')) return `${trimmed}gmail.com`;
  return trimmed;
}

export default async function handler(req: any, res: any) {
  // Enable CORS
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
    const email = await buildOrderConfirmationEmail(order, { baseUrl: reqHost, products: productsList });
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

    const safeAttachments = Array.isArray(email.attachments)
      ? email.attachments.filter((att: any) => {
          if (att && att.content && (Buffer.isBuffer(att.content) || typeof att.content === 'string')) return true;
          return false;
        })
      : [];

    await transporter.sendMail({
      from: `"NOT A KNOT" <${SMTP_USER}>`,
      to: customerEmail,
      subject,
      html: email.html,
      attachments: safeAttachments
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
