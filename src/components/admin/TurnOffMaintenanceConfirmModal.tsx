import React, { useState } from 'react';
import { AlertTriangle, Power, ShieldAlert, CheckCircle2, ArrowRight, X, Loader2, Sparkles } from 'lucide-react';

export interface TurnOffMaintenanceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  adminName?: string;
  brandName?: string;
}

export const TurnOffMaintenanceConfirmModal: React.FC<TurnOffMaintenanceConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  adminName = 'Quản trị viên',
  brandName = 'NOT A KNOT'
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirmAction = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Lỗi khi tắt chế độ bảo trì:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Decorative Top Accent Bar */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-500 w-full" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7 space-y-4">
          {/* Header Icon & Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200 shadow-xs">
              <Power className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                Tắt chế độ bảo trì?
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mở lại website cho khách hàng truy cập
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Bạn có chắc chắn muốn tắt chế độ bảo trì và mở lại hệ thống cửa hàng <strong className="text-slate-900">{brandName}</strong> không?
          </p>

          {/* Action Buttons: Xác nhận tắt & Hủy */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleConfirmAction}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tắt...</span>
                </>
              ) : (
                <>
                  <Power className="w-4 h-4" />
                  <span>Xác nhận tắt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
