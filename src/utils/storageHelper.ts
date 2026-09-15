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

/**
 * Free up storage space by removing disposable or oversized cache items
 */
export function evictDisposableStorageSpace(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    for (const key of EVICTABLE_KEYS) {
      localStorage.removeItem(key);
    }

    // Inspect all keys to remove any rogue oversized blob > 300KB
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('nak_') && key !== 'nak_cart' && key !== 'nak_admin_session') {
        const val = localStorage.getItem(key);
        if (val && val.length > 300000) {
          console.warn(`[StorageHelper] Purging oversized storage key: ${key} (${Math.round(val.length / 1024)} KB)`);
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
      rating: 5,
      reviewsCount: 0,
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
    rating: product.rating || 5,
    reviewsCount: product.reviewsCount || 0,
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
            rating: 5,
            reviewsCount: 0,
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
