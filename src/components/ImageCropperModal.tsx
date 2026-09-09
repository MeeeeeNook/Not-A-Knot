import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCw, ZoomIn, ZoomOut, Move, Crop, RefreshCw, Sparkles, Layers, Maximize2 } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onApplyCrop: (croppedDataUrl: string, cropRatio?: string) => void;
  initialAspectRatio?: '16:9' | '21:9' | 'fullscreen' | '9:16' | '4:5' | '4:3' | '1:1' | 'free';
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageUrl,
  onClose,
  onApplyCrop,
  initialAspectRatio = '16:9'
}) => {
  const [aspectRatioMode, setAspectRatioMode] = useState<'16:9' | '21:9' | 'fullscreen' | '9:16' | '4:5' | '4:3' | '1:1' | 'free'>(initialAspectRatio);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [panX, setPanX] = useState<number>(0); // in pixels offset
  const [panY, setPanY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; startPanX: number; startPanY: number } | null>(null);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 640, height: 360 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Reset controls when opened or image changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPanX(0);
      setPanY(0);
      setImageLoaded(false);
    }
  }, [isOpen, imageUrl]);

  // Track container size
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
    setImageLoaded(true);
    setPanX(0);
    setPanY(0);
  };

  // Drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      startPanX: panX,
      startPanY: panY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setPanX(dragStart.startPanX + deltaX);
    setPanY(dragStart.startPanY + deltaY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // Touch handlers for mobile/tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({
        x: touch.clientX,
        y: touch.clientY,
        startPanX: panX,
        startPanY: panY
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !dragStart || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;
    setPanX(dragStart.startPanX + deltaX);
    setPanY(dragStart.startPanY + deltaY);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.max(0.5, Math.min(3.5, Number((prev + zoomDelta).toFixed(2)))));
  };

  // Get current crop viewport aspect ratio ratio number
  const getAspectRatioValue = () => {
    switch (aspectRatioMode) {
      case '9:16':
        return 9 / 16;
      case '4:5':
        return 4 / 5;
      case '16:9':
        return 16 / 9;
      case '21:9':
        return 21 / 9;
      case 'fullscreen':
        return 16 / 9.5; // Optimized full screen billboard proportion
      case '4:3':
        return 4 / 3;
      case '1:1':
        return 1;
      case 'free':
      default:
        return imageSize.width && imageSize.height ? imageSize.width / imageSize.height : 16 / 9;
    }
  };

  // Generate cropped output on offscreen canvas
  const handleApply = () => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const cropTargetAspect = getAspectRatioValue();

    // Standard high-res target output dimensions (1080px width for smartphone portrait, 1920px for desktop)
    const isMobileAspect = aspectRatioMode === '9:16' || aspectRatioMode === '4:5';
    const targetWidth = isMobileAspect ? 1080 : 1920;
    const targetHeight = Math.round(targetWidth / cropTargetAspect);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear canvas with dark slate background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Calculate crop window dimensions relative to container
    const cWidth = containerRef.current.clientWidth;
    const cHeight = containerRef.current.clientHeight;

    // Save context state for transforms
    ctx.save();

    // Center translation
    ctx.translate(targetWidth / 2, targetHeight / 2);

    // Apply rotation
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    // Scale ratio from preview container to target canvas
    const scaleFactor = targetWidth / cWidth;

    // Translate pan coordinates scaled to target
    ctx.translate(panX * scaleFactor, panY * scaleFactor);

    // Draw scaled image centered
    const baseImgWidth = cWidth * zoom;
    const baseImgHeight = (baseImgWidth / (imageSize.width || 1)) * (imageSize.height || 1);

    const drawW = baseImgWidth * scaleFactor;
    const drawH = baseImgHeight * scaleFactor;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

    ctx.restore();

    // Convert to WebP / JPEG Data URL with ultra-high quality
    let croppedDataUrl = '';
    try {
      croppedDataUrl = canvas.toDataURL('image/webp', 0.96);
      if (!croppedDataUrl || !croppedDataUrl.startsWith('data:image/webp')) {
        croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      }
    } catch {
      croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    }
    onApplyCrop(croppedDataUrl, aspectRatioMode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn select-none font-sans">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Studio Cắt & Căn Chỉnh Khung Hình Banner</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/30">
                  1920 × 1080 Standard
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Kéo chuột để di chuyển ảnh, xoay hoặc phóng to để vừa khít với kích thước mong muốn.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aspect Ratio Toolbar */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Tỷ lệ cắt:</span>
            
            <button
              type="button"
              onClick={() => { setAspectRatioMode('9:16'); setPanX(0); setPanY(0); }}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                aspectRatioMode === '9:16'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              📱 9:16 Điện Thoại (1080×1920)
            </button>

            <button
              type="button"
              onClick={() => { setAspectRatioMode('4:5'); setPanX(0); setPanY(0); }}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                aspectRatioMode === '4:5'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              📸 4:5 Dọc (1080×1350)
            </button>

            <button
              type="button"
              onClick={() => { setAspectRatioMode('16:9'); setPanX(0); setPanY(0); }}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                aspectRatioMode === '16:9'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              🎬 16:9 Máy Tính
            </button>

            <button
              type="button"
              onClick={() => { setAspectRatioMode('fullscreen'); setPanX(0); setPanY(0); }}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                aspectRatioMode === 'fullscreen'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              🖥️ Toàn Màn Hình
            </button>

            <button
              type="button"
              onClick={() => { setAspectRatioMode('21:9'); setPanX(0); setPanY(0); }}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                aspectRatioMode === '21:9'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              🎞️ 21:9 Cinematic
            </button>

            <button
              type="button"
              onClick={() => { setAspectRatioMode('4:3'); setPanX(0); setPanY(0); }}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                aspectRatioMode === '4:3'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              4:3
            </button>

            <button
              type="button"
              onClick={() => { setAspectRatioMode('1:1'); setPanX(0); setPanY(0); }}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                aspectRatioMode === '1:1'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              1:1 Vuông
            </button>

            <button
              type="button"
              onClick={() => { setAspectRatioMode('free'); setPanX(0); setPanY(0); }}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                aspectRatioMode === 'free'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              🖼️ 100% Ảnh Gốc
            </button>
          </div>

          {/* Reset Quick Action */}
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setRotation(0);
              setPanX(0);
              setPanY(0);
            }}
            className="text-[11px] font-semibold text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Khôi phục căn giữa</span>
          </button>
        </div>

        {/* Main Crop Viewport Stage */}
        <div className="flex-1 bg-slate-950 p-4 sm:p-6 overflow-hidden flex items-center justify-center min-h-[300px]">
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            style={{
              aspectRatio: `${getAspectRatioValue()}`
            }}
            className={`relative w-full max-w-3xl max-h-[50vh] rounded-xl overflow-hidden border-2 border-amber-500 shadow-2xl select-none bg-black flex items-center justify-center ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* The Image being transformed */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Crop target"
              onLoad={handleImageLoad}
              draggable={false}
              className="max-w-none transition-transform duration-75 pointer-events-none select-none"
              style={{
                width: `${containerSize.width * zoom}px`,
                transform: `translate(${panX}px, ${panY}px) rotate(${rotation}deg)`,
                transformOrigin: 'center center'
              }}
            />

            {/* Rule of Thirds Guide Grid */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-white/15" />
              <div className="border-r border-white/15" />
              <div />
            </div>

            {/* Hint overlay on hover */}
            <div className="absolute bottom-2 left-2 z-20 pointer-events-none bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] text-slate-300 font-mono flex items-center gap-1.5 border border-white/10">
              <Move className="w-3 h-3 text-amber-400" />
              <span>Kéo để căn chỉnh | Cuộn chuột để Phóng to/Thu nhỏ</span>
            </div>
          </div>
        </div>

        {/* Bottom Adjustment Controls */}
        <div className="px-5 py-4 bg-slate-950 border-t border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Zoom Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-slate-300 font-semibold">
                  <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                  <span>Thu phóng (Zoom):</span>
                </div>
                <span className="font-mono text-amber-400 font-bold">{Math.round(zoom * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(3.0, Number((prev + 0.1).toFixed(2))))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Rotate Controls */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-slate-300 font-semibold">
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Xoay góc:</span>
                </div>
                <span className="font-mono text-amber-400 font-bold">{rotation}°</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>-90°</span>
                </button>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="1"
                  value={rotation > 180 ? rotation - 360 : rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>+90°</span>
                </button>
              </div>
            </div>

          </div>

          {/* Action Footer Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 transition-all shadow-lg hover:shadow-amber-500/20 active:scale-98 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Áp Dụng Cắt Ảnh Này</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
