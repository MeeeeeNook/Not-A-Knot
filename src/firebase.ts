import { initializeApp, getApps } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { Product, CategoryItem, CollectionInfo, SiteContentConfig, ContactMessage, SellerUser, VersionBackup, BackupScheduleConfig } from './types';
import { DEFAULT_CATEGORIES } from './data/categories';

// Load client configuration from firebase-applet-config.json
import firebaseAppletConfig from '../firebase-applet-config.json';

// Suppress internal Firebase advisory warnings (like transient WebChannel retry or 10s auto-detect warning)
try {
  setLogLevel('error');
} catch {
  // ignore
}

const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId,
  firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId || '(default)'
};

// Initialize Firebase App instance
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

const targetDbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

// Initialize Firestore with clean settings for fast direct connection in all browser/iframe environments
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    ignoreUndefinedProperties: true
  }, targetDbId);
} catch {
  firestoreInstance = targetDbId ? getFirestore(app, targetDbId) : getFirestore(app);
}

export const db = firestoreInstance;
export const storage = getStorage(app);

export async function uploadHeroArtwork(file: File, slideId: string, device: 'desktop' | 'mobile'): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const artworkRef = ref(storage, `hero-billboards/${slideId}/${device}-${Date.now()}-${safeName}`);
  const snapshot = await uploadBytes(artworkRef, file, { contentType: file.type, cacheControl: 'public,max-age=31536000,immutable' });
  return getDownloadURL(snapshot.ref);
}

export function isQuotaExhaustedError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('Free daily write units per project')
  );
}

/**
 * Strips undefined values recursively so Firestore setDoc/updateDoc never throws:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined".
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * High-Fidelity Base64 Image Processor & Compressor.
 * - Uses high-quality bicubic smoothing (ctx.imageSmoothingQuality = 'high')
 * - Preserves sharp paracord weave details, charms and vibrant colors
 * - Supports high-density WebP output with JPEG fallback
 * - Safe for Firestore document size limits while maintaining 1400px HD resolution
 */
export async function compressBase64Image(
  dataUrl: string,
  maxWidth = 2048,
  maxHeight = 2048,
  quality = 0.94
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  // If it's already reasonably compact (< 180KB), return directly to save CPU & memory cycles
  if (dataUrl.length < 180 * 1024) {
    return dataUrl;
  }

  // Safety check for non-browser environments
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return dataUrl;
  }

  return new Promise<string>((resolve) => {
    try {
      let isSettled = false;
      const done = (result: string) => {
        if (!isSettled) {
          isSettled = true;
          resolve(result);
        }
      };

      // Safety timeout: never hang more than 2.5s
      setTimeout(() => done(dataUrl), 2500);

      const img = new Image();
      if (!dataUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        try {
          let width = img.width || 800;
          let height = img.height || 800;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            done(dataUrl);
            return;
          }

          // Enable high-quality image smoothing to prevent blur and pixelation
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, width, height);

          // Try WebP first for superior clarity & smaller size, fallback to JPEG
          let compressed = '';
          try {
            compressed = canvas.toDataURL('image/webp', quality);
            if (!compressed || !compressed.startsWith('data:image/webp')) {
              compressed = canvas.toDataURL('image/jpeg', quality);
            }
          } catch {
            compressed = canvas.toDataURL('image/jpeg', quality);
          }

          done(compressed || dataUrl);
        } catch {
          done(dataUrl);
        }
      };
      img.onerror = () => done(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

// ----------------------------------------------------
// Quota & Free Tier Stats Tracker
// ----------------------------------------------------
export interface FirestoreQuotaStats {
  reads: number;
  writes: number;
  deletes: number;
  readsToday: number;
  writesToday: number;
  deletesToday: number;
  estimatedStorageBytes: number;
  maxStorageBytes: number;
  lastSyncTime: string;
  projectId: string;
  databaseId: string;
  region: string;
}

const getTodayDateKey = (): string => {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return '2026-09-02';
  }
};

const sanitizeCount = (val: string | null, fallback: number = 0, maxAllowed: number = 50000): number => {
  const num = parseInt(val || '0', 10);
  if (isNaN(num) || num < 0 || num > maxAllowed) return fallback;
  return num;
};

const sanitizeStorage = (val: string | null, fallback: number = 845000): number => {
  const num = parseInt(val || '0', 10);
  if (isNaN(num) || num < 0 || num > 1024 * 1024 * 1024) return fallback;
  return num;
};

const storedDate = typeof localStorage !== 'undefined' ? localStorage.getItem('nak_fb_ops_date') : null;
const currentDate = getTodayDateKey();
const isSameDay = storedDate === currentDate;

if (typeof localStorage !== 'undefined' && !isSameDay) {
  localStorage.setItem('nak_fb_ops_date', currentDate);
  localStorage.setItem('nak_fb_reads_today', '0');
  localStorage.setItem('nak_fb_writes_today', '0');
  localStorage.setItem('nak_fb_deletes_today', '0');
}

let quotaStats: FirestoreQuotaStats = {
  reads: sanitizeCount(typeof localStorage !== 'undefined' ? localStorage.getItem('nak_fb_reads') : null, 12),
  writes: sanitizeCount(typeof localStorage !== 'undefined' ? localStorage.getItem('nak_fb_writes') : null, 6),
  deletes: sanitizeCount(typeof localStorage !== 'undefined' ? localStorage.getItem('nak_fb_deletes') : null, 0),
  readsToday: sanitizeCount(typeof localStorage !== 'undefined' ? localStorage.getItem('nak_fb_reads_today') : null, 12),
  writesToday: sanitizeCount(typeof localStorage !== 'undefined' ? localStorage.getItem('nak_fb_writes_today') : null, 6),
  deletesToday: sanitizeCount(typeof localStorage !== 'undefined' ? localStorage.getItem('nak_fb_deletes_today') : null, 0),
  estimatedStorageBytes: sanitizeStorage(typeof localStorage !== 'undefined' ? localStorage.getItem('nak_fb_storage') : null, 845000),
  maxStorageBytes: 1024 * 1024 * 1024, // 1 GiB (1,024 MB) Spark Plan Free Tier
  lastSyncTime: new Date().toLocaleTimeString('vi-VN'),
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId,
  region: 'asia-southeast1 (Singapore)'
};

type QuotaListener = (stats: FirestoreQuotaStats) => void;
const quotaListeners: Set<QuotaListener> = new Set();

const notifyQuotaListeners = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('nak_fb_reads', quotaStats.reads.toString());
    localStorage.setItem('nak_fb_writes', quotaStats.writes.toString());
    localStorage.setItem('nak_fb_deletes', quotaStats.deletes.toString());
    localStorage.setItem('nak_fb_reads_today', quotaStats.readsToday.toString());
    localStorage.setItem('nak_fb_writes_today', quotaStats.writesToday.toString());
    localStorage.setItem('nak_fb_deletes_today', quotaStats.deletesToday.toString());
    localStorage.setItem('nak_fb_storage', quotaStats.estimatedStorageBytes.toString());
  }
  quotaListeners.forEach((l) => l({ ...quotaStats }));
};

export const subscribeQuotaStats = (listener: QuotaListener) => {
  quotaListeners.add(listener);
  listener({ ...quotaStats });
  return () => {
    quotaListeners.delete(listener);
  };
};

export const getLatestQuotaStats = (): FirestoreQuotaStats => {
  return { ...quotaStats };
};

export const resetFirestoreQuotaStats = (): FirestoreQuotaStats => {
  quotaStats.reads = 0;
  quotaStats.writes = 0;
  quotaStats.deletes = 0;
  quotaStats.readsToday = 0;
  quotaStats.writesToday = 0;
  quotaStats.deletesToday = 0;
  quotaStats.lastSyncTime = new Date().toLocaleTimeString('vi-VN');
  notifyQuotaListeners();
  return { ...quotaStats };
};

