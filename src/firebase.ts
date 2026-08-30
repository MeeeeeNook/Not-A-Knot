import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { Product, CategoryItem, CollectionInfo, SiteContentConfig, ContactMessage } from './types';

// Load client configuration from firebase-applet-config.json
import firebaseAppletConfig from '../firebase-applet-config.json';

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

// Initialize Firestore with auto-detect long polling for reliable cloud connection inside all browser/iframe environments
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
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

// ----------------------------------------------------
// Quota & Free Tier Stats Tracker
// ----------------------------------------------------
export interface FirestoreQuotaStats {
  reads: number;
  writes: number;
  deletes: number;
  estimatedStorageBytes: number;
  maxStorageBytes: number;
  lastSyncTime: string;
  projectId: string;
  databaseId: string;
  region: string;
}

let quotaStats: FirestoreQuotaStats = {
  reads: parseInt(localStorage.getItem('nak_fb_reads') || '14', 10),
  writes: parseInt(localStorage.getItem('nak_fb_writes') || '6', 10),
  deletes: parseInt(localStorage.getItem('nak_fb_deletes') || '0', 10),
  estimatedStorageBytes: parseInt(localStorage.getItem('nak_fb_storage') || '385000', 10), // ~385 KB
  maxStorageBytes: 1024 * 1024 * 1024, // 1 GiB (1,024 MB) Spark Plan Free Tier
  lastSyncTime: new Date().toLocaleTimeString('vi-VN'),
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId,
  region: 'asia-southeast1 (Singapore)'
};

type QuotaListener = (stats: FirestoreQuotaStats) => void;
const quotaListeners: Set<QuotaListener> = new Set();

const notifyQuotaListeners = () => {
  localStorage.setItem('nak_fb_reads', quotaStats.reads.toString());
  localStorage.setItem('nak_fb_writes', quotaStats.writes.toString());
  localStorage.setItem('nak_fb_deletes', quotaStats.deletes.toString());
  localStorage.setItem('nak_fb_storage', quotaStats.estimatedStorageBytes.toString());
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

const recordOperation = (type: 'read' | 'write' | 'delete', deltaStorageBytes = 0) => {
  if (type === 'read') quotaStats.reads += 1;
  if (type === 'write') quotaStats.writes += 1;
  if (type === 'delete') quotaStats.deletes += 1;
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
    selectedSize?: string;
    customNote?: string;
  }[];
  totalPrice?: number;
  totalAmount?: number;
  source?: 'website' | 'facebook' | 'shopee' | 'tiktok' | 'offline' | 'instagram' | 'zalo' | 'hotline' | 'other';
  type: 'preorder_0209' | 'standard_order' | 'manual_order';
  status: string;
  paymentMethod?: 'bank_transfer' | 'cod' | 'cash' | 'other';
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  bankReceiptImage?: string;
  paidAmount?: number;
  bankTransferRef?: string;
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
        images: data.images || [data.image],
        description: data.description || '',
        details: data.details || [],
        availableColors: data.availableColors,
        availableSizes: data.availableSizes,
        stock: rawStock,
        inStock: computedInStock,
        isEvent0209: !!data.isEvent0209,
        isEvent2010: !!data.isEvent2010,
        isBestSeller: !!data.isBestSeller,
        isNew: !!data.isNew,
        rating: data.rating || 5.0,
        reviewsCount: data.reviewsCount || 12
      } as Product);
      recordOperation('read');
    });
    return results;
  } catch (err) {
    console.error('Lỗi tải sản phẩm từ Firestore:', err);
    return [];
  }
};

export const saveProductToFirestore = async (prod: Product): Promise<void> => {
  try {
    const docRef = doc(db, 'products', prod.id);
    const stockVal = typeof prod.stock === 'number' ? prod.stock : 15;
    const inStockVal = prod.inStock !== false && stockVal > 0;
    const payload = cleanFirestoreData({
      ...prod,
      stock: stockVal,
      inStock: inStockVal,
      updatedAt: new Date().toISOString()
    });
    const prodSize = JSON.stringify(payload).length;
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
        bankTransferRef: data.bankTransferRef || ''
      });
      recordOperation('read');
    });
    return results;
  } catch (err) {
    console.error('Lỗi tải đơn hàng từ Firestore:', err);
    return [];
  }
};

export const saveOrderToFirestore = async (order: StoredOrder): Promise<void> => {
  try {
    const orderId = order.id || `ord-${Date.now()}`;
    const docRef = doc(db, 'orders', orderId);
    const payload = cleanFirestoreData({
      ...order,
      id: orderId,
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

export const updateOrderStatusInFirestore = async (orderId: string, status: string): Promise<void> => {
  try {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, cleanFirestoreData({
      status,
      updatedAt: new Date().toISOString()
    }));
    recordOperation('write', 100);
  } catch (err) {
    console.error('Lỗi cập nhật trạng thái đơn hàng Firestore:', err);
    throw err;
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
        highlightColor: data.highlightColor,
        badge: data.badge,
        isEvent: !!data.isEvent
      });
      recordOperation('read');
    });
    return results;
  } catch (err) {
    console.error('Lỗi tải danh mục từ Firestore:', err);
    return [];
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
        themeStyle: data.themeStyle || 'light'
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

export const saveCollectionToFirestore = async (collectionItem: CollectionInfo): Promise<void> => {
  try {
    const docRef = doc(db, 'collections', collectionItem.id);
    const payload = cleanFirestoreData({
      ...collectionItem,
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

export const saveSiteContentToFirestore = async (config: SiteContentConfig): Promise<void> => {
  try {
    const docRef = doc(db, 'site_content', 'main_config');
    const payload = cleanFirestoreData({
      ...config,
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

// Ping / Connection Test
export const testFirebaseConnection = async (): Promise<boolean> => {
  try {
    recordOperation('read');
    const colRef = collection(db, 'products');
    await getDocs(colRef);
    return true;
  } catch (e) {
    console.warn('Firebase test connection:', e);
    return false;
  }
};
