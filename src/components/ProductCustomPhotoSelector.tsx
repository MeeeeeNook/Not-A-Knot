import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, ZoomIn, RotateCw, CheckCircle2, AlertCircle, Clipboard, MousePointer, RefreshCw, Crop, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { uploadCustomPhotoImmediately } from '../firebase';
import { PhotoCropModal } from './PhotoCropModal';

export interface ProductCustomPhotoSelectorProps {
  title?: string;
  description?: string;
  priceDelta?: number;
  isRequired?: boolean;
  aspectRatio?: string; // 'square' | 'portrait' | 'circle' | 'free'
  customPhotoUrl?: string;
  customPhotoUrls?: string[];
  customPhotoNote?: string;
  onPhotoChange: (photoUrl: string | undefined, note?: string) => void;
  onPhotosChange?: (photoUrls: string[], note?: string) => void;
  onQuantityChange?: (newQuantity: number) => void;
  currentQuantity?: number;
  error?: string | null;
}

export const ProductCustomPhotoSelector: React.FC<ProductCustomPhotoSelectorProps> = ({
  title,
  description,
  priceDelta = 0,
  isRequired = false,
  aspectRatio = 'square',
  customPhotoUrl,
  customPhotoUrls,
  customPhotoNote = '',
  onPhotoChange,
  onPhotosChange,
  onQuantityChange,
  currentQuantity = 1,
  error,
}) => {
  const displayTitle = title?.trim() || 'In ảnh theo yêu cầu';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingToCloud, setIsUploadingToCloud] = useState(false);
  const [uploadSuccessToast, setUploadSuccessToast] = useState<string | null>(null);

  // Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewActiveIndex, setPreviewActiveIndex] = useState(0);

  // Note
  const [localNote, setLocalNote] = useState(customPhotoNote);

  // Crop Modal state
  const [pendingCropImages, setPendingCropImages] = useState<string[]>([]);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // Normalize photo list
  const activePhotoList = React.useMemo(() => {
    if (customPhotoUrls && customPhotoUrls.length > 0) {
      return customPhotoUrls;
    }
    if (customPhotoUrl) {
      return [customPhotoUrl];
    }
    return [];
  }, [customPhotoUrl, customPhotoUrls]);

  const hasPhotos = activePhotoList.length > 0;

  useEffect(() => {
    setLocalNote(customPhotoNote);
  }, [customPhotoNote]);

  // Read files and open crop modal
  const processFiles = (files: FileList | File[], appendMode = false) => {
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isImage = f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff)$/i.test(f.name);
      if (!isImage) {
        alert(`Tệp "${f.name}" không phải định dạng ảnh hợp lệ.`);
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        alert(`Ảnh "${f.name}" vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn 10MB.`);
        continue;
      }
      validFiles.push(f);
    }

    if (validFiles.length === 0) return;

    setIsProcessing(true);
    setUploadSuccessToast(null);

    const readers = validFiles.map((f) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(f);
      });
    });

    Promise.all(readers).then((dataUrls) => {
      setIsProcessing(false);
      if (appendMode && hasPhotos) {
        setPendingCropImages([...activePhotoList, ...dataUrls]);
      } else {
        setPendingCropImages(dataUrls);
      }
      setIsCropModalOpen(true);
    });
  };

  // Called when user confirms crop adjustments
  const handleCropConfirmMultiple = (croppedDataUrls: string[]) => {
    setIsCropModalOpen(false);
    setPendingCropImages([]);

    if (croppedDataUrls.length === 0) return;

    // Apply photos
    if (onPhotosChange) {
      onPhotosChange(croppedDataUrls, localNote);
    }
    onPhotoChange(croppedDataUrls[0], localNote);

    // If multiple photos chosen, update quantity so 1 photo = 1 item
    if (onQuantityChange) {
      const targetQty = Math.max(1, croppedDataUrls.length);
      onQuantityChange(targetQty);
    }

    // Background upload to cloud
    setIsUploadingToCloud(true);
    Promise.all(
      croppedDataUrls.map((dataUrl) =>
        uploadCustomPhotoImmediately(dataUrl, 'custom_photos').catch(() => dataUrl)
      )
    )
      .then((cloudUrls) => {
        setIsUploadingToCloud(false);
        const validUrls = cloudUrls.filter(Boolean) as string[];
        if (validUrls.length > 0 && validUrls.some((u) => u.startsWith('http'))) {
          if (onPhotosChange) {
            onPhotosChange(validUrls, localNote);
          }
          onPhotoChange(validUrls[0], localNote);
        }
        setUploadSuccessToast(
          croppedDataUrls.length > 1
            ? `Đã lưu ${croppedDataUrls.length} ảnh in lên hệ thống! ✨`
            : 'Đã tải ảnh lên máy chủ thành công! ✨'
        );
        setTimeout(() => setUploadSuccessToast(null), 3500);
      })
      .catch((err) => {
        setIsUploadingToCloud(false);
        console.warn('[ProductCustomPhotoSelector] Upload error:', err);
      });
  };

  const handleCropConfirmSingle = (croppedDataUrl: string) => {
    handleCropConfirmMultiple([croppedDataUrl]);
  };

  // Support pasting image from clipboard
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (!e.clipboardData?.files || e.clipboardData.files.length === 0) {
          return;
        }
      }

      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        processFiles(files, false);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [localNote, activePhotoList]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files, false);
    }
    e.target.value = '';
  };

  const handleAppendFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files, true);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files, false);
    }
  };

  const handleRemoveAll = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onPhotosChange) onPhotosChange([], '');
    onPhotoChange(undefined, '');
    setLocalNote('');
  };

  const handleRemoveSinglePhoto = (idxToRemove: number) => {
    const updated = activePhotoList.filter((_, idx) => idx !== idxToRemove);
    if (updated.length === 0) {
      handleRemoveAll();
      return;
    }
    if (onPhotosChange) {
      onPhotosChange(updated, localNote);
    }
    onPhotoChange(updated[0], localNote);
    if (onQuantityChange) {
      onQuantityChange(Math.max(1, updated.length));
    }
  };

  const handleRotateSingle = (idxToRotate: number) => {
    const targetUrl = activePhotoList[idxToRotate];
    if (!targetUrl) return;

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

        const updated = [...activePhotoList];
        updated[idxToRotate] = rotated;
        if (onPhotosChange) onPhotosChange(updated, localNote);
        onPhotoChange(updated[0], localNote);
      }
    };
    img.src = targetUrl;
  };

  const handleNoteBlur = () => {
    if (onPhotosChange) {
      onPhotosChange(activePhotoList, localNote);
    }
    onPhotoChange(activePhotoList[0], localNote);
  };

  // Shape class
  const getShapeClass = () => {
    if (aspectRatio === 'circle') return 'rounded-full aspect-square';
    if (aspectRatio === 'portrait') return 'rounded-xl aspect-[3/4]';
    return 'rounded-xl aspect-square';
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
              {hasPhotos
                ? `Đã chọn ${activePhotoList.length} ảnh (${activePhotoList.length} sản phẩm)`
                : isRequired
                ? 'Chưa chọn *'
                : 'Tùy chọn'}
            </span>
          </div>

          {hasPhotos && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full animate-in fade-in">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Sẵn sàng in</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {priceDelta > 0 && (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
              +{priceDelta.toLocaleString('vi-VN')}đ / ảnh
            </span>
          )}

          {hasPhotos && !isRequired && (
            <button
              type="button"
              onClick={handleRemoveAll}
              className="text-[11px] font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Bỏ chọn tất cả
            </button>
          )}
        </div>
      </div>

      {/* Description / Guideline */}
      {description && (
        <p className="text-[11px] text-slate-500 leading-relaxed bg-amber-50/40 p-2 rounded-xl border border-amber-200/50">
          💡 {description}
        </p>
      )}

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        type="file"
        ref={appendFileInputRef}
        multiple
        accept="image/*"
        onChange={handleAppendFileSelect}
        className="hidden"
      />

      {!hasPhotos ? (
        /* Empty Upload Dropzone */
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
                {isProcessing ? 'Đang xử lý ảnh...' : 'Bấm chọn một hoặc nhiều ảnh từ máy'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Mỗi ảnh tương ứng 1 sản phẩm. Có thể chọn nhiều ảnh cùng lúc.
              </p>
            </div>

            {/* Drag & Drop and Paste badging */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs text-[10px] font-bold text-slate-700">
                <MousePointer className="w-3 h-3 text-rose-500" />
                <span>Kéo thả nhiều ảnh vào đây</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-800">
                <Clipboard className="w-3 h-3 text-rose-600" />
                <span>Dán ảnh nhanh (Ctrl + V)</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Image Preview Gallery */
        <div className="p-3.5 bg-white rounded-2xl border border-rose-200/80 shadow-xs space-y-3">
          {/* Photos Strip / Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Danh sách {activePhotoList.length} ảnh đã chọn ({activePhotoList.length} sản phẩm):</span>
              <button
                type="button"
                onClick={() => appendFileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 font-bold bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Thêm ảnh khác</span>
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
              {activePhotoList.map((photoUrl, idx) => (
                <div
                  key={idx}
                  className="relative group bg-slate-100 rounded-xl border border-rose-200 overflow-hidden shadow-2xs"
                >
                  <div className={`relative w-full overflow-hidden ${getShapeClass()}`}>
                    <img
                      src={photoUrl}
                      alt={`Ảnh in #${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {/* Index badge */}
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/75 text-white text-[10px] font-mono font-bold z-10">
                      #{idx + 1}
                    </span>

                    {/* Hover actions overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 z-20">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewActiveIndex(idx);
                          setPreviewModalOpen(true);
                        }}
                        className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Xem to"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingCropImages(activePhotoList);
                          setIsCropModalOpen(true);
                        }}
                        className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Cắt / Căn chỉnh"
                      >
                        <Crop className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRotateSingle(idx)}
                        className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Xoay 90 độ"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSinglePhoto(idx)}
                        className="w-7 h-7 rounded-full bg-rose-600/90 hover:bg-rose-700 text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Xóa ảnh này"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add more button tile in grid */}
              <button
                type="button"
                onClick={() => appendFileInputRef.current?.click()}
                className={`border-2 border-dashed border-slate-200 hover:border-rose-400 bg-slate-50 hover:bg-rose-50/30 flex flex-col items-center justify-center text-slate-400 hover:text-rose-600 transition-all cursor-pointer ${getShapeClass()}`}
                title="Chọn thêm ảnh khác"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-bold mt-1">Thêm ảnh</span>
              </button>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPendingCropImages(activePhotoList);
                  setIsCropModalOpen(true);
                }}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Crop className="w-3 h-3 text-slate-600" />
                <span>Căn chỉnh tất cả ảnh</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Upload className="w-3 h-3" />
                <span>Chọn lại ảnh</span>
              </button>
            </div>
          </div>

          {/* Customer Customization Note for photos */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Yêu cầu in:
            </label>
            <input
              type="text"
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="VD: Cắt lấy mặt chính diện, chừa viền trắng, chỉnh màu sáng ấm..."
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
            <span className="font-bold block">Đang tải ảnh in lên hệ thống...</span>
            <span className="text-[10px] text-amber-700">Ảnh đang được đồng bộ an toàn.</span>
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

      {/* Lightbox Zoom Modal with switch arrows */}
      {previewModalOpen && activePhotoList.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">
                Ảnh in #{previewActiveIndex + 1}/{activePhotoList.length}
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative flex items-center justify-center bg-slate-900 rounded-2xl overflow-hidden min-h-[260px] max-h-[70vh]">
              {activePhotoList.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPreviewActiveIndex((prev) => (prev > 0 ? prev - 1 : activePhotoList.length - 1))}
                  className="absolute left-2 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              <img
                src={activePhotoList[previewActiveIndex]}
                alt=""
                className="max-h-[60vh] max-w-full object-contain"
              />

              {activePhotoList.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPreviewActiveIndex((prev) => (prev < activePhotoList.length - 1 ? prev + 1 : 0))}
                  className="absolute right-2 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Thumbnail navigation */}
            {activePhotoList.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 overflow-x-auto py-1">
                {activePhotoList.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPreviewActiveIndex(i)}
                    className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                      i === previewActiveIndex
                        ? 'border-rose-500 scale-105 ring-2 ring-rose-200'
                        : 'border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multi-Image Photo Crop Modal */}
      <PhotoCropModal
        isOpen={isCropModalOpen}
        imageSrcs={pendingCropImages}
        aspectRatio={aspectRatio}
        onConfirm={handleCropConfirmSingle}
        onConfirmMultiple={handleCropConfirmMultiple}
        onCancel={() => {
          setIsCropModalOpen(false);
          setPendingCropImages([]);
        }}
      />
    </div>
  );
};
