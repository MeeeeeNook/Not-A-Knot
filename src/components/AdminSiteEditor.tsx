import React, { useState, useRef, useEffect } from 'react';
import { SiteContentConfig, CustomElementBlock, SiteHeroSlide, CategoryItem, CollectionInfo, FaqItem, Product, LandingCollectionProductsConfig } from '../types';
import { DEFAULT_SITE_CONTENT } from '../data/siteContent';
import { DEFAULT_CATEGORIES } from '../data/categories';
import { COLLECTIONS_DATA } from '../data/collections';
import { saveSiteContentToFirestore } from '../firebase';
import { safeStorageSetItem } from '../utils/storageHelper';
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
  QrCode,
  LayoutGrid,
  Copy,
  Layers,
  EyeOff,
  Palette,
  Sliders,
  SlidersHorizontal
} from 'lucide-react';
import { CanvaSlideStudio } from './CanvaSlideStudio';
import { HeroBanners } from './HeroBanners';
import { LandingCollectionBanners } from './LandingCollectionBanners';
import { LandingProductsCollection } from './LandingProductsCollection';
import { DynamicCustomElements } from './DynamicCustomElements';
import { AboutUsSection } from './AboutUsSection';
import { LandingFaqCommitments } from './LandingFaqCommitments';
import { Footer } from './Footer';

interface AdminSiteEditorProps {
  initialConfig?: SiteContentConfig;
  categories?: CategoryItem[];
  collections?: CollectionInfo[];
  products?: Product[];
  onSaveConfig: (config: SiteContentConfig) => void;
  onPreviewWebsite?: () => void;
}

