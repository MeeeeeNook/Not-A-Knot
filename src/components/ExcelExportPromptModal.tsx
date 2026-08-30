import React, { useState } from 'react';
import { FileSpreadsheet, Image, Archive, Download, X, Loader2, CheckCircle } from 'lucide-react';

interface ExcelExportPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  itemCountInfo?: string;
  onConfirm: (includeImages: boolean, onProgress: (msg: string) => void) => Promise<void>;
}

export const ExcelExportPromptModal: React.FC<ExcelExportPromptModalProps> = ({
  isOpen,
  onClose,
  title = 'Xuất File Excel Báo Cáo',
  description = 'Bạn có muốn tải về toàn bộ hình ảnh đính kèm (Ảnh sản phẩm, Bill chuyển khoản, Banner) cùng với file Excel không?',
  itemCountInfo,
  onConfirm
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleExportChoice = async (includeImages: boolean) => {
    setIsProcessing(true);
    setProgressMessage(includeImages ? 'Đang chuẩn bị dữ liệu và hình ảnh...' : 'Đang tạo file Excel...');
    try {
      await onConfirm(includeImages, (msg) => setProgressMessage(msg));
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Lỗi xuất file:', err);
      alert('Có lỗi xảy ra trong quá trình xuất: ' + (err.message || 'Thử lại sau'));
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn font-sans">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-slate-900 animate-scaleUp">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">{title}</h3>
              {itemCountInfo && <p className="text-[11px] text-slate-500 font-medium">{itemCountInfo}</p>}
            </div>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {isProcessing ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="font-bold text-sm text-slate-800">{progressMessage}</p>
              <p className="text-xs text-slate-400">Vui lòng đợi giây lát trong khi hệ thống đóng gói file...</p>
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-600 leading-relaxed bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4">
                <p className="font-semibold text-amber-900 mb-1">💡 Tùy chọn tải về:</p>
                <p>{description}</p>
              </div>

              {/* Option Cards */}
              <div className="grid grid-cols-1 gap-3">
                {/* Option 1: Excel Only */}
                <button
                  type="button"
                  onClick={() => handleExportChoice(false)}
                  className="w-full p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 flex items-center justify-between text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-800">
                        Chỉ tải file Excel (.xlsx)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Xuất nhanh bảng tính dữ liệu chuẩn, dung lượng nhẹ
                      </div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                </button>

                {/* Option 2: Excel + Images Zip */}
                <button
                  type="button"
                  onClick={() => handleExportChoice(true)}
                  className="w-full p-4 rounded-2xl border-2 border-amber-400 bg-amber-50/40 hover:bg-amber-50 flex items-center justify-between text-left transition-all group cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 shadow-xs">
                      <Archive className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-black text-xs text-slate-950 flex items-center gap-1.5">
                        <span>Tải Excel kèm tất cả hình ảnh (.zip)</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[9px] font-extrabold">
                          Khuyên dùng
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Bao gồm file Excel và thư mục ảnh bill CK, ảnh sản phẩm, banner
                      </div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-amber-700 shrink-0" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isProcessing && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
            >
              Hủy
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
