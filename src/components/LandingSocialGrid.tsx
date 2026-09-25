import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { SiteContentConfig, SocialFeedPost } from '../types';

interface LandingSocialGridProps {
  siteContent?: SiteContentConfig;
}

const DEFAULT_POSTS: SocialFeedPost[] = [
  {
    id: 'post-1',
    image: '/assets/about-story.jpg',
    caption: 'Hậu trường chế tác từng nút thắt thủ công tỉ mỉ cho bộ sưu tập độc bản Not A Knot.\n\nMỗi sản phẩm là một câu chuyện kết nối được tạo nên từ sự tận tâm của người thợ lành nghề.',
    url: 'https://www.facebook.com/profile.php?id=61593591390851',
    gradient: 'bg-white/85',
    borderColor: 'border-black'
  },
  {
    id: 'post-2',
    image: '/assets/img_4_NOT_A_KNOT.jpg',
    caption: 'BST Nàng Thơ 20/10 — Sự hòa quyện giữa charm hoa ngọt ngào và dây đan pastel dịu êm.\n\nThiết kế độc quyền tôn vinh vẻ đẹp tinh tế của phái đẹp.',
    url: 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==',
    gradient: 'bg-white/85',
    borderColor: 'border-black'
  },
  {
    id: 'post-3',
    image: '/assets/hero-bg.png',
    caption: 'Phiên bản đặc biệt 02/09 — Năng lượng tự hào non sông trong từng nét đan thủ công.\n\nSợi chỉ đỏ kiên cường đan xen vẻ đẹp hiện đại.',
    url: 'https://www.facebook.com/profile.php?id=61593591390851',
    gradient: 'bg-white/85',
    borderColor: 'border-black'
  },
  {
    id: 'post-4',
    image: '/assets/img_0.jpg',
    caption: 'Gợi ý phối vòng charm phong cách tối giản cho outfit dạo phố cuối tuần thêm nổi bật.\n\nNhẹ nhàng, thanh lịch và cuốn hút trong từng khoảnh khắc.',
    url: 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==',
    gradient: 'bg-white/85',
    borderColor: 'border-black'
  },
  {
    id: 'post-5',
    image: '/assets/image_4.jpg',
    caption: 'Dây đeo Everyday Wear êm ái, bền chắc trên cổ tay suốt ngày dài học tập và làm việc.\n\nĐồng hành cùng bạn trong mọi trải nghiệm cuộc sống.',
    url: 'https://www.facebook.com/profile.php?id=61593591390851',
    gradient: 'bg-white/85',
    borderColor: 'border-black'
  }
];

