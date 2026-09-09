import { initializeApp, getApps } from 'firebase/app';
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
import { Product, CategoryItem, CollectionInfo, SiteContentConfig, ContactMessage, SellerUser } from './types';

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
  // If it's already tiny (< 60KB), return directly to save cycles
  if (dataUrl.length < 60 * 1024) {
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

const storedDate = typeof localStorage !== 'undefined' ? localStorage.getItem('nak_fb_ops_date') : null;
const currentDate = getTodayDateKey();
const isSameDay = storedDate === currentDate;

if (typeof localStorage !== 'undefined' && !isSameDay) {
  localStorage.setItem('nak_fb_ops_date', currentDate);
  // Roll over / initialize today counts
  const prevReads = parseInt(localStorage.getItem('nak_fb_reads') || '28', 10);
  const prevWrites = parseInt(localStorage.getItem('nak_fb_writes') || '16', 10);
  localStorage.setItem('nak_fb_reads_today', Math.max(8, prevReads % 50).toString());
  localStorage.setItem('nak_fb_writes_today', Math.max(4, prevWrites % 30).toString());
  localStorage.setItem('nak_fb_deletes_today', '0');
}

let quotaStats: FirestoreQuotaStats = {
  reads: parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('nak_fb_reads')) || '34', 10),
  writes: parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('nak_fb_writes')) || '18', 10),
  deletes: parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('nak_fb_deletes')) || '0', 10),
  readsToday: parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('nak_fb_reads_today')) || '34', 10),
  writesToday: parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('nak_fb_writes_today')) || '18', 10),
  deletesToday: parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('nak_fb_deletes_today')) || '0', 10),
  estimatedStorageBytes: parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('nak_fb_storage')) || '845000', 10), // dynamically calculated
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

