import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';

// Server-side Secrets (never exposed to client browser)
const JWT_SECRET: string = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'fallback-secret-for-development-only-replace-in-prod';
if (!process.env.ADMIN_JWT_SECRET && !process.env.JWT_SECRET) {
  console.warn("WARNING: ADMIN_JWT_SECRET environment variable is missing. Using fallback for development.");
}

// SMTP / Email Delivery Secrets
const SMTP_HOST: string = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT: number = Number(process.env.SMTP_PORT) || 465;
const SMTP_SECURE: boolean = process.env.SMTP_SECURE !== 'false' && (SMTP_PORT === 465 || !process.env.SMTP_PORT);
const SMTP_USER: string = (process.env.SMTP_USER || '').trim();
const SMTP_PASS: string = (process.env.SMTP_PASS || '').trim();
const SMTP_FROM: string = process.env.SMTP_FROM || '"NOT A KNOT" <notaknothandmade@gmail.com>';
const ADMIN_NOTIFICATION_EMAIL: string = (process.env.ADMIN_NOTIFICATION_EMAIL || 'nhunhuhao71@gmail.com').trim();

// Lazy transporter creation (fails gracefully if credentials not provided)
let mailTransporter: any = null;
function getMailTransporter(): any {
  if (!mailTransporter && SMTP_USER && SMTP_PASS) {
    try {
      mailTransporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    } catch (e) {
      console.warn('[Email Service] Failed to initialize SMTP transporter:', e);
      mailTransporter = null;
    }
  }
  return mailTransporter;
}

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyDpg7yJZaMXGaGtbLWtX12KYmqt311XFoI';

const ROOT_ADMIN_USERNAME: string = (process.env.ROOT_ADMIN_USERNAME || 'manhcuong').trim().toLowerCase();

// Connect server directly to Firestore database for authoritative seller credentials
const firebaseClientConfig = {
  apiKey: "AIzaSyDpg7yJZaMXGaGtbLWtX12KYmqt311XFoI",
  authDomain: "jittery-study-nzp2g.firebaseapp.com",
  projectId: "jittery-study-nzp2g",
  storageBucket: "jittery-study-nzp2g.firebasestorage.app",
  messagingSenderId: "23301458119",
  appId: "1:23301458119:web:f7ee271f42bc11fe0216e2"
};

const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseClientConfig);
const firestoreDb = getFirestore(fbApp, "ai-studio-remixremixnotakn-6b882779-1f6a-407c-af44-7b468092c95f");

async function fetchAuthoritativeSeller(username: string): Promise<any | null> {
  const clean = (username || '').trim().toLowerCase();
  if (!clean) return null;
  const sellerId = `seller-${clean.replace(/[^a-z0-9]/g, '')}`;
  try {
    const docRef = doc(firestoreDb, 'sellers', sellerId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    const col = collection(firestoreDb, 'sellers');
    const q = query(col, where('username', '==', clean), limit(1));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const d = querySnap.docs[0];
      return { id: d.id, ...d.data() };
    }
  } catch (err) {
    console.error('[Auth API] Error fetching seller from Firestore:', err);
  }
  return null;
}

interface JwtAdminPayload {
  id: string;
  username: string;
  name: string;
  role: 'root_admin' | 'member';
  isRootAdmin: boolean;
  avatarColor?: string;
  issuedAt: string;
}

// Extend Express Request type
interface AuthenticatedRequest extends Request {
  user?: JwtAdminPayload;
}

