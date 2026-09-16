import { useEffect } from 'react';
import { Product, CollectionInfo } from '../types';

export const DEFAULT_SEO = {
  title: 'Not a Knot | Handmade Accessories',
  description: 'NOT A KNOT - Thương hiệu phụ kiện dây dù Paracord thủ công cao cấp. Vòng tay nam nữ, móc khóa EDC, BST Hào Khí 02.09 chế tác thủ công tại Việt Nam.',
  keywords: 'NOT A KNOT, vòng tay paracord, vòng tay handmade, phụ kiện paracord, dây dù 550, vòng tay 02/09, vòng tay hào khí, vòng tay nam handmade, quà tặng thủ công, móc khóa paracord, paracord vietnam, vòng đôi handmade',
  image: '/assets/logo.jpg',
  type: 'website',
  url: 'https://notaknot.vn'
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
 * Helper to update or create a <link rel="canonical">
 */
export function setCanonicalUrl(url: string) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
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
 * Generate a high-conversion SEO title for a product
 */
export function generateProductMetaTitle(product: Product, categoryName?: string): string {
  const formattedPrice = new Intl.NumberFormat('vi-VN').format(product.price);
  if (categoryName) {
    return `${product.name} - ${categoryName} (${formattedPrice}đ) | NOT A KNOT`;
  }
  return `${product.name} - Vòng Tay Paracord Thủ Công (${formattedPrice}đ) | NOT A KNOT`;
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
  const fullDesc = `Đặt mua ngay ${product.name}${categorySnippet} tại NOT A KNOT. ${rawDesc} Dây dù Paracord 550 chịu lực, chế tác thủ công tinh xảo, giá chỉ ${formattedPrice}đ. Giao hàng toàn quốc.`;

  return cleanSeoText(fullDesc, 160);
}

/**
 * Generate relevant SEO keywords for a product
 */
export function generateProductKeywords(product: Product, categoryName?: string): string {
  const keywords = [
    product.name,
    `vòng tay ${product.name}`,
    `${product.name} paracord`,
    'vòng tay paracord',
    'phụ kiện paracord handmade',
    'dây dù 550 7 lõi',
    'quà tặng thủ công',
    'NOT A KNOT'
  ];

  if (categoryName) {
    keywords.push(categoryName, `vòng tay ${categoryName}`, `phụ kiện ${categoryName}`);
  }

  if (product.availableColors && product.availableColors.length > 0) {
    product.availableColors.slice(0, 3).forEach((c) => {
      keywords.push(`vòng paracord màu ${c.toLowerCase()}`);
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
  const absoluteImages = images.map((img) =>
    img.startsWith('http') ? img : `${window.location.origin}${img.startsWith('/') ? '' : '/'}${img}`
  );

  const productUrl = `${window.location.origin}${window.location.pathname}#product/${product.id}`;

  const schemaData = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    image: absoluteImages,
    description: generateProductMetaDescription(product, categoryName),
    sku: product.id || `NAK-${product.name.replace(/\s+/g, '-').toLowerCase()}`,
    mpn: product.id,
    brand: {
      '@type': 'Brand',
      name: 'NOT A KNOT'
    },
    category: categoryName || product.category,
    material: 'Dây dù Paracord 550 Type III 7 lõi tiêu chuẩn quân đội, Charm hợp kim/đồng/titan',
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
      }
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: product.rating || 5.0,
      reviewCount: product.reviewsCount || 15,
      bestRating: '5',
      worstRating: '1'
    }
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
      item: item.url.startsWith('http') ? item.url : `${window.location.origin}${item.url.startsWith('/') ? '' : '/'}${item.url}`
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
  const imageUrl = product.image.startsWith('http')
    ? product.image
    : `${window.location.origin}${product.image.startsWith('/') ? '' : '/'}${product.image}`;
  const productUrl = `${window.location.origin}${window.location.pathname}#product/${product.id}`;

  // 1. Browser tab title
  document.title = title;

  // 2. Standard Meta Tags
  setMetaTag('name', 'title', title);
  setMetaTag('name', 'description', description);
  setMetaTag('name', 'keywords', keywords);

  // 3. Open Graph (Facebook, Zalo, LinkedIn)
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:image', imageUrl);
  setMetaTag('property', 'og:image:secure_url', imageUrl);
  setMetaTag('property', 'og:image:alt', product.name);
  setMetaTag('property', 'og:type', 'product');
  setMetaTag('property', 'og:url', productUrl);

  // 4. Product Open Graph Extensions
  setMetaTag('property', 'product:brand', 'NOT A KNOT');
  setMetaTag('property', 'product:price:amount', String(product.price));
  setMetaTag('property', 'product:price:currency', 'VND');
  setMetaTag('property', 'product:availability', product.inStock !== false ? 'in stock' : 'out of stock');
  setMetaTag('property', 'product:condition', 'new');
  if (categoryName) {
    setMetaTag('property', 'product:category', categoryName);
  }

  // 5. Twitter Card
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);
  setMetaTag('name', 'twitter:image', imageUrl);
  setMetaTag('name', 'twitter:image:alt', product.name);

  // 6. Canonical URL
  setCanonicalUrl(productUrl);

  // 7. Schema.org Product Rich Snippet & Breadcrumbs
  updateProductSchemaJsonLd(product, categoryName);
  updateBreadcrumbSchemaJsonLd([
    { name: 'Trang Chủ', url: '/' },
    ...(categoryName ? [{ name: categoryName, url: `/#category/${product.category || 'all'}` }] : []),
    { name: product.name, url: `/#product/${product.id}` }
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
  const absoluteBanner = bannerImg.startsWith('http')
    ? bannerImg
    : `${window.location.origin}${bannerImg.startsWith('/') ? '' : '/'}${bannerImg}`;
  const colUrl = `${window.location.origin}${window.location.pathname}#collection/${collection.id}`;

  const schemaData: any = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.title || 'Bộ Sưu Tập NOT A KNOT',
    description: cleanSeoText(collection.description || collection.subtitle || 'Bộ sưu tập phụ kiện thủ công Paracord cao cấp từ NOT A KNOT.', 160),
    url: colUrl,
    image: absoluteBanner,
    isPartOf: {
      '@type': 'WebSite',
      name: 'NOT A KNOT',
      url: window.location.origin
    }
  };

  if (productsInCollection && productsInCollection.length > 0) {
    schemaData.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: productsInCollection.length,
      itemListElement: productsInCollection.slice(0, 20).map((prod, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `${window.location.origin}${window.location.pathname}#product/${prod.id}`,
        name: prod.name,
        image: prod.image.startsWith('http') ? prod.image : `${window.location.origin}${prod.image.startsWith('/') ? '' : '/'}${prod.image}`
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
  const title = `${colTitle} - Bộ Sưu Tập Phụ Kiện Paracord Handmade | NOT A KNOT`;
  const baseDesc = collection.description || collection.subtitle || 'Khám phá bộ sưu tập phụ kiện đan thủ công từ dây dù Paracord 550 cao cấp.';
  const description = cleanSeoText(
    `${colTitle} tại NOT A KNOT: ${baseDesc} Thiết kế độc bản, dây dù quân đội 550 bền bỉ, bảo hành trọn đời dây đan. Xem ngay!`,
    160
  );
  const keywords = [
    colTitle,
    `BST ${colTitle}`,
    `bộ sưu tập ${colTitle}`,
    'phụ kiện paracord',
    'vòng tay handmade',
    'dây dù paracord 550',
    'quà tặng thủ công',
    'NOT A KNOT'
  ].join(', ');

  const bannerImg = collection.bannerImage || collection.bgImage || collection.horizontalImage || collection.productPageBanner || '/assets/logo.jpg';
  const imageUrl = bannerImg.startsWith('http')
    ? bannerImg
    : `${window.location.origin}${bannerImg.startsWith('/') ? '' : '/'}${bannerImg}`;
  const colUrl = `${window.location.origin}${window.location.pathname}#collection/${collection.id}`;

  // 1. Title
  document.title = title;

  // 2. Meta Tags
  setMetaTag('name', 'title', title);
  setMetaTag('name', 'description', description);
  setMetaTag('name', 'keywords', keywords);

  // 3. Open Graph
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:image', imageUrl);
  setMetaTag('property', 'og:image:secure_url', imageUrl);
  setMetaTag('property', 'og:image:alt', colTitle);
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:url', colUrl);

  // Remove product price tags if previously active
  removeMetaTag('property', 'product:price:amount');
  removeMetaTag('property', 'product:price:currency');
  removeMetaTag('property', 'product:availability');
  removeMetaTag('property', 'product:condition');
  removeMetaTag('property', 'product:brand');
  removeMetaTag('property', 'product:category');

  // 4. Twitter Card
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);
  setMetaTag('name', 'twitter:image', imageUrl);
  setMetaTag('name', 'twitter:image:alt', colTitle);

  // 5. Canonical URL
  setCanonicalUrl(colUrl);

  // 6. Schema.org Collection & Breadcrumb Structured Data
  removeProductSchemaJsonLd();
  updateCollectionSchemaJsonLd(collection, productsInCollection);
  updateBreadcrumbSchemaJsonLd([
    { name: 'Trang Chủ', url: '/' },
    { name: 'Bộ Sưu Tập', url: '/#collections' },
    { name: colTitle, url: `/#collection/${collection.id}` }
  ]);
}

/**
 * Reset back to default site SEO
 */
export function resetDefaultSEO() {
  if (typeof document === 'undefined') return;
  document.title = DEFAULT_SEO.title;

  setMetaTag('name', 'title', DEFAULT_SEO.title);
  setMetaTag('name', 'description', DEFAULT_SEO.description);
  setMetaTag('name', 'keywords', DEFAULT_SEO.keywords);

  setMetaTag('property', 'og:title', DEFAULT_SEO.title);
  setMetaTag('property', 'og:description', DEFAULT_SEO.description);
  setMetaTag('property', 'og:image', DEFAULT_SEO.image);
  setMetaTag('property', 'og:image:secure_url', `${window.location.origin}${DEFAULT_SEO.image}`);
  setMetaTag('property', 'og:image:alt', 'NOT A KNOT Handmade Studio');
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:url', DEFAULT_SEO.url);

  // Remove product-specific OG tags
  removeMetaTag('property', 'product:price:amount');
  removeMetaTag('property', 'product:price:currency');
  removeMetaTag('property', 'product:availability');
  removeMetaTag('property', 'product:condition');
  removeMetaTag('property', 'product:brand');
  removeMetaTag('property', 'product:category');

  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', DEFAULT_SEO.title);
  setMetaTag('name', 'twitter:description', DEFAULT_SEO.description);
  setMetaTag('name', 'twitter:image', DEFAULT_SEO.image);
  setMetaTag('name', 'twitter:image:alt', 'NOT A KNOT Handmade Studio');

  setCanonicalUrl(DEFAULT_SEO.url);
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
