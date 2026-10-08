import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Truck, Ticket, Copy, Check, ShieldCheck, 
  ChevronLeft, ChevronRight, ArrowRight, X
} from 'lucide-react';
import { SiteContentConfig } from '../types';

export interface AnnouncementItem {
  id: string;
  type: 'custom' | 'shipping' | 'voucher' | 'warranty' | 'support';
  badge?: string;
  badgeColor?: string;
  text: string;
  subtext?: string;
  voucherCode?: string;
  link?: string;
  buttonText?: string;
}

interface TopAnnouncementBarProps {
  siteContent?: SiteContentConfig;
  onNavigateLanding?: () => void;
  onSelectCollection?: (collectionId: string) => void;
  onOpenAllCatalog?: (categoryId?: string) => void;
  onOpenAbout?: () => void;
  onOpenContact?: () => void;
  onOpenCart?: () => void;
  onToast?: (msg: string, opts?: { type?: 'success' | 'warning' | 'info'; showCartAction?: boolean }) => void;
}

export const TopAnnouncementBar: React.FC<TopAnnouncementBarProps> = ({
  siteContent,
  onNavigateLanding,
  onSelectCollection,
  onOpenAllCatalog,
  onOpenAbout,
  onOpenContact,
  onToast
}) => {
  const isEnabled = siteContent?.announcementActive !== false;
  const theme = siteContent?.announcementTheme || 'obsidian';
  const mode = siteContent?.announcementMode || 'carousel';
  const showControls = siteContent?.announcementShowControls === true; // Default: false (no control buttons unless explicitly enabled)
  const showCloseBtn = siteContent?.announcementShowClose === true; // Default: false (clean bar)
  const slideIntervalSec = siteContent?.announcementSpeed || 4.5;
  const tickerSpeedSec = siteContent?.announcementTickerSpeed || 32;

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('nak_announcement_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Touch gesture support for mobile swiping
  const touchStartXRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Build curated messages based on siteContent
  const messages: AnnouncementItem[] = useMemo(() => {
    // 1. If admin configured custom announcement items list in Admin Panel
    if (siteContent?.announcementItems && siteContent.announcementItems.length > 0) {
      const activeItems = siteContent.announcementItems.filter(
        item => item.isActive !== false && item.text && item.text.trim().length > 0
      );
      if (activeItems.length > 0) {
        if (mode === 'single') {
          const first = activeItems[0];
          return [{
            id: first.id,
            type: first.voucherCode ? 'voucher' : 'custom',
            badge: first.badge || 'Ưu Đãi',
            badgeColor: theme === 'minimal' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-amber-400 text-slate-950',
            text: first.text.trim(),
            voucherCode: first.voucherCode?.trim() || undefined,
            link: first.link || undefined,
            buttonText: first.link ? 'Xem ngay' : undefined,
          }];
        }

        return activeItems.map((item, idx) => {
          const badgeText = item.badge?.trim() || 'Ưu Đãi';
          let itemType: 'custom' | 'shipping' | 'voucher' | 'warranty' = 'custom';
          let badgeColor = theme === 'minimal' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-amber-400 text-slate-950';

          if (item.voucherCode?.trim()) {
            itemType = 'voucher';
            badgeColor = theme === 'minimal' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-amber-400 text-slate-950 font-black';
          } else if (badgeText.toLowerCase().includes('freeship') || item.text.toLowerCase().includes('freeship') || item.text.toLowerCase().includes('miễn phí giao hàng')) {
            itemType = 'shipping';
            badgeColor = 'bg-emerald-500 text-white';
          } else if (badgeText.toLowerCase().includes('bảo hành') || badgeText.toLowerCase().includes('cam kết') || item.text.toLowerCase().includes('bảo hành')) {
            itemType = 'warranty';
            badgeColor = 'bg-sky-500 text-white';
          }

          return {
            id: item.id || `msg-${idx}`,
            type: itemType,
            badge: badgeText,
            badgeColor,
            text: item.text.trim(),
            voucherCode: item.voucherCode?.trim() || undefined,
            link: item.link || undefined,
            buttonText: item.link ? 'Chi tiết' : undefined,
          };
        });
      }
    }

    const list: AnnouncementItem[] = [];

    // Fallback: Admin custom announcement text (if provided)
    if (siteContent?.announcementText && siteContent.announcementText.trim()) {
      list.push({
        id: 'msg-custom-admin',
        type: 'custom',
        badge: 'Ưu Đãi',
        badgeColor: theme === 'minimal' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-amber-400 text-slate-950',
        text: siteContent.announcementText.trim(),
        link: siteContent.announcementLink || undefined,
        buttonText: siteContent.announcementLink ? 'Xem ngay' : undefined,
      });
    }

    // If single mode is selected and custom text exists, return only that
    if (mode === 'single' && list.length > 0) {
      return list;
    }

    // 2. Free Shipping policy (if enabled)
    if (siteContent?.announcementShowFreeship !== false) {
      list.push({
        id: 'msg-freeship',
        type: 'shipping',
        badge: 'Freeship 0đ',
        badgeColor: 'bg-emerald-500 text-white',
        text: 'Miễn phí giao hàng toàn bộ Hà Nội • Đồng giá 20k toàn quốc',
        subtext: 'Đơn từ 299k tặng quà',
        link: '#about',
        buttonText: 'Chi tiết',
      });
    }

    // 3. Voucher code with 1-click copy (if enabled)
    if (siteContent?.announcementShowVoucher !== false) {
      const vCode = siteContent?.announcementVoucherCode?.trim() || 'NOTAKNOT';
      list.push({
        id: 'msg-voucher',
        type: 'voucher',
        badge: 'Mã Giảm Giá',
        badgeColor: theme === 'minimal' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-amber-400 text-slate-950 font-black',
        text: 'Giảm ngay 10.000đ cho đơn từ 199k',
        voucherCode: vCode,
        buttonText: 'Sao chép',
      });
    }

    // 4. Lifetime handcrafted commitment (if enabled)
    if (siteContent?.announcementShowWarranty !== false) {
      list.push({
        id: 'msg-warranty',
        type: 'warranty',
        badge: 'Cam Kết 100%',
        badgeColor: 'bg-sky-500 text-white',
        text: 'Bảo hành trọn đời nút thắt thủ công • Dây dù Paracord 550',
        link: '#about',
        buttonText: 'Về Not A Knot',
      });
    }

    // Fallback if list is empty
    if (list.length === 0) {
      list.push({
        id: 'msg-default',
        type: 'custom',
        badge: 'Not A Knot',
        badgeColor: 'bg-amber-400 text-slate-950',
        text: 'Chào mừng bạn đến với Not A Knot • Phụ kiện thủ công tinh tế',
        link: '#products',
        buttonText: 'Khám phá',
      });
    }

    return list;
  }, [
    siteContent?.announcementItems,
    siteContent?.announcementText, 
    siteContent?.announcementLink, 
    siteContent?.announcementShowFreeship, 
    siteContent?.announcementShowVoucher, 
    siteContent?.announcementVoucherCode, 
    siteContent?.announcementShowWarranty, 
    mode, 
    theme
  ]);

  // Seamless loop items for continuous marquee ticker (repeats smoothly with wide spacing)
  const marqueeItems = useMemo(() => {
    if (!messages.length) return [];
    const repeatCount = Math.max(3, Math.ceil(8 / messages.length));
    const baseSet = Array.from({ length: repeatCount }).flatMap(() => messages);
    return [...baseSet, ...baseSet];
  }, [messages]);

  // Handle slide transitions with smooth animation
  const goToSlide = useCallback((nextIdx: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(nextIdx);
      setIsTransitioning(false);
    }, 150);
  }, []);

  const handleNext = useCallback(() => {
    goToSlide((currentIndex + 1) % messages.length);
  }, [currentIndex, messages.length, goToSlide]);

  const handlePrev = useCallback(() => {
    goToSlide((currentIndex - 1 + messages.length) % messages.length);
  }, [currentIndex, messages.length, goToSlide]);

  // Auto-slide carousel
  useEffect(() => {
    if (isPaused || mode === 'single' || mode === 'ticker' || messages.length <= 1) return;

    timerRef.current = setInterval(() => {
      goToSlide((currentIndex + 1) % messages.length);
    }, Math.max(2500, slideIntervalSec * 1000));

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, mode, messages.length, slideIntervalSec, currentIndex, goToSlide]);

  // Reset index if out of bounds when messages change
  useEffect(() => {
    if (messages.length > 0 && currentIndex >= messages.length) {
      setCurrentIndex(0);
    }
  }, [messages.length, currentIndex]);

  const handleCopyVoucher = (code: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    if (onToast) {
      onToast(`Đã sao chép mã ưu đãi "${code}"! Dán vào ô Voucher khi thanh toán để nhận giảm giá.`, { type: 'success' });
    }
    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
  };

  const handleActionClick = (item: AnnouncementItem) => {
    if (item.voucherCode) {
      handleCopyVoucher(item.voucherCode);
      return;
    }

    if (!item.link) return;

    const link = item.link;
    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else if (link.includes('collection') || link.includes('event_0209')) {
      const match = link.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1] && onSelectCollection) {
        onSelectCollection(match[1]);
      } else if (onSelectCollection) {
        onSelectCollection('event_0209');
      }
    } else if (link === '#products' || link.includes('products')) {
      if (onOpenAllCatalog) onOpenAllCatalog('all');
    } else if (link === '#about' || link.includes('about')) {
      if (onOpenAbout) onOpenAbout();
    } else if (link === '#contact' || link.includes('contact')) {
      if (onOpenContact) onOpenContact();
    } else if (onNavigateLanding) {
      onNavigateLanding();
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('nak_announcement_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  // Touch swipe handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext(); // swiped left -> next
      } else {
        handlePrev(); // swiped right -> prev
      }
    }
    touchStartXRef.current = null;
  };

  if (!isEnabled || isDismissed) {
    return null;
  }

  // Theme styling configurations
  const themeClasses = {
    obsidian: 'bg-neutral-950 text-slate-100 border-b border-amber-400/20',
    amber: 'bg-gradient-to-r from-amber-950 via-[#3a1d0f] to-amber-950 text-amber-100 border-b border-amber-600/30',
    minimal: 'bg-stone-50 text-stone-900 border-b border-stone-200/90 shadow-2xs',
    festive: 'bg-gradient-to-r from-rose-950 via-[#4c0519] to-rose-950 text-rose-100 border-b border-rose-500/30'
  }[theme] || 'bg-neutral-950 text-slate-100 border-b border-amber-400/20';

  const actionTextClass = theme === 'minimal' 
    ? 'text-amber-800 hover:text-amber-950 hover:underline' 
    : 'text-amber-400 hover:text-amber-300 hover:underline';

  const arrowButtonClass = theme === 'minimal'
    ? 'text-stone-400 hover:text-stone-800 hover:bg-stone-200/70'
    : 'text-slate-400 hover:text-amber-300 hover:bg-white/10';

  const dotActiveClass = theme === 'minimal' ? 'bg-amber-600' : 'bg-amber-400';
  const dotInactiveClass = theme === 'minimal' ? 'bg-stone-300' : 'bg-slate-700';

  const currentMsg = messages[currentIndex] || messages[0];

  return (
    <aside 
      aria-label="Thanh thông báo ưu đãi"
      className={`relative z-50 text-xs select-none transition-all duration-300 ${themeClasses}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Shimmer light effect for luxury themes */}
      {theme !== 'minimal' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/5 to-transparent pointer-events-none" />
      )}

      {/* Main Single-Line Container: strictly h-9 (36px) to completely eliminate Cumulative Layout Shift (CLS) */}
      {mode === 'ticker' ? (
        /* Full-Width Edge-to-Edge Container for Continuous Ticker */
        <div className="w-full h-9 flex items-center relative overflow-hidden">
          <div className="w-full overflow-hidden flex items-center">
            <div 
              className="flex items-center gap-16 sm:gap-24 whitespace-nowrap animate-marquee"
              style={{ animationDuration: `${tickerSpeedSec}s` }}
            >
              {marqueeItems.map((item, idx) => (
                <div 
                  key={`${item.id}-loop-${idx}`}
                  onClick={() => handleActionClick(item)}
                  className={`inline-flex items-center gap-2.5 cursor-pointer font-medium shrink-0 transition-opacity hover:opacity-90 ${actionTextClass}`}
                >
                  {item.badge && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${item.badgeColor || 'bg-amber-400 text-slate-950'}`}>
                      {item.badge}
                    </span>
                  )}
                  <span className="text-xs sm:text-[13px] tracking-tight">{item.text}</span>
                  {item.voucherCode && (
                    <span className="font-mono font-bold bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.5 rounded text-[10px] text-amber-300 tracking-wider">
                      {item.voucherCode}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Close button floating on the far right if enabled in settings */}
          {showCloseBtn && (
            <div className="absolute right-0 top-0 bottom-0 pr-2 pl-8 flex items-center bg-gradient-to-l from-neutral-950 via-neutral-950/80 to-transparent z-20">
              <button
                type="button"
                onClick={handleDismiss}
                className={`p-1 rounded-full transition-colors cursor-pointer ${arrowButtonClass}`}
                title="Tắt thông báo này"
                aria-label="Tắt thông báo này"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Centered max-w-7xl Container for Carousel / Single Slide Mode */
        <div className="max-w-7xl mx-auto px-2 sm:px-4 h-9 flex items-center justify-between gap-1 sm:gap-2 relative">
          
          {/* Left Arrow: Switch slide (Only if multiple messages in carousel mode and controls enabled) */}
          {showControls && messages.length > 1 && mode === 'carousel' && (
            <button
              type="button"
              onClick={handlePrev}
              className={`p-1 rounded-full transition-colors cursor-pointer shrink-0 ${arrowButtonClass}`}
              title="Ưu đãi trước"
              aria-label="Ưu đãi trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Center: Announcement Content Area */}
          <div className="flex-1 overflow-hidden min-w-0 flex items-center justify-center">
            {/* Carousel & Single Mode: Clean Single-Line Slide with Zero Height Jumping */}
            <div 
              className={`flex items-center justify-center gap-1.5 sm:gap-2 max-w-full transition-opacity duration-200 ${
                isTransitioning ? 'opacity-0' : 'opacity-100'
              }`}
            >
              {/* Badge */}
              {currentMsg.badge && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-2xs shrink-0 flex items-center gap-1 ${currentMsg.badgeColor || 'bg-amber-400 text-slate-950'}`}>
                  {currentMsg.type === 'shipping' && <Truck className="w-3 h-3" />}
                  {currentMsg.type === 'voucher' && <Ticket className="w-3 h-3" />}
                  {currentMsg.type === 'warranty' && <ShieldCheck className="w-3 h-3" />}
                  <span>{currentMsg.badge}</span>
                </span>
              )}

              {/* Text content with clean truncation on small mobile */}
              <span 
                onClick={() => handleActionClick(currentMsg)}
                className={`font-medium text-xs tracking-tight truncate max-w-[200px] xs:max-w-[260px] sm:max-w-md md:max-w-lg lg:max-w-2xl ${
                  currentMsg.link || currentMsg.voucherCode 
                    ? 'cursor-pointer hover:underline underline-offset-2' 
                    : ''
                }`}
                title={currentMsg.text}
              >
                {currentMsg.text}
              </span>

              {/* 1-Click Voucher Copy Pill */}
              {currentMsg.voucherCode && (
                <button
                  type="button"
                  onClick={(e) => handleCopyVoucher(currentMsg.voucherCode!, e)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all active:scale-95 shrink-0 cursor-pointer shadow-2xs ${
                    copiedCode === currentMsg.voucherCode
                      ? 'bg-emerald-600 text-white'
                      : theme === 'minimal'
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                        : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  }`}
                  title="Bấm để sao chép mã ưu đãi"
                >
                  {copiedCode === currentMsg.voucherCode ? (
                    <>
                      <Check className="w-3 h-3 text-white" />
                      <span>Đã chép!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span className="font-mono tracking-wider font-extrabold">{currentMsg.voucherCode}</span>
                    </>
                  )}
                </button>
              )}

              {/* Action Button Link (if not voucher and has link) */}
              {!currentMsg.voucherCode && currentMsg.buttonText && currentMsg.link && (
                <button
                  type="button"
                  onClick={() => handleActionClick(currentMsg)}
                  className={`hidden sm:inline-flex items-center gap-0.5 text-[11px] font-bold cursor-pointer shrink-0 ${actionTextClass}`}
                >
                  <span>{currentMsg.buttonText}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Right Controls: Only rendered if controls or close button are enabled */}
          {(showControls || showCloseBtn) && (
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              {/* Next Slide Arrow (if multiple messages and controls enabled) */}
              {showControls && messages.length > 1 && mode === 'carousel' && (
                <button
                  type="button"
                  onClick={handleNext}
                  className={`p-1 rounded-full transition-colors cursor-pointer ${arrowButtonClass}`}
                  title="Ưu đãi kế tiếp"
                  aria-label="Ưu đãi kế tiếp"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Dots Indicator for Tablet/Desktop */}
              {showControls && messages.length > 1 && mode === 'carousel' && (
                <div className="hidden md:flex items-center gap-1 px-1">
                  {messages.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => goToSlide(idx)}
                      className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === currentIndex ? `${dotActiveClass} w-3` : dotInactiveClass
                      }`}
                      title={`Chuyển đến thông báo ${idx + 1}`}
                      aria-label={`Chuyển đến thông báo ${idx + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Close/Dismiss Button (if enabled in settings) */}
              {showCloseBtn && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className={`p-1 rounded-full transition-colors cursor-pointer ml-0.5 ${arrowButtonClass}`}
                  title="Tắt thông báo này"
                  aria-label="Tắt thông báo này"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

        </div>
      )}
    </aside>
  );
};
