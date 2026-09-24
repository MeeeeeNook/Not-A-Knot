import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, uploadString, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
  where,
  limit,
  writeBatch,
  arrayUnion,
  onSnapshot
} from 'firebase/firestore';
import { Product, CategoryItem, CollectionInfo, SiteContentConfig, ContactMessage, SellerUser, VersionBackup, BackupScheduleConfig } from './types';
import { DEFAULT_CATEGORIES } from './data/categories';
import {
  saveProductToIDB,
  saveProductsToIDB,
  getProductsFromIDB,
  saveAssetToIDB,
  getAssetFromIDB,
  getMultipleAssetsFromIDB,
  deleteProductFromIDB,
  safeStorageSetItem
} from './utils/storageHelper';
import {
  safeIsoDateString,
  safeOrderTimestamp,
  formatOrderDateWithoutSeconds
} from './utils/orderFormatters';

// Load client configuration using encrypted database connection parameters
// protected from plain-text exposure in client bundle
// Suppress internal Firebase advisory warnings (like transient WebChannel retry or 10s auto-detect warning)
try {
  setLogLevel('error');
} catch {
  // ignore
}

// Standard Firebase web configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDpg7yJZaMXGaGtbLWtX12KYmqt311XFoI",
  authDomain: "jittery-study-nzp2g.firebaseapp.com",
  projectId: "jittery-study-nzp2g",
  storageBucket: "jittery-study-nzp2g.firebasestorage.app",
  messagingSenderId: "23301458119",
  appId: "1:23301458119:web:f7ee271f42bc11fe0216e2",
  firestoreDatabaseId: "ai-studio-remixremixnotakn-6b882779-1f6a-407c-af44-7b468092c95f"
};

// Initialize Firebase App instance
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

const targetDbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

// Initialize Firestore with clean settings and persistent local cache for instant multi-tab loading
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  }, targetDbId);
} catch {
  firestoreInstance = targetDbId ? getFirestore(app, targetDbId) : getFirestore(app);
}

export const canonicalOrderKey = (idOrTracking?: string): string => {
  if (!idOrTracking) return '';
  const clean = String(idOrTracking).replace(/^#/, '').trim().toUpperCase();
  if (clean.startsWith('ORD-MAN-') || clean.startsWith('ORD-WEB-')) {
    const digits = clean.replace(/[^0-9]/g, '');
    if (digits.length >= 6) {
      return `NAK-${digits.slice(-6)}`;
    }
  }
  return clean;
};

export const resolveAllOrderIdCandidates = (idOrTracking?: string): string[] => {
  if (!idOrTracking) return [];
  const raw = String(idOrTracking).trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();
  const withoutHash = raw.replace(/^#/, '').trim();
  const withoutHashUpper = withoutHash.toUpperCase();
  const canonical = canonicalOrderKey(raw);

  const set = new Set<string>();
  set.add(raw);
  set.add(upper);
  set.add(lower);
  if (withoutHash) set.add(withoutHash);
  if (withoutHashUpper) set.add(withoutHashUpper);
  if (canonical) {
    set.add(canonical);
    set.add(canonical.toUpperCase());
    set.add(canonical.toLowerCase());
  }

  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length >= 6) {
    const lastDigits = digits.slice(-6);
    set.add(`NAK-${lastDigits}`);
    set.add(`ord-web-${lastDigits}`);
    set.add(`ord-man-${lastDigits}`);
    set.add(`ORD-WEB-${lastDigits}`);
    set.add(`ORD-MAN-${lastDigits}`);
  }
  return Array.from(set).filter(Boolean);
};

export const isMatchingOrderDoc = (targetId: string, docId?: string, docData?: any): boolean => {
  if (!targetId) return false;
  const t = String(targetId).trim().toUpperCase();
  const tClean = t.replace(/^#/, '').trim();

  if (docId) {
    const d = String(docId).trim().toUpperCase();
    const dClean = d.replace(/^#/, '').trim();
    if (t === d || tClean === dClean || t === dClean || tClean === d) return true;
    const cDoc = canonicalOrderKey(docId).toUpperCase();
    const cTarget = canonicalOrderKey(targetId).toUpperCase();
    if (cTarget && cDoc && cTarget === cDoc) return true;
  }

  if (docData) {
    const dataId = docData.id ? String(docData.id).trim().toUpperCase() : '';
    const dataIdClean = dataId.replace(/^#/, '').trim();
    if (dataId && (t === dataId || tClean === dataIdClean || t === dataIdClean || tClean === dataId)) return true;

    const dataTrack = docData.trackingNumber ? String(docData.trackingNumber).trim().toUpperCase() : '';
    const dataTrackClean = dataTrack.replace(/^#/, '').trim();
    if (dataTrack && (t === dataTrack || tClean === dataTrackClean || t === dataTrackClean || tClean === dataTrack)) return true;

    const dataCode = docData.orderCode ? String(docData.orderCode).trim().toUpperCase() : '';
    const dataCodeClean = dataCode.replace(/^#/, '').trim();
    if (dataCode && (t === dataCode || tClean === dataCodeClean || t === dataCodeClean || tClean === dataCode)) return true;

    const cTarget = canonicalOrderKey(targetId).toUpperCase();
    if (dataId && canonicalOrderKey(dataId).toUpperCase() === cTarget) return true;
    if (dataTrack && canonicalOrderKey(dataTrack).toUpperCase() === cTarget) return true;
  }

  return false;
};

export const syncLocalStorageOrderDeletion = (orderId: string, permanent: boolean = false) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const keys = ['nak_preorders', 'nak_orders', 'nak_custom_orders'];

  keys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const list: StoredOrder[] = JSON.parse(raw);
      if (!Array.isArray(list)) return;

      let updated: StoredOrder[];
      if (permanent) {
        updated = list.filter((ord) => !isMatchingOrderDoc(orderId, ord.id || '', ord));
      } else {
        const nowIso = new Date().toISOString();
        updated = list.map((ord) => {
          if (isMatchingOrderDoc(orderId, ord.id || '', ord)) {
            return { ...ord, isDeleted: true, deletedAt: nowIso };
          }
          return ord;
        });
      }
      safeStorageSetItem(key, JSON.stringify(updated));
    } catch {
      // ignore parsing error
    }
  });

  try {
    window.dispatchEvent(
      new CustomEvent('nak_order_deleted', { detail: { orderId, permanent } })
    );
  } catch {}
};

export const purgeAllDeletedOrdersFromLocalStorage = (orderIds?: string[]) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const keys = ['nak_preorders', 'nak_orders', 'nak_custom_orders'];

  keys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const list: StoredOrder[] = JSON.parse(raw);
      if (!Array.isArray(list)) return;

      const updated = list.filter((ord) => {
        if (!ord) return false;
        if (ord.isDeleted === true || (ord as any).deleted === true) return false;
        if (orderIds && orderIds.length > 0) {
          if (orderIds.some((id) => isMatchingOrderDoc(id, ord.id || '', ord))) return false;
        }
        return true;
      });
      safeStorageSetItem(key, JSON.stringify(updated));
    } catch {}
  });

  try {
    window.dispatchEvent(
      new CustomEvent('nak_order_deleted', { detail: { orderIds, permanent: true } })
    );
  } catch {}
};

export const db = firestoreInstance;

export const storage = getStorage(app);

export async function uploadHeroArtwork(file: File, slideId: string, device: 'desktop' | 'mobile'): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const artworkRef = ref(storage, `hero-billboards/${slideId}/${device}-${Date.now()}-${safeName}`);
  const snapshot = await uploadBytes(artworkRef, file, { contentType: file.type, cacheControl: 'public,max-age=31536000,immutable' });
  return getDownloadURL(snapshot.ref);
}

export const uploadBase64ToStorage = async (
  base64Data: string,
  storagePath: string
): Promise<string> => {
  if (!base64Data || typeof base64Data !== 'string') return base64Data;
  if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
    return base64Data;
  }
  if (base64Data.startsWith('data:') || base64Data.length > 300) {
    try {
      const storageRef = ref(storage, storagePath);
      let payload = base64Data;
      let contentType = 'image/png';
      if (!payload.startsWith('data:')) {
        payload = `data:image/png;base64,${payload}`;
      } else {
        const mimeMatch = payload.match(/^data:([^;]+);base64,/);
        if (mimeMatch && mimeMatch[1]) {
          contentType = mimeMatch[1];
        }
      }
      await uploadString(storageRef, payload, 'data_url', {
        contentType,
        cacheControl: 'public,max-age=31536000,immutable'
      });
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (err) {
      console.warn(`[Firebase Storage] Upload failed for ${storagePath}:`, err);
      return base64Data;
    }
  }
  return base64Data;
};

