import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Minus, Plus, RotateCw, RotateCcw, ChevronLeft, ChevronRight, Trash2, PlusCircle, Check } from 'lucide-react';

export interface PhotoCropModalProps {
  isOpen: boolean;
  imageSrc?: string;
  imageSrcs?: string[];
  initialIndex?: number;
  aspectRatio?: 'square' | 'circle' | 'portrait' | 'free' | string;
  onConfirm: (croppedDataUrl: string) => void;
  onConfirmMultiple?: (croppedDataUrls: string[]) => void;
  onCancel: () => void;
}

interface CropConfig {
  zoom: number;
  rotation: number;
  pan: { x: number; y: number };
  freeRatioChoice: 'original' | '1:1' | '3:4' | '4:3' | '16:9';
}

export const PhotoCropModal: React.FC<PhotoCropModalProps> = ({
  isOpen,
  imageSrc,
  imageSrcs,
  initialIndex = 0,
  aspectRatio = 'square',
  onConfirm,
  onConfirmMultiple,
  onCancel,
}) => {
  // Normalize images list
  const getInitialList = useCallback(() => {
    return imageSrcs && imageSrcs.length > 0 ? [...imageSrcs] : imageSrc ? [imageSrc] : [];
  }, [imageSrc, imageSrcs]);

  const [imageList, setImageList] = useState<string[]>(() => {
    return imageSrcs && imageSrcs.length > 0 ? [...imageSrcs] : imageSrc ? [imageSrc] : [];
  });
  const [currentIndex, setCurrentIndex] = useState(() => {
    const list = imageSrcs && imageSrcs.length > 0 ? imageSrcs : imageSrc ? [imageSrc] : [];
    return Math.min(Math.max(0, initialIndex), Math.max(0, list.length - 1));
  });
  const [configs, setConfigs] = useState<{ [key: number]: CropConfig }>(() => {
    const list = imageSrcs && imageSrcs.length > 0 ? imageSrcs : imageSrc ? [imageSrc] : [];
    const initConfigs: { [key: number]: CropConfig } = {};
    list.forEach((_, idx) => {
      initConfigs[idx] = {
        zoom: 1,
        rotation: 0,
        pan: { x: 0, y: 0 },
        freeRatioChoice: 'original',
      };
    });
    return initConfigs;
  });
  const [isSavingAll, setIsSavingAll] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset when modal opens or input props change
  useEffect(() => {
    if (isOpen) {
      const list = imageSrcs && imageSrcs.length > 0 ? [...imageSrcs] : imageSrc ? [imageSrc] : [];
      setImageList(list);
      const safeIdx = Math.min(Math.max(0, initialIndex), Math.max(0, list.length - 1));
      setCurrentIndex(safeIdx);

      const initConfigs: { [key: number]: CropConfig } = {};
      list.forEach((_, idx) => {
        initConfigs[idx] = {
          zoom: 1,
          rotation: 0,
          pan: { x: 0, y: 0 },
          freeRatioChoice: 'original',
        };
      });
      setConfigs(initConfigs);
    }
  }, [isOpen, imageSrc, imageSrcs, initialIndex]);

  const activeSrc = imageList[currentIndex] || '';

  // Current crop settings
  const currentConfig: CropConfig = configs[currentIndex] || {
    zoom: 1,
    rotation: 0,
    pan: { x: 0, y: 0 },
    freeRatioChoice: 'original',
  };

  const zoom = currentConfig.zoom;
  const rotation = currentConfig.rotation;
  const pan = currentConfig.pan;
  const freeRatioChoice = currentConfig.freeRatioChoice;

  const updateCurrentConfig = useCallback((patch: Partial<CropConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [currentIndex]: {
        ...(prev[currentIndex] || {
          zoom: 1,
          rotation: 0,
          pan: { x: 0, y: 0 },
          freeRatioChoice: 'original',
        }),
        ...patch,
      },
    }));
  }, [currentIndex]);

  const setZoom = useCallback((newZoom: number | ((prev: number) => number)) => {
    setConfigs((prev) => {
      const curr = prev[currentIndex]?.zoom ?? 1;
      const val = typeof newZoom === 'function' ? newZoom(curr) : newZoom;
      return {
        ...prev,
        [currentIndex]: {
          ...(prev[currentIndex] || {
            zoom: 1,
            rotation: 0,
            pan: { x: 0, y: 0 },
            freeRatioChoice: 'original',
          }),
          zoom: Math.max(1, Math.min(3, val)),
        },
      };
    });
  }, [currentIndex]);

  const setRotation = useCallback((newRot: number | ((prev: number) => number)) => {
    setConfigs((prev) => {
      const curr = prev[currentIndex]?.rotation ?? 0;
      const val = typeof newRot === 'function' ? newRot(curr) : newRot;
      return {
        ...prev,
        [currentIndex]: {
          ...(prev[currentIndex] || {
            zoom: 1,
            rotation: 0,
            pan: { x: 0, y: 0 },
            freeRatioChoice: 'original',
          }),
          rotation: val,
        },
      };
    });
  }, [currentIndex]);

  const setPan = useCallback((newPan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
    setConfigs((prev) => {
      const curr = prev[currentIndex]?.pan ?? { x: 0, y: 0 };
      const val = typeof newPan === 'function' ? newPan(curr) : newPan;
      return {
        ...prev,
        [currentIndex]: {
          ...(prev[currentIndex] || {
            zoom: 1,
            rotation: 0,
            pan: { x: 0, y: 0 },
            freeRatioChoice: 'original',
          }),
          pan: val,
        },
      };
    });
  }, [currentIndex]);

  const setFreeRatioChoice = useCallback((newChoice: 'original' | '1:1' | '3:4' | '4:3' | '16:9') => {
    updateCurrentConfig({ freeRatioChoice: newChoice, zoom: 1, rotation: 0, pan: { x: 0, y: 0 } });
  }, [updateCurrentConfig]);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  // Load natural dimensions of active image
  useEffect(() => {
    if (isOpen && activeSrc) {
      const img = new Image();
      img.onload = () => {
        setImageNaturalSize({
          width: img.naturalWidth || img.width || 800,
          height: img.naturalHeight || img.height || 800,
        });
      };
      img.src = activeSrc;
    }
  }, [isOpen, activeSrc, currentIndex]);

  // Determine viewport dimensions based on aspect ratio
  const { boxW, boxH, isCircle } = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const baseSize = isMobile ? 250 : 310;

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
          w = Math.min(330, Math.round(150 * targetRatio));
        }
      } else {
        h = baseSize;
        w = Math.round(baseSize * targetRatio);
        if (w < 150) {
          w = 150;
          h = Math.min(330, Math.round(150 / targetRatio));
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

  // Rotation math
  const rad = (Math.abs(rotation) * Math.PI) / 180;
  const neededW = boxW * Math.cos(rad) + boxH * Math.sin(rad);
  const neededH = boxW * Math.sin(rad) + boxH * Math.cos(rad);

  const minZoomForRotation = Math.max(1, neededW / baseImgW, neededH / baseImgH);
  const effectiveZoom = Math.max(zoom, minZoomForRotation);

  const currImgW = baseImgW * effectiveZoom;
  const currImgH = baseImgH * effectiveZoom;

  const maxPanX = Math.max(0, (currImgW - neededW) / 2);
  const maxPanY = Math.max(0, (currImgH - neededH) / 2);

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

  useEffect(() => {
    setPan((prev) => clampPan(prev));
  }, [zoom, rotation, boxW, boxH, clampPan, setPan]);

  // Pointer drag
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
    [isDragging, clampPan, setPan]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setPan((prev) => clampPan(prev));
  }, [clampPan, setPan]);

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

  // Touch handlers
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistRef.current = Math.hypot(dx, dy);
      touchStartZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2 && touchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / touchStartDistRef.current;
      const newZoom = Math.min(3, Math.max(1, touchStartZoomRef.current * ratio));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
    handlePointerUp();
  };

  // Helper to crop single image onto canvas
  const cropImageToCanvas = (
    src: string,
    cfg: CropConfig,
    w: number,
    h: number,
    circle: boolean
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const nw = img.naturalWidth || img.width || 800;
        const nh = img.naturalHeight || img.height || 800;
        const scale = Math.max(w / nw, h / nh);
        const baseW = nw * scale;
        const baseH = nh * scale;

        const radVal = (Math.abs(cfg.rotation) * Math.PI) / 180;
        const nW = w * Math.cos(radVal) + h * Math.sin(radVal);
        const nH = w * Math.sin(radVal) + h * Math.cos(radVal);
        const minZ = Math.max(1, nW / baseW, nH / baseH);
        const effZoom = Math.max(cfg.zoom, minZ);

        const outputScale = 3;
        const outW = Math.round(w * outputScale);
        const outH = Math.round(h * outputScale);

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);

        if (circle) {
          ctx.beginPath();
          ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
        }

        ctx.save();
        ctx.translate(outW / 2, outH / 2);
        ctx.translate(cfg.pan.x * outputScale, cfg.pan.y * outputScale);
        ctx.rotate((cfg.rotation * Math.PI) / 180);
        ctx.scale(effZoom, effZoom);

        const drawW = baseW * outputScale;
        const drawH = baseH * outputScale;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        const format = circle ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(format, 0.92));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  };

  // Crop all images and call confirm callbacks
  const handleSave = async () => {
    if (!imageList.length) return;
    setIsSavingAll(true);

    try {
      const croppedResults: string[] = [];
      for (let i = 0; i < imageList.length; i++) {
        const src = imageList[i];
        const cfg = configs[i] || {
          zoom: 1,
          rotation: 0,
          pan: { x: 0, y: 0 },
          freeRatioChoice: 'original',
        };
        const cropped = await cropImageToCanvas(src, cfg, boxW, boxH, isCircle);
        croppedResults.push(cropped);
      }

      setIsSavingAll(false);
      if (onConfirmMultiple && croppedResults.length > 0) {
        onConfirmMultiple(croppedResults);
      } else if (croppedResults.length > 0) {
        onConfirm(croppedResults[0]);
      }
    } catch (err) {
      setIsSavingAll(false);
      console.error('[PhotoCropModal] Save error:', err);
      if (activeSrc) onConfirm(activeSrc);
    }
  };

  // Navigate to previous image
  const handlePrevImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Navigate to next image
  const handleNextImage = () => {
    if (currentIndex < imageList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Remove one photo
  const handleRemovePhoto = (idxToRemove: number) => {
    if (imageList.length <= 1) {
      onCancel();
      return;
    }
    const nextList = imageList.filter((_, i) => i !== idxToRemove);
    setImageList(nextList);

    const nextConfigs: { [key: number]: CropConfig } = {};
    let newIdx = 0;
    Object.keys(configs).forEach((keyStr) => {
      const k = parseInt(keyStr, 10);
      if (k !== idxToRemove) {
        nextConfigs[newIdx] = configs[k];
        newIdx++;
      }
    });
    setConfigs(nextConfigs);

    if (currentIndex >= nextList.length) {
      setCurrentIndex(nextList.length - 1);
    }
  };

  // Add more photos from device
  const handleAddMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readers: Promise<string>[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type.startsWith('image/')) {
        readers.push(
          new Promise((res) => {
            const r = new FileReader();
            r.onload = (ev) => res(ev.target?.result as string);
            r.readAsDataURL(f);
          })
        );
      }
    }

    Promise.all(readers).then((newUrls) => {
      if (newUrls.length > 0) {
        const startLen = imageList.length;
        setImageList((prev) => [...prev, ...newUrls]);
        setConfigs((prev) => {
          const next = { ...prev };
          newUrls.forEach((_, idx) => {
            next[startLen + idx] = {
              zoom: 1,
              rotation: 0,
              pan: { x: 0, y: 0 },
              freeRatioChoice: 'original',
            };
          });
          return next;
        });
        setCurrentIndex(startLen);
      }
    });

    if (addFileInputRef.current) {
      addFileInputRef.current.value = '';
    }
  };

  if (!isOpen || !activeSrc) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-[#0f141c]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 select-none"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md bg-[#181f2a] rounded-3xl border border-slate-700/60 shadow-2xl p-4 sm:p-5 text-white space-y-3.5 animate-in zoom-in-95 duration-200 max-h-[96vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Switcher / Indicator / Close */}
        <div className="flex items-center justify-between pb-1 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {imageList.length > 1
                ? `Căn chỉnh ảnh (${currentIndex + 1}/${imageList.length})`
                : aspectRatio === 'circle'
                ? 'Căn chỉnh ảnh tròn'
                : 'Căn chỉnh ảnh in'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Arrow Switcher on Header */}
            {imageList.length > 1 && (
              <div className="flex items-center gap-1 bg-white/5 rounded-xl p-0.5 border border-white/10">
                <button
                  type="button"
                  onClick={handlePrevImage}
                  disabled={currentIndex === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 transition-colors cursor-pointer"
                  title="Ảnh trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-bold px-1.5 text-amber-400">
                  {currentIndex + 1}/{imageList.length}
                </span>
                <button
                  type="button"
                  onClick={handleNextImage}
                  disabled={currentIndex === imageList.length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 transition-colors cursor-pointer"
                  title="Ảnh tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onCancel}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Frame with Left/Right Navigation Arrows */}
        <div className="relative flex items-center justify-center pt-1 pb-1">
          {/* Previous Image Arrow Floating on Left */}
          {imageList.length > 1 && (
            <button
              type="button"
              onClick={handlePrevImage}
              disabled={currentIndex === 0}
              className="absolute left-1 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 active:scale-90 border border-white/20 flex items-center justify-center text-white disabled:opacity-20 disabled:pointer-events-none transition-all shadow-lg cursor-pointer backdrop-blur-xs"
              title="Xem & chỉnh ảnh trước"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}

          {/* Next Image Arrow Floating on Right */}
          {imageList.length > 1 && (
            <button
              type="button"
              onClick={handleNextImage}
              disabled={currentIndex === imageList.length - 1}
              className="absolute right-1 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 active:scale-90 border border-white/20 flex items-center justify-center text-white disabled:opacity-20 disabled:pointer-events-none transition-all shadow-lg cursor-pointer backdrop-blur-xs"
              title="Xem & chỉnh ảnh tiếp theo"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}

          {/* Interactive Crop Frame */}
          <div
            className={`relative overflow-hidden bg-black/80 flex items-center justify-center shadow-inner cursor-grab active:cursor-grabbing border-2 border-dashed border-rose-500/70 select-none ${
              isCircle ? 'rounded-full' : 'rounded-2xl'
            }`}
            style={{ width: `${boxW}px`, height: `${boxH}px` }}
            onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={activeSrc}
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

            {/* 3x3 Grid Lines */}
            <div className={`absolute inset-0 pointer-events-none ${isCircle ? 'rounded-full' : 'rounded-none'}`}>
              <div className="absolute top-[33.33%] left-0 right-0 h-[1px] bg-white/30" />
              <div className="absolute top-[66.66%] left-0 right-0 h-[1px] bg-white/30" />
              <div className="absolute left-[33.33%] top-0 bottom-0 w-[1px] bg-white/30" />
              <div className="absolute left-[66.66%] top-0 bottom-0 w-[1px] bg-white/30" />
            </div>
          </div>
        </div>

        {/* Multi-Image Thumbnail Strip */}
        {imageList.length > 1 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
              <span>Danh sách {imageList.length} ảnh đã chọn:</span>
              <span>Bấm vào ảnh hoặc dùng mũi tên để chuyển</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 no-scrollbar">
              {imageList.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                    idx === currentIndex
                      ? 'border-amber-400 scale-105 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/30'
                      : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/40'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0.5 left-0.5 px-1 py-0.2 bg-black/75 rounded text-[9px] font-bold text-white">
                    #{idx + 1}
                  </span>
                  {imageList.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePhoto(idx);
                      }}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600/90 text-white flex items-center justify-center hover:bg-rose-700 transition-colors cursor-pointer"
                      title="Bỏ ảnh này"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add More Photos Button in Thumbnail Strip */}
              <button
                type="button"
                onClick={() => addFileInputRef.current?.click()}
                className="shrink-0 w-12 h-12 rounded-xl border border-dashed border-white/30 hover:border-amber-400 hover:bg-white/5 flex flex-col items-center justify-center text-slate-400 hover:text-amber-300 transition-all cursor-pointer"
                title="Chọn thêm ảnh khác"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[9px] font-bold mt-0.5">Thêm</span>
              </button>
              <input
                ref={addFileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleAddMoreFiles}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Free Ratio Chips */}
        {aspectRatio === 'free' && (
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-slate-400 font-semibold mr-1">Tỷ lệ:</span>
            {[
              { id: 'original', label: 'Gốc' },
              { id: '1:1', label: '1:1' },
              { id: '3:4', label: '3:4' },
              { id: '4:3', label: '4:3' },
              { id: '16:9', label: '16:9' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setFreeRatioChoice(r.id as any)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
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

        {/* Sliders: Zoom & Straighten */}
        <div className="space-y-2.5 pt-0.5">
          {/* Zoom Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 px-1">
              <div className="flex items-center gap-2">
                <span>Thu phóng ({Math.round(zoom * 100)}%)</span>
                {zoom > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer inline-flex items-center gap-1 font-normal"
                    title="Đặt lại mức zoom 100%"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>100%</span>
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(1, prev - 0.1))}
                className="w-7 h-7 rounded-full border border-dashed border-white/40 hover:border-white/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(3, prev + 0.1))}
                className="w-7 h-7 rounded-full border border-dashed border-white/40 hover:border-white/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Straighten Rotation Slider */}
          <div className="space-y-1">
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
                className="w-7 h-7 rounded-full border border-dashed border-white/40 hover:border-white/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
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
                className="w-7 h-7 rounded-full border border-dashed border-white/40 hover:border-white/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSavingAll}
            className="w-full py-3 sm:py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-98 disabled:opacity-50 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-rose-900/40 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isSavingAll ? (
              <span>ĐANG XỬ LÝ ẢNH...</span>
            ) : imageList.length > 1 ? (
              <span>LƯU TẤT CẢ ({imageList.length} ẢNH)</span>
            ) : (
              <span>LƯU ẢNH</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
