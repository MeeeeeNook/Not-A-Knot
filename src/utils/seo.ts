import { useEffect } from 'react';
import { Product, CollectionInfo } from '../types';
import { getProductSlug, getCollectionSlug, slugify } from './slugify';

export const SITE_DOMAIN = 'https://www.notaknot.id.vn';

export const DEFAULT_SEO = {
  title: 'Not a Knot | Handmade Accessories',
  description: 'Thương hiệu Phụ kiện thời trang thủ công dành cho học sinh, sinh viên - Vòng tay handmade độc bản, móc khoá thời trang, phụ kiện charm đồng titan chế tác thủ công tại Việt Nam.',
  keywords: 'NOT A KNOT, vòng tay handmade, phụ kiện handmade, vòng tay thủ công, vòng tay 02/09, vòng tay hào khí, vòng tay nam handmade, quà tặng thủ công, móc khóa handmade, vòng đôi handmade, phụ kiện học sinh sinh viên',
  image: '/assets/logo.jpg',
  type: 'website',
  url: `${SITE_DOMAIN}/`
};

/**
 * Helper to update or create a <meta> tag by name or property
 */
export function setMetaTag(attribute: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return;
  let element = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Helper to remove a <meta> tag by name or property
 */
export function removeMetaTag(attribute: 'name' | 'property', key: string) {
  if (typeof document === 'undefined') return;
  const element = document.querySelector(`meta[${attribute}="${key}"]`);
  if (element) {
    element.remove();
  }
}

/**
 * Helper to update or create a <link rel="canonical"> tag
 */
export function setCanonicalUrl(url: string) {
  if (typeof document === 'undefined') return;
  // Canonical URLs must NEVER contain hash fragments (#) according to RFC 6596 and Google Search Central
  const cleanWithoutHash = (url || '').split('#')[0] || SITE_DOMAIN;
  const cleanUrl = cleanWithoutHash.startsWith('http') ? cleanWithoutHash : `${SITE_DOMAIN}${cleanWithoutHash.startsWith('/') ? '' : '/'}${cleanWithoutHash}`;
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', cleanUrl);
}

/**
 * Helper to strip HTML tags & trim down text to a clean SEO description
 */
export function cleanSeoText(text: string, maxLength: number = 160): string {
  if (!text) return '';
  const clean = text
    .replace(/<[^>]*>?/gm, '')
    .replace(/[#*`_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength - 3).trim() + '...';
}

/**
 * Helper to format absolute image URL
 */
function getAbsoluteImageUrl(imagePath?: string): string {
  if (!imagePath) return `${SITE_DOMAIN}/assets/logo.jpg`;
  if (imagePath.startsWith('http')) return imagePath;
  return `${SITE_DOMAIN}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
}

export interface PageSEOOptions {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl: string;
  ogType?: 'website' | 'product' | 'article';
  ogImage?: string;
  noindex?: boolean;
}

/**
 * Generalized Page SEO Applier
 */
export function applyPageSEO(options: PageSEOOptions) {
  if (typeof document === 'undefined') return;

  const {
    title,
    description,
    keywords = DEFAULT_SEO.keywords,
    canonicalUrl,
    ogType = 'website',
    ogImage = DEFAULT_SEO.image,
    noindex = false
  } = options;

  const absImageUrl = getAbsoluteImageUrl(ogImage);
  const fullCanonical = canonicalUrl.startsWith('http') ? canonicalUrl : `${SITE_DOMAIN}${canonicalUrl.startsWith('/') ? '' : '/'}${canonicalUrl}`;

  // 1. Browser Tab & Document Title
  document.title = title;

  // 2. Canonical URL Tag
  setCanonicalUrl(fullCanonical);

  // 3. Primary Meta Tags
  setMetaTag('name', 'title', title);
  setMetaTag('name', 'description', cleanSeoText(description, 160));
  setMetaTag('name', 'keywords', keywords);

  // 4. Robots indexing directives
  if (noindex) {
    setMetaTag('name', 'robots', 'noindex, nofollow');
    setMetaTag('name', 'googlebot', 'noindex, nofollow');
  } else {
    setMetaTag('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    setMetaTag('name', 'googlebot', 'index, follow, max-snippet:-1, max-image-preview:large');
  }

  // 5. OpenGraph (Facebook / Zalo / Telegram / iMessage)
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', cleanSeoText(description, 160));
  setMetaTag('property', 'og:type', ogType);
  setMetaTag('property', 'og:url', fullCanonical);
  setMetaTag('property', 'og:image', absImageUrl);
  setMetaTag('property', 'og:image:secure_url', absImageUrl);
  setMetaTag('property', 'og:image:alt', title);
  setMetaTag('property', 'og:site_name', 'NOT A KNOT Handmade Studio');
  setMetaTag('property', 'og:locale', 'vi_VN');

  // 6. Twitter / X Cards
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', cleanSeoText(description, 160));
  setMetaTag('name', 'twitter:image', absImageUrl);
  setMetaTag('name', 'twitter:image:alt', title);
}

/**
 * Generate a high-conversion SEO title for a product
 */
export function generateProductMetaTitle(product: Product, categoryName?: string): string {
  const formattedPrice = new Intl.NumberFormat('vi-VN').format(product.price);
  if (categoryName) {
    return `${product.name} - ${categoryName} (${formattedPrice}đ) | NOT A KNOT`;
  }
  return `${product.name} - Phụ Kiện Handmade Thủ Công (${formattedPrice}đ) | NOT A KNOT`;
}

/**
 * Generate a rich, compelling SEO meta description for a product
 */
export function generateProductMetaDescription(product: Product, categoryName?: string): string {
  const formattedPrice = new Intl.NumberFormat('vi-VN').format(product.price);
  
  let rawDesc = cleanSeoText(product.description || '', 100);
  if (product.details && product.details.length > 0 && rawDesc.length < 70) {
    const detailSnippet = product.details.slice(0, 2).join('. ');
    rawDesc = `${rawDesc} ${detailSnippet}`;
  }

  const categorySnippet = categoryName ? ` thuộc ${categoryName}` : '';
  const fullDesc = `Đặt mua ngay ${product.name}${categorySnippet} tại NOT A KNOT. ${rawDesc} Chế tác thủ công tinh xảo, bền bỉ, giá chỉ ${formattedPrice}đ. Giao hàng toàn quốc.`;

  return cleanSeoText(fullDesc, 160);
}

/**
 * Generate relevant SEO keywords for a product
 */
export function generateProductKeywords(product: Product, categoryName?: string): string {
  const keywords = [
    product.name,
    `vòng tay ${product.name}`,
    `${product.name} handmade`,
    'vòng tay handmade',
    'phụ kiện handmade',
    'quà tặng thủ công',
    'NOT A KNOT'
  ];

  if (categoryName) {
    keywords.push(categoryName, `vòng tay ${categoryName}`, `phụ kiện ${categoryName}`);
  }

  if (product.availableColors && product.availableColors.length > 0) {
    product.availableColors.slice(0, 3).forEach((c) => {
      keywords.push(`vòng handmade màu ${c.toLowerCase()}`);
    });
  }

  return keywords.join(', ');
}

/**
 * Injects or updates Schema.org JSON-LD structured data for Google Search Product Rich Snippets
 */
export function updateProductSchemaJsonLd(product: Product, categoryName?: string) {
  if (typeof document === 'undefined') return;
  let script = document.getElementById('nak-product-schema-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'nak-product-schema-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  const images = product.images && product.images.length > 0 ? product.images : [product.image];
  const absoluteImages = images.map((img) => getAbsoluteImageUrl(img));
  const productSlug = getProductSlug(product);
  const productUrl = `${SITE_DOMAIN}/product/${productSlug}`;

  const schemaData = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    image: absoluteImages,
    description: generateProductMetaDescription(product, categoryName),
    sku: product.id || `NAK-${productSlug}`,
    mpn: product.id,
    brand: {
      '@type': 'Brand',
      name: 'NOT A KNOT'
    },
    category: categoryName || product.category,
    material: 'Dây đan cao cấp, Charm hợp kim/đồng/titan thủ công',
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'VND',
      price: product.price,
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      availability: product.inStock !== false ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'NOT A KNOT Handmade Studio'
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'VN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn'
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '20000',
          currency: 'VND'
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'VN'
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 2,
            unitCode: 'DAY'
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 2,
            maxValue: 4,
            unitCode: 'DAY'
          }
        }
      }
    },
    ...(product.rating && product.reviewsCount && product.reviewsCount > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
        reviewCount: product.reviewsCount,
        bestRating: '5',
        worstRating: '1'
      }
    } : {})
  };

  script.textContent = JSON.stringify(schemaData, null, 2);
}

/**
 * Remove product-specific Schema.org JSON-LD
 */
export function removeProductSchemaJsonLd() {
  if (typeof document === 'undefined') return;
  const script = document.getElementById('nak-product-schema-jsonld');
  if (script) {
    script.remove();
  }
}

/**
 * Injects or updates BreadcrumbList Schema.org JSON-LD for Google Rich Results
 */
export function updateBreadcrumbSchemaJsonLd(items: { name: string; url: string }[]) {
  if (typeof document === 'undefined') return;
  let script = document.getElementById('nak-breadcrumb-schema-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'nak-breadcrumb-schema-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_DOMAIN}${item.url.startsWith('/') ? '' : '/'}${item.url}`
    }))
  };

  script.textContent = JSON.stringify(breadcrumbData, null, 2);
}

