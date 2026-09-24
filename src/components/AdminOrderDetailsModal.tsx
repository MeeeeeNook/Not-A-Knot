import React, { useRef, useState } from 'react';
import { StoredOrder } from '../firebase';
import { formatOrderDateWithoutSeconds, getSourceBadgeConfig, normalizeOrderStatus, getCleanOrderNote } from '../utils/orderFormatters';
import { Lock, Printer, Download, Copy, ExternalLink, X, Check, FileText, RotateCcw, CheckCircle2, Mail, Send, RefreshCw } from 'lucide-react';
import {
  printOrderSlipDirectly,
  openOrderPrintTab,
  downloadOrderSlipHtml,
  downloadOrderSlipTxt,
  copyOrderSlipToClipboard
} from '../utils/printOrderSlip';
import { LoadingImage } from './LoadingImage';
import { sendOrderConfirmationEmail, ensureGmailDomain } from '../utils/emailService';

interface AdminOrderDetailsModalProps {
  order: StoredOrder;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: string) => void;
  onUpdatePaymentStatus?: (orderId: string, paymentStatus: 'paid' | 'unpaid') => void;
  onZoomReceipt: (imageUrl: string) => void;
  onEdit?: (order: StoredOrder) => void;
  onDelete?: (orderId: string) => void;
}

