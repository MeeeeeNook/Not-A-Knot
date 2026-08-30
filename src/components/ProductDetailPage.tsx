import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, CategoryItem } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Check,
  ShieldCheck,
  Truck,
  RotateCcw,
  Star,
  Share2,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { trackGA4ViewItem } from '../utils/analytics';

interface ProductDetailPageProps {
  product: Product;
  allProducts: Product[];
  categories?: CategoryItem[];
  backLabel?: string;
  onBack: () => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (
    product: Product,
    quantity: number,
    selectedColor?: string,
    selectedSize?: string
  ) => void;
  onBuyNow: (
    product: Product,
    quantity: number,
    selectedColor?: string,
    selectedSize?: string
  ) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  allProducts,
  categories = [],
  backLabel,
  onBack,
  onSelectProduct,
  onAddToCart,
  onBuyNow,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(
    product.availableColors?.[0]
  );
  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    product.availableSizes?.[0]
  );
  const [isAdded, setIsAdded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Reset state when product changes
  useEffect(() => {
    setActiveImageIdx(0);
    setQuantity(1);
    setSelectedColor(product.availableColors?.[0]);
    setSelectedSize(product.availableSizes?.[0]);
    setIsAdded(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (product) {
      trackGA4ViewItem(product);
    }
  }, [product?.id]);

  const images = useMemo(() => {
    if (product.images && product.images.length > 0) {
      return product.images;
    }
    return [product.image];
  }, [product]);

  const availableStock = typeof product.stock === 'number' ? product.stock : 15;
  const isOutOfStock = product.inStock === false || availableStock <= 0;

  const prevImage = useCallback(() => {
    setActiveImageIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const nextImage = useCallback(() => {
    setActiveImageIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  // Keyboard navigation for image gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevImage, nextImage]);

  const handleAddToCartClick = () => {
    if (isOutOfStock) return;
    onAddToCart(product, quantity, selectedColor, selectedSize);
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 2000);
  };

  const handleBuyNowClick = () => {
    if (isOutOfStock) return;
    onBuyNow(product, quantity, selectedColor, selectedSize);
  };

  const handleShare = () => {
    const url = window.location.origin + window.location.pathname + `#product/${product.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Find related products in the same category
  const relatedProducts = useMemo(() => {
    return allProducts
      .filter((p) => p.id !== product.id && p.category === product.category)
      .slice(0, 4);
  }, [allProducts, product]);

  const categoryName = useMemo(() => {
    const match = categories.find((c) => c.id === product.category);
    if (match) return match.label;
    if (product.category === 'event_0209') return 'BST Quốc Khánh 02.09';
    if (product.category === 'event_2010') return 'BST 20/10 Quà Nàng';
    if (product.category === 'charm_bracelet') return 'Vòng Charm Phong Cách';
    if (product.category === 'everyday') return 'Everyday Wear';
    if (product.category === 'bracelets') return 'Vòng Paracord 550';
    if (product.category === 'keychains') return 'Móc Khóa EDC';
    if (product.category === 'lanyards') return 'Dây Đeo Phụ Kiện';
    return 'Phụ Kiện Thủ Công';
  }, [categories, product.category]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      id={`product-detail-page-${product.id}`}
      className="min-h-screen bg-[#FAF8F5] text-neutral-900 font-sans pb-24"
    >
      {/* Top Breadcrumb & Navigation Bar */}
      <div className="bg-white border-b border-neutral-200/80 sticky top-14 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-neutral-700 hover:text-neutral-950 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{backLabel || 'Quay lại danh mục sản phẩm'}</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-neutral-500 hidden sm:inline">
              {categoryName}
            </span>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors cursor-pointer"
              title="Sao chép link sản phẩm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedLink ? 'Đã sao chép!' : 'Chia sẻ'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-12">
        {/* Product Hero: Left Gallery, Right Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* LEFT: Interactive High-Res Gallery */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative aspect-square rounded-3xl overflow-hidden bg-white border border-neutral-200 shadow-md group">
              {/* Main Image with Animated Transition */}
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImageIdx}
                  src={images[activeImageIdx] || product.image}
                  alt={product.name}
                  initial={{ opacity: 0.7, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.7 }}
                  transition={{ duration: 0.25 }}
                  className="w-full h-full object-cover object-center"
                />
              </AnimatePresence>

              {/* Navigation Arrows for switching photos */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-neutral-900 flex items-center justify-center shadow-lg border border-neutral-200 transition-all hover:scale-105 active:scale-95 cursor-pointer z-10"
                    aria-label="Ảnh trước (hoặc phím mũi tên trái)"
                    title="Ảnh trước (Phím ←)"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  <button
                    onClick={nextImage}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-neutral-900 flex items-center justify-center shadow-lg border border-neutral-200 transition-all hover:scale-105 active:scale-95 cursor-pointer z-10"
                    aria-label="Ảnh tiếp theo (hoặc phím mũi tên phải)"
                    title="Ảnh tiếp theo (Phím →)"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Photo Index Counter */}
              {images.length > 1 && (
                <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/65 backdrop-blur-md text-white text-xs font-bold rounded-full pointer-events-none">
                  {activeImageIdx + 1} / {images.length}
                </div>
              )}
            </div>

            {/* Thumbnail Strip (Click to choose photo) */}
            {images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {images.map((img, idx) => {
                  const isActive = idx === activeImageIdx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 bg-white cursor-pointer ${
                        isActive
                          ? 'border-neutral-950 ring-2 ring-neutral-950/20 scale-102 shadow-sm'
                          : 'border-neutral-200 opacity-60 hover:opacity-100 hover:border-neutral-400'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${product.name} thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {idx === 0 && (
                        <span className="absolute bottom-0 inset-x-0 bg-neutral-900/80 text-[9px] text-white text-center font-bold py-0.5">
                          Ảnh chính
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Product Information & Purchase Panel */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-sm space-y-6">
              
              {/* Category & Title */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">
                  {categoryName}
                </span>

                <h1 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight leading-tight">
                  {product.name}
                </h1>

                {/* Rating & Stock status */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center gap-1 text-amber-500">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold text-neutral-900">
                      {product.rating || 5.0}
                    </span>
                    <span className="text-xs text-neutral-400">
                      ({product.reviewsCount || 12} đánh giá)
                    </span>
                  </div>

                  <span className="text-neutral-300">•</span>

                  {isOutOfStock ? (
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md">
                      Hết hàng
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                      Còn {availableStock} sản phẩm
                    </span>
                  )}
                </div>
              </div>

              {/* Price Row */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-baseline gap-3">
                <span className="text-3xl font-black text-neutral-950 font-mono">
                  {product.price.toLocaleString('vi-VN')}đ
                </span>
                {product.originalPrice && (
                  <span className="text-base text-neutral-400 line-through font-mono">
                    {product.originalPrice.toLocaleString('vi-VN')}đ
                  </span>
                )}
                {product.discountBadge && (
                  <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded">
                    {product.discountBadge}
                  </span>
                )}
              </div>

              {/* Short Description */}
              <p className="text-sm text-neutral-600 leading-relaxed">
                {product.description}
              </p>

              {/* Color Variants (if available) */}
              {product.availableColors && product.availableColors.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider">
                    Màu sắc: <span className="text-amber-700 font-semibold">{selectedColor}</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.availableColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          selectedColor === color
                            ? 'border-neutral-950 bg-neutral-950 text-white'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-400'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Variants (if available) */}
              {product.availableSizes && product.availableSizes.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider">
                    Kích thước cổ tay: <span className="text-amber-700 font-semibold">{selectedSize}</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.availableSizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          selectedSize === size
                            ? 'border-neutral-950 bg-neutral-950 text-white'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-400'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Selector & Action Buttons */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-neutral-200 rounded-2xl bg-neutral-50 p-1">
                    <button
                      type="button"
                      disabled={quantity <= 1 || isOutOfStock}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-12 text-center font-bold text-sm text-neutral-900">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      disabled={quantity >= availableStock || isOutOfStock}
                      onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                      className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-xs text-neutral-500">
                    Tạm tính:{' '}
                    <strong className="text-neutral-950 font-mono text-sm">
                      {(product.price * quantity).toLocaleString('vi-VN')}đ
                    </strong>
                  </div>
                </div>

                {/* Primary CTA Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isOutOfStock}
                    onClick={handleAddToCartClick}
                    className={`py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isOutOfStock
                        ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                        : isAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-950 hover:bg-neutral-800 text-white shadow-md active:scale-98'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Đã thêm vào giỏ</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>Thêm Vào Giỏ</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isOutOfStock}
                    onClick={handleBuyNowClick}
                    className={`py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isOutOfStock
                        ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                        : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-md active:scale-98'
                    }`}
                  >
                    <span>Mua Ngay</span>
                  </button>
                </div>
              </div>

              {/* Service & Quality Guarantees */}
              <div className="pt-4 border-t border-neutral-100 grid grid-cols-1 gap-2.5 text-xs text-neutral-600">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Dây Paracord 550 chuẩn 7 lõi siêu bền, chống nước tuyệt đối.</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Giao hàng toàn quốc — Kiểm tra hàng trước khi thanh toán.</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Bảo hành nút thắt trọn đời — Đổi trả miễn phí 7 ngày nếu lỗi.</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Product Details & Specifications */}
        {product.details && product.details.length > 0 && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-sm space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-neutral-950 tracking-tight">
              Đặc Điểm & Thông Số Chế Tác
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {product.details.map((detail, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-start gap-3 text-xs sm:text-sm text-neutral-700"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 flex-shrink-0" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <section className="space-y-6 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight">
                Sản Phẩm Cùng Bộ Sưu Tập
              </h2>
              <button
                onClick={onBack}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 transition-colors"
              >
                Xem tất cả →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {relatedProducts.map((rel) => (
                <motion.div
                  key={rel.id}
                  whileHover={{ y: -4 }}
                  onClick={() => onSelectProduct(rel)}
                  className="bg-white rounded-3xl border border-neutral-200 hover:border-neutral-400 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer shadow-2xs hover:shadow-md"
                >
                  <div className="relative aspect-square overflow-hidden bg-neutral-100">
                    <img
                      src={rel.image}
                      alt={rel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {rel.discountBadge && (
                      <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 bg-brand-red text-white text-[10px] font-bold rounded-full">
                        {rel.discountBadge}
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1 justify-between space-y-2">
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-neutral-900 group-hover:text-amber-700 line-clamp-1">
                        {rel.name}
                      </h3>
                      <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                        {rel.description}
                      </p>
                    </div>
                    <div className="font-mono text-xs sm:text-sm font-bold text-neutral-950">
                      {rel.price.toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

      </main>
    </motion.div>
  );
};
