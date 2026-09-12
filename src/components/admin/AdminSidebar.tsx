import React from 'react';
import { ChevronsLeft, ArrowLeft } from 'lucide-react';
import { SellerUser, SiteContentConfig } from '../../types';

export type AdminTabType =
  | 'dashboard'
  | 'analytics'
  | 'orders'
  | 'manual_order'
  | 'sellers'
  | 'messages'
  | 'site_editor'
  | 'bank_account'
  | 'banners'
  | 'products'
  | 'categories'
  | 'version_history'
  | 'backup'
  | 'firebase';

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
  productsCount: number;
  categoriesCount: number;
  collectionsCount: number;
  sellersCount: number;
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
  productsCount,
  categoriesCount,
  collectionsCount,
  sellersCount,
  onBackToStore,
  onLogout,
  onOpenSwitchSellerModal
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={onCloseSidebar}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="admin-sidebar"
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 shadow-sm ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${desktopSidebarCollapsed ? 'lg:w-0 lg:overflow-hidden lg:border-r-0 lg:p-0' : 'lg:w-64 w-72'}`}
      >
        {/* Top Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
          {/* 1. Header with Store Logo and Top Collapse Button */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center">
              {siteContent?.logoUrl ? (
                <img
                  src={siteContent.logoUrl}
                  alt="Logo"
                  className="w-8 h-8 rounded-xl object-contain bg-white border border-slate-200 p-1 shadow-2xs shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-xs shadow-2xs shrink-0">
                  {(siteContent?.brandName || 'N').charAt(0)}
                </div>
              )}
            </div>

            {/* Top Collapse Button for Desktop, Close button for Mobile */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleDesktopSidebar}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-all cursor-pointer"
                title="Thu gọn menu"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onCloseSidebar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 lg:hidden cursor-pointer"
                title="Đóng"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. Navigation Items */}
          <nav className="p-3 space-y-4">
            {/* SECTION 1: TỔNG QUAN */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                TỔNG QUAN
              </div>
              <button
                onClick={() => onSwitchTab('dashboard')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Bảng điều khiển</span>
              </button>

              <button
                onClick={() => onSwitchTab('analytics')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Truy cập & GA4</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                    activeTab === 'analytics'
                      ? 'bg-black/10 text-slate-950 border-black/15'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                  }`}
                >
                  GA4 Live
                </span>
              </button>
            </div>

            {/* SECTION 2: BÁN HÀNG & ĐƠN HÀNG */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                BÁN HÀNG & ĐƠN HÀNG
              </div>

              <button
                onClick={() => onSwitchTab('orders')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Quản lý đơn hàng</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                    activeTab === 'orders'
                      ? 'bg-black/15 text-slate-950 border-transparent'
                      : 'bg-slate-100 text-slate-700 border-slate-200/70'
                  }`}
                >
                  {ordersCount}
                </span>
              </button>

              <button
                onClick={() => onSwitchTab('manual_order')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'manual_order'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Nhập đơn thủ công</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                    activeTab === 'manual_order'
                      ? 'bg-black/10 text-slate-950 border-black/15'
                      : 'bg-sky-50 text-sky-700 border-sky-200/60'
                  }`}
                >
                  + Mới
                </span>
              </button>

              <button
                onClick={() => onSwitchTab('messages')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'messages'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Hộp thư liên hệ</span>
                {unreadMessagesCount > 0 ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse shadow-xs font-mono">
                    {unreadMessagesCount}
                  </span>
                ) : null}
              </button>
            </div>

            {/* SECTION 3: SẢN PHẨM & KHO */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                SẢN PHẨM & KHO
              </div>

              <button
                onClick={() => onSwitchTab('products')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'products'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Danh sách sản phẩm</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                    activeTab === 'products'
                      ? 'bg-black/15 text-slate-950 border-transparent'
                      : 'bg-slate-100 text-slate-700 border-slate-200/70'
                  }`}
                >
                  {productsCount}
                </span>
              </button>

              <button
                onClick={() => onSwitchTab('categories')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'categories'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Danh mục sản phẩm</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                    activeTab === 'categories'
                      ? 'bg-black/15 text-slate-950 border-transparent'
                      : 'bg-slate-100 text-slate-700 border-slate-200/70'
                  }`}
                >
                  {categoriesCount}
                </span>
              </button>
            </div>

            {/* SECTION 4: GIAO DIỆN & NỘI DUNG */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                GIAO DIỆN & NỘI DUNG
              </div>

              <button
                onClick={() => onSwitchTab('site_editor')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'site_editor'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Sửa Website & Nội dung</span>
              </button>

              <button
                onClick={() => onSwitchTab('banners')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'banners'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Banners & Bộ sưu tập</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                    activeTab === 'banners'
                      ? 'bg-black/15 text-slate-950 border-transparent'
                      : 'bg-slate-100 text-slate-700 border-slate-200/70'
                  }`}
                >
                  {collectionsCount}
                </span>
              </button>

              <button
                onClick={() => onSwitchTab('bank_account')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'bank_account'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Tài khoản ngân hàng</span>
              </button>
            </div>

            {/* SECTION 5: SAO LƯU & BACKUP */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                SAO LƯU & BACKUP
              </div>

              <button
                onClick={() => onSwitchTab('backup')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'backup'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Sao Lưu & Dữ Liệu</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                    activeTab === 'backup'
                      ? 'bg-black/10 text-slate-950 border-black/15'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                  }`}
                >
                  v2.0
                </span>
              </button>

              <button
                onClick={() => onSwitchTab('version_history')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'version_history'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Lịch sử phiên bản</span>
              </button>

              {isRootAdmin && (
                <button
                  onClick={() => onSwitchTab('sellers')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'sellers'
                      ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>Quản trị</span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                      activeTab === 'sellers'
                        ? 'bg-black/15 text-slate-950 border-transparent'
                        : 'bg-amber-100 text-amber-900 border-amber-200/70'
                    }`}
                  >
                    {sellersCount}
                  </span>
                </button>
              )}

              <button
                onClick={() => onSwitchTab('firebase')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'firebase'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Tài Khoản & Quota Firebase</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs shrink-0" title="Firebase Online" />
              </button>
            </div>
          </nav>
        </div>

        {/* 3. Bottom Footer Profile & Back to Store */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
          {/* Seller User Identity */}
          {currentSeller && (
            <div className="p-2 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0"
                  style={{ backgroundColor: currentSeller.avatarColor || '#d97706' }}
                >
                  {currentSeller.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-900 truncate">
                    {currentSeller.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium leading-none">
                    {currentSeller.isRootAdmin ? 'Root Admin' : 'Người bán'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenSwitchSellerModal}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-[10px] font-bold"
                title="Đổi tài khoản"
              >
                Đổi
              </button>
            </div>
          )}

          {/* Action Links */}
          <div className="flex items-center gap-2">
            <button
              onClick={onBackToStore}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Về Web Khách</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                title="Đăng xuất"
              >
                Thoát
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
