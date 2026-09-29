import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, ChevronDown, ChevronRight, ArrowRight, ShieldCheck, 
  Package, Home, Compass, Info, Phone, Search, X 
} from 'lucide-react';
import { COLLECTIONS_DATA } from '../data/collections';
import { CategoryItem, CollectionInfo, SiteContentConfig, SellerUser } from '../types';
import { stripBstPrefix } from '../utils/orderFormatters';

interface NavbarProps {
  cartCount: number;
  isCartBumping?: boolean;
  categories?: CategoryItem[];
  collections?: CollectionInfo[];
  siteContent?: SiteContentConfig;
  onOpenCart: () => void;
  onNavigateLanding: () => void;
  onSelectCollection: (collectionId: string) => void;
  onOpenAllCatalog: (categoryId?: string) => void;
  onOpenAbout: () => void;
  onOpenContact: () => void;
  onOpenOrderTracker?: () => void;
  onOpenAdmin?: () => void;
  currentView: 'landing' | 'collection' | 'catalog' | 'about' | 'contact' | 'admin' | 'track-order' | string;
  activeCollectionId: string;
  currentSeller?: SellerUser | null;
  isAdminLoggedIn?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  isCartBumping = false,
  categories,
  collections = COLLECTIONS_DATA,
  siteContent,
  onOpenCart,
  onNavigateLanding,
  onSelectCollection,
  onOpenAllCatalog,
  onOpenAbout,
  onOpenContact,
  onOpenOrderTracker,
  onOpenAdmin,
  currentView,
  activeCollectionId,
  currentSeller,
  isAdminLoggedIn = false
}) => {
  const brandName = siteContent?.brandName || 'NOT A KNOT';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileCollectionsExpanded, setMobileCollectionsExpanded] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close mobile menu when resizing to desktop (xl: >= 1280px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lock body scroll when mobile menu is open on phones/tablets
  useEffect(() => {
    if (mobileMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [mobileMenuOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMouseEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setDropdownOpen(false);
    }, 200);
  };

  const handleNavClick = (action: () => void) => {
    action();
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  };

  const hiddenCatKeys = useMemo(() => {
    return new Set((categories || []).filter((c) => c.isHidden).map((c) => c.id));
  }, [categories]);

  const visibleCollections = useMemo(() => {
    return collections.filter(
      (c) => !c.isHidden && (!c.categoryKey || !hiddenCatKeys.has(c.categoryKey))
    );
  }, [collections, hiddenCatKeys]);

  return (
    <header className="sticky top-0 z-40 bg-[#141210]/95 backdrop-blur-md border-b border-[#29221B] text-stone-100 transition-all shadow-[0_4px_20px_-4px_rgba(20,16,10,0.15)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 py-2">
          
          {/* Brand Logo & Name */}
          <div
            id="brand-logo-btn"
            onClick={onNavigateLanding}
            className="flex items-center gap-2.5 cursor-pointer group py-1 shrink-0"
          >
            {siteContent?.logoUrl ? (
              <img
                src={siteContent.logoUrl}
                alt={brandName}
                className="h-8 sm:h-9 w-auto max-w-[120px] sm:max-w-[160px] object-contain rounded-sm"
              />
            ) : null}
            <span className="font-black text-base sm:text-lg tracking-wider text-white group-hover:text-amber-400 transition-colors uppercase whitespace-nowrap">
              {brandName}
            </span>
          </div>

          {/* Desktop Navigation Links - Shown only on xl screens (>= 1280px) to prevent two-line wrapping */}
          <nav className="hidden xl:flex items-center gap-1.5 text-xs font-bold shrink-0">
            {/* 1. Bộ Sưu Tập Dropdown Trigger */}
            <div
              className="relative shrink-0"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                id="nav-dropdown-collections-btn"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  currentView === 'collection' || dropdownOpen
                    ? 'bg-neutral-800 text-amber-400 font-bold ring-1 ring-amber-400/40'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <span>Bộ Sưu Tập</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-amber-400' : 'text-neutral-400'}`} />
              </button>

              {/* Mega-Menu Dropdown in Light Mode */}
              {dropdownOpen && (
                <div
                  id="nav-categories-dropdown-menu"
                  className={`absolute top-full mt-2 bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-4 z-50 animate-fadeIn text-slate-900 ${
                    visibleCollections.length === 1
                      ? 'left-0 w-[290px] sm:w-[320px]'
                      : visibleCollections.length === 2
                      ? 'left-1/2 -translate-x-1/3 sm:-translate-x-1/2 w-[92vw] sm:w-[580px] max-w-[620px]'
                      : 'left-1/2 -translate-x-1/4 sm:-translate-x-1/3 lg:-translate-x-1/2 w-[92vw] max-w-[860px]'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className="uppercase tracking-wider text-slate-800 text-[11px] font-extrabold">
                        Bộ Sưu Tập {brandName}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Grid of Collection Cards */}
                  <div className={`grid gap-3.5 max-h-[440px] overflow-y-auto sm:overflow-visible ${
                    visibleCollections.length === 1
                      ? 'grid-cols-1'
                      : visibleCollections.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                  }`}>
                    {visibleCollections.map((col) => {
                      const colImg = col.horizontalImage || col.bannerImage || col.bgImage || '/assets/hero-bg.png';
                      const isSelected = currentView === 'collection' && activeCollectionId === col.id;
                      const cleanTitle = stripBstPrefix(col.title);

                      return (
                        <div
                          key={col.id}
                          id={`nav-megamenu-col-${col.id}`}
                          onClick={() => handleNavClick(() => onSelectCollection(col.id))}
                          className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all duration-300 flex flex-col bg-slate-50/80 hover:bg-white ${
                            isSelected
                              ? 'border-amber-500 ring-2 ring-amber-400/40 bg-amber-50/40 shadow-sm'
                              : 'border-slate-200 hover:border-amber-400 hover:shadow-md'
                          }`}
                        >
                          {/* Horizontal Photo Thumbnail */}
                          <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                            <img
                              src={colImg}
                              alt={cleanTitle}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
                            
                            {/* Badges / Preorder tag */}
                            <div className="absolute top-2 left-2 flex items-center gap-1">
                              {col.badge && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md text-amber-300 text-[9px] font-black uppercase tracking-wider border border-amber-400/20">
                                  {col.badge}
                                </span>
                              )}
                              {col.isPreorder && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
                                  Đặt trước
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Collection Title & Subtitle */}
                          <div className="p-3 flex flex-col justify-between flex-grow">
                            <div>
                              <span className="block text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-1">
                                {cleanTitle}
                              </span>
                              {col.subtitle && (
                                <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5 font-normal">
                                  {col.subtitle}
                                </p>
                              )}
                            </div>

                            <div className="mt-2.5 flex items-center text-[10px] font-bold text-amber-700 group-hover:text-amber-800 transition-colors gap-1">
                              <span>Khám phá ngay</span>
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Sản Phẩm */}
            <button
              id="nav-all-products-btn"
              onClick={() => handleNavClick(() => onOpenAllCatalog('all'))}
              className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                currentView === 'catalog'
                  ? 'bg-neutral-800 text-amber-400 font-bold ring-1 ring-amber-400/40'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <span>Sản Phẩm</span>
            </button>

            {/* 3. Về Chúng Tôi */}
            <button
              id="nav-about-btn"
              onClick={onOpenAbout}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                currentView === 'about'
                  ? 'bg-neutral-800 text-amber-400 font-bold ring-1 ring-amber-400/40'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <span>Về Chúng Tôi</span>
            </button>

            {/* 4. Liên Hệ */}
            <button
              id="nav-contact-btn"
              onClick={onOpenContact}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                currentView === 'contact'
                  ? 'bg-neutral-800 text-amber-400 font-bold ring-1 ring-amber-400/40'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <span>Liên Hệ</span>
            </button>

            {/* 5. Tra Cứu Đơn */}
            {onOpenOrderTracker && (
              <button
                id="nav-track-order-btn"
                onClick={() => handleNavClick(onOpenOrderTracker)}
                className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  currentView === 'order-tracker' || (currentView as any) === 'track-order'
                    ? 'bg-neutral-800 text-amber-400 font-bold ring-1 ring-amber-400/40'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <span>Tra Cứu Đơn</span>
              </button>
            )}
          </nav>

          {/* Action Icons: Admin (if logged in) + Cart Button + Animated 3-Line Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Admin Header Button - ONLY shown when admin is logged in */}
            {isAdminLoggedIn && onOpenAdmin && (
              <button
                id="nav-admin-header-btn"
                onClick={onOpenAdmin}
                className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold shadow-xs group whitespace-nowrap shrink-0"
                title={`Trang Quản Trị Hệ Thống (${currentSeller?.name || 'Admin'})`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                <span className="hidden sm:inline">Quản Trị</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5 shrink-0" title="Đang đăng nhập" />
              </button>
            )}

            {/* Cart Button */}
            <button
              id="nav-cart-btn"
              onClick={onOpenCart}
              className={`relative px-3.5 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 border shadow-xs group cursor-pointer whitespace-nowrap shrink-0 ${
                isCartBumping
                  ? 'scale-105 ring-2 ring-amber-400 bg-amber-400 text-neutral-950 font-black shadow-md border-amber-300'
                  : currentView === 'cart'
                  ? 'bg-amber-400 text-slate-950 font-black border-amber-300'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-800'
              }`}
              aria-label="Mở giỏ hàng"
            >
              <ShoppingBag
                className={`w-4 h-4 transition-transform duration-200 shrink-0 ${
                  isCartBumping
                    ? 'scale-115 text-neutral-950'
                    : currentView === 'cart'
                    ? 'text-slate-950'
                    : 'text-amber-400 group-hover:scale-105'
                }`}
              />
              <span className={`text-xs font-bold hidden sm:inline ${isCartBumping ? 'text-neutral-950 font-black' : ''}`}>
                Giỏ Hàng
              </span>
              {cartCount > 0 && (
                <div className="relative inline-flex items-center justify-center shrink-0">
                  <span
                    className={`relative text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-4 text-center leading-none shadow-xs transition-all duration-200 ${
                      isCartBumping
                        ? 'scale-110 bg-neutral-950 text-amber-400 ring-2 ring-neutral-950 shadow-sm'
                        : currentView === 'cart'
                        ? 'bg-slate-950 text-amber-400'
                        : 'bg-amber-400 text-neutral-950'
                    }`}
                  >
                    {cartCount}
                  </span>
                </div>
              )}
            </button>

            {/* Three-Line Menu Toggle Button with Smooth CSS Morph Animation to 'X' */}
            <button
              id="mobile-menu-toggle-btn"
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="relative w-10 h-10 flex flex-col items-center justify-center gap-1.5 p-2 text-neutral-300 hover:text-white xl:hidden rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 cursor-pointer transition-all duration-200 active:scale-95 shrink-0 focus:outline-hidden"
              aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu ba gạch'}
              aria-expanded={mobileMenuOpen}
            >
              <span
                className={`w-5 h-0.5 rounded-full transition-all duration-300 ease-in-out transform origin-center ${
                  mobileMenuOpen ? 'rotate-45 translate-y-2 bg-amber-400' : 'bg-neutral-200'
                }`}
              />
              <span
                className={`w-5 h-0.5 rounded-full transition-all duration-200 ease-in-out ${
                  mobileMenuOpen ? 'opacity-0 scale-x-0 -translate-x-2 bg-amber-400' : 'opacity-100 scale-x-100 bg-neutral-200'
                }`}
              />
              <span
                className={`w-5 h-0.5 rounded-full transition-all duration-300 ease-in-out transform origin-center ${
                  mobileMenuOpen ? '-rotate-45 -translate-y-2 bg-amber-400' : 'bg-neutral-200'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop with Smooth Fade Animation */}
      <div
        onClick={() => setMobileMenuOpen(false)}
        className={`fixed inset-0 top-14 bg-black/75 backdrop-blur-xs z-30 xl:hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Mobile Animated Dropdown Drawer Panel */}
      <div
        id="mobile-nav-panel"
        className={`fixed left-0 right-0 top-14 z-40 xl:hidden bg-neutral-950/98 backdrop-blur-2xl border-b border-neutral-800/90 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform origin-top ${
          mobileMenuOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto max-h-[calc(100dvh-3.5rem)] overflow-y-auto'
            : 'opacity-0 -translate-y-3 pointer-events-none max-h-0 overflow-hidden'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3">
          {/* Navigation Links Grid */}
          <div className="space-y-1.5">
            {/* 1. Trang Chủ */}
            <button
              onClick={() => handleNavClick(onNavigateLanding)}
              className={`w-full text-left py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                currentView === 'landing'
                  ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30'
                  : 'text-neutral-200 hover:text-white hover:bg-neutral-900/90'
              }`}
            >
              <div className="flex items-center gap-3">
                <Home className={`w-4 h-4 ${currentView === 'landing' ? 'text-amber-400' : 'text-neutral-400'}`} />
                <span className="text-sm">Trang Chủ</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500" />
            </button>

            {/* 2. Sản Phẩm */}
            <button
              onClick={() => handleNavClick(() => onOpenAllCatalog('all'))}
              className={`w-full text-left py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                currentView === 'catalog'
                  ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30'
                  : 'text-neutral-200 hover:text-white hover:bg-neutral-900/90'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package className={`w-4 h-4 ${currentView === 'catalog' ? 'text-amber-400' : 'text-neutral-400'}`} />
                <span className="text-sm">Tất Cả Sản Phẩm</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500" />
            </button>

            {/* 3. Bộ Sưu Tập (Interactive Accordion Drawer) */}
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 overflow-hidden transition-colors">
              <button
                type="button"
                onClick={() => setMobileCollectionsExpanded((prev) => !prev)}
                className="w-full text-left py-2.5 px-3.5 font-bold flex items-center justify-between text-neutral-200 hover:text-white cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <Compass className="w-4 h-4 text-amber-400" />
                  <span className="text-sm">Bộ Sưu Tập</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-amber-300 font-bold border border-neutral-700">
                    {visibleCollections.length}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${
                    mobileCollectionsExpanded ? 'rotate-180 text-amber-400' : ''
                  }`}
                />
              </button>

              {/* Collapsible collections list */}
              <div
                className={`transition-all duration-300 ease-in-out ${
                  mobileCollectionsExpanded ? 'max-h-[600px] opacity-100 pb-2 px-2' : 'max-h-0 opacity-0 overflow-hidden'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-neutral-800/70">
                  {visibleCollections.map((col) => {
                    const colImg = col.horizontalImage || col.bannerImage || col.bgImage || '/assets/hero-bg.png';
                    const isSelected = currentView === 'collection' && activeCollectionId === col.id;
                    const cleanTitle = stripBstPrefix(col.title);

                    return (
                      <button
                        key={col.id}
                        onClick={() => handleNavClick(() => onSelectCollection(col.id))}
                        className={`w-full text-left p-2 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer active:scale-[0.98] ${
                          isSelected
                            ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/40'
                            : 'hover:bg-neutral-800/80 text-neutral-300 hover:text-white'
                        }`}
                      >
                        <img
                          src={colImg}
                          alt={cleanTitle}
                          className="w-10 h-10 rounded-md object-cover shrink-0 border border-neutral-700/60"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold truncate">{cleanTitle}</span>
                            {col.isPreorder && (
                              <span className="text-[8px] font-black text-rose-300 bg-rose-950/90 px-1.5 py-0.2 rounded border border-rose-800 shrink-0">
                                Preorder
                              </span>
                            )}
                          </div>
                          {col.subtitle && (
                            <p className="text-[10px] text-neutral-400 truncate mt-0.5">{col.subtitle}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Về Chúng Tôi */}
            <button
              onClick={() => handleNavClick(onOpenAbout)}
              className={`w-full text-left py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                currentView === 'about'
                  ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30'
                  : 'text-neutral-200 hover:text-white hover:bg-neutral-900/90'
              }`}
            >
              <div className="flex items-center gap-3">
                <Info className={`w-4 h-4 ${currentView === 'about' ? 'text-amber-400' : 'text-neutral-400'}`} />
                <span className="text-sm">Về Chúng Tôi</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500" />
            </button>

            {/* 5. Liên Hệ */}
            <button
              onClick={() => handleNavClick(onOpenContact)}
              className={`w-full text-left py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                currentView === 'contact'
                  ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30'
                  : 'text-neutral-200 hover:text-white hover:bg-neutral-900/90'
              }`}
            >
              <div className="flex items-center gap-3">
                <Phone className={`w-4 h-4 ${currentView === 'contact' ? 'text-amber-400' : 'text-neutral-400'}`} />
                <span className="text-sm">Liên Hệ & Hỗ Trợ</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500" />
            </button>

            {/* 6. Tra Cứu Đơn */}
            {onOpenOrderTracker && (
              <button
                id="mobile-nav-track-order-btn"
                onClick={() => handleNavClick(onOpenOrderTracker)}
                className={`w-full text-left py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                  currentView === 'order-tracker' || (currentView as any) === 'track-order'
                    ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30'
                    : 'text-neutral-200 hover:text-white hover:bg-neutral-900/90'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Search className={`w-4 h-4 ${currentView === 'order-tracker' ? 'text-amber-400' : 'text-neutral-400'}`} />
                  <span className="text-sm">Tra Cứu Đơn Hàng</span>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              </button>
            )}
          </div>

          {/* Admin Mobile Link (Only for logged in Admin) */}
          {isAdminLoggedIn && onOpenAdmin && (
            <div className="pt-2 border-t border-neutral-800">
              <button
                onClick={() => handleNavClick(onOpenAdmin)}
                className="w-full text-left py-3 px-3.5 rounded-xl font-bold flex items-center justify-between text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-xs font-black">Trang Quản Trị Hệ Thống</div>
                    <div className="text-[10px] text-amber-400/80 font-normal">Tài khoản: {currentSeller?.name || 'Admin'}</div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold uppercase tracking-wider">
                  Vào Quản Trị
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