export const recalculateFirestoreStorage = (
  products?: Product[],
  orders?: StoredOrder[],
  categories?: CategoryItem[],
  collections?: CollectionInfo[],
  siteContent?: SiteContentConfig
): number => {
  let totalBytes = 0;
  try {
    if (products && Array.isArray(products)) {
      totalBytes += new TextEncoder().encode(JSON.stringify(products)).length;
    }
    if (orders && Array.isArray(orders)) {
      totalBytes += new TextEncoder().encode(JSON.stringify(orders)).length;
    }
    if (categories && Array.isArray(categories)) {
      totalBytes += new TextEncoder().encode(JSON.stringify(categories)).length;
    }
    if (collections && Array.isArray(collections)) {
      totalBytes += new TextEncoder().encode(JSON.stringify(collections)).length;
    }
    if (siteContent) {
      totalBytes += new TextEncoder().encode(JSON.stringify(siteContent)).length;
    }
  } catch {
    // Fallback if TextEncoder is unavailable
    if (products) totalBytes += JSON.stringify(products).length;
    if (orders) totalBytes += JSON.stringify(orders).length;
  }

  // Add system indexing overhead and Firestore metadata footprint (~180 KB)
  totalBytes = Math.max(256000, totalBytes + 180000);
  quotaStats.estimatedStorageBytes = totalBytes;
  quotaStats.lastSyncTime = new Date().toLocaleTimeString('vi-VN');
  notifyQuotaListeners();
  return totalBytes;
};

export const recordOperation = (type: 'read' | 'write' | 'delete', count = 1, deltaStorageBytes = 0) => {
  if (count <= 0) return;
  if (type === 'read') {
    quotaStats.reads += count;
    quotaStats.readsToday += count;
  }
  if (type === 'write') {
    quotaStats.writes += count;
    quotaStats.writesToday += count;
  }
  if (type === 'delete') {
    quotaStats.deletes += count;
    quotaStats.deletesToday += count;
  }
  quotaStats.estimatedStorageBytes = Math.max(128000, quotaStats.estimatedStorageBytes + deltaStorageBytes);
  quotaStats.lastSyncTime = new Date().toLocaleTimeString('vi-VN');
  notifyQuotaListeners();
};

// ----------------------------------------------------
// Order Entity & Interfaces
// ----------------------------------------------------
export interface StoredOrder {
  id: string;
  date?: string;
  createdAt?: string;
  name?: string;
  customerName?: string;
  phone: string;
  address: string;
  note?: string;
  items: string[];
  itemDetails?: {
    productId: string;
    productName: string;
    category?: string;
    price: number;
    quantity: number;
    selectedColor?: string;
    selectedColorImage?: string;
    selectedCharm?: string;
    selectedCharmImage?: string;
    selectedCharmPrice?: number;
    selectedSize?: string;
    customNote?: string;
  }[];
  totalPrice?: number;
  totalAmount?: number;
  shippingFee?: number;
  discountAmount?: number;
  craftingStageNote?: string;
  source?: 'website' | 'facebook' | 'shopee' | 'tiktok' | 'offline' | 'instagram' | 'zalo' | 'hotline' | 'other';
  type: 'preorder_0209' | 'standard_order' | 'manual_order';
  isManual?: boolean;
  status: string;
  paymentMethod?: 'bank_transfer' | 'cod' | 'cash' | 'other';
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  bankReceiptImage?: string;
  paidAmount?: number;
  bankTransferRef?: string;
  sellerId?: string;
  sellerName?: string;
  trackingNumber?: string;
  shippingCarrier?: string;
  shippingCode?: string;
  estimatedDelivery?: string;
  statusHistory?: {
    status: string;
    label?: string;
    timestamp: string;
    note?: string;
    actor?: string;
  }[];
}

// In-memory cache for ultra-fast reads
let productsMemoryCache: { data: Product[]; expiresAt: number } | null = null;
let categoriesMemoryCache: { data: CategoryItem[]; expiresAt: number } | null = null;
let ordersMemoryCache: { data: StoredOrder[]; expiresAt: number } | null = null;

export const clearFirestoreMemoryCache = () => {
  productsMemoryCache = null;
  categoriesMemoryCache = null;
  ordersMemoryCache = null;
};

// ----------------------------------------------------
// Firestore Products CRUD
// ----------------------------------------------------
export const fetchProductsFromFirestore = async (forceRefresh = false): Promise<Product[]> => {
  try {
    const now = Date.now();
    if (!forceRefresh && productsMemoryCache && productsMemoryCache.expiresAt > now) {
      return productsMemoryCache.data;
    }

    recordOperation('read');
    const colRef = collection(db, 'products');
    const snap = await getDocs(colRef);
    const results: Product[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const rawStock = typeof data.stock === 'number' ? data.stock : 15;
      const computedInStock = data.inStock !== false && rawStock > 0;
      results.push({
        id: docSnap.id,
        name: data.name || '',
        category: data.category || 'bracelets',
        price: data.price || 0,
        originalPrice: data.originalPrice,
        discountBadge: data.discountBadge,
        image: (data.image && typeof data.image === 'string' && data.image.trim().length > 0) ? data.image : '/assets/bracelet.jpg',
        images: Array.isArray(data.images) && data.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0).length > 0
          ? data.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0)
          : [(data.image && typeof data.image === 'string' && data.image.trim().length > 0) ? data.image : '/assets/bracelet.jpg'],
        description: data.description || '',
        details: Array.isArray(data.details) && data.details.length > 0 ? data.details : ['Dây Paracord 550 cao cấp'],
        availableColors: data.availableColors,
        availableSizes: data.availableSizes,
        enableColorSelection: !!data.enableColorSelection,
        colorOptions: Array.isArray(data.colorOptions) ? data.colorOptions : undefined,
        enableCharmSelection: !!data.enableCharmSelection,
        charmOptions: Array.isArray(data.charmOptions) ? data.charmOptions : undefined,
        charmSelectionRequired: !!data.charmSelectionRequired,
        maxCharmsAllowed: typeof data.maxCharmsAllowed === 'number' ? data.maxCharmsAllowed : undefined,
        enableOmamoriSelection: !!data.enableOmamoriSelection,
        omamoriOptions: Array.isArray(data.omamoriOptions) ? data.omamoriOptions : undefined,
        omamoriSelectionRequired: !!data.omamoriSelectionRequired,
        maxOmamoriAllowed: typeof data.maxOmamoriAllowed === 'number' ? data.maxOmamoriAllowed : undefined,
        enableSizeSelection: !!data.enableSizeSelection,
        stock: rawStock,
        inStock: computedInStock,
        soldCount: typeof data.soldCount === 'number' ? data.soldCount : undefined,
        isEvent0209: !!data.isEvent0209,
        isEvent2010: !!data.isEvent2010,
        isBestSeller: !!data.isBestSeller,
        isNew: !!data.isNew,
        rating: data.rating || 5.0,
        reviewsCount: data.reviewsCount || 12,
        isHidden: !!data.isHidden,
        updatedAt: data.updatedAt || undefined
      } as Product);
      recordOperation('read');
    });

    productsMemoryCache = { data: results, expiresAt: now + 30000 };
    return results;
  } catch (err) {
    console.error('Lỗi tải sản phẩm từ Firestore:', err);
    return productsMemoryCache ? productsMemoryCache.data : [];
  }
};

/**
 * Real-time subscription to products collection for instant auto-sync across all clients
 */
