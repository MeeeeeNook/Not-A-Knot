import React, { useMemo, useRef, useState } from 'react';
import { SiteHeroSlide, BillboardTextBox } from '../types';
import { uploadHeroArtwork } from '../firebase';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Monitor,
  Move,
  Plus,
  Smartphone,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';

interface CanvaSlideStudioProps {
  slides: SiteHeroSlide[];
  onChangeSlides: (slides: SiteHeroSlide[]) => void;
  brandName?: string;
  initialDevice?: 'desktop' | 'mobile';
}

type Device = 'desktop' | 'mobile';
type FontFamily = 'sans' | 'serif' | 'mono' | 'display';

const textBoxesFor = (slide: SiteHeroSlide): BillboardTextBox[] => slide.textBoxes || [
  { id: `${slide.id}-title`, text: [slide.title, slide.highlight].filter(Boolean).join(' '), x: 8, y: 38, width: 55, fontFamily: slide.fontFamily === 'serif' ? 'serif' : 'sans', fontSize: 42, fontWeight: 800, color: slide.titleColor || '#ffffff', align: slide.textAlign || 'left', visible: slide.showText !== false },
  { id: `${slide.id}-subtitle`, text: slide.subtitle || '', x: 8, y: 58, width: 44, fontFamily: 'sans', fontSize: 16, fontWeight: 400, color: slide.subtitleColor || '#e2e8f0', align: slide.subtitleTextAlign || slide.textAlign || 'left', visible: Boolean(slide.subtitle) && slide.showText !== false },
];

const normalize = (slide: SiteHeroSlide, index: number): SiteHeroSlide => ({
  ...slide,
  order: index + 1,
  isActive: slide.isActive !== false,
  bgFit: slide.bgFit || 'cover',
  bgFitMobile: slide.bgFitMobile || 'cover',
  aspectRatio: slide.aspectRatio || 'fullscreen',
  aspectRatioMobile: slide.aspectRatioMobile || 'fullscreen',
  textBoxes: textBoxesFor(slide),
});

