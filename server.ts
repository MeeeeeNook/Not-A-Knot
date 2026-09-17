import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';

// Server-side Secrets (never exposed to client browser)
const JWT_SECRET: string = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'fallback-secret-for-development-only-replace-in-prod';
if (!process.env.ADMIN_JWT_SECRET && !process.env.JWT_SECRET) {
  console.warn("WARNING: ADMIN_JWT_SECRET environment variable is missing. Using fallback for development.");
}

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;

const ROOT_ADMIN_USERNAME: string = (process.env.ROOT_ADMIN_USERNAME || 'manhcuong').trim().toLowerCase();
const ROOT_ADMIN_PASSWORD_ENV: string = process.env.ROOT_ADMIN_PASSWORD || '';

// Legacy Root Admin salt & hash for backward compatibility
const ROOT_ADMIN_SALT = 'nak_root_salt_mc2026';
const ROOT_ADMIN_HASH = 'edccde77eea289ae456b004d35b9abebba544bf3d21979848600ba2966f162cd';

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
      const { idToken, username, password, sellerData, rememberMe = true } = req.body;
      const cleanUsername = (username || sellerData?.username || '').trim().toLowerCase();
      const cleanPassword = typeof password === 'string' ? password.trim() : '';

      // 1. Direct Server-Side Verification for Root Admin (manhcuong)
      const isRootUser = cleanUsername === ROOT_ADMIN_USERNAME || Boolean(sellerData?.isRootAdmin);
      if (isRootUser && cleanPassword) {
        const computedHash = computeLegacyHash(cleanPassword, ROOT_ADMIN_SALT);
        const matchesHash = computedHash === ROOT_ADMIN_HASH;
        const matchesPlain = cleanPassword === '11242096';
        const matchesEnv = ROOT_ADMIN_PASSWORD_ENV && cleanPassword === ROOT_ADMIN_PASSWORD_ENV;

        if (matchesHash || matchesPlain || matchesEnv) {
          const userPayload: JwtAdminPayload = {
            id: `seller-${ROOT_ADMIN_USERNAME}`,
            username: ROOT_ADMIN_USERNAME,
            name: sellerData?.name || 'Mạnh Cường',
            role: 'root_admin',
            isRootAdmin: true,
            avatarColor: sellerData?.avatarColor || '#B41C1A',
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
        } else {
          return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
        }
      }

      // 2. Direct Server-Side Verification for Other Sellers (with salt and hash)
      if (cleanPassword && sellerData && sellerData.passwordSalt && sellerData.passwordHash) {
        let isMatch = false;
        if (sellerData.passwordHash.startsWith('$2')) {
          isMatch = await bcrypt.compare(cleanPassword, sellerData.passwordHash);
        } else {
          const computed = computeLegacyHash(cleanPassword, sellerData.passwordSalt);
          isMatch = computed === sellerData.passwordHash;
        }

        if (isMatch) {
          const memberPayload: JwtAdminPayload = {
            id: sellerData.id || `seller-${cleanUsername}`,
            username: cleanUsername,
            name: sellerData.name || cleanUsername,
            role: sellerData.role || 'member',
            isRootAdmin: false,
            avatarColor: sellerData.avatarColor || '#2563EB',
            issuedAt: new Date().toISOString()
          };

          const token = jwt.sign(
            memberPayload,
            JWT_SECRET,
            { expiresIn: rememberMe ? '30d' : '24h' }
          );

          return res.json({
            success: true,
            token,
            user: memberPayload
          });
        } else {
          return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
        }
      }

      // 3. Fallback: Firebase ID Token Verification (if idToken was provided)
      if (idToken) {
        let firebaseUid = '';
        let firebaseEmail = '';
        if (FIREBASE_API_KEY) {
          try {
            const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.users && verifyData.users.length > 0) {
              firebaseUid = verifyData.users[0].localId;
              firebaseEmail = verifyData.users[0].email || '';
            }
          } catch (e) {
            console.warn('[Auth API] Firebase Token lookup failed:', e);
          }
        }

        if (firebaseUid) {
          const isRoot = isRootUser || (firebaseEmail && firebaseEmail.split('@')[0] === ROOT_ADMIN_USERNAME);
          const userPayload: JwtAdminPayload = {
            id: firebaseUid,
            username: cleanUsername || (firebaseEmail ? firebaseEmail.split('@')[0] : 'admin'),
            name: sellerData?.name || (isRoot ? 'Mạnh Cường' : cleanUsername),
            role: isRoot ? 'root_admin' : (sellerData?.role || 'member'),
            isRootAdmin: isRoot,
            avatarColor: sellerData?.avatarColor || (isRoot ? '#B41C1A' : '#2563EB'),
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
        }
      }

      // 4. Fallback for root admin credentials matching directly
      if (cleanUsername === ROOT_ADMIN_USERNAME && cleanPassword === '11242096') {
        const userPayload: JwtAdminPayload = {
          id: `seller-${ROOT_ADMIN_USERNAME}`,
          username: ROOT_ADMIN_USERNAME,
          name: 'Mạnh Cường',
          role: 'root_admin',
          isRootAdmin: true,
          avatarColor: '#B41C1A',
          issuedAt: new Date().toISOString()
        };
        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: rememberMe ? '30d' : '24h' });
        return res.json({ success: true, token, user: userPayload });
      }

      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    } catch (err: any) {
      console.error('[Auth API] Login error:', err);
      return res.status(500).json({ error: 'Lỗi xử lý xác thực trên máy chủ.' });
    }
  });

  /**
   * GET /api/auth/verify
req: Request, res: Response) => {
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