export const subscribeToProductsFromFirestore = (
  callback: (products: Product[]) => void,
  onError?: (err: any) => void
): (() => void) => {
  try {
    const colRef = collection(db, 'products');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const results: Product[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const rawStock = typeof data.stock === 'number' ? data.stock : 15;
          const computedInStock = data.inStock !== false && rawStock > 0;
          results.push({
            id: docSnap.id,
            name: data.name || '',
            category: data.category || 'bracelets',
            price: data.price || 0,
            originalPrice: data.originalPrice,
            discountBadge: data.discountBadge,
            image: (data.image && typeof data.image === 'string' && data.image.trim().length > 0) ? data.image : '/assets/bracelet.jpg',
            images: Array.isArray(data.images) && data.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0).length > 0
              ? data.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0)
              : [(data.image && typeof data.image === 'string' && data.image.trim().length > 0) ? data.image : '/assets/bracelet.jpg'],
            description: data.description || '',
            details: Array.isArray(data.details) && data.details.length > 0 ? data.details : ['Dây Paracord 550 cao cấp'],
            availableColors: data.availableColors,
            availableSizes: data.availableSizes,
            enableColorSelection: !!data.enableColorSelection,
            colorOptions: Array.isArray(data.colorOptions) ? data.colorOptions : undefined,
            enableCharmSelection: !!data.enableCharmSelection,
            charmOptions: Array.isArray(data.charmOptions) ? data.charmOptions : undefined,
            charmSelectionRequired: !!data.charmSelectionRequired,
            maxCharmsAllowed: typeof data.maxCharmsAllowed === 'number' ? data.maxCharmsAllowed : undefined,
            enableOmamoriSelection: !!data.enableOmamoriSelection,
            omamoriOptions: Array.isArray(data.omamoriOptions) ? data.omamoriOptions : undefined,
            omamoriSelectionRequired: !!data.omamoriSelectionRequired,
            maxOmamoriAllowed: typeof data.maxOmamoriAllowed === 'number' ? data.maxOmamoriAllowed : undefined,
            enableSizeSelection: !!data.enableSizeSelection,
            stock: rawStock,
            inStock: computedInStock,
            soldCount: typeof data.soldCount === 'number' ? data.soldCount : undefined,
            isEvent0209: !!data.isEvent0209,
            isEvent2010: !!data.isEvent2010,
            isBestSeller: !!data.isBestSeller,
            isNew: !!data.isNew,
            rating: data.rating || 5.0,
            reviewsCount: data.reviewsCount || 12,
            isHidden: !!data.isHidden,
            updatedAt: data.updatedAt || undefined
          } as Product);
        });
        callback(results);
      },
      (error) => {
        console.warn('Real-time products snapshot error:', error);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Cannot subscribe to products:', err);
    return () => {};
  }
};

export const saveProductToFirestore = async (prod: Product): Promise<void> => {
  try {
    const docRef = doc(db, 'products', prod.id);
    const stockVal = typeof prod.stock === 'number' ? prod.stock : 15;
    const inStockVal = prod.inStock !== false && stockVal > 0;

    // 1. Optimize and compress main image only if large Base64 string (> 180KB)
    let optimizedImage = prod.image;
    if (optimizedImage && optimizedImage.startsWith('data:image/') && optimizedImage.length > 180 * 1024) {
      optimizedImage = await compressBase64Image(optimizedImage, 1400, 1400, 0.88);
    }

    // 2. Optimize and compress gallery images only if large Base64 (> 180KB)
    let optimizedImages = prod.images;
    if (Array.isArray(optimizedImages) && optimizedImages.length > 0) {
      optimizedImages = await Promise.all(
        optimizedImages.map(async (img) => {
          if (img && img.startsWith('data:image/') && img.length > 180 * 1024) {
            return await compressBase64Image(img, 1200, 1200, 0.86);
          }
          return img;
        })
      );
    }

    let payload = cleanFirestoreData({
      ...prod,
      image: optimizedImage || prod.image || '/assets/hero-bg.png',
      images: optimizedImages || (optimizedImage ? [optimizedImage] : ['/assets/hero-bg.png']),
      stock: stockVal,
      inStock: inStockVal,
      updatedAt: new Date().toISOString()
    });

    let prodSize = JSON.stringify(payload).length;

    // 3. Fallback defensive pass: Only if total payload is > 750KB (approaching 1MB limit)
    // Downscale gently to 1000px at 0.82 quality instead of crushing to 600px/0.65
    if (prodSize > 750000) {
      if (optimizedImage && optimizedImage.startsWith('data:image/')) {
        optimizedImage = await compressBase64Image(optimizedImage, 1000, 1000, 0.82);
      }
      if (Array.isArray(optimizedImages)) {
        const topImages = optimizedImages.slice(0, 5); // Limit gallery to top 5 images
        optimizedImages = await Promise.all(
          topImages.map(async (img) => {
            if (img && img.startsWith('data:image/')) {
              return await compressBase64Image(img, 1000, 1000, 0.80);
            }
            return img;
          })
        );
      }
      payload = cleanFirestoreData({
        ...prod,
        image: optimizedImage || '/assets/hero-bg.png',
        images: optimizedImages || [optimizedImage || '/assets/hero-bg.png'],
        stock: stockVal,
        inStock: inStockVal,
        updatedAt: new Date().toISOString()
      });
      prodSize = JSON.stringify(payload).length;
    }

    await setDoc(docRef, payload, { merge: true });
    productsMemoryCache = null;
    recordOperation('write', 1, prodSize);
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      console.warn('⚠️ Firestore Write Quota đạt giới hạn trong ngày. Dữ liệu tiếp tục lưu trữ cục bộ:', err);
      return;
    }
    console.error('Lỗi lưu sản phẩm lên Firestore:', err);
    throw err;
  }
};

export const deleteProductFromFirestore = async (productId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'products', productId);
    await deleteDoc(docRef);
    productsMemoryCache = null;
    recordOperation('delete', 1, -1500);
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      console.warn('⚠️ Firestore Write Quota đạt giới hạn trong ngày. Dữ liệu tiếp tục lưu trữ cục bộ:', err);
      return;
    }
    console.error('Lỗi xóa sản phẩm trên Firestore:', err);
    throw err;
  }
};

// ----------------------------------------------------
// Firestore Orders CRUD
// ----------------------------------------------------
export const fetchOrdersFromFirestore = async (): Promise<StoredOrder[]> => {
  try {
    recordOperation('read');
    const colRef = collection(db, 'orders');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const results: StoredOrder[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      results.push({
        ...data,
        id: docSnap.id,
        date: data.date || data.createdAt || '',
        createdAt: data.createdAt || data.date || '',
        name: data.name || data.customerName || '',
        customerName: data.customerName || data.name || '',
        phone: data.phone || '',
        address: data.address || '',
        note: data.note || '',
        items: data.items || [],
        itemDetails: data.itemDetails || [],
        totalPrice: data.totalPrice !== undefined ? Number(data.totalPrice) : (Number(data.totalAmount) || 0),
        totalAmount: data.totalAmount !== undefined ? Number(data.totalAmount) : (Number(data.totalPrice) || 0),
        shippingFee: Number(data.shippingFee) || 0,
        discountAmount: Number(data.discountAmount) || 0,
        craftingStageNote: data.craftingStageNote || '',
        source: data.source || 'website',
        type: data.type || 'standard_order',
        status: data.status || 'pending',
        paymentMethod: data.paymentMethod || (data.bankReceiptImage ? 'bank_transfer' : 'cod'),
        paymentStatus: data.paymentStatus || (data.bankReceiptImage ? 'paid' : 'unpaid'),
        bankReceiptImage: data.bankReceiptImage || '',
        paidAmount: data.paidAmount !== undefined ? Number(data.paidAmount) : (data.paymentStatus === 'paid' ? (Number(data.totalPrice) || 0) : 0),
        bankTransferRef: data.bankTransferRef || '',
        sellerId: data.sellerId || '',
        sellerName: data.sellerName || '',
        trackingNumber: data.trackingNumber || '',
        shippingCarrier: data.shippingCarrier || '',
        shippingCode: data.shippingCode || '',
        estimatedDelivery: data.estimatedDelivery || '',
        statusHistory: data.statusHistory || []
      });
      recordOperation('read');
    });
    return results;
  } catch (err) {
    console.error('Lỗi tải đơn hàng từ Firestore:', err);
    return [];
  }
};

