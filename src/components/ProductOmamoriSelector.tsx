import React, { useState, useMemo } from 'react';
import { ProductOmamoriOption } from '../types';
import { Check, Flame, X, ZoomIn } from 'lucide-react';
import { ProductImageCompareModal, CompareItem } from './ProductImageCompareModal';

interface ProductOmamoriSelectorProps {
  omamoris: ProductOmamoriOption[];
  title?: string;
  selectedOmamori?: string;
  selectedOmamoris?: ProductOmamoriOption[];
  onSelectOmamori?: (omamori: ProductOmamoriOption | null) => void;
  onSelectOmamoris?: (omamoris: ProductOmamoriOption[]) => void;
  maxAllowed?: number;
  isRequired?: boolean;
}

export const ProductOmamoriSelector: React.FC<ProductOmamoriSelectorProps> = ({
  omamoris,
  title,
  selectedOmamori,
  selectedOmamoris,
  onSelectOmamori,
  onSelectOmamoris,
  maxAllowed = 1,
  isRequired = false,
}) => {
  if (!omamoris || omamoris.length === 0) return null;

  const displayTitle = title?.trim() || 'Chọn Bùa Omamori';
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [activeCompareIdx, setActiveCompareIdx] = useState(0);

  const compareItems: CompareItem[] = useMemo(() => {
    return omamoris.map((o, i) => ({
      id: o.id || `omamori-${i}`,
      title: o.name,
      image: o.image || '',
      priceDelta: o.priceDelta,
      stock: o.stock,
      type: 'omamori',
      originalData: o,
    }));
  }, [omamoris]);

  // Resolve current active selection array
  const currentSelection: ProductOmamoriOption[] = React.useMemo(() => {
    if (selectedOmamoris && selectedOmamoris.length > 0) {
      return selectedOmamoris;
    }
    if (selectedOmamori) {
      const found = omamoris.find(
        (o) => o.name.trim().toLowerCase() === selectedOmamori.trim().toLowerCase()
      );
      return found ? [found] : [];
    }
    return [];
  }, [selectedOmamoris, selectedOmamori, omamoris]);

  const [limitNotice, setLimitNotice] = React.useState<string | null>(null);

  const totalExtraPrice = React.useMemo(() => {
    return currentSelection.reduce((sum, o) => sum + (o.priceDelta || 0), 0);
  }, [currentSelection]);

  const handleToggleOmamori = (omamori: ProductOmamoriOption) => {
    const isAlreadySelected = currentSelection.some(
      (o) => (o.id && o.id === omamori.id) || o.name.trim().toLowerCase() === omamori.name.trim().toLowerCase()
    );

    let nextSelection: ProductOmamoriOption[];

    if (isAlreadySelected) {
      if (isRequired && currentSelection.length <= 1) {
        return;
      }
      nextSelection = currentSelection.filter(
        (o) => !((o.id && o.id === omamori.id) || o.name.trim().toLowerCase() === omamori.name.trim().toLowerCase())
      );
      setLimitNotice(null);
    } else {
      if (currentSelection.length >= maxAllowed) {
        setLimitNotice(`Đã đạt tối đa ${maxAllowed} mục đã chọn. Hãy bỏ chọn bớt trước khi thêm.`);
        return;
      }
      setLimitNotice(null);
      nextSelection = [...currentSelection, omamori];
    }

    if (onSelectOmamoris) {
      onSelectOmamoris(nextSelection);
    }
    if (onSelectOmamori) {
      onSelectOmamori(nextSelection[0] || null);
    }
  };

  const handleRemoveOmamori = (omamoriIdOrName: string) => {
    if (isRequired && currentSelection.length <= 1) return;
    const nextSelection = currentSelection.filter(
      (o) => (o.id ? o.id !== omamoriIdOrName : o.name !== omamoriIdOrName)
    );
    setLimitNotice(null);
    if (onSelectOmamoris) onSelectOmamoris(nextSelection);
    if (onSelectOmamori) onSelectOmamori(nextSelection[0] || null);
  };

  const handleClearAll = () => {
    if (isRequired) return;
    setLimitNotice(null);
    if (onSelectOmamoris) onSelectOmamoris([]);
    if (onSelectOmamori) onSelectOmamori(null);
  };

  return (
    <div className="space-y-2 pt-1">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-bold text-slate-800 tracking-wide">
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            <span>{displayTitle} {isRequired && <span className="text-rose-500">*</span>}</span>
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            {maxAllowed > 1
              ? `(${currentSelection.length}/${maxAllowed})`
              : currentSelection.length > 0
              ? '(1 đã chọn)'
              : '(Tùy chọn)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveCompareIdx(0);
              setCompareModalOpen(true);
            }}
            className="text-[11px] font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            title="Bấm để phóng to và so sánh các mẫu bùa Omamori"
          >
            <ZoomIn className="w-3 h-3" />
            <span>So sánh ({omamoris.length})</span>
          </button>

          {totalExtraPrice > 0 && (
            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/70">
              +{totalExtraPrice.toLocaleString('vi-VN')}đ
            </span>
          )}

          {currentSelection.length > 0 && !isRequired && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Xóa tất cả
            </button>
          )}
        </div>
      </div>

      {/* Grid of Omamori cards - Strictly fixed card heights to avoid layout shifts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {omamoris.map((omamori, idx) => {
          const selectedIndex = currentSelection.findIndex(
            (o) => (o.id && o.id === omamori.id) || o.name.trim().toLowerCase() === omamori.name.trim().toLowerCase()
          );
          const isSelected = selectedIndex !== -1;
          const isOutOfStock = typeof omamori.stock === 'number' && omamori.stock <= 0;

          return (
            <button
              key={omamori.id || idx}
              type="button"
              disabled={isOutOfStock}
              onClick={() => {
                if (isOutOfStock) return;
                handleToggleOmamori(omamori);
              }}
              className={`group relative rounded-xl p-2 text-left border-2 transition-colors flex flex-col items-center justify-between ${
                isOutOfStock
                  ? 'opacity-50 grayscale bg-slate-50 border-slate-200 cursor-not-allowed select-none'
                  : isSelected
                  ? 'border-rose-500 bg-rose-50/50 shadow-xs cursor-pointer'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 cursor-pointer'
              }`}
            >
              {/* Selection indicator */}
              {isSelected && !isOutOfStock && (
                <div className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs text-[10px] font-bold">
                  {maxAllowed > 1 ? selectedIndex + 1 : <Check className="w-3 h-3" strokeWidth={2.5} />}
                </div>
              )}

              {/* Omamori Image - Click image to zoom & compare */}
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
                className="w-full aspect-[4/5] rounded-lg overflow-hidden bg-white mb-1.5 border border-slate-100 flex items-center justify-center relative cursor-zoom-in group/img"
                title="Bấm vào ảnh để phóng to & so sánh chi tiết"
              >
                {/* Zoom / Compare Button */}
                <span
                  className="absolute top-1 left-1 z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition-all opacity-85 sm:opacity-0 group-hover:opacity-100 hover:scale-110 shadow-xs pointer-events-none"
                  aria-label="Phóng to"
                >
                  <ZoomIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </span>

                {omamori.image && omamori.image.trim() ? (
                  <img
                    src={omamori.image}
                    alt={omamori.name}
                    className="w-full h-full object-contain p-1 transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-300 font-medium">
                    Bùa
                  </div>
                )}

                {/* Hover zoom pill overlay */}
                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="px-2 py-0.5 rounded-full bg-black/80 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                    <ZoomIn className="w-3 h-3 text-rose-300" />
                    <span>Phóng to</span>
                  </span>
                </div>

                {/* Extra price badge */}
                {omamori.priceDelta && omamori.priceDelta > 0 ? (
                  <span className="absolute bottom-1 right-1 text-[9px] bg-slate-900/80 text-white font-medium px-1.5 py-0.5 rounded shadow-xs backdrop-blur-[1px] z-10">
                    +{omamori.priceDelta.toLocaleString('vi-VN')}đ
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

              {/* Card Label - Strictly fixed height so selecting never alters card height */}
              <div className="w-full text-center h-8 flex flex-col justify-center">
                <span className="text-[11px] block truncate leading-tight font-semibold text-slate-800">
                  {omamori.name}
                </span>
                <span className="text-[10px] block h-3.5 leading-none mt-0.5">
                  {isOutOfStock ? (
                    <span className="text-rose-500 font-medium">Hết hàng</span>
                  ) : typeof omamori.stock === 'number' && omamori.stock > 0 ? (
                    <span className={isSelected ? 'text-rose-700 font-semibold' : 'text-slate-400 font-medium'}>
                      Còn {omamori.stock}
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

      {/* Limit Notice Toast - Rendered below grid so grid never jumps */}
      {limitNotice && (
        <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center justify-between gap-2 animate-fadeIn">
          <span>{limitNotice}</span>
          <button
            type="button"
            onClick={() => setLimitNotice(null)}
            className="text-rose-600 hover:text-rose-900 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Items Chips (Rendered BELOW grid to guarantee zero layout shifts during selection) */}
      {currentSelection.length > 0 && maxAllowed > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {currentSelection.map((item, idx) => (
            <div
              key={item.id || idx}
              className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 text-slate-800 px-2.5 py-1 rounded-lg text-xs font-medium group transition-all"
            >
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <span className="truncate max-w-[140px]">{item.name}</span>
              {item.priceDelta && item.priceDelta > 0 ? (
                <span className="text-[10px] text-rose-700 font-semibold">
                  (+{item.priceDelta.toLocaleString('vi-VN')}đ)
                </span>
              ) : null}
              {!isRequired && (
                <button
                  type="button"
                  onClick={() => handleRemoveOmamori(item.id || item.name)}
                  className="text-slate-400 hover:text-rose-500 ml-0.5 cursor-pointer p-0.5"
                  title="Bỏ chọn"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Zoom & Compare Modal */}
      <ProductImageCompareModal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        items={compareItems}
        initialIndex={activeCompareIdx}
        title={`So sánh mẫu ${displayTitle}`}
        onSelectItem={(item) => {
          if (item.originalData) {
            handleToggleOmamori(item.originalData);
          }
        }}
        isItemSelected={(item) => {
          return currentSelection.some(
            (o) =>
              (o.id && o.id === item.id) ||
              o.name.trim().toLowerCase() === item.title.trim().toLowerCase()
          );
        }}
      />
    </div>
  );
};
