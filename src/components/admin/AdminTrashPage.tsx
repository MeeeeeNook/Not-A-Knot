import React, { useState, useMemo } from 'react';
import { StoredOrder } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';
import {
  Trash2,
  RefreshCw,
  Search,
  RotateCcw,
  AlertTriangle,
  CheckSquare,
  Square,
  PackageCheck,
  Calendar,
  User,
  Phone,
  MapPin,
  Tag
} from 'lucide-react';
import {
  restoreOrderFromTrash,
  deleteOrderPermanently,
  emptyOrderTrash,
  isMatchingOrderDoc
} from '../../firebase';

interface AdminTrashPageProps {
  orders: StoredOrder[];
  onNotify: (msg: string) => void;
  onRefreshOrders?: () => void;
  onUpdateOrders?: (newOrders: StoredOrder[]) => void;
}

export const AdminTrashPage: React.FC<AdminTrashPageProps> = ({
  orders,
  onNotify,
  onRefreshOrders,
  onUpdateOrders
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    type: 'delete_one' | 'delete_batch' | 'empty_all';
    orderId?: string;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Filter only deleted orders
  const deletedOrders = orders.filter((o) => o.isDeleted === true);

  const filteredTrash = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase().trim();
    return deletedOrders.filter((o) => {
      if (!q) return true;
      return (
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.name && o.name.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.phone && o.phone.includes(q)) ||
        (o.address && o.address.toLowerCase().includes(q))
      );
    });
  }, [deletedOrders, debouncedSearchQuery]);

  const handleSelectAll = () => {
    if (selectedIds.length === filteredTrash.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTrash.map((o) => o.id!).filter(Boolean));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Restore Single
  const handleRestore = async (orderId: string) => {
    setIsProcessing(true);
    try {
      if (onUpdateOrders) {
        onUpdateOrders(
          orders.map((o) => (o.id === orderId ? { ...o, isDeleted: false, deletedAt: undefined } : o))
        );
      }
      await restoreOrderFromTrash(orderId);
      onNotify(`✓ Đã khôi phục đơn hàng #${orderId} về danh sách chính!`);
      if (onRefreshOrders) onRefreshOrders();
    } catch (err) {
      onNotify('Lỗi khi khôi phục đơn hàng!');
    } finally {
      setIsProcessing(false);
    }
  };

  // Restore Selected Batch
  const handleRestoreSelected = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    try {
      const idsSet = new Set(selectedIds);
      if (onUpdateOrders) {
        onUpdateOrders(
          orders.map((o) => (o.id && idsSet.has(o.id) ? { ...o, isDeleted: false, deletedAt: undefined } : o))
        );
      }
      for (const id of selectedIds) {
        await restoreOrderFromTrash(id);
      }
      onNotify(`✓ Đã khôi phục ${selectedIds.length} đơn hàng về danh sách chính!`);
      setSelectedIds([]);
      if (onRefreshOrders) onRefreshOrders();
    } catch (err) {
      onNotify('Lỗi khi khôi phục các đơn hàng đã chọn!');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm Permanent Delete Single
  const confirmDeletePermanently = (orderId: string) => {
    setConfirmModal({
      type: 'delete_one',
      orderId,
      title: 'Xóa vĩnh viễn đơn hàng này?',
      message: `Đơn hàng #${orderId} và dữ liệu liên quan sẽ bị xóa vĩnh viễn khỏi hệ thống Cloud và không thể phục hồi lại.`,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          if (onUpdateOrders) {
            onUpdateOrders(orders.filter((o) => !isMatchingOrderDoc(orderId, o.id || '', o)));
          }
          await deleteOrderPermanently(orderId);
          onNotify(`✓ Đã xóa vĩnh viễn đơn hàng #${orderId}.`);
          setConfirmModal(null);
          if (onRefreshOrders) onRefreshOrders();
        } catch (err) {
          onNotify('Lỗi khi xóa vĩnh viễn đơn hàng!');
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  // Confirm Permanent Delete Batch
  const confirmDeleteSelectedPermanently = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    setConfirmModal({
      type: 'delete_batch',
      title: `Xóa vĩnh viễn ${count} đơn hàng đã chọn?`,
      message: `${count} đơn hàng này sẽ bị xóa vĩnh viễn khỏi Cloud Firebase. Hành động này KHÔNG THỂ HỎAN TÁC.`,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          if (onUpdateOrders) {
            onUpdateOrders(
              orders.filter((o) => !selectedIds.some((id) => isMatchingOrderDoc(id, o.id || '', o)))
            );
          }
          await emptyOrderTrash(selectedIds);
          onNotify(`✓ Đã xóa vĩnh viễn ${count} đơn hàng!`);
          setSelectedIds([]);
          setConfirmModal(null);
          if (onRefreshOrders) onRefreshOrders();
        } catch (err) {
          onNotify('Lỗi khi xóa vĩnh viễn các đơn hàng đã chọn!');
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  // Confirm Empty All Trash
  const confirmEmptyAllTrash = () => {
    if (deletedOrders.length === 0) return;
    const count = deletedOrders.length;
    const allIds = deletedOrders.map((o) => o.id!).filter(Boolean);
    setConfirmModal({
      type: 'empty_all',
      title: `Dọn sạch Thùng rác (${count} đơn)?`,
      message: `Tất cả ${count} đơn hàng trong Thùng rác sẽ bị xóa vĩnh viễn khỏi hệ thống. Hành động này KHÔNG THỂ HỎAN TÁC.`,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          if (onUpdateOrders) {
            onUpdateOrders(
              orders.filter((o) => !o.isDeleted && !allIds.some((id) => isMatchingOrderDoc(id, o.id || '', o)))
            );
          }
          await emptyOrderTrash(allIds);
          onNotify(`✓ Đã dọn sạch ${count} đơn hàng khỏi Thùng rác!`);
          setSelectedIds([]);
          setConfirmModal(null);
          if (onRefreshOrders) onRefreshOrders();
        } catch (err) {
          onNotify('Lỗi khi dọn sạch thùng rác!');
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Thùng rác Đơn hàng
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Nơi lưu trữ các đơn hàng đã xóa tạm thời. Bạn có thể khôi phục lại bất cứ lúc nào.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {deletedOrders.length > 0 && (
            <button
              onClick={confirmEmptyAllTrash}
              disabled={isProcessing}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Dọn sạch Thùng rác ({deletedOrders.length})
            </button>
          )}
        </div>
      </div>

      {/* Toolbar & Controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm đơn trong thùng rác theo mã, tên, SDT..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
          />
        </div>

        {/* Selected Controls */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              Đã chọn: {selectedIds.length}
            </span>
            <button
              onClick={handleRestoreSelected}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Khôi phục ({selectedIds.length})
            </button>
            <button
              onClick={confirmDeleteSelectedPermanently}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa vĩnh viễn
            </button>
          </div>
        )}
      </div>

      {/* Trash Items List */}
      {filteredTrash.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Trash2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Thùng rác trống</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? 'Không tìm thấy đơn hàng xóa trùng khớp với từ khóa của bạn.'
              : 'Hiện tại không có đơn hàng nào nằm trong thùng rác.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select All Bar */}
          <div className="flex items-center justify-between px-4 text-xs font-bold text-slate-500">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 hover:text-slate-900 transition-all cursor-pointer"
            >
              {selectedIds.length === filteredTrash.length ? (
                <CheckSquare className="w-4 h-4 text-amber-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Chọn tất cả ({filteredTrash.length} đơn)</span>
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTrash.map((order) => {
              const isSelected = selectedIds.includes(order.id!);
              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl p-5 border transition-all space-y-3.5 relative ${
                    isSelected
                      ? 'border-amber-500 shadow-md ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  {/* Select Checkbox & Order ID */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => handleToggleSelect(order.id!)}
                        className="text-slate-400 hover:text-amber-600 transition-all cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <span className="font-mono font-black text-sm text-slate-900">
                          #{order.id}
                        </span>
                        {order.deletedAt && (
                          <div className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            Xóa ngày: {new Date(order.deletedAt).toLocaleString('vi-VN')}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {order.status || 'Chờ xác nhận'}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{order.name || order.customerName || 'Chưa cập nhật'}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{order.phone || 'Chưa có SĐT'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{order.address || 'Chưa có địa chỉ'}</span>
                    </div>
                  </div>

                  {/* Products & Amount */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <PackageCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>{Array.isArray(order.items) ? order.items.length : 1} món</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400">Tổng tiền: </span>
                      <span className="font-black text-amber-600 font-mono text-sm">
                        {(order.totalPrice || order.totalAmount || 0).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleRestore(order.id!)}
                      disabled={isProcessing}
                      className="flex-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Khôi phục
                    </button>
                    <button
                      onClick={() => confirmDeletePermanently(order.id!)}
                      disabled={isProcessing}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200/80 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Xóa vĩnh viễn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">{confirmModal.title}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{confirmModal.message}</p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmModal.onConfirm}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
