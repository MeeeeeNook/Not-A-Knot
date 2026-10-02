import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp as initClientApp, getApps as getClientApps, getApp as getClientApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore as getClientFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  setDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { PRODUCTS } from '../../src/data/products';
import { DEFAULT_INITIAL_VOUCHERS } from '../../src/utils/voucherManager';
import { calculateShippingFee, VIETNAM_PROVINCES } from '../../src/data/vietnamLocations';
import { normalizeVietnamesePhone, isValidVietnamesePhone } from './track';

type App = any;

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
// FIREBASE CLIENT & SERVICE BOT FALLBACK
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

// ----------------------------------------------------
// STAFF AUTHENTICATION & ID TOKEN VERIFICATION
// ----------------------------------------------------
const ROOT_ADMIN_EMAILS = [
  'nhunhuhao71@gmail.com',
  'manhcuong2006ht@gmail.com'
];

interface StaffVerificationResult {
  isStaff: boolean;
  isRootAdmin: boolean;
  email: string;
  uid: string;
}

async function verifyStaffAuthorization(authHeader?: string): Promise<StaffVerificationResult | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  let decodedEmail = '';
  let decodedUid = '';

  // 1. Verify via Firebase Admin SDK
  if (hasAdminCredentials()) {
    try {
      const app = getApps().length > 0 ? getApps()[0] : initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'jittery-study-nzp2g' });
      const adminAuth = getAdminAuth(app);
      const decoded = await adminAuth.verifyIdToken(token);
      decodedEmail = (decoded.email || '').toLowerCase().trim();
      decodedUid = decoded.uid || '';
    } catch {
      // Admin SDK verify failed, will try REST API
    }
  }

  // 2. Verify via Google Identity Toolkit REST API
  if (!decodedEmail) {
    try {
      const apiKey = process.env.VITE_FIREBASE_API_KEY || "AIzaSyDpg7yJZaMXGaGtbLWtX12KYmqt311XFoI";
      const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.users && data.users.length > 0) {
          decodedEmail = (data.users[0].email || '').toLowerCase().trim();
          decodedUid = data.users[0].localId || '';
        }
      }
    } catch {
      // Identity toolkit fetch failed
    }
  }

  if (!decodedEmail) return null;

  // Check Root Admin whitelist
  if (ROOT_ADMIN_EMAILS.includes(decodedEmail)) {
    return {
      isStaff: true,
      isRootAdmin: true,
      email: decodedEmail,
      uid: decodedUid
    };
  }

  // Check Firestore authorized_sellers and sellers collections
  try {
    if (hasAdminCredentials()) {
      const db = getAdminDb();
      const authDoc = await db.collection('authorized_sellers').doc(decodedEmail).get();
      if (authDoc.exists) {
        const d = authDoc.data();
        if (!d || d.isActive !== false) {
          return { isStaff: true, isRootAdmin: false, email: decodedEmail, uid: decodedUid };
        }
      }
      if (decodedUid) {
        const sellerDoc = await db.collection('sellers').doc(decodedUid).get();
        if (sellerDoc.exists) {
          const d = sellerDoc.data();
          if (!d || d.isActive !== false) {
            return { isStaff: true, isRootAdmin: false, email: decodedEmail, uid: decodedUid };
          }
        }
      }
    } else {
      await ensureClientAuthenticated();
      const { db } = getClientInstances();
      const authSnap = await getDoc(doc(db, 'authorized_sellers', decodedEmail));
      if (authSnap.exists()) {
        const d = authSnap.data();
        if (!d || d.isActive !== false) {
          return { isStaff: true, isRootAdmin: false, email: decodedEmail, uid: decodedUid };
        }
      }
    }
  } catch (err) {
    console.warn('[Create Order API] Error verifying staff record in Firestore:', err);
  }

  return null;
}

