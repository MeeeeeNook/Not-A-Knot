import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  QrCode, 
  Copy, 
  Check, 
  Download, 
  Share2, 
  Facebook, 
  Smartphone,
  ExternalLink
} from 'lucide-react';
import QRCode from 'qrcode';
import { Product } from '../types';
import { resolveAssetUrl } from '../firebase';
import { getProductSlug } from '../utils/slugify';

interface ShareProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  categoryName?: string;
}

export const ShareProductModal: React.FC<ShareProductModalProps> = ({
  isOpen,
  onClose,
  product,
  categoryName
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canonical official website clean URL without hash (#)
  const slug = getProductSlug(product);
  const baseOrigin = typeof window !== 'undefined' && window.location.hostname.includes('notaknot.id.vn')
    ? 'https://notaknot.id.vn'
    : (typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://notaknot.id.vn');
  const productUrl = `${baseOrigin}/product/${slug}`;

  // Generate QR Code when modal opens
  useEffect(() => {
    if (!isOpen || !productUrl) return;

    setIsGenerating(true);
    QRCode.toDataURL(productUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0f172a', // Slate-900
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        setQrDataUrl(url);
        setIsGenerating(false);
      })
      .catch((err) => {
        console.error('Failed to generate QR Code:', err);
        setIsGenerating(false);
      });
  }, [isOpen, productUrl]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(productUrl);
      } else {
        const input = document.createElement('input');
        input.value = productUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${getProductSlug(product)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${product.name} - NOT A KNOT`,
          text: `Xem mẫu thủ công "${product.name}" tại NOT A KNOT:`,
          url: productUrl,
        });
      } catch {
        // User cancelled or failed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleFacebookShare = () => {
    const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;
    window.open(fbShareUrl, '_blank', 'width=600,height=500');
  };

  const handleZaloShare = () => {
    const zaloShareUrl = `https://zalo.me/share?url=${encodeURIComponent(productUrl)}`;
    window.open(zaloShareUrl, '_blank', 'width=600,height=500');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          id="share-product-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans select-none"
        >
          {/* Backdrop click area */}
          <div 
            className="absolute inset-0"
            onClick={onClose}
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                    Chia Sẻ Sản Phẩm
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Quét mã QR hoặc sao chép link gửi cho bạn bè
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Product Mini Header Preview */}
              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-white shrink-0 border border-slate-200">
                  <img
                    src={resolveAssetUrl(product.image)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {categoryName && (
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
                      {categoryName}
                    </span>
                  )}
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                    {product.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-black text-rose-600">
                      {product.price.toLocaleString('vi-VN')}₫
                    </span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="text-[11px] text-slate-400 line-through">
                        {product.originalPrice.toLocaleString('vi-VN')}₫
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* QR Code Center Display */}
              <div className="flex flex-col items-center justify-center p-5 bg-[#FAF8F5] rounded-3xl border-2 border-dashed border-slate-200">
                <div className="bg-white p-3.5 rounded-2xl shadow-md border border-slate-200/80 flex items-center justify-center min-w-[200px] min-h-[200px]">
                  {isGenerating ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                      <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium">Đang tạo mã QR...</span>
                    </div>
                  ) : qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`Mã QR ${product.name}`}
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                    />
                  ) : (
                    <span className="text-xs text-rose-500">Không thể tạo mã QR</span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-slate-600 text-xs text-center font-medium">
                  <Smartphone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Dùng Camera điện thoại hoặc Zalo để quét</span>
                </div>

                {/* Download QR Button */}
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  disabled={!qrDataUrl}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Tải ảnh mã QR (.png)</span>
                </button>
              </div>

              {/* URL Input & Quick Copy */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Đường dẫn sản phẩm:</span>
                  {copied && (
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Đã chép vào bộ nhớ!
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      readOnly
                      value={productUrl}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-700 truncate focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Social Share Buttons */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Chia sẻ nhanh qua mạng xã hội:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleFacebookShare}
                    className="py-2.5 px-3 rounded-xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#1877F2]/20 active:scale-98"
                  >
                    <Facebook className="w-4 h-4" />
                    <span>Facebook</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleZaloShare}
                    className="py-2.5 px-3 rounded-xl bg-[#0068FF]/10 hover:bg-[#0068FF]/20 text-[#0068FF] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#0068FF]/20 active:scale-98"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Zalo</span>
                  </button>
                </div>

                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Chia sẻ qua ứng dụng khác (AirDrop / Tin nhắn)</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
