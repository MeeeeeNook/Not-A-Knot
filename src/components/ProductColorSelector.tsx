import React from 'react';
import { ProductColorOption } from '../types';
import { Palette, Check, AlertCircle } from 'lucide-react';
import { resolveAssetUrl } from '../firebase';
import { LoadingImage } from './LoadingImage';

interface ProductColorSelectorProps {
  colors: (ProductColorOption | string)[];
  selectedColor?: string;
  onSelectColor: (colorOption: ProductColorOption) => void;
}

export const ProductColorSelector: React.FC<ProductColorSelectorProps> = ({
  colors,
  selectedColor,
  onSelectColor,
}) => {
  if (!colors || colors.length === 0) return null;

  // Normalize options to ProductColorOption format
  const normalizedOptions: ProductColorOption[] = colors.map((c) => {
    if (typeof c === 'string') {
      return { name: c };
    }
    return c;
  });

  const selectedOption = normalizedOptions.find(
    (c) => (selectedColor || '').trim().toLowerCase() === c.name.trim().toLowerCase()
  );

  // Preload color option images
  React.useEffect(() => {
    normalizedOptions.forEach((opt) => {
      if (opt.image) {
        const resolved = resolveAssetUrl(opt.image);
        if (resolved && resolved !== '/assets/bracelet.jpg') {
          const img = new Image();
          img.src = resolved;
        }
      }
    });
  }, [normalizedOptions]);

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Palette className="w-4 h-4 text-amber-600" />
          <label className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
            Màu sắc: <span className="text-amber-700 font-semibold">{selectedColor || 'Chưa chọn'}</span>
          </label>
          {selectedOption && typeof selectedOption.stock === 'number' && (
            selectedOption.stock > 0 ? (
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Còn {selectedOption.stock} chiếc
              </span>
            ) : (
              <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Tạm hết hàng
              </span>
            )
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {normalizedOptions.map((opt, idx) => {
          const isSelected =
            (selectedColor || '').trim().toLowerCase() === opt.name.trim().toLowerCase();
          const isOutOfStock = typeof opt.stock === 'number' && opt.stock <= 0;

          return (
            <button
              key={idx}
              type="button"
              disabled={isOutOfStock}
              onClick={() => {
                if (!isOutOfStock) {
                  onSelectColor(opt);
                }
              }}
              title={isOutOfStock ? `${opt.name} - Hiện đã hết hàng` : typeof opt.stock === 'number' ? `${opt.name} - Còn ${opt.stock} chiếc` : opt.name}
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all select-none ${
                isOutOfStock
                  ? 'border-neutral-200 bg-neutral-100 text-neutral-400 opacity-60 cursor-not-allowed line-through'
                  : isSelected
                  ? 'border-neutral-950 bg-neutral-950 text-white shadow-xs cursor-pointer'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 hover:border-neutral-300 cursor-pointer'
              }`}
            >
              {/* Optional mini image thumbnail linked with this color */}
              {opt.image && opt.image.trim() ? (
                <div className="relative w-5 h-5 rounded-lg overflow-hidden flex-shrink-0">
                  <LoadingImage
                    src={resolveAssetUrl(opt.image)}
                    alt={opt.name}
                    containerClassName="w-full h-full"
                    className={`w-full h-full object-cover border ${
                      isSelected ? 'border-white/50' : 'border-neutral-200'
                    }`}
                    spinnerSize="xs"
                    spinnerColor={isSelected ? 'white' : 'neutral'}
                    loading={idx < 8 ? 'eager' : 'lazy'}
                    fetchPriority={idx < 8 ? 'high' : 'low'}
                    decoding="async"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-neutral-900/50 flex items-center justify-center pointer-events-none">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
              ) : null}

              {/* Optional hex color dot */}
              {(!opt.image || !opt.image.trim()) && opt.colorCode && (
                <span
                  className="w-3.5 h-3.5 rounded-full border border-neutral-300 shadow-xs flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: opt.colorCode }}
                >
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />}
                </span>
              )}

              <span>{opt.name}</span>

              {/* Stock status indicator */}
              {isOutOfStock ? (
                <span className="ml-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 not-sr-only">
                  Hết
                </span>
              ) : typeof opt.stock === 'number' ? (
                <span
                  className={`text-[10px] font-mono ${
                    isSelected ? 'text-amber-300' : opt.stock <= 3 ? 'text-amber-600 font-bold' : 'text-neutral-400'
                  }`}
                >
                  ({opt.stock})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};
