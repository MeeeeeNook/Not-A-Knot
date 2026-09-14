import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, 
  MailCheck, 
  Trash2, 
  RefreshCw, 
  Search, 
  X, 
  Copy, 
  Check, 
  Phone, 
  Clock, 
  Inbox, 
  MessageSquare, 
  AlertCircle, 
  ChevronRight,
  Send,
  ExternalLink
} from 'lucide-react';
import { ContactMessage } from '../types';
import {
  fetchContactMessagesFromFirestore,
  updateContactMessageStatusInFirestore,
  deleteContactMessageFromFirestore
} from '../firebase';

interface AdminMessagesManagerProps {
  onNotify?: (msg: string) => void;
  onUpdateUnreadCount?: (count: number) => void;
}

export const AdminMessagesManager: React.FC<AdminMessagesManagerProps> = ({ onNotify, onUpdateUnreadCount }) => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<ContactMessage | null>(null);

  const showToast = (text: string) => {
    setToastMessage(text);
    if (onNotify) onNotify(text);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const syncUnreadCount = (list: ContactMessage[]) => {
    const unread = list.filter((m) => !m.isRead).length;
    if (onUpdateUnreadCount) {
      onUpdateUnreadCount(unread);
    }
  };

  const loadMessages = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchContactMessagesFromFirestore();
      setMessages(data);
      syncUnreadCount(data);
      if (selectedMessage) {
        const found = data.find((m) => m.id === selectedMessage.id);
        if (found) setSelectedMessage(found);
      }
    } catch (err) {
      console.warn('Lỗi tải tin nhắn:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Đã sao chép vào bộ nhớ tạm');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleRead = async (msg: ContactMessage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = !msg.isRead;
    const updated = messages.map((m) =>
      m.id === msg.id ? { ...m, isRead: newStatus, status: newStatus ? ('read' as const) : ('unread' as const) } : m
    );
    setMessages(updated);
    syncUnreadCount(updated);
    if (selectedMessage?.id === msg.id) {
      setSelectedMessage({ ...selectedMessage, isRead: newStatus, status: newStatus ? 'read' : 'unread' });
    }
    await updateContactMessageStatusInFirestore(msg.id, newStatus);
    showToast(newStatus ? 'Đã đánh dấu đã đọc' : 'Đã đánh dấu chưa đọc');
  };

  const handlePromptDelete = (msg: ContactMessage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMessageToDelete(msg);
  };

  const handleConfirmDelete = async () => {
    if (!messageToDelete) return;
    const id = messageToDelete.id;
    const updated = messages.filter((m) => m.id !== id);
    setMessages(updated);
    syncUnreadCount(updated);
    if (selectedMessage?.id === id) {
      setSelectedMessage(null);
      setIsMobileDetailOpen(false);
    }
    setMessageToDelete(null);
    try {
      await deleteContactMessageFromFirestore(id);
      showToast('Đã xóa thư liên hệ thành công');
    } catch (err) {
      console.warn('Lỗi xóa Firestore message:', err);
      showToast('Đã xóa thư khỏi danh sách');
    }
  };

  const handleSelectMessage = (msg: ContactMessage) => {
    setSelectedMessage(msg);
    setIsMobileDetailOpen(true);
    if (!msg.isRead) {
      handleToggleRead(msg);
    }
  };

  const unreadCount = useMemo(() => {
    return messages.filter((m) => !m.isRead).length;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (filterTab === 'unread' && msg.isRead) return false;
      if (filterTab === 'read' && !msg.isRead) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = msg.name?.toLowerCase().includes(q);
        const matchContact = msg.contactInfo?.toLowerCase().includes(q) || msg.email?.toLowerCase().includes(q) || msg.phone?.toLowerCase().includes(q);
        const matchMessage = msg.message?.toLowerCase().includes(q);
        return matchName || matchContact || matchMessage;
      }
      return true;
    });
  }, [messages, filterTab, searchQuery]);

  const getInitials = (name?: string) => {
    if (!name || !name.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const isPhoneNumber = (val?: string) => {
    if (!val) return false;
    const clean = val.replace(/[\s\-\+\(\)\.]/g, '');
    return /^[0-9]{8,15}$/.test(clean);
  };

  return (
    <div id="admin-messages-manager-container" className="space-y-4 sm:space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner - Streamlined and clean */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Tin Nhắn & Liên Hệ
              </h3>
              {unreadCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-black animate-pulse">
                  {unreadCount} mới
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                  Tất cả đã đọc
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Xem và xử lý tin nhắn từ biểu mẫu liên hệ của khách hàng.
            </p>
          </div>
        </div>

        <button
          onClick={loadMessages}
          disabled={isRefreshing}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
          <span>{isRefreshing ? 'Đang tải lại...' : 'Làm mới'}</span>
        </button>
      </div>

      {/* Main Grid: Left List (7 Cols) & Right Detail View (5 Cols on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Filter Tabs, Search & Message Cards */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          
          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl">
              {[
                { id: 'all', label: 'Tất cả', count: messages.length },
                { id: 'unread', label: 'Chưa đọc', count: unreadCount },
                { id: 'read', label: 'Đã đọc', count: messages.length - unreadCount },
              ].map((t) => {
                const isActive = filterTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setFilterTab(t.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive 
                        ? (t.id === 'unread' && unreadCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-800')
                        : 'bg-slate-200/70 text-slate-500'
                    }`}>
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên, email, sđt, tin nhắn..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Messages List */}
          {isLoading ? (
            <div className="py-16 text-center space-y-2 text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-500" />
              <p>Đang tải danh sách tin nhắn...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="py-14 px-4 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Chưa có tin nhắn nào</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                {searchQuery
                  ? 'Không tìm thấy tin nhắn nào khớp với từ khóa tìm kiếm.'
                  : 'Hộp thư hiện đang trống. Tin nhắn gửi từ form liên hệ sẽ xuất hiện tại đây.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
              {filteredMessages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                const dateObj = new Date(msg.createdAt || msg.timestamp);
                const formattedDate = dateObj.toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const contactStr = msg.contactInfo || msg.email || msg.phone || '';
                const isPhone = isPhoneNumber(contactStr);

                return (
                  <div
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg)}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-amber-50/80 border-amber-400 shadow-sm ring-2 ring-amber-400/20'
                        : !msg.isRead
                        ? 'bg-amber-50/20 border-amber-200 hover:border-amber-300 hover:bg-amber-50/40 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                    }`}
                  >
                    {/* Row 1: Avatar + Name + New Badge + Time */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none ${
                          !msg.isRead
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {getInitials(msg.name)}
                        </div>

                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                            {msg.name || 'Khách hàng ẩn danh'}
                          </h4>
                          {!msg.isRead && (
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider shadow-2xs">
                              MỚI
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 shrink-0 whitespace-nowrap">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>

                    {/* Row 2: Contact Info with Icons and Quick Copy */}
                    {contactStr && (
                      <div className="flex items-center gap-1.5 text-xs mb-2">
                        {isPhone ? (
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Mail className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-700 font-mono text-[11px] sm:text-xs truncate">
                          {contactStr}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(contactStr, msg.id);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Sao chép thông tin liên hệ"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Row 3: Message Text Snippet in Soft Bubble */}
                    <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100/90 text-xs text-slate-600 leading-relaxed line-clamp-2 mb-3">
                      {msg.message || 'Không có nội dung tin nhắn.'}
                    </div>

                    {/* Row 4: Card Footer Actions */}
                    <div 
                      className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectMessage(msg)}
                        className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Chi tiết</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleToggleRead(msg, e)}
                          className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                            msg.isRead
                              ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                          }`}
                        >
                          {msg.isRead ? (
                            <>
                              <Mail className="w-3 h-3" />
                              <span>Chưa đọc</span>
                            </>
                          ) : (
                            <>
                              <MailCheck className="w-3 h-3 text-amber-700" />
                              <span>Đã đọc</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handlePromptDelete(msg, e)}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all flex items-center gap-1 cursor-pointer"
                          title="Xóa tin nhắn"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Desktop Sticky Detail View (Hidden on mobile) */}
        <div className="hidden lg:block lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 sticky top-20">
          {selectedMessage ? (
            <div className="space-y-4">
              {/* Detail Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white ${
                    !selectedMessage.isRead ? 'bg-amber-500' : 'bg-slate-700'
                  }`}>
                    {getInitials(selectedMessage.name)}
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Chi Tiết Tin Nhắn
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900">
                      {selectedMessage.name}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleRead(selectedMessage)}
                    className="px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    {selectedMessage.isRead ? 'Đánh dấu chưa đọc' : 'Đã đọc'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptDelete(selectedMessage)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Xóa thư"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sender Info Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Khách hàng:</span>
                  <span className="font-bold text-slate-900">{selectedMessage.name}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Liên hệ:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 font-mono">
                      {selectedMessage.contactInfo || selectedMessage.email || selectedMessage.phone || 'Chưa cung cấp'}
                    </span>
                    {(selectedMessage.contactInfo || selectedMessage.email || selectedMessage.phone) && (
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedMessage.contactInfo || selectedMessage.email || selectedMessage.phone || '', selectedMessage.id)}
                        className="px-1.5 py-0.5 text-[10px] font-bold bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {copiedId === selectedMessage.id ? 'Đã chép' : 'Chép'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Thời gian:</span>
                  <span className="font-medium text-slate-700">
                    {new Date(selectedMessage.createdAt || selectedMessage.timestamp).toLocaleString('vi-VN')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Trạng thái:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    selectedMessage.isRead 
                      ? 'bg-slate-200 text-slate-700' 
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    {selectedMessage.isRead ? 'Đã đọc' : 'Chưa đọc (MỚI)'}
                  </span>
                </div>
              </div>

              {/* Action shortcuts if phone or email */}
              {(selectedMessage.phone || selectedMessage.email || selectedMessage.contactInfo) && (
                <div className="flex items-center gap-2">
                  {isPhoneNumber(selectedMessage.phone || selectedMessage.contactInfo) && (
                    <a
                      href={`tel:${(selectedMessage.phone || selectedMessage.contactInfo || '').replace(/\s+/g, '')}`}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Gọi điện</span>
                    </a>
                  )}
                  {(selectedMessage.email || selectedMessage.contactInfo?.includes('@')) && (
                    <a
                      href={`mailto:${selectedMessage.email || selectedMessage.contactInfo}`}
                      className="flex-1 py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Gửi email</span>
                    </a>
                  )}
                </div>
              )}

              {/* Message Content */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Nội Dung Tin Nhắn:
                </label>
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 text-xs sm:text-sm text-slate-900 leading-relaxed whitespace-pre-wrap min-h-[160px] select-text">
                  {selectedMessage.message}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center space-y-2 text-slate-400 text-xs">
              <MessageSquare className="w-10 h-10 text-slate-200 mx-auto" />
              <p className="font-bold text-slate-700">Chưa chọn tin nhắn</p>
              <p className="text-slate-400">Chọn một tin nhắn ở danh sách bên trái để xem đầy đủ nội dung.</p>
            </div>
          )}
        </div>

      </div>

      {/* MOBILE FULL MESSAGE DETAIL MODAL */}
      {isMobileDetailOpen && selectedMessage && (
        <div className="fixed inset-0 z-50 lg:hidden flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col animate-slideUp">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white ${
                  !selectedMessage.isRead ? 'bg-amber-500' : 'bg-slate-700'
                }`}>
                  {getInitials(selectedMessage.name)}
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 truncate">
                    {selectedMessage.name}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {new Date(selectedMessage.createdAt || selectedMessage.timestamp).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileDetailOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto py-3 space-y-3 flex-1">
              {/* Contact info info box */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Liên hệ:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {selectedMessage.contactInfo || selectedMessage.email || selectedMessage.phone || 'Chưa cung cấp'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Trạng thái:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    selectedMessage.isRead 
                      ? 'bg-slate-200 text-slate-700' 
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    {selectedMessage.isRead ? 'Đã đọc' : 'Chưa đọc'}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Call, Email, Copy */}
              <div className="flex items-center gap-2">
                {isPhoneNumber(selectedMessage.phone || selectedMessage.contactInfo) && (
                  <a
                    href={`tel:${(selectedMessage.phone || selectedMessage.contactInfo || '').replace(/\s+/g, '')}`}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Gọi điện</span>
                  </a>
                )}
                {(selectedMessage.email || selectedMessage.contactInfo?.includes('@')) && (
                  <a
                    href={`mailto:${selectedMessage.email || selectedMessage.contactInfo}`}
                    className="flex-1 py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Gửi email</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleCopy(selectedMessage.contactInfo || selectedMessage.email || selectedMessage.phone || '', selectedMessage.id)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedId === selectedMessage.id ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>

              {/* Message text */}
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Nội Dung Tin Nhắn:
                </label>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 leading-relaxed whitespace-pre-wrap select-text">
                  {selectedMessage.message}
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleRead(selectedMessage)}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                {selectedMessage.isRead ? <Mail className="w-3.5 h-3.5" /> : <MailCheck className="w-3.5 h-3.5" />}
                <span>{selectedMessage.isRead ? 'Đánh dấu chưa đọc' : 'Đã đọc'}</span>
              </button>

              <button
                type="button"
                onClick={() => handlePromptDelete(selectedMessage)}
                className="py-2 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-200 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Xóa</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {messageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 font-bold">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Xác nhận xóa thư</h4>
                <p className="text-xs text-slate-500">Tin nhắn của "{messageToDelete.name}"</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              Bạn có chắc chắn muốn xóa tin nhắn này khỏi hệ thống? Dữ liệu đã xóa sẽ không thể khôi phục.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMessageToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