export const LandingSocialGrid: React.FC<LandingSocialGridProps> = ({ siteContent }) => {
  const config = siteContent?.socialFeed;

  const rawPosts = config?.posts && config.posts.length > 0 ? config.posts : DEFAULT_POSTS;
  // Ensure exactly 5 posts
  const posts = rawPosts.slice(0, 5);
  const total = posts.length || 1;

  const title = config?.title || 'GÓC TIN TỨC';

  // Section ref for viewport auto-scroll detection
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isInViewport, setIsInViewport] = useState(false);

  // Mobile 3-Card Interactive Stage state with touch swiping and directional slide animation
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  // Last manual interaction timestamp to prevent auto-scroll collision
  const lastInteractionRef = useRef<number>(Date.now());

  const prevIndex = (activeIndex - 1 + total) % total;
  const nextIndex = (activeIndex + 1) % total;

  const handleNext = useCallback(() => {
    setIsDescriptionOpen(false);
    setSlideDirection('left');
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = useCallback(() => {
    setIsDescriptionOpen(false);
    setSlideDirection('right');
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const handleDotClick = (idx: number) => {
    if (idx === activeIndex) return;
    lastInteractionRef.current = Date.now();
    setIsDescriptionOpen(false);
    setSlideDirection(idx > activeIndex ? 'left' : 'right');
    setActiveIndex(idx);
  };

  // Viewport intersection observer to detect when user scrolls to this section
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInViewport(entry.isIntersecting);
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px'
      }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Automatic scrolling every 3 seconds ONLY when user scrolls to this area on mobile
  useEffect(() => {
    // Only auto-scroll when in viewport, not currently swiping, and description overlay is closed
    if (!isInViewport || isSwiping || isDescriptionOpen) return;

    const interval = setInterval(() => {
      // Allow 3.5s cooldown after manual user touch/interaction
      if (Date.now() - lastInteractionRef.current >= 3000) {
        handleNext();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isInViewport, isSwiping, isDescriptionOpen, handleNext]);

  // If explicitly disabled in admin CMS, do not render
  if (config?.isActive === false) return null;

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    lastInteractionRef.current = Date.now();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartXRef.current = clientX;
    touchStartYRef.current = clientY;
    isHorizontalSwipeRef.current = null;
    setIsSwiping(true);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - touchStartXRef.current;
    const deltaY = clientY - touchStartYRef.current;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (isHorizontalSwipeRef.current) {
      setSwipeOffset(deltaX * 0.75);
    }
  };

  const handleTouchEnd = () => {
    lastInteractionRef.current = Date.now();
    if (isHorizontalSwipeRef.current && Math.abs(swipeOffset) > 25) {
      if (swipeOffset < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    setIsSwiping(false);
    setSwipeOffset(0);
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalSwipeRef.current = null;
  };

  const openPost = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section 
      ref={sectionRef}
      id="landing-social-feed" 
      aria-label="Khám phá tin tức mạng xã hội Not A Knot" 
      className="w-full bg-[#FAF9F6] py-12 sm:py-16 md:py-20 text-stone-900 font-sans overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header - Exactly identical typography & uppercase tracking to CÂU CHUYỆN THƯƠNG HIỆU */}
        <div className="flex flex-col items-center justify-center text-center mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-sm sm:text-base md:text-lg font-semibold tracking-[0.22em] uppercase text-stone-900">
            {title}
          </h2>
        </div>

        {/* ---------------------------------------------------- */}
        {/* DESKTOP LAYOUT (1 Large Left Card + 2x2 Right Cards) */}
        {/* ---------------------------------------------------- */}
        <div className="hidden md:grid grid-cols-12 gap-5 lg:gap-6 h-[540px] lg:h-[580px]">
          
          {/* Card 1: Large Featured Portrait (Spans 5 cols, Full Height) */}
          <div 
            onClick={() => openPost(posts[0].url)}
            className="col-span-5 h-full relative rounded-3xl overflow-hidden border border-black shadow-md hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-xl cursor-pointer group"
          >
            {/* Specular Highlight Top Edge */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none z-30" />

            {/* Image - Natural fit without distortion/crop on tinted white glass */}
            <div className="w-full h-full flex items-center justify-center overflow-hidden p-2">
              <img
                src={posts[0].image}
                alt="Featured Post Not A Knot"
                className="w-full h-full max-w-full max-h-full object-contain object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                loading="lazy"
              />
            </div>

            {/* Hover Tinted Glass Overlay with Full Description (Preserves Line Breaks) */}
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/45 to-transparent backdrop-blur-[1.5px] opacity-0 group-hover:opacity-100 transition-all duration-300 p-6 lg:p-8 flex flex-col justify-end text-white z-20">
              <div className="overflow-y-auto max-h-[70%] pr-1 mb-4 space-y-2">
                <p className="text-sm lg:text-base font-medium text-stone-100 leading-relaxed whitespace-pre-line break-words drop-shadow-xs">
                  {posts[0].caption}
                </p>
              </div>
              
              <div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPost(posts[0].url);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/35 active:bg-white/45 border border-white/30 text-white font-bold text-xs sm:text-sm backdrop-blur-xl transition-all shadow-xs cursor-pointer group/btn"
                >
                  <span>Xem bài viết</span>
                  <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right 2x2 Grid (Spans 7 cols, 2 rows of 2 cards) */}
          <div className="col-span-7 grid grid-cols-2 gap-5 lg:gap-6 h-full">
            {posts.slice(1, 5).map((post) => (
              <div
                key={post.id}
                onClick={() => openPost(post.url)}
                className="h-[258px] lg:h-[277px] relative rounded-3xl overflow-hidden border border-black shadow-md hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-xl cursor-pointer group"
              >
                {/* Specular Highlight Top Edge */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none z-30" />

                {/* Image - Natural fit without distortion/crop */}
                <div className="w-full h-full flex items-center justify-center overflow-hidden p-2">
                  <img
                    src={post.image}
                    alt={post.caption}
                    className="w-full h-full max-w-full max-h-full object-contain object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                    loading="lazy"
                  />
                </div>

                {/* Hover Tinted Glass Overlay with Description & Line Break Support */}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/45 to-transparent backdrop-blur-[1.5px] opacity-0 group-hover:opacity-100 transition-all duration-300 p-4 lg:p-5 flex flex-col justify-end text-white z-20">
                  <div className="overflow-y-auto max-h-[70%] pr-1 mb-3 space-y-1.5">
                    <p className="text-xs sm:text-[13px] font-medium text-stone-100 leading-snug whitespace-pre-line break-words drop-shadow-xs">
                      {post.caption}
                    </p>
                  </div>
                  
                  <div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPost(post.url);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/35 active:bg-white/45 border border-white/30 text-white font-bold text-xs backdrop-blur-xl transition-all shadow-xs cursor-pointer group/btn"
                    >
                      <span>Xem bài viết</span>
                      <ExternalLink className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* ---------------------------------------------------- */}
        {/* MOBILE 3-CARD BALANCED SQUARE STAGE [ 5 ] [ 1 ] [ 2 ] */}
        {/* ---------------------------------------------------- */}
        <div 
          className="md:hidden w-full relative select-none py-2 touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Inline keyframe animations for directional card transitions */}
          <style>{`
            @keyframes socialSlideInLeft {
              0% { opacity: 0.3; transform: translateX(38px) scale(0.96); }
              100% { opacity: 1; transform: translateX(0) scale(1); }
            }
            @keyframes socialSlideInRight {
              0% { opacity: 0.3; transform: translateX(-38px) scale(0.96); }
              100% { opacity: 1; transform: translateX(0) scale(1); }
            }
            @keyframes socialFadeScale {
              0% { opacity: 0.4; transform: scale(0.95); }
              100% { opacity: 1; transform: scale(1); }
            }
          `}</style>

          {/* 3-Card Stage Area matching User's Sketch [5] [ 1 ] [2] with matching full-height blurry side cards */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 w-full min-h-[300px] sm:min-h-[340px] px-1 overflow-hidden">
            
            {/* LEFT CARD (e.g. Post 5 / Previous - Full height with gentle soft blur, white glass + black border) */}
            <div
              onClick={() => {
                lastInteractionRef.current = Date.now();
                handlePrev();
              }}
              style={{
                transform: `translateX(${swipeOffset * 0.3}px)`,
                transition: isSwiping ? 'none' : 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)'
              }}
              className="w-[20vw] min-w-[62px] max-w-[96px] h-[72vw] min-h-[240px] max-h-[290px] relative rounded-3xl overflow-hidden border border-black shadow-md bg-white/70 backdrop-blur-md cursor-pointer shrink-0 transition-all group"
              title="Xem bài trước"
            >
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none z-30" />
              <div 
                key={`prev-${prevIndex}`} 
                className="w-full h-full flex items-center justify-center overflow-hidden opacity-70 group-hover:opacity-90 transition-opacity p-1.5"
                style={{
                  animation: slideDirection ? 'socialFadeScale 0.3s ease-out' : 'none'
                }}
              >
                <img
                  src={posts[prevIndex].image}
                  alt="Previous Post"
                  className="w-full h-full max-w-full max-h-full object-contain object-center blur-[1px] scale-102 group-hover:blur-none transition-all duration-300"
                />
              </div>
              <div className="absolute inset-0 bg-stone-950/10 group-hover:bg-transparent transition-colors pointer-events-none" />
            </div>

            {/* CENTER ACTIVE CARD (e.g. Post 1 / Main Featured - Pure Square Aspect Ratio, white glass + distinct black border) */}
            <div
              onClick={() => {
                lastInteractionRef.current = Date.now();
                setIsDescriptionOpen((prev) => !prev);
              }}
              style={{
                transform: `translateX(${swipeOffset}px)`,
                transition: isSwiping ? 'none' : 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)'
              }}
              className="w-[72vw] min-w-[240px] max-w-[290px] aspect-square relative rounded-3xl overflow-hidden border-2 border-black shadow-2xl bg-white/90 backdrop-blur-xl cursor-pointer group shrink-0 z-20"
              title="Chạm để xem chi tiết bài viết"
            >
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none z-30" />
              
              {/* Animated Inner Content Container */}
              <div 
                key={`active-${activeIndex}`}
                className="w-full h-full relative"
                style={{
                  animation: slideDirection === 'left'
                    ? 'socialSlideInLeft 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards'
                    : slideDirection === 'right'
                    ? 'socialSlideInRight 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards'
                    : 'socialFadeScale 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards'
                }}
              >
                {/* Image: Natural contain fit, gentle 1px blur on tap so image remains clearly visible */}
                <div className="w-full h-full flex items-center justify-center overflow-hidden p-2">
                  <img
                    src={posts[activeIndex].image}
                    alt={posts[activeIndex].caption}
                    className={`w-full h-full max-w-full max-h-full object-contain object-center transition-all duration-300 ease-out ${
                      isDescriptionOpen ? 'blur-[1px] scale-[1.02] brightness-95' : 'blur-none scale-100'
                    }`}
                  />
                </div>

                {/* Tinted Glass Info Overlay - Subtle bottom gradient, image stays clearly visible */}
                <div
                  className={`absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/45 to-transparent backdrop-blur-[1px] p-4 sm:p-5 flex flex-col justify-end text-white z-20 transition-all duration-300 ${
                    isDescriptionOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="overflow-y-auto max-h-[70%] pr-1 mb-3 space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-stone-100 leading-snug whitespace-pre-line break-words drop-shadow-xs">
                      {posts[activeIndex].caption}
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPost(posts[activeIndex].url);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/25 hover:bg-white/35 active:bg-white/45 border border-white/30 text-white font-bold text-xs backdrop-blur-xl transition-all shadow-xs cursor-pointer"
                    >
                      <span>Xem bài viết</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT CARD (e.g. Post 2 / Next - Full height with gentle soft blur, white glass + black border) */}
            <div
              onClick={() => {
                lastInteractionRef.current = Date.now();
                handleNext();
              }}
              style={{
                transform: `translateX(${swipeOffset * 0.3}px)`,
                transition: isSwiping ? 'none' : 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)'
              }}
              className="w-[20vw] min-w-[62px] max-w-[96px] h-[72vw] min-h-[240px] max-h-[290px] relative rounded-3xl overflow-hidden border border-black shadow-md bg-white/70 backdrop-blur-md cursor-pointer shrink-0 transition-all group"
              title="Xem bài tiếp theo"
            >
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none z-30" />
              <div 
                key={`next-${nextIndex}`} 
                className="w-full h-full flex items-center justify-center overflow-hidden opacity-70 group-hover:opacity-90 transition-opacity p-1.5"
                style={{
                  animation: slideDirection ? 'socialFadeScale 0.3s ease-out' : 'none'
                }}
              >
                <img
                  src={posts[nextIndex].image}
                  alt="Next Post"
                  className="w-full h-full max-w-full max-h-full object-contain object-center blur-[1px] scale-102 group-hover:blur-none transition-all duration-300"
                />
              </div>
              <div className="absolute inset-0 bg-stone-950/10 group-hover:bg-transparent transition-colors pointer-events-none" />
            </div>

          </div>

          {/* Clean Indicator Dots */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {posts.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleDotClick(idx)}
                aria-label={`Chuyển đến bài viết ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  activeIndex === idx ? 'w-6 bg-stone-900' : 'w-2 bg-stone-300 hover:bg-stone-400'
                }`}
              />
            ))}
          </div>

        </div>

      </div>
    </section>
  );
};

