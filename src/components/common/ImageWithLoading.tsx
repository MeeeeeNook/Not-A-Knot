import React, { useState, useEffect } from 'react';

interface ImageWithLoadingProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  containerClassName?: string;
  showSkeleton?: boolean;
}

export const ImageWithLoading: React.FC<ImageWithLoadingProps> = ({
  src,
  alt = 'Product image',
  className = '',
  containerClassName = '',
  fallbackSrc = '/assets/bracelet.jpg',
  showSkeleton = true,
  ...restProps
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reset states if src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const effectiveSrc = hasError ? (fallbackSrc || src) : src;

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* Skeleton Shimmer Loading Placeholder */}
      {showSkeleton && !isLoaded && (
        <div className="absolute inset-0 z-0 bg-neutral-200 animate-pulse flex items-center justify-center">
          <div className="w-full h-full bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
        </div>
      )}

      {/* Main Image with smooth fade-in */}
      <img
        src={effectiveSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (!hasError && fallbackSrc && fallbackSrc !== src) {
            setHasError(true);
          } else {
            setIsLoaded(true);
          }
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...restProps}
      />
    </div>
  );
};
