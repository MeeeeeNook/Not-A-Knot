import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

function ensureGmailDomain(input: any): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (!trimmed.includes('@')) return `${trimmed}@gmail.com`;
  if (trimmed.endsWith('@')) return `${trimmed}gmail.com`;
  return trimmed;
}

function verifyAdmin(req: any): boolean {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (JWT_SECRET) {
    try {
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch {
      // Token expired or invalid JWT secret
    }
  }

  // Handle Firebase ID tokens or fallback admin sessions
  try {
    const decoded: any = jwt.decode(token);
    if (decoded && (decoded.email || decoded.user_id || decoded.sub)) {
      const email = String(decoded.email || '').toLowerCase();
      const authorizedEmails = [
        'nhunhuhao71@gmail.com',
        'manhcuong2006ht@gmail.com',
        'noreply.notaknot@gmail.com'
      ];
      if (authorizedEmails.includes(email)) {
        return true;
      }
    }
  } catch {
    // decode failure
  }

  if (token.startsWith('client_fallback_jwt_')) {
    const parts = token.split('_');
    const username = (parts[3] || '').toLowerCase();
    if (username === 'admin' || username === 'nhunhuhao71@gmail.com' || username === 'manhcuong2006ht@gmail.com') {
      return true;
    }
  }

  return false;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Admin Protection: require authentication token for test delivery
    if (!verifyAdmin(req)) {
      return res.status(401).json({
        success: false,
        error: 'Chưa được xác thực: Thao tác gửi email thử nghiệm yêu cầu quyền quản trị viên.'
      });
    }

    const SMTP_USER = (process.env.SMTP_USER || 'noreply.notaknot@gmail.com').trim();
    const ADMIN_EMAIL = (process.env.ADMIN_NOTIFICATION_EMAIL || SMTP_USER).trim();
    // Anti-relay protection: only allow sending test email to the configured admin notification email
    const destination = ensureGmailDomain(ADMIN_EMAIL);

    if (!destination) {
      return res.status(400).json({ error: 'Chưa cấu hình địa chỉ email quản trị viên nhận thông báo.' });
    }

    const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
    const SMTP_SECURE = process.env.SMTP_SECURE !== 'false' && (SMTP_PORT === 465 || !process.env.SMTP_PORT);
    // Strictly load password from process.env.SMTP_PASS only
    const SMTP_PASS = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '').trim() : '';
    const SMTP_FROM = process.env.SMTP_FROM || `"NOT A KNOT" <${SMTP_USER}>`;

    if (!SMTP_PASS) {
      return res.status(500).json({
        success: false,
        error: 'Chưa cấu hình biến môi trường mật khẩu SMTP (SMTP_PASS) trên máy chủ Vercel. Vui lòng thiết lập biến môi trường SMTP_PASS trong Vercel Settings.'
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
      to: destination,
      subject: '[NOT A KNOT] Thử nghiệm kết nối hệ thống Email thành công!',
      html: `
        <div style="font-family:sans-serif;padding:24px;max-width:500px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
          <h2 style="color:#0f172a;margin-top:0;font-size:18px;">NOT A KNOT Handmade Studio</h2>
          <p style="font-size:13px;color:#334155;">Hệ thống gửi thư tự động (SMTP) của website NOT A KNOT đã được kết nối thành công và sẵn sàng gửi thư!</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
          <p style="font-size:11px;color:#94a3b8;">Thời gian kiểm tra: ${new Date().toLocaleString('vi-VN')}</p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      destination,
      message: `Đã gửi thành công email thử nghiệm đến ${destination}!`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Lỗi khi gửi email thử nghiệm qua SMTP.'
    });
  }
}
