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
  const [imageNaturalRatio, setImageNaturalRatio] = useState<number | null>(null);

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
      bgImage: '/assets/hero-bg.jpg',
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

  // Automatic bottom-region luminance detection & natural image ratio calculation
  useEffect(() => {
    const s = currentSlide as SiteHeroSlide;
    const activeImgSrc = currentSlide?.bgImage;
    if (!activeImgSrc) {
      setIsBrightBg(false);
      setImageNaturalRatio(null);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = activeImgSrc;

    img.onload = () => {
      if (!isMounted) return;
      try {
        if (img.naturalWidth && img.naturalHeight) {
          setImageNaturalRatio(img.naturalWidth / img.naturalHeight);
        }

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

  const handleNavigateLink = (link?: string) => {
    if (!link || !link.trim()) return;
    const cleanLink = link.trim();
    if (cleanLink.startsWith('http://') || cleanLink.startsWith('https://')) {
      window.open(cleanLink, '_blank', 'noopener,noreferrer');
      return;
    }
    if (cleanLink.startsWith('#')) {
      const el = document.getElementById(cleanLink.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    if (cleanLink === 'event_0209') {
      handleNavEvent();
      return;
    }
    handleSelectCat(cleanLink);
  };

  const s = currentSlide as SiteHeroSlide;

  return (
    <section id="hero-banner-section" className={`relative ${isBrightBg ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'} overflow-hidden overflow-x-clip w-full max-w-full select-none transition-colors duration-300`}>
      {/* Unified Hero Billboard (PC and Mobile share 100% identical image & ratio) */}
      <div
        className={`relative w-full max-w-full overflow-hidden overflow-x-clip select-none aspect-[16/7] ${isBrightBg ? 'bg-white' : 'bg-slate-950'} transition-all`}
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

              const hasCustomBoxes = Array.isArray(s.textBoxes) && s.textBoxes.some(b => b.visible !== false && !!b.text?.trim());
              const hasOverlay = s.hideOverlay !== true && (s.overlayOpacity ?? 0) > 0;

              // Helper to render image layer with robust error fallback
              const renderImageLayer = (
                imgSrc: string | undefined,
                posX: number,
                posY: number,
                zoom: number,
                fitMode: string,
                altText: string
              ) => {
                const validSrc = imgSrc && typeof imgSrc === 'string' && imgSrc.trim().length > 0 ? imgSrc : '/assets/hero-bg.jpg';
                const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
                  const target = e.currentTarget;
                  if (!target.src.includes('/assets/hero-bg.jpg')) {
                    target.src = '/assets/hero-bg.jpg';
                  }
                };

                if (fitMode === 'contain') {
                  return (
                    <div className={`absolute inset-0 w-full h-full ${isBrightBg ? 'bg-white' : 'bg-slate-950'} flex items-center justify-center overflow-hidden transition-colors duration-300`}>
                      <img
                        src={validSrc}
                        alt=""
                        aria-hidden="true"
                        onError={handleImgError}
                        className={`absolute inset-0 w-full h-full object-cover blur-2xl ${isBrightBg ? 'opacity-20' : 'opacity-40'} scale-110 pointer-events-none`}
                      />
                      <img
                        src={validSrc}
                        alt={altText}
                        onError={handleImgError}
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
                      onError={handleImgError}
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
                    onError={handleImgError}
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
                  className={`absolute inset-0 w-full h-full flex items-center justify-center ${!hasCustomBoxes && s.categoryLink ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (!hasCustomBoxes && s.categoryLink) {
                      handleCta(s);
                    }
                  }}
                >
                  {/* Single Unified Image Layer (Identical on PC and Mobile) */}
                  <div className="absolute inset-0 w-full h-full">
                    {renderImageLayer(
                      s.bgImage,
                      s.bgPositionX ?? 50,
                      s.bgPositionY ?? 50,
                      s.bgZoom ?? 100,
                      s.bgFit || 'cover',
                      s.title || 'NOT A KNOT Banner'
                    )}
                  </div>

                  {/* Configurable Overlay Opacity - Exactly matches Canva Studio */}
                  {hasOverlay && (
                    <div
                      className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-300"
                      style={{ opacity: (s.overlayOpacity ?? 0) / 100 }}
                    />
                  )}

                  {/* CUSTOM TEXT BOXES & BUTTONS (Rendered strictly from Studio design) */}
                  {hasCustomBoxes && (
                    <div className="absolute inset-0 w-full h-full pointer-events-none z-20">
                      {s.textBoxes?.map((box) => {
                        if (box.visible === false || !box.text?.trim()) return null;
                        const isBtn = box.isButton || !!box.link;
                        const btnStyle = box.buttonStyle || 'pill';

                        const fontFamilyCSS = 
                          box.fontFamily === 'serif'
                            ? 'Georgia, "Playfair Display", "Times New Roman", serif'
                            : box.fontFamily === 'mono'
                            ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                            : box.fontFamily === 'display'
                            ? '"Montserrat", "Plus Jakarta Sans", sans-serif'
                            : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

                        const innerElement = (
                          <div
                            className={`transition-all select-none ${
                              box.isButton
                                ? `px-3 sm:px-6 py-1.5 sm:py-2.5 font-bold shadow-xl flex items-center justify-center gap-1.5 ${
                                    btnStyle === 'rounded'
                                      ? 'rounded-xl'
                                      : btnStyle === 'square'
                                      ? 'rounded-xs'
                                      : btnStyle === 'outline'
                                      ? 'rounded-full border-2 border-current bg-black/40 backdrop-blur-xs'
                                      : btnStyle === 'glass'
                                      ? 'rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white'
                                      : 'rounded-full'
                                  }`
                                : ''
                            } ${box.isUppercase ? 'uppercase tracking-wider' : ''} ${box.isItalic ? 'italic' : ''}`}
                            style={{
                              color: box.color || '#ffffff',
                              backgroundColor: box.isButton && btnStyle !== 'outline' && btnStyle !== 'glass' ? (box.bgColor || '#09090b') : undefined,
                              fontFamily: fontFamilyCSS,
                              fontSize: `clamp(11px, ${(box.fontSize || 18) * 0.08}vw, ${box.fontSize || 18}px)`,
                              fontWeight: box.fontWeight || 600,
                              textAlign: box.align || 'left',
                              textShadow: box.textShadow !== false && !box.isButton ? '0 2px 10px rgba(0,0,0,0.9)' : 'none',
                            }}
                          >
                            <span>{box.text}</span>
                            {box.isButton && <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
                          </div>
                        );

                        if (box.link) {
                          return (
                            <button
                              key={box.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateLink(box.link);
                              }}
                              className="absolute pointer-events-auto cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                              style={{
                                left: `${box.x}%`,
                                top: `${box.y}%`,
                                width: box.width ? `${box.width}%` : 'auto',
                              }}
                            >
                              {innerElement}
                            </button>
                          );
                        }

                        return (
                          <div
                            key={box.id}
                            className="absolute pointer-events-none"
                            style={{
                              left: `${box.x}%`,
                              top: `${box.y}%`,
                              width: box.width ? `${box.width}%` : 'auto',
                            }}
                          >
                            {innerElement}
                          </div>
                        );
                      })}
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
        </div>
      </div>
    </section>
  );
};
