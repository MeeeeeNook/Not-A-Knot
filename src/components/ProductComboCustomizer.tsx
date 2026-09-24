import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Check, AlertCircle, ShoppingBag, Eye } from 'lucide-react';
import { Product, ComboItemConfig, ComboItemSelection } from '../types';
import { ProductCharmSelector } from './ProductCharmSelector';
import { ProductOmamoriSelector } from './ProductOmamoriSelector';
import { ProductKhoenSelector } from './ProductKhoenSelector';
import { LoadingImage } from './LoadingImage';

interface ProductComboCustomizerProps {
  product: Product;
  comboItems: ComboItemConfig[];
  onCompleteCombo?: (selectedComboItems: ComboItemSelection[], totalExtraPrice: number) => void;
  onAddToCartDirect: (selectedComboItems: ComboItemSelection[], totalExtraPrice: number, quantity: number) => void;
  onBuyNowDirect: (selectedComboItems: ComboItemSelection[], totalExtraPrice: number, quantity: number) => void;
  isOutOfStock?: boolean;
  activeStep?: number;
  onStepChange?: (stepIdx: number) => void;
  onActiveColorChange?: (colorName: string, imageUrl?: string, itemIdx?: number) => void;
  quantity?: number;
  onQuantityChange?: (qty: number) => void;
  availableStock?: number;
}

