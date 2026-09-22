/**
 * CDN Configuration and Asset Delivery Helper
 * Provides seamless integration with CDN providers (Cloudflare, Fastly, AWS CloudFront, BunnyCDN)
 * and automatic fallback to origin or local assets.
 */

export interface CDNConfig {
  enabled: boolean;
  baseUrl: string;
  imageOptimizationUrl?: string;
  defaultTtlSeconds: number;
}

// Check for user-configured CDN endpoint via environment or default to origin-relative delivery
const metaEnv = (import.meta as any).env || {};
const CDN_URL = (metaEnv.VITE_CDN_URL as string || '').replace(/\/+$/, '');
const CDN_IMAGE_SERVICE = (metaEnv.VITE_CDN_IMAGE_SERVICE as string || '').replace(/\/+$/, '');

export const cdnConfig: CDNConfig = {
  enabled: !!CDN_URL,
  baseUrl: CDN_URL,
  imageOptimizationUrl: CDN_IMAGE_SERVICE,
  defaultTtlSeconds: 31536000 // 1 year for immutable static assets
};

/**
 * Resolves a static asset path to a CDN-hosted URL if CDN is configured,
 * otherwise returns the normalized local/origin path.
 * 
 * @param path Relative path to asset (e.g. '/assets/bracelet.jpg' or 'assets/logo.png')
 */
export function getCDNAssetUrl(path: string): string {
  if (!path) return '';
  const cleanPath = path.trim();

  // If already absolute or data URL, do not modify
  if (
    cleanPath.startsWith('http://') ||
    cleanPath.startsWith('https://') ||
    cleanPath.startsWith('data:') ||
    cleanPath.startsWith('blob:')
  ) {
    return cleanPath;
  }

  // Ensure leading slash
  const normalized = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;

  if (cdnConfig.enabled && cdnConfig.baseUrl) {
    return `${cdnConfig.baseUrl}${normalized}`;
  }

  return normalized;
}

/**
 * Transforms an image URL to be served through an image CDN proxy or edge resizer
 * with quality, width, and modern format conversions (WebP/AVIF).
 */
export function getCDNImageUrl(url: string, width?: number, quality: number = 85): string {
  if (!url) return '';
  const cleanUrl = url.trim();

  if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:')) {
    return cleanUrl;
  }

  // If custom image proxy CDN is specified (e.g. Cloudflare Images or Cloudinary)
  if (cdnConfig.imageOptimizationUrl) {
    const encoded = encodeURIComponent(getCDNAssetUrl(cleanUrl));
    const w = width ? `&w=${width}` : '';
    return `${cdnConfig.imageOptimizationUrl}?url=${encoded}&q=${quality}${w}&format=auto`;
  }

  return getCDNAssetUrl(cleanUrl);
}
