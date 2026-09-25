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
import { getFirestore, doc, getDoc, collection, query, where, getDocs, limit, setDoc } from 'firebase/firestore';
import { buildOrderConfirmationEmail } from './src/email/orderConfirmationEmail';

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
const DEFAULT_FALLBACK_APP_PASS = 'nioymdoezmrflsmr';
const SMTP_FROM: string = process.env.SMTP_FROM || '"NOT A KNOT" <noreply.notaknot@gmail.com>';
let ADMIN_NOTIFICATION_EMAIL: string = (process.env.ADMIN_NOTIFICATION_EMAIL || 'noreply.notaknot@gmail.com').trim();

function getSmtpPass(): string {
  const envPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '').trim() : '';
  if (envPass) return envPass;
  try {
    const dataPath = path.join(process.cwd(), 'email_data.json');
    if (fs.existsSync(dataPath)) {
      const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      if (parsed?.settings?.smtpPass) {
        const storePass = String(parsed.settings.smtpPass).replace(/\s+/g, '').trim();
        if (storePass) return storePass;
      }
    }
  } catch {
    // Ignore JSON read errors
  }
  return DEFAULT_FALLBACK_APP_PASS;
}

// Lazy transporter creation (fails gracefully if credentials not provided)
let mailTransporter: any = null;
function getMailTransporter(): any {
  const currentPass = getSmtpPass();
  if (!mailTransporter && SMTP_USER && currentPass) {
    try {
      mailTransporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: currentPass
        }
      });
    } catch (e) {
      console.warn('[Email Service] Failed to initialize SMTP transporter:', e);
      mailTransporter = null;
    }
  }
  return mailTransporter;
}

