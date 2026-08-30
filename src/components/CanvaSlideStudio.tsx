import React, { useState, useRef, useEffect } from 'react';
import { SiteHeroSlide } from '../types';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowUp, 
  ArrowDown, 
  Upload, 
  Trash2, 
  Copy, 
  Plus, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Type, 
  Image as ImageIcon, 
  MousePointerClick,
  Sliders,
  ChevronLeft,
  ChevronRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  Layers,
  Palette,
  Check,
  RotateCcw,
  Sparkle,
  Info,
  Move,
  Crop,
  Maximize2,
  ZoomIn,
  Crosshair
} from 'lucide-react';

interface CanvaSlideStudioProps {
  slides: SiteHeroSlide[];
  onChangeSlides: (slides: SiteHeroSlide[]) => void;
  brandName?: string;
}

// Curated Design Presets
const DESIGN_PRESETS = [
  {
    id: 'haokhi',
    name: 'Hào Khí Độc Bản',
    desc: 'Tiêu đề to đậm, từ khóa vàng hổ phách, nút trắng bo tròn hiện đại',
    config: {
      fontFamily: 'display' as const,
      titleFontSize: 44,
      subtitleFontSize: 16,
      buttonFontSize: 13,
      textAlign: 'center' as const,
      textPosition: 'center' as const,
      titleColor: '#FFFFFF',
      highlightColor: '#F59E0B',
      subtitleColor: '#E2E8F0',
      buttonBgColor: '#FFFFFF',
      buttonTextColor: '#0F172A',
      buttonStyle: 'pill' as const,
      overlayOpacity: 55,
      textShadow: true,
      letterSpacing: 'tight' as const
    }
  },
  {
    id: 'disan',
    name: 'Di Sản Hoàng Gia',
    desc: 'Phông chữ có chân thanh lịch, chữ vàng kim quý phái, căn trái sang trọng',
    config: {
      fontFamily: 'serif' as const,
      titleFontSize: 40,
      subtitleFontSize: 15,
      buttonFontSize: 13,
      textAlign: 'left' as const,
      textPosition: 'center-left' as const,
      titleColor: '#FEF3C7',
      highlightColor: '#FBBF24',
      subtitleColor: '#F1F5F9',
      buttonBgColor: '#F59E0B',
      buttonTextColor: '#0F172A',
      buttonStyle: 'rounded' as const,
      overlayOpacity: 65,
      textShadow: true,
      letterSpacing: 'wide' as const
    }
  },
  {
    id: 'tactical',
    name: 'Chiến Thuật Mạnh Mẽ',
    desc: 'Phông hiện đại sắc nét, nút màu cam dạ quang, căn trái phong cách EDC',
    config: {
      fontFamily: 'sans' as const,
      titleFontSize: 42,
      subtitleFontSize: 15,
      buttonFontSize: 13,
      textAlign: 'left' as const,
      textPosition: 'bottom-left' as const,
      titleColor: '#FFFFFF',
      highlightColor: '#38BDF8',
      subtitleColor: '#CBD5E1',
      buttonBgColor: '#0F172A',
      buttonTextColor: '#FFFFFF',
      buttonStyle: 'square' as const,
      overlayOpacity: 60,
      textShadow: true,
      letterSpacing: 'normal' as const
    }
  },
  {
    id: 'toigian',
    name: 'Tối Giản Tinh Tế',
    desc: 'Phông chữ thanh thoát, lớp phủ dịu nhẹ, nút trong suốt sang trọng',
    config: {
      fontFamily: 'sans' as const,
      titleFontSize: 36,
      subtitleFontSize: 14,
      buttonFontSize: 12,
      textAlign: 'center' as const,
      textPosition: 'center' as const,
      titleColor: '#FFFFFF',
      highlightColor: '#E2E8F0',
      subtitleColor: '#94A3B8',
      buttonBgColor: '#FFFFFF',
      buttonTextColor: '#0F172A',
      buttonStyle: 'pill' as const,
      overlayOpacity: 45,
      textShadow: false,
      letterSpacing: 'wide' as const
    }
  }
];

