import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { initializeApp as initClientApp, getApps as getClientApps, getApp as getClientApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore as getClientFirestore, doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';

type App = any;
type ApiRequest = any;
type ApiResponse = any;

// ----------------------------------------------------
// FIREBASE ADMIN INITIALIZATION (SINGLETON)
// ----------------------------------------------------
let adminFirestoreInstance: Firestore | null = null;

function hasAdminCredentials(): boolean {
  return Boolean(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

function getAdminDb(): Firestore {
  if (adminFirestoreInstance) {
    return adminFirestoreInstance;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'jittery-study-nzp2g';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const databaseId = process.env.FIREBASE_DATABASE_ID || 'ai-studio-remixremixnotakn-6b882779-1f6a-407c-af44-7b468092c95f';

  let app: App;
  const existingApps = getApps();

  if (existingApps.length > 0) {
    app = existingApps[0];
  } else if (clientEmail && privateKey) {
    // Handle escaped newline strings and wrapping quotes from environment variables
    let cleanPrivateKey = privateKey.trim();
    if (cleanPrivateKey.startsWith('"') && cleanPrivateKey.endsWith('"')) {
      cleanPrivateKey = cleanPrivateKey.slice(1, -1);
    }
    cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');

    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: cleanPrivateKey,
      }),
      projectId,
    });
  } else {
    app = initializeApp({ projectId });
  }

  adminFirestoreInstance = getFirestore(app, databaseId);
  return adminFirestoreInstance;
}

// ----------------------------------------------------
// FIREBASE AUTH SERVICE BOT (ORGANIZATION POLICY BYPASS)
// ----------------------------------------------------
const firebaseClientConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDpg7yJZaMXGaGtbLWtX12KYmqt311XFoI",
  authDomain: "jittery-study-nzp2g.firebaseapp.com",
  projectId: "jittery-study-nzp2g",
  storageBucket: "jittery-study-nzp2g.firebasestorage.app",
  messagingSenderId: "23301458119",
  appId: "1:23301458119:web:f7ee271f42bc11fe0216e2"
};

let clientDbInstance: any = null;
let clientAuthInstance: any = null;

function getClientInstances() {
  if (!clientDbInstance) {
    const app = getClientApps().length > 0 ? getClientApp() : initClientApp(firebaseClientConfig);
    clientAuthInstance = getAuth(app);
    clientDbInstance = getClientFirestore(app, process.env.FIREBASE_DATABASE_ID || "ai-studio-remixremixnotakn-6b882779-1f6a-407c-af44-7b468092c95f");
  }
  return { auth: clientAuthInstance, db: clientDbInstance };
}

async function ensureClientAuthenticated() {
  const serviceEmail = process.env.TRACKER_SERVICE_EMAIL || 'tracker-service@notaknot.id.vn';
  const servicePassword = process.env.TRACKER_SERVICE_PASSWORD;
  if (!servicePassword) return;

  const { auth } = getClientInstances();
  if (!auth.currentUser || auth.currentUser.email !== serviceEmail) {
    await signInWithEmailAndPassword(auth, serviceEmail, servicePassword);
  }
}

async function fetchOrderRecord(cleanCode: string): Promise<any | null> {
  // Method 1: Firebase Admin SDK (if private key available)
  if (hasAdminCredentials()) {
    try {
      const db = getAdminDb();
      const ordersCol = db.collection('orders');

      // 1. Exact doc ID
      let snap = await ordersCol.doc(cleanCode).get();
      if (snap.exists) return snap.data();

      // 2. Alt code with/without NAK-
      const altCode = cleanCode.startsWith('NAK-') ? cleanCode.replace(/^NAK-/, '') : `NAK-${cleanCode}`;
      snap = await ordersCol.doc(altCode).get();
      if (snap.exists) return snap.data();

      // 3. Query trackingNumber
      let qSnap = await ordersCol.where('trackingNumber', '==', cleanCode).limit(1).get();
      if (!qSnap.empty) return qSnap.docs[0].data();

      // 4. Query trackingNumber with NAK-
      qSnap = await ordersCol.where('trackingNumber', '==', altCode).limit(1).get();
      if (!qSnap.empty) return qSnap.docs[0].data();
    } catch (adminErr: any) {
      if (adminErr?.code !== 7 && !adminErr?.message?.includes('PERMISSION_DENIED')) {
        console.warn('[Track Order API] Admin SDK query notice:', adminErr?.message || adminErr);
      }
    }
  }

  // Method 2: Firebase Client SDK with Authenticated Staff / Service Account
  try {
    await ensureClientAuthenticated();
    const { db } = getClientInstances();
    const ordersCol = collection(db, 'orders');

    // 1. Exact doc ID
    let snap = await getDoc(doc(ordersCol, cleanCode));
    if (snap.exists()) return snap.data();

    // 2. Alt code with/without NAK-
    const altCode = cleanCode.startsWith('NAK-') ? cleanCode.replace(/^NAK-/, '') : `NAK-${cleanCode}`;
    snap = await getDoc(doc(ordersCol, altCode));
    if (snap.exists()) return snap.data();

    // 3. Query trackingNumber
    let qSnap = await getDocs(query(ordersCol, where('trackingNumber', '==', cleanCode), limit(1)));
    if (!qSnap.empty) return qSnap.docs[0].data();

    // 4. Query trackingNumber with NAK-
    qSnap = await getDocs(query(ordersCol, where('trackingNumber', '==', altCode), limit(1)));
    if (!qSnap.empty) return qSnap.docs[0].data();
  } catch (clientErr: any) {
    if (clientErr?.code !== 'permission-denied' && !clientErr?.message?.includes('insufficient permissions')) {
      console.warn('[Track Order API] Client SDK query notice:', clientErr?.message || clientErr);
    }
  }

  return null;
}

