import { DEFAULT_INITIAL_VOUCHERS } from '../data/vouchers';
export { DEFAULT_INITIAL_VOUCHERS } from '../data/vouchers';
import { Voucher } from '../types';
import { calculateVoucherStack, INVALID_VOUCHER_MESSAGE, type VoucherCartItemContext, type VoucherValidationResult } from './voucherCalculation';
export { calculateVoucherStack, isProductEligibleForVoucher } from './voucherCalculation';
export type { VoucherCartItemContext, VoucherValidationResult } from './voucherCalculation';
export type { Voucher };
import { db, cleanFirestoreData } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';

const VOUCHER_STORAGE_KEY = 'nak_vouchers_cache';
const VOUCHER_COLLECTION = 'vouchers';

// Secret salt for tamper-proof checksum verification
const CIPHER_SALT = 'NAK_VOUCHER_ENCRYPTION_KEY_2026_SECURE_AUTH';

export const VOUCHER_CLIENT_ERROR_MESSAGE = 'Voucher không tồn tại/đã hết lượt sử dụng';

/**
 * Encrypt voucher payload with SHA-256 HMAC-like signature to ensure integrity
 */
export async function generateVoucherEncryption(voucher: Omit<Voucher, 'encryptedData'>): Promise<string> {
  const payload = JSON.stringify({
    code: voucher.code.toUpperCase().trim(),
    type: voucher.type,
    discountPercent: voucher.discountPercent || 0,
    minOrderValue: voucher.minOrderValue || 0,
    maxDiscountAmount: voucher.maxDiscountAmount || 0,
    startDate: voucher.startDate || '',
    endDate: voucher.endDate || '',
    isActive: voucher.isActive,
    applyToAllProducts: voucher.applyToAllProducts ?? true,
    applicableProductIds: voucher.applicableProductIds || [],
    maxApplicableQuantity: voucher.maxApplicableQuantity || 0,
    usageLimit: voucher.usageLimit || 0,
    salt: CIPHER_SALT
  });

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    // Fallback simple cipher if subtle crypto unavailable
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

/**
 * Verify voucher data against its encrypted checksum
 */
export async function verifyVoucherIntegrity(voucher: Voucher): Promise<boolean> {
  if (!voucher.encryptedData) return false;
  const expected = await generateVoucherEncryption(voucher);
  return expected === voucher.encryptedData;
}



const sanitizeVoucherCreator = (v: Voucher): Voucher => {
  if (v.code.toUpperCase().includes('HUY')) {
    return { ...v, createdBy: 'Trần Việt Huy' };
  }
  const fakeTitles = ['tổng bí thư', 'bộ trưởng', 'chủ tịch nước', 'quản trị viên', 'hệ thống', 'admin'];
  if (v.createdBy && fakeTitles.includes(v.createdBy.trim().toLowerCase())) {
    const copy = { ...v };
    delete copy.createdBy;
    return copy;
  }
  return v;
};

/**
 * Fetch all vouchers (with local cache fallback and defaults)
 */
export async function getVouchers(): Promise<Voucher[]> {
  let firestoreItems: Voucher[] = [];

  // 1. Fetch from Firestore client SDK
  try {
    const colRef = collection(db, VOUCHER_COLLECTION);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      snap.forEach((d) => {
        firestoreItems.push(sanitizeVoucherCreator(d.data() as Voucher));
      });
    }
  } catch (err) {
    console.warn('Lấy voucher từ Firestore client không thành công, thử server API:', err);
  }

  // 2. Fallback to server endpoint if client Firestore was empty or failed
  if (firestoreItems.length === 0) {
    try {
      const res = await fetch('/api/vouchers');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.vouchers)) {
          firestoreItems = data.vouchers.map(sanitizeVoucherCreator);
        }
      }
    } catch {}
  }

  // 3. Load local cache
  let localItems: Voucher[] = [];
  try {
    const local = localStorage.getItem(VOUCHER_STORAGE_KEY);
    if (local) localItems = (JSON.parse(local) as Voucher[]).map(sanitizeVoucherCreator);
  } catch {}

  // 4. Smart merge: key by voucher code (uppercase) so duplicates are resolved
  const mergedMap = new Map<string, Voucher>();

  firestoreItems.forEach((v) => {
    const key = v.code.toUpperCase().trim();
    mergedMap.set(key, v);
  });

  localItems.forEach((v) => {
    const key = v.code.toUpperCase().trim();
    const existing = mergedMap.get(key);
    if (!existing) {
      mergedMap.set(key, v);
    } else {
      const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const localTime = v.updatedAt ? new Date(v.updatedAt).getTime() : 0;
      // If local item is newer, preserve local version!
      if (localTime >= existingTime) {
        mergedMap.set(key, v);
      }
    }
  });

  let items = Array.from(mergedMap.values());

  // 5. Ensure HUYTRAN preset is available if not in Firestore
  if (!items.some((it) => it.code.toUpperCase() === 'HUYTRAN')) {
    const huyPreset = DEFAULT_INITIAL_VOUCHERS.find((p) => p.code === 'HUYTRAN');
    if (huyPreset) {
      const enc = await generateVoucherEncryption(huyPreset);
      items.unshift({ ...huyPreset, encryptedData: enc });
    }
  }

  // 6. If completely empty, seed default vouchers
  if (items.length === 0) {
    for (const raw of DEFAULT_INITIAL_VOUCHERS) {
      const encrypted = await generateVoucherEncryption(raw);
      items.push({ ...raw, encryptedData: encrypted });
    }
  }

  try {
    localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(items));
  } catch {}

  return items;
}

/**
 * Save or update a voucher
 */
