import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, CategoryItem, CartItem, ProductColorOption, ProductCharmOption, ProductOmamoriOption, ProductKhoenOption, CollectionInfo, ComboItemSelection } from '../types';
import { DEFAULT_OMAMORI_PRESETS } from '../data/sampleOmamori';
import { DEFAULT_KHOEN_PRESETS } from '../data/sampleKhoen';
import { ProductCharmSelector } from './ProductCharmSelector';
import { ProductOmamoriSelector } from './ProductOmamoriSelector';
import { ProductKhoenSelector } from './ProductKhoenSelector';
import { ProductColorSelector } from './ProductColorSelector';
import { ProductComboCustomizer } from './ProductComboCustomizer';
import { ProductImageCompareModal, CompareItem } from './ProductImageCompareModal';
import { ShareProductModal } from './ShareProductModal';
import { LoadingImage } from './LoadingImage';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Check,
  Share2,
  QrCode,
  ArrowLeft,
  Plus,
  AlertCircle,
  ShieldCheck,
  PackageCheck,
  Package,
  Truck,
  RotateCcw,
  Sparkles,
  Award,
  MessageCircle,
  ZoomIn
} from 'lucide-react';
import { trackGA4ViewItem, trackGA4PageView } from '../utils/analytics';
import { resolveAssetUrl } from '../firebase';
import { useProductSEO } from '../utils/seo';
import { getProductSlug } from '../utils/slugify';
import { buildProductGalleryImages, findGalleryImageIndex, isSameImageUrl } from '../utils/imageUtils';

interface ProductDetailPageProps {
  product: Product;
  allProducts: Product[];
  categories?: CategoryItem[];
  collections?: CollectionInfo[];
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
    selectedOmamoriPrice?: number,
    selectedKhoen?: string,
    selectedKhoenImage?: string,
    selectedKhoenPrice?: number,
    selectedComboItems?: ComboItemSelection[]
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
    selectedOmamoriPrice?: number,
    selectedKhoen?: string,
    selectedKhoenImage?: string,
    selectedKhoenPrice?: number,
    selectedComboItems?: ComboItemSelection[]
  ) => void;
}

