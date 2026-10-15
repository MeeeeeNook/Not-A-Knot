import React from 'react';
import { ArrowUpRight, Check, Inbox } from 'lucide-react';
import type { ContactMessage } from '../../types';
import { normalizeFacebookUrl } from '../../utils/affiliateRequests';

export function AffiliateRequestsPanel({ messages, onMarkRead }: { messages: ContactMessage[]; onMarkRead?: (message: ContactMessage) => void }) {
  const requests = messages.filter(message => message.type === 'affiliate_request').sort((a, b) => b.timestamp - a.timestamp);
  const unread = requests.filter(request => !request.isRead).length;
  return <section aria-label="Yêu cầu trở thành affiliate" className="overflow-hidden rounded-2xl border border-rose-100 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 bg-rose-50/50 px-4 py-4 sm:px-5">
      <div className="flex items-center gap-2"><Inbox className="h-4 w-4 text-rose-700" /><h2 className="text-sm font-bold text-slate-900">Yêu cầu trở thành affiliate</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs text-rose-700">{requests.length}</span></div>
      {unread > 0 && <span className="text-xs font-semibold text-rose-700">{unread} yêu cầu mới</span>}
    </div>
    {requests.length === 0 ? <p className="px-5 py-5 text-xs text-slate-500">Chưa có yêu cầu đăng ký. Yêu cầu mới sẽ hiện ở đây và trong hộp thư liên hệ.</p> : <div className="divide-y divide-slate-100">
      {requests.map(request => {
        const facebookUrl = normalizeFacebookUrl(request.facebookUrl || '');
        return <article key={request.id} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-center">
          <div><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-slate-900">{request.name}</h3>{!request.isRead && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">Mới</span>}</div><p className="mt-1 text-[11px] text-slate-400">{new Date(request.createdAt || request.timestamp).toLocaleString('vi-VN')}</p></div>
          <div className="min-w-0 space-y-1.5 text-xs"><p className="text-slate-600">Zalo: <span className="font-semibold text-slate-900 select-all">{request.phone || request.contactInfo}</span></p>{facebookUrl && <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-rose-700 hover:underline"><span className="truncate">{facebookUrl}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></a>}</div>
          <div>{request.isRead ? <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Check className="h-3.5 w-3.5" />Đã xem</span> : onMarkRead && <button type="button" onClick={() => onMarkRead(request)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Đánh dấu đã xem</button>}</div>
        </article>;
      })}
    </div>}
  </section>;
}