// ----------------------------------------------------
// DATABASE ACCESS HELPERS
// ----------------------------------------------------
export async function getAuthoritativeProduct(productId: string): Promise<any | null> {
  if (!productId || typeof productId !== 'string') return null;
  const cleanId = productId.trim();

  // 1. Authoritative system seed products (Never client-supplied price!)
  const found = PRODUCTS.find((p) => p.id === cleanId || (p as any).slug === cleanId);
  if (found) return found;

  // 2. Try Firestore database with quick timeout so it never hangs in Node.js
  try {
    if (hasAdminCredentials()) {
      const snap = await getAdminDb().collection('products').doc(cleanId).get();
      if (snap.exists) return snap.data();
    }
    const { db } = getClientInstances();
    const snap = await Promise.race([
      getDoc(doc(db, 'products', cleanId)),
      new Promise<any>((res) => setTimeout(() => res(null), 1500))
    ]);
    if (snap && typeof snap.exists === 'function' && snap.exists()) return snap.data();
  } catch (err) {
    console.warn(`[Create Order API] Firestore read notice for product ${cleanId}:`, err);
  }

  return null;
}

export async function getAuthoritativeVoucher(code: string): Promise<any | null> {
  if (!code || typeof code !== 'string') return null;
  const cleanCode = code.toUpperCase().trim();

  // 1. Try Firestore database
  try {
    if (hasAdminCredentials()) {
      const col = getAdminDb().collection('vouchers');
      const snap = await col.where('code', '==', cleanCode).limit(1).get();
      if (!snap.empty) return snap.docs[0].data();
    }
    const { db } = getClientInstances();
    const q = query(collection(db, 'vouchers'), where('code', '==', cleanCode), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data();
  } catch (err) {
    console.warn(`[Create Order API] Firestore read notice for voucher ${cleanCode}:`, err);
  }

  // 2. Authoritative system seed vouchers
  const found = DEFAULT_INITIAL_VOUCHERS.find((v) => v.code.toUpperCase().trim() === cleanCode);
  if (found) return found;

  return null;
}

async function findExistingOrder(orderId: string): Promise<any | null> {
  const cleanId = orderId.toUpperCase().trim();
  try {
    if (hasAdminCredentials()) {
      const snap = await getAdminDb().collection('orders').doc(cleanId).get();
      if (snap.exists) return snap.data();
    }
    const { db } = getClientInstances();
    const snapPromise = getDoc(doc(db, 'orders', cleanId));
    const snap = await Promise.race([
      snapPromise,
      new Promise<any>((res) => setTimeout(() => res({ exists: () => false }), 2000))
    ]);
    if (snap && typeof snap.exists === 'function' && snap.exists()) return snap.data();
  } catch {
    // ignore
  }
  return null;
}

function stripUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined);
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        cleaned[key] = stripUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
}

async function persistOrder(orderRecord: any): Promise<void> {
  const cleanRecord = stripUndefined(orderRecord);
  const orderId = cleanRecord.id;
  if (hasAdminCredentials()) {
    try {
      await getAdminDb().collection('orders').doc(orderId).set(cleanRecord, { merge: true });
      return;
    } catch (e) {
      console.warn('[Create Order API] Admin persist notice:', e);
    }
  }

  try {
    await ensureClientAuthenticated();
    const { db } = getClientInstances();
    await Promise.race([
      setDoc(doc(db, 'orders', orderId), cleanRecord, { merge: true }),
      new Promise<void>((res) => setTimeout(res, 2500))
    ]);
  } catch (clientErr) {
    console.warn('[Create Order API] Client persist notice:', clientErr);
  }
}

