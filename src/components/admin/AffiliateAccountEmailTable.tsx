import React, { useMemo, useState } from 'react';
import { Users, UserPlus, X } from 'lucide-react';
import type { AuthorizedSellerItem, SellerUser } from '../../types';
import { saveSellerToFirestore } from '../../firebase';
import { fetchAffiliateSystemConfig, generateAffiliateCode } from '../../utils/affiliateManager';
import { buildAffiliatePartner, createAffiliatePartnerDraft, validateAffiliatePartnerStep } from '../../utils/affiliatePartnerForm';
import { validAccountDate } from '../../utils/affiliateActivity';
import { AffiliateAccountActivity } from './AffiliateAccountActivity';
import { AccountDirectory, accountAddClass } from './AccountDirectory';

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
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const accounts = useMemo(() => {
    const rows = new Map<string, { key: string; name: string; email: string; active: boolean; createdAt: string; seller?: SellerUser }>();
    authorizedEmails.filter(item => item.role === 'affiliate').forEach(item => {
      const email = item.email.trim().toLowerCase();
      rows.set(email, { key: email, name: item.name || '', email, active: item.isActive !== false, createdAt: validAccountDate(item.createdAt) });
    });
    sellers.filter(seller => seller.role === 'affiliate').forEach(seller => {
      const email = (seller.googleEmail || seller.email || '').trim().toLowerCase();
      rows.set(email || seller.id, { key: email || seller.id, name: seller.name || seller.username, email, active: seller.isActive !== false, createdAt: validAccountDate(seller.createdAt) || rows.get(email)?.createdAt || '', seller });
    });
    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.email.localeCompare(b.email));
  }, [sellers, authorizedEmails]);
  const selected = accounts.find(account => account.key === selectedAccount);

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

  return <>
    <AccountDirectory label="Tài khoản affiliate" title="Tài khoản affiliate" description="Email được cấp quyền sử dụng Affiliate Hub." icon={<Users className="h-4 w-4" />} accounts={accounts.map(account => ({ ...account, lastSeenAt: account.seller?.lastSeenAt || account.seller?.lastLoginAt, onHistory: () => setSelectedAccount(account.key) }))} action={<button type="button" disabled={saving} onClick={() => { setShowForm(!showForm); setMessage(null); }} className={accountAddClass}>{showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{showForm ? 'Đóng biểu mẫu' : 'Thêm affiliate'}</button>}>
    {message && <p role={message.error ? 'alert' : 'status'} className={`m-4 rounded-xl p-3 text-xs ${message.error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{message.text}</p>}
    {showForm && <form aria-label="Thêm tài khoản affiliate" onSubmit={addAccount} noValidate className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="affiliate-account-name" className="mb-1 block text-xs font-semibold text-slate-700">Tên affiliate</label><input id="affiliate-account-name" value={name} onChange={event => setName(event.target.value)} disabled={saving} autoComplete="name" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
        <div><label htmlFor="affiliate-account-email" className="mb-1 block text-xs font-semibold text-slate-700">Email Google của affiliate</label><input id="affiliate-account-email" type="email" value={email} onChange={event => setEmail(event.target.value)} disabled={saving} autoComplete="email" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
      </div>
      <p className="text-xs text-slate-500">Tài khoản mới dùng thiết lập mặc định. Chỉnh mã tiếp thị và hoa hồng tại trang Affiliate.</p>
      <button type="submit" disabled={saving} className="rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Đang thêm...' : 'Thêm tài khoản'}</button>
    </form>}
    </AccountDirectory>
    {selected && <AffiliateAccountActivity key={selected.key} seller={selected.seller} name={selected.name} email={selected.email} onClose={() => setSelectedAccount(null)} />}
  </>;
}
