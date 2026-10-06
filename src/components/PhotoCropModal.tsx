import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Minus, Plus, RotateCw, RotateCcw } from 'lucide-react';

export interface PhotoCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  aspectRatio?: 'square' | 'circle' | 'portrait' | 'free' | string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

export const PhotoCropModal: React.FC<PhotoCropModalProps> = ({
  isOpen,
  imageSrc,
  aspectRatio = 'square',
  onConfirm,
  onCancel,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [freeRatioChoice, setFreeRatioChoice] = useState<'original' | '1:1' | '3:4' | '4:3' | '16:9'>('original');

  // Load natural dimensions of image
  useEffect(() => {
    if (isOpen && imageSrc) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setFreeRatioChoice('original');

      const img = new Image();
      img.onload = () => {
        setImageNaturalSize({
          width: img.naturalWidth || img.width || 800,
          height: img.naturalHeight || img.height || 800,
        });
      };
      img.src = imageSrc;
    }
  }, [isOpen, imageSrc]);

  // Determine viewport dimensions based on aspect ratio
  const { boxW, boxH, isCircle } = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const baseSize = isMobile ? 260 : 320;

    if (aspectRatio === 'circle') {
      return {
        boxW: baseSize,
        boxH: baseSize,
        isCircle: true,
      };
    }

    if (aspectRatio === 'portrait') {
      return {
        boxW: Math.round(baseSize * 0.75),
        boxH: baseSize,
        isCircle: false,
      };
    }

    if (aspectRatio === 'free') {
      let targetRatio = 1;
      if (freeRatioChoice === 'original') {
        targetRatio =
          imageNaturalSize.width && imageNaturalSize.height
            ? imageNaturalSize.width / imageNaturalSize.height
            : 1;
      } else if (freeRatioChoice === '1:1') {
        targetRatio = 1;
      } else if (freeRatioChoice === '3:4') {
        targetRatio = 3 / 4;
      } else if (freeRatioChoice === '4:3') {
        targetRatio = 4 / 3;
      } else if (freeRatioChoice === '16:9') {
        targetRatio = 16 / 9;
      }

      let w = baseSize;
      let h = baseSize;
      if (targetRatio >= 1) {
        w = baseSize;
        h = Math.round(baseSize / targetRatio);
        if (h < 150) {
          h = 150;
          w = Math.min(340, Math.round(150 * targetRatio));
        }
      } else {
        h = baseSize;
        w = Math.round(baseSize * targetRatio);
        if (w < 150) {
          w = 150;
          h = Math.min(340, Math.round(150 / targetRatio));
        }
      }
      return { boxW: w, boxH: h, isCircle: false };
    }

    // Default: square 1:1
    return {
      boxW: baseSize,
      boxH: baseSize,
      isCircle: false,
    };
  }, [aspectRatio, freeRatioChoice, imageNaturalSize]);

  // Base dimensions ensuring image ALWAYS completely covers the crop box
  const natW = imageNaturalSize.width || 800;
  const natH = imageNaturalSize.height || 800;
  const baseScale = Math.max(boxW / natW, boxH / natH);
  const baseImgW = natW * baseScale;
  const baseImgH = natH * baseScale;

  // Rotation math: calculate bounding box of crop viewport to guarantee no empty gaps
  const rad = (Math.abs(rotation) * Math.PI) / 180;
  const neededW = boxW * Math.cos(rad) + boxH * Math.sin(rad);
  const neededH = boxW * Math.sin(rad) + boxH * Math.cos(rad);

  // Minimum zoom to prevent any corner exposure when rotated
  const minZoomForRotation = Math.max(1, neededW / baseImgW, neededH / baseImgH);
  const effectiveZoom = Math.max(zoom, minZoomForRotation);

  // Current scaled image dimensions
  const currImgW = baseImgW * effectiveZoom;
  const currImgH = baseImgH * effectiveZoom;

  // Maximum allowed pan offset so image strictly covers the frame at all times
  const maxPanX = Math.max(0, (currImgW - neededW) / 2);
  const maxPanY = Math.max(0, (currImgH - neededH) / 2);

  // Clamp helper to enforce 100% fill boundary
  const clampPan = useCallback(
    (p: { x: number; y: number }, customMaxX?: number, customMaxY?: number) => {
      const maxX = typeof customMaxX === 'number' ? customMaxX : maxPanX;
      const maxY = typeof customMaxY === 'number' ? customMaxY : maxPanY;
      return {
        x: Math.max(-maxX, Math.min(maxX, p.x)),
        y: Math.max(-maxY, Math.min(maxY, p.y)),
      };
    },
    [maxPanX, maxPanY]
  );

  // Auto-clamp pan whenever zoom, rotation, or box dimensions change
  useEffect(() => {
    setPan((prev) => clampPan(prev));
  }, [zoom, rotation, boxW, boxH, clampPan]);

  // Pointer drag handling for pan (supports desktop mouse and mobile touch)
  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
    panStartRef.current = { ...pan };
  };

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      const nextPan = {
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      };
      setPan(clampPan(nextPan));
    },
    [isDragging, clampPan]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setPan((prev) => clampPan(prev));
  }, [clampPan]);

  // Global mouse listeners while dragging
  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const onMouseUp = () => handlePointerUp();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  // Execute Canvas Crop & Export High-Res JPEG
  const handleSave = () => {
    if (!imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const outputScale = 3;
      const outW = Math.round(boxW * outputScale);
      const outH = Math.round(boxH * outputScale);

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill solid background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);

      // If circle crop, clip canvas as circle
      if (isCircle) {
        ctx.beginPath();
        ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      }

      // Center transformations
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.translate(pan.x * outputScale, pan.y * outputScale);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(effectiveZoom, effectiveZoom);

      const drawW = baseImgW * outputScale;
      const drawH = baseImgH * outputScale;

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const format = isCircle ? 'image/png' : 'image/jpeg';
      const croppedDataUrl = canvas.toDataURL(format, 0.92);
      onConfirm(croppedDataUrl);
    };
    img.src = imageSrc;
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0f141c]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 select-none"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md bg-[#181f2a] rounded-3xl border border-slate-700/60 shadow-2xl p-4 sm:p-6 text-white space-y-3.5 sm:space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Close Button */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {aspectRatio === 'circle'
                ? 'Căn chỉnh ảnh tròn'
                : aspectRatio === 'portrait'
                ? 'Căn chỉnh ảnh 3:4'
                : aspectRatio === 'free'
                ? 'Căn chỉnh ảnh tự do'
                : 'Căn chỉnh ảnh vuông'}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-slate-300 hover:text-white cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Crop Frame Container */}
        <div className="flex items-center justify-center py-1">
          <div
            className={`relative overflow-hidden bg-black/60 shadow-inner flex items-center justify-center border-2 border-white/80 cursor-grab active:cursor-grabbing transition-[width,height] duration-200 ${
              isCircle ? 'rounded-full' : 'rounded-none'
            }`}
            style={{ width: `${boxW}px`, height: `${boxH}px` }}
            onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 1) {
                handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchEnd={handlePointerUp}
          >
            {/* The Draggable / Scalable Image (Strictly covers entire box) */}
            <img
              src={imageSrc}
              alt="Ảnh cần cắt"
              className="max-w-none pointer-events-none transition-transform duration-75 select-none"
              style={{
                width: `${baseImgW}px`,
                height: `${baseImgH}px`,
                objectFit: 'cover',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${effectiveZoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
              draggable={false}
            />

            {/* 3x3 Grid Lines (Rule of thirds) */}
            <div className={`absolute inset-0 pointer-events-none ${isCircle ? 'rounded-full' : 'rounded-none'}`}>
              <div className="absolute top-[33.33%] left-0 right-0 h-[1px] bg-white/30" />
              <div className="absolute top-[66.66%] left-0 right-0 h-[1px] bg-white/30" />
              <div className="absolute left-[33.33%] top-0 bottom-0 w-[1px] bg-white/30" />
              <div className="absolute left-[66.66%] top-0 bottom-0 w-[1px] bg-white/30" />
            </div>
          </div>
        </div>

        {/* Free Ratio Selector Chips (Only shown if mode is 'free') */}
        {aspectRatio === 'free' && (
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-slate-400 font-semibold mr-1">Tỷ lệ:</span>
            {[
              { id: 'original', label: 'Gốc (Toàn bộ)' },
              { id: '1:1', label: '1:1' },
              { id: '3:4', label: '3:4' },
              { id: '4:3', label: '4:3' },
              { id: '16:9', label: '16:9' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setFreeRatioChoice(r.id as any);
                  setZoom(1);
                  setRotation(0);
                  setPan({ x: 0, y: 0 });
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  freeRatioChoice === r.id
                    ? 'bg-amber-400 text-slate-950 shadow-xs scale-105'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {/* Controls Section (Vietnamese labels + small Reset buttons) */}
        <div className="space-y-3 pt-0.5">
          {/* Thu phóng (Zoom) Slider with Reset button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 px-1">
              <div className="flex items-center gap-2">
                <span>Thu phóng</span>
                {zoom !== 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer inline-flex items-center gap-1 font-normal"
                    title="Đặt lại mức thu phóng ban đầu"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Đặt lại</span>
                  </button>
                )}
              </div>
              <span className="font-mono text-[11px] text-amber-400 font-bold">{Math.round(effectiveZoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(1, +(prev - 0.1).toFixed(2)))}
                className="w-8 h-8 rounded-full border border-dashed border-white/40 hover:border-white/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.02"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(3, +(prev + 0.1).toFixed(2)))}
                className="w-8 h-8 rounded-full border border-dashed border-white/40 hover:border-white/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Cân chỉnh góc (Straighten) Slider with Reset button & 90° button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 px-1">
              <div className="flex items-center gap-2">
                <span>Cân chỉnh góc ({rotation}°)</span>
                {rotation !== 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRotation(0);
                      setPan({ x: 0, y: 0 });
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer inline-flex items-center gap-1 font-normal"
                    title="Đặt lại góc xoay về 0°"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>0°</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1 cursor-pointer transition-colors"
                title="Xoay 90 độ"
              >
                <RotateCw className="w-3 h-3" />
                <span>+90°</span>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRotation((prev) => Math.max(-45, prev - 5))}
                className="w-8 h-8 rounded-full border border-dashed border-white/40 hover:border-white/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={rotation}
                onChange={(e) => setRotation(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <button
                type="button"
                onClick={() => setRotation((prev) => Math.min(45, prev + 5))}
                className="w-8 h-8 rounded-full border border-dashed border-white/40 hover:border-white/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Big Prominent Save Button */}
        <div className="pt-1.5">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3 sm:py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-rose-900/40 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>LƯU ẢNH</span>
          </button>
        </div>
      </div>
    </div>
  );
};