export const getOrdersFromFirestore = fetchOrdersFromFirestore;

export const saveOrderToFirestore = async (order: StoredOrder): Promise<void> => {
  try {
    const orderId = order.id || `ord-${Date.now()}`;
    const docRef = doc(db, 'orders', orderId);

    // Compress bank receipt image if present as Base64
    let receiptImage = order.bankReceiptImage;
    if (receiptImage && receiptImage.startsWith('data:image/')) {
      receiptImage = await compressBase64Image(receiptImage, 900, 900, 0.80);
    }

    const payload = cleanFirestoreData({
      ...order,
      id: orderId,
      bankReceiptImage: receiptImage,
      createdAt: order.createdAt || new Date().toISOString()
    });
    const orderSize = JSON.stringify(payload).length;
    await setDoc(docRef, payload, { merge: true });
    recordOperation('write', 1, orderSize);
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      console.warn('⚠️ Firestore Write Quota đạt giới hạn trong ngày. Đơn hàng tiếp tục lưu trữ cục bộ:', err);
      return;
    }
    console.error('Lỗi lưu đơn hàng Firestore:', err);
    throw err;
  }
};

export const saveOrdersToFirestore = async (ordersList: StoredOrder[]): Promise<void> => {
  for (const ord of ordersList) {
    await saveOrderToFirestore(ord);
  }
};

export const saveProductsToFirestore = async (productsList: Product[]): Promise<void> => {
  for (const p of productsList) {
    await saveProductToFirestore(p);
  }
};

/**
 * Đẩy danh sách sản phẩm lên Firestore VÀ dọn sạch các sản phẩm trên Firestore
 * không còn nằm trong danh sách hiện tại (giúp Firestore đồng bộ chính xác 100% với local).
 */
export const pushAndSyncProductsToFirestore = async (
  productsList: Product[],
  purgeObsolete: boolean = true
): Promise<{ saved: number; deleted: number }> => {
  try {
    let deletedCount = 0;
    if (purgeObsolete) {
      // 1. Lấy danh sách ID hiện tại trên Firestore
      const snap = await getDocs(collection(db, 'products'));
      recordOperation('read', 1);
      const currentIds = new Set(productsList.map((p) => p.id));
      const toDeleteDocs: string[] = [];
      snap.forEach((docSnap) => {
        if (!currentIds.has(docSnap.id)) {
          toDeleteDocs.push(docSnap.id);
        }
      });

      // Xóa các sản phẩm cũ trên Firestore theo từng đợt
      for (let i = 0; i < toDeleteDocs.length; i += 10) {
        const chunk = toDeleteDocs.slice(i, i + 10);
        await Promise.all(
          chunk.map(async (id) => {
            try {
              await deleteDoc(doc(db, 'products', id));
              recordOperation('delete', 1, -1500);
            } catch (e) {
              console.warn('Lỗi dọn dẹp sản phẩm cũ:', id, e);
            }
          })
        );
      }
      deletedCount = toDeleteDocs.length;
    }

    // 2. Lưu các sản phẩm hiện tại lên Firestore (chia batch song song 6 item)
    const batchSize = 6;
    for (let i = 0; i < productsList.length; i += batchSize) {
      const chunk = productsList.slice(i, i + batchSize);
      await Promise.all(chunk.map((p) => saveProductToFirestore(p)));
    }

    return { saved: productsList.length, deleted: deletedCount };
  } catch (err) {
    console.error('Lỗi pushAndSyncProductsToFirestore:', err);
    throw err;
  }
};

/**
 * Đẩy danh mục lên Firestore VÀ dọn sạch các danh mục cũ không còn trong danh sách
 */
export const pushAndSyncCategoriesToFirestore = async (
  categoriesList: CategoryItem[],
  purgeObsolete: boolean = true
): Promise<{ saved: number; deleted: number }> => {
  try {
    let deletedCount = 0;
    if (purgeObsolete) {
      const snap = await getDocs(collection(db, 'categories'));
      recordOperation('read', 1);
      const currentCatIds = new Set(categoriesList.map((c) => c.id));
      const toDeleteDocs: string[] = [];
      snap.forEach((docSnap) => {
        if (!currentCatIds.has(docSnap.id)) {
          toDeleteDocs.push(docSnap.id);
        }
      });
      for (const id of toDeleteDocs) {
        try {
          await deleteDoc(doc(db, 'categories', id));
          recordOperation('delete', 1, -500);
        } catch (e) {
          console.warn('Lỗi dọn dẹp category cũ:', id, e);
        }
      }
      deletedCount = toDeleteDocs.length;
    }

    await Promise.all(categoriesList.map((c) => saveCategoryToFirestore(c)));
    return { saved: categoriesList.length, deleted: deletedCount };
  } catch (err) {
    console.error('Lỗi pushAndSyncCategoriesToFirestore:', err);
    throw err;
  }
};

export const saveCategoriesToFirestore = async (categoriesList: CategoryItem[]): Promise<void> => {
  for (const c of categoriesList) {
    await saveCategoryToFirestore(c);
  }
};

export const saveCollectionsToFirestore = async (collectionsList: CollectionInfo[]): Promise<void> => {
  for (const col of collectionsList) {
    await saveCollectionToFirestore(col);
  }
};

export const updateOrderStatusInFirestore = async (
  orderId: string,
  status: string,
  extra?: { paymentStatus?: 'paid' | 'unpaid'; paidAmount?: number }
): Promise<void> => {
  try {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, cleanFirestoreData({
      status,
      ...(extra?.paymentStatus ? { paymentStatus: extra.paymentStatus } : {}),
      ...(extra?.paidAmount !== undefined ? { paidAmount: extra.paidAmount } : {}),
      updatedAt: new Date().toISOString()
    }));
    recordOperation('write', 1, 100);
  } catch (err) {
    console.error('Lỗi cập nhật trạng thái đơn hàng Firestore:', err);
    throw err;
  }
};

/**
 * Real-time subscription to orders collection for instant sync
 */
export const subscribeToOrdersFromFirestore = (
  callback: (orders: StoredOrder[]) => void,
  onError?: (err: any) => void
): (() => void) => {
  try {
    const colRef = collection(db, 'orders');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const results: StoredOrder[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          results.push({
            ...data,
            id: docSnap.id,
            date: data.date || data.createdAt || '',
            createdAt: data.createdAt || data.date || new Date().toISOString(),
            name: data.name || data.customerName || '',
            customerName: data.customerName || data.name || '',
            phone: data.phone || '',
            address: data.address || '',
            note: data.note || '',
            items: data.items || [],
            itemDetails: data.itemDetails || [],
            totalPrice: data.totalPrice !== undefined ? Number(data.totalPrice) : (Number(data.totalAmount) || 0),
            totalAmount: data.totalAmount !== undefined ? Number(data.totalAmount) : (Number(data.totalPrice) || 0),
            shippingFee: Number(data.shippingFee) || 0,
            discountAmount: Number(data.discountAmount) || 0,
            craftingStageNote: data.craftingStageNote || '',
            source: data.source || 'website',
            type: data.type || 'standard_order',
            status: data.status || 'pending',
            paymentMethod: data.paymentMethod || (data.bankReceiptImage ? 'bank_transfer' : 'cod'),
            paymentStatus: data.paymentStatus || (data.bankReceiptImage ? 'paid' : 'unpaid'),
            bankReceiptImage: data.bankReceiptImage || '',
            paidAmount: data.paidAmount !== undefined ? Number(data.paidAmount) : (data.paymentStatus === 'paid' ? (Number(data.totalPrice) || 0) : 0),
            bankTransferRef: data.bankTransferRef || '',
            sellerId: data.sellerId || '',
            sellerName: data.sellerName || '',
            trackingNumber: data.trackingNumber || '',
            shippingCarrier: data.shippingCarrier || '',
            shippingCode: data.shippingCode || '',
            estimatedDelivery: data.estimatedDelivery || '',
            statusHistory: data.statusHistory || []
          });
        });
        // Sort descending by createdAt
        results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        callback(results);
      },
      (error) => {
        console.warn('Real-time orders snapshot error:', error);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Cannot subscribe to orders:', err);
    return () => {};
  }
};

