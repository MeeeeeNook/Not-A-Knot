import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
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
  
  // Draggable position state (in viewport fixed pixels)
  const [buttonPos, setButtonPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; startPosX: number; startPosY: number }>({
    pointerX: 0,
    pointerY: 0,
    startPosX: 0,
    startPosY: 0,
  });
  const hasMovedRef = useRef(false);

  // Computed Popup Box Position (clamped strictly within viewport, never overlapping button)
  const [popupStyle, setPopupStyle] = useState<{
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
    width: number;
    maxHeight: number;
    transformOrigin: string;
  }>({
    right: 20,
    bottom: 90,
    width: 320,
    maxHeight: 500,
    transformOrigin: 'bottom right'
  });

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
  const zaloUrl = siteContent?.socialLinks?.zalo || `https://zalo.me/${cleanPhone || '0342938174'}`;

  // Initialize button position on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.innerWidth < 640;
    const bSize = isMobile ? 48 : 56;
    const rightMargin = isMobile ? 14 : 24;
    const bottomMargin = isProductDetail ? 84 : (isMobile ? 18 : 24);

    const initialX = window.innerWidth - bSize - rightMargin;
    const initialY = window.innerHeight - bSize - bottomMargin;
    setButtonPos({ x: initialX, y: initialY });
  }, [isProductDetail]);

  // Adjust button position if window resizes so it never stays outside bounds
  useEffect(() => {
    const handleResize = () => {
      setButtonPos((prev) => {
        if (!prev) return prev;
        const bSize = window.innerWidth < 640 ? 48 : 56;
        const clampedX = Math.max(12, Math.min(window.innerWidth - bSize - 12, prev.x));
        const clampedY = Math.max(70, Math.min(window.innerHeight - bSize - 16, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute smart popup placement: NEVER covers the button and NEVER exceeds screen bounds
  const recalculatePopupPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const bSize = vw < 640 ? 48 : 56;
    const curX = buttonPos?.x ?? (vw - bSize - 20);
    const curY = buttonPos?.y ?? (vh - bSize - 20);

    const cardWidth = Math.min(340, vw - 28);

    // 1. Horizontal placement: align with button without going offscreen
    let left: number | undefined = undefined;
    let right: number | undefined = undefined;
    let horizontalOrigin: 'left' | 'right';

    if (curX < vw / 2) {
      // Button is on left half: align card with button left edge, expanding rightward
      left = Math.max(14, Math.min(curX, vw - cardWidth - 14));
      horizontalOrigin = 'left';
    } else {
      // Button is on right half: align card with button right edge, expanding leftward
      right = Math.max(14, Math.min(vw - (curX + bSize), vw - cardWidth - 14));
      horizontalOrigin = 'right';
    }

    // 2. Vertical placement: Open ABOVE if space permits, else BELOW (always with 10px safe gap)
    let top: number | undefined = undefined;
    let bottom: number | undefined = undefined;
    let verticalOrigin: 'top' | 'bottom';
    let cardMaxHeight: number;

    const spaceAbove = curY - 70; // Clearance from top header
    const spaceBelow = vh - (curY + bSize) - 16;

    if (spaceAbove >= 300 || spaceAbove >= spaceBelow) {
      // Open ABOVE button: anchor bottom edge 10px above button top edge
      bottom = Math.max(16, vh - curY + 10);
      cardMaxHeight = Math.max(260, Math.min(520, curY - 76));
      verticalOrigin = 'bottom';
    } else {
      // Open BELOW button: anchor top edge 10px below button bottom edge
      top = Math.max(70, curY + bSize + 10);
      cardMaxHeight = Math.max(260, Math.min(520, vh - (curY + bSize) - 20));
      verticalOrigin = 'top';
    }

    setPopupStyle({
      left,
      right,
      top,
      bottom,
      width: cardWidth,
      maxHeight: cardMaxHeight,
      transformOrigin: `${verticalOrigin} ${horizontalOrigin}`
    });
  }, [buttonPos]);

  useLayoutEffect(() => {
    if (isOpen) {
      recalculatePopupPosition();
    }
  }, [isOpen, recalculatePopupPosition]);

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
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Pre-fill message if order code provided
  useEffect(() => {
    if (currentOrderCode && !message) {
      setMessage(`Chào shop, mình cần tư vấn/hỗ trợ về đơn hàng #${currentOrderCode}`);
    }
  }, [currentOrderCode]);

  // Drag Handlers for pointer (mouse + touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isOpen) return; // Don't drag while popup is open
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startPosX: buttonPos?.x ?? (window.innerWidth - 70),
      startPosY: buttonPos?.y ?? (window.innerHeight - 70),
    };
    hasMovedRef.current = false;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.pointerX;
    const deltaY = e.clientY - dragStartRef.current.pointerY;

    if (Math.hypot(deltaX, deltaY) > 5) {
      hasMovedRef.current = true;
    }

    const bSize = window.innerWidth < 640 ? 48 : 56;
    const newX = dragStartRef.current.startPosX + deltaX;
    const newY = dragStartRef.current.startPosY + deltaY;

    // Strict clamp so button NEVER escapes screen borders
    const clampedX = Math.max(12, Math.min(window.innerWidth - bSize - 12, newX));
    const clampedY = Math.max(70, Math.min(window.innerHeight - bSize - 16, newY));

    setButtonPos({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    // If it was just a tap/click without significant move, toggle open
    if (!hasMovedRef.current) {
      setIsOpen((prev) => !prev);
    }
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

  return (
    <>
      {/* 1. EXPANDED POPUP CARD (Never covers the floating button) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popupRef}
            id="floating-chat-card"
            initial={{ opacity: 0, scale: 0.9, y: popupStyle.bottom !== undefined ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: popupStyle.bottom !== undefined ? 6 : -6 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            style={{
              position: 'fixed',
              left: popupStyle.left !== undefined ? `${popupStyle.left}px` : undefined,
              right: popupStyle.right !== undefined ? `${popupStyle.right}px` : undefined,
              top: popupStyle.top !== undefined ? `${popupStyle.top}px` : undefined,
              bottom: popupStyle.bottom !== undefined ? `${popupStyle.bottom}px` : undefined,
              width: `${popupStyle.width}px`,
              maxHeight: `${popupStyle.maxHeight}px`,
              transformOrigin: popupStyle.transformOrigin,
              zIndex: 60,
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
            <div className="p-4 bg-white overflow-y-auto flex-1">
              <AnimatePresence mode="wait">
                {activeTab === 'options' ? (
                  <motion.div
                    key="tab-options"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2.5"
                  >
                    {/* Option 1: Chat qua Messenger */}
                    <a
                      href={messengerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackGA4Contact('messenger', 'Floating Chat Messenger')}
                      className="w-full py-2.5 px-3.5 rounded-2xl bg-[#1d5ec9] hover:bg-[#164da7] active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                      <span>Chat qua Messenger</span>
                    </a>

                    {/* Option 2: Zalo Chat / Hotline */}
                    {cleanPhone && (
                      <a
                        href={zaloUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackGA4Contact('zalo', 'Floating Chat Zalo')}
                        className="w-full py-2.5 px-3.5 rounded-2xl bg-[#0068FF] hover:bg-[#0055D4] active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                      >
                        <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                        <span>Chat Zalo ({hotline})</span>
                      </a>
                    )}

                    {/* Option 3: Xem trang Facebook */}
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackGA4Contact('facebook', 'Floating Chat Facebook')}
                      className="w-full py-2.5 px-3.5 rounded-2xl bg-white hover:bg-slate-50 active:scale-98 text-slate-800 font-bold text-xs sm:text-sm border-2 border-slate-200 hover:border-slate-300 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                    >
                      <Facebook className="w-4 h-4 sm:w-5 sm:h-5 text-[#1d5ec9] shrink-0" />
                      <span>Xem trang Facebook</span>
                    </a>

                    {/* Quick Switch to message form */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('leave-message')}
                      className="w-full pt-1.5 text-center text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>Hoặc gửi lời nhắn để xưởng gọi lại</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="tab-message"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {isSubmitted ? (
                      <div className="text-center py-4 space-y-2.5">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900">Đã gửi tin nhắn đến shop!</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Tụi mình sẽ phản hồi sớm nhất qua SĐT của bạn nhé.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsSubmitted(false)}
                          className="mt-1 px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Gửi lời nhắn khác
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSendMessage} className="space-y-2 text-xs">
                        <div>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Tên của bạn..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-hidden focus:border-slate-900"
                          />
                        </div>

                        <div>
                          <input
                            type="text"
                            required
                            value={contactInfo}
                            onChange={(e) => setContactInfo(e.target.value)}
                            placeholder="Số điện thoại liên hệ..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-hidden focus:border-slate-900"
                          />
                        </div>

                        <div>
                          <textarea
                            required
                            rows={2}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Nội dung cần tư vấn..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-900 focus:outline-hidden focus:border-slate-900 resize-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-2.5 rounded-xl bg-[#1d5ec9] hover:bg-[#164da7] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                        >
                          {isSubmitting ? (
                            <span>Đang gửi...</span>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5 text-white" />
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

      {/* 2. DRAGGABLE FLOATING CHAT BUBBLE BUTTON */}
      {buttonPos && (
        <div
          style={{
            position: 'fixed',
            left: `${buttonPos.x}px`,
            top: `${buttonPos.y}px`,
            zIndex: 55,
            touchAction: 'none',
          }}
          className="select-none flex flex-col items-center group"
        >
          {/* Subtle drag hint tooltip on hover */}
          {!isOpen && (
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
      )}
    </>
  );
};
