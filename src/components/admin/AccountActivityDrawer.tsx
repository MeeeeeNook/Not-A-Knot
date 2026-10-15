import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, LogIn, MousePointerClick, X } from 'lucide-react';
import { AccountCopyButton } from './AccountDirectory';
import { formatAffiliateAccountDate } from '../../utils/affiliateActivity';

export interface AccountHistoryEntry {
  id: string; title: string; timestamp: string; kind: 'login' | 'activity';
  ip?: string; device?: string; description?: string; status?: string;
}

export function AccountActivityDrawer({ name, email, createdAt, lastLoginAt, ip, device, entries, loading, error, note, actions, notice, onClose }: {
  name: string; email: string; createdAt?: string; lastLoginAt?: string; ip?: string; device?: string;
  entries: AccountHistoryEntry[]; loading?: boolean; error?: string; note?: string;
  actions?: React.ReactNode; notice?: React.ReactNode; onClose: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'login' | 'activity'>('all');
  const overlay = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null), closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    const siblings = [...document.body.children].filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlay.current).map(element => ({ element, inert: element.inert }));
    siblings.forEach(({ element }) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('[data-drawer-close]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]') || [])];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; siblings.forEach(({ element, inert }) => { element.inert = inert; }); document.removeEventListener('keydown', onKey); previousFocus?.focus(); };
  }, []);
  const visible = entries.filter(entry => filter === 'all' || entry.kind === filter);
  const filters = [{ id: 'all' as const, title: 'Tất cả' }, { id: 'login' as const, title: 'Đăng nhập' }, { id: 'activity' as const, title: 'Thao tác' }];
  return createPortal(<div ref={overlay} className="fixed inset-0 z-[200] flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="flex h-dvh w-full flex-col bg-white shadow-2xl sm:max-w-xl">
      <header className="shrink-0 border-b border-slate-100 px-5 pb-5 pt-6 sm:px-6"><div className="flex items-start justify-between gap-3"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700">Nhật ký tài khoản</p><h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-900">IP & hoạt động · {name || 'Tài khoản'}</h2><div id={descriptionId} className="mt-1 flex items-center gap-1 text-xs text-slate-500"><span className="min-w-0 break-all">{email || 'Chưa có email'}</span>{email && <AccountCopyButton value={email} label="email" />}</div></div><button type="button" data-drawer-close onClick={onClose} aria-label="Đóng lịch sử tài khoản" className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-rose-700"><X className="h-5 w-5" /></button></div></header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
        <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs"><div><dt className="mb-1 text-[11px] text-slate-500">Ngày tạo</dt><dd className="leading-5 text-slate-800">{formatAffiliateAccountDate(createdAt)}</dd></div><div><dt className="mb-1 text-[11px] text-slate-500">Đăng nhập gần nhất</dt><dd className="leading-5 text-slate-800">{formatAffiliateAccountDate(lastLoginAt)}</dd></div><div><dt className="mb-1 text-[11px] text-slate-500">IP gần nhất</dt><dd className="flex items-center gap-1"><span className="min-w-0 break-all font-mono text-slate-700">{ip || 'Chưa ghi nhận'}</span>{ip && <AccountCopyButton value={ip} label="IP" />}</dd></div><div><dt className="mb-1 text-[11px] text-slate-500">Thiết bị gần nhất</dt><dd className="break-words leading-5 text-slate-800">{device || 'Chưa ghi nhận'}</dd></div></dl>
        {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">{error}</p>}{notice}
        <div role="group" aria-label="Lọc lịch sử tài khoản" className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">{filters.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-2 text-[11px] font-semibold sm:px-2 sm:text-xs transition focus-visible:outline-2 focus-visible:outline-rose-700 ${filter === item.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>{item.title}<span className="text-[10px] font-normal text-slate-400">{entries.filter(entry => item.id === 'all' || entry.kind === item.id).length}</span></button>)}</div>
        {loading && <p role="status" className="mb-4 text-xs text-slate-500">Đang tải lịch sử…</p>}
        {visible.length ? <ol aria-label="Lịch sử hoạt động tài khoản" className="space-y-0">{visible.map((entry, index) => <li key={entry.id} className="relative flex gap-3 pb-6 last:pb-1">{index < visible.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-4 top-8 border-l border-slate-200" />}<span aria-hidden="true" className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${entry.kind === 'login' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{entry.kind === 'login' ? <LogIn className="h-3.5 w-3.5" /> : <MousePointerClick className="h-3.5 w-3.5" />}</span><div className="min-w-0 flex-1 pt-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-semibold leading-5 text-slate-800">{entry.title}</h3>{entry.status && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{entry.status}</span>}</div><time dateTime={entry.timestamp} className="mt-0.5 block text-[11px] text-slate-400">{formatAffiliateAccountDate(entry.timestamp)}</time>{entry.description && <p className="mt-2 break-words text-xs leading-5 text-slate-500">{entry.description}</p>}<div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500"><div className="flex items-center gap-1"><span className="min-w-0 break-all font-mono">IP: {entry.ip || 'Chưa ghi nhận'}</span>{entry.ip && <AccountCopyButton value={entry.ip} label="IP" />}</div><p className="mt-1 break-words leading-5">{entry.device || 'Chưa ghi nhận thiết bị'}</p></div></div></li>)}</ol> : !loading && <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center"><History className="mx-auto mb-3 h-6 w-6 text-slate-300" /><p className="text-xs font-medium text-slate-500">{entries.length ? 'Chưa có hoạt động trong bộ lọc này.' : 'Chưa có hoạt động được ghi nhận.'}</p></div>}
      </div>
      <footer className="shrink-0 space-y-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6"><p className="text-[11px] leading-5 text-slate-500">Hiển thị {visible.length}/{entries.length} bản ghi.{note && ` ${note}`}</p>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</footer>
    </div>
  </div>, document.body);
}
