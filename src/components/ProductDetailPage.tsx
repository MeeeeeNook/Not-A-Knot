import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, CategoryItem, CartItem, ProductColorOption, ProductCharmOption } from '../types';
import { ProductCharmSelector } from './ProductCharmSelector';
import { ProductColorSelector } from './ProductColorSelector';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Check,
  Star,
  Share2,
  ArrowLeft,
  Plus,
  AlertCircle,
  ShieldCheck,
  Droplets,
  PackageCheck,
  Truck,
  RotateCcw,
  Sparkles,
  Award
} from 'lucide-react';
import { trackGA4ViewItem } from '../utils/analytics';
import { useProductSEO } from '../utils/seo';

interface ProductDetailPageProps {
  product: Product;
  allProducts: Product[];
  categories?: CategoryItem[];
  cartItems?: CartItem[];
  backLabel?: string;
  onBack: () => void;
  onSelectProduct: (product: Product) => void;
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
  onBuyNow: (
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

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  allProducts,
  categories = [],
  cartItems = [],
  backLabel,
  onBack,
  onSelectProduct,
  onAddToCart,
  onBuyNow,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);

  // Initial color setup
  const initialColor = useMemo(() => {
    if (product.colorOptions && product.colorOptions.length > 0) {
      return product.colorOptions[0].name;
    }
    return product.availableColors?.[0];
  }, [product]);

