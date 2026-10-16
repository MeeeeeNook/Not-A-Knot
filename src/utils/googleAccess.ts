import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { SellerUser } from '../types';

export interface GoogleAccessResult {
  isAuthorized: boolean;
  conclusive: boolean;
  seller?: SellerUser;
  role?: SellerUser['role'];
  error?: string;
}
export const GOOGLE_ACCESS_DENIED = 'Tài khoản không tồn tại hoặc chưa được cấp quyền trong hệ thống. Vui lòng liên hệ quản trị viên.';
export const GOOGLE_ACCESS_TIMEOUT = 'Chưa thể xác minh quyền truy cập. Vui lòng kiểm tra kết nối và thử lại.';

export async function withDeadline<T>(operation: Promise<T>, milliseconds: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([operation.catch(() => fallback), new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), milliseconds); })]); }
  finally { clearTimeout(timer!); }
}

export async function checkGoogleAccess(email: string, uid: string): Promise<GoogleAccessResult> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const reads = await Promise.allSettled([
    cleanEmail ? getDoc(doc(db, 'authorized_sellers', cleanEmail)) : Promise.reject(new Error('no-email')),
    cleanEmail ? getDocs(query(collection(db, 'sellers'), where('googleEmail', '==', cleanEmail), limit(1))) : Promise.reject(new Error('no-email')),
    cleanEmail ? getDocs(query(collection(db, 'sellers'), where('email', '==', cleanEmail), limit(1))) : Promise.reject(new Error('no-email')),
    uid ? getDoc(doc(db, 'sellers', uid)) : Promise.reject(new Error('no-uid'))
  ]);
  const authDoc = reads[0].status === 'fulfilled' && reads[0].value.exists() ? reads[0].value.data() : null;
  let seller: SellerUser | undefined;
  for (const read of [reads[1], reads[2]]) {
    if (read.status === 'fulfilled' && !read.value.empty) {
      const found = read.value.docs[0];
      seller = { ...found.data(), id: found.id } as SellerUser;
      break;
    }
  }
  const uidDoc = reads[3];
  if (!seller && uidDoc.status === 'fulfilled' && uidDoc.value.exists()) {
    seller = { ...uidDoc.value.data(), id: uidDoc.value.id } as SellerUser;
  }
  if (!seller && authDoc?.sellerId && typeof authDoc.sellerId === 'string') {
    try {
      const linkedSnap = await getDoc(doc(db, 'sellers', authDoc.sellerId));
      if (linkedSnap.exists()) {
        seller = { ...linkedSnap.data(), id: linkedSnap.id } as SellerUser;
      }
    } catch {}
  }
  if (authDoc?.isActive === false || seller?.isActive === false) {
    return { isAuthorized: false, conclusive: true, error: GOOGLE_ACCESS_DENIED };
  }
  if (authDoc || seller) {
    const resolvedRole: SellerUser['role'] =
      authDoc?.role === 'affiliate' || seller?.role === 'affiliate'
        ? 'affiliate'
        : (seller?.role || authDoc?.role || 'member');
    const normalizedSeller = seller ? { ...seller, role: resolvedRole, isActive: true } : undefined;
    return { isAuthorized: true, conclusive: true, seller: normalizedSeller, role: resolvedRole };
  }
  const networkFailed = reads.some(
    (read) =>
      read.status === 'rejected' &&
      read.reason?.code !== 'permission-denied' &&
      read.reason?.message !== 'no-email' &&
      read.reason?.message !== 'no-uid'
  );
  return { isAuthorized: false, conclusive: !networkFailed, error: networkFailed ? GOOGLE_ACCESS_TIMEOUT : GOOGLE_ACCESS_DENIED };
}

const pending = new Map<string, Promise<GoogleAccessResult>>();
export function resolveGoogleAccess(email: string, uid: string, isRoot: boolean): Promise<GoogleAccessResult> {
  if (isRoot) return Promise.resolve({ isAuthorized: true, conclusive: true, role: 'root_admin' });
  const key = `${uid}:${email}`;
  const current = pending.get(key);
  if (current) return current;
  // Never enumerate every staff account during login. A slow/offline SDK read is bounded.
  const check = withDeadline(checkGoogleAccess(email, uid), 2500, { isAuthorized: false, conclusive: false, error: GOOGLE_ACCESS_TIMEOUT });
  pending.set(key, check);
  void check.finally(() => { if (pending.get(key) === check) pending.delete(key); });
  return check;
}