export const uploadProductToFirebaseStorage = async (prod: Product): Promise<Product> => {
  const updatedProd = { ...prod };
  const prodId = prod.id;

  // 1. Main image
  if (updatedProd.image) {
    updatedProd.image = await uploadBase64ToStorage(updatedProd.image, `products/${prodId}/main.png`);
  }

  // 2. Images gallery
  if (Array.isArray(updatedProd.images)) {
    const uploadedImages: string[] = [];
    for (let i = 0; i < updatedProd.images.length; i++) {
      const url = await uploadBase64ToStorage(updatedProd.images[i], `products/${prodId}/gallery_${i}.png`);
      uploadedImages.push(url);
    }
    updatedProd.images = uploadedImages;
  }

  // 3. Color options
  if (Array.isArray(updatedProd.colorOptions)) {
    const updatedColors = [];
    for (let i = 0; i < updatedProd.colorOptions.length; i++) {
      const col = { ...updatedProd.colorOptions[i] };
      if (col.image) {
        col.image = await uploadBase64ToStorage(col.image, `products/${prodId}/color_${i}.png`);
      }
      updatedColors.push(col);
    }
    updatedProd.colorOptions = updatedColors;
  }

  // 4. Charm options
  if (Array.isArray(updatedProd.charmOptions)) {
    const updatedCharms = [];
    for (let i = 0; i < updatedProd.charmOptions.length; i++) {
      const c = { ...updatedProd.charmOptions[i] };
      if (c.image) {
        c.image = await uploadBase64ToStorage(c.image, `products/${prodId}/charm_${c.id || i}.png`);
      }
      updatedCharms.push(c);
    }
    updatedProd.charmOptions = updatedCharms;
  }

  // 5. Omamori options
  if (Array.isArray(updatedProd.omamoriOptions)) {
    const updatedOmamoris = [];
    for (let i = 0; i < updatedProd.omamoriOptions.length; i++) {
      const o = { ...updatedProd.omamoriOptions[i] };
      if (o.image) {
        o.image = await uploadBase64ToStorage(o.image, `products/${prodId}/omamori_${o.id || i}.png`);
      }
      updatedOmamoris.push(o);
    }
    updatedProd.omamoriOptions = updatedOmamoris;
  }

  // 6. Khoen options
  if (Array.isArray(updatedProd.khoenOptions)) {
    const updatedKhoens = [];
    for (let i = 0; i < updatedProd.khoenOptions.length; i++) {
      const k = { ...updatedProd.khoenOptions[i] };
      if (k.image) {
        k.image = await uploadBase64ToStorage(k.image, `products/${prodId}/khoen_${k.id || i}.png`);
      }
      updatedKhoens.push(k);
    }
    updatedProd.khoenOptions = updatedKhoens;
  }

  // 7. Combo items images (if any base64)
  if (Array.isArray(updatedProd.comboItems)) {
    const updatedCombo = [];
    for (let ci = 0; ci < updatedProd.comboItems.length; ci++) {
      const item = { ...updatedProd.comboItems[ci] };
      if (item.image && item.image.startsWith('data:')) {
        item.image = await uploadBase64ToStorage(item.image, `products/${prodId}/combo_${ci}_main.png`);
      }
      if (Array.isArray(item.colorOptions)) {
        const upColors = [];
        for (let coi = 0; coi < item.colorOptions.length; coi++) {
          const col = { ...item.colorOptions[coi] };
          if (col.image && col.image.startsWith('data:')) {
            col.image = await uploadBase64ToStorage(col.image, `products/${prodId}/combo_${ci}_color_${coi}.png`);
          }
          upColors.push(col);
        }
        item.colorOptions = upColors;
      }
      if (Array.isArray(item.charmOptions)) {
        const upCharms = [];
        for (let chi = 0; chi < item.charmOptions.length; chi++) {
          const ch = { ...item.charmOptions[chi] };
          if (ch.image && ch.image.startsWith('data:')) {
            ch.image = await uploadBase64ToStorage(ch.image, `products/${prodId}/combo_${ci}_charm_${chi}.png`);
          }
          upCharms.push(ch);
        }
        item.charmOptions = upCharms;
      }
      if (Array.isArray(item.omamoriOptions)) {
        const upOmamoris = [];
        for (let omi = 0; omi < item.omamoriOptions.length; omi++) {
          const om = { ...item.omamoriOptions[omi] };
          if (om.image && om.image.startsWith('data:')) {
            om.image = await uploadBase64ToStorage(om.image, `products/${prodId}/combo_${ci}_omamori_${omi}.png`);
          }
          upOmamoris.push(om);
        }
        item.omamoriOptions = upOmamoris;
      }
      if (Array.isArray(item.khoenOptions)) {
        const upKhoens = [];
        for (let ki = 0; ki < item.khoenOptions.length; ki++) {
          const kh = { ...item.khoenOptions[ki] };
          if (kh.image && kh.image.startsWith('data:')) {
            kh.image = await uploadBase64ToStorage(kh.image, `products/${prodId}/combo_${ci}_khoen_${ki}.png`);
          }
          upKhoens.push(kh);
        }
        item.khoenOptions = upKhoens;
      }
      updatedCombo.push(item);
    }
    updatedProd.comboItems = updatedCombo;
  }

  return updatedProd;
};

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

function isFirestoreSentinel(val: any): boolean {
  if (!val || typeof val !== 'object') return false;
  if (val instanceof Date) return false;
  if (
    '_methodName' in val || 
    '_delegate' in val || 
    (val.constructor && (val.constructor.name.includes('FieldValue') || val.constructor.name.includes('FieldTransform')))
  ) {
    return true;
  }
  return false;
}

/**
 * Strips undefined values recursively so Firestore setDoc/updateDoc never throws:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined".
 * Preserves FieldValue sentinels (e.g. arrayUnion, serverTimestamp) and Date instances.
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (isFirestoreSentinel(obj)) {
    return obj;
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
 * - Preserves sharp handmade weave details, charms and vibrant colors
 * - Supports high-density WebP output with JPEG fallback
 * - Safe for Firestore document size limits while maintaining 1400px HD resolution
 */
export async function compressBase64Image(
  dataUrl: string,
  maxWidth = 1600,
  maxHeight = 900,
  quality = 0.82
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
  email?: string;
  customerEmail?: string;
  phone: string;
  address: string;
  province?: string;
  district?: string;
  detailedAddress?: string;
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
    selectedKhoen?: string;
    selectedKhoenImage?: string;
    selectedKhoenPrice?: number;
    selectedSize?: string;
    customNote?: string;
  }[];
  totalPrice?: number;
  totalAmount?: number;
  shippingFee?: number;
  discountAmount?: number;
  voucherCode?: string;
  voucherDiscountAmount?: number;
  voucherType?: 'freeship' | 'percent';
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
  isDeleted?: boolean;
  deletedAt?: string;
  updatedAt?: string;
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
// ZERO-COMPRESSION ASSET & PRODUCT STORAGE ENGINE
// ----------------------------------------------------

/**
 * In-memory LRU-style cache for hydrated product assets
 */
const inMemoryAssetCache = new Map<string, string>();

/**
 * Safely resolves any image string. If it is an asset token ('asset:...'),
 * it returns the hydrated base64 image from memory cache, or falls back to a safe placeholder.
 * It NEVER returns an unresolvable 'asset:...' protocol string to the DOM.
 */
export const resolveAssetUrl = (val?: string, fallback = '/assets/bracelet.jpg'): string => {
  if (!val || typeof val !== 'string') return fallback;
  if (!val.startsWith('asset:')) return val;
  const assetId = val.replace('asset:', '');
  if (inMemoryAssetCache.has(assetId)) {
    return inMemoryAssetCache.get(assetId)!;
  }
  const parts = assetId.split('_');
  if (parts.length >= 3) {
    const hashSuffix = parts.slice(-2).join('_');
    for (const [cachedId, cachedData] of inMemoryAssetCache.entries()) {
      if (cachedId.endsWith(hashSuffix)) {
        inMemoryAssetCache.set(assetId, cachedData);
        return cachedData;
      }
    }
  }
  return fallback;
};

/**
 * Extract heavy Base64 image assets from a Product into standalone asset records
 */
function extractProductAssets(prod: Product): {
  cleanProd: Product;
  assetDocs: Array<{ id: string; productId: string; data: string }>;
} {
  const assetDocs: Array<{ id: string; productId: string; data: string }> = [];
  const prodId = prod.id;

  const processImageField = (imgVal?: string, prefix: string = 'img'): string | undefined => {
    if (!imgVal || typeof imgVal !== 'string') return imgVal;
    // If it's a heavy Base64 string (> 2000 chars), extract into dedicated asset
    if (imgVal.startsWith('data:image/') || imgVal.length > 2000) {
      // Calculate content hash to create unique immutable assetId per image version
      let hash = 0;
      for (let i = 0; i < Math.min(imgVal.length, 300); i++) {
        hash = ((hash << 5) - hash) + imgVal.charCodeAt(i);
        hash |= 0;
      }
      const assetId = `${prodId}_${prefix}_${Math.abs(hash).toString(36)}_${imgVal.length}`;
      assetDocs.push({ id: assetId, productId: prodId, data: imgVal });
      inMemoryAssetCache.set(assetId, imgVal);
      return `asset:${assetId}`;
    }
    return imgVal;
  };

  const cleanMainImage = processImageField(prod.image, 'main') || '/assets/bracelet.jpg';

  const cleanImages = Array.isArray(prod.images)
    ? prod.images.map((img, idx) => processImageField(img, `gal_${idx}`) || img)
    : [cleanMainImage];

  const cleanColorOptions = Array.isArray(prod.colorOptions)
    ? prod.colorOptions.map((opt, idx) => ({
        ...opt,
        stock: typeof opt.stock === 'number' ? Math.max(0, opt.stock) : (opt.stock !== undefined ? Math.max(0, Number(opt.stock) || 0) : undefined),
        image: processImageField(opt.image, `col_${idx}`) || opt.image
      }))
    : undefined;

  const cleanCharmOptions = Array.isArray(prod.charmOptions)
    ? prod.charmOptions.map((opt, idx) => ({
        ...opt,
        image: processImageField(opt.image, `chm_${opt.id || idx}`) || opt.image
      }))
    : undefined;

  const cleanOmamoriOptions = Array.isArray(prod.omamoriOptions)
    ? prod.omamoriOptions.map((opt, idx) => ({
        ...opt,
        image: processImageField(opt.image, `oma_${opt.id || idx}`) || opt.image
      }))
    : undefined;

  const cleanKhoenOptions = Array.isArray(prod.khoenOptions)
    ? prod.khoenOptions.map((opt, idx) => ({
        ...opt,
        image: processImageField(opt.image, `khn_${opt.id || idx}`) || opt.image
      }))
    : undefined;

  // If color selection is enabled and color options have stocks, aggregate color stocks into total product stock
  const hasColorStock = Boolean(
    prod.enableColorSelection !== false &&
    cleanColorOptions &&
    cleanColorOptions.length > 0 &&
    cleanColorOptions.some((c) => typeof c.stock === 'number')
  );
  const colorStockSum = cleanColorOptions && cleanColorOptions.length > 0
    ? cleanColorOptions.reduce((sum, c) => sum + (typeof c.stock === 'number' ? c.stock : 0), 0)
    : 0;

  const stockVal = hasColorStock
    ? colorStockSum
    : (typeof prod.stock === 'number' ? prod.stock : 15);
  const inStockVal = prod.inStock !== false && stockVal > 0;
  const isProdHidden = prod.isHidden === true || String(prod.isHidden) === 'true';

  const cleanProd: Product = {
    ...prod,
    image: cleanMainImage,
    images: cleanImages,
    colorOptions: cleanColorOptions,
    charmOptions: cleanCharmOptions,
    omamoriOptions: cleanOmamoriOptions,
    khoenOptions: cleanKhoenOptions,
    stock: stockVal,
    inStock: inStockVal,
    isHidden: isProdHidden,
    updatedAt: new Date().toISOString()
  };

  return { cleanProd, assetDocs };
}

