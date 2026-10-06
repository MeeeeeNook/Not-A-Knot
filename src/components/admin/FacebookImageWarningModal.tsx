import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ExternalLink, X, Download, ShieldAlert, ArrowRight, Check, Sparkles, RefreshCw } from 'lucide-react';
import { compressBase64Image } from '../../firebase';

/**
 * Checks whether a given string is a Facebook CDN image URL (which expires in 24-48 hours)
 */
export const isFacebookImageUrl = (url?: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  
  // Facebook CDN domains & image paths
  if (
    trimmed.includes('fbcdn.net') ||
    trimmed.includes('scontent.') ||
    trimmed.includes('scontent-') ||
    trimmed.includes('fna.fbcdn') ||
    trimmed.includes('lookaside.fbsbx.com') ||
    trimmed.includes('fbsbx.com') ||
    (trimmed.includes('facebook.com') && (trimmed.includes('/photo') || trimmed.includes('/photos/') || trimmed.includes('safe_image.php') || trimmed.includes('oh=')))
  ) {
    return true;
  }
  return false;
};

/**
 * Programmatically triggers the Facebook Image Warning Modal anywhere in the app
 */
export const triggerFacebookImageWarning = (url: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('facebook-image-warning', {
        detail: { url }
      })
    );
  }
};

interface FacebookImageWarningModalProps {
  isOpen?: boolean;
  imageUrl?: string;
  onClose?: () => void;
  onConfirmUseAnyway?: () => void;
}

export const FacebookImageWarningModal: React.FC<FacebookImageWarningModalProps> = ({
  isOpen: controlledIsOpen,
  imageUrl: controlledImageUrl,
  onClose: controlledOnClose,
  onConfirmUseAnyway: controlledOnConfirm
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);

  const isControlled = controlledIsOpen !== undefined;
  const isVisible = isControlled ? controlledIsOpen : internalIsOpen;
  const activeUrl = isControlled ? controlledImageUrl || '' : currentUrl;

  const handleAutoDownloadAndSave = async () => {
    if (!activeUrl) return;
    setIsAutoSaving(true);
    setAutoSaveError(null);
    try {
      const res = await fetch('/api/import-external-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeUrl })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể tải ảnh từ liên kết này');
      }

      // Compress to high-fidelity WebP/JPEG base64 format for Firestore permanence
      let finalData = data.base64;
      try {
        finalData = await compressBase64Image(data.base64, 1200, 1200, 0.88);
      } catch {}

      // Dispatch event for any active form/manager to consume the permanent data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('facebook-image-imported', {
            detail: {
              originalUrl: activeUrl,
              permanentBase64: finalData,
              permanentUrl: data.permanentUrl
            }
          })
        );
      }

      handleClose();
    } catch (err: any) {
      console.warn('Lỗi tự động tải ảnh:', err);
      setAutoSaveError(err?.message || 'Không thể tải ảnh tự động. Bạn vui lòng tải ảnh về máy rồi tải lên.');
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleClose = useCallback(() => {
    if (isControlled) {
      controlledOnClose?.();
    } else {
      setInternalIsOpen(false);
    }
  }, [isControlled, controlledOnClose]);

  const handleProceedAnyway = () => {
    if (isControlled) {
      controlledOnConfirm?.();
    } else {
      setInternalIsOpen(false);
    }
  };

  // Listen to programmatic custom events and global paste events across Admin
  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ url: string }>;
      const url = customEvent.detail?.url || '';
      if (isFacebookImageUrl(url)) {
        setCurrentUrl(url);
        setInternalIsOpen(true);
      }
    };

    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Check if user is typing/pasting into an input or textarea
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tagName = target.tagName?.toLowerCase();
      const isInput = tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
      if (!isInput) return;

      const pastedText = e.clipboardData?.getData('text') || '';
      if (isFacebookImageUrl(pastedText)) {
        setCurrentUrl(pastedText.trim());
        setInternalIsOpen(true);
      }
    };

    window.addEventListener('facebook-image-warning', handleCustomEvent);
    document.addEventListener('paste', handleGlobalPaste);

    return () => {
      window.removeEventListener('facebook-image-warning', handleCustomEvent);
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none animate-fadeIn">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-amber-200/80 overflow-hidden relative animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Amber Status Bar */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 h-2 w-full" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer"
          title="Đóng cảnh báo"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-7">
          {/* Header with Alert Icon */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-md mb-1">
                Lưu ý quan trọng về hình ảnh
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                Link ảnh Facebook sẽ hết hạn sau 24 – 48 giờ!
              </h3>
            </div>
          </div>

          {/* Explanation Body */}
          <div className="space-y-3.5 text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
            <p className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 text-amber-900">
              Bạn vừa dán đường dẫn ảnh từ máy chủ CDN của Facebook (<span className="font-mono text-xs font-semibold">fbcdn.net / scontent</span>).
              Hệ thống bảo mật của Facebook sẽ <strong>tự động khóa và vô hiệu hóa liên kết này sau 24 đến 48 giờ</strong> (mã lỗi 403 Forbidden). 
              Khi hết hạn, ảnh sẽ <strong>không còn hiển thị</strong> được cho khách hàng trên website!
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                <span>💡 Cách khắc phục chuẩn xác:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 text-xs sm:text-[13px] leading-relaxed pl-1">
                <li>
                  <strong>Tải ảnh về máy:</strong> Nhấp vào nút bên dưới để mở ảnh gốc và lưu về thiết bị.
                </li>
                <li>
                  <strong>Tải ảnh lên trực tiếp:</strong> Dùng nút chọn tệp hoặc kéo thả file ảnh vào khung để lưu trữ vĩnh viễn an toàn trên Cloud của hệ thống.
                </li>
              </ol>
            </div>

            {/* Display Active Link with Quick Action */}
            {activeUrl && (
              <div className="pt-1">
                <div className="text-[11px] font-medium text-slate-500 mb-1 flex items-center justify-between">
                  <span>Liên kết đã nhận diện:</span>
                  <a
                    href={activeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 hover:underline font-semibold"
                  >
                    <Download className="w-3 h-3" />
                    <span>Mở ảnh để tải về</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[11px] truncate select-all">
                  {activeUrl}
                </div>
              </div>
            )}

            {autoSaveError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                ⚠️ {autoSaveError}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleProceedAnyway}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors cursor-pointer text-center"
            >
              Vẫn giữ link này
            </button>

            {activeUrl && (
              <button
                type="button"
                disabled={isAutoSaving}
                onClick={handleAutoDownloadAndSave}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
              >
                {isAutoSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    <span>Đang tự động tải & lưu vĩnh viễn...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                    <span>⚡ Tự động tải về & lưu vĩnh viễn</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Đóng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