const EMPTY_CATEGORIES: CategoryItem[] = [];
const EMPTY_COLLECTIONS: CollectionInfo[] = [];
const EMPTY_CART_ITEMS: CartItem[] = [];

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  allProducts,
  categories = EMPTY_CATEGORIES,
  collections = EMPTY_COLLECTIONS,
  cartItems = EMPTY_CART_ITEMS,
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
      const inStockColor = product.colorOptions.find((c) => c.stock === undefined || c.stock > 0);
      return inStockColor ? inStockColor.name : product.colorOptions[0].name;
    }
    return product.availableColors?.[0];
  }, [product]);

  const initialColorImage = useMemo(() => {
    if (product.colorOptions && product.colorOptions.length > 0) {
      const inStockColor = product.colorOptions.find((c) => c.stock === undefined || c.stock > 0);
      return (inStockColor || product.colorOptions[0]).image;
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

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
  }, [cartItems]);

  const effectiveUnitPrice = product.price + totalCharmPrice + totalOmamoriPrice + totalKhoenPrice;

  const selectedCharmNames = useMemo(() => {
    return selectedCharms.map((c) => c.name).join(', ');
  }, [selectedCharms]);

  const [isAdded, setIsAdded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [quickAddedId, setQuickAddedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'return_warranty' | 'shipping'>('return_warranty');

  // Floating hovering purchase dock visibility: only show when above the original CTA and it is obscured below viewport
  const mainCtaRef = useRef<HTMLDivElement>(null);
  const [showFloatingBar, setShowFloatingBar] = useState<boolean>(false);
  const [stockNotice, setStockNotice] = useState<string | null>(null);
  const stockNoticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerStockNotice = (customMsg?: string) => {
    if (stockNoticeTimerRef.current) clearTimeout(stockNoticeTimerRef.current);
    const msg = customMsg || (
      isOutOfStock 
        ? 'Sản phẩm này hiện đã hết hàng.'
        : isCartFullForProduct 
        ? `Bạn đã thêm đủ toàn bộ tồn kho (${availableStock} chiếc) vào giỏ hàng!` 
        : `Kho chỉ còn ${availableStock} chiếc (bạn đã chọn ${quantity} chiếc).`
    );
    setStockNotice(msg);
    stockNoticeTimerRef.current = setTimeout(() => {
      setStockNotice(null);
    }, 3500);
  };

  useEffect(() => {
    const updateVisibility = () => {
      if (!mainCtaRef.current) {
        setShowFloatingBar(false);
        return;
      }
      const rect = mainCtaRef.current.getBoundingClientRect();
      // Only show if the user is above the original CTA button and the button is hidden below the viewport
      const isAboveAndObscured = rect.top > window.innerHeight;
      setShowFloatingBar(isAboveAndObscured);
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
    };
  }, [product?.id]);

  const isInteractiveCombo = Boolean(product.isCombo && product.comboItems && product.comboItems.length > 0);
  const [activeComboStep, setActiveComboStep] = useState(0);

  // General combo overview images: always kept accessible
  const generalComboImages = useMemo(() => {
    const raw: string[] = [];
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      raw.push(...product.images);
    } else if (product.image) {
      raw.push(product.image);
    }
    const clean: string[] = [];
    raw.forEach((r) => {
      if (r && typeof r === 'string' && r.trim()) {
        const resolved = resolveAssetUrl(r.trim());
        if (resolved && !clean.some((ex) => isSameImageUrl(ex, resolved))) {
          clean.push(resolved);
        }
      }
    });
    return clean;
  }, [product.image, product.images]);

  // Gallery images strictly reflecting the product's uploaded images, sub-items and color variants
  const images = useMemo(() => {
    if (isInteractiveCombo && product.comboItems && product.comboItems.length > 0) {
      const activeItem = product.comboItems[activeComboStep] || product.comboItems[0];
      const itemRaw: string[] = [];
      if (activeItem?.image) itemRaw.push(activeItem.image);
      if (Array.isArray(activeItem?.images)) {
        itemRaw.push(...activeItem.images);
      }
      if (Array.isArray(activeItem?.colorOptions)) {
        activeItem.colorOptions.forEach((col) => {
          if (col?.image) itemRaw.push(col.image);
        });
      }

      // "lúc nào cũng có ảnh chung": General overview images first, then current sub-product images
      const combined: string[] = [...generalComboImages];
      itemRaw.forEach((r) => {
        if (r && typeof r === 'string' && r.trim()) {
          const resolved = resolveAssetUrl(r.trim());
          if (resolved && !combined.some((ex) => isSameImageUrl(ex, resolved))) {
            combined.push(resolved);
          }
        }
      });

      return combined.length > 0 ? combined : ['/assets/bracelet.jpg'];
    }

    return buildProductGalleryImages(product);
  }, [product, isInteractiveCombo, activeComboStep, generalComboImages]);

  const [productCompareModalOpen, setProductCompareModalOpen] = useState(false);

  const productCompareItems: CompareItem[] = useMemo(() => {
    return images.map((img, i) => {
      const matchingColor = product.colorOptions?.find((c) => c.image && isSameImageUrl(c.image, img));
      return {
        id: `prod-img-${i}`,
        title: matchingColor ? `${product.name} (${matchingColor.name})` : `${product.name} - Ảnh ${i + 1}`,
        image: img,
        subtitle: matchingColor ? `Phân loại: ${matchingColor.name}` : undefined,
        type: 'product',
        originalData: matchingColor,
      };
    });
  }, [images, product]);

  // Reset state when product changes
  useEffect(() => {
    const inStockColor = product.colorOptions?.find((c) => c.stock === undefined || c.stock > 0);
    const initCol = inStockColor ? inStockColor.name : (product.colorOptions?.[0]?.name || product.availableColors?.[0]);
    const initImg = inStockColor ? inStockColor.image : product.colorOptions?.[0]?.image;

    setQuantity(1);
    setSelectedColor(initCol);
    setSelectedColorImage(initImg);
    setSelectedCharms([]);
    setSelectedOmamoris([]);
    setSelectedKhoen(null);
    setCharmError(null);
    setOmamoriError(null);
    setKhoenError(null);
    setIsAdded(false);
    setQuickAddedId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (initImg) {
      const initIdx = findGalleryImageIndex(images, initImg);
      setActiveImageIdx(initIdx > -1 ? initIdx : 0);
    } else {
      setActiveImageIdx(0);
    }

    if (product) {
      trackGA4ViewItem(product);
      trackGA4PageView(`#product-detail?id=${product.id}`, `${product.name} - NOT A KNOT`);
    }
  }, [product?.id]);

  const selectedColorOption = useMemo(() => {
    if (!selectedColor || !product.colorOptions) return undefined;
    return product.colorOptions.find(
      (c) => c.name.trim().toLowerCase() === selectedColor.trim().toLowerCase()
    );
  }, [product.colorOptions, selectedColor]);

  // If a specific color is selected and has its own stock, use that color's stock
  const currentColorStock = typeof selectedColorOption?.stock === 'number'
    ? selectedColorOption.stock
    : undefined;

  const availableStock = currentColorStock !== undefined
    ? currentColorStock
    : (typeof product.stock === 'number' 
      ? product.stock 
      : (product.inStock === false ? 0 : 99));

  const inCartQty = useMemo(() => {
    if (!cartItems || cartItems.length === 0) return 0;
    return cartItems
      .filter((item) => item.product.id === product.id && (currentColorStock === undefined || item.selectedColor === selectedColor))
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems, product.id, currentColorStock, selectedColor]);

  const remainingAddableStock = Math.max(0, availableStock - inCartQty);
  const isOutOfStock = product.inStock === false || availableStock <= 0;
  const isCartFullForProduct = !isOutOfStock && remainingAddableStock <= 0 && availableStock < 90;

  // Ensure selected quantity never exceeds remaining addable stock
  useEffect(() => {
    if (remainingAddableStock > 0) {
      setQuantity((prev) => (prev > remainingAddableStock ? remainingAddableStock : prev));
    }
  }, [remainingAddableStock]);

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
    const targetImg = images[idx];
    if (targetImg && product.colorOptions && product.colorOptions.length > 0) {
      const matchingColor = product.colorOptions.find((c) => c.image && isSameImageUrl(c.image, targetImg));
      if (matchingColor && (matchingColor.stock === undefined || matchingColor.stock > 0)) {
        setSelectedColor(matchingColor.name);
        setSelectedColorImage(matchingColor.image);
      }
    }
  }, [images, product.colorOptions]);

  const prevImage = useCallback(() => {
    paginate(-1);
  }, [paginate]);

  const nextImage = useCallback(() => {
    paginate(1);
  }, [paginate]);

  // Mobile touch swipe gestures for image gallery
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchDeltaXRef.current = 0;
      isSwipingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isSwipingRef.current || touchStartXRef.current === null) return;
    const currentX = e.touches[0].clientX;
    touchDeltaXRef.current = currentX - touchStartXRef.current;
  };

  const handleTouchEnd = () => {
    if (isSwipingRef.current && touchStartXRef.current !== null) {
      const deltaX = touchDeltaXRef.current;
      const swipeThreshold = 30; // px threshold
      if (deltaX < -swipeThreshold) {
        nextImage();
      } else if (deltaX > swipeThreshold) {
        prevImage();
      }
    }
    isSwipingRef.current = false;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchDeltaXRef.current = 0;
  };

  // Keyboard navigation for image gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (productCompareModalOpen) return;
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;

      if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevImage, nextImage, productCompareModalOpen]);

  // Color selection with automatic image link preview
  const handleSelectColor = (colorOpt: ProductColorOption) => {
    setSelectedColor(colorOpt.name);
    if (colorOpt.image && colorOpt.image.trim()) {
      setSelectedColorImage(colorOpt.image);
      const imgIdx = findGalleryImageIndex(images, colorOpt.image);
      if (imgIdx > -1) {
        setActiveImageIdx(imgIdx);
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

    const charmTitleLabel = product.charmTitle?.trim() || 'Charm';
    const omamoriTitleLabel = product.omamoriTitle?.trim() || 'Bùa Omamori';

    if (product.enableCharmSelection && product.charmSelectionRequired && selectedCharms.length === 0) {
      setCharmError(`Vui lòng chọn ít nhất 1 tùy chọn trong "${charmTitleLabel}" trước khi thêm vào giỏ hàng.`);
      return;
    }

    if (product.enableOmamoriSelection && product.omamoriSelectionRequired && selectedOmamoris.length === 0) {
      setOmamoriError(`Vui lòng chọn ít nhất 1 tùy chọn trong "${omamoriTitleLabel}" trước khi thêm vào giỏ hàng.`);
      return;
    }

    const khoenTitleLabel = product.khoenTitle?.trim() || 'Khoen';
    if (product.enableKhoenSelection && product.khoenSelectionRequired && !selectedKhoen) {
      setKhoenError(`Vui lòng chọn 1 tùy chọn trong "${khoenTitleLabel}" trước khi thêm vào giỏ hàng.`);
      return;
    }

    const addQty = Math.min(quantity, remainingAddableStock);

    if (selectedColorOption && typeof selectedColorOption.stock === 'number') {
      if (selectedColorOption.stock <= 0) {
        triggerStockNotice(`Màu "${selectedColorOption.name}" hiện đã hết hàng.`);
        return;
      }
      if (selectedColorOption.stock < addQty) {
        triggerStockNotice(`Màu "${selectedColorOption.name}" chỉ còn ${selectedColorOption.stock} chiếc trong kho.`);
        return;
      }
    }

    for (const ch of selectedCharms) {
      if (typeof ch.stock === 'number') {
        if (ch.stock <= 0) {
          setCharmError(`Mục "${ch.name}" hiện đã hết hàng. Vui lòng chọn mục khác.`);
          return;
        }
        if (ch.stock < addQty) {
          setCharmError(`Mục "${ch.name}" chỉ còn ${ch.stock} cái trong kho, không đủ số lượng ${addQty}.`);
          return;
        }
      }
    }

    for (const om of selectedOmamoris) {
      if (typeof om.stock === 'number') {
        if (om.stock <= 0) {
          setOmamoriError(`Mục "${om.name}" hiện đã hết hàng. Vui lòng chọn mục khác.`);
          return;
        }
        if (om.stock < addQty) {
          setOmamoriError(`Mục "${om.name}" chỉ còn ${om.stock} cái trong kho, không đủ số lượng ${addQty}.`);
          return;
        }
      }
    }

    if (selectedKhoen && typeof selectedKhoen.stock === 'number') {
      if (selectedKhoen.stock <= 0) {
        setKhoenError(`Mục "${selectedKhoen.name}" hiện đã hết hàng. Vui lòng chọn mục khác.`);
        return;
      }
      if (selectedKhoen.stock < addQty) {
        setKhoenError(`Mục "${selectedKhoen.name}" chỉ còn ${selectedKhoen.stock} cái trong kho, không đủ số lượng ${addQty}.`);
        return;
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
      totalOmamoriPrice,
      selectedKhoen?.name || undefined,
      selectedKhoen?.image || undefined,
      totalKhoenPrice
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

    const khoenTitleLabel = product.khoenTitle?.trim() || 'Khoen';
    if (product.enableKhoenSelection && product.khoenSelectionRequired && !selectedKhoen) {
      setKhoenError(`Vui lòng chọn 1 tùy chọn trong "${khoenTitleLabel}" trước khi mua hàng.`);
      return;
    }

    const addQty = Math.min(quantity, remainingAddableStock);

    if (selectedColorOption && typeof selectedColorOption.stock === 'number') {
      if (selectedColorOption.stock <= 0) {
        triggerStockNotice(`Màu "${selectedColorOption.name}" hiện đã hết hàng.`);
        return;
      }
      if (selectedColorOption.stock < addQty) {
        triggerStockNotice(`Màu "${selectedColorOption.name}" chỉ còn ${selectedColorOption.stock} chiếc trong kho.`);
        return;
      }
    }

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

    if (selectedKhoen && typeof selectedKhoen.stock === 'number') {
      if (selectedKhoen.stock <= 0) {
        setKhoenError(`Mục "${selectedKhoen.name}" hiện đã hết hàng. Vui lòng chọn mục khác.`);
        return;
      }
      if (selectedKhoen.stock < addQty) {
        setKhoenError(`Mục "${selectedKhoen.name}" chỉ còn ${selectedKhoen.stock} cái trong kho, không đủ số lượng ${addQty}.`);
        return;
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
      totalOmamoriPrice,
      selectedKhoen?.name || undefined,
      selectedKhoen?.image || undefined,
      totalKhoenPrice
    );
  };

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  const handleQuickAddRecommended = (e: React.MouseEvent, prod: Product) => {
    e.stopPropagation();
    const defaultColor = prod.colorOptions?.[0]?.name || prod.availableColors?.[0];
    onAddToCart(prod, 1, defaultColor, undefined);
    
    setQuickAddedId(prod.id);
    setTimeout(() => {
      setQuickAddedId((curr) => (curr === prod.id ? null : curr));
    }, 1800);
  };

  // Set of category IDs that are marked as hidden
  const hiddenCategoryIds = useMemo(() => {
    return new Set(
      categories
        .filter((c) => c.isHidden === true || String(c.isHidden) === 'true')
        .map((c) => c.id)
    );
  }, [categories]);

  // Robust check: Is this product hidden (explicitly or via its category)
  const isProductVisible = useCallback(
    (p: Product) => {
      if (p.isHidden === true || String(p.isHidden) === 'true') return false;
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
    if (collections && collections.length > 0) {
      const matchCol = collections.find(
        (c) => c.id === product.category || c.categoryKey === product.category
      );
      if (matchCol && (matchCol.tag || matchCol.title)) return matchCol.tag || matchCol.title;
    }
    const match = categories.find((c) => c.id === product.category);
    if (match) return match.label;
    if (product.category === 'event_0209') return 'Quốc Khánh 02.09';
    if (product.category === 'event_2010') return 'Phụ Nữ 20.10';
    if (product.category === 'bracelets') return 'Vòng Tay Handmade';
    if (product.category === 'back_to_school') return 'Back 2 School';
    if (product.category && product.category.trim().length > 0) {
      return product.category.replace(/^(BST|Bộ\s+sưu\s+tập)\s+/i, '').trim();
    }
    return 'Bộ Sưu Tập NOT A KNOT';
  }, [categories, collections, product.category]);

  // Automatically update page title, meta description, keywords, Open Graph, Twitter cards, and JSON-LD schema for this product
  useProductSEO(product, categoryName);

  // Preload main product images and all option images for instant loading
  useEffect(() => {
    // 1. Main gallery images
    if (images && images.length > 0) {
      images.slice(0, 4).forEach((imgSrc) => {
        if (imgSrc) {
          const img = new Image();
          img.src = resolveAssetUrl(imgSrc);
        }
      });
    }
    // 2. Product Option Images (Charms, Omamori, Khoens, Colors)
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
  }, [images, product]);

  if (product.isHidden === true || String(product.isHidden) === 'true') {
    return (
      <div id="product-hidden-page" className="min-h-[70vh] bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-900 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-8 h-8 text-amber-800" />
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
      <div className="bg-white/95 backdrop-blur-md border-b border-neutral-200/80 sticky top-14 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-neutral-950 hover:text-neutral-700 transition-colors cursor-pointer py-1.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 active:scale-95 border border-neutral-200/80 shadow-2xs"
            title="Quay lại cửa hàng (Về shop)"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-950 stroke-[2.5]" />
            <span>Về shop</span>
            <span className="hidden sm:inline font-normal text-neutral-500">• {backLabel || 'Danh mục sản phẩm'}</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs font-bold text-neutral-700 bg-neutral-100/90 border border-neutral-200/80 px-2.5 py-1 rounded-lg truncate max-w-[160px] sm:max-w-none">
              {categoryName}
            </span>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors cursor-pointer active:scale-95 border border-neutral-200/60 shadow-2xs"
              title="Chia sẻ sản phẩm"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-800" />
              <span>Chia sẻ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-12">
        {/* Product Hero: Left Gallery, Right Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* LEFT: Compact Interactive High-Res Gallery (Responsive Full-Width Mobile) */}
          <div className="lg:col-span-5 xl:col-span-5 max-w-md mx-auto w-full lg:max-w-none space-y-3">
            <div 
              onClick={() => setProductCompareModalOpen(true)}
              className="relative aspect-square w-full sm:max-h-[440px] rounded-2xl sm:rounded-3xl overflow-hidden bg-white border border-neutral-200/90 shadow-xs group select-none touch-pan-y mx-auto cursor-zoom-in isolate"
              style={{ touchAction: 'pan-y' }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
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
                      className="w-full h-full object-cover object-center select-none pointer-events-none"
                      style={{ imageRendering: '-webkit-optimize-contrast' }}
                      draggable={false}
                      spinnerSize="md"
                      spinnerColor="amber"
                    />
                  </div>
                ))}
              </div>

              {/* Shopee-style Photo Counter Pill */}
              {images.length > 1 && (
                <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md text-white text-[10px] sm:text-xs font-bold rounded-full pointer-events-none z-10 flex items-center gap-1 shadow-sm">
                  <span>{activeImageIdx + 1}</span>
                  <span className="opacity-60">/</span>
                  <span>{images.length}</span>
                </div>
              )}

              {/* Navigation Arrows for switching photos */}
              {images.length > 1 && (
                <>
                  {/* Left arrow button */}
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        prevImage();
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      className="pointer-events-auto w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/30 text-white flex items-center justify-center opacity-85 sm:opacity-0 sm:group-hover:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-md"
                      aria-label="Ảnh trước"
                    >
                      <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Right arrow button */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        nextImage();
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      className="pointer-events-auto w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/30 text-white flex items-center justify-center opacity-85 sm:opacity-0 sm:group-hover:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-md"
                      aria-label="Ảnh tiếp theo"
                    >
                      <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>
                </>
              )}

              {/* Mobile pagination dots */}
              {images.length > 1 && (
                <div 
                  className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-full sm:hidden pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                >
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectImage(idx);
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      aria-label={`Chuyển đến ảnh ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 p-0 border-0 cursor-pointer ${
                        idx === activeImageIdx ? 'w-3.5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnail Strip (Click to choose photo) */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {images.map((img, idx) => {
                  const isActive = idx === activeImageIdx;
                  return (
                    <button
                      key={idx}
                      onClick={() => selectImage(idx)}
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 bg-white cursor-pointer ${
                        isActive
                          ? 'border-neutral-950 ring-2 ring-neutral-950/20 scale-102 shadow-xs'
                          : 'border-neutral-200 opacity-60 hover:opacity-100 hover:border-neutral-400'
                      }`}
                    >
                      <LoadingImage
                        src={img || '/assets/bracelet.jpg'}
                        alt={`${product.name} thumbnail ${idx + 1}`}
                        containerClassName="w-full h-full"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        spinnerSize="xs"
                        spinnerColor="neutral"
                      />
                      {isInteractiveCombo ? (
                        idx === generalComboImages.length ? (
                          <span className="absolute bottom-0 inset-x-0 bg-amber-500/95 text-[7px] text-neutral-950 text-center font-bold py-0.5 truncate px-0.5">
                            {product.comboItems?.[activeComboStep]?.title || 'Chi tiết'}
                          </span>
                        ) : null
                      ) : (
                        idx === 0 && (
                          <span className="absolute bottom-0 inset-x-0 bg-neutral-900/80 text-[7px] text-white text-center font-bold py-0.2">
                            Chính
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Product Information & Purchase Panel */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-4 sm:space-y-5">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-7 border border-neutral-200/70 sm:border-neutral-200/90 shadow-2xs sm:shadow-xs space-y-3.5 sm:space-y-6">
              
              {/* Product Title & Quick Share */}
              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <h1 className="text-xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight leading-tight flex-1">
                  {product.name}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-slate-200/80 shadow-2xs active:scale-95"
                  title="Chia sẻ sản phẩm"
                >
                  <Share2 className="w-4 h-4 text-slate-800" />
                  <span className="hidden sm:inline">Chia sẻ</span>
                </button>
              </div>

              {/* Price & Sales Row */}
              <div className="p-3 sm:p-4 bg-neutral-50 rounded-xl sm:rounded-2xl border border-neutral-200/80 flex items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                    <span className="text-xl sm:text-3xl font-black text-neutral-950 font-mono tracking-tight">
                      {effectiveUnitPrice.toLocaleString('vi-VN')}đ
                    </span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="text-sm sm:text-base text-neutral-400 line-through font-mono">
                        {(product.originalPrice + totalCharmPrice + totalOmamoriPrice).toLocaleString('vi-VN')}đ
                      </span>
                    )}

                    {/* Discount Badge Tag next to Price (Only if explicitly set) */}
                    {product.discountBadge && (
                      <span className="px-2 py-0.5 bg-rose-600 text-white text-xs sm:text-sm font-extrabold rounded-lg shadow-2xs flex items-center shrink-0">
                        {product.discountBadge}
                      </span>
                    )}
                  </div>
                  {(totalCharmPrice > 0 || totalOmamoriPrice > 0) && (
                    <div className="text-xs font-medium text-amber-800">
                      +{(totalCharmPrice + totalOmamoriPrice).toLocaleString('vi-VN')}đ phụ kiện
                    </div>
                  )}
                </div>

                {product.soldCount !== undefined && product.soldCount > 0 && (
                  <span className="text-xs font-medium text-neutral-500 shrink-0">
                    Đã bán {product.soldCount}
                  </span>
                )}
              </div>

              {/* Short Description */}
              {product.description && (
                <p className="text-sm text-neutral-600 leading-relaxed">
                  {product.description}
                </p>
              )}

              {/* Multi-Product Combo Stepper Flow if this product is a Combo */}
              {isInteractiveCombo ? (
                <ProductComboCustomizer
                  product={product}
                  comboItems={product.comboItems!}
                  allProducts={allProducts}
                  activeStep={activeComboStep}
                  onStepChange={(stepIdx) => {
                    setActiveComboStep(stepIdx);
                    // Switch carousel to active item image (right after general combo images)
                    if (generalComboImages.length > 0) {
                      setActiveImageIdx(generalComboImages.length);
                    } else {
                      setActiveImageIdx(0);
                    }
                  }}
                  onColorSelect={(_colName, colImg) => {
                    if (colImg) {
                      const matchIdx = findGalleryImageIndex(images, colImg);
                      if (matchIdx >= 0) {
                        setActiveImageIdx(matchIdx);
                      }
                    }
                  }}
                  quantity={quantity}
                  setQuantity={setQuantity}
                  availableStock={availableStock}
                  isOutOfStock={isOutOfStock}
                  isCartFullForProduct={isCartFullForProduct}
                  remainingAddableStock={remainingAddableStock}
                  isAdded={isAdded}
                  onAddToCartDirect={(selectedComboItems, totalExtra, chosenQty) => {
                    setIsAdded(true);
                    setTimeout(() => setIsAdded(false), 2000);
                    onAddToCart(
                      product,
                      chosenQty,
                      selectedComboItems[0]?.selectedColor,
                      undefined,
                      undefined,
                      undefined,
                      selectedComboItems[0]?.selectedColorImage,
                      undefined,
                      totalExtra,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      selectedComboItems
                    );
                  }}
                  onBuyNowDirect={(selectedComboItems, totalExtra, chosenQty) => {
                    onBuyNow(
                      product,
                      chosenQty,
                      selectedComboItems[0]?.selectedColor,
                      undefined,
                      undefined,
                      undefined,
                      selectedComboItems[0]?.selectedColorImage,
                      undefined,
                      totalExtra,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      selectedComboItems
                    );
                  }}
                />
              ) : (
                <>
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
                </>
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

              {/* Quantity Selector & Action Buttons (Hidden for interactive Combo products because Combo has its own interactive stepper buttons) */}
              {!isInteractiveCombo && (
                <div ref={mainCtaRef} id="product-detail-main-cta" className="space-y-3 pt-2">
                {/* Large Prominent Quantity & Subtotal Card */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-neutral-50 rounded-2xl border border-neutral-200/90 shadow-2xs">
                  <div className="flex items-center gap-2.5 flex-wrap">
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

                    {/* Small subtle stock counter */}
                    {isOutOfStock || availableStock <= 0 ? (
                      <span className="text-[11px] font-semibold text-rose-600">
                        Hết hàng
                      </span>
                    ) : availableStock < 5 ? (
                      <span className="text-[11px] font-medium text-amber-700">
                        (chỉ còn {availableStock})
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-500">
                        (còn {availableStock})
                      </span>
                    )}
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
              </div>
              )}

              {/* Service Guarantees */}
              <div className="pt-4 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-neutral-700">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100/90">
                    <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium truncate">Đóng gói hộp giấy</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100/90">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium truncate">Bảo hành chi tiết</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100/90">
                    <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Truck className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium truncate">Phí ship minh bạch</span>
                  </div>
                </div>

            </div>
          </div>
        </div>

        {/* INTERACTIVE POLICY & SHIPPING TABS */}
        <section id="product-tabs-section" className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-xs space-y-6">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('return_warranty')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'return_warranty'
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Chính sách đổi trả & Bảo hành</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shipping')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'shipping'
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Chính sách Phí vận chuyển</span>
            </button>
          </div>

          {/* Tab 1: Chính sách đổi trả & Bảo hành */}
          {activeTab === 'return_warranty' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-950 text-sm">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Thiết kế đan thủ công tinh xảo</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Từng đường đan được thắt thủ công tỉ mỉ, chất liệu chỉ dù cao cấp bền màu, êm ái khi đeo cả ngày dài.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-950 text-sm">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Bảo hành chi tiết từng phụ kiện</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Có chính sách bảo hành chi tiết đối với từng thành phần: khoen, charm, bùa, phụ kiện hoặc dây khi có vấn đề trong quá trình sử dụng.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-950 text-sm">
                    <Package className="w-4 h-4 text-sky-600" />
                    <span>Đóng gói trong hộp giấy</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Mỗi sản phẩm đều được đóng gói cẩn thận trong hộp giấy cứng cáp, bảo vệ sản phẩm toàn diện khi giao hàng và lịch sự khi làm quà tặng.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-950 text-sm">
                    <RotateCcw className="w-4 h-4 text-rose-600" />
                    <span>Quy định đổi trả & Xử lý lỗi</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Hỗ trợ tiếp nhận đổi trả hoặc bảo hành đối với các trường hợp lỗi linh kiện (khoen, charm, bùa, phụ kiện, hoặc dây) hoặc sản phẩm bị ảnh hưởng trong khâu giao nhận.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Chính sách Phí vận chuyển */}
          {activeTab === 'shipping' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-950 text-sm">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>Toàn bộ Hà Nội</span>
                  </div>
                  <div className="text-base font-black text-emerald-600 font-mono">0đ (Miễn phí ship)</div>
                  <p className="text-neutral-600 leading-relaxed">
                    Miễn phí giao hàng cho tất cả đơn hàng tại Hà Nội, bao gồm toàn bộ các quận, huyện và thị xã.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-neutral-950 text-sm">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>Toàn quốc (Tỉnh khác)</span>
                  </div>
                  <div className="text-base font-black text-blue-600 font-mono">20.000đ</div>
                  <p className="text-neutral-600 leading-relaxed">
                    Áp dụng mức phí đồng giá 20.000đ cho mọi tỉnh, thành phố khác trên toàn quốc.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 text-xs text-neutral-600 flex items-start gap-2.5">
                <PackageCheck className="w-4 h-4 text-neutral-700 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Thời gian giao hàng: Nội thành Hà Nội từ 1 - 2 ngày làm việc, các tỉnh thành khác từ 2 - 4 ngày làm việc. Khách hàng được quyền kiểm tra hàng khi nhận.
                </p>
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
              {recommendedProducts.map((rec) => {
                return (
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
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
                        {rec.discountBadge ? (
                          <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-lg shadow-2xs">
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
                    <div className="p-4 flex flex-col flex-1 justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-xs sm:text-sm text-neutral-950 group-hover:text-amber-700 transition-colors line-clamp-1">
                          {rec.name}
                        </h3>
                        <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                          {(rec as any).subtitle || rec.description}
                        </p>

                        <div className="flex items-baseline gap-1.5 mt-2">
                          <span className="font-mono text-sm sm:text-base font-black text-neutral-950">
                            {rec.price.toLocaleString('vi-VN')}đ
                          </span>
                          {rec.originalPrice && rec.originalPrice > rec.price && (
                            <span className="text-xs text-neutral-400 line-through font-mono">
                              {rec.originalPrice.toLocaleString('vi-VN')}đ
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
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
              {relatedProducts.map((rel) => {
                return (
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
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
                        {rel.discountBadge ? (
                          <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-lg shadow-2xs">
                            {rel.discountBadge}
                          </span>
                        ) : rel.isBestSeller ? (
                          <span className="px-2 py-0.5 bg-neutral-950 text-white text-[10px] font-black rounded-lg shadow-2xs">
                            HOT
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="p-4 flex flex-col flex-1 justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-xs sm:text-sm text-neutral-950 group-hover:text-amber-700 transition-colors line-clamp-1">
                          {rel.name}
                        </h3>
                        <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                          {(rel as any).subtitle || rel.description}
                        </p>

                        <div className="flex items-baseline gap-1.5 mt-2">
                          <span className="font-mono text-sm sm:text-base font-black text-neutral-950">
                            {rel.price.toLocaleString('vi-VN')}đ
                          </span>
                          {rel.originalPrice && rel.originalPrice > rel.price && (
                            <span className="text-xs text-neutral-400 line-through font-mono">
                              {rel.originalPrice.toLocaleString('vi-VN')}đ
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

      </main>

      {/* UNIVERSAL FLOATING PERSISTENT PURCHASE DOCK (Desktop & Mobile) - disabled for combo products to let user customize both products */}
      <AnimatePresence>
        {showFloatingBar && !isInteractiveCombo && (
          <motion.div
            key="floating-product-dock"
            id="floating-product-dock"
            initial={{ y: 100, opacity: 0 }}
            animate={{
              y: 0,
              opacity: 1,
              transition: { type: 'spring', damping: 28, stiffness: 300 }
            }}
            exit={{
              y: 100,
              opacity: 0,
              transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] }
            }}
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

            {/* MOBILE SHOPEE-STYLE BAR (< sm) */}
            <div className="flex sm:hidden items-center justify-between gap-1.5 w-full">
              {/* Left quick action icons */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Chat button */}
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-chat-widget'));
                  }}
                  className="flex flex-col items-center justify-center w-12 py-1 text-neutral-600 hover:text-amber-700 active:scale-90 transition-transform cursor-pointer"
                  title="Chat tư vấn ngay"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-[9px] font-medium mt-0.5">Chat</span>
                </button>

                {/* Cart with badge */}
                <button
                  type="button"
                  onClick={onBack}
                  className="relative flex flex-col items-center justify-center w-12 py-1 text-neutral-600 hover:text-amber-700 active:scale-90 transition-transform cursor-pointer"
                  title="Xem giỏ hàng"
                >
                  <ShoppingBag className="w-4 h-4" />
                  {totalCartCount > 0 && (
                    <span className="absolute -top-0.5 right-1.5 min-w-[15px] h-[15px] bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 shadow-xs">
                      {totalCartCount > 99 ? '99+' : totalCartCount}
                    </span>
                  )}
                  <span className="text-[9px] font-medium mt-0.5">Giỏ hàng</span>
                </button>
              </div>

              {/* Action buttons (Shopee split style) */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <button
                  type="button"
                  id="mobile-floating-add-to-cart-btn"
                  disabled={isOutOfStock || isCartFullForProduct}
                  onClick={() => {
                    if (isOutOfStock || isCartFullForProduct) {
                      triggerStockNotice();
                    } else {
                      handleAddToCartClick();
                    }
                  }}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1 ${
                    isOutOfStock || isCartFullForProduct
                      ? 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                      : isAdded
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-amber-100/90 hover:bg-amber-200 text-amber-950 border border-amber-300 shadow-2xs active:scale-95 cursor-pointer'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span className="truncate">Đã thêm</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span className="truncate">{isCartFullForProduct ? 'Hết kho' : 'Thêm giỏ'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="mobile-floating-buy-now-btn"
                  disabled={isOutOfStock || isCartFullForProduct}
                  onClick={() => {
                    if (isOutOfStock || isCartFullForProduct) {
                      triggerStockNotice();
                    } else {
                      handleBuyNowClick();
                    }
                  }}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-black transition-all duration-150 flex items-center justify-center shadow-xs ${
                    isOutOfStock || isCartFullForProduct
                      ? 'bg-neutral-200 text-neutral-400'
                      : 'bg-rose-600 hover:bg-rose-700 text-white active:scale-95 cursor-pointer shadow-rose-600/20'
                  }`}
                >
                  <span className="truncate">{isCartFullForProduct ? 'Hết Kho' : 'Mua Ngay'}</span>
                </button>
              </div>
            </div>

            {/* DESKTOP / TABLET DOCK (sm+) */}
            <div className="hidden sm:flex items-center justify-between gap-2.5 sm:gap-4 max-w-7xl mx-auto">
              
              {/* Product Info & Thumbnail */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 flex-shrink-0">
                  <img
                    src={images[0] || '/assets/bracelet.jpg'}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-neutral-900 truncate leading-tight">
                    {product.name}
                  </h4>
                  <div className="font-mono font-black text-xs sm:text-sm text-rose-600 mt-0.5">
                    {(effectiveUnitPrice * quantity).toLocaleString('vi-VN')}đ
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
              <div className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50 p-0.5 flex-shrink-0">
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
                      <span className="text-xs font-bold whitespace-nowrap">Đã thêm</span>
                    </>
                  ) : isCartFullForProduct ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      <span className="text-xs font-bold whitespace-nowrap">Hết hàng</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span className="text-xs font-bold whitespace-nowrap">Thêm giỏ</span>
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
                  className={`py-2.5 px-3.5 sm:px-5 rounded-xl font-black text-xs transition-all cursor-pointer shadow-sm whitespace-nowrap ${
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

      {/* Fullscreen Product Images Zoom & Compare Lightbox */}
      <ProductImageCompareModal
        isOpen={productCompareModalOpen}
        onClose={() => setProductCompareModalOpen(false)}
        items={productCompareItems}
        initialIndex={activeImageIdx}
        title={`Ảnh chi tiết: ${product.name}`}
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

      {/* Share Product & QR Code Modal */}
      <ShareProductModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        product={product}
        categoryName={categoryName}
      />
    </motion.div>
  );
};
