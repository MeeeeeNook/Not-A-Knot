import type { AffiliatePaymentAccount } from '../types';

export const emptyAffiliatePaymentAccount = (): AffiliatePaymentAccount => ({ bankBin: '', bankCode: '', bankName: '', accountNumber: '', accountName: '' });

export function validateAffiliatePayment(account: AffiliatePaymentAccount): string | null {
  if (!/^\d{6}$/.test(account.bankBin)) return 'Vui lòng chọn ngân hàng.';
  if (!/^[A-Za-z0-9]{1,19}$/.test(account.accountNumber.trim())) return 'Số tài khoản/biệt danh gồm chữ hoặc số, tối đa 19 ký tự.';
  if (!account.accountName.trim()) return 'Vui lòng nhập Chủ tài khoản.';
  return null;
}

export function formatAffiliatePayment(account: AffiliatePaymentAccount): string {
  return `${account.bankName} · STK: ${account.accountNumber.trim()} · Chủ tài khoản: ${account.accountName.trim()}`;
}

export function createCommissionQrRequest(account: AffiliatePaymentAccount, amount: number, available: number, code: string) {
  const error = validateAffiliatePayment(account);
  if (error) throw new Error(error);
  const limit = Math.max(0, Math.floor(available));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > limit || amount > 9999999999999) throw new Error(`Số tiền phải là số nguyên từ 1đ đến ${limit.toLocaleString('vi-VN')}đ.`);
  const description = `NAK HOA HONG ${code}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
  const params = new URLSearchParams({ amount: String(amount), addInfo: description, accountName: account.accountName.trim() });
  return { amount, description, url: `https://img.vietqr.io/image/${account.bankBin}-${account.accountNumber.trim()}-compact2.png?${params}` };
}
