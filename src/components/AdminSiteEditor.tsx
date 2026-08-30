import React, { useState, useRef } from 'react';
import { SiteContentConfig, CustomElementBlock, SiteHeroSlide } from '../types';
import { DEFAULT_SITE_CONTENT } from '../data/siteContent';
import { saveSiteContentToFirestore } from '../firebase';
import { Sparkles, ArrowRight, ArrowUp, ArrowDown, Eye, X, Upload, Check, Trash2, Smartphone, Monitor, ImagePlus } from 'lucide-react';
import { CanvaSlideStudio } from './CanvaSlideStudio';

interface AdminSiteEditorProps {
  initialConfig?: SiteContentConfig;
  onSaveConfig: (config: SiteContentConfig) => void;
  onPreviewWebsite: () => void;
}

export const AdminSiteEditor: React.FC<AdminSiteEditorProps> = ({
  initialConfig,
  onSaveConfig,
  onPreviewWebsite
}) => {
  const [config, setConfig] = useState<SiteContentConfig>(() => {
    return initialConfig || DEFAULT_SITE_CONTENT;
  });

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'hero' | 'custom_elements' | 'footer'>('general');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  
  // Live Preview Modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewHeroIndex, setPreviewHeroIndex] = useState(0);

  // Drag & drop state for hero slide upload
  const [dragOverSlideId, setDragOverSlideId] = useState<string | null>(null);
  const [dragOverLogo, setDragOverLogo] = useState<boolean>(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const processLogoImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP, SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
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
          const compressed = canvas.toDataURL('image/png');
          setConfig((prev) => ({ ...prev, logoUrl: compressed }));
        } else {
          setConfig((prev) => ({ ...prev, logoUrl: e.target?.result as string }));
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Save handler (Local state + Firestore sync + LocalStorage)
  const handleSave = async () => {
    setSaveStatus('saving');
    setStatusMsg('Đang lưu cấu hình...');
    try {
      // 1. Immediately persist locally & notify parent for instant UI update
      localStorage.setItem('nak_site_content', JSON.stringify(config));
      onSaveConfig(config);

      // 2. Sync to Firestore in background / fast promise with 3.5s timeout
      const syncPromise = saveSiteContentToFirestore(config);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3500)
      );

      await Promise.race([syncPromise, timeoutPromise]);
      setSaveStatus('success');
      setStatusMsg('Đã lưu và cập nhật toàn bộ website thành công!');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e: any) {
      console.warn('Đã lưu cục bộ thành công (Firebase nền đang đồng bộ):', e);
      onSaveConfig(config);
      setSaveStatus('success');
      setStatusMsg('Đã lưu thay đổi vào hệ thống thành công!');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('Bạn có chắc chắn muốn khôi phục toàn bộ nội dung website về mặc định gốc?')) {
      setConfig(DEFAULT_SITE_CONTENT);
      onSaveConfig(DEFAULT_SITE_CONTENT);
      localStorage.setItem('nak_site_content', JSON.stringify(DEFAULT_SITE_CONTENT));
      setSaveStatus('success');
      setStatusMsg('Đã khôi phục nội dung mặc định gốc!');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  // ----------------------------------------------------
  // Hero Slides Helpers
  // ----------------------------------------------------
  const handleAddHeroSlide = () => {
    const newSlide: SiteHeroSlide = {
      id: `slide-${Date.now()}`,
      tag: 'Bộ Sưu Tập Mới',
      title: 'Tiêu Đề Slide Mới',
      highlight: 'Phong Cách Độc Bản',
      subtitle: 'Mô tả ngắn gọn về bộ sưu tập và dòng phụ kiện thủ công.',
      bgImage: 'https://images.unsplash.com/photo-1611591475155-4286fa7c2e60?q=80&w=1200&auto=format&fit=crop',
      buttonText: 'Khám phá ngay',
      categoryLink: 'all',
      order: (config.heroSlides?.length || 0) + 1,
      isActive: true
    };
    setConfig((prev) => ({
      ...prev,
      heroSlides: [...(prev.heroSlides || []), newSlide]
    }));
  };

  const handleUpdateHeroSlide = (id: string, field: keyof SiteHeroSlide, val: any) => {
    setConfig((prev) => ({
      ...prev,
      heroSlides: prev.heroSlides.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    }));
  };

  const handleDeleteHeroSlide = (id: string) => {
    if (config.heroSlides.length <= 1) {
      alert('Cần giữ ít nhất 1 slide Hero Billboard trên trang chủ.');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      heroSlides: prev.heroSlides.filter((s) => s.id !== id)
    }));
  };

  const handleMoveSlideUp = (idx: number) => {
    if (idx <= 0) return;
    setConfig((prev) => {
      const slides = [...prev.heroSlides];
      const temp = slides[idx];
      slides[idx] = slides[idx - 1];
      slides[idx - 1] = temp;
      return {
        ...prev,
        heroSlides: slides.map((s, i) => ({ ...s, order: i + 1 }))
      };
    });
  };

  const handleMoveSlideDown = (idx: number) => {
    if (idx >= config.heroSlides.length - 1) return;
    setConfig((prev) => {
      const slides = [...prev.heroSlides];
      const temp = slides[idx];
      slides[idx] = slides[idx + 1];
      slides[idx + 1] = temp;
      return {
        ...prev,
        heroSlides: slides.map((s, i) => ({ ...s, order: i + 1 }))
      };
    });
  };

  const processHeroImageUpload = (file: File, slideId: string) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1600;
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
          handleUpdateHeroSlide(slideId, 'bgImage', compressed);
        } else {
          handleUpdateHeroSlide(slideId, 'bgImage', e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // ----------------------------------------------------
  // Custom Elements Helpers
  // ----------------------------------------------------
  const handleAddCustomElement = () => {
    const newElem: CustomElementBlock = {
      id: `elem-${Date.now()}`,
      type: 'guarantee',
      title: 'Tiêu Đề Khối Nội Dung Mới',
      subtitle: 'Phụ đề ngắn giới thiệu hoặc hướng dẫn',
      badge: 'Khối Đặc Biệt',
      content: 'Nội dung chi tiết của phần tử này. Bạn có thể viết nhiều dòng giới thiệu, cam kết, thông báo ưu đãi hoặc chính sách tại đây.',
      buttonText: 'Xem chi tiết',
      buttonLink: '#products',
      isActive: true,
      order: (config.customElements?.length || 0) + 1,
      bgStyle: 'glass'
    };
    setConfig((prev) => ({
      ...prev,
      customElements: [...(prev.customElements || []), newElem]
    }));
  };

  const handleUpdateCustomElement = (id: string, field: keyof CustomElementBlock, val: any) => {
    setConfig((prev) => ({
      ...prev,
      customElements: prev.customElements.map((e) => (e.id === id ? { ...e, [field]: val } : e))
    }));
  };

  const handleDeleteCustomElement = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      customElements: prev.customElements.filter((e) => e.id !== id)
    }));
  };

  const activeHeroSlides = (config.heroSlides || []).filter((s) => s.isActive);
  const currentPreviewSlide = activeHeroSlides[previewHeroIndex % (activeHeroSlides.length || 1)] || config.heroSlides[0];

  return (
    <div id="admin-site-editor" className="space-y-5">
      
      {/* Top Header & Action Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-slate-600 text-xs font-bold uppercase tracking-wider mb-0.5">
            Cấu Hình Giao Diện & Nội Dung
          </div>
          <h2 className="text-lg font-bold text-slate-900">Chỉnh Sửa Website & Hero Slides</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý thanh thông báo, slide trình diễn đầu trang, khối tùy chỉnh trang chủ và chân trang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Live Preview Button */}
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
            title="Xem trực tiếp giao diện đã cấu hình mà không cần rời trang admin"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Xem Trước Giao Diện</span>
          </button>

          <button
            onClick={onPreviewWebsite}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-all"
          >
            Về Trang Chủ
          </button>

          <button
            onClick={handleResetToDefault}
            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all"
          >
            Khôi phục gốc
          </button>

          <button
            id="admin-site-editor-save-btn"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{saveStatus === 'saving' ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {statusMsg && (
        <div className={`p-3 rounded-lg border text-xs font-bold ${
          saveStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-800'
        }`}>
          {statusMsg}
        </div>
      )}

      {/* Sub-Tabs Navigation (Removed 'about' us tab as requested) */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={() => setActiveSubTab('general')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'general' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Thông Tin Chung & Header
        </button>

        <button
          onClick={() => setActiveSubTab('hero')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'hero' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Slide Hero Billboard ({config.heroSlides?.length || 0})
        </button>

        <button
          onClick={() => setActiveSubTab('custom_elements')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'custom_elements' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Khối Tuỳ Chỉnh Trang Chủ ({config.customElements?.length || 0})
        </button>

        <button
          onClick={() => setActiveSubTab('footer')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'footer' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Chân Trang & Chính Sách
        </button>
      </div>

      {/* ----------------------------------------------------
          TAB 1: GENERAL & HEADER BAR
         ---------------------------------------------------- */}
      {activeSubTab === 'general' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900">1. Thương Hiệu & Thông Tin Chung</h3>
            <p className="text-xs text-slate-500 mt-0.5">Cấu hình tên thương hiệu, logo, khẩu hiệu/slogan và thanh thông báo ưu đãi đầu trang.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Logo (Ảnh)</label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverLogo(true);
                }}
                onDragLeave={() => setDragOverLogo(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverLogo(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) processLogoImageUpload(file);
                }}
                onClick={() => logoInputRef.current?.click()}
                className={`flex items-center gap-3 p-2 rounded-xl border border-dashed transition-all cursor-pointer bg-slate-50 ${
                  dragOverLogo ? 'border-amber-500 bg-amber-50' : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50/30'
                }`}
              >
                {config.logoUrl ? (
                  <div className="h-8 w-16 bg-white rounded border border-slate-200 flex items-center justify-center p-1 shrink-0 shadow-xs relative group">
                    <img src={config.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfig(prev => ({ ...prev, logoUrl: undefined }));
                      }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex shadow-sm z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-8 w-16 bg-slate-100 rounded border border-slate-200 flex items-center justify-center shrink-0">
                    <ImagePlus className="w-4 h-4 text-slate-400" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-800">{config.logoUrl ? 'Đổi Logo' : 'Tải Logo lên'}</span>
                  <span className="text-[9px] text-slate-500">JPG, PNG, WEBP</span>
                </div>
                <input
                  type="file"
                  ref={logoInputRef}
                  className="hidden"
                  accept="image/jpeg, image/png, image/webp, image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      processLogoImageUpload(file);
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Tên Thương Hiệu</label>
              <input
                type="text"
                value={config.brandName}
                onChange={(e) => setConfig({ ...config, brandName: e.target.value })}
                className="w-full h-[52px] bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white outline-none font-bold uppercase tracking-wider"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-bold text-slate-700">Khẩu Hiệu / Slogan</label>
              <input
                type="text"
                value={config.brandTagline}
                onChange={(e) => setConfig({ ...config, brandTagline: e.target.value })}
                className="w-full h-[52px] bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white outline-none font-semibold"
              />
            </div>
          </div>

          {/* Announcement Bar */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase">Thanh Thông Báo Ưu Đãi Đầu Trang</span>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={config.announcementActive}
                  onChange={(e) => setConfig({ ...config, announcementActive: e.target.checked })}
                  className="rounded text-slate-900 focus:ring-0"
                />
                <span className="text-slate-700 font-semibold">Hiển thị thanh này</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Nội dung thông báo</label>
                <input
                  type="text"
                  value={config.announcementText}
                  onChange={(e) => setConfig({ ...config, announcementText: e.target.value })}
                  placeholder="Sự Kiện 02/09: Nhận đặt trước BST Hào Khí Độc Lập - Giảm 15%..."
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Liên kết chuyển hướng</label>
                <input
                  type="text"
                  value={config.announcementLink || ''}
                  onChange={(e) => setConfig({ ...config, announcementLink: e.target.value })}
                  placeholder="#collection?id=event_0209 hoặc #products"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="border-t border-slate-200 pt-3 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thông Tin Liên Hệ</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Hotline</label>
                <input
                  type="text"
                  value={config.phone}
                  onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Số Zalo</label>
                <input
                  type="text"
                  value={config.zalo}
                  onChange={(e) => setConfig({ ...config, zalo: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Địa Chỉ Xưởng</label>
                <input
                  type="text"
                  value={config.address}
                  onChange={(e) => setConfig({ ...config, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Email Hỗ Trợ</label>
                <input
                  type="text"
                  value={config.email}
                  onChange={(e) => setConfig({ ...config, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          TAB 2: HERO BILLBOARD SLIDES (Canva / PowerPoint Slide Deck Studio)
         ---------------------------------------------------- */}
      {activeSubTab === 'hero' && (
        <CanvaSlideStudio
          slides={config.heroSlides || []}
          onChangeSlides={(newSlides) => setConfig((prev) => ({ ...prev, heroSlides: newSlides }))}
          brandName={config.brandName}
        />
      )}

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-50 animate-fadeIn">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="px-6 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-all shadow-2xl disabled:opacity-50 flex items-center gap-2 border border-slate-700/50"
        >
          <Check className="w-4 h-4" />
          <span>{saveStatus === 'saving' ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
        </button>
      </div>

      {/* ----------------------------------------------------
          TAB 3: CUSTOM EDITABLE ELEMENTS & SECTIONS
         ---------------------------------------------------- */}
      {activeSubTab === 'custom_elements' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
          {/* Explanation Banner */}
          <div className="p-4 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Vị trí hiển thị của Khối Tuỳ Chỉnh trên Website:</span>
              </div>
              <p className="text-xs text-indigo-900/80 leading-relaxed">
                Các khối tuỳ chỉnh này được hiển thị trực tiếp tại <strong>Trang Chủ (Landing Page)</strong> của website — nằm giữa khu vực Slide Hero Billboard và các Bộ sưu tập nổi bật, cũng như phía trên Chân trang. Bạn có thể bấm nút <strong>"Xem Trước Giao Diện"</strong> để kiểm tra vị trí thực tế!
              </p>
            </div>
            <button
              onClick={() => setShowPreviewModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shrink-0 shadow-xs flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem trực quan</span>
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Danh Sách Khối Nội Dung Tuỳ Chỉnh</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Thêm thông báo ưu đãi, cam kết chất lượng dù paracord, hoặc giải đáp thắc mắc.
              </p>
            </div>
            <button
              id="admin-add-custom-element-btn"
              onClick={handleAddCustomElement}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs"
            >
              + Thêm Khối Mới
            </button>
          </div>

          <div className="space-y-4">
            {config.customElements.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Chưa có khối phần tử tuỳ chỉnh nào. Bấm "+ Thêm Khối Mới" để tạo khối nội dung.
              </div>
            ) : (
              config.customElements.map((elem, idx) => (
                <div key={elem.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">Khối #{idx + 1}</span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        Loại: {elem.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={elem.isActive}
                          onChange={(e) => handleUpdateCustomElement(elem.id, 'isActive', e.target.checked)}
                          className="rounded text-slate-900"
                        />
                        <span>Hiển thị trên web</span>
                      </label>
                      <button
                        onClick={() => handleDeleteCustomElement(elem.id)}
                        className="text-rose-600 hover:text-rose-700 px-2 py-1 rounded text-xs font-bold hover:bg-rose-50"
                        title="Xóa khối này"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Loại khối phần tử</label>
                      <select
                        value={elem.type}
                        onChange={(e) => handleUpdateCustomElement(elem.id, 'type', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none font-semibold"
                      >
                        <option value="guarantee">Cam kết & Bảo đảm</option>
                        <option value="faq">Câu hỏi thường gặp</option>
                        <option value="banner">Banner thông báo đặc biệt</option>
                        <option value="custom_card">Thẻ giới thiệu phong cách</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Huy hiệu nhỏ</label>
                      <input
                        type="text"
                        value={elem.badge || ''}
                        onChange={(e) => handleUpdateCustomElement(elem.id, 'badge', e.target.value)}
                        placeholder="Cam kết vàng, Hỏi đáp..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Tiêu đề chính của khối</label>
                      <input
                        type="text"
                        value={elem.title}
                        onChange={(e) => handleUpdateCustomElement(elem.id, 'title', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none font-bold"
                      />
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Phụ đề giới thiệu ngắn</label>
                      <input
                        type="text"
                        value={elem.subtitle || ''}
                        onChange={(e) => handleUpdateCustomElement(elem.id, 'subtitle', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none"
                      />
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Nội dung chi tiết</label>
                      <textarea
                        rows={3}
                        value={elem.content}
                        onChange={(e) => handleUpdateCustomElement(elem.id, 'content', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Chữ trên nút</label>
                      <input
                        type="text"
                        value={elem.buttonText || ''}
                        onChange={(e) => handleUpdateCustomElement(elem.id, 'buttonText', e.target.value)}
                        placeholder="Tìm hiểu thêm, Mua ngay..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none font-semibold"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Liên kết nút bấm</label>
                      <input
                        type="text"
                        value={elem.buttonLink || ''}
                        onChange={(e) => handleUpdateCustomElement(elem.id, 'buttonLink', e.target.value)}
                        placeholder="#size-guide, #products, #collection?id=event_0209..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          TAB 4: FOOTER & POLICIES
         ---------------------------------------------------- */}
      {activeSubTab === 'footer' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900">4. Chân Trang & Chính Sách Khách Hàng</h3>
            <p className="text-xs text-slate-500 mt-0.5">Tùy chỉnh thông tin giới thiệu chân trang, liên kết mạng xã hội và cam kết bảo hành.</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Đoạn mô tả ngắn chân trang</label>
              <textarea
                rows={2}
                value={config.footerDescription}
                onChange={(e) => setConfig({ ...config, footerDescription: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 outline-none focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Dòng bản quyền</label>
              <input
                type="text"
                value={config.copyrightText}
                onChange={(e) => setConfig({ ...config, copyrightText: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Chính sách bảo hành nút thắt</label>
                <textarea
                  rows={3}
                  value={config.warrantyPolicy}
                  onChange={(e) => setConfig({ ...config, warrantyPolicy: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Chính sách giao hàng & COD</label>
                <textarea
                  rows={3}
                  value={config.shippingPolicy}
                  onChange={(e) => setConfig({ ...config, shippingPolicy: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 outline-none focus:bg-white"
                />
              </div>
            </div>

            {/* Social Links */}
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Đường Dẫn Mạng Xã Hội</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600 font-semibold">Facebook URL</label>
                  <input
                    type="text"
                    value={config.socialLinks.facebook}
                    onChange={(e) => setConfig({
                      ...config,
                      socialLinks: { ...config.socialLinks, facebook: e.target.value }
                    })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600 font-semibold">Instagram URL</label>
                  <input
                    type="text"
                    value={config.socialLinks.instagram}
                    onChange={(e) => setConfig({
                      ...config,
                      socialLinks: { ...config.socialLinks, instagram: e.target.value }
                    })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600 font-semibold">Threads URL</label>
                  <input
                    type="text"
                    value={config.socialLinks.threads}
                    onChange={(e) => setConfig({
                      ...config,
                      socialLinks: { ...config.socialLinks, threads: e.target.value }
                    })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          LIVE PREVIEW MODAL
         ---------------------------------------------------- */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl border border-slate-700 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-sm text-white">Xem Trước Giao Diện Website</span>
              </div>

              {/* Viewport switch & close */}
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-1 rounded-lg flex items-center gap-1 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                      previewDevice === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Máy tính</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                      previewDevice === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Điện thoại</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Container with Mock Website Viewport */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-950 p-4 sm:p-6 flex justify-center">
              <div
                className={`transition-all duration-300 bg-[#0C0D11] text-white rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden flex flex-col ${
                  previewDevice === 'mobile' ? 'w-[375px] my-auto min-h-[640px]' : 'w-full'
                }`}
              >
                {/* 1. Announcement Bar Preview */}
                {config.announcementActive && (
                  <div className="bg-red-600 text-white py-1.5 text-xs font-bold overflow-hidden relative">
                    <div className="whitespace-nowrap overflow-hidden">
                      <div className="inline-flex items-center gap-2 animate-marquee">
                        <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                        <span>{config.announcementText}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Top Nav Bar Preview */}
                <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    {config.logoUrl ? (
                      <img src={config.logoUrl} alt="Logo" className="h-5 w-auto object-contain shrink-0" />
                    ) : (
                      <span className="font-black text-sm tracking-wider uppercase text-white">
                        {config.brandName || 'NOT A KNOT'}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">
                    Live Component Simulator
                  </div>
                </div>

                {/* 3. Hero Carousel Simulator */}
                {currentPreviewSlide && (
                  <div className="relative h-[380px] sm:h-[460px] w-full overflow-hidden bg-neutral-900 flex items-center justify-center">
                    <img
                      src={currentPreviewSlide.bgImage}
                      alt={currentPreviewSlide.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ opacity: 1 }}
                    />
                    {/* Configurable Overlay Opacity */}
                    <div
                      className="absolute inset-0 bg-black"
                      style={{ opacity: (currentPreviewSlide.overlayOpacity ?? 50) / 100 }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20" />
                    
                    <div className={`relative z-10 p-6 sm:p-10 max-w-2xl w-full space-y-2 sm:space-y-3 flex flex-col ${
                      (currentPreviewSlide.textAlign || 'center') === 'center' ? 'items-center text-center mx-auto' :
                      (currentPreviewSlide.textAlign === 'right') ? 'items-end text-right ml-auto' : 'items-start text-left mr-auto'
                    }`}>
                      {currentPreviewSlide.tag && (
                        <span 
                          className="px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-xs border border-white/20 text-[10px] font-bold uppercase tracking-wider inline-block"
                          style={{ color: currentPreviewSlide.highlightColor || '#F59E0B' }}
                        >
                          {currentPreviewSlide.tag}
                        </span>
                      )}
                      <h2
                        className={`leading-tight ${
                          currentPreviewSlide.fontFamily === 'serif' ? 'font-serif' :
                          currentPreviewSlide.fontFamily === 'mono' ? 'font-mono' :
                          currentPreviewSlide.fontFamily === 'display' ? 'font-black tracking-tight' : 'font-sans'
                        } ${
                          currentPreviewSlide.letterSpacing === 'wide' ? 'tracking-widest' :
                          currentPreviewSlide.letterSpacing === 'tight' ? 'tracking-tight' : 'tracking-normal'
                        }`}
                        style={{ 
                          color: currentPreviewSlide.titleColor || '#FFFFFF',
                          textShadow: currentPreviewSlide.textShadow !== false ? '0 2px 8px rgba(0,0,0,0.8)' : 'none'
                        }}
                      >
                        <span 
                          className="block font-black"
                          style={{
                            fontSize: currentPreviewSlide.titleFontSize ? `${Math.min(currentPreviewSlide.titleFontSize, previewDevice === 'mobile' ? 22 : 36)}px` : undefined
                          }}
                        >
                          {currentPreviewSlide.title}
                        </span>
                        {currentPreviewSlide.highlight && (
                          <span 
                            className="block font-light mt-0.5"
                            style={{ 
                              color: currentPreviewSlide.highlightColor || '#F59E0B',
                              fontSize: currentPreviewSlide.titleFontSize ? `${Math.min(Math.round(currentPreviewSlide.titleFontSize * 0.75), previewDevice === 'mobile' ? 16 : 26)}px` : undefined
                            }}
                          >
                            {currentPreviewSlide.highlight}
                          </span>
                        )}
                      </h2>
                      {currentPreviewSlide.subtitle && (
                        <p 
                          className="line-clamp-2 max-w-lg font-normal leading-relaxed"
                          style={{
                            color: currentPreviewSlide.subtitleColor || '#E2E8F0',
                            fontSize: currentPreviewSlide.subtitleFontSize ? `${Math.min(currentPreviewSlide.subtitleFontSize, 14)}px` : undefined,
                            textShadow: currentPreviewSlide.textShadow !== false ? '0 1px 4px rgba(0,0,0,0.7)' : 'none'
                          }}
                        >
                          {currentPreviewSlide.subtitle}
                        </p>
                      )}
                      <div className={`pt-1 flex w-full ${
                        (currentPreviewSlide.textAlign || 'center') === 'center' ? 'justify-center' :
                        (currentPreviewSlide.textAlign === 'right') ? 'justify-end' : 'justify-start'
                      }`}>
                        <button
                          type="button"
                          className={`px-5 py-2 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xl hover:scale-105 transition-all ${
                            currentPreviewSlide.buttonStyle === 'rounded' ? 'rounded-xl' :
                            currentPreviewSlide.buttonStyle === 'square' ? 'rounded-xs' : 'rounded-full'
                          }`}
                          style={{
                            backgroundColor: currentPreviewSlide.buttonBgColor || '#FFFFFF',
                            color: currentPreviewSlide.buttonTextColor || '#0F172A',
                            fontSize: currentPreviewSlide.buttonFontSize ? `${currentPreviewSlide.buttonFontSize}px` : '13px'
                          }}
                        >
                          <span>{currentPreviewSlide.buttonText || 'Khám phá ngay'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Carousel Dots */}
                    {activeHeroSlides.length > 1 && (
                      <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/10">
                        {activeHeroSlides.map((_, dotIdx) => (
                          <button
                            key={dotIdx}
                            type="button"
                            onClick={() => setPreviewHeroIndex(dotIdx)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              (previewHeroIndex % activeHeroSlides.length) === dotIdx ? 'bg-amber-400 w-4' : 'bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Custom Elements Simulator */}
                <div className="p-6 space-y-6 bg-[#0C0D11] border-t border-neutral-800">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                      Vị trí: Khối Tuỳ Chỉnh Trên Trang Chủ
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">Nội dung bổ sung và cam kết thương hiệu</h3>
                  </div>

                  {config.customElements.filter((e) => e.isActive).length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-neutral-800 text-center text-xs text-neutral-500">
                      Hiện chưa kích hoạt khối tuỳ chỉnh nào
                    </div>
                  ) : (
                    config.customElements
                      .filter((e) => e.isActive)
                      .map((elem) => (
                        <div
                          key={elem.id}
                          className="bg-gradient-to-r from-amber-500/10 via-neutral-900 to-amber-500/10 border border-amber-400/30 rounded-2xl p-5 shadow-lg space-y-2"
                        >
                          {elem.badge && (
                            <span className="text-amber-300 text-[10px] font-bold uppercase tracking-wider block">
                              {elem.badge}
                            </span>
                          )}
                          <h4 className="text-base font-bold text-white">{elem.title}</h4>
                          {elem.subtitle && <p className="text-neutral-400 text-xs">{elem.subtitle}</p>}
                          <p className="text-neutral-300 text-xs leading-relaxed whitespace-pre-line">
                            {elem.content}
                          </p>
                          {elem.buttonText && (
                            <div className="pt-1">
                              <button
                                type="button"
                                className="px-3.5 py-1.5 rounded-full bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5"
                              >
                                <span>{elem.buttonText}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                  )}
                </div>

                {/* 5. Footer Preview */}
                <div className="p-6 bg-neutral-950 border-t border-neutral-800 text-xs text-neutral-400 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-1 max-w-sm">
                      <span className="font-bold text-sm text-white block">{config.brandName}</span>
                      <p className="text-[11px] leading-relaxed text-neutral-400">{config.footerDescription}</p>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <span className="font-bold text-neutral-300 block">Liên hệ xưởng</span>
                      <div>Hotline: {config.phone}</div>
                      <div>Zalo: {config.zalo}</div>
                      <div>Địa chỉ: {config.address}</div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-neutral-900 text-center text-[10px] text-neutral-500">
                    {config.copyrightText}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
              <span className="text-slate-400">
                Giao diện mô phỏng thời gian thực theo cấu hình đang sửa.
              </span>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold"
              >
                Đóng Xem Trước
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
