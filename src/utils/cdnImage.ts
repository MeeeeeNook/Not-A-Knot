/**
 * Cloud CDN & High-Performance Edge Media Acceleration Utility
 * Handles optimized image delivery, responsive srcsets, caching headers, and fallbacks.
 */

export interface CdnImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'auto' | 'png' | 'jpg';
  fit?: 'cover' | 'contain' | 'crop' | 'fill';
}

/**
 * Transforms an image source into an ultra-fast Cloud CDN / Edge cached URL
 */
export function getOptimizedCdnUrl(url: string | undefined | null, options: CdnImageOptions = {}): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return '/assets/logo.png';
  }

  const cleanUrl = url.trim();

  // Local assets or relative paths - serve directly
  if (cleanUrl.startsWith('/') || cleanUrl.startsWith('./')) {
    return cleanUrl;
  }

  // Base64 data URLs - return as-is
  if (cleanUrl.startsWith('data:')) {
    return cleanUrl;
  }

  try {
    const parsed = new URL(cleanUrl);

    // 1. Unsplash CDN Optimization
    if (parsed.hostname.includes('unsplash.com')) {
      const q = options.quality ?? 80;
      const w = options.width ? `&w=${options.width}` : '';
      const h = options.height ? `&h=${options.height}` : '';
      const fit = options.fit === 'crop' || options.fit === 'cover' ? '&fit=crop' : '';
      const format = options.format === 'webp' ? '&fm=webp' : '&auto=format';
      return `${cleanUrl.split('?')[0]}?q=${q}${w}${h}${fit}${format}`;
    }

    // 2. Google Cloud Storage & Firebase Storage CDN
    if (parsed.hostname.includes('firebasestorage.googleapis.com') || parsed.hostname.includes('storage.googleapis.com')) {
      // Ensure HTTPS and preserve download token
      parsed.protocol = 'https:';
      return parsed.toString();
    }

    // 3. Google User Content CDN (Avatars, Drive, Photos)
    if (parsed.hostname.includes('googleusercontent.com')) {
      if (options.width) {
        // Append size parameter (e.g. =s400 or =w400-h400-c)
        return cleanUrl.replace(/=s\d+.*$/, '') + `=w${options.width}-h${options.height || options.width}-c`;
      }
      return cleanUrl;
    }

    return cleanUrl;
  } catch {
    return cleanUrl;
  }
}

/**
 * Generates a responsive srcset string for high-DPI displays (retina) and mobile viewports
 */
export function getResponsiveSrcSet(url: string | undefined | null, widths: number[] = [360, 640, 1080, 1440]): string {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:') || url.startsWith('/assets/')) return '';

  return widths
    .map((w) => `${getOptimizedCdnUrl(url, { width: w })} ${w}w`)
    .join(', ');
}

/**
 * Returns standard Cache-Control headers for Cloud CDN & Edge proxies
 */
export const CDN_CACHE_HEADERS = {
  STATIC_ASSETS: 'public, max-age=31536000, immutable',
  MEDIA_IMAGES: 'public, max-age=2592000, stale-while-revalidate=86400',
  DYNAMIC_API: 'public, max-age=0, s-maxage=60, stale-while-revalidate=120'
};
