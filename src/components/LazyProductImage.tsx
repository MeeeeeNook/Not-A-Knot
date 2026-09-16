import React, { useState, useEffect, useRef } from 'react';

export interface LazyProductImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  fallbackSrc?: string;
  priority?: boolean;
  rootMargin?: string;
  threshold?: number;
}

/**
 * LazyProductImage provides smooth, performance-optimized lazy loading
 * for product images across lists, collections, and grids.
 * - Defers loading until image approaches viewport (IntersectionObserver)
 * - Uses native loading="lazy" and decoding="async"
 * - Displays a sleek placeholder skeleton to prevent cumulative layout shift (CLS)
 * - Fades in smoothly once loaded with error fallback handling
 */
export const LazyProductImage: React.FC<LazyProductImageProps> = ({
  src,
  alt,
  className = '',
  wrapperClassName = '',
  fallbackSrc = '/assets/hero-bg.png',
  priority = false,
  rootMargin = '600px 0px',
  threshold = 0.01,
  ...props
}) => {
  const [isInView, setIsInView] = useState<boolean>(priority);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (priority || isInView) return;

    // If IntersectionObserver is not supported, load immediately
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
      {
        rootMargin,
        threshold
      }
    );

    const currentEl = wrapperRef.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      observer.disconnect();
    };
  }, [priority, isInView, rootMargin, threshold]);

  // Reset or instantly resolve if cached
  useEffect(() => {
    setHasError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [src]);

  const validSrc = typeof src === 'string' && src.trim().length > 0 ? src : fallbackSrc;
  const activeSrc = hasError ? fallbackSrc : validSrc;

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden ${wrapperClassName}`}
    >
      {/* Skeleton Shimmer / Placeholder while loading */}
      {!isLoaded && (
        <div
          className="absolute inset-0 bg-neutral-200/60 animate-pulse flex items-center justify-center pointer-events-none z-0"
          aria-hidden="true"
        >
          <div className="w-6 h-6 rounded-full border-2 border-neutral-300 border-t-neutral-500 animate-spin opacity-40" />
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
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            if (!hasError) {
              setHasError(true);
            }
            setIsLoaded(true);
          }}
          className={`transition-opacity duration-200 ease-out ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          {...props}
        />
      )}
    </div>
  );
};