export function removeBreadcrumbSchemaJsonLd() {
  if (typeof document === 'undefined') return;
  const script = document.getElementById('nak-breadcrumb-schema-jsonld');
  if (script) {
    script.remove();
  }
}

/**
 * Apply full SEO metadata for a single product
 */
export function setProductSEO(product: Product, categoryName?: string) {
  if (!product || typeof document === 'undefined') return;

  const title = generateProductMetaTitle(product, categoryName);
  const description = generateProductMetaDescription(product, categoryName);
  const keywords = generateProductKeywords(product, categoryName);
  const imageUrl = getAbsoluteImageUrl(product.image);
  const productSlug = getProductSlug(product);
  const productUrl = `${SITE_DOMAIN}/product/${productSlug}`;
  const productCanonical = `${SITE_DOMAIN}/product/${productSlug}`;

  applyPageSEO({
    title,
    description,
    keywords,
    canonicalUrl: productCanonical,
    ogType: 'product',
    ogImage: imageUrl
  });

  // Product Open Graph Extensions
  setMetaTag('property', 'product:brand', 'NOT A KNOT');
  setMetaTag('property', 'product:price:amount', String(product.price));
  setMetaTag('property', 'product:price:currency', 'VND');
  setMetaTag('property', 'product:availability', product.inStock !== false ? 'in stock' : 'out of stock');
  setMetaTag('property', 'product:condition', 'new');
  if (categoryName) {
    setMetaTag('property', 'product:category', categoryName);
  }

  // Schema.org Product Rich Snippet & Breadcrumbs
  updateProductSchemaJsonLd(product, categoryName);
  updateBreadcrumbSchemaJsonLd([
    { name: 'Trang Chủ', url: '/' },
    ...(categoryName ? [{ name: categoryName, url: `/products?category=${slugify(product.category || 'all')}` }] : []),
    { name: product.name, url: `/product/${productSlug}` }
  ]);
}