  const initialColorImage = useMemo(() => {
    if (product.colorOptions && product.colorOptions.length > 0) {
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

  const [isAdded, setIsAdded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [quickAddedId, setQuickAddedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'warranty'>('details');

  // Dynamic gallery images (including linked color image if present)
  const images = useMemo(() => {
    const base = product.images && product.images.length > 0 ? [...product.images] : [product.image];
    if (selectedColorImage && !base.includes(selectedColorImage)) {
      return [selectedColorImage, ...base];
    }
    return base;
  }, [product, selectedColorImage]);

  // Reset state when product changes
  useEffect(() => {
    const initCol = product.colorOptions?.[0]?.name || product.availableColors?.[0];
    const initImg = product.colorOptions?.[0]?.image;

    setActiveImageIdx(0);
    setQuantity(1);
    setSelectedColor(initCol);
    setSelectedColorImage(initImg);
    setSelectedCharm(undefined);
    setSelectedCharmImage(undefined);
    setSelectedCharmPrice(undefined);
    setCharmError(null);
    setIsAdded(false);
    setQuickAddedId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (product) {
      trackGA4ViewItem(product);
    }
  }, [product?.id]);

  const availableStock = typeof product.stock === 'number' && product.stock > 1 ? product.stock : 99;
  const inCartQty = useMemo(() => {
    if (!cartItems || cartItems.length === 0) return 0;
    return cartItems
      .filter((item) => item.product.id === product.id)
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems, product.id]);

  const remainingAddableStock = Math.max(0, availableStock - inCartQty);
  const isOutOfStock = product.inStock === false;
  const isCartFullForProduct = !isOutOfStock && remainingAddableStock <= 0 && availableStock < 90;

  // Ensure selected quantity never exceeds remaining addable stock
  useEffect(() => {
    if (remainingAddableStock > 0 && quantity > remainingAddableStock) {
      setQuantity(remainingAddableStock);
    } else if (remainingAddableStock === 0) {
      setQuantity(1);
    }
  }, [remainingAddableStock, quantity]);

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

  const prevImage = useCallback(() => {
    paginate(-1);
  }, [paginate]);

  const nextImage = useCallback(() => {
    paginate(1);
  }, [paginate]);

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

  // Color selection with automatic image link preview
  const handleSelectColor = (colorOpt: ProductColorOption) => {
    setSelectedColor(colorOpt.name);
    if (colorOpt.image) {
      setSelectedColorImage(colorOpt.image);
      const imgIdx = images.indexOf(colorOpt.image);
      if (imgIdx > -1) {
        setActiveImageIdx(imgIdx);
      } else {
        // Will be prepended by useMemo
        setActiveImageIdx(0);
      }
    }
  };

  // Charm selection
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

  const handleAddToCartClick = () => {
    if (isOutOfStock || remainingAddableStock <= 0) return;

    if (product.enableCharmSelection && product.charmSelectionRequired && !selectedCharm) {
      setCharmError('Vui lòng chọn 1 mẫu charm trước khi thêm vào giỏ hàng.');
      return;
    }

    const addQty = Math.min(quantity, remainingAddableStock);

    if (selectedCharm && product.charmOptions) {
      const chosenCharm = product.charmOptions.find(
        (c) => c.name.trim().toLowerCase() === selectedCharm.trim().toLowerCase()
      );
      if (chosenCharm && typeof chosenCharm.stock === 'number') {
        if (chosenCharm.stock <= 0) {
          setCharmError(`Mẫu charm "${chosenCharm.name}" hiện đã hết hàng. Vui lòng chọn mẫu khác.`);
          return;
        }
        if (chosenCharm.stock < addQty) {
          setCharmError(`Mẫu charm "${chosenCharm.name}" chỉ còn ${chosenCharm.stock} cái trong kho, không đủ số lượng ${addQty}.`);
          return;
        }
      }
    }

    onAddToCart(
      product,
      addQty,
      selectedColor,
      undefined,
      undefined,
      selectedCharm,
      selectedColorImage,
      selectedCharmImage,
      selectedCharmPrice
    );
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 2000);
  };

  const handleBuyNowClick = () => {
    if (isOutOfStock || remainingAddableStock <= 0) return;

    if (product.enableCharmSelection && product.charmSelectionRequired && !selectedCharm) {
      setCharmError('Vui lòng chọn 1 mẫu charm trước khi mua hàng.');
      return;
    }

    const addQty = Math.min(quantity, remainingAddableStock);

    if (selectedCharm && product.charmOptions) {
      const chosenCharm = product.charmOptions.find(
        (c) => c.name.trim().toLowerCase() === selectedCharm.trim().toLowerCase()
      );
      if (chosenCharm && typeof chosenCharm.stock === 'number') {
        if (chosenCharm.stock <= 0) {
          setCharmError(`Mẫu charm "${chosenCharm.name}" hiện đã hết hàng. Vui lòng chọn mẫu khác.`);
          return;
        }
        if (chosenCharm.stock < addQty) {
          setCharmError(`Mẫu charm "${chosenCharm.name}" chỉ còn ${chosenCharm.stock} cái trong kho, không đủ số lượng ${addQty}.`);
          return;
        }
      }
    }

    onBuyNow(
      product,
      addQty,
      selectedColor,
      undefined,
      undefined,
      selectedCharm,
      selectedColorImage,
      selectedCharmImage,
      selectedCharmPrice
    );
  };

  const handleShare = () => {
    const url = window.location.origin + window.location.pathname + `#product/${product.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleQuickAddRecommended = (e: React.MouseEvent, prod: Product) => {
    e.stopPropagation();
    const defaultColor = prod.colorOptions?.[0]?.name || prod.availableColors?.[0];
    const defaultSize = prod.availableSizes?.[0];
    onAddToCart(prod, 1, defaultColor, defaultSize);
    
    setQuickAddedId(prod.id);
    setTimeout(() => {
      setQuickAddedId((curr) => (curr === prod.id ? null : curr));
    }, 1800);
  };

  // Find related products in the same category (excluding hidden)
  const relatedProducts = useMemo(() => {
    return allProducts
      .filter((p) => !p.isHidden && p.id !== product.id && p.category === product.category)
      .slice(0, 4);
  }, [allProducts, product]);

  // Curated 'Có thể bạn sẽ thích' (cross-collection recommendations & hot picks, excluding hidden)
  const recommendedProducts = useMemo(() => {
    // Exclude current product and hidden products
    const otherProducts = allProducts.filter((p) => !p.isHidden && p.id !== product.id && p.inStock !== false);
    if (otherProducts.length === 0) return [];

    // Prioritize products with high rating, bestsellers, and complementary categories
    const sorted = [...otherProducts].sort((a, b) => {
      const isDiffCatA = a.category !== product.category ? 1.5 : 0.5;
      const isDiffCatB = b.category !== product.category ? 1.5 : 0.5;
      const scoreA = (a.isBestSeller ? 2 : 0) + (a.discountBadge ? 1 : 0) + (a.rating || 4.8) + isDiffCatA;
      const scoreB = (b.isBestSeller ? 2 : 0) + (b.discountBadge ? 1 : 0) + (b.rating || 4.8) + isDiffCatB;
      return scoreB - scoreA;
    });

    return sorted.slice(0, 4);
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

  // Automatically update page title, meta description, keywords, Open Graph, Twitter cards, and JSON-LD schema for this product
  useProductSEO(product, categoryName);

  if (product.isHidden) {
    return (
      <div id="product-hidden-page" className="min-h-[70vh] bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-900 border border-amber-200 flex items-center justify-center mx-auto text-3xl shadow-xs">
            🙈
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sản Phẩm Đang Tạm Ẩn</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Mẫu "{product.name}" hiện đang được tạm ẩn khỏi gian hàng trực tuyến. Quý khách vui lòng tham khảo các mẫu sản phẩm khác đang sẵn hàng!
          </p>
          <div className="pt-2">
            <button
              onClick={onBack}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay Lại Cửa Hàng</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-12">
        {/* Product Hero: Left Gallery, Right Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* LEFT: Compact Interactive High-Res Gallery */}
          <div className="lg:col-span-5 xl:col-span-5 max-w-md mx-auto w-full lg:max-w-none space-y-3.5">
            <div className="relative aspect-square max-h-[440px] rounded-3xl overflow-hidden bg-white border border-neutral-200 shadow-sm group">
              {/* Main Image Carousel Track: Flex wrapper with overflow-hidden and animated horizontal transform */}
              <div
                className="flex w-full h-full transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${activeImageIdx * 100}%)` }}
              >
                {images.map((imgSrc, idx) => (
                  <div key={idx} className="w-full h-full flex-shrink-0 relative">
                    <img
                      src={imgSrc || product.image}
                      alt={`${product.name} - Ảnh ${idx + 1}`}
                      className="w-full h-full object-cover object-center select-none pointer-events-none"
                      style={{ imageRendering: '-webkit-optimize-contrast' }}
                      draggable={false}
                    />
                  </div>
                ))}
              </div>

              {/* Navigation Arrows for switching photos - Minimalist transparent glass, visible only on left/right edge hover */}
              {images.length > 1 && (
                <>
                  {/* Left edge hover zone */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-16 sm:w-20 z-20 flex items-center justify-start pl-2.5 group/edge-left cursor-pointer select-none"
                    onClick={prevImage}
                    title="Ảnh trước (Phím ←)"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        prevImage();
                      }}
                      className="w-8 h-8 rounded-full bg-black/25 hover:bg-black/50 backdrop-blur-md border border-white/20 text-white flex items-center justify-center opacity-0 group-hover/edge-left:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-xs"
                      aria-label="Ảnh trước (hoặc phím mũi tên trái)"
                    >
                      <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>

                  {/* Right edge hover zone */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-16 sm:w-20 z-20 flex items-center justify-end pr-2.5 group/edge-right cursor-pointer select-none"
                    onClick={nextImage}
                    title="Ảnh tiếp theo (Phím →)"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        nextImage();
                      }}
                      className="w-8 h-8 rounded-full bg-black/25 hover:bg-black/50 backdrop-blur-md border border-white/20 text-white flex items-center justify-center opacity-0 group-hover/edge-right:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-xs"
                      aria-label="Ảnh tiếp theo (hoặc phím mũi tên phải)"
                    >
                      <ChevronRight className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>
                </>
              )}

              {/* Photo Index Counter */}
              {images.length > 1 && (
                <div className="absolute bottom-3 right-3 px-2.5 py-0.5 bg-black/65 backdrop-blur-md text-white text-[11px] font-bold rounded-full pointer-events-none z-10">
                  {activeImageIdx + 1} / {images.length}
                </div>
              )}
            </div>

            {/* Thumbnail Strip (Click to choose photo) */}
            {images.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
                {images.map((img, idx) => {
                  const isActive = idx === activeImageIdx;
                  return (
                    <button
                      key={idx}
                      onClick={() => selectImage(idx)}
                      className={`relative w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 bg-white cursor-pointer ${
                        isActive
                          ? 'border-neutral-950 ring-2 ring-neutral-950/20 scale-102 shadow-xs'
                          : 'border-neutral-200 opacity-60 hover:opacity-100 hover:border-neutral-400'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${product.name} thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      {idx === 0 && (
                        <span className="absolute bottom-0 inset-x-0 bg-neutral-900/80 text-[8px] text-white text-center font-bold py-0.5">
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
          <div className="lg:col-span-7 xl:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-sm space-y-6">
              
              {/* Category & Title */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">
                  {categoryName}
                </span>

                <h1 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight leading-tight">
                  {product.name}
                </h1>

                {/* Stock & sales status */}
                <div className="flex items-center gap-3 pt-1 flex-wrap">
                  {product.soldCount !== undefined && product.soldCount > 0 && (
                    <>
                      <span className="text-xs font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md">
                        Đã bán {product.soldCount}
                      </span>
                      <span className="text-neutral-300">•</span>
                    </>
                  )}

                  {isOutOfStock ? (
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md">
                      Hết hàng
                    </span>
                  ) : availableStock === 1 ? (
                    <span className="text-xs font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md animate-pulse">
                      ⚡ Chỉ còn duy nhất 1 sản phẩm!
                    </span>
                  ) : availableStock <= 3 ? (
                    <span className="text-xs font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                      ⚡ Chỉ còn {availableStock} sản phẩm trong kho
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                      Còn {availableStock} sản phẩm trong kho
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

              {/* In-cart stock status alert */}
              {inCartQty > 0 && availableStock < 90 && (
                <div
                  className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                    isCartFullForProduct
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <p className="font-bold">
                      {isCartFullForProduct
                        ? `Bạn đã có đủ toàn bộ số lượng tồn kho (${inCartQty}/${availableStock} chiếc) trong giỏ hàng.`
                        : `Bạn đã thêm ${inCartQty} chiếc vào giỏ hàng.`}
                    </p>
                    <p className="text-[11px] opacity-90">
                      {isCartFullForProduct
                        ? 'Không thể thêm số lượng nhiều hơn số lượng hiện có.'
                        : `Còn có thể thêm tối đa ${remainingAddableStock} chiếc nữa.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Quantity Selector & Action Buttons */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-neutral-200 rounded-2xl bg-neutral-50 p-1">
                    <button
                      type="button"
                      disabled={quantity <= 1 || isOutOfStock || isCartFullForProduct}
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
                      disabled={quantity >= remainingAddableStock || isOutOfStock || isCartFullForProduct}
                      onClick={() => setQuantity((q) => Math.min(remainingAddableStock, q + 1))}
                      className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-xs text-neutral-500">
                    Tạm tính:{' '}
                    <strong className="text-neutral-950 font-mono text-sm">
                      {((product.price + (selectedCharmPrice || 0)) * quantity).toLocaleString('vi-VN')}đ
                    </strong>
                    {selectedCharmPrice && selectedCharmPrice > 0 ? (
                      <span className="text-[10px] text-amber-700 ml-1">
                        (kèm charm +{(selectedCharmPrice * quantity).toLocaleString('vi-VN')}đ)
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Primary CTA Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isOutOfStock || isCartFullForProduct}
                    onClick={handleAddToCartClick}
                    className={`py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isOutOfStock || isCartFullForProduct
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
                    ) : isCartFullForProduct ? (
                      <span>Đã đạt giới hạn</span>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>Thêm Vào Giỏ</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isOutOfStock || isCartFullForProduct}
                    onClick={handleBuyNowClick}
                    className={`py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isOutOfStock || isCartFullForProduct
                        ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                        : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-md active:scale-98'
                    }`}
                  >
                    <span>{isCartFullForProduct ? 'Kho đã hết' : 'Mua Ngay'}</span>
                  </button>
                </div>

                {/* 4 Trust & Craft Commitments */}
                <div className="pt-4 border-t border-neutral-100 grid grid-cols-2 gap-2 text-[11px] text-neutral-600">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100/80">
                    <ShieldCheck className="w-4 h-4 text-amber-700 flex-shrink-0" />
                    <span className="font-semibold text-neutral-800">Dây Paracord 550 chính hãng</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100/80">
                    <Droplets className="w-4 h-4 text-sky-600 flex-shrink-0" />
                    <span className="font-semibold text-neutral-800">Chống nước, không phai màu</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100/80">
                    <PackageCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="font-semibold text-neutral-800">Đồng kiểm tra trước khi trả tiền</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100/80">
                    <RotateCcw className="w-4 h-4 text-amber-700 flex-shrink-0" />
                    <span className="font-semibold text-neutral-800">Đổi size miễn phí trong 7 ngày</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* INTERACTIVE SPECIFICATION & SERVICE TABS */}
        <section id="product-tabs-section" className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-sm space-y-6">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'details'
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Chi tiết chế tác & Chất liệu</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('warranty')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'warranty'
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Chính sách đổi trả & Bảo hành</span>
            </button>
          </div>

          {/* Tab 1: Chi tiết chế tác */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {product.details && product.details.length > 0 ? (
                  product.details.map((detail, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-start gap-3 text-xs sm:text-sm text-neutral-700"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-600 mt-1.5 flex-shrink-0" />
                      <span className="leading-relaxed">{detail}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 text-xs sm:text-sm text-neutral-600">
                    Sản phẩm được đan tay 100% thủ công từ dây Paracord 550 nhập khẩu cao cấp, chốt khóa hợp kim chống gỉ sáng bóng.
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border border-amber-200/60 text-xs text-amber-950 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Quy chuẩn chất lượng xưởng NOT A KNOT</p>
                  <p className="text-neutral-700 leading-relaxed">
                    Mỗi chiếc vòng được nghệ nhân bện tay từng gút thắt tỉ mỉ, xử lý giấu mối nhiệt thẩm mỹ cao, đảm bảo không cộm rát khi đeo thường nhật hay hoạt động thể thao ngoài trời.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Chính sách đổi trả & bảo hành */}
          {activeTab === 'warranty' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-950 text-sm">
                    <RotateCcw className="w-4 h-4 text-amber-700" />
                    <span>Đổi size trong 7 ngày</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Nếu nhận hàng đeo không vừa, xưởng sẵn sàng hỗ trợ đan lại size mới hoặc tinh chỉnh theo đúng số đo của bạn hoàn toàn miễn phí.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-950 text-sm">
                    <PackageCheck className="w-4 h-4 text-emerald-600" />
                    <span>Đồng kiểm khi nhận hàng</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Quý khách được quyền mở hộp kiểm tra màu sắc, mẫu charm, thử vòng trước khi thanh toán cho nhân viên giao hàng.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-950 text-sm">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    <span>Bảo hành độ bền sợi</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Bảo hành trọn đời lỗi bung gút đan tự nhiên. Dây Paracord 550 chính hãng có khả năng chịu lực 250kg và không bị mục sợi khi ngâm nước.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-950 text-sm">
                    <Truck className="w-4 h-4 text-amber-700" />
                    <span>Đóng gói quà tặng Vintage</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Mỗi đơn hàng được đóng gói trong hộp kraft vintage phong cách xưởng, có túi chống ẩm và thiệp thông điệp thích hợp làm quà tặng.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* PHẦN 'CÓ THỂ BẠN SẼ THÍCH' */}
        {recommendedProducts.length > 0 && (
          <section className="space-y-6 pt-6">
            <h2 className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight">
              Có thể bạn sẽ thích
            </h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {recommendedProducts.map((rec) => (
                <motion.div
                  key={rec.id}
                  whileHover={{ y: -4 }}
                  onClick={() => onSelectProduct(rec)}
                  className="bg-white rounded-3xl border border-neutral-200 hover:border-neutral-900 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer shadow-2xs hover:shadow-md"
                >
                  {/* Product Image & Badges */}
                  <div className="relative aspect-square overflow-hidden bg-neutral-100">
                    <img
                      src={rec.image}
                      alt={rec.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
                      {rec.discountBadge ? (
                        <span className="px-2 py-0.5 bg-amber-400 text-neutral-950 text-[10px] font-black rounded-lg shadow-2xs">
                          {rec.discountBadge}
                        </span>
                      ) : rec.isBestSeller ? (
                        <span className="px-2 py-0.5 bg-neutral-950 text-white text-[10px] font-black rounded-lg shadow-2xs">
                          HOT
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-neutral-950 group-hover:text-amber-700 transition-colors line-clamp-1">
                        {rec.name}
                      </h3>
                      <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                        {rec.description}
                      </p>

                      <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="font-mono text-sm sm:text-base font-black text-neutral-950">
                          {rec.price.toLocaleString('vi-VN')}đ
                        </span>
                        {rec.originalPrice && (
                          <span className="text-xs text-neutral-400 line-through font-mono">
                            {rec.originalPrice.toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Add Button */}
                    <button
                      type="button"
                      onClick={(e) => handleQuickAddRecommended(e, rec)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                        quickAddedId === rec.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-100 hover:bg-neutral-950 text-neutral-900 hover:text-white active:scale-95'
                      }`}
                      title="Thêm vào giỏ hàng"
                    >
                      {quickAddedId === rec.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã thêm vào giỏ ✓</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm vào giỏ</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Related Products in the same collection */}
        {relatedProducts.length > 0 && (
          <section className="space-y-6 pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {relatedProducts.map((rel) => (
                <motion.div
                  key={rel.id}
                  whileHover={{ y: -4 }}
                  onClick={() => onSelectProduct(rel)}
                  className="bg-white rounded-3xl border border-neutral-200 hover:border-neutral-900 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer shadow-2xs hover:shadow-md"
                >
                  <div className="relative aspect-square overflow-hidden bg-neutral-100">
                    <img
                      src={rel.image}
                      alt={rel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      decoding="async"
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

      {/* MOBILE STICKY BUY BAR (visible on mobile only) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-neutral-200/90 p-3 z-30 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block truncate">
              {product.name}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-black text-sm text-neutral-950">
                {((product.price + (selectedCharmPrice || 0)) * quantity).toLocaleString('vi-VN')}đ
              </span>
              {selectedCharm && (
                <span className="text-[10px] text-amber-700 font-medium truncate">
                  +{selectedCharm}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              disabled={isOutOfStock || isCartFullForProduct}
              onClick={handleAddToCartClick}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isAdded
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'border-neutral-900 bg-white text-neutral-950 hover:bg-neutral-100'
              }`}
              title="Thêm vào giỏ"
            >
              {isAdded ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
            </button>

            <button
              type="button"
              disabled={isOutOfStock || isCartFullForProduct}
              onClick={handleBuyNowClick}
              className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 font-black text-xs text-neutral-950 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Mua Ngay
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
