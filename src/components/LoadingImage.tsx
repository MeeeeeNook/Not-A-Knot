import React, { useState, useEffect, useRef } from 'react';

export interface LoadingImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
  containerClassName?: string;
  className?: string;
  spinnerSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  spinnerColor?: 'amber' | 'slate' | 'white' | 'rose' | 'neutral';
  showLoadingCircle?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none';
}

const SPINNER_SIZES = {
  xs: 'w-3 h-3 border-[1.5px]',
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-7 h-7 border-[2.5px]',
  xl: 'w-9 h-9 border-3',
};

const SPINNER_COLORS = {
  amber: 'border-amber-200 border-t-amber-600',
  slate: 'border-slate-200 border-t-slate-700',
  white: 'border-white/30 border-t-white',
  rose: 'border-rose-200 border-t-rose-600',
  neutral: 'border-neutral-200 border-t-neutral-800',
};

/**
 * Hardwired, zero-lag LoadingImage with instant GPU-accelerated loading circle.
 * Displays a lightweight CSS spinner immediately while an image downloads,
 * and smoothly transitions the loaded image into view with zero layout shift.
 */
export const LoadingImage: React.FC<LoadingImageProps> = ({
  src,
  alt,
  fallbackSrc = '/assets/bracelet.jpg',
  containerClassName = '',
  className = '',
  spinnerSize = 'sm',
  spinnerColor = 'amber',
  showLoadingCircle = true,
  objectFit = 'contain',
  onLoad,
  onError,
  loading = 'lazy',
  decoding = 'async',
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Normalize src
  const activeSrc = !src || src.trim().length === 0 ? fallbackSrc : src.trim();
  const currentSrc = hasError ? fallbackSrc : activeSrc;

  // Whenever source URL changes, reset state and check if cached in memory
  useEffect(() => {
    setHasError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [currentSrc]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (onLoad) onLoad(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError) {
      setHasError(true);
    }
    setIsLoaded(true);
    if (onError) onError(e);
  };

  const spinnerClass = `${SPINNER_SIZES[spinnerSize] || SPINNER_SIZES.sm} ${
    SPINNER_COLORS[spinnerColor] || SPINNER_COLORS.amber
  }`;

  const fitClass =
    objectFit === 'contain'
      ? 'object-contain'
      : objectFit === 'cover'
      ? 'object-cover'
      : objectFit === 'fill'
      ? 'object-fill'
      : '';

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${containerClassName}`}>
      {/* Zero-Lag Hardware-Accelerated CSS Loading Circle */}
      {showLoadingCircle && !isLoaded && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-slate-50/70 z-0 pointer-events-none select-none transition-opacity duration-150"
          aria-hidden="true"
        >
          <div
            className={`rounded-full animate-spin shrink-0 ${spinnerClass}`}
            style={{ willChange: 'transform' }}
          />
        </div>
      )}

      {/* Target Image */}
      <img
        ref={(node) => {
          imgRef.current = node;
          // Synchronous check if browser already cached the image
          if (node && node.complete && node.naturalWidth > 0 && !isLoaded) {
            setIsLoaded(true);
          }
        }}
        src={currentSrc}
        alt={alt}
        loading={loading}
        decoding={decoding}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full ${fitClass} transition-opacity duration-200 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...props}
      />
    </div>
  );
};
export default LoadingImage;