export const CanvaSlideStudio: React.FC<CanvaSlideStudioProps> = ({
  slides,
  onChangeSlides,
  brandName = 'NOT A KNOT'
}) => {
  const [selectedSlideId, setSelectedSlideId] = useState<string>(() => slides[0]?.id || 'slide-1');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [inspectorTab, setInspectorTab] = useState<'bg' | 'text' | 'button' | 'presets'>('bg');
  const [dragOverSlideId, setDragOverSlideId] = useState<string | null>(null);
  
  // Drag and Drop state for reordering slides
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Interactive Background Drag & Crop State
  const [isDragCropMode, setIsDragCropMode] = useState(false);
  const [isDraggingBg, setIsDraggingBg] = useState(false);
  const [dragStart, setDragStart] = useState<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  // Active slide being edited
  const activeSlide = slides.find((s) => s.id === selectedSlideId) || slides[0];
  const activeIndex = slides.findIndex((s) => s.id === activeSlide?.id);

  // Helper to update active slide
  const updateActiveSlide = (field: keyof SiteHeroSlide, val: any) => {
    if (!activeSlide) return;
    const updated = slides.map((s) => (s.id === activeSlide.id ? { ...s, [field]: val } : s));
    onChangeSlides(updated);
  };

  // Bulk update active slide
  const updateActiveSlideFields = (fields: Partial<SiteHeroSlide>) => {
    if (!activeSlide) return;
    const updated = slides.map((s) => (s.id === activeSlide.id ? { ...s, ...fields } : s));
    onChangeSlides(updated);
  };

  // Select 9-grid position and auto-synchronize text alignments
  const handleSelectPosition = (pos: string) => {
    const isLeft = pos.includes('left');
    const isRight = pos.includes('right');
    const hAlign: 'left' | 'center' | 'right' = isLeft ? 'left' : isRight ? 'right' : 'center';
    
    updateActiveSlideFields({
      textPosition: pos as any,
      textAlign: hAlign,
      titleTextAlign: hAlign,
      subtitleTextAlign: hAlign
    });
  };

  // Canvas Drag / Crop event handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragCropMode || !activeSlide) return;
    e.preventDefault();
    setIsDraggingBg(true);
    setDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      startX: activeSlide.bgPositionX ?? 50,
      startY: activeSlide.bgPositionY ?? 50
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingBg || !dragStart || !canvasRef.current || !activeSlide) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const deltaXPercent = -((e.clientX - dragStart.clientX) / rect.width) * 100;
    const deltaYPercent = -((e.clientY - dragStart.clientY) / rect.height) * 100;

    const newX = Math.max(0, Math.min(100, Math.round(dragStart.startX + deltaXPercent)));
    const newY = Math.max(0, Math.min(100, Math.round(dragStart.startY + deltaYPercent)));

    updateActiveSlideFields({
      bgPositionX: newX,
      bgPositionY: newY
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingBg(false);
    setDragStart(null);
  };

  // Add new slide
  const handleAddNewSlide = () => {
    const newSlide: SiteHeroSlide = {
      id: `slide-${Date.now()}`,
      tag: 'Bộ Sưu Tập Mới',
      title: 'Tuyệt Tác Thủ Công Mới',
      highlight: 'Phong Cách Độc Bản',
      subtitle: 'Từng nút thắt Paracord được hoàn thiện tỉ mỉ bằng đam mê và tay nghề thủ công chuẩn xác.',
      bgImage: 'https://images.unsplash.com/photo-1611591475155-4286fa7c2e60?q=80&w=1200&auto=format&fit=crop',
      buttonText: 'Khám phá ngay',
      categoryLink: 'all',
      order: slides.length + 1,
      isActive: true,
      textAlign: 'center',
      textPosition: 'center',
      titleFontSize: 40,
      subtitleFontSize: 15,
      buttonFontSize: 13,
      fontFamily: 'sans',
      overlayOpacity: 55,
      titleColor: '#FFFFFF',
      highlightColor: '#F59E0B',
      subtitleColor: '#E2E8F0',
      buttonBgColor: '#FFFFFF',
      buttonTextColor: '#0F172A',
      buttonStyle: 'pill',
      textShadow: true,
      letterSpacing: 'tight'
    };

    const nextSlides = [...slides, newSlide];
    onChangeSlides(nextSlides);
    setSelectedSlideId(newSlide.id);
  };

  // Duplicate slide
  const handleDuplicateSlide = (slide: SiteHeroSlide) => {
    const duplicated: SiteHeroSlide = {
      ...slide,
      id: `slide-${Date.now()}`,
      title: `${slide.title} - Bản Sao`,
      order: slides.length + 1
    };
    const nextSlides = [...slides, duplicated];
    onChangeSlides(nextSlides);
    setSelectedSlideId(duplicated.id);
  };

  // Delete slide
  const handleDeleteSlide = (id: string) => {
    if (slides.length <= 1) {
      alert('Cần giữ lại ít nhất 1 slide trên trang chủ.');
      return;
    }
    const filtered = slides.filter((s) => s.id !== id);
    onChangeSlides(filtered);
    if (selectedSlideId === id) {
      setSelectedSlideId(filtered[0]?.id || '');
    }
  };

  // Move slide up
  const handleMoveUp = (idx: number) => {
    if (idx <= 0) return;
    const copy = [...slides];
    const temp = copy[idx];
    copy[idx] = copy[idx - 1];
    copy[idx - 1] = temp;
    onChangeSlides(copy.map((s, i) => ({ ...s, order: i + 1 })));
  };

  // Move slide down
  const handleMoveDown = (idx: number) => {
    if (idx >= slides.length - 1) return;
    const copy = [...slides];
    const temp = copy[idx];
    copy[idx] = copy[idx + 1];
    copy[idx + 1] = temp;
    onChangeSlides(copy.map((s, i) => ({ ...s, order: i + 1 })));
  };

  // Process image upload from computer
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
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
          const compressed = canvas.toDataURL('image/jpeg', 0.78);
          updateActiveSlide('bgImage', compressed);
        } else {
          updateActiveSlide('bgImage', e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Font family helper
  const getFontFamilyClass = (family?: string) => {
    switch (family) {
      case 'serif':
        return 'font-serif';
      case 'display':
        return 'font-black uppercase tracking-tight';
      case 'mono':
        return 'font-mono';
      default:
        return 'font-sans';
    }
  };

  // Letter spacing helper
  const getLetterSpacingClass = (spacing?: string) => {
    switch (spacing) {
      case 'wide':
        return 'tracking-widest';
      case 'tight':
        return 'tracking-tight';
      default:
        return 'tracking-normal';
    }
  };

  // Position alignment classes
  const getPositionClasses = (position?: string) => {
    switch (position) {
      case 'top-left':
        return 'justify-start items-start pt-3 sm:pt-5';
      case 'top-center':
        return 'justify-start items-center pt-3 sm:pt-5 text-center';
      case 'top-right':
        return 'justify-start items-end pt-3 sm:pt-5 text-right';
      case 'center-left':
        return 'justify-center items-start text-left';
      case 'center-right':
        return 'justify-center items-end text-right';
      case 'bottom-left':
        return 'justify-end items-start pb-3 sm:pb-5 text-left';
      case 'bottom-center':
        return 'justify-end items-center pb-3 sm:pb-5 text-center';
      case 'bottom-right':
        return 'justify-end items-end pb-3 sm:pb-5 text-right';
      case 'center':
      default:
        return 'justify-center items-center text-center';
    }
  };

  // Drag handlers for slide reordering
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragOverIdx !== idx) {
      setDragOverIdx(idx);
    }
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) {
      setDragOverIdx(null);
      setDraggedIdx(null);
      return;
    }
    
    const newSlides = [...slides];
    const [draggedSlide] = newSlides.splice(draggedIdx, 1);
    newSlides.splice(idx, 0, draggedSlide);
    
    onChangeSlides(newSlides.map((s, i) => ({ ...s, order: i + 1 })));
    setDragOverIdx(null);
    setDraggedIdx(null);
  };
  
  const handleDragEnd = () => {
    setDragOverIdx(null);
    setDraggedIdx(null);
  };

  if (!activeSlide) return null;

  const currentAlign = activeSlide.textAlign || (activeSlide.textPosition?.includes('left') ? 'left' : activeSlide.textPosition?.includes('right') ? 'right' : 'center');
  const isCenter = currentAlign === 'center';
  const isRight = currentAlign === 'right';

  const titleSize = activeSlide.titleFontSize || 38;
  const subtitleSize = activeSlide.subtitleFontSize || 15;
  const buttonSize = activeSlide.buttonFontSize || 13;
  const buttonShape = activeSlide.buttonStyle || 'pill';

  return (
    <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col font-sans">
      
      {/* 1. TOP STUDIO BAR (Light Studio Header) */}
      <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-wide">
                Trình Thiết Kế Slide
              </h2>
              <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                Slide {activeIndex + 1} / {slides.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Biên tập hình ảnh, cỡ chữ, màu sắc và nút bấm trực quan thời gian thực
            </p>
          </div>
        </div>

        {/* Center: Device Switcher */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setDeviceMode('desktop')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              deviceMode === 'desktop' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Máy tính</span>
          </button>

          <button
            type="button"
            onClick={() => setDeviceMode('tablet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              deviceMode === 'tablet' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Máy tính bảng</span>
          </button>

          <button
            type="button"
            onClick={() => setDeviceMode('mobile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              deviceMode === 'mobile' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Điện thoại</span>
          </button>
        </div>

        {/* Right: Quick Slide Operations */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDuplicateSlide(activeSlide)}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-200 transition-all cursor-pointer shadow-2xs"
            title="Nhân bản slide hiện tại"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Nhân bản</span>
          </button>

          <button
            type="button"
            onClick={handleAddNewSlide}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Slide</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN 3-PANE STUDIO WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px] bg-slate-100/60 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        
        {/* ======================================================== */}
        {/* PANE 1 (LEFT): SLIDE FILMSTRIP LIST */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 bg-white p-4 space-y-3 flex flex-col justify-between max-h-[720px] overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                <span>Danh sách Slide ({slides.length})</span>
              </span>
            </div>

            {/* Thumbnail Slide Cards */}
            <div className="space-y-2.5">
              {slides.map((slide, idx) => {
                const isSelected = slide.id === selectedSlideId;
                return (
                  <div
                    key={slide.id}
                    onClick={() => setSelectedSlideId(slide.id)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                      dragOverIdx === idx ? 'border-amber-500 bg-amber-50 border-t-4 border-t-amber-500 pt-1.5' :
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 shadow-xs ring-1 ring-amber-500'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-white'
                    } ${draggedIdx === idx ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail Box */}
                      <div className="relative w-20 h-12 rounded-lg bg-slate-900 border border-slate-200 overflow-hidden shrink-0">
                        {slide.bgImage ? (
                          <img
                            src={slide.bgImage}
                            alt={slide.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-100 text-[10px] text-slate-400">
                            Chưa có ảnh
                          </div>
                        )}
                        <span className="absolute top-1 left-1 bg-black/70 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.2 rounded">
                          #{idx + 1}
                        </span>
                      </div>

                      {/* Info & Title */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-amber-600 truncate">
                            {slide.tag || 'Slide'}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            slide.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {slide.isActive ? 'Bật' : 'Tắt'}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5">
                          {slide.title || 'Chưa đặt tiêu đề'}
                        </h4>
                        <p className="text-[10px] text-slate-500 truncate">
                          {slide.subtitle || 'Không có mô tả'}
                        </p>
                      </div>
                    </div>

                    {/* Quick Reorder & Delete Bar */}
                    <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveUp(idx);
                          }}
                          className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-30 border border-slate-200 cursor-pointer hidden sm:block"
                          title="Di chuyển lên"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === slides.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveDown(idx);
                          }}
                          className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-30 border border-slate-200 cursor-pointer hidden sm:block"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <div className="p-1 rounded text-slate-400 cursor-move hover:text-amber-600 active:cursor-grabbing sm:hidden lg:block" title="Kéo thả để sắp xếp">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={slide.isActive}
                            onChange={(e) => {
                              const updated = slides.map((s) => (s.id === slide.id ? { ...s, isActive: e.target.checked } : s));
                              onChangeSlides(updated);
                            }}
                            className="rounded text-amber-500 focus:ring-0 w-3 h-3"
                          />
                          <span>Hiện</span>
                        </label>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSlide(slide.id);
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                          title="Xóa slide này"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddNewSlide}
            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-50 text-slate-700 hover:text-amber-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer mt-3"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Slide Trình Diễn Mới</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* PANE 2 (CENTER): LIVE VISUAL CANVAS (The Stage) */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 bg-slate-100/90 p-4 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden">
          
          {/* Canvas Top Bar */}
          <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-2 mb-3 px-1 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-800 text-xs">Màn hình xem trước thực tế</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                {deviceMode === 'desktop' ? 'Chuẩn 16:9 Desktop' : deviceMode === 'tablet' ? 'Chuẩn 16:10 Tablet' : 'Chuẩn 9:16 Mobile'}
              </span>
            </div>
            
            {/* Interactive Canvas Toolbar */}
            <div className="flex items-center gap-1.5">
              {/* Drag/Crop Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsDragCropMode(!isDragCropMode)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs border ${
                  isDragCropMode 
                    ? 'bg-amber-500 text-white border-amber-600 shadow-amber-200' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="Bật/tắt chế độ kéo chỉnh vị trí ảnh và căn tâm trực tiếp trên khung ảnh"
              >
                <Move className="w-3.5 h-3.5" />
                <span>{isDragCropMode ? 'Đang kéo ảnh...' : 'Kéo chỉnh vị trí ảnh'}</span>
              </button>

              {/* Quick Slide Prev/Next */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  disabled={activeIndex <= 0}
                  onClick={() => setSelectedSlideId(slides[activeIndex - 1]?.id || slides[0].id)}
                  className="p-1 rounded bg-transparent hover:bg-slate-100 text-slate-700 disabled:opacity-30 cursor-pointer"
                  title="Slide trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-xs text-slate-800 px-1.5">
                  {activeIndex + 1}/{slides.length}
                </span>
                <button
                  type="button"
                  disabled={activeIndex >= slides.length - 1}
                  onClick={() => setSelectedSlideId(slides[activeIndex + 1]?.id || slides[slides.length - 1].id)}
                  className="p-1 rounded bg-transparent hover:bg-slate-100 text-slate-700 disabled:opacity-30 cursor-pointer"
                  title="Slide sau"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* DRAG-TO-PAN NOTICE WHEN ACTIVE */}
          {isDragCropMode && (
            <div className="w-full max-w-4xl mb-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-400 text-amber-900 text-[11px] font-semibold flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2">
                <Move className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                <span>Nhấp giữ và kéo chuột trên ảnh bên dưới để di chuyển tâm điểm (Focal Point).</span>
              </div>
              <span className="font-mono font-bold text-amber-700 bg-white/80 px-2 py-0.5 rounded border border-amber-300">
                X: {activeSlide.bgPositionX ?? 50}% | Y: {activeSlide.bgPositionY ?? 50}% | Zoom: {activeSlide.bgZoom ?? 100}%
              </span>
            </div>
          )}

          {/* THE STAGE VIEWPORT (Strict 16:9 Aspect Ratio on Desktop) */}
          <div
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className={`relative w-full rounded-2xl overflow-hidden border border-slate-300 shadow-xl transition-all duration-300 select-none ${
              isDragCropMode 
                ? 'cursor-grab active:cursor-grabbing ring-4 ring-amber-400/80 shadow-2xl' 
                : ''
            } ${
              deviceMode === 'mobile'
                ? 'max-w-[320px] aspect-[9/16]'
                : deviceMode === 'tablet'
                ? 'max-w-xl aspect-[16/10]'
                : 'max-w-4xl aspect-[16/9]'
            }`}
          >
            {/* Background Image with Focal Point & Zoom */}
            {activeSlide.bgImage ? (
              <img
                src={activeSlide.bgImage}
                alt={activeSlide.title}
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-100 pointer-events-none"
                style={{
                  objectPosition: `${activeSlide.bgPositionX ?? 50}% ${activeSlide.bgPositionY ?? 50}%`,
                  transform: `scale(${(activeSlide.bgZoom ?? 100) / 100})`,
                  transformOrigin: `${activeSlide.bgPositionX ?? 50}% ${activeSlide.bgPositionY ?? 50}%`
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-black flex items-center justify-center text-slate-400">
                Chưa có ảnh nền
              </div>
            )}

            {/* Configurable Overlay Opacity (Dark Film) */}
            <div
              className="absolute inset-0 bg-black transition-opacity pointer-events-none"
              style={{ opacity: (activeSlide.overlayOpacity ?? 50) / 100 }}
            />

            {/* Cinematic Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10 pointer-events-none" />

            {/* Visual Crosshair when in Drag & Crop Mode */}
            {isDragCropMode && (
              <div 
                className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                style={{
                  left: `${activeSlide.bgPositionX ?? 50}%`,
                  top: `${activeSlide.bgPositionY ?? 50}%`
                }}
              >
                <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-dashed bg-amber-400/20 flex items-center justify-center shadow-lg animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                </div>
              </div>
            )}

            {/* Live Rendered Slide Content Box */}
            <div className={`relative z-20 w-full h-full p-4 sm:p-7 flex flex-col ${getPositionClasses(activeSlide.textPosition)}`}>
              <div 
                className={`space-y-2.5 flex flex-col pointer-events-none ${activeSlide.disableAnimation ? '' : 'animate-fadeIn'} ${
                  activeSlide.titleTextAlign === 'center' || (isCenter && !activeSlide.titleTextAlign)
                    ? 'items-center text-center mx-auto'
                    : activeSlide.titleTextAlign === 'right' || (isRight && !activeSlide.titleTextAlign)
                    ? 'items-end text-right ml-auto'
                    : 'items-start text-left mr-auto'
                }`}
                style={{ width: '100%', maxWidth: activeSlide.contentMaxWidth ? `${activeSlide.contentMaxWidth}%` : '512px' }}
              >
                
                {/* Eyebrow Tag */}
                {activeSlide.tag && (
                  <span 
                    className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest inline-block px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-xs border border-white/20 ${
                      isCenter ? 'mx-auto' : isRight ? 'ml-auto' : 'mr-auto'
                    }`}
                    style={{
                      color: activeSlide.highlightColor || '#F59E0B'
                    }}
                  >
                    {activeSlide.tag}
                  </span>
                )}

                {/* Headline & Highlight */}
                <h2
                  className={`leading-tight w-full ${getFontFamilyClass(activeSlide.titleFontFamily || activeSlide.fontFamily)} ${getLetterSpacingClass(activeSlide.letterSpacing)} ${
                    activeSlide.titleTextAlign === 'center' || (isCenter && !activeSlide.titleTextAlign)
                      ? 'text-center'
                      : activeSlide.titleTextAlign === 'right' || (isRight && !activeSlide.titleTextAlign)
                      ? 'text-right'
                      : 'text-left'
                  }`}
                  style={{
                    color: activeSlide.titleColor || '#FFFFFF',
                    textShadow: activeSlide.textShadow !== false ? '0 2px 8px rgba(0,0,0,0.8)' : 'none'
                  }}
                >
                  <span
                    className="block font-black tracking-tight"
                    style={{
                      fontSize: `${deviceMode === 'mobile' ? Math.min(titleSize, 22) : deviceMode === 'tablet' ? Math.min(titleSize, 28) : Math.min(titleSize, 34)}px`
                    }}
                  >
                    {activeSlide.title || 'Tiêu đề chính'}
                  </span>
                  {activeSlide.highlight && (
                    <span 
                      className="block font-light mt-0.5 tracking-normal"
                      style={{
                        color: activeSlide.highlightColor || '#F59E0B',
                        fontSize: `${deviceMode === 'mobile' ? Math.min(Math.round(titleSize * 0.72), 16) : deviceMode === 'tablet' ? Math.min(Math.round(titleSize * 0.72), 22) : Math.min(Math.round(titleSize * 0.72), 25)}px`
                      }}
                    >
                      {activeSlide.highlight}
                    </span>
                  )}
                </h2>

                {/* Subtitle */}
                {activeSlide.subtitle && (
                  <p 
                    className={`leading-relaxed line-clamp-3 font-normal w-full ${getFontFamilyClass(activeSlide.subtitleFontFamily || activeSlide.fontFamily)} ${
                      activeSlide.subtitleTextAlign === 'center' || (isCenter && !activeSlide.subtitleTextAlign)
                        ? 'text-center'
                        : activeSlide.subtitleTextAlign === 'right' || (isRight && !activeSlide.subtitleTextAlign)
                        ? 'text-right'
                        : 'text-left'
                    }`}
                    style={{
                      color: activeSlide.subtitleColor || '#E2E8F0',
                      fontSize: `${deviceMode === 'mobile' ? Math.min(subtitleSize, 12) : deviceMode === 'tablet' ? Math.min(subtitleSize, 13) : Math.min(subtitleSize, 14)}px`,
                      textShadow: activeSlide.textShadow !== false ? '0 1px 4px rgba(0,0,0,0.7)' : 'none'
                    }}
                  >
                    {activeSlide.subtitle}
                  </p>
                )}

                {/* CTA Button */}
                <div className={`pt-1.5 flex items-center w-full ${isCenter ? 'justify-center mx-auto' : isRight ? 'justify-end ml-auto' : 'justify-start mr-auto'}`}>
                  <button
                    type="button"
                    className={`px-5 py-2 font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all ${
                      buttonShape === 'rounded' ? 'rounded-xl' : buttonShape === 'square' ? 'rounded-xs' : 'rounded-full'
                    }`}
                    style={{
                      backgroundColor: activeSlide.buttonBgColor || '#FFFFFF',
                      color: activeSlide.buttonTextColor || '#0F172A',
                      fontSize: `${buttonSize}px`
                    }}
                  >
                    <span>{activeSlide.buttonText || 'Khám phá ngay'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Positioning Grid Overlay (Visible when hovering over canvas & NOT in crop mode) */}
            {!isDragCropMode && (
              <div className="absolute inset-0 z-25 opacity-0 hover:opacity-100 transition-opacity duration-300">
                <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0">
                  {[
                    'top-left', 'top-center', 'top-right',
                    'center-left', 'center', 'center-right',
                    'bottom-left', 'bottom-center', 'bottom-right'
                  ].map((pos) => (
                    <div
                      key={pos}
                      onClick={() => handleSelectPosition(pos)}
                      className={`border border-white/20 hover:bg-amber-500/20 hover:border-amber-500 cursor-crosshair transition-all flex items-center justify-center ${activeSlide.textPosition === pos ? 'bg-amber-500/10 border-amber-500/50' : ''}`}
                      title={`Căn chuyển nội dung đến đây`}
                    >
                      <div className={`w-3 h-3 rounded-full bg-white/30 ${activeSlide.textPosition === pos ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]' : ''}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Upload Button on bottom-right */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-3 right-3 z-30 px-3 py-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-[11px] font-bold backdrop-blur-md border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Upload className="w-3 h-3" />
              <span>Đổi ảnh nền</span>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
            }}
          />
        </div>

        {/* ======================================================== */}
        {/* PANE 3 (RIGHT): PROPERTY & TYPOGRAPHY INSPECTOR */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 bg-white p-4 space-y-4 max-h-[720px] overflow-y-auto">
          
          {/* Inspector Tabs */}
          <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setInspectorTab('bg')}
              className={`py-1.5 rounded-lg text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                inspectorTab === 'bg' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Nền</span>
            </button>

            <button
              type="button"
              onClick={() => setInspectorTab('text')}
              className={`py-1.5 rounded-lg text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                inspectorTab === 'text' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Chữ</span>
            </button>

            <button
              type="button"
              onClick={() => setInspectorTab('button')}
              className={`py-1.5 rounded-lg text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                inspectorTab === 'button' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>Nút</span>
            </button>

            <button
              type="button"
              onClick={() => setInspectorTab('presets')}
              className={`py-1.5 rounded-lg text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                inspectorTab === 'presets' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkle className="w-3.5 h-3.5" />
              <span>Mẫu</span>
            </button>
          </div>

          {/* ---------------- TAB 1: BACKGROUND & OVERLAY ---------------- */}
          {inspectorTab === 'bg' && (
            <div className="space-y-4">
              {/* Image Upload Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  1. Ảnh Nền Banner
                </label>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverSlideId(activeSlide.id);
                  }}
                  onDragLeave={() => setDragOverSlideId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSlideId(null);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleImageFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    dragOverSlideId === activeSlide.id
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                  }`}
                >
                  <Upload className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                  <span className="text-xs font-bold text-slate-800 block">Tải ảnh từ máy tính</span>
                  <span className="text-[10px] text-slate-500">Kéo thả hoặc nhấn vào đây</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Hoặc dán liên kết ảnh</label>
                  <input
                    type="text"
                    value={activeSlide.bgImage}
                    onChange={(e) => updateActiveSlide('bgImage', e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none font-mono focus:bg-white focus:border-amber-500"
                  />
                </div>
              </div>

              {/* IMAGE UPLOAD GUIDELINES & SIZING SPECS */}
              <div className="rounded-xl bg-slate-900 text-slate-100 p-3.5 space-y-2.5 text-xs shadow-inner border border-slate-800">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Quy chuẩn kích thước ảnh đề xuất</span>
                </div>
                
                <div className="space-y-2 text-[11px] text-slate-300">
                  <div className="flex items-start justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-semibold text-white">🖥️ Fullscreen (Toàn màn hình):</span>
                    <span className="font-mono text-amber-300 font-bold">1920 × 1080 px (16:9)</span>
                  </div>
                  <div className="flex items-start justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-semibold text-white">🎬 Cinematic Banner (Ngang):</span>
                    <span className="font-mono text-amber-300 font-bold">1920 × 800 px (~21:9)</span>
                  </div>
                  <div className="flex items-start justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-semibold text-white">📱 Safe Zone (Vùng an toàn):</span>
                    <span className="text-slate-300">Chủ thể ở 70% trung tâm</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="font-semibold text-white">⚡ Định dạng & Dung lượng:</span>
                    <span className="text-emerald-400 font-medium">JPG/WebP/PNG &lt; 2MB</span>
                  </div>
                </div>
                
                <p className="text-[10px] text-slate-400 leading-normal italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  💡 <strong>Mẹo:</strong> Để ảnh không bị che mất sản phẩm khi xem trên điện thoại hay laptop, hãy bố trí sản phẩm vòng tay ở vùng chính giữa ảnh.
                </p>
              </div>

              {/* CROP, FOCAL POINT & ZOOM ADJUSTMENT */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Crop className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">Cắt Ảnh & Căn Tâm (Crop & Pan)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateActiveSlideFields({ bgPositionX: 50, bgPositionY: 50, bgZoom: 100 })}
                    className="text-[10px] font-bold text-slate-600 hover:text-amber-600 bg-slate-100 hover:bg-amber-50 px-2 py-0.5 rounded border border-slate-200 hover:border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Đặt lại ảnh về tâm giữa và tỷ lệ 100%"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Mặc định (50/50)</span>
                  </button>
                </div>

                {/* 9-Point Focal Presets */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600">Điểm lấy nét nhanh (Focal Point)</label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit mx-auto">
                    {[
                      { id: 'tl', x: 20, y: 20, label: '↖' },
                      { id: 'tc', x: 50, y: 20, label: '↑' },
                      { id: 'tr', x: 80, y: 20, label: '↗' },
                      { id: 'cl', x: 20, y: 50, label: '←' },
                      { id: 'cc', x: 50, y: 50, label: '•' },
                      { id: 'cr', x: 80, y: 50, label: '→' },
                      { id: 'bl', x: 20, y: 80, label: '↙' },
                      { id: 'bc', x: 50, y: 80, label: '↓' },
                      { id: 'br', x: 80, y: 80, label: '↘' }
                    ].map((focal) => {
                      const isSelected = (activeSlide.bgPositionX ?? 50) === focal.x && (activeSlide.bgPositionY ?? 50) === focal.y;
                      return (
                        <button
                          key={focal.id}
                          type="button"
                          onClick={() => updateActiveSlideFields({ bgPositionX: focal.x, bgPositionY: focal.y })}
                          className={`w-6 h-6 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-white hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {focal.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Position X Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Vị trí Ngang (Trục X)</span>
                    <span className="font-mono font-bold text-amber-600">{activeSlide.bgPositionX ?? 50}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={activeSlide.bgPositionX ?? 50}
                    onInput={(e: any) => updateActiveSlide('bgPositionX', Number(e.target.value))}
                    onChange={(e) => updateActiveSlide('bgPositionX', Number(e.target.value))}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full accent-amber-500 cursor-pointer touch-none"
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 px-0.5">
                    <span>Trái (0%)</span>
                    <span>Giữa (50%)</span>
                    <span>Phải (100%)</span>
                  </div>
                </div>

                {/* Position Y Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Vị trí Dọc (Trục Y)</span>
                    <span className="font-mono font-bold text-amber-600">{activeSlide.bgPositionY ?? 50}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={activeSlide.bgPositionY ?? 50}
                    onInput={(e: any) => updateActiveSlide('bgPositionY', Number(e.target.value))}
                    onChange={(e) => updateActiveSlide('bgPositionY', Number(e.target.value))}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full accent-amber-500 cursor-pointer touch-none"
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 px-0.5">
                    <span>Trên (0%)</span>
                    <span>Giữa (50%)</span>
                    <span>Dưới (100%)</span>
                  </div>
                </div>

                {/* Zoom / Scale Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Thu Phóng Ảnh (Zoom)</span>
                    <span className="font-mono font-bold text-amber-600">{activeSlide.bgZoom ?? 100}%</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={200}
                    step={2}
                    value={activeSlide.bgZoom ?? 100}
                    onInput={(e: any) => updateActiveSlide('bgZoom', Number(e.target.value))}
                    onChange={(e) => updateActiveSlide('bgZoom', Number(e.target.value))}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full accent-amber-500 cursor-pointer touch-none"
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 px-0.5">
                    <span>Vừa khít (100%)</span>
                    <span>Phóng to (200%)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDragCropMode(!isDragCropMode)}
                  className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                    isDragCropMode
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>{isDragCropMode ? 'Đang bật kéo chuột trực tiếp trên ảnh' : 'Bật kéo chuột trực tiếp trên khung ảnh'}</span>
                </button>
              </div>

              {/* Overlay Opacity Slider */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Độ tối lớp phủ nền</span>
                  <span className="font-mono font-bold text-amber-600">
                    {activeSlide.overlayOpacity ?? 50}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={95}
                  step={5}
                  value={activeSlide.overlayOpacity ?? 50}
                  onInput={(e: any) => updateActiveSlide('overlayOpacity', Number(e.target.value))}
                  onChange={(e) => updateActiveSlide('overlayOpacity', Number(e.target.value))}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full accent-amber-500 cursor-pointer touch-none"
                />
                <p className="text-[10px] text-slate-500">
                  Tăng độ tối giúp tiêu đề hiển thị nổi bật và tương phản rõ ràng hơn trên ảnh nền sáng.
                </p>
              </div>
            </div>
          )}

          {/* ---------------- TAB 2: TEXT & TYPOGRAPHY ---------------- */}
          {inspectorTab === 'text' && (
            <div className="space-y-3.5">
              {/* Tag */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Huy hiệu nhỏ</label>
                <input
                  type="text"
                  value={activeSlide.tag || ''}
                  onChange={(e) => updateActiveSlide('tag', e.target.value)}
                  placeholder="Ví dụ: BỘ SƯU TẬP MỚI, PHONG CÁCH EDC..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              {/* Main Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Tiêu đề chính</label>
                <input
                  type="text"
                  value={activeSlide.title}
                  onChange={(e) => updateActiveSlide('title', e.target.value)}
                  placeholder="Ví dụ: Tuyệt Tác Thủ Công..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-bold outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              {/* Highlight Keyword */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Từ khóa nổi bật</label>
                <input
                  type="text"
                  value={activeSlide.highlight || ''}
                  onChange={(e) => updateActiveSlide('highlight', e.target.value)}
                  placeholder="Ví dụ: Phong Cách Độc Bản, Đậm Chất Tôi..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-amber-700 font-bold outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              {/* Subtitle */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Mô tả phụ</label>
                <textarea
                  rows={2}
                  value={activeSlide.subtitle}
                  onChange={(e) => updateActiveSlide('subtitle', e.target.value)}
                  placeholder="Mô tả chi tiết về sản phẩm hoặc câu chuyện thương hiệu..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              {/* FONT SIZE CONTROLS */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Điều Chỉnh Cỡ Chữ</span>
                  <button
                    type="button"
                    onClick={() => {
                      updateActiveSlideFields({
                        titleFontSize: 32,
                        subtitleFontSize: 14,
                        contentMaxWidth: 80,
                        textPosition: 'center-left'
                      });
                    }}
                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors cursor-pointer flex items-center gap-1"
                    title="Tự động tối ưu cỡ chữ và lề để vừa vặn khung ảnh"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Tự động vừa vặn</span>
                  </button>
                </div>
                
                {/* Title Font Size */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Cỡ chữ Tiêu đề</span>
                    <span className="font-mono font-bold text-amber-600">{titleSize} px</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={56}
                    step={2}
                    value={titleSize}
                    onInput={(e: any) => updateActiveSlide('titleFontSize', Number(e.target.value))}
                    onChange={(e) => updateActiveSlide('titleFontSize', Number(e.target.value))}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full accent-amber-500 cursor-pointer touch-none"
                  />
                </div>

                {/* Subtitle Font Size */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Cỡ chữ Mô tả phụ</span>
                    <span className="font-mono font-bold text-amber-600">{subtitleSize} px</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={22}
                    step={1}
                    value={subtitleSize}
                    onInput={(e: any) => updateActiveSlide('subtitleFontSize', Number(e.target.value))}
                    onChange={(e) => updateActiveSlide('subtitleFontSize', Number(e.target.value))}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full accent-amber-500 cursor-pointer touch-none"
                  />
                </div>
              </div>

              {/* COLOR SELECTION */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-800 block">Màu Sắc Văn Bản</span>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600">Màu tiêu đề</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={activeSlide.titleColor || '#FFFFFF'}
                        onChange={(e) => updateActiveSlide('titleColor', e.target.value)}
                        className="w-7 h-7 rounded border border-slate-200 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={activeSlide.titleColor || '#FFFFFF'}
                        onChange={(e) => updateActiveSlide('titleColor', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600">Màu từ khóa</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={activeSlide.highlightColor || '#F59E0B'}
                        onChange={(e) => updateActiveSlide('highlightColor', e.target.value)}
                        className="w-7 h-7 rounded border border-slate-200 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={activeSlide.highlightColor || '#F59E0B'}
                        onChange={(e) => updateActiveSlide('highlightColor', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* FONT FAMILY, LETTER SPACING & SHADOW */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">Phông Tiêu đề</label>
                    <select
                      value={activeSlide.titleFontFamily || activeSlide.fontFamily || 'sans'}
                      onChange={(e) => updateActiveSlide('titleFontFamily', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none cursor-pointer"
                    >
                      <option value="sans">Hiện đại (Sans)</option>
                      <option value="display">Nổi bật (Display)</option>
                      <option value="serif">Cổ điển (Serif)</option>
                      <option value="mono">Đơn cách (Mono)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">Phông Mô tả phụ</label>
                    <select
                      value={activeSlide.subtitleFontFamily || activeSlide.fontFamily || 'sans'}
                      onChange={(e) => updateActiveSlide('subtitleFontFamily', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none cursor-pointer"
                    >
                      <option value="sans">Hiện đại (Sans)</option>
                      <option value="display">Nổi bật (Display)</option>
                      <option value="serif">Cổ điển (Serif)</option>
                      <option value="mono">Đơn cách (Mono)</option>
                    </select>
                  </div>
                </div>

                {/* Shadow & Animation Toggle */}
                <div className="flex flex-col gap-1 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeSlide.textShadow !== false}
                      onChange={(e) => updateActiveSlide('textShadow', e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0"
                    />
                    <span className="font-semibold">Đổ bóng chữ chống chói nền</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!activeSlide.disableAnimation}
                      onChange={(e) => updateActiveSlide('disableAnimation', !e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0"
                    />
                    <span className="font-semibold">Hiệu ứng chữ xuất hiện</span>
                  </label>
                </div>
              </div>

              {/* ALIGNMENT & POSITION */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">Căn lề Tiêu đề</label>
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                      {['left', 'center', 'right'].map(align => (
                        <button
                          key={`t-${align}`}
                          type="button"
                          onClick={() => updateActiveSlide('titleTextAlign', align)}
                          className={`flex-1 py-1 rounded text-xs flex justify-center cursor-pointer ${
                            (activeSlide.titleTextAlign || currentAlign) === align ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                          }`}
                          title={`Căn ${align}`}
                        >
                          {align === 'left' ? <AlignLeft className="w-3.5 h-3.5" /> : align === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">Căn lề Mô tả</label>
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                      {['left', 'center', 'right'].map(align => (
                        <button
                          key={`s-${align}`}
                          type="button"
                          onClick={() => updateActiveSlide('subtitleTextAlign', align)}
                          className={`flex-1 py-1 rounded text-xs flex justify-center cursor-pointer ${
                            (activeSlide.subtitleTextAlign || currentAlign) === align ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                          }`}
                          title={`Căn ${align}`}
                        >
                          {align === 'left' ? <AlignLeft className="w-3.5 h-3.5" /> : align === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600">Vị trí khối chữ</label>
                  <div className="grid grid-cols-3 gap-0.5 bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit mx-auto">
                    {[
                      { id: 'top-left', label: '↖' },
                      { id: 'top-center', label: '↑' },
                      { id: 'top-right', label: '↗' },
                      { id: 'center-left', label: '←' },
                      { id: 'center', label: '•' },
                      { id: 'center-right', label: '→' },
                      { id: 'bottom-left', label: '↙' },
                      { id: 'bottom-center', label: '↓' },
                      { id: 'bottom-right', label: '↘' }
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => handleSelectPosition(pos.id)}
                        className={`w-5 h-5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          (activeSlide.textPosition || 'center') === pos.id
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                  
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1">
                      <span>Độ rộng tối đa</span>
                      <span>{activeSlide.contentMaxWidth || 50}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="30" max="100" step="5" 
                      value={activeSlide.contentMaxWidth || 50} 
                      onInput={(e: any) => updateActiveSlide('contentMaxWidth', Number(e.target.value))}
                      onChange={(e) => updateActiveSlide('contentMaxWidth', Number(e.target.value))} 
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-full accent-amber-500 cursor-pointer touch-none" 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- TAB 3: BUTTON & CTA ---------------- */}
          {inspectorTab === 'button' && (
            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Nội dung nút bấm</label>
                <input
                  type="text"
                  value={activeSlide.buttonText}
                  onChange={(e) => updateActiveSlide('buttonText', e.target.value)}
                  placeholder="Khám phá ngay, Xem bộ sưu tập..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-bold outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Đường dẫn danh mục khi bấm</label>
                <input
                  type="text"
                  value={activeSlide.categoryLink}
                  onChange={(e) => updateActiveSlide('categoryLink', e.target.value)}
                  placeholder="all, keychains, bracelets..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-amber-500 font-mono"
                />
              </div>

              {/* Button Size */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-600">Cỡ chữ nút bấm</span>
                  <span className="font-mono font-bold text-amber-600">{buttonSize} px</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={20}
                  step={1}
                  value={buttonSize}
                  onInput={(e: any) => updateActiveSlide('buttonFontSize', Number(e.target.value))}
                  onChange={(e) => updateActiveSlide('buttonFontSize', Number(e.target.value))}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full accent-amber-500 cursor-pointer touch-none"
                />
              </div>

              {/* Button Shape */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-700">Kiểu bo góc nút</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => updateActiveSlide('buttonStyle', 'pill')}
                    className={`py-1 rounded text-xs font-semibold cursor-pointer ${
                      buttonShape === 'pill' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    Bo tròn
                  </button>
                  <button
                    type="button"
                    onClick={() => updateActiveSlide('buttonStyle', 'rounded')}
                    className={`py-1 rounded text-xs font-semibold cursor-pointer ${
                      buttonShape === 'rounded' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    Bo vừa
                  </button>
                  <button
                    type="button"
                    onClick={() => updateActiveSlide('buttonStyle', 'square')}
                    className={`py-1 rounded text-xs font-semibold cursor-pointer ${
                      buttonShape === 'square' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    Vuông
                  </button>
                </div>
              </div>

              {/* Button Colors */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-800 block">Màu Sắc Nút Bấm</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600">Màu nền nút</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={activeSlide.buttonBgColor || '#FFFFFF'}
                        onChange={(e) => updateActiveSlide('buttonBgColor', e.target.value)}
                        className="w-7 h-7 rounded border border-slate-200 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={activeSlide.buttonBgColor || '#FFFFFF'}
                        onChange={(e) => updateActiveSlide('buttonBgColor', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600">Màu chữ nút</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={activeSlide.buttonTextColor || '#0F172A'}
                        onChange={(e) => updateActiveSlide('buttonTextColor', e.target.value)}
                        className="w-7 h-7 rounded border border-slate-200 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={activeSlide.buttonTextColor || '#0F172A'}
                        onChange={(e) => updateActiveSlide('buttonTextColor', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                Nút bấm tự động căn lề (giữa, trái, phải) đồng bộ chuẩn xác với cấu hình vị trí khối chữ trên màn hình.
              </div>
            </div>
          )}

          {/* ---------------- TAB 4: DESIGN PRESETS ---------------- */}
          {inspectorTab === 'presets' && (
            <div className="space-y-3">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Bộ Mẫu Phong Cách Nhanh</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Áp dụng phong cách thiết kế chuyên nghiệp chỉ với 1 thao tác bấm:
                </p>
              </div>

              <div className="space-y-2.5">
                {DESIGN_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => updateActiveSlideFields(preset.config)}
                    className="w-full p-3 rounded-xl border border-slate-200 hover:border-amber-500 bg-slate-50/70 hover:bg-amber-50/30 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 group-hover:text-amber-700">
                        {preset.name}
                      </span>
                      <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5">
                        <span>Áp dụng</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {preset.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
