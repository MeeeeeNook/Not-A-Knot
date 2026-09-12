import React from 'react';
import { Menu, CloudUpload, RefreshCw, ChevronsRight, Package, Folder, ShoppingBag, Mail } from 'lucide-react';
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
  onFetchFromCloud
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-2xs gap-3">
      {/* Left: Mobile menu toggle, expand sidebar button if collapsed, and Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden cursor-pointer"
          title="Mở menu quản trị"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Uncollapse button when desktop sidebar is collapsed */}
        {desktopSidebarCollapsed && (
          <button
            onClick={onToggleDesktopSidebar}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-colors cursor-pointer border border-slate-200"
            title="Mở rộng lại menu bên trái"
          >
            <ChevronsRight className="w-4 h-4" />
            <span>Mở Menu</span>
          </button>
        )}

        {/* Page Title: Exactly just the page name, no breadcrumbs */}
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Center: Quick Count Indicators (Sản phẩm, Danh mục, Đơn hàng, Hộp thư nếu có tin mới) */}
      <div className="hidden lg:flex items-center gap-2">
        {/* Sản phẩm */}
        {typeof productsCount === 'number' && (
          <button
            type="button"
            onClick={onNavigateToProducts}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition-colors cursor-pointer"
            title="Xem danh sách sản phẩm"
          >
            <Package className="w-3.5 h-3.5 text-slate-500" />
            <span>Sản phẩm</span>
            <span className="bg-slate-200 text-slate-900 px-1.5 py-0.5 rounded text-[11px] font-bold font-mono">
              {productsCount}
            </span>
          </button>
        )}

        {/* Danh mục */}
        {typeof categoriesCount === 'number' && (
          <button
            type="button"
            onClick={onNavigateToCategories}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition-colors cursor-pointer"
            title="Xem danh mục sản phẩm"
          >
            <Folder className="w-3.5 h-3.5 text-slate-500" />
            <span>Danh mục</span>
            <span className="bg-slate-200 text-slate-900 px-1.5 py-0.5 rounded text-[11px] font-bold font-mono">
              {categoriesCount}
            </span>
          </button>
        )}

        {/* Đơn hàng */}
        <button
          type="button"
          onClick={onNavigateToOrders}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors cursor-pointer"
          title="Xem danh sách đơn hàng"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
          <span>Đơn hàng</span>
          <span className="bg-amber-200/80 text-amber-950 px-1.5 py-0.5 rounded text-[11px] font-black font-mono">
            {orders.length}
          </span>
        </button>

        {/* Hộp thư - Chỉ hiện nếu có tin nhắn mới */}
        {unreadMessagesCount > 0 && (
          <button
            type="button"
            onClick={onNavigateToMessages}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer animate-pulse"
            title="Có tin nhắn liên hệ mới từ khách hàng"
          >
            <Mail className="w-3.5 h-3.5 text-rose-600" />
            <span>Hộp thư</span>
            <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded text-[10px] font-black font-mono">
              {unreadMessagesCount} mới
            </span>
          </button>
        )}
      </div>

      {/* Right: Notifications & Cloud Icons (Icon-only with hover description) */}
      <div className="flex items-center gap-2">
        {/* Admin Notifications */}
        <AdminNotifications
          orders={orders}
          messages={contactMessages}
          onInspectOrder={onInspectOrder}
          onNavigateToOrders={onNavigateToOrders}
          onNavigateToMessages={onNavigateToMessages}
          onUpdateOrderStatus={onUpdateOrderStatus}
          onMarkMessageRead={onMarkMessageRead}
          onRefresh={onRefreshData}
        />

        {/* Push to Cloud Button (Icon-only with hover tooltip) */}
        <div className="relative group">
          <button
            onClick={onPushAllToCloud}
            disabled={isCloudSyncing}
            className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
            title="Đẩy dữ liệu hiện tại lên Firebase Cloud (Ghi đè Cloud để khớp với máy bạn)"
            aria-label="Đẩy lên Cloud"
          >
            <CloudUpload className={`w-4 h-4 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
          </button>
          <div className="pointer-events-none absolute -bottom-8 right-0 z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            Đẩy dữ liệu lên Cloud
          </div>
        </div>

        {/* Sync from Cloud Button (Icon-only with hover tooltip) */}
        <div className="relative group">
          <button
            onClick={onFetchFromCloud}
            disabled={isCloudSyncing}
            className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
            title="Đồng bộ dữ liệu mới nhất từ Firebase Cloud về máy"
            aria-label="Đồng bộ từ Cloud"
          >
            <RefreshCw className={`w-4 h-4 ${isCloudSyncing ? 'animate-spin' : ''}`} />
          </button>
          <div className="pointer-events-none absolute -bottom-8 right-0 z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            Đồng bộ dữ liệu từ Cloud
          </div>
        </div>
      </div>
    </header>
  );
};
