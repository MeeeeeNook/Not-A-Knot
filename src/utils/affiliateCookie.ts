export const AFFILIATE_COOKIE_NAME = 'nak_affiliate_ref';
const HISTORY_KEY = 'nak_affiliate_sessions_v1';
export interface StoredAffiliateCookie {
  code: string;
  clickedAt: string;
  expiresAt: string;
  maxOrders?: number;
  orderCount?: number;
  orderIds?: string[];
}
const validLimit = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 1;
const isLive = (session?: StoredAffiliateCookie | null): session is StoredAffiliateCookie => Boolean(session?.code && Number.isFinite(Date.parse(session.expiresAt)) && Date.parse(session.expiresAt) > Date.now());
function readCookie(): StoredAffiliateCookie | null {
  if (typeof document === 'undefined') return null;
  try {
    const raw = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${AFFILIATE_COOKIE_NAME}=`));
    return raw ? JSON.parse(decodeURIComponent(raw.slice(AFFILIATE_COOKIE_NAME.length + 1))) : null;
  } catch { return null; }
}
function readHistory(): Record<string, StoredAffiliateCookie> {
  const result: Record<string, StoredAffiliateCookie> = {};
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    if (saved && typeof saved === 'object') Object.entries(saved).forEach(([code, session]) => {
      if (isLive(session as StoredAffiliateCookie)) result[code] = session as StoredAffiliateCookie;
    });
  } catch {}
  const current = readCookie();
  if (isLive(current)) result[current.code] = current;
  return result;
}
function writeSession(session: StoredAffiliateCookie) {
  if (typeof document === 'undefined') return;
  const history = readHistory();
  history[session.code] = session;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  const remaining = Math.max(1, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000));
  document.cookie = `${AFFILIATE_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(session))}; path=/; max-age=${remaining}; SameSite=Lax`;
}
export function getActiveAffiliateReferral(): StoredAffiliateCookie | null {
  const session = readCookie();
  if (!isLive(session)) return null;
  const max = validLimit(session.maxOrders);
  return max > 0 && (session.orderCount || 0) >= max ? null : session;
}
// Each affiliate retains the original expiry and quota on this browser, even after
// switching to another link or exhausting its quota. A repeated click cannot reset it.
export function setAffiliateReferral(code: string, durationDays = 30, maxOrders = 1): void {
  if (typeof document === 'undefined') return;
  const clean = code.trim().toUpperCase();
  if (!clean) return;
  const existing = readHistory()[clean];
  const days = Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 30;
  const session = existing || { code: clean, clickedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + days * 86400000).toISOString(), orderCount: 0, orderIds: [] };
  session.maxOrders = validLimit(maxOrders);
  writeSession(session);
}
export function clearAffiliateCookie(): void {
  if (typeof document !== 'undefined') document.cookie = `${AFFILIATE_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
export function recordOrderOnAffiliateCookie(overrideMaxOrders?: number, orderId?: string): { shouldClear: boolean; orderCount: number } {
  const session = readCookie();
  if (!isLive(session)) return { shouldClear: true, orderCount: 0 };
  if (overrideMaxOrders !== undefined) session.maxOrders = validLimit(overrideMaxOrders);
  const ids = session.orderIds || [];
  if (!orderId || !ids.includes(orderId)) {
    session.orderCount = (session.orderCount || 0) + 1;
    if (orderId) session.orderIds = [...ids, orderId].slice(-50);
  }
  writeSession(session);
  const max = validLimit(session.maxOrders);
  // Retain the exhausted cookie/history until its original expiry; stop attribution.
  return { shouldClear: max > 0 && (session.orderCount || 0) >= max, orderCount: session.orderCount || 0 };
}