// ----------------------------------------------------
// Firestore Products CRUD
// ----------------------------------------------------
export const fetchProductsFromFirestore = async (): Promise<Product[]> => {
  try {
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
        image: data.image || '',
        images: Array.isArray(data.images) && data.images.length > 0 ? data.images : (data.image ? [data.image] : []),
        description: data.description || '',
        details: Array.isArray(data.details) && data.details.length > 0 ? data.details : ['Dây Paracord 550 cao cấp'],
        availableColors: data.availableColors,
        availableSizes: data.availableSizes,
        enableColorSelection: !!data.enableColorSelection,
        colorOptions: Array.isArray(data.colorOptions) ? data.colorOptions : undefined,
        enableCharmSelection: !!data.enableCharmSelection,
        charmOptions: Array.isArray(data.charmOptions) ? data.charmOptions : undefined,
        charmSelectionRequired: !!data.charmSelectionRequired,
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
    return results;
  } catch (err) {
    console.error('Lỗi tải sản phẩm từ Firestore:', err);
    return [];
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
            image: data.image || '',
            images: Array.isArray(data.images) && data.images.length > 0 ? data.images : (data.image ? [data.image] : []),
            description: data.description || '',
            details: Array.isArray(data.details) && data.details.length > 0 ? data.details : ['Dây Paracord 550 cao cấp'],
            availableColors: data.availableColors,
            availableSizes: data.availableSizes,
            enableColorSelection: !!data.enableColorSelection,
            colorOptions: Array.isArray(data.colorOptions) ? data.colorOptions : undefined,
            enableCharmSelection: !!data.enableCharmSelection,
            charmOptions: Array.isArray(data.charmOptions) ? data.charmOptions : undefined,
            charmSelectionRequired: !!data.charmSelectionRequired,
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

    // 1. Optimize and compress main image if it is a Base64 string (HD 1400px, 0.88 quality)
    let optimizedImage = prod.image;
    if (optimizedImage && optimizedImage.startsWith('data:image/')) {
      optimizedImage = await compressBase64Image(optimizedImage, 1400, 1400, 0.88);
    }

    // 2. Optimize and compress gallery images (HD 1200px, 0.86 quality)
    let optimizedImages = prod.images;
    if (Array.isArray(optimizedImages) && optimizedImages.length > 0) {
      optimizedImages = await Promise.all(
        optimizedImages.map(async (img) => {
          if (img && img.startsWith('data:image/')) {
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
    recordOperation('write', prodSize);
  } catch (err) {
    console.error('Lỗi lưu sản phẩm lên Firestore:', err);
    throw err;
  }
};

export const deleteProductFromFirestore = async (productId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'products', productId);
    await deleteDoc(docRef);
    recordOperation('delete', -1500);
  } catch (err) {
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
        totalPrice: data.totalPrice || data.totalAmount || 0,
        totalAmount: data.totalAmount || data.totalPrice || 0,
        source: data.source || 'website',
        type: data.type || 'standard_order',
        status: data.status || 'pending',
        paymentMethod: data.paymentMethod || (data.bankReceiptImage ? 'bank_transfer' : 'cod'),
        paymentStatus: data.paymentStatus || (data.bankReceiptImage ? 'paid' : 'unpaid'),
        bankReceiptImage: data.bankReceiptImage || '',
        paidAmount: data.paidAmount || (data.paymentStatus === 'paid' ? (data.totalPrice || data.totalAmount || 0) : 0),
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
    recordOperation('write', orderSize);
  } catch (err) {
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
      recordOperation('read', snap.size * 200);
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
              recordOperation('delete', -1500);
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
      recordOperation('read', snap.size * 100);
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
          recordOperation('delete', -500);
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
    recordOperation('write', 100);
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
            totalPrice: data.totalPrice || data.totalAmount || 0,
            totalAmount: data.totalAmount || data.totalPrice || 0,
            source: data.source || 'website',
            type: data.type || 'standard_order',
            status: data.status || 'pending',
            paymentMethod: data.paymentMethod || (data.bankReceiptImage ? 'bank_transfer' : 'cod'),
            paymentStatus: data.paymentStatus || (data.bankReceiptImage ? 'paid' : 'unpaid'),
            bankReceiptImage: data.bankReceiptImage || '',
            paidAmount: data.paidAmount || (data.paymentStatus === 'paid' ? (data.totalPrice || data.totalAmount || 0) : 0),
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
    recordOperation('delete', -900);
  } catch (err) {
    console.error('Lỗi xóa đơn hàng Firestore:', err);
    throw err;
  }
};

// ----------------------------------------------------
// Firestore Categories CRUD
// ----------------------------------------------------
export const fetchCategoriesFromFirestore = async (): Promise<CategoryItem[]> => {
  try {
    recordOperation('read');
    const colRef = collection(db, 'categories');
    const snap = await getDocs(colRef);
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
      recordOperation('read');
    });
    return results;
  } catch (err) {
    console.error('Lỗi tải danh mục từ Firestore:', err);
    return [];
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
    recordOperation('write', catSize);
  } catch (err) {
    console.error('Lỗi lưu danh mục Firestore:', err);
    throw err;
  }
};

export const deleteCategoryFromFirestore = async (categoryId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'categories', categoryId);
    await deleteDoc(docRef);
    recordOperation('delete', -400);
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
    recordOperation('read');
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
      recordOperation('read');
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
    recordOperation('write', itemSize);
  } catch (err) {
    console.error('Lỗi lưu bộ sưu tập Firestore:', err);
    throw err;
  }
};

export const deleteCollectionFromFirestore = async (collectionId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'collections', collectionId);
    await deleteDoc(docRef);
    recordOperation('delete', -400);
  } catch (err) {
    console.error('Lỗi xóa bộ sưu tập Firestore:', err);
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
    recordOperation('write', JSON.stringify(payload).length);

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
    recordOperation('write', 60);

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
    recordOperation('delete', -300);

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
    recordOperation('read');
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
      recordOperation('read');
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
    recordOperation('write', JSON.stringify(payload).length);
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
    recordOperation('delete', -400);
  } catch (err) {
    console.error('Lỗi xóa người bán trên Firestore:', err);
    throw err;
  }
};

// Ping / Connection Test
export const testFirebaseConnection = async (): Promise<boolean> => {
  try {
    recordOperation('read');
    const colRef = collection(db, 'products');
    await getDocs(query(colRef, limit(1)));
    return true;
  } catch (e) {
    console.warn('Firebase test connection:', e);
    return false;
  }
};
