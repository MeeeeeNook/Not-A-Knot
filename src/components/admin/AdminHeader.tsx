import React from 'react';
import { Menu, CloudUpload, RefreshCw, ChevronsRight, Package, Folder, ShoppingBag, Mail, ArrowLeft, Bell } from 'lucide-react';
import { AdminNotifications } from '../AdminNotifications';
import { StoredOrder } from '../../firebase';
import { ContactMessage } from '../../types';

interface AdminHeaderProps {
  pageTitle: string;
  desktopSidebarCollapsed: boolean;
  onToggleDesktopSidebar: () => void;
  onOpenMobileSidebar: () => void;
  orders: StoredOrder[];
  contactMessages: ContactMessage[];
  productsCount?: number;
  categoriesCount?: number;
  unreadMessagesCount?: number;
  onInspectOrder: (order: StoredOrder) => void;
  onNavigateToOrders: () => void;
  onNavigateToMessages: () => void;
  onNavigateToProducts?: () => void;
  onNavigateToCategories?: () => void;
  onUpdateOrderStatus: (orderId: string, status: any) => void;
  onMarkMessageRead: (msgId: string) => void;
  onRefreshData: () => void;
  isCloudSyncing: boolean;
  onPushAllToCloud: () => void;
  onFetchFromCloud: () => void;
  onBackToStore?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  pageTitle,
  desktopSidebarCollapsed,
  onToggleDesktopSidebar,
  onOpenMobileSidebar,
  orders,
  contactMessages,
  productsCount,
  categoriesCount,
  unreadMessagesCount = 0,
  onInspectOrder,
  onNavigateToOrders,
  onNavigateToMessages,
  onNavigateToProducts,
  onNavigateToCategories,
  onUpdateOrderStatus,
  onMarkMessageRead,
  onRefreshData,
  isCloudSyncing,
  onPushAllToCloud,
  onFetchFromCloud,
  onBackToStore
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between shadow-2xs gap-2 sm:gap-3 transition-all">
      {/* Left: Mobile menu toggle, expand sidebar button if collapsed, and Page Title */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 lg:hidden cursor-pointer shrink-0 active:scale-95 transition-transform relative"
          title="Mở menu quản trị"
          aria-label="Mở menu quản trị"
        >
          <Menu className="w-5 h-5" />
          {unreadMessagesCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
          )}
        </button>

        {/* Uncollapse button when desktop sidebar is collapsed */}
        {desktopSidebarCollapsed && (
          <button
            type="button"
            onClick={onToggleDesktopSidebar}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-colors cursor-pointer border border-slate-200 shrink-0"
            title="Mở rộng lại menu bên trái"
          >
            <ChevronsRight className="w-4 h-4" />
            <span>Mở Menu</span>
          </button>
        )}

        {/* Page Title: Responsive font sizing */}
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight truncate leading-snug">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Center: Quick Count Indicators (Desktop only) */}
      <div className="hidden lg:flex items-center gap-2">
        {/* Sản phẩm */}
        {typeof productsCount === 'number' && (
          <button
            type="button"
            onClick={onNavigateToProducts}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition-colors cursor-pointer"
            title="Xem danh sách sản phẩm"
          >
            <Package className="w-3.5 h-3.5 text-slate-500" />
            <span>Sản phẩm</span>
            <span className="bg-slate-200 text-slate-900 px-1.5 py-0.5 rounded-md text-[11px] font-bold font-mono">
              {productsCount}
            </span>
          </button>
        )}

        {/* Danh mục */}
        {typeof categoriesCount === 'number' && (
          <button
            type="button"
            onClick={onNavigateToCategories}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition-colors cursor-pointer"
            title="Xem danh mục sản phẩm"
          >
            <Folder className="w-3.5 h-3.5 text-slate-500" />
            <span>Danh mục</span>
            <span className="bg-slate-200 text-slate-900 px-1.5 py-0.5 rounded-md text-[11px] font-bold font-mono">
              {categoriesCount}
            </span>
          </button>
        )}

        {/* Đơn hàng */}
        <button
          type="button"
          onClick={onNavigateToOrders}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 transition-colors cursor-pointer"
          title="Xem danh sách đơn hàng"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
          <span>Đơn hàng</span>
          <span className="bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded-md text-[11px] font-black font-mono">
            {orders.length}
          </span>
        </button>

        {/* Hộp thư */}
        {unreadMessagesCount > 0 && (
          <button
            type="button"
            onClick={onNavigateToMessages}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer animate-pulse"
            title="Có tin nhắn liên hệ mới từ khách hàng"
          >
            <Mail className="w-3.5 h-3.5 text-rose-600" />
            <span>Hộp thư</span>
            <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono">
              {unreadMessagesCount} mới
            </span>
          </button>
        )}
      </div>

      {/* Right: Actions (Notifications, Cloud Sync, and Back to Store) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Direct Back to Store button */}
        {onBackToStore && (
          <button
            type="button"
            onClick={onBackToStore}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 text-xs font-black transition-all border border-amber-500/30 cursor-pointer shadow-xs shrink-0 active:scale-95"
            title="Quay lại trang bán hàng cho khách (Về Shop)"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
            <span className="font-extrabold text-xs hidden sm:inline">Về shop</span>
            <span className="font-extrabold text-xs sm:hidden">Shop</span>
          </button>
        )}

        {/* Admin Notifications Bell & Dropdown */}
        <AdminNotifications
          orders={orders}
          messages={contactMessages}
          onInspectOrder={onInspectOrder}
          onNavigateToOrders={onNavigateToOrders}
          onNavigateToMessages={onNavigateToMessages}
          onUpdateOrderStatus={onUpdateOrderStatus}
          onMarkMessageRead={(msg) => onMarkMessageRead(typeof msg === 'string' ? msg : msg.id)}
          onRefresh={onRefreshData}
        />

        {/* Push to Cloud Button */}
        <button
          type="button"
          onClick={onPushAllToCloud}
          disabled={isCloudSyncing}
          className="p-2 sm:p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center active:scale-95"
          title="Đẩy dữ liệu hiện tại lên Firebase Cloud"
          aria-label="Đẩy lên Cloud"
        >
          <CloudUpload className={`w-4 h-4 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
        </button>

        {/* Sync from Cloud Button */}
        <button
          type="button"
          onClick={onFetchFromCloud}
          disabled={isCloudSyncing}
          className="p-2 sm:p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center active:scale-95"
          title="Đồng bộ dữ liệu mới nhất từ Firebase Cloud"
          aria-label="Đồng bộ từ Cloud"
        >
          <RefreshCw className={`w-4 h-4 ${isCloudSyncing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
};
