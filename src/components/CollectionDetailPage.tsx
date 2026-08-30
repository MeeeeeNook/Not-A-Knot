import React, { useState, useEffect, useMemo } from 'react';
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
  Heart
} from 'lucide-react';
import { saveOrderToFirestore } from '../firebase';
import { ProductCard } from './ProductCard';

interface CollectionDetailPageProps {
  collectionId: string;
  products: Product[];
  collections?: CollectionInfo[];
  onBackToLanding: () => void;
  onSelectCollection: (collectionId: string) => void;
  onOpenProductDetail: (product: Product) => void;
  onAddToCart: (product: Product, quantity?: number, selectedColor?: string, selectedSize?: string) => void;
  onPreorderSuccess: (orderData: any) => void;
}

export const CollectionDetailPage: React.FC<CollectionDetailPageProps> = ({
  collectionId,
  products,
  collections = COLLECTIONS_DATA,
  onBackToLanding,
  onSelectCollection,
  onOpenProductDetail,
  onAddToCart,
  onPreorderSuccess
}) => {
  const currentCollection = useMemo(() => {
    return collections.find((c) => c.id === collectionId) || collections[0] || COLLECTIONS_DATA[0];
  }, [collectionId, collections]);

  const is0209 = currentCollection.id === 'event_0209';
  const isSoldOut = currentCollection.status === 'sold_out' || is0209;

  // Filter products for this collection with useMemo
  const collectionProducts = useMemo(() => {
    return products.filter(
      (p) => p.category === currentCollection.categoryKey
    );
  }, [products, currentCollection.categoryKey]);

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
    const interval = setInterval(calculateCountdown, 1000);
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
      price: p.price,
      quantity: selectedPreItems[p.id]?.qty || 1
    }));

    const orderRecord = {
      id: `ord-pre-${Date.now()}`,
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
      status: 'pending'
    };

    try {
      await saveOrderToFirestore(orderRecord);
    } catch (err) {
      console.warn('Firestore fallback:', err);
    }

    const local = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
    local.push(orderRecord);
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
                <span>★ ĐÃ FULL SLOT (SOLD OUT) ★</span>
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
                    {currentCollection.soldOutTitle || '[PRE-ORDER 02.09] CHÍNH THỨC FULL SLOT! ❤️'}
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
              {currentCollection.story || 'Cảm hứng từ những trang sử vàng hào hùng, bộ sưu tập 02/09 của NOT A KNOT mang trong mình tinh thần "Độc Lập - Tự Do - Hạnh Phúc". Từng nút thắt Paracord thủ công tỉ mỉ không chỉ là trang sức, mà còn là một kỷ vật kết nối quá khứ với hiện tại, tôn vinh tình yêu tổ quốc cháy bỏng.'}
            </p>
          </div>
        </section>

        {/* 3. Product Showcase Section */}
        <section id="products-section" className="py-20 bg-[#F9F7F2]">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-14">
              <div className="inline-block px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                ★ ĐÃ BÁN HẾT (FULL SLOT) ★
              </div>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#1A1A1A] mb-3">
                Kỷ Vật Trong Bộ Sưu Tập 02/09
              </h2>
              <p className="text-neutral-600 text-sm sm:text-base font-medium">
                Toàn bộ sản phẩm đợt mở bán đầu tiên đã tìm được chủ nhân. Cảm ơn sự yêu thương của bạn!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {collectionProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpenDetail={onOpenProductDetail}
                  onAddToCart={onAddToCart}
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
              href="https://www.facebook.com/profile.php?id=61593591390851"
              target="_blank"
              rel="noreferrer"
              className="hover:text-amber-400 flex items-center gap-1.5 transition-colors font-medium"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Tư vấn qua Facebook Messenger</span>
            </a>
          </div>
        </section>

      </div>
    );
  }

  // =========================================================================
  // VIEW B: OTHER COLLECTIONS (20.10, Charm, Everyday, etc.)
  // =========================================================================
  return (
    <div id="collection-detail-page" className="w-full bg-[#090A0D] text-neutral-200 min-h-screen font-sans">
      
      {/* 1. Clean Sticky Top Navigation Bar */}
      <nav className="sticky top-13 z-30 bg-[#090A0D]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              id="back-to-landing-btn"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Collection Header & Editorial Story */}
      <section className="py-14 sm:py-20 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
            {currentCollection.tag}
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            {currentCollection.title}
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 max-w-2xl mx-auto leading-relaxed font-normal">
            {currentCollection.story}
          </p>
        </div>
      </section>

      {/* 3. Product Catalog Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8 pb-3 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">
              Sản phẩm trong bộ sưu tập ({collectionProducts.length})
            </h2>
          </div>
        </div>

        {collectionProducts.length === 0 ? (
          <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-white/5 p-8">
            <Info className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">Hiện chưa có sản phẩm nào trong bộ sưu tập này.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {collectionProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenDetail={onOpenProductDetail}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        )}
      </section>

      {/* Bottom Help Links */}
      <section className="py-10 border-t border-white/10 text-center text-xs">
        <div className="max-w-xl mx-auto px-4 flex flex-wrap items-center justify-center gap-4 text-neutral-400">
          <a
            href="https://www.facebook.com/profile.php?id=61593591390851"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Tư vấn qua Facebook</span>
          </a>
        </div>
      </section>

    </div>
  );
};
