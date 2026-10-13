import type { CategoryItem, CollectionInfo, Product } from '../types';

export const isCatalogItemHidden = (item: { isHidden?: boolean }) =>
  item.isHidden === true || String(item.isHidden) === 'true';

export function getVisibleCollections(collections: CollectionInfo[], categories: CategoryItem[]) {
  const hiddenCategories = new Set(categories.filter(isCatalogItemHidden).map((c) => c.id));
  return collections.filter((c) => !isCatalogItemHidden(c) && !hiddenCategories.has(c.categoryKey || c.id));
}

export function isProductMatchingCategory(product: Product, categoryId: string, collections: CollectionInfo[]) {
  if (categoryId === 'all' || product.category === categoryId) return true;
  const collection = collections.find((c) => c.id === categoryId || c.categoryKey === categoryId);
  return Boolean(collection && (product.category === collection.categoryKey || product.category === collection.id));
}

// Used by both the storefront and affiliate link tools so CMS changes stay in sync.
export function getStorefrontCategoryOptions(products: Product[], categories: CategoryItem[], collections: CollectionInfo[]): CategoryItem[] {
  const hiddenCategories = new Set(categories.filter(isCatalogItemHidden).map((c) => c.id));
  const options = new Map<string, CategoryItem>();
  getVisibleCollections(collections, categories).forEach((col) => {
    const key = col.categoryKey || col.id;
    options.set(key, {
      id: key,
      label: (col.title || col.tag || key).replace(/^BST\s+/i, '').replace(/^Bộ sưu tập\s+/i, '').trim(),
      description: col.subtitle || col.description || '',
      highlightColor: col.themeColor || '#B41C1A',
      badge: col.badge || undefined,
      bannerImage: col.productPageBanner || col.bannerImage || col.bgImage,
      isEvent: col.themeStyle === 'event0209'
    });
  });
  categories.forEach((cat) => {
    if (isCatalogItemHidden(cat) || cat.id === 'all') return;
    const existing = options.get(cat.id);
    if (existing) {
      options.set(cat.id, { ...existing, ...cat, label: cat.label || existing.label });
    } else {
      const isLegacyDummy = ['charm_bracelet', 'everyday', 'keychains', 'lanyards'].includes(cat.id);
      if (!isLegacyDummy || products.some((p) => !isCatalogItemHidden(p) && p.category === cat.id)) options.set(cat.id, cat);
    }
  });
  products.forEach((p) => {
    if (!isCatalogItemHidden(p) && p.category && !hiddenCategories.has(p.category) && !options.has(p.category)) {
      options.set(p.category, {
        id: p.category,
        label: p.category.replace(/^BST\s+/i, '').replace(/^Bộ sưu tập\s+/i, '').trim() || 'Vòng Tay Handmade',
        highlightColor: '#475569'
      });
    }
  });
  options.delete('all');
  return [{ id: 'all', label: 'Tất cả sản phẩm', badge: 'All' }, ...options.values()];
}
