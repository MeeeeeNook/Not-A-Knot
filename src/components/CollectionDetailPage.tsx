import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, CollectionInfo } from '../types';
import { COLLECTIONS_DATA } from '../data/collections';
import { 
  ArrowLeft, 
  ShoppingBag, 
  CheckCircle2, 
  MessageCircle, 
  Send,
  Eye,
  Info,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Check,
  Heart,
  Palette,
  UploadCloud,
  Image as ImageIcon,
  Edit3,
  Save,
  X,
  Trash2,
  Plus,
  Loader2,
  ChevronDown,
  Camera,
  FileText
} from 'lucide-react';
import { saveOrderToFirestore, saveCollectionToFirestore, deleteCollectionFromFirestore } from '../firebase';
import { ProductCard } from './ProductCard';
import { stripBstPrefix } from '../utils/orderFormatters';
import { useCollectionSEO } from '../utils/seo';

interface CollectionDetailPageProps {
  collectionId: string;
  products: Product[];
  collections?: CollectionInfo[];
  isAdminLoggedIn?: boolean;
  onBackToLanding: () => void;
  onSelectCollection: (collectionId: string) => void;
  onOpenProductDetail: (product: Product) => void;
  onAddToCart: (product: Product, quantity?: number, selectedColor?: string, selectedSize?: string) => void;
  onPreorderSuccess: (orderData: any) => void;
  onUpdateCollections?: (collections: CollectionInfo[]) => void;
}

// Preset color themes for collections
export const THEME_PRESETS = [
  {
    id: 'linen',
    name: 'Kem Ấm Thủ Công',
    bg: '#FAF7F2',
    isDark: false,
    text: 'text-slate-900',
    subtext: 'text-slate-600',
    border: 'border-amber-900/15',
    accent: '#B45309'
  },
  {
    id: 'charcoal',
    name: 'Đen Than Sang Trọng',
    bg: '#12141A',
    isDark: true,
    text: 'text-slate-100',
    subtext: 'text-slate-300',
    border: 'border-white/10',
    accent: '#F59E0B'
  },
  {
    id: 'sage',
    name: 'Xanh Rêu Botanical',
    bg: '#F3F6F4',
    isDark: false,
    text: 'text-emerald-950',
    subtext: 'text-emerald-800/80',
    border: 'border-emerald-900/15',
    accent: '#059669'
  },
  {
    id: 'terracotta',
    name: 'Nâu Đất Nung Artisanal',
    bg: '#FAF3EE',
    isDark: false,
    text: 'text-stone-900',
    subtext: 'text-stone-700',
    border: 'border-stone-300',
    accent: '#C2410C'
  },
  {
    id: 'midnight_navy',
    name: 'Xanh Đêm Midnight',
    bg: '#0F172A',
    isDark: true,
    text: 'text-slate-100',
    subtext: 'text-slate-300',
    border: 'border-slate-700/60',
    accent: '#38BDF8'
  },
  {
    id: 'pure_white',
    name: 'Trắng Tinh Khôi',
    bg: '#FFFFFF',
    isDark: false,
    text: 'text-slate-900',
    subtext: 'text-slate-600',
    border: 'border-slate-200',
    accent: '#2563EB'
  }
];