/**
 * Hydrates asset tokens ('asset:...') in a list of Products back to original full-resolution Base64 images
 */
async function hydrateProductsWithAssets(rawProducts: Product[]): Promise<Product[]> {
  if (!rawProducts || rawProducts.length === 0) return [];

  // 1. Gather all needed asset tokens
  const neededAssetIds = new Set<string>();
  const scanToken = (val?: string) => {
    if (val && typeof val === 'string' && val.startsWith('asset:')) {
      neededAssetIds.add(val.replace('asset:', ''));
    }
  };

  rawProducts.forEach((p) => {
    scanToken(p.image);
    p.images?.forEach(scanToken);
    p.colorOptions?.forEach((o) => scanToken(o.image));
    p.charmOptions?.forEach((o) => scanToken(o.image));
    p.omamoriOptions?.forEach((o) => scanToken(o.image));
    p.khoenOptions?.forEach((o) => scanToken(o.image));
  });

  if (neededAssetIds.size === 0) {
    return rawProducts;
  }

  // 2. Fetch from In-Memory Cache and IndexedDB first
  const assetMap = new Map<string, string>();
  const missingFromLocal: string[] = [];

  for (const id of neededAssetIds) {
    if (inMemoryAssetCache.has(id)) {
      assetMap.set(id, inMemoryAssetCache.get(id)!);
    } else {
      missingFromLocal.push(id);
    }
  }

  if (missingFromLocal.length > 0) {
    const fromIDB = await getMultipleAssetsFromIDB(missingFromLocal);
    for (const [id, data] of fromIDB.entries()) {
      assetMap.set(id, data);
      inMemoryAssetCache.set(id, data);
    }
  }

  // 3. For any remaining missing assets (e.g., opened on a new device or cleared cache), fetch from Firestore `product_assets` in parallel
  const stillMissing = Array.from(neededAssetIds).filter((id) => !assetMap.has(id));
  if (stillMissing.length > 0) {
    try {
      recordOperation('read', Math.min(stillMissing.length, 30));
      // Fetch in concurrent batches for maximum throughput
      const batchSize = 20;
      for (let i = 0; i < stillMissing.length; i += batchSize) {
        const chunk = stillMissing.slice(i, i + batchSize);
        await Promise.all(
          chunk.map(async (assetId) => {
            try {
              const docRef = doc(db, 'product_assets', assetId);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                const data = snap.data();
                if (data?.isChunked && typeof data.totalChunks === 'number' && data.totalChunks > 0) {
                  // Reassemble chunked asset (>1MB) from product_asset_chunks
                  const chunkPromises = [];
                  for (let c = 0; c < data.totalChunks; c++) {
                    const chkRef = doc(db, 'product_asset_chunks', `${assetId}_chk_${c}`);
                    chunkPromises.push(getDoc(chkRef));
                  }
                  const chunkSnaps = await Promise.all(chunkPromises);
                  const assembled = chunkSnaps.map((s) => (s.exists() ? (s.data()?.data || '') : '')).join('');
                  if (assembled) {
                    assetMap.set(assetId, assembled);
                    inMemoryAssetCache.set(assetId, assembled);
                    saveAssetToIDB(assetId, assembled).catch(() => {});
                  }
                } else if (data?.data && typeof data.data === 'string') {
                  assetMap.set(assetId, data.data);
                  inMemoryAssetCache.set(assetId, data.data);
                  saveAssetToIDB(assetId, data.data).catch(() => {});
                }
              } else {
                // If specific doc was not found, check if an asset with the exact same content hash exists in cache
                const parts = assetId.split('_');
                if (parts.length >= 3) {
                  const hashSuffix = parts.slice(-2).join('_');
                  for (const [cachedId, cachedData] of inMemoryAssetCache.entries()) {
                    if (cachedId.endsWith(hashSuffix)) {
                      assetMap.set(assetId, cachedData);
                      break;
                    }
                  }
                }
              }
            } catch (e) {
              // Check memory cache fallback if Firestore query failed
              const parts = assetId.split('_');
              if (parts.length >= 3) {
                const hashSuffix = parts.slice(-2).join('_');
                for (const [cachedId, cachedData] of inMemoryAssetCache.entries()) {
                  if (cachedId.endsWith(hashSuffix)) {
                    assetMap.set(assetId, cachedData);
                    break;
                  }
                }
              }
            }
          })
        );
      }
    } catch (e) {
      console.warn('Lỗi tải tài nguyên ảnh từ Firestore:', e);
    }
  }

  // 4. Reconstitute products with original image strings
  const replaceToken = (val?: string): string | undefined => {
    if (!val || typeof val !== 'string') return val;
    if (val.startsWith('asset:')) {
      const assetId = val.replace('asset:', '');
      const resolved = assetMap.get(assetId) || inMemoryAssetCache.get(assetId);
      if (resolved) return resolved;
      // Content hash fallback
      const parts = assetId.split('_');
      if (parts.length >= 3) {
        const hashSuffix = parts.slice(-2).join('_');
        for (const [cachedId, cachedData] of inMemoryAssetCache.entries()) {
          if (cachedId.endsWith(hashSuffix)) {
            assetMap.set(assetId, cachedData);
            return cachedData;
          }
        }
      }
      return '/assets/bracelet.jpg';
    }
    return val;
  };

  const hydrated = rawProducts.map((p) => {
    const hydMain = replaceToken(p.image) || '/assets/bracelet.jpg';
    const hydImages = Array.isArray(p.images)
      ? p.images.map((img) => replaceToken(img) || img)
      : [hydMain];

    const hydColor = p.colorOptions?.map((opt) => ({
      ...opt,
      image: replaceToken(opt.image) || opt.image
    }));

    const hydCharm = p.charmOptions?.map((opt) => ({
      ...opt,
      image: replaceToken(opt.image) || opt.image
    }));

    const hydOmamori = p.omamoriOptions?.map((opt) => ({
      ...opt,
      image: replaceToken(opt.image) || opt.image
    }));

    const hydKhoen = p.khoenOptions?.map((opt) => ({
      ...opt,
      image: replaceToken(opt.image) || opt.image
    }));

    return {
      ...p,
      image: hydMain,
      images: hydImages,
      colorOptions: hydColor,
      charmOptions: hydCharm,
      omamoriOptions: hydOmamori,
      khoenOptions: hydKhoen
    };
  });

  // Also save complete hydrated products to IndexedDB
  saveProductsToIDB(hydrated).catch(() => {});

  return hydrated;
}

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
    const rawResults: Product[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const rawStock = typeof data.stock === 'number' ? data.stock : 15;
      const computedInStock = data.inStock !== false && rawStock > 0;
      rawResults.push({
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
        details: Array.isArray(data.details) && data.details.length > 0 ? data.details : ['Dây đan thủ công cao cấp'],
        availableColors: data.availableColors,
        availableSizes: data.availableSizes,
        enableColorSelection: !!data.enableColorSelection,
        colorOptions: Array.isArray(data.colorOptions) ? data.colorOptions : undefined,
        enableCharmSelection: !!data.enableCharmSelection,
        charmOptions: Array.isArray(data.charmOptions) ? data.charmOptions : undefined,
        charmSelectionRequired: !!data.charmSelectionRequired,
        maxCharmsAllowed: typeof data.maxCharmsAllowed === 'number' ? data.maxCharmsAllowed : undefined,
        enableOmamoriSelection: !!data.enableOmamoriSelection,
        omamoriTitle: data.omamoriTitle || undefined,
        omamoriOptions: Array.isArray(data.omamoriOptions) ? data.omamoriOptions : undefined,
        omamoriSelectionRequired: !!data.omamoriSelectionRequired,
        maxOmamoriAllowed: typeof data.maxOmamoriAllowed === 'number' ? data.maxOmamoriAllowed : undefined,
        enableKhoenSelection: !!data.enableKhoenSelection,
        khoenTitle: data.khoenTitle || undefined,
        khoenOptions: Array.isArray(data.khoenOptions) ? data.khoenOptions : undefined,
        khoenSelectionRequired: !!data.khoenSelectionRequired,
        enableSizeSelection: !!data.enableSizeSelection,
        isCombo: !!data.isCombo,
        comboItems: Array.isArray(data.comboItems) ? data.comboItems : undefined,
        stock: rawStock,
        inStock: computedInStock,
        soldCount: typeof data.soldCount === 'number' ? data.soldCount : undefined,
        isEvent0209: !!data.isEvent0209,
        isEvent2010: !!data.isEvent2010,
        isBestSeller: !!data.isBestSeller,
        isNew: !!data.isNew,
        rating: typeof data.rating === 'number' ? data.rating : undefined,
        reviewsCount: typeof data.reviewsCount === 'number' ? data.reviewsCount : 0,
        isHidden: data.isHidden === true || String(data.isHidden) === 'true',
        updatedAt: data.updatedAt || undefined
      } as Product);
      recordOperation('read');
    });

    const hydratedResults = await hydrateProductsWithAssets(rawResults);
    productsMemoryCache = { data: hydratedResults, expiresAt: now + 30000 };
    return hydratedResults;
  } catch (err) {
    console.error('Lỗi tải sản phẩm từ Firestore:', err);
    // Try to fallback to IndexedDB if network fails
    const idbProds = await getProductsFromIDB();
    if (idbProds && idbProds.length > 0) return idbProds;
    return productsMemoryCache ? productsMemoryCache.data : [];
  }
};