export const deleteOrderFromFirestore = async (orderId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'orders', orderId);
    await deleteDoc(docRef);
    ordersMemoryCache = null;
    recordOperation('delete', 1, -900);
  } catch (err) {
    console.error('Lỗi xóa đơn hàng Firestore:', err);
    throw err;
  }
};

/**
 * Fast bulk order deletion using atomic writeBatch for maximum speed
 */
export const deleteOrdersBatchFromFirestore = async (orderIds: string[]): Promise<void> => {
  if (!orderIds || orderIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    orderIds.forEach((id) => {
      const docRef = doc(db, 'orders', id);
      batch.delete(docRef);
    });
    await batch.commit();
    ordersMemoryCache = null;
    recordOperation('delete', orderIds.length, -900 * orderIds.length);
  } catch (err) {
    console.error('Lỗi xóa batch đơn hàng Firestore:', err);
    throw err;
  }
};

// ----------------------------------------------------
// Firestore Categories CRUD
// ----------------------------------------------------
export const fetchCategoriesFromFirestore = async (forceRefresh = false): Promise<CategoryItem[]> => {
  try {
    const now = Date.now();
    if (!forceRefresh && categoriesMemoryCache && categoriesMemoryCache.expiresAt > now) {
      return categoriesMemoryCache.data;
    }

    recordOperation('read', 1);
    const colRef = collection(db, 'categories');
    const snap = await getDocs(colRef);

    if (snap.empty) {
      return DEFAULT_CATEGORIES;
    }

    const results: CategoryItem[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      results.push({
        id: docSnap.id,
        label: data.label || docSnap.id,
        description: data.description,
        introText: data.introText,
        bannerImage: data.bannerImage,
        highlightColor: data.highlightColor,
        badge: data.badge,
        isEvent: !!data.isEvent,
        isHidden: !!data.isHidden
      });
    });

    categoriesMemoryCache = { data: results, expiresAt: now + 30000 };
    return results;
  } catch (err) {
    console.error('Lỗi tải danh mục từ Firestore:', err);
    return categoriesMemoryCache ? categoriesMemoryCache.data : DEFAULT_CATEGORIES;
  }
};

/**
 * Real-time subscription to categories collection for instant auto-sync
 */
export const subscribeToCategoriesFromFirestore = (
  callback: (categories: CategoryItem[]) => void,
  onError?: (err: any) => void
): (() => void) => {
  try {
    const colRef = collection(db, 'categories');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const results: CategoryItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          results.push({
            id: docSnap.id,
            label: data.label || docSnap.id,
            description: data.description,
            introText: data.introText,
            bannerImage: data.bannerImage,
            highlightColor: data.highlightColor,
            badge: data.badge,
            isEvent: !!data.isEvent,
            isHidden: !!data.isHidden
          });
        });
        callback(results);
      },
      (error) => {
        console.warn('Real-time categories snapshot error:', error);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Cannot subscribe to categories:', err);
    return () => {};
  }
};

export const saveCategoryToFirestore = async (category: CategoryItem): Promise<void> => {
  try {
    const docRef = doc(db, 'categories', category.id);
    const payload = cleanFirestoreData({
      ...category,
      updatedAt: new Date().toISOString()
    });
    const catSize = JSON.stringify(payload).length;
    await setDoc(docRef, payload, { merge: true });
    recordOperation('write', 1, catSize);
  } catch (err) {
    console.error('Lỗi lưu danh mục Firestore:', err);
    throw err;
  }
};

export const deleteCategoryFromFirestore = async (categoryId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'categories', categoryId);
    await deleteDoc(docRef);
    recordOperation('delete', 1, -400);
  } catch (err) {
    console.error('Lỗi xóa danh mục Firestore:', err);
    throw err;
  }
};

// ----------------------------------------------------
// Firestore Collections / Banners CRUD
// ----------------------------------------------------
export const fetchCollectionsFromFirestore = async (): Promise<CollectionInfo[]> => {
  try {
    recordOperation('read', 1);
    const colRef = collection(db, 'collections');
    const snap = await getDocs(colRef);
    const results: CollectionInfo[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      results.push({
        id: docSnap.id,
        categoryKey: data.categoryKey || docSnap.id,
        tag: data.tag || '',
        title: data.title || '',
        subtitle: data.subtitle || '',
        highlight: data.highlight || '',
        story: data.story || '',
        craftDetails: data.craftDetails || [],
        bgImage: data.bgImage || '',
        bannerImage: data.bannerImage || data.bgImage || '',
        badge: data.badge || '',
        isPreorder: !!data.isPreorder,
        themeColor: data.themeColor || '#B41C1A',
        accentColor: data.accentColor || '',
        order: typeof data.order === 'number' ? data.order : 0,
        buttonText: data.buttonText || '',
        themeStyle: data.themeStyle || 'light',
        isHidden: !!data.isHidden
      });
    });
    if (results.length > 0) {
      results.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return results;
  } catch (err) {
    console.error('Lỗi tải bộ sưu tập từ Firestore:', err);
    return [];
  }
};

/**
 * Real-time subscription to collections for instant auto-sync
 */
export const subscribeToCollectionsFromFirestore = (
  callback: (collections: CollectionInfo[]) => void,
  onError?: (err: any) => void
): (() => void) => {
  try {
    const colRef = collection(db, 'collections');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const results: CollectionInfo[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          results.push({
            id: docSnap.id,
            categoryKey: data.categoryKey || docSnap.id,
            tag: data.tag || '',
            title: data.title || '',
            subtitle: data.subtitle || '',
            highlight: data.highlight || '',
            story: data.story || '',
            craftDetails: data.craftDetails || [],
            bgImage: data.bgImage || '',
            bannerImage: data.bannerImage || data.bgImage || '',
            badge: data.badge || '',
            isPreorder: !!data.isPreorder,
            themeColor: data.themeColor || '#B41C1A',
            accentColor: data.accentColor || '',
            order: typeof data.order === 'number' ? data.order : 0,
            buttonText: data.buttonText || '',
            themeStyle: data.themeStyle || 'light',
            isHidden: !!data.isHidden
          });
        });
        results.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        callback(results);
      },
      (error) => {
        console.warn('Real-time collections snapshot error:', error);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Cannot subscribe to collections:', err);
    return () => {};
  }
};

export const saveCollectionToFirestore = async (collectionItem: CollectionInfo): Promise<void> => {
  try {
    const docRef = doc(db, 'collections', collectionItem.id);

    let bgImage = collectionItem.bgImage;
    if (bgImage && bgImage.startsWith('data:image/')) {
      bgImage = await compressBase64Image(bgImage, 1200, 800, 0.80);
    }

    let bannerImage = collectionItem.bannerImage;
    if (bannerImage && bannerImage.startsWith('data:image/')) {
      bannerImage = await compressBase64Image(bannerImage, 1200, 800, 0.80);
    }

    let horizontalImage = collectionItem.horizontalImage;
    if (horizontalImage && horizontalImage.startsWith('data:image/')) {
      horizontalImage = await compressBase64Image(horizontalImage, 1200, 800, 0.80);
    }

    let productPageBanner = collectionItem.productPageBanner;
    if (productPageBanner && productPageBanner.startsWith('data:image/')) {
      productPageBanner = await compressBase64Image(productPageBanner, 1200, 800, 0.80);
    }

    const payload = cleanFirestoreData({
      ...collectionItem,
      bgImage,
      bannerImage,
      horizontalImage,
      productPageBanner,
      updatedAt: new Date().toISOString()
    });
    const itemSize = JSON.stringify(payload).length;
    await setDoc(docRef, payload, { merge: true });
    recordOperation('write', 1, itemSize);
  } catch (err) {
    console.error('Lỗi lưu bộ sưu tập Firestore:', err);
    throw err;
  }
};

