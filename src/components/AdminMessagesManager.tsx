import React, { useState, useEffect, useMemo } from 'react';
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
    showToast('Đã sao chép');
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

  return (
    <div id="admin-messages-manager-container" className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 text-xs font-semibold">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-bold">
              Hộp Thư Khách Hàng
            </span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                {unreadCount} tin nhắn mới chưa đọc
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Tin Nhắn & Yêu Cầu Liên Hệ
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý và xem tin nhắn gửi từ biểu mẫu liên hệ của khách hàng.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto">
          <button
            onClick={loadMessages}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            {isRefreshing ? 'Đang tải lại...' : 'Làm Mới Danh Sách'}
          </button>
        </div>
      </div>

      {/* Main Grid: Left List (7 Cols) & Right Detail View (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Search, Filter Tabs & List */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          
          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {[
                { id: 'all', label: 'Tất cả', count: messages.length },
                { id: 'unread', label: 'Chưa đọc', count: unreadCount },
                { id: 'read', label: 'Đã đọc', count: messages.length - unreadCount },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFilterTab(t.id as any)}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                    filterTab === t.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên, email, nội dung..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-colors"
              />
            </div>
          </div>

          {/* Messages List */}
          {isLoading ? (
            <div className="py-16 text-center space-y-2 text-slate-500 text-xs">
              Đang tải danh sách tin nhắn...
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="py-16 text-center space-y-1 border border-dashed border-slate-200 rounded-lg">
              <p className="text-xs font-bold text-slate-700">Chưa có tin nhắn nào</p>
              <p className="text-[11px] text-slate-400">
                {searchQuery
                  ? 'Không tìm thấy tin nhắn phù hợp.'
                  : 'Hộp thư hiện đang trống.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredMessages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                const formattedDate = new Date(msg.createdAt || msg.timestamp).toLocaleString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-400'
                        : !msg.isRead
                        ? 'bg-amber-50/20 border-amber-200 hover:border-amber-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {!msg.isRead ? (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500 text-white text-[10px] font-bold">
                              MỚI
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 text-[10px] font-medium">
                              Đã đọc
                            </span>
                          )}
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {msg.name || 'Khách hàng ẩn danh'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            • {formattedDate}
                          </span>
                        </div>

                        <div className="text-xs text-slate-700 mb-1 font-medium truncate">
                          {msg.contactInfo || msg.email || msg.phone || 'Chưa để lại liên hệ'}
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {msg.message}
                        </p>
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleToggleRead(msg, e)}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                        >
                          {msg.isRead ? 'Chưa đọc' : 'Đã đọc'}
                        </button>
                        <button
                          onClick={(e) => handlePromptDelete(msg, e)}
                          className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded transition-colors"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Message Detail View */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 sticky top-20">
          {selectedMessage ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Chi Tiết Tin Nhắn
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedMessage.name}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleRead(selectedMessage)}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                  >
                    {selectedMessage.isRead ? 'Đánh dấu chưa đọc' : 'Đã đọc'}
                  </button>
                  <button
                    onClick={() => handlePromptDelete(selectedMessage)}
                    className="px-2.5 py-1 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded transition-colors"
                  >
                    Xóa
                  </button>
                </div>
              </div>

              {/* Sender Info Block */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Họ và tên:</span>
                  <span className="font-bold text-slate-900">{selectedMessage.name}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Thông tin liên hệ:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono">
                      {selectedMessage.contactInfo || selectedMessage.email || selectedMessage.phone || 'Chưa cung cấp'}
                    </span>
                    {(selectedMessage.contactInfo || selectedMessage.email || selectedMessage.phone) && (
                      <button
                        onClick={() => handleCopy(selectedMessage.contactInfo || selectedMessage.email || selectedMessage.phone || '', selectedMessage.id)}
                        className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50"
                      >
                        {copiedId === selectedMessage.id ? 'Đã sao chép' : 'Sao chép'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Thời gian gửi:</span>
                  <span className="font-medium text-slate-700">
                    {new Date(selectedMessage.createdAt || selectedMessage.timestamp).toLocaleString('vi-VN')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Trạng thái:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedMessage.isRead ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    {selectedMessage.isRead ? 'Đã đọc' : 'Chưa đọc (Mới)'}
                  </span>
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nội Dung Tin Nhắn:
                </label>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-300 text-xs sm:text-sm text-slate-900 leading-relaxed whitespace-pre-wrap min-h-[140px]">
                  {selectedMessage.message}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-1 text-slate-400 text-xs">
              <p className="font-bold text-slate-700">Chưa chọn tin nhắn</p>
              <p>Chọn một tin nhắn ở danh sách bên trái để xem nội dung.</p>
            </div>
          )}
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {messageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 font-bold text-lg">
                ✕
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
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
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
