import { Product } from '../types';

export const GA_MEASUREMENT_ID = 'G-MWTDSVH9ER';
export const GA_DASHBOARD_URL = 'https://analytics.google.com/analytics/web/#/';

// ========================================================
// 1. GOOGLE ANALYTICS 4 (GA4) INTEGRATION HELPERS
// ========================================================

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Send a custom event to Google Analytics 4
 */
export function sendGA4Event(eventName: string, params: Record<string, any> = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, {
        send_to: GA_MEASUREMENT_ID,
        ...params,
      });
    }
  } catch (err) {
    console.warn('[GA4] Event dispatch error:', err);
  }
}

/**
 * Track page view across hash navigation (#home, #products, #cart, #collection/..., etc.)
 * Strictly EXCLUDES admin panel views.
 */
export function trackGA4PageView(pagePath: string, pageTitle?: string) {
  const normalizedPath = pagePath.startsWith('#') ? pagePath : `#${pagePath}`;
  
  // NEVER track admin panel page views
  if (normalizedPath.toLowerCase().includes('admin')) {
    return;
  }

  const fullUrl = window.location.origin + window.location.pathname + normalizedPath;
  const title = pageTitle || document.title || 'NOT A KNOT';

  sendGA4Event('page_view', {
    page_path: normalizedPath,
    page_location: fullUrl,
    page_title: title,
  });

  // Log to internal analytics tracker
  recordInternalPageView(normalizedPath, title);
}

/**
 * Track E-commerce: view_item
 */
export function trackGA4ViewItem(product: Product) {
  sendGA4Event('view_item', {
    currency: 'VND',
    value: product.price,
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        price: product.price,
        item_category: product.category,
        item_brand: 'NOT A KNOT',
      },
    ],
  });

  // Record internally
  recordInternalProductView(product);
}

/**
 * Track E-commerce: add_to_cart
 */
export function trackGA4AddToCart(
  product: Product,
  quantity: number = 1,
  selectedColor?: string,
  selectedSize?: string
) {
  sendGA4Event('add_to_cart', {
    currency: 'VND',
    value: product.price * quantity,
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        price: product.price,
        quantity,
        item_category: product.category,
        item_variant: [selectedColor, selectedSize].filter(Boolean).join(' / ') || undefined,
        item_brand: 'NOT A KNOT',
      },
    ],
  });

  // Record internally
  recordInternalAddToCart(product, quantity, selectedColor, selectedSize);
}

/**
 * Track E-commerce: begin_checkout
 */
export function trackGA4BeginCheckout(
  itemsOrTotal: any,
  totalOrItems?: any
) {
  // Support either (items, totalValue) or (totalValue, items)
  let rawItems: any[] = [];
  let totalValue = 0;

  if (Array.isArray(itemsOrTotal)) {
    rawItems = itemsOrTotal;
    totalValue = typeof totalOrItems === 'number' ? totalOrItems : 0;
  } else if (Array.isArray(totalOrItems)) {
    rawItems = totalOrItems;
    totalValue = typeof itemsOrTotal === 'number' ? itemsOrTotal : 0;
  } else if (typeof itemsOrTotal === 'number') {
    totalValue = itemsOrTotal;
  }

  const safeItems = Array.isArray(rawItems) ? rawItems : [];

  sendGA4Event('begin_checkout', {
    currency: 'VND',
    value: totalValue,
    items: safeItems.map((i) => {
      const prod = i?.product || i;
      return {
        item_id: prod?.id || prod?.productId || 'sp',
        item_name: prod?.name || prod?.productName || 'Sản phẩm NOT A KNOT',
        price: prod?.price ?? (typeof i?.price === 'number' ? i.price : 0),
        quantity: i?.quantity || 1,
        item_category: prod?.category || 'Knot',
      };
    }),
  });

  recordInternalCheckoutStart(totalValue, safeItems.length);
}

/**
 * Track E-commerce: purchase
 */
export function trackGA4Purchase(
  orderId: string,
  totalValue: number,
  items: any,
  paymentMethod?: string
) {
  const safeItems: any[] = Array.isArray(items) ? items : items ? [items] : [];

  sendGA4Event('purchase', {
    transaction_id: orderId,
    value: totalValue,
    currency: 'VND',
    payment_type: paymentMethod || 'COD',
    items: safeItems.map((i) => {
      const prod = i?.product || i;
      return {
        item_id: prod?.id || prod?.productId || orderId,
        item_name: prod?.name || prod?.productName || 'Sản phẩm NOT A KNOT',
        price: prod?.price ?? (typeof i?.price === 'number' ? i.price : totalValue),
        quantity: i?.quantity || 1,
      };
    }),
  });

  recordInternalPurchase(orderId, totalValue, safeItems.length);
}