export const deleteCollectionFromFirestore = async (collectionId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'collections', collectionId);
    await deleteDoc(docRef);
    recordOperation('delete', 1, -400);
  } catch (err) {
    console.error('Lỗi xóa bộ sưu tập Firestore:', err);
    throw err;
  }
};

/**
 * Clean orphans and synchronize entire collections list to Firestore
 */
export const pushAndSyncCollectionsToFirestore = async (
  collectionsList: CollectionInfo[],
  cleanOrphans = true
): Promise<{ saved: number; deleted: number }> => {
  try {
    let deletedCount = 0;
    if (cleanOrphans) {
      const existing = await fetchCollectionsFromFirestore();
      const currentIds = new Set(collectionsList.map((c) => c.id));
      const toDeleteDocs = existing.filter((c) => !currentIds.has(c.id)).map((c) => c.id);

      for (const id of toDeleteDocs) {
        try {
          await deleteDoc(doc(db, 'collections', id));
          recordOperation('delete', 1, -400);
        } catch (e) {
          console.warn('Lỗi dọn dẹp collection cũ:', id, e);
        }
      }
      deletedCount = toDeleteDocs.length;
    }

    await Promise.all(collectionsList.map((c) => saveCollectionToFirestore(c)));
    return { saved: collectionsList.length, deleted: deletedCount };
  } catch (err) {
    console.error('Lỗi pushAndSyncCollectionsToFirestore:', err);
    throw err;
  }
};

// ----------------------------------------------------
// Site Content & Visual Elements Configuration Sync
// ----------------------------------------------------
export const fetchSiteContentFromFirestore = async (): Promise<SiteContentConfig | null> => {
  try {
    recordOperation('read');
    const docRef = doc(db, 'site_content', 'main_config');
    const snap = await getDocs(query(collection(db, 'site_content')));
    if (!snap.empty) {
      const found = snap.docs.find(d => d.id === 'main_config');
      if (found && found.exists()) {
        return found.data() as SiteContentConfig;
      }
    }
    return null;
  } catch (err) {
    console.error('Lỗi tải cấu hình website từ Firestore:', err);
    return null;
  }
};

/**
 * Real-time subscription to site content for instant auto-sync
 */
export const subscribeToSiteContentFromFirestore = (
  callback: (config: SiteContentConfig) => void,
  onError?: (err: any) => void
): (() => void) => {
  try {
    const docRef = doc(db, 'site_content', 'main_config');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as SiteContentConfig);
        }
      },
      (error) => {
        console.warn('Real-time site content snapshot error:', error);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Cannot subscribe to site content:', err);
    return () => {};
  }
};

export const saveSiteContentToFirestore = async (config: SiteContentConfig): Promise<void> => {
  try {
    const docRef = doc(db, 'site_content', 'main_config');

    // Compress hero slides images if any Base64 strings exist
    let heroSlides = config.heroSlides;
    if (Array.isArray(heroSlides) && heroSlides.length > 0) {
      heroSlides = await Promise.all(
        heroSlides.map(async (slide) => {
          let bgImg = slide.bgImage;
          if (bgImg && bgImg.startsWith('data:image/')) {
            bgImg = await compressBase64Image(bgImg, 1200, 800, 0.80);
          }
          let bgImgMobile = slide.bgImageMobile;
          if (bgImgMobile && bgImgMobile.startsWith('data:image/')) {
            bgImgMobile = await compressBase64Image(bgImgMobile, 900, 1600, 0.82);
          }
          return { ...slide, bgImage: bgImg, bgImageMobile: bgImgMobile };
        })
      );
    }

    const payload = cleanFirestoreData({
      ...config,
      heroSlides,
      updatedAt: new Date().toISOString()
    });
    const dataSize = JSON.stringify(payload).length;
    await setDoc(docRef, payload, { merge: true });
    recordOperation('write', dataSize);
  } catch (err) {
    console.error('Lỗi lưu cấu hình website vào Firestore:', err);
    throw err;
  }
};

// ----------------------------------------------------
// Contact Messages CRUD
// ----------------------------------------------------
export const fetchContactMessagesFromFirestore = async (): Promise<ContactMessage[]> => {
  try {
    recordOperation('read');
    const colRef = collection(db, 'contact_messages');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const results: ContactMessage[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      results.push({
        id: docSnap.id,
        name: data.name || '',
        contactInfo: data.contactInfo || data.email || data.phone || '',
        email: data.email || '',
        phone: data.phone || '',
        message: data.message || '',
        createdAt: data.createdAt || new Date().toISOString(),
        timestamp: data.timestamp || Date.now(),
        isRead: data.isRead ?? false,
        status: data.status || (data.isRead ? 'read' : 'unread')
      });
      recordOperation('read');
    });
    return results;
  } catch (err) {
    console.error('Lỗi tải tin nhắn liên hệ từ Firestore:', err);
    // Fallback to localStorage cache
    try {
      const cached = localStorage.getItem('nak_contact_messages');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // ignore
    }
    return [];
  }
};

/**
 * Real-time subscription to contact messages for instant auto-sync
 */
export const subscribeToContactMessagesFromFirestore = (
  callback: (messages: ContactMessage[]) => void,
  onError?: (err: any) => void
): (() => void) => {
  try {
    const colRef = collection(db, 'contact_messages');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const results: ContactMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          results.push({
            id: docSnap.id,
            name: data.name || '',
            contactInfo: data.contactInfo || data.email || data.phone || '',
            email: data.email || '',
            phone: data.phone || '',
            message: data.message || '',
            createdAt: data.createdAt || new Date().toISOString(),
            timestamp: data.timestamp || Date.now(),
            isRead: data.isRead ?? false,
            status: data.status || (data.isRead ? 'read' : 'unread')
          });
        });
        results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        callback(results);
      },
      (error) => {
        console.warn('Real-time contact messages snapshot error:', error);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Cannot subscribe to contact messages:', err);
    return () => {};
  }
};

