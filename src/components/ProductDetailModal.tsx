import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { X, Check, ShieldCheck, Truck, ShoppingBag } from 'lucide-react';
import { trackGA4ViewItem } from '../utils/analytics';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (
    product: Product,
    quantity: number,
    selectedColor?: string,
    selectedSize?: string
  ) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart
}) => {
  if (!product) return null;

  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isAdded, setIsAdded] = useState(false);

  useEffect(() => {
    if (product) {
      trackGA4ViewItem(product);
    }
  }, [product?.id]);

  const images = product.images && product.images.length > 0 ? product.images : [product.image];

  const availableStock = typeof product.stock === 'number' ? product.stock : 15;
  const isOutOfStock = product.inStock === false || availableStock <= 0;

  const handleAdd = () => {
    if (isOutOfStock) return;
    onAddToCart(product, quantity);
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
      onClose();
    }, 1000);
  };

  return (
    <div
      id="product-detail-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="product-detail-modal-content"
        className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden relative border border-neutral-200 my-auto text-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          id="close-product-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full transition-colors"
          aria-label="Đóng cửa sổ"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Images Section */}
          <div className="bg-neutral-50 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-neutral-200">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-white shadow-sm mb-4">
              <img
                src={images[activeImageIdx]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {product.isEvent0209 && (
                <div className="absolute top-3 left-3 bg-brand-red text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                  Bản giới hạn 02.09
                </div>
              )}
            </div>

            {/* Thumbnail switcher */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImageIdx(i)}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                      i === activeImageIdx
                        ? 'border-neutral-900'
                        : 'border-neutral-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="thumb" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info & Options */}
          <div className="p-6 sm:p-8 flex flex-col justify-between max-h-[85vh] overflow-y-auto">
            <div className="space-y-4">
              {/* Category */}
              <span className="text-xs font-semibold uppercase text-neutral-500 tracking-wider block">
                {product.category === 'event_0209'
                  ? 'Sự kiện Quốc khánh 02.09'
                  : product.category === 'event_2010'
                  ? 'BST 20/10 — Quà Tặng Nàng'
                  : product.category === 'charm_bracelet'
                  ? 'Vòng Charm Biểu Tượng'
                  : product.category === 'everyday'
                  ? 'Everyday Wear — Đeo Hàng Ngày'
                  : product.category === 'bracelets'
                  ? 'Vòng Tay Paracord 550'
                  : product.category === 'keychains'
                  ? 'Móc Khóa EDC'
                  : product.category === 'lanyards'
                  ? 'Dây Đeo Phụ Kiện'
                  : 'Phụ Kiện Thủ Công'}
              </span>

              {/* Title & Stock badge */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 tracking-tight">
                    {product.name}
                  </h2>
                  {isOutOfStock ? (
                    <span className="bg-red-100 text-brand-red text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      Hết hàng
                    </span>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Còn {availableStock} sản phẩm
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-neutral-950">
                  {product.price.toLocaleString('vi-VN')}đ
                </span>
                {product.originalPrice && (
                  <span className="text-sm text-neutral-400 line-through font-normal">
                    {product.originalPrice.toLocaleString('vi-VN')}đ
                  </span>
                )}
                {product.discountBadge && !isOutOfStock && (
                  <span className="bg-red-50 text-brand-red text-xs font-semibold px-2 py-0.5 rounded-full border border-red-200">
                    {product.discountBadge}
                  </span>
                )}
              </div>

              {/* Out of Stock Notice */}
              {isOutOfStock && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-xs text-brand-red font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-red flex-shrink-0 animate-ping" />
                  <span>Sản phẩm này hiện đã hết hàng trong kho. Quý khách có thể liên hệ trực tiếp để được thông báo khi có hàng lại!</span>
                </div>
              )}

              {/* Description */}
              <p className="text-neutral-600 text-xs sm:text-sm leading-relaxed">
                {product.description}
              </p>

              {/* Product Specifications list */}
              {product.details && product.details.length > 0 && (
                <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 space-y-1.5">
                  <span className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wider block">
                    Đặc điểm sản phẩm
                  </span>
                  {product.details.map((detail, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-neutral-600 font-normal">
                      <span className="text-neutral-400">•</span>
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quantity */}
              {!isOutOfStock && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs font-semibold text-neutral-700">Số lượng:</span>
                  <div className="flex items-center border border-neutral-300 rounded-full overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-1 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 text-xs font-semibold text-neutral-900 min-w-[28px] text-center">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                      disabled={quantity >= availableStock}
                      className="px-3 py-1 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-neutral-50 text-neutral-700 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                  {quantity >= availableStock && (
                    <span className="text-[11px] text-amber-700 font-medium">Tối đa theo tồn kho</span>
                  )}
                </div>
              )}
            </div>

            {/* Single Apple-style Action Button */}
            <div className="pt-6 border-t border-neutral-200 mt-6 space-y-2">
              <button
                id="modal-add-to-cart-btn"
                type="button"
                onClick={handleAdd}
                disabled={isOutOfStock}
                className={`w-full py-3.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
                  isOutOfStock
                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none'
                    : isAdded
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-950 text-white hover:bg-neutral-800'
                }`}
              >
                {isOutOfStock ? (
                  <span>Tạm Hết Hàng</span>
                ) : isAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Đã thêm vào giỏ hàng</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Thêm vào giỏ ({quantity}) — {(product.price * quantity).toLocaleString('vi-VN')}đ</span>
                  </>
                )}
              </button>

              {/* Messenger consultation link */}
              <a
                id="modal-messenger-contact-btn"
                href="https://www.facebook.com/profile.php?id=61593591390851"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-full border border-neutral-300 hover:border-neutral-900 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4 text-[#0084FF] fill-current flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.908 1.455 5.503 3.735 7.152V22l3.447-1.892c.905.251 1.865.388 2.818.388 5.523 0 10-4.145 10-9.238C22 6.145 17.523 2 12 2zm1.05 12.355l-2.673-2.85-5.215 2.85 5.735-6.09 2.741 2.85 5.147-2.85-5.735 6.09z" />
                </svg>
                <span>Nhắn tin tư vấn sản phẩm qua Messenger</span>
              </a>

              <div className="flex items-center justify-center gap-4 text-[11px] text-neutral-500 pt-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-neutral-700" />
                  Bảo hành trọn đời
                </span>
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-neutral-700" />
                  Giao hàng toàn quốc
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
