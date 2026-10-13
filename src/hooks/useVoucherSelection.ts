import { useEffect, useMemo, useState } from 'react';
import type { Voucher } from '../types';
import { calculateVoucherStack, getVoucherUsedCount } from '../utils/voucherManager';
import { INVALID_VOUCHER_MESSAGE, type VoucherCartItemContext } from '../utils/voucherCalculation';
import { trackGA4ApplyCoupon } from '../utils/analytics';

export function useVoucherSelection(items: VoucherCartItemContext[], subtotal: number, shippingFee: number, availableVouchers: Voucher[]) {
  const [codes, setCodes] = useState<string[]>([]);
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherSuccessMsg, setVoucherSuccessMsg] = useState<string | null>(null);
  const evaluate = (selectedCodes: string[]) => {
    const vouchers = selectedCodes.map((code) => availableVouchers.find((v) => v.code.toUpperCase().trim() === code)).filter((v): v is Voucher => Boolean(v));
    return calculateVoucherStack(vouchers.map((v) => ({ ...v, usageCount: getVoucherUsedCount(v) })), subtotal, shippingFee, items);
  };
  const stack = useMemo(() => evaluate(codes), [codes, availableVouchers, subtotal, shippingFee, items]);
  const selectedVouchers = stack.appliedVouchers;
  const validCodes = selectedVouchers.map((v) => v.code.toUpperCase().trim());
  const validKey = validCodes.join('|');
  useEffect(() => {
    if (codes.some((code) => !validCodes.includes(code))) {
      setCodes(validCodes);
      setVoucherError(stack.results.find((r) => !r.isValid)?.message || INVALID_VOUCHER_MESSAGE);
      setVoucherSuccessMsg(null);
    }
  }, [codes, validKey]);
  const handleApplyVoucher = () => {
    setVoucherError(null); setVoucherSuccessMsg(null);
    const code = voucherInput.trim().toUpperCase();
    if (!code) { setVoucherError('Vui lòng nhập mã voucher.'); return; }
    if (codes.includes(code)) { setVoucherError('Mã này đã được áp dụng.'); return; }
    if (code === 'GIAM100K') { setVoucherError('Đây chỉ là ví dụ thôi hahahahaha'); return; }
    const candidate = evaluate([...codes, code]);
    const result = candidate.results.find((r) => r.voucher?.code.toUpperCase().trim() === code);
    if (!result?.isValid || !result.voucher) { setVoucherError(result?.message || INVALID_VOUCHER_MESSAGE); return; }
    setCodes([...codes, code]); setVoucherInput(''); setVoucherSuccessMsg(result.message || 'Áp dụng voucher thành công!');
    trackGA4ApplyCoupon(code, result.discountAmount);
  };
  const handleRemoveVoucher = (code: string) => { setCodes((prev) => prev.filter((c) => c !== code.toUpperCase().trim())); setVoucherInput(''); setVoucherError(null); setVoucherSuccessMsg(null); };
  const getDiscountForVoucher = (code: string) => stack.results.find((r) => r.voucher?.code.toUpperCase() === code.toUpperCase())?.discountAmount || 0;
  return { voucherInput, setVoucherInput, voucherError, setVoucherError, voucherSuccessMsg, selectedVouchers, voucherDiscountAmount: stack.discountAmount, isFreeShippingVoucher: stack.isFreeShipping, handleApplyVoucher, handleRemoveVoucher, getDiscountForVoucher };
}
