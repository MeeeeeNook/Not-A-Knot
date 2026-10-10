import React from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';

export interface PhotoDeleteSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: string[];
  productName?: string;
  itemQuantity?: number;
  onDeletePhoto: (photoIndex: number) => void;
  onDecreaseQuantityOnly?: () => void;
}

export const PhotoDeleteSelectModal: React.FC<PhotoDeleteSelectModalProps> = ({
  isOpen,
  onClose,
  photos,
  productName,
  itemQuantity,
  onDeletePhoto,
  onDecreaseQuantityOnly,
}) => {
  if (!isOpen || photos.length === 0) return null;

  const currentQty = itemQuantity ?? photos.length;
  const uniquePhotos = Array.from(new Set(photos.filter(Boolean)));
  const isSharedPhoto = uniquePhotos.length <= 1;
  const canDecreaseWithoutDeleting = Boolean(onDecreaseQuantityOnly && (currentQty > photos.length || isSharedPhoto));

  return (
    <div
      className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 sm:p-6 text-slate-900 space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-1 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {photos.length > 1
                  ? 'Chọn ảnh cần xóa để giảm số lượng'
                  : 'Xác nhận xóa ảnh in theo yêu cầu'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {productName ? `${productName} • ` : ''}Đang có {photos.length} ảnh in • Số lượng hiện tại: {currentQty}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          {photos.length > 1
            ? `Mỗi sản phẩm tương ứng với 1 ảnh in. Để giảm bớt số lượng, vui lòng bấm chọn ảnh bạn muốn bỏ bớt:`
            : currentQty > 1
              ? `Bạn đang có ${currentQty} sản phẩm dùng chung 1 ảnh in này. Bạn muốn giảm bớt 1 sản phẩm nhưng vẫn giữ ảnh in?`
              : `Bạn có muốn gỡ bỏ ảnh in này khỏi sản phẩm trong giỏ hàng?`}
        </p>

        {/* Action when Qty > 1 and sharing photo: decrease item quantity while keeping photo */}
        {(onDecreaseQuantityOnly && (currentQty > photos.length || photos.length === 1 || isSharedPhoto)) && (
          <div className="p-3 bg-amber-50/90 rounded-2xl border border-amber-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="text-[11px] text-amber-950 font-medium">
              Giữ nguyên ảnh in cho {Math.max(1, currentQty - 1)} sản phẩm còn lại.
            </div>
            <button
              type="button"
              onClick={() => {
                if (onDecreaseQuantityOnly) onDecreaseQuantityOnly();
                onClose();
              }}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer shadow-2xs"
            >
              ✓ Giảm 1 món (Giữ lại ảnh in)
            </button>
          </div>
        )}

        {/* Photos Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photoUrl, idx) => (
              <div
                key={idx}
                className="relative group bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:border-rose-400 transition-all flex flex-col"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-slate-200">
                  <img
                    src={photoUrl}
                    alt={`Ảnh #${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-mono font-bold backdrop-blur-xs">
                    Ảnh #{idx + 1}
                  </span>
                </div>
                <div className="p-2 bg-white">
                  <button
                    type="button"
                    onClick={() => {
                      if ((photos.length <= 1 || isSharedPhoto) && currentQty > 1 && onDecreaseQuantityOnly) {
                        onDecreaseQuantityOnly();
                      } else {
                        onDeletePhoto(idx);
                      }
                      onClose();
                    }}
                    className="w-full py-1.5 px-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{(photos.length <= 1 || isSharedPhoto) && currentQty > 1 ? 'Giảm 1 món (Giữ ảnh)' : 'Bỏ bớt ảnh này'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Hủy / Giữ nguyên ({currentQty} món)
          </button>
        </div>
      </div>
    </div>
  );
};
