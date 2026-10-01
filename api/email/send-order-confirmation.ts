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
    const rawCustomerEmail = typeof order.email === 'string' && order.email.trim()
      ? order.email
      : typeof order.customerEmail === 'string' && order.customerEmail.trim()
      ? order.customerEmail
      : typeof order.recipientEmail === 'string' && order.recipientEmail.trim()
      ? order.recipientEmail
      : null;

    const customerEmail = rawCustomerEmail ? ensureGmailDomain(rawCustomerEmail) : null;

    if (!customerEmail || !customerEmail.includes('@') || customerEmail.length > 100) {
      return res.status(400).json({ error: 'Địa chỉ email người nhận trong đơn hàng không hợp lệ.' });
    }

    const productsList = Array.isArray(body?.products) ? body.products : Array.isArray(order?.products) ? order.products : [];
    const baseUrl = process.env.PUBLIC_SITE_URL || 'https://www.notaknot.id.vn';

    const email = await buildOrderConfirmationEmail(order, {
      baseUrl,
      products: productsList
    });
    const subject = `[NOT A KNOT] Xác nhận đơn hàng #${orderCode} - ${order.customerName || order.name || 'Quý khách'}`;

    const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
    const SMTP_SECURE = process.env.SMTP_SECURE !== 'false' && (SMTP_PORT === 465 || !process.env.SMTP_PORT);
    const SMTP_USER = (process.env.SMTP_USER || 'noreply.notaknot@gmail.com').trim();
    const SMTP_PASS = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '').trim() : '';
    const SMTP_FROM = process.env.SMTP_FROM || `"NOT A KNOT" <${SMTP_USER}>`;

    if (!SMTP_PASS) {
      return res.status(500).json({
        success: false,
        error: 'Chưa cấu hình biến môi trường mật khẩu SMTP (SMTP_PASS) trên máy chủ Vercel. Vui lòng thiết lập biến môi trường SMTP_PASS trong Vercel Project Settings.'
      });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to: customerEmail,
      subject,
      html: email.html,
      attachments: email.attachments
    });

    return res.status(200).json({
      success: true,
      mode: 'sent_real_email',
      recipients: [customerEmail],
      orderId: orderCode
    });
  } catch (err: any) {
    console.error('[Vercel Handler] Error sending confirmation email:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Lỗi gửi email máy chủ'
    });
  }
}