export const CanvaSlideStudio: React.FC<CanvaSlideStudioProps> = ({ slides, onChangeSlides, initialDevice = 'desktop' }) => {
  const [selectedId, setSelectedId] = useState(slides[0]?.id || '');
  const [device, setDevice] = useState<Device>(initialDevice);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = slides.find((slide) => slide.id === selectedId) || slides[0];
  const normalized = useMemo(() => slides.map(normalize), [slides]);
  const boxes = active ? textBoxesFor(active) : [];
  const selectedBox = boxes.find((box) => box.id === selectedTextId);
  const image = active ? (device === 'mobile' ? active.bgImageMobile || active.bgImage : active.bgImage) : '';

  const commit = (patch: Partial<SiteHeroSlide>) => {
    if (!active) return;
    onChangeSlides(normalized.map((slide) => slide.id === active.id ? normalize({ ...slide, ...patch }, slide.order - 1) : slide));
  };
  const updateBox = (patch: Partial<BillboardTextBox>) => {
    if (!active || !selectedBox) return;
    commit({ textBoxes: boxes.map((box) => box.id === selectedBox.id ? { ...box, ...patch } : box) });
  };
  const addSlide = () => {
    const slide: SiteHeroSlide = { id: `slide-${Date.now()}`, tag: 'Bộ sưu tập mới', title: 'Tiêu đề mới', highlight: '', subtitle: 'Mô tả ngắn cho billboard', bgImage: '/assets/hero-bg.png', buttonText: 'Khám phá ngay', categoryLink: 'all', order: slides.length + 1, isActive: true, aspectRatio: 'fullscreen', aspectRatioMobile: 'fullscreen' };
    onChangeSlides([...normalized, normalize(slide, normalized.length)]); setSelectedId(slide.id);
  };
  const duplicate = () => { if (!active) return; const copy = { ...active, id: `slide-${Date.now()}`, title: `${active.title} (bản sao)` }; const next = [...normalized, normalize(copy, normalized.length)]; onChangeSlides(next); setSelectedId(copy.id); };
  const remove = () => { if (!active || slides.length <= 1) return; const next = normalized.filter((slide) => slide.id !== active.id).map(normalize); onChangeSlides(next); setSelectedId(next[0]?.id || ''); };
  const move = (direction: -1 | 1) => { if (!active) return; const index = normalized.findIndex((slide) => slide.id === active.id); const target = index + direction; if (target < 0 || target >= normalized.length) return; const next = [...normalized]; [next[index], next[target]] = [next[target], next[index]]; onChangeSlides(next.map(normalize)); };
  const handleUpload = async (file: File) => { if (!active || !file.type.startsWith('image/')) return; if (file.size > 12 * 1024 * 1024) return alert('Ảnh tối đa 12MB.'); setUploading(true); try { const url = await uploadHeroArtwork(file, active.id, device); commit(device === 'mobile' ? { bgImageMobile: url, originalBgImageMobile: url } : { bgImage: url, originalBgImage: url }); } catch (error) { console.error('[v0] Hero artwork upload failed', error); alert('Không thể tải ảnh lên Firebase Storage.'); } finally { setUploading(false); } };

  if (!active) return <div className="rounded-2xl border border-dashed p-10 text-center"><p>Chưa có billboard nào.</p><button onClick={addSlide} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-white"><Plus className="mr-2 inline h-4 w-4" />Tạo billboard</button></div>;
  const ratio = device === 'mobile' ? 'aspect-[9/16]' : 'aspect-[16/7]';

  return <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
    <aside className="rounded-2xl border bg-white p-3 shadow-sm"><div className="mb-3 flex items-center justify-between"><strong>Billboard</strong><button onClick={addSlide} title="Thêm billboard" className="rounded-lg bg-slate-900 p-2 text-white"><Plus className="h-4 w-4" /></button></div><div className="space-y-2">{normalized.map((slide, index) => <button key={slide.id} onClick={() => setSelectedId(slide.id)} className={`flex w-full items-center gap-2 rounded-xl border p-2 text-left ${slide.id === active.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}><img src={slide.bgImageMobile || slide.bgImage} alt="" className="h-12 w-16 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate text-xs font-semibold">{index + 1}. {slide.title || 'Không có tiêu đề'}</span>{slide.isActive === false ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-emerald-600" />}</button>)}</div></aside>
    <main className="rounded-2xl border bg-slate-950 p-4 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-white"><div><p className="text-xs uppercase tracking-[0.2em] text-amber-300">Live canvas</p><h2 className="font-bold">{device === 'mobile' ? 'Smartphone 9:16' : 'Desktop full bleed 16:7'}</h2></div><div className="flex rounded-lg bg-white/10 p-1"><button onClick={() => setDevice('desktop')} className={`rounded-md px-3 py-2 text-xs ${device === 'desktop' ? 'bg-white text-slate-900' : ''}`}><Monitor className="mr-1 inline h-4 w-4" />Desktop</button><button onClick={() => setDevice('mobile')} className={`rounded-md px-3 py-2 text-xs ${device === 'mobile' ? 'bg-white text-slate-900' : ''}`}><Smartphone className="mr-1 inline h-4 w-4" />Mobile</button></div></div><div className={`relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl bg-slate-800 ${ratio}`} style={{ backgroundImage: image ? `url(${image})` : undefined, backgroundSize: device === 'mobile' ? active.bgFitMobile : active.bgFit, backgroundPosition: `${device === 'mobile' ? active.bgPositionXMobile ?? 50 : active.bgPositionX ?? 50}% ${device === 'mobile' ? active.bgPositionYMobile ?? 50 : active.bgPositionY ?? 50}%` }} onClick={() => setSelectedTextId(null)}>{!image && <div className="absolute inset-0 grid place-items-center text-white/60">Tải ảnh để bắt đầu</div>}{boxes.map((box) => box.visible && <button key={box.id} type="button" onClick={(event) => { event.stopPropagation(); setSelectedTextId(box.id); }} className={`absolute min-h-8 cursor-move rounded border border-dashed px-2 text-left ${selectedBox?.id === box.id ? 'border-amber-300 bg-black/20' : 'border-transparent hover:border-white/70'}`} style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, color: box.color, fontFamily: box.fontFamily === 'serif' ? 'Georgia, serif' : box.fontFamily === 'mono' ? 'monospace' : 'sans-serif', fontSize: `${Math.max(10, box.fontSize / 2)}px`, fontWeight: box.fontWeight, textAlign: box.align }}>{box.text || 'Văn bản mới'}</button>)}</div><p className="mt-3 text-center text-xs text-slate-400">Khung xem trước dùng đúng tỷ lệ xuất bản. Kéo vị trí ảnh bằng các trường căn chỉnh bên phải.</p></main>
    <aside className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm"><div className="flex gap-2"><button onClick={() => inputRef.current?.click()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white" disabled={uploading}><Upload className="h-4 w-4" />{uploading ? 'Đang tải...' : `Ảnh ${device === 'mobile' ? 'mobile' : 'desktop'}`}</button><input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && handleUpload(event.target.files[0])} /></div><div className="grid grid-cols-4 gap-2"><button onClick={() => commit({ isActive: active.isActive === false })} title="Ẩn/hiện" className="rounded-lg border p-2">{active.isActive === false ? <EyeOff className="mx-auto h-4 w-4" /> : <Eye className="mx-auto h-4 w-4" />}</button><button onClick={() => move(-1)} title="Đưa lên" className="rounded-lg border p-2"><ChevronUp className="mx-auto h-4 w-4" /></button><button onClick={() => move(1)} title="Đưa xuống" className="rounded-lg border p-2"><ChevronDown className="mx-auto h-4 w-4" /></button><button onClick={duplicate} title="Nhân bản" className="rounded-lg border p-2"><Copy className="mx-auto h-4 w-4" /></button></div><button onClick={remove} className="w-full rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600"><Trash2 className="mr-1 inline h-4 w-4" />Xóa billboard</button><section className="border-t pt-3"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Ảnh & căn chỉnh</p><label className="text-xs">Vị trí ngang<input type="range" min="0" max="100" value={device === 'mobile' ? active.bgPositionXMobile ?? 50 : active.bgPositionX ?? 50} onChange={(e) => commit(device === 'mobile' ? { bgPositionXMobile: Number(e.target.value) } : { bgPositionX: Number(e.target.value) })} className="w-full" /></label><label className="text-xs">Vị trí dọc<input type="range" min="0" max="100" value={device === 'mobile' ? active.bgPositionYMobile ?? 50 : active.bgPositionY ?? 50} onChange={(e) => commit(device === 'mobile' ? { bgPositionYMobile: Number(e.target.value) } : { bgPositionY: Number(e.target.value) })} className="w-full" /></label></section><section className="border-t pt-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Text box</p><button onClick={() => { const box: BillboardTextBox = { id: `${active.id}-text-${Date.now()}`, text: 'Văn bản mới', x: 8, y: 72, width: 45, fontFamily: 'sans', fontSize: 22, fontWeight: 600, color: '#ffffff', align: 'left', visible: true }; commit({ textBoxes: [...boxes, box] }); setSelectedTextId(box.id); }} className="rounded bg-amber-400 p-1"><Plus className="h-4 w-4" /></button></div>{boxes.map((box) => <button key={box.id} onClick={() => setSelectedTextId(box.id)} className={`mb-1 flex w-full items-center gap-2 rounded border p-2 text-left text-xs ${selectedBox?.id === box.id ? 'border-amber-500' : ''}`}><Type className="h-3 w-3" />{box.text || 'Văn bản mới'}{!box.visible && <EyeOff className="ml-auto h-3 w-3" />}</button>)}{selectedBox && <div className="space-y-2 rounded-lg bg-slate-50 p-3"><input value={selectedBox.text} onChange={(e) => updateBox({ text: e.target.value })} className="w-full rounded border px-2 py-1 text-xs" /><div className="flex gap-1"><select value={selectedBox.fontFamily} onChange={(e) => updateBox({ fontFamily: e.target.value as FontFamily })} className="w-full rounded border px-2 py-1 text-xs"><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option></select><input type="number" min="10" max="120" value={selectedBox.fontSize} onChange={(e) => updateBox({ fontSize: Number(e.target.value) })} className="w-20 rounded border px-2 py-1 text-xs" /></div><div className="flex gap-1"><button onClick={() => updateBox({ align: 'left' })} className="rounded border p-1"><AlignLeft className="h-4 w-4" /></button><button onClick={() => updateBox({ align: 'center' })} className="rounded border p-1"><AlignCenter className="h-4 w-4" /></button><button onClick={() => updateBox({ align: 'right' })} className="rounded border p-1"><AlignRight className="h-4 w-4" /></button><input type="color" value={selectedBox.color} onChange={(e) => updateBox({ color: e.target.value })} className="ml-auto h-7 w-8" /><button onClick={() => updateBox({ visible: !selectedBox.visible })} className="rounded border p-1">{selectedBox.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button><button onClick={() => { commit({ textBoxes: boxes.filter((box) => box.id !== selectedBox.id) }); setSelectedTextId(null); }} className="rounded border p-1 text-red-600"><Trash2 className="h-4 w-4" /></button></div><label className="text-xs">X<input type="range" min="0" max="90" value={selectedBox.x} onChange={(e) => updateBox({ x: Number(e.target.value) })} className="w-full" /></label><label className="text-xs">Y<input type="range" min="0" max="90" value={selectedBox.y} onChange={(e) => updateBox({ y: Number(e.target.value) })} className="w-full" /></label></div>}</section></aside>
  </div>;
};

export default CanvaSlideStudio;