/**
 * Track user engagement and session duration
 */
export function trackGA4Engagement(engagementTimeMsec: number) {
  sendGA4Event('user_engagement', {
    engagement_time_msec: engagementTimeMsec,
  });
}

// ========================================================
// 2. INTERNAL REAL-TIME ANALYTICS DATA MODEL & STORAGE
// ========================================================

export interface LiveEventLog {
  id: string;
  type: 'page_view' | 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase' | 'test_ping';
  title: string;
  detail?: string;
  timestamp: number;
}

export interface InternalPageViewEvent {
  path: string;
  title: string;
  timestamp: number;
}

export interface InternalAddToCartEvent {
  productId: string;
  productName: string;
  category: string;
  price: number;
  quantity: number;
  variant?: string;
  timestamp: number;
}

export interface InternalPurchaseEvent {
  orderId: string;
  totalValue: number;
  itemCount: number;
  timestamp: number;
}

export interface DailyActivityStat {
  date: string; // YYYY-MM-DD
  pageViews: number;
  productViews: number;
  addToCartCount: number;
  ordersCount: number;
  avgDurationSec: number;
}

export interface PageDurationStat {
  path: string;
  totalSeconds: number;
  viewCount: number;
  avgSeconds: number;
  lastUpdated: number;
}

export interface InternalAnalyticsState {
  totalPageViews: number;
  totalUniqueSessions: number;
  totalSessionDurationSeconds: number;
  pageViewEvents: InternalPageViewEvent[];
  productViewStats: Record<string, { count: number; name: string; category: string; price: number; lastViewed: number }>;
  addToCartStats: Record<string, { count: number; totalQuantity: number; name: string; lastAdded: number }>;
  recentAddToCartEvents: InternalAddToCartEvent[];
  recentPurchases: InternalPurchaseEvent[];
  liveEventsLog: LiveEventLog[];
  dailyStats: Record<string, DailyActivityStat>;
  pathViews: Record<string, number>;
  pathDurations: Record<string, { totalSeconds: number; viewCount: number }>;
  lastUpdated: number;
}

const STORAGE_KEY = 'nak_internal_analytics_v3';

// Initialize a real, clean baseline state without artificial fake 4000+ sine wave data
function getCleanInitialState(): InternalAnalyticsState {
  const now = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];

  const dailyStats: Record<string, DailyActivityStat> = {
    [todayStr]: {
      date: todayStr,
      pageViews: 1,
      productViews: 0,
      addToCartCount: 0,
      ordersCount: 0,
      avgDurationSec: 45,
    }
  };

  return {
    totalPageViews: 1,
    totalUniqueSessions: 1,
    totalSessionDurationSeconds: 45,
    pageViewEvents: [
      { path: '#home', title: 'Trang chủ | NOT A KNOT', timestamp: now }
    ],
    productViewStats: {},
    addToCartStats: {},
    recentAddToCartEvents: [],
    recentPurchases: [],
    liveEventsLog: [
      {
        id: `ev-${now}`,
        type: 'page_view',
        title: 'Truy cập Trang chủ',
        detail: 'Đã tải ứng dụng NOT A KNOT',
        timestamp: now,
      }
    ],
    dailyStats,
    pathViews: {
      '#home': 1
    },
    pathDurations: {
      '#home': { totalSeconds: 45, viewCount: 1 }
    },
    lastUpdated: now,
  };
}

/**
 * Load internal analytics from storage
 */
export function getInternalAnalytics(): InternalAnalyticsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalPageViews === 'number') {
        // Ensure liveEventsLog exists and remove any historical admin logs
        if (!Array.isArray(parsed.liveEventsLog)) {
          parsed.liveEventsLog = [];
        } else {
          parsed.liveEventsLog = parsed.liveEventsLog.filter((e: any) => !e?.title?.toLowerCase().includes('admin'));
        }

        // Clean pathViews from admin entries
        if (parsed.pathViews) {
          delete parsed.pathViews['#admin'];
          delete parsed.pathViews['/admin'];
          delete parsed.pathViews['admin'];
        }

        // Clean pageViewEvents
        if (Array.isArray(parsed.pageViewEvents)) {
          parsed.pageViewEvents = parsed.pageViewEvents.filter((ev: any) => !ev?.path?.toLowerCase().includes('admin'));
        }

        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading analytics store:', e);
  }

  const initial = getCleanInitialState();
  saveInternalAnalytics(initial);
  return initial;
}

/**
 * Save internal analytics to storage
 */