export const saveContactMessageToFirestore = async (msg: ContactMessage): Promise<void> => {
  try {
    const msgId = msg.id || `msg-${Date.now()}`;
    const docRef = doc(db, 'contact_messages', msgId);
    const payload = cleanFirestoreData({
      ...msg,
      id: msgId,
      createdAt: msg.createdAt || new Date().toISOString(),
      timestamp: msg.timestamp || Date.now(),
      isRead: msg.isRead ?? false,
      status: msg.status || 'unread'
    });
    await setDoc(docRef, payload, { merge: true });
    recordOperation('write', 1, JSON.stringify(payload).length);

    // Also update local cache
    try {
      const existing = localStorage.getItem('nak_contact_messages');
      const list: ContactMessage[] = existing ? JSON.parse(existing) : [];
      const updated = [payload, ...list.filter((m) => m.id !== msgId)];
      localStorage.setItem('nak_contact_messages', JSON.stringify(updated));
    } catch {
      // ignore
    }
  } catch (err) {
    console.error('Lỗi lưu tin nhắn liên hệ vào Firestore:', err);
    // Ensure saved to local cache even if Firestore fails
    try {
      const existing = localStorage.getItem('nak_contact_messages');
      const list: ContactMessage[] = existing ? JSON.parse(existing) : [];
      const updated = [msg, ...list.filter((m) => m.id !== msg.id)];
      localStorage.setItem('nak_contact_messages', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
};

export const updateContactMessageStatusInFirestore = async (id: string, isRead: boolean): Promise<void> => {
  try {
    const docRef = doc(db, 'contact_messages', id);
    await updateDoc(docRef, cleanFirestoreData({
      isRead,
      status: isRead ? 'read' : 'unread',
      updatedAt: new Date().toISOString()
    }));
    recordOperation('write', 1, 60);

    // Update local cache
    try {
      const existing = localStorage.getItem('nak_contact_messages');
      if (existing) {
        const list: ContactMessage[] = JSON.parse(existing);
        const updated = list.map((m) => m.id === id ? { ...m, isRead, status: isRead ? 'read' : 'unread' } : m);
        localStorage.setItem('nak_contact_messages', JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
  } catch (err) {
    console.error('Lỗi cập nhật trạng thái tin nhắn trên Firestore:', err);
    // Update local cache anyway
    try {
      const existing = localStorage.getItem('nak_contact_messages');
      if (existing) {
        const list: ContactMessage[] = JSON.parse(existing);
        const updated = list.map((m) => (m.id === id ? { ...m, isRead, status: isRead ? ('read' as const) : ('unread' as const) } : m));
        localStorage.setItem('nak_contact_messages', JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
  }
};

export const deleteContactMessageFromFirestore = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, 'contact_messages', id);
    await deleteDoc(docRef);
    recordOperation('delete', 1, -300);

    // Update local cache
    try {
      const existing = localStorage.getItem('nak_contact_messages');
      if (existing) {
        const list: ContactMessage[] = JSON.parse(existing);
        const updated = list.filter((m) => m.id !== id);
        localStorage.setItem('nak_contact_messages', JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
  } catch (err) {
    console.error('Lỗi xóa tin nhắn trên Firestore:', err);
    // Remove from local cache anyway
    try {
      const existing = localStorage.getItem('nak_contact_messages');
      if (existing) {
        const list: ContactMessage[] = JSON.parse(existing);
        const updated = list.filter((m) => m.id !== id);
        localStorage.setItem('nak_contact_messages', JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
  }
};

// ----------------------------------------------------
// Firestore Sellers & Admin Users CRUD
// ----------------------------------------------------
export const fetchSellersFromFirestore = async (): Promise<SellerUser[]> => {
  try {
    recordOperation('read', 1);
    const colRef = collection(db, 'sellers');
    const q = query(colRef, orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    const results: SellerUser[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      results.push({
        id: docSnap.id,
        username: data.username || docSnap.id,
        name: data.name || data.username || '',
        passwordHash: data.passwordHash || '',
        passwordSalt: data.passwordSalt || '',
        isRootAdmin: !!data.isRootAdmin,
        role: data.role || (data.isRootAdmin ? 'root_admin' : 'member'),
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        lastLoginAt: data.lastLoginAt,
        avatarColor: data.avatarColor || '#B41C1A',
        phone: data.phone || ''
      });
    });

    // Deduplicate results by ID and username
    const seen = new Set<string>();
    const deduplicatedResults: SellerUser[] = [];
    for (const item of results) {
      const idKey = (item.id || '').toLowerCase().trim();
      const userKey = (item.username || '').toLowerCase().trim();
      if ((idKey && seen.has(idKey)) || (userKey && seen.has(userKey))) continue;
      if (idKey) seen.add(idKey);
      if (userKey) seen.add(userKey);
      deduplicatedResults.push(item);
    }
    return deduplicatedResults;
  } catch (err) {
    console.error('Lỗi tải danh sách người bán từ Firestore:', err);
    return [];
  }
};

export const saveSellerToFirestore = async (seller: SellerUser): Promise<void> => {
  try {
    const sellerId = seller.id || `seller-${seller.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const docRef = doc(db, 'sellers', sellerId);
    const payload = cleanFirestoreData({
      ...seller,
      id: sellerId,
      updatedAt: new Date().toISOString()
    });
    await setDoc(docRef, payload, { merge: true });
    recordOperation('write', 1, JSON.stringify(payload).length);
  } catch (err) {
    console.error('Lỗi lưu tài khoản người bán trên Firestore:', err);
    throw err;
  }
};

export const saveSellersToFirestore = async (sellersList: SellerUser[]): Promise<void> => {
  for (const s of sellersList) {
    await saveSellerToFirestore(s);
  }
};

export const deleteSellerFromFirestore = async (sellerId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'sellers', sellerId);
    await deleteDoc(docRef);
    recordOperation('delete', 1, -400);
  } catch (err) {
    console.error('Lỗi xóa người bán trên Firestore:', err);
    throw err;
  }
};

// Ping / Connection Test
export const testFirebaseConnection = async (): Promise<boolean> => {
  try {
    recordOperation('read', 1);
    const colRef = collection(db, 'products');
    await getDocs(query(colRef, limit(1)));
    return true;
  } catch (e) {
    console.warn('Firebase test connection:', e);
    return false;
  }
};

// ==========================================
// VERSION HISTORY & CLOUD BACKUPS (MAX 5)
// ==========================================

const IDB_BACKUP_DB = 'notaknot_backups_idb';
const IDB_BACKUP_STORE = 'backups_store';

function openBackupIDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return resolve(null);
    }
    try {
      const request = window.indexedDB.open(IDB_BACKUP_DB, 1);
      request.onupgradeneeded = () => {
        const idb = request.result;
        if (!idb.objectStoreNames.contains(IDB_BACKUP_STORE)) {
          idb.createObjectStore(IDB_BACKUP_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveBackupsToIDB(backups: VersionBackup[]): Promise<void> {
  try {
    const idb = await openBackupIDB();
    if (!idb) return;
    const tx = idb.transaction(IDB_BACKUP_STORE, 'readwrite');
    const store = tx.objectStore(IDB_BACKUP_STORE);
    store.clear();
    for (const b of backups) {
      store.put(b);
    }
  } catch {
    // fallback gracefully
  }
}

async function loadBackupsFromIDB(): Promise<VersionBackup[]> {
  try {
    const idb = await openBackupIDB();
    if (!idb) return [];
    return new Promise((resolve) => {
      try {
        const tx = idb.transaction(IDB_BACKUP_STORE, 'readonly');
        const store = tx.objectStore(IDB_BACKUP_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve((request.result as VersionBackup[]) || []);
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } catch {
    return [];
  }
}

function deepSanitizeBackup(obj: any, maxDataUriLen: number = 2000): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'string') {
    // If it's a base64 image data URI that is heavy, replace with safe fallback asset
    if (obj.startsWith('data:image/') && obj.length > maxDataUriLen) {
      return '/assets/bracelet.jpg';
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepSanitizeBackup(item, maxDataUriLen));
  }
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        res[k] = deepSanitizeBackup(v, maxDataUriLen);
      }
    }
    return res;
  }
  return obj;
}

function sanitizeBackupForFirestore(backup: VersionBackup): any {
  // 1. Clean undefined and non-serializable fields
  let cleaned = cleanFirestoreData(backup);
  // 2. Strip excessive base64 strings so document fits within Firestore's 1MB limit
  cleaned = deepSanitizeBackup(cleaned, 1500);

  try {
    let str = JSON.stringify(cleaned);
    // If payload is still approaching 600KB, strip all base64 data URIs down
    if (str.length > 600000) {
      cleaned = deepSanitizeBackup(cleaned, 200);
      str = JSON.stringify(cleaned);
    }
    if (str.length > 600000) {
      cleaned = deepSanitizeBackup(cleaned, 50);
    }
  } catch {}

  if (cleaned && typeof cleaned === 'object') {
    delete (cleaned as any).syncedToCloud;
  }
  return cleaned;
}

export const fetchBackupsFromFirestore = async (): Promise<VersionBackup[]> => {
  const backupMap = new Map<string, VersionBackup>();
  const cloudDocIds = new Set<string>();

  // 1. Query Firestore FIRST (Primary Cloud source of truth across all devices)
  try {
    recordOperation('read');
    const colRef = collection(db, 'backups');
    const snap = await getDocs(colRef);
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.createdAt) {
        cloudDocIds.add(docSnap.id);
        backupMap.set(docSnap.id, {
          id: docSnap.id,
          ...data,
          syncedToCloud: true
        } as VersionBackup);
      }
    });
  } catch (err) {
    console.warn('Không thể tải backup từ Firestore, sử dụng bộ nhớ cục bộ:', err);
  }

  // 2. Read from IndexedDB (local cache fallback / enrichment)
  const unsyncedBackups: VersionBackup[] = [];
  try {
    const idbList = await loadBackupsFromIDB();
    idbList.forEach((b) => {
      if (b && b.id) {
        const existing = backupMap.get(b.id);
        if (!existing) {
          const isCloud = cloudDocIds.has(b.id);
          const withStatus = { ...b, syncedToCloud: isCloud };
          backupMap.set(b.id, withStatus);
          if (!isCloud) {
            unsyncedBackups.push(withStatus);
          }
        } else if (!existing.data && b.data) {
          existing.data = b.data;
        }
      }
    });
  } catch {}

  // 3. Read from localStorage cache fallback
  try {
    const cached = localStorage.getItem('notaknot_backups_cache');
    if (cached) {
      const list: VersionBackup[] = JSON.parse(cached);
      if (Array.isArray(list)) {
        list.forEach((b) => {
          if (b && b.id && !backupMap.has(b.id)) {
            const isCloud = cloudDocIds.has(b.id);
            const withStatus = { ...b, syncedToCloud: isCloud };
            backupMap.set(b.id, withStatus);
            if (!isCloud) {
              unsyncedBackups.push(withStatus);
            }
          }
        });
      }
    }
  } catch {}

  // 4. AUTO-SYNC: If there are local backups that only exist on this machine, upload them to Firebase Cloud!
  if (unsyncedBackups.length > 0) {
    console.log(`Tự động đồng bộ ${unsyncedBackups.length} bản sao lưu từ máy này lên Firebase Cloud...`);
    for (const unsynced of unsyncedBackups) {
      try {
        const docRef = doc(db, 'backups', unsynced.id);
        const cleaned = sanitizeBackupForFirestore(unsynced);
        await setDoc(docRef, cleaned);
        recordOperation('write', 1, 2000);
        unsynced.syncedToCloud = true;
        const inMap = backupMap.get(unsynced.id);
        if (inMap) inMap.syncedToCloud = true;
      } catch (e) {
        console.warn('Lỗi khi đồng bộ backup lên Cloud:', e);
      }
    }
  }

  const result = Array.from(backupMap.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  if (result.length > 0) {
    saveBackupsToIDB(result);
    try {
      localStorage.setItem('notaknot_backups_cache', JSON.stringify(result));
    } catch {}
  }

  return result;
};

/**
 * Saves a backup to Firestore Cloud, IndexedDB, and localStorage cache, retaining the latest 5 backups.
 */
export const saveBackupToFirestore = async (backup: VersionBackup): Promise<VersionBackup[]> => {
  // 1. Persist to Firestore Cloud FIRST
  let cloudSuccess = false;
  try {
    const docRef = doc(db, 'backups', backup.id);
    const cleaned = sanitizeBackupForFirestore(backup);
    await setDoc(docRef, cleaned);
    recordOperation('write', 1, 2500);
    cloudSuccess = true;
    backup.syncedToCloud = true;

    // Enforce max 5 documents on Firestore
    const colRef = collection(db, 'backups');
    const snap = await getDocs(colRef);
    const fsDocs: { id: string; createdAt: string }[] = [];
    snap.forEach((d) => {
      const data = d.data();
      fsDocs.push({ id: d.id, createdAt: data?.createdAt || '' });
    });
    fsDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (fsDocs.length > 5) {
      const toDelete = fsDocs.slice(5);
      for (const oldDoc of toDelete) {
        try {
          await deleteDoc(doc(db, 'backups', oldDoc.id));
          recordOperation('delete', 1, -2500);
        } catch (delErr) {
          console.warn('Không thể xóa backup cũ vượt quá giới hạn 5:', delErr);
        }
      }
    }
  } catch (err: any) {
    console.error('Lưu backup Firestore gặp lỗi lần 1, đang thử nén siêu gọn...', err);
    try {
      const ultraCleaned = deepSanitizeBackup(cleanFirestoreData(backup), 50);
      delete (ultraCleaned as any).syncedToCloud;
      const docRef = doc(db, 'backups', backup.id);
      await setDoc(docRef, ultraCleaned);
      recordOperation('write', 1, 1500);
      cloudSuccess = true;
      backup.syncedToCloud = true;
    } catch (retryErr: any) {
      console.warn('Không thể lưu backup lên Firestore (vượt quá dung lượng 1MB hoặc lỗi mạng), chuyển sang lưu trữ an toàn cục bộ trên máy:', retryErr);
      cloudSuccess = false;
      backup.syncedToCloud = false;
    }
  }

  // 2. Fetch existing backups from all sources
  const existingList = await fetchBackupsFromFirestore();
  const updatedList: VersionBackup[] = [
    { ...backup, syncedToCloud: cloudSuccess },
    ...existingList.filter((b) => b.id !== backup.id)
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // 3. Immediately persist to IndexedDB and localStorage
  await saveBackupsToIDB(updatedList);
  try {
    localStorage.setItem('notaknot_backups_cache', JSON.stringify(updatedList));
  } catch {}

  return updatedList;
};

export const syncLocalBackupsToFirestore = async (): Promise<{ syncedCount: number; errors: number }> => {
  let syncedCount = 0;
  let errors = 0;
  try {
    const list = await fetchBackupsFromFirestore();
    for (const b of list) {
      if (!b.syncedToCloud) {
        try {
          const docRef = doc(db, 'backups', b.id);
          const cleaned = sanitizeBackupForFirestore(b);
          await setDoc(docRef, cleaned);
          recordOperation('write', 1, 2000);
          b.syncedToCloud = true;
          syncedCount++;
        } catch (err) {
          console.error(`Lỗi đồng bộ bản sao lưu ${b.id}:`, err);
          errors++;
        }
      }
    }
    if (syncedCount > 0) {
      await saveBackupsToIDB(list);
      try {
        localStorage.setItem('notaknot_backups_cache', JSON.stringify(list));
      } catch {}
    }
  } catch (e) {
    console.error('Lỗi khi thực hiện đồng bộ Cloud:', e);
  }
  return { syncedCount, errors };
};

export const deleteBackupFromFirestore = async (backupId: string): Promise<void> => {
  // 1. Delete from Firestore
  try {
    const docRef = doc(db, 'backups', backupId);
    await deleteDoc(docRef);
    recordOperation('delete', 1, -2500);
  } catch (err) {
    console.warn('Lỗi xóa backup từ Firestore:', err);
  }

  // 2. Delete from local cache and IndexedDB
  try {
    localStorage.removeItem('notaknot_backups_cache');
    const dbBackups = await loadBackupsFromIDB();
    const filtered = dbBackups.filter((b) => b.id !== backupId);
    saveBackupsToIDB(filtered);
  } catch {}
};

export const fetchBackupScheduleFromFirestore = async (): Promise<BackupScheduleConfig | null> => {
  try {
    recordOperation('read', 1);
    const docRef = doc(db, 'site_content', 'backup_schedule');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as BackupScheduleConfig;
      try {
        localStorage.setItem('notaknot_backup_schedule_cache', JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch (err) {
    console.warn('Lỗi tải cấu hình auto backup từ Firestore:', err);
  }

  try {
    const cached = localStorage.getItem('notaknot_backup_schedule_cache');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}
  return null;
};

export const saveBackupScheduleToFirestore = async (schedule: BackupScheduleConfig): Promise<void> => {
  try {
    localStorage.setItem('notaknot_backup_schedule_cache', JSON.stringify(schedule));
  } catch {}

  try {
    const docRef = doc(db, 'site_content', 'backup_schedule');
    await setDoc(docRef, cleanFirestoreData(schedule));
    recordOperation('write', 1, 200);
  } catch (err) {
    console.warn('Lỗi lưu cấu hình auto backup lên Firestore:', err);
  }
};