export const ProductComboCustomizer: React.FC<ProductComboCustomizerProps> = ({
  product,
  comboItems,
  onCompleteCombo,
  onAddToCartDirect,
  onBuyNowDirect,
  isOutOfStock = false,
  activeStep: controlledActiveStep,
  onStepChange,
  onActiveColorChange,
  quantity: controlledQuantity,
  onQuantityChange,
  availableStock = 99,
}) => {
  const [internalActiveStep, setInternalActiveStep] = useState<number>(0);
  const activeStep = controlledActiveStep !== undefined ? controlledActiveStep : internalActiveStep;
  
  const [internalQty, setInternalQty] = useState<number>(1);
  const quantity = controlledQuantity !== undefined ? controlledQuantity : internalQty;

  const totalSteps = comboItems.length;

  // Track customer selections for each step
  const [selections, setSelections] = useState<ComboItemSelection[]>(() => {
    return comboItems.map((item, idx) => ({
      itemId: item.id || `combo-item-${idx}`,
      itemTitle: item.title || `Sản phẩm ${idx + 1}`,
      selectedColor: item.colorOptions?.[0]?.name || item.availableColors?.[0],
      selectedColorImage: item.colorOptions?.[0]?.image || item.image,
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

  const handleStepChange = (newStep: number) => {
    setStepError(null);
    if (controlledActiveStep === undefined) {
      setInternalActiveStep(newStep);
    }
    onStepChange?.(newStep);
    
    // Sync current selection image with parent gallery
    const targetSel = selections[newStep];
    const targetItem = comboItems[newStep];
    const imgToSync = targetSel?.selectedColorImage || targetItem?.image || product.image;
    if (imgToSync) {
      onActiveColorChange?.(targetSel?.selectedColor || '', imgToSync, newStep);
    }
  };

  const handleQtyChange = (newQty: number) => {
    const clamped = Math.max(1, Math.min(availableStock, newQty));
    if (controlledQuantity === undefined) {
      setInternalQty(clamped);
    }
    onQuantityChange?.(clamped);
  };

  const updateCurrentSelection = (patch: Partial<ComboItemSelection>) => {
    setStepError(null);
    setSelections((prev) => {
      const next = [...prev];
      next[activeStep] = { ...next[activeStep], ...patch };
      return next;
    });

    if (patch.selectedColor || patch.selectedColorImage) {
      const colName = patch.selectedColor || currentSelection.selectedColor || '';
      const colImg = patch.selectedColorImage || currentSelection.selectedColorImage || currentItem?.image;
      onActiveColorChange?.(colName, colImg, activeStep);
    }
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
          handleStepChange(idx);
          setStepError(`Vui lòng chọn charm cho "${item.title}".`);
          return false;
        }
      }

      // Omamori validation
      if (item.enableOmamoriSelection && item.omamoriSelectionRequired) {
        if (!sel.selectedOmamoris || sel.selectedOmamoris.length === 0) {
          handleStepChange(idx);
          setStepError(`Vui lòng chọn bùa Omamori cho "${item.title}".`);
          return false;
        }
      }

      // Khoen validation
      if (item.enableKhoenSelection && item.khoenSelectionRequired) {
        if (!sel.selectedKhoen) {
          handleStepChange(idx);
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
      handleStepChange(activeStep + 1);
    }
  };

  const handlePrevStep = () => {
    setStepError(null);
    if (activeStep > 0) {
      handleStepChange(activeStep - 1);
    }
  };

  // Calculate total extra price across all configured combo items
  const totalExtraPrice = selections.reduce((sum, sel) => {
    return sum + (sel.selectedCharmPrice || 0) + (sel.selectedOmamoriPrice || 0) + (sel.selectedKhoenPrice || 0);
  }, 0);

  const effectiveUnitPrice = (product.price || 0) + totalExtraPrice;
  const subtotalPrice = effectiveUnitPrice * quantity;
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

  // Active display image
  const currentPreviewImage =
    currentSelection?.selectedColorImage ||
    currentItem?.image ||
    product.image ||
    '/assets/hero-bg.png';

  const nextItem = activeStep < totalSteps - 1 ? comboItems[activeStep + 1] : null;
  const nextItemTitle = nextItem ? (nextItem.title || `Sản phẩm ${activeStep + 2}`) : `Sản phẩm ${activeStep + 2}`;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-neutral-200/90 p-4 sm:p-5 space-y-5 shadow-xs">
      {/* 1. Item Navigation Tabs - Users can switch freely anytime to inspect photos and customize */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-neutral-500 font-semibold px-0.5">
          <span>Chọn sản phẩm để xem ảnh & phối màu:</span>
          <span>{activeStep + 1} / {totalSteps} sản phẩm</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {comboItems.map((item, idx) => {
            const isActive = idx === activeStep;
            const sel = selections[idx];
            const itemThumb =
              sel?.selectedColorImage ||
              item.image ||
              product.image ||
              '/assets/hero-bg.png';

            const summaryColor = sel?.selectedColor;

            return (
              <button
                key={item.id || idx}
                type="button"
                onClick={() => handleStepChange(idx)}
                className={`group p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 select-none ${
                  isActive
                    ? 'bg-neutral-950 text-white border-neutral-950 shadow-md ring-2 ring-amber-400/40'
                    : 'bg-neutral-50/80 hover:bg-neutral-100/80 text-neutral-800 border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {/* Thumbnail Image */}
                <div
                  className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border transition-transform group-hover:scale-[1.03] ${
                    isActive ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <LoadingImage
                    src={itemThumb}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                        isActive
                          ? 'bg-amber-400 text-neutral-950'
                          : 'bg-neutral-200 text-neutral-700'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold truncate leading-tight">
                      {item.title}
                    </span>
                  </div>

                  <div
                    className={`text-[11px] truncate mt-1 ${
                      isActive ? 'text-neutral-300' : 'text-neutral-500'
                    }`}
                  >
                    {summaryColor ? `Màu: ${summaryColor}` : item.subtitle || `Sản phẩm ${idx + 1}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Active Item Customization Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="bg-neutral-50/60 rounded-2xl p-4 sm:p-5 border border-neutral-200/80 space-y-4"
        >
          {/* Item Header & Visual Photo Preview */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 pb-4 border-b border-neutral-200/80">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border border-neutral-200 overflow-hidden shrink-0 bg-white shadow-xs">
              <LoadingImage
                src={currentPreviewImage}
                alt={currentItem.title}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-neutral-950/70 backdrop-blur-xs text-white text-[9px] font-medium flex items-center gap-0.5">
                <Eye className="w-2.5 h-2.5" />
                <span>Ảnh mẫu</span>
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-950 text-[10px] font-bold">
                <span>Sản phẩm {activeStep + 1} / {totalSteps}</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight truncate">
                {currentItem.title}
              </h3>
              {currentItem.subtitle && (
                <p className="text-xs text-neutral-600 leading-relaxed">{currentItem.subtitle}</p>
              )}
            </div>
          </div>

          {/* Color Selection for this combo sub-item */}
          {currentItem.enableColorSelection !== false && currentItem.colorOptions && currentItem.colorOptions.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-900 block">
                  Màu sắc / Mẫu dây: <span className="text-amber-700 font-extrabold">{currentSelection.selectedColor}</span>
                </label>
                <span className="text-[11px] text-neutral-400">Chạm để chọn màu</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {currentItem.colorOptions.map((col, cIdx) => {
                  const isColActive = currentSelection.selectedColor === col.name;
                  return (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => {
                        updateCurrentSelection({
                          selectedColor: col.name,
                          selectedColorImage: col.image || currentSelection.selectedColorImage,
                        });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                        isColActive
                          ? 'bg-neutral-950 text-white border-neutral-950 shadow-xs ring-2 ring-amber-400/50'
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
                      {isColActive && <Check className="w-3 h-3 text-amber-400" />}
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
                title={currentItem.charmTitle || `Chọn Charm Cho Sản Phẩm ${activeStep + 1}`}
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
                title={currentItem.omamoriTitle || `Chọn Bùa Omamori Cho Sản Phẩm ${activeStep + 1}`}
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
                title={currentItem.khoenTitle || `Chọn Khoen Cài Cho Sản Phẩm ${activeStep + 1}`}
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

          {/* Navigation Controls inside Step */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-200/80">
            {activeStep > 0 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại sản phẩm trước</span>
              </button>
            ) : <span />}

            {!isLastStep ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer ml-auto"
              >
                <span>Xem & phối {nextItemTitle}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 3. Summary & Purchase Action Dock */}
      <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-4">
        <div className="flex items-center justify-between text-xs font-black text-neutral-800 uppercase tracking-wide">
          <span>Tóm tắt lựa chọn trọn bộ Combo:</span>
          {totalExtraPrice > 0 && (
            <span className="text-amber-700 font-bold">
              Phụ thu phụ kiện: +{totalExtraPrice.toLocaleString('vi-VN')}đ
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {comboItems.map((item, i) => {
            const sel = selections[i];
            return (
              <div key={i} className="p-2.5 bg-white rounded-xl border border-neutral-200 space-y-1 shadow-2xs">
                <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-neutral-900 text-white text-[10px] font-black flex items-center justify-center">
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

        {/* Quantity Selector & Subtotal Card - Exactly matching normal product page */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold text-neutral-600">Số lượng:</span>
            <div className="flex items-center border border-neutral-200 rounded-xl bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                disabled={quantity <= 1 || isOutOfStock}
                onClick={() => handleQtyChange(quantity - 1)}
                className="w-8 h-8 rounded-lg bg-neutral-50 hover:bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer text-sm"
                aria-label="Giảm số lượng"
              >
                -
              </button>
              <span className="w-10 text-center font-black text-sm text-neutral-950 font-mono">
                {quantity}
              </span>
              <button
                type="button"
                disabled={quantity >= availableStock || isOutOfStock}
                onClick={() => handleQtyChange(quantity + 1)}
                className="w-8 h-8 rounded-lg bg-neutral-50 hover:bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer text-sm"
                aria-label="Tăng số lượng"
              >
                +
              </button>
            </div>

            {/* Stock indicator */}
            {isOutOfStock || availableStock <= 0 ? (
              <span className="text-[11px] font-semibold text-rose-600">Hết hàng</span>
            ) : availableStock < 5 ? (
              <span className="text-[11px] font-medium text-amber-700">(chỉ còn {availableStock})</span>
            ) : (
              <span className="text-[11px] text-neutral-500">(còn {availableStock})</span>
            )}
          </div>

          <div className="text-right">
            <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Tổng tạm tính</div>
            <div className="text-base sm:text-lg font-black text-neutral-950 font-mono">
              {subtotalPrice.toLocaleString('vi-VN')}đ
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="pt-1 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleFinishAddToCart}
            className="w-full sm:flex-1 py-3.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Thêm Combo Vào Giỏ Hàng</span>
          </button>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleFinishBuyNow}
            className="w-full sm:flex-1 py-3.5 px-5 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
          >
            <span>Mua Ngay Trọn Bộ Combo</span>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
