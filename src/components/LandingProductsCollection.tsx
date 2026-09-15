import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product, CategoryItem, CollectionInfo, LandingCollectionProductsConfig } from '../types';

interface LandingProductsCollectionProps {
  config?: LandingCollectionProductsConfig;
  products: Product[];
  categories?: CategoryItem[];
  collections?: CollectionInfo[];
  sectionIndex?: number;
  zaloPhone?: string;
  messengerLink?: string;
  onOpenProductDetail: (product: Product) => void;
  onOpenAllCatalog: (category?: string) => void;
}

export const LandingProductsCollection: React.FC<LandingProductsCollectionProps> = ({
  config,
  products,
  categories,
  collections,
  sectionIndex = 0,
  zaloPhone,
  messengerLink,
  onOpenProductDetail,
  onOpenAllCatalog
}) => {
  // If explicitly disabled in admin, do not render
  if (config?.isActive === false) {
    return null;
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const sectionId = config?.id || `sec-${sectionIndex}`;
  const title = config?.title || 'THE COLLECTION';
  const subtitle = config?.subtitle;
  const badgeText = config?.badgeText || 'NEW';
  const detailButtonText = config?.detailButtonText || 'Chi tiết';
  const viewAllText = config?.viewAllText || 'Xem tất cả';
  
  // Custom display limit: 0 or undefined means show all selected/matched
  const displayLimit = typeof config?.displayLimit === 'number' ? config.displayLimit : 8;

  // Handle action when clicking the product card or "Chi tiết" button
  const handleProductAction = (product: Product, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    const actionType = config?.detailActionType || 'product_detail';

    // 1. Chuyển hướng đến URL tùy chỉnh của cả khối (Shopee, Landing page, bài viết...)
    if (actionType === 'custom_url' && config?.detailCustomUrl?.trim()) {
      const rawUrl = config.detailCustomUrl.trim();
      if (config.detailOpenNewTab !== false) {
        window.open(rawUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = rawUrl;
      }
      return;
    }

    // 2. Ưu tiên mở liên kết riêng của từng sản phẩm nếu có
    if (actionType === 'product_custom_url' && product.customUrl?.trim()) {
      window.open(product.customUrl.trim(), '_blank', 'noopener,noreferrer');
      return;
    }

    // 3. Mở Zalo chat tư vấn trực tiếp về sản phẩm
    if (actionType === 'zalo') {
      const cleanPhone = (zaloPhone || '').replace(/\D/g, '');
      const targetPhone = cleanPhone || '0988888888';
      const textMsg = encodeURIComponent(
        `Chào shop, mình quan tâm đến sản phẩm "${product.name}" (${Number(product.price || 0).toLocaleString('vi-VN')}đ). Tư vấn cho mình với ạ!`
      );
      window.open(`https://zalo.me/${targetPhone}?text=${textMsg}`, '_blank', 'noopener,noreferrer');
      return;
    }

    // 4. Mở Facebook Messenger chat
    if (actionType === 'messenger') {
      const fbTarget = messengerLink || 'https://m.me';
      window.open(fbTarget, '_blank', 'noopener,noreferrer');
      return;
    }

    // 5. Chuyển sang danh mục sản phẩm tương ứng trong cửa hàng
    if (actionType === 'category') {
      onOpenAllCatalog(config?.filterCategory && config.filterCategory !== 'all' ? config.filterCategory : product.category);
      return;
    }

    // Mặc định: Mở trang / modal chi tiết sản phẩm
    onOpenProductDetail(product);
  };

  // Filter & pick products based on admin configuration
  const displayProducts = useMemo(() => {
    // 1. If admin picked specific products manually
    if (config?.selectedProductIds && config.selectedProductIds.length > 0) {
      const selected = config.selectedProductIds
        .map((id) => products.find((p) => String(p.id) === String(id)))
        .filter((p): p is Product => Boolean(p));
      if (selected.length > 0) {
        return displayLimit > 0 ? selected.slice(0, displayLimit) : selected;
      }
    }

    // 2. Filter by category if specified
    let filtered = products.filter((p) => !p.isHidden && String(p.isHidden) !== 'true');
    if (config?.filterCategory && config.filterCategory !== 'all') {
      const catFiltered = filtered.filter((p) => p.category === config.filterCategory);
      if (catFiltered.length > 0) {
        filtered = catFiltered;
      }
    }

    // Fallback: If filtered is empty, take all available products so the section never disappears
    if (filtered.length === 0 && products.length > 0) {
      filtered = products;
    }

    // 3. Take products according to limit
    return displayLimit > 0 ? filtered.slice(0, displayLimit) : filtered;
  }, [products, config, displayLimit]);

  // Check scroll position for left/right arrows
  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [displayProducts]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(260, el.clientWidth * 0.75);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (displayProducts.length === 0) {
    return null;
  }

  const isExternalOrRedirect = 
    config?.detailActionType === 'custom_url' ||
    config?.detailActionType === 'zalo' ||
    config?.detailActionType === 'messenger' ||
    config?.detailActionType === 'category';

  // Determine dark or light text theme based on background color or explicit setting
  const isDarkBg = useMemo(() => {
    if (config?.textColor === 'light') return true;
    if (config?.textColor === 'dark') return false;
    const bg = config?.backgroundColor?.toLowerCase() || '';
    if (!bg) return false;
    if (bg.startsWith('#')) {
      // Simple luminance calculation
      const hex = bg.replace('#', '');
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
      }
    }
    return bg.includes('black') || bg.includes('slate-900') || bg.includes('neutral-900') || bg.includes('zinc-900');
  }, [config?.backgroundColor, config?.textColor]);

  // Layout mode: 'grid' | 'carousel' | 'auto'
  // Auto mode: If more than 4 products, enable smooth horizontal scroll & desktop arrows; if <= 4 products, center items nicely!
  const effectiveLayoutMode = config?.layoutMode || 'auto';
  const shouldEnableScroll = effectiveLayoutMode === 'carousel' || (effectiveLayoutMode === 'auto' && displayProducts.length > 4);

  // Background style configuration
  const customBgStyle: React.CSSProperties = {
    backgroundColor: config?.backgroundColor || (sectionIndex % 2 === 1 ? '#ffffff' : '#FAF9F6'),
  };

  return (
    <section
      id={`landing-collection-${sectionId}`}
      aria-label={title}
      style={customBgStyle}
      className={`relative w-full py-12 sm:py-16 md:py-20 font-sans border-t transition-colors ${
        isDarkBg ? 'text-white border-white/10' : 'text-slate-900 border-slate-200/60'
      }`}
    >
      {/* Optional Background Image Layer with custom opacity */}
      {config?.backgroundImage && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <img
            src={config.backgroundImage}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover select-none"
            style={{ opacity: typeof config.bgImageOpacity === 'number' ? config.bgImageOpacity : 0.25 }}
          />
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading: Tracked Uppercase Minimalist with Optional Arrows */}
        <div className="flex flex-col items-center justify-center text-center mb-8 sm:mb-12 md:mb-16 relative">
          <h2 className={`text-sm sm:text-base md:text-lg font-semibold tracking-[0.22em] uppercase ${
            isDarkBg ? 'text-white' : 'text-slate-900'
          }`}>
            {title}
          </h2>
          {subtitle && (
            <p className={`text-xs sm:text-sm font-normal tracking-wide mt-2 max-w-xl mx-auto ${
              isDarkBg ? 'text-slate-300' : 'text-slate-500'
            }`}>
              {subtitle}
            </p>
          )}

          {/* Desktop Left/Right Scroll Arrows when scrollable */}
          {shouldEnableScroll && (
            <div className="hidden sm:flex items-center gap-2 absolute right-0 bottom-0">
              <button
                type="button"
                onClick={() => handleScroll('left')}
                disabled={!canScrollLeft}
                aria-label="Cuộn sang trái"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                  isDarkBg
                    ? 'bg-slate-800/80 hover:bg-slate-700 text-white border-white/20 disabled:opacity-30 disabled:cursor-not-allowed'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-xs disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll('right')}
                disabled={!canScrollRight}
                aria-label="Cuộn sang phải"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                  isDarkBg
                    ? 'bg-slate-800/80 hover:bg-slate-700 text-white border-white/20 disabled:opacity-30 disabled:cursor-not-allowed'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-xs disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* PRODUCTS PRESENTATION: CENTERED & HORIZONTAL SWIPEABLE */}
        {shouldEnableScroll ? (
          /* Scroll Track (Swipe on Mobile, Arrow Navigation on Desktop) */
          <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
            <div
              ref={scrollContainerRef}
              className={`flex items-stretch gap-4 sm:gap-6 lg:gap-8 overflow-x-auto snap-x snap-mandatory scrollbar-none py-2 scroll-smooth ${
                displayProducts.length <= 4 ? 'sm:justify-center' : ''
              }`}
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {displayProducts.map((product) => {
                const isOutOfStock = product.inStock === false || (product.stock !== undefined && product.stock <= 0);
                const mainImg = (product.images && product.images[0]) || product.image || '/assets/bracelet.jpg';
                const priceFormatted = Number(product.price || 0).toLocaleString('vi-VN') + 'đ';
                const origPriceFormatted = product.originalPrice ? Number(product.originalPrice).toLocaleString('vi-VN') + 'đ' : null;
                const hasProductCustomUrl = Boolean(product.customUrl?.trim());

                return (
                  <div
                    key={product.id}
                    id={`collection-product-${product.id}`}
                    onClick={() => handleProductAction(product)}
                    className="group flex flex-col items-center text-center cursor-pointer relative shrink-0 snap-start w-[160px] sm:w-[220px] md:w-[250px] lg:w-[270px]"
                  >
                    {/* Product Image Stage */}
                    <div className="relative w-full aspect-square bg-white flex items-center justify-center overflow-hidden border border-slate-100/80 mb-3 sm:mb-4 rounded-lg">
                      {/* Chic Top-Left Badge */}
                      {isOutOfStock ? (
                        <span className="absolute top-2 left-2 z-10 bg-slate-800 text-white text-[9px] sm:text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 select-none pointer-events-none">
                          HẾT HÀNG
                        </span>
                      ) : badgeText ? (
                        <span className="absolute top-2 left-2 z-10 bg-[#0d2e2b] text-white text-[9px] sm:text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 select-none pointer-events-none shadow-2xs">
                          {badgeText}
                        </span>
                      ) : null}

                      {/* Product Photo with subtle hover zoom */}
                      <img
                        src={mainImg}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain p-3 sm:p-5 group-hover:scale-105 transition-transform duration-500 ease-out"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/assets/bracelet.jpg';
                        }}
                      />
                    </div>

                    {/* Product Title */}
                    <h3 className={`text-xs sm:text-sm font-semibold tracking-wider uppercase line-clamp-1 transition-colors px-1 w-full ${
                      isDarkBg ? 'text-white group-hover:text-amber-400' : 'text-slate-900 group-hover:text-amber-600'
                    }`}>
                      {product.name}
                    </h3>

                    {/* Price Display */}
                    <div className="flex items-baseline justify-center gap-1.5 mt-1">
                      <span className={`text-xs sm:text-sm font-medium ${
                        isDarkBg ? 'text-amber-300' : 'text-slate-500'
                      }`}>
                        {priceFormatted}
                      </span>
                      {origPriceFormatted && (
                        <span className={`text-[11px] line-through ${
                          isDarkBg ? 'text-slate-400' : 'text-slate-400'
                        }`}>
                          {origPriceFormatted}
                        </span>
                      )}
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={(e) => handleProductAction(product, e)}
                      className={`mt-2.5 text-xs font-medium transition-colors underline-offset-4 hover:underline py-1 px-3 cursor-pointer inline-flex items-center gap-1 ${
                        isDarkBg ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-black'
                      }`}
                    >
                      <span>{detailButtonText}</span>
                      {(isExternalOrRedirect || (config?.detailActionType === 'product_custom_url' && hasProductCustomUrl)) && (
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Mobile Touch Swipe Indicator Pill */}
            <div className="flex sm:hidden items-center justify-center gap-1 mt-4 text-[11px] text-slate-400">
              <span>← Vuốt xem thêm {displayProducts.length} sản phẩm →</span>
            </div>
          </div>
        ) : (
          /* Centered Responsive Grid / Flex (Perfect alignment whether 1, 2, 3, or 4 products) */
          <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 lg:gap-x-10 gap-y-10 sm:gap-y-12 lg:gap-y-16">
            {displayProducts.map((product) => {
              const isOutOfStock = product.inStock === false || (product.stock !== undefined && product.stock <= 0);
              const mainImg = (product.images && product.images[0]) || product.image || '/assets/bracelet.jpg';
              const priceFormatted = Number(product.price || 0).toLocaleString('vi-VN') + 'đ';
              const origPriceFormatted = product.originalPrice ? Number(product.originalPrice).toLocaleString('vi-VN') + 'đ' : null;
              const hasProductCustomUrl = Boolean(product.customUrl?.trim());

              return (
                <div
                  key={product.id}
                  id={`collection-product-${product.id}`}
                  onClick={() => handleProductAction(product)}
                  className="group flex flex-col items-center text-center cursor-pointer relative w-[calc(50%-0.5rem)] sm:w-[220px] md:w-[250px] lg:w-[260px] shrink-0"
                >
                  {/* Product Image Stage */}
                  <div className="relative w-full aspect-square bg-white flex items-center justify-center overflow-hidden border border-slate-100/80 mb-3 sm:mb-4 rounded-lg">
                    {/* Chic Top-Left Badge */}
                    {isOutOfStock ? (
                      <span className="absolute top-2 left-2 z-10 bg-slate-800 text-white text-[9px] sm:text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 select-none pointer-events-none">
                        HẾT HÀNG
                      </span>
                    ) : badgeText ? (
                      <span className="absolute top-2 left-2 z-10 bg-[#0d2e2b] text-white text-[9px] sm:text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 select-none pointer-events-none shadow-2xs">
                        {badgeText}
                      </span>
                    ) : null}

                    {/* Centered Product Photo with subtle hover zoom */}
                    <img
                      src={mainImg}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain p-3 sm:p-5 group-hover:scale-105 transition-transform duration-500 ease-out"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/assets/bracelet.jpg';
                      }}
                    />
                  </div>

                  {/* Product Title */}
                  <h3 className={`text-xs sm:text-sm font-semibold tracking-wider uppercase line-clamp-1 transition-colors px-1 w-full ${
                    isDarkBg ? 'text-white group-hover:text-amber-400' : 'text-slate-900 group-hover:text-amber-600'
                  }`}>
                    {product.name}
                  </h3>

                  {/* Price Display */}
                  <div className="flex items-baseline justify-center gap-1.5 mt-1">
                    <span className={`text-xs sm:text-sm font-medium ${
                      isDarkBg ? 'text-amber-300' : 'text-slate-500'
                    }`}>
                      {priceFormatted}
                    </span>
                    {origPriceFormatted && (
                      <span className={`text-[11px] line-through ${
                        isDarkBg ? 'text-slate-400' : 'text-slate-400'
                      }`}>
                        {origPriceFormatted}
                      </span>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={(e) => handleProductAction(product, e)}
                    className={`mt-2.5 text-xs font-medium transition-colors underline-offset-4 hover:underline py-1 px-3 cursor-pointer inline-flex items-center gap-1 ${
                      isDarkBg ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-black'
                    }`}
                  >
                    <span>{detailButtonText}</span>
                    {(isExternalOrRedirect || (config?.detailActionType === 'product_custom_url' && hasProductCustomUrl)) && (
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* "Xem tất cả" Button at the bottom */}
        <div className="text-center mt-10 sm:mt-14 md:mt-16">
          <button
            type="button"
            id={`landing-collection-view-all-btn-${sectionId}`}
            onClick={() => onOpenAllCatalog(config?.filterCategory && config.filterCategory !== 'all' ? config.filterCategory : 'all')}
            className={`inline-flex items-center justify-center px-8 sm:px-12 py-3 border text-xs sm:text-sm font-semibold tracking-widest uppercase transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md ${
              isDarkBg
                ? 'bg-white/10 hover:bg-white text-white hover:text-black border-white/40'
                : 'bg-white hover:bg-slate-950 text-slate-900 hover:text-white border-slate-300 hover:border-slate-950'
            }`}
          >
            {viewAllText}
          </button>
        </div>

      </div>
    </section>
  );
};