export function saveInternalAnalytics(state: InternalAnalyticsState) {
  try {
    state.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Error writing analytics store:', e);
  }
}

/**
 * Record internal page view
 */
function recordInternalPageView(path: string, title: string) {
  // Ignore admin paths
  if (path.toLowerCase().includes('admin')) {
    return;
  }

  const state = getInternalAnalytics();
  const now = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];

  state.totalPageViews += 1;

  // Path stats
  state.pathViews[path] = (state.pathViews[path] || 0) + 1;

  // Recent page views log (keep max 50)
  state.pageViewEvents.unshift({ path, title, timestamp: now });
  if (state.pageViewEvents.length > 50) {
    state.pageViewEvents.pop();
  }

  // Live event log
  state.liveEventsLog = state.liveEventsLog || [];
  state.liveEventsLog.unshift({
    id: `ev-${now}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'page_view',
    title: `Xem trang ${path}`,
    detail: title,
    timestamp: now,
  });
  if (state.liveEventsLog.length > 40) {
    state.liveEventsLog.pop();
  }

  // Daily stats
  if (!state.dailyStats[todayStr]) {
    state.dailyStats[todayStr] = {
      date: todayStr,
      pageViews: 1,
      productViews: 0,
      addToCartCount: 0,
      ordersCount: 0,
      avgDurationSec: 60,
    };
  } else {
    state.dailyStats[todayStr].pageViews += 1;
  }

  saveInternalAnalytics(state);
}

/**
 * Record internal product view
 */
function recordInternalProductView(product: Product) {
  const state = getInternalAnalytics();
  const now = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];

  if (!state.productViewStats[product.id]) {
    state.productViewStats[product.id] = {
      count: 1,
      name: product.name,
      category: product.category,
      price: product.price,
      lastViewed: now,
    };
  } else {
    state.productViewStats[product.id].count += 1;
    state.productViewStats[product.id].name = product.name;
    state.productViewStats[product.id].price = product.price;
    state.productViewStats[product.id].lastViewed = now;
  }

  // Live event log
  state.liveEventsLog = state.liveEventsLog || [];
  state.liveEventsLog.unshift({
    id: `ev-${now}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'view_item',
    title: `Xem sản phẩm`,
    detail: `${product.name} (${product.price.toLocaleString('vi-VN')}đ)`,
    timestamp: now,
  });
  if (state.liveEventsLog.length > 40) {
    state.liveEventsLog.pop();
  }

  if (!state.dailyStats[todayStr]) {
    state.dailyStats[todayStr] = {
      date: todayStr,
      pageViews: 1,
      productViews: 1,
      addToCartCount: 0,
      ordersCount: 0,
      avgDurationSec: 60,
    };
  } else {
    state.dailyStats[todayStr].productViews += 1;
  }

  saveInternalAnalytics(state);
}

/**
 * Record internal add to cart
 */
function recordInternalAddToCart(
  product: Product,
  quantity: number,
  selectedColor?: string,
  selectedSize?: string
) {
  const state = getInternalAnalytics();
  const now = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];

  const variantStr = [selectedColor, selectedSize].filter(Boolean).join(' / ') || undefined;

  // By product stats
  if (!state.addToCartStats[product.id]) {
    state.addToCartStats[product.id] = {
      count: 1,
      totalQuantity: quantity,
      name: product.name,
      lastAdded: now,
    };
  } else {
    state.addToCartStats[product.id].count += 1;
    state.addToCartStats[product.id].totalQuantity += quantity;
    state.addToCartStats[product.id].lastAdded = now;
  }

  // Recent add to cart log
  state.recentAddToCartEvents.unshift({
    productId: product.id,
    productName: product.name,
    category: product.category,
    price: product.price,
    quantity,
    variant: variantStr,
    timestamp: now,
  });
  if (state.recentAddToCartEvents.length > 50) {
    state.recentAddToCartEvents.pop();
  }

  // Live event log
  state.liveEventsLog = state.liveEventsLog || [];
  state.liveEventsLog.unshift({
    id: `ev-${now}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'add_to_cart',
    title: `Thêm vào giỏ hàng (+${quantity})`,
    detail: `${product.name} ${variantStr ? `[${variantStr}]` : ''}`,
    timestamp: now,
  });
  if (state.liveEventsLog.length > 40) {
    state.liveEventsLog.pop();
  }

  // Daily stats
  if (!state.dailyStats[todayStr]) {
    state.dailyStats[todayStr] = {
      date: todayStr,
      pageViews: 1,
      productViews: 0,
      addToCartCount: 1,
      ordersCount: 0,
      avgDurationSec: 60,
    };
  } else {
    state.dailyStats[todayStr].addToCartCount += 1;
  }

  saveInternalAnalytics(state);
}

/**
 * Record checkout start
 */
function recordInternalCheckoutStart(totalValue: number, itemCount: number) {
  const state = getInternalAnalytics();
  const now = Date.now();

  state.liveEventsLog = state.liveEventsLog || [];
  state.liveEventsLog.unshift({
    id: `ev-${now}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'begin_checkout',
    title: `Mở thanh toán (${itemCount} món)`,
    detail: `Tổng giá trị: ${totalValue.toLocaleString('vi-VN')}đ`,
    timestamp: now,
  });
  if (state.liveEventsLog.length > 40) {
    state.liveEventsLog.pop();
  }

  saveInternalAnalytics(state);
}