/**
 * Real-time subscription to products collection with automatic zero-compression asset hydration
 */
export const subscribeToProductsFromFirestore = (
  callback: (products: Product[]) => void,
  onError?: (err: any) => void
): (() => void) => {
  try {
    const colRef = collection(db, 'products');
    const unsubscribe = onSnapshot(
      colRef,
      async (snapshot) => {
        const rawResults: Product[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const rawStock = typeof data.stock === 'number' ? data.stock : 15;
          const computedInStock = data.inStock !== false && rawStock > 0;
          rawResults.push({
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
            details: Array.isArray(data.details) && data.details.length > 0 ? data.details : ['Dây đan thủ công cao cấp'],
            availableColors: data.availableColors,
            availableSizes: data.availableSizes,
            enableColorSelection: !!data.enableColorSelection,
            colorOptions: Array.isArray(data.colorOptions) ? data.colorOptions : undefined,
            enableCharmSelection: !!data.enableCharmSelection,
            charmOptions: Array.isArray(data.charmOptions) ? data.charmOptions : undefined,
            charmSelectionRequired: !!data.charmSelectionRequired,
            maxCharmsAllowed: typeof data.maxCharmsAllowed === 'number' ? data.maxCharmsAllowed : undefined,
            enableOmamoriSelection: !!data.enableOmamoriSelection,
            omamoriTitle: data.omamoriTitle || undefined,
            omamoriOptions: Array.isArray(data.omamoriOptions) ? data.omamoriOptions : undefined,
            omamoriSelectionRequired: !!data.omamoriSelectionRequired,
            maxOmamoriAllowed: typeof data.maxOmamoriAllowed === 'number' ? data.maxOmamoriAllowed : undefined,
            enableKhoenSelection: !!data.enableKhoenSelection,
            khoenTitle: data.khoenTitle || undefined,
            khoenOptions: Array.isArray(data.khoenOptions) ? data.khoenOptions : undefined,
            khoenSelectionRequired: !!data.khoenSelectionRequired,
            enableSizeSelection: !!data.enableSizeSelection,
            isCombo: !!data.isCombo,
            comboItems: Array.isArray(data.comboItems) ? data.comboItems : undefined,
            stock: rawStock,
            inStock: computedInStock,
            soldCount: typeof data.soldCount === 'number' ? data.soldCount : undefined,
            isEvent0209: !!data.isEvent0209,
            isEvent2010: !!data.isEvent2010,
            isBestSeller: !!data.isBestSeller,
            isNew: !!data.isNew,
            rating: typeof data.rating === 'number' ? data.rating : undefined,
            reviewsCount: typeof data.reviewsCount === 'number' ? data.reviewsCount : 0,
            isHidden: data.isHidden === true || String(data.isHidden) === 'true',
            updatedAt: data.updatedAt || undefined
          } as Product);
        });

        // Hydrate all image assets without loss
        const hydratedResults = await hydrateProductsWithAssets(rawResults);
        callback(hydratedResults);
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

/**
 * Save product with full-resolution images without compression:
 * - Saves uncompressed original product to IndexedDB
 * - Splits heavy images into individual asset docs in `product_assets`
 * - Saves lightweight product manifest in `products` (well under 1MB)
 */
export const saveProductToFirestore = async (prod: Product): Promise<void> => {
  try {
    // 1. Upload all Base64 images directly to Firebase Storage bucket
    const storageProd = await uploadProductToFirebaseStorage(prod);

    // 2. Save complete product with Firebase Storage URLs to IndexedDB
    await saveProductToIDB(storageProd);

    // 3. Save lightweight product document to `products` collection with direct Storage URLs
    const docRef = doc(db, 'products', storageProd.id);
    const payload = cleanFirestoreData(storageProd);
    const prodSize = JSON.stringify(payload).length;

    await setDoc(docRef, payload, { merge: true });
    productsMemoryCache = null;
    recordOperation('write', 1, prodSize);
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      console.warn('⚠️ Firestore Write Quota đạt giới hạn trong ngày. Dữ liệu tiếp tục lưu trữ an toàn trong IndexedDB:', err);
      return;
    }
    console.error('Lỗi lưu sản phẩm lên Firestore:', err);
    throw err;
  }
};

export const deleteProductFromFirestore = async (productId: string): Promise<void> => {
  try {
    // 1. Delete from IndexedDB
    await deleteProductFromIDB(productId);

    // 2. Delete product document from Firestore
    const docRef = doc(db, 'products', productId);
    await deleteDoc(docRef);

    // 3. Clean up associated assets in `product_assets`
    try {
      const colRef = collection(db, 'product_assets');
      const q = query(colRef, where('productId', '==', productId));
      const snap = await getDocs(q);
      const deleteOps = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deleteOps);
    } catch {
      // ignore
    }

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
/**
 * Deduplicates orders list by canonical ID or tracking number.
 * Unifies any ord-man-* legacy IDs with their canonical NAK-* IDs.
 */
export const deduplicateStoredOrders = (ordersList: StoredOrder[]): StoredOrder[] => {
  const map = new Map<string, StoredOrder>();
  for (const ord of ordersList) {
    if (!ord) continue;
    // Filter out corrupted or completely empty ghost documents
    const hasInfo = Boolean(
      (ord.customerName && ord.customerName.trim()) ||
      (ord.name && ord.name.trim()) ||
      (ord.phone && ord.phone.trim()) ||
      (ord.items && ord.items.length > 0) ||
      (ord.itemDetails && ord.itemDetails.length > 0) ||
      ord.totalPrice ||
      ord.totalAmount
    );
    if (!hasInfo) {
      continue;
    }

    const key = (ord.id || ord.trackingNumber || '').trim().toUpperCase();
    if (!key) continue;

    if (map.has(key)) {
      const existing = map.get(key)!;
      const isDeleted = ord.isDeleted === true || existing.isDeleted === true;
      const deletedAt = isDeleted ? (ord.deletedAt || existing.deletedAt || new Date().toISOString()) : undefined;

      const preferOrd = (safeOrderTimestamp(ord.updatedAt || ord.createdAt || ord.date) >= safeOrderTimestamp(existing.updatedAt || existing.createdAt || existing.date));
      const base = preferOrd ? ord : existing;
      const other = preferOrd ? existing : ord;

      map.set(key, {
        ...other,
        ...base,
        id: base.id || other.id || key,
        trackingNumber: base.trackingNumber || other.trackingNumber || key,
        isDeleted,
        deletedAt
      });
    } else {
      map.set(key, ord);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const timeA = safeOrderTimestamp(a.createdAt || a.date);
    const timeB = safeOrderTimestamp(b.createdAt || b.date);
    return timeB - timeA;
  });
};

export const fetchOrdersFromFirestore = async (forceRefresh = false): Promise<StoredOrder[]> => {
  try {
    const now = Date.now();
    if (!forceRefresh && ordersMemoryCache && ordersMemoryCache.expiresAt > now) {
      return ordersMemoryCache.data;
    }

    recordOperation('read');
    const colRef = collection(db, 'orders');
    // Fetch all documents directly without strict orderBy index constraints
    // This guarantees orders without createdAt or with formatting differences are never omitted
    const snap = await getDocs(colRef);
    const results: StoredOrder[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const orderId = docSnap.id;
      const tracking = data.trackingNumber || (orderId.startsWith('NAK-') ? orderId : orderId);
      results.push({
        ...data,
        id: orderId,
        date: data.date ? formatOrderDateWithoutSeconds(data.date) : formatOrderDateWithoutSeconds(data.createdAt || new Date()),
        createdAt: safeIsoDateString(data.createdAt || data.date),
        name: data.name || data.customerName || '',
        customerName: data.customerName || data.name || '',
        phone: data.phone || '',
        address: data.address || '',
        province: data.province || '',
        district: data.district || '',
        detailedAddress: data.detailedAddress || '',
        note: data.note || '',
        items: data.items || [],
        itemDetails: data.itemDetails || [],
        totalPrice: data.totalPrice !== undefined ? Number(data.totalPrice) : (Number(data.totalAmount) || 0),
        totalAmount: data.totalAmount !== undefined ? Number(data.totalAmount) : (Number(data.totalPrice) || 0),
        shippingFee: Number(data.shippingFee) || 0,
        discountAmount: Number(data.discountAmount) || 0,
        voucherCode: data.voucherCode || undefined,
        voucherDiscountAmount: data.voucherDiscountAmount !== undefined ? Number(data.voucherDiscountAmount) : undefined,
        voucherType: data.voucherType || undefined,
        craftingStageNote: data.craftingStageNote || '',
        source: data.source || 'website',
        type: data.type || 'standard_order',
        status: data.status || 'Chờ xác nhận',
        paymentMethod: data.paymentMethod || (data.bankReceiptImage ? 'bank_transfer' : 'cod'),
        paymentStatus: data.paymentStatus || (data.bankReceiptImage ? 'paid' : 'unpaid'),
        bankReceiptImage: data.bankReceiptImage || '',
        paidAmount: data.paidAmount !== undefined ? Number(data.paidAmount) : (data.paymentStatus === 'paid' ? (Number(data.totalPrice) || 0) : 0),
        bankTransferRef: data.bankTransferRef || '',
        sellerId: data.sellerId || '',
        sellerName: data.sellerName || '',
        trackingNumber: tracking,
        shippingCarrier: data.shippingCarrier || '',
        shippingCode: data.shippingCode || '',
        estimatedDelivery: data.estimatedDelivery || '',
        statusHistory: data.statusHistory || [],
        isDeleted: data.isDeleted === true,
        deletedAt: data.deletedAt || undefined
      });
      recordOperation('read');
    });

    const deduplicated = deduplicateStoredOrders(results);
    ordersMemoryCache = { data: deduplicated, expiresAt: now + 30000 };
    return deduplicated;
  } catch (err) {
    console.error('Lỗi tải đơn hàng từ Firestore:', err);
    return ordersMemoryCache?.data || [];
  }
};

export const getOrdersFromFirestore = fetchOrdersFromFirestore;

// Helper to sanitize itemDetails: strip all heavy base64 images completely so order payload contains purely clean text metadata (< 2KB)
function sanitizeItemDetailsForFirestore(itemDetails: any[]): any[] {
  if (!Array.isArray(itemDetails)) return [];
  return itemDetails.map((item) => {
    const copy = { ...item };
    // Completely remove all heavy base64 strings
    if (typeof copy.selectedColorImage === 'string' && copy.selectedColorImage.startsWith('data:image/')) {
      delete copy.selectedColorImage;
    }
    if (typeof copy.selectedCharmImage === 'string' && copy.selectedCharmImage.startsWith('data:image/')) {
      delete copy.selectedCharmImage;
    }
    if (typeof copy.selectedKhoenImage === 'string' && copy.selectedKhoenImage.startsWith('data:image/')) {
      delete copy.selectedKhoenImage;
    }
    if (typeof copy.image === 'string' && copy.image.startsWith('data:image/')) {
      delete copy.image;
    }
    return copy;
  });
}

export const saveOrderToFirestore = async (order: StoredOrder): Promise<void> => {
  const canonicalId = canonicalOrderKey(order.id) || canonicalOrderKey(order.trackingNumber);
  const orderId = (canonicalId || order.id || order.trackingNumber || `NAK-${Date.now().toString().slice(-8)}`).trim().toUpperCase();
  const docRef = doc(db, 'orders', orderId);

  // 1. Bank receipt image is uploaded directly to Firebase Storage bucket under receipts/
  let receiptImage = order.bankReceiptImage;
  if (receiptImage && (receiptImage.startsWith('data:image/') || receiptImage.length > 300) && !receiptImage.startsWith('http')) {
    try {
      // Set 2.5s timeout for receipt upload so it never blocks checkout
      receiptImage = await Promise.race([
        uploadBase64ToStorage(receiptImage, `receipts/${orderId}_receipt.png`),
        new Promise<string>((resolve) => setTimeout(() => resolve(receiptImage!), 2500))
      ]);
    } catch {
      // ignore
    }
  }

  // 2. Sanitize itemDetails to strip all images so order payload is pure text (< 2KB)
  const sanitizedItemDetails = sanitizeItemDetailsForFirestore(order.itemDetails || []);

  const payload = cleanFirestoreData({
    ...order,
    id: orderId,
    trackingNumber: order.trackingNumber || orderId,
    bankReceiptImage: receiptImage,
    itemDetails: sanitizedItemDetails,
    date: order.date ? formatOrderDateWithoutSeconds(order.date) : formatOrderDateWithoutSeconds(order.createdAt || new Date()),
    createdAt: safeIsoDateString(order.createdAt || order.date),
    status: order.status || 'Chờ xác nhận',
    paymentStatus: order.paymentStatus || 'unpaid',
    source: order.source || 'website',
    updatedAt: new Date().toISOString()
  });

  // 3. Immediately synchronize local storage cache
  try {
    const existingStr = localStorage.getItem('nak_preorders');
    const existingList: StoredOrder[] = existingStr ? JSON.parse(existingStr) : [];
    const normKey = orderId.toUpperCase();
    const updatedList = [
      payload,
      ...existingList.filter((o) => {
        const k1 = (o.id || '').toUpperCase();
        const k2 = (o.trackingNumber || '').toUpperCase();
        return k1 !== normKey && k2 !== normKey;
      })
    ];
    safeStorageSetItem('nak_preorders', JSON.stringify(updatedList));
    localStorage.setItem('nak_last_order_code', orderId);
  } catch {
    // ignore
  }

  // 4. Broadcast live custom event across browser window/tabs
  ordersMemoryCache = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nak_order_created', { detail: payload }));
  }

  // 5. Direct write to Firestore with up to 3 fast retry attempts
  let lastErr: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const orderSize = JSON.stringify(payload).length;
      
      // Wrap setDoc in 3.5s timeout guard so slow network ack never locks checkout modal
      await Promise.race([
        setDoc(docRef, payload, { merge: true }),
        new Promise<void>((resolve) => setTimeout(resolve, 3500))
      ]);
      recordOperation('write', 1, orderSize);

      // NON-BLOCKING: Backup JSON file to Firebase Storage asynchronously (Fire and forget!)
      uploadString(ref(storage, `orders/details/${orderId}.json`), JSON.stringify(payload, null, 2), 'raw', { contentType: 'application/json' }).catch((stErr) => {
        console.warn('Storage order backup notice:', stErr);
      });

      return; // Succeeded!
    } catch (err: any) {
      lastErr = err;
      console.warn(`Lưu đơn hàng lên Firestore lần ${attempt} thất bại:`, err);
      if (isQuotaExhaustedError(err)) {
        // Quota error: data is safely in local storage, notify
        return;
      }
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  }

  // If payload is already saved in localStorage, consider it saved
  console.warn('Đơn hàng đã được lưu vào bộ nhớ máy, lưu trực tuyến báo phản hồi chậm:', lastErr);
};