/**
 * Injects or updates Schema.org JSON-LD for Collection Pages
 */
export function updateCollectionSchemaJsonLd(collection: CollectionInfo, productsInCollection?: Product[]) {
  if (typeof document === 'undefined') return;
  let script = document.getElementById('nak-collection-schema-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'nak-collection-schema-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  const bannerImg = collection.bannerImage || collection.bgImage || collection.horizontalImage || collection.productPageBanner || '/assets/logo.jpg';
  const absoluteBanner = getAbsoluteImageUrl(bannerImg);
  const colSlug = getCollectionSlug(collection.id, collection.title);
  const colUrl = `${SITE_DOMAIN}/collection/${colSlug}`;

  const schemaData: any = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.title || 'Bộ Sưu Tập NOT A KNOT',
    description: cleanSeoText(collection.description || collection.subtitle || 'Bộ sưu tập phụ kiện thủ công handmade cao cấp từ NOT A KNOT.', 160),
    url: colUrl,
    image: absoluteBanner,
    isPartOf: {
      '@type': 'WebSite',
      name: 'NOT A KNOT',
      url: SITE_DOMAIN
    }
  };

  if (productsInCollection && productsInCollection.length > 0) {
    schemaData.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: productsInCollection.length,
      itemListElement: productsInCollection.slice(0, 20).map((prod, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `${SITE_DOMAIN}/product/${getProductSlug(prod)}`,
        name: prod.name,
        image: getAbsoluteImageUrl(prod.image)
      }))
    };
  }

  script.textContent = JSON.stringify(schemaData, null, 2);
}

