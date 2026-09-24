import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Check, AlertCircle, ShoppingBag } from 'lucide-react';
import { Product, ComboItemConfig, ComboItemSelection } from '../types';
import { ProductColorSelector } from './ProductColorSelector';
import { ProductCharmSelector } from './ProductCharmSelector';
import { ProductOmamoriSelector } from './ProductOmamoriSelector';
import { ProductKhoenSelector } from './ProductKhoenSelector';

interface ProductComboCustomizerProps {
  product: Product;
  comboItems: ComboItemConfig[];
  activeStep?: number;
  onStepChange?: (stepIdx: number) => void;
  onColorSelect?: (colorName: string, colorImage?: string) => void;
  quantity?: number;
  setQuantity?: React.Dispatch<React.SetStateAction<number>>;
  availableStock?: number;
  isOutOfStock?: boolean;
  isCartFullForProduct?: boolean;
  remainingAddableStock?: number;
  isAdded?: boolean;
  onAddToCartDirect: (selectedComboItems: ComboItemSelection[], totalExtraPrice: number, quantity: number) => void;
  onBuyNowDirect: (selectedComboItems: ComboItemSelection[], totalExtraPrice: number, quantity: number) => void;
}

export const ProductComboCustomizer: React.FC<ProductComboCustomizerProps> = ({
  product,
  comboItems,
  activeStep: controlledStep,
  onStepChange,
  onColorSelect,
  quantity = 1,
  setQuantity,
  availableStock = 50,
  isOutOfStock = false,
  isCartFullForProduct = false,
  remainingAddableStock = 50,
  isAdded = false,
  onAddToCartDirect,
  onBuyNowDirect,
}) => {
  const [internalStep, setInternalStep] = useState<number>(0);
  const activeStep = controlledStep !== undefined ? controlledStep : internalStep;

  const setActiveStep = (stepIdx: number) => {
    setInternalStep(stepIdx);
    onStepChange?.(stepIdx);
  };

  const totalSteps = comboItems.length;

  // Track customer selections for each step
  const [selections, setSelections] = useState<ComboItemSelection[]>(() => {
    return comboItems.map((item, idx) => ({
      itemId: item.id || `combo-item-${idx}`,
      itemTitle: item.title || `Sản phẩm #${idx + 1}`,
      selectedColor: item.colorOptions?.[0]?.name || item.availableColors?.[0],
      selectedColorImage: item.colorOptions?.[0]?.image,
      selectedCharms: [],
      selectedCharmPrice: 0,
      selectedOmamoris: [],
      selectedOmamoriPrice: 0,
      selectedKhoen: undefined,
      selectedKhoenPrice: 0,
    }));
  });

  const [stepError, setStepError] = useState<string | null>(null);

  const currentItem = comboItems[activeStep] || comboItems[0];
  const currentSelection = selections[activeStep] || {
    itemId: currentItem?.id,
    itemTitle: currentItem?.title,
  };

  const updateCurrentSelection = (patch: Partial<ComboItemSelection>) => {
    setStepError(null);
    setSelections((prev) => {
      const next = [...prev];
      next[activeStep] = { ...next[activeStep], ...patch };
      return next;
    });
  };

  // Comprehensive validation across all combo items before purchase/add-to-cart
  const validateAllItems = (): boolean => {
    for (let idx = 0; idx < comboItems.length; idx++) {
      const item = comboItems[idx];
      const sel = selections[idx];
      if (!item || !sel) continue;

      // Charm validation
      if (item.enableCharmSelection && item.charmSelectionRequired) {
        if (!sel.selectedCharms || sel.selectedCharms.length === 0) {
          setActiveStep(idx);
          setStepError(`Vui lòng chọn charm cho "${item.title}".`);
          return false;
        }
      }

      // Omamori validation
      if (item.enableOmamoriSelection && item.omamoriSelectionRequired) {
        if (!sel.selectedOmamoris || sel.selectedOmamoris.length === 0) {
          setActiveStep(idx);
          setStepError(`Vui lòng chọn bùa Omamori cho "${item.title}".`);
          return false;
        }
      }

      // Khoen validation
      if (item.enableKhoenSelection && item.khoenSelectionRequired) {
        if (!sel.selectedKhoen) {
          setActiveStep(idx);
          setStepError(`Vui lòng chọn khoen cài cho "${item.title}".`);
          return false;
        }
      }
    }

    setStepError(null);
    return true;
  };

  const handleNextStep = () => {
    setStepError(null);
    if (activeStep < totalSteps - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handlePrevStep = () => {
    setStepError(null);
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  // Calculate total extra price across all configured combo items
  const totalExtraPrice = selections.reduce((sum, sel) => {
    return sum + (sel.selectedCharmPrice || 0) + (sel.selectedOmamoriPrice || 0) + (sel.selectedKhoenPrice || 0);
  }, 0);

  const isLastStep = activeStep === totalSteps - 1;

  const handleFinishAddToCart = () => {
    if (!validateAllItems()) return;
    onAddToCartDirect(selections, totalExtraPrice, quantity);
  };

  const handleFinishBuyNow = () => {
    if (!validateAllItems()) return;
    onBuyNowDirect(selections, totalExtraPrice, quantity);
  };

  if (comboItems.length === 0) return null;

  const basePrice = product.price || 0;
  const singleComboTotal = basePrice + totalExtraPrice;
  const subtotal = singleComboTotal * quantity;

  return (
    <div className="p-0 sm:p-5 sm:bg-white sm:rounded-3xl sm:border sm:border-neutral-200/90 space-y-3.5 sm:space-y-5 sm:shadow-xs">
      {/* 1. Item Navigation Tabs - Clean, light artisan styling without darkmode or inner images */}
      <div className="space-y-1.5">
        <div className="text-xs text-neutral-500 font-semibold px-0.5">
          Chọn món để xem ảnh & phối màu:
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {comboItems.map((item, idx) => {
            const isActive = idx === activeStep;
            const sel = selections[idx];
            const summaryColor = sel?.selectedColor;

            return (
              <button
                key={item.id || idx}
                type="button"
                onClick={() => {
                  setActiveStep(idx);
                  setStepError(null);
                  if (sel?.selectedColorImage) {
                    onColorSelect?.(sel.selectedColor || '', sel.selectedColorImage);
                  }
                }}
                className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer select-none flex flex-col justify-center ${
                  isActive
                    ? 'bg-amber-50/90 text-amber-950 border-amber-400 shadow-xs ring-2 ring-amber-400/30'
                    : 'bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-200'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black shrink-0 ${
                      isActive
                        ? 'bg-amber-500 text-neutral-950'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold truncate leading-tight text-neutral-950">
                    {item.title}
                  </span>
                </div>

                <div
                  className={`text-[10px] sm:text-[11px] truncate mt-0.5 sm:mt-1 pl-5 sm:pl-6 ${
                    isActive ? 'text-amber-800 font-medium' : 'text-neutral-500'
                  }`}
                >
                  {summaryColor ? `Màu: ${summaryColor}` : (item.subtitle || 'Tùy chỉnh')}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Active Item Customization Card - Clean header without "sản phẩm 1/2" or "ảnh mẫu" badges */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="bg-neutral-50/60 sm:bg-neutral-50/70 rounded-xl sm:rounded-2xl p-2.5 sm:p-5 border border-neutral-200/70 space-y-3 sm:space-y-4"
        >
          {/* Card Header: Product Title & Subtitle */}
          <div className="pb-2 sm:pb-3 border-b border-neutral-200/70">
            <h3 className="text-sm sm:text-lg font-black text-neutral-900 tracking-tight truncate">
              {currentItem.title}
            </h3>
            {currentItem.subtitle && (
              <p className="text-xs text-neutral-600 leading-relaxed mt-0.5">{currentItem.subtitle}</p>
            )}
          </div>

          {/* Color Selection for this combo sub-item */}
          {currentItem.enableColorSelection !== false && currentItem.colorOptions && currentItem.colorOptions.length > 0 && (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-900 block">
                  Màu sắc / Mẫu dây: <span className="text-amber-700 font-extrabold">{currentSelection.selectedColor}</span>
                </label>
                <span className="text-[10px] sm:text-[11px] text-neutral-400">Chạm để chọn màu</span>
              </div>

              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {currentItem.colorOptions.map((col, cIdx) => {
                  const isColActive = currentSelection.selectedColor === col.name;
                  return (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => {
                        const targetImg = col.image || currentSelection.selectedColorImage;
                        updateCurrentSelection({
                          selectedColor: col.name,
                          selectedColorImage: targetImg,
                        });
                        // Synchronize with parent page image gallery so the left main photo jumps to this color
                        onColorSelect?.(col.name, targetImg);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isColActive
                          ? 'bg-amber-100 text-amber-950 border-amber-500 shadow-xs ring-2 ring-amber-400/40'
                          : 'bg-white hover:bg-neutral-100 text-neutral-800 border-neutral-200'
                      }`}
                    >
                      {col.colorCode && (
                        <span
                          className="w-3 h-3 rounded-full border border-white/50 shrink-0"
                          style={{ backgroundColor: col.colorCode }}
                        />
                      )}
                      <span>{col.name}</span>
                      {isColActive && <Check className="w-3 h-3 text-amber-700" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Charm Selection for this combo sub-item */}
          {currentItem.enableCharmSelection && currentItem.charmOptions && currentItem.charmOptions.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <ProductCharmSelector
                title={currentItem.charmTitle || 'Chọn Charm'}
                charms={currentItem.charmOptions}
                selectedCharms={currentSelection.selectedCharms || []}
                onSelectCharms={(charms) => {
                  const charmExtra = charms.reduce((acc, c) => acc + (c.priceDelta || 0), 0);
                  updateCurrentSelection({
                    selectedCharms: charms,
                    selectedCharmPrice: charmExtra,
                  });
                }}
                isRequired={currentItem.charmSelectionRequired}
                maxAllowed={currentItem.maxCharmsAllowed || 1}
              />
            </div>
          )}

          {/* Omamori Selection for this sub-item */}
          {currentItem.enableOmamoriSelection && currentItem.omamoriOptions && currentItem.omamoriOptions.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <ProductOmamoriSelector
                title={currentItem.omamoriTitle || 'Chọn Bùa Omamori'}
                omamoris={currentItem.omamoriOptions}
                selectedOmamoris={currentSelection.selectedOmamoris || []}
                onSelectOmamoris={(omamoris) => {
                  const omaExtra = omamoris.reduce((acc, o) => acc + (o.priceDelta || 0), 0);
                  updateCurrentSelection({
                    selectedOmamoris: omamoris,
                    selectedOmamoriPrice: omaExtra,
                  });
                }}
                isRequired={currentItem.omamoriSelectionRequired}
                maxAllowed={currentItem.maxOmamoriAllowed || 1}
              />
            </div>
          )}

          {/* Khoen Selection for this sub-item */}
          {currentItem.enableKhoenSelection && currentItem.khoenOptions && currentItem.khoenOptions.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <ProductKhoenSelector
                title={currentItem.khoenTitle || 'Chọn Khoen Cài'}
                khoenOptions={currentItem.khoenOptions}
                selectedKhoen={
                  currentItem.khoenOptions.find((k) => k.name === currentSelection.selectedKhoen) || null
                }
                onSelectKhoen={(khoen) => {
                  updateCurrentSelection({
                    selectedKhoen: khoen ? khoen.name : undefined,
                    selectedKhoenImage: khoen?.image,
                    selectedKhoenPrice: khoen?.priceDelta || 0,
                  });
                }}
                isRequired={currentItem.khoenSelectionRequired}
              />
            </div>
          )}

          {/* Error notice if validation fails */}
          {stepError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{stepError}</span>
            </div>
          )}

          {/* Navigation Controls: Displaying product names (e.g. Butterfly Knot, Lucky Knot) */}
          <div className="flex items-center justify-between gap-2 pt-2.5 sm:pt-3 border-t border-neutral-200/70">
            {activeStep > 0 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="truncate max-w-[120px] sm:max-w-none">{comboItems[activeStep - 1]?.title || 'Quay lại'}</span>
              </button>
            ) : <span />}

            {!isLastStep ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ml-auto"
              >
                <span className="truncate max-w-[120px] sm:max-w-none">{comboItems[activeStep + 1]?.title || 'Tiếp theo'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 3. Summary & Unified Purchase Action Dock */}
      <div className="bg-neutral-50/70 sm:bg-neutral-50 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-neutral-200/70 sm:border-neutral-200/90 space-y-3 sm:space-y-4">
        {/* Header without "(2 món)" as requested */}
        <div className="flex items-center justify-between text-[11px] sm:text-xs font-black text-neutral-800 uppercase tracking-wide">
          <span>Tóm tắt lựa chọn trọn bộ Combo:</span>
          {totalExtraPrice > 0 && (
            <span className="text-amber-700 font-bold">
              Phụ thu: +{totalExtraPrice.toLocaleString('vi-VN')}đ
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {comboItems.map((item, i) => {
            const sel = selections[i];
            return (
              <div key={i} className="p-2 sm:p-2.5 bg-white rounded-lg sm:rounded-xl border border-neutral-200/80 space-y-0.5 shadow-2xs">
                <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-neutral-950 text-[9px] font-black flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="truncate">{item.title}</span>
                </div>
                <div className="text-[11px] text-neutral-600 pl-5 space-y-0.5">
                  {sel?.selectedColor && (
                    <div>• Màu: <span className="font-semibold text-neutral-900">{sel.selectedColor}</span></div>
                  )}
                  {sel?.selectedCharms && sel.selectedCharms.length > 0 && (
                    <div>• Charm: <span className="font-semibold text-amber-800">{sel.selectedCharms.map((c) => c.name).join(', ')}</span></div>
                  )}
                  {sel?.selectedOmamoris && sel.selectedOmamoris.length > 0 && (
                    <div>• Omamori: <span className="font-semibold text-red-800">{sel.selectedOmamoris.map((o) => o.name).join(', ')}</span></div>
                  )}
                  {sel?.selectedKhoen && (
                    <div>• Khoen: <span className="font-semibold text-sky-800">{sel.selectedKhoen}</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Unified Quantity Selector & Subtotal Card */}
        <div className="flex items-center justify-between gap-2 p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-neutral-600 hidden xs:inline">SL:</span>
            <div className="flex items-center border border-neutral-200 rounded-lg sm:rounded-xl bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                disabled={quantity <= 1 || isOutOfStock || isCartFullForProduct}
                onClick={() => setQuantity?.((q) => Math.max(1, q - 1))}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-neutral-50 hover:bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer text-xs sm:text-sm"
                aria-label="Giảm số lượng"
              >
                -
              </button>
              <span className="w-8 sm:w-10 text-center font-black text-xs sm:text-sm text-neutral-950 font-mono">
                {quantity}
              </span>
              <button
                type="button"
                disabled={quantity >= remainingAddableStock || isOutOfStock || isCartFullForProduct}
                onClick={() => setQuantity?.((q) => Math.min(remainingAddableStock, q + 1))}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg font-bold flex items-center justify-center transition-colors cursor-pointer text-xs sm:text-sm ${
                  quantity >= remainingAddableStock || isOutOfStock || isCartFullForProduct
                    ? 'bg-neutral-200 text-neutral-400 hover:bg-neutral-300'
                    : 'bg-neutral-50 hover:bg-neutral-200 text-neutral-800'
                }`}
                aria-label="Tăng số lượng"
              >
                +
              </button>
            </div>

            {/* Subtle Stock Counter */}
            {isOutOfStock || availableStock <= 0 ? (
              <span className="text-[10px] sm:text-[11px] font-semibold text-rose-600">
                Hết hàng
              </span>
            ) : availableStock < 5 ? (
              <span className="text-[10px] sm:text-[11px] font-medium text-amber-700">
                (còn {availableStock})
              </span>
            ) : (
              <span className="text-[10px] sm:text-[11px] text-neutral-500">
                (còn {availableStock})
              </span>
            )}
          </div>

          <div className="text-right min-w-0">
            <div className="text-[10px] sm:text-[11px] font-semibold text-neutral-500 uppercase tracking-wider truncate">
              Tạm tính ({quantity})
            </div>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-lg sm:text-2xl font-black text-neutral-950 font-mono tracking-tight">
                {subtotal.toLocaleString('vi-VN')}đ
              </span>
            </div>
            {totalExtraPrice > 0 && (
              <div className="text-[10px] sm:text-[11px] font-medium text-amber-700 truncate">
                (+{(totalExtraPrice * quantity).toLocaleString('vi-VN')}đ phụ kiện)
              </div>
            )}
          </div>
        </div>

        {/* Primary CTA Buttons (Identical to normal product page: "Thêm Vào Giỏ" and "Mua Ngay") */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-0.5">
          <button
            type="button"
            disabled={isOutOfStock || isCartFullForProduct}
            onClick={handleFinishAddToCart}
            className={`py-3 px-2 sm:py-3.5 sm:px-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isOutOfStock || isCartFullForProduct
                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                : isAdded
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-900 hover:bg-neutral-800 text-white shadow-md active:scale-98'
            }`}
          >
            {isAdded ? (
              <>
                <Check className="w-4 h-4" />
                <span className="truncate">Đã thêm giỏ</span>
              </>
            ) : isCartFullForProduct ? (
              <span className="truncate">Đạt giới hạn</span>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                <span className="truncate">Thêm Vào Giỏ</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isOutOfStock || isCartFullForProduct}
            onClick={handleFinishBuyNow}
            className={`py-3 px-2 sm:py-3.5 sm:px-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isOutOfStock || isCartFullForProduct
                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-md active:scale-98'
            }`}
          >
            <span className="truncate">{isCartFullForProduct ? 'Kho đã hết' : 'Mua Ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
