import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
export const PRODUCT_VOUCHER_POLICY_DOC = 'product_voucher_limits';
export type ProductVoucherLimits = Record<string, number>;

export function subscribeToProductVoucherLimits(onUpdate: (limits: ProductVoucherLimits) => void) {
  return onSnapshot(doc(db, 'system_settings', PRODUCT_VOUCHER_POLICY_DOC), (snapshot) => {
    const raw = snapshot.exists() ? snapshot.data().limits : {};
    const limits: ProductVoucherLimits = {};
    if (raw && typeof raw === 'object') Object.entries(raw).forEach(([id, limit]) => {
      if (Number.isSafeInteger(limit) && Number(limit) >= 0) limits[id] = Number(limit);
    });
    onUpdate(limits);
  }, (error) => console.warn('Không thể tải giới hạn voucher sản phẩm:', error));
}

// Existing Firestore rules make system_settings writable only by Root Admin.
// The order API trusts this document, never a limit supplied by the shopper or product editor.
export async function saveProductVoucherLimit(productId: string, limit: number) {
  if (!productId || !Number.isSafeInteger(limit) || limit < 0) throw new Error('Giới hạn mã giảm % phải là số nguyên không âm.');
  await setDoc(doc(db, 'system_settings', PRODUCT_VOUCHER_POLICY_DOC), { limits: { [productId]: limit }, updatedAt: new Date().toISOString() }, { merge: true });
}
