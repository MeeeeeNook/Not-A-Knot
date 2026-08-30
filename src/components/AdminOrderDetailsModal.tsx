import React, { useRef } from 'react';
import { StoredOrder } from '../firebase';

interface AdminOrderDetailsModalProps {
  order: StoredOrder;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: string) => void;
  onZoomReceipt: (imageUrl: string) => void;
  onEdit?: (order: StoredOrder) => void;
}

export const AdminOrderDetailsModal: React.FC<AdminOrderDetailsModalProps> = ({
  order,
  onClose,
  onUpdateStatus,
  onZoomReceipt,
  onEdit
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrintSlip = () => {
    window.print();
  };

  const getSourceBadge = () => {
    switch (order.source) {
      case 'mạng xã hội':
      case 'facebook':
        return { label: 'Mạng xã hội', color: 'text-indigo-800 bg-indigo-50 border-indigo-200' };
      case 'zalo':
        return { label: 'Zalo Chat', color: 'text-teal-800 bg-teal-50 border-teal-200' };
      case 'hotline':
      case 'trực tiếp':
        return { label: 'Trực tiếp / Hotline', color: 'text-amber-800 bg-amber-50 border-amber-200' };
      case 'website':
      default:
        return { label: 'Website', color: 'text-blue-800 bg-blue-50 border-blue-200' };
    }
  };

  const src = getSourceBadge();
  const totalAmount = order.totalPrice || order.totalAmount || 0;
  const paidAmount = order.paidAmount ?? (order.paymentStatus === 'paid' ? totalAmount : 0);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 shadow-2xl relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900">
                Chi Tiết Đơn Hàng #{order.id}
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${src.color}`}>
                {src.label}
              </span>
            </div>
            <span className="text-xs text-slate-500 block mt-0.5">
              Ngày đặt: {order.date || order.createdAt || 'N/A'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(order);
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-xs transition-colors"
              >
                Sửa Đơn
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintSlip}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold border border-slate-300 shadow-xs"
            >
              In Phiếu
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-slate-400 hover:text-slate-900 rounded text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              Đóng [X]
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div ref={printRef} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-slate-700 text-xs">
          
          {/* Customer & Delivery Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Thông Tin Khách Hàng
              </span>
              <span className="text-sm font-bold text-slate-900 block">
                {order.name || order.customerName || 'Khách vãng lai'}
              </span>
              <div className="text-slate-800 font-semibold">
                SĐT: {order.phone || 'Chưa cung cấp SĐT'}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Địa Chỉ Giao Hàng
              </span>
              <p className="text-slate-800 leading-relaxed">
                {order.address || 'Nhận trực tiếp tại xưởng / Thống nhất qua tin nhắn'}
              </p>
              {order.note && (
                <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <strong>Ghi chú:</strong> {order.note}
                </div>
              )}
            </div>
          </div>

          {/* Payment & Bill Proof Section */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Thông Tin Thanh Toán
              </span>

              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                order.paymentStatus === 'paid'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : order.paymentStatus === 'partial'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {order.paymentStatus === 'paid' ? 'Đã thanh toán đủ (100%)' : order.paymentStatus === 'partial' ? 'Đã đặt cọc 1 phần' : 'Chưa thanh toán'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <span className="text-slate-500 text-[11px] block">Hình thức:</span>
                <span className="font-bold text-slate-900 text-xs">
                  {order.paymentMethod === 'bank_transfer' ? 'Chuyển khoản (VietQR)' : order.paymentMethod === 'cash' ? 'Tiền mặt tại xưởng' : 'Thu tiền khi nhận'}
                </span>
                {order.bankTransferRef && (
                  <span className="text-[10px] text-slate-500 block font-mono">Mã GD: {order.bankTransferRef}</span>
                )}
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Số tiền đã thu:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {paidAmount.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Còn phải thu:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {remainingAmount.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Bill Receipt Image (if present) */}
            {order.bankReceiptImage && (
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <img
                    src={order.bankReceiptImage}
                    alt="Bill chuyển khoản"
                    className="w-14 h-14 rounded object-cover border border-slate-300 cursor-pointer"
                    onClick={() => onZoomReceipt(order.bankReceiptImage!)}
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      Ảnh Bill Chuyển Khoản
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Bấm vào ảnh để phóng to
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onZoomReceipt(order.bankReceiptImage!)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Phóng To Bill
                </button>
              </div>
            )}
          </div>

          {/* Ordered Products Table */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Danh Sách Món Đã Đặt
            </span>

            <div className="space-y-2 divide-y divide-slate-200">
              {(order.itemDetails && order.itemDetails.length > 0) ? (
                order.itemDetails.map((it, idx) => (
                  <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">
                        {it.productName} (x{it.quantity})
                      </span>
                      {it.customNote && (
                        <div className="text-[10px] text-amber-800 mt-0.5">
                          Ghi chú: {it.customNote}
                        </div>
                      )}
                    </div>
                    <span className="font-bold text-slate-900 text-xs whitespace-nowrap">
                      {((it.unitPrice || it.price || 0) * it.quantity).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                ))
              ) : (
                (order.items || []).map((itText, idx) => (
                  <div key={idx} className="pt-2 first:pt-0 text-xs text-slate-800">
                    {itText}
                  </div>
                ))
              )}
            </div>

            {/* Total Breakdown */}
            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
              <span className="font-bold text-xs text-slate-500 uppercase">Tổng Cộng Đơn Hàng:</span>
              <span className="text-base font-bold text-slate-900">
                {totalAmount.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>

          {/* Status Quick Update in Modal */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Trạng thái:</span>
              <select
                value={order.status || 'Đã đặt'}
                onChange={(e) => onUpdateStatus(order.id!, e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none"
              >
                <option value="Đã đặt">Đã đặt</option>
                <option value="Đã thanh toán">Đã thanh toán</option>
                <option value="Đã giao">Đã giao</option>
              </select>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors"
            >
              Đóng Cửa Sổ
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