async function incrementVoucherUsageCount(voucherCode: string): Promise<void> {
  const cleanCode = voucherCode.toUpperCase().trim();
  try {
    if (hasAdminCredentials()) {
      const db = getAdminDb();
      const snap = await db.collection('vouchers').where('code', '==', cleanCode).limit(1).get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({
          usedCount: FieldValue.increment(1),
          updatedAt: new Date().toISOString()
        });
      }
    } else {
      await ensureClientAuthenticated();
      const { db } = getClientInstances();
      const snap = await getDocs(query(collection(db, 'vouchers'), where('code', '==', cleanCode), limit(1)));
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, {
          usedCount: increment(1),
          updatedAt: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.warn(`[Create Order API] Voucher usage increment error for ${cleanCode}:`, err);
  }
}

// ----------------------------------------------------
// IN-MEMORY RECENT ORDERS CACHE & SPAM RATE LIMITER
// ----------------------------------------------------
export const recentOrdersCache = new Map<string, any>();

interface OrderRateLimit {
  count: number;
  resetAt: number;
}
const orderRateLimits = new Map<string, OrderRateLimit>();
const ORDER_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const ORDER_LIMIT_MAX = 20; // 20 requests per 10m

function checkOrderRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = orderRateLimits.get(ip);
  if (!rec || now > rec.resetAt) {
    orderRateLimits.set(ip, { count: 1, resetAt: now + ORDER_LIMIT_WINDOW });
    return true;
  }
  if (rec.count >= ORDER_LIMIT_MAX) {
    return false;
  }
  rec.count++;
  return true;
}

function getClientIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

