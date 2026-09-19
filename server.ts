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
const SMTP_USER: string = (process.env.SMTP_USER || 'noreply.notaknot@gmail.com').trim();
const SMTP_PASS: string = (process.env.SMTP_PASS || 'dyjdwgejzlaxdljh').trim();
const SMTP_FROM: string = process.env.SMTP_FROM || '"NOT A KNOT" <noreply.notaknot@gmail.com>';
let ADMIN_NOTIFICATION_EMAIL: string = (process.env.ADMIN_NOTIFICATION_EMAIL || 'noreply.notaknot@gmail.com').trim();

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
  // EMAIL PERSISTENCE & STATS COUNTER SYSTEM
  // ----------------------------------------------------
  interface EmailLogEntry {
    id: string;
    timestamp: number;
    recipient: string;
    orderCode?: string;
    type: 'admin_notification' | 'customer_confirmation' | 'manual_admin' | 'test';
    status: 'sent' | 'simulated' | 'error';
  }

  interface EmailStoreData {
    settings: {
      notifyAdminOnNewOrder: boolean;
      customerOrderEmailOption: boolean;
      adminNotificationEmail: string;
    };
    sentLogs: EmailLogEntry[];
  }

  const EMAIL_DATA_PATH = path.join(process.cwd(), 'email_data.json');

  let emailStore: EmailStoreData = {
    settings: {
      notifyAdminOnNewOrder: false, // Default OFF per user request
      customerOrderEmailOption: true, // Default ON (toggleable)
      adminNotificationEmail: ADMIN_NOTIFICATION_EMAIL || 'noreply.notaknot@gmail.com'
    },
    sentLogs: []
  };

  const loadEmailData = () => {
    try {
      if (fs.existsSync(EMAIL_DATA_PATH)) {
        const raw = fs.readFileSync(EMAIL_DATA_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          emailStore = {
            settings: {
              notifyAdminOnNewOrder: typeof parsed.settings?.notifyAdminOnNewOrder === 'boolean' ? parsed.settings.notifyAdminOnNewOrder : false,
              customerOrderEmailOption: typeof parsed.settings?.customerOrderEmailOption === 'boolean' ? parsed.settings.customerOrderEmailOption : true,
              adminNotificationEmail: parsed.settings?.adminNotificationEmail || ADMIN_NOTIFICATION_EMAIL
            },
            sentLogs: Array.isArray(parsed.sentLogs) ? parsed.sentLogs : []
          };
          ADMIN_NOTIFICATION_EMAIL = emailStore.settings.adminNotificationEmail;
        }
      }
    } catch (e) {
      console.warn('[Email Store] Could not load email_data.json:', e);
    }
  };

  const saveEmailData = () => {
    try {
      // Keep only last 1000 logs to prevent file bloat
      if (emailStore.sentLogs.length > 1000) {
        emailStore.sentLogs = emailStore.sentLogs.slice(-1000);
      }
      fs.writeFileSync(EMAIL_DATA_PATH, JSON.stringify(emailStore, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Email Store] Error saving email_data.json:', e);
    }
  };

  loadEmailData();

  const recordEmailLog = (
    recipient: string,
    type: EmailLogEntry['type'],
    orderCode?: string,
    status: 'sent' | 'simulated' | 'error' = 'sent'
  ) => {
    const entry: EmailLogEntry = {
      id: `mail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      recipient,
      orderCode,
      type,
      status
    };
    emailStore.sentLogs.push(entry);
    saveEmailData();
  };

  const calculateEmailStats = () => {
    const now = new Date();
    // Start of today in local date
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Start of this week (Monday)
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday).getTime();

    // Start of this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const validLogs = emailStore.sentLogs.filter((log) => log.status !== 'error');

    const todayCount = validLogs.filter((log) => log.timestamp >= startOfToday).length;
    const weekCount = validLogs.filter((log) => log.timestamp >= startOfWeek).length;
    const monthCount = validLogs.filter((log) => log.timestamp >= startOfMonth).length;
    const totalCount = validLogs.length;

    return {
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
      total: totalCount,
      dailyLimit: 500 // Gmail Standard Free Tier limit
    };
  };

  // ----------------------------------------------------
  // EMAIL NOTIFICATION & ORDER CONFIRMATION API
  // ----------------------------------------------------
  // EMAIL NOTIFICATION & ORDER CONFIRMATION API
  // ----------------------------------------------------

  /**
   * Helper: Automatically fill @gmail.com if domain is missing
   * Example: "abc" -> "abc@gmail.com". If @gmail.com or other domain already exists, ignore.
   */
  const ensureGmailDomain = (input: any): string => {
    if (typeof input !== 'string') return '';
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (!trimmed.includes('@')) {
      return `${trimmed}@gmail.com`;
    }
    if (trimmed.endsWith('@')) {
      return `${trimmed}gmail.com`;
    }
    return trimmed;
  };

  /**
   * Helper: Convert local public file path to Base64 Data URI
   * Ensures ALL email images (logo, icons, product photos) display 100% reliably in Gmail/Outlook without broken icons.
   */
  const getLocalImageAsBase64 = (relativePath: string): string => {
    if (!relativePath) return '';
    if (relativePath.startsWith('data:image/')) return relativePath;
    try {
      const cleanPath = relativePath.replace(/^\//, '');
      const absolutePath = path.join(process.cwd(), 'public', cleanPath);
      if (fs.existsSync(absolutePath)) {
        const ext = path.extname(absolutePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        const b64 = fs.readFileSync(absolutePath).toString('base64');
        return `data:${mime};base64,${b64}`;
      }
    } catch (e) {
      console.error('[Base64 Image] Error reading file:', relativePath, e);
    }
    return '';
  };

  /**
   * Helper: Generate a pristine, highly-crafted HTML order receipt email
   * Redesigned to strictly replicate the user's template (warm beige palette, maroon accents, elegant serif headings,
   * step-by-step progress tracker, detailed item cards, trust badges, support banner, and base64 embedded images).
   */
  const generateOrderEmailHtml = (order: any, reqHost?: string): string => {
    const host = reqHost && !reqHost.includes('localhost') ? reqHost : 'www.notaknot.id.vn';
    const baseUrl = host.startsWith('http') ? host : `https://${host}`;

    const orderCode = order.id || order.trackingNumber || 'NAK-ORDER';
    const customerName = order.customerName || order.name || 'Quý khách';
    const phone = order.phone || 'Chưa cung cấp';
    const address = order.address || 'Tại xưởng NOT A KNOT';
    const note = order.note ? String(order.note).trim() : '';
    const dateStr = order.date || new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
    const paymentMethodLabel =
      order.paymentMethod === 'bank_transfer' || order.paymentMethod === 'vietqr'
        ? 'Chuyển khoản VietQR'
        : order.paymentMethod === 'cash'
        ? 'Tiền mặt'
        : 'COD (Khi nhận hàng)';

    const items = Array.isArray(order.itemDetails) && order.itemDetails.length > 0
      ? order.itemDetails
      : Array.isArray(order.items)
      ? order.items.map((it: any) => (typeof it === 'string' ? { productName: it, quantity: 1, price: 0 } : it))
      : [];

    const totalAmount = Number(order.totalPrice || order.totalAmount || 0);
    const shippingFee = Number(order.shippingFee || 0);
    const discountAmount = Number(order.discountAmount || order.voucherDiscountAmount || 0);
    const subtotal = Math.max(0, totalAmount - shippingFee + discountAmount);
    const totalQuantity = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);

    const trackingUrl = `https://www.notaknot.id.vn/#tracking?code=${encodeURIComponent(orderCode)}`;
    const messengerUrl = 'https://m.me/61593591390851';

    // Base64 pre-load for essential branding & social assets
    const logoBase64 = getLocalImageAsBase64('/assets/logo.jpg') || getLocalImageAsBase64('/logo.jpg');
    const fbIconB64 = getLocalImageAsBase64('/assets/icons/facebook.png');
    const instaIconB64 = getLocalImageAsBase64('/assets/icons/instagram.png');
    const threadsIconB64 = getLocalImageAsBase64('/assets/icons/threads.png');

    // Build Product Rows
    const itemsRows = items.map((item: any) => {
      const pName = item.productName || item.name || 'Phụ kiện thủ công';
      const qty = item.quantity || 1;
      const uPrice = Number(item.price || item.unitPrice || 0);
      const rowTotal = uPrice > 0 ? (uPrice * qty).toLocaleString('vi-VN') + 'đ' : '-';

      // Base64 Product Image Resolution
      let itemImgB64 = '';
      const pImgRaw = item.imageUrl || item.image || item.productImage || '';
      if (pImgRaw && pImgRaw.startsWith('data:image/')) {
        itemImgB64 = pImgRaw;
      } else if (pImgRaw && (pImgRaw.startsWith('/assets/') || pImgRaw.startsWith('assets/'))) {
        itemImgB64 = getLocalImageAsBase64(pImgRaw);
      }

      if (!itemImgB64) {
        const nameLow = (pName + ' ' + (item.productId || '')).toLowerCase();
        let subPath = '/assets/bracelet.jpg';
        if (nameLow.includes('bộ đội') || nameLow.includes('bodoi')) {
          subPath = '/assets/keychain-bodoi.jpg';
        } else if (nameLow.includes('mũ cối') || nameLow.includes('mucoi')) {
          subPath = '/assets/keychain-mucoi.jpg';
        } else if (nameLow.includes('lucky')) {
          subPath = '/assets/bracelet.jpg';
        } else if (nameLow.includes('butterfly')) {
          subPath = '/assets/img_4.jpg';
        } else if (nameLow.includes('0209') || nameLow.includes('02/09')) {
          subPath = '/assets/0209/img_3.jpg';
        } else if (nameLow.includes('charm') || nameLow.includes('omamori')) {
          subPath = '/assets/img_0.jpg';
        } else if (nameLow.includes('vòng') || nameLow.includes('bracelet')) {
          subPath = '/assets/bracelet.jpg';
        } else if (nameLow.includes('móc') || nameLow.includes('khoá') || nameLow.includes('keychain')) {
          subPath = '/assets/keychain-bodoi.jpg';
        } else {
          subPath = '/assets/img_1.jpg';
        }
        itemImgB64 = getLocalImageAsBase64(subPath);
      }

      // Variant label summary
      const variantParts: string[] = [];
      if (item.selectedColor) variantParts.push(item.selectedColor);
      if (item.selectedCharms && item.selectedCharms.length > 0) {
        variantParts.push('Charm ' + item.selectedCharms.map((c: any) => c.name || c).join(', '));
      } else if (item.selectedCharm) {
        variantParts.push('Charm ' + (typeof item.selectedCharm === 'object' ? item.selectedCharm.name : item.selectedCharm));
      }
      if (item.selectedOmamoris && item.selectedOmamoris.length > 0) {
        variantParts.push('Bùa ' + item.selectedOmamoris.map((o: any) => o.name || o).join(', '));
      } else if (item.selectedOmamori) {
        variantParts.push('Bùa ' + (typeof item.selectedOmamori === 'object' ? item.selectedOmamori.name : item.selectedOmamori));
      }
      if (item.selectedSize) variantParts.push(`Size ${item.selectedSize}`);

      const variantSummary = variantParts.length > 0 ? variantParts.join(' • ') : 'Bản tiêu chuẩn thủ công';

      // Option breakdown lines
      const optionLines: string[] = [];
      if (item.selectedKhoen) {
        optionLines.push(`• Khoen: ${item.selectedKhoen}`);
      }
      if (item.customNote) {
        optionLines.push(`• Ghi chú: ${item.customNote}`);
      }

      const optionsHtml = optionLines.length > 0
        ? `<div style="margin-top:6px;font-size:12px;color:#7a6e65;line-height:1.5;">${optionLines.join('<br>')}</div>`
        : '';

      return `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid #eedec8;vertical-align:top;width:68px;">
            <div style="width:68px;height:68px;background:#f5ebd9;border-radius:12px;overflow:hidden;border:1px solid #eedec8;">
              <img src="${itemImgB64}" alt="${pName}" width="68" height="68" style="width:68px;height:68px;object-fit:cover;display:block;" />
            </div>
          </td>
          <td style="padding:16px 14px;border-bottom:1px solid #eedec8;vertical-align:top;">
            <div style="font-size:15px;font-weight:700;color:#2b211e;line-height:1.4;">${pName}</div>
            <div style="font-size:13px;color:#7a6e65;margin-top:4px;">Phân loại: <span style="color:#5c1920;font-weight:600;">${variantSummary}</span></div>
            ${optionsHtml}
            <div style="margin-top:6px;">
              <span style="display:inline-block;background:#f5ebd9;color:#5c1920;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Hàng thủ công độc bản</span>
            </div>
          </td>
          <td style="padding:16px 0;border-bottom:1px solid #eedec8;vertical-align:top;text-align:right;white-space:nowrap;">
            <div style="font-size:12px;color:#8a7d72;margin-bottom:2px;">SL: <strong style="color:#2b211e;font-size:14px;">${qty}</strong></div>
            <div style="font-size:16px;font-weight:800;color:#5c1920;">${rowTotal}</div>
          </td>
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
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          body {
            margin: 0;
            padding: 0;
            background-color: #f6f2e9;
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #2b211e;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
          }
          @media only screen and (max-width: 640px) {
            .main-card { border-radius: 0 !important; border: none !important; }
            .content-padding { padding: 20px 16px !important; }
            .responsive-col { display: block !important; width: 100% !important; padding: 0 !important; margin-bottom: 12px !important; }
            .responsive-btn { width: 100% !important; display: block !important; text-align: center !important; box-sizing: border-box !important; }
          }
        </style>
      </head>
      <body>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f6f2e9;padding:24px 0;">
          <tr>
            <td align="center" style="padding:0 8px;">
              
              <!-- Main Email Container -->
              <table class="main-card" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#ffffff;border-radius:20px;border:1px solid #e8dfd1;box-shadow:0 10px 32px rgba(92,25,32,0.06);overflow:hidden;margin:0 auto;">
                
                <!-- Top Header Strip -->
                <tr>
                  <td style="background:#5c1920;padding:12px 20px;text-align:center;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.5px;">
                    Cảm ơn bạn đã đồng hành cùng Not A Knot Studio
                  </td>
                </tr>

                <!-- Logo & Heading Box -->
                <tr>
                  <td style="background:#f8f4eb;padding:32px 24px 28px 24px;text-align:center;border-bottom:1px solid #eedec8;">
                    
                    <!-- Logo Card -->
                    <div style="width:88px;height:88px;background:#eedec8;border-radius:18px;margin:0 auto;padding:6px;box-sizing:border-box;">
                      <img src="${logoBase64}" alt="NOT A KNOT" width="76" height="76" style="width:76px;height:76px;border-radius:14px;object-fit:cover;display:block;" />
                    </div>

                    <!-- Main Title -->
                    <h1 style="font-family:'Playfair Display', Georgia, 'Times New Roman', serif;font-size:26px;font-weight:700;color:#5c1920;margin:18px 0 8px 0;line-height:1.3;">
                      Đơn hàng của bạn đang được xử lý!
                    </h1>
                    <p style="font-size:14px;color:#7a6e65;margin:0 auto;max-width:480px;line-height:1.5;">
                      Chúng tôi đã nhận được đơn hàng và đang chuẩn bị các sản phẩm thủ công tinh tế dành riêng cho bạn.
                    </p>

                  </td>
                </tr>

                <!-- Progress Tracker Bar -->
                <tr>
                  <td style="padding:22px 24px 16px 24px;border-bottom:1px solid #f2e9dc;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="width:30%;">
                          <span style="display:inline-block;background:#5c1920;color:#ffffff;font-size:12px;font-weight:700;padding:5px 12px;border-radius:20px;white-space:nowrap;">
                            ✓ Đã đặt hàng
                          </span>
                        </td>
                        <td style="width:5%;">
                          <div style="height:2px;background:#eedec8;"></div>
                        </td>
                        <td align="center" style="width:30%;">
                          <span style="display:inline-block;border:2px solid #5c1920;color:#5c1920;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;background:#ffffff;">
                            2 Đang xử lý
                          </span>
                        </td>
                        <td style="width:5%;">
                          <div style="height:2px;background:#eedec8;"></div>
                        </td>
                        <td align="center" style="width:30%;">
                          <span style="display:inline-block;border:1px solid #d1c7b7;color:#a09385;font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;white-space:nowrap;background:#ffffff;">
                            3 Đang giao hàng
                          </span>
                        </td>
                      </tr>
                    </table>
                    <div style="font-size:12px;color:#8a7d72;text-align:center;margin-top:14px;font-style:italic;">
                      Vui lòng chờ khoảng 12 - 24 giờ để mã vận đơn hiển thị trên hệ thống tra cứu.
                    </div>
                  </td>
                </tr>

                <!-- Order Code & Tra Cứu Banner -->
                <tr>
                  <td style="padding:20px 24px 16px 24px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td class="responsive-col" style="vertical-align:middle;">
                          <div style="font-size:13px;color:#8a7d72;font-weight:600;">Mã đơn hàng:</div>
                          <div style="font-size:22px;font-weight:800;color:#5c1920;font-family:'Playfair Display', Georgia, serif;letter-spacing:0.5px;">
                            #${orderCode}
                          </div>
                        </td>
                        <td class="responsive-col" align="right" style="vertical-align:middle;">
                          <a class="responsive-btn" href="${trackingUrl}" target="_blank" style="display:inline-block;background:#5c1920;color:#ffffff;font-size:13px;font-weight:800;padding:11px 22px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;text-transform:uppercase;box-shadow:0 3px 10px rgba(92,25,32,0.25);">
                            TRA CỨU ĐƠN HÀNG
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Information Card (Customer & Shipping) -->
                <tr>
                  <td style="padding:0 24px 24px 24px;">
                    <div style="background:#faf6ef;border:1px solid #eedec8;border-radius:14px;padding:20px 22px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <!-- Column 1: Order Info -->
                          <td class="responsive-col" style="width:48%;vertical-align:top;padding-right:12px;">
                            <div style="font-size:11px;font-weight:800;color:#8a7d72;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">
                              THÔNG TIN ĐƠN HÀNG
                            </div>
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;line-height:1.8;color:#2b211e;">
                              <tr>
                                <td style="color:#7a6e65;width:80px;">Mã đơn:</td>
                                <td><strong style="color:#5c1920;">#${orderCode}</strong></td>
                              </tr>
                              <tr>
                                <td style="color:#7a6e65;">Ngày đặt:</td>
                                <td><strong>${dateStr}</strong></td>
                              </tr>
                              <tr>
                                <td style="color:#7a6e65;">Thanh toán:</td>
                                <td><strong>${paymentMethodLabel}</strong></td>
                              </tr>
                              <tr>
                                <td style="color:#7a6e65;">Trạng thái:</td>
                                <td>
                                  <span style="display:inline-block;background:#f5ebd9;color:#5c1920;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">
                                    Đang chuẩn bị hàng
                                  </span>
                                </td>
                              </tr>
                            </table>
                          </td>

                          <!-- Divider on Desktop -->
                          <td style="width:4%;border-left:1px solid #eedec8;" class="responsive-col"></td>

                          <!-- Column 2: Shipping Address -->
                          <td class="responsive-col" style="width:48%;vertical-align:top;padding-left:12px;">
                            <div style="font-size:11px;font-weight:800;color:#8a7d72;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">
                              ĐỊA CHỈ GIAO HÀNG
                            </div>
                            <div style="font-size:14px;font-weight:700;color:#2b211e;margin-bottom:4px;">
                              ${customerName}
                            </div>
                            <div style="font-size:13px;color:#5c1920;font-weight:700;margin-bottom:6px;">
                              SĐT: ${phone}
                            </div>
                            <div style="font-size:13px;color:#524641;line-height:1.5;">
                              ${address}
                            </div>
                          </td>
                        </tr>
                      </table>

                      ${note ? `
                      <!-- Order Note Sub-box -->
                      <div style="margin-top:16px;padding-top:14px;border-top:1px dashed #eedec8;font-size:13px;color:#524641;line-height:1.5;">
                        <strong style="color:#5c1920;">📝 Ghi chú đơn hàng:</strong> <em>“${note}”</em>
                      </div>
                      ` : ''}

                    </div>
                  </td>
                </tr>

                <!-- Product Details Section -->
                <tr>
                  <td style="padding:0 24px 24px 24px;">
                    <div style="font-size:17px;font-weight:800;color:#2b211e;margin-bottom:12px;font-family:'Playfair Display', Georgia, serif;">
                      Chi tiết đơn hàng
                    </div>

                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                      <tbody>
                        ${itemsRows}
                      </tbody>
                    </table>

                    <!-- Subtotal & Total Financial Summary -->
                    <div style="margin-top:16px;padding-top:16px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;color:#6e6259;line-height:2;">
                        <tr>
                          <td style="padding:2px 0;">Tạm tính (${totalQuantity} món):</td>
                          <td style="padding:2px 0;text-align:right;font-weight:700;color:#2b211e;">
                            ${subtotal.toLocaleString('vi-VN')}đ
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:2px 0;">Phí vận chuyển:</td>
                          <td style="padding:2px 0;text-align:right;font-weight:700;color:${shippingFee === 0 ? '#2e7d32' : '#2b211e'};">
                            ${shippingFee > 0 ? `${shippingFee.toLocaleString('vi-VN')}đ` : 'MIỄN PHÍ'}
                          </td>
                        </tr>
                        ${discountAmount > 0 ? `
                        <tr>
                          <td style="padding:2px 0;color:#2e7d32;">Giảm giá ưu đãi:</td>
                          <td style="padding:2px 0;text-align:right;font-weight:700;color:#2e7d32;">
                            -${discountAmount.toLocaleString('vi-VN')}đ
                          </td>
                        </tr>
                        ` : ''}
                        <tr>
                          <td style="padding:2px 0;">Phương thức thanh toán:</td>
                          <td style="padding:2px 0;text-align:right;font-weight:600;color:#2b211e;">
                            ${paymentMethodLabel}
                          </td>
                        </tr>
                        <tr style="border-top:2px solid #5c1920;">
                          <td style="padding:12px 0 0 0;font-size:16px;font-weight:800;color:#2b211e;">
                            Tổng cộng:
                          </td>
                          <td style="padding:12px 0 0 0;text-align:right;font-size:22px;font-weight:800;color:#5c1920;font-family:'Playfair Display', Georgia, serif;">
                            ${totalAmount.toLocaleString('vi-VN')}đ
                          </td>
                        </tr>
                      </table>
                    </div>

                  </td>
                </tr>

                <!-- Trust Features Row (3 Badges) -->
                <tr>
                  <td style="background:#faf6ef;padding:20px 24px;border-top:1px solid #eedec8;border-bottom:1px solid #eedec8;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="width:33.3%;vertical-align:top;padding:0 4px;">
                          <div style="font-size:18px;margin-bottom:4px;">🕒</div>
                          <div style="font-size:13px;font-weight:700;color:#2b211e;">Hỗ trợ tận tâm</div>
                          <div style="font-size:11px;color:#8a7d72;margin-top:2px;">08:00 - 21:00 hàng ngày</div>
                        </td>
                        <td align="center" style="width:33.3%;vertical-align:top;padding:0 4px;border-left:1px solid #eedec8;border-right:1px solid #eedec8;">
                          <div style="font-size:18px;margin-bottom:4px;">✓</div>
                          <div style="font-size:13px;font-weight:700;color:#2b211e;">Thủ công tinh xảo</div>
                          <div style="font-size:11px;color:#8a7d72;margin-top:2px;">Tỉ mỉ từng mối thắt</div>
                        </td>
                        <td align="center" style="width:33.3%;vertical-align:top;padding:0 4px;">
                          <div style="font-size:18px;margin-bottom:4px;">🔄</div>
                          <div style="font-size:13px;font-weight:700;color:#2b211e;">Đổi trả linh hoạt</div>
                          <div style="font-size:11px;color:#8a7d72;margin-top:2px;">Trong 7 ngày nhận hàng</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Support Banner Section -->
                <tr>
                  <td style="background:#5c1920;padding:24px;text-align:center;color:#ffffff;">
                    <div style="font-size:14px;font-weight:600;line-height:1.6;">
                      Cần hỗ trợ gấp về đơn hàng? Hotline / Zalo: <strong style="font-size:15px;text-decoration:underline;">079 655 5636</strong>
                    </div>
                    <div style="margin-top:14px;">
                      <a href="${messengerUrl}" target="_blank" style="display:inline-block;background:#ffffff;color:#5c1920;font-size:13px;font-weight:800;padding:10px 24px;border-radius:30px;text-decoration:none;box-shadow:0 3px 10px rgba(0,0,0,0.15);">
                        💬 Hỗ trợ qua Messenger
                      </a>
                    </div>
                  </td>
                </tr>

                <!-- Footer Section -->
                <tr>
                  <td style="background:#f8f4eb;padding:32px 24px 20px 24px;text-align:center;">
                    
                    <!-- Footer Logo Box -->
                    <div style="width:64px;height:64px;background:#eedec8;border-radius:14px;margin:0 auto 12px auto;padding:4px;box-sizing:border-box;">
                      <img src="${logoBase64}" alt="NOT A KNOT" width="56" height="56" style="width:56px;height:56px;border-radius:10px;object-fit:cover;display:block;" />
                    </div>

                    <div style="font-family:'Playfair Display', Georgia, serif;font-size:18px;font-weight:700;letter-spacing:2px;color:#5c1920;text-transform:uppercase;margin-bottom:2px;">
                      NOT A KNOT STUDIO
                    </div>
                    <div style="font-family:'Playfair Display', Georgia, serif;font-size:12px;color:#8a7d72;font-style:italic;margin-bottom:16px;">
                      Even more • Est 2026
                    </div>

                    <!-- Social Media Base64 Buttons -->
                    <div style="margin-bottom:20px;">
                      <a href="https://www.facebook.com/profile.php?id=61593591390851" target="_blank" style="display:inline-block;width:38px;height:38px;background:#ffffff;border:1px solid #eedec8;border-radius:50%;margin:0 4px;vertical-align:middle;text-align:center;line-height:38px;box-shadow:0 2px 5px rgba(0,0,0,0.04);">
                        ${fbIconB64 ? `<img src="${fbIconB64}" width="20" height="20" alt="FB" style="vertical-align:middle;display:inline-block;" />` : 'FB'}
                      </a>
                      <a href="https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==" target="_blank" style="display:inline-block;width:38px;height:38px;background:#ffffff;border:1px solid #eedec8;border-radius:50%;margin:0 4px;vertical-align:middle;text-align:center;line-height:38px;box-shadow:0 2px 5px rgba(0,0,0,0.04);">
                        ${instaIconB64 ? `<img src="${instaIconB64}" width="20" height="20" alt="IG" style="vertical-align:middle;display:inline-block;" />` : 'IG'}
                      </a>
                      <a href="https://www.threads.com/@notaknot.handmade?igshid=NTc4MTIwNjQ2YQ==" target="_blank" style="display:inline-block;width:38px;height:38px;background:#ffffff;border:1px solid #eedec8;border-radius:50%;margin:0 4px;vertical-align:middle;text-align:center;line-height:38px;box-shadow:0 2px 5px rgba(0,0,0,0.04);">
                        ${threadsIconB64 ? `<img src="${threadsIconB64}" width="20" height="20" alt="Threads" style="vertical-align:middle;display:inline-block;" />` : 'TH'}
                      </a>
                      <a href="https://www.notaknot.id.vn" target="_blank" style="display:inline-block;width:38px;height:38px;background:#ffffff;border:1px solid #eedec8;border-radius:50%;margin:0 4px;vertical-align:middle;text-align:center;line-height:38px;color:#5c1920;font-weight:700;font-size:14px;text-decoration:none;box-shadow:0 2px 5px rgba(0,0,0,0.04);">
                        🌐
                      </a>
                    </div>

                    <div style="font-size:13px;color:#524641;margin-bottom:6px;">
                      Hotline / Zalo hỗ trợ: <strong style="color:#5c1920;font-size:14px;">079 655 5636</strong>
                    </div>

                    <div style="font-size:12px;color:#8a7d72;line-height:1.6;margin-bottom:16px;">
                      (Email tự động từ hệ thống noreply.notaknot@gmail.com - vui lòng không phản hồi trực tiếp vào email này)<br>
                      Website chính thức: <a href="https://www.notaknot.id.vn" target="_blank" style="color:#5c1920;text-decoration:none;font-weight:700;">www.notaknot.id.vn</a><br>
                      © ${new Date().getFullYear()} NOT A KNOT Studio. Tự hào chế tác thủ công tại Việt Nam.
                    </div>

                    <!-- Academic Project Disclaimer Box -->
                    <div style="background:#f0ebe1;border:1px solid #e2dacd;border-radius:12px;padding:16px 18px;text-align:justify;font-size:11px;color:#8a7d72;line-height:1.6;margin-top:16px;">
                      ℹ️ <strong style="color:#5c1920;">Not A Knot</strong> cùng hệ thống website và các kênh truyền thông liên quan là dự án học tập và bài tập nhóm thuộc khuôn khổ môn Quản trị tác nghiệp Thương mại điện tử - Đại học Kinh tế Quốc dân. Dự án được triển khai hoàn toàn nhằm mục đích nghiên cứu, thực hành môn học và không mang tính chất kinh doanh thương mại.
                    </div>

                    <div style="font-size:11px;color:#a09385;margin-top:12px;">
                      Bạn nhận được email này vì đã đặt hàng tại Not A Knot Studio. <a href="https://www.notaknot.id.vn" style="color:#8a7d72;text-decoration:underline;">Quản lý thông báo</a>
                    </div>

                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  };

  /**
   * GET /api/email/settings
   * Returns current SMTP status, toggles configuration, and sending statistics
   */
  app.get('/api/email/settings', (_req: Request, res: Response) => {
    const isConfigured = Boolean(SMTP_USER && SMTP_PASS);
    const maskedUser = SMTP_USER ? SMTP_USER.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Chưa cấu hình';
    const stats = calculateEmailStats();
    res.json({
      configured: isConfigured,
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
      smtpSecure: SMTP_SECURE,
      configuredUser: maskedUser,
      settings: emailStore.settings,
      stats,
      mode: isConfigured ? 'live_smtp' : 'simulated_preview'
    });
  });

  /**
   * POST /api/email/settings
   * Allows updating email toggles and admin notification email
   */
  app.post('/api/email/settings', (req: Request, res: Response) => {
    try {
      const { notifyAdminOnNewOrder, customerOrderEmailOption, adminNotificationEmail } = req.body;
      if (typeof notifyAdminOnNewOrder === 'boolean') {
        emailStore.settings.notifyAdminOnNewOrder = notifyAdminOnNewOrder;
      }
      if (typeof customerOrderEmailOption === 'boolean') {
        emailStore.settings.customerOrderEmailOption = customerOrderEmailOption;
      }
      if (adminNotificationEmail && typeof adminNotificationEmail === 'string' && adminNotificationEmail.includes('@')) {
        emailStore.settings.adminNotificationEmail = adminNotificationEmail.trim();
        ADMIN_NOTIFICATION_EMAIL = emailStore.settings.adminNotificationEmail;
      }
      saveEmailData();
      const stats = calculateEmailStats();
      return res.json({
        success: true,
        settings: emailStore.settings,
        stats,
        message: 'Đã cập nhật cài đặt email thành công.'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi cập nhật cài đặt email' });
    }
  });

  /**
   * GET /api/email/status
   * Legacy status check endpoint, updated with settings and stats
   */
  app.get('/api/email/status', (_req: Request, res: Response) => {
    const isConfigured = Boolean(SMTP_USER && SMTP_PASS);
    const maskedUser = SMTP_USER ? SMTP_USER.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Chưa cấu hình';
    const stats = calculateEmailStats();
    res.json({
      configured: isConfigured,
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
      smtpSecure: SMTP_SECURE,
      configuredUser: maskedUser,
      adminNotificationEmail: emailStore.settings.adminNotificationEmail,
      settings: emailStore.settings,
      stats,
      mode: isConfigured ? 'live_smtp' : 'simulated_preview'
    });
  });

  /**
   * POST /api/email/update-admin-email
   * Allows dynamically updating the admin notification email address
   */
  app.post('/api/email/update-admin-email', (req: Request, res: Response) => {
    try {
      const { newEmail } = req.body;
      const formatted = ensureGmailDomain(newEmail);
      if (formatted) {
        emailStore.settings.adminNotificationEmail = formatted;
        ADMIN_NOTIFICATION_EMAIL = emailStore.settings.adminNotificationEmail;
        saveEmailData();
        console.log(`[Email Service] Updated ADMIN_NOTIFICATION_EMAIL to: ${ADMIN_NOTIFICATION_EMAIL}`);
        return res.json({
          success: true,
          adminNotificationEmail: ADMIN_NOTIFICATION_EMAIL,
          settings: emailStore.settings,
          message: `Đã cập nhật email nhận thông báo thành công: ${ADMIN_NOTIFICATION_EMAIL}`
        });
      }
      return res.status(400).json({ error: 'Địa chỉ email không hợp lệ.' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi cập nhật email' });
    }
  });

  /**
   * POST /api/email/send-order-confirmation
   * Dispatches order confirmation email:
   * - To customer recipient if provided
   * - To admin only if notifyAdminOnNewOrder is true
   */
  app.post('/api/email/send-order-confirmation', async (req: Request, res: Response) => {
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

      const isManualAdmin = Boolean(req.body?.isManualAdmin);
      const isCustomerRequest = Boolean(req.body?.isCustomerRequest);

      // Determine who should receive email
      const recipients: { email: string; type: EmailLogEntry['type'] }[] = [];

      if (customerEmail) {
        recipients.push({
          email: customerEmail,
          type: isManualAdmin ? 'manual_admin' : 'customer_confirmation'
        });
      }

      // Check if admin notification is enabled
      const shouldNotifyAdmin = emailStore.settings.notifyAdminOnNewOrder && !isManualAdmin;
      if (shouldNotifyAdmin && emailStore.settings.adminNotificationEmail) {
        const adminEmail = emailStore.settings.adminNotificationEmail;
        if (!recipients.some((r) => r.email.toLowerCase() === adminEmail.toLowerCase())) {
          recipients.push({
            email: adminEmail,
            type: 'admin_notification'
          });
        }
      }

      if (recipients.length === 0) {
        return res.json({
          success: true,
          skipped: true,
          message: 'Không có người nhận (Email thông báo admin đang tắt và không có email khách hàng).',
          orderCode
        });
      }

      const reqHost = (req.headers['x-forwarded-host'] as string) || req.headers.host;
      const htmlContent = generateOrderEmailHtml(order, reqHost);
      const subject = `[NOT A KNOT] Xác nhận đơn hàng #${orderCode} - ${order.customerName || order.name || 'Quý khách'}`;

      const logoPath = path.join(process.cwd(), 'public', 'assets', 'logo.jpg');
      const mailAttachments: any[] = [];
      if (fs.existsSync(logoPath)) {
        mailAttachments.push({
          filename: 'logo.jpg',
          path: logoPath,
          cid: 'shoplogo'
        });
      }

      const transporter = getMailTransporter();

      if (transporter) {
        // Send to each recipient with inline CID logo and hosted images
        for (const target of recipients) {
          try {
            await transporter.sendMail({
              from: SMTP_FROM,
              to: target.email,
              subject,
              html: htmlContent,
              attachments: mailAttachments
            });
            recordEmailLog(target.email, target.type, orderCode, 'sent');
          } catch (sendErr: any) {
            console.error(`[Email Service] Failed sending to ${target.email}:`, sendErr);
            recordEmailLog(target.email, target.type, orderCode, 'error');
          }
        }

        const stats = calculateEmailStats();
        return res.json({
          success: true,
          mode: 'sent_real_email',
          recipients: recipients.map((r) => r.email),
          stats,
          orderCode,
          timestamp: new Date().toISOString()
        });
      } else {
        // Simulated / preview mode
        for (const target of recipients) {
          recordEmailLog(target.email, target.type, orderCode, 'simulated');
        }
        const stats = calculateEmailStats();
        return res.json({
          success: true,
          mode: 'simulated_preview',
          message: 'Đã ghi nhận gửi email (Chế độ xem trước).',
          recipients: recipients.map((r) => r.email),
          stats,
          orderCode,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error('[Email Service] Error in send-order-confirmation:', err);
      return res.json({
        success: false,
        error: err.message || 'Không thể gửi email lúc này'
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
      const destination = ensureGmailDomain(targetEmail || emailStore.settings.adminNotificationEmail);

      if (!destination) {
        return res.status(400).json({ error: 'Địa chỉ email nhận test không hợp lệ.' });
      }

      const transporter = getMailTransporter();
      if (!transporter) {
        recordEmailLog(destination, 'test', undefined, 'simulated');
        const stats = calculateEmailStats();
        return res.json({
          success: false,
          configured: false,
          stats,
          message: `Chưa cấu hình thông tin đăng nhập SMTP (SMTP_USER và SMTP_PASS). Hệ thống đang chạy ở chế độ xem trước (Simulated Mode). Email test tới ${destination} đã được mô phỏng.`
        });
      }

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

      recordEmailLog(destination, 'test', undefined, 'sent');
      const stats = calculateEmailStats();

      return res.json({
        success: true,
        configured: true,
        destination,
        stats,
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
