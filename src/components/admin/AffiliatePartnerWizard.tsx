import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Copy, Plus, Search, Trash2, X } from 'lucide-react';
import type { AffiliateSystemConfig, CategoryItem, CollectionInfo, Product, SellerUser } from '../../types';
import { calculateDetailedAffiliateCommission, generateAffiliateCode, getAffiliateReferralUrl } from '../../utils/affiliateManager';
import { buildAffiliatePartner, createAffiliatePartnerDraft, isValidCommissionRate, validateAffiliatePartnerStep, type AffiliatePartnerDraft } from '../../utils/affiliatePartnerForm';
import { getStorefrontCategoryOptions, isCatalogItemHidden, isProductMatchingCategory } from '../../utils/storefrontCatalog';

interface Props {
  affiliate: SellerUser | null;
  sellers: SellerUser[];
  products: Product[];
  categories: CategoryItem[];
  collections: CollectionInfo[];
  config: AffiliateSystemConfig;
  onSave: (partner: SellerUser) => Promise<void>;
  onClose: () => void;
}

const steps = [
  { title: 'Email & tên', description: 'Chọn tài khoản Google và tên hiển thị cho đối tác.' },
  { title: 'Mã & trạng thái', description: 'Thiết lập mã giới thiệu và quyền hoạt động của tài khoản.' },
  { title: 'Ghi nhận đơn', description: 'Chọn thời gian lưu giới thiệu và số đơn được ghi nhận.' },
  { title: 'Hoa hồng', description: 'Chọn cách tính hoa hồng và các tỷ lệ áp dụng.' },
  { title: 'Kiểm tra & lưu', description: 'Bổ sung thông tin nhận tiền và kiểm tra toàn bộ cấu hình.' }
];
const inputClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-50 read-only:bg-slate-50';
const boxClass = 'rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3';
const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`;

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-1.5"><label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800">{label}</label>{children}{hint && <p className="text-xs leading-relaxed text-slate-500">{hint}</p>}</div>;
}

export function AffiliatePartnerWizard({ affiliate, sellers, products, categories, collections, config, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(() => createAffiliatePartnerDraft(affiliate, config, generateAffiliateCode('', sellers)));
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState(0);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [includeHidden, setIncludeHidden] = useState(false);
  const [productId, setProductId] = useState('');
  const [productRate, setProductRate] = useState('15');
  const [bulkCategory, setBulkCategory] = useState('');
  const [notice, setNotice] = useState('');
  const [tierMin, setTierMin] = useState('0');
  const [tierMax, setTierMax] = useState('200000');
  const [tierRate, setTierRate] = useState('10');
  const [previewProductId, setPreviewProductId] = useState('');
  const [previewSubtotal, setPreviewSubtotal] = useState('200000');
  const [previewDiscount, setPreviewDiscount] = useState('0');
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const savingRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const patch = <K extends keyof AffiliatePartnerDraft>(key: K, value: AffiliatePartnerDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value })); setError('');
  };

  // A portal keeps the dialog above the admin header and outside transformed/clipped parents.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!savingRef.current) closeRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); previousFocus?.focus(); };
  }, []);
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); titleRef.current?.focus(); }, [step]);
  useEffect(() => { if (error) contentRef.current?.scrollTo({ top: 0 }); }, [error]);

  const hiddenCategoryIds = useMemo(() => new Set(categories.filter(isCatalogItemHidden).map((c) => c.id)), [categories]);
  const currentProducts = useMemo(() => products.filter((p) => includeHidden || (!isCatalogItemHidden(p) && !hiddenCategoryIds.has(p.category))), [products, includeHidden, hiddenCategoryIds]);
  const productOptions = currentProducts.filter((p) => `${p.name} ${p.id}`.toLowerCase().includes(productSearch.toLowerCase().trim()));
  const selectedProduct = productOptions.find((p) => p.id === productId);
  const categoryOptions = useMemo(() => getStorefrontCategoryOptions(currentProducts, categories, collections), [currentProducts, categories, collections]);
  const bulkProducts = bulkCategory ? currentProducts.filter((p) => isProductMatchingCategory(p, bulkCategory, collections)) : [];
  const previewProduct = currentProducts.find((p) => p.id === previewProductId) || currentProducts[0];
  const subtotal = Math.max(0, Number(previewSubtotal) || 0);
  const discount = Math.min(subtotal, Math.max(0, Number(previewDiscount) || 0));
  const preview = calculateDetailedAffiliateCommission({ ...affiliate, commissionRate: isValidCommissionRate(draft.rate) ? Number(draft.rate) : 0, commissionModel: draft.model, productCommissions: draft.productRates, tieredCommissions: draft.tiers } as SellerUser,
    previewProduct ? [{ productId: previewProduct.id, productName: previewProduct.name, price: subtotal, quantity: 1 }] : [], subtotal, discount, config.defaultCommissionRate);
  const limitLabel = draft.maxOrdersMode === 'unlimited' ? 'Không giới hạn trong thời hạn cookie' : draft.maxOrdersMode === 'custom' ? `Tối đa ${draft.maxOrders} đơn / lượt giới thiệu` : '1 đơn đầu tiên';
  const modelLabel = draft.model === 'by_product' ? 'Theo từng sản phẩm' : draft.model === 'tiered' ? 'Theo giá trị từng đơn' : 'Tỷ lệ cố định';
  const referralUrl = getAffiliateReferralUrl(draft.code.trim().toUpperCase());

  const goTo = (target: number) => { setStep(target); setVisited((v) => Math.max(v, target)); setError(''); setNotice(''); };
  const findInvalidStep = (lastStep: number) => {
    for (let i = 0; i <= lastStep; i++) {
      const issue = validateAffiliatePartnerStep(draft, i, sellers, affiliate);
      if (issue) { setStep(i); setError(issue); return true; }
    }
    return false;
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (step < 4) {
      if (step === 3 && draft.model === 'by_product' && selectedProduct) { setError('Bạn đã chọn sản phẩm nhưng chưa áp dụng tỷ lệ. Nhấn “Áp dụng mức riêng” hoặc bỏ chọn sản phẩm.'); return; }
      if (!findInvalidStep(step)) goTo(step + 1);
      return;
    }
    if (findInvalidStep(3)) return;
    savingRef.current = true; setIsSaving(true); setError('');
    try { await onSave(buildAffiliatePartner(draft, affiliate, sellers)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Không thể lưu đối tác. Dữ liệu bạn nhập vẫn được giữ để thử lại.'); }
    finally { savingRef.current = false; setIsSaving(false); }
  };
  const applyProductRates = (targets: Product[]) => {
    if (!targets.length) { setError('Chọn sản phẩm hoặc danh mục có sản phẩm hiện tại.'); return; }
    if (!isValidCommissionRate(productRate)) { setError('Tỷ lệ riêng phải từ 0 đến 100%.'); return; }
    const ids = new Set(targets.map((p) => p.id));
    patch('productRates', [...draft.productRates.filter((p) => !ids.has(p.productId)), ...targets.map((p) => ({ productId: p.id, productName: p.name, rate: Number(productRate) }))]);
    setProductId(''); setNotice(`Đã áp dụng ${productRate}% cho ${targets.length} sản phẩm.`);
  };
  const addTier = () => {
    const min = Number(tierMin), max = tierMax.trim() ? Number(tierMax) : undefined;
    if (!tierMin.trim() || !Number.isSafeInteger(min) || min < 0 || (max !== undefined && (!Number.isSafeInteger(max) || max <= min)) || !isValidCommissionRate(tierRate)) { setError('Nhập mức tiền nguyên không âm, mức đến lớn hơn mức từ và tỷ lệ từ 0 đến 100%.'); return; }
    if (draft.tiers.some((t) => min < (t.maxAmount || Infinity) && (max ?? Infinity) > t.minAmount)) { setError('Bậc mới bị chồng lấn với bậc đã có. Xóa bậc cần thay trước khi thêm.'); return; }
    patch('tiers', [...draft.tiers, { minAmount: min, maxAmount: max, rate: Number(tierRate) }].sort((a, b) => a.minAmount - b.minAmount));
    setTierMin(max !== undefined ? String(max) : ''); setTierMax(''); setNotice('Đã thêm bậc hoa hồng.');
  };
  const copyLink = async () => { try { await navigator.clipboard.writeText(referralUrl); setCopied(true); } catch { setNotice('Bạn có thể chọn và sao chép liên kết bên dưới.'); } };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/65 p-2 sm:p-4 backdrop-blur-sm">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="partner-dialog-title" className="flex w-full max-w-3xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        <header className="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Đối tác tiếp thị</p><h2 id="partner-dialog-title" className="mt-1 text-lg font-bold">{affiliate ? 'Chỉnh sửa đối tác' : 'Thêm đối tác mới'}</h2></div>
            <button type="button" aria-label="Đóng form đối tác" onClick={onClose} disabled={isSaving} className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X className="h-5 w-5" /></button>
          </div>
          <nav aria-label="Các bước thiết lập đối tác" className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-3">
            {steps.map((item, index) => <button key={item.title} type="button" aria-current={step === index ? 'step' : undefined} aria-label={`Bước ${index + 1}: ${item.title}`} disabled={index > visited || isSaving} onClick={() => goTo(index)} className={`min-w-0 rounded-lg px-1 py-2 text-left text-xs disabled:cursor-default ${step === index ? 'bg-amber-50 text-amber-900' : 'text-slate-500'}`}><span className={`mb-1 block h-1 rounded-full ${index <= step ? 'bg-amber-400' : 'bg-slate-200'}`} /><span className="flex items-center gap-1"><span className="font-bold">{index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}</span><span className="hidden truncate sm:inline">{item.title}</span></span></button>)}
          </nav>
        </header>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
            <div className="mb-5"><p className="text-xs text-slate-500">Bước {step + 1} / 5</p><h3 ref={titleRef} tabIndex={-1} className="mt-1 text-xl font-bold outline-none">{steps[step].title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-500">{steps[step].description}</p></div>
            {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
            {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
            <fieldset disabled={isSaving} className="min-w-0 space-y-5 border-0 p-0">
              {step === 0 && <>
                <Field label="Email Google *" htmlFor="partner-email" hint={affiliate?.googleEmail ? 'Email đã cấp quyền đăng nhập được giữ nguyên khi chỉnh sửa đối tác.' : 'Đối tác sẽ đăng nhập bằng đúng tài khoản Google này; không cần tạo mật khẩu riêng.'}><input id="partner-email" type="email" autoComplete="email" readOnly={Boolean(affiliate?.googleEmail)} value={draft.email} onChange={(e) => patch('email', e.target.value)} placeholder="doitac@gmail.com" className={inputClass} /></Field>
                <Field label="Tên hiển thị *" htmlFor="partner-name" hint="Tên hiển thị trong trang quản lý và tài khoản affiliate."><input id="partner-name" autoComplete="name" value={draft.name} onChange={(e) => patch('name', e.target.value)} placeholder="VD: An Nguyễn" className={inputClass} /></Field>
              </>}
              {step === 1 && <>
                <Field label="Mã tiếp thị *" htmlFor="partner-code" hint="Mã riêng dùng trong link giới thiệu. Thay đổi mã sẽ làm link cũ không còn nhận diện đúng đối tác."><div className="flex gap-2"><input id="partner-code" value={draft.code} onChange={(e) => { patch('code', e.target.value.toUpperCase()); setCopied(false); }} maxLength={40} className={`${inputClass} font-mono`} /><button type="button" onClick={() => patch('code', generateAffiliateCode(draft.name, sellers.filter((s) => s.id !== affiliate?.id)))} className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-semibold">Gợi ý mã</button></div></Field>
                <div className={boxClass}><p className="text-xs font-semibold text-slate-600">Link giới thiệu</p><p className="break-all text-xs text-slate-700 select-all">{referralUrl}</p></div>
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" checked={draft.isActive} onChange={(e) => patch('isActive', e.target.checked)} className="mt-1 h-4 w-4 accent-amber-500" /><span><strong className="text-sm">Kích hoạt tài khoản đối tác</strong><span className="mt-1 block text-xs leading-relaxed text-slate-500">Bỏ chọn để lưu tài khoản ở trạng thái tạm khóa. Đơn cũ và hoa hồng đã ghi nhận được giữ lại.</span></span></label>
              </>}
              {step === 2 && <>
                <Field label="Thời hạn cookie (ngày)" htmlFor="partner-cookie" hint={`Để trống để dùng mặc định cửa hàng: ${config.cookieDurationDays} ngày. Mở link giới thiệu mới bắt đầu lại thời hạn theo nguyên tắc lượt nhấp cuối.`}><input id="partner-cookie" type="number" min={1} max={365} step={1} value={draft.cookieDays} onChange={(e) => patch('cookieDays', e.target.value)} placeholder={`Mặc định ${config.cookieDurationDays} ngày`} className={inputClass} /></Field>
                <div className="flex flex-wrap gap-2">{['', '7', '30', '60', '90'].map((days) => <button type="button" key={days} aria-pressed={draft.cookieDays === days} onClick={() => patch('cookieDays', days)} className={`rounded-lg border px-3 py-1.5 text-xs ${draft.cookieDays === days ? 'border-amber-400 bg-amber-50 font-semibold' : 'border-slate-200'}`}>{days ? `${days} ngày` : 'Mặc định cửa hàng'}</button>)}</div>
                <div><p className="mb-2 text-sm font-semibold">Số đơn mỗi lượt giới thiệu</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{[
                  ['first_only', '1 đơn đầu tiên', 'Kết thúc lượt giới thiệu sau đơn đặt thành công đầu tiên.'], ['custom', 'Số đơn cụ thể', 'Giữ giới thiệu đến khi đủ số đơn hoặc hết thời hạn.'], ['unlimited', 'Không giới hạn', 'Ghi nhận các đơn trong thời hạn cookie.']
                ].map(([value, label, description]) => <button type="button" key={value} aria-pressed={draft.maxOrdersMode === value} onClick={() => patch('maxOrdersMode', value as AffiliatePartnerDraft['maxOrdersMode'])} className={`rounded-xl border p-3 text-left ${draft.maxOrdersMode === value ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : 'border-slate-200 bg-white'}`}><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span></button>)}</div></div>
                {draft.maxOrdersMode === 'custom' && <Field label="Số đơn tối đa *" htmlFor="partner-max-orders"><input id="partner-max-orders" type="number" min={2} max={100} step={1} value={draft.maxOrders} onChange={(e) => patch('maxOrders', e.target.value)} className={inputClass} /></Field>}
                <p className="text-xs leading-relaxed text-slate-500">Số lượt được tính khi đặt đơn thành công; hủy đơn sau đó không tự hoàn lại lượt đã dùng.</p>
              </>}
              {step === 3 && <>
                <Field label="Tỷ lệ hoa hồng cơ bản (%) *" htmlFor="partner-rate" hint="Dùng cho cơ chế cố định hoặc sản phẩm chưa có tỷ lệ riêng. Có thể đặt 0%."><input id="partner-rate" type="number" min={0} max={100} step="any" value={draft.rate} onChange={(e) => patch('rate', e.target.value)} className={inputClass} /></Field>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{[['standard', 'Tỷ lệ cố định'], ['by_product', 'Theo từng sản phẩm'], ['tiered', 'Theo giá trị từng đơn']].map(([value, label]) => <button type="button" key={value} aria-pressed={draft.model === value} onClick={() => { patch('model', value as AffiliatePartnerDraft['model']); setProductId(''); }} className={`rounded-xl border p-3 text-left text-sm font-semibold ${draft.model === value ? 'border-purple-400 bg-purple-50 text-purple-900 ring-1 ring-purple-200' : 'border-slate-200'}`}>{label}</button>)}</div>
                {draft.model === 'by_product' && <div className={boxClass}>
                  <h4 className="text-sm font-bold">Tỷ lệ riêng theo sản phẩm</h4>
                  <p className="text-xs leading-relaxed text-slate-500">Danh sách lấy từ dữ liệu hiện tại của cửa hàng. Các sản phẩm chưa đặt riêng dùng {draft.rate || '0'}%.</p>
                  <Field label="Tìm sản phẩm" htmlFor="partner-product-search"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input id="partner-product-search" value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setProductId(''); }} placeholder="Tên hoặc mã sản phẩm..." className={`${inputClass} pl-9`} /></div></Field>
                  <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={includeHidden} onChange={(e) => { setIncludeHidden(e.target.checked); setProductId(''); }} className="accent-amber-500" />Bao gồm sản phẩm và danh mục đang ẩn</label>
                  <Field label="Sản phẩm cần đặt tỷ lệ" htmlFor="partner-product"><select id="partner-product" value={selectedProduct?.id || ''} onChange={(e) => setProductId(e.target.value)} className={inputClass}><option value="">Chọn sản phẩm ({productOptions.length})</option>{productOptions.map((p) => <option value={p.id} key={p.id}>{p.name} — {money(p.price)}{isCatalogItemHidden(p) || hiddenCategoryIds.has(p.category) ? ' (đang ẩn)' : ''}</option>)}</select></Field>
                  {!productOptions.length && <p className="text-xs text-slate-500">Không có sản phẩm phù hợp. Thử từ khóa khác hoặc kiểm tra dữ liệu cửa hàng.</p>}
                  <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto]"><Field label="Tỷ lệ riêng (%)" htmlFor="partner-product-rate"><input id="partner-product-rate" type="number" min={0} max={100} step="any" value={productRate} onChange={(e) => setProductRate(e.target.value)} className={inputClass} /></Field><button type="button" disabled={!selectedProduct} onClick={() => selectedProduct && applyProductRates([selectedProduct])} className="rounded-xl bg-purple-600 px-4 py-3 text-xs font-semibold text-white disabled:opacity-40">Áp dụng mức riêng</button></div>
                  <details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-xs font-semibold">Áp dụng nhanh cho một danh mục</summary><div className="mt-3 space-y-3"><Field label="Danh mục áp dụng" htmlFor="partner-bulk-category"><select id="partner-bulk-category" value={categoryOptions.some((c) => c.id === bulkCategory) ? bulkCategory : ''} onChange={(e) => setBulkCategory(e.target.value)} className={inputClass}><option value="">Chọn danh mục</option>{categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field><p className="text-xs text-slate-500">Dùng tỷ lệ {productRate || '0'}% ở trên, thay thế mức riêng của {bulkProducts.length} sản phẩm hiện tại. Sản phẩm thêm sau này dùng tỷ lệ cơ bản.</p><button type="button" disabled={!bulkProducts.length} onClick={() => applyProductRates(bulkProducts)} className="rounded-lg border border-purple-200 px-3 py-2 text-xs font-semibold text-purple-700 disabled:opacity-40">Áp dụng cho {bulkProducts.length} sản phẩm</button></div></details>
                  {draft.productRates.map((item) => { const product = products.find((p) => p.id === item.productId); return <div key={item.productId} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3"><div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold">{product?.name || item.productName || item.productId}</p>{!product && <p className="text-[11px] text-amber-700">Không còn trong danh sách sản phẩm hiện tại</p>}</div><input aria-label={`Hoa hồng ${product?.name || item.productName || item.productId}`} type="number" min={0} max={100} step="any" value={Number.isFinite(item.rate) ? item.rate : ''} onChange={(e) => patch('productRates', draft.productRates.map((p) => p.productId === item.productId ? { ...p, rate: e.target.value === '' ? NaN : Number(e.target.value) } : p))} className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-xs" /><span className="text-xs">%</span><button type="button" aria-label={`Xóa tỷ lệ ${product?.name || item.productName || item.productId}`} onClick={() => patch('productRates', draft.productRates.filter((p) => p.productId !== item.productId))} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div>; })}
                  {!draft.productRates.length && <p className="text-xs text-slate-500">Chưa có mức riêng. Hiện tất cả sản phẩm dùng tỷ lệ cơ bản.</p>}
                </div>}
                {draft.model === 'tiered' && <div className={boxClass}>
                  <h4 className="text-sm font-bold">Bậc theo giá trị từng đơn</h4><p className="text-xs leading-relaxed text-slate-500">Chọn tỷ lệ dựa trên tiền sản phẩm sau giảm giá của mỗi đơn, không tính phí giao hàng. Áp dụng tỷ lệ đó cho toàn bộ giá trị đơn; không cộng dồn theo tháng.</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Field label="Từ mức (đ)" htmlFor="partner-tier-min"><input id="partner-tier-min" type="number" min={0} step={1} value={tierMin} onChange={(e) => setTierMin(e.target.value)} className={inputClass} /></Field><Field label="Đến dưới mức (đ)" htmlFor="partner-tier-max" hint="Bỏ trống = không giới hạn"><input id="partner-tier-max" type="number" min={1} step={1} value={tierMax} onChange={(e) => setTierMax(e.target.value)} placeholder="Không giới hạn" className={inputClass} /></Field><Field label="Hoa hồng (%)" htmlFor="partner-tier-rate"><input id="partner-tier-rate" type="number" min={0} max={100} step="any" value={tierRate} onChange={(e) => setTierRate(e.target.value)} className={inputClass} /></Field></div>
                  <button type="button" onClick={addTier} className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" />Thêm bậc</button>
                  {draft.tiers.map((tier, index) => <div key={index} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs"><span className="min-w-0 flex-1">Từ {money(tier.minAmount)}{tier.maxAmount ? ` đến dưới ${money(tier.maxAmount)}` : ' trở lên'}</span><strong>{tier.rate}%</strong><button type="button" aria-label={`Xóa bậc ${index + 1}`} onClick={() => patch('tiers', draft.tiers.filter((_, i) => i !== index))} className="p-2 text-slate-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div>)}
                  <p className="text-xs text-slate-500">Các bậc cần liền nhau từ 0đ; bậc cuối không giới hạn để tránh đơn rơi vào khoảng chưa cấu hình.</p>
                </div>}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3"><h4 className="text-sm font-bold">Thử tính hoa hồng</h4>
                  {draft.model === 'by_product' && <Field label="Sản phẩm minh họa" htmlFor="partner-preview-product"><select id="partner-preview-product" value={previewProduct?.id || ''} onChange={(e) => { setPreviewProductId(e.target.value); const product = products.find((p) => p.id === e.target.value); if (product) setPreviewSubtotal(String(product.price)); }} className={inputClass}><option value="" disabled>Chọn sản phẩm</option>{currentProducts.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></Field>}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Tiền sản phẩm minh họa (đ)" htmlFor="partner-preview-subtotal"><input id="partner-preview-subtotal" type="number" min={0} value={previewSubtotal} onChange={(e) => setPreviewSubtotal(e.target.value)} className={inputClass} /></Field><Field label="Giảm giá minh họa (đ)" htmlFor="partner-preview-discount"><input id="partner-preview-discount" type="number" min={0} max={subtotal} value={previewDiscount} onChange={(e) => setPreviewDiscount(e.target.value)} className={inputClass} /></Field></div>
                  <p className="text-sm">Hoa hồng minh họa: <strong data-testid="commission-preview" className="text-amber-900">{money(preview.commissionAmount)}</strong> <span className="text-xs text-slate-500">({preview.effectiveRate}%)</span></p><p className="text-xs text-slate-500">Chỉ tính thử, không tạo đơn và không thay đổi dữ liệu thanh toán.</p>
                </div>
              </>}
              {step === 4 && <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Số điện thoại / Zalo" htmlFor="partner-phone" hint="Không bắt buộc; dùng để liên hệ đối soát."><input id="partner-phone" type="tel" autoComplete="tel" value={draft.phone} onChange={(e) => patch('phone', e.target.value)} className={inputClass} /></Field><Field label="Thông tin nhận hoa hồng" htmlFor="partner-payment" hint="Tên ngân hàng, số tài khoản và chủ tài khoản. Có thể bổ sung sau."><textarea id="partner-payment" rows={3} value={draft.paymentInfo} onChange={(e) => patch('paymentInfo', e.target.value)} placeholder="VD: MB Bank · STK · CHỦ TÀI KHOẢN" className={`${inputClass} resize-y`} /></Field></div>
                <div className={boxClass}><div className="flex items-center justify-between"><h4 className="text-sm font-bold">Kiểm tra trước khi lưu</h4><span className={`rounded-full px-2 py-1 text-xs font-semibold ${draft.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{draft.isActive ? 'Đang hoạt động' : 'Tạm khóa'}</span></div>
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{[['Tên đối tác', draft.name], ['Email Google', draft.email], ['Mã tiếp thị', draft.code], ['Thời hạn cookie', `${draft.cookieDays || config.cookieDurationDays} ngày${draft.cookieDays ? '' : ' (mặc định cửa hàng)'}`], ['Số đơn', limitLabel], ['Hoa hồng', `${modelLabel} · cơ bản ${draft.rate}%`]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl>
                  {draft.model === 'by_product' && <div className="space-y-1 border-t border-slate-200 pt-3"><p className="text-xs font-semibold">{draft.productRates.length} sản phẩm có mức riêng</p>{draft.productRates.map((p) => <p className="break-words text-xs" key={p.productId}>{products.find((item) => item.id === p.productId)?.name || p.productName || p.productId}: <strong>{p.rate}%</strong></p>)}</div>}
                  {draft.model === 'tiered' && <div className="space-y-1 border-t border-slate-200 pt-3">{draft.tiers.map((t, i) => <p className="text-xs" key={i}>Từ {money(t.minAmount)}{t.maxAmount ? ` đến dưới ${money(t.maxAmount)}` : ' trở lên'}: <strong>{t.rate}%</strong></p>)}</div>}
                  <div className="flex flex-wrap gap-2">{[0, 1, 2, 3].map((index) => <button type="button" key={index} onClick={() => goTo(index)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600">Sửa {steps[index].title.toLowerCase()}</button>)}</div>
                </div>
                <div className={boxClass}><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold">Link giới thiệu</p><button type="button" onClick={copyLink} className="inline-flex items-center gap-1 text-xs font-semibold"><Copy className="h-3.5 w-3.5" />{copied ? 'Đã sao chép' : 'Sao chép'}</button></div><p className="break-all text-xs select-all">{referralUrl}</p><p className="text-xs text-slate-500">Lưu đối tác xong mới sử dụng link này. Hoa hồng được đối soát và chuyển khoản thủ công.</p></div>
              </>}
            </fieldset>
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl px-2 py-2 text-xs text-slate-500 disabled:opacity-40">Hủy bỏ</button>
            <div className="flex items-center gap-2">{step > 0 && <button type="button" onClick={() => goTo(step - 1)} disabled={isSaving} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold disabled:opacity-40"><ArrowLeft className="h-4 w-4" />Quay lại</button>}<button type="submit" disabled={isSaving} className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{isSaving ? 'Đang lưu...' : step === 4 ? affiliate ? 'Lưu thay đổi' : 'Tạo đối tác' : 'Tiếp tục'}{!isSaving && (step === 4 ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />)}</button></div>
          </footer>
        </form>
      </div>
    </div>, document.body
  );
}
