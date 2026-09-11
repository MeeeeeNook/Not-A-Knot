import React, { useState, useRef } from 'react';
import { SiteContentConfig, CustomElementBlock, SiteHeroSlide, CategoryItem, CollectionInfo, FaqItem } from '../types';
import { DEFAULT_SITE_CONTENT } from '../data/siteContent';
import { DEFAULT_CATEGORIES } from '../data/categories';
import { COLLECTIONS_DATA } from '../data/collections';
import { saveSiteContentToFirestore } from '../firebase';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  X, 
  Upload, 
  Check, 
  Trash2, 
  Smartphone, 
  Monitor, 
  ImagePlus, 
  Link2, 
  ExternalLink, 
  HelpCircle, 
  Plus, 
  ChevronDown, 
  ChevronUp,
  Search,
  ShoppingBag,
  Menu,
  ShieldCheck,
  Truck,
  Lock,
  Wifi,
  Battery,
  CreditCard,
  QrCode
} from 'lucide-react';
import { CanvaSlideStudio } from './CanvaSlideStudio';
import { HeroBanners } from './HeroBanners';
import { LandingCollectionBanners } from './LandingCollectionBanners';
import { DynamicCustomElements } from './DynamicCustomElements';
import { AboutUsSection } from './AboutUsSection';
import { LandingFaqCommitments } from './LandingFaqCommitments';
import { Footer } from './Footer';

interface AdminSiteEditorProps {
  initialConfig?: SiteContentConfig;
  categories?: CategoryItem[];
  collections?: CollectionInfo[];
  onSaveConfig: (config: SiteContentConfig) => void;
  onPreviewWebsite?: () => void;
}