export async function saveVoucher(voucher: Voucher): Promise<void> {
  // Ensure encrypted integrity is computed
  const encrypted = await generateVoucherEncryption(voucher);
  const secureVoucher: Voucher = {
    ...voucher,
    code: voucher.code.toUpperCase().trim(),
    encryptedData: encrypted,
    updatedAt: new Date().toISOString()
  };

  // 1. Immediately store in local cache so UI updates instantly
  try {
    const local = localStorage.getItem(VOUCHER_STORAGE_KEY);
    let current: Voucher[] = local ? JSON.parse(local) : [];
    const existingIdx = current.findIndex(
      (v) => v.id === secureVoucher.id || v.code.toUpperCase() === secureVoucher.code.toUpperCase()
    );
    if (existingIdx >= 0) {
      current[existingIdx] = secureVoucher;
    } else {
      current = [secureVoucher, ...current];
    }
    localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(current));
  } catch {}

  // 2. Prepare clean, sanitized payload for Firestore without undefined values
  const rawPayload: Record<string, any> = {
    ...secureVoucher,
    applicableProductIds: secureVoucher.applicableProductIds || []
  };
  if (!rawPayload.usageLimit || Number(rawPayload.usageLimit) <= 0) {
    delete rawPayload.usageLimit;
  }
  const cleanPayload = cleanFirestoreData(rawPayload);

  // 3. Save to Firestore client SDK
  try {
    const docRef = doc(db, VOUCHER_COLLECTION, secureVoucher.id);
    await setDoc(docRef, cleanPayload, { merge: true });
  } catch (err: any) {
    console.warn('Lưu voucher lên Firestore bị lỗi, thử server fallback:', err);
  }

  // 4. Save to Server endpoint as reliable fallback
  try {
    await fetch('/api/vouchers/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanPayload)
    });
  } catch {}
}

/**
 * Delete a voucher
 */
export async function deleteVoucher(voucherId: string): Promise<void> {
  // 1. Remove from local cache immediately
  try {
    const local = localStorage.getItem(VOUCHER_STORAGE_KEY);
    if (local) {
      const current = JSON.parse(local) as Voucher[];
      const nextList = current.filter((v) => v.id !== voucherId);
      localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(nextList));
    }
  } catch {}

  // 2. Delete from Firestore client SDK
  try {
    const docRef = doc(db, VOUCHER_COLLECTION, voucherId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Xóa voucher trên Firestore bị lỗi:', err);
  }

  // 3. Delete from Server endpoint
  try {
    await fetch('/api/vouchers/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: voucherId })
    });
  } catch {}
}

/**
 * Calculate total usage count for a voucher from cache and stored orders
 */
export function getVoucherUsedCount(voucher: Voucher): number {
  let count = Number(voucher.usageCount) || Number((voucher as any).usedCount) || 0;
  try {
    const localOrders = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
    if (Array.isArray(localOrders)) {
      const target = voucher.code.toUpperCase().trim();
      const orderCount = localOrders.filter((ord: any) => {
        if (!ord || ord.isDeleted || ord.status === 'cancelled' || ord.status === 'Đã hủy') return false;
        if (!ord.voucherCode) return false;
        const raw = String(ord.voucherCode).toUpperCase().trim();
        if (raw === target) return true;
        const tokens = raw.split(/[\s,+&/|]+/).map((t: string) => t.trim());
        return tokens.includes(target);
      }).length;
      count = Math.max(count, orderCount);
    }
  } catch {}
  return count;
}

/**
 * Increment usage count for voucher(s) upon successful order creation
 */
export async function incrementVouchersUsage(voucherCodes: string[]): Promise<void> {
  if (!voucherCodes || voucherCodes.length === 0) return;
  const cleanCodes = voucherCodes.map((c) => c.toUpperCase().trim()).filter(Boolean);
  if (cleanCodes.length === 0) return;

  try {
    const vouchers = await getVouchers();
    let changed = false;
    const updatedList = vouchers.map((v) => {
      if (cleanCodes.includes(v.code.toUpperCase().trim())) {
        changed = true;
        const newCount = (v.usageCount || 0) + 1;
        return {
          ...v,
          usageCount: newCount,
          usedCount: newCount,
          updatedAt: new Date().toISOString()
        };
      }
      return v;
    });

    if (changed) {
      localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(updatedList));

      for (const v of updatedList) {
        if (cleanCodes.includes(v.code.toUpperCase().trim())) {
          try {
            const docRef = doc(db, VOUCHER_COLLECTION, v.id);
            await updateDoc(docRef, {
              usageCount: v.usageCount,
              usedCount: v.usageCount,
              updatedAt: new Date().toISOString()
            });
          } catch {
            // Firestore write fallback
          }
        }
      }
    }
  } catch (err) {
    console.warn('Lỗi ghi nhận lượt dùng voucher:', err);
  }
}

/** Validate a single code using the same product policy as multi-code checkout. */
export function validateVoucherCode(code: string, vouchers: Voucher[], subtotal: number, shippingFee = 0, cartItems?: VoucherCartItemContext[]): VoucherValidationResult {
  const cleanCode = code.toUpperCase().trim();
  if (!cleanCode) return { isValid: false, discountAmount: 0, isFreeShipping: false, message: 'Vui lòng nhập mã voucher.' };
  if (cleanCode === 'GIAM100K') return { isValid: false, discountAmount: 0, isFreeShipping: false, message: 'Đây chỉ là ví dụ thôi hahahahaha' };
  const voucher = vouchers.find((v) => v.code.toUpperCase().trim() === cleanCode);
  if (!voucher) return { isValid: false, discountAmount: 0, isFreeShipping: false, message: INVALID_VOUCHER_MESSAGE };
  return calculateVoucherStack([{ ...voucher, usageCount: getVoucherUsedCount(voucher) }], subtotal, shippingFee, cartItems).results[0];
}
