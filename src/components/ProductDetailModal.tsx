import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, ProductColorOption, ProductCharmOption } from '../types';
import { ProductCharmSelector } from './ProductCharmSelector';
import { ProductColorSelector } from './ProductColorSelector';
import { X, Check, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { trackGA4ViewItem } from '../utils/analytics';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (
    product: Product,
    quantity: number,
    selectedColor?: string,
    selectedSize?: string,
    customNote?: string,
    selectedCharm?: string,
    selectedColorImage?: string,
    selectedCharmImage?: string,
    selectedCharmPrice?: number
  ) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart
}) => {
  if (!product) return null;

  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [isAdded, setIsAdded] = useState(false);

  const initialColor = useMemo(() => {
    if (product?.colorOptions && product.colorOptions.length > 0) {
      return product.colorOptions[0].name;
    }
    return product?.availableColors?.[0];
  }, [product]);

  const initialColorImage = useMemo(() => {
    if (product?.colorOptions && product.colorOptions.length > 0) {
      return product.colorOptions[0].image;
    }
    return undefined;
  }, [product]);

  const [selectedColor, setSelectedColor] = useState<string | undefined>(initialColor);
  const [selectedColorImage, setSelectedColorImage] = useState<string | undefined>(initialColorImage);
  const [selectedCharm, setSelectedCharm] = useState<string | undefined>(undefined);
  const [selectedCharmImage, setSelectedCharmImage] = useState<string | undefined>(undefined);
  const [selectedCharmPrice, setSelectedCharmPrice] = useState<number | undefined>(undefined);
  const [charmError, setCharmError] = useState<string | null>(null);

  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    product?.availableSizes?.[0]
  );

  useEffect(() => {
    setActiveImageIdx(0);
    setQuantity(1);
    setSelectedColor(product?.colorOptions?.[0]?.name || product?.availableColors?.[0]);
    setSelectedColorImage(product?.colorOptions?.[0]?.image);
    setSelectedCharm(undefined);
    setSelectedCharmImage(undefined);
    setSelectedCharmPrice(undefined);
    setCharmError(null);
    setSelectedSize(product?.availableSizes?.[0]);

    if (product) {
      trackGA4ViewItem(product);
    }
  }, [product?.id]);

  const images = useMemo(() => {
    const base = product.images && product.images.length > 0 ? [...product.images] : [product.image];
    if (selectedColorImage && !base.includes(selectedColorImage)) {
      return [selectedColorImage, ...base];
    }
    return base;
  }, [product, selectedColorImage]);

  const availableStock = typeof product.stock === 'number' && product.stock > 1 ? product.stock : 99;
  const isOutOfStock = product.inStock === false;

  const paginate = useCallback((newDirection: number) => {
    setActiveImageIdx((curr) => {
      let next = curr + newDirection;
      if (next < 0) next = images.length - 1;
      if (next >= images.length) next = 0;
      return next;
    });
  }, [images.length]);

  const selectImage = useCallback((idx: number) => {
    setActiveImageIdx(idx);
  }, []);

  const handleSelectColor = (colorOpt: ProductColorOption) => {
    setSelectedColor(colorOpt.name);
    if (colorOpt.image) {
      setSelectedColorImage(colorOpt.image);
      const imgIdx = images.indexOf(colorOpt.image);
      if (imgIdx > -1) {
        setActiveImageIdx(imgIdx);
      } else {
        setActiveImageIdx(0);
      }
    }
  };

  const handleSelectCharm = (charmOpt: ProductCharmOption | null) => {
    setCharmError(null);
    if (!charmOpt) {
      setSelectedCharm(undefined);
      setSelectedCharmImage(undefined);
      setSelectedCharmPrice(undefined);
    } else {
      if (typeof charmOpt.stock === 'number' && charmOpt.stock <= 0) {
        setCharmError(`Mẫu charm "${charmOpt.name}" đã hết hàng trong kho. Vui lòng chọn mẫu khác.`);
        return;
      }
      setSelectedCharm(charmOpt.name);
      setSelectedCharmImage(charmOpt.image);
      setSelectedCharmPrice(charmOpt.priceDelta || 0);
    }
  };

  const handleAdd = () => {
    if (isOutOfStock) return;

    if (product.enableCharmSelection && product.charmSelectionRequired && !selectedCharm) {
      setCharmError('Vui lòng chọn 1 mẫu charm trước khi thêm.');
      return;
    }

    if (selectedCharm && product.charmOptions) {
      const chosenCharm = product.charmOptions.find(
        (c) => c.name.trim().toLowerCase() === selectedCharm.trim().toLowerCase()
      );
      if (chosenCharm && typeof chosenCharm.stock === 'number') {
        if (chosenCharm.stock <= 0) {
          setCharmError(`Mẫu charm "${chosenCharm.name}" hiện đã hết hàng. Vui lòng chọn mẫu charm khác.`);
          return;
        }
        if (chosenCharm.stock < quantity) {
          setCharmError(`Mẫu charm "${chosenCharm.name}" chỉ còn ${chosenCharm.stock} cái trong kho, không đủ số lượng ${quantity}.`);
          return;
        }
      }
    }

    onAddToCart(
      product,
      quantity,
      selectedColor,
      selectedSize,
      undefined,
      selectedCharm,
      selectedColorImage,
      selectedCharmImage,
      selectedCharmPrice
    );
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
      onClose();
    }, 1000);
  };

  return (
    <div
      id="product-detail-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="product-detail-modal-content"
        className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden relative border border-neutral-200 my-auto text-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          id="close-product-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full transition-colors"
          aria-label="Đóng cửa sổ"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Images Section */}
          <div className="bg-neutral-50 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-neutral-200">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-white shadow-sm mb-4 group">
              {/* Main Image Carousel Track: Flex wrapper with overflow-hidden and animated horizontal transform */}
              <div
                className="flex w-full h-full transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${activeImageIdx * 100}%)` }}
              >
                {images.map((imgSrc, idx) => (
                  <div key={idx} className="w-full h-full flex-shrink-0 relative">
                    <img
                      src={imgSrc}
                      alt={`${product.name} - Ảnh ${idx + 1}`}
                      className="w-full h-full object-cover select-none pointer-events-none"
                      style={{ imageRendering: '-webkit-optimize-contrast' }}
                      draggable={false}
                    />
                  </div>
                ))}
              </div>

              {images.length > 1 && (
                <>
                  {/* Left edge hover zone */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 z-20 flex items-center justify-start pl-2.5 group/edge-left cursor-pointer select-none"
                    onClick={() => paginate(-1)}
                    title="Ảnh trước"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        paginate(-1);
                      }}
                      className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-black/15 hover:bg-black/40 backdrop-blur-md border border-white/20 text-white/90 hover:text-white flex items-center justify-center opacity-0 group-hover/edge-left:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-xs"
                      aria-label="Ảnh trước"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" strokeWidth={2} />
                    </button>
                  </div>

                  {/* Right edge hover zone */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 z-20 flex items-center justify-end pr-2.5 group/edge-right cursor-pointer select-none"
                    onClick={() => paginate(1)}
                    title="Ảnh sau"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        paginate(1);
                      }}
                      className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-black/15 hover:bg-black/40 backdrop-blur-md border border-white/20 text-white/90 hover:text-white flex items-center justify-center opacity-0 group-hover/edge-right:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-xs"
                      aria-label="Ảnh sau"
                    >
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" strokeWidth={2} />
                    </button>
                  </div>
                </>
              )}

              {product.isEvent0209 && (
                <div className="absolute top-3 left-3 bg-brand-red text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm z-10">
                  Bản giới hạn 02.09
                </div>
              )}
            </div>

            {/* Thumbnail switcher */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => selectImage(i)}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${
                      i === activeImageIdx
                        ? 'border-neutral-900 ring-1 ring-neutral-900/20'
                        : 'border-neutral-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt="thumb"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info & Options */}
          <div className="p-6 sm:p-8 flex flex-col justify-between max-h-[85vh] overflow-y-auto">
            <div className="space-y-4">
              {/* Category */}
              <span className="text-xs font-semibold uppercase text-neutral-500 tracking-wider block">
                {product.category === 'event_0209'
                  ? 'Sự kiện Quốc khánh 02.09'
                  : product.category === 'event_2010'
                  ? 'BST 20/10 — Quà Tặng Nàng'
                  : product.category === 'charm_bracelet'
                  ? 'Vòng Charm Biểu Tượng'
                  : product.category === 'everyday'
                  ? 'Everyday Wear — Đeo Hàng Ngày'
                  : product.category === 'bracelets'
                  ? 'Vòng Tay Paracord 550'
                  : product.category === 'keychains'
                  ? 'Móc Khóa EDC'
                  : product.category === 'lanyards'
                  ? 'Dây Đeo Phụ Kiện'
                  : 'Phụ Kiện Thủ Công'}
              </span>

              {/* Title & Stock badge */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 tracking-tight">
                    {product.name}
                  </h2>
                  {product.soldCount !== undefined && product.soldCount > 0 && (
                    <span className="bg-neutral-100 text-neutral-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-neutral-200">
                      Đã bán {product.soldCount}
                    </span>
                  )}
                  {isOutOfStock ? (
                    <span className="bg-red-100 text-brand-red text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      Hết hàng
                    </span>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Còn {availableStock} sản phẩm
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-neutral-950">
                  {product.price.toLocaleString('vi-VN')}đ
                </span>
                {product.originalPrice && (
                  <span className="text-sm text-neutral-400 line-through font-normal">
                    {product.originalPrice.toLocaleString('vi-VN')}đ
                  </span>
                )}
                {product.discountBadge && !isOutOfStock && (
                  <span className="bg-red-50 text-brand-red text-xs font-semibold px-2 py-0.5 rounded-full border border-red-200">
                    {product.discountBadge}
                  </span>
                )}
              </div>

              {/* Out of Stock Notice */}
              {isOutOfStock && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-xs text-brand-red font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-red flex-shrink-0 animate-ping" />
                  <span>Sản phẩm này hiện đã hết hàng trong kho. Quý khách có thể liên hệ trực tiếp để được thông báo khi có hàng lại!</span>
                </div>
              )}

              {/* Description */}
              <p className="text-neutral-600 text-xs sm:text-sm leading-relaxed">
                {product.description}
              </p>

              {/* Color Selection (if enabled) */}
              {product.enableColorSelection !== false &&
                ((product.colorOptions && product.colorOptions.length > 0) ||
                  (product.availableColors && product.availableColors.length > 0)) && (
                  <ProductColorSelector
                    colors={
                      product.colorOptions && product.colorOptions.length > 0
                        ? product.colorOptions
                        : product.availableColors || []
                    }
                    selectedColor={selectedColor}
                    onSelectColor={handleSelectColor}
                  />
                )}

              {/* Charm Selection (if enabled) */}
              {product.enableCharmSelection &&
                product.charmOptions &&
                product.charmOptions.length > 0 && (
                  <div className="space-y-1">
                    <ProductCharmSelector
                      charms={product.charmOptions}
                      selectedCharm={selectedCharm}
                      onSelectCharm={handleSelectCharm}
                      isRequired={product.charmSelectionRequired}
                    />
                    {charmError && (
                      <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl animate-shake">
                        ⚠️ {charmError}
                      </p>
                    )}
                  </div>
                )}

              {/* Size Variants (if enabled) */}
              {product.enableSizeSelection !== false &&
                product.availableSizes &&
                product.availableSizes.length > 0 && (
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
                          className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            selectedSize === size
                              ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm'
                              : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-400'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Product Specifications list */}
              {product.details && product.details.length > 0 && (
                <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 space-y-1.5">
                  <span className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wider block">
                    Đặc điểm sản phẩm
                  </span>
                  {product.details.map((detail, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-neutral-600 font-normal">
                      <span className="text-neutral-400">•</span>
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quantity */}
              {!isOutOfStock && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs font-semibold text-neutral-700">Số lượng:</span>
                  <div className="flex items-center border border-neutral-300 rounded-full overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-1 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 text-xs font-semibold text-neutral-900 min-w-[28px] text-center">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                      disabled={quantity >= availableStock}
                      className="px-3 py-1 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-neutral-50 text-neutral-700 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                  {quantity >= availableStock && availableStock < 90 && (
                    <span className="text-[11px] text-amber-700 font-medium">Tối đa ({availableStock})</span>
                  )}
                  {selectedCharmPrice && selectedCharmPrice > 0 ? (
                    <span className="text-xs text-amber-800 font-medium">
                      +{(selectedCharmPrice * quantity).toLocaleString('vi-VN')}đ (charm)
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {/* Single Apple-style Action Button */}
            <div className="pt-6 border-t border-neutral-200 mt-6 space-y-2">
              <button
                id="modal-add-to-cart-btn"
                type="button"
                onClick={handleAdd}
                disabled={isOutOfStock}
                className={`w-full py-3.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
                  isOutOfStock
                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none'
                    : isAdded
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-950 text-white hover:bg-neutral-800'
                }`}
              >
                {isOutOfStock ? (
                  <span>Tạm Hết Hàng</span>
                ) : isAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Đã thêm vào giỏ hàng</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      Thêm vào giỏ ({quantity}) — {((product.price + (selectedCharmPrice || 0)) * quantity).toLocaleString('vi-VN')}đ
                    </span>
                  </>
                )}
              </button>

              {/* Messenger consultation link */}
              <a
                id="modal-messenger-contact-btn"
                href="https://m.me/61593591390851"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-full border border-neutral-300 hover:border-neutral-900 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4 text-[#0084FF] fill-current flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.908 1.455 5.503 3.735 7.152V22l3.447-1.892c.905.251 1.865.388 2.818.388 5.523 0 10-4.145 10-9.238C22 6.145 17.523 2 12 2zm1.05 12.355l-2.673-2.85-5.215 2.85 5.735-6.09 2.741 2.85 5.147-2.85-5.735 6.09z" />
                </svg>
                <span>Nhắn tin tư vấn sản phẩm qua Messenger</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
