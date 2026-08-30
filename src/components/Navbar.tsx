import React, { useState, useRef } from 'react';
import { ShoppingBag, ChevronDown, Menu, X, ArrowRight, Shield, Sparkles } from 'lucide-react';
import { COLLECTIONS_DATA } from '../data/collections';
import { CategoryItem, CollectionInfo, SiteContentConfig } from '../types';

interface NavbarProps {
  cartCount: number;
  categories?: CategoryItem[];
  collections?: CollectionInfo[];
  siteContent?: SiteContentConfig;
  onOpenCart: () => void;
  onNavigateLanding: () => void;
  onSelectCollection: (collectionId: string) => void;
  onOpenAllCatalog: (categoryId?: string) => void;
  onOpenAbout: () => void;
  onOpenContact: () => void;
  onOpenAdmin: () => void;
  currentView: 'landing' | 'collection' | 'catalog' | 'about' | 'contact' | 'admin';
  activeCollectionId: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  categories,
  collections = COLLECTIONS_DATA,
  siteContent,
  onOpenCart,
  onNavigateLanding,
  onSelectCollection,
  onOpenAllCatalog,
  onOpenAbout,
  onOpenContact,
  onOpenAdmin,
  currentView,
  activeCollectionId
}) => {
  const brandName = siteContent?.brandName || 'NOT A KNOT';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-800 text-white transition-all shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 py-2">
          
          {/* Brand Logo & Name */}
          <div
            id="brand-logo-btn"
            onClick={onNavigateLanding}
            className="flex items-center gap-2.5 cursor-pointer group py-1"
          >
            {siteContent?.logoUrl ? (
              <img
                src={siteContent.logoUrl}
                alt={brandName}
                className="h-8 sm:h-9 w-auto max-w-[120px] sm:max-w-[160px] object-contain rounded-sm"
              />
            ) : null}
            <span className="font-black text-base sm:text-lg tracking-wider text-white group-hover:text-amber-400 transition-colors uppercase">
              {brandName}
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-bold">
            {/* 1. Bộ Sưu Tập Dropdown Trigger */}
            <div
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                id="nav-dropdown-collections-btn"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentView === 'collection' || dropdownOpen
                    ? 'bg-neutral-800 text-amber-400 font-bold ring-1 ring-amber-400/40'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <span>Bộ Sưu Tập</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-amber-400' : 'text-neutral-400'}`} />
              </button>

              {/* Mega-Menu Dropdown */}
              {dropdownOpen && (
                <div
                  id="nav-categories-dropdown-menu"
                  className="absolute top-full left-1/2 -translate-x-1/4 sm:-translate-x-1/3 lg:-translate-x-1/2 mt-2 w-[92vw] max-w-[860px] bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl p-5 z-50 animate-fadeIn text-white"
                >
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="uppercase tracking-wider text-white">Bộ Sưu Tập Thủ Công {brandName}</span>
                    </div>
                    <button
                      onClick={() => handleNavClick(onNavigateLanding)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold transition-colors cursor-pointer"
                    >
                      <span>Xem tất cả</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Horizontal Grid of Collection Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[440px] overflow-y-auto sm:overflow-visible">
                    {collections.map((col) => {
                      const colImg = col.horizontalImage || col.bannerImage || col.bgImage || '/assets/hero-bg.png';
                      const isSelected = currentView === 'collection' && activeCollectionId === col.id;

                      return (
                        <div
                          key={col.id}
                          id={`nav-megamenu-col-${col.id}`}
                          onClick={() => handleNavClick(() => onSelectCollection(col.id))}
                          className={`group relative rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 flex flex-col bg-neutral-950/80 hover:bg-neutral-950 ${
                            isSelected
                              ? 'border-amber-400 ring-2 ring-amber-400/40 bg-amber-950/20'
                              : 'border-neutral-800 hover:border-amber-400/60 hover:shadow-lg'
                          }`}
                        >
                          {/* Horizontal Photo Thumbnail */}
                          <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-900">
                            <img
                              src={colImg}
                              alt={col.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
                            
                            {/* Badges / Preorder tag */}
                            <div className="absolute top-2 left-2 flex items-center gap-1">
                              {col.badge && (
                                <span className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-amber-300 text-[9px] font-black uppercase tracking-wider border border-amber-400/20">
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
                              <h4 className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                                {col.title}
                              </h4>
                              {col.subtitle && (
                                <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5 font-normal">
                                  {col.subtitle}
                                </p>
                              )}
                            </div>

                            <div className="mt-2.5 flex items-center text-[10px] font-bold text-amber-400 group-hover:text-amber-300 transition-colors gap-1">
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
              className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                currentView === 'about'
                  ? 'bg-neutral-800 text-amber-400 font-bold ring-1 ring-amber-400/40'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
              }`}
            >
              Về Chúng Tôi
            </button>

            {/* 4. Liên Hệ */}
            <button
              id="nav-contact-btn"
              onClick={onOpenContact}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                currentView === 'contact'
                  ? 'bg-neutral-800 text-amber-400 font-bold ring-1 ring-amber-400/40'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
              }`}
            >
              Liên Hệ
            </button>
          </nav>

          {/* Action Icons: Cart Button & Admin portal entry */}
          <div className="flex items-center gap-2">
            {/* Admin entry */}
            <button
              id="nav-admin-btn"
              onClick={onOpenAdmin}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                currentView === 'admin'
                  ? 'bg-amber-400 text-neutral-950 border-amber-400 shadow-xs'
                  : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800 hover:text-white'
              }`}
              title="Trang Quản Trị Hệ Thống"
              aria-label="Admin Portal"
            >
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline text-xs">Quản Trị</span>
            </button>

            {/* Cart Button */}
            <button
              id="nav-cart-btn"
              onClick={onOpenCart}
              className="relative px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white transition-all flex items-center gap-2 border border-neutral-800 shadow-xs group cursor-pointer"
              aria-label="Mở giỏ hàng"
            >
              <ShoppingBag className="w-4 h-4 text-amber-400 group-hover:scale-105 transition-transform" />
              <span className="text-xs font-bold hidden sm:inline">Giỏ Hàng</span>
              {cartCount > 0 && (
                <span className="bg-amber-400 text-neutral-950 text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-4 text-center leading-none shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile Menu Hamburger */}
            <button
              id="mobile-menu-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-neutral-300 hover:text-white md:hidden rounded-xl hover:bg-neutral-900 border border-neutral-800 cursor-pointer"
              aria-label="Menu di động"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-neutral-950 border-b border-neutral-800 px-4 py-4 space-y-2 animate-fadeIn text-xs text-white shadow-xl">
          <button
            onClick={() => handleNavClick(onNavigateLanding)}
            className={`w-full text-left py-2.5 px-3 rounded-xl font-bold flex items-center justify-between cursor-pointer ${
              currentView === 'landing' ? 'bg-amber-400/10 text-amber-300' : 'text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            <span>Trang Chủ</span>
            <span>›</span>
          </button>

          {/* Sản Phẩm */}
          <button
            onClick={() => handleNavClick(() => onOpenAllCatalog('all'))}
            className={`w-full text-left py-2.5 px-3 rounded-xl font-bold flex items-center justify-between transition-colors cursor-pointer ${
              currentView === 'catalog'
                ? 'bg-neutral-800 text-amber-400'
                : 'text-neutral-300 bg-neutral-900 hover:bg-neutral-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Sản Phẩm Thủ Công</span>
            </div>
            <span>›</span>
          </button>

          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-3 pt-2">
            Bộ Sưu Tập Thủ Công
          </div>

          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => handleNavClick(() => onSelectCollection(col.id))}
              className={`w-full text-left py-2 px-3 rounded-lg font-medium flex items-center justify-between cursor-pointer ${
                currentView === 'collection' && activeCollectionId === col.id
                  ? 'bg-amber-400/15 text-amber-300 font-bold'
                  : 'text-neutral-300 hover:bg-neutral-900'
              }`}
            >
              <span>{col.title}</span>
              {col.isPreorder && (
                <span className="text-[9px] font-bold text-rose-300 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">
                  Đặt trước
                </span>
              )}
            </button>
          ))}

          <div className="pt-2 border-t border-neutral-800 flex flex-col gap-1">
            <button
              onClick={() => handleNavClick(onOpenAbout)}
              className={`w-full text-left py-2 px-3 rounded-lg font-semibold flex items-center justify-between cursor-pointer ${
                currentView === 'about'
                  ? 'bg-neutral-800 text-amber-400 font-bold'
                  : 'text-neutral-300 hover:bg-neutral-900'
              }`}
            >
              <span>Về Chúng Tôi</span>
              <span>›</span>
            </button>
            <button
              onClick={() => handleNavClick(onOpenContact)}
              className={`w-full text-left py-2 px-3 rounded-lg font-semibold flex items-center justify-between cursor-pointer ${
                currentView === 'contact'
                  ? 'bg-neutral-800 text-amber-400 font-bold'
                  : 'text-neutral-300 hover:bg-neutral-900'
              }`}
            >
              <span>Liên Hệ</span>
              <span>›</span>
            </button>
            <button
              onClick={() => handleNavClick(onOpenAdmin)}
              className="w-full text-left py-2 px-3 rounded-lg font-bold text-amber-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 flex items-center justify-between mt-1 cursor-pointer"
            >
              <span>Trang Quản Trị Hệ Thống</span>
              <span>›</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
