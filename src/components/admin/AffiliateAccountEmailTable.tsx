import React, { useMemo, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import type { AuthorizedSellerItem, SellerUser } from '../../types';
import { saveSellerToFirestore } from '../../firebase';
import { fetchAffiliateSystemConfig, generateAffiliateCode } from '../../utils/affiliateManager';
import { buildAffiliatePartner, createAffiliatePartnerDraft, validateAffiliatePartnerStep } from '../../utils/affiliatePartnerForm';

export function AffiliateAccountEmailTable({ sellers, authorizedEmails, reservedEmails, onUpdateSellers }: {
  sellers: SellerUser[];
  authorizedEmails: AuthorizedSellerItem[];
  reservedEmails: string[];
  onUpdateSellers: (sellers: SellerUser[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(''), [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const accounts = useMemo(() => {
    const rows = new Map<string, { name: string; email: string; active: boolean }>();
    authorizedEmails.filter(item => item.role === 'affiliate').forEach(item => {
      const email = item.email.trim().toLowerCase();
      rows.set(email, { name: item.name || '', email, active: item.isActive !== false });
    });
    sellers.filter(seller => seller.role === 'affiliate').forEach(seller => {
      const email = (seller.googleEmail || seller.email || '').trim().toLowerCase();
      rows.set(email || seller.id, { name: seller.name || seller.username, email, active: seller.isActive !== false });
    });
    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.email.localeCompare(b.email));
  }, [sellers, authorizedEmails]);

  const addAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    if ([...reservedEmails, ...authorizedEmails.map(item => item.email)].some(item => item.trim().toLowerCase() === cleanEmail)) {
      setMessage({ error: true, text: 'Email này đã có trong danh sách tài khoản.' });
      return;
    }
    setSaving(true);
    try {
      const config = await fetchAffiliateSystemConfig();
      const draft = createAffiliatePartnerDraft(null, config, generateAffiliateCode(name, sellers));
      draft.name = name;
      draft.email = cleanEmail;
      const error = validateAffiliatePartnerStep(draft, 0, sellers, null) || validateAffiliatePartnerStep(draft, 1, sellers, null);
      if (error) throw new Error(error);
      const affiliate = buildAffiliatePartner(draft, null, sellers);
      await saveSellerToFirestore(affiliate);
      onUpdateSellers([...sellers, affiliate]);
      setShowForm(false);
      setName(''); setEmail('');
      setMessage({ error: false, text: 'Đã thêm tài khoản affiliate. Thiết lập hoa hồng tại trang Affiliate.' });
    } catch (error: any) {
      setMessage({ error: true, text: error.message || 'Chưa thêm được tài khoản. Vui lòng thử lại.' });
    } finally { setSaving(false); }
  };

  return <section aria-label="Tài khoản affiliate" className="overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:p-5">
      <h3 className="font-bold text-sm sm:text-base text-slate-900">Danh sách tài khoản Affiliate ({accounts.length})</h3>
      <button type="button" disabled={saving} onClick={() => { setShowForm(!showForm); setMessage(null); }} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">
        {showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{showForm ? 'Đóng biểu mẫu' : 'Thêm affiliate'}
      </button>
    </div>
    {message && <p role={message.error ? 'alert' : 'status'} className={`m-4 rounded-xl p-3 text-xs ${message.error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{message.text}</p>}
    {showForm && <form aria-label="Thêm tài khoản affiliate" onSubmit={addAccount} noValidate className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="affiliate-account-name" className="mb-1 block text-xs font-semibold text-slate-700">Tên affiliate</label><input id="affiliate-account-name" value={name} onChange={event => setName(event.target.value)} disabled={saving} autoComplete="name" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
        <div><label htmlFor="affiliate-account-email" className="mb-1 block text-xs font-semibold text-slate-700">Email Google của affiliate</label><input id="affiliate-account-email" type="email" value={email} onChange={event => setEmail(event.target.value)} disabled={saving} autoComplete="email" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
      </div>
      <p className="text-xs text-slate-500">Tài khoản mới dùng thiết lập mặc định. Chỉnh mã tiếp thị và hoa hồng tại trang Affiliate.</p>
      <button type="submit" disabled={saving} className="rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Đang thêm...' : 'Thêm tài khoản'}</button>
    </form>}
    <div className="overflow-x-auto"><table aria-label="Danh sách email affiliate" className="w-full text-left text-xs sm:text-sm">
      <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500"><tr><th className="p-3.5 sm:p-4">Tên</th><th className="p-3.5 sm:p-4">Email Google</th><th className="p-3.5 sm:p-4">Trạng thái</th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {accounts.map((account, index) => <tr key={account.email || index}><td className="p-3.5 sm:p-4 font-semibold text-slate-900">{account.name || 'Chưa có tên'}</td><td className="p-3.5 sm:p-4 break-all font-mono text-slate-600">{account.email || 'Chưa có email'}</td><td className="p-3.5 sm:p-4"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${account.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{account.active ? 'Hoạt động' : 'Đã tắt'}</span></td></tr>)}
        {accounts.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-slate-400">Chưa có tài khoản affiliate.</td></tr>}
      </tbody>
    </table></div>
  </section>;
}
