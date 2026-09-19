/**
 * Vietnamese Diacritics & Clean URL Slug Utilities for NOT A KNOT
 * Ensures 100% human-readable, SEO-friendly, clean ASCII URLs.
 */

import { Product, CategoryItem, CollectionInfo } from '../types';

/**
 * Converts any Vietnamese / Unicode text into a clean, normalized, lowercased ASCII slug.
 * Examples:
 *   "Vòng Tay Hào Khí 02.09" -> "vong-tay-hao-khi-0209"
 *   "Móc Khóa Đan Dây Trái Tim" -> "moc-khoa-dan-day-trai-tim"
 *   "Phụ Kiện Charm Đồng & Titan" -> "phu-kien-charm-dong-titan"
 */
export function slugify(text: string): string {
  if (!text) return '';

  return text
    .toString()
    .toLowerCase()
    // Replace special Vietnamese characters
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/[đĐ]/g, 'd')
    // Remove combined diacritical marks if any remained
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace dots between digits e.g. 02.09 -> 0209 or 02-09
    .replace(/(\d+)\.(\d+)/g, '$1$2')
    // Replace non-alphanumeric chars with hyphens
    .replace(/[^a-z0-9\s-]/g, '')
    // Replace whitespace with a single hyphen
    .replace(/\s+/g, '-')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Trim hyphens from start and end
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates an SEO-optimized clean slug for a Product
 */
export function getProductSlug(product: { id: string; name?: string; slug?: string }): string {
  if (product.slug && product.slug.trim()) {
    return slugify(product.slug);
  }
  if (product.name && product.name.trim()) {
    const nameSlug = slugify(product.name);
    if (nameSlug) return nameSlug;
  }
  return product.id;
}

/**
 * Finds a product from an array by either its raw ID, custom slug, or auto-generated name slug
 */
export function findProductBySlugOrId(products: Product[], identifier: string): Product | undefined {
  if (!identifier || !products || products.length === 0) return undefined;
  
  const cleanTarget = identifier.trim().toLowerCase();
  const slugifiedTarget = slugify(cleanTarget);

  // 1. Exact ID match
  const matchId = products.find((p) => p.id && p.id.toLowerCase() === cleanTarget);
  if (matchId) return matchId;

  // 2. Exact Custom Slug match
  const matchSlug = products.find((p) => p.slug && slugify(p.slug) === slugifiedTarget);
  if (matchSlug) return matchSlug;

  // 3. Exact Name Slug match
  const matchNameSlug = products.find((p) => slugify(p.name) === slugifiedTarget);
  if (matchNameSlug) return matchNameSlug;

  // 4. Loose substring match (fallback for truncated slugs)
  const matchLoose = products.find((p) => {
    const s = slugify(p.name);
    return s.includes(slugifiedTarget) || slugifiedTarget.includes(s);
  });
  if (matchLoose) return matchLoose;

  return undefined;
}

/**
 * Canonical Collection Slug Mapping
 */
export const COLLECTION_SLUG_MAP: Record<string, string> = {
  'event_0209': 'hao-khi-0209',
  'event-0209': 'hao-khi-0209',
  'hao-khi-0209': 'event_0209',
  'event_2010': 'phu-nu-viet-nam-2010',
  'event-2010': 'phu-nu-viet-nam-2010',
  'phu-nu-viet-nam-2010': 'event_2010',
  'bracelets': 'vong-tay-handmade',
  'vong-tay-handmade': 'bracelets',
  'back_to_school': 'tuu-truong-gen-z',
  'tuu-truong-gen-z': 'back_to_school'
};

/**
 * Normalizes any collection identifier to a clean canonical slug
 */
export function getCollectionSlug(collectionId: string, title?: string): string {
  if (COLLECTION_SLUG_MAP[collectionId]) {
    return COLLECTION_SLUG_MAP[collectionId];
  }
  if (title) {
    return slugify(title);
  }
  return slugify(collectionId);
}

/**
 * Resolves a collection ID from a slug or ID
 */
export function resolveCollectionId(slugOrId: string, availableCollections?: CollectionInfo[]): string {
  if (!slugOrId) return 'event_0209';
  const clean = slugOrId.trim().toLowerCase();

  // Known reverse map
  if (COLLECTION_SLUG_MAP[clean]) {
    return COLLECTION_SLUG_MAP[clean];
  }

  // Check matching collections list if provided
  if (availableCollections && availableCollections.length > 0) {
    const directMatch = availableCollections.find((c) => c.id === clean || slugify(c.id) === clean || slugify(c.title) === clean);
    if (directMatch) return directMatch.id;
  }

  return clean;
}

/**
 * Normalizes category IDs into clean slugs and vice versa
 */
export function getCategorySlug(category: string): string {
  return slugify(category);
}

/**
 * Resolves category from slug
 */
export function resolveCategoryId(slugOrCat: string, categories?: CategoryItem[]): string {
  if (!slugOrCat) return 'all';
  const clean = slugOrCat.trim().toLowerCase();
  if (clean === 'all' || clean === 'tat-ca') return 'all';

  if (categories && categories.length > 0) {
    const found = categories.find((c) => c.id.toLowerCase() === clean || slugify(c.label) === clean || slugify(c.id) === clean);
    if (found) return found.id;
  }

  return clean;
}

/**
 * Builds clean, absolute URLs for sharing and SEO
 */
export function buildProductUrl(product: Product, domain = 'https://www.notaknot.id.vn'): string {
  const slug = getProductSlug(product);
  return `${domain}/#product/${slug}`;
}

export function buildCollectionUrl(collectionId: string, title?: string, domain = 'https://www.notaknot.id.vn'): string {
  const slug = getCollectionSlug(collectionId, title);
  return `${domain}/#collection/${slug}`;
}
