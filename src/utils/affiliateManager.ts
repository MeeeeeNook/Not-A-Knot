import { AffiliateSystemConfig, SellerUser, StoredOrder } from '../types';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, setDoc, query, where, limit } from 'firebase/firestore';

export const AFFILIATE_COOKIE_NAME = 'nak_affiliate_ref';
export const AFFILIATE_SETTINGS_DOC = 'affiliate_config';
export const DEFAULT_AFFILIATE_CONFIG: AffiliateSystemConfig = {
  cookieDurationDays: 30,
  defaultCommissionRate: 10
};

export interface StoredAffiliateCookie {
  code: string;
  clickedAt: string; // ISO string
  expiresAt: string; // ISO string
}

/**
 * Read the active affiliate referral from cookies.
 * Automatically checks for expiration.
 */
export function getActiveAffiliateReferral(): StoredAffiliateCookie | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp('(^| )' + AFFILIATE_COOKIE_NAME + '=([^;]+)'));
    if (!match || !match[2]) return null;

    const raw = decodeURIComponent(match[2]);
    const parsed: StoredAffiliateCookie = JSON.parse(raw);
    if (!parsed || !parsed.code || !parsed.expiresAt) return null;

    const expiresMs = new Date(parsed.expiresAt).getTime();
    if (isNaN(expiresMs) || Date.now() > expiresMs) {
      // Expired: clear cookie
      clearAffiliateCookie();
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Set or update the affiliate referral cookie with configured duration (Last-Click Priority).
 */
export function setAffiliateReferral(code: string, durationDays: number = 30): void {
  if (typeof document === 'undefined') return;
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) return;

  const validDays = Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 30;
  const now = new Date();
  const expiresDate = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);

  const cookiePayload: StoredAffiliateCookie = {
    code: cleanCode,
    clickedAt: now.toISOString(),
    expiresAt: expiresDate.toISOString()
  };

  const serialized = encodeURIComponent(JSON.stringify(cookiePayload));
  const maxAgeSec = Math.floor(validDays * 24 * 60 * 60);

  // Set with SameSite=Lax and max-age so it persists across refreshes and pages
  document.cookie = `${AFFILIATE_COOKIE_NAME}=${serialized}; path=/; max-age=${maxAgeSec}; SameSite=Lax`;
}

/**
 * Clear the affiliate referral cookie (e.g. after first order placed or on expiry).
 */
export function clearAffiliateCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AFFILIATE_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
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

  try {
    const colRef = collection(db, 'sellers');
    // First query by affiliateCode
    const q = query(colRef, where('affiliateCode', '==', clean), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data() as SellerUser;
      return { id: snap.docs[0].id, ...data };
    }

    // Fallback: search in sellers collection
    const allSnap = await getDocs(colRef);
    for (const d of allSnap.docs) {
      const data = d.data() as SellerUser;
      if (
        (data.affiliateCode && data.affiliateCode.toUpperCase().trim() === clean) ||
        (data.role === 'affiliate' && data.username && data.username.toUpperCase().trim() === clean)
      ) {
        return { id: d.id, ...data };
      }
    }
  } catch (err) {
    console.warn('[Affiliate] Error looking up affiliate by code:', err);
  }

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

