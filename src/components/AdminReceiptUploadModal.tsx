import React, { useState, useRef, useEffect } from 'react';
import { StoredOrder, saveOrderToFirestore } from '../firebase';

interface AdminReceiptUploadModalProps {
  order: StoredOrder;
  onClose: () => void;
  onSaved?: (updatedOrder: StoredOrder) => void;
  onSave?: (updatedOrder: StoredOrder) => void;
  onSaveReceipt?: (orderId: string, receiptUrl: string, paymentStatus: 'paid' | 'unpaid') => void;
  onSkip?: () => void;
  isPromptOnPaid?: boolean;
}

export const AdminReceiptUploadModal: React.FC<AdminReceiptUploadModalProps> = ({
  order,
  onClose,
  onSaved,
  onSave,
  onSaveReceipt,
  onSkip,
  isPromptOnPaid = false
}) => {
  const [receiptImage, setReceiptImage] = useState<string>(order.bankReceiptImage || '');
  const [bankRef, setBankRef] = useState<string>(order.bankTransferRef || '');
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process & compress image
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setReceiptImage(compressed);
        } else {
          setReceiptImage(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Listen to paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            processImageFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const total = order.totalPrice || order.totalAmount || 0;
      const updated: StoredOrder = {
        ...order,
        paymentStatus: 'paid',
        paidAmount: total,
        bankReceiptImage: receiptImage || undefined,
        bankTransferRef: bankRef.trim() || order.bankTransferRef,
        status: order.status === 'Đã đặt' || order.status === 'pending' ? 'Đã thanh toán' : order.status
      };

      await saveOrderToFirestore(updated);
      if (typeof onSaved === 'function') {
        onSaved(updated);
      } else if (typeof onSave === 'function') {
        onSave(updated);
      }
      if (typeof onSaveReceipt === 'function') {
        onSaveReceipt(order.id!, receiptImage, 'paid');
      }
      onClose();
    } catch (err) {
      console.error('Lỗi khi lưu ảnh bill:', err);
      alert('Không thể lưu ảnh bill. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipAction = async () => {
    if (onSkip) {
      onSkip();
      return;
    }
    setIsSaving(true);
    try {
      const total = order.totalPrice || order.totalAmount || 0;
      const updated: StoredOrder = {
        ...order,
        paymentStatus: 'paid',
        paidAmount: total,
        status: order.status === 'Đã đặt' || order.status === 'pending' ? 'Đã thanh toán' : order.status
      };
      await saveOrderToFirestore(updated);
      if (typeof onSaved === 'function') {
        onSaved(updated);
      } else if (typeof onSave === 'function') {
        onSave(updated);
      }
      if (typeof onSaveReceipt === 'function') {
        onSaveReceipt(order.id!, '', 'paid');
      }
      onClose();
    } catch (err) {
      console.error('Lỗi khi cập nhật thanh toán:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalAmount = order.totalPrice || order.totalAmount || 0;
  const customerName = order.name || order.customerName || 'Khách hàng';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              {isPromptOnPaid ? 'Xác Nhận Đã Thanh Toán' : 'Cập Nhật Ảnh Bill Chuyển Khoản'}
            </h3>
            <p className="text-xs text-slate-500">
              Đơn hàng #{order.id} • {customerName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-slate-400 hover:text-slate-900 rounded hover:bg-slate-100 text-xs font-bold transition-colors"
          >
            Đóng [X]
          </button>
        </div>

        {/* Order Summary Mini Box */}
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 block">Số tiền cần thanh toán:</span>
            <span className="font-bold text-slate-900 text-sm">
              {totalAmount.toLocaleString('vi-VN')}đ
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block">SĐT khách:</span>
            <span className="font-bold text-slate-800">{order.phone || 'Chưa có SĐT'}</span>
          </div>
        </div>

        {/* Upload & Dropzone Area */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            Ảnh chụp hóa đơn / Bill chuyển khoản
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {!receiptImage ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-slate-500 bg-slate-100'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'
              }`}
            >
              <p className="text-xs font-bold text-slate-900">
                Kéo thả ảnh bill vào đây hoặc Bấm để tải lên từ máy
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Hoặc nhấn phím <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono font-bold">Ctrl + V</kbd> để dán ảnh trực tiếp từ clipboard
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center gap-3">
              <div className="shrink-0">
                <img
                  src={receiptImage}
                  alt="Bill preview"
                  className="w-16 h-16 rounded object-cover border border-slate-300 cursor-pointer"
                  onClick={() => setPreviewZoom(true)}
                />
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-800 block">
                  Đã tải ảnh Bill chuyển khoản
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Ảnh đã sẵn sàng đính kèm vào đơn hàng
                </p>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(true)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-[10px] font-bold"
                  >
                    Xem phóng to
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[10px] font-bold"
                  >
                    Đổi ảnh khác
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceiptImage('')}
                    className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-[10px] font-bold"
                  >
                    Xóa ảnh
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transaction Reference / Note */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Mã giao dịch / Nội dung CK (Tùy chọn)
          </label>
          <input
            type="text"
            value={bankRef}
            onChange={(e) => setBankRef(e.target.value)}
            placeholder="Ví dụ: MB-883921 / NAK 0912345678"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
          {isPromptOnPaid ? (
            <button
              type="button"
              onClick={handleSkipAction}
              disabled={isSaving}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold"
            >
              Bỏ qua (Làm sau)
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold"
            >
              Hủy
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors"
          >
            {isSaving ? 'Đang lưu...' : 'Nộp ảnh & Lưu'}
          </button>
        </div>

        {/* Zoom Lightbox */}
        {previewZoom && receiptImage && (
          <div
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewZoom(false)}
          >
            <div className="relative max-w-xl w-full bg-white p-3 rounded-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 mb-2">
                <span className="text-xs font-bold text-slate-800">Ảnh Bill phóng to</span>
                <button
                  onClick={() => setPreviewZoom(false)}
                  className="px-2 py-1 text-slate-400 hover:text-slate-800 rounded text-xs font-bold"
                >
                  Đóng [X]
                </button>
              </div>
              <img
                src={receiptImage}
                alt="Bill Full"
                className="max-h-[70vh] w-auto mx-auto rounded object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
