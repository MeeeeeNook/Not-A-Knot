import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Copy, QrCode, X } from 'lucide-react';
import type { AffiliatePaymentAccount } from '../types';
import initialBanks from '../data/vietqrBanks.json';
import { createCommissionQrRequest } from '../utils/affiliatePayment';

type Bank = typeof initialBanks[number];
const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-900 focus:bg-white focus:border-rose-500 outline-none';

export function AffiliatePaymentSettings({ value, onChange, availableCommission, affiliateCode, legacyPaymentInfo, preview = false }: { value: AffiliatePaymentAccount; onChange: (account: AffiliatePaymentAccount) => void; availableCommission: number; affiliateCode: string; legacyPaymentInfo?: string; preview?: boolean }) {
  const [banks, setBanks] = useState<Bank[]>(initialBanks);
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const [amount, setAmount] = useState(''), [error, setError] = useState(''), [qr, setQr] = useState<ReturnType<typeof createCommissionQrRequest> | null>(null);
  const [imageError, setImageError] = useState(false), [notice, setNotice] = useState('');
  const selectRef = useRef<HTMLDivElement>(null);
  const available = Math.max(0, Math.floor(availableCommission));
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
    fetch('https://api.vietqr.io/v2/banks', { signal: controller.signal }).then(r => r.json()).then(data => {
      if (data.code === '00' && Array.isArray(data.data)) {
        const list = data.data.filter((b: any) => b.transferSupported === 1 && /^\d{6}$/.test(b.bin) && typeof b.name === 'string' && typeof b.shortName === 'string' && typeof b.code === 'string');
        if (list.length) setBanks(list);
      }
    }).catch(() => {}).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [preview]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!selectRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const update = (patch: Partial<AffiliatePaymentAccount>) => { onChange({ ...value, ...patch }); setQr(null); setError(''); };
  const generate = () => {
    try { const request = createCommissionQrRequest(value, Number(amount), available, affiliateCode); setQr(request); setError(''); setImageError(false); setNotice(''); }
    catch (e: any) { setError(e.message); }
  };
  const copy = async () => {
    if (!qr) return;
    try { await navigator.clipboard.writeText(qr.url); setNotice('Đã sao chép link QR để gửi quản trị viên.'); } catch { setNotice('Bạn có thể mở ảnh QR và sao chép đường dẫn.'); }
  };
  const download = async () => {
    if (!qr) return;
    try {
      const response = await fetch(qr.url); if (!response.ok) throw Error();
      const blob = await response.blob(); if (!blob.type.startsWith('image/')) throw Error();
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `hoa-hong-${affiliateCode}-${qr.amount}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setNotice('Chưa tải được ảnh. Mở ảnh QR để lưu trực tiếp.'); }
  };
  return <fieldset className="space-y-4 rounded-2xl border border-neutral-200 p-4 sm:p-5">
    <legend className="px-1 text-sm font-bold text-neutral-900">Thông tin thanh toán</legend>
    {legacyPaymentInfo && !value.bankBin && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Thông tin đã lưu: {legacyPaymentInfo}. Điền các trường bên dưới để tạo QR.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="relative" ref={selectRef} onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); e.stopPropagation(); } }}>
        <label id="payment-bank-label" className="block font-bold text-neutral-800 mb-1 text-xs">Tên ngân hàng</label>
        <button type="button" aria-labelledby="payment-bank-label" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen(!open); setQuery(''); }} className={`${inputClass} flex items-center justify-between text-left gap-2`}><span>{value.bankName || 'Chọn ngân hàng'}</span><ChevronDown className="w-4 h-4 shrink-0" /></button>
        {open && <div className="absolute top-full mt-1 z-30 w-full rounded-xl border border-neutral-200 bg-white shadow-xl p-2">
          <input autoFocus aria-label="Tìm ngân hàng" value={query} onChange={e => setQuery(e.target.value)} className={inputClass} placeholder="Tìm tên hoặc mã ngân hàng..." />
          <div role="listbox" aria-label="Danh sách ngân hàng" className="max-h-56 overflow-y-auto mt-2">{banks.filter(bank => searchable(`${bank.name} ${bank.shortName} ${bank.code}`).includes(searchable(query))).map(bank => <button type="button" role="option" aria-selected={value.bankBin === bank.bin} key={bank.bin} onClick={() => { update({ bankBin: bank.bin, bankCode: bank.code, bankName: bank.shortName }); setOpen(false); }} className="block w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-rose-50"><strong>{bank.shortName}</strong><span className="block text-neutral-500">{bank.name}</span></button>)}</div>
        </div>}
      </div>
      <div><label htmlFor="payment-account-number" className="block font-bold text-neutral-800 mb-1 text-xs">Số tài khoản (STK)</label><input id="payment-account-number" value={value.accountNumber} onChange={e => update({ accountNumber: e.target.value })} autoComplete="off" className={inputClass} placeholder="Số tài khoản hoặc biệt danh" /></div>
      <div className="sm:col-span-2"><label htmlFor="payment-account-name" className="block font-bold text-neutral-800 mb-1 text-xs">Chủ tài khoản</label><input id="payment-account-name" value={value.accountName} onChange={e => update({ accountName: e.target.value })} autoComplete="name" className={inputClass} placeholder="Tên chủ tài khoản ngân hàng" /></div>
    </div>
    <div className="border-t border-neutral-100 pt-4 space-y-3">
      <p className="text-xs text-neutral-600">Hoa hồng đang có: <strong className="text-rose-700">{available.toLocaleString('vi-VN')}đ</strong></p>
      <div className="flex flex-wrap items-end gap-2"><div className="flex-1 min-w-36"><label htmlFor="commission-qr-amount" className="block text-xs font-semibold mb-1">Số tiền nhận hoa hồng (VNĐ)</label><input id="commission-qr-amount" type="number" min="1" max={available} step="1" value={amount} onChange={e => { setAmount(e.target.value); setQr(null); setError(''); }} className={inputClass} placeholder="Nhập số tiền" /></div><button type="button" disabled={available <= 0} onClick={() => { setAmount(String(available)); setQr(null); setError(''); }} className="rounded-xl border border-neutral-200 px-3 py-2.5 text-xs font-semibold disabled:opacity-50">Tất cả</button><button type="button" disabled={available <= 0} onClick={generate} className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-white text-xs font-bold disabled:opacity-50"><QrCode className="w-4 h-4" />Tạo QR nhận hoa hồng</button></div>
      <p className="text-[11px] text-neutral-500">Số tiền tối đa là hoa hồng ghi nhận trừ các khoản admin đã đánh dấu trả. QR dùng để gửi quản trị viên chuyển khoản; tạo QR không tự ghi nhận đã thanh toán hoặc trừ số dư.</p>
      {preview && <p className="text-[11px] text-neutral-500">Số dư trong preview là dữ liệu mẫu. VietQR tạo từ ngân hàng và STK bạn nhập vẫn dùng để chuyển khoản được.</p>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </div>
    {qr && <div role="dialog" aria-label="QR nhận hoa hồng" className="rounded-2xl bg-neutral-50 border border-neutral-200 p-4 space-y-3">
      <div className="flex justify-between gap-2"><strong className="text-sm">QR nhận hoa hồng: {qr.amount.toLocaleString('vi-VN')}đ</strong><button type="button" onClick={() => setQr(null)} aria-label="Đóng QR"><X className="w-4 h-4" /></button></div>
      {imageError ? <p role="alert" className="text-xs text-rose-700">Chưa tải được VietQR. Vui lòng thử lại hoặc mở ảnh QR.</p> : <img src={qr.url} alt={`VietQR nhận hoa hồng ${qr.amount.toLocaleString('vi-VN')}đ`} onError={() => setImageError(true)} className="w-full max-w-xs mx-auto rounded-xl" />}
      <p className="text-xs text-neutral-600 break-words">{value.bankName} · {value.accountNumber} · {value.accountName}<br />Nội dung: {qr.description}</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={download} className="inline-flex gap-1 items-center rounded-lg border bg-white px-3 py-2 text-xs"><Download className="w-3.5 h-3.5" />Tải ảnh QR</button><button type="button" onClick={copy} className="inline-flex gap-1 items-center rounded-lg border bg-white px-3 py-2 text-xs"><Copy className="w-3.5 h-3.5" />Sao chép link QR</button><a href={qr.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border bg-white px-3 py-2 text-xs">Mở ảnh QR</a></div>
      {notice && <p role="status" className="text-xs text-neutral-600">{notice}</p>}
    </div>}
  </fieldset>;
}
