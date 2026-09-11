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
  const [isBrightBg, setIsBrightBg] = useState(false);

  // Use dynamic slides if provided and active, otherwise fallback to banners
  const dynamicSlides: (SiteHeroSlide | (BannerItem & { textAlign?: string; textPosition?: string; titleFontSize?: number; subtitleFontSize?: number; fontFamily?: string; overlayOpacity?: number; titleColor?: string; highlightColor?: string; showButton?: boolean; showText?: boolean; hideOverlay?: boolean }))[] = 
    slides && slides.length > 0
      ? slides.filter(s => s.isActive)
      : banners.map((b, i) => ({
          id: b.id,
          tag: b.tag || '',
          title: b.title,
          highlight: b.highlight || '',
          subtitle: b.subtitle || '',
          bgImage: b.bgImage,
          buttonText: b.buttonText ?? 'Khám phá ngay',
          categoryLink: b.categoryLink,
          order: i + 1,
          isActive: true
        }));

  const activeSlides = dynamicSlides && dynamicSlides.length > 0 ? dynamicSlides : [
    {
      id: 'fallback-1',
      tag: 'Bộ Sưu Tập Đặc Biệt',
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

  // Automatic bottom-region luminance detection to adapt indicator & scroll button colors
  useEffect(() => {
    if (!currentSlide?.bgImage) {
      setIsBrightBg(false);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentSlide.bgImage;

    img.onload = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 30;
        canvas.height = 30;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // Sample bottom center area (30% width, bottom 25% height)
        const sx = img.naturalWidth * 0.35;
        const sy = img.naturalHeight * 0.75;
        const sw = Math.max(1, img.naturalWidth * 0.3);
        const sh = Math.max(1, img.naturalHeight * 0.25);

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 30, 30);
        const imageData = ctx.getImageData(0, 0, 30, 30);
        const data = imageData.data;

        let totalLum = 0;
        let validPixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a > 30) {
            // Standard perceptual luminance formula
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLum += lum;
            validPixels++;
          }
        }

        const avgBrightness = validPixels > 0 ? totalLum / validPixels : 40;
        const s = currentSlide as SiteHeroSlide;
        const overlayOp = s.overlayOpacity ?? 0.3;
        const hideOverlay = s.hideOverlay;

        // Overlay darkens the background
        const effectiveBrightness = hideOverlay ? avgBrightness : avgBrightness * (1 - overlayOp * 0.7);

        // Threshold of 120 (0-255) classifies background as bright/light vs dark
        setIsBrightBg(effectiveBrightness > 120);
      } catch {
        // In case of CORS or canvas error, fallback based on image URL heuristic if possible or default to dark
        setIsBrightBg(false);
      }
    };

    img.onerror = () => {
      if (isMounted) setIsBrightBg(false);
    };

    return () => {
      isMounted = false;
    };
  }, [
    currentSlide?.bgImage,
    (currentSlide as SiteHeroSlide)?.overlayOpacity,
    (currentSlide as SiteHeroSlide)?.hideOverlay
  ]);

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
      opacity: 0.4,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.6 },
        opacity: { duration: 0.4 }
      }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0.4,
      transition: {
        x: { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.6 },
        opacity: { duration: 0.4 }
      }
    })
  };

  return (
    <section id="hero-banner-section" className="relative bg-slate-950 text-white overflow-hidden overflow-x-clip w-full max-w-full select-none">
      {/* Main Cinematic Hero Billboard (Device-optimized for PC and Smartphone) */}
      <div
        className={`relative w-full max-w-full overflow-hidden overflow-x-clip select-none bg-slate-950 transition-all ${
          // Desktop aspect ratio
          (currentSlide as SiteHeroSlide).aspectRatio === '16:9'
            ? 'sm:aspect-[16/9] sm:min-h-[520px] sm:max-h-[800px]'
            : (currentSlide as SiteHeroSlide).aspectRatio === 'cinematic'
            ? 'sm:aspect-[21/9] sm:min-h-[460px] sm:max-h-[700px]'
            : 'sm:h-[calc(100vh-3.5rem)] sm:min-h-[560px]'
        } ${
          // Mobile smartphone aspect ratio: strictly sized for smartphone screens
          (currentSlide as SiteHeroSlide).aspectRatioMobile === '9:16'
            ? 'max-sm:aspect-[9/16] max-sm:w-full max-sm:max-h-[85svh] max-sm:min-h-[460px]'
            : (currentSlide as SiteHeroSlide).aspectRatioMobile === '4:5'
            ? 'max-sm:aspect-[4/5] max-sm:w-full max-sm:min-h-[400px]'
            : (currentSlide as SiteHeroSlide).aspectRatioMobile === '1:1'
            ? 'max-sm:aspect-square max-sm:w-full max-sm:min-h-[320px]'
            : (currentSlide as SiteHeroSlide).aspectRatioMobile === '16:9'
            ? 'max-sm:aspect-[16/9] max-sm:w-full max-sm:min-h-[220px]'
            : (currentSlide as SiteHeroSlide).aspectRatioMobile === 'fullscreen'
            ? 'max-sm:h-[calc(100svh-3.5rem)] max-sm:min-h-[480px] max-sm:max-h-[820px] max-sm:w-full'
            : (currentSlide as SiteHeroSlide).bgImageMobile
            ? 'max-sm:aspect-[9/16] max-sm:w-full max-sm:max-h-[85svh] max-sm:min-h-[460px]'
            : 'max-sm:aspect-[16/9] max-sm:w-full max-sm:min-h-[220px] max-sm:max-h-[380px]'
        }`}
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
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_e, { offset, velocity }) => {
              const swipeConfidenceThreshold = 10000;
              const swipe = Math.abs(offset.x) * velocity.x;
              if (swipe < -swipeConfidenceThreshold || offset.x < -45) {
                handleNext();
              } else if (swipe > swipeConfidenceThreshold || offset.x > 45) {
                handlePrev();
              }
            }}
            className="absolute inset-0 w-full h-full flex items-center justify-center touch-pan-y"
          >
            {/* Background Image with Focal Point, Zoom & Fit Mode */}
            {(() => {
              const s = currentSlide as SiteHeroSlide;
              const pos = s.textPosition || 'center';
              const align = s.textAlign || (pos.includes('left') ? 'left' : pos.includes('right') ? 'right' : 'center');
              const isCenter = align === 'center';
              const isRight = align === 'right';
              const buttonShape = s.buttonStyle || 'pill';

              const hasVisibleButton = s.showButton !== false && !!s.buttonText && s.buttonText.trim() !== '';
              const hasVisibleText = s.showText !== false && (!!s.title?.trim() || !!s.subtitle?.trim() || !!s.tag?.trim() || !!s.highlight?.trim());
              const hasOverlay = s.hideOverlay !== true && (s.overlayOpacity ?? 50) > 0;

              // Helper to render image with specific focal point, zoom, and fit mode
              const renderImageLayer = (
                imgSrc: string | undefined,
                posX: number,
                posY: number,
                zoom: number,
                fitMode: string,
                altText: string
              ) => {
                const validSrc = imgSrc && typeof imgSrc === 'string' && imgSrc.trim().length > 0 ? imgSrc : '/assets/hero-bg.png';
                if (fitMode === 'contain') {
                  return (
                    <div className="absolute inset-0 w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
                      <img
                        src={validSrc}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110 pointer-events-none"
                      />
                      <img
                        src={validSrc}
                        alt={altText}
                        className="relative z-10 max-w-full max-h-full object-contain transition-transform duration-300"
                        style={{
                          transform: `scale(${zoom / 100})`,
                          transformOrigin: `${posX}% ${posY}%`
                        }}
                      />
                    </div>
                  );
                }
                if (fitMode === 'fill') {
                  return (
                    <img
                      src={validSrc}
                      alt={altText}
                      className="absolute inset-0 w-full h-full object-fill transition-transform duration-300"
                      style={{
                        objectPosition: `${posX}% ${posY}%`,
                        transform: `scale(${zoom / 100})`,
                        transformOrigin: `${posX}% ${posY}%`
                      }}
                    />
                  );
                }
                return (
                  <img
                    src={validSrc}
                    alt={altText}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
                    style={{
                      objectPosition: `${posX}% ${posY}%`,
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: `${posX}% ${posY}%`
                    }}
                  />
                );
              };

              return (
                <div 
                  className={`absolute inset-0 w-full h-full flex items-center justify-center ${!hasVisibleButton && s.categoryLink ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (!hasVisibleButton && s.categoryLink) {
                      handleCta(s);
                    }
                  }}
                >
                  {/* Smartphone Viewport (< 640px): Dedicated Mobile Billboard */}
                  <div className="block sm:hidden absolute inset-0 w-full h-full">
                    {renderImageLayer(
                      s.bgImageMobile || s.bgImage,
                      s.bgPositionXMobile ?? (s.bgImageMobile ? 50 : s.bgPositionX ?? 50),
                      s.bgPositionYMobile ?? (s.bgImageMobile ? 50 : s.bgPositionY ?? 50),
                      s.bgZoomMobile ?? (s.bgImageMobile ? 100 : s.bgZoom ?? 100),
                      s.bgFitMobile || (s.bgImageMobile ? (s.bgFit || 'cover') : 'contain'),
                      s.title || 'NOT A KNOT Mobile Banner'
                    )}
                  </div>

                  {/* Desktop Viewport (>= 640px): Dedicated Desktop Billboard */}
                  <div className="hidden sm:block absolute inset-0 w-full h-full">
                    {renderImageLayer(
                      s.bgImage,
                      s.bgPositionX ?? 50,
                      s.bgPositionY ?? 50,
                      s.bgZoom ?? 100,
                      s.bgFit || (s.aspectRatio === 'contain' ? 'contain' : 'cover'),
                      s.title || 'NOT A KNOT Banner'
                    )}
                  </div>

                  {/* Configurable Overlay Opacity (Hidden if in pure image mode or opacity = 0) */}
                  {hasOverlay && (
                    <>
                      <div
                        className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-300"
                        style={{ opacity: (s.overlayOpacity ?? 50) / 100 }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10 pointer-events-none" />
                    </>
                  )}

                  {/* Slide Content Box */}
                  {(hasVisibleText || hasVisibleButton) && (
                    <div className={`relative z-20 w-full h-full max-w-6xl mx-auto px-6 sm:px-12 pt-6 sm:pt-10 pb-16 sm:pb-24 flex flex-col ${getPositionClasses(pos)} pointer-events-none`}>
                      <div 
                        className={`space-y-4 flex flex-col pointer-events-auto ${s.titleTextAlign === 'center' ? 'items-center text-center mx-auto' : s.titleTextAlign === 'right' ? 'items-end text-right ml-auto' : s.titleTextAlign === 'left' ? 'items-start text-left mr-auto' : isCenter ? 'items-center text-center mx-auto' : isRight ? 'items-end text-right ml-auto' : 'items-start text-left mr-auto'}`}
                        style={{ width: '100%', maxWidth: (s as any).contentMaxWidth ? `${(s as any).contentMaxWidth}%` : '48rem' }}
                      >
                        {/* Eyebrow Tag */}
                        {s.tag && hasVisibleText && (
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
                        {(s.title || s.highlight) && hasVisibleText && (
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
                            {s.title && (
                              <span
                                className="block font-black tracking-tight"
                                style={{
                                  fontSize: s.titleFontSize ? `clamp(22px, 4vw, ${s.titleFontSize}px)` : 'clamp(24px, 4.5vw, 44px)'
                                }}
                              >
                                {s.title}
                              </span>
                            )}
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
                        )}
                        {/* Subtitle */}
                        {s.subtitle && hasVisibleText && (
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
                        {/* Primary CTA Button (Rendered ONLY if showButton !== false and buttonText is non-empty) */}
                        {hasVisibleButton && (
                          <motion.div
                            initial={(s as any).disableAnimation ? false : { y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.45 }}
                            className={`pt-2 flex items-center gap-4 w-full ${s.titleTextAlign === 'center' ? 'justify-center mx-auto' : s.titleTextAlign === 'right' ? 'justify-end ml-auto' : s.titleTextAlign === 'left' ? 'justify-start mr-auto' : isCenter ? 'justify-center mx-auto' : isRight ? 'justify-end ml-auto' : 'justify-start mr-auto'}`}
                          >
                            <button
                              id={`hero-cta-btn-${s.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCta(s);
                              }}
                              className={`px-8 py-3.5 font-bold transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                                buttonShape === 'rounded' ? 'rounded-xl' : buttonShape === 'square' ? 'rounded-xs' : 'rounded-full'
                              }`}
                              style={{
                                backgroundColor: s.buttonBgColor || '#FFFFFF',
                                color: s.buttonTextColor || '#0F172A',
                                fontSize: s.buttonFontSize ? `${s.buttonFontSize}px` : '14px'
                              }}
                            >
                              <span>{s.buttonText}</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        </AnimatePresence>

        {/* Slide Controls (Left/Right Chevrons) - Minimalist transparent glass, visible only when hovering near left/right edges */}
        {activeSlides.length > 1 && (
          <>
            {/* Left Edge Hover Zone */}
            <div
              className="absolute left-0 top-0 bottom-12 w-20 sm:w-32 z-30 flex items-center justify-start pl-3 sm:pl-6 group/edge-left cursor-pointer select-none"
              onClick={handlePrev}
              title="Slide trước"
            >
              <button
                id="banner-prev-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full backdrop-blur-md flex items-center justify-center opacity-0 group-hover/edge-left:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-md pointer-events-auto ${
                  isBrightBg
                    ? 'bg-black/15 hover:bg-black/30 border border-black/20 text-neutral-900'
                    : 'bg-black/25 hover:bg-black/50 border border-white/20 text-white'
                }`}
                aria-label="Slide trước"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Right Edge Hover Zone */}
            <div
              className="absolute right-0 top-0 bottom-12 w-20 sm:w-32 z-30 flex items-center justify-end pr-3 sm:pl-6 group/edge-right cursor-pointer select-none"
              onClick={handleNext}
              title="Slide kế tiếp"
            >
              <button
                id="banner-next-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full backdrop-blur-md flex items-center justify-center opacity-0 group-hover/edge-right:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-md pointer-events-auto ${
                  isBrightBg
                    ? 'bg-black/15 hover:bg-black/30 border border-black/20 text-neutral-900'
                    : 'bg-black/25 hover:bg-black/50 border border-white/20 text-white'
                }`}
                aria-label="Slide kế tiếp"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>
          </>
        )}

        {/* Bottom Indicators & Adaptive Subtle Scroll Button */}
        <div className="absolute bottom-2.5 sm:bottom-5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none group/bottom-nav">
          {/* Slide Indicator Dots (Only if multiple slides) - Clean, minimalist, no bulky bubble wrapper */}
          {activeSlides.length > 1 && (
            <div className="flex items-center gap-1.5 py-1 pointer-events-auto transition-opacity duration-300 opacity-60 hover:opacity-100">
              {activeSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDirection(idx > currentIndex ? 1 : -1);
                    setCurrentIndex(idx);
                  }}
                  className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === currentIndex
                      ? isBrightBg
                        ? 'w-6 bg-neutral-900 shadow-sm'
                        : 'w-6 bg-white shadow-sm'
                      : isBrightBg
                      ? 'w-1.5 bg-neutral-900/40 hover:bg-neutral-900/80 hover:w-3'
                      : 'w-1.5 bg-white/40 hover:bg-white/90 hover:w-3'
                  }`}
                  aria-label={`Chuyển tới slide ${idx + 1}`}
                />
              ))}
            </div>
          )}

          {/* Automatic Adaptive Minimalist Scroll-Down CTA - Faint by default, highlights smoothly on hover */}
          <button
            id="hero-scroll-explore-btn"
            onClick={() => {
              const el = document.getElementById('landing-collections-showcase') || document.getElementById('landing-apple-banners-section') || document.getElementById('products-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`flex text-[11px] sm:text-xs font-medium items-center gap-1 tracking-wider uppercase transition-all duration-300 cursor-pointer pointer-events-auto opacity-40 hover:opacity-100 hover:scale-105 active:scale-95 group/scroll ${
              isBrightBg
                ? 'text-neutral-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]'
                : 'text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
            }`}
            aria-label="Cuộn xuống khám phá"
          >
            <span className="group-hover/scroll:underline underline-offset-4 decoration-amber-500/60 transition-all">Cuộn để khám phá</span>
            <span className="text-xs transition-transform duration-300 group-hover/scroll:translate-y-1">↓</span>
          </button>
        </div>
      </div>
    </section>
  );
};
