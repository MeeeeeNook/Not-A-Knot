import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, 
  X, 
  Facebook, 
  Send, 
  CheckCircle2, 
  ArrowRight
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
  // STRICT REQUIREMENT: Does NOT auto-open until user clicks
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'options' | 'leave-message'>('options');
  
  // Draggable state handling
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Message Form State
  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const brandName = siteContent?.brandName || 'NOT A KNOT';
  const messengerUrl = siteContent?.socialLinks?.messenger || 'https://m.me/61593591390851';
  const facebookUrl = siteContent?.socialLinks?.facebook || 'https://www.facebook.com/profile.php?id=61593591390851';
  const hotline = siteContent?.hotline || '0342 938 174';
  const cleanPhone = hotline.replace(/[^0-9]/g, '');
  const zaloUrl = siteContent?.socialLinks?.zalo || `https://zalo.me/${cleanPhone || '0342938174'}`;

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

  // Close on outside click when open
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Pre-fill message if order code provided
  useEffect(() => {
    if (currentOrderCode && !message) {
      setMessage(`Chào shop, mình cần tư vấn/hỗ trợ về đơn hàng #${currentOrderCode}`);
    }
  }, [currentOrderCode]);

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

  return (
    <motion.div 
      ref={containerRef}
      id="floating-chat-widget-root"
      drag
      dragMomentum={false}
      dragElastic={0.08}
      onDragStart={(_, info) => {
        dragStartPoint.current = { x: info.point.x, y: info.point.y };
        setIsDragging(true);
      }}
      onDragEnd={(_, info) => {
        const dist = Math.hypot(info.point.x - dragStartPoint.current.x, info.point.y - dragStartPoint.current.y);
        if (dist > 6) {
          setTimeout(() => setIsDragging(false), 120);
        } else {
          setIsDragging(false);
        }
      }}
      className={`fixed z-50 flex flex-col items-end pointer-events-auto select-none font-sans ${
        isZoomModalOpen ? 'hidden opacity-0 pointer-events-none' : ''
      } ${
        isProductDetail 
          ? 'bottom-[84px] right-3 sm:bottom-6 sm:right-6' 
          : 'bottom-4 right-4 sm:bottom-6 sm:right-6'
      }`}
    >
      {/* 1. EXPANDED POPUP CARD (Light Mode Pure Design with Smooth Animation) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="floating-chat-card"
            initial={{ opacity: 0, scale: 0.85, y: 18, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 14 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-[calc(100vw-2rem)] sm:w-80 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden mb-3.5"
          >
            {/* Header: Pure Light Mode Design (No dark gradients, no NO letters) */}
            <div className="bg-slate-50 border-b border-slate-200/90 p-4 sm:p-5 rounded-t-3xl relative">
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

            {/* Content Body */}
            <div className="p-4 bg-white">
              <AnimatePresence mode="wait">
                {activeTab === 'options' ? (
                  <motion.div
                    key="tab-options"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2.5"
                  >
                    {/* Option 1: Chat qua Messenger */}
                    <a
                      href={messengerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackGA4Contact('messenger', 'Floating Chat Messenger')}
                      className="w-full py-3 px-4 rounded-2xl bg-[#1d5ec9] hover:bg-[#164da7] active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>Chat qua Messenger</span>
                    </a>

                    {/* Option 2: Xem trang Facebook */}
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackGA4Contact('facebook', 'Floating Chat Facebook')}
                      className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-98 text-slate-800 font-bold text-sm border-2 border-slate-300 hover:border-slate-400 flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-2xs"
                    >
                      <Facebook className="w-5 h-5 text-[#1d5ec9]" />
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
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    {isSubmitted ? (
                      <div className="text-center py-5 space-y-2.5">
                        <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900">Đã gửi tin nhắn đến shop!</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Tụi mình sẽ phản hồi sớm nhất qua SĐT của bạn nhé.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsSubmitted(false)}
                          className="mt-2 px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Gửi lời nhắn khác
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSendMessage} className="space-y-2.5 text-xs">
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

      {/* 2. CIRCULAR FLOATING CHAT BUBBLE BUTTON WITH DRAG & CLICK */}
      <motion.button
        type="button"
        id="btn-toggle-floating-chat"
        onClick={() => {
          if (!isDragging) {
            setIsOpen(!isOpen);
          }
        }}
        aria-label="Mở menu tư vấn trực tiếp"
        title="Bấm để tư vấn | Giữ & kéo để di chuyển vị trí bong bóng chat"
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.05 }}
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-xl flex items-center justify-center transition-colors bg-[#1d5ec9] hover:bg-[#164da7] active:bg-[#124294] text-white shadow-blue-500/40 cursor-grab active:cursor-grabbing border-2 border-white/20"
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
    </motion.div>
  );
};
