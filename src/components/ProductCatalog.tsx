import React, { useState, useMemo } from 'react';
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'newest'>('featured');
  const [onlyInStock, setOnlyInStock] = useState(false);

  const categoryOptions = useMemo(() => {
    const allOpt = { id: 'all', label: 'Tất cả sản phẩm', badge: 'All' };
    return [allOpt, ...categories];
  }, [categories]);

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

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesCategory =
          selectedCategory === 'all' ? true : p.category === selectedCategory;
        const matchesSearch =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStock = onlyInStock ? (p.inStock !== false && (p.stock === undefined || p.stock > 0)) : true;
        return matchesCategory && matchesSearch && matchesStock;
      })
      .sort((a, b) => {
        // ALWAYS put out-of-stock / sold-out items at the very bottom!
        const aSoldOut = !a.inStock || (a.stock !== undefined && a.stock <= 0);
        const bSoldOut = !b.inStock || (b.stock !== undefined && b.stock <= 0);
        if (aSoldOut && !bSoldOut) return 1;
        if (!aSoldOut && bSoldOut) return -1;

        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'newest') return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
        return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0);
      });
  }, [products, selectedCategory, searchQuery, sortBy, onlyInStock]);

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
                  const matchingCount = products.filter(p => cat.id === 'all' ? true : p.category === cat.id).length;

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
                  placeholder="Tìm kiếm sản phẩm theo tên, mã..."
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
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {/* In-Stock Filter */}
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 px-3.5 py-2 rounded-full border border-neutral-200 cursor-pointer select-none whitespace-nowrap transition-colors">
                  <input
                    type="checkbox"
                    checked={onlyInStock}
                    onChange={(e) => setOnlyInStock(e.target.checked)}
                    className="rounded text-neutral-950 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Chỉ còn hàng</span>
                </label>

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

            {/* Product Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-neutral-200 max-w-xl mx-auto p-8 shadow-xs">
                <p className="text-neutral-700 font-bold text-base mb-2">
                  Không tìm thấy sản phẩm phù hợp
                </p>
                <p className="text-xs text-neutral-500 mb-6">
                  Vui lòng thử chọn danh mục khác hoặc bỏ bớt điều kiện tìm kiếm.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setOnlyInStock(false);
                      onSelectCategory('all');
                    }}
                    className="px-5 py-2.5 bg-neutral-950 text-white rounded-full text-xs font-semibold hover:bg-neutral-800 transition-colors"
                  >
                    Xem tất cả sản phẩm
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpenDetail={onOpenProductDetail}
                      onAddToCart={onAddToCart}
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