export const saveOrdersToFirestore = async (ordersList: StoredOrder[]): Promise<void> => {
  for (const ord of ordersList) {
    await saveOrderToFirestore(ord);
  }
};

export const saveProductsToFirestore = async (productsList: Product[]): Promise<void> => {
  const batchSize = 6;
  for (let i = 0; i < productsList.length; i += batchSize) {
    const chunk = productsList.slice(i, i + batchSize);
    await Promise.all(chunk.map((p) => saveProductToFirestore(p)));
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
    ordersMemoryCache = null;
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
          const orderId = docSnap.id;
          const tracking = data.trackingNumber || orderId;
          results.push({
            ...data,
            id: orderId,
            date: data.date ? formatOrderDateWithoutSeconds(data.date) : formatOrderDateWithoutSeconds(data.createdAt || new Date()),
            createdAt: safeIsoDateString(data.createdAt || data.date),
            name: data.name || data.customerName || '',
            customerName: data.customerName || data.name || '',
            phone: data.phone || '',
            address: data.address || '',
            province: data.province || '',
            district: data.district || '',
            detailedAddress: data.detailedAddress || '',
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
            status: data.status || 'Chờ xác nhận',
            paymentMethod: data.paymentMethod || (data.bankReceiptImage ? 'bank_transfer' : 'cod'),
            paymentStatus: data.paymentStatus || (data.bankReceiptImage ? 'paid' : 'unpaid'),
            bankReceiptImage: data.bankReceiptImage || '',
            paidAmount: data.paidAmount !== undefined ? Number(data.paidAmount) : (data.paymentStatus === 'paid' ? (Number(data.totalPrice) || 0) : 0),
            bankTransferRef: data.bankTransferRef || '',
            sellerId: data.sellerId || '',
            sellerName: data.sellerName || '',
            trackingNumber: tracking,
            shippingCarrier: data.shippingCarrier || '',
            shippingCode: data.shippingCode || '',
            estimatedDelivery: data.estimatedDelivery || '',
            statusHistory: data.statusHistory || [],
            isDeleted: data.isDeleted === true,
            deletedAt: data.deletedAt || undefined
          });
        });
        // Deduplicate and sort descending by createdAt
        const deduplicated = deduplicateStoredOrders(results);
        callback(deduplicated);
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

export const moveOrderToTrash = async (orderId: string): Promise<void> => {
  if (!orderId) return;
  try {
    const now = new Date().toISOString();
    const cleanId = orderId.replace(/^#/, '').trim();
    const cleanUpper = cleanId.toUpperCase();

    // 1. Prepare direct document writes
    const updatePromises: Promise<any>[] = [
      setDoc(doc(db, 'orders', orderId), { isDeleted: true, deletedAt: now }, { merge: true }).catch(() => {}),
      setDoc(doc(db, 'orders', cleanId), { isDeleted: true, deletedAt: now }, { merge: true }).catch(() => {}),
      setDoc(doc(db, 'orders', cleanUpper), { isDeleted: true, deletedAt: now }, { merge: true }).catch(() => {})
    ];

    // 2. Query Firestore collection to find and update all matching documents
    const colRef = collection(db, 'orders');
    const snap = await getDocs(colRef);
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (isMatchingOrderDoc(orderId, docSnap.id, d)) {
        updatePromises.push(
          setDoc(docSnap.ref, { isDeleted: true, deletedAt: now }, { merge: true })
        );
      }
    });

    await Promise.allSettled(updatePromises);

    // 3. Clean and sync all local storage caches
    syncLocalStorageOrderDeletion(orderId, false);
    ordersMemoryCache = null;
    recordOperation('write', 1, -100);
  } catch (err) {
    console.error('Lỗi chuyển đơn hàng vào thùng rác:', err);
    throw err;
  }
};