export const SAMPLE_BANNERS = [
  { name: 'Nàng Thơ Pastel', url: '/assets/img_4_NOT_A_KNOT.jpg' },
  { name: 'Handmade Survival EDC', url: '/assets/bracelet.jpg' },
  { name: 'Hào Khí Quốc Khánh', url: '/assets/hero-bg.png' },
  { name: 'Phong Cách Tựu Trường', url: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Phụ Kiện Thủ Công Tinh Tế', url: 'https://images.unsplash.com/photo-1611591475883-9b8192376e10?auto=format&fit=crop&w=1200&q=80' }
];

export const isColorDark = (hexColor: string): boolean => {
  if (!hexColor) return false;
  let hex = hexColor.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 135;
};

// Client-side image compression for Firestore safety
export const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 720;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const CollectionDetailPage: React.FC<CollectionDetailPageProps> = ({
  collectionId,
  products,
  collections = COLLECTIONS_DATA,
  isAdminLoggedIn = false,
  onBackToLanding,
  onSelectCollection,
  onOpenProductDetail,
  onAddToCart,
  onPreorderSuccess,
  onUpdateCollections
}) => {
  const currentCollection = useMemo(() => {
    return collections.find((c) => c.id === collectionId) || collections[0] || COLLECTIONS_DATA[0];
  }, [collectionId, collections]);

  const is0209 = currentCollection.id === 'event_0209';
  const isSoldOut = currentCollection.status === 'sold_out' || is0209;

  // Filter products for this collection with useMemo (exclude hidden products)
  const collectionProducts = useMemo(() => {
    return products.filter(
      (p) => !p.isHidden && p.category === currentCollection.categoryKey
    );
  }, [products, currentCollection.categoryKey]);

  // Apply rich dynamic Collection SEO tags and JSON-LD schema
  useCollectionSEO(currentCollection, collectionProducts);

  const productIdsKey = useMemo(() => {
    return collectionProducts.map((p) => p.id).join(',');
  }, [collectionProducts]);

  // Countdown timer calculation for 02/09
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateCountdown = () => {
      // Calculate target date (Sept 2nd)
      const now = new Date();
      const currentYear = now.getFullYear();
      let targetDate = new Date(currentYear, 8, 2, 0, 0, 0); // Month 8 is September
      if (now.getTime() > targetDate.getTime()) {
        targetDate = new Date(currentYear + 1, 8, 2, 0, 0, 0);
      }
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };

    calculateCountdown();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      calculateCountdown();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Preorder form states for 02.09 collection
  const [preName, setPreName] = useState('');
  const [prePhone, setPrePhone] = useState('');
  const [preAddress, setPreAddress] = useState('');
  const [preNote, setPreNote] = useState('');
  const [selectedPreItems, setSelectedPreItems] = useState<{ [id: string]: { selected: boolean; qty: number } }>(() => {
    const init: { [id: string]: { selected: boolean; qty: number } } = {};
    collectionProducts.forEach((p, idx) => {
      init[p.id] = { selected: idx === 0, qty: 1 };
    });
    return init;
  });

  // Re-sync initial pre-items when collection products update without creating infinite loops
  useEffect(() => {
    setSelectedPreItems((prev) => {
      let hasChanges = false;
      const next = { ...prev };
      collectionProducts.forEach((p, idx) => {
        if (!next[p.id]) {
          next[p.id] = { selected: idx === 0, qty: 1 };
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });
  }, [productIdsKey, collectionProducts]);

  const [isPreSubmitting, setIsPreSubmitting] = useState(false);
  const [preorderSuccess, setPreorderSuccess] = useState(false);

  // Local state for editing the collection (description, banner image, theme/bg color, etc.)
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Enforce security: non-admins cannot stay in editing mode
  useEffect(() => {
    if (!isAdminLoggedIn && isEditing) {
      setIsEditing(false);
    }
  }, [isAdminLoggedIn, isEditing]);
  const [editTitle, setEditTitle] = useState(currentCollection.title || '');
  const [editSubtitle, setEditSubtitle] = useState(currentCollection.subtitle || '');
  const [editDescription, setEditDescription] = useState(currentCollection.description || currentCollection.story || '');
  const [editTag, setEditTag] = useState(currentCollection.tag || 'BỘ SƯU TẬP');
  const [editBannerImage, setEditBannerImage] = useState(currentCollection.bannerImage || currentCollection.bgImage || '');
  const [editBgColor, setEditBgColor] = useState(
    currentCollection.bgColor || (currentCollection.themeStyle === 'dark' ? '#12141A' : '#FAF7F2')
  );
  const [editBannerMode, setEditBannerMode] = useState<'cover_hero' | 'featured_card' | 'minimal'>(
    currentCollection.bannerDisplayMode || (currentCollection.bannerImage ? 'cover_hero' : 'featured_card')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Sync edit form whenever active collection changes
  useEffect(() => {
    setEditTitle(currentCollection.title || '');
    setEditSubtitle(currentCollection.subtitle || '');
    setEditDescription(currentCollection.description || currentCollection.story || '');
    setEditTag(currentCollection.tag || 'BỘ SƯU TẬP');
    setEditBannerImage(currentCollection.bannerImage || currentCollection.bgImage || '');
    setEditBgColor(currentCollection.bgColor || (currentCollection.themeStyle === 'dark' ? '#12141A' : '#FAF7F2'));
    setEditBannerMode(currentCollection.bannerDisplayMode || (currentCollection.bannerImage ? 'cover_hero' : 'featured_card'));
    setIsEditing(false);
    setIsThemePickerOpen(false);
  }, [currentCollection.id]);

  // Compute active background color and contrast
  const activeBgColor = currentCollection.bgColor || (currentCollection.themeStyle === 'dark' ? '#12141A' : '#FAF7F2');
  const isDark = useMemo(() => isColorDark(activeBgColor), [activeBgColor]);

  // Banner image to display
  const displayBannerImage = currentCollection.bannerImage || currentCollection.bgImage;
  const displayBannerMode = currentCollection.bannerDisplayMode || (displayBannerImage ? 'cover_hero' : 'featured_card');

  // Handle uploading banner image from user device
  const handleBannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP).');
      return;
    }
    try {
      setIsUploadingImage(true);
      const compressedDataUrl = await compressImageFile(file);
      setEditBannerImage(compressedDataUrl);
      if (editBannerMode === 'minimal') {
        setEditBannerMode('cover_hero');
      }
    } catch (err) {
      console.error('Lỗi nén ảnh banner:', err);
      alert('Không thể xử lý ảnh, vui lòng thử lại ảnh khác.');
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  // Quick background color updater (instant click)
  const handleQuickChangeBgColor = async (newBg: string) => {
    setEditBgColor(newBg);
    const updatedCollection: CollectionInfo = {
      ...currentCollection,
      bgColor: newBg,
      themeStyle: isColorDark(newBg) ? 'dark' : 'light'
    };

    const updatedCols = collections.map((c) =>
      c.id === currentCollection.id ? updatedCollection : c
    );

    if (onUpdateCollections) {
      onUpdateCollections(updatedCols);
    } else {
      localStorage.setItem('nak_collections', JSON.stringify(updatedCols));
    }

    try {
      await saveCollectionToFirestore(updatedCollection);
    } catch (err) {
      console.warn('Lưu màu nền lên Firestore:', err);
    }

    setSaveSuccessMsg('Đã cập nhật màu nền thành công!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Full save handler for description, title, banner image, etc.
  const handleSaveCollectionInfo = async () => {
    setIsSaving(true);
    const updatedCollection: CollectionInfo = {
      ...currentCollection,
      title: editTitle.trim() || currentCollection.title,
      subtitle: editSubtitle.trim(),
      description: editDescription.trim(),
      story: editDescription.trim(), // Keep both in sync for backwards compatibility
      tag: editTag.trim() || currentCollection.tag,
      bannerImage: editBannerImage,
      bgImage: editBannerImage || currentCollection.bgImage,
      bgColor: editBgColor,
      bannerDisplayMode: editBannerMode,
      themeStyle: isColorDark(editBgColor) ? 'dark' : 'light'
    };

    const updatedCols = collections.map((c) =>
      c.id === currentCollection.id ? updatedCollection : c
    );

    if (onUpdateCollections) {
      onUpdateCollections(updatedCols);
    } else {
      localStorage.setItem('nak_collections', JSON.stringify(updatedCols));
    }

    try {
      await saveCollectionToFirestore(updatedCollection);
    } catch (err) {
      console.warn('Lỗi lưu collection lên Firestore:', err);
    }

    setIsSaving(false);
    setIsEditing(false);
    setSaveSuccessMsg('Đã lưu thông tin bộ sưu tập và ảnh banner thành công!');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Toggle item in pre-order form
  const handleTogglePreItem = (productId: string) => {
    setSelectedPreItems((prev) => {
      const curr = prev[productId] || { selected: false, qty: 1 };
      return {
        ...prev,
        [productId]: { ...curr, selected: !curr.selected }
      };
    });
  };

  const handleUpdatePreQty = (productId: string, delta: number) => {
    setSelectedPreItems((prev) => {
      const curr = prev[productId] || { selected: true, qty: 1 };
      const newQty = Math.max(1, curr.qty + delta);
      return {
        ...prev,
        [productId]: { ...curr, qty: newQty }
      };
    });
  };

  const handleSelectProductForPreorder = (product: Product) => {
    setSelectedPreItems((prev) => ({
      ...prev,
      [product.id]: { selected: true, qty: (prev[product.id]?.qty || 1) }
    }));
    const orderSec = document.getElementById('order-section');
    if (orderSec) {
      orderSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Pre-order total
  const preTotalAmount = collectionProducts.reduce((sum, p) => {
    const state = selectedPreItems[p.id];
    if (state && state.selected) {
      return sum + p.price * state.qty;
    }
    return sum;
  }, 0);

  const handlePreorderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProds = collectionProducts.filter((p) => selectedPreItems[p.id]?.selected);
    const chosen = selectedProds.map((p) => `${p.name} (x${selectedPreItems[p.id]?.qty || 1}) - ${(p.price * (selectedPreItems[p.id]?.qty || 1)).toLocaleString('vi-VN')}đ`);

    if (chosen.length === 0) {
      alert('Vui lòng chọn ít nhất một sản phẩm trong danh sách đặt trước.');
      return;
    }

    setIsPreSubmitting(true);

    const itemDetails = selectedProds.map(p => ({
      productId: p.id,
      productName: p.name,
      imageUrl: p.image || (p.images && p.images[0]) || '',
      image: p.image || (p.images && p.images[0]) || '',
      price: p.price,
      quantity: selectedPreItems[p.id]?.qty || 1
    }));

    const trackingCode = `NAK-0209-${Date.now().toString().slice(-6)}`;
    const orderRecord = {
      id: trackingCode,
      trackingNumber: trackingCode,
      date: new Date().toLocaleString('vi-VN'),
      createdAt: new Date().toISOString(),
      name: preName,
      customerName: preName,
      phone: prePhone,
      address: preAddress,
      note: preNote ? `[Pre-order 02.09] ${preNote}` : '[Pre-order 02.09]',
      items: chosen,
      itemDetails,
      totalPrice: preTotalAmount,
      totalAmount: preTotalAmount,
      source: 'website' as const,
      type: 'preorder_0209' as const,
      status: 'Chờ xác nhận' as const
    };

    try {
      await saveOrderToFirestore(orderRecord);
    } catch (err: any) {
      console.error('Lỗi lưu đơn hàng preorder lên Firebase:', err);
      alert(`Không thể kết nối máy chủ để ghi nhận đơn hàng: ${err?.message || 'Lỗi mạng'}. Quý khách vui lòng thử lại!`);
      setIsPreSubmitting(false);
      return;
    }

    const local = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
    local.unshift(orderRecord);
    localStorage.setItem('nak_preorders', JSON.stringify(local));

    onPreorderSuccess(orderRecord);
    setIsPreSubmitting(false);
    setPreorderSuccess(true);
    setPreName('');
    setPrePhone('');
    setPreAddress('');
    setPreNote('');

    setTimeout(() => {
      setPreorderSuccess(false);
    }, 8000);
  };

  const scrollToPreorder = () => {
    const el = document.getElementById('order-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // If collection is hidden by admin, show friendly notice
  if (currentCollection.isHidden) {
    return (
      <div id="collection-hidden-page" className="w-full bg-[#12141A] text-white min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-3xl shadow-sm">
            🙈
          </div>
          <h2 className="text-2xl font-black tracking-tight">Bộ Sưu Tập Đang Tạm Ẩn</h2>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Bộ sưu tập "{currentCollection.title}" hiện đang được tạm ẩn để bảo trì nội dung hoặc chuẩn bị đợt ra mắt mới. Quý khách vui lòng tham khảo các bộ sưu tập khác nhé!
          </p>
          <div className="pt-2">
            <button
              onClick={onBackToLanding}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay Lại Trang Chủ</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW A: DEDICATED AUTHENTIC BST 02/09 (Matches https://notaknot09.netlify.app/)
  // =========================================================================
  if (is0209) {
    return (
      <div id="collection-detail-page" className="w-full bg-[#fdfbf7] text-[#1a1a1a] min-h-screen font-sans">
        
        {/* Sticky Subnav Bar */}
        <nav className="sticky top-13 z-30 bg-[#12141A]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3 text-white">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                id="back-to-landing-btn"
                onClick={onBackToLanding}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-rose-600/90 text-white px-3.5 sm:px-5 py-1.5 rounded-full font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-900/30 border border-white/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>SOLD OUT</span>
              </span>
            </div>
          </div>
        </nav>

        {/* 1. Hero Section - SOLD OUT & GRATITUDE NOTIFICATION */}
        <section 
          className="relative min-h-[92vh] flex flex-col justify-center py-20 bg-cover bg-no-repeat bg-top"
          style={{
            backgroundImage: "url('/assets/0209/img_1.png')"
          }}
        >
          {/* Hero dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40 pointer-events-none" />

          <div className="relative z-10 container mx-auto px-4 sm:px-6 flex flex-col items-center text-center max-w-4xl">
            <div className="animate-fadeIn space-y-6 w-full">
              
              {/* Official Announcement Stamp / Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-600/90 backdrop-blur-md border border-white/30 text-white text-xs sm:text-sm font-black uppercase tracking-widest shadow-xl">
                <span>★ {currentCollection.soldOutBadge || 'THÔNG BÁO CHÍNH THỨC'} ★</span>
              </div>

              {/* Big 3D Bold Sold Out Banner Heading */}
              <div className="space-y-2">
                <h1 className="text-white font-black text-3xl sm:text-5xl lg:text-6xl uppercase tracking-wider drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                  TỰ HÀO <span className="text-[#DDB652]">VIỆT NAM</span>
                </h1>
                
                <p className="text-gray-200 text-sm sm:text-lg font-medium max-w-2xl mx-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  Bộ sưu tập Kỷ vật thủ công kỷ niệm ngày Tết Độc Lập 02/09 từ NOT A KNOT.
                </p>
              </div>

              {/* OFFICIAL SOLD OUT GRAPHIC CARD (Inspired by Facebook Announcement) */}
              <div className="relative max-w-2xl mx-auto bg-gradient-to-b from-stone-900/90 via-black/95 to-stone-950/95 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border-2 border-[#DDB652]/60 shadow-[0_10px_50px_rgba(180,28,26,0.4)] my-4 text-white overflow-hidden">
                {/* Decorative background glow */}
                <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#DDB652]/20 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-rose-600/20 rounded-full blur-2xl pointer-events-none" />

                {/* Ribbon Tag */}
                <div className="inline-block bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-black text-[11px] sm:text-xs uppercase tracking-widest px-4 py-1 rounded-full shadow-md border border-white/20 mb-4">
                  {currentCollection.soldOutRibbon || '★ TOÀN BỘ DANH MỤC ★'}
                </div>

                {/* 3D Gold / Red Typography */}
                <div className="space-y-1 my-2">
                  <div className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-red-500 to-amber-400 drop-shadow-[0_4px_12px_rgba(220,38,38,0.6)]">
                    SOLD OUT
                  </div>
                  <p className="text-[#DDB652] font-black text-sm sm:text-base tracking-widest uppercase mt-1">
                    {currentCollection.soldOutTitle || '[PRE-ORDER 02.09] SOLD OUT! ❤️'}
                  </p>
                </div>

                {/* Heartfelt Thank You Note */}
                <div className="mt-5 pt-5 border-t border-white/15 space-y-3 text-left sm:text-center">
                  <p className="text-gray-200 text-xs sm:text-sm leading-relaxed font-normal">
                    {currentCollection.soldOutMessage || 'Bộ sưu tập Hào Khí 02.09 đã chính thức SOLD OUT chỉ sau một thời gian ngắn mở bán. Not A Knot xin gửi lời cảm ơn chân thành nhất đến bạn vì đã lựa chọn mang theo tinh thần Việt Nam trên mỗi hành trình. Sự yêu thương của mọi người chính là niềm tự hào lớn nhất của chúng mình! ✨'}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2 text-[#DDB652] font-bold text-xs sm:text-sm">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0" />
                    <span>{currentCollection.soldOutNote || 'Hẹn gặp lại bạn trong những BST tiếp theo nhé!'}</span>
                    <span className="text-gray-400 font-normal">| Love from Not A Knot ❤️</span>
                  </div>
                </div>
              </div>

              {/* Hero Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    const el = document.getElementById('products-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white px-6 sm:px-8 py-3 rounded-full font-bold text-xs sm:text-sm tracking-wider uppercase backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                >
                  Xem Kỷ Vật Đã Chế Tác
                </button>
                <button
                  onClick={onBackToLanding}
                  className="bg-gradient-to-r from-[#B41C1A] to-[#9c1513] hover:from-[#d12421] hover:to-[#B41C1A] text-white px-6 sm:px-8 py-3 rounded-full font-bold text-xs sm:text-sm tracking-wider uppercase shadow-lg shadow-red-900/40 transition-all cursor-pointer"
                >
                  Khám Phá BST Khác
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* 2. Story Section */}
        <section className="py-20 bg-[#F9F7F2] text-[#1A1A1A] border-b border-neutral-200">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight mb-4 text-[#1A1A1A]">
              CÂU CHUYỆN <span className="text-[#B41C1A]">THƯƠNG HIỆU</span>
            </h2>
            <div className="w-16 h-1 bg-[#DDB652] mx-auto mb-8 rounded-full"></div>
            <p className="text-base sm:text-xl text-neutral-700 leading-relaxed font-medium">
              {currentCollection.story || 'Cảm hứng từ những trang sử vàng hào hùng, bộ sưu tập 02/09 của NOT A KNOT mang trong mình tinh thần "Độc Lập - Tự Do - Hạnh Phúc". Từng nút thắt thủ công tỉ mỉ không chỉ là trang sức, mà còn là một kỷ vật kết nối quá khứ với hiện tại, tôn vinh tình yêu tổ quốc cháy bỏng.'}
            </p>
          </div>
        </section>

        {/* 3. Product Showcase Section */}
        <section id="products-section" className="py-20 bg-[#F9F7F2]">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-14">
              <div className="inline-block px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                ★ SOLD OUT ★
              </div>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#1A1A1A] mb-3">
                Kỷ Vật Trong Bộ Sưu Tập 02/09
              </h2>
              <p className="text-neutral-600 text-sm sm:text-base font-medium">
                Toàn bộ sản phẩm đợt mở bán đầu tiên đã tìm được chủ nhân. Cảm ơn sự yêu thương của bạn!
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 p-1 sm:p-2 -m-1 sm:-m-2">
              {collectionProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpenDetail={onOpenProductDetail}
                  onAddToCart={onAddToCart}
                  collections={collections}
                />
              ))}
            </div>
          </div>
        </section>

        {/* 4. GRATITUDE & STAY TUNED SECTION (Replaced Pre-order registration form) */}
        <section className="py-20 relative overflow-hidden bg-gradient-to-b from-[#12141A] to-[#0A0B0E] text-white">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#B41C1A] via-[#DDB652] to-[#B41C1A]"></div>
          
          <div className="container mx-auto px-6 relative z-10">
            <div className="max-w-3xl mx-auto bg-gradient-to-br from-stone-900/90 to-stone-950 p-8 sm:p-12 rounded-3xl border border-white/10 shadow-2xl text-center space-y-6">
              
              <div className="w-16 h-16 rounded-full bg-rose-600/20 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/30 shadow-inner">
                <Heart className="w-8 h-8 fill-rose-500" />
              </div>

              <div className="space-y-2">
                <span className="text-[#DDB652] font-black text-xs sm:text-sm uppercase tracking-widest">
                  TRI ÂN TỪ TRÁI TIM
                </span>
                <h3 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
                  Cảm Ơn Bạn Đã Đồng Hành
                </h3>
              </div>

              <p className="text-neutral-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                Đợt mở bán BST Hào Khí 02.09 đã chính thức khép lại. Chúng mình đang dồn toàn bộ tâm huyết để hoàn thiện những nút thắt đẹp nhất trao đến tay bạn.
              </p>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm text-amber-200/90 max-w-md mx-auto">
                ✨ Đừng bỏ lỡ những bộ sưu tập giới hạn tiếp theo từ NOT A KNOT!
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <button
                  onClick={onBackToLanding}
                  className="px-6 sm:px-8 py-3.5 bg-gradient-to-r from-[#B41C1A] to-[#9c1513] hover:from-[#d12421] hover:to-[#B41C1A] text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg shadow-red-900/30 transition-all cursor-pointer"
                >
                  Khám Phá Các BST Khác
                </button>

                <a
                  href="https://www.facebook.com/profile.php?id=61593591390851"
                  target="_blank"
                  rel="noreferrer"
                  className="px-6 sm:px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-bold transition-all border border-white/20 flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Theo Dõi Not A Knot</span>
                </a>
              </div>

            </div>
          </div>
        </section>

        {/* Footer contact shortcut */}
        <section className="py-8 bg-[#0D0E11] text-center text-xs text-neutral-400 border-t border-white/10">
          <div className="max-w-xl mx-auto px-4 flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://m.me/61593591390851"
              target="_blank"
              rel="noreferrer"
              className="hover:text-amber-400 flex items-center gap-1.5 transition-colors font-medium"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Tư vấn qua Messenger</span>
            </a>
          </div>
        </section>

      </div>
    );
  }

  // =========================================================================
  // VIEW B: OTHER COLLECTIONS (Back To School, 20.10, Charm, Everyday, etc.)
  // =========================================================================
  return (
    <div 
      id="collection-detail-page" 
      style={{ backgroundColor: activeBgColor }}
      className={`w-full min-h-screen font-sans transition-colors duration-300 ${
        isDark ? 'text-slate-100' : 'text-slate-900'
      }`}
    >
      {/* Hidden file input for uploading banner image */}
      <input
        ref={bannerFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBannerFileUpload}
      />

      {/* Floating Save Toast */}
      {saveSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-fadeIn border border-white/20">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* 1. Sticky Navigation Bar with Quick Theme Selector & Edit Shortcut */}
      <nav className={`sticky top-13 z-30 backdrop-blur-md border-b px-4 sm:px-6 lg:px-8 py-3 transition-colors ${
        isDark 
          ? 'bg-[#12141A]/90 border-white/10 text-white' 
          : 'bg-[#FAF7F2]/90 border-amber-900/10 text-slate-900'
      }`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Back button */}
          <div className="flex items-center gap-3">
            <button
              id="back-to-landing-btn"
              onClick={onBackToLanding}
              className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-950'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </button>
            <span className={`text-xs font-semibold hidden sm:inline-block ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>/</span>
            <span className={`text-xs font-bold truncate max-w-[150px] sm:max-w-xs hidden sm:inline-block ${
              isDark ? 'text-neutral-300' : 'text-neutral-700'
            }`}>
              {stripBstPrefix(currentCollection.title)}
            </span>
          </div>

          {/* Action controls: Only visible when admin is authenticated */}
          {isAdminLoggedIn && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider hidden sm:inline flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                <span>Admin</span>
              </span>

              {/* Quick Theme Color Picker Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsThemePickerOpen(!isThemePickerOpen)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
                      : 'bg-white hover:bg-amber-50/50 border-amber-900/15 text-slate-800 shadow-xs'
                  }`}
                  title="Thay đổi màu nền trang bộ sưu tập (Admin)"
                >
                  <span 
                    className="w-3 h-3 rounded-full border border-black/20 shrink-0 shadow-inner" 
                    style={{ backgroundColor: activeBgColor }} 
                  />
                  <Palette className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Màu nền</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {isThemePickerOpen && (
                  <div className={`absolute right-0 mt-2 w-72 p-4 rounded-2xl shadow-2xl border z-50 animate-fadeIn ${
                    isDark
                      ? 'bg-[#181A22] border-white/15 text-white'
                      : 'bg-white border-amber-900/15 text-slate-900 shadow-xl'
                  }`}>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-inherit">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-amber-500" />
                        <span>Chọn màu nền giao diện</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsThemePickerOpen(false)}
                        className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-60 hover:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Preset Swatches */}
                    <div className="space-y-1.5">
                      {THEME_PRESETS.map((t) => {
                        const isSelected = activeBgColor.toLowerCase() === t.bg.toLowerCase();
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              handleQuickChangeBgColor(t.bg);
                              setIsThemePickerOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/20 border border-amber-500 text-amber-500'
                                : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span 
                                className="w-4 h-4 rounded-full border border-black/20 shrink-0 shadow-xs" 
                                style={{ backgroundColor: t.bg }} 
                              />
                              <span>{t.name}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom color picker input */}
                    <div className="mt-3 pt-3 border-t border-inherit flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold opacity-70">Tự chọn màu:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={activeBgColor.startsWith('#') ? activeBgColor : '#FAF7F2'}
                          onChange={(e) => handleQuickChangeBgColor(e.target.value)}
                          className="w-7 h-7 rounded-lg border border-inherit cursor-pointer p-0.5 bg-transparent"
                        />
                        <span className="text-[11px] font-mono font-bold opacity-80">{activeBgColor}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Edit Description & Banner Button */}
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isEditing
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : isDark
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                    : 'bg-white hover:bg-amber-50/80 text-amber-950 border border-amber-500/30'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Đóng' : 'Chỉnh sửa'}</span>
              </button>

              {/* Delete Collection Button */}
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isDark
                    ? 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                }`}
                title="Xóa bộ sưu tập này"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* 2. Collection Hero Section with Optional Backdrop Banner Image */}
      <section 
        className={`relative py-14 sm:py-20 border-b transition-all overflow-hidden ${
          isDark ? 'border-white/10' : 'border-amber-900/10'
        } ${displayBannerImage && displayBannerMode === 'cover_hero' ? 'bg-cover bg-center' : ''}`}
        style={
          displayBannerImage && displayBannerMode === 'cover_hero'
            ? { backgroundImage: `url('${displayBannerImage}')` }
            : {}
        }
      >
        {/* If cover hero mode is on, render subtle gradient backdrop for crisp legibility */}
        {displayBannerImage && displayBannerMode === 'cover_hero' && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isDark
                ? `linear-gradient(to bottom, rgba(10,12,16,0.55) 0%, rgba(10,12,16,0.85) 65%, ${activeBgColor} 100%)`
                : `linear-gradient(to bottom, rgba(250,247,242,0.6) 0%, rgba(250,247,242,0.92) 65%, ${activeBgColor} 100%)`
            }}
          />
        )}

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          {/* Collection Title */}
          <div className="space-y-2">
            <h1 className={`text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight uppercase ${
              isDark ? 'text-white drop-shadow-md' : 'text-slate-900'
            }`}>
              {stripBstPrefix(currentCollection.title)}
            </h1>

            {currentCollection.subtitle && (
              <p className={`text-xs sm:text-sm font-semibold tracking-wide uppercase opacity-80 ${
                isDark ? 'text-amber-300' : 'text-amber-800'
              }`}>
                {currentCollection.subtitle}
              </p>
            )}
          </div>

          {/* Featured Card Mode Banner Image (if user chooses card mode) */}
          {displayBannerImage && displayBannerMode === 'featured_card' && !isEditing && (
            <div className="max-w-2xl mx-auto my-6 rounded-3xl overflow-hidden shadow-xl border border-inherit">
              <img 
                src={displayBannerImage} 
                alt={`Bộ sưu tập ${stripBstPrefix(currentCollection.title)} - NOT A KNOT phụ kiện handmade`}
                loading="lazy"
                decoding="async"
                className="w-full h-56 sm:h-72 object-cover"
              />
            </div>
          )}

          {/* =============================================================== */}
          {/* AREA DIRECTLY UNDER TITLE: DESCRIPTION & IMAGE UPLOAD SECTION   */}
          {/* =============================================================== */}
          {!isEditing ? (
            /* VIEW MODE: Clean, uncluttered presentation */
            <div className="pt-2 max-w-3xl mx-auto space-y-3">
              {(currentCollection.description || currentCollection.story) && (
                <p className={`text-sm sm:text-base leading-relaxed whitespace-pre-line font-normal ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}>
                  {currentCollection.description || currentCollection.story}
                </p>
              )}

              {/* Only authenticated Admin sees quick-edit shortcut when in admin mode */}
              {isAdminLoggedIn && (
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Chỉnh sửa thông tin & banner (Chỉ Admin)</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* =============================================================== */
            /* EDITING MODE: INLINE FORM FOR DESCRIPTION, BANNER & THEME       */
            /* =============================================================== */
            <div className={`max-w-3xl mx-auto p-5 sm:p-8 rounded-3xl border text-left space-y-6 shadow-2xl transition-all animate-fadeIn ${
              isDark
                ? 'bg-[#161822]/95 border-white/15 text-white backdrop-blur-xl'
                : 'bg-white/95 border-amber-900/15 text-slate-900 backdrop-blur-xl shadow-amber-950/10'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-inherit">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-wide">
                      Chỉnh sửa thông tin & Banner bộ sưu tập
                    </h3>
                    <p className="text-[11px] opacity-70">
                      Cập nhật mô tả, tải ảnh bìa và chọn màu sắc cho {currentCollection.title}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Field 1: Description (Mô tả chi tiết dưới tên Back To School) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-500" />
                    <span>Mô tả bộ sưu tập (Description)</span>
                  </span>
                  <span className="text-[10px] font-normal opacity-60">Hiển thị ngay dưới tiêu đề</span>
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Nhập mô tả cho bộ sưu tập Back To School (ví dụ: Chào đón mùa tựu trường cùng BST Back To School từ NOT A KNOT! Mang phong cách trẻ trung, bền bỉ với những nút thắt đan tay thủ công năng động, sắc màu thời trang cùng bạn đồng hành trên mỗi chặng đường học tập...)"
                  rows={4}
                  className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${
                    isDark
                      ? 'bg-white/5 border-white/15 text-white placeholder:text-neutral-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-neutral-400'
                  }`}
                />
              </div>

              {/* Field 2: Subtitle & Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider">
                    Phụ đề / Khẩu hiệu ngắn (Subtitle)
                  </label>
                  <input
                    type="text"
                    value={editSubtitle}
                    onChange={(e) => setEditSubtitle(e.target.value)}
                    placeholder="Ví dụ: Năng động · Bền bỉ · Tự tin đến trường"
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark
                        ? 'bg-white/5 border-white/15 text-white placeholder:text-neutral-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-neutral-400'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider">
                    Nhãn Tag nổi bật (Tag)
                  </label>
                  <input
                    type="text"
                    value={editTag}
                    onChange={(e) => setEditTag(e.target.value)}
                    placeholder="Ví dụ: BỘ SƯU TẬP TỰU TRƯỜNG"
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark
                        ? 'bg-white/5 border-white/15 text-white placeholder:text-neutral-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-neutral-400'
                    }`}
                  />
                </div>
              </div>

              {/* Field 3: Image Upload Area ("Khu đấy có thể up ảnh nữa") */}
              <div className="space-y-3 pt-2 border-t border-inherit">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ảnh Banner / Ảnh Bìa Bộ Sưu Tập</span>
                  </label>
                  <span className="text-[11px] opacity-60">Upload từ máy hoặc dán link ảnh</span>
                </div>

                {/* Banner Preview or Upload Dropzone */}
                {editBannerImage ? (
                  <div className="relative rounded-2xl overflow-hidden border border-inherit aspect-21/9 max-h-56 group shadow-md">
                    <img
                      src={editBannerImage}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => bannerFileInputRef.current?.click()}
                        className="px-3.5 py-2 bg-white text-slate-950 text-xs font-bold rounded-xl shadow hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Đổi ảnh khác</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditBannerImage('')}
                        className="px-3.5 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl shadow hover:bg-rose-700 cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Gỡ ảnh</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => bannerFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                      isDark
                        ? 'border-white/20 hover:border-amber-400 bg-white/[0.02]'
                        : 'border-amber-900/20 hover:border-amber-500 bg-amber-50/40'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold">
                      {isUploadingImage ? 'Đang nén và tải ảnh lên...' : 'Nhấn vào đây để tải ảnh từ máy tính / điện thoại'}
                    </p>
                    <p className="text-[11px] opacity-70 mt-1">
                      Hỗ trợ JPG, PNG, WebP (Tỉ lệ ngang 16:9 hoặc 21:9 hiển thị đẹp nhất)
                    </p>
                  </div>
                )}

                {/* Direct URL input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editBannerImage}
                    onChange={(e) => setEditBannerImage(e.target.value)}
                    placeholder="Hoặc dán đường dẫn ảnh (URL) vào đây..."
                    className={`flex-1 p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark
                        ? 'bg-white/5 border-white/15 text-white placeholder:text-neutral-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-neutral-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => bannerFileInputRef.current?.click()}
                    className="px-3.5 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 text-xs font-bold rounded-xl border border-amber-500/30 flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Tải tệp</span>
                  </button>
                </div>

                {/* Sample Presets */}
                <div>
                  <span className="text-[11px] font-bold opacity-75 block mb-1.5">
                    Hoặc chọn nhanh ảnh mẫu thủ công Not A Knot:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {SAMPLE_BANNERS.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditBannerImage(s.url)}
                        className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                          editBannerImage === s.url
                            ? 'border-amber-500 bg-amber-500/20 text-amber-500 font-bold'
                            : 'border-inherit hover:border-amber-400 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img src={s.url} alt={s.name} className="w-5 h-5 rounded-md object-cover" />
                        <span>{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Display Mode Choice */}
                {editBannerImage && (
                  <div className="pt-2">
                    <span className="text-[11px] font-bold opacity-75 block mb-1.5">
                      Kiểu hiển thị ảnh banner:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditBannerMode('cover_hero')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          editBannerMode === 'cover_hero'
                            ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold ring-1 ring-amber-500'
                            : 'border-inherit opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold mb-0.5">
                          <span>🌟 Ảnh nền Hero tràn viền</span>
                        </div>
                        <span className="block text-[11px] font-normal opacity-70">
                          Ảnh làm phông nền mờ phía sau tiêu đề & mô tả
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditBannerMode('featured_card')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          editBannerMode === 'featured_card'
                            ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold ring-1 ring-amber-500'
                            : 'border-inherit opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold mb-0.5">
                          <span>🖼️ Thẻ ảnh bìa riêng biệt</span>
                        </div>
                        <span className="block text-[11px] font-normal opacity-70">
                          Đóng khung ảnh như ảnh bìa tạp chí thời trang
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Field 4: Background Color Customization */}
              <div className="space-y-2 pt-2 border-t border-inherit">
                <label className="block text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-amber-500" />
                  <span>Màu nền trang bộ sưu tập</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {THEME_PRESETS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditBgColor(t.bg)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        editBgColor.toLowerCase() === t.bg.toLowerCase()
                          ? 'border-amber-500 ring-2 ring-amber-500 bg-amber-500/10'
                          : 'border-inherit opacity-80 hover:opacity-100'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/20 shrink-0 shadow-xs"
                        style={{ backgroundColor: t.bg }}
                      />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] opacity-70">Hoặc tự chọn màu mã hex:</span>
                  <input
                    type="color"
                    value={editBgColor.startsWith('#') ? editBgColor : '#FAF7F2'}
                    onChange={(e) => setEditBgColor(e.target.value)}
                    className="w-7 h-7 rounded-lg border border-inherit cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={editBgColor}
                    onChange={(e) => setEditBgColor(e.target.value)}
                    className={`w-24 p-1 rounded-lg border text-xs font-mono text-center ${
                      isDark ? 'bg-white/5 border-white/15 text-white' : 'bg-white border-slate-300'
                    }`}
                  />
                </div>
              </div>

              {/* Action Save / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-inherit">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                    isDark
                      ? 'border-white/15 hover:bg-white/5 text-slate-300'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveCollectionInfo}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Lưu thông tin & Giao diện</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* 3. Product Catalog Grid */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className={`flex items-center justify-between gap-4 mb-8 pb-3 border-b ${
          isDark ? 'border-white/10' : 'border-amber-900/10'
        }`}>
          <div>
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              <span>Sản phẩm trong bộ sưu tập</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                isDark ? 'bg-white/10 text-amber-300' : 'bg-amber-100 text-amber-900'
              }`}>
                {collectionProducts.length}
              </span>
            </h2>
          </div>
        </div>

        {collectionProducts.length === 0 ? (
          <div className={`text-center py-16 rounded-3xl border p-8 ${
            isDark 
              ? 'bg-white/[0.02] border-white/10 text-slate-400' 
              : 'bg-white/60 border-amber-900/10 text-slate-600 shadow-sm'
          }`}>
            <Info className="w-8 h-8 text-amber-500 mx-auto mb-3" />
            <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Hiện chưa có sản phẩm nào trong bộ sưu tập này
            </h3>
            <p className="text-xs sm:text-sm max-w-md mx-auto mb-4 leading-relaxed">
              Bạn có thể vào trang Quản Trị &gt; Quản Lý Sản Phẩm để chọn danh mục "{currentCollection.categoryKey}" cho sản phẩm mong muốn.
            </p>
            <button
              type="button"
              onClick={onBackToLanding}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer shadow-sm transition-all"
            >
              Khám Phá Các Bộ Sưu Tập Khác
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 p-1 sm:p-2 -m-1 sm:-m-2">
            {collectionProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenDetail={onOpenProductDetail}
                onAddToCart={onAddToCart}
                collections={collections}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Bottom Help & Brand Guarantee Links */}
      <section className={`py-12 border-t text-center text-xs transition-colors ${
        isDark ? 'border-white/10 text-neutral-400' : 'border-amber-900/10 text-neutral-600'
      }`}>
        <div className="max-w-xl mx-auto px-4 space-y-4">
          <p className="text-xs font-medium">
            Mọi sản phẩm của NOT A KNOT đều được đan thủ công tỉ mỉ và bảo hành nút đan trọn đời.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://m.me/61593591390851"
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-1.5 font-bold transition-colors ${
                isDark ? 'hover:text-amber-400 text-neutral-300' : 'hover:text-amber-700 text-neutral-800'
              }`}
            >
              <MessageCircle className="w-4 h-4 text-amber-500" />
              <span>Tư vấn thiết kế riêng qua Messenger</span>
            </a>
            <span>•</span>
            <button
              onClick={onBackToLanding}
              className={`hover:underline font-semibold cursor-pointer ${
                isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-black'
              }`}
            >
              Về trang chủ NOT A KNOT
            </button>
          </div>
        </div>
      </section>

      {/* CONFIRM DELETE COLLECTION MODAL */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="relative max-w-sm w-full bg-white p-5 rounded-2xl border border-slate-200 shadow-2xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-base text-slate-900">Xác Nhận Xóa Bộ Sưu Tập</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bạn có chắc chắn muốn xóa bộ sưu tập "{currentCollection.title}"?
              </p>
            </div>

            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Banner và trang chi tiết của bộ sưu tập này sẽ bị xóa khỏi hệ thống. Sản phẩm bên trong vẫn được lưu trữ đầy đủ trong kho hàng.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const targetId = currentCollection.id;
                    if (onUpdateCollections && collections) {
                      const remaining = collections.filter((c) => c.id !== targetId && c.categoryKey !== targetId);
                      onUpdateCollections(remaining);
                      try {
                        localStorage.setItem('nak_collections', JSON.stringify(remaining));
                        localStorage.setItem('nak_collections_data', JSON.stringify(remaining));
                      } catch {}
                    }
                    await deleteCollectionFromFirestore(targetId).catch((err) =>
                      console.warn('Lỗi xóa Firestore:', err)
                    );
                    setShowDeleteModal(false);
                    onBackToLanding();
                  } catch (e) {
                    console.error('Lỗi xóa:', e);
                    onBackToLanding();
                  }
                }}
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
