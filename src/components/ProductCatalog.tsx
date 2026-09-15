import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, CategoryItem, CollectionInfo } from '../types';
import { DEFAULT_CATEGORIES } from '../data/categories';
import { Search, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { ProductCard } from './ProductCard';

interface ProductCatalogProps {
  products: Product[];
  categories?: CategoryItem[];
  collections?: CollectionInfo[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onOpenProductDetail: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onBackToHome?: () => void;
  isLoading?: boolean;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  categories = DEFAULT_CATEGORIES,
  collections = [],
  selectedCategory,
  onSelectCategory,
  onOpenProductDetail,
  onAddToCart,
  onBackToHome,
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'newest'>('featured');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');

  // Set of hidden category IDs
  const hiddenCategoryIds = useMemo(() => {
    return new Set(
      categories
        .filter((c) => c.isHidden === true || String(c.isHidden) === 'true')
        .map((c) => c.id)
    );
  }, [categories]);

  // Helper to check if a product matches a category or collection
  const isProductMatchingCategory = (p: Product, targetCatId: string) => {
    if (targetCatId === 'all') return true;
    if (p.category === targetCatId) return true;
    const col = collections.find(c => c.id === targetCatId || c.categoryKey === targetCatId);
    if (col && (p.category === col.categoryKey || p.category === col.id)) return true;
    return false;
  };

  const categoryOptions = useMemo(() => {
    const allOpt: CategoryItem = { id: 'all', label: 'Tất cả sản phẩm', badge: 'All' };
    const catMap = new Map<string, CategoryItem>();

    // 1. Add from collections (source of truth for store BSTs)
    collections.forEach((col) => {
      if (col.isHidden) return;
      const key = col.categoryKey || col.id;
      catMap.set(key, {
        id: key,
        label: (col.title || col.tag || key).replace(/^BST\s+/i, '').replace(/^Bộ sưu tập\s+/i, '').trim(),
        description: col.subtitle || col.description || '',
        highlightColor: col.themeColor || '#B41C1A',
        badge: col.badge || undefined,
        bannerImage: col.productPageBanner || col.bannerImage || col.bgImage,
        isEvent: col.themeStyle === 'event0209'
      });
    });

    // 2. Add or merge explicit categories from categories prop
    categories.forEach((cat) => {
      if (cat.isHidden) return;
      if (catMap.has(cat.id)) {
        const existing = catMap.get(cat.id)!;
        catMap.set(cat.id, {
          ...existing,
          ...cat,
          label: cat.label || existing.label
        });
      } else {
        const count = products.filter(p => !p.isHidden && p.category === cat.id).length;
        const isLegacyDummy = ['charm_bracelet', 'everyday', 'keychains', 'lanyards'].includes(cat.id);
        if (!isLegacyDummy || count > 0) {
          catMap.set(cat.id, cat);
        }
      }
    });

    // 3. Dynamically discover any category key from products that might not be in the list
    products.forEach((p) => {
      if (!p.isHidden && p.category && !hiddenCategoryIds.has(p.category) && !catMap.has(p.category)) {
        catMap.set(p.category, {
          id: p.category,
          label: p.category.replace(/^BST\s+/i, '').replace(/^Bộ sưu tập\s+/i, '').trim() || 'Vòng Tay Paracord',
          highlightColor: '#475569'
        });
      }
    });

    return [allOpt, ...Array.from(catMap.values())];
  }, [categories, collections, products, hiddenCategoryIds]);

  // Fallback to 'all' if active selectedCategory is hidden
  useEffect(() => {
    if (selectedCategory !== 'all' && hiddenCategoryIds.has(selectedCategory)) {
      onSelectCategory('all');
    }
  }, [selectedCategory, hiddenCategoryIds, onSelectCategory]);

  const activeCategoryObj = useMemo(() => {
    return categoryOptions.find((c) => c.id === selectedCategory) || categoryOptions[0];
  }, [categoryOptions, selectedCategory]);

  // Find matching collection if any for banner display
  const activeCollection = useMemo(() => {
    if (selectedCategory === 'all') return null;
    return collections.find(
      (c) => c.categoryKey === selectedCategory || c.id === selectedCategory
    );
  }, [collections, selectedCategory]);

  const collectionBannerImg = activeCollection?.productPageBanner || activeCollection?.bannerImage || activeCollection?.bgImage || (activeCategoryObj as CategoryItem)?.bannerImage;
  const collectionIntro = activeCollection?.subtitle || (activeCategoryObj as CategoryItem)?.introText || activeCategoryObj?.description;

  // Compute category-level stock counts for toggle badges
  const { totalCount, inStockCount, outOfStockCount } = useMemo(() => {
    const matched = products.filter((p) => {
      if (p.isHidden === true || String(p.isHidden) === 'true') return false;
      if (p.category && hiddenCategoryIds.has(p.category)) return false;
      const matchesCategory = isProductMatchingCategory(p, selectedCategory);
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    let inCount = 0;
    let outCount = 0;
    matched.forEach((p) => {
      const isAvailable = p.inStock !== false && (p.stock === undefined || p.stock > 0);
      if (isAvailable) inCount++;
      else outCount++;
    });

    return {
      totalCount: matched.length,
      inStockCount: inCount,
      outOfStockCount: outCount
    };
  }, [products, selectedCategory, searchQuery, hiddenCategoryIds, collections]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (p.isHidden === true || String(p.isHidden) === 'true') return false;
        if (p.category && hiddenCategoryIds.has(p.category)) return false;
        const matchesCategory = isProductMatchingCategory(p, selectedCategory);
        const matchesSearch =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase());
        
        const isAvailable = p.inStock !== false && (p.stock === undefined || p.stock > 0);
        let matchesStock = true;
        if (stockFilter === 'in_stock') {
          matchesStock = isAvailable;
        } else if (stockFilter === 'out_of_stock') {
          matchesStock = !isAvailable;
        }

        return matchesCategory && matchesSearch && matchesStock;
      })
      .sort((a, b) => {
        // When showing all, put out-of-stock items at bottom
        if (stockFilter === 'all') {
          const aSoldOut = !a.inStock || (a.stock !== undefined && a.stock <= 0);
          const bSoldOut = !b.inStock || (b.stock !== undefined && b.stock <= 0);
          if (aSoldOut && !bSoldOut) return 1;
          if (!aSoldOut && bSoldOut) return -1;
        }

        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'newest') return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
        return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0);
      });
  }, [products, selectedCategory, searchQuery, sortBy, stockFilter]);

  return (
    <div id="product-catalog-page" className="pt-4 sm:pt-6 pb-20 bg-[#FAF8F5] text-neutral-900 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Collection Banner */}
        {selectedCategory !== 'all' && collectionBannerImg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full rounded-3xl overflow-hidden shadow-sm border border-neutral-200/80 bg-neutral-950 text-white min-h-[200px] sm:min-h-[260px] flex items-end p-6 sm:p-8 group"
          >
            <img
              src={collectionBannerImg}
              alt={activeCategoryObj.label}
              className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 opacity-75"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="relative z-10 max-w-2xl space-y-1.5">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest block">
                {activeCollection?.tag || 'Bộ Sưu Tập'}
              </span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                {activeCollection?.title || activeCategoryObj.label}
              </h1>
              {collectionIntro && (
                <p className="text-xs sm:text-sm text-neutral-200 line-clamp-2 leading-relaxed">
                  {collectionIntro}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* 2-Column Catalog Layout: Left Box for Categories/BST, Right for Search/Filters & Grid */}
        <div className="flex flex-col lg:flex-row items-start gap-6">
          
          {/* LEFT SIDEBAR: Category & Collection Box */}
          <aside className="w-full lg:w-64 xl:w-72 flex-shrink-0">
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200 shadow-xs lg:sticky lg:top-20 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
                  Danh Mục & BST
                </h3>
                <span className="text-[11px] font-semibold text-neutral-400">
                  {categoryOptions.length} mục
                </span>
              </div>

              {/* Vertical Category Items in Box */}
              <div className="space-y-1">
                {categoryOptions.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const matchingCount = products.filter(
                    (p) => !p.isHidden && (!p.category || !hiddenCategoryIds.has(p.category)) && isProductMatchingCategory(p, cat.id)
                  ).length;

                  return (
                    <button
                      key={cat.id}
                      id={`sidebar-cat-btn-${cat.id}`}
                      onClick={() => onSelectCategory(cat.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-200 flex items-center justify-between group ${
                        isSelected
                          ? 'bg-neutral-950 text-white shadow-sm font-bold'
                          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950'
                      }`}
                    >
                      <span className="truncate">{cat.label}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 ${
                        isSelected
                          ? 'bg-amber-400 text-neutral-950'
                          : 'bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200 group-hover:text-neutral-800'
                      }`}>
                        {matchingCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* RIGHT MAIN CONTENT: Search, Filters & Product Grid */}
          <main className="flex-1 w-full min-w-0 space-y-4">
            
            {/* Search and Filters Bar */}
            <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-neutral-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="catalog-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm..."
                  className="w-full pl-9 pr-8 py-2 bg-neutral-50 border border-neutral-200 rounded-full text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-700 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filters & Sorting Controls */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                {/* Stock Toggle Filter Buttons (Tất cả / Còn hàng / Hết hàng) */}
                <div className="inline-flex p-1 bg-neutral-100/90 rounded-full border border-neutral-200/90 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setStockFilter('all')}
                    className={`px-3 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                      stockFilter === 'all'
                        ? 'bg-neutral-950 text-white shadow-xs font-bold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>Tất cả</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      stockFilter === 'all' ? 'bg-neutral-800 text-amber-300' : 'bg-neutral-200 text-neutral-600'
                    }`}>
                      {totalCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStockFilter('in_stock')}
                    className={`px-3 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                      stockFilter === 'in_stock'
                        ? 'bg-emerald-600 text-white shadow-xs font-bold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                    title="Chỉ hiển thị sản phẩm còn hàng"
                  >
                    <span>Còn hàng</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      stockFilter === 'in_stock' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {inStockCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStockFilter('out_of_stock')}
                    className={`px-3 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                      stockFilter === 'out_of_stock'
                        ? 'bg-rose-600 text-white shadow-xs font-bold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                    title="Chỉ hiển thị sản phẩm đã hết hàng"
                  >
                    <span>Hết hàng</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      stockFilter === 'out_of_stock' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {outOfStockCount}
                    </span>
                  </button>
                </div>

                {/* Sort dropdown */}
                <div className="flex items-center gap-1.5 bg-neutral-50 px-3 py-1.5 rounded-full border border-neutral-200">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
                  <select
                    id="catalog-sort-select"
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-neutral-800 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="featured">Nổi bật</option>
                    <option value="newest">Mới nhất</option>
                    <option value="price-asc">Giá: Thấp → Cao</option>
                    <option value="price-desc">Giá: Cao → Thấp</option>
                  </select>
                </div>

                {/* Product Count Indicator */}
                <span className="text-xs font-semibold text-neutral-500 px-2 whitespace-nowrap hidden sm:inline">
                  {filteredProducts.length} sản phẩm
                </span>
              </div>
            </div>

            {/* Product Grid / Skeleton */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5" id="product-catalog-skeleton-loader">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={`skeleton-card-${idx}`}
                    className="bg-white rounded-2xl sm:rounded-3xl border border-neutral-200/80 p-3 sm:p-4 shadow-xs flex flex-col justify-between animate-pulse"
                  >
                    <div>
                      {/* Skeleton Image with shimmering effect */}
                      <div className="w-full aspect-square rounded-xl sm:rounded-2xl bg-neutral-200 relative overflow-hidden mb-3 sm:mb-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                      </div>

                      {/* Skeleton Badge Row */}
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <div className="h-3 sm:h-4 w-16 sm:w-20 bg-neutral-200 rounded-full" />
                        <div className="h-3 sm:h-4 w-10 sm:w-14 bg-neutral-200/80 rounded-full" />
                      </div>

                      {/* Skeleton Title Lines */}
                      <div className="h-4 sm:h-5 w-4/5 bg-neutral-200 rounded-md mb-1.5" />
                      <div className="h-3 sm:h-4 w-3/5 bg-neutral-200/70 rounded-md mb-2 sm:mb-3" />
                    </div>

                    {/* Skeleton Price & Add button */}
                    <div className="pt-2 sm:pt-3 border-t border-neutral-100 flex items-center justify-between gap-2 mt-1 sm:mt-2">
                      <div className="space-y-1">
                        <div className="h-4 sm:h-6 w-16 sm:w-24 bg-neutral-200 rounded-md" />
                        <div className="h-2.5 sm:h-3 w-12 sm:w-16 bg-neutral-200/60 rounded-md" />
                      </div>
                      <div className="h-7 sm:h-10 w-14 sm:w-24 bg-neutral-200 rounded-xl sm:rounded-2xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-neutral-200 max-w-xl mx-auto p-8 shadow-xs">
                <p className="text-neutral-700 font-bold text-base mb-2">
                  Không tìm thấy sản phẩm phù hợp
                </p>
                <p className="text-xs text-neutral-500 mb-6">
                  Vui lòng thử chọn danh mục khác hoặc chuyển lại chế độ xem tồn kho.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setStockFilter('all');
                      onSelectCategory('all');
                    }}
                    className="px-5 py-2.5 bg-neutral-950 text-white rounded-full text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Xem tất cả sản phẩm
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpenDetail={onOpenProductDetail}
                      onAddToCart={onAddToCart}
                      categories={categories}
                      collections={collections}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </main>
        </div>

      </div>
    </div>
  );
};