export function removeCollectionSchemaJsonLd() {
  if (typeof document === 'undefined') return;
  const script = document.getElementById('nak-collection-schema-jsonld');
  if (script) {
    script.remove();
  }
}

/**
 * Apply full SEO metadata for a Collection Page
 */
export function setCollectionSEO(collection: CollectionInfo, productsInCollection?: Product[]) {
  if (!collection || typeof document === 'undefined') return;

  const colTitle = collection.title || 'Bộ Sưu Tập';
  const title = `${colTitle} - BST Phụ Kiện Handmade | NOT A KNOT`;
  const baseDesc = collection.description || collection.subtitle || 'Khám phá bộ sưu tập phụ kiện đan thủ công cao cấp.';
  const description = cleanSeoText(
    `${colTitle} tại NOT A KNOT: ${baseDesc} Thiết kế độc bản, dây đan bền bỉ, bảo hành trọn đời dây đan. Xem ngay!`,
    160
  );
  const keywords = [
    colTitle,
    `BST ${colTitle}`,
    `bộ sưu tập ${colTitle}`,
    'phụ kiện handmade',
    'vòng tay handmade',
    'quà tặng thủ công',
    'NOT A KNOT'
  ].join(', ');

  const bannerImg = collection.bannerImage || collection.bgImage || collection.horizontalImage || collection.productPageBanner || '/assets/logo.jpg';
  const imageUrl = getAbsoluteImageUrl(bannerImg);
  const colSlug = getCollectionSlug(collection.id, collection.title);
  const colUrl = `${SITE_DOMAIN}/collection/${colSlug}`;

  applyPageSEO({
    title,
    description,
    keywords,
    canonicalUrl: colUrl,
    ogType: 'website',
    ogImage: imageUrl
  });

  // Clean up product-specific tags
  removeMetaTag('property', 'product:price:amount');
  removeMetaTag('property', 'product:price:currency');
  removeMetaTag('property', 'product:availability');
  removeMetaTag('property', 'product:condition');
  removeMetaTag('property', 'product:brand');
  removeMetaTag('property', 'product:category');

  // Schema.org Collection & Breadcrumb Structured Data
  removeProductSchemaJsonLd();
  updateCollectionSchemaJsonLd(collection, productsInCollection);
  updateBreadcrumbSchemaJsonLd([
    { name: 'Trang Chủ', url: '/' },
    { name: 'Bộ Sưu Tập', url: '/#collections' },
    { name: colTitle, url: `/collection/${colSlug}` }
  ]);
}

/**
 * Apply SEO for Product Catalog
 */
