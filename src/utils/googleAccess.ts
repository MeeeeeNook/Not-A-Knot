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
  const reads = await Promise.allSettled([
    getDoc(doc(db, 'authorized_sellers', email)),
    getDocs(query(collection(db, 'sellers'), where('googleEmail', '==', email), limit(1))),
    getDocs(query(collection(db, 'sellers'), where('email', '==', email), limit(1))),
    getDoc(doc(db, 'sellers', uid))
  ]);
  const authDoc = reads[0].status === 'fulfilled' && reads[0].value.exists() ? reads[0].value.data() : null;
  let seller: SellerUser | undefined;
  for (const read of [reads[1], reads[2]]) {
    if (read.status === 'fulfilled' && !read.value.empty) {
      const found = read.value.docs[0]; seller = { ...found.data(), id: found.id } as SellerUser; break;
    }
  }
  const uidDoc = reads[3];
  if (!seller && uidDoc.status === 'fulfilled' && uidDoc.value.exists()) seller = { ...uidDoc.value.data(), id: uidDoc.value.id } as SellerUser;
  if (authDoc?.isActive === false || seller?.isActive === false) return { isAuthorized: false, conclusive: true, error: GOOGLE_ACCESS_DENIED };
  if (authDoc || seller) return { isAuthorized: true, conclusive: true, seller, role: seller?.role || authDoc?.role || 'member' };
  const networkFailed = reads.some((read) => read.status === 'rejected' && read.reason?.code !== 'permission-denied');
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
