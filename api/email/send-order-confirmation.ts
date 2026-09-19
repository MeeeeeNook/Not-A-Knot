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
    const order = req.body?.orderData || req.body;
    if (!order || (!order.id && !order.trackingNumber)) {
      return res.status(400).json({ error: 'Dữ liệu đơn hàng không hợp lệ.' });
    }

    const orderCode = order.id || order.trackingNumber;
    const rawExplicit = typeof req.body?.recipientEmail === 'string' ? req.body.recipientEmail : null;
    const explicitRecipient = rawExplicit ? ensureGmailDomain(rawExplicit) : null;

    const customerEmail = explicitRecipient || (
      typeof order.email === 'string' && order.email.trim()
        ? ensureGmailDomain(order.email)
        : typeof order.customerEmail === 'string' && order.customerEmail.trim()
        ? ensureGmailDomain(order.customerEmail)
        : null
    );

    if (!customerEmail) {
      return res.status(400).json({ error: 'Không tìm thấy địa chỉ email người nhận.' });
    }

    const productsList = Array.isArray(req.body?.products) ? req.body.products : Array.isArray(order?.products) ? order.products : [];

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

    await transporter.sendMail({
      from: `"NOT A KNOT" <${SMTP_USER}>`,
      to: customerEmail,
      subject,
      html: email.html,
      attachments: email.attachments
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
