import React, { useState, useEffect } from 'react';
import { BannerItem, SiteHeroSlide } from '../types';
import { HERO_BANNERS } from '../data/products';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeroBannersProps {
  banners?: BannerItem[];
  slides?: SiteHeroSlide[];
  onSelectCategory?: (category: string) => void;
  onNavigateToEvent?: () => void;
  onSelectBannerCategory?: (category: string) => void;
  onOpen0209Event?: () => void;
  onOpenAbout?: () => void;
}

export const HeroBanners: React.FC<HeroBannersProps> = ({
  banners = HERO_BANNERS,
  slides,
  onSelectCategory,
  onNavigateToEvent,
  onSelectBannerCategory,
  onOpen0209Event
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<number>(1); // 1 = right/next, -1 = left/prev
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  // Use dynamic slides if provided and active, otherwise fallback to banners
  const dynamicSlides: (SiteHeroSlide | (BannerItem & { textAlign?: string; textPosition?: string; titleFontSize?: number; subtitleFontSize?: number; fontFamily?: string; overlayOpacity?: number; titleColor?: string; highlightColor?: string }))[] = 
    slides && slides.length > 0
      ? slides.filter(s => s.isActive)
      : banners.map((b, i) => ({
          id: b.id,
          tag: b.tag || 'Bộ Sưu Tập',
          title: b.title,
          highlight: b.highlight || '',
          subtitle: b.subtitle || '',
          bgImage: b.bgImage,
          buttonText: b.buttonText || 'Khám phá ngay',
          categoryLink: b.categoryLink,
          order: i + 1,
          isActive: true
        }));

  const activeSlides = dynamicSlides && dynamicSlides.length > 0 ? dynamicSlides : [
    {
      id: 'fallback-1',
      tag: 'Bộ Sưu Tập Thủ Công',
      title: 'NOT A KNOT',
      highlight: 'Sợi Dây Kể Chuyện',
      subtitle: 'Từng nút thắt paracord đều mang một câu chuyện độc bản.',
      bgImage: '/assets/hero-bg.png',
      buttonText: 'Khám phá ngay',
      categoryLink: 'all',
      order: 1,
      isActive: true
    }
  ];

  const handleSelectCat = onSelectCategory || onSelectBannerCategory || (() => {});
  const handleNavEvent = onNavigateToEvent || onOpen0209Event || (() => {});

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  useEffect(() => {
    if (!isAutoPlay || activeSlides.length <= 1) return;
    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isAutoPlay, activeSlides.length]);

  if (activeSlides.length === 0) return null;

  const currentSlide = activeSlides[currentIndex] || activeSlides[0];

  const handleCta = (slide: typeof currentSlide) => {
    if (slide.categoryLink === 'event_0209') {
      handleNavEvent();
    } else {
      handleSelectCat(slide.categoryLink || 'all');
    }
  };

  // Helper for slide positioning alignment
  const getPositionClasses = (pos?: string) => {
    switch (pos) {
      case 'top-left':
        return 'items-start justify-start text-left pt-6 sm:pt-10';
      case 'center-left':
        return 'items-start justify-center text-left';
      case 'bottom-left':
        return 'items-start justify-end text-left pb-8 sm:pb-12';
      case 'top-center':
        return 'items-center justify-start text-center pt-6 sm:pt-10';
      case 'bottom-center':
        return 'items-center justify-end text-center pb-8 sm:pb-12';
      case 'top-right':
        return 'items-end justify-start text-right pt-6 sm:pt-10';
      case 'center-right':
        return 'items-end justify-center text-right';
      case 'bottom-right':
        return 'items-end justify-end text-right pb-8 sm:pb-12';
      case 'center':
      default:
        return 'items-center justify-center text-center';
    }
  };

  const getFontFamilyClass = (fam?: string) => {
    switch (fam) {
      case 'serif':
        return 'font-serif';
      case 'mono':
        return 'font-mono';
      case 'display':
        return 'font-black tracking-tighter';
      case 'sans':
      default:
        return 'font-sans';
    }
  };

  const getLetterSpacingClass = (spacing?: string) => {
    switch (spacing) {
      case 'wide':
        return 'tracking-widest';
      case 'tight':
        return 'tracking-tight';
      default:
        return 'tracking-normal';
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'spring', stiffness: 280, damping: 30 },
        opacity: { duration: 0.3 }
      }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0.9,
      transition: {
        x: { type: 'spring', stiffness: 280, damping: 30 },
        opacity: { duration: 0.3 }
      }
    })
  };

  return (
    <section id="hero-banner-section" className="relative bg-slate-950 text-white overflow-hidden w-full select-none">
      {/* Main Cinematic Hero Billboard (Full Viewport Height) */}
      <div
        className="relative h-[80vh] sm:h-[85vh] md:h-[90vh] min-h-[560px] max-h-[960px] w-full overflow-hidden"
        onMouseEnter={() => setIsAutoPlay(false)}
        onMouseLeave={() => setIsAutoPlay(true)}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentSlide.id || currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 w-full h-full flex items-center justify-center"
          >
            {/* Background Image with Focal Point & Zoom */}
            {(() => {
              const s = currentSlide as SiteHeroSlide;
              const posX = s.bgPositionX ?? 50;
              const posY = s.bgPositionY ?? 50;
              const zoom = s.bgZoom ?? 100;
              return (
                <img
                  src={s.bgImage}
                  alt={s.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
                  style={{
                    objectPosition: `${posX}% ${posY}%`,
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: `${posX}% ${posY}%`
                  }}
                />
              );
            })()}

            {/* Configurable Overlay Opacity */}
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: (currentSlide.overlayOpacity ?? 50) / 100 }}
            />
            {/* Apple Cinematic Linear Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20" />

            {/* Slide Content Box */}
            {(() => {
              const pos = currentSlide.textPosition || 'center';
              const align = currentSlide.textAlign || (pos.includes('left') ? 'left' : pos.includes('right') ? 'right' : 'center');
              const isCenter = align === 'center';
              const isRight = align === 'right';
              const s = currentSlide as SiteHeroSlide;
              const buttonShape = s.buttonStyle || 'pill';

              return (
                <div className={`relative z-20 w-full h-full max-w-6xl mx-auto px-6 sm:px-12 flex flex-col ${getPositionClasses(pos)}`}>
                  <div 
                    className={`space-y-4 flex flex-col ${s.titleTextAlign === 'center' ? 'items-center text-center mx-auto' : s.titleTextAlign === 'right' ? 'items-end text-right ml-auto' : s.titleTextAlign === 'left' ? 'items-start text-left mr-auto' : isCenter ? 'items-center text-center mx-auto' : isRight ? 'items-end text-right ml-auto' : 'items-start text-left mr-auto'}`}
                    style={{ width: '100%', maxWidth: (s as any).contentMaxWidth ? `${(s as any).contentMaxWidth}%` : '48rem' }}
                  >
                    {/* Eyebrow Tag */}
                    {s.tag && (
                      <motion.p
                        initial={(s as any).disableAnimation ? false : { y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className={`text-xs sm:text-sm font-black uppercase tracking-widest inline-block px-3 py-1 rounded-full bg-black/40 backdrop-blur-xs border border-white/20 ${isCenter ? 'mx-auto text-center' : isRight ? 'ml-auto text-right' : 'mr-auto text-left'}`}
                        style={{ color: s.highlightColor || '#F59E0B' }}
                      >
                        {s.tag}
                      </motion.p>
                    )}
                    {/* Main Headline */}
                    <motion.h1
                      initial={(s as any).disableAnimation ? false : { y: 25, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.25 }}
                      className={`leading-tight w-full ${getFontFamilyClass(s.titleFontFamily || s.fontFamily)} ${getLetterSpacingClass(s.letterSpacing)} ${s.titleTextAlign === 'center' ? 'text-center' : s.titleTextAlign === 'right' ? 'text-right' : s.titleTextAlign === 'left' ? 'text-left' : isCenter ? 'text-center' : isRight ? 'text-right' : 'text-left'}`}
                      style={{
                        color: s.titleColor || '#FFFFFF',
                        textShadow: s.textShadow !== false ? '0 2px 10px rgba(0,0,0,0.85)' : 'none'
                      }}
                    >
                      <span
                        className="block font-black tracking-tight"
                        style={{
                          fontSize: s.titleFontSize ? `clamp(22px, 4vw, ${s.titleFontSize}px)` : 'clamp(24px, 4.5vw, 44px)'
                        }}
                      >
                        {s.title}
                      </span>
                      {s.highlight && (
                        <span
                          className="block font-light mt-1 tracking-normal"
                          style={{
                            color: s.highlightColor || '#F59E0B',
                            fontSize: s.titleFontSize ? `clamp(16px, 3vw, ${Math.round(s.titleFontSize * 0.75)}px)` : 'clamp(18px, 3.2vw, 32px)'
                          }}
                        >
                          {s.highlight}
                        </span>
                      )}
                    </motion.h1>
                    {/* Subtitle */}
                    {s.subtitle && (
                      <motion.p
                        initial={(s as any).disableAnimation ? false : { y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.35 }}
                        className={`font-normal leading-relaxed w-full line-clamp-3 ${getFontFamilyClass(s.subtitleFontFamily || s.fontFamily)} ${s.subtitleTextAlign === 'center' ? 'mx-auto text-center' : s.subtitleTextAlign === 'right' ? 'ml-auto text-right' : s.subtitleTextAlign === 'left' ? 'mr-auto text-left' : isCenter ? 'mx-auto text-center' : isRight ? 'ml-auto text-right' : 'mr-auto text-left'}`}
                        style={{
                          color: s.subtitleColor || '#E2E8F0',
                          fontSize: s.subtitleFontSize ? `clamp(13px, 1.8vw, ${s.subtitleFontSize}px)` : 'clamp(14px, 2vw, 16px)',
                          textShadow: s.textShadow !== false ? '0 1px 6px rgba(0,0,0,0.8)' : 'none'
                        }}
                      >
                        {s.subtitle}
                      </motion.p>
                    )}
                    {/* Primary CTA Button - Exactly Centered when Center-Aligned */}
                    <motion.div
                      initial={(s as any).disableAnimation ? false : { y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.45 }}
                      className={`pt-2 flex items-center gap-4 w-full ${s.titleTextAlign === 'center' ? 'justify-center mx-auto' : s.titleTextAlign === 'right' ? 'justify-end ml-auto' : s.titleTextAlign === 'left' ? 'justify-start mr-auto' : isCenter ? 'justify-center mx-auto' : isRight ? 'justify-end ml-auto' : 'justify-start mr-auto'}`}
                    >
                      <button
                        id={`hero-cta-btn-${s.id}`}
                        onClick={() => handleCta(s)}
                        className={`px-8 py-3.5 font-bold transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                          buttonShape === 'rounded' ? 'rounded-xl' : buttonShape === 'square' ? 'rounded-xs' : 'rounded-full'
                        }`}
                        style={{
                          backgroundColor: s.buttonBgColor || '#FFFFFF',
                          color: s.buttonTextColor || '#0F172A',
                          fontSize: s.buttonFontSize ? `${s.buttonFontSize}px` : '14px'
                        }}
                      >
                        <span>{s.buttonText || 'Khám phá ngay'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </motion.div>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        </AnimatePresence>

        {/* Slide Controls (Left/Right Chevrons) */}
        {activeSlides.length > 1 && (
          <>
            <button
              id="banner-prev-btn"
              onClick={handlePrev}
              className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/80 hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-lg"
              aria-label="Slide trước"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              id="banner-next-btn"
              onClick={handleNext}
              className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/80 hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-lg"
              aria-label="Slide kế tiếp"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Bottom Indicators & Scroll Hint */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                {activeSlides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setDirection(idx > currentIndex ? 1 : -1);
                      setCurrentIndex(idx);
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === currentIndex ? 'w-8 bg-white shadow-xs' : 'w-2.5 bg-white/40 hover:bg-white/70'
                    }`}
                    aria-label={`Chuyển tới slide ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => {
                  const el = document.getElementById('landing-apple-banners-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-neutral-400 hover:text-white text-[11px] font-medium flex items-center gap-1 opacity-75 hover:opacity-100 transition-all animate-bounce pt-1 cursor-pointer"
                aria-label="Cuộn xuống khám phá"
              >
                <span>Cuộn để khám phá</span>
                <span className="text-sm">↓</span>
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
