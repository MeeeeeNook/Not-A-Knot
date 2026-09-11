import React from 'react';
import { ProductColorOption } from '../types';
import { Palette, Check } from 'lucide-react';

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

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-amber-600" />
          <label className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
            Màu sắc: <span className="text-amber-700 font-semibold">{selectedColor || 'Chưa chọn'}</span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {normalizedOptions.map((opt, idx) => {
          const isSelected =
            (selectedColor || '').trim().toLowerCase() === opt.name.trim().toLowerCase();

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectColor(opt)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isSelected
                  ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm ring-1 ring-neutral-950'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 hover:border-neutral-400'
              }`}
            >
              {/* Optional mini image thumbnail linked with this color */}
              {opt.image && opt.image.trim() ? (
                <img
                  src={opt.image}
                  alt={opt.name}
                  className={`w-5 h-5 rounded-lg object-cover border ${
                    isSelected ? 'border-white/50' : 'border-neutral-200'
                  }`}
                />
              ) : null}

              {/* Optional hex color dot */}
              {(!opt.image || !opt.image.trim()) && opt.colorCode && (
                <span
                  className="w-3.5 h-3.5 rounded-full border border-neutral-300 shadow-xs flex-shrink-0"
                  style={{ backgroundColor: opt.colorCode }}
                />
              )}

              <span>{opt.name}</span>

              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