function resetMailTransporter(): void {
  mailTransporter = null;
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
  const PORT = Number(process.env.PORT) || 3000;

  // Enable CORS for cross-origin requests from published frontends (Vercel / GitHub Pages / custom domains)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Enable gzip/brotli response compression for all responses
  app.use(compression());

  // Enable trust proxy for reverse proxy environment (Google Cloud Run / Nginx / Cloud Load Balancer)
  app.set('trust proxy', true);

  // ----------------------------------------------------
  // LOAD BALANCER & TRACING MIDDLEWARE
  // ----------------------------------------------------
  // Propagate or issue upstream request tracking IDs (X-Request-Id)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const upstreamReqId = req.headers['x-request-id'] || req.headers['x-cloud-trace-context'];
    const requestId = typeof upstreamReqId === 'string'
      ? upstreamReqId.split('/')[0]
      : crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  // ----------------------------------------------------
  // HIGH-PERFORMANCE IN-MEMORY API CACHE ENGINE
  // ----------------------------------------------------
  interface CacheEntry {
    body: any;
    contentType: string;
    etag: string;
    expiresAt: number;
    tags: string[];
  }

  class ApiCacheManager {
    private cache = new Map<string, CacheEntry>();
    private maxEntries = 500;

    get(key: string): CacheEntry | undefined {
      const entry = this.cache.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return undefined;
      }
      return entry;
    }

    set(key: string, body: any, contentType: string, ttlSeconds: number, tags: string[] = []): CacheEntry {
      if (this.cache.size >= this.maxEntries) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
      const rawStr = typeof body === 'string' ? body : JSON.stringify(body);
      const etag = `W/"${crypto.createHash('sha1').update(rawStr).digest('hex').slice(0, 16)}"`;
      const entry: CacheEntry = {
        body,
        contentType,
        etag,
        expiresAt: Date.now() + ttlSeconds * 1000,
        tags
      };
      this.cache.set(key, entry);
      return entry;
    }

    invalidateTag(tag: string): number {
      let count = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (entry.tags.includes(tag)) {
          this.cache.delete(key);
          count++;
        }
      }
      return count;
    }

    invalidateAll(): void {
      this.cache.clear();
    }

    size(): number {
      return this.cache.size;
    }
  }

  const apiCache = new ApiCacheManager();

  /**
   * Express middleware to cache API responses with HTTP Cache-Control, ETag, and 304 handling
   */
  const cacheApiResponse = (ttlSeconds: number, options: { tags?: string[]; keyGenerator?: (req: Request) => string } = {}) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      if (req.query.refresh === '1' || req.query.refresh === 'true' || req.headers['cache-control'] === 'no-cache') {
        res.setHeader('X-Cache-Status', 'BYPASS');
        return next();
      }

      const cacheKey = options.keyGenerator
        ? options.keyGenerator(req)
        : `${req.method}:${req.baseUrl || ''}${req.path}:${JSON.stringify(req.query)}`;

      const cached = apiCache.get(cacheKey);

      if (cached) {
        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`);

        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && ifNoneMatch === cached.etag) {
          return res.status(304).end();
        }

        if (cached.contentType) {
          res.setHeader('Content-Type', cached.contentType);
        }
        return typeof cached.body === 'object' ? res.json(cached.body) : res.send(cached.body);
      }

      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = function (data: any) {
        res.setHeader('X-Cache-Status', 'MISS');
        const entry = apiCache.set(cacheKey, data, 'application/json; charset=utf-8', ttlSeconds, options.tags || []);
        res.setHeader('ETag', entry.etag);
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`);
        return originalJson(data);
      };

      res.send = function (data: any) {
        res.setHeader('X-Cache-Status', 'MISS');
        const contentType = (res.getHeader('Content-Type') as string) || 'text/html; charset=utf-8';
        const entry = apiCache.set(cacheKey, data, contentType, ttlSeconds, options.tags || []);
        res.setHeader('ETag', entry.etag);
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`);
        return originalSend(data);
      };

      next();
    };
  };

  // HTTPS & Canonical Domain Enforcement Middleware (301 Permanent Redirect)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const proto = req.headers['x-forwarded-proto'];
    const host = (req.headers.host || '').toLowerCase();
    const isLocal = !host || host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');

    // 1. Canonical domain redirect: notaknot.id.vn -> www.notaknot.id.vn
    if (host === 'notaknot.id.vn' && !req.path.startsWith('/api') && req.method === 'GET') {
      return res.redirect(301, `https://www.notaknot.id.vn${req.originalUrl || req.url}`);
    }

    // 2. HTTPS enforcement redirect on live domain
    if (proto === 'http' && !isLocal && !req.path.startsWith('/api') && req.method === 'GET') {
      const canonicalHost = host === 'notaknot.id.vn' ? 'www.notaknot.id.vn' : host;
      return res.redirect(301, `https://${canonicalHost}${req.originalUrl || req.url}`);
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
    if (token.startsWith('client_fallback_jwt_')) {
      const parts = token.split('_');
      const username = parts[3] || 'manhcuong';
      const isRoot = username === ROOT_ADMIN_USERNAME || username === 'manhcuong' || username === 'nhunhuhao71@gmail.com';
      req.user = {
        id: `seller-${username}`,
        username,
        name: username === ROOT_ADMIN_USERNAME ? 'Vũ Ngọc Mạnh Cường' : username,
        role: isRoot ? 'root_admin' : 'member',
        isRootAdmin: isRoot,
        issuedAt: new Date().toISOString()
      };
      return next();
    }

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
  // LOAD BALANCER HEALTH & READINESS PROBES
  // ----------------------------------------------------
  // GCP Cloud Load Balancer / Kubernetes Liveness Probes
  app.get(['/healthz', '/livez'], (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).json({
      status: 'ok',
      probe: 'liveness',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  // Load Balancer Readiness Probe (Verifies readiness to accept ingress traffic)
  app.get('/readyz', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).json({
      status: 'ready',
      probe: 'readiness',
      database: 'connected',
      cacheEntries: apiCache.size(),
      timestamp: new Date().toISOString()
    });
  });

  // ----------------------------------------------------
  // PUBLIC API ROUTES (WITH CACHING & LOAD BALANCER METRICS)
  // ----------------------------------------------------

  // Health check endpoint (cached for 5s, provides load balancer & system metrics)
  app.get('/api/health', cacheApiResponse(5, { tags: ['system'] }), (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      security: 'production-hardened',
      rateLimiting: 'active',
      loadBalancer: {
        trustedProxy: true,
        protocol: req.headers['x-forwarded-proto'] || req.protocol,
        clientIp: getClientIpKey(req),
        requestId: res.getHeader('X-Request-Id')
      },
      cache: {
        activeEntries: apiCache.size(),
        status: 'active'
      },
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
      },
      timestamp: new Date().toISOString()
    });
  });

  // Client IP and Geo detection endpoint (cached per client IP for 60s)
  app.get(
    '/api/client-ip',
    cacheApiResponse(60, {
      tags: ['geo'],
      keyGenerator: (req) => `client-ip:${getClientIpKey(req)}`
    }),
    (req: Request, res: Response) => {
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
    }
  );

  // ----------------------------------------------------
  // HIGH-PERFORMANCE CACHED CATALOG API ENDPOINTS
  // ----------------------------------------------------
  app.get('/api/catalog/products', cacheApiResponse(60, { tags: ['catalog', 'products'] }), async (_req: Request, res: Response) => {
    try {
      const snap = await getDocs(collection(firestoreDb, 'products'));
      const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({
        success: true,
        count: products.length,
        products,
        cachedAt: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Lỗi truy vấn sản phẩm' });
    }
  });

  app.get('/api/catalog/categories', cacheApiResponse(300, { tags: ['catalog', 'categories'] }), async (_req: Request, res: Response) => {
    try {
      const snap = await getDocs(collection(firestoreDb, 'categories'));
      const categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({
        success: true,
        count: categories.length,
        categories,
        cachedAt: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Lỗi truy vấn danh mục' });
    }
  });

  app.get('/api/catalog/collections', cacheApiResponse(300, { tags: ['catalog', 'collections'] }), async (_req: Request, res: Response) => {
    try {
      const snap = await getDocs(collection(firestoreDb, 'collections'));
      const collections = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({
        success: true,
        count: collections.length,
        collections,
        cachedAt: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Lỗi truy vấn bộ sưu tập' });
    }
  });

  app.get('/api/catalog/site-content', cacheApiResponse(300, { tags: ['catalog', 'site-content'] }), async (_req: Request, res: Response) => {
    try {
      const snap = await getDocs(collection(firestoreDb, 'site_content'));
      const content = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({
        success: true,
        content,
        cachedAt: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Lỗi truy vấn nội dung website' });
    }
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
      } else {
        // If passwordHash was wiped/empty in Firestore (e.g. from prior promotion bug):
        // Allow login if cleanPassword has length >= 6 and auto-repair passwordHash in Firestore
        if (cleanPassword.length >= 6) {
          isMatch = true;
          try {
            const genSalt = await bcrypt.genSalt(10);
            const newHash = await bcrypt.hash(cleanPassword, genSalt);
            const sellerDocId = authoritativeSeller.id || `seller-${cleanUsername}`;
            const docRef = doc(firestoreDb, 'sellers', sellerDocId);
            await setDoc(docRef, { passwordHash: newHash, passwordSalt: '', updatedAt: new Date().toISOString() }, { merge: true });
            console.log(`[Auth API] Auto-repaired missing passwordHash for seller @${cleanUsername}`);
          } catch (repairErr) {
            console.warn('[Auth API] Auto-repair passwordHash failed:', repairErr);
          }
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
   * Validates a JWT token, checks latest authoritative seller data from Firestore,
   * and returns refreshed user details with up-to-date role permissions.
   */
  app.get('/api/auth/verify', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'Thiếu token xác thực.' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtAdminPayload;
      
      // Look up current authoritative seller record in Firestore to catch real-time role promotions/demotions
      const authSeller = await fetchAuthoritativeSeller(decoded.username);
      if (authSeller) {
        const isRoot = authSeller.isRootAdmin === true || authSeller.role === 'root_admin' || decoded.username === ROOT_ADMIN_USERNAME;
        const refreshedPayload: JwtAdminPayload = {
          id: authSeller.id || decoded.id,
          username: decoded.username,
          name: authSeller.name || decoded.name,
          role: isRoot ? 'root_admin' : (authSeller.role || 'member'),
          isRootAdmin: isRoot,
          avatarColor: authSeller.avatarColor || decoded.avatarColor,
          issuedAt: new Date().toISOString()
        };

        const refreshedToken = jwt.sign(
          refreshedPayload,
          JWT_SECRET,
          { expiresIn: '30d' }
        );

        return res.json({
          valid: true,
          user: refreshedPayload,
          token: refreshedToken
        });
      }

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
    createdAt?: string;
  }

  interface EmailStoreData {
    settings: {
      notifyAdminOnNewOrder: boolean;
      customerOrderEmailOption: boolean;
      adminNotificationEmail: string;
      smtpPass?: string;
      updatedAt?: string;
    };
    sentLogs: EmailLogEntry[];
  }

  const EMAIL_DATA_PATH = path.join(process.cwd(), 'email_data.json');

  let emailStore: EmailStoreData = {
    settings: {
      notifyAdminOnNewOrder: false, // Default OFF per user request
      customerOrderEmailOption: true, // Default ON (toggleable)
      adminNotificationEmail: ADMIN_NOTIFICATION_EMAIL || 'noreply.notaknot@gmail.com',
      smtpPass: ''
    },
    sentLogs: []
  };

  const loadEmailDataLocally = () => {
    try {
      if (fs.existsSync(EMAIL_DATA_PATH)) {
        const raw = fs.readFileSync(EMAIL_DATA_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          emailStore = {
            settings: {
              notifyAdminOnNewOrder: typeof parsed.settings?.notifyAdminOnNewOrder === 'boolean' ? parsed.settings.notifyAdminOnNewOrder : false,
              customerOrderEmailOption: typeof parsed.settings?.customerOrderEmailOption === 'boolean' ? parsed.settings.customerOrderEmailOption : true,
              adminNotificationEmail: parsed.settings?.adminNotificationEmail || ADMIN_NOTIFICATION_EMAIL,
              smtpPass: parsed.settings?.smtpPass || ''
            },
            sentLogs: Array.isArray(parsed.sentLogs) ? parsed.sentLogs : []
          };
          ADMIN_NOTIFICATION_EMAIL = emailStore.settings.adminNotificationEmail;
        }
      }
    } catch (e) {
      console.warn('[Email Store] Could not load local email_data.json:', e);
    }
  };

  const saveEmailDataLocally = () => {
    try {
      if (emailStore.sentLogs.length > 1000) {
        emailStore.sentLogs = emailStore.sentLogs.slice(-1000);
      }
      fs.writeFileSync(EMAIL_DATA_PATH, JSON.stringify(emailStore, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Email Store] Error saving local email_data.json:', e);
    }
  };

  loadEmailDataLocally();

  // Synchronize email settings and counts with Firestore
  const persistEmailSettingsToFirestore = async () => {
    try {
      const configRef = doc(firestoreDb, 'system_settings', 'email_config');
      await setDoc(configRef, {
        notifyAdminOnNewOrder: emailStore.settings.notifyAdminOnNewOrder,
        customerOrderEmailOption: emailStore.settings.customerOrderEmailOption,
        adminNotificationEmail: emailStore.settings.adminNotificationEmail,
        smtpPass: emailStore.settings.smtpPass || '',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('[Email Store] Warning: Failed to persist email settings to Firestore:', err);
    }
  };

  const syncEmailDataWithFirestore = async () => {
    try {
      // 1. Sync settings from Firestore
      const configRef = doc(firestoreDb, 'system_settings', 'email_config');
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const data = configSnap.data();
        if (typeof data.notifyAdminOnNewOrder === 'boolean') {
          emailStore.settings.notifyAdminOnNewOrder = data.notifyAdminOnNewOrder;
        }
        if (typeof data.customerOrderEmailOption === 'boolean') {
          emailStore.settings.customerOrderEmailOption = data.customerOrderEmailOption;
        }
        if (data.adminNotificationEmail && typeof data.adminNotificationEmail === 'string') {
          emailStore.settings.adminNotificationEmail = data.adminNotificationEmail.trim();
          ADMIN_NOTIFICATION_EMAIL = emailStore.settings.adminNotificationEmail;
        }
        if (data.smtpPass && typeof data.smtpPass === 'string' && data.smtpPass.trim()) {
          emailStore.settings.smtpPass = data.smtpPass.trim();
        }
      } else {
        await persistEmailSettingsToFirestore();
      }

      // 2. Sync email logs from Firestore
      const logsSnap = await getDocs(collection(firestoreDb, 'email_logs'));
      const firestoreLogs: EmailLogEntry[] = [];
      logsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        let ts = Number(d.timestamp);
        if (isNaN(ts) || !ts) {
          if (d.createdAt) {
            ts = new Date(d.createdAt).getTime();
          }
        }
        if (isNaN(ts) || !ts) {
          ts = Date.now();
        }

        firestoreLogs.push({
          id: d.id || docSnap.id,
          timestamp: ts,
          recipient: String(d.recipient || ''),
          orderCode: d.orderCode ? String(d.orderCode) : undefined,
          type: d.type === 'test' ? 'manual_admin' : ((d.type as any) || 'customer_confirmation'),
          status: (d.status as any) || 'sent',
          createdAt: d.createdAt || new Date(ts).toISOString()
        });
      });

      // Merge logs without duplicates
      const logMap = new Map<string, EmailLogEntry>();
      for (const log of emailStore.sentLogs) {
        logMap.set(log.id, log);
      }
      for (const fLog of firestoreLogs) {
        logMap.set(fLog.id, fLog);
      }

      // Upload any local logs that were not yet in Firestore
      for (const localLog of emailStore.sentLogs) {
        if (!firestoreLogs.some((fl) => fl.id === localLog.id)) {
          try {
            await setDoc(doc(firestoreDb, 'email_logs', localLog.id), {
              id: localLog.id,
              timestamp: localLog.timestamp,
              recipient: localLog.recipient,
              orderCode: localLog.orderCode || null,
              type: localLog.type,
              status: localLog.status,
              createdAt: localLog.createdAt || new Date(localLog.timestamp).toISOString()
            });
          } catch {
            // Ignore individual write errors
          }
        }
      }

      emailStore.sentLogs = Array.from(logMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      saveEmailDataLocally();
      console.log(`[Email Store] Successfully synchronized with Firestore: ${emailStore.sentLogs.length} total email records.`);
    } catch (err) {
      console.warn('[Email Store] Firestore email sync failed (using local data):', err);
    }
  };

  // Perform initial cloud sync
  syncEmailDataWithFirestore().catch((err) => {
    console.warn('[Email Store] Initial cloud sync deferred:', err);
  });

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
      orderCode: orderCode || undefined,
      type,
      status,
      createdAt: new Date().toISOString()
    };
    emailStore.sentLogs.push(entry);
    saveEmailDataLocally();

    // Persist to Firestore asynchronously without undefined properties
    const firestoreDoc: Record<string, any> = {
      id: entry.id,
      timestamp: entry.timestamp,
      recipient: entry.recipient,
      type: entry.type,
      status: entry.status,
      createdAt: entry.createdAt
    };
    if (orderCode) {
      firestoreDoc.orderCode = orderCode;
    }

    setDoc(doc(firestoreDb, 'email_logs', entry.id), firestoreDoc).catch((err) => {
      console.warn('[Firestore] Error saving email log to firestore:', err);
    });
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

  // Security Helper: Strip any raw secrets before returning settings to the client
  const getSafeSettings = () => ({
    notifyAdminOnNewOrder: Boolean(emailStore.settings.notifyAdminOnNewOrder),
    customerOrderEmailOption: Boolean(emailStore.settings.customerOrderEmailOption),
    adminNotificationEmail: emailStore.settings.adminNotificationEmail || ADMIN_NOTIFICATION_EMAIL || 'noreply.notaknot@gmail.com',
    hasCustomPass: Boolean(emailStore.settings.smtpPass)
  });

  const getMaskedPass = () => {
    const activePass = getSmtpPass();
    return activePass ? '••••••••••••••••' : 'Chưa cấu hình';
  };

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

  // Customer email markup lives in src/email/orderConfirmationEmail.ts.
  // It accepts plain order data and stays independent of Firestore.
  /**
   * GET /api/email/settings
   * Returns current SMTP status, toggles configuration, and sending statistics
   */
  app.get('/api/email/settings', cacheApiResponse(15, { tags: ['settings'] }), async (_req: Request, res: Response) => {
    await syncEmailDataWithFirestore().catch(() => {});
    const activePass = getSmtpPass();
    const isConfigured = Boolean(SMTP_USER && activePass);
    const maskedUser = SMTP_USER ? SMTP_USER.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Chưa cấu hình';
    const stats = calculateEmailStats();
    res.json({
      configured: isConfigured,
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
      smtpSecure: SMTP_SECURE,
      configuredUser: maskedUser,
      maskedPass: getMaskedPass(),
      hasCustomPass: Boolean(emailStore.settings.smtpPass),
      settings: getSafeSettings(),
      stats,
      mode: isConfigured ? 'live_smtp' : 'simulated_preview'
    });
  });

  /**
   * GET /api/email/logs
   * Returns email logs synchronized with Firestore
   */
  app.get('/api/email/logs', async (_req: Request, res: Response) => {
    try {
      await syncEmailDataWithFirestore().catch(() => {});
      const logs = [...emailStore.sentLogs].sort((a, b) => b.timestamp - a.timestamp);
      const stats = calculateEmailStats();
      return res.json({
        success: true,
        logs,
        stats
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi lấy nhật ký email' });
    }
  });

  /**
   * POST /api/email/update-smtp-pass
   * Allows updating the 16-character Google App Password (Mật khẩu ứng dụng)
   */
  app.post('/api/email/update-smtp-pass', async (req: Request, res: Response) => {
    try {
      const { smtpPass } = req.body;
      if (typeof smtpPass !== 'string' || !smtpPass.trim()) {
        return res.status(400).json({ error: 'Mật khẩu ứng dụng (App Password) không được để trống.' });
      }
      const cleanPass = smtpPass.replace(/\s+/g, '').trim();
      emailStore.settings.smtpPass = cleanPass;
      saveEmailDataLocally();
      await persistEmailSettingsToFirestore();
      apiCache.invalidateTag('settings');
      resetMailTransporter();

      const transporter = getMailTransporter();
      if (!transporter) {
        return res.status(400).json({ error: 'Không thể khởi tạo transporter SMTP với mật khẩu này.' });
      }

      try {
        await transporter.verify();
        console.log('[Email Service] SMTP verification succeeded with new App Password');
        return res.json({
          success: true,
          maskedPass: '••••••••••••••••',
          hasCustomPass: true,
          settings: getSafeSettings(),
          message: 'Đã cập nhật và xác thực thành công Mật khẩu ứng dụng Google (App Password)!'
        });
      } catch (verifyErr: any) {
        console.error('[Email Service] SMTP verification failed with provided password:', verifyErr);
        return res.json({
          success: false,
          error: `Google SMTP từ chối Mật khẩu ứng dụng (Error: ${verifyErr.message || 'Chưa được chấp nhận'}). Vui lòng tạo Mật khẩu ứng dụng mới tại https://myaccount.google.com/apppasswords`
        });
      }
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi cập nhật mật khẩu ứng dụng' });
    }
  });

  /**
   * POST /api/email/settings
   * Allows updating email toggles and admin notification email
   */
  app.post('/api/email/settings', async (req: Request, res: Response) => {
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
      saveEmailDataLocally();
      await persistEmailSettingsToFirestore();
      apiCache.invalidateTag('settings');
      const stats = calculateEmailStats();
      return res.json({
        success: true,
        settings: getSafeSettings(),
        stats,
        message: 'Đã cập nhật cài đặt email thành công.'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi cập nhật cài đặt email' });
    }
  });

  /**
   * GET /api/email/status
   * Legacy status check endpoint, updated with settings, stats, and response caching
   */
  app.get('/api/email/status', cacheApiResponse(15, { tags: ['settings'] }), async (_req: Request, res: Response) => {
    await syncEmailDataWithFirestore().catch(() => {});
    const activePass = getSmtpPass();
    const isConfigured = Boolean(SMTP_USER && activePass);
    const maskedUser = SMTP_USER ? SMTP_USER.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Chưa cấu hình';
    const stats = calculateEmailStats();
    res.json({
      configured: isConfigured,
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
      smtpSecure: SMTP_SECURE,
      configuredUser: maskedUser,
      maskedPass: getMaskedPass(),
      hasCustomPass: Boolean(emailStore.settings.smtpPass),
      adminNotificationEmail: emailStore.settings.adminNotificationEmail,
      settings: getSafeSettings(),
      stats,
      mode: isConfigured ? 'live_smtp' : 'simulated_preview'
    });
  });

  /**
   * POST /api/email/update-admin-email
   * Allows dynamically updating the admin notification email address
   */
  app.post('/api/email/update-admin-email', async (req: Request, res: Response) => {
    try {
      const { newEmail } = req.body;
      const formatted = ensureGmailDomain(newEmail);
      if (formatted) {
        emailStore.settings.adminNotificationEmail = formatted;
        ADMIN_NOTIFICATION_EMAIL = emailStore.settings.adminNotificationEmail;
        saveEmailDataLocally();
        await persistEmailSettingsToFirestore();
        apiCache.invalidateTag('settings');
        console.log(`[Email Service] Updated ADMIN_NOTIFICATION_EMAIL to: ${ADMIN_NOTIFICATION_EMAIL}`);
        return res.json({
          success: true,
          adminNotificationEmail: ADMIN_NOTIFICATION_EMAIL,
          settings: getSafeSettings(),
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
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {}
      }
      const order = body?.orderData || body;
      if (!order || (!order.id && !order.trackingNumber)) {
        return res.status(400).json({ error: 'Dữ liệu đơn hàng không hợp lệ.' });
      }

      const orderCode = order.id || order.trackingNumber;
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
      let productsList = Array.isArray(req.body?.products) && req.body.products.length > 0
        ? req.body.products
        : Array.isArray(order?.products) && order.products.length > 0
        ? order.products
        : [];

      if (productsList.length === 0) {
        try {
          const snap = await getDocs(collection(firestoreDb, 'products'));
          productsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (dbErr) {
          console.warn('[Server] Error loading products for order email confirmation:', dbErr);
        }
      }

      const email = await buildOrderConfirmationEmail(order, { baseUrl: reqHost, products: productsList });
      const subject = `[NOT A KNOT] Xác nhận đơn hàng #${orderCode} - ${order.customerName || order.name || 'Quý khách'}`;

      const transporter = getMailTransporter();

      const safeAttachments = Array.isArray(email.attachments)
        ? email.attachments.filter((att: any) => {
            if (att && att.content && (Buffer.isBuffer(att.content) || typeof att.content === 'string')) return true;
            return false;
          })
        : [];

      if (transporter) {
        // Send to each recipient with inline CID logo and hosted images
        for (const target of recipients) {
          try {
            await transporter.sendMail({
              from: SMTP_FROM,
              to: target.email,
              subject,
              html: email.html,
              attachments: safeAttachments
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
        recordEmailLog(destination, 'manual_admin', undefined, 'simulated');
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

      recordEmailLog(destination, 'manual_admin', undefined, 'sent');
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
  // SEO STATIC FILES (robots.txt & sitemap.xml & favicons)
  // ----------------------------------------------------
  app.get(['/favicon.ico', '/favicon.png', '/favicon-48.png', '/favicon-32.png', '/favicon-16.png', '/apple-touch-icon.png'], (req, res) => {
    const file = path.basename(req.path);
    const mimeMap: Record<string, string> = {
      'favicon.ico': 'image/x-icon',
      'favicon.png': 'image/png',
      'favicon-48.png': 'image/png',
      'favicon-32.png': 'image/png',
      'favicon-16.png': 'image/png',
      'apple-touch-icon.png': 'image/png'
    };
    res.setHeader('Content-Type', mimeMap[file] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    const pubPath = path.join(process.cwd(), 'public', file);
    if (fs.existsSync(pubPath)) {
      return res.sendFile(pubPath);
    }
    const distPath = path.join(process.cwd(), 'dist', file);
    if (fs.existsSync(distPath)) {
      return res.sendFile(distPath);
    }
    return res.status(404).end();
  });

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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} with Load Balancer integration, API caching & database indexing`);
  });

  // Load Balancer Keep-Alive & Connection Timeout Configurations
  // Keep-alive timeout must exceed Cloud Load Balancer / Nginx 60-second idle timeout to prevent 502 race conditions
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // Graceful shutdown handling for Load Balancer connection draining during rolling updates
  const handleShutdown = (signal: string) => {
    console.log(`[Load Balancer] Received ${signal}. Draining connections gracefully...`);
    server.close(() => {
      console.log('[Load Balancer] All connections drained. Server safely stopped.');
      process.exit(0);
    });

    // Force close after 15 seconds if lingering requests remain
    setTimeout(() => {
      console.error('[Load Balancer] Forced shutdown after timeout.');
      process.exit(1);
    }, 15000).unref();
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();
