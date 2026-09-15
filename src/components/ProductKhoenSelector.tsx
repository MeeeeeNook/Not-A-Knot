import React, { useState, useMemo } from 'react';
import { ProductKhoenOption } from '../types';
import { Check, CircleDot, X, ZoomIn } from 'lucide-react';
import { ProductImageCompareModal, CompareItem } from './ProductImageCompareModal';

interface ProductKhoenSelectorProps {
  khoenOptions: ProductKhoenOption[];
  title?: string;
  selectedKhoen?: ProductKhoenOption | null;
  onSelectKhoen?: (khoen: ProductKhoenOption | null) => void;
  isRequired?: boolean;
}

export const ProductKhoenSelector: React.FC<ProductKhoenSelectorProps> = ({
  khoenOptions,
  title,
  selectedKhoen,
  onSelectKhoen,
  isRequired = false,
}) => {
  if (!khoenOptions || khoenOptions.length === 0) return null;

  const displayTitle = title?.trim() || 'Chọn Khoen';
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [activeCompareIdx, setActiveCompareIdx] = useState(0);

  const compareItems: CompareItem[] = useMemo(() => {
    return khoenOptions.map((k, i) => ({
      id: k.id || `khoen-${i}`,
      title: k.name,
      image: k.image || '',
      priceDelta: k.priceDelta,
      stock: k.stock,
      type: 'khoen',
      originalData: k,
    }));
  }, [khoenOptions]);

  const handleToggle = (khoen: ProductKhoenOption) => {
    const isAlreadySelected =
      selectedKhoen &&
      ((selectedKhoen.id && selectedKhoen.id === khoen.id) ||
        selectedKhoen.name.trim().toLowerCase() === khoen.name.trim().toLowerCase());

    if (isAlreadySelected) {
      if (isRequired) return; // Cannot deselect if required
      if (onSelectKhoen) onSelectKhoen(null);
    } else {
      if (onSelectKhoen) onSelectKhoen(khoen);
    }
  };

  return (
    <div className="space-y-2 pt-1">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 tracking-wide">
            <CircleDot className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {displayTitle} {isRequired && <span className="text-rose-500">*</span>}
            </span>
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            {selectedKhoen ? '(1 đã chọn)' : isRequired ? '(Bắt buộc)' : '(Tùy chọn)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveCompareIdx(0);
              setCompareModalOpen(true);
            }}
            className="text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            title="Bấm để phóng to và so sánh các mẫu khoen"
          >
            <ZoomIn className="w-3 h-3" />
            <span>So sánh ({khoenOptions.length})</span>
          </button>

          {selectedKhoen && selectedKhoen.priceDelta && selectedKhoen.priceDelta > 0 ? (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
              +{selectedKhoen.priceDelta.toLocaleString('vi-VN')}đ
            </span>
          ) : null}

          {selectedKhoen && !isRequired && (
            <button
              type="button"
              onClick={() => onSelectKhoen?.(null)}
              className="text-[11px] font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Bỏ chọn
            </button>
          )}
        </div>
      </div>

      {/* Selected indicator chip if any */}
      {selectedKhoen && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-950 font-medium">
          <span className="text-slate-500">Đã chọn:</span>
          <span className="font-bold text-amber-900">{selectedKhoen.name}</span>
          {selectedKhoen.priceDelta && selectedKhoen.priceDelta > 0 ? (
            <span className="text-[11px] font-bold text-amber-700">
              (+{selectedKhoen.priceDelta.toLocaleString('vi-VN')}đ)
            </span>
          ) : (
            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              Miễn phí
            </span>
          )}
        </div>
      )}

      {/* Grid of khoen cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {khoenOptions.map((khoen, idx) => {
          const isSelected =
            selectedKhoen &&
            ((selectedKhoen.id && selectedKhoen.id === khoen.id) ||
              selectedKhoen.name.trim().toLowerCase() === khoen.name.trim().toLowerCase());

          const isOutOfStock = typeof khoen.stock === 'number' && khoen.stock <= 0;

          return (
            <button
              key={khoen.id || idx}
              type="button"
              disabled={isOutOfStock}
              onClick={() => {
                if (isOutOfStock) return;
                handleToggle(khoen);
              }}
              className={`group relative rounded-xl p-2 text-left border-2 transition-colors flex flex-col items-center justify-between ${
                isOutOfStock
                  ? 'opacity-50 grayscale bg-slate-50 border-slate-200 cursor-not-allowed select-none'
                  : isSelected
                  ? 'border-amber-500 bg-amber-50/50 shadow-xs cursor-pointer ring-2 ring-amber-400/30'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 cursor-pointer'
              }`}
            >
              {/* Checkmark indicator */}
              {isSelected && !isOutOfStock && (
                <div className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs text-[10px] font-bold">
                  <Check className="w-3 h-3" strokeWidth={2.5} />
                </div>
              )}

              {/* Khoen Image - Click image to zoom & compare */}
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveCompareIdx(idx);
                  setCompareModalOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    setActiveCompareIdx(idx);
                    setCompareModalOpen(true);
                  }
                }}
                className="w-full aspect-square rounded-lg overflow-hidden bg-white mb-1.5 border border-slate-100 flex items-center justify-center relative cursor-zoom-in group/img"
                title="Bấm vào ảnh để phóng to & so sánh chi tiết"
              >
                {/* Zoom / Compare Button */}
                <span
                  className="absolute top-1 left-1 z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition-all opacity-85 sm:opacity-0 group-hover:opacity-100 hover:scale-110 shadow-xs pointer-events-none"
                  aria-label="Phóng to"
                >
                  <ZoomIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </span>

                {khoen.image && khoen.image.trim() ? (
                  <img
                    src={khoen.image}
                    alt={khoen.name}
                    className="w-full h-full object-contain p-1 transition-transform duration-200 hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                    Khoen
                  </div>
                )}

                {/* Hover zoom pill overlay */}
                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="px-2 py-0.5 rounded-full bg-black/80 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                    <ZoomIn className="w-3 h-3 text-amber-300" />
                    <span>Phóng to</span>
                  </span>
                </div>

                {/* Extra price badge */}
                {khoen.priceDelta && khoen.priceDelta > 0 ? (
                  <span className="absolute bottom-1 right-1 text-[9px] bg-slate-900/80 text-white font-medium px-1.5 py-0.5 rounded shadow-xs backdrop-blur-[1px] z-10">
                    +{khoen.priceDelta.toLocaleString('vi-VN')}đ
                  </span>
                ) : null}

                {/* Out of stock overlay */}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center">
                    <span className="bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wide">
                      Hết hàng
                    </span>
                  </div>
                )}
              </div>

              {/* Card Label */}
              <div className="w-full text-center h-8 flex flex-col justify-center">
                <span className="text-[11px] block truncate leading-tight font-semibold text-slate-800">
                  {khoen.name}
                </span>
                <span className="text-[10px] block h-3.5 leading-none mt-0.5">
                  {isOutOfStock ? (
                    <span className="text-rose-500 font-medium">Hết hàng</span>
                  ) : typeof khoen.stock === 'number' && khoen.stock > 0 ? (
                    <span className={isSelected ? 'text-amber-700 font-semibold' : 'text-slate-400 font-medium'}>
                      Còn {khoen.stock}
                    </span>
                  ) : (
                    <span className="text-transparent select-none">-</span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Fullscreen Zoom & Compare Modal */}
      <ProductImageCompareModal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        items={compareItems}
        initialIndex={activeCompareIdx}
        title={`So sánh mẫu ${displayTitle}`}
        onSelectItem={(item) => {
          if (item.originalData) {
            handleToggle(item.originalData);
          }
        }}
        isItemSelected={(item) => {
          return !!(
            selectedKhoen &&
            ((selectedKhoen.id && selectedKhoen.id === item.id) ||
              selectedKhoen.name.trim().toLowerCase() === item.title.trim().toLowerCase())
          );
        }}
      />
    </div>
  );
};
