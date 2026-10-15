import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { X } from 'lucide-react';
import { db } from '../../firebase';
import type { SellerUser } from '../../types';
import { affiliateActivityLabels, affiliateTabLabels, formatAffiliateAccountDate, mergeAffiliateActivity } from '../../utils/affiliateActivity';

export function AffiliateAccountActivity({ seller, name, email, onClose }: { seller?: SellerUser; name: string; email: string; onClose: () => void }) {
  const [profile, setProfile] = useState(seller);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(seller?.id));
  useEffect(() => {
    setProfile(seller); setError(''); setLoading(Boolean(seller?.id));
    if (!seller?.id) return;
    return onSnapshot(doc(db, 'sellers', seller.id), snapshot => {
      if (snapshot.exists()) setProfile({ ...seller, ...snapshot.data(), id: seller.id });
      else { setProfile(undefined); setError('Tài khoản này không còn tồn tại.'); }
      setLoading(false);
    }, () => { setError('Chưa tải được lịch sử mới nhất. Vui lòng đóng và mở lại để thử lại.'); setLoading(false); });
  }, [seller?.id]);
  const history = mergeAffiliateActivity(profile?.affiliateActivity);
  return <section id="affiliate-account-activity" aria-label={`IP và hoạt động của ${name || email}`} className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5">
    <div className="mb-4 flex items-start justify-between gap-4"><div><h4 className="text-sm font-bold text-slate-900">IP & hoạt động · {name || 'Affiliate'}</h4><p className="mt-1 break-all text-xs text-slate-500">{email}</p></div><button type="button" onClick={onClose} aria-label="Đóng lịch sử affiliate" className="rounded-lg p-2 hover:bg-slate-200"><X className="h-4 w-4" /></button></div>
    <dl className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs sm:grid-cols-3">
      <div><dt className="text-slate-500">Đăng nhập gần nhất</dt><dd className="mt-1 font-semibold">{formatAffiliateAccountDate(profile?.lastLoginAt)}</dd></div>
      <div><dt className="text-slate-500">IP ghi nhận gần nhất</dt><dd className="mt-1 break-all font-mono">{profile?.lastLoginIp || 'Chưa ghi nhận'}</dd></div>
      <div><dt className="text-slate-500">Thiết bị gần nhất</dt><dd className="mt-1">{profile?.lastDevice || 'Chưa ghi nhận'}</dd></div>
    </dl>
    {error && <p role="alert" className="mb-3 text-xs text-rose-700">{error}</p>}
    {loading && <p role="status" className="mb-3 text-xs text-slate-500">Đang tải lịch sử…</p>}
    <p className="mb-3 text-[11px] leading-5 text-slate-500">Tối đa 100 hoạt động gần nhất. Lịch sử bắt đầu được ghi từ khi tính năng này được bật; IP có thể thay đổi theo mạng hoặc VPN.</p>
    {history.length ? <ol className="max-h-96 space-y-2 overflow-y-auto" aria-label="Lịch sử hoạt động affiliate">{history.map(entry => <li key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
      <div className="flex flex-wrap justify-between gap-2"><strong className="text-slate-900">{affiliateActivityLabels[entry.action]}{entry.tab ? ` · ${affiliateTabLabels[entry.tab] || entry.tab}` : ''}</strong><time dateTime={entry.timestamp} className="text-slate-500">{formatAffiliateAccountDate(entry.timestamp)}</time></div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-slate-600"><span className="break-all font-mono">IP: {entry.ip || 'Chưa ghi nhận'}</span><span>{entry.device || 'Chưa ghi nhận thiết bị'}</span></div>
    </li>)}</ol> : !loading && <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">Chưa có hoạt động được ghi nhận.</p>}
  </section>;
}