export function setCatalogSEO(categoryName?: string, categoryId?: string) {
  const isSpecificCat = categoryName && categoryName !== 'Tất cả' && categoryId !== 'all';
  const title = isSpecificCat
    ? `${categoryName} - Phụ Kiện Handmade | NOT A KNOT`
    : 'Danh Mục Sản Phẩm Phụ Kiện Handmade | NOT A KNOT';

  const description = isSpecificCat
    ? `Khám phá các mẫu ${categoryName} đan thủ công bền đẹp tại NOT A KNOT. Miễn phí vận chuyển Hà Nội, bảo hành trọn đời.`
    : 'Toàn bộ danh mục vòng tay, móc khoá, charm đồng titan thủ công tinh xảo tại NOT A KNOT. Phù hợp học sinh, sinh viên, bảo hành trọn đời.';

  const canonicalUrl = isSpecificCat && categoryId
    ? `${SITE_DOMAIN}/?page=catalog&category=${encodeURIComponent(categoryId)}`
    : `${SITE_DOMAIN}/?page=catalog`;

  applyPageSEO({
    title,
    description,
    canonicalUrl,
    ogType: 'website'
  });

  removeProductSchemaJsonLd();
  removeCollectionSchemaJsonLd();
  updateBreadcrumbSchemaJsonLd([
    { name: 'Trang Chủ', url: '/' },
    { name: 'Danh Mục Sản Phẩm', url: '/?page=catalog' },
    ...(isSpecificCat ? [{ name: categoryName, url: `/?page=catalog&category=${categoryId}` }] : [])
  ]);
}

/**
 * Apply SEO for About Page
 */
export function setAboutSEO() {
  applyPageSEO({
    title: 'Về Chúng Tôi - Câu Chuyện Thương Hiệu | NOT A KNOT',
    description: 'Tìm hiểu hành trình sáng tạo của NOT A KNOT - Xưởng thủ công phụ kiện handmade tại Việt Nam. Tinh thần bền bỉ, từng nút thắt tỉ mỉ và đậm chất riêng.',
    canonicalUrl: `${SITE_DOMAIN}/?page=about`,
    ogType: 'article'
  });

  removeProductSchemaJsonLd();
  removeCollectionSchemaJsonLd();
  updateBreadcrumbSchemaJsonLd([
    { name: 'Trang Chủ', url: '/' },
    { name: 'Về Chúng Tôi', url: '/?page=about' }
  ]);
}

/**
 * Apply SEO for Contact Page
 */
export function setContactSEO() {
  applyPageSEO({
    title: 'Liên Hệ & Hỗ Trợ Khách Hàng | NOT A KNOT',
    description: 'Liên hệ xưởng thủ công NOT A KNOT để được tư vấn kích thước vòng tay, đặt mẫu custom theo yêu cầu hoặc hỗ trợ đơn hàng nhanh chóng qua Zalo, Messenger, Hotline.',
    canonicalUrl: `${SITE_DOMAIN}/?page=contact`,
    ogType: 'website'
  });

  removeProductSchemaJsonLd();
  removeCollectionSchemaJsonLd();
  updateBreadcrumbSchemaJsonLd([
    { name: 'Trang Chủ', url: '/' },
    { name: 'Liên Hệ', url: '/?page=contact' }
  ]);
}

/**
 * Apply SEO for Order Tracker Page
 */
export function setOrderTrackerSEO(orderCode?: string) {
  const title = orderCode
    ? `Tra Cứu Đơn Hàng #${orderCode} | NOT A KNOT`
    : 'Tra Cứu Trạng Thái Đơn Hàng | NOT A KNOT';

  const description = orderCode
    ? `Theo dõi tiến độ gia công, đóng gói và lộ trình giao hàng của đơn #${orderCode} tại NOT A KNOT.`
    : 'Tra cứu nhanh tiến độ sản xuất và hành trình giao hàng các sản phẩm phụ kiện handmade tại NOT A KNOT theo thời gian thực.';

  applyPageSEO({
    title,
    description,
    canonicalUrl: orderCode ? `${SITE_DOMAIN}/?page=tracker&code=${encodeURIComponent(orderCode)}` : `${SITE_DOMAIN}/?page=tracker`,
    ogType: 'website'
  });

  removeProductSchemaJsonLd();
  removeCollectionSchemaJsonLd();
  updateBreadcrumbSchemaJsonLd([
    { name: 'Trang Chủ', url: '/' },
    { name: 'Tra Cứu Đơn Hàng', url: '/?page=tracker' }
  ]);
}

