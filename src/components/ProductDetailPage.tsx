import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, CategoryItem, CartItem, ProductColorOption, ProductCharmOption, ProductOmamoriOption } from '../types';
import { DEFAULT_OMAMORI_PRESETS } from '../data/sampleOmamori';
import { ProductCharmSelector } from './ProductCharmSelector';
import { ProductOmamoriSelector } from './ProductOmamoriSelector';
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
    selectedCharmPrice?: number,
    selectedCharms?: ProductCharmOption[],
    selectedOmamoris?: ProductOmamoriOption[],
    selectedOmamoriPrice?: number
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
    selectedCharmPrice?: number,
    selectedCharms?: ProductCharmOption[],
    selectedOmamoris?: ProductOmamoriOption[],
    selectedOmamoriPrice?: number
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
  const [selectedCharms, setSelectedCharms] = useState<ProductCharmOption[]>([]);
  const [charmError, setCharmError] = useState<string | null>(null);
  const [selectedOmamoris, setSelectedOmamoris] = useState<ProductOmamoriOption[]>([]);
  const [omamoriError, setOmamoriError] = useState<string | null>(null);

  const totalCharmPrice = useMemo(() => {
    return selectedCharms.reduce((sum, c) => sum + (c.priceDelta || 0), 0);
  }, [selectedCharms]);

  const totalOmamoriPrice = useMemo(() => {
    return selectedOmamoris.reduce((sum, o) => sum + (o.priceDelta || 0), 0);
  }, [selectedOmamoris]);

  const effectiveUnitPrice = product.price + totalCharmPrice + totalOmamoriPrice;

  const selectedCharmNames = useMemo(() => {
    return selectedCharms.map((c) => c.name).join(', ');
  }, [selectedCharms]);

  const [isAdded, setIsAdded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [quickAddedId, setQuickAddedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'warranty'>('details');

  // Floating hovering purchase dock visibility observer
  const mainCtaRef = useRef<HTMLDivElement>(null);
  const [isMainCtaInView, setIsMainCtaInView] = useState<boolean>(true);
  const [stockNotice, setStockNotice] = useState<string | null>(null);
  const stockNoticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerStockNotice = (customMsg?: string) => {
    if (stockNoticeTimerRef.current) clearTimeout(stockNoticeTimerRef.current);
    const msg = customMsg || (
      isOutOfStock 
        ? 'Sản phẩm này tạm thời hết hàng.'
        : isCartFullForProduct 
        ? `Bạn đã thêm đủ toàn bộ số lượng trong kho (${availableStock} chiếc) vào giỏ hàng.` 
        : `Kho chỉ còn ${availableStock} chiếc có sẵn (bạn đang chọn tối đa ${remainingAddableStock} chiếc).`
    );
    setStockNotice(msg);
    stockNoticeTimerRef.current = setTimeout(() => {
      setStockNotice(null);
    }, 3000);
  };

  useEffect(() => {
    const target = mainCtaRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMainCtaInView(entry.isIntersecting);
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -20px 0px'
      }
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [product?.id]);

  // Dynamic gallery images (including linked color image if present)
  const images = useMemo(() => {
    const rawList = product.images && product.images.length > 0 ? product.images : [product.image];
    const validBase = rawList.filter(
      (img) => typeof img === 'string' && img.trim().length > 0
    );
    const base = validBase.length > 0 ? validBase : ['/assets/bracelet.jpg'];
    if (
      selectedColorImage &&
      typeof selectedColorImage === 'string' &&
      selectedColorImage.trim().length > 0 &&
      !base.includes(selectedColorImage)
    ) {
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
    setSelectedCharms([]);
    setSelectedOmamoris([]);
    setCharmError(null);
    setOmamoriError(null);
    setIsAdded(false);
    setQuickAddedId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (product) {
      trackGA4ViewItem(product);
    }
  }, [product?.id]);

  const availableStock = typeof product.stock === 'number' 
    ? product.stock 
    : (product.inStock === false ? 0 : 99);
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

  // Charm selection (multi-selection)
  const handleSelectCharms = (charms: ProductCharmOption[]) => {
    setCharmError(null);
    setSelectedCharms(charms);
  };

  // Omamori selection (multi-selection)
  const handleSelectOmamoris = (omamoris: ProductOmamoriOption[]) => {
    setOmamoriError(null);
    setSelectedOmamoris(omamoris);
  };

  const handleAddToCartClick = () => {
    if (isOutOfStock || remainingAddableStock <= 0) return;

    if (product.enableCharmSelection && product.charmSelectionRequired && selectedCharms.length === 0) {
      setCharmError('Vui lòng chọn ít nhất 1 mẫu charm trước khi thêm vào giỏ hàng.');
      return;
    }

    if (product.enableOmamoriSelection && product.omamoriSelectionRequired && selectedOmamoris.length === 0) {
      setOmamoriError('Vui lòng chọn ít nhất 1 bùa Omamori trước khi thêm vào giỏ hàng.');
      return;
    }

    const addQty = Math.min(quantity, remainingAddableStock);

    for (const ch of selectedCharms) {
      if (typeof ch.stock === 'number') {
        if (ch.stock <= 0) {
          setCharmError(`Mẫu charm "${ch.name}" hiện đã hết hàng. Vui lòng chọn mẫu khác.`);
          return;
        }
        if (ch.stock < addQty) {
          setCharmError(`Mẫu charm "${ch.name}" chỉ còn ${ch.stock} cái trong kho, không đủ số lượng ${addQty}.`);
          return;
        }
      }
    }

    for (const om of selectedOmamoris) {
      if (typeof om.stock === 'number') {
        if (om.stock <= 0) {
          setOmamoriError(`Bùa "${om.name}" hiện đã hết hàng. Vui lòng chọn mẫu khác.`);
          return;
        }
        if (om.stock < addQty) {
          setOmamoriError(`Bùa "${om.name}" chỉ còn ${om.stock} cái trong kho, không đủ số lượng ${addQty}.`);
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
      selectedCharmNames || undefined,
      selectedColorImage,
      selectedCharms[0]?.image || undefined,
      totalCharmPrice,
      selectedCharms,
      selectedOmamoris,
      totalOmamoriPrice
    );
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 2000);
  };

  const handleBuyNowClick = () => {
    if (isOutOfStock || remainingAddableStock <= 0) return;

    if (product.enableCharmSelection && product.charmSelectionRequired && selectedCharms.length === 0) {
      setCharmError('Vui lòng chọn ít nhất 1 mẫu charm trước khi mua hàng.');
      return;
    }

    if (product.enableOmamoriSelection && product.omamoriSelectionRequired && selectedOmamoris.length === 0) {
      setOmamoriError('Vui lòng chọn ít nhất 1 bùa Omamori trước khi mua hàng.');
      return;
    }

    const addQty = Math.min(quantity, remainingAddableStock);

    for (const ch of selectedCharms) {
      if (typeof ch.stock === 'number') {
        if (ch.stock <= 0) {
          setCharmError(`Mẫu charm "${ch.name}" hiện đã hết hàng. Vui lòng chọn mẫu khác.`);
          return;
        }
        if (ch.stock < addQty) {
          setCharmError(`Mẫu charm "${ch.name}" chỉ còn ${ch.stock} cái trong kho, không đủ số lượng ${addQty}.`);
          return;
        }
      }
    }

    for (const om of selectedOmamoris) {
      if (typeof om.stock === 'number') {
        if (om.stock <= 0) {
          setOmamoriError(`Bùa "${om.name}" hiện đã hết hàng. Vui lòng chọn mẫu khác.`);
          return;
        }
        if (om.stock < addQty) {
          setOmamoriError(`Bùa "${om.name}" chỉ còn ${om.stock} cái trong kho, không đủ số lượng ${addQty}.`);
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
      selectedCharmNames || undefined,
      selectedColorImage,
      selectedCharms[0]?.image || undefined,
      totalCharmPrice,
      selectedCharms,
      selectedOmamoris,
      totalOmamoriPrice
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

  // Set of category IDs that are marked as hidden
  const hiddenCategoryIds = useMemo(() => {
    return new Set(categories.filter((c) => c.isHidden).map((c) => c.id));
  }, [categories]);

  // Robust check: Is this product hidden (explicitly or via its category)
  const isProductVisible = useCallback(
    (p: Product) => {
      if (Boolean(p.isHidden)) return false;
      if (p.category && hiddenCategoryIds.has(p.category)) return false;
      return true;
    },
    [hiddenCategoryIds]
  );

  // Find related products in the same category (strictly visible products only)
  const relatedProducts = useMemo(() => {
    return allProducts
      .filter((p) => isProductVisible(p) && p.id !== product.id && p.category === product.category)
      .slice(0, 4);
  }, [allProducts, product, isProductVisible]);

  // Curated 'Có thể bạn sẽ thích' (strictly visible products only)
  const recommendedProducts = useMemo(() => {
    // Exclude current product and hidden products
    const otherProducts = allProducts.filter(
      (p) => isProductVisible(p) && p.id !== product.id && p.inStock !== false
    );
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
  }, [allProducts, product, isProductVisible]);

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
                      src={imgSrc || product.image || '/assets/bracelet.jpg'}
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
                        src={img || '/assets/bracelet.jpg'}
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

                  {isOutOfStock || availableStock <= 0 ? (
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md">
                      Hết hàng
                    </span>
                  ) : availableStock < 5 ? (
                    <span className="text-xs font-extrabold text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                      <span>⚠️</span>
                      <span>Sắp hết hàng (Chỉ còn {availableStock} sản phẩm)</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                      Còn {availableStock} sản phẩm
                    </span>
                  )}
                </div>
              </div>

              {/* Price Row */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-black text-neutral-950 font-mono">
                  {effectiveUnitPrice.toLocaleString('vi-VN')}đ
                </span>
                {product.originalPrice && (
                  <span className="text-base text-neutral-400 line-through font-mono">
                    {(product.originalPrice + totalCharmPrice + totalOmamoriPrice).toLocaleString('vi-VN')}đ
                  </span>
                )}
                {product.discountBadge && (
                  <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded">
                    {product.discountBadge}
                  </span>
                )}
                {(totalCharmPrice > 0 || totalOmamoriPrice > 0) && (
                  <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                    +{(totalCharmPrice + totalOmamoriPrice).toLocaleString('vi-VN')}đ phụ kiện
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
                      selectedCharms={selectedCharms}
                      onSelectCharms={handleSelectCharms}
                      isRequired={product.charmSelectionRequired}
                      maxAllowed={product.maxCharmsAllowed || 1}
                    />
                    {charmError && (
                      <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl animate-shake">
                        ⚠️ {charmError}
                      </p>
                    )}
                  </div>
                )}

              {/* Omamori Selection (if enabled) */}
              {product.enableOmamoriSelection && (
                <div className="space-y-1">
                  <ProductOmamoriSelector
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
                      ⚠️ {omamoriError}
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
              <div ref={mainCtaRef} id="product-detail-main-cta" className="space-y-3 pt-2">
                {/* Large Prominent Quantity & Subtotal Card */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-neutral-50 rounded-2xl border border-neutral-200/90 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-neutral-600">Số lượng:</span>
                    <div className="flex items-center border border-neutral-200 rounded-xl bg-white p-0.5 shadow-2xs">
                      <button
                        type="button"
                        disabled={quantity <= 1 || isOutOfStock || isCartFullForProduct}
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="w-8 h-8 rounded-lg bg-neutral-50 hover:bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer text-sm"
                        aria-label="Giảm số lượng"
                      >
                        -
                      </button>
                      <span className="w-10 text-center font-black text-sm text-neutral-950 font-mono">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (quantity >= remainingAddableStock || isOutOfStock || isCartFullForProduct) {
                            triggerStockNotice();
                          } else {
                            setQuantity((q) => Math.min(remainingAddableStock, q + 1));
                          }
                        }}
                        className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center transition-colors cursor-pointer text-sm ${
                          quantity >= remainingAddableStock || isOutOfStock || isCartFullForProduct
                            ? 'bg-neutral-200 text-neutral-400 hover:bg-neutral-300'
                            : 'bg-neutral-50 hover:bg-neutral-200 text-neutral-800'
                        }`}
                        aria-label="Tăng số lượng"
                        title={
                          isOutOfStock
                            ? 'Hết hàng'
                            : isCartFullForProduct
                            ? `Đã đạt giới hạn tồn kho (${availableStock} chiếc)`
                            : quantity >= remainingAddableStock
                            ? `Kho chỉ còn ${availableStock} chiếc`
                            : 'Tăng số lượng'
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                      Tạm tính ({quantity} chiếc)
                    </div>
                    <div className="flex items-baseline justify-end gap-1">
                      <span className="text-xl sm:text-2xl font-black text-neutral-950 font-mono tracking-tight">
                        {(effectiveUnitPrice * quantity).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    {(totalCharmPrice > 0 || totalOmamoriPrice > 0) && (
                      <div className="text-[11px] font-medium text-amber-700">
                        (gồm phụ kiện +{((totalCharmPrice + totalOmamoriPrice) * quantity).toLocaleString('vi-VN')}đ)
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary CTA Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
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
                      src={rec.image || '/assets/bracelet.jpg'}
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
                      src={rel.image || '/assets/bracelet.jpg'}
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

      {/* UNIVERSAL FLOATING PERSISTENT PURCHASE DOCK (Desktop & Mobile) */}
      <AnimatePresence>
        {!isMainCtaInView && (
          <motion.div
            key="floating-product-dock"
            id="floating-product-dock"
            initial={{ y: 80, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 sm:bottom-5 inset-x-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 w-full sm:w-[94%] sm:max-w-4xl bg-white/95 backdrop-blur-md border-t sm:border border-neutral-200/90 sm:rounded-2xl p-3 sm:px-5 sm:py-3 z-40 shadow-xl sm:shadow-2xl shadow-neutral-950/10"
          >
            {/* Real-time stock notice tooltip inside floating bar */}
            <AnimatePresence>
              {stockNotice && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute -top-12 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-lg border border-neutral-700 whitespace-nowrap flex items-center gap-1.5 z-50 pointer-events-none"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>{stockNotice}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between gap-3 sm:gap-4 max-w-7xl mx-auto">
              
              {/* Product Info & Thumbnail */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 flex-shrink-0">
                  <img
                    src={images[0] || '/assets/bracelet.jpg'}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-neutral-900 truncate">
                    {product.name}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-500 truncate">
                    {selectedColor && (
                      <span>Màu: <strong className="text-neutral-800">{selectedColor}</strong></span>
                    )}
                    {selectedCharms.length > 0 && (
                      <span className="text-amber-700 font-medium truncate hidden md:inline">
                        • Charm: {selectedCharms.map((c) => c.name).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Price / Subtotal */}
              <div className="text-right flex-shrink-0 px-1 sm:px-2">
                <div className="text-[10px] sm:text-[11px] text-neutral-500 font-medium">
                  Tạm tính ({quantity}):
                </div>
                <div className="font-mono font-black text-sm sm:text-base text-neutral-950">
                  {(effectiveUnitPrice * quantity).toLocaleString('vi-VN')}đ
                </div>
              </div>

              {/* Quantity selector on desktop */}
              <div className="hidden md:flex items-center border border-neutral-200 rounded-xl bg-neutral-50 p-0.5 flex-shrink-0">
                <button
                  type="button"
                  disabled={quantity <= 1 || isOutOfStock || isCartFullForProduct}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-lg bg-white hover:bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer text-xs"
                  aria-label="Giảm số lượng"
                >
                  -
                </button>
                <span className="w-8 text-center font-bold text-xs text-neutral-900 font-mono">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (quantity >= remainingAddableStock || isOutOfStock || isCartFullForProduct) {
                      triggerStockNotice();
                    } else {
                      setQuantity((q) => Math.min(remainingAddableStock, q + 1));
                    }
                  }}
                  onMouseEnter={() => {
                    if (quantity >= remainingAddableStock || isOutOfStock || isCartFullForProduct) {
                      triggerStockNotice();
                    }
                  }}
                  title={
                    isOutOfStock
                      ? 'Hết hàng'
                      : isCartFullForProduct
                      ? `Đã đạt giới hạn tồn kho (${availableStock} chiếc)`
                      : quantity >= remainingAddableStock
                      ? `Kho chỉ còn ${availableStock} chiếc`
                      : 'Tăng số lượng'
                  }
                  className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center transition-colors text-xs cursor-pointer ${
                    quantity >= remainingAddableStock || isOutOfStock || isCartFullForProduct
                      ? 'bg-neutral-200 text-neutral-400 hover:bg-neutral-300'
                      : 'bg-white hover:bg-neutral-200 text-neutral-800'
                  }`}
                  aria-label="Tăng số lượng"
                >
                  +
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  id="floating-add-to-cart-btn"
                  onClick={() => {
                    if (isOutOfStock || isCartFullForProduct) {
                      triggerStockNotice();
                    } else {
                      handleAddToCartClick();
                    }
                  }}
                  onMouseEnter={() => {
                    if (isOutOfStock || isCartFullForProduct) {
                      triggerStockNotice();
                    }
                  }}
                  className={`py-2.5 px-3.5 sm:px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isOutOfStock || isCartFullForProduct
                      ? 'bg-neutral-200 text-neutral-400'
                      : isAdded
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-950 hover:bg-neutral-800 text-white shadow-sm'
                  }`}
                  title={
                    isOutOfStock
                      ? 'Hết hàng'
                      : isCartFullForProduct
                      ? `Đã có đủ ${availableStock} chiếc trong giỏ`
                      : 'Thêm vào giỏ hàng'
                  }
                >
                  {isAdded ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span className="hidden sm:inline">Đã thêm ✓</span>
                    </>
                  ) : isCartFullForProduct ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      <span className="hidden sm:inline">Đã đạt tối đa</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span className="hidden sm:inline">Thêm Vào Giỏ</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="floating-buy-now-btn"
                  onClick={() => {
                    if (isOutOfStock || isCartFullForProduct) {
                      triggerStockNotice();
                    } else {
                      handleBuyNowClick();
                    }
                  }}
                  onMouseEnter={() => {
                    if (isOutOfStock || isCartFullForProduct) {
                      triggerStockNotice();
                    }
                  }}
                  className={`py-2.5 px-4 sm:px-5 rounded-xl font-black text-xs transition-all cursor-pointer shadow-sm ${
                    isOutOfStock || isCartFullForProduct
                      ? 'bg-neutral-200 text-neutral-400'
                      : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 active:scale-95'
                  }`}
                  title={
                    isOutOfStock || isCartFullForProduct
                      ? 'Không thể đặt thêm do đã đạt giới hạn tồn kho'
                      : 'Mua ngay'
                  }
                >
                  <span>{isCartFullForProduct ? 'Hết Kho' : 'Mua Ngay'}</span>
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
