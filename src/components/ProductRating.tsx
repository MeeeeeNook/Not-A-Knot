import React from 'react';
import { Star } from 'lucide-react';

interface ProductRatingProps {
  rating?: number;
  reviewsCount?: number;
  productId?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showCount?: boolean;
  showNumericScore?: boolean;
  countLabel?: string; // e.g. 'đánh giá' or just '()'
  className?: string;
  isDarkTheme?: boolean;
}

/**
 * Returns genuine review count or 0. No fake metrics are fabricated.
 */
export function getStableReviewsCount(_productId?: string, defaultCount?: number): number {
  if (typeof defaultCount === 'number' && defaultCount > 0) return defaultCount;
  return 0;
}

export const ProductRating: React.FC<ProductRatingProps> = ({
  rating,
  reviewsCount,
  productId,
  size = 'xs',
  showCount = true,
  showNumericScore = true,
  countLabel,
  className = '',
  isDarkTheme = false
}) => {
  const count = getStableReviewsCount(productId, reviewsCount);

  // If no rating or no reviews, do not render fake metrics
  if (!rating || rating <= 0 || count <= 0) {
    return null;
  }

  const displayRating = rating;

  // Star size mapping
  const starDimensions = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }[size];

  const textSizes = {
    xs: 'text-[11px]',
    sm: 'text-xs',
    md: 'text-xs sm:text-sm',
    lg: 'text-sm sm:text-base'
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}
      title={`Đánh giá: ${displayRating.toFixed(1)}/5 sao (${count} lượt đánh giá)`}
    >
      {/* 5 Stars Rating Row */}
      <div className="flex items-center gap-0.5 text-amber-400">
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const isFull = displayRating >= starIndex;
          const isHalf = !isFull && displayRating >= starIndex - 0.5;

          return (
            <div key={starIndex} className="relative inline-flex items-center justify-center">
              {/* Empty background star */}
              <Star
                className={`${starDimensions} ${
                  isDarkTheme ? 'text-neutral-700' : 'text-neutral-200'
                }`}
                strokeWidth={1.5}
              />

              {/* Filled foreground star */}
              {(isFull || isHalf) && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: isFull ? '100%' : '50%' }}
                >
                  <Star
                    className={`${starDimensions} fill-amber-400 text-amber-400`}
                    strokeWidth={1.5}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Numeric Score */}
      {showNumericScore && (
        <span
          className={`font-bold font-mono ${textSizes} ${
            isDarkTheme ? 'text-amber-400' : 'text-neutral-900'
          }`}
        >
          {displayRating.toFixed(1)}
        </span>
      )}

      {/* Reviews Count */}
      {showCount && (
        <span
          className={`${textSizes} font-normal ${
            isDarkTheme ? 'text-neutral-400' : 'text-neutral-400'
          }`}
        >
          {countLabel ? `(${count} ${countLabel})` : `(${count})`}
        </span>
      )}
    </div>
  );
};
