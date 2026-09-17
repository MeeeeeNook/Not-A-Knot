import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, ProductColorOption, ProductCharmOption, ProductOmamoriOption, ProductKhoenOption } from '../types';
import { DEFAULT_OMAMORI_PRESETS } from '../data/sampleOmamori';
import { DEFAULT_KHOEN_PRESETS } from '../data/sampleKhoen';
import { ProductCharmSelector } from './ProductCharmSelector';
import { ProductOmamoriSelector } from './ProductOmamoriSelector';
import { ProductKhoenSelector } from './ProductKhoenSelector';
import { ProductColorSelector } from './ProductColorSelector';
import { ProductImageCompareModal, CompareItem } from './ProductImageCompareModal';
import { LoadingImage } from './LoadingImage';
import { X, Check, ShoppingBag, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { trackGA4ViewItem, trackGA4PageView } from '../utils/analytics';
import { resolveAssetUrl } from '../firebase';
import { useProductSEO } from '../utils/seo';

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
    selectedCharmPrice?: number,
    selectedCharms?: ProductCharmOption[],
    selectedOmamoris?: ProductOmamoriOption[],
    selectedOmamoriPrice?: number,
    selectedKhoen?: string,
    selectedKhoenImage?: string,
    selectedKhoenPrice?: number
  ) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart
}) => {
  useProductSEO(product, product?.category);

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
  const [selectedCharms, setSelectedCharms] = useState<ProductCharmOption[]>([]);
  const [charmError, setCharmError] = useState<string | null>(null);
  const [selectedOmamoris, setSelectedOmamoris] = useState<ProductOmamoriOption[]>([]);
  const [omamoriError, setOmamoriError] = useState<string | null>(null);
  const [selectedKhoen, setSelectedKhoen] = useState<ProductKhoenOption | null>(null);
  const [khoenError, setKhoenError] = useState<string | null>(null);

  const totalCharmPrice = useMemo(() => {
    return selectedCharms.reduce((sum, c) => sum + (c.priceDelta || 0), 0);
  }, [selectedCharms]);

  const totalOmamoriPrice = useMemo(() => {
    return selectedOmamoris.reduce((sum, o) => sum + (o.priceDelta || 0), 0);
  }, [selectedOmamoris]);

  const totalKhoenPrice = selectedKhoen?.priceDelta || 0;

  const effectiveUnitPrice = (product?.price || 0) + totalCharmPrice + totalOmamoriPrice + totalKhoenPrice;

  const selectedCharmNames = useMemo(() => {
    return selectedCharms.map((c) => c.name).join(', ');
  }, [selectedCharms]);

  useEffect(() => {
    setActiveImageIdx(0);
    setQuantity(1);
    const inStockColor = product?.colorOptions?.find((c) => c.stock === undefined || c.stock > 0);
    setSelectedColor(inStockColor ? inStockColor.name : (product?.colorOptions?.[0]?.name || product?.availableColors?.[0]));
    setSelectedColorImage(inStockColor ? inStockColor.image : product?.colorOptions?.[0]?.image);
    setSelectedCharms([]);
    setSelectedOmamoris([]);
    setSelectedKhoen(null);
    setCharmError(null);
    setOmamoriError(null);
    setKhoenError(null);

    if (product) {
      trackGA4ViewItem(product);
      trackGA4PageView(`#product-modal?id=${product.id}`, `Xem Nhanh: ${product.name} - NOT A KNOT`);

      // Preload product images and option images when modal opens
      const optionImageUrls: string[] = [];
      product.charmOptions?.forEach((c) => c.image && optionImageUrls.push(resolveAssetUrl(c.image)));
      product.omamoriOptions?.forEach((o) => o.image && optionImageUrls.push(resolveAssetUrl(o.image)));
      product.khoenOptions?.forEach((k) => k.image && optionImageUrls.push(resolveAssetUrl(k.image)));
      product.colorOptions?.forEach((cl) => {
        if (typeof cl !== 'string' && cl.image) {
          optionImageUrls.push(resolveAssetUrl(cl.image));
        }
      });

      optionImageUrls.forEach((url) => {
        if (url && url !== '/assets/bracelet.jpg') {
          const img = new Image();
          img.src = url;
        }
      });
    }
  }, [product?.id]);

  const images = useMemo(() => {
    const rawList = product.images && product.images.length > 0 ? product.images : [product.image];
    const validBase = rawList.filter(
      (img) => typeof img === 'string' && img.trim().length > 0
    );
    const resolved = validBase.map((img) => resolveAssetUrl(img));
    return resolved.length > 0 ? resolved : ['/assets/bracelet.jpg'];
  }, [product.images, product.image]);

  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const compareItems: CompareItem[] = useMemo(() => {
    return images.map((img, i) => {
      const matchingColor = product?.colorOptions?.find((c) => c.image === img);
      return {
        id: `modal-img-${i}`,
        title: matchingColor ? `${product?.name} (${matchingColor.name})` : `${product?.name || 'Sản phẩm'} - Ảnh ${i + 1}`,
        image: img,
        subtitle: matchingColor ? `Phân loại: ${matchingColor.name}` : undefined,
        type: 'product',
        originalData: matchingColor,
      };
    });
  }, [images, product]);

  const selectedColorOption = useMemo(() => {
    if (!selectedColor || !product?.colorOptions) return undefined;
    return product.colorOptions.find(
      (c) => c.name.trim().toLowerCase() === selectedColor.trim().toLowerCase()
    );
  }, [product?.colorOptions, selectedColor]);

  const currentColorStock = typeof selectedColorOption?.stock === 'number'
    ? selectedColorOption.stock
    : undefined;

  const availableStock = currentColorStock !== undefined
    ? currentColorStock
    : (typeof product?.stock === 'number' && product.stock > 0 ? product.stock : 99);
  const isOutOfStock = product?.inStock === false || availableStock <= 0;

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

  const handleSelectCharms = (charms: ProductCharmOption[]) => {
    setCharmError(null);
    setSelectedCharms(charms);
  };

  const handleSelectOmamoris = (omamoris: ProductOmamoriOption[]) => {
    setOmamoriError(null);
    setSelectedOmamoris(omamoris);
  };

  const handleAdd = () => {
    if (isOutOfStock) return;

    const charmTitleLabel = product.charmTitle?.trim() || 'Charm';
    const omamoriTitleLabel = product.omamoriTitle?.trim() || 'Bùa Omamori';

    if (product.enableCharmSelection && product.charmSelectionRequired && selectedCharms.length === 0) {
      setCharmError(`Vui lòng chọn ít nhất 1 tùy chọn trong "${charmTitleLabel}" trước khi thêm.`);
      return;
    }

    if (product.enableOmamoriSelection && product.omamoriSelectionRequired && selectedOmamoris.length === 0) {
      setOmamoriError(`Vui lòng chọn ít nhất 1 tùy chọn trong "${omamoriTitleLabel}" trước khi thêm.`);
      return;
    }

    const khoenTitleLabel = product.khoenTitle?.trim() || 'Khoen';
    if (product.enableKhoenSelection && product.khoenSelectionRequired && !selectedKhoen) {
      setKhoenError(`Vui lòng chọn 1 tùy chọn trong "${khoenTitleLabel}" trước khi thêm.`);
      return;
    }

    if (selectedColorOption && typeof selectedColorOption.stock === 'number') {
      if (selectedColorOption.stock <= 0) {
        alert(`Màu "${selectedColorOption.name}" hiện đã hết hàng. Vui lòng chọn màu khác.`);
        return;
      }
      if (selectedColorOption.stock < quantity) {
        alert(`Màu "${selectedColorOption.name}" chỉ còn ${selectedColorOption.stock} chiếc trong kho, không đủ số lượng ${quantity}.`);
        return;
      }
    }

    for (const ch of selectedCharms) {
      if (typeof ch.stock === 'number') {
        if (ch.stock <= 0) {
          setCharmError(`Mục "${ch.name}" hiện đã hết hàng. Vui lòng chọn mẫu khác.`);
          return;
        }
        if (ch.stock < quantity) {
          setCharmError(`Mục "${ch.name}" chỉ còn ${ch.stock} cái trong kho, không đủ số lượng ${quantity}.`);
          return;
        }
      }
    }

    for (const om of selectedOmamoris) {
      if (typeof om.stock === 'number') {
        if (om.stock <= 0) {
          setOmamoriError(`Mục "${om.name}" hiện đã hết hàng. Vui lòng chọn mẫu khác.`);
          return;
        }
        if (om.stock < quantity) {
          setOmamoriError(`Mục "${om.name}" chỉ còn ${om.stock} cái trong kho, không đủ số lượng ${quantity}.`);
          return;
        }
      }
    }

    if (selectedKhoen && typeof selectedKhoen.stock === 'number') {
      if (selectedKhoen.stock <= 0) {
        setKhoenError(`Mục "${selectedKhoen.name}" hiện đã hết hàng. Vui lòng chọn mẫu khác.`);
        return;
      }
      if (selectedKhoen.stock < quantity) {
        setKhoenError(`Mục "${selectedKhoen.name}" chỉ còn ${selectedKhoen.stock} cái trong kho, không đủ số lượng ${quantity}.`);
        return;
      }
    }

    onAddToCart(
      product,
      quantity,
      selectedColor,
      undefined,
      undefined,
      selectedCharmNames || undefined,
      selectedColorImage,
      selectedCharms[0]?.image || undefined,
      totalCharmPrice,
      selectedCharms,
      selectedOmamoris,
      totalOmamoriPrice,
      selectedKhoen?.name || undefined,
      selectedKhoen?.image || undefined,
      totalKhoenPrice
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
          <div className="bg-neutral-50 p-4 sm:p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-neutral-200">
            <div 
              onClick={() => setCompareModalOpen(true)}
              className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white shadow-sm mb-3 sm:mb-4 group cursor-zoom-in"
            >
              {/* Zoom & Compare Overlay Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCompareModalOpen(true);
                }}
                className="absolute top-2.5 right-2.5 z-20 px-2 sm:px-2.5 py-1 bg-black/60 hover:bg-black/85 backdrop-blur-md text-white text-[11px] font-semibold rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer border border-white/20 hover:scale-105"
                title="Bấm để phóng to và so sánh ảnh (hoặc phím mũi tên)"
              >
                <ZoomIn className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Phóng to</span>
              </button>

              {/* Main Image Carousel Track: Flex wrapper with overflow-hidden and animated horizontal transform */}
              <div
                className="flex w-full h-full transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${activeImageIdx * 100}%)` }}
              >
                {images.map((imgSrc, idx) => (
                  <div key={idx} className="w-full h-full flex-shrink-0 relative flex items-center justify-center">
                    <LoadingImage
                      src={imgSrc || product.image || '/assets/bracelet.jpg'}
                      alt={`${product.name} - Ảnh ${idx + 1}`}
                      loading={idx === 0 ? "eager" : "lazy"}
                      fetchPriority={idx === 0 ? "high" : "low"}
                      decoding="async"
                      containerClassName="w-full h-full"
                      className="w-full h-full object-cover select-none pointer-events-none"
                      style={{ imageRendering: '-webkit-optimize-contrast' }}
                      draggable={false}
                      spinnerSize="md"
                      spinnerColor="amber"
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

              {/* Promo Badge on top left of image */}
              {product.discountBadge ? (
                <div className="absolute top-2.5 left-2.5 bg-rose-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-md z-10 max-w-[85%] truncate">
                  {product.discountBadge}
                </div>
              ) : product.isEvent0209 ? (
                <div className="absolute top-2.5 left-2.5 bg-brand-red text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm z-10">
                  Bản giới hạn 02.09
                </div>
              ) : null}
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
                    <LoadingImage
                      src={img || '/assets/bracelet.jpg'}
                      alt="thumb"
                      containerClassName="w-full h-full"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      spinnerSize="xs"
                      spinnerColor="neutral"
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
                  ? '20/10 — Quà Tặng Nàng'
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

              {/* Title */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 tracking-tight">
                    {product.name}
                  </h2>
                  {product.soldCount !== undefined && product.soldCount > 0 && (
                    <span className="text-neutral-500 text-xs font-medium">
                      • Đã bán {product.soldCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-2xl font-bold text-neutral-950 font-mono">
                  {effectiveUnitPrice.toLocaleString('vi-VN')}đ
                </span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-sm text-neutral-400 line-through font-mono">
                    {(product.originalPrice + totalCharmPrice + totalOmamoriPrice).toLocaleString('vi-VN')}đ
                  </span>
                )}
                {(() => {
                  const hasOrig = product.originalPrice && product.originalPrice > product.price;
                  const pct = hasOrig 
                    ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100) 
                    : 0;
                  const badgeText = product.discountBadge || (pct > 0 ? `-${pct}%` : null);
                  if (!badgeText) return null;
                  return (
                    <span className="px-2 py-0.5 bg-rose-600 text-white text-xs font-black rounded-lg shadow-2xs flex items-center shrink-0">
                      {badgeText.includes('%') || badgeText.includes('-') ? badgeText : `-${badgeText}`}
                    </span>
                  );
                })()}
                {(totalCharmPrice > 0 || totalOmamoriPrice > 0) && (
                  <span className="bg-amber-100/80 text-amber-900 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                    +{(totalCharmPrice + totalOmamoriPrice).toLocaleString('vi-VN')}đ phụ kiện
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
                      title={product.charmTitle}
                      charms={product.charmOptions}
                      selectedCharms={selectedCharms}
                      onSelectCharms={handleSelectCharms}
                      isRequired={product.charmSelectionRequired}
                      maxAllowed={product.maxCharmsAllowed || 1}
                    />
                    {charmError && (
                      <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl animate-shake">
                        {charmError}
                      </p>
                    )}
                  </div>
                )}

              {/* Omamori Selection (if enabled) */}
              {product.enableOmamoriSelection && (
                <div className="space-y-1">
                  <ProductOmamoriSelector
                    title={product.omamoriTitle}
                    omamoris={
                      product.omamoriOptions && product.omamoriOptions.length > 0
                        ? product.omamoriOptions
                        : DEFAULT_OMAMORI_PRESETS
                    }
                    selectedOmamoris={selectedOmamoris}
                    onSelectOmamoris={handleSelectOmamoris}
                    isRequired={product.omamoriSelectionRequired}
                    maxAllowed={product.maxOmamoriAllowed || 1}
                  />
                  {omamoriError && (
                    <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl animate-shake">
                      {omamoriError}
                    </p>
                  )}
                </div>
              )}

              {/* Khoen Selection (if enabled) */}
              {product.enableKhoenSelection && (
                <div className="space-y-1">
                  <ProductKhoenSelector
                    title={product.khoenTitle}
                    khoenOptions={
                      product.khoenOptions && product.khoenOptions.length > 0
                        ? product.khoenOptions
                        : DEFAULT_KHOEN_PRESETS
                    }
                    selectedKhoen={selectedKhoen}
                    onSelectKhoen={(khoen) => {
                      setKhoenError(null);
                      setSelectedKhoen(khoen);
                    }}
                    isRequired={product.khoenSelectionRequired}
                  />
                  {khoenError && (
                    <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl animate-shake">
                      {khoenError}
                    </p>
                  )}
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
                <div className="flex items-center gap-3 pt-1 flex-wrap">
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
                  <span className="text-[11px] text-neutral-500">
                    {availableStock < 5 ? `(chỉ còn ${availableStock})` : `(còn ${availableStock})`}
                  </span>
                  {(totalCharmPrice > 0 || totalOmamoriPrice > 0) && (
                    <span className="text-xs text-amber-800 font-medium">
                      +{((totalCharmPrice + totalOmamoriPrice) * quantity).toLocaleString('vi-VN')}đ (phụ kiện)
                    </span>
                  )}
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
                      Thêm vào giỏ ({quantity}) - {(effectiveUnitPrice * quantity).toLocaleString('vi-VN')}đ
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

      {/* Fullscreen Product Image Zoom & Compare Modal */}
      <ProductImageCompareModal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        items={compareItems}
        initialIndex={activeImageIdx}
        title={`Ảnh chi tiết: ${product?.name || 'Sản phẩm'}`}
        onSelectItem={(item) => {
          if (item.originalData) {
            handleSelectColor(item.originalData);
          } else {
            const idx = images.indexOf(item.image);
            if (idx !== -1) setActiveImageIdx(idx);
          }
        }}
        isItemSelected={(item) => {
          if (item.originalData) {
            return selectedColor === item.originalData.name;
          }
          return images[activeImageIdx] === item.image;
        }}
      />
    </div>
  );
};
