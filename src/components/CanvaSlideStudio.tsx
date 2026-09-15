import React, { useState, useRef, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Copy, 
  MoveUp, 
  MoveDown, 
  Upload, 
  Type, 
  Link as LinkIcon, 
  MousePointerClick, 
  Move, 
  ChevronRight,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Layers,
  ZoomIn,
  Compass,
  ArrowUpRight,
  Check,
  Loader2,
  Save
} from 'lucide-react';
import { SiteHeroSlide, BillboardTextBox, CategoryItem, CollectionInfo } from '../types';

interface CanvaSlideStudioProps {
  slides: SiteHeroSlide[];
  onChangeSlides: (slides: SiteHeroSlide[]) => void;
  onSave?: (slides: SiteHeroSlide[]) => Promise<void> | void;
  brandName?: string;
  categories?: CategoryItem[];
  collections?: CollectionInfo[];
}

const DEFAULT_SLIDE_TEMPLATE: SiteHeroSlide = {
  id: '',
  title: 'Billboard Banner',
  bgImage: 'https://images.unsplash.com/photo-1611591475102-468ae7f6305a?auto=format&fit=crop&w=1920&q=85',
  categoryLink: 'all',
  order: 1,
  isActive: true,
  aspectRatio: '16:7',
  bgPositionX: 50,
  bgPositionY: 50,
  bgZoom: 100,
  bgFit: 'cover',
  overlayOpacity: 0,
  textBoxes: []
};

