import { Voucher } from '../types';
export type { Voucher };
import { db } from '../firebase';
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

export const DEFAULT_INITIAL_VOUCHERS: Omit<Voucher, 'encryptedData'>[] = [
  {
    id: 'voucher-knot10',
    code: 'KNOT10',
    type: 'percent',
    discountPercent: 10,
    minOrderValue: 100000,
    maxDiscountAmount: 50000,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'voucher-freeship',
    code: 'FREESHIP',
    type: 'freeship',
    discountPercent: 0,
    minOrderValue: 150000,
    maxDiscountAmount: 30000,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'voucher-naknew',
    code: 'NAKNEW',
    type: 'percent',
    discountPercent: 15,
    minOrderValue: 80000,
    maxDiscountAmount: 40000,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

/**
 * Fetch all vouchers (with local cache fallback and defaults)
 */
export async function getVouchers(): Promise<Voucher[]> {
  try {
    const colRef = collection(db, VOUCHER_COLLECTION);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const items: Voucher[] = [];
      snap.forEach((d) => {
        items.push(d.data() as Voucher);
      });
      localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(items));
      return items;
    }
  } catch (err) {
    console.warn('Lấy voucher từ Firestore không thành công, sử dụng bộ nhớ cục bộ:', err);
  }

  // Fallback to localStorage
  try {
    const local = localStorage.getItem(VOUCHER_STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local) as Voucher[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  // Generate initial presets with signed encryption
  const seeded: Voucher[] = [];
  for (const raw of DEFAULT_INITIAL_VOUCHERS) {
    const encrypted = await generateVoucherEncryption(raw);
    seeded.push({
      ...raw,
      encryptedData: encrypted
    });
  }

  try {
    localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(seeded));
  } catch {}

  return seeded;
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

  try {
    const docRef = doc(db, VOUCHER_COLLECTION, secureVoucher.id);
    await setDoc(docRef, secureVoucher, { merge: true });
  } catch (err) {
    console.warn('Lưu voucher lên Firestore bị lỗi, lưu tạm cục bộ:', err);
  }

  // Update local cache
  try {
    const current = await getVouchers();
    const existingIdx = current.findIndex((v) => v.id === secureVoucher.id);
    let nextList: Voucher[];
    if (existingIdx >= 0) {
      nextList = [...current];
      nextList[existingIdx] = secureVoucher;
    } else {
      nextList = [secureVoucher, ...current];
    }
    localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(nextList));
  } catch {}
}

/**
 * Delete a voucher
 */
export async function deleteVoucher(voucherId: string): Promise<void> {
  try {
    const docRef = doc(db, VOUCHER_COLLECTION, voucherId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Xóa voucher trên Firestore bị lỗi:', err);
  }

  try {
    const current = await getVouchers();
    const nextList = current.filter((v) => v.id !== voucherId);
    localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(nextList));
  } catch {}
}

export interface VoucherValidationResult {
  isValid: boolean;
  voucher?: Voucher;
  discountAmount: number;
  isFreeShipping: boolean;
  message?: string;
}

/**
 * Validate a voucher code against order context (subtotal, shippingFee)
 */
export function validateVoucherCode(
  code: string,
  vouchers: Voucher[],
  subtotal: number,
  shippingFee: number = 0
): VoucherValidationResult {
  const cleanCode = code.toUpperCase().trim();
  if (!cleanCode) {
    return { isValid: false, discountAmount: 0, isFreeShipping: false, message: 'Vui lòng nhập mã voucher.' };
  }

  const voucher = vouchers.find((v) => v.code.toUpperCase().trim() === cleanCode);
  if (!voucher) {
    return { isValid: false, discountAmount: 0, isFreeShipping: false, message: 'Mã voucher không tồn tại.' };
  }

  if (!voucher.isActive) {
    return { isValid: false, discountAmount: 0, isFreeShipping: false, message: 'Mã voucher này đã bị vô hiệu hóa.' };
  }

  const now = new Date();
  if (voucher.startDate) {
    const start = new Date(voucher.startDate);
    // Compare at beginning of start day
    start.setHours(0, 0, 0, 0);
    if (now < start) {
      return { isValid: false, discountAmount: 0, isFreeShipping: false, message: 'Mã voucher chưa đến thời gian áp dụng.' };
    }
  }

  if (voucher.endDate) {
    const end = new Date(voucher.endDate);
    // End date valid until end of day 23:59:59
    end.setHours(23, 59, 59, 999);
    if (now > end) {
      return { isValid: false, discountAmount: 0, isFreeShipping: false, message: 'Mã voucher đã hết hạn sử dụng.' };
    }
  }

  if (voucher.minOrderValue && voucher.minOrderValue > 0) {
    if (subtotal < voucher.minOrderValue) {
      return {
        isValid: false,
        discountAmount: 0,
        isFreeShipping: false,
        message: `Đơn hàng tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ để áp dụng voucher này.`
      };
    }
  }

  if (voucher.type === 'freeship') {
    // Freeship voucher covers the full shipping fee
    return {
      isValid: true,
      voucher,
      discountAmount: 0,
      isFreeShipping: true,
      message: 'Áp dụng miễn phí vận chuyển thành công!'
    };
  }

  if (voucher.type === 'percent') {
    const percent = voucher.discountPercent || 0;
    if (percent <= 0) {
      return { isValid: false, discountAmount: 0, isFreeShipping: false, message: 'Voucher không hợp lệ.' };
    }
    let calculatedDiscount = Math.round((subtotal * percent) / 100);
    if (voucher.maxDiscountAmount && voucher.maxDiscountAmount > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, voucher.maxDiscountAmount);
    }
    calculatedDiscount = Math.min(calculatedDiscount, subtotal);

    return {
      isValid: true,
      voucher,
      discountAmount: calculatedDiscount,
      isFreeShipping: false,
      message: `Giảm ${percent}% (-${calculatedDiscount.toLocaleString('vi-VN')}đ)`
    };
  }

  return { isValid: false, discountAmount: 0, isFreeShipping: false, message: 'Voucher không hợp lệ.' };
}
