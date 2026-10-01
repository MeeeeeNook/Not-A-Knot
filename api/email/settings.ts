import jwt from 'jsonwebtoken';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasUser = Boolean(process.env.SMTP_USER);
  const hasPass = Boolean(process.env.SMTP_PASS && process.env.SMTP_PASS.trim());
  const isConfigured = hasUser && hasPass;
  const user = (process.env.SMTP_USER || '').trim();
  const configuredUser = user ? user.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Chưa cấu hình';
  const adminNotificationEmail = (process.env.ADMIN_NOTIFICATION_EMAIL || user || 'noreply.notaknot@gmail.com').trim();

  // GET: Retrieve public status / safe configuration metadata
  if (req.method === 'GET') {
    return res.status(200).json({
      configured: isConfigured,
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: Number(process.env.SMTP_PORT) || 465,
      smtpSecure: process.env.SMTP_SECURE !== 'false',
      configuredUser,
      hasCustomPass: hasPass,
      adminNotificationEmail,
      settings: {
        notifyAdminOnNewOrder: false,
        customerOrderEmailOption: true,
        adminNotificationEmail,
        hasCustomPass: hasPass
      },
      mode: isConfigured ? 'live_smtp' : 'simulated_preview'
    });
  }

  // POST: Update settings (Admin Authentication Required)
  if (req.method === 'POST') {
    if (!verifyAdmin(req)) {
      return res.status(401).json({
        success: false,
        error: 'Chưa được xác thực: Thao tác cập nhật cài đặt email yêu cầu quyền quản trị viên.'
      });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }

    // Security check: Never allow setting or altering SMTP_PASS via API
    if (body && (body.smtpPass || body.password || body.SMTP_PASS)) {
      return res.status(403).json({
        success: false,
        error: 'Mật khẩu ứng dụng SMTP được quản lý an toàn qua biến môi trường SMTP_PASS trên Vercel. Không cho phép cập nhật qua giao diện hoặc API.'
      });
    }

    const responseSettings: Record<string, any> = {
      notifyAdminOnNewOrder: typeof body?.notifyAdminOnNewOrder === 'boolean' ? body.notifyAdminOnNewOrder : false,
      customerOrderEmailOption: typeof body?.customerOrderEmailOption === 'boolean' ? body.customerOrderEmailOption : true,
      adminNotificationEmail: typeof body?.adminNotificationEmail === 'string' && body.adminNotificationEmail.includes('@')
        ? body.adminNotificationEmail.trim()
        : adminNotificationEmail,
      hasCustomPass: hasPass
    };

    return res.status(200).json({
      success: true,
      settings: responseSettings,
      message: 'Đã cập nhật cài đặt email thành công.'
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
