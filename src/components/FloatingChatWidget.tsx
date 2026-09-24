import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, 
  X, 
  Facebook, 
  Send, 
  CheckCircle2, 
  ArrowRight,
  PhoneCall,
  GripHorizontal
} from 'lucide-react';
import { SiteContentConfig, ContactMessage } from '../types';
import { saveContactMessageToFirestore } from '../firebase';
import { trackGA4Contact } from '../utils/analytics';

interface FloatingChatWidgetProps {
  siteContent?: SiteContentConfig;
  currentOrderCode?: string;
  isProductDetail?: boolean;
}

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({
  siteContent,
  currentOrderCode,
  isProductDetail = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'options' | 'leave-message'>('options');

  // Relative Position from bottom-right of viewport (in pixels)
  // This guarantees the button NEVER drifts to center upon window resize
  const [position, setPosition] = useState<{ right: number; bottom: number }>(() => ({
    right: typeof window !== 'undefined' && window.innerWidth < 640 ? 16 : 24,
    bottom: typeof window !== 'undefined'
      ? (isProductDetail ? (window.innerWidth < 640 ? 84 : 24) : (window.innerWidth < 640 ? 20 : 24))
      : 24
  }));

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startRight: number;
    startBottom: number;
  }>({
    pointerX: 0,
    pointerY: 0,
    startRight: 24,
    startBottom: 24,
  });
  const hasMovedRef = useRef(false);

  // Message Form State
  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const brandName = siteContent?.brandName || 'NOT A KNOT';
  const messengerUrl = siteContent?.socialLinks?.messenger || 'https://m.me/61593591390851';
  const facebookUrl = siteContent?.socialLinks?.facebook || 'https://www.facebook.com/profile.php?id=61593591390851';
  const hotline = siteContent?.hotline || '0342 938 174';
  const cleanPhone = hotline.replace(/[^0-9]/g, '');
  const zaloUrl = siteContent?.socialLinks?.zalo || (cleanPhone ? `https://zalo.me/${cleanPhone}` : 'https://zalo.me/0342938174');

  // Keep button within screen bounds on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxRight = Math.max(12, window.innerWidth - 68);
        const maxBottom = Math.max(16, window.innerHeight - 68);
        return {
          right: Math.min(prev.right, maxRight),
          bottom: Math.min(prev.bottom, maxBottom),
        };
      });
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for image zoom modal events to hide chat bubble when viewing zoomed images
  useEffect(() => {
    const handleZoomOpened = () => setIsZoomModalOpen(true);
    const handleZoomClosed = () => setIsZoomModalOpen(false);

    window.addEventListener('nak-image-zoom-opened', handleZoomOpened);
    window.addEventListener('nak-image-zoom-closed', handleZoomClosed);
    return () => {
      window.removeEventListener('nak-image-zoom-opened', handleZoomOpened);
      window.removeEventListener('nak-image-zoom-closed', handleZoomClosed);
    };
  }, []);

  // Listen for global open chat event
  useEffect(() => {
    const handleOpenChat = () => setIsOpen(true);
    window.addEventListener('open-chat-widget', handleOpenChat);
    return () => window.removeEventListener('open-chat-widget', handleOpenChat);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        isOpen && 
        popupRef.current && 
        !popupRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // DRAG LOGIC (Relative to screen edges)
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    hasMovedRef.current = false;
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startRight: position.right,
      startBottom: position.bottom,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

    const deltaX = e.clientX - dragStartRef.current.pointerX; // Moving right means deltaX > 0, decreasing distance from right edge
    const deltaY = e.clientY - dragStartRef.current.pointerY; // Moving down means deltaY > 0, decreasing distance from bottom edge

    if (!hasMovedRef.current && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
      hasMovedRef.current = true;
      setIsDragging(true);
    }

    if (hasMovedRef.current) {
      const maxRight = Math.max(12, window.innerWidth - 68);
      const maxBottom = Math.max(16, window.innerHeight - 68);

      const newRight = Math.max(12, Math.min(maxRight, dragStartRef.current.startRight - deltaX));
      const newBottom = Math.max(16, Math.min(maxBottom, dragStartRef.current.startBottom - deltaY));

      setPosition({ right: newRight, bottom: newBottom });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (!hasMovedRef.current) {
      // Clean click - toggle open/close
      setIsOpen((prev) => !prev);
    }
    setIsDragging(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contactInfo.trim() || !message.trim()) {
      return;
    }

    setIsSubmitting(true);
    const newMsg: ContactMessage = {
      id: `msg-${Date.now()}`,
      name: name.trim(),
      contactInfo: contactInfo.trim(),
      email: contactInfo.includes('@') ? contactInfo.trim() : undefined,
      phone: /^[0-9+ ]+$/.test(contactInfo.trim()) ? contactInfo.trim() : undefined,
      message: currentOrderCode ? `[Mã đơn: ${currentOrderCode}] ${message.trim()}` : message.trim(),
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      isRead: false,
      status: 'unread'
    };

    try {
      await saveContactMessageToFirestore(newMsg);
      trackGA4Contact('contact_form', 'Gửi lời nhắn hỗ trợ');
      setIsSubmitted(true);
      setName('');
      setContactInfo('');
      setMessage('');
    } catch (err) {
      console.warn('Lỗi gửi tin nhắn:', err);
      trackGA4Contact('contact_form', 'Gửi lời nhắn hỗ trợ (thử lại)');
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isZoomModalOpen) return null;

  // Compute popup box position relative to the floating button
  const popupWidth = typeof window !== 'undefined' ? (window.innerWidth < 640 ? window.innerWidth - 32 : 350) : 350;
  const clampedPopupRight = typeof window !== 'undefined' 
    ? Math.max(12, Math.min(window.innerWidth - popupWidth - 12, position.right))
    : 24;
  const popupBottom = position.bottom + 64;

  return (
    <>
      {/* 1. EXPANDED POPUP CARD (Anchored relative to screen edges & bubble button, z-35 so modals at z-50 overlay it) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popupRef}
            id="floating-chat-card"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            style={{
              position: 'fixed',
              right: `${clampedPopupRight}px`,
              bottom: `${popupBottom}px`,
              width: `${popupWidth}px`,
              maxHeight: typeof window !== 'undefined' ? `${Math.max(300, window.innerHeight - popupBottom - 20)}px` : '75vh',
              transformOrigin: 'bottom right',
              zIndex: 35,
            }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col font-sans select-none"
          >
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200/90 p-4 sm:p-5 rounded-t-3xl relative shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>{brandName} xin chào!</span>
                  <span className="text-base">👋</span>
                </h3>

                {/* Close Button Inside Header */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
                  title="Đóng cửa sổ"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
                Cần tư vấn mẫu, đặt hàng hay pre-order? Nhắn tụi mình nhé.
              </p>

              {/* Light Mode Switch Tabs */}
              <div className="flex items-center gap-1 mt-3.5 p-1 bg-slate-200/60 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setActiveTab('options'); setIsSubmitted(false); }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                    activeTab === 'options'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kênh Trò Chuyện
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('leave-message'); setIsSubmitted(false); }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                    activeTab === 'leave-message'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Để Lại Lời Nhắn
                </button>
              </div>
            </div>

            {/* Content Body with Scroll if needed */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              <AnimatePresence mode="wait">
                {activeTab === 'options' ? (
                  <motion.div
                    key="tab-options"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2.5"
                  >
                    {/* Option 1: Chat Zalo */}
                    <a
                      href={zaloUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackGA4Contact('zalo', 'Floating Chat Zalo')}
                      className="flex items-center justify-between p-3 rounded-2xl bg-sky-50 hover:bg-sky-100/90 text-sky-950 border border-sky-200 transition-all font-bold text-xs sm:text-sm group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#0068FF] text-white flex items-center justify-center font-black text-xs shadow-xs">
                          Zalo
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold">Chat qua Zalo</div>
                          <div className="text-[11px] font-normal text-sky-700">{hotline}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-sky-700 group-hover:translate-x-1 transition-transform" />
                    </a>

                    {/* Option 2: Chat qua Messenger */}
                    <a
                      href={messengerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackGA4Contact('messenger', 'Floating Chat Messenger')}
                      className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/80 hover:bg-blue-100/90 text-blue-900 border border-blue-200 transition-all font-bold text-xs sm:text-sm group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#0084FF] text-white flex items-center justify-center shadow-xs">
                          <MessageCircle className="w-4 h-4 fill-current" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold">Chat qua Messenger</div>
                          <div className="text-[11px] font-normal text-blue-700">Facebook Direct Message</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-700 group-hover:translate-x-1 transition-transform" />
                    </a>

                    {/* Option 3: Facebook Fanpage */}
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackGA4Contact('facebook', 'Floating Chat Facebook')}
                      className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-950 border border-indigo-200 transition-all font-bold text-xs sm:text-sm group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shadow-xs">
                          <Facebook className="w-4 h-4 fill-current" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold">Trang Facebook</div>
                          <div className="text-[11px] font-normal text-indigo-700">Xem tin bài & bài đăng mới</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-indigo-700 group-hover:translate-x-1 transition-transform" />
                    </a>

                    {/* Hotline Direct Call */}
                    <a
                      href={`tel:${cleanPhone || '0342938174'}`}
                      onClick={() => trackGA4Contact('hotline', 'Floating Chat Hotline')}
                      className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-950 border border-emerald-200 transition-all font-bold text-xs sm:text-sm group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <PhoneCall className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold">Gọi Hotline Trực Tiếp</div>
                          <div className="text-[11px] font-normal text-emerald-700">{hotline}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-emerald-700 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </motion.div>
                ) : (
                  <motion.div
                    key="tab-message"
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    {isSubmitted ? (
                      <div className="py-6 px-3 text-center space-y-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 animate-fadeIn">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-2xs">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-900">Đã Nhận Lời Nhắn!</h4>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                          Cảm ơn bạn! Đội ngũ {brandName} sẽ phản hồi qua thông tin liên hệ của bạn trong thời gian sớm nhất.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsSubmitted(false)}
                          className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
                        >
                          Gửi lời nhắn khác
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSendMessage} className="space-y-3 text-left">
                        {currentOrderCode && (
                          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-900 flex items-center justify-between">
                            <span>Đang hỗ trợ đơn hàng:</span>
                            <span className="font-mono text-xs">{currentOrderCode}</span>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Tên của bạn *
                          </label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ví dụ: Linh Chi"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            SĐT hoặc Link Facebook / Zalo *
                          </label>
                          <input
                            type="text"
                            required
                            value={contactInfo}
                            onChange={(e) => setContactInfo(e.target.value)}
                            placeholder="0912... hoặc fb.com/..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Nội dung cần hỗ trợ *
                          </label>
                          <textarea
                            required
                            rows={3}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Mô tả yêu cầu cần tư vấn, đổi mẫu hoặc đặt làm riêng..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800 focus:bg-white resize-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                          {isSubmitting ? (
                            <span>Đang gửi...</span>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Gửi Lời Nhắn</span>
                            </>
                          )}
                        </button>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. DRAGGABLE FLOATING CHAT BUBBLE BUTTON (Relative to screen edges, z-30) */}
      <div
        style={{
          position: 'fixed',
          right: `${position.right}px`,
          bottom: `${position.bottom}px`,
          zIndex: 30,
          touchAction: 'none',
        }}
        className="select-none flex flex-col items-center group"
      >
        {/* Drag Hint Tooltip on hover */}
        {!isOpen && !isDragging && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none mb-1 text-[10px] font-medium bg-slate-900/80 text-white px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 shadow-sm">
            <GripHorizontal className="w-3 h-3" />
            <span>Kéo để dời vị trí</span>
          </div>
        )}

        <motion.button
          ref={buttonRef}
          type="button"
          id="btn-toggle-floating-chat"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="Mở menu tư vấn trực tiếp"
          title="Bấm để tư vấn | Giữ & kéo để dời vị trí nếu che nút khác"
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-xl flex items-center justify-center transition-colors bg-[#1d5ec9] hover:bg-[#164da7] active:bg-[#124294] text-white shadow-blue-500/40 border-2 border-white/20 touch-none ${
            isDragging ? 'cursor-grabbing scale-105 shadow-2xl' : 'cursor-grab'
          }`}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close-icon"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <X className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="chat-icon"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <MessageCircle className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </>
  );
};
