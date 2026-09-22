import { CartItem, Product } from '../types';

/**
 * Non-critical cache keys that can be safely evicted if localStorage hits quota
 */
const EVICTABLE_KEYS = [
  'notaknot_backups_cache',
  'notaknot_backup_schedule_cache',
  'nak_internal_analytics_v1',
  'nak_internal_analytics_v2',
  'nak_analytics',
  'nak_contact_messages',
  'nak_products', // Legacy duplicate of nak_custom_products
];

const PROTECTED_KEYS = new Set([
  'nak_custom_products',
  'nak_categories',
  'nak_collections',
  'nak_site_content',
  'nak_cart',
  'nak_admin_session',
  'nak_orders'
]);

/**
 * Free up storage space by removing disposable or oversized cache items
 */
export function evictDisposableStorageSpace(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    for (const key of EVICTABLE_KEYS) {
      localStorage.removeItem(key);
    }

    // Inspect non-protected keys to remove any disposable bloated cache > 300KB
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !PROTECTED_KEYS.has(key) && key.startsWith('nak_')) {
        const val = localStorage.getItem(key);
        if (val && val.length > 300000) {
          console.warn(`[StorageHelper] Purging oversized non-essential storage key: ${key} (${Math.round(val.length / 1024)} KB)`);
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {
    // Ignore storage access errors in private/sandboxed mode
  }
}

// Auto-run cleanup on bundle execution
if (typeof window !== 'undefined') {
  try {
    evictDisposableStorageSpace();
  } catch {}
}

/**
 * Safely store an item in localStorage with automatic quota recovery & fallback
 */
export function safeStorageSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (window.localStorage) {
      localStorage.setItem(key, value);
      return true;
    }
  } catch (err: any) {
    // Quota reached or storage error
    console.warn(`[StorageHelper] Quota notice on "${key}". Cleaning up disposable caches and retrying...`);
    evictDisposableStorageSpace();

    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      // Fallback to in-memory/sessionStorage
      try {
        if (window.sessionStorage) {
          sessionStorage.setItem(key, value);
          return true;
        }
      } catch {}
    }
  }

  return false;
}

/**
 * Safely read an item from localStorage (or fallback sessionStorage)
 */
export function safeStorageGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.localStorage) {
      const localVal = localStorage.getItem(key);
      if (localVal !== null) return localVal;
    }
  } catch {}

  try {
    if (window.sessionStorage) {
      return sessionStorage.getItem(key);
    }
  } catch {}

  return null;
}

/**
 * Safely sanitize image URL to avoid stuffing multi-megabyte base64 strings into cart storage
 */
function sanitizeImageUrl(url?: string): string {
  if (!url) return '';
  // If image is a massive raw base64 string (> 1500 chars), return placeholder or fallback
  if (url.startsWith('data:image/') && url.length > 2000) {
    return '/assets/bracelet.jpg';
  }
  return url;
}

/**
 * Strips huge blobs/arrays from Product objects before saving cart to avoid exceeding quota
 */
function sanitizeProductForCart(product: Product): Product {
  if (!product) {
    return {
      id: 'unknown',
      name: 'Sản phẩm',
      category: 'general',
      price: 0,
      image: '/assets/bracelet.jpg',
      description: '',
      details: [],
      inStock: true,
    };
  }

  // Only keep fields needed for cart display & checkout
  return {
    id: product.id,
    name: product.name,
    category: product.category || 'general',
    price: product.price || 0,
    originalPrice: product.originalPrice,
    image: sanitizeImageUrl(product.image),
    description: (product.description || '').slice(0, 100),
    details: [],
    rating: product.rating,
    reviewsCount: product.reviewsCount,
    inStock: product.inStock !== false,
    stock: product.stock,
    isEvent0209: product.isEvent0209,
    isEvent2010: product.isEvent2010,
    enableColorSelection: product.enableColorSelection,
    enableCharmSelection: product.enableCharmSelection,
    enableOmamoriSelection: product.enableOmamoriSelection,
    enableKhoenSelection: product.enableKhoenSelection,
    khoenTitle: product.khoenTitle,
    khoenOptions: product.khoenOptions,
    khoenSelectionRequired: product.khoenSelectionRequired,
  };
}

/**
 * Serializes cart items into a lightweight JSON string (< 3KB instead of multiple MBs)
 */
export function serializeCartItems(cartItems: CartItem[]): string {
  if (!Array.isArray(cartItems)) return '[]';

  const lightweightItems = cartItems.map((item) => ({
    productId: item.product?.id,
    product: sanitizeProductForCart(item.product),
    quantity: Math.max(1, Number(item.quantity) || 1),
    selectedColor: item.selectedColor,
    selectedColorImage: sanitizeImageUrl(item.selectedColorImage),
    selectedCharm: item.selectedCharm,
    selectedCharmImage: sanitizeImageUrl(item.selectedCharmImage),
    selectedCharmPrice: item.selectedCharmPrice,
    selectedCharms: item.selectedCharms?.map((c) => ({
      name: c.name,
      image: sanitizeImageUrl(c.image),
      priceDelta: c.priceDelta,
    })),
    selectedOmamoris: item.selectedOmamoris?.map((o) => ({
      name: o.name,
      image: sanitizeImageUrl(o.image),
      priceDelta: o.priceDelta,
    })),
    selectedOmamoriPrice: item.selectedOmamoriPrice,
    selectedKhoen: item.selectedKhoen,
    selectedKhoenImage: sanitizeImageUrl(item.selectedKhoenImage),
    selectedKhoenPrice: item.selectedKhoenPrice,
    selectedSize: item.selectedSize,
    customNote: item.customNote,
  }));

  return JSON.stringify(lightweightItems);
}

