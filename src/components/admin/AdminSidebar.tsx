import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronsLeft, ArrowLeft, Wrench, Mail, ShieldAlert, 
  LayoutDashboard, ShoppingBag, PlusCircle, Ticket, Trash2, 
  Package, Folder, Palette, Share2, CreditCard, Search, 
  Database, History, HardDrive, ShieldCheck, Users, X,
  LogOut, UserCircle2, ExternalLink
} from 'lucide-react';
import { SellerUser, SiteContentConfig } from '../../types';

export type AdminTabType =
  | 'dashboard'
  | 'orders'
  | 'manual_order'
  | 'vouchers'
  | 'trash'
  | 'banners'
  | 'sellers'
  | 'messages'
  | 'site_editor'
  | 'social_feed'
  | 'seo_audit'
  | 'products'
  | 'categories'
  | 'version_history'
  | 'logs'
  | 'backup'
  | 'firebase'
  | 'maintenance'
  | 'email';

interface AdminSidebarProps {
  activeTab: AdminTabType;
  onSwitchTab: (tab: AdminTabType) => void;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  desktopSidebarCollapsed: boolean;
  onToggleDesktopSidebar: () => void;
  siteContent?: SiteContentConfig;
  currentSeller?: SellerUser;
  isRootAdmin: boolean;
  unreadMessagesCount: number;
  ordersCount: number;
  trashCount?: number;
  productsCount: number;
  categoriesCount: number;
  collectionsCount: number;
  sellersCount: number;
  seoIssuesCount?: number;
  isMaintenanceActive?: boolean;
  onBackToStore: () => void;
  onLogout?: () => void;
  onOpenSwitchSellerModal: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onSwitchTab,
  sidebarOpen,
  onCloseSidebar,
  desktopSidebarCollapsed,
  onToggleDesktopSidebar,
  siteContent,
  currentSeller,
  isRootAdmin,
  unreadMessagesCount,
  ordersCount,
  trashCount = 0,
  productsCount,
  categoriesCount,
  collectionsCount,
  sellersCount,
  seoIssuesCount = 0,
  isMaintenanceActive = false,
  onBackToStore,
  onLogout,
  onOpenSwitchSellerModal
}) => {
  const [showLogoutBtn, setShowLogoutBtn] = useState(false);
  const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);
  const userCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userCardRef.current && !userCardRef.current.contains(e.target as Node)) {
        setShowLogoutBtn(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleItemClick = (tab: AdminTabType) => {
    onSwitchTab(tab);
    if (sidebarOpen) {
      onCloseSidebar();
    }
  };

  return (
    <>
      {/* Mobile Backdrop with Smooth Fade */}
      {sidebarOpen && (
        <div
          onClick={onCloseSidebar}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity duration-300 animate-fadeIn"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container (Mobile-first Drawer on < lg, Sticky on >= lg) */}
      <aside
        id="admin-sidebar"
        aria-label="Thanh điều hướng quản trị"
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen max-h-[100dvh] bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 shadow-xl lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          desktopSidebarCollapsed 
            ? 'lg:w-0 lg:overflow-hidden lg:border-r-0 lg:p-0' 
            : 'w-[84vw] sm:w-80 lg:w-64 max-w-sm'
        }`}
      >
        {/* Top Header & Navigation Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200">
          
          {/* 1. Header with Store Logo & Controls */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 gap-2 sticky top-0 z-10 backdrop-blur-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              {siteContent?.logoUrl ? (
                <img
                  src={siteContent.logoUrl}
                  alt="Logo"
                  className="w-8 h-8 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shadow-2xs shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-xs shadow-2xs shrink-0">
                  {(siteContent?.brandName || 'N').charAt(0)}
                </div>
              )}

              <div className="min-w-0">
                <h2 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate leading-tight">
                  {siteContent?.brandName || 'Not A Knot'}
                </h2>
                <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">
                  Trang Quản Trị
                </span>
              </div>
            </div>

            {/* Actions: Desktop collapse & Mobile close */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onToggleDesktopSidebar}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-200/70 transition-all cursor-pointer"
                title="Thu gọn menu"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onCloseSidebar}
                className="flex lg:hidden items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-200/70 transition-all cursor-pointer"
                title="Đóng menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* User Profile Card - Morphs into Logout button on Hover (desktop) / Tap (mobile) */}
          {currentSeller && (
            <div
              ref={userCardRef}
              onClick={() => {
                if (showLogoutBtn) {
                  setIsConfirmLogoutOpen(true);
                } else {
                  setShowLogoutBtn(true);
                }
              }}
              onMouseEnter={() => setShowLogoutBtn(true)}
              onMouseLeave={() => setShowLogoutBtn(false)}
              className="relative group mx-3 mt-2.5 rounded-xl border border-amber-200/80 hover:border-rose-400 overflow-hidden cursor-pointer select-none transition-all duration-200 shadow-2xs"
              title="Rê chuột hoặc chạm vào để Đăng xuất"
            >
              {/* 1. Normal State: Clean, compact user information (Single lines, no awkward wraps) */}
              <div className="px-3 py-2 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent space-y-0.5">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="font-extrabold text-xs text-slate-900 truncate leading-tight">
                    {currentSeller.name}
                  </span>
                  <span className="shrink-0 font-bold text-amber-900 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-200/80 leading-none">
                    {currentSeller.isRootAdmin ? 'Tổng bí thư' : (currentSeller.role === 'deputy_admin' ? 'Chủ tịch nước' : 'Bộ trưởng')}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-600 truncate leading-tight">
                  {currentSeller.googleEmail || currentSeller.username}
                </div>
              </div>

              {/* 2. Hover / Tap State: The entire card morphs into the Exit Button */}
              {onLogout && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsConfirmLogoutOpen(true);
                  }}
                  className={`absolute inset-0 z-10 w-full h-full bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 rounded-xl shadow-inner transition-all duration-200 cursor-pointer ${
                    showLogoutBtn
                      ? 'opacity-100 pointer-events-auto scale-100'
                      : 'opacity-0 pointer-events-none scale-98 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:scale-100'
                  }`}
                  title="Đăng xuất khỏi trang quản trị"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              )}
            </div>
          )}

          {/* 2. Grouped Navigation Items */}
          <nav className="p-3 space-y-4">
            
            {/* SECTION 1: TỔNG QUAN */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                TỔNG QUAN
              </div>
              <button
                type="button"
                onClick={() => handleItemClick('dashboard')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Bảng điều khiển</span>
                </div>
              </button>
            </div>

            {/* SECTION 2: BÁN HÀNG & ĐƠN HÀNG */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                BÁN HÀNG & ĐƠN HÀNG
              </div>

              <button
                type="button"
                onClick={() => handleItemClick('orders')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'orders'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className={`w-4 h-4 ${activeTab === 'orders' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Quản lý đơn hàng</span>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                    activeTab === 'orders'
                      ? 'bg-black/15 text-slate-950 border-transparent'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {ordersCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('manual_order')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'manual_order'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <PlusCircle className={`w-4 h-4 ${activeTab === 'manual_order' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Nhập đơn thủ công</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('vouchers')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'vouchers'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Ticket className={`w-4 h-4 ${activeTab === 'vouchers' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Mã giảm giá</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('trash')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'trash'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 className={`w-4 h-4 ${activeTab === 'trash' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Thùng rác</span>
                </div>
                {trashCount > 0 && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border ${
                      activeTab === 'trash'
                        ? 'bg-black/10 text-slate-950 border-black/15'
                        : 'bg-rose-100 text-rose-800 border-rose-200'
                    }`}
                  >
                    {trashCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('messages')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'messages'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Mail className={`w-4 h-4 ${activeTab === 'messages' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Hộp thư liên hệ</span>
                </div>
                {unreadMessagesCount > 0 ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse shadow-xs font-mono">
                    {unreadMessagesCount} mới
                  </span>
                ) : null}
              </button>
            </div>

            {/* SECTION 3: SẢN PHẨM & KHO */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                SẢN PHẨM & KHO
              </div>

              <button
                type="button"
                onClick={() => handleItemClick('products')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'products'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Package className={`w-4 h-4 ${activeTab === 'products' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Danh sách sản phẩm</span>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                    activeTab === 'products'
                      ? 'bg-black/15 text-slate-950 border-transparent'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {productsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('categories')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'categories'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Folder className={`w-4 h-4 ${activeTab === 'categories' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Danh mục sản phẩm</span>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                    activeTab === 'categories'
                      ? 'bg-black/15 text-slate-950 border-transparent'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {categoriesCount}
                </span>
              </button>
            </div>

            {/* SECTION 4: GIAO DIỆN & NỘI DUNG */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                GIAO DIỆN & NỘI DUNG
              </div>

              <button
                type="button"
                onClick={() => handleItemClick('site_editor')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'site_editor'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Palette className={`w-4 h-4 ${activeTab === 'site_editor' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Chỉnh sửa giao diện</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('social_feed')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'social_feed'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Share2 className={`w-4 h-4 ${activeTab === 'social_feed' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Social Media Feed</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('seo_audit')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'seo_audit'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Search className={`w-4 h-4 ${activeTab === 'seo_audit' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Kiểm tra SEO</span>
                </div>
                {seoIssuesCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-700">
                    {seoIssuesCount} lỗi
                  </span>
                )}
              </button>
            </div>

            {/* SECTION 5: SAO LƯU & HỆ THỐNG */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                HỆ THỐNG & DỮ LIỆU
              </div>

              <button
                type="button"
                onClick={() => handleItemClick('backup')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'backup'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Database className={`w-4 h-4 ${activeTab === 'backup' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Sao Lưu Dữ Liệu</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('version_history')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'version_history'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <History className={`w-4 h-4 ${activeTab === 'version_history' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Lịch sử phiên bản</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('logs')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'logs'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <HardDrive className={`w-4 h-4 ${activeTab === 'logs' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>System Log</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('firebase')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                  activeTab === 'firebase'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Database className={`w-4 h-4 ${activeTab === 'firebase' ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>Firebase Settings</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs shrink-0" title="Firebase Online" />
              </button>
            </div>

            {/* SECTION 6: QUẢN TRỊ (CHỈ ROOT ADMIN) */}
            {isRootAdmin && (
              <div className="space-y-1 pt-2 border-t border-slate-200/80">
                <div className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  QUẢN TRỊ
                </div>

                {/* Page 1: Quản trị tài khoản */}
                <button
                  type="button"
                  onClick={() => handleItemClick('sellers')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                    activeTab === 'sellers'
                      ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Users className={`w-4 h-4 ${activeTab === 'sellers' ? 'text-slate-950' : 'text-slate-500'}`} />
                    <span>Quản trị tài khoản</span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                      activeTab === 'sellers'
                        ? 'bg-black/15 text-slate-950 border-transparent'
                        : 'bg-amber-100 text-amber-900 border-amber-200'
                    }`}
                  >
                    {sellersCount}
                  </span>
                </button>

                {/* Page 2: Email */}
                <button
                  type="button"
                  onClick={() => handleItemClick('email')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                    activeTab === 'email'
                      ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Mail className={`w-4 h-4 ${activeTab === 'email' ? 'text-slate-950' : 'text-slate-500'}`} />
                    <span>Cài đặt Email</span>
                  </div>
                </button>

                {/* Page 3: Maintenance mode */}
                <button
                  type="button"
                  onClick={() => handleItemClick('maintenance')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                    activeTab === 'maintenance'
                      ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Wrench className={`w-4 h-4 ${activeTab === 'maintenance' ? 'text-slate-950' : 'text-slate-500'}`} />
                    <span>Chế độ bảo trì</span>
                  </div>
                  {isMaintenanceActive ? (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-500 text-white animate-pulse shadow-xs">
                      Đang bật
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                      Tắt
                    </span>
                  )}
                </button>
              </div>
            )}
          </nav>
        </div>

        {/* 3. Bottom Footer Back to Store Action */}
        <div 
          className="p-3 border-t border-slate-100 bg-slate-50/70 shrink-0"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={onBackToStore}
            className="w-full px-3 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border border-amber-500/40 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về shop</span>
          </button>
        </div>
      </aside>

      {/* Confirmation Screen Trước Khi Đăng Xuất */}
      {isConfirmLogoutOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsConfirmLogoutOpen(false)}
        >
          <div
            className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200 shadow-xs">
                <LogOut className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  Xác nhận đăng xuất?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Tài khoản: {currentSeller?.name || 'Quản trị viên'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn kết thúc phiên làm việc quản trị hiện tại không?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsConfirmLogoutOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer active:scale-95"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmLogoutOpen(false);
                  onLogout?.();
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 border border-rose-700"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
