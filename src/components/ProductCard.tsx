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
  if (!category || category === 'all') return 'Bộ Sưu Tập NOT A KNOT';

  // Check provided collections
  if (collections && collections.length > 0) {
    const foundCol = collections.find(
      (c) => c.id === category || c.categoryKey === category
    );
    if (foundCol && (foundCol.tag || foundCol.title)) return foundCol.tag || foundCol.title;
  }

  // Check provided categories
  if (categories && categories.length > 0) {
    const found = categories.find((c) => c.id === category);
    if (found && found.label) return found.label;
  }

  // Check DEFAULT_CATEGORIES
  const defaultFound = DEFAULT_CATEGORIES.find((c) => c.id === category);
  if (defaultFound && defaultFound.label) return defaultFound.label;

  switch (category) {
    case 'event_0209':
      return 'BST Quốc Khánh 02.09';
    case 'event_2010':
      return 'BST Phụ Nữ 20.10';
    case 'bracelets':
      return 'Bản Đan Paracord EDC';
    case 'back_to_school':
      return 'BST Back 2 School';
    default:
      if (category.trim().length > 0) {
        return category.startsWith('BST') ? category : `BST ${category}`;
      }
      return 'Bộ Sưu Tập NOT A KNOT';
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
      className={`bg-white rounded-2xl sm:rounded-3xl border border-neutral-200/90 hover:border-neutral-400/80 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer shadow-xs hover:shadow-md relative ${
        isSoldOut ? 'opacity-85' : ''
      } ${className}`}
    >
      {/* Product Image Container with Zoom, Skeleton and Silky Horizontal Slide on Hover */}
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        {/* Placeholder skeleton while image is offscreen or downloading */}
        {!isLoaded && (
          <div
            className="absolute inset-0 bg-neutral-200/60 animate-pulse flex items-center justify-center pointer-events-none z-0"
            aria-hidden="true"
          />
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
          <div className="absolute bottom-2 sm:bottom-2.5 inset-x-0 flex items-center justify-center gap-1 sm:gap-1.5 z-10 pointer-events-none">
            {images.map((_, dotIdx) => (
              <span
                key={dotIdx}
                className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${
                  dotIdx === currentIdx
                    ? 'w-3.5 sm:w-4 bg-white shadow-xs'
                    : 'w-1 sm:w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        )}

        {/* Sold out overlay */}
        {isSoldOut ? (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none z-10">
            <span className="px-2.5 py-1 sm:px-3.5 sm:py-1.5 bg-rose-600 text-white text-[10px] sm:text-xs font-black rounded-lg sm:rounded-xl uppercase tracking-wider shadow-lg border border-white/20 transform -rotate-3">
              Đã Hết Hàng
            </span>
          </div>
        ) : product.discountBadge ? (
          <span className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-brand-red text-white text-[9px] sm:text-[11px] font-bold rounded-md sm:rounded-lg shadow-xs z-10">
            {product.discountBadge}
          </span>
        ) : product.isNew ? (
          <span className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-neutral-900 text-white text-[9px] sm:text-[11px] font-bold rounded-md sm:rounded-lg shadow-xs z-10">
            Mới
          </span>
        ) : null}
      </div>

      {/* Product Info - Responsive for 2-column mobile layout & multi-column desktop */}
      <div className="p-3 sm:p-5 flex flex-col flex-grow justify-between space-y-2 sm:space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[10px] font-bold text-amber-800 uppercase tracking-wider block truncate max-w-[140px] sm:max-w-none">
              {collectionLabel}
            </span>
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end shrink-0">
              {product.soldCount !== undefined && product.soldCount > 0 && (
                <span className="text-[9px] sm:text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                  Đã bán {product.soldCount}
                </span>
              )}
              {isSoldOut && (
                <span className="text-[9px] sm:text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                  Hết hàng
                </span>
              )}
            </div>
          </div>

          <h3 className="font-bold text-xs sm:text-sm text-neutral-900 group-hover:text-amber-700 transition-colors line-clamp-1 leading-snug">
            {product.name}
          </h3>

          <p className="text-[11px] sm:text-xs text-neutral-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Price & Single Clean Action Row */}
        <div className="pt-2 sm:pt-3 border-t border-neutral-100 flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="min-w-0">
            <div className="text-xs sm:text-base font-extrabold text-neutral-950 font-mono truncate">
              {product.price.toLocaleString('vi-VN')}đ
            </div>
            {product.originalPrice && (
              <div className="text-[9px] sm:text-[11px] text-neutral-400 line-through font-mono truncate">
                {product.originalPrice.toLocaleString('vi-VN')}đ
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isSoldOut || !onAddToCart}
            onClick={(e) => {
              e.stopPropagation();
              if (!isSoldOut && onAddToCart) {
                onAddToCart(product);
              }
            }}
            className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 flex items-center gap-1 sm:gap-1.5 shrink-0 ${
              isSoldOut
                ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-2xs hover:shadow-sm active:scale-95 cursor-pointer'
            }`}
            title={isSoldOut ? 'Sản phẩm đã hết hàng' : 'Thêm vào giỏ hàng'}
          >
            <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{isSoldOut ? 'Đã hết' : 'Thêm giỏ'}</span>
            <span className="sm:hidden">{isSoldOut ? 'Hết' : 'Thêm'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