const FONT_PRESETS = [
  { id: 'sans', label: 'Hiện đại (Sans-serif)', font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: 'serif', label: 'Cổ điển (Serif)', font: 'Georgia, "Playfair Display", "Times New Roman", serif' },
  { id: 'display', label: 'Nổi bật (Display)', font: '"Montserrat", "Plus Jakarta Sans", sans-serif' },
  { id: 'mono', label: 'Kỹ thuật (Mono)', font: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
] as const;

const BUTTON_STYLE_PRESETS = [
  { id: 'solid_dark', label: 'Đen Tuyển', bg: '#09090b', color: '#ffffff', style: 'pill' },
  { id: 'solid_gold', label: 'Vàng Hoàng Kim', bg: '#f59e0b', color: '#09090b', style: 'pill' },
  { id: 'solid_white', label: 'Trắng Sang', bg: '#ffffff', color: '#09090b', style: 'pill' },
  { id: 'glass', label: 'Kính Mờ', bg: 'rgba(0,0,0,0.45)', color: '#ffffff', style: 'glass' },
  { id: 'outline', label: 'Viền Mảnh', bg: 'transparent', color: '#ffffff', style: 'outline' },
] as const;

export const CanvaSlideStudio: React.FC<CanvaSlideStudioProps> = ({
  slides,
  onChangeSlides,
  onSave,
  brandName = 'NOT A KNOT',
  categories = [],
  collections = [],
}) => {
  // Normalize slides
  const normalizedSlides = useMemo(() => {
    if (!slides || slides.length === 0) {
      return [{ ...DEFAULT_SLIDE_TEMPLATE, id: 'slide-1', order: 1 }];
    }
    return slides.map((s, idx) => ({
      ...s,
      id: s.id || `slide-${idx + 1}`,
      order: typeof s.order === 'number' ? s.order : idx + 1,
      isActive: s.isActive !== false,
      aspectRatio: '16:7',
      bgPositionX: s.bgPositionX ?? 50,
      bgPositionY: s.bgPositionY ?? 50,
      bgZoom: s.bgZoom ?? 100,
      bgFit: s.bgFit || 'cover',
      overlayOpacity: s.overlayOpacity ?? 30,
      textBoxes: Array.isArray(s.textBoxes) ? s.textBoxes : []
    }));
  }, [slides]);

  const [activeSlideId, setActiveSlideId] = useState<string>(
    normalizedSlides[0]?.id || 'slide-1'
  );
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [dragOverCanvas, setDragOverCanvas] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeSlideIndex = normalizedSlides.findIndex((s) => s.id === activeSlideId);
  const activeSlide: SiteHeroSlide =
    activeSlideIndex >= 0 ? normalizedSlides[activeSlideIndex] : normalizedSlides[0];

  const selectedBox = activeSlide?.textBoxes?.find((b) => b.id === selectedBoxId) || null;

  const commitSlides = (newSlides: SiteHeroSlide[]) => {
    onChangeSlides(newSlides);
  };

  const handleSaveBillboard = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      if (onSave) {
        await onSave(normalizedSlides);
      }
      setSaveSuccessMsg('Đã lưu Billboard thành công! Website khách hàng đã được cập nhật.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Lỗi khi lưu billboard:', err);
      alert('Có lỗi xảy ra khi lưu billboard. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateActiveSlide = (patch: Partial<SiteHeroSlide>) => {
    const updated = normalizedSlides.map((s) => {
      if (s.id === activeSlide.id) {
        return { ...s, ...patch };
      }
      return s;
    });
    commitSlides(updated);
  };

  const handleMoveSlide = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= normalizedSlides.length) return;
    const copy = [...normalizedSlides];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    const reordered = copy.map((item, idx) => ({ ...item, order: idx + 1 }));
    commitSlides(reordered);
  };

  const handleAddSlide = () => {
    const newId = `slide-${Date.now()}`;
    const newSlide: SiteHeroSlide = {
      ...DEFAULT_SLIDE_TEMPLATE,
      id: newId,
      title: `${brandName} BILLBOARD ${normalizedSlides.length + 1}`,
      order: normalizedSlides.length + 1,
      textBoxes: []
    };
    const updated = [...normalizedSlides, newSlide];
    commitSlides(updated);
    setActiveSlideId(newId);
    setSelectedBoxId(null);
  };

  const handleDuplicateSlide = (slide: SiteHeroSlide) => {
    const newId = `slide-${Date.now()}`;
    const duplicated: SiteHeroSlide = {
      ...slide,
      id: newId,
      title: `${slide.title || 'Billboard'} (Bản sao)`,
      order: slide.order + 1,
      textBoxes: slide.textBoxes?.map((b) => ({ ...b, id: `box-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` })) || []
    };
    const idx = normalizedSlides.findIndex((s) => s.id === slide.id);
    const copy = [...normalizedSlides];
    copy.splice(idx + 1, 0, duplicated);
    const reordered = copy.map((item, i) => ({ ...item, order: i + 1 }));
    commitSlides(reordered);
    setActiveSlideId(newId);
  };

  const handleDeleteSlide = (slideId: string) => {
    if (normalizedSlides.length <= 1) {
      alert('Phải giữ ít nhất 1 billboard.');
      return;
    }
    const filtered = normalizedSlides.filter((s) => s.id !== slideId);
    const reordered = filtered.map((item, i) => ({ ...item, order: i + 1 }));
    commitSlides(reordered);
    if (activeSlideId === slideId) {
      setActiveSlideId(reordered[0]?.id || '');
    }
  };

  const handleToggleSlideActive = (slideId: string) => {
    const updated = normalizedSlides.map((s) =>
      s.id === slideId ? { ...s, isActive: !s.isActive } : s
    );
    commitSlides(updated);
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh (JPG, PNG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 2048;
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
          const compressed = canvas.toDataURL('image/jpeg', 0.9);
          updateActiveSlide({ bgImage: compressed });
        } else {
          updateActiveSlide({ bgImage: e.target?.result as string });
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCanvas(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleAddTextBox = (isButton: boolean = false) => {
    const newBoxId = `box-${Date.now()}`;
    const newBox: BillboardTextBox = {
      id: newBoxId,
      text: isButton ? 'Khám Phá Ngay' : 'Nhập nội dung chữ...',
      x: isButton ? 40 : 30,
      y: isButton ? 68 : 38,
      fontFamily: isButton ? 'sans' : 'sans',
      fontSize: isButton ? 14 : 26,
      fontWeight: 700,
      color: isButton ? '#ffffff' : '#ffffff',
      align: isButton ? 'center' : 'left',
      visible: true,
      isButton,
      buttonStyle: 'pill',
      bgColor: isButton ? '#09090b' : undefined,
      link: isButton ? 'all' : undefined,
      textShadow: !isButton
    };

    const currentBoxes = activeSlide.textBoxes || [];
    updateActiveSlide({ textBoxes: [...currentBoxes, newBox] });
    setSelectedBoxId(newBoxId);
  };

  const updateSelectedBox = (patch: Partial<BillboardTextBox>) => {
    if (!selectedBoxId) return;
    const currentBoxes = activeSlide.textBoxes || [];
    const updatedBoxes = currentBoxes.map((b) =>
      b.id === selectedBoxId ? { ...b, ...patch } : b
    );
    updateActiveSlide({ textBoxes: updatedBoxes });
  };

  const handleDeleteBox = (boxId: string) => {
    const currentBoxes = activeSlide.textBoxes || [];
    updateActiveSlide({ textBoxes: currentBoxes.filter((b) => b.id !== boxId) });
    if (selectedBoxId === boxId) setSelectedBoxId(null);
  };

  const handleDuplicateBox = (box: BillboardTextBox) => {
    const newBoxId = `box-${Date.now()}`;
    const dup: BillboardTextBox = {
      ...box,
      id: newBoxId,
      x: Math.min(85, box.x + 4),
      y: Math.min(85, box.y + 4)
    };
    const currentBoxes = activeSlide.textBoxes || [];
    updateActiveSlide({ textBoxes: [...currentBoxes, dup] });
    setSelectedBoxId(newBoxId);
  };

  const handleBoxDragStart = (e: React.MouseEvent, boxId: string) => {
    e.stopPropagation();
    setSelectedBoxId(boxId);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const xPercent = Math.max(0, Math.min(92, ((moveEvent.clientX - rect.left) / rect.width) * 100));
      const yPercent = Math.max(0, Math.min(92, ((moveEvent.clientY - rect.top) / rect.height) * 100));

      const currentBoxes = activeSlide.textBoxes || [];
      const updated = currentBoxes.map((b) =>
        b.id === boxId ? { ...b, x: Math.round(xPercent), y: Math.round(yPercent) } : b
      );
      updateActiveSlide({ textBoxes: updated });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Helper font family resolve
  const getFontFamilyCSS = (fontKey?: string) => {
    const found = FONT_PRESETS.find(f => f.id === fontKey);
    return found ? found.font : 'system-ui, -apple-system, sans-serif';
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Studio Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 text-white p-3.5 rounded-2xl border border-neutral-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-9 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-neutral-950 font-black flex items-center justify-center text-xs tracking-wider shadow-md">
            BILLBOARD STUDIO
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Thiết Kế Banner & Billboard</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-800 text-amber-400 border border-neutral-700">
                Chung 1 ảnh & 1 tỉ lệ cho PC & Mobile
              </span>
            </h3>
            <p className="text-xs text-neutral-400">
              Kéo thả trực quan • Thêm chữ & nút liên kết cao cấp • Tự động đồng bộ toàn bộ website
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Direct Save Billboard Button */}
          <button
            type="button"
            onClick={handleSaveBillboard}
            disabled={isSaving}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Đang Lưu Billboard...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-emerald-200" />
                <span>Lưu Cài Đặt Billboard</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleAddSlide}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Thêm Billboard Mới</span>
          </button>
        </div>
      </div>

      {/* Save Success Alert */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Studio 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: Slides Deck (3 cols) */}
        <div className="lg:col-span-3 bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3 max-h-[820px] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
                Danh Sách Slide ({normalizedSlides.length})
              </span>
            </div>
            <span className="text-[11px] text-neutral-400 font-medium">Kéo đổi vị trí</span>
          </div>

          <div className="space-y-2.5">
            {normalizedSlides.map((slide, index) => {
              const isSelected = slide.id === activeSlideId;
              return (
                <div
                  key={slide.id}
                  onClick={() => {
                    setActiveSlideId(slide.id);
                    setSelectedBoxId(null);
                  }}
                  className={`relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-md'
                      : 'border-neutral-200/80 hover:border-neutral-300 bg-neutral-50/50 text-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-5 h-5 rounded-md font-mono text-[10px] font-bold flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-200 text-neutral-700'
                      }`}>
                        {slide.order || index + 1}
                      </span>
                      <span className="text-xs font-bold truncate">
                        {slide.title || `Billboard #${index + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleToggleSlideActive(slide.id)}
                        className={`p-1 rounded-md text-xs transition-colors cursor-pointer ${
                          slide.isActive 
                            ? isSelected ? 'text-emerald-400 hover:bg-neutral-800' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                            : isSelected ? 'text-neutral-500 hover:bg-neutral-800' : 'text-neutral-400 bg-neutral-100 hover:bg-neutral-200'
                        }`}
                        title={slide.isActive ? 'Đang hiển thị' : 'Đang ẩn'}
                      >
                        {slide.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(index, 'up')}
                        disabled={index === 0}
                        className={`p-1 rounded-md disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer ${
                          isSelected ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-neutral-200 text-neutral-600'
                        }`}
                        title="Di chuyển lên"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(index, 'down')}
                        disabled={index === normalizedSlides.length - 1}
                        className={`p-1 rounded-md disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer ${
                          isSelected ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-neutral-200 text-neutral-600'
                        }`}
                        title="Di chuyển xuống"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Slide Thumbnail */}
                  <div className="relative w-full aspect-[16/7] rounded-lg overflow-hidden bg-neutral-950 border border-neutral-200/40">
                    <img
                      src={slide.bgImage || '/assets/hero-bg.png'}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{
                        objectPosition: `${slide.bgPositionX ?? 50}% ${slide.bgPositionY ?? 50}%`,
                        transform: `scale(${(slide.bgZoom ?? 100) / 100})`
                      }}
                    />
                    {!slide.isActive && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white bg-neutral-800 px-2 py-0.5 rounded">Đã ẩn</span>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail action footer */}
                  <div className="flex items-center justify-end gap-2 text-[11px] pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleDuplicateSlide(slide)}
                      className={`px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 cursor-pointer font-medium ${
                        isSelected ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      <Copy className="w-3 h-3" />
                      <span>Nhân bản</span>
                    </button>
                    {normalizedSlides.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(slide.id)}
                        className="px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 text-rose-500 hover:bg-rose-500/10 cursor-pointer font-medium"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Xóa</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MIDDLE COLUMN: 16:7 Visual Studio Canvas (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          {/* Quick Toolbar */}
          <div className="bg-white p-2.5 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAddTextBox(false)}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-neutral-200"
              >
                <Type className="w-3.5 h-3.5 text-neutral-700" />
                <span>+ Thêm Chữ (Text)</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddTextBox(true)}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <MousePointerClick className="w-3.5 h-3.5 text-amber-400" />
                <span>+ Thêm Nút Bấm (CTA)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Đổi ảnh nền</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    processImageFile(file);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>

          {/* Canvas Container (Unified PC & Mobile) */}
          <div className="w-full mx-auto max-w-full">
            <div
              ref={canvasRef}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCanvas(true);
              }}
              onDragLeave={() => setDragOverCanvas(false)}
              onDrop={handleCanvasDrop}
              onClick={() => setSelectedBoxId(null)}
              className={`relative w-full aspect-[16/7] rounded-2xl overflow-hidden select-none shadow-2xl border-2 transition-all ${
                dragOverCanvas
                  ? 'border-amber-400 ring-4 ring-amber-400/20 bg-neutral-900 scale-[1.01]'
                  : 'border-neutral-900 bg-neutral-950'
              }`}
            >
              {/* Background Image Layer */}
              <img
                src={activeSlide.bgImage || '/assets/hero-bg.png'}
                alt=""
                className="absolute inset-0 w-full h-full pointer-events-none transition-transform duration-100 ease-out"
                style={{
                  objectFit: activeSlide.bgFit || 'cover',
                  objectPosition: `${activeSlide.bgPositionX ?? 50}% ${activeSlide.bgPositionY ?? 50}%`,
                  transform: `scale(${(activeSlide.bgZoom ?? 100) / 100})`,
                  transformOrigin: `${activeSlide.bgPositionX ?? 50}% ${activeSlide.bgPositionY ?? 50}%`
                }}
              />

              {/* Elegant Overlay */}
              {activeSlide.overlayOpacity !== 0 && (
                <div
                  className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-150"
                  style={{ opacity: (activeSlide.overlayOpacity ?? 30) / 100 }}
                />
              )}

              {/* Drag drop helper overlay */}
              {dragOverCanvas && (
                <div className="absolute inset-0 bg-amber-500/20 backdrop-blur-xs flex flex-col items-center justify-center text-amber-300 font-bold gap-2 z-30">
                  <Upload className="w-8 h-8 animate-bounce text-amber-400" />
                  <span className="text-sm shadow-md bg-neutral-950/80 px-3 py-1 rounded-full border border-amber-400/30">
                    Thả file ảnh để áp dụng làm hình nền
                  </span>
                </div>
              )}

              {/* Interactive Text & Buttons on Canvas */}
              {activeSlide.textBoxes?.map((box) => {
                if (box.visible === false) return null;
                const isSelected = box.id === selectedBoxId;
                const isBtn = box.isButton;
                const btnStyle = box.buttonStyle || 'pill';

                return (
                  <div
                    key={box.id}
                    onMouseDown={(e) => handleBoxDragStart(e, box.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBoxId(box.id);
                    }}
                    className={`absolute cursor-move transition-transform select-none ${
                      isSelected
                        ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black/60 z-30'
                        : 'hover:ring-1 hover:ring-white/60 z-20'
                    }`}
                    style={{
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                    }}
                  >
                    <div
                      className={`${
                        isBtn
                          ? `px-4 py-2 font-bold shadow-xl flex items-center justify-center gap-1.5 transition-all ${
                              btnStyle === 'rounded'
                                ? 'rounded-xl'
                                : btnStyle === 'square'
                                ? 'rounded-xs'
                                : btnStyle === 'outline'
                                ? 'rounded-full border-2 border-current bg-black/40 backdrop-blur-xs'
                                : btnStyle === 'glass'
                                ? 'rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white'
                                : 'rounded-full'
                            }`
                          : ''
                      } ${box.isUppercase ? 'uppercase tracking-wider' : ''} ${box.isItalic ? 'italic' : ''}`}
                      style={{
                        color: box.color || '#ffffff',
                        backgroundColor: isBtn && btnStyle !== 'outline' && btnStyle !== 'glass' ? (box.bgColor || '#09090b') : undefined,
                        fontFamily: getFontFamilyCSS(box.fontFamily),
                        fontSize: `clamp(11px, ${(box.fontSize || 16) * 0.12}vw, ${box.fontSize || 16}px)`,
                        fontWeight: box.fontWeight || 600,
                        textAlign: box.align || 'left',
                        textShadow: box.textShadow !== false && !isBtn ? '0 2px 8px rgba(0,0,0,0.85)' : 'none',
                      }}
                    >
                      <span>{box.text}</span>
                      {isBtn && <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </div>

                    {/* Minimalist Selection indicator */}
                    {isSelected && (
                      <div className="absolute -top-6 -left-1 bg-amber-400 text-neutral-950 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase flex items-center gap-1 shadow-md">
                        <Move className="w-2.5 h-2.5" />
                        <span>Kéo</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty state helper */}
              {(!activeSlide.textBoxes || activeSlide.textBoxes.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-neutral-950/75 backdrop-blur-md px-4 py-2.5 rounded-2xl text-center border border-white/10 shadow-xl">
                    <p className="text-xs font-bold text-white">Billboard chưa có chữ hoặc nút tùy chỉnh</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">Bấm "+ Thêm Chữ" hoặc "+ Thêm Nút Bấm" ở trên để thiết kế</p>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-neutral-500 text-center mt-2 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Nhấp chuột vào chữ hoặc nút trên khung 16:7 để di chuyển vị trí và tùy biến thuộc tính</span>
            </p>
          </div>

          {/* Background Image Adjustments (Pan, Zoom, Overlay) */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 uppercase">
                <Compass className="w-3.5 h-3.5 text-neutral-500" />
                <span>Căn Chỉnh Hình Nền Billboard</span>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">Khung 16:7</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Pan X */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-neutral-700">
                  <span>Căn ngang (X)</span>
                  <span className="font-mono text-amber-600 font-bold">{activeSlide.bgPositionX ?? 50}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={activeSlide.bgPositionX ?? 50}
                  onChange={(e) => updateActiveSlide({ bgPositionX: Number(e.target.value) })}
                  className="w-full accent-amber-500 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* Pan Y */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-neutral-700">
                  <span>Căn dọc (Y)</span>
                  <span className="font-mono text-amber-600 font-bold">{activeSlide.bgPositionY ?? 50}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={activeSlide.bgPositionY ?? 50}
                  onChange={(e) => updateActiveSlide({ bgPositionY: Number(e.target.value) })}
                  className="w-full accent-amber-500 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* Zoom */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-neutral-700">
                  <span>Phóng to (Zoom)</span>
                  <span className="font-mono text-amber-600 font-bold">{activeSlide.bgZoom ?? 100}%</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="200"
                  value={activeSlide.bgZoom ?? 100}
                  onChange={(e) => updateActiveSlide({ bgZoom: Number(e.target.value) })}
                  className="w-full accent-amber-500 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-neutral-100">
              {/* Overlay Opacity */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-neutral-700">
                  <span>Độ tối lớp phủ (Overlay)</span>
                  <span className="font-mono text-amber-600 font-bold">{activeSlide.overlayOpacity ?? 30}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  value={activeSlide.overlayOpacity ?? 30}
                  onChange={(e) => updateActiveSlide({ overlayOpacity: Number(e.target.value) })}
                  className="w-full accent-amber-500 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* Image URL direct */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700 block">Link ảnh URL trực tiếp</label>
                <input
                  type="text"
                  value={activeSlide.bgImage || ''}
                  onChange={(e) => updateActiveSlide({ bgImage: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-xs text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Element Inspector & Link Settings (3 cols) */}
        <div className="lg:col-span-3 bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <span className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
              {selectedBox ? (selectedBox.isButton ? 'Chỉnh Sửa Nút Bấm' : 'Chỉnh Sửa Chữ') : 'Thuộc Tính Phần Tử'}
            </span>
            {selectedBox && (
              <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                X: {selectedBox.x}% | Y: {selectedBox.y}%
              </span>
            )}
          </div>

          {selectedBox ? (
            <div className="space-y-3.5">
              {/* Text Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Nội dung văn bản</label>
                <input
                  type="text"
                  value={selectedBox.text}
                  onChange={(e) => updateSelectedBox({ text: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 font-semibold"
                  placeholder="Nhập chữ hiển thị..."
                />
              </div>

              {/* Link Setting */}
              <div className="space-y-1.5 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                <label className="text-xs font-bold text-neutral-900 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-amber-600" />
                    <span>Liên kết khi người dùng bấm</span>
                  </div>
                  {selectedBox.link && (
                    <span className="text-[10px] text-emerald-600 font-medium">✓ Đã gắn link</span>
                  )}
                </label>
                <input
                  type="text"
                  value={selectedBox.link || ''}
                  onChange={(e) => updateSelectedBox({ link: e.target.value })}
                  placeholder="all, #products, hoặc https://..."
                  className="w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 outline-none focus:border-neutral-900 font-mono"
                />
                
                {/* Quick Destination Chips */}
                <div className="flex flex-wrap gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => updateSelectedBox({ link: 'all' })}
                    className="px-2 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-md text-[10px] font-semibold text-neutral-700 transition-colors cursor-pointer"
                  >
                    Tất cả SP
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedBox({ link: '#products-section' })}
                    className="px-2 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-md text-[10px] font-semibold text-neutral-700 transition-colors cursor-pointer"
                  >
                    Cuộn xuống SP
                  </button>
                  {categories.slice(0, 3).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => updateSelectedBox({ link: cat.id })}
                      className="px-2 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-md text-[10px] font-semibold text-neutral-700 transition-colors cursor-pointer"
                    >
                      {cat.label || cat.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Typography: Font Family & Size */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700">Kiểu Font chữ</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {FONT_PRESETS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => updateSelectedBox({ fontFamily: f.id as any })}
                      className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-all text-left truncate cursor-pointer ${
                        (selectedBox.fontFamily || 'sans') === f.id
                          ? 'bg-neutral-900 text-white shadow-sm ring-1 ring-neutral-900'
                          : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                      }`}
                      style={{ fontFamily: f.font }}
                    >
                      {f.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size & Formats */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
                  <span>Cỡ chữ</span>
                  <span className="font-mono text-neutral-900 font-bold">{selectedBox.fontSize || 16}px</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="64"
                  value={selectedBox.fontSize || 16}
                  onChange={(e) => updateSelectedBox({ fontSize: Number(e.target.value) })}
                  className="w-full accent-neutral-900 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* Format Buttons */}
              <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                <button
                  type="button"
                  onClick={() => updateSelectedBox({ fontWeight: selectedBox.fontWeight === 700 ? 400 : 700 })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                    selectedBox.fontWeight === 700 ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                  title="In đậm"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedBox({ isItalic: !selectedBox.isItalic })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                    selectedBox.isItalic ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                  title="In nghiêng"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedBox({ isUppercase: !selectedBox.isUppercase })}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${
                    selectedBox.isUppercase ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                  title="In hoa (UPPERCASE)"
                >
                  AA
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedBox({ align: 'left' })}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition-all flex items-center justify-center cursor-pointer ${
                    selectedBox.align === 'left' ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedBox({ align: 'center' })}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition-all flex items-center justify-center cursor-pointer ${
                    selectedBox.align === 'center' ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedBox({ align: 'right' })}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition-all flex items-center justify-center cursor-pointer ${
                    selectedBox.align === 'right' ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Button Styling Presets (When button is selected) */}
              {selectedBox.isButton && (
                <div className="space-y-2.5 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <label className="text-xs font-bold text-neutral-900 block">Kiểu dáng Nút Bấm</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {BUTTON_STYLE_PRESETS.map((bp) => (
                      <button
                        key={bp.id}
                        type="button"
                        onClick={() => updateSelectedBox({
                          buttonStyle: bp.style,
                          bgColor: bp.bg,
                          color: bp.color
                        })}
                        className="px-2 py-1.5 rounded-lg text-xs font-semibold text-center border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-800 transition-colors cursor-pointer"
                      >
                        {bp.label}
                      </button>
                    ))}
                  </div>

                  {/* Button Background Color Picker */}
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60">
                    <span className="text-xs font-medium text-neutral-700">Màu nền nút</span>
                    <div className="flex items-center gap-1.5">
                      {['#09090b', '#ffffff', '#f59e0b', '#dc2626', '#0284c7'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateSelectedBox({ bgColor: c })}
                          className="w-5 h-5 rounded-full border border-neutral-300 shadow-xs cursor-pointer"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <input
                        type="color"
                        value={selectedBox.bgColor || '#09090b'}
                        onChange={(e) => updateSelectedBox({ bgColor: e.target.value })}
                        className="w-6 h-6 rounded-md border border-neutral-300 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Text Color */}
              <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                <span className="text-xs font-semibold text-neutral-700">Màu chữ</span>
                <div className="flex items-center gap-1.5">
                  {['#ffffff', '#09090b', '#f59e0b', '#ef4444', '#10b981'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateSelectedBox({ color: c })}
                      className="w-5 h-5 rounded-full border border-neutral-300 shadow-xs cursor-pointer"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={selectedBox.color || '#ffffff'}
                    onChange={(e) => updateSelectedBox({ color: e.target.value })}
                    className="w-6 h-6 rounded-md border border-neutral-300 cursor-pointer"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => handleDuplicateBox(selectedBox)}
                  className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-colors border border-neutral-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Nhân bản</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteBox(selectedBox.id)}
                  className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-colors border border-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-neutral-200/80 flex items-center justify-center mx-auto text-neutral-500">
                <MousePointerClick className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-neutral-800">Chưa chọn phần tử nào</p>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Nhấp chuột vào bất kỳ chữ hoặc nút trên khung 16:7 để đổi màu, sửa chữ hoặc gán link liên kết.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

