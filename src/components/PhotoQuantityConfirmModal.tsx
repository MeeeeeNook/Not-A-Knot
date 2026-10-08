import React from 'react';
import { Camera, Copy, X } from 'lucide-react';

export interface PhotoQuantityConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl?: string;
  photosCount?: number;
  productName?: string;
  onReusePhoto: () => void;
  onAddNewPhoto: () => void;
}

export const PhotoQuantityConfirmModal: React.FC<PhotoQuantityConfirmModalProps> = ({
  isOpen,
  onClose,
  photoUrl,
  photosCount = 1,
  productName,
  onReusePhoto,
  onAddNewPhoto,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 sm:p-6 text-slate-900 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - No title, only close button */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thumbnail Preview & Question */}
        <div className="flex items-center gap-3.5 p-3 bg-slate-50 rounded-2xl border border-slate-200">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Ảnh in hiện tại"
              className="w-14 h-14 object-cover rounded-xl border border-slate-300 shadow-2xs shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
              <Camera className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 line-clamp-1">
              {productName || 'Sản phẩm có in ảnh theo yêu cầu'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Đang có {photosCount} ảnh in cho sản phẩm này.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-slate-600 leading-relaxed">
            Bạn muốn <strong className="text-slate-900 font-black">dùng lại ảnh này</strong> cho sản phẩm tiếp theo, hay muốn <strong className="text-slate-900 font-black">thêm ảnh khác</strong>?
          </p>
        </div>

        {/* Actions - Grey Buttons (No black, no red) */}
        <div className="grid grid-cols-1 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              onReusePhoto();
              onClose();
            }}
            className="w-full py-3 px-4 bg-gray-500 hover:bg-gray-600 active:scale-98 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Copy className="w-4 h-4 text-gray-200" />
            <span>Dùng lại ảnh này</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onAddNewPhoto();
              onClose();
            }}
            className="w-full py-3 px-4 bg-gray-200 hover:bg-gray-300 active:scale-98 text-gray-800 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer border border-gray-300"
          >
            <Camera className="w-4 h-4 text-gray-600" />
            <span>Thêm ảnh khác</span>
          </button>
        </div>
      </div>
    </div>
  );
};
