import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface CompareItem {
  id: string;
  title: string;
  image: string;
  subtitle?: string;
  priceDelta?: number;
  stock?: number;
  badge?: string;
  type: 'product' | 'charm' | 'omamori' | 'khoen';
  originalData?: any;
}

interface ProductImageCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CompareItem[];
  initialIndex?: number;
  title?: string;
  onSelectItem?: (item: CompareItem) => void;
  isItemSelected?: (item: CompareItem) => boolean;
}

export const ProductImageCompareModal: React.FC<ProductImageCompareModalProps> = ({
  isOpen,
  onClose,
  items,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Sync index on open & broadcast zoom state so chat widget and other floating elements hide
  useEffect(() => {
    if (isOpen) {
      const validIdx = Math.max(0, Math.min(initialIndex, items.length - 1));
      setCurrentIndex(validIdx);
      window.dispatchEvent(new CustomEvent('nak-image-zoom-opened'));
    } else {
      window.dispatchEvent(new CustomEvent('nak-image-zoom-closed'));
    }
    return () => {
      if (isOpen) {
        window.dispatchEvent(new CustomEvent('nak-image-zoom-closed'));
      }
    };
  }, [isOpen, initialIndex, items.length]);

  const handlePrev = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
  }, [items.length]);

  const handleNext = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
  }, [items.length]);

  // Keyboard navigation: Escape to close, Left/Right arrows to browse
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  // Swipe support for mobile
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const endX = e.changedTouches[0]?.clientX || touchStartRef.current.x;
    const endY = e.changedTouches[0]?.clientY || touchStartRef.current.y;
    const diffX = endX - touchStartRef.current.x;
    const diffY = endY - touchStartRef.current.y;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }
    touchStartRef.current = null;
  };

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];

  return (
    <AnimatePresence>
      <div
        id="image-preview-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-sm p-3 sm:p-6 select-none cursor-pointer"
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 z-50 p-2.5 bg-black/60 hover:bg-black/90 text-white rounded-full border border-white/20 transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
          aria-label="Đóng"
          title="Đóng (Esc)"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Previous Button */}
        {items.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-3 sm:left-6 z-40 p-2.5 sm:p-3.5 bg-black/50 hover:bg-black/80 text-white rounded-full border border-white/20 transition-all cursor-pointer shadow-xl hover:scale-110 active:scale-95"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}

        {/* Next Button */}
        {items.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-3 sm:right-6 z-40 p-2.5 sm:p-3.5 bg-black/50 hover:bg-black/80 text-white rounded-full border border-white/20 transition-all cursor-pointer shadow-xl hover:scale-110 active:scale-95"
            aria-label="Ảnh sau"
          >
            <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}

        {/* The Clean Full Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="relative max-w-full max-h-[92vh] flex items-center justify-center pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            key={currentItem.id || currentItem.image}
            src={currentItem.image}
            alt={currentItem.title || 'Xem ảnh lớn'}
            referrerPolicy="no-referrer"
            draggable={false}
            className="max-w-[92vw] max-h-[88vh] sm:max-w-[85vw] sm:max-h-[90vh] object-contain rounded-2xl shadow-2xl select-none"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80';
            }}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