export const AdminOrderDetailsModal: React.FC<AdminOrderDetailsModalProps> = ({
  order,
  onClose,
  onUpdateStatus,
  onUpdatePaymentStatus,
  onZoomReceipt,
  onEdit,
  onDelete
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printSuccessToast, setPrintSuccessToast] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [targetEmailInput, setTargetEmailInput] = useState(() => {
    const raw = order.email || (order as any).customerEmail || '';
    return raw ? ensureGmailDomain(raw) : '';
  });
  const [emailModalError, setEmailModalError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setPrintSuccessToast(msg);
    setTimeout(() => setPrintSuccessToast(null), 4000);
  };

  const handleOpenEmailModal = () => {
    const raw = order.email || (order as any).customerEmail || '';
    setTargetEmailInput(raw ? ensureGmailDomain(raw) : '');
    setEmailModalError(null);
    setIsEmailModalOpen(true);
  };

  const handleConfirmSendOrderEmail = async () => {
    const cleanEmail = ensureGmailDomain(targetEmailInput.trim());
    if (!cleanEmail) {
      setEmailModalError('Vui lòng nhập địa chỉ email người nhận hợp lệ.');
      return;
    }

    setIsSendingEmail(true);
    setEmailModalError(null);
    showToast('Đang tạo và gửi email xác nhận đơn hàng...');

    try {
      const payload: StoredOrder = {
        ...order,
        email: cleanEmail,
        customerEmail: cleanEmail,
        isManualAdmin: true
      };

      const res = await sendOrderConfirmationEmail(payload);
      if (res.success) {
        if (res.mode === 'sent_real_email') {
          showToast(`Đã gửi email hóa đơn thành công tới: ${cleanEmail}!`);
        } else {
          showToast(`Đã gửi email hóa đơn đơn hàng #${order.id} tới: ${cleanEmail}!`);
        }
        setIsEmailModalOpen(false);
      } else {
        const errMsg = res.error || 'Không thể gửi email lúc này';
        setEmailModalError(errMsg);
        showToast(`Không thể gửi email: ${errMsg}`);
      }
    } catch (err: any) {
      const errMsg = err.message || 'Lỗi mạng khi kết nối máy chủ';
      setEmailModalError(errMsg);
      showToast(`Lỗi gửi email: ${errMsg}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePrintSlip = () => {
    setIsPrintModalOpen(true);
  };

  const handleDirectWindowPrint = () => {
    const success = printOrderSlipDirectly(order);
    if (success) {
      showToast('Đang mở hộp thoại in phiếu...');
    } else {
      try {
        window.print();
        showToast('Đang gọi lệnh in của trình duyệt...');
      } catch {
        openOrderPrintTab(order);
        showToast('Đã mở tab in riêng do trình duyệt hạn chế in trực tiếp!');
      }
    }
  };

  const handleOpenPrintTab = () => {
    const success = openOrderPrintTab(order);
    if (success) {
      showToast('Đang mở tab in riêng (A4/A5)...');
    } else {
      showToast('Đã tải file phiếu in (.html) về máy của bạn!');
      downloadOrderSlipHtml(order);
    }
  };

  const handleDownloadHtml = () => {
    downloadOrderSlipHtml(order);
    showToast('Đã tải phiếu in định dạng HTML!');
  };

  const handleDownloadTxt = () => {
    downloadOrderSlipTxt(order);
    showToast('Đã tải phiếu giao hàng định dạng TXT!');
  };

  const handleCopyText = async () => {
    const ok = await copyOrderSlipToClipboard(order);
    if (ok) {
      showToast('Đã sao chép toàn bộ thông tin phiếu vào bộ nhớ tạm!');
    } else {
      showToast('Không thể sao chép tự động, vui lòng chọn tải file.');
    }
  };

  const srcConfig = getSourceBadgeConfig(order.source);
  const totalAmount = order.totalPrice || order.totalAmount || 0;
  const itemsSubtotal = (order.itemDetails && order.itemDetails.length > 0)
    ? order.itemDetails.reduce((sum, it) => sum + (it.unitPrice || it.price || 0) * (it.quantity || 1), 0)
    : (order.subtotal || (totalAmount - (order.shippingFee || 0) + (order.discountAmount || 0)));
  const discountAmount = Number(order.discountAmount || 0);
  const shippingFee = order.shippingFee !== undefined && order.shippingFee !== null
    ? Number(order.shippingFee)
    : (totalAmount > itemsSubtotal ? Math.max(0, totalAmount - itemsSubtotal + discountAmount) : 0);
  const paidAmount = order.paidAmount ?? (order.paymentStatus === 'paid' ? totalAmount : 0);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const formattedDate = formatOrderDateWithoutSeconds(order.date || order.createdAt);
  const currentStatus = normalizeOrderStatus(order.status);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 shadow-2xl relative my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  Chi Tiết Đơn Hàng #{order.id}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${srcConfig.badgeClass}`}>
                  {srcConfig.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Ngày đặt: {formattedDate}
              </p>
            </div>

            {/* Clean, neatly arranged top action buttons: Sửa, In, Đóng */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(order);
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300/80 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Sửa
                </button>
              )}

              <button
                type="button"
                onClick={handlePrintSlip}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300/80 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                In
              </button>

              <button
                type="button"
                onClick={handleOpenEmailModal}
                disabled={isSendingEmail}
                className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                title="Gửi email hóa đơn xác nhận đơn hàng cho khách hoặc quản trị viên"
              >
                <Mail className="w-3.5 h-3.5 text-amber-700" />
                <span>{isSendingEmail ? 'Đang gửi...' : 'Gửi Email'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Đóng
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
              {(order.email || (order as any).customerEmail) && (
                <div className="text-slate-600 text-[11px] flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>Email: {order.email || (order as any).customerEmail}</span>
                </div>
              )}
              {(() => {
                const isLockedSource = order.source === 'website' || order.source === 'mạng xã hội' || order.source === 'facebook' || order.source === 'tiktok' || order.source === 'instagram' || order.source === 'zalo' || order.source === 'shopee';
                if (isLockedSource) {
                  return (
                    <div className="pt-1 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded flex items-center gap-1.5 font-medium">
                      <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Nguồn: <strong>{order.source === 'website' ? 'Website' : 'Mạng xã hội'}</strong> (Đơn tự động — Đã khóa người bán)</span>
                    </div>
                  );
                }
                if (order.sellerName) {
                  return (
                    <div className="pt-1 text-[11px] text-amber-900 bg-amber-50/80 border border-amber-200/80 px-2 py-1 rounded flex items-center gap-1.5 font-medium">
                      <span>Người bán phụ trách:</span>
                      <strong className="text-amber-950 font-bold">{order.sellerName}</strong>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Địa Chỉ & Giao Hàng
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  shippingFee > 0 ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}>
                  {shippingFee > 0 ? `Ship: ${shippingFee.toLocaleString('vi-VN')}đ` : 'Freeship (0đ)'}
                </span>
              </div>
              <p className="text-slate-800 leading-relaxed font-medium">
                {order.address || 'Nhận trực tiếp tại xưởng / Thống nhất qua tin nhắn'}
              </p>
              {order.shippingCarrier && (
                <div className="text-[11px] text-slate-600 pt-0.5">
                  Đơn vị vận chuyển: <strong className="text-slate-900">{order.shippingCarrier}</strong>
                  {order.shippingCode && <span> (Mã: <code className="text-amber-800 font-bold">{order.shippingCode}</code>)</span>}
                </div>
              )}
              {getCleanOrderNote(order.note) && (
                <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <strong>Ghi chú:</strong> {getCleanOrderNote(order.note)}
                </div>
              )}
            </div>
          </div>

          {/* Payment & Bill Proof Section */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Thông Tin Thanh Toán
              </span>

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 ${
                  order.paymentStatus === 'paid'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : order.paymentStatus === 'partial'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-slate-200 text-slate-700 border border-slate-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${order.paymentStatus === 'paid' ? 'bg-emerald-600' : order.paymentStatus === 'partial' ? 'bg-amber-500' : 'bg-slate-500'}`} />
                  {order.paymentStatus === 'paid' ? 'Đã thanh toán đủ (100%)' : order.paymentStatus === 'partial' ? 'Đã đặt cọc 1 phần' : 'Chưa thanh toán'}
                </span>

                {onUpdatePaymentStatus && order.id && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextPayment = order.paymentStatus === 'paid' ? 'unpaid' : 'paid';
                      onUpdatePaymentStatus(order.id!, nextPayment);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border ${
                      order.paymentStatus === 'paid'
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 hover:border-amber-400'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm'
                    }`}
                    title={order.paymentStatus === 'paid' ? 'Chuyển đơn này sang Chưa thanh toán' : 'Đánh dấu đơn này là Đã thanh toán nhanh'}
                  >
                    {order.paymentStatus === 'paid' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                        <span>Chuyển Chưa TT</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Đánh Dấu Đã TT</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <span className="text-slate-500 text-[11px] block">Hình thức:</span>
                <span className="font-bold text-slate-900 text-xs">
                  {order.paymentMethod === 'bank_transfer' ? 'Chuyển khoản (VietQR)' : order.paymentMethod === 'cash' ? 'Tiền mặt tại xưởng' : 'Thu tiền khi nhận'}
                </span>
                {order.bankTransferRef && (
                  <span className="text-[10px] text-slate-500 block font-mono truncate">Mã GD: {order.bankTransferRef}</span>
                )}
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Phí vận chuyển:</span>
                <span className={`font-bold text-xs ${shippingFee > 0 ? 'text-slate-900' : 'text-emerald-700'}`}>
                  {shippingFee > 0 ? `${shippingFee.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Số tiền đã thu:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {paidAmount.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Còn phải thu:</span>
                <span className="font-bold text-amber-900 text-sm">
                  {remainingAmount.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Voucher Information Row */}
            {(order.voucherCode || (order.voucherDiscountAmount && order.voucherDiscountAmount > 0) || discountAmount > 0) && (
              <div className="mt-2.5 p-2.5 bg-amber-50/90 border border-amber-300 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-950 flex items-center gap-1">
                    🎟️ Mã giảm giá (Voucher):
                  </span>
                  {order.voucherCode ? (
                    <span className="font-mono font-black text-xs text-amber-950 bg-amber-200/90 px-2 py-0.5 rounded border border-amber-300">
                      {order.voucherCode}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Chiết khấu trực tiếp</span>
                  )}
                  {order.voucherType && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                      {order.voucherType === 'freeship' ? 'Miễn phí vận chuyển' : 'Giảm giá %'}
                    </span>
                  )}
                </div>
                <div className="font-bold text-emerald-700 font-mono text-xs">
                  Giảm: -{(order.voucherDiscountAmount || discountAmount || 0).toLocaleString('vi-VN')}đ
                </div>
              </div>
            )}

            {/* Bill Receipt Image (if present) */}
            {order.bankReceiptImage && order.bankReceiptImage.trim() && (
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

            <div className="space-y-3 divide-y divide-slate-200">
              {(order.itemDetails && order.itemDetails.length > 0) ? (
                order.itemDetails.map((it, idx) => (
                  <div key={idx} className="pt-3 first:pt-0 flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          {it.productName || it.name || 'Sản phẩm'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black text-[10px]">
                          x{it.quantity || 1}
                        </span>
                      </div>

                      {/* Full Customer-Selected Variations */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {it.selectedColor && (
                          <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-800 shadow-2xs">
                            {it.selectedColorImage && it.selectedColorImage.trim() ? (
                              <LoadingImage
                                src={it.selectedColorImage}
                                alt={it.selectedColor}
                                containerClassName="w-5 h-5 rounded border border-slate-200 shrink-0"
                                className="w-full h-full object-cover"
                                spinnerSize="xs"
                                spinnerColor="amber"
                              />
                            ) : null}
                            <span>Màu: <strong className="text-slate-900">{it.selectedColor}</strong></span>
                          </div>
                        )}

                        {it.selectedCharm && (
                          <div className="inline-flex items-center gap-1.5 bg-amber-50/90 border border-amber-300 px-2 py-1 rounded-lg text-[11px] font-bold text-amber-950 shadow-2xs">
                            {it.selectedCharmImage && it.selectedCharmImage.trim() ? (
                              <LoadingImage
                                src={it.selectedCharmImage}
                                alt={typeof it.selectedCharm === 'object' ? (it.selectedCharm as any).name : it.selectedCharm}
                                containerClassName="w-6 h-6 rounded-md border border-amber-300 shrink-0"
                                className="w-full h-full object-cover"
                                spinnerSize="xs"
                                spinnerColor="amber"
                              />
                            ) : null}
                            <span>Charm: <strong>{typeof it.selectedCharm === 'object' ? (it.selectedCharm as any).name : it.selectedCharm}</strong></span>
                            {it.selectedCharmPrice ? (
                              <span className="text-[10px] text-amber-700 font-mono">(+{it.selectedCharmPrice.toLocaleString('vi-VN')}đ)</span>
                            ) : null}
                          </div>
                        )}

                        {it.selectedKhoen && (
                          <div className="inline-flex items-center gap-1.5 bg-sky-50/90 border border-sky-300 px-2 py-1 rounded-lg text-[11px] font-bold text-sky-950 shadow-2xs">
                            {it.selectedKhoenImage && it.selectedKhoenImage.trim() ? (
                              <LoadingImage
                                src={it.selectedKhoenImage}
                                alt={it.selectedKhoen}
                                containerClassName="w-6 h-6 rounded-md border border-sky-300 shrink-0"
                                className="w-full h-full object-cover"
                                spinnerSize="xs"
                                spinnerColor="amber"
                              />
                            ) : null}
                            <span>Khoen: <strong>{it.selectedKhoen}</strong></span>
                            {it.selectedKhoenPrice ? (
                              <span className="text-[10px] text-sky-700 font-mono">(+{it.selectedKhoenPrice.toLocaleString('vi-VN')}đ)</span>
                            ) : null}
                          </div>
                        )}

                        {it.selectedOmamoris && it.selectedOmamoris.length > 0 && (
                          <div className="inline-flex items-center gap-1.5 bg-rose-50/90 border border-rose-300 px-2 py-1 rounded-lg text-[11px] font-bold text-rose-950 shadow-2xs">
                            {it.selectedOmamoris[0]?.image ? (
                              <LoadingImage
                                src={it.selectedOmamoris[0].image}
                                alt="Bùa Omamori"
                                containerClassName="w-6 h-6 rounded-md border border-rose-300 shrink-0"
                                className="w-full h-full object-cover"
                                spinnerSize="xs"
                                spinnerColor="rose"
                              />
                            ) : null}
                            <span>Bùa: <strong>{it.selectedOmamoris.map((o) => o.name).join(', ')}</strong></span>
                            {it.selectedOmamoriPrice ? (
                              <span className="text-[10px] text-rose-700 font-mono">(+{it.selectedOmamoriPrice.toLocaleString('vi-VN')}đ)</span>
                            ) : null}
                          </div>
                        )}

                        {it.selectedSize && (
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                            Size: <strong className="ml-1 text-slate-950">{it.selectedSize}</strong>
                          </span>
                        )}
                      </div>

                      {/* Combo Multi-Product Breakdown (if item is a combo) */}
                      {it.selectedComboItems && it.selectedComboItems.length > 0 && (
                        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2 mt-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-black text-stone-900 uppercase">
                            <span>Chi tiết phối đồ Combo ({it.selectedComboItems.length} món):</span>
                          </div>
                          <div className="space-y-1.5 text-[11px]">
                            {it.selectedComboItems.map((cItem, cIdx) => (
                              <div key={cIdx} className="bg-white p-2 rounded-lg border border-stone-200 space-y-0.5">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span className="w-4 h-4 rounded-full bg-stone-900 text-white text-[10px] font-black flex items-center justify-center">
                                    {cIdx + 1}
                                  </span>
                                  <span>{cItem.itemTitle}</span>
                                </div>
                                <div className="pl-5 text-slate-600 space-y-0.5">
                                  {cItem.selectedColor && (
                                    <div>• Màu: <strong className="text-slate-800">{cItem.selectedColor}</strong></div>
                                  )}
                                  {cItem.selectedCharms && cItem.selectedCharms.length > 0 && (
                                    <div>• Charm: <strong className="text-amber-800">{cItem.selectedCharms.map((c) => c.name).join(', ')}</strong></div>
                                  )}
                                  {cItem.selectedOmamoris && cItem.selectedOmamoris.length > 0 && (
                                    <div>• Omamori: <strong className="text-rose-800">{cItem.selectedOmamoris.map((o) => o.name).join(', ')}</strong></div>
                                  )}
                                  {cItem.selectedKhoen && (
                                    <div>• Khoen: <strong className="text-sky-800">{cItem.selectedKhoen}</strong></div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {it.customNote && (
                        <div className="text-[11px] text-amber-900 bg-amber-100/70 border border-amber-200 px-2.5 py-1 rounded-lg font-medium">
                          <strong>Yêu cầu riêng của khách:</strong> {it.customNote}
                        </div>
                      )}
                    </div>
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm whitespace-nowrap pt-0.5">
                      {((it.unitPrice || it.price || 0) * (it.quantity || 1)).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                ))
              ) : (
                (Array.isArray(order.items) ? order.items : order.items ? [String(order.items)] : []).map((itText, idx) => (
                  <div key={idx} className="pt-2 first:pt-0 text-xs text-slate-800">
                    {itText}
                  </div>
                ))
              )}
            </div>

            {/* Total Breakdown */}
            <div className="pt-3 border-t border-slate-200 space-y-1.5">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Tạm tính tiền hàng:</span>
                <span className="font-semibold text-slate-900">{itemsSubtotal.toLocaleString('vi-VN')}đ</span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Phí vận chuyển:</span>
                <span className={`font-semibold ${shippingFee > 0 ? 'text-slate-900' : 'text-emerald-700'}`}>
                  {shippingFee > 0 ? `+${shippingFee.toLocaleString('vi-VN')}đ` : 'Miễn phí (0đ)'}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-xs text-emerald-700">
                  <span>Giảm giá / Ưu đãi:</span>
                  <span className="font-semibold">-{discountAmount.toLocaleString('vi-VN')}đ</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="font-bold text-xs sm:text-sm text-slate-900 uppercase">Tổng Cộng Đơn Hàng:</span>
                <span className="text-base sm:text-lg font-black text-amber-800">
                  {totalAmount.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>
          </div>

          {/* Status Quick Update & Action Footer */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Trạng thái:</span>
                <select
                  value={currentStatus}
                  onChange={(e) => onUpdateStatus(order.id!, e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none"
                >
                  <option value="Chờ xác nhận">Chờ xác nhận</option>
                  <option value="Đã xác nhận">Đã xác nhận</option>
                  <option value="Knot đang được sản xuất">Knot đang được sản xuất</option>
                  <option value="Đang giao hàng">Đang giao hàng</option>
                  <option value="Đơn hàng giao thành công">Đơn hàng giao thành công</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onDelete && order.id && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDelete(order.id!);
                  }}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  title="Xóa đơn hàng này"
                >
                  Xóa Đơn
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Đóng Cửa Sổ
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>

      {/* Official Print Slip Dialog */}
      {isPrintModalOpen && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setIsPrintModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-slate-200 shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-sm sm:text-base">
                  Phiếu Giao Nhận & Hóa Đơn - #{order.id}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700"
                title="Đóng (hoặc nhấn ra ngoài để thoát)"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Notification alert banner */}
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200/70 text-amber-900 text-xs flex items-center justify-between gap-2 no-print">
              <div className="flex items-center gap-1.5">
                <span className="font-bold">💡 Mẹo in:</span>
                <span>
                  {printSuccessToast || 'Bấm "Mở Tab In" để mở trang in chuẩn A4/A5 tự động, hoặc "Tải File In" nếu trình duyệt chặn popup.'}
                </span>
              </div>
              {printSuccessToast && (
                <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1 shrink-0">
                  <Check className="w-3.5 h-3.5" /> Đã thực hiện
                </span>
              )}
            </div>

            {/* Printable Area with exact styling */}
            <div className="p-6 overflow-y-auto space-y-5 bg-white text-slate-900 printable-order-slip text-xs">
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-black text-slate-950 tracking-wider">
                    NOT A KNOT
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Xưởng Đan Vòng & Phụ Kiện Handmade Thủ Công
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Hotline: 0987 654 321
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">MÃ ĐƠN HÀNG</div>
                  <div className="text-lg font-black font-mono text-slate-900">#{order.id}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{formattedDate}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Khách Hàng Nhận</div>
                  <div className="font-bold text-slate-900 text-sm">{order.name || order.customerName || 'Khách hàng'}</div>
                  <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">{order.phone || 'Chưa có SĐT'}</div>
                  {order.sellerName && (
                    <div className="text-[11px] text-amber-900 font-medium mt-1">Phụ trách: {order.sellerName}</div>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Địa Chỉ Nhận Hàng</div>
                  <div className="text-slate-800 leading-snug">{order.address || 'Nhận tại xưởng / Thỏa thuận qua tin nhắn'}</div>
                  {getCleanOrderNote(order.note) && (
                    <div className="text-[11px] text-amber-900 italic font-semibold mt-1">
                      * Ghi chú: {getCleanOrderNote(order.note)}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Sản Phẩm</th>
                      <th className="p-2.5 text-center w-12">SL</th>
                      <th className="p-2.5 text-right w-24">Đơn Giá</th>
                      <th className="p-2.5 text-right w-28">Thành Tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {order.itemDetails && order.itemDetails.length > 0 ? (
                      order.itemDetails.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900">{it.productName}</div>
                            <div className="text-[11px] text-slate-500">
                              {[
                                it.selectedSize ? `Size: ${it.selectedSize}` : '',
                                it.selectedColor ? `Màu: ${it.selectedColor}` : '',
                                it.selectedCharm ? `Charm: ${typeof it.selectedCharm === 'object' ? (it.selectedCharm as any).name : it.selectedCharm}${it.selectedCharmPrice ? ` (+${it.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''}` : '',
                                it.selectedKhoen ? `Khoen: ${it.selectedKhoen}${it.selectedKhoenPrice ? ` (+${it.selectedKhoenPrice.toLocaleString('vi-VN')}đ)` : ''}` : '',
                                it.selectedOmamoris && it.selectedOmamoris.length > 0 ? `Bùa: ${it.selectedOmamoris.map((o) => o.name).join(', ')}${it.selectedOmamoriPrice ? ` (+${it.selectedOmamoriPrice.toLocaleString('vi-VN')}đ)` : ''}` : ''
                              ].filter(Boolean).join(' | ')}
                            </div>
                            {it.selectedComboItems && it.selectedComboItems.length > 0 && (
                              <div className="text-[10px] text-stone-800 bg-stone-100 p-1.5 rounded mt-1 border border-stone-200">
                                <strong>Combo {it.selectedComboItems.length} món:</strong>
                                {it.selectedComboItems.map((c, i) => (
                                  <div key={i} className="pl-1">
                                    • {c.itemTitle}: {[c.selectedColor, c.selectedCharms?.map(x=>x.name).join(','), c.selectedOmamoris?.map(x=>x.name).join(','), c.selectedKhoen].filter(Boolean).join(' - ')}
                                  </div>
                                ))}
                              </div>
                            )}
                            {it.customNote && (
                              <div className="text-[10px] text-amber-800 italic mt-0.5">
                                * {it.customNote}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-900">{it.quantity || 1}</td>
                          <td className="p-2.5 text-right font-mono text-slate-700">
                            {(it.price || (it as any).unitPrice || 0).toLocaleString('vi-VN')}đ
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            {((it.price || (it as any).unitPrice || 0) * (it.quantity || 1)).toLocaleString('vi-VN')}đ
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-2.5 text-slate-800">
                          {Array.isArray(order.items) ? order.items.join(', ') : order.items ? String(order.items) : 'Sản phẩm phụ kiện handmade'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Tiến trình:</span>
                  <strong className="text-slate-900">{currentStatus}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Thanh toán:</span>
                  <span className="font-bold text-slate-900">
                    {order.paymentMethod === 'bank_transfer'
                      ? 'Chuyển khoản VietQR'
                      : order.paymentMethod === 'cash'
                      ? 'Tiền mặt tại xưởng'
                      : 'Thu COD khi nhận hàng'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tình trạng thanh toán:</span>
                  <strong className={order.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-800'}>
                    {order.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : 'Chờ thu tiền / COD'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tạm tính tiền hàng:</span>
                  <span className="font-bold text-slate-900">
                    {itemsSubtotal.toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Phí giao hàng:</span>
                  <span className={`font-bold ${shippingFee > 0 ? 'text-slate-900' : 'text-emerald-700'}`}>
                    {shippingFee > 0 ? `${shippingFee.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Giảm giá / Ưu đãi:</span>
                    <span className="font-bold">
                      -{discountAmount.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 font-bold text-sm">
                  <span className="text-slate-900">TỔNG TIỀN:</span>
                  <span className="font-mono text-amber-700 text-base">
                    {totalAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>

              <div className="text-center text-[11px] text-slate-500 italic pt-2 border-t border-dashed border-slate-200">
                Cảm ơn bạn đã lựa chọn NOT A KNOT! Chúc quý khách một ngày tốt lành.
              </div>
            </div>

            {/* Bottom action buttons - 3 CLEAN BUTTONS */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
              <span className="text-xs text-slate-500 font-medium truncate max-w-xs">
                {printSuccessToast || 'Phiếu giao nhận đơn hàng'}
              </span>

              <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                  title="Tải phiếu dạng file văn bản (.txt)"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Tải .txt</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPrintTab}
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                  title="In phiếu giao nhận & hóa đơn"
                >
                  <Printer className="w-4 h-4 text-slate-950" />
                  <span>In Phiếu</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyText}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                  title="Sao chép thông tin phiếu đơn hàng"
                >
                  <Copy className="w-4 h-4 text-amber-400" />
                  <span>Sao Chép</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DIALOG: GỬI EMAIL XÁC NHẬN ĐƠN HÀNG */}
      {/* ======================================================== */}
      {isEmailModalOpen && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !isSendingEmail && setIsEmailModalOpen(false)}
        >
          <div
            className="relative max-w-md w-full bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Gửi Email Đơn Hàng #{order.id}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Hóa đơn xác nhận đơn hàng đính kèm logo và thương hiệu Not A Knot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSendingEmail && setIsEmailModalOpen(false)}
                disabled={isSendingEmail}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Order info summary */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-slate-800">{order.name || order.customerName || 'Khách vãng lai'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số điện thoại:</span>
                <span className="font-semibold text-slate-800">{order.phone || 'Chưa cung cấp SĐT'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tổng thanh toán:</span>
                <span className="font-bold text-amber-800 font-mono">{totalAmount.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>

            {/* Email input field */}
            <div className="space-y-2 text-xs">
              <label className="block text-slate-800 font-bold">
                Địa chỉ email người nhận:
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={targetEmailInput}
                  onChange={(e) => {
                    setTargetEmailInput(e.target.value);
                    if (emailModalError) setEmailModalError(null);
                  }}
                  onBlur={() => {
                    if (targetEmailInput.trim()) {
                      setTargetEmailInput(ensureGmailDomain(targetEmailInput));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSendingEmail) {
                      e.preventDefault();
                      handleConfirmSendOrderEmail();
                    }
                  }}
                  placeholder="Nhập email người nhận (ví dụ: khach@gmail.com hoặc gõ tên)..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Quick suggestion buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-slate-400 font-medium">Gợi ý nhanh:</span>
                {(order.email || (order as any).customerEmail) && (
                  <button
                    type="button"
                    onClick={() => {
                      const cust = ensureGmailDomain(order.email || (order as any).customerEmail);
                      setTargetEmailInput(cust);
                    }}
                    className="text-[11px] px-2 py-0.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    Khách ({ensureGmailDomain(order.email || (order as any).customerEmail)})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTargetEmailInput('noreply.notaknot@gmail.com')}
                  className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Admin (noreply.notaknot@gmail.com)
                </button>
              </div>

              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2 font-medium leading-relaxed">
                💡 <strong>Mẹo tiện lợi:</strong> Tự động bổ sung đuôi <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono font-bold">@gmail.com</code> nếu không gõ tên miền (ví dụ: gõ <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono font-bold">abc</code> ➔ <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono font-bold">abc@gmail.com</code>).
              </p>

              {emailModalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <X className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{emailModalError}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                disabled={isSendingEmail}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmSendOrderEmail}
                disabled={isSendingEmail}
                className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all"
              >
                {isSendingEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang gửi email...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi Email Ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating notification toast in Order Details Modal */}
      {printSuccessToast && (
        <div className="fixed top-5 right-5 z-[70] bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-2.5 text-xs font-semibold backdrop-blur-sm max-w-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="leading-snug">{printSuccessToast}</span>
        </div>
      )}
    </>
  );
};
