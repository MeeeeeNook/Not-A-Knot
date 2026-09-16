/**
 * Utility functions for responsive image optimization, srcset generation, and sizes presets.
 * Optimizes image delivery for Unsplash, CDN assets, and local/firebase sources.
 */

/**
 * Transforms an image URL to include width, quality, and auto-format query parameters
 * when supported (e.g., Unsplash, Cloudinary, Imgix).
 */
export const getOptimizedImageUrl = (
  src?: string,
  width?: number,
  quality: number = 80
): string => {
  if (!src || typeof src !== 'string') return '/assets/bracelet.jpg';
  const trimmed = src.trim();
  if (!trimmed) return '/assets/bracelet.jpg';

  // Base64 data URLs or local SVG / assets without query parameter support
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.endsWith('.svg')) {
    return trimmed;
  }

  // Handle Unsplash image URLs
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const url = new URL(trimmed);
      if (width) url.searchParams.set('w', String(width));
      url.searchParams.set('q', String(quality));
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      return url.toString();
    } catch {
      // Fallback string replacement if URL constructor fails
      let out = trimmed;
      if (width) {
        if (out.includes('w=')) out = out.replace(/w=\d+/, `w=${width}`);
        else out += (out.includes('?') ? '&' : '?') + `w=${width}`;
      }
      return out;
    }
  }

  // Handle Cloudinary or Imgix URLs if present
  if (trimmed.includes('res.cloudinary.com')) {
    if (width && !trimmed.includes('/w_')) {
      return trimmed.replace('/upload/', `/upload/w_${width},q_${quality},f_auto/`);
    }
  }

  return trimmed;
};

/**
 * Generates a responsive `srcset` attribute string for a given image source.
 * Returns `undefined` if the source is a local file, base64 string, or unresizable URL.
 */
export const generateSrcSet = (
  src?: string,
  widths: number[] = [200, 360, 480, 640, 800, 1080]
): string | undefined => {
  if (!src || typeof src !== 'string') return undefined;
  const trimmed = src.trim();

  // Return undefined for base64 data URLs or local static assets that cannot be server-resized
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.endsWith('.svg') ||
    (!trimmed.includes('http://') && !trimmed.includes('https://'))
  ) {
    return undefined;
  }

  // Generate srcset for remote transformable images
  if (trimmed.includes('images.unsplash.com') || trimmed.includes('res.cloudinary.com')) {
    const srcsetEntries = widths.map((w) => {
      const optUrl = getOptimizedImageUrl(trimmed, w);
      return `${optUrl} ${w}w`;
    });
    return srcsetEntries.join(', ');
  }

  return undefined;
};

/**
 * Standardized responsive `sizes` attribute presets for consistent viewport rendering.
 */
export const IMAGE_SIZES_PRESETS = {
  /** Grid product cards (2 cols on mobile, 3 cols on tablet, 4 cols on desktop) */
  productCard: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',

  /** Full-width collection banners */
  collectionBanner: '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px',

  /** Landing page horizontal carousel items */
  landingCarousel: '(max-width: 640px) 160px, (max-width: 768px) 220px, 270px',

  /** Landing page grid items */
  landingGrid: '(max-width: 640px) 50vw, (max-width: 768px) 220px, 260px',

  /** Product detail modal & single product view */
  productDetail: '(max-width: 768px) 100vw, 50vw',

  /** Small option thumbnails */
  thumbnail: '(max-width: 640px) 60px, 100px'
} as const;