function computeLegacyHash(password: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${password}:nak_secure_salt_2026`).digest('hex');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable gzip/brotli response compression for all responses
  app.use(compression());

  // Enable trust proxy for reverse proxy environment (Google Cloud Run / Nginx)
  app.set('trust proxy', 1);

  // HTTPS Enforcement Middleware (301 Permanent Redirect on Insecure HTTP)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const proto = req.headers['x-forwarded-proto'];
    const host = req.headers.host || '';
    const isLocal = !host || host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');

    // If forwarded proto is http on live/production domain, enforce https redirect
    if (proto === 'http' && !isLocal) {
      return res.redirect(301, `https://${host}${req.originalUrl || req.url}`);
    }

    // Set Strict-Transport-Security (HSTS) Header
    if (!isLocal) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
  });

  // Helper to extract reliable client IP behind reverse proxy / Nginx
  const getClientIpKey = (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].trim();
    }
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
  };

  // 1. Strict Request Body Limits to prevent DoS / Memory Overflow
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 2. Production Rate Limiters
  // General API Limiter: 300 requests per 15 minutes per IP
  const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIpKey,
    validate: false,
    message: { error: 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau 15 phút.' }
  });

  // Strict Auth Login Limiter: Max 10 attempts per 15 minutes per IP to prevent brute-force attacks
  const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIpKey,
    validate: false,
    message: { error: 'Quá nhiều lần đăng nhập không thành công. Địa chỉ IP của bạn tạm thời bị khóa trong 15 phút.' }
  });

  // Order Placement Limiter: Max 25 orders per 10 minutes per IP to prevent automated spam orders
  const orderPlacementLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIpKey,
    validate: false,
    message: { error: 'Hệ thống phát hiện tần suất đặt đơn bất thường. Vui lòng thử lại sau ít phút.' }
  });

  // Apply general limiter to all /api routes
  app.use('/api/', generalApiLimiter);

  // Authentication Middleware for Protected Server APIs
  const requireAdminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Chưa được xác thực: Thiếu Access Token hoặc phiên đăng nhập không hợp lệ.' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtAdminPayload;
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Phiên làm việc đã hết hạn hoặc token bảo mật không hợp lệ. Vui lòng đăng nhập lại.' });
    }
  };

  // Root Admin Authorization Middleware
  const requireRootAdminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    requireAdminAuth(req, res, () => {
      if (!req.user || (!req.user.isRootAdmin && req.user.role !== 'root_admin')) {
        return res.status(403).json({ error: 'Bạn không có quyền Root Admin để thực hiện thao tác nhạy cảm này.' });
      }
      next();
    });
  };

  // ----------------------------------------------------
  // PUBLIC API ROUTES
  // ----------------------------------------------------

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      security: 'production-hardened',
      rateLimiting: 'active',
      timestamp: new Date().toISOString()
    });
  });

  // Client IP and Geo detection endpoint
  app.get('/api/client-ip', (req, res) => {
    const cfIp = req.headers['cf-connecting-ip'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const fastlyIp = req.headers['fastly-client-ip'] as string;
    const forwarded = req.headers['x-forwarded-for'];

    let candidateIps: string[] = [];

    if (cfIp) candidateIps.push(cfIp);
    if (realIp) candidateIps.push(realIp);
    if (fastlyIp) candidateIps.push(fastlyIp);

    if (typeof forwarded === 'string') {
      candidateIps.push(...forwarded.split(',').map((s) => s.trim()));
    } else if (Array.isArray(forwarded)) {
      candidateIps.push(...forwarded.map((s) => String(s).trim()));
    }

    if (req.socket.remoteAddress) {
      candidateIps.push(req.socket.remoteAddress);
    }

    // Clean up ::ffff: prefix
    candidateIps = candidateIps.map((ip) => (ip.startsWith('::ffff:') ? ip.slice(7) : ip));

    const isPrivateIp = (ipStr: string): boolean => {
      if (!ipStr || ipStr === '127.0.0.1' || ipStr === '::1' || ipStr === 'localhost') return true;
      if (ipStr.startsWith('10.') || ipStr.startsWith('192.168.') || ipStr.startsWith('169.254.')) return true;
      if (ipStr.startsWith('172.')) {
        const parts = ipStr.split('.');
        const second = parseInt(parts[1] || '0', 10);
        if (second >= 16 && second <= 31) return true;
      }
      return false;
    };

    const firstPublicIp = candidateIps.find((ipStr) => !isPrivateIp(ipStr));
    const resolvedIp = firstPublicIp || candidateIps[0] || '127.0.0.1';
    const isPublic = !isPrivateIp(resolvedIp);

    res.json({
      ip: resolvedIp,
      isPublic,
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    });
  });

  // ----------------------------------------------------
  // SERVER-SIDE AUTHENTICATION API
  // ----------------------------------------------------

  /**
   * POST /api/auth/login
   * Strictly verifies credentials on the server using bcrypt / crypto / root admin hash.
   * Issues an HMAC-signed JWT with 24h or 30d lifetime.
   */
  app.post('/api/auth/login', authLoginLimiter, async (req: Request, res: Response) => {
    try {
      const { username, password, rememberMe = true } = req.body;
      const cleanUsername = (username || '').trim().toLowerCase();
      const cleanPassword = typeof password === 'string' ? password.trim() : '';

      if (!cleanUsername || !cleanPassword) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
      }

      // 1. Fetch Authoritative Seller directly from Firestore (DO NOT TRUST CLIENT BODY HASHES)
      const authoritativeSeller = await fetchAuthoritativeSeller(cleanUsername);

      if (!authoritativeSeller) {
        return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
      }

      // Check account status
      if (authoritativeSeller.isActive === false) {
        return res.status(403).json({ error: 'Tài khoản người bán này hiện đang bị tạm khóa.' });
      }

      // 2. Cryptographic Password Verification
      let isMatch = false;
      const storedHash = authoritativeSeller.passwordHash;
      const storedSalt = authoritativeSeller.passwordSalt;

      if (storedHash) {
        if (storedHash.startsWith('$2')) {
          // Standard modern bcrypt verification
          isMatch = await bcrypt.compare(cleanPassword, storedHash);
        } else if (storedSalt) {
          // Salted SHA-256 legacy verification
          const computed = computeLegacyHash(cleanPassword, storedSalt);
          isMatch = computed === storedHash;
        }
      }

      // If credentials do not match stored hash, REJECT IMMEDIATELY.
      // NO BACKDOORS. NO MASTER KEYS. NO FALLBACKS TO OLD DEFAULT PASSWORDS.
      if (!isMatch) {
        return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
      }

      // 3. Issue signed JWT session token
      const isRoot = authoritativeSeller.isRootAdmin === true || authoritativeSeller.role === 'root_admin' || cleanUsername === ROOT_ADMIN_USERNAME;
      const userPayload: JwtAdminPayload = {
        id: authoritativeSeller.id || `seller-${cleanUsername}`,
        username: cleanUsername,
        name: authoritativeSeller.name || (isRoot ? 'Mạnh Cường' : cleanUsername),
        role: isRoot ? 'root_admin' : (authoritativeSeller.role || 'member'),
        isRootAdmin: isRoot,
        avatarColor: authoritativeSeller.avatarColor || (isRoot ? '#B41C1A' : '#2563EB'),
        issuedAt: new Date().toISOString()
      };

      const token = jwt.sign(
        userPayload,
        JWT_SECRET,
        { expiresIn: rememberMe ? '30d' : '24h' }
      );

      return res.json({
        success: true,
        token,
        user: userPayload
      });
    } catch (err: any) {
      console.error('[Auth API] Login error:', err);
      return res.status(500).json({ error: 'Lỗi xử lý xác thực trên máy chủ.' });
    }
  });

  /**
   * GET /api/auth/verify
   * Validates a JWT token and returns user details.
   */
  app.get('/api/auth/verify', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'Thiếu token xác thực.' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtAdminPayload;
      return res.json({
        valid: true,
        user: decoded
      });
    } catch {
      return res.status(401).json({ valid: false, error: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
  });

  /**
   * POST /api/auth/hash-password
   * Hashes a password using bcrypt on the server (Protected route).
   */
  app.post('/api/auth/hash-password', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { password } = req.body;
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu cần tối thiểu 6 ký tự.' });
      }
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      return res.json({ success: true, hash, algorithm: 'bcrypt' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Lỗi băm mật khẩu trên server.' });
    }
  });

  /**
   * POST /api/admin/verify-action
   * Server-side authorization check before executing critical business mutations
   * (e.g., delete order, update prices, manage sellers, purge trash)
   */
  app.post('/api/admin/verify-action', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const { action, targetId } = req.body;
    const user = req.user!;

    // Sensitive actions requiring Root Admin authorization
    const rootOnlyActions = ['purge_trash', 'delete_seller', 'manage_seller_roles', 'reset_system'];
    if (rootOnlyActions.includes(action) && !user.isRootAdmin && user.role !== 'root_admin') {
      return res.status(403).json({
        allowed: false,
        error: `Thao tác nhạy cảm "${action}" yêu cầu quyền Root Admin.`
      });
    }

    return res.json({
      allowed: true,
      verifiedBy: user.username,
      action,
      targetId,
      timestamp: new Date().toISOString()
    });
  });

  /**
   * POST /api/orders/validate
   * Anti-spam & validation endpoint for incoming pre-orders
   */
  app.post('/api/orders/validate', orderPlacementLimiter, (req: Request, res: Response) => {
    const { customerName, phone, address, items, totalPrice } = req.body;

    if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 2) {
      return res.status(400).json({ valid: false, error: 'Họ tên người nhận không hợp lệ.' });
    }

    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 12) {
      return res.status(400).json({ valid: false, error: 'Số điện thoại không hợp lệ.' });
    }

    if (!address || typeof address !== 'string' || address.trim().length < 5) {
      return res.status(400).json({ valid: false, error: 'Địa chỉ giao hàng quá ngắn.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ valid: false, error: 'Đơn hàng không có sản phẩm.' });
    }

    return res.json({
      valid: true,
      sanitized: {
        customerName: customerName.trim(),
        phone: cleanPhone,
        address: address.trim(),
        itemCount: items.length,
        totalPrice: Number(totalPrice) || 0
      },
      verifiedAt: new Date().toISOString()
    });
  });

  // ----------------------------------------------------
  // EMAIL NOTIFICATION & ORDER CONFIRMATION API
  // ----------------------------------------------------

  /**
   * Helper: Generate a pristine, responsive HTML order receipt email
   */
  const generateOrderEmailHtml = (order: any): string => {
    const orderCode = order.id || order.trackingNumber || 'NAK-ORDER';
    const customerName = order.customerName || order.name || 'Quý khách';
    const phone = order.phone || 'Chưa cung cấp';
    const address = order.address || 'Tại xưởng NOT A KNOT';
    const note = order.note ? String(order.note).trim() : '';
    const dateStr = order.date || new Date().toLocaleString('vi-VN');
    const paymentMethodLabel =
      order.paymentMethod === 'bank_transfer' || order.paymentMethod === 'vietqr'
        ? 'Chuyển khoản VietQR'
        : order.paymentMethod === 'cash'
        ? 'Tiền mặt'
        : 'Thu hộ COD khi nhận hàng';
    const paymentStatusLabel = order.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : 'Chờ thu tiền / COD';

    const items = Array.isArray(order.itemDetails) && order.itemDetails.length > 0
      ? order.itemDetails
      : Array.isArray(order.items)
      ? order.items.map((it: any) => (typeof it === 'string' ? { productName: it, quantity: 1, price: 0 } : it))
      : [];

    const totalAmount = Number(order.totalPrice || order.totalAmount || 0);
    const shippingFee = Number(order.shippingFee || 0);
    const discountAmount = Number(order.discountAmount || order.voucherDiscountAmount || 0);
    const subtotal = Math.max(0, totalAmount - shippingFee + discountAmount);

    const trackingUrl = `https://www.notaknot.id.vn/#tracker?code=${encodeURIComponent(orderCode)}`;

    const itemsRows = items.map((item: any) => {
      const pName = item.productName || item.name || 'Phụ kiện thủ công';
      const qty = item.quantity || 1;
      const uPrice = Number(item.price || item.unitPrice || 0);
      const rowTotal = uPrice > 0 ? (uPrice * qty).toLocaleString('vi-VN') + 'đ' : '-';

      const extras = [];
      if (item.selectedColor) extras.push(`Màu: ${item.selectedColor}`);
      if (item.selectedCharm) extras.push(`Charm: ${item.selectedCharm}`);
      if (item.selectedOmamori) extras.push(`Bùa Omamori: ${item.selectedOmamori}`);
      if (item.selectedKhoen) extras.push(`Khoen: ${item.selectedKhoen}`);
      if (item.selectedSize) extras.push(`Size: ${item.selectedSize}`);
      if (item.customNote) extras.push(`Ghi chú: ${item.customNote}`);

      const variantDetail = extras.length > 0
        ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${extras.join(' • ')}</div>`
        : '';

      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 8px;vertical-align:top;">
            <div style="font-weight:600;color:#0f172a;font-size:13px;">${pName}</div>
            ${variantDetail}
          </td>
          <td style="padding:10px 8px;text-align:center;font-size:13px;color:#334155;vertical-align:top;">x${qty}</td>
          <td style="padding:10px 8px;text-align:right;font-size:13px;color:#0f172a;font-weight:600;vertical-align:top;">${rowTotal}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xác nhận đơn hàng #${orderCode} - NOT A KNOT</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.5;">
        <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          
          <!-- Header with Brand Accent -->
          <div style="background:#B41C1A;background:linear-gradient(135deg, #B41C1A 0%, #831210 100%);padding:28px 24px;text-align:center;color:#ffffff;">
            <h1 style="margin:0;font-size:22px;letter-spacing:1px;font-weight:800;text-transform:uppercase;">NOT A KNOT</h1>
            <p style="margin:4px 0 0;font-size:12px;opacity:0.9;letter-spacing:0.5px;">Xưởng Phụ Kiện Thủ Công Độc Bản</p>
            <div style="display:inline-block;background:rgba(255,255,255,0.2);backdrop-filter:blur(4px);padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;margin-top:14px;">
              MÃ ĐƠN HÀNG: #${orderCode}
            </div>
          </div>

          <!-- Greeting Card -->
          <div style="padding:24px;">
            <p style="margin:0 0 12px;font-size:14px;">Xin chào <strong>${customerName}</strong>,</p>
            <p style="margin:0 0 18px;font-size:13px;color:#475569;line-height:1.6;">
              Cảm ơn bạn đã tin tưởng và đặt hàng tại <strong>NOT A KNOT</strong>! Mỗi sản phẩm vòng tay và phụ kiện thủ công đều được chúng mình hoàn thiện tỉ mỉ bằng tay trước khi đóng gói gửi đến bạn.
            </p>

            <!-- Customer & Delivery Summary Box -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
              <div style="font-size:12px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">
                Thông Tin Giao Hàng
              </div>
              <div style="font-size:12px;color:#334155;line-height:1.7;">
                <div><strong>Người nhận:</strong> ${customerName} • <strong>SĐT:</strong> ${phone}</div>
                <div><strong>Địa chỉ:</strong> ${address}</div>
                <div><strong>Thời gian đặt:</strong> ${dateStr}</div>
                <div><strong>Hình thức:</strong> ${paymentMethodLabel} (<span style="color:#b45309;font-weight:600;">${paymentStatusLabel}</span>)</div>
                ${note ? `<div style="margin-top:4px;color:#b41c1a;"><strong>Ghi chú:</strong> ${note}</div>` : ''}
              </div>
            </div>

            <!-- Items Table -->
            <div style="margin-bottom:20px;">
              <div style="font-size:12px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
                Chi Tiết Sản Phẩm Đặt Mua
              </div>
              <table style="width:100%;border-collapse:collapse;text-align:left;">
                <thead>
                  <tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1;font-size:11px;color:#475569;text-transform:uppercase;">
                    <th style="padding:8px;border-radius:6px 0 0 6px;">Sản phẩm</th>
                    <th style="padding:8px;text-align:center;">SL</th>
                    <th style="padding:8px;text-align:right;border-radius:0 6px 6px 0;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>
            </div>

            <!-- Total Calculation -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:24px;font-size:13px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#64748b;">
                <span>Tạm tính tiền hàng:</span>
                <span style="font-weight:600;color:#0f172a;">${subtotal.toLocaleString('vi-VN')}đ</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#64748b;">
                <span>Phí vận chuyển:</span>
                <span style="font-weight:600;color:#0f172a;">${shippingFee > 0 ? `${shippingFee.toLocaleString('vi-VN')}đ` : 'Miễn phí'}</span>
              </div>
              ${discountAmount > 0 ? `
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#16a34a;font-weight:600;">
                <span>Giảm giá (Voucher):</span>
                <span>-${discountAmount.toLocaleString('vi-VN')}đ</span>
              </div>` : ''}
              <div style="display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:6px;font-size:15px;font-weight:800;color:#B41C1A;">
                <span>TỔNG THANH TOÁN:</span>
                <span>${totalAmount.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>

            <!-- Action Button -->
            <div style="text-align:center;margin-bottom:24px;">
              <a href="${trackingUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:700;letter-spacing:0.3px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                Tra Cứu Trạng Thái Đơn Hàng &gt;
              </a>
            </div>

            <!-- Guarantee Note -->
            <div style="border-top:1px dashed #cbd5e1;padding-top:16px;font-size:11px;color:#64748b;line-height:1.6;text-align:center;">
              🛡️ <strong>Chính sách NOT A KNOT:</strong> Bảo hành chốt khóa trọn đời • Hỗ trợ đổi trả miễn phí trong 7 ngày nếu lỗi gia công.<br>
              Nếu cần hỗ trợ gấp, vui lòng liên hệ Zalo / Hotline hoặc email: <a href="mailto:notaknothandmade@gmail.com" style="color:#B41C1A;text-decoration:none;">notaknothandmade@gmail.com</a>
            </div>

          </div>

          <!-- Footer -->
          <div style="background:#f1f5f9;padding:16px 24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
            © ${new Date().getFullYear()} NOT A KNOT Handmade Studio. Mọi quyền được bảo lưu.<br>
            Website: <a href="https://www.notaknot.id.vn" style="color:#64748b;text-decoration:underline;">https://www.notaknot.id.vn</a>
          </div>

        </div>
      </body>
      </html>
    `;
  };

  /**
   * GET /api/email/status
   * Checks whether the SMTP email subsystem is active and configured
   */
  app.get('/api/email/status', (_req: Request, res: Response) => {
    const isConfigured = Boolean(SMTP_USER && SMTP_PASS);
    const maskedUser = SMTP_USER ? SMTP_USER.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Chưa cấu hình';
    res.json({
      configured: isConfigured,
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
      smtpSecure: SMTP_SECURE,
      configuredUser: maskedUser,
      adminNotificationEmail: ADMIN_NOTIFICATION_EMAIL,
      mode: isConfigured ? 'live_smtp' : 'simulated_preview'
    });
  });

  /**
   * POST /api/email/send-order-confirmation
   * Dispatches order confirmation email to customer (if email provided)
   * and sends an admin order alert to the shop owner.
   */
  app.post('/api/email/send-order-confirmation', async (req: Request, res: Response) => {
    try {
      const order = req.body?.orderData || req.body;
      if (!order || (!order.id && !order.trackingNumber)) {
        return res.status(400).json({ error: 'Dữ liệu đơn hàng không hợp lệ.' });
      }

      const orderCode = order.id || order.trackingNumber;
      const customerEmail = typeof order.email === 'string' && order.email.includes('@')
        ? order.email.trim()
        : typeof order.customerEmail === 'string' && order.customerEmail.includes('@')
        ? order.customerEmail.trim()
        : null;

      const htmlContent = generateOrderEmailHtml(order);
      const subject = `[NOT A KNOT] Xác nhận đơn hàng #${orderCode} - ${order.customerName || order.name || 'Quý khách'}`;

      const transporter = getMailTransporter();

      // Collect recipients
      const recipients: string[] = [];
      if (customerEmail) recipients.push(customerEmail);
      if (ADMIN_NOTIFICATION_EMAIL && !recipients.includes(ADMIN_NOTIFICATION_EMAIL)) {
        recipients.push(ADMIN_NOTIFICATION_EMAIL);
      }

      if (transporter) {
        // Send real email via SMTP
        await transporter.sendMail({
          from: SMTP_FROM,
          to: customerEmail || ADMIN_NOTIFICATION_EMAIL,
          bcc: customerEmail && ADMIN_NOTIFICATION_EMAIL !== customerEmail ? ADMIN_NOTIFICATION_EMAIL : undefined,
          subject,
          html: htmlContent
        });

        console.log(`[Email Service] Successfully sent real order email for #${orderCode} to:`, recipients.join(', '));
        return res.json({
          success: true,
          mode: 'sent_real_email',
          recipients,
          orderCode,
          timestamp: new Date().toISOString()
        });
      } else {
        // Simulated / preview mode: logged cleanly to console without failing checkout
        console.log(`[Email Service] [Preview Mode] Order notification generated for #${orderCode}. Target recipients: ${recipients.join(', ') || 'Admin'}`);
        return res.json({
          success: true,
          mode: 'simulated_preview',
          message: 'Đã tạo nội dung email hóa đơn thành công và ghi nhận vào hệ thống (Chế độ xem trước: cấu hình SMTP_USER và SMTP_PASS trong biến môi trường để gửi thực tế).',
          recipients,
          orderCode,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error('[Email Service] Error in send-order-confirmation:', err);
      // Even if email fails, return 200 with error notice so customer's order placement is not blocked!
      return res.json({
        success: false,
        error: err.message || 'Không thể gửi email lúc này',
        fallbackLogged: true
      });
    }
  });

  /**
   * POST /api/email/test-delivery
   * Admin-only or setup endpoint to verify SMTP delivery
   */
  app.post('/api/email/test-delivery', async (req: Request, res: Response) => {
    try {
      const { targetEmail } = req.body;
      const destination = (targetEmail || ADMIN_NOTIFICATION_EMAIL).trim();

      if (!destination || !destination.includes('@')) {
        return res.status(400).json({ error: 'Địa chỉ email nhận test không hợp lệ.' });
      }

      const transporter = getMailTransporter();
      if (!transporter) {
        return res.json({
          success: false,
          configured: false,
          message: `Chưa cấu hình thông tin đăng nhập SMTP (SMTP_USER và SMTP_PASS). Hệ thống đang chạy ở chế độ xem trước (Simulated Mode). Email test tới ${destination} đã được mô phỏng.`
        });
      }

      await transporter.sendMail({
        from: SMTP_FROM,
        to: destination,
        subject: '[NOT A KNOT] Thử nghiệm kết nối hệ thống Email thành công!',
        html: `
          <div style="font-family:sans-serif;padding:20px;max-width:500px;border:1px solid #e2e8f0;border-radius:12px;">
            <h2 style="color:#B41C1A;margin-top:0;">NOT A KNOT Handmade Studio</h2>
            <p>Xin chào quản trị viên,</p>
            <p>Hệ thống gửi thư tự động (SMTP) của website NOT A KNOT đã được kết nối thành công và sẵn sàng gửi email xác nhận đơn hàng cho khách!</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
            <p style="font-size:12px;color:#64748b;">Thời gian kiểm tra: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
        `
      });

      return res.json({
        success: true,
        configured: true,
        destination,
        message: `Đã gửi thành công email thử nghiệm đến ${destination}!`
      });
    } catch (err: any) {
      console.error('[Email Service] Test delivery failed:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Lỗi khi gửi email thử nghiệm qua SMTP.'
      });
    }
  });

  // ----------------------------------------------------
  // SEO STATIC FILES (robots.txt & sitemap.xml)
  // ----------------------------------------------------
  app.get('/robots.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
    if (fs.existsSync(robotsPath)) {
      return res.sendFile(robotsPath);
    }
    const distRobotsPath = path.join(process.cwd(), 'dist', 'robots.txt');
    if (fs.existsSync(distRobotsPath)) {
      return res.sendFile(distRobotsPath);
    }
    return res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: https://www.notaknot.id.vn/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (_req, res) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      return res.sendFile(sitemapPath);
    }
    const distSitemapPath = path.join(process.cwd(), 'dist', 'sitemap.xml');
    if (fs.existsSync(distSitemapPath)) {
      return res.sendFile(distSitemapPath);
    }
    return res.status(404).send('Sitemap not found');
  });

  // ----------------------------------------------------
  // LLMS.TXT & AI CRAWLER SPECIFICATIONS
  // ----------------------------------------------------
  app.get('/llms.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const filePath = path.join(process.cwd(), 'public', 'llms.txt');
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    const distPath = path.join(process.cwd(), 'dist', 'llms.txt');
    if (fs.existsSync(distPath)) {
      return res.sendFile(distPath);
    }
    return res.status(404).send('# NOT A KNOT - LLMs.txt not found');
  });

  app.get('/llms-full.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const filePath = path.join(process.cwd(), 'public', 'llms-full.txt');
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    const distPath = path.join(process.cwd(), 'dist', 'llms-full.txt');
    if (fs.existsSync(distPath)) {
      return res.sendFile(distPath);
    }
    return res.status(404).send('# NOT A KNOT - Full LLMs.txt not found');
  });

  app.get('/backlink-strategy.md', (_req, res) => {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const filePath = path.join(process.cwd(), 'public', 'backlink-strategy.md');
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    const distPath = path.join(process.cwd(), 'dist', 'backlink-strategy.md');
    if (fs.existsSync(distPath)) {
      return res.sendFile(distPath);
    }
    return res.status(404).send('# NOT A KNOT - Backlink Strategy not found');
  });

  // ----------------------------------------------------
  // VITE & STATIC SERVING
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
      ? path.join(process.cwd(), 'dist')
      : path.join(process.cwd(), 'build');
    app.use(express.static(distPath, {
      maxAge: '1y',
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} with production-grade security, rate-limiting & JWT auth`);
  });
}

startServer();