// ----------------------------------------------------
// VIETNAMESE PHONE NUMBER NORMALIZATION
// ----------------------------------------------------
export function normalizeVietnamesePhone(phone: unknown): string {
  if (typeof phone !== 'string' && typeof phone !== 'number') return '';
  let cleaned = String(phone).trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.replace(/^0+/, '0');
  }
  return cleaned;
}

export function isValidVietnamesePhone(phone: string): boolean {
  return /^0(3|5|7|8|9)[0-9]{8}$/.test(phone);
}

// ----------------------------------------------------
// RATE LIMITING PROTECTION (PER IP IN-MEMORY BUCKET)
// ----------------------------------------------------
interface RateLimitRecord {
  failures: number;
  resetAt: number;
}
const failedAttemptsMap = new Map<string, RateLimitRecord>();
const MAX_FAILURES = 10;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = failedAttemptsMap.get(ip);
  if (!record) return true;
  if (now > record.resetAt) {
    failedAttemptsMap.delete(ip);
    return true;
  }
  return record.failures < MAX_FAILURES;
}

function recordFailure(ip: string) {
  const now = Date.now();
  const record = failedAttemptsMap.get(ip);
  if (!record || now > record.resetAt) {
    failedAttemptsMap.set(ip, { failures: 1, resetAt: now + WINDOW_MS });
  } else {
    record.failures += 1;
  }
}

function recordSuccess(ip: string) {
  failedAttemptsMap.delete(ip);
}

// ----------------------------------------------------
// SAFE MASKING HELPERS
// ----------------------------------------------------
function maskPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    return '******' + digits.slice(-4);
  }
  return '******';
}

function maskLocation(orderData: any): string {
  const province = typeof orderData.province === 'string' ? orderData.province.trim() : '';
  const district = typeof orderData.district === 'string' ? orderData.district.trim() : '';
  if (district && province) {
    return `${district}, ${province}`;
  }
  if (province) {
    return province;
  }
  // If only full address is available, extract district/province without specific street/house number
  const full = typeof orderData.address === 'string' ? orderData.address.trim() : '';
  if (full) {
    const parts = full.split(',').map((p: string) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(-2).join(', ');
    }
  }
  return 'Việt Nam';
}