export const AdminSiteEditor: React.FC<AdminSiteEditorProps> = ({
  initialConfig,
  categories = DEFAULT_CATEGORIES,
  collections = COLLECTIONS_DATA,
  onSaveConfig,
  onPreviewWebsite
}) => {
  const [config, setConfig] = useState<SiteContentConfig>(() => {
    return initialConfig || DEFAULT_SITE_CONTENT;
  });

  const [isCustomAnnouncementLink, setIsCustomAnnouncementLink] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'hero' | 'hero_mobile' | 'faq' | 'footer'>('general');
  const [mobileStudioMode, setMobileStudioMode] = useState<'cards' | 'studio'>('cards');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  
  const [showResetModal, setShowResetModal] = useState(false);

  // Drag & drop state for hero slide upload
  const [dragOverSlideId, setDragOverSlideId] = useState<string | null>(null);
  const [dragOverMobileSlideId, setDragOverMobileSlideId] = useState<string | null>(null);
  const [dragOverLogo, setDragOverLogo] = useState<boolean>(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const mobileFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const processLogoImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatusMsg('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP, SVG).');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
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
    setStatusMsg('Đang lưu và đồng bộ lên Firebase Cloud...');
    try {
      // 1. Immediately persist locally & notify parent for instant UI update
      localStorage.setItem('nak_site_content', JSON.stringify(config));
      onSaveConfig(config);

      // 2. Sync to Firestore
      await saveSiteContentToFirestore(config);
      setSaveStatus('success');
      setStatusMsg('Đã lưu và đồng bộ toàn bộ website lên Firebase thành công!');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e: any) {
      console.warn('Lỗi đồng bộ Firebase cho site content:', e);
      onSaveConfig(config);
      setSaveStatus('success');
      setStatusMsg('Đã lưu cục bộ. Lưu ý: Lỗi đồng bộ Firebase Cloud, vui lòng kiểm tra kết nối.');
      setTimeout(() => setSaveStatus('idle'), 3500);
    }
  };

  const handleResetToDefault = () => {
    setShowResetModal(true);
  };

  const handleConfirmReset = () => {
    setConfig(DEFAULT_SITE_CONTENT);
    onSaveConfig(DEFAULT_SITE_CONTENT);
    localStorage.setItem('nak_site_content', JSON.stringify(DEFAULT_SITE_CONTENT));
    setSaveStatus('success');
    setStatusMsg('Đã khôi phục nội dung mặc định gốc!');
    setTimeout(() => setSaveStatus('idle'), 2500);
    setShowResetModal(false);
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
        const maxDim = 2560;
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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          let compressed = '';
          try {
            compressed = canvas.toDataURL('image/webp', 0.95);
            if (!compressed || !compressed.startsWith('data:image/webp')) {
              compressed = canvas.toDataURL('image/jpeg', 0.94);
            }
          } catch {
            compressed = canvas.toDataURL('image/jpeg', 0.94);
          }
          handleUpdateHeroSlide(slideId, 'bgImage', compressed);
        } else {
          handleUpdateHeroSlide(slideId, 'bgImage', e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processHeroMobileImageUpload = (file: File, slideId: string) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP).');
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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          let compressed = '';
          try {
            compressed = canvas.toDataURL('image/webp', 0.94);
            if (!compressed || !compressed.startsWith('data:image/webp')) {
              compressed = canvas.toDataURL('image/jpeg', 0.92);
            }
          } catch {
            compressed = canvas.toDataURL('image/jpeg', 0.92);
          }
          handleUpdateHeroSlide(slideId, 'bgImageMobile', compressed);
        } else {
          handleUpdateHeroSlide(slideId, 'bgImageMobile', e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddFaq = () => {
    const newFaq: FaqItem = {
      id: 'faq-' + Date.now(),
      q: '',
      a: ''
    };
    setConfig((prev) => ({
      ...prev,
      faqs: [...(prev.faqs || DEFAULT_SITE_CONTENT.faqs || []), newFaq]
    }));
  };

  const handleUpdateFaq = (id: string, field: 'q' | 'a', val: string) => {
    setConfig((prev) => {
      const currentFaqs = prev.faqs || DEFAULT_SITE_CONTENT.faqs || [];
      return {
        ...prev,
        faqs: currentFaqs.map((item) => (item.id === id ? { ...item, [field]: val } : item))
      };
    });
  };

  const handleDeleteFaq = (id: string) => {
    setConfig((prev) => {
      const currentFaqs = prev.faqs || DEFAULT_SITE_CONTENT.faqs || [];
      return {
        ...prev,
        faqs: currentFaqs.filter((item) => item.id !== id)
      };
    });
  };

  const handleMoveFaq = (index: number, direction: 'up' | 'down') => {
    setConfig((prev) => {
      const currentFaqs = [...(prev.faqs || DEFAULT_SITE_CONTENT.faqs || [])];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= currentFaqs.length) return prev;
      const temp = currentFaqs[index];
      currentFaqs[index] = currentFaqs[targetIndex];
      currentFaqs[targetIndex] = temp;
      return {
        ...prev,
        faqs: currentFaqs
      };
    });
  };

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
            Quản lý thanh thông báo, slide trình diễn đầu trang, câu hỏi thường gặp và chân trang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleResetToDefault}
            className="px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all cursor-pointer"
          >
            Khôi phục gốc
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

      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={() => setActiveSubTab('general')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'general' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Thông Tin Chung & Header
        </button>

        <button
          onClick={() => setActiveSubTab('hero')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'hero' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>🖥️ Billboard Máy Tính (PC)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeSubTab === 'hero' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {config.heroSlides?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('hero_mobile')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'hero_mobile' ? 'bg-amber-500 text-slate-950 shadow-xs font-black' : 'text-slate-700 hover:text-slate-900 hover:bg-amber-50'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-600" />
          <span>📱 Billboard Điện Thoại (Smartphone)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeSubTab === 'hero_mobile' ? 'bg-slate-950 text-amber-300' : 'bg-amber-100 text-amber-900'
          }`}>
            {config.heroSlides?.filter(s => !!s.bgImageMobile).length || 0}/{config.heroSlides?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('faq')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'faq' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Câu Hỏi Thường Gặp (FAQ) ({(config.faqs || DEFAULT_SITE_CONTENT.faqs || []).length})
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
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-900 uppercase">Thanh Thông Báo Ưu Đãi Đầu Trang</span>
              </div>
              <div className="flex items-center gap-3">
                {config.announcementText && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfig({ ...config, announcementText: '', announcementActive: false, announcementLink: '' });
                      setStatusMsg('Đã xóa nội dung thông báo ưu đãi.');
                      setSaveStatus('success');
                      setTimeout(() => setSaveStatus('idle'), 2500);
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer"
                    title="Xóa nội dung và tắt thông báo này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa thông báo</span>
                  </button>
                )}
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* Nội dung thông báo */}
              <div className="lg:col-span-7 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-600">Nội dung thông báo (hiển thị chạy chữ)</label>
                  {config.announcementText && (
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, announcementText: '' })}
                      className="text-[10px] text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
                    >
                      Xóa chữ
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={config.announcementText}
                  onChange={(e) => setConfig({ ...config, announcementText: e.target.value })}
                  placeholder="Ví dụ: 🇻🇳 Sự Kiện 02/09: Nhận đặt trước BST Hào Khí Độc Lập..."
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none font-medium focus:border-slate-400"
                />
              </div>

              {/* Menu Dropdown Chọn Trang Liên Kết Chuyển Hướng */}
              <div className="lg:col-span-5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                    <Link2 className="w-3 h-3 text-slate-500" />
                    <span>Trang liên kết khi bấm vào</span>
                  </label>
                  {config.announcementLink && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfig({ ...config, announcementLink: '' });
                        setIsCustomAnnouncementLink(false);
                      }}
                      className="text-[10px] text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
                    >
                      Không liên kết
                    </button>
                  )}
                </div>

                {/* Dropdown Menu các Trang của Website */}
                <select
                  value={
                    isCustomAnnouncementLink
                      ? '__custom__'
                      : (config.announcementLink || '')
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      setIsCustomAnnouncementLink(true);
                    } else {
                      setIsCustomAnnouncementLink(false);
                      setConfig({ ...config, announcementLink: val });
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400 font-medium cursor-pointer"
                >
                  <optgroup label="-- Tùy chọn cơ bản --">
                    <option value="">🚫 Không chuyển hướng (Chỉ xem chữ)</option>
                  </optgroup>

                  <optgroup label="-- Các Trang Chính --">
                    <option value="#products">🛍️ Trang: Tất cả sản phẩm</option>
                    <option value="#collection?id=event_0209">🇻🇳 Trang: BST Hào Khí 02/09 (Quốc Khánh)</option>
                    <option value="#about">📖 Trang: Về Chúng Tôi (Giới thiệu & Cam kết)</option>
                    <option value="#contact">📬 Trang: Liên Hệ (Gửi tin nhắn & Mạng xã hội)</option>
                  </optgroup>

                  {Array.isArray(collections) && collections.length > 0 && (
                    <optgroup label="-- Theo Bộ Sưu Tập (Collections) --">
                      {collections.map((col) => (
                        <option key={col.id} value={`#collection?id=${col.id}`}>
                          🌟 BST: {col.title || col.tag || col.id}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {Array.isArray(categories) && categories.length > 0 && (
                    <optgroup label="-- Theo Danh Mục Sản Phẩm --">
                      {categories.map((cat) => (
                        <option key={cat.id} value={`#products?category=${cat.id}`}>
                          📂 Danh mục: {cat.label || cat.id}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  <optgroup label="-- Tùy Chọn Nâng Cao --">
                    <option value="__custom__">🔗 Nhập liên kết tùy chỉnh / Web ngoài...</option>
                  </optgroup>
                </select>

                {/* Input nhập Custom Link nếu chọn Tùy chỉnh hoặc link không khớp danh sách */}
                {(isCustomAnnouncementLink || (config.announcementLink && ![
                  '',
                  '#products',
                  '#collection?id=event_0209',
                  '#about',
                  '#contact',
                  ...(collections || []).map((c) => `#collection?id=${c.id}`),
                  ...(categories || []).map((c) => `#products?category=${c.id}`)
                ].includes(config.announcementLink))) && (
                  <div className="pt-1.5 flex items-center gap-2 animate-fadeIn">
                    <input
                      type="text"
                      value={config.announcementLink || ''}
                      onChange={(e) => setConfig({ ...config, announcementLink: e.target.value })}
                      placeholder="https://facebook.com/... hoặc #custom-link"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomAnnouncementLink(false);
                        setConfig({ ...config, announcementLink: '' });
                      }}
                      className="text-xs px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg shrink-0 font-medium cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}

                <p className="text-[10px] text-slate-500">
                  {config.announcementLink
                    ? `Khi khách bấm vào thông báo sẽ mở: ${config.announcementLink}`
                    : 'Không đặt link chuyển hướng, khách hàng chỉ nhìn thấy nội dung chữ.'}
                </p>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thông Tin Liên Hệ & CSKH</h4>
              <span className="text-[11px] text-slate-500 italic">
                * Lưu ý: Ô nào không nhập (để trống) sẽ tự động ẩn hoàn toàn khỏi website.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Hotline */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-600">Hotline</label>
                  {config.phone && (
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, phone: '' })}
                      className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Xóa để ẩn hotline"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={config.phone || ''}
                  onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                  placeholder="Để trống nếu không dùng"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white font-semibold"
                />
              </div>

              {/* 2. Số Zalo */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    <span>Số Zalo</span>
                    <span className="text-[10px] text-slate-400 font-normal">(ẩn nếu trống)</span>
                  </label>
                  {config.zalo && (
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, zalo: '' })}
                      className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Xóa để ẩn hoàn toàn Zalo"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={config.zalo || ''}
                  onChange={(e) => setConfig({ ...config, zalo: e.target.value })}
                  placeholder="Để trống nếu không dùng Zalo"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white font-semibold"
                />
              </div>

              {/* 3. Địa Chỉ Xưởng */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-600">Địa Chỉ Xưởng</label>
                  {config.address && (
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, address: '' })}
                      className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Xóa để ẩn địa chỉ"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={config.address || ''}
                  onChange={(e) => setConfig({ ...config, address: e.target.value })}
                  placeholder="Để trống nếu không có"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white"
                />
              </div>

              {/* 4. Email Hỗ Trợ */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-600">Email Hỗ Trợ</label>
                  {config.email && (
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, email: '' })}
                      className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Xóa để ẩn email"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={config.email || ''}
                  onChange={(e) => setConfig({ ...config, email: e.target.value })}
                  placeholder="Để trống nếu không dùng"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          TAB 2: HERO BILLBOARD SLIDES (Canva / PowerPoint Slide Deck Studio for PC)
         ---------------------------------------------------- */}
      {activeSubTab === 'hero' && (
        <CanvaSlideStudio
          slides={config.heroSlides || []}
          onChangeSlides={(newSlides) => setConfig((prev) => ({ ...prev, heroSlides: newSlides }))}
          brandName={config.brandName}
          initialDevice="desktop"
          categories={categories}
          collections={collections}
        />
      )}

      {/* ----------------------------------------------------
          TAB 2B: DEDICATED SMARTPHONE BILLBOARD SECTION
         ---------------------------------------------------- */}
      {activeSubTab === 'hero_mobile' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50 p-5 sm:p-6 rounded-2xl border border-amber-200/80 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black shadow-xs">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    Billboard Dành Riêng Cho Điện Thoại (Smartphone)
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-bold uppercase tracking-wider">
                    Độc Lập Với PC
                  </span>
                </div>
                <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                  Tải lên và tùy chỉnh ảnh banner dọc riêng biệt cho khách hàng lướt web trên điện thoại di động (tỷ lệ chuẩn 9:16 hoặc 4:5). Ảnh trên máy tính (PC) và điện thoại hoàn toàn độc lập, đảm bảo ảnh không bị cắt xén, méo hình hay thu nhỏ quá mức trên smartphone.
                </p>
              </div>

              {/* Toggle Mode: Cards Quick Edit vs Full Canvas Studio */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileStudioMode('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    mobileStudioMode === 'cards'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>📋 Tải Ảnh & Cấu Hình Nhanh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileStudioMode('studio')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    mobileStudioMode === 'studio'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>🎨 Studio Canvas Điện Thoại</span>
                </button>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="p-3 bg-amber-100/50 rounded-xl border border-amber-200/60 text-xs text-amber-950 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Gợi ý tỷ lệ vàng cho Smartphone:</strong> Kích thước khuyến nghị cho ảnh dọc là <strong>1080 × 1920 px (tỷ lệ 9:16)</strong> hoặc <strong>1080 × 1350 px (tỷ lệ 4:5)</strong>. Nếu một slide chưa có ảnh riêng cho điện thoại, hệ thống sẽ tự động dùng ảnh PC với cơ chế hiển thị vừa vặn và tạo nền mờ thông minh, không làm vỡ bố cục.
              </div>
            </div>
          </div>

          {/* MODE A: FULL CANVAS STUDIO (FOCUSED ON SMARTPHONE) */}
          {mobileStudioMode === 'studio' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-600">
                  Đang mở chế độ Canvas Studio mô phỏng điện thoại di động
                </span>
                <button
                  type="button"
                  onClick={() => setMobileStudioMode('cards')}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                >
                  ← Quay lại danh sách quản lý ảnh nhanh
                </button>
              </div>
              <CanvaSlideStudio
                slides={config.heroSlides || []}
                onChangeSlides={(newSlides) => setConfig((prev) => ({ ...prev, heroSlides: newSlides }))}
                brandName={config.brandName}
                initialDevice="mobile"
                categories={categories}
                collections={collections}
              />
            </div>
          )}

          {/* MODE B: SLIDE-BY-SLIDE DEDICATED SMARTPHONE CARDS */}
          {mobileStudioMode === 'cards' && (
            <div className="space-y-6">
              {(config.heroSlides || []).map((slide, sIdx) => {
                const hasMobileImg = Boolean(slide.bgImageMobile);
                const activeMobileImg = slide.bgImageMobile || slide.bgImage || '/assets/hero-bg.png';
                const currentRatio = slide.aspectRatioMobile || '9:16';
                const currentFit = slide.bgFitMobile || (hasMobileImg ? 'cover' : 'contain');
                const posX = slide.bgPositionXMobile ?? (hasMobileImg ? 50 : slide.bgPositionX ?? 50);
                const posY = slide.bgPositionYMobile ?? (hasMobileImg ? 50 : slide.bgPositionY ?? 50);
                const zoom = slide.bgZoomMobile ?? (hasMobileImg ? 100 : slide.bgZoom ?? 100);

                return (
                  <div
                    key={slide.id || sIdx}
                    id={`mobile-billboard-card-${slide.id}`}
                    className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5"
                  >
                    {/* Slide Title & Status Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                          {sIdx + 1}
                        </span>
                        <h3 className="font-bold text-sm sm:text-base text-slate-900">
                          {slide.title || `Slide Billboard #${sIdx + 1}`}
                        </h3>
                        {slide.tag && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                            {slide.tag}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {hasMobileImg ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đã có ảnh riêng cho Smartphone</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>Đang dùng ảnh PC (chưa tải ảnh riêng)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Main Content Grid: Preview on Left, Controls on Right */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      
                      {/* Left: Device Visual Comparison (PC vs Smartphone) */}
                      <div className="lg:col-span-5 space-y-4">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Mô phỏng hiển thị trên Smartphone</span>
                          <span className="text-amber-700 font-mono text-[11px]">
                            {currentRatio === '9:16' ? 'Chuẩn Dọc 9:16' : currentRatio} • {currentFit}
                          </span>
                        </div>

                        {/* Smartphone Mockup Container */}
                        <div className="relative mx-auto w-48 sm:w-56 aspect-[9/16] rounded-3xl p-2.5 bg-slate-950 shadow-2xl border-4 border-slate-800 flex flex-col justify-between overflow-hidden">
                          {/* Top Speaker / Dynamic Island Notch */}
                          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900 rounded-full z-30 border border-slate-800/80 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-slate-950 mr-2" />
                            <div className="w-2.5 h-1 rounded-full bg-slate-800" />
                          </div>

                          {/* Inner Screen Area */}
                          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center">
                            {/* Blur ambient background for contain fit */}
                            {currentFit === 'contain' && (
                              <img
                                src={activeMobileImg}
                                alt=""
                                aria-hidden="true"
                                className="absolute inset-0 w-full h-full object-cover blur-xl opacity-50 scale-125 pointer-events-none"
                              />
                            )}

                            {/* Main Display Image */}
                            <img
                              src={activeMobileImg}
                              alt="Mobile Preview"
                              className={`w-full h-full ${
                                currentFit === 'contain'
                                  ? 'object-contain relative z-10'
                                  : currentFit === 'fill'
                                  ? 'object-fill'
                                  : 'object-cover'
                              }`}
                              style={{
                                objectPosition: `${posX}% ${posY}%`,
                                transform: `scale(${zoom / 100})`,
                                transformOrigin: `${posX}% ${posY}%`
                              }}
                            />

                            {/* Overlay Gradient & Sample Slide Typography */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent z-20 flex flex-col justify-end p-3.5 space-y-1 text-center pointer-events-none">
                              {slide.tag && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300 drop-shadow">
                                  {slide.tag}
                                </span>
                              )}
                              <h4 className="text-xs font-black text-white leading-tight drop-shadow">
                                {slide.title || 'Tiêu Đề Slide'}
                              </h4>
                              {slide.subtitle && (
                                <p className="text-[9px] text-slate-200 line-clamp-1 drop-shadow">
                                  {slide.subtitle}
                                </p>
                              )}
                              {slide.buttonText && slide.showButton !== false && (
                                <div className="pt-1">
                                  <span className="inline-block px-3 py-1 rounded-full text-[9px] font-bold bg-amber-400 text-slate-950 shadow-sm">
                                    {slide.buttonText}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* PC Thumbnail Reference */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                          <div className="w-16 h-10 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-300 relative">
                            <img
                              src={slide.bgImage || '/assets/hero-bg.png'}
                              alt="PC Version"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-slate-800 truncate">
                              🖥️ Ảnh gốc hiển thị trên Máy Tính (PC)
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {slide.aspectRatio || '16:9'} • Khách vào bằng PC sẽ thấy ảnh này
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Dedicated Smartphone Controls & Upload */}
                      <div className="lg:col-span-7 space-y-4">
                        {/* 1. Upload File & Drag/Drop Area */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                            <span>Tải Lên Ảnh Riêng Cho Smartphone</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              JPG, PNG, WebP (Tỷ lệ dọc 9:16 hoặc 4:5 khuyên dùng)
                            </span>
                          </label>

                          <input
                            type="file"
                            ref={(el) => (mobileFileInputRefs.current[slide.id] = el)}
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) processHeroMobileImageUpload(file, slide.id);
                            }}
                          />

                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverMobileSlideId(slide.id);
                            }}
                            onDragLeave={() => setDragOverMobileSlideId(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverMobileSlideId(null);
                              const file = e.dataTransfer.files?.[0];
                              if (file) processHeroMobileImageUpload(file, slide.id);
                            }}
                            onClick={() => mobileFileInputRefs.current[slide.id]?.click()}
                            className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                              dragOverMobileSlideId === slide.id
                                ? 'border-amber-500 bg-amber-50'
                                : 'border-slate-300 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/30'
                            }`}
                          >
                            <div className="p-2.5 rounded-full bg-white shadow-xs border border-slate-200 text-amber-600">
                              <Upload className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">
                                Nhấp để chọn ảnh dọc từ thiết bị hoặc kéo thả ảnh vào đây
                              </span>
                              <span className="text-[11px] text-slate-500">
                                Hệ thống sẽ tự động tối ưu hóa và nén hình ảnh chuẩn mobile tốc độ cao
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Direct Image URL Input */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Hoặc Nhập Đường Dẫn Link Ảnh Trực Tiếp
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={slide.bgImageMobile || ''}
                              onChange={(e) => handleUpdateHeroSlide(slide.id, 'bgImageMobile', e.target.value)}
                              placeholder="https://images.unsplash.com/... hoặc để trống nếu dùng chung ảnh PC"
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-amber-400 font-mono"
                            />
                            {hasMobileImg && (
                              <button
                                type="button"
                                onClick={() => handleUpdateHeroSlide(slide.id, 'bgImageMobile', '')}
                                className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                                title="Xóa ảnh riêng điện thoại, quay lại dùng chung ảnh PC"
                              >
                                Xóa ảnh riêng
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 3. Smartphone Aspect Ratio & Fit Mode */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* Aspect Ratio */}
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-800">
                              Tỷ Lệ Hiển Thị Smartphone
                            </label>
                            <select
                              value={slide.aspectRatioMobile || '9:16'}
                              onChange={(e) => handleUpdateHeroSlide(slide.id, 'aspectRatioMobile', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-amber-400 cursor-pointer"
                            >
                              <option value="9:16">📱 Chuẩn Dọc 9:16 (TikTok / Reels - Tốt nhất)</option>
                              <option value="4:5">📸 Dọc Gọn 4:5 (Instagram Feed)</option>
                              <option value="1:1">⏹️ Vuông Cân Đối 1:1</option>
                              <option value="16:9">🎬 Chuẩn Ngang 16:9</option>
                              <option value="fullscreen">📲 Tràn Toàn Màn Hình Điện Thoại</option>
                            </select>
                          </div>

                          {/* Fit Mode */}
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-800">
                              Chế Độ Vừa Khung (Fit)
                            </label>
                            <select
                              value={slide.bgFitMobile || (hasMobileImg ? 'cover' : 'contain')}
                              onChange={(e) => handleUpdateHeroSlide(slide.id, 'bgFitMobile', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-amber-400 cursor-pointer"
                            >
                              <option value="cover">Phủ kín khung viền (Cover - Sắc nét nhất)</option>
                              <option value="contain">Hiển thị trọn 100% ảnh + nền mờ sang trọng (Contain)</option>
                              <option value="fill">Kéo giãn vừa khít khung (Fill)</option>
                            </select>
                          </div>
                        </div>

                        {/* 4. Focal Point Alignment on Mobile */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              Trọng Tâm Hiển Thị Ảnh Trên Điện Thoại
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              X: {posX}% • Y: {posY}%
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-500 font-semibold block">
                                Trục Ngang (Trái ↔ Phải)
                              </span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={posX}
                                onChange={(e) => handleUpdateHeroSlide(slide.id, 'bgPositionXMobile', Number(e.target.value))}
                                className="w-full accent-amber-500 cursor-pointer"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-500 font-semibold block">
                                Trục Dọc (Trên ↕ Dưới)
                              </span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={posY}
                                onChange={(e) => handleUpdateHeroSlide(slide.id, 'bgPositionYMobile', Number(e.target.value))}
                                className="w-full accent-amber-500 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 5. Direct Action to Open Studio */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setMobileStudioMode('studio')}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Mở Studio Canvas để căn chỉnh chữ, nút & hiệu ứng trên Smartphone</span>
                          </button>

                          {hasMobileImg && (
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateHeroSlide(slide.id, 'bgImageMobile', '');
                                handleUpdateHeroSlide(slide.id, 'bgFitMobile', 'contain');
                              }}
                              className="text-xs text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              Khôi phục dùng chung ảnh PC
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
          TAB: FAQ (CÂU HỎI THƯỜNG GẶP)
         ---------------------------------------------------- */}
      {activeSubTab === 'faq' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Quản Lý Câu Hỏi Thường Gặp (FAQ)</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉnh sửa nội dung câu hỏi và câu trả lời hiển thị ở trang chủ và trang giới thiệu.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddFaq}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Câu Hỏi Mới</span>
            </button>
          </div>

          {/* Section Heading & Subtitle Configuration */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Tiêu đề khối FAQ</label>
              <input
                type="text"
                value={config.faqTitle || 'Câu Hỏi Thường Gặp'}
                onChange={(e) => setConfig({ ...config, faqTitle: e.target.value })}
                placeholder="VD: Câu Hỏi Thường Gặp"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-amber-500 font-semibold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Mô tả phụ ngắn</label>
              <input
                type="text"
                value={config.faqSubtitle || 'Những thắc mắc phổ biến khi mua phụ kiện và vòng tay Paracord thủ công'}
                onChange={(e) => setConfig({ ...config, faqSubtitle: e.target.value })}
                placeholder="VD: Những thắc mắc phổ biến..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* FAQ List */}
          <div className="space-y-4">
            {(!config.faqs || config.faqs.length === 0) ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium text-slate-500">Chưa có câu hỏi FAQ nào được thiết lập.</p>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, faqs: DEFAULT_SITE_CONTENT.faqs })}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs"
                >
                  Tải danh sách câu hỏi mặc định
                </button>
              </div>
            ) : (
              config.faqs.map((faq, index) => (
                <div
                  key={faq.id || `faq-${index}`}
                  className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all space-y-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        Câu hỏi #{index + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveFaq(index, 'up')}
                        disabled={index === 0}
                        className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        title="Di chuyển lên trên"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveFaq(index, 'down')}
                        disabled={index === (config.faqs?.length || 1) - 1}
                        className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        title="Di chuyển xuống dưới"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFaq(faq.id)}
                        className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer ml-1"
                        title="Xóa câu hỏi này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Câu hỏi (Question)
                      </label>
                      <input
                        type="text"
                        value={faq.q}
                        onChange={(e) => handleUpdateFaq(faq.id, 'q', e.target.value)}
                        placeholder="Nhập nội dung câu hỏi..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-semibold outline-none focus:bg-white focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Câu trả lời (Answer)
                      </label>
                      <textarea
                        rows={3}
                        value={faq.a}
                        onChange={(e) => handleUpdateFaq(faq.id, 'a', e.target.value)}
                        placeholder="Nhập câu trả lời giải đáp chi tiết cho khách hàng..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 leading-relaxed outline-none focus:bg-white focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick FAQ Live Preview */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Xem Trước Giao Diện FAQ ({config.faqs?.length || 0} câu hỏi)
              </span>
              <span className="text-[11px] text-slate-500">Hiển thị tức thì theo thay đổi</span>
            </div>
            
            <div className="space-y-2">
              {(config.faqs || DEFAULT_SITE_CONTENT.faqs || []).map((faq, idx) => (
                <details key={faq.id || idx} className="bg-white border border-slate-200 rounded-lg overflow-hidden group">
                  <summary className="p-3 text-xs font-bold text-slate-900 cursor-pointer list-none flex items-center justify-between gap-2 hover:bg-slate-50">
                    <span>{faq.q || `(Câu hỏi trống #${idx + 1})`}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                  </summary>
                  <div className="px-3 pb-3 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {faq.a || '(Chưa có câu trả lời)'}
                  </div>
                </details>
              ))}
            </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600 font-semibold">Messenger URL</label>
                  <input
                    type="text"
                    value={config.socialLinks.messenger || ''}
                    placeholder="https://m.me/61593591390851"
                    onChange={(e) => setConfig({
                      ...config,
                      socialLinks: { ...config.socialLinks, messenger: e.target.value }
                    })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white font-medium"
                  />
                </div>

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

      {/* MODAL: CONFIRM RESET SITE CONTENT */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowResetModal(false)}
        >
          <div
            className="relative max-w-md w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-base text-slate-900">Khôi Phục Giao Diện Gốc</h3>
              <p className="text-xs text-slate-500 mt-0.5">Đặt lại toàn bộ nội dung website</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                Bạn có chắc chắn muốn khôi phục toàn bộ nội dung website về mặc định gốc?
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tất cả các banner hero slide, thông điệp thương hiệu, tùy biến footer sẽ được đưa về giá trị thiết lập ban đầu.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Xác nhận khôi phục
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
