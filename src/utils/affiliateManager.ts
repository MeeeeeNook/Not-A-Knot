import { AffiliateSystemConfig, SellerUser, StoredOrder } from '../types';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, getDoc, setDoc, query, where, limit } from 'firebase/firestore';

export { AFFILIATE_COOKIE_NAME, getActiveAffiliateReferral, setAffiliateReferral, clearAffiliateCookie, recordOrderOnAffiliateCookie } from './affiliateCookie';
export type { StoredAffiliateCookie } from './affiliateCookie';
export const AFFILIATE_SETTINGS_DOC = 'affiliate_config';
export const DEFAULT_AFFILIATE_CONFIG: AffiliateSystemConfig = { cookieDurationDays: 30, defaultCommissionRate: 10 };

export interface AffiliateClickRecord {
  id?: string;
  code: string;
  clickedAt: string;
  timestamp: number;
  date: string;
}

/**
 * Record an affiliate referral click in Firestore and local storage.
 */
export async function recordAffiliateClick(code: string): Promise<void> {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) return;

  const now = new Date();
  const record: AffiliateClickRecord = {
    code: cleanCode,
    clickedAt: now.toISOString(),
    timestamp: now.getTime(),
    date: now.toISOString().slice(0, 10)
  };

  // Cache locally
  try {
    const key = `nak_aff_clicks_${cleanCode}`;
    const raw = localStorage.getItem(key);
    const existing: AffiliateClickRecord[] = raw ? JSON.parse(raw) : [];
    existing.unshift(record);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 500)));
  } catch {}

  // Save to Firestore
  try {
    const clickId = `clk_${cleanCode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const clickDocRef = doc(db, 'affiliate_clicks', clickId);
    await setDoc(clickDocRef, { ...record, id: clickId });
  } catch (err) {
    // silently catch network/offline error
  }
}

/**
 * Fetch click records for an affiliate code.
 */
export async function fetchAffiliateClicks(code: string): Promise<AffiliateClickRecord[]> {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) return [];

  let firestoreClicks: AffiliateClickRecord[] = [];
  try {
    const colRef = collection(db, 'affiliate_clicks');
    const q = query(colRef, where('code', '==', cleanCode), limit(500));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      firestoreClicks.push({ id: d.id, ...d.data() } as AffiliateClickRecord);
    });
  } catch (err) {
    // fallback
  }

  // Merge with local clicks
  let localClicks: AffiliateClickRecord[] = [];
  try {
    const raw = localStorage.getItem(`nak_aff_clicks_${cleanCode}`);
    if (raw) localClicks = JSON.parse(raw);
  } catch {}

  const map = new Map<string, AffiliateClickRecord>();
  firestoreClicks.forEach((c) => map.set(c.id || `${c.timestamp}`, c));
  localClicks.forEach((c) => {
    const k = c.id || `${c.timestamp}`;
    if (!map.has(k)) map.set(k, c);
  });

  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Synchronously or asynchronously fetch system affiliate configuration.
 */
let cachedConfig: AffiliateSystemConfig | null = null;
let cachedConfigExpiresAt = 0;

export async function fetchAffiliateSystemConfig(): Promise<AffiliateSystemConfig> {
  if (cachedConfig && Date.now() < cachedConfigExpiresAt) {
    return cachedConfig;
  }

  // 1. Try LocalStorage for instant UI response
  if (typeof localStorage !== 'undefined') {
    try {
      const local = localStorage.getItem('nak_affiliate_system_config');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && typeof parsed.cookieDurationDays === 'number') {
          cachedConfig = parsed;
        }
      }
    } catch {}
  }

  // 2. Fetch from Firestore /system_settings/affiliate_config
  try {
    const configDocRef = doc(db, 'system_settings', AFFILIATE_SETTINGS_DOC);
    const snap = await getDoc(configDocRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<AffiliateSystemConfig>;
      const merged: AffiliateSystemConfig = {
        cookieDurationDays: Number(data.cookieDurationDays) > 0 ? Number(data.cookieDurationDays) : DEFAULT_AFFILIATE_CONFIG.cookieDurationDays,
        defaultCommissionRate: Number(data.defaultCommissionRate) >= 0 ? Number(data.defaultCommissionRate) : DEFAULT_AFFILIATE_CONFIG.defaultCommissionRate,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy
      };
      cachedConfig = merged;
      cachedConfigExpiresAt = Date.now() + 60000; // 1 min in-memory TTL
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('nak_affiliate_system_config', JSON.stringify(merged));
      }
      return merged;
    }
  } catch (err) {
    console.warn('[Affiliate] Could not fetch system config from Firestore:', err);
  }

  return cachedConfig || DEFAULT_AFFILIATE_CONFIG;
}

/**
 * Save affiliate system configuration (Admin only).
 */
export async function saveAffiliateSystemConfig(config: AffiliateSystemConfig): Promise<void> {
  const merged: AffiliateSystemConfig = {
    cookieDurationDays: Math.max(1, Number(config.cookieDurationDays) || 30),
    defaultCommissionRate: Math.max(0, Math.min(100, Number(config.defaultCommissionRate) || 10)),
    updatedAt: new Date().toISOString(),
    updatedBy: config.updatedBy || 'admin'
  };

  cachedConfig = merged;
  cachedConfigExpiresAt = Date.now() + 60000;

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('nak_affiliate_system_config', JSON.stringify(merged));
  }

  try {
    const configDocRef = doc(db, 'system_settings', AFFILIATE_SETTINGS_DOC);
    await setDoc(configDocRef, merged, { merge: true });
  } catch (err) {
    console.warn('[Affiliate] Error saving config to Firestore:', err);
  }
}

/**
 * Fetch an active affiliate profile by code (e.g. "AN001").
 */
export async function fetchAffiliateByCode(code: string): Promise<SellerUser | null> {
  const clean = (code || '').trim().toUpperCase();
  if (!clean) return null;

  // Public shoppers cannot read private seller documents. The server returns only
  // referral/commission settings, keeping Google email and payment data private.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(`/api/affiliate?code=${encodeURIComponent(clean)}`, { signal: controller.signal });
    if (response.ok) {
      const result = await response.json();
      return result.affiliate || null;
    }
  } catch {} finally { clearTimeout(timer); }
  if (!auth.currentUser) return null;
  // Signed-in admin fallback for local/offline previews; never enumerate accounts.
  try {
    const colRef = collection(db, 'sellers');
    for (const [field, value] of [['affiliateCode', clean], ['username', clean.toLowerCase()]]) {
      const snap = await getDocs(query(colRef, where(field, '==', value), limit(1)));
      if (!snap.empty) {
        const data = snap.docs[0].data() as SellerUser;
        if (data.isActive !== false && (data.role === 'affiliate' || data.affiliateCode)) return { ...data, id: snap.docs[0].id };
      }
    }
  } catch {}

  return null;
}

/**
 * Fetch all affiliates (sellers where role === 'affiliate' or has affiliateCode).
 */
export async function fetchAllAffiliates(): Promise<SellerUser[]> {
  try {
    const colRef = collection(db, 'sellers');
    const snap = await getDocs(colRef);
    const list: SellerUser[] = [];
    snap.forEach((d) => {
      const s = { id: d.id, ...d.data() } as SellerUser;
      if (s.role === 'affiliate' || Boolean(s.affiliateCode)) {
        list.push(s);
      }
    });
    return list;
  } catch (err) {
    console.warn('[Affiliate] Error fetching affiliates list:', err);
    return [];
  }
}

/**
 * Helper to compute an affiliate's statistics from active (non-deleted) orders.
 */
export interface AffiliateStats {
  totalOrders: number;
  totalMerchandiseValue: number;
  totalCommission: number;
  attributedOrders: StoredOrder[];
}

export function calculateAffiliateStats(affiliate: SellerUser, orders: StoredOrder[]): AffiliateStats {
  const affCode = (affiliate.affiliateCode || affiliate.username || '').toUpperCase().trim();
  const affId = affiliate.id;

  // Filter for valid attributed orders (EXCLUDE DELETED ORDERS)
  const matchingOrders = (orders || []).filter((ord) => {
    if (ord.isDeleted === true || ord.status === 'cancelled' || ord.status === 'Đã hủy') {
      return false;
    }
    const orderAffCode = (ord.affiliateCode || '').toUpperCase().trim();
    const orderAffId = ord.affiliateId;
    return (affCode && orderAffCode === affCode) || (affId && orderAffId === affId);
  });

  let totalMerchandiseValue = 0;
  let totalCommission = 0;

  matchingOrders.forEach((ord) => {
    // Merchandise value = subtotal - discount (exclude shipping)
    const merchVal = typeof ord.affiliateMerchandiseValue === 'number'
      ? ord.affiliateMerchandiseValue
      : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));

    const commission = typeof ord.affiliateCommissionAmount === 'number'
      ? ord.affiliateCommissionAmount
      : Math.round((merchVal * (ord.affiliateCommissionRate || affiliate.commissionRate || 10)) / 100);

    totalMerchandiseValue += merchVal;
    totalCommission += commission;
  });

  return {
    totalOrders: matchingOrders.length,
    totalMerchandiseValue,
    totalCommission,
    attributedOrders: matchingOrders.sort((a, b) => {
      const tA = new Date(a.createdAt || a.date || 0).getTime();
      const tB = new Date(b.createdAt || b.date || 0).getTime();
      return tB - tA;
    })
  };
}

export interface DetailedCommissionResult {
  merchandiseValue: number;
  commissionAmount: number;
  effectiveRate: number;
  commissionModel: 'standard' | 'by_product' | 'tiered';
  tierApplied?: { minAmount: number; maxAmount?: number; rate: number };
  itemsBreakdown?: Array<{
    productId: string;
    productName?: string;
    rate: number;
    amount: number;
    merchandiseValue: number;
  }>;
}

/**
 * Calculate detailed affiliate commission with support for:
 * - Product-specific commission overrides (by_product)
 * - Order merchandise revenue tiers (tiered)
 * - Standard fixed commission rate (standard)
 */
export function calculateDetailedAffiliateCommission(
  affiliate: SellerUser,
  items: Array<{ productId: string; name?: string; productName?: string; price: number; quantity: number }> = [],
  subtotal: number = 0,
  discountAmount: number = 0,
  fallbackRate: number = 10
): DetailedCommissionResult {
  const merchandiseValue = Math.max(0, subtotal - discountAmount);
  const baseRate = typeof affiliate.commissionRate === 'number' && affiliate.commissionRate >= 0
    ? affiliate.commissionRate
    : fallbackRate;

  // 1. Model: By Product (Từng sản phẩm có % hoa hồng riêng)
  if (
    affiliate.commissionModel === 'by_product' &&
    Array.isArray(affiliate.productCommissions) &&
    affiliate.productCommissions.length > 0 &&
    items.length > 0
  ) {
    const rawSubtotal = subtotal > 0 ? subtotal : items.reduce((sum, it) => sum + ((it.price || 0) * (it.quantity || 1)), 0);
    const discountRatio = rawSubtotal > 0 ? Math.min(1, discountAmount / rawSubtotal) : 0;

    let totalCommission = 0;
    const itemsBreakdown: Array<{
      productId: string;
      productName?: string;
      rate: number;
      amount: number;
      merchandiseValue: number;
    }> = [];

    items.forEach((it) => {
      const itemRawTotal = (it.price || 0) * (it.quantity || 1);
      const itemMerchandise = Math.max(0, Math.round(itemRawTotal * (1 - discountRatio)));

      const override = affiliate.productCommissions?.find((p) => p.productId === it.productId);
      const rate = override && typeof override.rate === 'number' && override.rate >= 0
        ? override.rate
        : baseRate;

      const comm = Math.round((itemMerchandise * rate) / 100);
      totalCommission += comm;

      itemsBreakdown.push({
        productId: it.productId,
        productName: it.productName || it.name,
        rate,
        amount: comm,
        merchandiseValue: itemMerchandise
      });
    });

    const effectiveRate = merchandiseValue > 0
      ? Math.round((totalCommission / merchandiseValue) * 1000) / 10
      : baseRate;

    return {
      merchandiseValue,
      commissionAmount: totalCommission,
      effectiveRate,
      commissionModel: 'by_product',
      itemsBreakdown
    };
  }

  // 2. Model: Tiered (Theo từng mức giá trị đơn hàng / doanh thu)
  if (
    affiliate.commissionModel === 'tiered' &&
    Array.isArray(affiliate.tieredCommissions) &&
    affiliate.tieredCommissions.length > 0
  ) {
    // Sort tiers by minAmount ascending
    const sortedTiers = [...affiliate.tieredCommissions].sort((a, b) => a.minAmount - b.minAmount);
    let matchedTier = sortedTiers[0];

    for (const t of sortedTiers) {
      const min = Number(t.minAmount) || 0;
      const max = Number(t.maxAmount) || 0;
      if (merchandiseValue >= min) {
        if (max === 0 || merchandiseValue < max) {
          matchedTier = t;
          break;
        } else if (max > 0 && merchandiseValue >= max) {
          matchedTier = t;
        }
      }
    }

    const rate = matchedTier && typeof matchedTier.rate === 'number' && matchedTier.rate >= 0
      ? matchedTier.rate
      : baseRate;

    const commissionAmount = Math.round((merchandiseValue * rate) / 100);

    return {
      merchandiseValue,
      commissionAmount,
      effectiveRate: rate,
      commissionModel: 'tiered',
      tierApplied: matchedTier
    };
  }

  // 3. Standard Model (Cố định cơ bản)
  const rate = baseRate;
  const commissionAmount = Math.round((merchandiseValue * rate) / 100);

  return {
    merchandiseValue,
    commissionAmount,
    effectiveRate: rate,
    commissionModel: 'standard'
  };
}

/**
 * Calculate affiliate commission for a new order.
 * Merchandise Value = subtotal - discounts (excludes shipping).
 */
export function calculateOrderAffiliateCommission(
  subtotal: number,
  discountAmount: number = 0,
  commissionRate: number = 10
): { merchandiseValue: number; commissionAmount: number } {
  const merchandiseValue = Math.max(0, subtotal - discountAmount);
  const rate = Math.max(0, Math.min(100, Number(commissionRate) || 0));
  const commissionAmount = Math.round((merchandiseValue * rate) / 100);
  return { merchandiseValue, commissionAmount };
}

/**
 * Build canonical referral URL for an affiliate.
 * Example: https://notaknot.id.vn/?ref=AN001
 */
export function getAffiliateReferralUrl(code: string, fallbackDomain = 'https://notaknot.id.vn'): string {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) return fallbackDomain;

  let base = fallbackDomain;
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    base = window.location.origin;
  }
  return `${base}/?ref=${cleanCode}`;
}

/**
 * Generate a unique affiliate code suggestion (e.g. "AN001", "HA888")
 */
export function generateAffiliateCode(name: string = '', existingAffiliates: SellerUser[] = []): string {
  const existingCodes = new Set(
    existingAffiliates
      .map((a) => (a.affiliateCode || a.username || '').toUpperCase().trim())
      .filter(Boolean)
  );

  // Clean initials or letters from name
  const ascii = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  const prefix = (ascii.slice(0, 3) || 'NAK').padEnd(2, 'K');

  for (let i = 1; i <= 999; i++) {
    const candidate = `${prefix}${String(i).padStart(3, '0')}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  return `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
}