/**
 * Record purchase
 */
function recordInternalPurchase(orderId: string, totalValue: number, itemCount: number) {
  const state = getInternalAnalytics();
  const now = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];

  state.recentPurchases.unshift({
    orderId,
    totalValue,
    itemCount,
    timestamp: now,
  });

  if (state.recentPurchases.length > 50) {
    state.recentPurchases.pop();
  }

  // Live event log
  state.liveEventsLog = state.liveEventsLog || [];
  state.liveEventsLog.unshift({
    id: `ev-${now}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'purchase',
    title: `Đơn hàng mới #${orderId}`,
    detail: `${totalValue.toLocaleString('vi-VN')}đ (${itemCount} sản phẩm)`,
    timestamp: now,
  });
  if (state.liveEventsLog.length > 40) {
    state.liveEventsLog.pop();
  }

  if (state.dailyStats[todayStr]) {
    state.dailyStats[todayStr].ordersCount += 1;
  }

  saveInternalAnalytics(state);
}

/**
 * Record session heartbeat and duration
 */
export function recordSessionHeartbeat(secondsAdded: number = 10) {
  const state = getInternalAnalytics();
  state.totalSessionDurationSeconds += secondsAdded;
  saveInternalAnalytics(state);
}

/**
 * Trigger a real live test event for immediate admin testing
 */
export function triggerLiveTestPing(eventName: string = 'test_ping'): InternalAnalyticsState {
  const state = getInternalAnalytics();
  const now = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];

  state.totalPageViews += 1;
  if (!state.dailyStats[todayStr]) {
    state.dailyStats[todayStr] = {
      date: todayStr,
      pageViews: 1,
      productViews: 0,
      addToCartCount: 0,
      ordersCount: 0,
      avgDurationSec: 60,
    };
  } else {
    state.dailyStats[todayStr].pageViews += 1;
  }

  state.liveEventsLog = state.liveEventsLog || [];
  state.liveEventsLog.unshift({
    id: `ev-${now}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'test_ping',
    title: `GA4 Live Test Ping: ${eventName}`,
    detail: `Gửi trực tiếp lên GA4 (${GA_MEASUREMENT_ID}) lúc ${new Date(now).toLocaleTimeString('vi-VN')}`,
    timestamp: now,
  });
  if (state.liveEventsLog.length > 40) {
    state.liveEventsLog.pop();
  }

  saveInternalAnalytics(state);
  sendGA4Event(eventName, {
    event_category: 'admin_test',
    timestamp: now,
    measurement_id: GA_MEASUREMENT_ID,
  });

  return state;
}

/**
 * Record time spent on a specific page path (e.g. #home, #products, #collection/event_0209, etc.)
 */
export function recordPageTimeSpent(path: string, seconds: number) {
  if (!path || seconds <= 0) return;
  // Exclude admin pages from metrics
  if (path.toLowerCase().includes('admin')) return;

  const state = getInternalAnalytics();
  state.pathDurations = state.pathDurations || {};

  const current = state.pathDurations[path] || {
    totalSeconds: 0,
    viewCount: state.pathViews?.[path] || 1,
  };

  current.totalSeconds = (current.totalSeconds || 0) + seconds;
  current.viewCount = Math.max(current.viewCount || 1, state.pathViews?.[path] || 1);
  state.pathDurations[path] = current;

  // Also add to global session duration
  state.totalSessionDurationSeconds = (state.totalSessionDurationSeconds || 0) + seconds;

  saveInternalAnalytics(state);
}

/**
 * Reset analytics data to clean zeroes
 */
export function resetAnalyticsData(): InternalAnalyticsState {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('nak_internal_analytics_v2');
    localStorage.removeItem('nak_internal_analytics_v1');
    localStorage.removeItem('nak_analytics');
  } catch (e) {
    console.warn('Could not clear local keys:', e);
  }

  const fresh = getCleanInitialState();
  saveInternalAnalytics(fresh);
  return fresh;
}

