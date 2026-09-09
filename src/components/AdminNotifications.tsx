import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, Check, ChevronRight, RotateCw, X, Trash2, CheckCheck } from 'lucide-react';
import { StoredOrder } from '../firebase';
import { ContactMessage } from '../types';
import { 
  formatOrderDateWithoutSeconds, 
  getSourceBadgeConfig, 
  normalizeOrderStatus,
  isManualOrder,
  isWebOrder,
  playWebOrderChime
} from '../utils/orderFormatters';

interface AdminNotificationsProps {
  orders: StoredOrder[];
  messages: ContactMessage[];
  onInspectOrder: (order: StoredOrder) => void;
  onNavigateToOrders: () => void;
  onNavigateToMessages: () => void;
  onUpdateOrderStatus?: (orderId: string, status: string) => void;
  onMarkMessageRead?: (msg: ContactMessage) => void;
  onRefresh?: () => void;
}

const STORAGE_KEY_DISMISSED_ORDERS = 'nak_dismissed_order_notifs';
const STORAGE_KEY_DISMISSED_MSGS = 'nak_dismissed_msg_notifs';

export const AdminNotifications: React.FC<AdminNotificationsProps> = ({
  orders,
  messages,
  onInspectOrder,
  onNavigateToOrders,
  onNavigateToMessages,
  onUpdateOrderStatus,
  onMarkMessageRead,
  onRefresh
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'messages'>('orders');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Set of dismissed notification IDs stored in localStorage
  const [dismissedOrderIds, setDismissedOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DISMISSED_ORDERS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [dismissedMsgIds, setDismissedMsgIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DISMISSED_MSGS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Filter new/pending orders (Đã đặt or Đã tiếp nhận) EXCLUSIVELY from Web (khách đặt từ web)
  // User mandate: "đơn hàng tự nhập thì không cần thông báo chỉ cần thông báo khi có đơn hàng từ web"
  const newOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (o.id && dismissedOrderIds.includes(o.id)) return false;
        // Loại bỏ hoàn toàn đơn hàng tự nhập thủ công
        if (isManualOrder(o)) return false;
        // Chỉ nhận thông báo khi có đơn hàng từ web
        if (!isWebOrder(o)) return false;

        const st = normalizeOrderStatus(o.status);
        return st === 'Chờ xác nhận';
      })
      .slice(0, 25);
  }, [orders, dismissedOrderIds]);

  // Track new web orders arrival for live notification chime & toast
  const previousWebOrderIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const currentWebOrderIds = new Set(newOrders.map((o) => o.id || ''));
    if (previousWebOrderIdsRef.current === null) {
      previousWebOrderIdsRef.current = currentWebOrderIds;
      return;
    }

    const newlyArrived = newOrders.filter((o) => o.id && !previousWebOrderIdsRef.current?.has(o.id));
    if (newlyArrived.length > 0) {
      playWebOrderChime();
      const first = newlyArrived[0];
      showToast(`Đơn hàng mới từ Web: #${(first.id || '').slice(-6)} - ${first.name || first.customerName || 'Khách web'}`);
    }

    previousWebOrderIdsRef.current = currentWebOrderIds;
  }, [newOrders]);

  // Filter unread contact messages excluding dismissed ones
  const unreadMessages = useMemo(() => {
    return messages
      .filter((m) => !m.isRead && !dismissedMsgIds.includes(m.id))
      .slice(0, 25);
  }, [messages, dismissedMsgIds]);

  const totalUnreadCount = newOrders.length + unreadMessages.length;

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Dismiss a single order notification
  const handleDismissOrder = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...dismissedOrderIds, orderId];
    setDismissedOrderIds(updated);
    try {
      localStorage.setItem(STORAGE_KEY_DISMISSED_ORDERS, JSON.stringify(updated));
    } catch (err) {
      console.warn('Lỗi lưu dismissed orders:', err);
    }
    showToast('Đã xóa thông báo đơn hàng');
  };

  // Dismiss a single message notification
  const handleDismissMessage = (msg: ContactMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...dismissedMsgIds, msg.id];
    setDismissedMsgIds(updated);
    try {
      localStorage.setItem(STORAGE_KEY_DISMISSED_MSGS, JSON.stringify(updated));
    } catch (err) {
      console.warn('Lỗi lưu dismissed messages:', err);
    }
    if (onMarkMessageRead) {
      onMarkMessageRead(msg);
    }
    showToast('Đã xóa thông báo tin nhắn');
  };

  // Clear all notifications in current tab or both
  const handleClearCurrentTab = () => {
    if (activeTab === 'orders') {
      const orderIdsToDismiss = newOrders.map((o) => o.id).filter(Boolean) as string[];
      const updated = Array.from(new Set([...dismissedOrderIds, ...orderIdsToDismiss]));
      setDismissedOrderIds(updated);
      try {
        localStorage.setItem(STORAGE_KEY_DISMISSED_ORDERS, JSON.stringify(updated));
      } catch (err) {
        console.warn('Lỗi lưu dismissed orders:', err);
      }
      showToast('Đã xóa tất cả thông báo đơn hàng');
    } else {
      const msgIdsToDismiss = unreadMessages.map((m) => m.id);
      const updated = Array.from(new Set([...dismissedMsgIds, ...msgIdsToDismiss]));
      setDismissedMsgIds(updated);
      try {
        localStorage.setItem(STORAGE_KEY_DISMISSED_MSGS, JSON.stringify(updated));
      } catch (err) {
        console.warn('Lỗi lưu dismissed messages:', err);
      }
      if (onMarkMessageRead) {
        unreadMessages.forEach((m) => onMarkMessageRead(m));
      }
      showToast('Đã xóa tất cả thông báo tin nhắn');
    }
  };

  // Reset / restore cleared notifications
  const handleRestoreDismissed = () => {
    setDismissedOrderIds([]);
    setDismissedMsgIds([]);
    localStorage.removeItem(STORAGE_KEY_DISMISSED_ORDERS);
    localStorage.removeItem(STORAGE_KEY_DISMISSED_MSGS);
    showToast('Đã khôi phục lại toàn bộ thông báo');
  };

  // Relative time helper
  const getTimeAgo = (dateStr?: string, timestamp?: number) => {
    let time = timestamp;
    if (!time && dateStr) {
      const parsed = new Date(dateStr).getTime();
      if (!isNaN(parsed)) time = parsed;
    }
    if (!time) return formatOrderDateWithoutSeconds(dateStr);

    const diff = Date.now() - time;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return formatOrderDateWithoutSeconds(dateStr);
  };

  const hasItemsInCurrentTab = activeTab === 'orders' ? newOrders.length > 0 : unreadMessages.length > 0;
  const hasDismissedHistory = dismissedOrderIds.length > 0 || dismissedMsgIds.length > 0;

  return (
    <div className="relative font-sans antialiased text-slate-900" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        id="admin-notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
          isOpen
            ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-xs'
            : totalUnreadCount > 0
            ? 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-xs'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
        title={`Thông báo (${totalUnreadCount} mục mới)`}
        aria-label="Thông báo quản trị"
      >
        <Bell className="w-4 h-4 text-slate-700" />
        
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white font-bold text-[11px] rounded-full flex items-center justify-center border-2 border-white shadow-xs">
            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[390px] sm:w-[440px] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden text-slate-900 animate-fadeIn">
          
          {/* Header */}
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h3 className="font-bold text-base text-slate-900 tracking-tight">Thông báo</h3>
              {totalUnreadCount > 0 ? (
                <span className="text-xs font-semibold text-slate-700 bg-slate-200/80 px-2.5 py-0.5 rounded-full">
                  {totalUnreadCount} mới
                </span>
              ) : (
                <span className="text-xs text-slate-500 font-medium">Đã cập nhật</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Nút Xóa tất cả thông báo */}
              {hasItemsInCurrentTab && (
                <button
                  type="button"
                  id="btn-clear-all-notifications"
                  onClick={handleClearCurrentTab}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-transparent hover:border-rose-200"
                  title="Xóa tất cả thông báo trong mục này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa tất cả</span>
                </button>
              )}

              {onRefresh && (
                <button
                  type="button"
                  onClick={() => onRefresh()}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                  title="Làm mới"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Toast Notification inside popover */}
          {toastMessage && (
            <div className="bg-slate-900 text-white text-xs font-medium px-4 py-2 flex items-center justify-between animate-fadeIn">
              <span>{toastMessage}</span>
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          )}

          {/* Clean Segmented Tabs */}
          <div className="flex border-b border-slate-200 px-5 gap-6 text-sm font-medium bg-white">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`py-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Đơn hàng Web</span>
              {newOrders.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'orders'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {newOrders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('messages')}
              className={`py-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'messages'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Tin nhắn</span>
              {unreadMessages.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'messages'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {unreadMessages.length}
                </span>
              )}
            </button>
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            
            {/* ORDERS TAB */}
            {activeTab === 'orders' && (
              <>
                {newOrders.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-2">
                    <p className="text-sm font-medium text-slate-700">Không có thông báo đơn hàng mới từ web</p>
                    <p className="text-xs text-slate-400">
                      Hệ thống chỉ thông báo khi có khách đặt hàng trực tuyến trên Website (đơn hàng tự nhập sẽ không tạo thông báo).
                    </p>
                    {hasDismissedHistory && (
                      <button
                        type="button"
                        onClick={handleRestoreDismissed}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer pt-1 block mx-auto"
                      >
                        Khôi phục lại các thông báo đã xóa
                      </button>
                    )}
                  </div>
                ) : (
                  newOrders.map((ord) => {
                    const srcConfig = getSourceBadgeConfig(ord.source);
                    const totalAmt = ord.totalPrice || ord.totalAmount || 0;
                    const itemsCount = ord.itemDetails?.length || ord.items?.length || 1;
                    const cleanDate = formatOrderDateWithoutSeconds(ord.date || ord.createdAt);
                    const isNew = normalizeOrderStatus(ord.status) === 'Chờ xác nhận';

                    return (
                      <div
                        key={ord.id}
                        onClick={() => {
                          onInspectOrder(ord);
                          setIsOpen(false);
                        }}
                        className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group flex items-start justify-between gap-3 relative"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          {/* Row 1: Name + Order Code */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm truncate max-w-[210px]">
                              {ord.name || ord.customerName || 'Khách vãng lai'}
                            </span>
                            <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              #{ord.id?.slice(-6) || 'ORD'}
                            </span>
                          </div>

                          {/* Row 2: Badge + Items + Total */}
                          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${srcConfig.pillClass}`}>
                              {srcConfig.shortLabel}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-slate-700">{itemsCount} món</span>
                            <span>•</span>
                            <span className="font-bold text-emerald-700 text-xs">
                              {totalAmt.toLocaleString('vi-VN')}₫
                            </span>
                          </div>

                          {/* Row 3: Date */}
                          <div className="text-xs text-slate-500 font-medium">
                            {cleanDate}
                          </div>
                        </div>

                        {/* Action Buttons & Delete Button */}
                        <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                          <div className="flex items-center gap-1.5">
                            {isNew && onUpdateOrderStatus && ord.id && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateOrderStatus(ord.id!, 'Đã tiếp nhận');
                                }}
                                className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white font-semibold rounded-lg text-xs border border-sky-200 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Tiếp nhận đơn ngay"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Tiếp nhận</span>
                              </button>
                            )}

                            {/* Nút xóa từng thông báo */}
                            {ord.id && (
                              <button
                                type="button"
                                onClick={(e) => handleDismissOrder(ord.id!, e)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Xóa thông báo này"
                                aria-label="Xóa thông báo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors mr-1" />
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {/* MESSAGES TAB */}
            {activeTab === 'messages' && (
              <>
                {unreadMessages.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-2">
                    <p className="text-sm font-medium text-slate-500">Không có thông báo tin nhắn mới</p>
                    {hasDismissedHistory && (
                      <button
                        type="button"
                        onClick={handleRestoreDismissed}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer"
                      >
                        Khôi phục lại các thông báo đã xóa
                      </button>
                    )}
                  </div>
                ) : (
                  unreadMessages.map((msg) => {
                    const timeText = getTimeAgo(msg.createdAt, msg.timestamp);

                    return (
                      <div
                        key={msg.id}
                        onClick={() => {
                          if (onMarkMessageRead) onMarkMessageRead(msg);
                          onNavigateToMessages();
                          setIsOpen(false);
                        }}
                        className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {msg.name}
                            </span>
                            <span className="text-xs text-slate-500 font-medium ml-auto">
                              {timeText}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 font-medium truncate">
                            {msg.contactInfo || msg.email || msg.phone || 'Chưa để lại liên hệ'}
                          </div>

                          <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                            {msg.message}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0 pt-1">
                          {/* Nút xóa thông báo tin nhắn */}
                          <button
                            type="button"
                            onClick={(e) => handleDismissMessage(msg, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Xóa thông báo tin nhắn này"
                            aria-label="Xóa thông báo tin nhắn"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

          </div>

          {/* Footer View All Link */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-5">
            {activeTab === 'orders' ? (
              <button
                type="button"
                onClick={() => {
                  onNavigateToOrders();
                  setIsOpen(false);
                }}
                className="text-xs text-slate-700 hover:text-slate-950 font-bold hover:underline transition-all inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Xem danh sách đơn hàng ({orders.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onNavigateToMessages();
                  setIsOpen(false);
                }}
                className="text-xs text-slate-700 hover:text-slate-950 font-bold hover:underline transition-all inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Xem tất cả hộp thư ({messages.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            {hasItemsInCurrentTab && (
              <button
                type="button"
                onClick={handleClearCurrentTab}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold hover:underline cursor-pointer"
              >
                Xóa tất cả
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
