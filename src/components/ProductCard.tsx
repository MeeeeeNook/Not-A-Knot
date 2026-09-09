import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { Product } from '../types';

export interface ProductCardProps {
  product: Product;
  onOpenDetail: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  className?: string;
}

export const getCategoryLabel = (category?: string): string => {
  switch (category) {
    case 'event_0209':
      return 'Sự kiện 02.09';
    case 'event_2010':
      return 'BST 20/10 Quà Nàng';
    case 'charm_bracelet':
      return 'Vòng Charm';
    case 'everyday':
      return 'Everyday';
    case 'bracelets':
      return 'Vòng Paracord';
    case 'keychains':
      return 'Móc khóa EDC';
    case 'lanyards':
      return 'Dây đeo';
    default:
      return 'Thủ công';
  }
};

const cardSlideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '100%' : '-100%',
    opacity: 1
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (dir: number) => ({
    zIndex: 0,
    x: dir > 0 ? '-100%' : '100%',
    opacity: 1
  })
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onOpenDetail,
  onAddToCart,
  className = ''
}) => {
  const images = useMemo(() => {
    if (product.images && product.images.length > 0) {
      return product.images;
    }
    return [product.image];
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

  // Photos are STATIC by default. When mouse hovers, start auto-slide through photos.
  useEffect(() => {
    if (!isHovered || images.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIdx((prev) => (prev + 1) % images.length);
    }, 1300);

    return () => clearInterval(interval);
  }, [isHovered, images.length]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setDirection(-1);
    setCurrentIdx(0); // Return immediately to initial static photo
  };

  const stockCount = typeof product.stock === 'number' ? product.stock : 15;
  const isSoldOut = !product.inStock || stockCount <= 0;

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
      className={`bg-white rounded-3xl border border-neutral-200/90 hover:border-neutral-400/80 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer shadow-xs hover:shadow-md relative ${
        isSoldOut ? 'opacity-85' : ''
      } ${className}`}
    >
      {/* Product Image Container with Zoom, Skeleton and Horizontal Slide on Hover */}
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        {/* Placeholder skeleton while image is offscreen or downloading */}
        {!isLoaded && (
          <div
            className="absolute inset-0 bg-neutral-200/60 animate-pulse flex items-center justify-center pointer-events-none z-0"
            aria-hidden="true"
          />
        )}

        <div className="w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out">
          {isInView && (
            isHovered && images.length > 1 ? (
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.img
                  key={currentIdx}
                  src={images[currentIdx] || product.image}
                  alt={product.name}
                  custom={direction}
                  variants={cardSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: 'spring', stiffness: 260, damping: 26 },
                    opacity: { duration: 0.1 }
                  }}
                  onLoad={() => setIsLoaded(true)}
                  className={`w-full h-full object-cover transition-opacity duration-200 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                  } ${isSoldOut ? 'grayscale-[35%]' : ''}`}
                  style={{ imageRendering: '-webkit-optimize-contrast' }}
                  loading="lazy"
                  decoding="async"
                />
              </AnimatePresence>
            ) : (
              <img
                src={images[0] || product.image}
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
          <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1.5 z-10 pointer-events-none">
            {images.map((_, dotIdx) => (
              <span
                key={dotIdx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  dotIdx === currentIdx
                    ? 'w-4 bg-white shadow-xs'
                    : 'w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        )}

        {/* Sold out overlay */}
        {isSoldOut ? (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none z-10">
            <span className="px-3.5 py-1.5 bg-rose-600 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-lg border border-white/20 transform -rotate-3">
              Đã Hết Hàng
            </span>
          </div>
        ) : product.discountBadge ? (
          <span className="absolute top-3 right-3 px-2.5 py-1 bg-brand-red text-white text-[11px] font-bold rounded-lg shadow-sm z-10">
            {product.discountBadge}
          </span>
        ) : product.isNew ? (
          <span className="absolute top-3 right-3 px-2.5 py-1 bg-neutral-900 text-white text-[11px] font-bold rounded-lg shadow-sm z-10">
            Mới
          </span>
        ) : null}
      </div>

      {/* Product Info */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow justify-between space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
              {getCategoryLabel(product.category)}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {product.soldCount !== undefined && product.soldCount > 0 && (
                <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                  Đã bán {product.soldCount}
                </span>
              )}
              {isSoldOut && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                  Hết hàng
                </span>
              )}
            </div>
          </div>

          <h3 className="font-bold text-sm text-neutral-900 group-hover:text-amber-700 transition-colors line-clamp-1">
            {product.name}
          </h3>

          <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Price & Single Clean Action Row */}
        <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm sm:text-base font-extrabold text-neutral-950 font-mono">
              {product.price.toLocaleString('vi-VN')}đ
            </div>
            {product.originalPrice && (
              <div className="text-[11px] text-neutral-400 line-through font-mono">
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
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
              isSoldOut
                ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-2xs hover:shadow-sm active:scale-95 cursor-pointer'
            }`}
            title={isSoldOut ? 'Sản phẩm đã hết hàng' : 'Thêm vào giỏ hàng'}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{isSoldOut ? 'Đã hết hàng' : 'Thêm giỏ'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};
