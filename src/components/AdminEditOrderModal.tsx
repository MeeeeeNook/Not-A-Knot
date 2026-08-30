import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Product } from '../types';
import { StoredOrder, saveOrderToFirestore } from '../firebase';

interface EditableOrderItem {
  productId: string;
  productName: string;
  category?: string;
  price: number;
  quantity: number;
  customNote?: string;
}

interface AdminEditOrderModalProps {
  order: StoredOrder;
  products?: Product[];
  allProducts?: Product[];
  onClose: () => void;
  onSaved?: (updatedOrder: StoredOrder) => void;
  onSave?: (updatedOrder: StoredOrder) => void;
}

export const AdminEditOrderModal: React.FC<AdminEditOrderModalProps> = ({
  order,
  products: propProducts,
  allProducts,
  onClose,
  onSaved,
  onSave
}) => {
  const products = propProducts || allProducts || [];
  // Normalize source to 3 allowed
  const normalizeSource = (s?: string): 'website' | 'mạng xã hội' | 'trực tiếp' => {
    if (!s || s === 'website') return 'website';
    if (s === 'facebook' || s === 'zalo' || s === 'instagram' || s === 'tiktok' || s === 'mạng xã hội' || s === 'social') return 'mạng xã hội';
    return 'trực tiếp';
  };

  const [customerName, setCustomerName] = useState(order.name || order.customerName || '');
  const [phone, setPhone] = useState(order.phone || '');
  const [address, setAddress] = useState(order.address || '');
  const [note, setNote] = useState(order.note || '');
  const [source, setSource] = useState<'website' | 'mạng xã hội' | 'trực tiếp'>(normalizeSource(order.source));
  const [status, setStatus] = useState<string>(order.status || 'Đã đặt');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>(
    order.paymentStatus === 'paid' ? 'paid' : 'unpaid'
  );
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'cod'>(
    (order.paymentMethod as any) || (order.bankReceiptImage ? 'bank_transfer' : 'cash')
  );
  const [bankReceiptImage, setBankReceiptImage] = useState<string>(order.bankReceiptImage || '');
  const [bankTransferRef, setBankTransferRef] = useState<string>(order.bankTransferRef || '');
  const [isSaving, setIsSaving] = useState(false);
  const [previewZoomReceipt, setPreviewZoomReceipt] = useState(false);

  // Initialize editable item list
  const [items, setItems] = useState<EditableOrderItem[]>(() => {
    if (order.itemDetails && order.itemDetails.length > 0) {
      return order.itemDetails.map((it) => ({
        productId: it.productId || 'custom',
        productName: it.productName,
        category: it.category || 'Khác',
        price: it.unitPrice || it.price || 0,
        quantity: it.quantity || 1,
        customNote: it.customNote || ''
      }));
    }
    if (order.items && order.items.length > 0) {
      return order.items.map((itStr, idx) => ({
        productId: `item-${idx}`,
        productName: itStr,
        price: 0,
        quantity: 1
      }));
    }
    return [];
  });

  // Adding new product state
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedAddProductId, setSelectedAddProductId] = useState<string>(products[0]?.id || '');
  const [addQty, setAddQty] = useState<number | string>(1);
  const [addCustomNote, setAddCustomNote] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate total price
  const calculatedTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  }, [items]);

  const handleUpdateItemQty = (index: number, newQty: number) => {
    const qtyVal = Math.max(1, newQty);
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: qtyVal };
      return next;
    });
  };

  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], price: Math.max(0, newPrice) };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddProductToItems = () => {
    const prod = products.find((p) => p.id === selectedAddProductId);
    if (!prod) return;

    const parsedQty = typeof addQty === 'string' ? (parseInt(addQty, 10) || 1) : addQty;
    const finalQty = Math.max(1, parsedQty);

    // Check if already in list
    const existingIndex = items.findIndex((it) => it.productId === prod.id);
    if (existingIndex >= 0) {
      setItems((prev) => {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + finalQty,
          customNote: addCustomNote ? `${next[existingIndex].customNote || ''} ${addCustomNote}`.trim() : next[existingIndex].customNote
        };
        return next;
      });
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          category: prod.category,
          price: prod.price,
          quantity: finalQty,
          customNote: addCustomNote
        }
      ]);
    }

    // Reset add state
    setIsAddingProduct(false);
    setAddQty(1);
    setAddCustomNote('');
    setProductSearch('');
  };

  // Image upload handling
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setBankReceiptImage(compressed);
        } else {
          setBankReceiptImage(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Paste support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;
      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.indexOf('image') !== -1) {
          const blob = clipboardItems[i].getAsFile();
          if (blob) {
            processImageFile(blob);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Vui lòng nhập tên khách hàng.');
      return;
    }
    if (!phone.trim()) {
      alert('Vui lòng nhập số điện thoại khách hàng.');
      return;
    }
    if (items.length === 0) {
      alert('Đơn hàng phải có ít nhất 1 sản phẩm.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedOrder: StoredOrder = {
        ...order,
        name: customerName.trim(),
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        note: note.trim(),
        source,
        status,
        paymentStatus,
        paymentMethod,
        bankReceiptImage: bankReceiptImage || undefined,
        bankTransferRef: bankTransferRef.trim() || undefined,
        totalPrice: calculatedTotal,
        totalAmount: calculatedTotal,
        paidAmount: paymentStatus === 'paid' ? calculatedTotal : 0,
        itemDetails: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          category: it.category,
          unitPrice: it.price,
          price: it.price,
          quantity: it.quantity,
          customNote: it.customNote
        })),
        items: items.map((it) => `${it.productName} (x${it.quantity})`)
      };

      await saveOrderToFirestore(updatedOrder);
      if (typeof onSaved === 'function') {
        onSaved(updatedOrder);
      } else if (typeof onSave === 'function') {
        onSave(updatedOrder);
      }
      onClose();
    } catch (err) {
      console.error('Lỗi khi lưu chỉnh sửa đơn hàng:', err);
      alert('Có lỗi xảy ra khi lưu đơn hàng. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProductsForAdd = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [products, productSearch]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-slate-200 shadow-2xl relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              Chỉnh Sửa Đơn Hàng #{order.id}
            </h3>
            <p className="text-xs text-slate-500">
              Ngày đặt: {order.date || order.createdAt || 'N/A'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-slate-400 hover:text-slate-900 rounded text-xs font-bold hover:bg-slate-100 transition-colors"
          >
            Đóng [X]
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSaveOrder} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
            
            {/* Section 1: Customer & Source Info */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                1. Thông Tin Khách Hàng & Nguồn Đơn
              </span>

              {/* Source selection (3 sources only) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nguồn đơn hàng *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'website', label: 'Website' },
                    { id: 'mạng xã hội', label: 'Mạng xã hội' },
                    { id: 'trực tiếp', label: 'Trực tiếp' }
                  ].map((s) => {
                    const isSelected = source === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSource(s.id as any)}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên khách hàng *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số điện thoại *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa chỉ giao hàng
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú đơn hàng (Note)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú yêu cầu của khách hoặc nhân viên..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Section 2: Order Status & Payment Status */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                2. Trạng Thái & Thanh Toán
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Trạng thái đơn *
                  </label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="Đã đặt">Đã đặt</option>
                    <option value="Đã thanh toán">Đã thanh toán</option>
                    <option value="Đã giao">Đã giao</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tình trạng thanh toán *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentStatus('paid')}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                        paymentStatus === 'paid'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Đã thanh toán
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentStatus('unpaid')}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                        paymentStatus === 'unpaid'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Chưa thanh toán
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment Method & Bank Ref */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hình thức thanh toán
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none"
                  >
                    <option value="bank_transfer">Chuyển khoản (VietQR / Banking)</option>
                    <option value="cash">Tiền mặt tại xưởng</option>
                    <option value="cod">Thu tiền khi giao</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã GD / Nội dung chuyển khoản
                  </label>
                  <input
                    type="text"
                    value={bankTransferRef}
                    onChange={(e) => setBankTransferRef(e.target.value)}
                    placeholder="Ví dụ: MB-883921"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Bill Receipt Upload / Preview */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ảnh Bill chuyển khoản
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      processImageFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {bankReceiptImage ? (
                  <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={bankReceiptImage}
                        alt="Bill Receipt"
                        className="w-14 h-14 rounded object-cover border border-slate-300 cursor-pointer"
                        onClick={() => setPreviewZoomReceipt(true)}
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Đã có ảnh Bill
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewZoomReceipt(true)}
                            className="text-[11px] text-slate-600 hover:text-slate-900 underline font-bold"
                          >
                            Xem ảnh
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[11px] text-slate-800 hover:text-black underline font-bold"
                          >
                            Đổi ảnh
                          </button>
                          <button
                            type="button"
                            onClick={() => setBankReceiptImage('')}
                            className="text-[11px] text-rose-600 hover:text-rose-700 underline font-bold"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-white p-3 rounded-lg text-center cursor-pointer transition-colors"
                  >
                    <span className="text-xs font-bold text-slate-700 block">
                      Bấm để tải ảnh Bill hoặc dán Ctrl+V
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Ordered Items Table & Editor */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  3. Danh Sách Sản Phẩm Trong Đơn
                </span>

                <button
                  type="button"
                  onClick={() => setIsAddingProduct(!isAddingProduct)}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  + Thêm sản phẩm
                </button>
              </div>

              {/* Inline Product Picker to Add */}
              {isAddingProduct && (
                <div className="bg-white p-3 rounded-lg border border-slate-300 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                    <span className="font-bold text-xs text-slate-900">Chọn sản phẩm:</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Tìm kiếm sản phẩm..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />

                    <select
                      value={selectedAddProductId}
                      onChange={(e) => setSelectedAddProductId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                    >
                      {filteredProductsForAdd.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - {p.price.toLocaleString('vi-VN')}đ (Kho: {p.stock ?? 15})
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-500 font-bold mb-1">Số lượng:</label>
                        <div className="flex items-center border border-slate-300 rounded-lg bg-slate-50 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              const curr = typeof addQty === 'string' ? (parseInt(addQty, 10) || 1) : addQty;
                              setAddQty(Math.max(1, curr - 1));
                            }}
                            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={addQty}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAddQty(val === '' ? '' : Math.max(0, parseInt(val, 10) || 0));
                            }}
                            onBlur={() => {
                              if (addQty === '' || Number(addQty) < 1) {
                                setAddQty(1);
                              }
                            }}
                            className="w-full text-center bg-transparent text-xs font-bold text-slate-900 focus:outline-none py-1"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const curr = typeof addQty === 'string' ? (parseInt(addQty, 10) || 1) : addQty;
                              setAddQty(curr + 1);
                            }}
                            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 pt-4">
                        <button
                          type="button"
                          onClick={handleAddProductToItems}
                          className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
                        >
                          Thêm Vào Đơn
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2 divide-y divide-slate-200">
                {items.map((it, idx) => (
                  <div key={idx} className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 text-xs block">
                        {it.productName}
                      </span>
                      {it.customNote && (
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          Ghi chú: {it.customNote}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Price input */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Giá:</span>
                        <input
                          type="number"
                          value={it.price}
                          onChange={(e) => handleUpdateItemPrice(idx, Number(e.target.value))}
                          className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-right"
                        />
                        <span className="text-[10px] text-slate-500">đ</span>
                      </div>

                      {/* Quantity buttons */}
                      <div className="flex items-center border border-slate-300 rounded-md bg-slate-50">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(idx, it.quantity - 1)}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-200 rounded-l-md font-bold"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-bold text-slate-900 min-w-[20px] text-center">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(idx, it.quantity + 1)}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-200 rounded-r-md font-bold"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-xs font-bold"
                        title="Xóa món này"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Row */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-600 uppercase">Tổng tiền đơn hàng:</span>
                <span className="font-bold text-base text-slate-900">
                  {calculatedTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs border border-slate-300 transition-colors"
            >
              Hủy Bỏ
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </button>
          </div>
        </form>

        {/* Zoom Lightbox */}
        {previewZoomReceipt && bankReceiptImage && (
          <div
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewZoomReceipt(false)}
          >
            <div className="relative max-w-xl w-full bg-white p-3 rounded-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 mb-2">
                <span className="text-xs font-bold text-slate-800">Ảnh Bill phóng to</span>
                <button
                  onClick={() => setPreviewZoomReceipt(false)}
                  className="px-2 py-1 text-slate-400 hover:text-slate-800 rounded text-xs font-bold"
                >
                  Đóng [X]
                </button>
              </div>
              <img
                src={bankReceiptImage}
                alt="Bill Full"
                className="max-h-[70vh] w-auto mx-auto rounded object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
