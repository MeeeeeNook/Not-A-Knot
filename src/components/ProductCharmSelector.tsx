import React from 'react';
import { ProductCharmOption } from '../types';
import { Check, Sparkles, X } from 'lucide-react';

interface ProductCharmSelectorProps {
  charms: ProductCharmOption[];
  selectedCharm?: string;
  onSelectCharm: (charm: ProductCharmOption | null) => void;
  isRequired?: boolean;
}

export const ProductCharmSelector: React.FC<ProductCharmSelectorProps> = ({
  charms,
  selectedCharm,
  onSelectCharm,
  isRequired = false,
}) => {
  if (!charms || charms.length === 0) return null;

  const currentSelection = charms.find(
    (c) => c.name.trim().toLowerCase() === (selectedCharm || '').trim().toLowerCase()
  );

  return (
    <div className="space-y-2.5 pt-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <label className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
            Chọn loại charm {isRequired && <span className="text-rose-500">*</span>}:
          </label>
        </div>

        {selectedCharm && !isRequired && (
          <button
            type="button"
            onClick={() => onSelectCharm(null)}
            className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Bỏ chọn charm</span>
          </button>
        )}
      </div>

      {currentSelection && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-amber-800 bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200 font-medium">
          <span>Đã chọn: <strong className="text-amber-950 font-bold">{currentSelection.name}</strong></span>
          {currentSelection.priceDelta && currentSelection.priceDelta > 0 ? (
            <span className="text-emerald-700 font-bold">
              (+{currentSelection.priceDelta.toLocaleString('vi-VN')}đ)
            </span>
          ) : null}
          {typeof currentSelection.stock === 'number' && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
              currentSelection.stock <= 0 
                ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                : currentSelection.stock <= 5
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}>
              {currentSelection.stock <= 0 ? '⚠️ Đã hết hàng' : `📦 Còn ${currentSelection.stock} cái trong kho`}
            </span>
          )}
        </div>
      )}

      {/* Grid of charm cards matching the user's reference photo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {charms.map((charm, idx) => {
          const isSelected =
            (selectedCharm || '').trim().toLowerCase() === charm.name.trim().toLowerCase();
          const isOutOfStock = typeof charm.stock === 'number' && charm.stock <= 0;
          const isLowStock = typeof charm.stock === 'number' && charm.stock > 0 && charm.stock <= 5;

          return (
            <button
              key={charm.id || idx}
              type="button"
              disabled={isOutOfStock}
              onClick={() => {
                if (isOutOfStock) return;
                if (isSelected && !isRequired) {
                  onSelectCharm(null);
                } else {
                  onSelectCharm(charm);
                }
              }}
              className={`relative rounded-2xl p-2 text-left border-2 transition-all duration-200 flex flex-col items-center justify-between ${
                isOutOfStock
                  ? 'opacity-60 grayscale-[35%] bg-slate-50 border-slate-200 cursor-not-allowed select-none'
                  : isSelected
                  ? 'border-amber-600 bg-amber-50/90 shadow-md ring-2 ring-amber-400/40 cursor-pointer group'
                  : 'border-neutral-200 hover:border-amber-300 bg-white hover:bg-amber-50/30 cursor-pointer group'
              }`}
            >
              {/* Active checkmark badge */}
              {isSelected && !isOutOfStock && (
                <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-sm">
                  <Check className="w-3 h-3" strokeWidth={3} />
                </div>
              )}

              {/* Charm Image */}
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-50 mb-2 border border-neutral-100 flex items-center justify-center relative">
                <img
                  src={charm.image}
                  alt={charm.name}
                  className={`w-full h-full object-contain p-1 transition-transform duration-200 ${
                    isOutOfStock ? '' : 'group-hover:scale-105'
                  }`}
                  loading="lazy"
                />

                {/* Extra price badge */}
                {charm.priceDelta && charm.priceDelta > 0 ? (
                  <span className="absolute bottom-1 right-1 text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                    +{charm.priceDelta.toLocaleString('vi-VN')}đ
                  </span>
                ) : null}

                {/* Out of stock overlay */}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-1">
                    <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm uppercase tracking-wide">
                      Hết hàng
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Label Bar */}
              <div
                className={`w-full py-1 px-1.5 rounded-lg text-center transition-colors ${
                  isOutOfStock
                    ? 'bg-slate-200/80 text-slate-500 font-medium'
                    : isSelected
                    ? 'bg-amber-200/80 text-amber-950 font-bold'
                    : 'bg-neutral-100 group-hover:bg-amber-100/60 text-slate-700 font-medium'
                }`}
              >
                <span className="text-[11px] block truncate leading-tight">
                  {charm.name}
                </span>
                {isOutOfStock && (
                  <span className="text-[9px] block text-rose-600 font-bold mt-0.5">
                    Tạm hết hàng
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
