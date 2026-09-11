import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ShoppingBag, 
  Trash2, 
  CheckCircle2, 
  ShieldCheck, 
  Truck, 
  Copy, 
  Check, 
  ExternalLink, 
  MessageCircle, 
  QrCode, 
  CreditCard, 
  Phone, 
  MapPin, 
  User, 
  FileText, 
  Download, 
  Search,
  ChevronRight,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { CartItem, SiteContentConfig } from '../types';
import { saveOrderToFirestore, StoredOrder } from '../firebase';
import { trackGA4BeginCheckout, trackGA4Purchase } from '../utils/analytics';
import { generateTrackingNumber, removeVietnameseTones } from '../utils/orderFormatters';

interface CartPageProps {
  cartItems: CartItem[];
  siteContent?: SiteContentConfig;
  facebookUrl?: string;
  messengerUrl?: string;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onOrderPlaced: (orderData: StoredOrder) => void;
  onContinueShopping: () => void;
  onOpenOrderTracker: (trackingCode?: string) => void;
}

export const CartPage: React.FC<CartPageProps> = ({
  cartItems,
  siteContent,
  facebookUrl = 'https://www.facebook.com/profile.php?id=61593591390851',
  messengerUrl = 'https://m.me/61593591390851',
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderPlaced,
  onContinueShopping,
  onOpenOrderTracker
}) => {
  // Page Steps: 'checkout' (Cart & Form) | 'success' (Order Placed & VietQR)
  const [step, setStep] = useState<'checkout' | 'success'>('checkout');

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'vietqr' | 'cod'>('vietqr');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Placed Order Details for Success Screen (persists even after onClearCart)
  const [placedOrder, setPlacedOrder] = useState<StoredOrder | null>(null);
  const [placedTotal, setPlacedTotal] = useState<number>(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Bank Configuration
  const bankConfig = siteContent?.bankAccount || {
    bankId: 'VCB',
    bankName: 'Vietcombank',
    accountNumber: '1028394859',
    accountHolder: 'VU NGOC MANH CUONG',
    branch: 'Sở Giao Dịch',
    qrTemplate: 'compact2'
  };

  const hotline = siteContent?.phone || '079 655 5636';

  // Calculate Subtotal
  const subtotal = cartItems.reduce(
    (acc, item) =>
      acc +
      (item.product.price + (item.selectedCharmPrice || 0) + (item.selectedOmamoriPrice || 0)) *
        item.quantity,
    0
  );

  // Track Begin Checkout on mount if items exist
  useEffect(() => {
    if (cartItems.length > 0 && step === 'checkout') {
      trackGA4BeginCheckout(cartItems, subtotal);
    }
  }, [cartItems, step, subtotal]);

  // Copy helper
  const copyToClipboard = async (text: string, fieldKey: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2500);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  // Build items description
  const formatCartItemsText = () => {
    return cartItems.map((item) => {
      const unitPrice =
        item.product.price + (item.selectedCharmPrice || 0) + (item.selectedOmamoriPrice || 0);
      let desc = `${item.product.name} (x${item.quantity}) - ${(unitPrice * item.quantity).toLocaleString('vi-VN')}đ`;
      const extras = [];
      if (item.selectedColor) extras.push(`Màu: ${item.selectedColor}`);
      if (item.selectedCharms && item.selectedCharms.length > 0) {
        const names = item.selectedCharms.map((c) => c.name).join(', ');
        extras.push(
          `Charm: ${names}${
            item.selectedCharmPrice ? ` (+${item.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      } else if (item.selectedCharm) {
        extras.push(
          `Charm: ${item.selectedCharm}${
            item.selectedCharmPrice ? ` (+${item.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      }
      if (item.selectedOmamoris && item.selectedOmamoris.length > 0) {
        const omNames = item.selectedOmamoris.map((o) => o.name).join(', ');
        extras.push(
          `Bùa Omamori: ${omNames}${
            item.selectedOmamoriPrice ? ` (+${item.selectedOmamoriPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      }
      if (item.selectedSize) extras.push(`Size: ${item.selectedSize}`);
      if (item.customNote) extras.push(`Ghi chú: ${item.customNote}`);
      if (extras.length > 0) desc += ` [${extras.join(', ')}]`;
      return desc;
    });
  };

  // Handle Order Submit
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();

    if (!cleanName) {
      setFormError('Vui lòng nhập Họ và tên người nhận.');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 9) {
      setFormError('Vui lòng nhập Số điện thoại hợp lệ (ít nhất 9 chữ số).');
      return;
    }
    if (!cleanAddress) {
      setFormError('Vui lòng nhập Địa chỉ nhận hàng chi tiết.');
      return;
    }
    if (cartItems.length === 0) {
      setFormError('Giỏ hàng của bạn đang trống.');
      return;
    }

    setIsSubmitting(true);

    const trackingCode = generateTrackingNumber();
    const currentOrderTotal = subtotal;

    const itemDetails = cartItems.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      category: item.product.category,
      price: item.product.price + (item.selectedCharmPrice || 0) + (item.selectedOmamoriPrice || 0),
      quantity: item.quantity,
      selectedColor: item.selectedColor,
      selectedColorImage: item.selectedColorImage,
      selectedCharm: item.selectedCharm,
      selectedCharmImage: item.selectedCharmImage,
      selectedCharmPrice: item.selectedCharmPrice,
      selectedCharms: item.selectedCharms,
      selectedOmamoris: item.selectedOmamoris,
      selectedOmamoriPrice: item.selectedOmamoriPrice,
      selectedSize: item.selectedSize,
      customNote: item.customNote
    }));

    const orderData: StoredOrder = {
      id: trackingCode,
      trackingNumber: trackingCode,
      date: new Date().toLocaleString('vi-VN'),
      createdAt: new Date().toISOString(),
      name: cleanName,
      customerName: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      note: note.trim() ? note.trim() : undefined,
      items: formatCartItemsText(),
      itemDetails,
      totalPrice: currentOrderTotal,
      totalAmount: currentOrderTotal,
      source: 'website' as const,
      type: 'standard_order' as const,
      status: 'Chờ xác nhận' as const,
      paymentMethod: paymentMethod === 'vietqr' ? ('bank_transfer' as const) : ('cod' as const),
      paymentStatus: 'unpaid' as const
    };

    try {
      await saveOrderToFirestore(orderData);
    } catch (err) {
      console.warn('Fallback saving order to local storage:', err);
    }

    // Save to local storage
    try {
      const local = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
      local.unshift(orderData);
      localStorage.setItem('nak_preorders', JSON.stringify(local));
    } catch {
      // ignore localstorage errors
    }

    // Retain state for success view BEFORE clearing cart
    setPlacedOrder(orderData);
    setPlacedTotal(currentOrderTotal);
    onOrderPlaced(orderData);
    trackGA4Purchase(
      orderData.id || trackingCode,
      currentOrderTotal,
      orderData.itemDetails,
      paymentMethod === 'vietqr' ? 'VietQR_Banking' : 'COD_System'
    );

    setIsSubmitting(false);
    setStep('success');
    onClearCart();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build VietQR Image URL and Memo
  const finalOrderAmount = Math.round(Number(placedOrder?.totalPrice || placedOrder?.totalAmount || placedTotal || 0));
  const finalCustomerName = (placedOrder?.customerName || placedOrder?.name || name || '').trim();
  const finalCustomerPhone = (placedOrder?.phone || phone || '').trim();

  // User specification: "Nội dung ck là Họ và tên người mua + số điện thoại"
  const rawTransferMemo = `${finalCustomerName} ${finalCustomerPhone}`.trim();
  const cleanAsciiMemo = removeVietnameseTones(rawTransferMemo).toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim() || `NOTAKNOT ${finalCustomerPhone}`;

  const cleanBankId = (bankConfig.bankId || 'VCB').toUpperCase().trim();
  const cleanAccountNo = (bankConfig.accountNumber || '').replace(/[^0-9a-zA-Z]/g, '');
  const cleanAccountHolder = (bankConfig.accountHolder || 'NOT A KNOT').toUpperCase().trim();
  const qrTemplate = bankConfig.qrTemplate || 'compact2';

  // Exact VietQR standard URL
  const vietQrUrl = `https://img.vietqr.io/image/${cleanBankId}-${cleanAccountNo}-${qrTemplate}.png?amount=${finalOrderAmount}&addInfo=${encodeURIComponent(cleanAsciiMemo)}&accountName=${encodeURIComponent(cleanAccountHolder)}`;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 pb-20 pt-6 sm:pt-8 font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Navigation Breadcrumbs & Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
            <button
              onClick={onContinueShopping}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-amber-700 transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Tiếp tục chọn phụ kiện</span>
            </button>

            {/* Stepper Pill Indicator */}
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className={`px-3 py-1 rounded-full ${step === 'checkout' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
                1. Giỏ hàng & Thanh toán
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className={`px-3 py-1 rounded-full ${step === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                2. Hoàn tất & Chuyển khoản
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* VIEW 1: ACTIVE CART & CHECKOUT FORM                          */}
        {/* ============================================================ */}
        {step === 'checkout' && (
          <div>
            {cartItems.length === 0 ? (
              /* Empty Cart State */
              <div className="bg-white rounded-3xl border border-slate-200/90 p-10 sm:p-16 text-center max-w-lg mx-auto shadow-xs">
                <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-5">
                  <ShoppingBag className="w-10 h-10 stroke-[1.5]" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 font-display">
                  Giỏ hàng của bạn đang trống
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-8">
                  Hãy khám phá những tác phẩm vòng tay và phụ kiện Paracord 550 thủ công độc bản được chế tác tỉ mỉ dành riêng cho bạn.
                </p>
                <button
                  onClick={onContinueShopping}
                  className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Khám phá bộ sưu tập ngay</span>
                </button>
              </div>
            ) : (
              /* Two-Column Spacious Checkout Layout */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Column (8 cols): Cart Items + Shipping Form + Payment Method */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-8">
                  
                  {/* Section A: Selected Products */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <ShoppingBag className="w-5 h-5 text-amber-600" />
                        <h2 className="text-base sm:text-lg font-black text-slate-900">
                          Sản phẩm trong giỏ ({cartItems.reduce((s, i) => s + i.quantity, 0)})
                        </h2>
                      </div>

                      {showClearConfirm ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-rose-600 font-bold">Xóa tất cả?</span>
                          <button
                            type="button"
                            onClick={() => {
                              onClearCart();
                              setShowClearConfirm(false);
                            }}
                            className="text-rose-700 font-black hover:underline cursor-pointer"
                          >
                            Có
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            type="button"
                            onClick={() => setShowClearConfirm(false)}
                            className="text-slate-500 font-medium hover:underline cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(true)}
                          className="text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa giỏ</span>
                        </button>
                      )}
                    </div>

                    {/* Cart Items List */}
                    <div className="divide-y divide-slate-100">
                      {cartItems.map((item, index) => {
                        const unitPrice =
                          item.product.price +
                          (item.selectedCharmPrice || 0) +
                          (item.selectedOmamoriPrice || 0);
                        const lineSubtotal = unitPrice * item.quantity;
                        const itemImage = item.selectedColorImage || item.product.image;

                        return (
                          <div key={index} className="py-4 sm:py-5 first:pt-0 last:pb-0 flex gap-4 sm:gap-5">
                            {/* Product Thumbnail */}
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 border border-slate-200/80 overflow-hidden flex-shrink-0 relative">
                              <img
                                src={itemImage}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                                    {item.product.name}
                                  </h3>
                                  <button
                                    type="button"
                                    onClick={() => onRemoveItem(index)}
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer flex-shrink-0"
                                    title="Xóa sản phẩm này"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Custom Attributes: Wrist Size, Color, Charms, Omamori */}
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs">
                                  {item.selectedSize && (
                                    <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-bold text-[11px]">
                                      Size: {item.selectedSize}
                                    </span>
                                  )}
                                  {item.selectedColor && (
                                    <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-medium text-[11px]">
                                      Màu: {item.selectedColor}
                                    </span>
                                  )}
                                  {item.selectedCharms && item.selectedCharms.length > 0 ? (
                                    <span className="inline-flex flex-wrap items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/60 px-2.5 py-0.5 rounded-md font-medium text-[11px]">
                                      Charm: {item.selectedCharms.map((c) => c.name).join(', ')} {item.selectedCharmPrice ? `(+${item.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''}
                                    </span>
                                  ) : item.selectedCharm ? (
                                    <span className="bg-amber-50 text-amber-800 border border-amber-200/60 px-2.5 py-0.5 rounded-md font-medium text-[11px]">
                                      Charm: {item.selectedCharm} {item.selectedCharmPrice ? `(+${item.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''}
                                    </span>
                                  ) : null}

                                  {item.selectedOmamoris && item.selectedOmamoris.length > 0 && (
                                    <span className="inline-flex flex-wrap items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200/60 px-2.5 py-0.5 rounded-md font-medium text-[11px]">
                                      Bùa Omamori: {item.selectedOmamoris.map((o) => o.name).join(', ')} {item.selectedOmamoriPrice ? `(+${item.selectedOmamoriPrice.toLocaleString('vi-VN')}đ)` : ''}
                                    </span>
                                  )}
                                </div>

                                {item.customNote && (
                                  <p className="text-xs text-amber-800 bg-amber-50/70 p-2 rounded-xl border border-amber-200/50 mt-2 italic">
                                    Ghi chú thợ đan: "{item.customNote}"
                                  </p>
                                )}
                              </div>

                              {/* Price and Quantity Adjuster */}
                              <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                                <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors font-bold text-sm cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="w-10 text-center text-xs font-black text-slate-900 font-mono">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors font-bold text-sm cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="text-right">
                                  <span className="text-sm sm:text-base font-black text-slate-900 font-mono">
                                    {lineSubtotal.toLocaleString('vi-VN')}đ
                                  </span>
                                  {item.quantity > 1 && (
                                    <span className="block text-[11px] text-slate-400 font-mono">
                                      {unitPrice.toLocaleString('vi-VN')}đ / cái
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section B: Recipient Details Form */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
                    <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                      <MapPin className="w-5 h-5 text-amber-600" />
                      <h2 className="text-base sm:text-lg font-black text-slate-900">
                        Thông tin giao hàng
                      </h2>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Name */}
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                            Họ và tên người nhận <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Ví dụ: Nguyễn Văn A"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 focus:outline-hidden transition-colors"
                            />
                            <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                          </div>
                        </div>

                        {/* Phone */}
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                            Số điện thoại <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="Ví dụ: 0912345678"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-medium text-slate-900 focus:bg-white focus:border-amber-400 focus:outline-hidden transition-colors"
                            />
                            <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      {/* Address */}
                      <div>
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                          Địa chỉ nhận hàng chi tiết <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 focus:outline-hidden transition-colors"
                        />
                      </div>

                      {/* Note */}
                      <div>
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                          Ghi chú thêm cho thợ đan & shipper (không bắt buộc)
                        </label>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 focus:outline-hidden transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section C: Payment Method Selection */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
                    <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                      <CreditCard className="w-5 h-5 text-amber-600" />
                      <h2 className="text-base sm:text-lg font-black text-slate-900">
                        Phương thức thanh toán
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Option 1: VietQR */}
                      <div
                        onClick={() => setPaymentMethod('vietqr')}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          paymentMethod === 'vietqr'
                            ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${paymentMethod === 'vietqr' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                <QrCode className="w-4 h-4" />
                              </div>
                              <span className="text-sm font-black text-slate-900">
                                Chuyển khoản VietQR
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                              Khuyên dùng
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Mã QR thông minh tự động điền số tiền & nội dung theo họ tên và SĐT của bạn. Chế tác và giao hàng nhanh hơn.
                          </p>
                        </div>

                        <div className="mt-4 pt-2 border-t border-slate-200/60 flex items-center gap-2 text-xs font-bold text-amber-900">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${paymentMethod === 'vietqr' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'}`}>
                            {paymentMethod === 'vietqr' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span>Xác nhận tự động 24/7</span>
                        </div>
                      </div>

                      {/* Option 2: COD */}
                      <div
                        onClick={() => setPaymentMethod('cod')}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          paymentMethod === 'cod'
                            ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${paymentMethod === 'cod' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                <Truck className="w-4 h-4" />
                              </div>
                              <span className="text-sm font-black text-slate-900">
                                Thanh toán khi nhận (COD)
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Thanh toán tiền mặt cho nhân viên giao hàng khi nhận kiện hàng. Được đồng kiểm tra hàng trước khi thanh toán.
                          </p>
                        </div>

                        <div className="mt-4 pt-2 border-t border-slate-200/60 flex items-center gap-2 text-xs font-bold text-amber-900">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${paymentMethod === 'cod' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'}`}>
                            {paymentMethod === 'cod' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span>Kiểm tra hàng trước khi trả</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right Column (4-5 cols): Sticky Summary & Submit Button */}
                <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-5">
                  
                  {/* Summary Card */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
                    <h3 className="text-base font-black text-slate-900 pb-4 mb-4 border-b border-slate-100">
                      Tóm tắt thanh toán
                    </h3>

                    <div className="space-y-3.5 text-xs sm:text-sm">
                      <div className="flex items-center justify-between gap-2 text-slate-600">
                        <span className="whitespace-nowrap font-medium">Đơn hàng</span>
                        <span className="font-mono font-bold text-slate-900 whitespace-nowrap">
                          {subtotal.toLocaleString('vi-VN')}đ
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-slate-600">
                        <span className="whitespace-nowrap font-medium">Phí vận chuyển</span>
                        <span className="font-bold text-emerald-700 whitespace-nowrap">
                          Miễn phí
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-slate-600">
                        <span className="whitespace-nowrap font-medium">Hình thức</span>
                        <span className="font-bold text-slate-800 whitespace-nowrap">
                          {paymentMethod === 'vietqr' ? 'Chuyển khoản' : 'Ship COD'}
                        </span>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide whitespace-nowrap">
                          Tổng thanh toán:
                        </span>
                        <span className="text-xl sm:text-2xl font-black text-amber-600 font-mono whitespace-nowrap">
                          {subtotal.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>

                    {/* Error Message */}
                    {formError && (
                      <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Submit CTA */}
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleCheckoutSubmit}
                      className="w-full mt-6 py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Đang gửi đơn hàng...</span>
                        </>
                      ) : (
                        <span>Xác nhận đặt hàng</span>
                      )}
                    </button>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: ORDER PLACED & LARGE VIETQR DISPLAY                  */}
        {/* ============================================================ */}
        {step === 'success' && placedOrder && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
            
            {/* Top Success Banner */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 stroke-[2]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-display">
                Đặt Hàng Thành Công!
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-lg mx-auto">
                Cảm ơn bạn đã lựa chọn NOT A KNOT. Chúng tôi sẽ giao sản phẩm của bạn trong thời gian sớm nhất.
              </p>

              {/* Tracking Code Highlight Box */}
              <div className="mt-5 inline-flex flex-col sm:flex-row items-center gap-3 bg-amber-50/80 border border-amber-200/80 px-5 py-3 rounded-2xl">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900">
                  Mã tra cứu tiến độ đơn hàng:
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-base sm:text-lg text-slate-950 tracking-wider">
                    {placedOrder.trackingNumber || placedOrder.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(placedOrder.trackingNumber || placedOrder.id || '', 'trackingCode')}
                    className="p-1.5 rounded-lg bg-white border border-amber-200 text-slate-700 hover:text-amber-800 transition-colors cursor-pointer"
                    title="Sao chép mã tra cứu"
                  >
                    {copiedField === 'trackingCode' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* IF VIETQR: HUGE QR CODE + EXPLICIT AMOUNT & MEMO           */}
            {/* ========================================================= */}
            {placedOrder.paymentMethod === 'bank_transfer' && (
              <div className="bg-white rounded-3xl border-2 border-amber-400/80 p-6 sm:p-9 shadow-md">
                
                <div className="text-center max-w-xl mx-auto mb-6 sm:mb-8">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black mb-3">
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Quét mã VietQR chuyển khoản</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-display">
                    Chuyển Khoản Ngân Hàng 24/7
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                    Mở ứng dụng ngân hàng bất kỳ (Vietcombank, MB, Techcombank, TPBank, MoMo...) và quét mã QR dưới đây. Số tiền và nội dung đã được cài đặt tự động.
                  </p>
                </div>

                {/* Big QR Section (Desktop 2-Col / Mobile Stack) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                  
                  {/* Left (5 cols): The HUGE QR Code */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center">
                    <div className="p-3 sm:p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-lg inline-block">
                      <img
                        src={vietQrUrl}
                        alt="Mã QR Chuyển khoản VietQR"
                        className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <a
                      href={vietQrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 text-xs font-bold text-amber-700 hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Mở ảnh QR kích thước lớn</span>
                    </a>
                  </div>

                  {/* Right (7 cols): Large, Clear Bank Credentials Table */}
                  <div className="md:col-span-7 space-y-3.5 text-xs sm:text-sm">
                    
                    {/* Bank Name */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Ngân hàng thụ hưởng
                        </span>
                        <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                          {bankConfig.bankName} ({cleanBankId})
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        {bankConfig.branch || 'Toàn quốc'}
                      </span>
                    </div>

                    {/* Account Number */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Số tài khoản
                        </span>
                        <span className="font-mono font-black text-slate-900 text-base sm:text-lg">
                          {cleanAccountNo}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(cleanAccountNo, 'stk')}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 font-bold text-xs text-slate-800 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        {copiedField === 'stk' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'stk' ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                    </div>

                    {/* Account Holder */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Chủ tài khoản
                        </span>
                        <span className="font-black text-slate-900 uppercase text-sm sm:text-base">
                          {cleanAccountHolder}
                        </span>
                      </div>
                    </div>

                    {/* Amount - HIGHLIGHTED AND CORRECT */}
                    <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider block">
                          Số tiền thanh toán chính xác
                        </span>
                        <span className="font-mono font-black text-emerald-900 text-xl sm:text-2xl">
                          {finalOrderAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(String(finalOrderAmount), 'amount')}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        {copiedField === 'amount' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'amount' ? 'Đã chép' : 'Sao chép số tiền'}</span>
                      </button>
                    </div>

                    {/* Transfer Memo - USER MANDATED: "Họ và tên người mua + số điện thoại" */}
                    <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[11px] font-black text-amber-900 uppercase tracking-wider block">
                          Nội dung chuyển khoản (bắt buộc)
                        </span>
                        <span className="font-bold text-slate-950 text-sm sm:text-base block mt-0.5">
                          {rawTransferMemo || cleanAsciiMemo}
                        </span>
                        <span className="text-[11px] text-amber-800 italic block mt-0.5">
                          (Dạng chuẩn hệ thống ngân hàng: <span className="font-mono font-bold">{cleanAsciiMemo}</span>)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(cleanAsciiMemo, 'memo')}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer flex-shrink-0"
                      >
                        {copiedField === 'memo' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'memo' ? 'Đã chép' : 'Sao chép nội dung'}</span>
                      </button>
                    </div>

                  </div>

                </div>

                {/* Important Notice */}
                <div className="mt-6 pt-5 border-t border-slate-200 text-xs text-slate-600 flex items-start gap-2.5 bg-slate-50 p-4 rounded-2xl">
                  <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Lưu ý:</strong> Vui lòng giữ nguyên nội dung chuyển khoản là <strong>Họ tên + Số điện thoại</strong> để hệ thống tự động xác nhận đơn hàng ngay khi tiền về tài khoản. Bạn nên lưu lại ảnh chụp màn hình sau khi chuyển khoản.
                  </p>
                </div>

              </div>
            )}

            {/* ========================================================= */}
            {/* IF COD: INSTRUCTIONS                                      */}
            {/* ========================================================= */}
            {placedOrder.paymentMethod === 'cod' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      Hình thức thanh toán: Thu tiền khi nhận hàng (COD)
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                      Đơn hàng của bạn sẽ được xưởng đan tay và đóng gói cẩn thận. Bưu tá sẽ liên hệ theo số điện thoại <strong>{placedOrder.phone}</strong> trước khi giao. Vui lòng chuẩn bị số tiền <strong>{(placedOrder.totalPrice || 0).toLocaleString('vi-VN')}đ</strong> khi nhận hàng.
                    </p>
                    <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                      ✓ Được phép đồng kiểm hàng cùng bưu tá để đảm bảo sản phẩm đúng số đo và chất lượng.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Order Review Summary */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4 pb-3 border-b border-slate-100">
                Chi tiết người nhận & sản phẩm
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm mb-6">
                <div>
                  <span className="text-slate-400 block text-xs">Người nhận hàng:</span>
                  <span className="font-bold text-slate-900">{placedOrder.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">Số điện thoại:</span>
                  <span className="font-mono font-bold text-slate-900">{placedOrder.phone}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block text-xs">Địa chỉ nhận:</span>
                  <span className="font-medium text-slate-800">{placedOrder.address}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                {placedOrder.itemDetails && placedOrder.itemDetails.length > 0 ? (
                  placedOrder.itemDetails.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="font-bold text-slate-900">{it.productName}</span>
                        <span className="text-slate-500">(x{it.quantity})</span>
                        {it.selectedSize && <span className="text-slate-400">[{it.selectedSize}]</span>}
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        {((it.price || 0) * it.quantity).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  ))
                ) : Array.isArray(placedOrder.items) ? (
                  placedOrder.items.map((it, idx) => (
                    <div key={idx} className="text-xs text-slate-700">
                      • {it}
                    </div>
                  ))
                ) : placedOrder.items ? (
                  <div className="text-xs text-slate-700">
                    • {String(placedOrder.items)}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenOrderTracker(placedOrder.trackingNumber || placedOrder.id)}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>Tra cứu tiến độ</span>
              </button>

              <button
                type="button"
                onClick={onContinueShopping}
                className="px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Tiếp tục mua sắm</span>
              </button>

              <a
                href={messengerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-amber-400" />
                <span>Nhắn Messenger</span>
              </a>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
