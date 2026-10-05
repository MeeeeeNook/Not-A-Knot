import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, ZoomIn, RotateCw, CheckCircle2, AlertCircle, Image as ImageIcon, Sparkles, Clipboard, MousePointer, ShieldCheck, RefreshCw, Crop } from 'lucide-react';
import { uploadCustomPhotoImmediately } from '../firebase';
import { PhotoCropModal } from './PhotoCropModal';

interface ProductCustomPhotoSelectorProps {
  title?: string;
  description?: string;
  priceDelta?: number;
  isRequired?: boolean;
  aspectRatio?: string; // 'square' | 'portrait' | 'circle' | 'free'
  customPhotoUrl?: string;
  customPhotoNote?: string;
  onPhotoChange: (photoUrl: string | undefined, note?: string) => void;
  error?: string | null;
}

export const ProductCustomPhotoSelector: React.FC<ProductCustomPhotoSelectorProps> = ({
  title,
  description,
  priceDelta = 0,
  isRequired = false,
  aspectRatio = 'square',
  customPhotoUrl,
  customPhotoNote = '',
  onPhotoChange,
  error,
}) => {
  const displayTitle = title?.trim() || 'In ảnh theo yêu cầu';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingToCloud, setIsUploadingToCloud] = useState(false);
  const [uploadSuccessToast, setUploadSuccessToast] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [localNote, setLocalNote] = useState(customPhotoNote);
  const [pendingCropImage, setPendingCropImage] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // Validate file & launch crop adjustment interface
  const processImageFile = (file: File) => {
    if (!file) return;

    // 1. Strictly validate image format
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff)$/i.test(file.name);
    if (!isImage) {
      alert('Tệp được chọn không phải là định dạng ảnh. Vui lòng chỉ chọn tệp ảnh hợp lệ (JPG, PNG, HEIC, WEBP).');
      return;
    }

    // 2. Strictly validate maximum file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Dung lượng ảnh vượt quá 10MB. Vui lòng chọn ảnh có dung lượng tối đa 10MB.');
      return;
    }

    setIsProcessing(true);
    setUploadSuccessToast(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setIsProcessing(false);
      setPendingCropImage(src);
      setIsCropModalOpen(true);
    };
    reader.onerror = () => {
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  // Called when user confirms their crop adjustments in PhotoCropModal
  const handleCropConfirm = (croppedDataUrl: string) => {
    setIsCropModalOpen(false);
    setPendingCropImage(null);

    // 1. Immediately apply the cropped image
    onPhotoChange(croppedDataUrl, localNote);
    setIsUploadingToCloud(true);

    // 2. Start background upload to Firebase Storage
    uploadCustomPhotoImmediately(croppedDataUrl, 'custom_photos')
      .then((cloudUrl) => {
        setIsUploadingToCloud(false);
        if (cloudUrl && cloudUrl.startsWith('http')) {
          onPhotoChange(cloudUrl, localNote);
        }
        setUploadSuccessToast('Đã tải ảnh lên máy chủ thành công! ✨');
        setTimeout(() => setUploadSuccessToast(null), 3500);
      })
      .catch((err) => {
        setIsUploadingToCloud(false);
        console.warn('[ProductCustomPhotoSelector] Background upload fallback:', err);
      });
  };

  // Support pasting image from clipboard (Ctrl+V on desktop or paste on mobile)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        // If typing in text input, only intercept if clipboard specifically has an image file
        if (!e.clipboardData?.files || e.clipboardData.files.length === 0) {
          return;
        }
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [localNote]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleRotate = () => {
    if (!customPhotoUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        const rotated = canvas.toDataURL('image/jpeg', 0.86);
        onPhotoChange(rotated, localNote);
      }
    };
    img.src = customPhotoUrl;
  };

  const handleRemove = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onPhotoChange(undefined, '');
    setLocalNote('');
  };

  const handleNoteBlur = () => {
    onPhotoChange(customPhotoUrl, localNote);
  };

  // Determine shape styling based on aspect ratio
  const getShapeClass = () => {
    if (aspectRatio === 'circle') return 'rounded-full aspect-square';
    if (aspectRatio === 'portrait') return 'rounded-2xl aspect-[3/4]';
    return 'rounded-2xl aspect-square';
  };

  return (
    <div className="space-y-3 pt-2">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 tracking-wide">
            <Camera className="w-3.5 h-3.5 text-rose-500" />
            <span>{displayTitle}:</span>
            <span className="text-amber-800 font-semibold">
              {customPhotoUrl ? 'Đã tải ảnh' : isRequired ? 'Chưa chọn *' : 'Tùy chọn'}
            </span>
          </div>

          {customPhotoUrl && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full animate-in fade-in">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Sẵn sàng in</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {priceDelta > 0 && (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
              +{priceDelta.toLocaleString('vi-VN')}đ
            </span>
          )}

          {customPhotoUrl && !isRequired && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-[11px] font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Bỏ chọn
            </button>
          )}
        </div>
      </div>

      {/* Description / Guideline */}
      {description ? (
        <p className="text-[11px] text-slate-500 leading-relaxed bg-amber-50/40 p-2 rounded-xl border border-amber-200/50">
          💡 {description}
        </p>
      ) : (
        <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-200/60">
          💡 Tải ảnh rõ nét (chân dung, ảnh kỷ niệm, thú cưng...) để shop in và lồng ảnh chuẩn nét nhất.
        </p>
      )}

      {/* Upload & Preview Section */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!customPhotoUrl ? (
        /* Empty Upload Dropzone with Drag-and-Drop and Paste Support */
        <div
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-rose-400 ${
            isDragging
              ? 'border-rose-500 bg-rose-50/70 scale-[1.01] shadow-md ring-2 ring-rose-300'
              : error
              ? 'border-rose-400 bg-rose-50/30'
              : 'border-slate-300 hover:border-rose-400 bg-slate-50/60 hover:bg-rose-50/20'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-100 to-amber-100 border border-rose-200/70 flex items-center justify-center text-rose-500 shadow-2xs group-hover:scale-105 transition-transform">
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-6 h-6 text-rose-600" />
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-slate-800">
                {isProcessing ? 'Đang xử lý ảnh...' : 'Bấm chọn ảnh từ máy hoặc điện thoại'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Định dạng được hỗ trợ: JPG, PNG, HEIC, WEBP (Tối đa 10MB)
              </p>
            </div>

            {/* Drag & Drop and Paste badging */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs text-[10px] font-bold text-slate-700">
                <MousePointer className="w-3 h-3 text-rose-500" />
                <span>Kéo thả file ảnh vào đây</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-800">
                <Clipboard className="w-3 h-3 text-rose-600" />
                <span>Dán ảnh nhanh (Ctrl + V)</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Image Preview Box */
        <div className="p-3.5 bg-white rounded-2xl border border-rose-200/80 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Thumbnail Preview with shape guide */}
            <div className="relative group shrink-0">
              <div
                className={`relative w-24 sm:w-28 overflow-hidden border-2 border-rose-400 shadow-xs bg-slate-100 ${getShapeClass()}`}
              >
                <img
                  src={customPhotoUrl}
                  alt="Ảnh custom"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(true)}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                  title="Phóng to xem ảnh"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
              </div>

              {aspectRatio === 'circle' && (
                <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-slate-900 text-white text-[9px] font-bold">
                  Mặt tròn
                </span>
              )}
            </div>

            {/* Photo Info & Action Buttons */}
            <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
              <div>
                <span className="text-xs font-bold text-slate-900 block truncate">
                  Đã nhận ảnh kỷ niệm thành công
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-center sm:justify-start gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Shop sẽ căn chỉnh và in chuẩn nét theo khuôn</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>Đổi ảnh</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (customPhotoUrl) {
                      setPendingCropImage(customPhotoUrl);
                      setIsCropModalOpen(true);
                    }
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title="Căn chỉnh khung ảnh theo tỷ lệ"
                >
                  <Crop className="w-3 h-3 text-slate-600" />
                  <span>Căn chỉnh</span>
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title="Xoay ảnh 90 độ"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Xoay ảnh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(true)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <ZoomIn className="w-3 h-3" />
                  <span>Xem to</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Xóa ảnh</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick paste to replace notice */}
          <div className="text-[10px] text-slate-400 text-center sm:text-left">
            💡 Bạn cũng có thể kéo thả hoặc dán (Ctrl+V) ảnh mới vào đây bất cứ lúc nào để thay thế.
          </div>

          {/* Customer Customization Note for photo */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Ghi chú riêng (tùy chọn):
            </label>
            <input
              type="text"
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="VD: Cắt lấy mặt người chính diện, chừa viền trắng, in tông màu ấm..."
              maxLength={200}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-400 focus:bg-white text-slate-900 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Cloud Uploading In-Progress Status */}
      {isUploadingToCloud && (
        <div className="flex items-center gap-2 text-xs text-amber-900 bg-amber-50/90 border border-amber-200/90 px-3 py-2 rounded-xl animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-bold block">Đang tải ảnh lên đám mây...</span>
            <span className="text-[10px] text-amber-700">Vui lòng không tắt hoặc tải lại trang trong giây lát.</span>
          </div>
        </div>
      )}

      {/* Cloud Upload Success Toast Banner */}
      {uploadSuccessToast && !isUploadingToCloud && (
        <div className="flex items-center gap-2 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl animate-in fade-in slide-in-from-top-1 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{uploadSuccessToast}</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {previewModalOpen && customPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-3xl p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-rose-500" />
                <span>Xem trước ảnh in của bạn</span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-center p-2 bg-slate-900 rounded-2xl overflow-hidden max-h-[65vh]">
              <img
                src={customPhotoUrl}
                alt="Ảnh phóng to"
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Định dạng khuôn in: <strong>{aspectRatio === 'circle' ? 'Hình tròn (Locket)' : aspectRatio === 'portrait' ? 'Khung dọc' : 'Hình vuông'}</strong></span>
              <button
                type="button"
                onClick={handleRotate}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Xoay 90°</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Photo Crop & Alignment Modal */}
      {isCropModalOpen && pendingCropImage && (
        <PhotoCropModal
          isOpen={isCropModalOpen}
          imageSrc={pendingCropImage}
          aspectRatio={aspectRatio}
          onConfirm={handleCropConfirm}
          onCancel={() => {
            setIsCropModalOpen(false);
            setPendingCropImage(null);
          }}
        />
      )}
    </div>
  );
};

