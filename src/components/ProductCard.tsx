import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { Product, CategoryItem, CollectionInfo } from '../types';
import { DEFAULT_CATEGORIES } from '../data/categories';

export interface ProductCardProps {
  product: Product;
  onOpenDetail: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  className?: string;
  categories?: CategoryItem[];
  collections?: CollectionInfo[];
}

export const getCategoryLabel = (
  category?: string,
  categories?: CategoryItem[],
  collections?: CollectionInfo[]
): string => {
  if (!category || category === 'all') return 'Vòng Tay Paracord';

  // Check provided collections
  if (collections && collections.length > 0) {
    const foundCol = collections.find(
      (c) => c.id === category || c.categoryKey === category
    );
    if (foundCol) {
      const name = foundCol.title || foundCol.tag || '';
      if (name) {
        return name.replace(/^BST\s+/i, '').replace(/^Bộ sưu tập\s+/i, '').trim();
      }
    }
  }

  // Check provided categories
  if (categories && categories.length > 0) {
    const found = categories.find((c) => c.id === category);
    if (found && found.label) {
      return found.label.replace(/^BST\s+/i, '').replace(/^Bộ sưu tập\s+/i, '').trim();
    }
  }

  // Check DEFAULT_CATEGORIES
  const defaultFound = DEFAULT_CATEGORIES.find((c) => c.id === category);
  if (defaultFound && defaultFound.label) {
    return defaultFound.label.replace(/^BST\s+/i, '').replace(/^Bộ sưu tập\s+/i, '').trim();
  }

  switch (category) {
    case 'event_0209':
      return 'Quốc Khánh 02.09';
    case 'event_2010':
      return 'Nàng Thơ 20.10';
    case 'bracelets':
      return 'Vòng Tay Paracord';
    case 'back_to_school':
      return 'Back 2 School';
    case 'charm_bracelet':
      return 'Vòng Charm';
    case 'everyday':
      return 'Everyday Wear';
    case 'keychains':
      return 'Móc Khóa EDC';
    case 'lanyards':
      return 'Dây Đeo Phụ Kiện';
    default:
      if (category && category.trim().length > 0) {
        const trimmed = category.trim();
        if (/^(bộ sưu tập|bst|bo_suu_tap)$/i.test(trimmed)) {
          return 'Vòng Tay Paracord';
        }
        return trimmed.replace(/^BST\s+/i, '').replace(/^Bộ sưu tập\s+/i, '').trim();
      }
      return 'Vòng Tay Paracord';
  }
};

const cardSlideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '100%' : '-100%',
    opacity: 0.2
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (dir: number) => ({
    zIndex: 0,
    x: dir > 0 ? '-100%' : '100%',
    opacity: 0.2
  })
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onOpenDetail,
  onAddToCart,
  className = '',
  categories,
  collections
}) => {
  const images = useMemo(() => {
    if (product.images && product.images.length > 0) {
      const valid = product.images.filter(
        (img) => typeof img === 'string' && img.trim().length > 0
      );
      if (valid.length > 0) return valid;
    }
    if (product.image && typeof product.image === 'string' && product.image.trim().length > 0) {
      return [product.image];
    }
    return ['/assets/bracelet.jpg'];
  }, [product]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Lazy loading observer: only loads image resources when card approaches viewport (300px margin)
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px', threshold: 0.01 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Photos are STATIC by default. When mouse hovers, gentle smooth pacing auto-slide through photos.
  useEffect(() => {
    if (!isHovered || images.length <= 1) {
      return;
    }

    // Gentle initial delay (1000ms) so accidental mouseover doesn't trigger abrupt slide jumps
    let intervalId: any = null;
    const initialTimeout = setTimeout(() => {
      setDirection(1);
      setCurrentIdx((prev) => (prev + 1) % images.length);

      // Smooth slide every 2600ms
      intervalId = setInterval(() => {
        setDirection(1);
        setCurrentIdx((prev) => (prev + 1) % images.length);
      }, 2600);
    }, 1000);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isHovered, images.length]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setDirection(-1);
    setCurrentIdx(0); // Return gently to initial photo
  };

  const stockCount = typeof product.stock === 'number' ? product.stock : 15;
  const isSoldOut = !product.inStock || stockCount <= 0;
  const hasMandatoryOptions = Boolean(
    (product.enableCharmSelection && product.charmSelectionRequired) ||
    (product.enableOmamoriSelection && product.omamoriSelectionRequired) ||
    (product.enableKhoenSelection && product.khoenSelectionRequired)
  );
  const collectionLabel = useMemo(() => {
    return getCategoryLabel(product.category, categories, collections);
  }, [product.category, categories, collections]);

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      id={`product-card-${product.id}`}
      onClick={() => onOpenDetail(product)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`bg-white rounded-xl sm:rounded-2xl border border-neutral-200/90 hover:border-neutral-400/80 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer shadow-xs hover:shadow-md relative ${
        isSoldOut ? 'opacity-85' : ''
      } ${className}`}
    >
      {/* Product Image Container with Zoom, Skeleton and Silky Horizontal Slide on Hover */}
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        {/* Placeholder skeleton while image is offscreen or downloading */}
        {!isLoaded && (
          <div
            className="absolute inset-0 bg-neutral-200 animate-pulse flex items-center justify-center pointer-events-none z-0 overflow-hidden"
            aria-hidden="true"
          >
            <div className="w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.4s_infinite]" />
          </div>
        )}

        <div className="w-full h-full group-hover:scale-105 transition-transform duration-700 ease-out">
          {isInView && (
            isHovered && images.length > 1 ? (
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.img
                  key={currentIdx}
                  src={images[currentIdx] || product.image || '/assets/bracelet.jpg'}
                  alt={product.name}
                  custom={direction}
                  variants={cardSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: 'tween', ease: [0.25, 1, 0.5, 1], duration: 0.55 },
                    opacity: { duration: 0.35 }
                  }}
                  onLoad={() => setIsLoaded(true)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/bracelet.jpg';
                    setIsLoaded(true);
                  }}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                  } ${isSoldOut ? 'grayscale-[35%]' : ''}`}
                  style={{ imageRendering: '-webkit-optimize-contrast' }}
                  loading="lazy"
                  decoding="async"
                />
              </AnimatePresence>
            ) : (
              <img
                src={images[0] || product.image || '/assets/bracelet.jpg'}
                alt={product.name}
                onLoad={() => setIsLoaded(true)}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/bracelet.jpg';
                  setIsLoaded(true);
                }}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isLoaded ? 'opacity-100' : 'opacity-0'
                } ${isSoldOut ? 'grayscale-[35%]' : ''}`}
                style={{ imageRendering: '-webkit-optimize-contrast' }}
                loading="lazy"
                decoding="async"
              />
            )
          )}
        </div>

        {/* Multi-photo dot indicator */}
        {images.length > 1 && (
          <div className="absolute bottom-1.5 sm:bottom-2 inset-x-0 flex items-center justify-center gap-1 z-10 pointer-events-none">
            {images.map((_, dotIdx) => (
              <span
                key={dotIdx}
                className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${
                  dotIdx === currentIdx
                    ? 'w-3 sm:w-4 bg-white shadow-xs'
                    : 'w-1 sm:w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        )}

        {/* Badges */}
        {isSoldOut ? (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none z-10">
            <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-rose-600 text-white text-[9px] sm:text-xs font-bold rounded-lg uppercase tracking-wider shadow-md">
              Hết Hàng
            </span>
          </div>
        ) : (
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1 pointer-events-none z-10">
            {product.isNew ? (
              <span className="px-2 py-0.5 bg-neutral-900 text-white text-[9px] sm:text-[10px] font-semibold rounded-md shadow-xs">
                Mới
              </span>
            ) : <span />}

            {product.discountBadge && (
              <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[9px] sm:text-[10px] font-bold rounded-md shadow-xs">
                {product.discountBadge}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3 sm:p-4 flex flex-col flex-grow justify-between space-y-2">
        <div className="space-y-1">
          <span className="text-[9px] sm:text-[10px] font-bold text-amber-800 uppercase tracking-wider block truncate">
            {collectionLabel}
          </span>

          <h3 className="font-semibold text-xs sm:text-sm text-neutral-900 group-hover:text-amber-700 transition-colors line-clamp-2 leading-snug min-h-[2rem] sm:min-h-[2.4rem]">
            {product.name}
          </h3>
        </div>

        {/* Price & Action Row */}
        <div className="pt-2 border-t border-neutral-100 space-y-1.5">
          <div className="flex items-center justify-between gap-1">
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-extrabold text-neutral-950 font-mono truncate">
                {product.price.toLocaleString('vi-VN')}đ
              </div>
              {product.originalPrice && (
                <div className="text-[10px] sm:text-xs text-neutral-400 line-through font-mono truncate">
                  {product.originalPrice.toLocaleString('vi-VN')}đ
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={isSoldOut}
              onClick={(e) => {
                e.stopPropagation();
                if (isSoldOut) return;
                if (hasMandatoryOptions) {
                  onOpenDetail(product);
                } else if (onAddToCart) {
                  onAddToCart(product);
                } else {
                  onOpenDetail(product);
                }
              }}
              className={`p-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center shrink-0 ${
                isSoldOut
                  ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                  : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer'
              }`}
              title={
                isSoldOut
                  ? 'Sản phẩm đã hết hàng'
                  : hasMandatoryOptions
                  ? 'Sản phẩm có tùy chọn bắt buộc - Xem chi tiết để chọn'
                  : 'Thêm vào giỏ hàng'
              }
            >
              <ShoppingBag className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Real Stock / Sold info only if present */}
          {product.soldCount !== undefined && product.soldCount > 0 ? (
            <div className="text-[10px] text-neutral-500">
              Đã bán {product.soldCount}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
};