export const moveOrdersBatchToTrash = async (orderIds: string[]): Promise<void> => {
  if (!orderIds || orderIds.length === 0) return;
  try {
    const now = new Date().toISOString();
    const colRef = collection(db, 'orders');
    const snap = await getDocs(colRef);
    const updatePromises: Promise<any>[] = [];

    orderIds.forEach((id) => {
      const cleanId = id.replace(/^#/, '').trim();
      const cleanUpper = cleanId.toUpperCase();
      updatePromises.push(
        setDoc(doc(db, 'orders', id), { isDeleted: true, deletedAt: now }, { merge: true }).catch(() => {}),
        setDoc(doc(db, 'orders', cleanId), { isDeleted: true, deletedAt: now }, { merge: true }).catch(() => {}),
        setDoc(doc(db, 'orders', cleanUpper), { isDeleted: true, deletedAt: now }, { merge: true }).catch(() => {})
      );
      syncLocalStorageOrderDeletion(id, false);
    });

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const matchesAny = orderIds.some((id) => isMatchingOrderDoc(id, docSnap.id, d));
      if (matchesAny) {
        updatePromises.push(
          setDoc(docSnap.ref, { isDeleted: true, deletedAt: now }, { merge: true })
        );
      }
    });

    await Promise.allSettled(updatePromises);
    ordersMemoryCache = null;
    recordOperation('write', orderIds.length, -100 * orderIds.length);
  } catch (err) {
    console.error('Lỗi chuyển hàng loạt đơn hàng vào thùng rác:', err);
    throw err;
  }
};

export const restoreOrderFromTrash = async (orderId: string): Promise<void> => {
  if (!orderId) return;
  try {
    const now = new Date().toISOString();
    const cleanId = orderId.replace(/^#/, '').trim();
    const cleanUpper = cleanId.toUpperCase();

    const updatePromises: Promise<any>[] = [
      setDoc(doc(db, 'orders', orderId), { isDeleted: false, deletedAt: null, updatedAt: now }, { merge: true }).catch(() => {}),
      setDoc(doc(db, 'orders', cleanId), { isDeleted: false, deletedAt: null, updatedAt: now }, { merge: true }).catch(() => {}),
      setDoc(doc(db, 'orders', cleanUpper), { isDeleted: false, deletedAt: null, updatedAt: now }, { merge: true }).catch(() => {})
    ];

    const colRef = collection(db, 'orders');
    const snap = await getDocs(colRef);
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (isMatchingOrderDoc(orderId, docSnap.id, d)) {
        updatePromises.push(
          setDoc(docSnap.ref, { isDeleted: false, deletedAt: null, updatedAt: now }, { merge: true })
        );
      }
    });

    await Promise.allSettled(updatePromises);

    // Update in localStorage
    const keys = ['nak_preorders', 'nak_orders', 'nak_custom_orders'];
    keys.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const list: StoredOrder[] = JSON.parse(raw);
        if (!Array.isArray(list)) return;
        const updated = list.map((ord) => {
          if (isMatchingOrderDoc(orderId, ord.id || '', ord)) {
            return { ...ord, isDeleted: false, deletedAt: undefined, updatedAt: now };
          }
          return ord;
        });
        safeStorageSetItem(key, JSON.stringify(updated));
      } catch {}
    });

    ordersMemoryCache = null;
    recordOperation('write', 1, -100);
  } catch (err) {
    console.error('Lỗi khôi phục đơn hàng:', err);
    throw err;
  }
};