/**
 * Apply SEO for Cart & Checkout Page
 */
export function setCartSEO() {
  applyPageSEO({
    title: 'Giỏ Hàng & Thanh Toán | NOT A KNOT',
    description: 'Xem lại giỏ hàng và đặt mua các phụ kiện handmade thủ công tại NOT A KNOT. Miễn phí vận chuyển nội thành Hà Nội, thanh toán an toàn, bảo hành trọn đời.',
    canonicalUrl: `${SITE_DOMAIN}/?page=cart`,
    ogType: 'website'
  });

  removeProductSchemaJsonLd();
  removeCollectionSchemaJsonLd();
  updateBreadcrumbSchemaJsonLd([
    { name: 'Trang Chủ', url: '/' },
    { name: 'Giỏ Hàng', url: '/?page=cart' }
  ]);
}

/**
 * Apply SEO for Admin Portal (noindex)
 */
export function setAdminSEO() {
  applyPageSEO({
    title: 'Quản Trị Hệ Thống | NOT A KNOT',
    description: 'Cổng quản trị nội bộ dành cho ban điều hành NOT A KNOT Studio.',
    canonicalUrl: `${SITE_DOMAIN}/?page=admin`,
    ogType: 'website',
    noindex: true
  });

  removeProductSchemaJsonLd();
  removeCollectionSchemaJsonLd();
  removeBreadcrumbSchemaJsonLd();
}

/**
 * Apply SEO for 404 Not Found Page (noindex, follow)
 */
export function setNotFoundSEO() {
  applyPageSEO({
    title: '404 - Không Tìm Thấy Trang | NOT A KNOT',
    description: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã được dời đi. Khám phá các mẫu vòng tay và phụ kiện thủ công tinh tế tại NOT A KNOT.',
    canonicalUrl: `${SITE_DOMAIN}/404`,
    ogType: 'website',
    ogImage: '/favicon.png',
    noindex: true
  });

  removeProductSchemaJsonLd();
  removeCollectionSchemaJsonLd();
  removeBreadcrumbSchemaJsonLd();
}

/**
 * Reset back to default site SEO (Homepage)
 */
export function resetDefaultSEO() {
  if (typeof document === 'undefined') return;

  applyPageSEO({
    title: DEFAULT_SEO.title,
    description: DEFAULT_SEO.description,
    keywords: DEFAULT_SEO.keywords,
    canonicalUrl: DEFAULT_SEO.url,
    ogType: 'website',
    ogImage: DEFAULT_SEO.image,
    noindex: false
  });

  removeMetaTag('property', 'product:price:amount');
  removeMetaTag('property', 'product:price:currency');
  removeMetaTag('property', 'product:availability');
  removeMetaTag('property', 'product:condition');
  removeMetaTag('property', 'product:brand');
  removeMetaTag('property', 'product:category');

  removeProductSchemaJsonLd();
  removeCollectionSchemaJsonLd();
  removeBreadcrumbSchemaJsonLd();
}

/**
 * React Hook for automatic SEO management on Product Pages
 */
export function useProductSEO(product: Product | null | undefined, categoryName?: string) {
  useEffect(() => {
    if (product) {
      setProductSEO(product, categoryName);
    }
    return () => {
      resetDefaultSEO();
    };
  }, [product?.id, product?.name, product?.description, product?.price, product?.image, categoryName]);
}

/**
 * React Hook for automatic SEO management on Collection Pages
 */
export function useCollectionSEO(collection: CollectionInfo | null | undefined, productsInCollection?: Product[]) {
  useEffect(() => {
    if (collection) {
      setCollectionSEO(collection, productsInCollection);
    }
    return () => {
      resetDefaultSEO();
    };
  }, [collection?.id, collection?.title, collection?.subtitle, collection?.description, collection?.bannerImage, collection?.bgImage, productsInCollection?.length]);
}
