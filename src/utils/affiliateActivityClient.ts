import { auth, recordAffiliateActivityInFirestore } from '../firebase';
import type { AffiliateActivityAction, SellerUser } from '../types';
import { getClientDeviceInfo } from './ipGeo';

let ipCache: { expires: number; request: Promise<string> } | null = null;
const seenSignIns = new Set<string>();

export function recordRecentAffiliateLogin(seller: SellerUser | null): void {
  const user = auth.currentUser, signedInAt = user?.metadata.lastSignInTime;
  if (!user || !signedInAt || !seller?.id || seller.role !== 'affiliate') return;
  const age = Date.now() - Date.parse(signedInAt);
  // Opening an old saved session is a Hub visit, not a new Google sign-in.
  if (!Number.isFinite(age) || age < -5000 || age > 60_000) return;
  const key = `${user.uid}:${signedInAt}`;
  if (seenSignIns.has(key)) return;
  seenSignIns.add(key);
  try {
    if (sessionStorage.getItem(`nak_affiliate_last_login:${user.uid}`) === signedInAt) return;
    sessionStorage.setItem(`nak_affiliate_last_login:${user.uid}`, signedInAt);
  } catch { /* The in-memory guard still prevents duplicate mount effects. */ }
  void recordAffiliateActivity(seller, 'login');
}
async function getActivityIp(): Promise<string> {
  if (ipCache && ipCache.expires > Date.now()) return ipCache.request;
  const request = (async () => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch('/api/client-ip', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return '';
      const data = await response.json();
      return typeof data.ip === 'string' && /^[a-f\d:.]{3,45}$/i.test(data.ip) ? data.ip : '';
    } catch { return ''; }
    finally { clearTimeout(timer); }
  })();
  ipCache = { expires: Date.now() + 60_000, request };
  return request;
}

export async function recordAffiliateActivity(seller: SellerUser | null, action: AffiliateActivityAction, tab?: string): Promise<void> {
  if (!seller?.id || seller.role !== 'affiliate' || !auth.currentUser) return;
  const email = (seller.googleEmail || seller.email || '').trim().toLowerCase();
  if (seller.googleUid && seller.googleUid !== auth.currentUser.uid) return;
  if (email && email !== auth.currentUser.email?.trim().toLowerCase()) return;
  const timestamp = new Date().toISOString(), id = crypto.randomUUID();
  const device = getClientDeviceInfo();
  try {
    const ip = await getActivityIp();
    await recordAffiliateActivityInFirestore(seller.id, {
      id, action, timestamp, device: `${device.browser} trên ${device.os}`,
      ...(ip ? { ip } : {}), ...(tab ? { tab } : {})
    });
  } catch {
    // Tracking must not block login, navigation or saved profile updates.
  }
}
