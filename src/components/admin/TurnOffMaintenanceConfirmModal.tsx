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
  const [hasConfirmedCheckbox, setHasConfirmedCheckbox] = useState(false);

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
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Decorative Top Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-500 w-full" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
          title="Đóng hộp thoại"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7">
          {/* Header Badge & Icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-xs border border-amber-200">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Xác nhận Quản Trị Viên
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Bảo mật hệ thống</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug mt-0.5">
                Xác nhận TẮT chế độ bảo trì?
              </h2>
            </div>
          </div>

          {/* Description & Impact List */}
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
            Hệ thống cửa hàng trực tuyến <strong className="text-slate-900">{brandName}</strong> đang trong trạng thái đóng cửa để bảo trì. Khi bạn xác nhận tắt bảo trì:
          </p>

          <div className="space-y-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-700 mb-5">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                ✓
              </span>
              <div>
                <strong className="text-slate-900 block font-bold">Mở khóa truy cập toàn bộ Website</strong>
                <span className="text-slate-500">Khách hàng sẽ ngay lập tức truy cập lại trang chủ, danh mục sản phẩm và các trang sự kiện.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                ✓
              </span>
              <div>
                <strong className="text-slate-900 block font-bold">Kích hoạt lại hệ thống đặt hàng & giỏ hàng</strong>
                <span className="text-slate-500">Người mua có thể thêm sản phẩm, áp dụng voucher và gửi đơn hàng mới như bình thường.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                ℹ
              </span>
              <div>
                <strong className="text-slate-900 block font-bold">Người thực hiện tác vụ</strong>
                <span className="text-slate-500">Quyền hạn Quản trị viên: <strong className="text-slate-800">{adminName}</strong></span>
              </div>
            </div>
          </div>

          {/* Optional confirmation checkbox */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer select-none mb-6 group hover:bg-amber-50 transition-colors">
            <input
              type="checkbox"
              checked={hasConfirmedCheckbox}
              onChange={(e) => setHasConfirmedCheckbox(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
            />
            <span className="text-xs text-amber-900 font-semibold group-hover:text-amber-950">
              Tôi đã kiểm tra kỹ thông tin và sẵn sàng mở lại website đón khách.
            </span>
          </label>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy (Tiếp tục bảo trì)
            </button>

            <button
              type="button"
              onClick={handleConfirmAction}
              disabled={isSubmitting || !hasConfirmedCheckbox}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang mở website...</span>
                </>
              ) : (
                <>
                  <Power className="w-4 h-4" />
                  <span>Xác nhận TẮT Bảo Trì & Mở Website</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