/**
 * Deserializes cart items and matches them with active product data
 */
export function deserializeCartItems(
  rawJson: string | null,
  availableProducts: Product[] = []
): CartItem[] {
  if (!rawJson) return [];

  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && (item.product || item.productId))
      .map((item) => {
        const prodId = item.productId || item.product?.id;
        const matchedProduct = availableProducts.find((p) => p.id === prodId);

        return {
          product: matchedProduct || item.product || {
            id: prodId || 'unknown',
            name: 'Sản phẩm',
            category: 'general',
            price: Number(item.price) || 0,
            image: '/assets/bracelet.jpg',
            description: '',
            details: [],
            inStock: true,
          },
          quantity: Math.max(1, Number(item.quantity) || 1),
          selectedColor: item.selectedColor,
          selectedColorImage: item.selectedColorImage,
          selectedCharm: item.selectedCharm,
          selectedCharmImage: item.selectedCharmImage,
          selectedCharmPrice: item.selectedCharmPrice,
          selectedCharms: item.selectedCharms,
          selectedOmamoris: item.selectedOmamoris,
          selectedOmamoriPrice: item.selectedOmamoriPrice,
          selectedKhoen: item.selectedKhoen,
          selectedKhoenImage: item.selectedKhoenImage,
          selectedKhoenPrice: item.selectedKhoenPrice,
          selectedSize: item.selectedSize,
          customNote: item.customNote,
        };
      });
  } catch (e) {
    return [];
  }
}

// ====================================================
// INDEXEDDB ENGINE FOR UNLIMITED & ZERO-COMPRESSION STORAGE
// ====================================================

const IDB_NAME = 'notaknot_main_idb';
const IDB_VERSION = 1;
const IDB_PRODUCTS_STORE = 'products';
const IDB_ASSETS_STORE = 'assets';

let idbInstancePromise: Promise<IDBDatabase | null> | null = null;

function getIDBInstance(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (!idbInstancePromise) {
    idbInstancePromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_PRODUCTS_STORE)) {
            db.createObjectStore(IDB_PRODUCTS_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(IDB_ASSETS_STORE)) {
            db.createObjectStore(IDB_ASSETS_STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('[IDB] Failed to open IndexedDB:', req.error);
          resolve(null);
        };
      } catch (e) {
        console.warn('[IDB] Exception opening IndexedDB:', e);
        resolve(null);
      }
    });
  }
  return idbInstancePromise;
}

/**
 * Save full product (with all uncompressed images) to IndexedDB
 */
export async function saveProductToIDB(product: Product): Promise<void> {
  const db = await getIDBInstance();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_PRODUCTS_STORE, 'readwrite');
      const store = tx.objectStore(IDB_PRODUCTS_STORE);
      store.put(product);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Save all products to IndexedDB
 */
export async function saveProductsToIDB(products: Product[]): Promise<void> {
  const db = await getIDBInstance();
  if (!db || !Array.isArray(products)) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_PRODUCTS_STORE, 'readwrite');
      const store = tx.objectStore(IDB_PRODUCTS_STORE);
      store.clear();
      for (const p of products) {
        store.put(p);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Get all products from IndexedDB
 */
export async function getProductsFromIDB(): Promise<Product[] | null> {
  const db = await getIDBInstance();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_PRODUCTS_STORE, 'readonly');
      const store = tx.objectStore(IDB_PRODUCTS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result;
        if (Array.isArray(results) && results.length > 0) {
          resolve(results as Product[]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save an individual full-resolution image/asset to IndexedDB
 */
export async function saveAssetToIDB(assetId: string, data: string): Promise<void> {
  const db = await getIDBInstance();
  if (!db || !assetId || !data) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_ASSETS_STORE, 'readwrite');
      const store = tx.objectStore(IDB_ASSETS_STORE);
      store.put({ id: assetId, data, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieve an asset from IndexedDB
 */
export async function getAssetFromIDB(assetId: string): Promise<string | null> {
  const db = await getIDBInstance();
  if (!db || !assetId) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_ASSETS_STORE, 'readonly');
      const store = tx.objectStore(IDB_ASSETS_STORE);
      const req = store.get(assetId);
      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve(req.result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Batch retrieve multiple assets from IndexedDB
 */
export async function getMultipleAssetsFromIDB(assetIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!assetIds || assetIds.length === 0) return map;
  const db = await getIDBInstance();
  if (!db) return map;

  await Promise.all(
    assetIds.map(async (id) => {
      const data = await getAssetFromIDB(id);
      if (data) {
        map.set(id, data);
      }
    })
  );
  return map;
}

/**
 * Delete a product from IndexedDB
 */
export async function deleteProductFromIDB(productId: string): Promise<void> {
  const db = await getIDBInstance();
  if (!db || !productId) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_PRODUCTS_STORE, 'readwrite');
      const store = tx.objectStore(IDB_PRODUCTS_STORE);
      store.delete(productId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

