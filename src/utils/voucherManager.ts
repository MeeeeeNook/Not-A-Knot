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

export const DEFAULT_INITIAL_VOUCHERS: Omit<Voucher, 'encryptedData'>[] = [
  {
    id: 'voucher-huytran',
    code: 'HUYTRAN',
    type: 'percent',
    discountPercent: 10,
    minOrderValue: 50000,
    maxDiscountAmount: 30000,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    createdBy: 'Trần Việt Huy',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
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
  try {
    const colRef = collection(db, VOUCHER_COLLECTION);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      let items: Voucher[] = [];
      snap.forEach((d) => {
        items.push(sanitizeVoucherCreator(d.data() as Voucher));
      });
      // Ensure HUYTRAN preset is available if not in Firestore
      if (!items.some((it) => it.code.toUpperCase() === 'HUYTRAN')) {
        const huyPreset = DEFAULT_INITIAL_VOUCHERS.find((p) => p.code === 'HUYTRAN');
        if (huyPreset) {
          const enc = await generateVoucherEncryption(huyPreset);
          items.unshift({ ...huyPreset, encryptedData: enc });
        }
      }
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
      let parsed = (JSON.parse(local) as Voucher[]).map(sanitizeVoucherCreator);
      if (!parsed.some((it) => it.code.toUpperCase() === 'HUYTRAN')) {
        const huyPreset = DEFAULT_INITIAL_VOUCHERS.find((p) => p.code === 'HUYTRAN');
        if (huyPreset) {
          const enc = await generateVoucherEncryption(huyPreset);
          parsed.unshift({ ...huyPreset, encryptedData: enc });
        }
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(parsed));
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
  eligibleItemCount?: number;
  discountedItemCount?: number;
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

export interface VoucherCartItemContext {
  product: {
    id: string;
    name: string;
    price: number;
    applyAllVouchers?: boolean;
    applicableVoucherIds?: string[];
    disallowedVoucherIds?: string[];
    [key: string]: any;
  };
  quantity: number;
  selectedCharmPrice?: number;
  selectedOmamoriPrice?: number;
  selectedKhoenPrice?: number;
  customPhotoPrice?: number;
  [key: string]: any;
}

/**
 * Check if a specific product is eligible for a given voucher
 */
export function isProductEligibleForVoucher(
  product: VoucherCartItemContext['product'],
  voucher: Voucher
): boolean {
  if (!product || !voucher) return false;

  const cleanVoucherCode = voucher.code.toUpperCase().trim();

  // 1. Kiểm tra cấu hình từ phía Voucher (Nếu voucher chỉ áp dụng cho một số sản phẩm)
  if (voucher.applyToAllProducts === false || (voucher.applicableProductIds && voucher.applicableProductIds.length > 0)) {
    const allowedProducts = voucher.applicableProductIds || [];
    if (!allowedProducts.includes(product.id)) {
      return false;
    }
  }

  // 2. Kiểm tra cấu hình từ phía Sản Phẩm (Nếu sản phẩm chỉ cho phép một số mã giảm giá)
  if (product.applyAllVouchers === false) {
    const allowedVouchers = (product.applicableVoucherIds || []).map((v) => String(v).toUpperCase().trim());
    const isAllowed = allowedVouchers.includes(voucher.id.toUpperCase().trim()) || allowedVouchers.includes(cleanVoucherCode);
    if (!isAllowed) {
      return false;
    }
  }

  // 3. Kiểm tra danh sách voucher bị vô hiệu hóa riêng cho sản phẩm này (nếu có)
  if (product.disallowedVoucherIds && product.disallowedVoucherIds.length > 0) {
    const disallowedVouchers = product.disallowedVoucherIds.map((v) => String(v).toUpperCase().trim());
    if (disallowedVouchers.includes(voucher.id.toUpperCase().trim()) || disallowedVouchers.includes(cleanVoucherCode)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate a voucher code against order context (subtotal, shippingFee, and optional cartItems)
 */
export function validateVoucherCode(
  code: string,
  vouchers: Voucher[],
  subtotal: number,
  shippingFee: number = 0,
  cartItems?: VoucherCartItemContext[]
): VoucherValidationResult {
  const cleanCode = code.toUpperCase().trim();
  if (!cleanCode) {
    return { isValid: false, discountAmount: 0, isFreeShipping: false, message: 'Vui lòng nhập mã voucher.' };
  }

  if (cleanCode === 'GIAM100K') {
    return { isValid: false, discountAmount: 0, isFreeShipping: false, message: 'Đây chỉ là ví dụ thôi hahahahaha' };
  }

  const voucher = vouchers.find((v) => v.code.toUpperCase().trim() === cleanCode);
  if (!voucher) {
    return { isValid: false, discountAmount: 0, isFreeShipping: false, message: VOUCHER_CLIENT_ERROR_MESSAGE };
  }

  if (!voucher.isActive) {
    return { isValid: false, discountAmount: 0, isFreeShipping: false, message: VOUCHER_CLIENT_ERROR_MESSAGE };
  }

  // Kiểm tra giới hạn số lượt dùng (Toàn hệ thống)
  const currentUses = getVoucherUsedCount(voucher);
  if (voucher.usageLimit && voucher.usageLimit > 0 && currentUses >= voucher.usageLimit) {
    return { isValid: false, discountAmount: 0, isFreeShipping: false, message: VOUCHER_CLIENT_ERROR_MESSAGE };
  }

  const now = new Date();
  if (voucher.startDate) {
    const start = new Date(voucher.startDate);
    // Compare at beginning of start day
    start.setHours(0, 0, 0, 0);
    if (now < start) {
      return { isValid: false, discountAmount: 0, isFreeShipping: false, message: VOUCHER_CLIENT_ERROR_MESSAGE };
    }
  }

  if (voucher.endDate) {
    const end = new Date(voucher.endDate);
    // End date valid until end of day 23:59:59
    end.setHours(23, 59, 59, 999);
    if (now > end) {
      return { isValid: false, discountAmount: 0, isFreeShipping: false, message: VOUCHER_CLIENT_ERROR_MESSAGE };
    }
  }

  if (voucher.minOrderValue && voucher.minOrderValue > 0) {
    if (subtotal < voucher.minOrderValue) {
      return {
        isValid: false,
        discountAmount: 0,
        isFreeShipping: false,
        message: VOUCHER_CLIENT_ERROR_MESSAGE
      };
    }
  }

  // Filter items in cart that are eligible for this voucher
  const hasCartItems = Boolean(cartItems && cartItems.length > 0);
  const eligibleItems = hasCartItems
    ? (cartItems || []).filter((item) => isProductEligibleForVoucher(item.product, voucher))
    : [];

  // If cart is provided but has zero eligible products
  if (hasCartItems && eligibleItems.length === 0) {
    return {
      isValid: false,
      voucher,
      discountAmount: 0,
      isFreeShipping: false,
      message: VOUCHER_CLIENT_ERROR_MESSAGE
    };
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
      return { isValid: false, discountAmount: 0, isFreeShipping: false, message: VOUCHER_CLIENT_ERROR_MESSAGE };
    }

    let calculatedDiscount = 0;
    let discountedItemCount = 0;
    const maxQty = voucher.maxApplicableQuantity && voucher.maxApplicableQuantity > 0
      ? Number(voucher.maxApplicableQuantity)
      : 0;

    if (hasCartItems) {
      // Calculate unit price helper
      const getItemUnitPrice = (item: VoucherCartItemContext) => {
        return (
          Number(item.product.price) +
          (Number(item.selectedCharmPrice) || 0) +
          (Number(item.selectedOmamoriPrice) || 0) +
          (Number(item.selectedKhoenPrice) || 0) +
          (Number(item.customPhotoPrice) || 0)
        );
      };

      if (maxQty > 0) {
        // Có giới hạn số lượng sản phẩm được giảm:
        // Sắp xếp các sản phẩm đủ điều kiện theo đơn giá giảm dần để khách hàng được hưởng ưu đãi tốt nhất
        const sortedEligible = [...eligibleItems].sort((a, b) => getItemUnitPrice(b) - getItemUnitPrice(a));
        let remainingQuota = maxQty;
        let discountableSubtotal = 0;

        for (const item of sortedEligible) {
          if (remainingQuota <= 0) break;
          const unitPrice = getItemUnitPrice(item);
          const qtyToDiscount = Math.min(item.quantity, remainingQuota);
          discountableSubtotal += unitPrice * qtyToDiscount;
          discountedItemCount += qtyToDiscount;
          remainingQuota -= qtyToDiscount;
        }

        calculatedDiscount = Math.round((discountableSubtotal * percent) / 100);
      } else {
        // Không giới hạn số lượng: áp dụng cho tất cả sản phẩm đủ điều kiện
        let discountableSubtotal = 0;
        for (const item of eligibleItems) {
          const unitPrice = getItemUnitPrice(item);
          discountableSubtotal += unitPrice * item.quantity;
          discountedItemCount += item.quantity;
        }
        calculatedDiscount = Math.round((discountableSubtotal * percent) / 100);
      }
    } else {
      // Fallback khi không truyền cartItems (tính trên subtotal)
      calculatedDiscount = Math.round((subtotal * percent) / 100);
    }

    if (voucher.maxDiscountAmount && voucher.maxDiscountAmount > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, voucher.maxDiscountAmount);
    }
    calculatedDiscount = Math.min(calculatedDiscount, subtotal);

    // Xây dựng thông báo trực quan rõ ràng
    let successMessage = `Giảm ${percent}% (-${calculatedDiscount.toLocaleString('vi-VN')}đ)`;
    if (hasCartItems && maxQty > 0) {
      const totalEligibleUnits = eligibleItems.reduce((acc, it) => acc + it.quantity, 0);
      if (totalEligibleUnits > maxQty) {
        successMessage = `Giảm ${percent}% cho ${discountedItemCount} sản phẩm (tối đa ${maxQty} SP / đơn) (-${calculatedDiscount.toLocaleString('vi-VN')}đ)`;
      } else {
        successMessage = `Giảm ${percent}% cho ${discountedItemCount} sản phẩm áp dụng (-${calculatedDiscount.toLocaleString('vi-VN')}đ)`;
      }
    } else if (hasCartItems && (voucher.applyToAllProducts === false || eligibleItems.length < (cartItems?.length || 0))) {
      successMessage = `Giảm ${percent}% cho các sản phẩm áp dụng (-${calculatedDiscount.toLocaleString('vi-VN')}đ)`;
    }

    return {
      isValid: true,
      voucher,
      discountAmount: calculatedDiscount,
      isFreeShipping: false,
      message: successMessage,
      eligibleItemCount: eligibleItems.length,
      discountedItemCount
    };
  }

  return { isValid: false, discountAmount: 0, isFreeShipping: false, message: VOUCHER_CLIENT_ERROR_MESSAGE };
}
