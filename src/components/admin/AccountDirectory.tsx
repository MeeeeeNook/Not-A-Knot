import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, History } from 'lucide-react';
import { formatAffiliateAccountDate, validAccountDate } from '../../utils/affiliateActivity';
import { relativeAccountTime, shortAccountDate } from '../../utils/accountUi';

export const accountActionClass = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:opacity-50';
export const accountAddClass = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:opacity-50';

export function AccountCopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch { setState('error'); }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2500);
  };
  return <span className="relative inline-flex shrink-0 items-center gap-1"><button type="button" onClick={copy} title={`Sao chép ${label}`} aria-label={`Sao chép ${label}: ${value}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-rose-700">{state === 'copied' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}</button>{state !== 'idle' && <span role={state === 'error' ? 'alert' : 'status'} className={`absolute bottom-full right-0 z-10 mb-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] shadow-sm ${state === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{state === 'error' ? 'Chưa sao chép được' : 'Đã sao chép'}</span>}</span>;
}

export function AccountDate({ value, relative = false, now }: { value?: string; relative?: boolean; now?: number }) {
  const [expanded, setExpanded] = useState(false);
  const date = validAccountDate(value), full = formatAffiliateAccountDate(date);
  if (!date) return <span className="text-slate-400">Chưa ghi nhận</span>;
  return <button type="button" title={full} aria-label={`Xem thời gian đầy đủ: ${full}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="rounded text-left leading-5 text-slate-600 decoration-dotted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-rose-700"><time dateTime={date}>{expanded ? full : relative ? relativeAccountTime(date, now) : shortAccountDate(date)}</time></button>;
}

export interface AccountDirectoryRow {
  key: string; name: string; email: string; active: boolean;
  createdAt?: string; lastSeenAt?: string; roleLabel?: string;
  onHistory: () => void; actions?: React.ReactNode;
}

export function AccountDirectory({ label, title, description, icon, accounts, action, children }: {
  label: string; title: string; description: string; icon: React.ReactNode;
  accounts: AccountDirectoryRow[]; action?: React.ReactNode; children?: React.ReactNode;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const identity = (account: AccountDirectoryRow) => <div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-sm font-bold text-rose-800">{(account.name || account.email || '?').slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-900">{account.name || 'Chưa có tên'}</p><div className="mt-0.5 flex items-center gap-1"><span className="min-w-0 break-all text-xs text-slate-500">{account.email || 'Chưa có email'}</span>{account.email && <AccountCopyButton value={account.email} label="email" />}</div>{account.roleLabel && <p className="mt-1 text-[11px] font-medium text-slate-500">{account.roleLabel}</p>}</div></div>;
  const status = (active: boolean) => <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />{active ? 'Đã bật' : 'Đã tắt'}</span>;
  const actions = (account: AccountDirectoryRow) => <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={account.onHistory} className={accountActionClass}><History className="h-3.5 w-3.5" />IP & hoạt động</button>{account.actions}</div>;
  return <section aria-label={label} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs sm:rounded-3xl">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5"><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">{icon}</span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{accounts.length}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div></div>{action}</div>
    {children}
    {accounts.length ? <>
      <div className="hidden overflow-x-auto md:block"><table aria-label={label} className="w-full table-fixed text-left text-xs"><colgroup>{[30, 14, 18, 11, 27].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500"><tr>{['Tài khoản', 'Ngày tạo', 'Truy cập gần nhất', 'Trạng thái', 'Thao tác'].map(text => <th key={text} scope="col" className="whitespace-nowrap px-4 py-3 ">{text}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{accounts.map(account => <tr key={account.key} className="transition hover:bg-slate-50/60"><td className="max-w-xs px-4 py-4">{identity(account)}</td><td className="px-4 py-4"><AccountDate value={account.createdAt} now={now} /></td><td className="px-4 py-4"><AccountDate value={account.lastSeenAt} relative now={now} /></td><td className="px-4 py-4">{status(account.active)}</td><td className="px-4 py-4">{actions(account)}</td></tr>)}</tbody></table></div>
      <ul aria-label={`${label} trên điện thoại`} className="divide-y divide-slate-100 md:hidden">{accounts.map(account => <li key={account.key} className="space-y-4 p-4"><div className="flex items-start justify-between gap-3">{identity(account)}{status(account.active)}</div><dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><dt className="mb-1 text-[11px] text-slate-400">Ngày tạo</dt><dd><AccountDate value={account.createdAt} now={now} /></dd></div><div><dt className="mb-1 text-[11px] text-slate-400">Truy cập gần nhất</dt><dd><AccountDate value={account.lastSeenAt} relative now={now} /></dd></div></dl>{actions(account)}</li>)}</ul>
    </> : <p className="p-8 text-center text-xs text-slate-400">Chưa có tài khoản trong danh sách này.</p>}
  </section>;
}