// ----------------------------------------------------
// MAIN HANDLER
// ----------------------------------------------------
const GENERIC_ERROR_MESSAGE = 'Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn và số điện thoại.';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // Enforce CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Phương thức yêu cầu không hợp lệ. Vui lòng sử dụng POST.' });
  }

  // Identify client IP
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket?.remoteAddress || 'unknown';

  // Check rate limit
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Bạn đã thử tra cứu sai quá nhiều lần. Vui lòng đợi 10 phút trước khi thử lại.'
    });
  }

  try {
    const { orderCode, phone } = req.body || {};

    if (!orderCode || typeof orderCode !== 'string' || !phone || (typeof phone !== 'string' && typeof phone !== 'number')) {
      recordFailure(clientIp);
      return res.status(200).json({ success: false, message: GENERIC_ERROR_MESSAGE });
    }

    const cleanCode = orderCode.trim().toUpperCase();
    const cleanPhone = normalizeVietnamesePhone(phone);

    // Validate format
    if (!/^[A-Z0-9_-]{3,40}$/.test(cleanCode) || !isValidVietnamesePhone(cleanPhone)) {
      recordFailure(clientIp);
      return res.status(200).json({ success: false, message: GENERIC_ERROR_MESSAGE });
    }

    // Fetch order record using Admin SDK or authenticated Service Bot fallback
    const data = await fetchOrderRecord(cleanCode);

    // If order was not found
    if (!data) {
      recordFailure(clientIp);
      return res.status(200).json({ success: false, message: GENERIC_ERROR_MESSAGE });
    }

    // Ignore soft-deleted orders
    if (data.isDeleted === true) {
      recordFailure(clientIp);
      return res.status(200).json({ success: false, message: GENERIC_ERROR_MESSAGE });
    }

    // 5. Verify Phone Number matches the exact order
    const rawStoredPhone = data.phone || data.customerPhone || '';
    const normalizedStoredPhone = normalizeVietnamesePhone(rawStoredPhone);

    if (!normalizedStoredPhone || normalizedStoredPhone !== cleanPhone) {
      recordFailure(clientIp);
      // Uniform generic response: never hint whether code was right or phone was wrong
      return res.status(200).json({ success: false, message: GENERIC_ERROR_MESSAGE });
    }

    // Both Order Code and Phone matched! Reset failure count.
    recordSuccess(clientIp);

    // 6. Return ONLY safe, sanitized customer-facing fields (Whitelisted field-by-field)
    const rawItems = Array.isArray(data.itemDetails) && data.itemDetails.length > 0
      ? data.itemDetails
      : Array.isArray(data.items)
      ? data.items.map((it: any) => typeof it === 'string' ? { productName: it, quantity: 1, price: 0 } : it)
      : [];

    const safeItems = rawItems.map((it: any) => ({
      productName: String(it?.productName || it?.name || 'Sản phẩm thủ công'),
      quantity: Math.max(1, Number(it?.quantity || 1)),
      price: Number(it?.price ?? it?.unitPrice ?? 0),
      image: it?.image || it?.selectedColorImage || it?.imageUrl || it?.productImage || undefined,
      selectedColorImage: it?.selectedColorImage || it?.image || undefined,
      selectedSize: it?.selectedSize ? String(it.selectedSize) : undefined,
      selectedColor: it?.selectedColor ? String(it.selectedColor) : undefined,
      selectedCharm: it?.selectedCharm ? (it.selectedCharm.name || String(it.selectedCharm)) : undefined,
      selectedCharms: Array.isArray(it?.selectedCharms) ? it.selectedCharms.map((c: any) => c?.name || String(c)) : undefined,
      selectedOmamoris: Array.isArray(it?.selectedOmamoris) ? it.selectedOmamoris.map((o: any) => ({ name: o?.name || String(o) })) : undefined,
      selectedKhoen: it?.selectedKhoen ? String(it.selectedKhoen) : undefined,
      customNote: it?.customNote ? String(it.customNote) : undefined,
    }));

    const safeStatusHistory = Array.isArray(data.statusHistory)
      ? data.statusHistory.map((h: any) => ({
          status: String(h?.status || ''),
          timestamp: String(h?.timestamp || h?.date || ''),
          note: h?.note ? String(h.note) : undefined,
        }))
      : [];

    const orderIdCode = String(data.trackingNumber || data.id || data.orderCode || cleanCode);

    const safeOrder = {
      id: orderIdCode,
      trackingNumber: orderIdCode,
      orderCode: orderIdCode,
      source: data.source || 'website',
      date: String(data.date || data.createdAt || ''),
      createdAt: String(data.createdAt || data.date || ''),
      status: String(data.status || 'Chờ xác nhận'),
      paymentMethod: String(data.paymentMethod || 'cod'),
      paymentStatus: String(data.paymentStatus || 'unpaid'),
      totalPrice: Number(data.totalPrice ?? data.totalAmount ?? 0),
      totalAmount: Number(data.totalAmount ?? data.totalPrice ?? 0),
      shippingFee: Number(data.shippingFee ?? 0),
      discountAmount: Number(data.discountAmount ?? 0),
      shippingCarrier: data.shippingCarrier ? String(data.shippingCarrier) : '',
      shippingCode: data.shippingCode ? String(data.shippingCode) : '',
      estimatedDelivery: data.estimatedDelivery ? String(data.estimatedDelivery) : '',
      craftingStageNote: data.craftingStageNote ? String(data.craftingStageNote) : '',
      statusHistory: safeStatusHistory,
      itemDetails: safeItems,
      maskedPhone: maskPhoneNumber(normalizedStoredPhone),
      maskedLocation: maskLocation(data),
      customerName: data.customerName || data.name ? String(data.customerName || data.name) : 'Khách hàng'
    };

    return res.status(200).json({
      success: true,
      order: safeOrder
    });
  } catch (error: any) {
    // Log generic error server-side without exposing customer inputs or stack trace to client
    console.error('[Track Order API] Server error:', error?.message || 'Unknown error');
    return res.status(500).json({
      success: false,
      message: 'Hệ thống đang bận. Vui lòng thử lại sau giây lát.'
    });
  }
}
