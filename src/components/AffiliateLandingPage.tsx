import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Link2, X } from 'lucide-react';
import type { Product } from '../types';
import { resolveAssetUrl, saveContactMessageToFirestore } from '../firebase';
import { buildAffiliateRequest } from '../utils/affiliateRequests';
import { LazyProductImage } from './LazyProductImage';

export function AffiliateLandingPage({ products, onLogin }: { products: Product[]; onLogin: () => void }) {
  const [showForm, setShowForm] = useState(false), [sent, setSent] = useState(false), [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', zaloPhone: '', facebookUrl: '' });
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null), requestId = useRef(''), submittingRef = useRef(false);
  const photos = products.filter(product => product.image || product.images?.length).slice(0, 2);
  const close = () => setShowForm(false);
  useLayoutEffect(() => {
    // Reset after the lazy page has mounted, when Safari may retain the footer's scroll position.
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    resetScroll();
    const frame = requestAnimationFrame(resetScroll);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!showForm) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab') return;
      const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]') || [])];
      const first = items[0], last = items[items.length - 1];
      if (!first) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); previousFocus?.focus(); };
  }, [showForm]);
  useEffect(() => { if (sent) dialogRef.current?.querySelector<HTMLElement>('[data-success-title]')?.focus(); }, [sent]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setError('');
    try {
      if (!requestId.current) requestId.current = `affiliate-request-${crypto.randomUUID()}`;
      const message = buildAffiliateRequest(form, requestId.current);
      submittingRef.current = true; setSubmitting(true);
      await saveContactMessageToFirestore(message, { requireServer: true });
      setSent(true);
    } catch (error: any) { setError(error.message?.startsWith('Vui lòng') ? error.message : 'Chưa gửi được yêu cầu. Bạn thử lại giúp chúng mình nhé.'); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };
  const openForm = () => setShowForm(true);
  const photoSrc = (product: Product) => resolveAssetUrl(product.image || product.images?.[0] || '');

  return <div id="affiliate-landing-page" className="bg-[#FAF9F6] text-[#38272b]" style={{ overflowAnchor: 'none' }}>
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14 lg:pt-20">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12" aria-labelledby="affiliate-intro-title">
        <div className="relative z-10">
          <p className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-rose-800"><span className="h-1.5 w-1.5 rounded-full bg-rose-700" />NOT A KNOT · AFFILIATE</p>
          <h1 id="affiliate-intro-title" className="max-w-xl text-[clamp(2.5rem,5.4vw,4.25rem)] font-semibold leading-[1.08] tracking-[-0.055em]">Chia sẻ gu của bạn.<br /><span className="text-rose-800">Nhận thêm<br className="hidden lg:block" /> hoa hồng.</span></h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#7c6c70]">Thích những món phụ kiện thủ công của Not A Knot? Chia sẻ chúng với bạn bè bằng link riêng và nhận hoa hồng từ những đơn hàng hợp lệ.</p>
          <div className="mt-7 flex flex-col items-start gap-4 sm:mt-8">
            <button type="button" onClick={openForm} className="inline-flex items-center gap-5 rounded-full bg-rose-800 px-6 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-800">Đăng ký trở thành affiliate<ArrowUpRight className="h-4 w-4" /></button>
            <button type="button" onClick={onLogin} className="group inline-flex items-center gap-2 px-1 py-1 text-xs text-[#7c6c70]">Đã là affiliate? <span className="font-semibold text-[#38272b] underline decoration-[#d7c8cc] underline-offset-4 group-hover:decoration-rose-800">Đăng nhập</span><ArrowRight className="h-3.5 w-3.5 text-rose-800" /></button>
          </div>
        </div>

        <div className="relative isolate mx-auto aspect-[1.05] w-full max-w-md lg:aspect-square" aria-label="Phụ kiện thủ công Not A Knot">
          <div className="absolute inset-[4%] rounded-[45%_45%_8%_8%] bg-[#f0e2dd]" />
          <svg className="pointer-events-none absolute -inset-x-3 top-0 h-full w-full text-[#d5a6a1]" viewBox="0 0 400 400" fill="none" aria-hidden="true"><path d="M45 308C8 210 52 100 150 78c84-19 178 17 188 91 13 98-162 172-209 118-48-55 95-144 154-93 70 60 6 175-98 165" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 6" /><path d="m329 62 7 18 18 7-18 7-7 18-7-18-18-7 18-7z" fill="currentColor" stroke="none" /></svg>
          {photos[0] ? <div className="absolute left-[5%] top-[6%] h-[72%] w-[72%] -rotate-6 overflow-hidden rounded-2xl border-[7px] border-white bg-white shadow-xl shadow-[#7e4a4a]/10"><LazyProductImage priority src={photoSrc(photos[0])} alt={photos[0].name} wrapperClassName="h-full w-full" className="h-full w-full object-cover" sizes="(max-width: 768px) 75vw, 360px" /></div> : <div className="absolute inset-[18%] -rotate-6 rounded-[40%] border-[18px] border-rose-800/80 shadow-xl"><div className="absolute inset-3 rounded-[40%] border-2 border-dashed border-white/60" /></div>}
          {photos[1] && <div className="absolute bottom-[4%] right-[1%] h-[49%] w-[49%] rotate-[8deg] overflow-hidden rounded-xl border-[6px] border-white bg-white shadow-lg"><LazyProductImage src={photoSrc(photos[1])} alt={photos[1].name} wrapperClassName="h-full w-full" className="h-full w-full object-cover" sizes="(max-width: 768px) 40vw, 220px" /></div>}
          <div className="absolute bottom-[7%] left-[1%] z-10 -rotate-3 rounded-xl border border-white/80 bg-[#fffdf8] px-4 py-3 shadow-md"><Link2 className="mb-1 h-4 w-4 text-rose-800" /><p className="text-xs font-semibold leading-5">Một chiếc link.<br />Thêm kết nối.</p></div>
          <span className="absolute right-[6%] top-[2%] rotate-6 rounded-full bg-rose-800 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white">Handmade, shared by you</span>
        </div>
      </section>

      <section aria-label="Cách tham gia affiliate" className="mt-14 grid gap-6 border-y border-[#e7ded9] py-7 sm:mt-16 sm:grid-cols-3 sm:gap-8 sm:py-9">
        {[
          ['01', 'Để lại thông tin', 'Cho chúng mình biết bạn là ai và cách liên hệ.'],
          ['02', 'Nhận link của riêng bạn', 'Sau khi được duyệt, đăng nhập để lấy link và xem thiết lập hoa hồng.'],
          ['03', 'Chia sẻ & nhận hoa hồng', 'Theo dõi đơn hàng và hoa hồng ngay trong affiliate hub.']
        ].map(([number, title, description]) => <div key={number} className="flex gap-4"><span className="pt-0.5 font-mono text-xs text-[#b39b9e]">{number}</span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-2 max-w-xs text-xs leading-6 text-[#8a787d]">{description}</p></div></div>)}
      </section>
      <section className="mt-8 flex flex-col items-start justify-between gap-5 rounded-2xl bg-[#542a35] px-6 py-7 text-[#fff7ef] sm:flex-row sm:items-center sm:px-8">
        <div><p className="text-xl font-medium tracking-tight">Cùng gu, cùng kết nối.</p><p className="mt-2 text-xs text-[#e3c7cc]">Bắt đầu hành trình affiliate cùng Not A Knot.</p></div>
        <button type="button" onClick={openForm} className="inline-flex shrink-0 items-center gap-5 rounded-full bg-[#fff7ef] px-5 py-3 text-xs font-semibold text-[#542a35] transition hover:bg-white">Tham gia cùng chúng mình<ArrowUpRight className="h-4 w-4" /></button>
      </section>
    </div>

    {showForm && createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#24141b]/55 p-4 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="affiliate-request-title" aria-describedby="affiliate-request-description" className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-[#fffdf9] p-6 text-[#38272b] shadow-2xl sm:p-8">
        <button type="button" onClick={close} aria-label="Đóng đăng ký affiliate" className="absolute right-4 top-4 rounded-full p-2 text-[#9b858b] hover:bg-rose-50"><X className="h-4 w-4" /></button>
        {sent ? <div className="py-7 text-center"><CheckCircle2 className="mx-auto mb-5 h-12 w-12 text-rose-800" /><h2 id="affiliate-request-title" data-success-title tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">Đã nhận đăng ký của bạn!</h2><p id="affiliate-request-description" className="mt-3 text-sm leading-7 text-[#8a787d]">Not A Knot sẽ xem yêu cầu và liên hệ qua thông tin bạn đã cung cấp.</p><button type="button" onClick={close} className="mt-6 inline-flex items-center gap-2 rounded-full bg-rose-800 px-6 py-3 text-sm font-semibold text-white">Xong rồi<Check className="h-4 w-4" /></button></div> : <>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-800">LET'S CONNECT</p>
          <h2 id="affiliate-request-title" className="pr-5 text-2xl font-semibold tracking-tight">Làm quen một chút nhé.</h2>
          <p id="affiliate-request-description" className="mt-3 text-xs leading-6 text-[#8a787d]">Để lại thông tin, chúng mình sẽ liên hệ về đăng ký affiliate của bạn.</p>
          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            {([['name', 'Tên của bạn', 'Bạn tên là…', 'text', 'name'], ['email', 'Email', 'ban@email.com', 'email', 'email'], ['facebookUrl', 'Link Facebook', 'https://www.facebook.com/…', 'text', 'url'], ['zaloPhone', 'Số điện thoại Zalo', 'Số điện thoại bạn dùng Zalo', 'tel', 'tel']] as const).map(([key, label, placeholder, type, autoComplete]) => <div key={key}><label htmlFor={`affiliate-request-${key}`} className="mb-2 block text-xs font-semibold">{label}{key === 'zaloPhone' ? ' (tùy chọn)' : ' *'}</label><input id={`affiliate-request-${key}`} type={type} autoComplete={autoComplete} inputMode={key === 'facebookUrl' ? 'url' : key === 'email' ? 'email' : key === 'zaloPhone' ? 'tel' : 'text'} maxLength={key === 'facebookUrl' ? 2000 : key === 'name' ? 120 : key === 'email' ? 254 : 60} value={form[key]} onChange={event => { setForm({ ...form, [key]: event.target.value }); setError(''); }} disabled={submitting} required={key !== 'zaloPhone'} className="w-full rounded-xl border border-[#e7ded9] bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-[#b6a5a8] focus:border-rose-700 focus:ring-2 focus:ring-rose-100 disabled:opacity-60" placeholder={placeholder} /></div>)}
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-800">{error}</p>}
            <p className="text-[11px] leading-5 text-[#9b858b]">Thông tin này chỉ dùng để liên hệ và xử lý đăng ký affiliate của bạn.</p>
            <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-3 rounded-full bg-rose-800 px-5 py-3.5 text-sm font-semibold text-white hover:bg-rose-900 disabled:cursor-wait disabled:opacity-60">{submitting ? 'Đang gửi yêu cầu…' : 'Gửi yêu cầu'}{!submitting && <ArrowRight className="h-4 w-4" />}</button>
          </form>
        </>}
      </div>
    </div>, document.body)}
  </div>;
}
