import React, { useEffect, useMemo, useState } from 'react';
import { BannerItem, SiteHeroSlide } from '../types';
import { HERO_BANNERS } from '../data/products';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props { banners?: BannerItem[]; slides?: SiteHeroSlide[]; onSelectCategory?: (category: string) => void; onNavigateToEvent?: () => void; onSelectBannerCategory?: (category: string) => void; onOpen0209Event?: () => void; }
const fallback = (b: BannerItem, i: number): SiteHeroSlide => ({ id: b.id, tag: b.tag || '', title: b.title, highlight: b.highlight || '', subtitle: b.subtitle || '', bgImage: b.bgImage, buttonText: b.buttonText || 'Khám phá ngay', categoryLink: b.categoryLink, order: i + 1, isActive: true });
const font = (family?: string) => family === 'serif' ? 'Georgia, serif' : family === 'mono' ? 'monospace' : 'system-ui, sans-serif';

export const HeroBanners: React.FC<Props> = ({ banners = HERO_BANNERS, slides, onSelectCategory, onNavigateToEvent, onSelectBannerCategory, onOpen0209Event }) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState(1);
  const source = useMemo(() => (slides?.length ? slides.filter((s) => s.isActive !== false).sort((a, b) => (a.order || 0) - (b.order || 0)) : banners.map(fallback)), [slides, banners]);
  const items = source.length ? source : [fallback(banners[0], 0)];
  const current = items[index % items.length];
  useEffect(() => { if (index >= items.length) setIndex(0); }, [index, items.length]);
  useEffect(() => { if (paused || items.length < 2) return; const timer = window.setInterval(() => { setDirection(1); setIndex((i) => (i + 1) % items.length); }, 6500); return () => window.clearInterval(timer); }, [paused, items.length]);
  const go = (step: number) => { setDirection(step); setIndex((i) => (i + step + items.length) % items.length); };
  const select = () => current.categoryLink === 'event_0209' ? (onNavigateToEvent || onOpen0209Event)?.() : (onSelectCategory || onSelectBannerCategory)?.(current.categoryLink || 'all');
  const legacyBoxes = [{ id: 'title', text: [current.title, current.highlight].filter(Boolean).join(' '), x: 8, y: 34, width: 62, fontFamily: current.titleFontFamily || current.fontFamily, fontSize: current.titleFontSize || 48, fontWeight: 800, color: current.titleColor || '#fff', align: current.titleTextAlign || current.textAlign || 'left', visible: current.showText !== false }, { id: 'subtitle', text: current.subtitle, x: 8, y: 61, width: 48, fontFamily: current.subtitleFontFamily || 'sans', fontSize: current.subtitleFontSize || 18, fontWeight: 400, color: current.subtitleColor || '#e5e7eb', align: current.subtitleTextAlign || current.textAlign || 'left', visible: Boolean(current.subtitle) && current.showText !== false }];
  const boxes = current.textBoxes?.length ? current.textBoxes : legacyBoxes;
  return <section id="hero-banner-section" className="relative w-full overflow-hidden bg-slate-950 text-white" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    <div className="relative h-[calc(100svh-4rem)] min-h-[520px] max-h-[920px] w-full max-sm:h-[calc(100svh-3.5rem)] max-sm:min-h-[500px]">
      <AnimatePresence initial={false} custom={direction} mode="wait"><motion.div key={current.id} initial={{ opacity: 0, x: direction > 0 ? '4%' : '-4%' }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction > 0 ? '-4%' : '4%' }} transition={{ duration: 0.45 }} className="absolute inset-0">
        <picture><source media="(max-width: 640px)" srcSet={current.bgImageMobile || current.bgImage} /><img src={current.bgImage} alt={current.title || 'Homepage billboard'} className="absolute inset-0 size-full" style={{ objectFit: 'cover', objectPosition: `${current.bgPositionX ?? 50}% ${current.bgPositionY ?? 50}%` }} /></picture>
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/20" />
        {boxes.map((box) => box.visible !== false && <div key={box.id} className="absolute whitespace-pre-wrap" style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, color: box.color, fontFamily: font(box.fontFamily), fontSize: `clamp(${Math.max(14, box.fontSize * .45)}px, ${Math.max(1, box.fontSize / 14)}vw, ${box.fontSize}px)`, fontWeight: box.fontWeight, textAlign: box.align, lineHeight: 1.12, textShadow: '0 2px 18px rgb(0 0 0 / .35)' }}>{box.text}</div>)}
        {current.showButton !== false && <button onClick={select} className="absolute bottom-[15%] left-[8%] inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300">{current.buttonText || 'Khám phá ngay'}<ArrowRight className="size-4" /></button>}
      </motion.div></AnimatePresence>
      {items.length > 1 && <><button aria-label="Previous billboard" onClick={() => go(-1)} className="absolute left-4 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/20 backdrop-blur"><ChevronLeft className="size-5" /></button><button aria-label="Next billboard" onClick={() => go(1)} className="absolute right-4 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/20 backdrop-blur"><ChevronRight className="size-5" /></button><div className="absolute bottom-6 right-6 flex gap-2">{items.map((item, i) => <button key={item.id} aria-label={`Go to billboard ${i + 1}`} onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i); }} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-10 bg-amber-300' : 'w-4 bg-white/50'}`} />)}</div></>}
    </div>
  </section>;
};
export default HeroBanners;