export const AdminSiteEditor: React.FC<AdminSiteEditorProps> = ({
  initialConfig,
  categories = DEFAULT_CATEGORIES,
  collections = COLLECTIONS_DATA,
  products = [],
  onSaveConfig,
  onPreviewWebsite
}) => {
  const [config, setConfig] = useState<SiteContentConfig>(() => {
    const base = initialConfig || DEFAULT_SITE_CONTENT;
    let sections = base.landingProductSections;
    if (!sections || sections.length === 0) {
      if (base.landingProducts) {
        sections = [base.landingProducts];
      } else {
        sections = DEFAULT_SITE_CONTENT.landingProductSections || [];
      }
    }
    const cleanFooterDesc =
      !base.footerDescription ||
      /Paracord|EDC|bảo hành nút thắt/i.test(base.footerDescription) ||
      !base.footerDescription.includes('Kinh tế Quốc dân')
        ? DEFAULT_SITE_CONTENT.footerDescription
        : base.footerDescription;

    return {
      ...base,
      footerDescription: cleanFooterDesc,
      landingProductSections: sections,
      landingProducts: sections[0] || base.landingProducts
    };
  });

  const [isCustomAnnouncementLink, setIsCustomAnnouncementLink] = useState(false);

  // Keep internal config synchronized if parent or cloud siteContent changes
  useEffect(() => {
    if (initialConfig) {
      setConfig((prev) => {
        const prevHeroStr = JSON.stringify(prev.heroSlides || []);
        const nextHeroStr = JSON.stringify(initialConfig.heroSlides || []);
        if (prevHeroStr !== nextHeroStr || prev.brandName !== initialConfig.brandName) {
          let sections = initialConfig.landingProductSections;
          if (!sections || sections.length === 0) {
            sections = initialConfig.landingProducts ? [initialConfig.landingProducts] : (DEFAULT_SITE_CONTENT.landingProductSections || []);
          }
          return {
            ...initialConfig,
            landingProductSections: sections,
            landingProducts: sections[0] || initialConfig.landingProducts
          };
        }
        return prev;
      });
    }
  }, [initialConfig]);

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'hero' | 'collection_products' | 'faq' | 'footer'>('general');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [dimensionNotice, setDimensionNotice] = useState<{ id: string; text: string } | null>(null);
  
  const [showResetModal, setShowResetModal] = useState(false);

  // Landing Collection Products Manager state
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [collectionPreviewDevice, setCollectionPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(0);
  const [collectionPreviewScope, setCollectionPreviewScope] = useState<'current' | 'all'>('current');

  // Multi-section accessors and mutators
  const landingSections: LandingCollectionProductsConfig[] = React.useMemo(() => {
    if (config.landingProductSections && config.landingProductSections.length > 0) {
      return config.landingProductSections;
    }
    if (config.landingProducts) {
      return [config.landingProducts];
    }
    return DEFAULT_SITE_CONTENT.landingProductSections || [];
  }, [config.landingProductSections, config.landingProducts]);

  // Compute hidden category IDs to filter out products in hidden categories
  const hiddenCategoryIds = React.useMemo(() => {
    return new Set((categories || []).filter((c) => c.isHidden || String(c.isHidden) === 'true').map((c) => c.id));
  }, [categories]);

  // Product is considered hidden if either explicitly hidden or category is hidden
  const isProductHidden = (p: Product) => {
    const isExplicit = p.isHidden === true || String(p.isHidden) === 'true';
    return isExplicit || Boolean(p.category && hiddenCategoryIds.has(p.category));
  };

  const currentSectionIndex = Math.min(Math.max(0, selectedSectionIdx), Math.max(0, landingSections.length - 1));
  const currentSection: LandingCollectionProductsConfig = landingSections[currentSectionIndex] || {
    id: 'section-the-collection',
    title: 'THE COLLECTION',
    subtitle: '',
    badgeText: 'NEW',
    viewAllText: 'Xem tất cả',
    detailButtonText: 'Chi tiết',
    isActive: true,
    displayLimit: 8,
    layoutMode: 'auto',
    backgroundColor: '#FAF9F6',
    textColor: 'auto',
    filterCategory: 'all',
    selectedProductIds: [],
    gridColumns: 4
  };

  const updateSections = (newSections: LandingCollectionProductsConfig[]) => {
    setConfig((prev) => ({
      ...prev,
      landingProductSections: newSections,
      landingProducts: newSections[0] || prev.landingProducts
    }));
  };

  const updateCurrentSection = (patch: Partial<LandingCollectionProductsConfig>) => {
    const newSections = [...landingSections];
    if (newSections[currentSectionIndex]) {
      newSections[currentSectionIndex] = { ...newSections[currentSectionIndex], ...patch };
      updateSections(newSections);
    }
  };

  const processSectionBgImageUpload = (file: File) => {
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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          let compressed = '';
          try {
            compressed = canvas.toDataURL('image/jpeg', 0.85);
          } catch {
            compressed = e.target?.result as string;
          }
          updateCurrentSection({ backgroundImage: compressed });
        } else {
          updateCurrentSection({ backgroundImage: e.target?.result as string });
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddSection = (presetKey: string = 'custom') => {
    const newId = `sec-${Date.now()}`;
    let newSec: LandingCollectionProductsConfig = {
      id: newId,
      title: 'THE COLLECTION',
      subtitle: '',
      badgeText: 'NEW',
      viewAllText: 'Xem tất cả',
      detailButtonText: 'Chi tiết',
      isActive: true,
      displayLimit: 8,
      filterCategory: 'all',
      selectedProductIds: [],
      gridColumns: 4
    };

    if (presetKey === 'best_sellers') {
      newSec.title = 'BEST SELLERS';
      newSec.badgeText = 'HOT';
    } else if (presetKey === 'bracelets') {
      newSec.title = 'VÒNG TAY HANDMADE';
      newSec.badgeText = 'HANDMADE';
      newSec.filterCategory = 'vong-tay';
    } else if (presetKey === 'keychains') {
      newSec.title = 'MÓC KHÓA HANDMADE';
      newSec.badgeText = 'HANDMADE';
      newSec.filterCategory = 'moc-khoa';
    } else if (presetKey === 'limited') {
      newSec.title = 'LIMITED EDITION';
      newSec.badgeText = 'LIMITED';
      newSec.displayLimit = 4;
    }

    const updated = [...landingSections, newSec];
    updateSections(updated);
    setSelectedSectionIdx(updated.length - 1);
  };

  const handleDuplicateSection = (idx: number) => {
    const target = landingSections[idx];
    if (!target) return;
    const duplicated: LandingCollectionProductsConfig = {
      ...target,
      id: `sec-${Date.now()}`,
      title: `${target.title} (Bản sao)`
    };
    const updated = [...landingSections];
    updated.splice(idx + 1, 0, duplicated);
    updateSections(updated);
    setSelectedSectionIdx(idx + 1);
  };

  const handleMoveSection = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= landingSections.length) return;
    const updated = [...landingSections];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    updateSections(updated);
    setSelectedSectionIdx(targetIdx);
  };

  const [deleteSectionModalIdx, setDeleteSectionModalIdx] = useState<number | null>(null);

  const handleDeleteSection = (idx: number) => {
    setDeleteSectionModalIdx(idx);
  };

  const handleConfirmDeleteSection = async () => {
    if (deleteSectionModalIdx === null) return;
    const idx = deleteSectionModalIdx;
    const targetTitle = landingSections[idx]?.title || 'Khối bộ sưu tập';
    const updated = landingSections.filter((_, i) => i !== idx);
    const newConfig: SiteContentConfig = {
      ...config,
      landingProductSections: updated,
      landingProducts: updated[0] || config.landingProducts
    };
    setConfig(newConfig);
    setSelectedSectionIdx(Math.max(0, idx - 1));
    setDeleteSectionModalIdx(null);
    try {
      safeStorageSetItem('nak_site_content', JSON.stringify(newConfig));
      onSaveConfig(newConfig);
      await saveSiteContentToFirestore(newConfig);
    } catch {
      onSaveConfig(newConfig);
    }
    setStatusMsg(`Đã xóa "${targetTitle}" và cập nhật giao diện.`);
    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const handleToggleSectionActive = (idx: number) => {
    const updated = [...landingSections];
    if (updated[idx]) {
      updated[idx] = {
        ...updated[idx],
        isActive: updated[idx].isActive === false ? true : false
      };
      updateSections(updated);
    }
  };

  // Drag & drop state for hero slide upload
  const [dragOverSlideId, setDragOverSlideId] = useState<string | null>(null);
  const [dragOverLogo, setDragOverLogo] = useState<boolean>(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
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
      safeStorageSetItem('nak_site_content', JSON.stringify(config));
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
    safeStorageSetItem('nak_site_content', JSON.stringify(DEFAULT_SITE_CONTENT));
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
          <span>Billboard Banner (PC & Mobile)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeSubTab === 'hero' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {config.heroSlides?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('collection_products')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'collection_products' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
          <span>The Collections ({landingSections.length} mục)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeSubTab === 'collection_products' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {landingSections.filter(s => s.isActive !== false).length} hiển thị
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
          TAB 2: HERO BILLBOARD SLIDES (Unified Canva Studio for PC & Mobile)
         ---------------------------------------------------- */}
      {activeSubTab === 'hero' && (
        <CanvaSlideStudio
          slides={config.heroSlides || []}
          onChangeSlides={(newSlides) => {
            const sanitized = newSlides.map((s) => {
              const { bgImageMobile, ...rest } = s as any;
              return rest;
            });
            setConfig((prev) => {
              const updatedConfig = { ...prev, heroSlides: sanitized };
              safeStorageSetItem('nak_site_content', JSON.stringify(updatedConfig));
              onSaveConfig(updatedConfig);
              return updatedConfig;
            });
          }}
          onSave={async (newSlides) => {
            const sanitized = newSlides.map((s) => {
              const { bgImageMobile, ...rest } = s as any;
              return rest;
            });
            const updatedConfig = { ...config, heroSlides: sanitized };
            setConfig(updatedConfig);
            safeStorageSetItem('nak_site_content', JSON.stringify(updatedConfig));
            onSaveConfig(updatedConfig);
            try {
              await saveSiteContentToFirestore(updatedConfig);
            } catch (err) {
              console.warn('Lỗi đồng bộ Firebase cho hero slides:', err);
            }
            setSaveStatus('success');
            setStatusMsg('Đã lưu Billboard thành công và cập nhật lên website!');
            setTimeout(() => setStatusMsg(''), 4000);
          }}
          brandName={config.brandName}
          categories={categories}
          collections={collections}
        />
      )}



      {/* ----------------------------------------------------
          TAB: THE COLLECTION (SẢN PHẨM LANDING PAGE - HỖ TRỢ NHIỀU MỤC)
         ---------------------------------------------------- */}
      {activeSubTab === 'collection_products' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-200">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Quản Lý Bộ Sưu Tập Sản Phẩm Trên Trang Chủ</h3>
                  <span className="text-[10px] bg-slate-900 text-white font-mono px-2 py-0.5 rounded-full font-bold">
                    {landingSections.length} mục
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono px-2 py-0.5 rounded-full font-bold">
                    {landingSections.filter(s => s.isActive !== false).length} đang bật
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bạn có thể tạo nhiều khối sản phẩm độc lập (THE COLLECTION, BEST SELLERS, VÒNG TAY, MÓC KHÓA...), tùy biến tiêu đề, nút bấm, lọc danh mục và sắp xếp thứ tự hiển thị.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saveStatus === 'saving' ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
              </button>
            </div>
          </div>

          {/* Section 1: Manage Sections List & Order */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Danh Sách Các Khối Bộ Sưu Tập ({landingSections.length})
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Nhấp vào một khối để chỉnh sửa chi tiết. Sử dụng các nút mũi tên để đổi thứ tự xuất hiện trên trang chủ.
                </p>
              </div>

              {/* Add New Section */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddSection('custom')}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Thêm Khối Mới</span>
                </button>
              </div>
            </div>

            {/* List of cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {landingSections.map((sec, idx) => {
                const isSelected = idx === currentSectionIndex;
                const isEnabled = sec.isActive !== false;
                const catLabel = sec.filterCategory === 'all' || !sec.filterCategory
                  ? 'Toàn bộ kho'
                  : (categories.find(c => c.id === sec.filterCategory)?.label || sec.filterCategory);

                return (
                  <div
                    key={sec.id || `sec-card-${idx}`}
                    onClick={() => setSelectedSectionIdx(idx)}
                    className={`relative p-3.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/40 shadow-sm ring-2 ring-amber-400/30'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    } ${!isEnabled ? 'opacity-65' : ''}`}
                  >
                    <div>
                      {/* Top Bar inside card */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                            isSelected ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            #{idx + 1}
                          </span>
                          {sec.badgeText && (
                            <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-900 text-white uppercase">
                              {sec.badgeText}
                            </span>
                          )}
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* Toggle Active */}
                          <button
                            type="button"
                            onClick={() => handleToggleSectionActive(idx)}
                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                              isEnabled ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-200'
                            }`}
                            title={isEnabled ? 'Mục này đang hiển thị (Bấm để ẩn)' : 'Mục này đang ẩn (Bấm để hiện)'}
                          >
                            {isEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>

                          {/* Move Up */}
                          <button
                            type="button"
                            onClick={() => handleMoveSection(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Di chuyển lên trên"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Down */}
                          <button
                            type="button"
                            onClick={() => handleMoveSection(idx, 'down')}
                            disabled={idx === landingSections.length - 1}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Di chuyển xuống dưới"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => handleDuplicateSection(idx)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                            title="Nhân bản mục này"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSection(idx)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Xóa mục này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h5 className="text-xs font-bold text-slate-900 truncate tracking-wide">
                        {sec.title || 'THE COLLECTION'}
                      </h5>
                      {sec.subtitle && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {sec.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Footer Info of card */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="truncate max-w-[140px]">
                        {catLabel}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 font-medium">
                        <span>{sec.displayLimit || 8} món</span>
                        <span>•</span>
                        <span className={isEnabled ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                          {isEnabled ? 'Đang bật' : 'Tắt'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Selected Section Configuration Form */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md">
                  Mục #{currentSectionIndex + 1}
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  Cấu Hình: {currentSection.title || 'THE COLLECTION'}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Hiển thị mục này:</span>
                <button
                  type="button"
                  onClick={() => updateCurrentSection({ isActive: currentSection.isActive === false ? true : false })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    currentSection.isActive !== false ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      currentSection.isActive !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Text & Labels Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Tiêu đề chính */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Tiêu đề hiển thị (Header)</span>
                </label>
                <input
                  type="text"
                  value={currentSection.title ?? 'THE COLLECTION'}
                  onChange={(e) => updateCurrentSection({ title: e.target.value })}
                  placeholder="THE COLLECTION"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-slate-400 font-medium"
                />
              </div>

              {/* Phụ đề */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Phụ đề ngắn (Subtitle - Tùy chọn)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Để trống nếu không dùng</span>
                </label>
                <input
                  type="text"
                  value={currentSection.subtitle ?? ''}
                  onChange={(e) => updateCurrentSection({ subtitle: e.target.value })}
                  placeholder="VD: Tuyệt tác phụ kiện EDC thủ công tinh xảo..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-slate-400 font-medium"
                />
              </div>

              {/* Nhãn Badge góc sản phẩm */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Nhãn góc trên ảnh sản phẩm (Badge)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={currentSection.badgeText ?? 'NEW'}
                    onChange={(e) => updateCurrentSection({ badgeText: e.target.value })}
                    placeholder="NEW (hoặc để trống)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-slate-400 font-medium uppercase"
                  />
                  {currentSection.badgeText && (
                    <span className="shrink-0 bg-[#0d2e2b] text-white text-[10px] font-bold tracking-widest uppercase px-2.5 py-1.5 rounded shadow-2xs">
                      {currentSection.badgeText}
                    </span>
                  )}
                </div>
              </div>

              {/* Nút Chi Tiết & Nút Xem Tất Cả */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Tên nút Chi Tiết
                  </label>
                  <input
                    type="text"
                    value={currentSection.detailButtonText ?? 'Chi tiết'}
                    onChange={(e) => updateCurrentSection({ detailButtonText: e.target.value })}
                    placeholder="Chi tiết"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-slate-400 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Tên nút Xem Tất Cả
                  </label>
                  <input
                    type="text"
                    value={currentSection.viewAllText ?? 'Xem tất cả'}
                    onChange={(e) => updateCurrentSection({ viewAllText: e.target.value })}
                    placeholder="Xem tất cả"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-slate-400 font-medium"
                  />
                </div>
              </div>

              {/* Cấu hình Hành vi & Chuyển hướng khi bấm nút Chi Tiết */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Hành động khi khách bấm nút "{currentSection.detailButtonText || 'Chi tiết'}"
                </label>

                <select
                  value={currentSection.detailActionType || 'product_detail'}
                  onChange={(e) => updateCurrentSection({ detailActionType: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-slate-500 cursor-pointer shadow-2xs"
                >
                  <option value="product_detail">Xem chi tiết sản phẩm (Mở popup / trang thông tin chi tiết)</option>
                  <option value="product_custom_url">Ưu tiên link riêng của từng sản phẩm (Shopee / TikTok Shop nếu có)</option>
                  <option value="custom_url">Chuyển hướng link ngoài chung (Dùng 1 URL cố định cho toàn bộ nút)</option>
                  <option value="zalo">Tư vấn qua Zalo (Mở chat Zalo kèm sẵn tên và giá sản phẩm)</option>
                  <option value="messenger">Tư vấn qua Messenger (Mở chat Fanpage Facebook)</option>
                  <option value="category">Mở danh mục sản phẩm (Chuyển đến trang danh mục tương ứng)</option>
                </select>

                {/* Giải thích ngắn gọn cơ chế hoạt động */}
                <p className="text-[11px] text-slate-500 italic">
                  {(currentSection.detailActionType || 'product_detail') === 'product_detail' &&
                    'Mở popup / trang chi tiết sản phẩm để khách chọn size, màu và đặt mua.'}
                  {currentSection.detailActionType === 'product_custom_url' &&
                    'Tự động mở link riêng của sản phẩm (Shopee/TikTok) hoặc mở chi tiết nếu chưa có link.'}
                  {currentSection.detailActionType === 'custom_url' &&
                    'Tất cả sản phẩm sẽ cùng chuyển hướng đến 1 đường dẫn URL cố định cài đặt bên dưới.'}
                  {currentSection.detailActionType === 'zalo' &&
                    'Mở chat Zalo kèm sẵn tên và giá sản phẩm để tư vấn nhanh.'}
                  {currentSection.detailActionType === 'messenger' &&
                    'Mở chat Fanpage Facebook để tư vấn trực tiếp.'}
                  {currentSection.detailActionType === 'category' &&
                    'Chuyển hướng đến trang danh mục tương ứng của sản phẩm.'}
                </p>

                {/* Ô nhập link khi chọn custom_url */}
                {currentSection.detailActionType === 'custom_url' && (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">
                      Đường dẫn URL muốn chuyển hướng tới (Link Shopee, TikTok Shop, Website khác...):
                    </label>
                    <input
                      type="url"
                      value={currentSection.detailCustomUrl || ''}
                      onChange={(e) => updateCurrentSection({ detailCustomUrl: e.target.value })}
                      placeholder="https://shopee.vn/... hoặc https://zalo.me/... hoặc /danh-muc"
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-slate-500 font-medium"
                    />
                    <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={currentSection.detailOpenNewTab !== false}
                        onChange={(e) => updateCurrentSection({ detailOpenNewTab: e.target.checked })}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs text-slate-700 font-medium">
                        Mở liên kết trong tab mới (khuyên dùng khi liên kết sang trang ngoài)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Product Display Limit, Layout & Filter Options */}
            <div className="pt-4 border-t border-slate-200/80 space-y-5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-600" />
                <span>Bố Cục, Số Lượng & Nguồn Sản Phẩm</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Kiểu hiển thị & Vuốt trượt */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Kiểu bố cục hiển thị
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'auto', label: 'Tự động' },
                      { id: 'carousel', label: 'Vuốt ngang' },
                      { id: 'grid', label: 'Lưới tĩnh' }
                    ].map((mode) => {
                      const isSelected = (currentSection.layoutMode || 'auto') === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => updateCurrentSection({ layoutMode: mode.id as any })}
                          className={`py-2 px-1 text-center rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Số lượng hiển thị */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Số lượng SP hiển thị</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      (0 = Hiện tất cả)
                    </span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={currentSection.displayLimit ?? 8}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateCurrentSection({ displayLimit: isNaN(val) ? 0 : Math.max(0, val) });
                    }}
                    placeholder="8"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-bold outline-none focus:border-slate-400"
                  />
                </div>

                {/* 3. Lọc theo danh mục */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Lọc sản phẩm theo danh mục
                  </label>
                  <select
                    value={currentSection.filterCategory || 'all'}
                    onChange={(e) => updateCurrentSection({ filterCategory: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-slate-400 font-medium cursor-pointer"
                  >
                    <option value="all">Tất cả sản phẩm (Toàn bộ kho hàng)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label || cat.id} {cat.isHidden ? '(Đang ẩn)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TÙY CHỈNH MÀU NỀN & ẢNH NỀN VÀ ĐỘ MỜ */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-amber-600" />
                    <span>Màu Nền, Hình Nền & Độ Mờ Khối Này</span>
                  </h5>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Màu nền Background Color */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">
                      Màu nền khối (Background Color)
                    </label>

                    {/* Color picker input + Hex code */}
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentSection.backgroundColor || '#FAF9F6'}
                        onChange={(e) => updateCurrentSection({ backgroundColor: e.target.value })}
                        className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={currentSection.backgroundColor || '#FAF9F6'}
                        onChange={(e) => updateCurrentSection({ backgroundColor: e.target.value })}
                        placeholder="#FAF9F6"
                        className="w-28 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 outline-none focus:border-slate-400"
                      />
                      <span className="text-[11px] text-slate-500">Mã màu HEX</span>
                    </div>

                    {/* Tông màu chữ Text Color Theme */}
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-slate-700 block mb-1">Màu chữ hiển thị:</span>
                      <div className="flex items-center gap-1.5">
                        {[
                          { id: 'auto', label: 'Tự động' },
                          { id: 'dark', label: 'Chữ tối' },
                          { id: 'light', label: 'Chữ sáng' }
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => updateCurrentSection({ textColor: t.id as any })}
                            className={`px-3 py-1 rounded-md text-xs font-medium border cursor-pointer transition-colors ${
                              (currentSection.textColor || 'auto') === t.id
                                ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Hình nền & Độ mờ Background Image & Opacity */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">
                      Hình nền khối (Tùy chọn) & Độ mờ
                    </label>

                    {/* Image Preview & Upload Controls */}
                    <div className="flex items-center gap-3">
                      {currentSection.backgroundImage ? (
                        <div className="relative w-20 h-16 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0">
                          <img
                            src={currentSection.backgroundImage}
                            alt="Background Preview"
                            className="w-full h-full object-cover"
                            style={{ opacity: typeof currentSection.bgImageOpacity === 'number' ? currentSection.bgImageOpacity : 0.25 }}
                          />
                          <button
                            type="button"
                            onClick={() => updateCurrentSection({ backgroundImage: '' })}
                            className="absolute top-1 right-1 p-0.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition-colors cursor-pointer"
                            title="Xóa ảnh nền"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-16 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0 bg-white">
                          <ImagePlus className="w-5 h-5" />
                          <span className="text-[9px] mt-0.5">Chưa có ảnh</span>
                        </div>
                      )}

                      <div className="flex-1 space-y-1.5">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Tải ảnh lên</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) processSectionBgImageUpload(file);
                            }}
                            className="hidden"
                          />
                        </label>
                        
                        <input
                          type="text"
                          value={currentSection.backgroundImage?.startsWith('data:') ? '' : (currentSection.backgroundImage || '')}
                          onChange={(e) => updateCurrentSection({ backgroundImage: e.target.value })}
                          placeholder="Hoặc dán URL ảnh tại đây..."
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-slate-400"
                        />
                      </div>
                    </div>

                    {/* Opacity Slider */}
                    {currentSection.backgroundImage && (
                      <div className="pt-2 space-y-1 bg-white p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                            <span>Độ mờ ảnh nền:</span>
                          </span>
                          <span className="font-bold text-amber-700 font-mono">
                            {Math.round((typeof currentSection.bgImageOpacity === 'number' ? currentSection.bgImageOpacity : 0.25) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.05}
                          max={1.0}
                          step={0.05}
                          value={typeof currentSection.bgImageOpacity === 'number' ? currentSection.bgImageOpacity : 0.25}
                          onChange={(e) => updateCurrentSection({ bgImageOpacity: parseFloat(e.target.value) })}
                          className="w-full accent-amber-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Mờ nhẹ (5%)</span>
                          <span>Trung bình (25%)</span>
                          <span>Đậm rõ (100%)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Manual Product Picker (Checklist with Search & Filtered Hidden Products) */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Tự tay chọn từng sản phẩm hiển thị cụ thể cho mục này:
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {currentSection.selectedProductIds?.length
                        ? `Đang ghim ${currentSection.selectedProductIds.length} sản phẩm tự chọn (hiển thị đúng theo thứ tự đã chọn).`
                        : 'Hiện đang ở chế độ tự động (lấy theo danh mục & sản phẩm có sẵn).'}
                    </span>
                  </div>

                  {currentSection.selectedProductIds?.length ? (
                    <button
                      type="button"
                      onClick={() => updateCurrentSection({ selectedProductIds: [] })}
                      className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 font-semibold rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      Bỏ chọn tất cả (Chuyển về tự động)
                    </button>
                  ) : null}
                </div>

                {/* Product Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    placeholder="Tìm theo tên sản phẩm hoặc mã để chọn nhanh..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-400 text-slate-900"
                  />
                </div>

                {/* Product List Selector Grid - Explicitly filters out hidden products */}
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                  {products
                    .filter((p) => {
                      // CRITICAL: Filter out hidden products (both directly hidden or hidden category)
                      if (isProductHidden(p)) return false;
                      if (!productSearchTerm.trim()) return true;
                      const q = productSearchTerm.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(q) ||
                        String(p.id).toLowerCase().includes(q) ||
                        (p.category && p.category.toLowerCase().includes(q))
                      );
                    })
                    .map((p) => {
                      const selectedIds = (currentSection.selectedProductIds || []).map(String);
                      const pId = String(p.id);
                      const isChecked = selectedIds.includes(pId);
                      const img = (p.images && p.images[0]) || p.image || '/assets/bracelet.jpg';
                      const priceFormatted = Number(p.price || 0).toLocaleString('vi-VN') + 'đ';
                      const orderIndex = selectedIds.indexOf(pId);

                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            const current = (currentSection.selectedProductIds || []).map(String);
                            const newSelection = isChecked
                              ? current.filter((id) => id !== pId)
                              : [...current, pId];
                            updateCurrentSection({ selectedProductIds: newSelection });
                          }}
                          className={`p-2 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-amber-50/90 border border-amber-300'
                              : 'hover:bg-white border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="w-4 h-4 rounded text-slate-900 focus:ring-0 cursor-pointer"
                            />
                            <img
                              src={img}
                              alt={p.name}
                              className="w-8 h-8 rounded object-cover bg-white border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-900 truncate block">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                {priceFormatted} • Kho: {p.stock ?? 15}
                              </span>
                            </div>
                          </div>

                          {isChecked && (
                            <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shrink-0 font-mono">
                              #{orderIndex + 1}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview Container (Desktop & Mobile view + Scope Selector) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-600" />
                  <span>Xem Trước Trực Quan (Live Preview)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Mô phỏng hiển thị chính xác theo thiết kế người dùng yêu cầu trên giao diện thật.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Scope selector */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCollectionPreviewScope('current')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      collectionPreviewScope === 'current'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Chỉ xem mục #{currentSectionIndex + 1}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectionPreviewScope('all')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      collectionPreviewScope === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Xem tất cả {landingSections.length} mục
                  </button>
                </div>

                {/* Device selector */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCollectionPreviewDevice('desktop')}
                    className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                      collectionPreviewDevice === 'desktop'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Máy tính (4 cột)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectionPreviewDevice('mobile')}
                    className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                      collectionPreviewDevice === 'mobile'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Điện thoại (2 cột)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* The Actual Rendered Preview */}
            <div className="flex justify-center p-2 bg-slate-100 rounded-xl overflow-x-auto">
              <div
                className={`transition-all duration-300 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden ${
                  collectionPreviewDevice === 'mobile' ? 'w-[375px]' : 'w-full'
                }`}
              >
                {collectionPreviewScope === 'current' ? (
                  <LandingProductsCollection
                    config={currentSection}
                    products={products}
                    categories={categories}
                    collections={collections}
                    sectionIndex={currentSectionIndex}
                    onOpenProductDetail={(prod) => {
                      alert(`Đã chọn xem chi tiết sản phẩm: ${prod.name} (${Number(prod.price).toLocaleString('vi-VN')}đ)`);
                    }}
                    onOpenAllCatalog={(cat) => {
                      alert(`Chuyển tới catalog danh mục: ${cat || 'all'}`);
                    }}
                  />
                ) : (
                  <div>
                    {landingSections.map((sec, idx) => (
                      <LandingProductsCollection
                        key={sec.id || `preview-sec-${idx}`}
                        config={sec}
                        products={products}
                        categories={categories}
                        collections={collections}
                        sectionIndex={idx}
                        onOpenProductDetail={(prod) => {
                          alert(`Đã chọn xem chi tiết sản phẩm: ${prod.name} (${Number(prod.price).toLocaleString('vi-VN')}đ)`);
                        }}
                        onOpenAllCatalog={(cat) => {
                          alert(`Chuyển tới catalog danh mục: ${cat || 'all'}`);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
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
                value={config.faqTitle ?? ''}
                onChange={(e) => setConfig({ ...config, faqTitle: e.target.value })}
                placeholder="VD: Câu Hỏi Thường Gặp"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-amber-500 font-semibold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Mô tả phụ ngắn</label>
              <input
                type="text"
                value={config.faqSubtitle ?? ''}
                onChange={(e) => setConfig({ ...config, faqSubtitle: e.target.value })}
                placeholder="VD: Những thắc mắc phổ biến... (để trống nếu không muốn hiển thị)"
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

      {/* MODAL: CONFIRM DELETE SECTION */}
      {deleteSectionModalIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setDeleteSectionModalIdx(null)}
        >
          <div
            className="relative max-w-sm w-full bg-white p-5 rounded-2xl border border-slate-200 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-base text-slate-900">Xác Nhận Xóa Khối</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bạn có chắc muốn xóa khối "{landingSections[deleteSectionModalIdx]?.title || 'Bộ sưu tập'}" khỏi trang chủ?
              </p>
            </div>

            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Hành động này sẽ xóa khối hiển thị này trên trang chủ. Sản phẩm và bộ sưu tập gốc vẫn được giữ nguyên vẹn.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteSectionModalIdx(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSection}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
