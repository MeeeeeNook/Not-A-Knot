import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, PaymentMethod, PaymentStatus } from '../types';
import { StoredOrder, saveOrderToFirestore, saveProductToFirestore } from '../firebase';

interface AdminManualOrderFormProps {
  products: Product[];
  onUpdateProducts: (newProducts: Product[]) => void;
  onOrderCreated: (newOrder: StoredOrder) => void;
  onNavigateToOrders: () => void;
}

interface ManualOrderItem {
  product: Product;
  quantity: number;
  customNote?: string;
}

export const AdminManualOrderForm: React.FC<AdminManualOrderFormProps> = ({
  products,
  onUpdateProducts,
  onOrderCreated,
  onNavigateToOrders
}) => {
  // Customer info state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [orderSource, setOrderSource] = useState<'website' | 'mạng xã hội' | 'trực tiếp'>('website');
  const [orderNote, setOrderNote] = useState('');
  const [orderStatus, setOrderStatus] = useState<'Đã đặt' | 'Đã thanh toán' | 'Đã giao'>('Đã đặt');

  // Payment info state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [bankTransferRef, setBankTransferRef] = useState<string>('');
  const [bankReceiptImage, setBankReceiptImage] = useState<string>('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [previewReceiptModal, setPreviewReceiptModal] = useState<string | null>(null);

  // Selected items in this manual order
  const [orderItems, setOrderItems] = useState<ManualOrderItem[]>([]);

  // Item picker & Fast Search state
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [pickerQuantity, setPickerQuantity] = useState<number | string>(1);
  const [pickerNote, setPickerNote] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<StoredOrder | null>(null);

  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  // Helper to compress and convert image file to optimized Base64
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1000;
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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setBankReceiptImage(compressedDataUrl);
        } else {
          setBankReceiptImage(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Global & dropzone Paste listener (Ctrl+V) for payment receipt image
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            processImageFile(blob);
            setPaymentMethod('bank_transfer');
            setPaymentStatus('paid');
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Handle Drag & Drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processImageFile(file);
      setPaymentMethod('bank_transfer');
      setPaymentStatus('paid');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processImageFile(file);
    }
  };

  // Extract unique categories from products
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  // Fast filtered products list for quick search & pick
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter;
      if (!matchCat) return false;
      if (!q) return true;
      const matchName = p.name.toLowerCase().includes(q);
      const matchId = p.id.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q);
      return matchName || matchId || matchDesc;
    });
  }, [products, productSearch, selectedCategoryFilter]);

  const currentSelectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  // Total amount
  const totalAmount = orderItems.reduce((sum, it) => sum + it.product.price * it.quantity, 0);

  // Auto-sync paid amount when total amount changes if full paid
  useEffect(() => {
    if (paymentStatus === 'paid') {
      setPaidAmountInput(totalAmount > 0 ? totalAmount.toString() : '');
    } else if (paymentStatus === 'unpaid') {
      setPaidAmountInput('0');
    }
  }, [totalAmount, paymentStatus]);

  // When selected product changes
  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    setPickerQuantity(1);
  };

  // Add item to temporary order cart
  const handleAddItemToOrder = () => {
    if (!currentSelectedProduct) return;

    const availableStock = currentSelectedProduct.stock ?? (currentSelectedProduct.inStock === false ? 0 : 15);
    if (availableStock <= 0 || currentSelectedProduct.inStock === false) {
      alert(`Sản phẩm "${currentSelectedProduct.name}" đã hết hàng trong kho!`);
      return;
    }

    // Check existing quantity already added
    const existingIndex = orderItems.findIndex(
      (it) => it.product.id === currentSelectedProduct.id
    );

    const parsedPickerQty = typeof pickerQuantity === 'string' ? (parseInt(pickerQuantity, 10) || 1) : pickerQuantity;
    const finalAddQty = Math.max(1, parsedPickerQty);

    if (existingIndex > -1) {
      const existingItem = orderItems[existingIndex];
      const newTotalQty = existingItem.quantity + finalAddQty;
      if (newTotalQty > availableStock) {
        alert(`Số lượng tồn kho chỉ còn ${availableStock} cái. Không thể thêm quá số lượng tồn kho!`);
        return;
      }
      const updated = [...orderItems];
      updated[existingIndex] = {
        ...existingItem,
        quantity: newTotalQty,
        customNote: pickerNote || existingItem.customNote
      };
      setOrderItems(updated);
    } else {
      if (finalAddQty > availableStock) {
        alert(`Số lượng tồn kho chỉ còn ${availableStock} cái. Vui lòng giảm số lượng!`);
        return;
      }
      setOrderItems([
        ...orderItems,
        {
          product: currentSelectedProduct,
          quantity: finalAddQty,
          customNote: pickerNote
        }
      ]);
    }

    setPickerNote('');
    setPickerQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleUpdateItemQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const item = orderItems[index];
    const availableStock = item.product.stock ?? (item.product.inStock === false ? 0 : 15);
    if (newQty > availableStock) {
      alert(`Chỉ còn ${availableStock} cái trong kho!`);
      return;
    }
    const updated = [...orderItems];
    updated[index] = { ...item, quantity: newQty };
    setOrderItems(updated);
  };

  // Submit Order & Auto-Deduct Stock
  const handleSubmitManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      alert('Vui lòng nhập họ và tên khách hàng.');
      return;
    }
    if (!phone.trim()) {
      alert('Vui lòng nhập số điện thoại khách hàng.');
      return;
    }
    if (orderItems.length === 0) {
      alert('Vui lòng thêm ít nhất một sản phẩm vào đơn hàng.');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderId = `ord-man-${Date.now()}`;
      const nowStr = new Date().toLocaleString('vi-VN');
      const nowIso = new Date().toISOString();

      // Format items list
      const formattedItems = orderItems.map((it) => {
        let text = `${it.product.name} (x${it.quantity}) - ${(it.product.price * it.quantity).toLocaleString('vi-VN')}đ`;
        const extra: string[] = [];
        if (it.customNote) extra.push(`Note: ${it.customNote}`);
        if (extra.length > 0) {
          text += ` [${extra.join(', ')}]`;
        }
        return text;
      });

      const itemDetails = orderItems.map((it) => ({
        productId: it.product.id,
        productName: it.product.name,
        category: it.product.category,
        unitPrice: it.product.price,
        price: it.product.price,
        quantity: it.quantity,
        customNote: it.customNote
      }));

      const sourceLabels: Record<string, string> = {
        'mạng xã hội': 'Mạng xã hội',
        'trực tiếp': 'Trực tiếp',
        'website': 'Website'
      };

      const finalNote = orderNote
        ? `[Nguồn: ${sourceLabels[orderSource] || orderSource}] ${orderNote}`
        : `[Nguồn: ${sourceLabels[orderSource] || orderSource}]`;

      const parsedPaid = paidAmountInput ? parseInt(paidAmountInput.replace(/\D/g, ''), 10) || 0 : (paymentStatus === 'paid' ? totalAmount : 0);

      const newOrderRecord: StoredOrder = {
        id: orderId,
        date: nowStr,
        createdAt: nowIso,
        name: customerName.trim(),
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim() || 'Nhận tại xưởng / Thống nhất qua tin nhắn',
        note: finalNote,
        items: formattedItems,
        itemDetails,
        totalPrice: totalAmount,
        totalAmount: totalAmount,
        source: orderSource,
        type: 'standard_order',
        status: orderStatus,
        paymentMethod: paymentMethod,
        paymentStatus: paymentStatus,
        bankReceiptImage: bankReceiptImage || undefined,
        paidAmount: parsedPaid,
        bankTransferRef: bankTransferRef.trim() || undefined
      };

      // 1. Save order to Firebase Firestore
      await saveOrderToFirestore(newOrderRecord);

      // 2. Save order to local storage
      const local = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
      local.unshift(newOrderRecord);
      localStorage.setItem('nak_preorders', JSON.stringify(local));

      // 3. Auto-deduct stock for each product and update Firestore
      let updatedProducts = [...products];
      for (const it of orderItems) {
        const pIndex = updatedProducts.findIndex((p) => p.id === it.product.id);
        if (pIndex > -1) {
          const currentProd = updatedProducts[pIndex];
          const prevStock = currentProd.stock ?? 15;
          const newStock = Math.max(0, prevStock - it.quantity);
          const newInStock = newStock > 0;

          const updatedProd: Product = {
            ...currentProd,
            stock: newStock,
            inStock: newInStock
          };

          updatedProducts[pIndex] = updatedProd;
          await saveProductToFirestore(updatedProd).catch((e) => console.warn('Firestore stock deduct error:', e));
        }
      }

      // Update state in App
      onUpdateProducts(updatedProducts);
      onOrderCreated(newOrderRecord);

      setSubmittedOrder(newOrderRecord);
      setIsSubmitting(false);

      // Reset form
      setCustomerName('');
      setPhone('');
      setAddress('');
      setOrderNote('');
      setBankReceiptImage('');
      setBankTransferRef('');
      setPaidAmountInput('');
      setOrderItems([]);
    } catch (error) {
      console.error('Lỗi khi tạo đơn hàng manual:', error);
      alert('Đã xảy ra lỗi khi lưu đơn hàng. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  };

  const handleResetForNextOrder = () => {
    setSubmittedOrder(null);
  };

  return (
    <div id="admin-manual-order-form" className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white text-slate-900 p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold uppercase tracking-wider mb-1 border border-slate-200">
              Nhập đơn thủ công
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Tạo Đơn Hàng Mới
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Nhập đơn từ Mạng xã hội, Trực tiếp tại xưởng hoặc Website. Hỗ trợ dán Ctrl+V ảnh Bill chuyển khoản và tự động cập nhật kho.
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToOrders}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold whitespace-nowrap self-start sm:self-auto transition-colors"
          >
            Xem Danh Sách Đơn Hàng
          </button>
        </div>
      </div>

      {/* Success Notification Box */}
      {submittedOrder && (
        <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h4 className="text-base font-bold text-emerald-400">
              Đã Tạo Đơn Hàng #{submittedOrder.id} Thành Công
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Đã đồng bộ lên Firebase và tự động trừ tồn kho các sản phẩm liên quan.
            </p>
          </div>

          <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block">Khách hàng:</span>
              <span className="font-bold text-white text-sm">{submittedOrder.name}</span>
              <span className="text-slate-300 block">{submittedOrder.phone}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Tổng tiền:</span>
              <span className="font-bold text-amber-400 text-base">
                {(submittedOrder.totalPrice || 0).toLocaleString('vi-VN')}đ
              </span>
              <span className="text-slate-400 block capitalize">Nguồn: {submittedOrder.source || 'Mạng xã hội'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Thanh toán:</span>
              <span className="font-bold text-white block">
                {submittedOrder.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : submittedOrder.paymentMethod === 'cash' ? 'Tiền mặt' : 'Thu COD'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block mt-0.5 ${
                submittedOrder.paymentStatus === 'paid' ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'
              }`}>
                {submittedOrder.paymentStatus === 'paid' ? 'Đã nhận đủ tiền' : 'Chưa thanh toán'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Bill chuyển khoản:</span>
              {submittedOrder.bankReceiptImage ? (
                <button
                  type="button"
                  onClick={() => setPreviewReceiptModal(submittedOrder.bankReceiptImage || null)}
                  className="mt-1 inline-block px-2.5 py-1 rounded bg-slate-700 text-white text-[11px] font-semibold"
                >
                  Xem Bill
                </button>
              ) : (
                <span className="text-slate-400 block mt-1">Không có bill</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handleResetForNextOrder}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors"
            >
              Tiếp tục tạo đơn mới
            </button>
            <button
              onClick={onNavigateToOrders}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-colors border border-slate-700"
            >
              Xem trong bảng Đơn Hàng
            </button>
          </div>
        </div>
      )}

      {/* Main Order Entry Form */}
      <form onSubmit={handleSubmitManualOrder} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Customer & Payment & Bill Info (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Customer Info Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="pb-2 border-b border-slate-200">
                <h4 className="font-bold text-sm text-slate-900">1. Thông Tin Khách Hàng</h4>
              </div>

              {/* Source Selection (3 sources only) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nguồn đơn hàng *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'website', label: 'Website' },
                    { id: 'mạng xã hội', label: 'Mạng xã hội' },
                    { id: 'trực tiếp', label: 'Trực tiếp' }
                  ].map((src) => {
                    const isSelected = orderSource === src.id;
                    return (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => setOrderSource(src.id as any)}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-bold text-center transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {src.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên khách hàng *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ví dụ: Anh Quân (Quân Paracord)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số điện thoại liên hệ *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ví dụ: 0912345678"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              {/* Delivery Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Địa chỉ giao hàng
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ví dụ: 123 Lê Lợi, P. Bến Thành, Quận 1, TP.HCM"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              {/* Order Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi chú đơn hàng / Chế tác
                </label>
                <textarea
                  rows={2}
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Ví dụ: Giao trước 17h, đóng gói hộp quà..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              {/* Initial Status (3 statuses) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trạng thái đơn khởi tạo
                </label>
                <select
                  value={orderStatus}
                  onChange={(e: any) => setOrderStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="Đã đặt">Đã đặt (Mới tạo)</option>
                  <option value="Đã thanh toán">Đã thanh toán (Đã nhận tiền / CK)</option>
                  <option value="Đã giao">Đã giao (Hoàn tất giao hàng)</option>
                </select>
              </div>
            </div>

            {/* Payment & Bill Proof Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-sm text-slate-900">2. Thanh Toán & Bill Chuyển Khoản</h4>
                {bankReceiptImage && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Đã có Bill CK
                  </span>
                )}
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phương thức thanh toán *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'bank_transfer', label: 'Chuyển khoản' },
                    { id: 'cod', label: 'Thu COD' },
                    { id: 'cash', label: 'Tiền mặt' }
                  ].map((m) => {
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.id as PaymentMethod);
                          if (m.id === 'bank_transfer' || m.id === 'cash') {
                            setPaymentStatus('paid');
                          } else {
                            setPaymentStatus('unpaid');
                          }
                        }}
                        className={`py-2 px-2 rounded-lg border text-xs font-bold text-center transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Status (2 options) & Paid Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tình trạng thanh toán *
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e: any) => {
                      const newStatus = e.target.value;
                      setPaymentStatus(newStatus);
                      if (newStatus === 'paid') {
                        setPaidAmountInput(String(totalAmount));
                      } else {
                        setPaidAmountInput('0');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                  >
                    <option value="paid">Đã thanh toán (100%)</option>
                    <option value="unpaid">Chưa thanh toán</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số tiền khách đã trả (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    placeholder={paymentStatus === 'paid' ? `${totalAmount.toLocaleString('vi-VN')}đ` : '0'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              {/* Bank Transaction Ref (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã giao dịch / Nội dung CK (nếu có)
                </label>
                <input
                  type="text"
                  value={bankTransferRef}
                  onChange={(e) => setBankTransferRef(e.target.value)}
                  placeholder="Ví dụ: MB-883921 / NAK 0912345678"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              {/* Bill Receipt Upload & Paste Dropzone Area */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Ảnh Bill chuyển khoản (Kéo thả hoặc dán Ctrl+V)
                </label>

                {/* Dropzone container */}
                <input
                  ref={receiptFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {!bankReceiptImage ? (
                  <div
                    ref={dropzoneRef}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => receiptFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                      isDraggingFile
                        ? 'border-slate-800 bg-slate-100'
                        : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-800">
                      Bấm để chọn file hoặc Kéo thả ảnh bill vào đây
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Hoặc nhấn <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono">Ctrl + V</kbd> để dán ảnh bill
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50 text-slate-900 rounded-lg p-3 flex items-center justify-between gap-3 border border-slate-200">
                    <div className="flex items-center gap-3">
                      <img
                        src={bankReceiptImage}
                        alt="Bill chuyển khoản"
                        className="w-14 h-14 rounded object-cover border border-slate-300 cursor-pointer"
                        onClick={() => setPreviewReceiptModal(bankReceiptImage)}
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Đã đính kèm ảnh Bill chuyển khoản
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewReceiptModal(bankReceiptImage)}
                            className="text-[11px] text-slate-700 underline font-bold"
                          >
                            Xem ảnh
                          </button>
                          <button
                            type="button"
                            onClick={() => receiptFileInputRef.current?.click()}
                            className="text-[11px] text-slate-700 underline font-bold"
                          >
                            Đổi ảnh
                          </button>
                          <button
                            type="button"
                            onClick={() => setBankReceiptImage('')}
                            className="text-[11px] text-rose-600 underline font-bold"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Fast Search Product Picker & Order Items List (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Product Picker Card with Fast Search */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-sm text-slate-900">3. Chọn Sản Phẩm Thêm Vào Đơn</h4>
                <span className="text-[11px] text-slate-500 font-medium">
                  {products.length} sản phẩm
                </span>
              </div>

              {/* Fast Search Input Bar */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Tìm nhanh: tên vòng, mã sản phẩm, màu sắc..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="px-2.5 py-1 text-slate-500 hover:text-slate-900 text-xs font-bold"
                    >
                      Xóa tìm
                    </button>
                  )}
                </div>

                {/* Quick Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryFilter('all')}
                    className={`px-2.5 py-1 rounded font-bold whitespace-nowrap transition-colors ${
                      selectedCategoryFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({products.length})
                  </button>
                  {availableCategories.map((catKey) => {
                    const count = products.filter((p) => p.category === catKey).length;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setSelectedCategoryFilter(catKey)}
                        className={`px-2.5 py-1 rounded font-semibold whitespace-nowrap transition-colors ${
                          selectedCategoryFilter === catKey
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {catKey} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Search Results Grid (Scrollable Quick Picker) */}
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1 divide-y divide-slate-200">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">
                      Không tìm thấy sản phẩm nào khớp với "{productSearch}".
                    </div>
                  ) : (
                    filteredProducts.map((p) => {
                      const stockVal = p.stock ?? 15;
                      const isOutOfStock = p.inStock === false || stockVal <= 0;
                      const isSelected = selectedProductId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleProductSelect(p.id)}
                          className={`p-2 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-slate-200 border border-slate-400'
                              : 'hover:bg-white bg-white/60 border border-transparent'
                          } ${isOutOfStock ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-10 h-10 rounded object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-slate-900 block truncate">
                                {p.name}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="font-bold text-slate-700">
                                  {p.price.toLocaleString('vi-VN')}đ
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-500 truncate">{p.category}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isOutOfStock ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded">
                                Hết hàng
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                                Còn {stockVal}
                              </span>
                            )}
                            {isSelected && (
                              <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded">
                                Đang chọn
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Product Specs Configurator */}
                {currentSelectedProduct && (
                  <div className="p-3.5 bg-slate-900 text-white rounded-lg border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={currentSelectedProduct.image}
                          alt={currentSelectedProduct.name}
                          className="w-10 h-10 rounded object-cover border border-white/20 shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-white block truncate">
                            {currentSelectedProduct.name}
                          </span>
                          <span className="font-bold text-amber-400 text-xs">
                            {currentSelectedProduct.price.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      </div>

                      <div>
                        {(currentSelectedProduct.stock ?? 15) > 0 && currentSelectedProduct.inStock !== false ? (
                          <span className="px-2 py-0.5 bg-emerald-900 text-emerald-300 text-[10px] font-bold rounded">
                            Kho: {currentSelectedProduct.stock ?? 15} cái
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-900 text-rose-300 text-[10px] font-bold rounded">
                            Hết hàng
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity & Note row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Số lượng đặt
                        </label>
                        <div className="flex items-center border border-slate-700 rounded-lg bg-slate-800 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              const curr = typeof pickerQuantity === 'string' ? (parseInt(pickerQuantity, 10) || 1) : pickerQuantity;
                              setPickerQuantity(Math.max(1, curr - 1));
                            }}
                            className="px-3 py-1 hover:bg-slate-700 font-bold text-xs text-slate-200"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={currentSelectedProduct?.stock ?? 15}
                            value={pickerQuantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPickerQuantity(val === '' ? '' : Math.max(0, parseInt(val, 10) || 0));
                            }}
                            onBlur={() => {
                              if (pickerQuantity === '' || Number(pickerQuantity) < 1) {
                                setPickerQuantity(1);
                              }
                            }}
                            className="w-full text-center bg-transparent font-bold text-xs text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const curr = typeof pickerQuantity === 'string' ? (parseInt(pickerQuantity, 10) || 1) : pickerQuantity;
                              setPickerQuantity(Math.min(currentSelectedProduct?.stock ?? 15, curr + 1));
                            }}
                            className="px-3 py-1 hover:bg-slate-700 font-bold text-xs text-slate-200"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Ghi chú món (nếu có)
                        </label>
                        <input
                          type="text"
                          value={pickerNote}
                          onChange={(e) => setPickerNote(e.target.value)}
                          placeholder="Ví dụ: Đóng gói riêng từng chiếc..."
                          className="w-full px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-white focus:outline-none placeholder-slate-500"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItemToOrder}
                      disabled={!currentSelectedProduct || (currentSelectedProduct.stock ?? 15) <= 0 || currentSelectedProduct.inStock === false}
                      className="w-full py-2 px-4 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 text-xs font-bold rounded-lg transition-colors"
                    >
                      + Thêm Món Này Vào Đơn Hàng
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Order Items Table Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-sm text-slate-900">
                  Danh Sách Sản Phẩm Trong Đơn ({orderItems.reduce((s, i) => s + i.quantity, 0)} món)
                </h4>

                {orderItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOrderItems([])}
                    className="text-xs text-rose-600 hover:underline font-semibold"
                  >
                    Xóa tất cả
                  </button>
                )}
              </div>

              {orderItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-1">
                  <p className="text-xs font-medium">Chưa có sản phẩm nào được thêm vào đơn hàng.</p>
                  <p className="text-[11px] text-slate-400">Tìm và chọn sản phẩm ở ô trên rồi nhấn "+ Thêm Món Này Vào Đơn Hàng".</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orderItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-10 h-10 rounded object-cover border border-slate-200 shrink-0"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-xs text-slate-900 block truncate">
                          {item.product.name}
                        </span>
                        {item.customNote && (
                          <div className="text-[11px] text-amber-800 truncate">
                            Ghi chú: {item.customNote}
                          </div>
                        )}
                        <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                          {(item.product.price * item.quantity).toLocaleString('vi-VN')}đ
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center border border-slate-300 rounded bg-white overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQuantity(idx, item.quantity - 1)}
                            className="px-2 py-0.5 hover:bg-slate-100 font-bold text-slate-700"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                handleUpdateItemQuantity(idx, val);
                              }
                            }}
                            className="w-12 text-center font-bold text-slate-900 focus:outline-none py-0.5 bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQuantity(idx, item.quantity + 1)}
                            className="px-2 py-0.5 hover:bg-slate-100 font-bold text-slate-700"
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

                  {/* Summary & Submit Button */}
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Tổng tiền đơn hàng:
                      </span>
                      <span className="text-lg font-bold text-slate-900">
                        {totalAmount.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || orderItems.length === 0}
                      className="w-full py-3 px-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-all"
                    >
                      {isSubmitting ? 'Đang lưu lên Firebase...' : 'Lưu Đơn Hàng & Tự Động Trừ Kho'}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </form>

      {/* Bill Receipt Zoom Modal */}
      {previewReceiptModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreviewReceiptModal(null)}
        >
          <div
            className="bg-slate-900 rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col p-4 border border-slate-800 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-white">
              <span className="font-bold text-sm">
                Ảnh Bill Chuyển Khoản Khách Hàng
              </span>
              <button
                type="button"
                onClick={() => setPreviewReceiptModal(null)}
                className="px-2 py-1 text-slate-400 hover:text-white rounded text-xs font-bold"
              >
                Đóng [X]
              </button>
            </div>
            <div className="p-2 overflow-auto flex-1 flex items-center justify-center">
              <img
                src={previewReceiptModal}
                alt="Bill Receipt Preview"
                className="max-h-[70vh] w-auto rounded object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
