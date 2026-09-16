import React, { useState, useEffect, useRef, useMemo } from 'react';
import { generateSrcSet, getOptimizedImageUrl, IMAGE_SIZES_PRESETS } from '../utils/imageUtils';

export interface LazyProductImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  srcSet?: string;
  sizes?: string;
  responsiveWidths?: number[];
  className?: string;
  wrapperClassName?: string;
  fallbackSrc?: string;
  priority?: boolean;
  rootMargin?: string;
  threshold?: number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  aspectRatioClassName?: string;
  showSkeleton?: boolean;
}

/**
 * LazyProductImage provides smooth, performance-optimized responsive image loading
 * for product images across lists, collections, and landing grids.
 * - Generates responsive srcset and sizes for optimal device width matching
 * - Defers loading until image approaches viewport via IntersectionObserver
 * - Native loading="lazy", decoding="async", fetchpriority="high"/"low"
 * - Displays a sleek placeholder skeleton shimmer to prevent Cumulative Layout Shift (CLS)
 * - Smooth fade-in once loaded with error fallback handling
 */
export const LazyProductImage: React.FC<LazyProductImageProps> = ({
  src,
  alt,
  srcSet,
  sizes,
  responsiveWidths = [200, 360, 480, 640, 800, 1080],
  className = '',
  wrapperClassName = '',
  fallbackSrc = '/assets/bracelet.jpg',
  priority = false,
  rootMargin = '400px 0px',
  threshold = 0.01,
  objectFit = 'cover',
  aspectRatioClassName = '',
  showSkeleton = true,
  onLoad,
  onError,
  style,
  ...props
}) => {
  const [isInView, setIsInView] = useState<boolean>(priority);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Compute optimized single src and responsive srcset
  const validSrc = useMemo(() => {
    if (typeof src === 'string' && src.trim().length > 0) return src.trim();
    return fallbackSrc;
  }, [src, fallbackSrc]);

  const activeSrc = hasError ? fallbackSrc : validSrc;

  const computedSrcSet = useMemo(() => {
    if (srcSet) return srcSet;
    if (hasError) return undefined;
    return generateSrcSet(validSrc, responsiveWidths);
  }, [srcSet, hasError, validSrc, responsiveWidths]);

  const computedSizes = useMemo(() => {
    if (sizes) return sizes;
    return IMAGE_SIZES_PRESETS.productCard;
  }, [sizes]);

  useEffect(() => {
    if (priority || isInView) return;

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    const currentEl = wrapperRef.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      observer.disconnect();
    };
  }, [priority, isInView, rootMargin, threshold]);

  // Check cached or complete state immediately when src or activeSrc changes
  useEffect(() => {
    setHasError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [activeSrc]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (onLoad) onLoad(e);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError) {
      setHasError(true);
    }
    setIsLoaded(true);
    if (onError) onError(e);
  };

  const objectFitClass = objectFit === 'contain' ? 'object-contain' : objectFit === 'fill' ? 'object-fill' : 'object-cover';

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden bg-neutral-100 ${aspectRatioClassName} ${wrapperClassName}`}
    >
      {/* Skeleton Shimmer / Placeholder while loading */}
      {showSkeleton && !isLoaded && (
        <div
          className="absolute inset-0 bg-neutral-200 animate-pulse flex items-center justify-center pointer-events-none z-0 overflow-hidden"
          aria-hidden="true"
        >
          <div className="w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.4s_infinite]" />
        </div>
      )}

      {/* Actual Image rendered only when in view */}
      {isInView && activeSrc && (
        <img
          ref={(node) => {
            imgRef.current = node;
            if (node && node.complete && node.naturalWidth > 0 && !isLoaded) {
              setIsLoaded(true);
            }
          }}
          src={activeSrc}
          srcSet={computedSrcSet}
          sizes={computedSizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          {...({ fetchpriority: priority ? 'high' : 'low' } as any)}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`w-full h-full ${objectFitClass} transition-opacity duration-300 ease-out ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          style={{ imageRendering: '-webkit-optimize-contrast', ...style }}
          {...props}
        />
      )}
    </div>
  );
};
