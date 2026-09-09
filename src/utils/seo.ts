import { useEffect } from 'react';
import { Product } from '../types';

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
function setMetaTag(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Helper to update or create a <link rel="canonical">
 */
function setCanonicalUrl(url: string) {
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
  // Remove markdown or html tags
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
  
  // Base raw description cleaned
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
    keywords.push(categoryName, `vòng tay ${categoryName}`);
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
  const script = document.getElementById('nak-product-schema-jsonld');
  if (script) {
    script.remove();
  }
}

/**
 * Apply full SEO metadata for a single product
 */
export function setProductSEO(product: Product, categoryName?: string) {
  if (!product) return;

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
  setMetaTag('property', 'og:type', 'product');
  setMetaTag('property', 'og:url', productUrl);

  // 4. Product Open Graph Extensions
  setMetaTag('property', 'product:price:amount', String(product.price));
  setMetaTag('property', 'product:price:currency', 'VND');
  setMetaTag('property', 'product:availability', product.inStock !== false ? 'in stock' : 'out of stock');

  // 5. Twitter Card
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);
  setMetaTag('name', 'twitter:image', imageUrl);

  // 6. Canonical URL
  setCanonicalUrl(productUrl);

  // 7. Schema.org Product Rich Snippet
  updateProductSchemaJsonLd(product, categoryName);
}

/**
 * Reset back to default site SEO
 */
export function resetDefaultSEO() {
  document.title = DEFAULT_SEO.title;

  setMetaTag('name', 'title', DEFAULT_SEO.title);
  setMetaTag('name', 'description', DEFAULT_SEO.description);
  setMetaTag('name', 'keywords', DEFAULT_SEO.keywords);

  setMetaTag('property', 'og:title', DEFAULT_SEO.title);
  setMetaTag('property', 'og:description', DEFAULT_SEO.description);
  setMetaTag('property', 'og:image', DEFAULT_SEO.image);
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:url', DEFAULT_SEO.url);

  // Remove product-specific OG tags
  const ogPrice = document.querySelector('meta[property="product:price:amount"]');
  if (ogPrice) ogPrice.remove();
  const ogCurrency = document.querySelector('meta[property="product:price:currency"]');
  if (ogCurrency) ogCurrency.remove();
  const ogAvail = document.querySelector('meta[property="product:availability"]');
  if (ogAvail) ogAvail.remove();

  setMetaTag('name', 'twitter:title', DEFAULT_SEO.title);
  setMetaTag('name', 'twitter:description', DEFAULT_SEO.description);
  setMetaTag('name', 'twitter:image', DEFAULT_SEO.image);

  setCanonicalUrl(DEFAULT_SEO.url);
  removeProductSchemaJsonLd();
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
  }, [product?.id, product?.name, product?.description, product?.price, categoryName]);
}
