import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
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
  const [isHovered, setIsHovered] = useState(false);

  // Auto-switch between photos until hovered on. When hovered, reset to 0 (default photo).
  useEffect(() => {
    if (isHovered || images.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % images.length);
    }, 2600);

    return () => clearInterval(interval);
  }, [isHovered, images.length]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setCurrentIdx(0); // Immediately reset to the default first photo
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const isSoldOut = !product.inStock || (product.stock !== undefined && product.stock <= 0);

  return (
    <motion.div
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
      {/* Product Image Container */}
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        <img
          src={images[currentIdx] || product.image}
          alt={product.name}
          className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ease-out ${
            isSoldOut ? 'grayscale-[35%]' : ''
          }`}
          loading="lazy"
        />

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

        {/* Stock status badge / overlay */}
        {isSoldOut ? (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
            <span className="px-3.5 py-1.5 bg-rose-600 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-lg border border-white/20 transform -rotate-3">
              Đã Hết Hàng
            </span>
          </div>
        ) : product.discountBadge ? (
          <span className="absolute top-3 right-3 px-2.5 py-1 bg-brand-red text-white text-[11px] font-bold rounded-lg shadow-sm">
            {product.discountBadge}
          </span>
        ) : product.isNew ? (
          <span className="absolute top-3 right-3 px-2.5 py-1 bg-neutral-900 text-white text-[11px] font-bold rounded-lg shadow-sm">
            Mới
          </span>
        ) : null}

        {/* Remaining stock tag */}
        {!isSoldOut && product.stock !== undefined && product.stock > 0 && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-0.5 bg-white/95 text-emerald-800 text-[10px] font-bold rounded-md shadow-2xs">
              Còn {product.stock}
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow justify-between space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
              {getCategoryLabel(product.category)}
            </span>
            {isSoldOut && (
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                Hết hàng
              </span>
            )}
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
