import React from 'react';
import { ProductCharmOption } from '../types';
import { Check, Sparkles, X } from 'lucide-react';

interface ProductCharmSelectorProps {
  charms: ProductCharmOption[];
  title?: string;
  selectedCharm?: string;
  selectedCharms?: ProductCharmOption[];
  onSelectCharm?: (charm: ProductCharmOption | null) => void;
  onSelectCharms?: (charms: ProductCharmOption[]) => void;
  maxAllowed?: number;
  isRequired?: boolean;
}

export const ProductCharmSelector: React.FC<ProductCharmSelectorProps> = ({
  charms,
  title,
  selectedCharm,
  selectedCharms,
  onSelectCharm,
  onSelectCharms,
  maxAllowed = 1,
  isRequired = false,
}) => {
  if (!charms || charms.length === 0) return null;

  const displayTitle = title?.trim() || 'Chọn Charm';

  // Resolve current active selection array
  const currentSelection: ProductCharmOption[] = React.useMemo(() => {
    if (selectedCharms && selectedCharms.length > 0) {
      return selectedCharms;
    }
    if (selectedCharm) {
      const found = charms.find(
        (c) => c.name.trim().toLowerCase() === selectedCharm.trim().toLowerCase()
      );
      return found ? [found] : [];
    }
    return [];
  }, [selectedCharms, selectedCharm, charms]);

  const [limitNotice, setLimitNotice] = React.useState<string | null>(null);

  const totalExtraPrice = React.useMemo(() => {
    return currentSelection.reduce((sum, c) => sum + (c.priceDelta || 0), 0);
  }, [currentSelection]);

  const handleToggleCharm = (charm: ProductCharmOption) => {
    const isAlreadySelected = currentSelection.some(
      (c) => (c.id && c.id === charm.id) || c.name.trim().toLowerCase() === charm.name.trim().toLowerCase()
    );

    let nextSelection: ProductCharmOption[];

    if (isAlreadySelected) {
      if (isRequired && currentSelection.length <= 1) {
        return;
      }
      nextSelection = currentSelection.filter(
        (c) => !((c.id && c.id === charm.id) || c.name.trim().toLowerCase() === charm.name.trim().toLowerCase())
      );
      setLimitNotice(null);
    } else {
      if (currentSelection.length >= maxAllowed) {
        setLimitNotice(`Đã đạt tối đa ${maxAllowed} mẫu đã chọn. Hãy bỏ chọn bớt trước khi thêm.`);
        return;
      }
      setLimitNotice(null);
      nextSelection = [...currentSelection, charm];
    }

    if (onSelectCharms) {
      onSelectCharms(nextSelection);
    }
    if (onSelectCharm) {
      onSelectCharm(nextSelection[0] || null);
    }
  };

  const handleRemoveCharm = (charmIdOrName: string) => {
    if (isRequired && currentSelection.length <= 1) return;
    const nextSelection = currentSelection.filter(
      (c) => (c.id ? c.id !== charmIdOrName : c.name !== charmIdOrName)
    );
    setLimitNotice(null);
    if (onSelectCharms) onSelectCharms(nextSelection);
    if (onSelectCharm) onSelectCharm(nextSelection[0] || null);
  };

  const handleClearAll = () => {
    if (isRequired) return;
    setLimitNotice(null);
    if (onSelectCharms) onSelectCharms([]);
    if (onSelectCharm) onSelectCharm(null);
  };

  return (
    <div className="space-y-2 pt-1">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-bold text-slate-800 tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
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
          {totalExtraPrice > 0 && (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
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

      {/* Grid of charm cards - Fixed height to avoid any jumping */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {charms.map((charm, idx) => {
          const selectedIndex = currentSelection.findIndex(
            (c) => (c.id && c.id === charm.id) || c.name.trim().toLowerCase() === charm.name.trim().toLowerCase()
          );
          const isSelected = selectedIndex !== -1;
          const isOutOfStock = typeof charm.stock === 'number' && charm.stock <= 0;

          return (
            <button
              key={charm.id || idx}
              type="button"
              disabled={isOutOfStock}
              onClick={() => {
                if (isOutOfStock) return;
                handleToggleCharm(charm);
              }}
              className={`relative rounded-xl p-2 text-left border-2 transition-colors flex flex-col items-center justify-between ${
                isOutOfStock
                  ? 'opacity-50 grayscale bg-slate-50 border-slate-200 cursor-not-allowed select-none'
                  : isSelected
                  ? 'border-amber-500 bg-amber-50/50 shadow-xs cursor-pointer'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 cursor-pointer'
              }`}
            >
              {/* Selection indicator */}
              {isSelected && !isOutOfStock && (
                <div className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs text-[10px] font-bold">
                  {maxAllowed > 1 ? selectedIndex + 1 : <Check className="w-3 h-3" strokeWidth={2.5} />}
                </div>
              )}

              {/* Charm Image */}
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-white mb-1.5 border border-slate-100 flex items-center justify-center relative">
                {charm.image && charm.image.trim() ? (
                  <img
                    src={charm.image}
                    alt={charm.name}
                    className="w-full h-full object-contain p-1 transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-300 font-medium">
                    Charm
                  </div>
                )}

                {/* Extra price badge */}
                {charm.priceDelta && charm.priceDelta > 0 ? (
                  <span className="absolute bottom-1 right-1 text-[9px] bg-slate-900/80 text-white font-medium px-1.5 py-0.5 rounded shadow-xs backdrop-blur-[1px]">
                    +{charm.priceDelta.toLocaleString('vi-VN')}đ
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

              {/* Card Label - Strictly fixed height so selecting never shifts card height */}
              <div className="w-full text-center h-8 flex flex-col justify-center">
                <span className="text-[11px] block truncate leading-tight font-semibold text-slate-800">
                  {charm.name}
                </span>
                <span className="text-[10px] block h-3.5 leading-none mt-0.5">
                  {isOutOfStock ? (
                    <span className="text-rose-500 font-medium">Hết hàng</span>
                  ) : typeof charm.stock === 'number' && charm.stock > 0 ? (
                    <span className={isSelected ? 'text-amber-700 font-semibold' : 'text-slate-400 font-medium'}>
                      Còn {charm.stock}
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

      {/* Limit Notice Toast - Rendered below grid to prevent layout jumping */}
      {limitNotice && (
        <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between gap-2 animate-fadeIn">
          <span>⚠️ {limitNotice}</span>
          <button
            type="button"
            onClick={() => setLimitNotice(null)}
            className="text-amber-600 hover:text-amber-900 p-0.5 cursor-pointer"
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
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <span className="truncate max-w-[140px]">{item.name}</span>
              {item.priceDelta && item.priceDelta > 0 ? (
                <span className="text-[10px] text-amber-700 font-semibold">
                  (+{item.priceDelta.toLocaleString('vi-VN')}đ)
                </span>
              ) : null}
              {!isRequired && (
                <button
                  type="button"
                  onClick={() => handleRemoveCharm(item.id || item.name)}
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
    </div>
  );
};