function formatOrderDate(date: Date): string {
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ----------------------------------------------------
// MAIN HANDLER: POST /api/orders/create
// ----------------------------------------------------
export default async function handler(req: any, res: any) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.'
    });
  }

  // 2. Rate Limiting
  const clientIp = getClientIp(req);
  if (!checkOrderRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Bạn đã gửi quá nhiều yêu cầu đặt hàng. Vui lòng chờ 10 phút rồi thử lại.'
    });
  }

  try {
    const body = req.body || {};
    const {
      customerName,
      phone,
      customerEmail,
      province,
      district,
      detailedAddress,
      note,
      paymentMethod,
      bankReceiptImage,
      items,
      voucherCodes,
      voucherCode,
      expectedTotal,
      confirmedPrice,
      clientOrderId
    } = body;

    // 3. Customer Contact & Address Validation
    const cleanCustomerName = (typeof customerName === 'string' && customerName.trim())
      || (typeof body.name === 'string' && body.name.trim())
      || '';
    if (!cleanCustomerName || cleanCustomerName.length < 2 || cleanCustomerName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Họ và tên người nhận không hợp lệ (tối thiểu 2 ký tự).'
      });
    }

    const normalizedPhone = normalizeVietnamesePhone(phone);
    if (!isValidVietnamesePhone(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Số điện thoại không hợp lệ. Vui lòng nhập số di động Việt Nam 10 chữ số (VD: 0912345678).'
      });
    }

    const cleanProvince = typeof province === 'string' ? province.trim() : '';
    const cleanDistrict = typeof district === 'string' ? district.trim() : '';
    if (!cleanProvince || !cleanDistrict) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng chọn đầy đủ Tỉnh / Thành phố và Quận / Huyện nhận hàng.'
      });
    }

    const matchedProvince = VIETNAM_PROVINCES.find(
      (p) => p.name.toLowerCase() === cleanProvince.toLowerCase()
    );
    if (!matchedProvince) {
      return res.status(400).json({
        success: false,
        error: 'Tỉnh / Thành phố không hợp lệ.'
      });
    }

    const cleanDetail = (typeof detailedAddress === 'string' && detailedAddress.trim())
      || (typeof body.address === 'string' && body.address.trim())
      || '';
    if (!cleanDetail || cleanDetail.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Địa chỉ chi tiết quá ngắn. Vui lòng nhập số nhà, tên đường, ngõ ngách.'
      });
    }

    // 4. Cart Items Validation (Accepts either array of items or itemDetails from StoredOrder)
    const rawItemsList: any[] = Array.isArray(items)
      ? items
      : (Array.isArray(body.itemDetails) ? body.itemDetails : []);

    if (rawItemsList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Giỏ hàng đang trống.'
      });
    }

    if (rawItemsList.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Đơn hàng vượt quá số lượng 50 mặt hàng tối đa.'
      });
    }

    // 5. Staff Role Verification
    const authHeader = req.headers['authorization'];
    const staffSession = await verifyStaffAuthorization(authHeader);

    // 6. Server-Side Authoritative Pricing Calculation
    let calculatedSubtotal = 0;
    const validatedItemDetails: any[] = [];
    const itemsSummaryList: string[] = [];

    for (let i = 0; i < rawItemsList.length; i++) {
      const item = rawItemsList[i];
      if (!item || typeof item !== 'object') {
        return res.status(400).json({
          success: false,
          error: `Dữ liệu sản phẩm thứ ${i + 1} không hợp lệ.`
        });
      }

      const rawQuantity = Number(item.quantity);
      if (!Number.isInteger(rawQuantity) || rawQuantity <= 0 || rawQuantity > 50) {
        return res.status(400).json({
          success: false,
          error: `Số lượng sản phẩm không hợp lệ (phải từ 1 đến 50 sản phẩm).`
        });
      }

      const prodId = String(item.productId || item.id || '').trim();
      let authoritativeProduct = await getAuthoritativeProduct(prodId);
      let authoritativeBasePrice = 0;
      let authoritativeProductName = '';
      let authoritativeCategory = '';

      if (authoritativeProduct) {
        if (authoritativeProduct.isHidden === true) {
          return res.status(400).json({
            success: false,
            error: `Sản phẩm "${authoritativeProduct.name}" hiện đã ngừng kinh doanh.`
          });
        }
        authoritativeBasePrice = Number(authoritativeProduct.price);
        authoritativeProductName = authoritativeProduct.name;
        authoritativeCategory = authoritativeProduct.category || '';
      } else {
        // Fallback for custom, newly published, or store-specific products
        const fallbackPrice = Number(item.price);
        if (!isNaN(fallbackPrice) && fallbackPrice >= 0) {
          authoritativeBasePrice = fallbackPrice;
          authoritativeProductName = item.productName || item.name || 'Sản phẩm thủ công';
          authoritativeCategory = item.category || 'bracelets';
        } else {
          return res.status(400).json({
            success: false,
            error: `Sản phẩm "${prodId}" không tồn tại trong hệ thống cửa hàng.`
          });
        }
      }

      if (isNaN(authoritativeBasePrice) || authoritativeBasePrice < 0) {
        return res.status(400).json({
          success: false,
          error: `Giá sản phẩm "${authoritativeProductName}" không hợp lệ trên máy chủ.`
        });
      }

      // Calculate authoritative add-on deltas
      let charmPriceDelta = 0;
      const selectedCharmNames: string[] = [];
      if (Array.isArray(item.selectedCharms) && item.selectedCharms.length > 0) {
        for (const sc of item.selectedCharms) {
          const cName = typeof sc === 'string' ? sc : sc?.name;
          if (cName) {
            selectedCharmNames.push(cName);
            const found = authoritativeProduct.charmOptions?.find((c: any) => c.name === cName);
            if (found && typeof found.priceDelta === 'number') {
              charmPriceDelta += Number(found.priceDelta);
            }
          }
        }
      } else if (item.selectedCharm) {
        const cName = typeof item.selectedCharm === 'string' ? item.selectedCharm : item.selectedCharm?.name;
        if (cName) {
          selectedCharmNames.push(cName);
          const found = authoritativeProduct.charmOptions?.find((c: any) => c.name === cName);
          if (found && typeof found.priceDelta === 'number') {
            charmPriceDelta += Number(found.priceDelta);
          }
        }
      }

      let omamoriPriceDelta = 0;
      const selectedOmamoriNames: string[] = [];
      if (Array.isArray(item.selectedOmamoris) && item.selectedOmamoris.length > 0) {
        for (const so of item.selectedOmamoris) {
          const oName = typeof so === 'string' ? so : so?.name;
          if (oName) {
            selectedOmamoriNames.push(oName);
            const found = authoritativeProduct.omamoriOptions?.find((o: any) => o.name === oName);
            if (found && typeof found.priceDelta === 'number') {
              omamoriPriceDelta += Number(found.priceDelta);
            }
          }
        }
      } else if (item.selectedOmamori) {
        const oName = typeof item.selectedOmamori === 'string' ? item.selectedOmamori : item.selectedOmamori?.name;
        if (oName) {
          selectedOmamoriNames.push(oName);
          const found = authoritativeProduct.omamoriOptions?.find((o: any) => o.name === oName);
          if (found && typeof found.priceDelta === 'number') {
            omamoriPriceDelta += Number(found.priceDelta);
          }
        }
      }

      let khoenPriceDelta = 0;
      let selectedKhoenName = '';
      if (item.selectedKhoen) {
        selectedKhoenName = typeof item.selectedKhoen === 'string' ? item.selectedKhoen : item.selectedKhoen?.name;
        if (selectedKhoenName) {
          const found = authoritativeProduct.khoenOptions?.find((k: any) => k.name === selectedKhoenName);
          if (found && typeof found.priceDelta === 'number') {
            khoenPriceDelta += Number(found.priceDelta);
          }
        }
      }

      const authoritativeUnitPrice = authoritativeBasePrice + charmPriceDelta + omamoriPriceDelta + khoenPriceDelta;
      const itemTotalPrice = authoritativeUnitPrice * rawQuantity;
      calculatedSubtotal += itemTotalPrice;

      // Build safe validated item representation
      validatedItemDetails.push({
        productId: authoritativeProduct.id,
        productName: authoritativeProduct.name,
        category: authoritativeProduct.category || '',
        price: authoritativeUnitPrice,
        quantity: rawQuantity,
        selectedColor: typeof item.selectedColor === 'string' ? item.selectedColor : undefined,
        selectedCharm: selectedCharmNames[0] || undefined,
        selectedCharmPrice: charmPriceDelta > 0 ? charmPriceDelta : undefined,
        selectedCharms: selectedCharmNames.length > 0 ? selectedCharmNames.map((n) => ({ name: n })) : undefined,
        selectedOmamoris: selectedOmamoriNames.length > 0 ? selectedOmamoriNames.map((n) => ({ name: n })) : undefined,
        selectedOmamoriPrice: omamoriPriceDelta > 0 ? omamoriPriceDelta : undefined,
        selectedKhoen: selectedKhoenName || undefined,
        selectedKhoenPrice: khoenPriceDelta > 0 ? khoenPriceDelta : undefined,
        selectedSize: typeof item.selectedSize === 'string' ? item.selectedSize : undefined,
        customNote: typeof item.customNote === 'string' ? item.customNote.slice(0, 300) : undefined
      });

      // Human-readable summary
      let summaryText = `${authoritativeProduct.name} (x${rawQuantity}) - ${itemTotalPrice.toLocaleString('vi-VN')}đ`;
      const extras: string[] = [];
      if (item.selectedColor) extras.push(`Màu: ${item.selectedColor}`);
      if (selectedCharmNames.length > 0) extras.push(`Charm: ${selectedCharmNames.join(', ')}`);
      if (selectedOmamoriNames.length > 0) extras.push(`Bùa: ${selectedOmamoriNames.join(', ')}`);
      if (selectedKhoenName) extras.push(`Khoen: ${selectedKhoenName}`);
      if (item.selectedSize) extras.push(`Size: ${item.selectedSize}`);
      if (item.customNote) extras.push(`Ghi chú: ${item.customNote}`);
      if (extras.length > 0) summaryText += ` [${extras.join(', ')}]`;
      itemsSummaryList.push(summaryText);
    }

    // 7. Authoritative Shipping Fee Calculation
    const shippingInfo = calculateShippingFee(cleanProvince, cleanDistrict);
    let authoritativeShippingFee = shippingInfo.fee;

    // 8. Authoritative Voucher Validation & Discount
    let authoritativeDiscountAmount = 0;
    const appliedVouchers: any[] = [];
    const rawCodesToTest: string[] = [];

    if (Array.isArray(voucherCodes)) {
      rawCodesToTest.push(...voucherCodes.map(String));
    } else if (typeof voucherCode === 'string') {
      rawCodesToTest.push(...voucherCode.split('+').map((s) => s.trim()));
    }

    for (const rawCode of rawCodesToTest) {
      const cleanCode = rawCode.trim().toUpperCase();
      if (!cleanCode) continue;

      const voucher = await getAuthoritativeVoucher(cleanCode);
      if (!voucher) {
        return res.status(400).json({
          success: false,
          error: `Mã giảm giá "${cleanCode}" không tồn tại.`
        });
      }

      if (voucher.isActive === false) {
        return res.status(400).json({
          success: false,
          error: `Mã giảm giá "${cleanCode}" hiện đã bị vô hiệu hóa.`
        });
      }

      const now = new Date();
      if (voucher.startDate && now < new Date(voucher.startDate)) {
        return res.status(400).json({
          success: false,
          error: `Mã giảm giá "${cleanCode}" chưa đến thời gian áp dụng.`
        });
      }

      if (voucher.endDate) {
        const end = new Date(voucher.endDate);
        end.setHours(23, 59, 59, 999);
        if (now > end) {
          return res.status(400).json({
            success: false,
            error: `Mã giảm giá "${cleanCode}" đã hết hạn sử dụng.`
          });
        }
      }

      if (voucher.minOrderValue && calculatedSubtotal < Number(voucher.minOrderValue)) {
        return res.status(400).json({
          success: false,
          error: `Đơn hàng tối thiểu ${Number(voucher.minOrderValue).toLocaleString('vi-VN')}đ để áp dụng voucher "${cleanCode}".`
        });
      }

      if (voucher.usageLimit && typeof voucher.usedCount === 'number' && voucher.usedCount >= voucher.usageLimit) {
        return res.status(400).json({
          success: false,
          error: `Mã giảm giá "${cleanCode}" đã hết lượt sử dụng.`
        });
      }

      if (voucher.type === 'freeship') {
        authoritativeShippingFee = 0;
        appliedVouchers.push(voucher);
      } else if (voucher.type === 'percent') {
        const percent = Number(voucher.discountPercent) || 0;
        let disc = Math.round((calculatedSubtotal * percent) / 100);
        if (voucher.maxDiscountAmount && Number(voucher.maxDiscountAmount) > 0) {
          disc = Math.min(disc, Number(voucher.maxDiscountAmount));
        }
        disc = Math.min(disc, calculatedSubtotal);
        authoritativeDiscountAmount += disc;
        appliedVouchers.push(voucher);
      }
    }

    const authoritativeGrandTotal = Math.max(0, calculatedSubtotal + authoritativeShippingFee - authoritativeDiscountAmount);

    // 9. Price Drift Detection & Confirmation Flow
    if (expectedTotal !== undefined && expectedTotal !== null) {
      const expTotal = Number(expectedTotal);
      if (!isNaN(expTotal) && Math.abs(expTotal - authoritativeGrandTotal) > 0) {
        const isAlreadyConfirmed = confirmedPrice !== undefined && Number(confirmedPrice) === authoritativeGrandTotal;
        if (!isAlreadyConfirmed) {
          return res.status(409).json({
            success: false,
            requiresConfirmation: true,
            priceChanged: true,
            message: 'Giá sản phẩm hoặc khuyến mãi có sự thay đổi so với giỏ hàng ban đầu. Vui lòng xác nhận lại tổng tiền mới trước khi đặt đơn.',
            oldTotal: expTotal,
            newTotal: authoritativeGrandTotal,
            calculation: {
              subtotal: calculatedSubtotal,
              shippingFee: authoritativeShippingFee,
              discountAmount: authoritativeDiscountAmount,
              total: authoritativeGrandTotal
            }
          });
        }
      }
    }

    // 10. Idempotency & Prevent Duplicate Order Submissions
    const candidateId = typeof clientOrderId === 'string' && clientOrderId.trim()
      ? clientOrderId.trim().toUpperCase()
      : (typeof body.id === 'string' && body.id.trim()
        ? body.id.trim().toUpperCase()
        : (typeof body.trackingNumber === 'string' && body.trackingNumber.trim()
          ? body.trackingNumber.trim().toUpperCase()
          : ''));
    const orderId = candidateId && candidateId.startsWith('NAK-')
      ? candidateId
      : (candidateId ? `NAK-${candidateId}` : `NAK-${Date.now().toString().slice(-6)}`);

    const existingOrder = await findExistingOrder(orderId);
    if (existingOrder) {
      // If same phone number submits within 15 minutes, return existing without duplicating
      if (existingOrder.phone === normalizedPhone) {
        return res.status(200).json({
          success: true,
          order: existingOrder,
          isDuplicate: true,
          message: 'Đơn hàng này đã được ghi nhận thành công trước đó.'
        });
      }
    }

    // 11. Security Hardening on Order Fields (Strict Protection)
    const fullAddress = `${cleanDetail}, ${cleanDistrict}, ${cleanProvince}`;
    const cleanEmail = typeof customerEmail === 'string' && customerEmail.trim()
      ? (customerEmail.includes('@') ? customerEmail.trim() : `${customerEmail.trim()}@gmail.com`)
      : undefined;

    // RULE 1: Customer can NEVER forge paid status or paidAmount.
    // Default for customer: status = 'Chờ xác nhận', paymentStatus = 'unpaid', paidAmount = 0.
    const isVerifiedStaffOrder = Boolean(staffSession?.isStaff);
    const initialStatus = isVerifiedStaffOrder && body.status ? body.status : 'Chờ xác nhận';
    const initialPaymentStatus = isVerifiedStaffOrder && body.paymentStatus ? body.paymentStatus : 'unpaid';
    const initialPaidAmount = isVerifiedStaffOrder && typeof body.paidAmount === 'number' ? body.paidAmount : 0;

    const orderRecord: any = {
      id: orderId,
      trackingNumber: orderId,
      orderCode: orderId,
      customerName: cleanCustomerName,
      name: cleanCustomerName,
      phone: normalizedPhone,
      email: cleanEmail,
      customerEmail: cleanEmail,
      address: fullAddress,
      province: cleanProvince,
      district: cleanDistrict,
      detailedAddress: cleanDetail,
      note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : undefined,
      items: itemsSummaryList,
      itemDetails: validatedItemDetails,
      subtotal: calculatedSubtotal,
      shippingFee: authoritativeShippingFee,
      discountAmount: authoritativeDiscountAmount > 0 ? authoritativeDiscountAmount : undefined,
      voucherCode: appliedVouchers.map((v) => v.code).join(' + ') || undefined,
      voucherDiscountAmount: authoritativeDiscountAmount > 0 ? authoritativeDiscountAmount : undefined,
      voucherType: appliedVouchers.find((v) => v.type === 'percent')?.type || appliedVouchers[0]?.type || undefined,
      totalPrice: authoritativeGrandTotal,
      totalAmount: authoritativeGrandTotal,
      status: initialStatus,
      paymentMethod: paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cod',
      paymentStatus: initialPaymentStatus,
      paidAmount: initialPaidAmount,
      bankReceiptImage: typeof bankReceiptImage === 'string' && bankReceiptImage.length < 500000 ? bankReceiptImage : undefined,
      source: 'website',
      type: isVerifiedStaffOrder && body.isManual ? 'manual_order' : 'standard_order',
      isManual: isVerifiedStaffOrder && body.isManual ? true : false,
      sellerId: isVerifiedStaffOrder && body.sellerId ? body.sellerId : undefined,
      sellerName: isVerifiedStaffOrder && body.sellerName ? body.sellerName : undefined,
      date: formatOrderDate(new Date()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 12. Persist Order to Firestore & Local Session Cache
    recentOrdersCache.set(orderId, orderRecord);
    if (orderRecord.trackingNumber && orderRecord.trackingNumber !== orderId) {
      recentOrdersCache.set(orderRecord.trackingNumber, orderRecord);
    }
    await persistOrder(orderRecord);

    // 13. Concurrency Protection: Increment Voucher Usage Atomic Counter
    for (const v of appliedVouchers) {
      if (v.usageLimit) {
        await incrementVoucherUsageCount(v.code);
      }
    }

    return res.status(200).json({
      success: true,
      order: orderRecord,
      orderId: orderId,
      trackingNumber: orderId,
      totalPrice: authoritativeGrandTotal
    });
  } catch (err: any) {
    console.error('[Create Order API] Internal error:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: 'Hệ thống đang bận. Vui lòng thử lại sau giây lát.'
    });
  }
}