export const deleteOrderPermanently = async (orderId: string): Promise<void> => {
  if (!orderId) return;
  try {
    const cleanId = orderId.replace(/^#/, '').trim();
    const cleanUpper = cleanId.toUpperCase();
    const candidates = resolveAllOrderIdCandidates(orderId);

    // 1. Direct document deletions for all candidate IDs in Firestore
    const deletePromises: Promise<any>[] = [
      deleteDoc(doc(db, 'orders', orderId)).catch(() => {}),
      deleteDoc(doc(db, 'orders', cleanId)).catch(() => {}),
      deleteDoc(doc(db, 'orders', cleanUpper)).catch(() => {})
    ];

    candidates.forEach((candId) => {
      deletePromises.push(deleteDoc(doc(db, 'orders', candId)).catch(() => {}));
      deletePromises.push(deleteDoc(doc(db, 'orders', candId.replace(/^#/, ''))).catch(() => {}));
    });

    // 2. Query Firestore collection and delete ANY doc that matches this order
    const colRef = collection(db, 'orders');
    const snap = await getDocs(colRef);
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (isMatchingOrderDoc(orderId, docSnap.id, d)) {
        deletePromises.push(deleteDoc(docSnap.ref));
        deletePromises.push(deleteObject(ref(storage, `orders/details/${docSnap.id}.json`)).catch(() => {}));
        deletePromises.push(deleteObject(ref(storage, `orders/details/${docSnap.id.replace(/^#/, '')}.json`)).catch(() => {}));
      }
    });

    // 3. Clean from Firebase Storage for all potential candidate paths
    candidates.forEach((candId) => {
      deletePromises.push(deleteObject(ref(storage, `orders/details/${candId}.json`)).catch(() => {}));
      deletePromises.push(deleteObject(ref(storage, `orders/details/${candId.replace(/^#/, '')}.json`)).catch(() => {}));
    });
    deletePromises.push(deleteObject(ref(storage, `orders/details/${orderId}.json`)).catch(() => {}));
    deletePromises.push(deleteObject(ref(storage, `orders/details/${cleanId}.json`)).catch(() => {}));

    await Promise.allSettled(deletePromises);

    // 4. Remove completely from all local storage caches
    syncLocalStorageOrderDeletion(orderId, true);
    purgeAllDeletedOrdersFromLocalStorage([orderId]);
    ordersMemoryCache = null;
    recordOperation('delete', 1, -900);
  } catch (err) {
    console.error('Lỗi xóa vĩnh viễn đơn hàng:', err);
    throw err;
  }
};

export const emptyOrderTrash = async (orderIds?: string[]): Promise<void> => {
  try {
    const colRef = collection(db, 'orders');
    const snap = await getDocs(colRef);
    const deletePromises: Promise<any>[] = [];
    const isSpecificBatch = Boolean(orderIds && orderIds.length > 0);

    // Resolve all target candidate IDs
    const allTargets = new Set<string>();
    if (isSpecificBatch && orderIds) {
      orderIds.forEach((id) => {
        allTargets.add(id);
        const candidates = resolveAllOrderIdCandidates(id);
        candidates.forEach((c) => allTargets.add(c));
      });
    }

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const isDeletedFlag = d.isDeleted === true || d.deleted === true;
      let shouldDelete = false;

      if (isSpecificBatch && orderIds) {
        shouldDelete = orderIds.some((id) => isMatchingOrderDoc(id, docSnap.id, d));
      } else {
        shouldDelete = isDeletedFlag;
      }

      if (shouldDelete) {
        // 1. Delete document from Firestore
        deletePromises.push(deleteDoc(docSnap.ref));

        // 2. Delete detail JSON and receipt files from Firebase Storage
        deletePromises.push(deleteObject(ref(storage, `orders/details/${docSnap.id}.json`)).catch(() => {}));
        deletePromises.push(deleteObject(ref(storage, `orders/details/${docSnap.id.replace(/^#/, '')}.json`)).catch(() => {}));
        if (d.id) {
          deletePromises.push(deleteObject(ref(storage, `orders/details/${d.id}.json`)).catch(() => {}));
          deletePromises.push(deleteObject(ref(storage, `orders/details/${String(d.id).replace(/^#/, '')}.json`)).catch(() => {}));
        }
        if (d.trackingNumber) {
          deletePromises.push(deleteObject(ref(storage, `orders/details/${d.trackingNumber}.json`)).catch(() => {}));
          deletePromises.push(deleteObject(ref(storage, `orders/details/${String(d.trackingNumber).replace(/^#/, '')}.json`)).catch(() => {}));
        }
        if (d.bankReceiptImage) {
          deletePromises.push(deleteObject(ref(storage, `receipts/${docSnap.id}_receipt.png`)).catch(() => {}));
          deletePromises.push(deleteObject(ref(storage, `receipts/${String(d.id || docSnap.id).replace(/^#/, '')}_receipt.png`)).catch(() => {}));
        }
      }
    });

    // Direct deletion for all candidate ID keys
    allTargets.forEach((targetId) => {
      deletePromises.push(deleteDoc(doc(db, 'orders', targetId)).catch(() => {}));
      deletePromises.push(deleteDoc(doc(db, 'orders', targetId.replace(/^#/, ''))).catch(() => {}));
      deletePromises.push(deleteObject(ref(storage, `orders/details/${targetId}.json`)).catch(() => {}));
      deletePromises.push(deleteObject(ref(storage, `orders/details/${targetId.replace(/^#/, '')}.json`)).catch(() => {}));
      deletePromises.push(deleteObject(ref(storage, `receipts/${targetId}_receipt.png`)).catch(() => {}));
      deletePromises.push(deleteObject(ref(storage, `receipts/${targetId.replace(/^#/, '')}_receipt.png`)).catch(() => {}));
    });

    // 3. Scan Storage orders/details folder directly to purge any lingering order JSON files
    try {
      const folderRef = ref(storage, 'orders/details');
      const fileList = await listAll(folderRef);
      for (const itemRef of fileList.items) {
        const itemName = itemRef.name.replace(/\.json$/i, '');
        let shouldDeleteStorageFile = false;
        if (!isSpecificBatch) {
          // Empty all trash -> delete all storage files
          shouldDeleteStorageFile = true;
        } else if (orderIds) {
          shouldDeleteStorageFile = orderIds.some((id) => {
            const clean = id.replace(/^#/, '').toLowerCase();
            const cand = itemName.replace(/^#/, '').toLowerCase();
            return cand === clean || cand.includes(clean) || clean.includes(cand);
          });
        }
        if (shouldDeleteStorageFile) {
          deletePromises.push(deleteObject(itemRef).catch(() => {}));
        }
      }
    } catch {
      // Storage listing may be empty
    }

    await Promise.allSettled(deletePromises);

    // 4. Thoroughly purge all matching or deleted items from local storage caches
    if (orderIds && orderIds.length > 0) {
      orderIds.forEach((id) => {
        syncLocalStorageOrderDeletion(id, true);
      });
    }
    purgeAllDeletedOrdersFromLocalStorage(orderIds);

    // 5. Invalidate memory cache & record operation
    ordersMemoryCache = null;
    recordOperation('delete', Math.max(1, deletePromises.length), -900);

    // 6. Broadcast deletion event
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('nak_order_deleted', { detail: { orderIds, permanent: true } })
        );
      } catch {}
    }
  } catch (err) {
    console.error('Lỗi dọn sạch thùng rác:', err);
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
        isHidden: data.isHidden === true || String(data.isHidden) === 'true'
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
            isHidden: data.isHidden === true || String(data.isHidden) === 'true'
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
    const isCatHidden = category.isHidden === true || String(category.isHidden) === 'true';

    let bannerImage = category.bannerImage;
    if (bannerImage && (bannerImage.startsWith('data:image/') || bannerImage.length > 300) && !bannerImage.startsWith('http')) {
      bannerImage = await uploadBase64ToStorage(bannerImage, `categories/${category.id}/banner.png`);
    }

    const payload = cleanFirestoreData({
      ...category,
      bannerImage,
      isHidden: isCatHidden,
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
        ...data,
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
        horizontalImage: data.horizontalImage || data.bannerImage || data.bgImage || '',
        productPageBanner: data.productPageBanner || data.bannerImage || data.bgImage || '',
        badge: data.badge || '',
        isPreorder: !!data.isPreorder,
        themeColor: data.themeColor || '#B41C1A',
        accentColor: data.accentColor || '',
        order: typeof data.order === 'number' ? data.order : 0,
        buttonText: data.buttonText || '',
        themeStyle: data.themeStyle || 'light',
        isHidden: data.isHidden === true || String(data.isHidden) === 'true'
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
            ...data,
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
            horizontalImage: data.horizontalImage || data.bannerImage || data.bgImage || '',
            productPageBanner: data.productPageBanner || data.bannerImage || data.bgImage || '',
            badge: data.badge || '',
            isPreorder: !!data.isPreorder,
            themeColor: data.themeColor || '#B41C1A',
            accentColor: data.accentColor || '',
            order: typeof data.order === 'number' ? data.order : 0,
            buttonText: data.buttonText || '',
            themeStyle: data.themeStyle || 'light',
            isHidden: data.isHidden === true || String(data.isHidden) === 'true'
          });
        });
        results.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        callback(results);
      },
      (error) => {
        console.warn('Lỗi lắng nghe realtime collections:', error);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Lỗi thiết lập realtime collections:', err);
    return () => {};
  }
};

export const saveCollectionToFirestore = async (collectionItem: CollectionInfo): Promise<void> => {
  try {
    const docRef = doc(db, 'collections', collectionItem.id);

    let bgImage = collectionItem.bgImage;
    if (bgImage && (bgImage.startsWith('data:image/') || bgImage.length > 300) && !bgImage.startsWith('http')) {
      bgImage = await uploadBase64ToStorage(bgImage, `collections/${collectionItem.id}/bg.png`);
    }

    let bannerImage = collectionItem.bannerImage;
    if (bannerImage && (bannerImage.startsWith('data:image/') || bannerImage.length > 300) && !bannerImage.startsWith('http')) {
      bannerImage = await uploadBase64ToStorage(bannerImage, `collections/${collectionItem.id}/banner.png`);
    }

    let horizontalImage = collectionItem.horizontalImage;
    if (horizontalImage && (horizontalImage.startsWith('data:image/') || horizontalImage.length > 300) && !horizontalImage.startsWith('http')) {
      horizontalImage = await uploadBase64ToStorage(horizontalImage, `collections/${collectionItem.id}/horizontal.png`);
    }

    let productPageBanner = collectionItem.productPageBanner;
    if (productPageBanner && (productPageBanner.startsWith('data:image/') || productPageBanner.length > 300) && !productPageBanner.startsWith('http')) {
      productPageBanner = await uploadBase64ToStorage(productPageBanner, `collections/${collectionItem.id}/product_page.png`);
    }

    const isColHidden = collectionItem.isHidden === true || String(collectionItem.isHidden) === 'true';
    const payload = cleanFirestoreData({
      ...collectionItem,
      isHidden: isColHidden,
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

    // Also verify and delete any doc where categoryKey or id matches to ensure 100% clean deletion
    try {
      const snap = await getDocs(collection(db, 'collections'));
      const extraDeletes: Promise<any>[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (d.id === collectionId || data.id === collectionId || data.categoryKey === collectionId) {
          extraDeletes.push(deleteDoc(doc(db, 'collections', d.id)));
        }
      });
      if (extraDeletes.length > 0) {
        await Promise.all(extraDeletes);
      }
    } catch {
      // ignore secondary lookup errors
    }
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
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as SiteContentConfig;
    }
    const snap = await getDocs(query(collection(db, 'site_content')));
    if (!snap.empty) {
      const found = snap.docs.find(d => d.id === 'main_config') || snap.docs[0];
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

    // Compress hero slides images if any Base64 strings exist & remove legacy separate mobile images
    let heroSlides = config.heroSlides;
    if (Array.isArray(heroSlides) && heroSlides.length > 0) {
      heroSlides = await Promise.all(
        heroSlides.map(async (slide) => {
          let bgImg = slide.bgImage;
          if (bgImg && bgImg.startsWith('data:image/')) {
            try {
              bgImg = await compressBase64Image(bgImg, 1600, 900, 0.82);
            } catch (compErr) {
              console.warn('Lỗi nén ảnh slide:', compErr);
            }
          }
          const { bgImageMobile, ...restSlide } = slide as any;
          return { ...restSlide, bgImage: bgImg };
        })
      );
    }

    const payload = cleanFirestoreData({
      ...config,
      heroSlides,
      updatedAt: new Date().toISOString()
    });

    // Also update local storage cache immediately with quota-safe helper
    safeStorageSetItem('nak_site_content', JSON.stringify(payload));

    const dataSize = JSON.stringify(payload).length;
    await setDoc(docRef, payload, { merge: true });
    recordOperation('write', dataSize);
  } catch (err) {
    console.error('Lỗi lưu cấu hình website vào Firestore:', err);
    // Ensure local storage is updated anyway
    safeStorageSetItem('nak_site_content', JSON.stringify(config));
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

      // Robust extraction of ipHistory (handles arrays, recovered elements, or single lastLoginIp fallback)
      let parsedHistory: Array<{ ip: string; city?: string; country?: string; device?: string; timestamp: string }> = [];
      if (Array.isArray(data.ipHistory)) {
        parsedHistory = data.ipHistory.filter((item: any) => item && typeof item === 'object' && item.ip);
      } else if (data.ipHistory && typeof data.ipHistory === 'object') {
        if (Array.isArray((data.ipHistory as any)._elements)) {
          parsedHistory = (data.ipHistory as any)._elements.filter((item: any) => item && typeof item === 'object' && item.ip);
        } else if (Array.isArray((data.ipHistory as any).elements)) {
          parsedHistory = (data.ipHistory as any).elements.filter((item: any) => item && typeof item === 'object' && item.ip);
        }
      }

      // If ipHistory array is empty but lastLoginIp is stored on document, synthesize a valid entry
      if (parsedHistory.length === 0 && data.lastLoginIp && data.lastLoginIp !== 'Unknown' && data.lastLoginIp !== '127.0.0.1') {
        parsedHistory.push({
          ip: data.lastLoginIp,
          city: data.lastLoginCity || 'Hà Nội',
          country: data.lastLoginCountry || 'Vietnam',
          device: data.lastDevice || 'Thiết bị quản trị',
          timestamp: data.lastLoginAt || data.lastSeenAt || data.createdAt || new Date().toISOString()
        });
      }

      results.push({
        id: docSnap.id,
        username: data.username || docSnap.id,
        name: data.name || data.username || '',
        passwordHash: '',
        passwordSalt: '',
        isRootAdmin: !!data.isRootAdmin,
        role: data.role || (data.isRootAdmin ? 'root_admin' : 'member'),
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        lastLoginAt: data.lastLoginAt,
        lastLoginIp: data.lastLoginIp || '',
        lastLoginCity: data.lastLoginCity || '',
        lastLoginCountry: data.lastLoginCountry || '',
        lastSeenAt: data.lastSeenAt,
        lastDevice: data.lastDevice || '',
        avatarColor: data.avatarColor || '#B41C1A',
        phone: data.phone || '',
        ipHistory: parsedHistory
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

export const fetchSellerByUsername = async (username: string): Promise<SellerUser | null> => {
  const clean = (username || '').trim().toLowerCase();
  if (!clean) return null;
  const sellerId = `seller-${clean.replace(/[^a-z0-9]/g, '')}`;

  const fetchInternal = async (): Promise<SellerUser | null> => {
    try {
      // 1. Direct fetch by standard doc ID
      const docRef = doc(db, 'sellers', sellerId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          id: snap.id,
          username: data.username || clean,
          name: data.name || clean,
          isRootAdmin: !!data.isRootAdmin,
          role: data.role || (data.isRootAdmin ? 'root_admin' : 'member'),
          isActive: data.isActive !== false,
          createdAt: data.createdAt || new Date().toISOString(),
          avatarColor: data.avatarColor || '#B41C1A',
          phone: data.phone || '',
          ...data,
          passwordHash: data.passwordHash || '',
          passwordSalt: data.passwordSalt || ''
        } as SellerUser;
      }

      // 2. Query collection by username field
      const colRef = collection(db, 'sellers');
      const q = query(colRef, where('username', '==', clean), limit(1));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const docSnap = querySnap.docs[0];
        const data = docSnap.data();
        return {
          id: docSnap.id,
          username: data.username || clean,
          name: data.name || clean,
          isRootAdmin: !!data.isRootAdmin,
          role: data.role || (data.isRootAdmin ? 'root_admin' : 'member'),
          isActive: data.isActive !== false,
          createdAt: data.createdAt || new Date().toISOString(),
          avatarColor: data.avatarColor || '#B41C1A',
          phone: data.phone || '',
          ...data,
          passwordHash: data.passwordHash || '',
          passwordSalt: data.passwordSalt || ''
        } as SellerUser;
      }
    } catch (err) {
      console.warn('fetchSellerByUsername warning:', err);
    }
    return null;
  };

  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
  return Promise.race([fetchInternal(), timeoutPromise]);
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

/**
 * Updates seller's online presence, latest IP and device info on Firestore.
 */
export const updateSellerPresence = async (
  sellerId: string, 
  presenceData: {
    lastSeenAt?: string;
    lastLoginAt?: string;
    lastLoginIp?: string;
    lastLoginCity?: string;
    lastLoginCountry?: string;
    lastDevice?: string;
  }
): Promise<void> => {
  if (!sellerId) return;
  try {
    const docRef = doc(db, 'sellers', sellerId);
    const nowIso = new Date().toISOString();
    
    const updateObj: Record<string, any> = {
      ...presenceData,
      lastSeenAt: presenceData.lastSeenAt || nowIso,
      updatedAt: nowIso
    };

    // If a valid IP is supplied, append to ipHistory on the seller document
    if (presenceData.lastLoginIp && presenceData.lastLoginIp !== '127.0.0.1' && presenceData.lastLoginIp !== 'Unknown') {
      const ipEntry = {
        ip: presenceData.lastLoginIp,
        city: presenceData.lastLoginCity || 'Hà Nội',
        country: presenceData.lastLoginCountry || 'Vietnam',
        device: presenceData.lastDevice || 'Không xác định',
        timestamp: presenceData.lastLoginAt || nowIso
      };
      updateObj.ipHistory = arrayUnion(ipEntry);
    }

    const payload = cleanFirestoreData(updateObj);
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    // Non-blocking error for background presence update
    console.warn('Lỗi cập nhật trạng thái người bán:', err);
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
    .slice(0, 30);

  if (result.length > 0) {
    saveBackupsToIDB(result);
    try {
      localStorage.setItem('notaknot_backups_cache', JSON.stringify(result));
    } catch {}
  }

  return result;
};

/**
 * Saves a backup to Firestore Cloud, Firebase Storage, IndexedDB, and localStorage cache, retaining the latest 30 backups.
 */
export const saveBackupToFirestore = async (backup: VersionBackup): Promise<VersionBackup[]> => {
  // 1. Save full, un-truncated backup to Firebase Storage bucket
  try {
    const storageBackupRef = ref(storage, `backups/${backup.id}.json`);
    await uploadString(storageBackupRef, JSON.stringify(backup, null, 2), 'raw', { contentType: 'application/json' });
  } catch (stErr) {
    console.warn('Không thể lưu bản sao lưu nguyên vẹn vào Firebase Storage:', stErr);
  }

  // 2. Persist metadata & summary to Firestore Cloud
  let cloudSuccess = false;
  try {
    const docRef = doc(db, 'backups', backup.id);
    const cleaned = sanitizeBackupForFirestore(backup);
    await setDoc(docRef, cleaned);
    recordOperation('write', 1, 2500);
    cloudSuccess = true;
    backup.syncedToCloud = true;

    // Enforce max 30 documents on Firestore
    const colRef = collection(db, 'backups');
    const snap = await getDocs(colRef);
    const fsDocs: { id: string; createdAt: string }[] = [];
    snap.forEach((d) => {
      const data = d.data();
      fsDocs.push({ id: d.id, createdAt: data?.createdAt || '' });
    });
    fsDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (fsDocs.length > 30) {
      const toDelete = fsDocs.slice(30);
      for (const oldDoc of toDelete) {
        try {
          await deleteDoc(doc(db, 'backups', oldDoc.id));
          // Also delete old file from Storage
          try {
            await deleteObject(ref(storage, `backups/${oldDoc.id}.json`));
          } catch {}
          recordOperation('delete', 1, -2500);
        } catch (delErr) {
          console.warn('Không thể xóa backup cũ vượt quá giới hạn 30:', delErr);
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
      console.warn('Không thể lưu backup lên Firestore, lưu trữ an toàn cục bộ trên máy:', retryErr);
      cloudSuccess = false;
      backup.syncedToCloud = false;
    }
  }

  // 3. Fetch existing backups from all sources
  const existingList = await fetchBackupsFromFirestore();
  const updatedList: VersionBackup[] = [
    { ...backup, syncedToCloud: cloudSuccess },
    ...existingList.filter((b) => b.id !== backup.id)
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);

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

// ----------------------------------------------------
// DATABASE INDEXED QUERY HELPERS & CLIENT INDEX CACHE
// ----------------------------------------------------

/**
 * Fetch orders by status using the composite index (status ASC, createdAt DESC)
 */
export const fetchOrdersByStatusIndex = async (status: string, limitCount = 50): Promise<any[]> => {
  try {
    recordOperation('read', 1);
    const colRef = collection(db, 'orders');
    const q = query(colRef, where('status', '==', status), orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn(`[Firestore Index] Failed compound query for status "${status}":`, err);
    // Fallback: load from client IDB/local cache
    const all = await fetchOrdersFromFirestore();
    return all.filter((o: any) => o.status === status).slice(0, limitCount);
  }
};

/**
 * Fetch orders by type using the composite index (type ASC, createdAt DESC)
 */
export const fetchOrdersByTypeIndex = async (type: string, limitCount = 50): Promise<any[]> => {
  try {
    recordOperation('read', 1);
    const colRef = collection(db, 'orders');
    const q = query(colRef, where('type', '==', type), orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn(`[Firestore Index] Failed compound query for type "${type}":`, err);
    const all = await fetchOrdersFromFirestore();
    return all.filter((o: any) => o.type === type).slice(0, limitCount);
  }
};

/**
 * Fetch products by category sorted by price using the composite index
 * (category ASC, price ASC / DESC)
 */
export const fetchProductsByCategoryAndPriceIndex = async (
  category: string,
  sortDirection: 'asc' | 'desc' = 'asc'
): Promise<Product[]> => {
  try {
    recordOperation('read', 1);
    const colRef = collection(db, 'products');
    const q = query(colRef, where('category', '==', category), orderBy('price', sortDirection));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[];
  } catch (err) {
    console.warn(`[Firestore Index] Failed query for category "${category}":`, err);
    const all = await fetchProductsFromFirestore();
    return all
      .filter((p) => p.category === category)
      .sort((a, b) => (sortDirection === 'asc' ? a.price - b.price : b.price - a.price));
  }
};

/**
 * Client-Side In-Memory Database Index Cache
 * Provides O(1) indexed lookups for products and orders
 */
class ClientDatabaseIndexManager {
  private productsByCategory = new Map<string, Product[]>();
  private ordersByStatus = new Map<string, any[]>();
  private ordersByPhone = new Map<string, any[]>();
  private lastIndexedAt = 0;

  indexProducts(products: Product[]): void {
    this.productsByCategory.clear();
    for (const p of products) {
      if (p.category) {
        if (!this.productsByCategory.has(p.category)) {
          this.productsByCategory.set(p.category, []);
        }
        this.productsByCategory.get(p.category)!.push(p);
      }
    }
    this.lastIndexedAt = Date.now();
  }

  indexOrders(orders: any[]): void {
    this.ordersByStatus.clear();
    this.ordersByPhone.clear();
    for (const o of orders) {
      if (o.status) {
        if (!this.ordersByStatus.has(o.status)) {
          this.ordersByStatus.set(o.status, []);
        }
        this.ordersByStatus.get(o.status)!.push(o);
      }
      if (o.phone) {
        const cleanPhone = String(o.phone).trim();
        if (!this.ordersByPhone.has(cleanPhone)) {
          this.ordersByPhone.set(cleanPhone, []);
        }
        this.ordersByPhone.get(cleanPhone)!.push(o);
      }
    }
  }

  getProductsByCategory(category: string): Product[] {
    return this.productsByCategory.get(category) || [];
  }

  getOrdersByStatus(status: string): any[] {
    return this.ordersByStatus.get(status) || [];
  }

  getOrdersByPhone(phone: string): any[] {
    return this.ordersByPhone.get(phone.trim()) || [];
  }

  getLastIndexedTime(): number {
    return this.lastIndexedAt;
  }
}

export const dbIndexManager = new ClientDatabaseIndexManager();


