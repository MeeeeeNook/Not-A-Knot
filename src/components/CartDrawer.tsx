import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CartItem, SiteContentConfig } from '../types';
import { 
  X, 
  Trash2, 
  ShoppingBag, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Truck, 
  MessageCircle, 
  Send, 
  Copy, 
  ExternalLink,
  PhoneCall,
  AlertTriangle,
  Search,
  CreditCard,
  QrCode,
  Check,
  Building2,
  MapPin,
  Gift,
  RefreshCw,
  Ticket,
  Tag
} from 'lucide-react';
import { saveOrderToFirestore } from '../firebase';
import {
  trackGA4BeginCheckout,
  trackGA4Purchase,
  trackGA4ViewCart,
  trackGA4RemoveFromCart,
  trackGA4ApplyCoupon
} from '../utils/analytics';
import { generateTrackingNumber } from '../utils/orderFormatters';
import { VIETNAM_PROVINCES, getDistrictsByProvince, calculateShippingFee } from '../data/vietnamLocations';
import { getVouchers, validateVoucherCode, Voucher } from '../utils/voucherManager';
import { LoadingImage } from './LoadingImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  facebookUrl?: string;
  messengerUrl?: string;
  siteContent?: SiteContentConfig;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onOrderPlaced: (orderData: any) => void;
  onOpenOrderTracker?: (trackingCode: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  facebookUrl = 'https://www.facebook.com/profile.php?id=61593591390851',
  messengerUrl = 'https://m.me/61593591390851',
  siteContent,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderPlaced,
  onOpenOrderTracker
}) => {
  // Steps: 'cart' -> 'select-method' -> 'form-checkout' (if method 1) -> 'success'
  const [step, setStep] = useState<'cart' | 'select-method' | 'form-checkout' | 'success'>('cart');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedMessengerOrder, setCopiedMessengerOrder] = useState(false);
  const [successMode, setSuccessMode] = useState<'system' | 'facebook'>('system');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [createdTrackingCode, setCreatedTrackingCode] = useState('');
  const [copiedTrackingCode, setCopiedTrackingCode] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod'>('cod');
  const [copiedBankField, setCopiedBankField] = useState<string | null>(null);
  const [confirmedTotalAmount, setConfirmedTotalAmount] = useState<number>(0);

  // Voucher states
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [shippingVoucher, setShippingVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherSuccessMsg, setVoucherSuccessMsg] = useState<string | null>(null);
  const [availableVouchers, setAvailableVouchers] = useState<Voucher[]>([]);

  useEffect(() => {
    getVouchers().then(setAvailableVouchers).catch(() => {});
  }, []);

  const bankConfig = siteContent?.bankAccount || {
    bankId: 'VCB',
    bankName: 'Vietcombank',
    accountNumber: '1028394859',
    accountHolder: 'VU NGOC MANH CUONG',
    branch: '',
    qrTemplate: 'compact2'
  };

  // Available districts for selected province
  const availableDistricts = getDistrictsByProvince(province);

  // Real-time dynamic shipping fee based on administrative boundaries (only computed when selected)
  const shippingInfo = calculateShippingFee(province, district);
  const shippingFee = shippingInfo.fee;

  const handleProvinceChange = (newProvince: string) => {
    setProvince(newProvince);
    setDistrict('');
  };

  const subtotal = cartItems.reduce(
    (acc, item) =>
      acc +
      (item.product.price + (item.selectedCharmPrice || 0) + (item.selectedOmamoriPrice || 0) + (item.selectedKhoenPrice || 0)) *
        item.quantity,
    0
  );

  // Validate each slot independently against the original merchandise subtotal.
  const discountResult = appliedVoucher
    ? validateVoucherCode(appliedVoucher.code, availableVouchers, subtotal, shippingFee) : null;
  const shippingResult = shippingVoucher
    ? validateVoucherCode(shippingVoucher.code, availableVouchers, subtotal, shippingFee) : null;
  const voucherDiscountAmount = discountResult?.isValid && discountResult.voucher?.type === 'percent'
    ? discountResult.discountAmount : 0;
  const isFreeShippingVoucher = Boolean(shippingResult?.isValid && shippingResult.voucher?.type === 'freeship');
  const selectedVouchers = [
    ...(discountResult?.isValid && discountResult.voucher?.type === 'percent' ? [discountResult.voucher] : []),
    ...(shippingResult?.isValid && shippingResult.voucher?.type === 'freeship' ? [shippingResult.voucher] : [])
  ];

  useEffect(() => {
    const invalidDiscount = appliedVoucher && (!discountResult?.isValid || discountResult.voucher?.type !== 'percent');
    const invalidShipping = shippingVoucher && (!shippingResult?.isValid || shippingResult.voucher?.type !== 'freeship');
    if (invalidDiscount) setAppliedVoucher(null);
    if (invalidShipping) setShippingVoucher(null);
    if (invalidDiscount || invalidShipping) {
      setVoucherError('Một mã không còn đủ điều kiện và đã được gỡ. Các mã hợp lệ khác được giữ lại.');
      setVoucherSuccessMsg(null);
    }
  }, [subtotal, shippingFee, appliedVoucher, shippingVoucher, availableVouchers]);


  // Track view_cart in GA4 when drawer opens with items
  useEffect(() => {
    if (isOpen && cartItems.length > 0) {
      trackGA4ViewCart(cartItems, subtotal);
    }
  }, [isOpen]);

  const handleRemoveItem = (index: number) => {
    const itemToRemove = cartItems[index];
    if (itemToRemove) {
      trackGA4RemoveFromCart(
        itemToRemove.product,
        itemToRemove.quantity,
        itemToRemove.selectedColor,
        itemToRemove.selectedSize
      );
    }
    onRemoveItem(index);
  };

  const handleApplyVoucher = () => {
    setVoucherError(null);
    setVoucherSuccessMsg(null);
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      setVoucherError('Vui lòng nhập mã voucher.');
      return;
    }
    const res = validateVoucherCode(code, availableVouchers, subtotal, shippingFee);
    if (!res.isValid || !res.voucher) {
      setVoucherError(res.message || 'Mã voucher không hợp lệ.');
      return;
    }
    const occupied = res.voucher.type === 'freeship' ? shippingVoucher : appliedVoucher;
    if (occupied) {
      setVoucherError(occupied.code.toUpperCase() === code
        ? 'Mã này đã được áp dụng.'
        : 'Chỉ được dùng 1 mã giảm giá và 1 mã freeship. Hãy gỡ mã cùng loại trước.');
      return;
    }
    if (res.voucher.type === 'freeship') setShippingVoucher(res.voucher);
    else setAppliedVoucher(res.voucher);
    setVoucherInput('');
    setVoucherSuccessMsg(res.message || 'Áp dụng voucher thành công!');
    trackGA4ApplyCoupon(res.voucher.code, res.discountAmount);
  };

  const handleRemoveVoucher = (type: Voucher['type']) => {
    if (type === 'freeship') setShippingVoucher(null);
    else setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError(null);
    setVoucherSuccessMsg(null);
  };

  const effectiveShippingFee = isFreeShippingVoucher ? 0 : shippingFee;
  const discountedSubtotal = Math.max(0, subtotal - voucherDiscountAmount);
  const grandTotal = discountedSubtotal + effectiveShippingFee;

  const formatCartItemsText = () => {
    return cartItems.map((item) => {
      const unitPrice =
        item.product.price + (item.selectedCharmPrice || 0) + (item.selectedOmamoriPrice || 0) + (item.selectedKhoenPrice || 0);
      let desc = `${item.product.name} (x${item.quantity}) - ${(unitPrice * item.quantity).toLocaleString('vi-VN')}đ`;
      const extras = [];
      const charmLabel = item.product.charmTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Charm';
      const omamoriLabel = item.product.omamoriTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Bùa Omamori';
      const khoenLabel = item.product.khoenTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Khoen';

      if (item.selectedColor) extras.push(`Màu: ${item.selectedColor}`);
      if (item.selectedCharms && item.selectedCharms.length > 0) {
        const names = item.selectedCharms.map((c) => c.name).join(', ');
        extras.push(
          `${charmLabel}: ${names}${
            item.selectedCharmPrice ? ` (+${item.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      } else if (item.selectedCharm) {
        extras.push(
          `${charmLabel}: ${item.selectedCharm}${
            item.selectedCharmPrice ? ` (+${item.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      }
      if (item.selectedOmamoris && item.selectedOmamoris.length > 0) {
        const omNames = item.selectedOmamoris.map((o) => o.name).join(', ');
        extras.push(
          `${omamoriLabel}: ${omNames}${
            item.selectedOmamoriPrice ? ` (+${item.selectedOmamoriPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      }
      if (item.selectedKhoen) {
        extras.push(
          `${khoenLabel}: ${item.selectedKhoen}${
            item.selectedKhoenPrice ? ` (+${item.selectedKhoenPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      }
      if (item.selectedSize) extras.push(`Size: ${item.selectedSize}`);
      if (item.customNote) extras.push(`Ghi chú: ${item.customNote}`);
      if (extras.length > 0) desc += ` [${extras.join(', ')}]`;
      return desc;
    });
  };

  // Robust Clipboard copy that works in all browsers and iframes
  const copyTextToClipboard = async (text: string) => {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (e) {
        console.warn('navigator.clipboard write failed, using textarea fallback', e);
      }
    }
    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        console.error('Fallback copy command failed', err);
      }
    }
    return copied;
  };

  // Generate text message for Facebook Messenger
  const buildMessengerOrderText = () => {
    const itemsList = cartItems.map((item, idx) => {
      const unitPrice =
        item.product.price + (item.selectedCharmPrice || 0) + (item.selectedOmamoriPrice || 0) + (item.selectedKhoenPrice || 0);
      let line = `${idx + 1}. ${item.product.name} - SL: ${item.quantity} - ${(unitPrice * item.quantity).toLocaleString('vi-VN')}đ`;
      const extras = [];
      const charmLabel = item.product.charmTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Charm';
      const omamoriLabel = item.product.omamoriTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Bùa Omamori';
      const khoenLabel = item.product.khoenTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Khoen';

      if (item.selectedColor) extras.push(`Màu: ${item.selectedColor}`);
      if (item.selectedCharms && item.selectedCharms.length > 0) {
        const names = item.selectedCharms.map((c) => c.name).join(', ');
        extras.push(
          `${charmLabel}: ${names}${
            item.selectedCharmPrice ? ` (+${item.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      } else if (item.selectedCharm) {
        extras.push(
          `${charmLabel}: ${item.selectedCharm}${
            item.selectedCharmPrice ? ` (+${item.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      }
      if (item.selectedOmamoris && item.selectedOmamoris.length > 0) {
        const omNames = item.selectedOmamoris.map((o) => o.name).join(', ');
        extras.push(
          `${omamoriLabel}: ${omNames}${
            item.selectedOmamoriPrice ? ` (+${item.selectedOmamoriPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      }
      if (item.selectedKhoen) {
        extras.push(
          `${khoenLabel}: ${item.selectedKhoen}${
            item.selectedKhoenPrice ? ` (+${item.selectedKhoenPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      }
      if (item.selectedSize) extras.push(`Size: ${item.selectedSize}`);
      if (item.customNote) extras.push(`Ghi chú: ${item.customNote}`);
      if (extras.length > 0) line += ` (${extras.join(', ')})`;
      return line;
    }).join('\n');

    return `Chào shop NOT A KNOT! Mình muốn đặt hàng các sản phẩm sau:\n\n` +
      `🛒 DANH SÁCH SẢN PHẨM:\n${itemsList}\n\n` +
      `💰 TỔNG CỘNG: ${subtotal.toLocaleString('vi-VN')}đ\n\n` +
      `Shop tư vấn và xác nhận đơn giúp mình nhé!`;
  };

  // Build structured order payload for Firestore
  const createOrderPayload = (contactMethod: 'system' | 'facebook') => {
    const formattedItems = formatCartItemsText();
    const itemDetails = cartItems.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      category: item.product.category,
      price: item.product.price + (item.selectedCharmPrice || 0) + (item.selectedOmamoriPrice || 0) + (item.selectedKhoenPrice || 0),
      quantity: item.quantity,
      selectedColor: item.selectedColor,
      selectedCharm: item.selectedCharm,
      selectedCharmPrice: item.selectedCharmPrice,
      selectedCharms: item.selectedCharms,
      selectedOmamoris: item.selectedOmamoris,
      selectedOmamoriPrice: item.selectedOmamoriPrice,
      selectedKhoen: item.selectedKhoen,
      selectedKhoenPrice: item.selectedKhoenPrice,
      selectedSize: item.selectedSize,
      customNote: item.customNote
    }));

    const trackingCode = generateTrackingNumber();
    setCreatedTrackingCode(trackingCode);

    const fullAddress = contactMethod === 'facebook'
      ? (detailedAddress ? `${detailedAddress}, ${district}, ${province}` : '')
      : `${detailedAddress.trim()}, ${district.trim()}, ${province.trim()}`;

    const totalToRecord = contactMethod === 'facebook' ? subtotal : grandTotal;
    setConfirmedTotalAmount(totalToRecord);

    return {
      id: trackingCode,
      trackingNumber: trackingCode,
      date: new Date().toLocaleString('vi-VN'),
      createdAt: new Date().toISOString(),
      name: name.trim() || 'Khách Facebook Messenger',
      customerName: name.trim() || 'Khách Facebook Messenger',
      phone: phone.trim() || '',
      address: fullAddress,
      province: province.trim(),
      district: district.trim(),
      detailedAddress: detailedAddress.trim(),
      shippingFee: contactMethod === 'facebook' ? 0 : effectiveShippingFee,
      voucherCode: selectedVouchers.map((voucher) => voucher.code).join(' + ') || undefined,
      voucherDiscountAmount: voucherDiscountAmount > 0 ? voucherDiscountAmount : undefined,
      voucherType: selectedVouchers.find((voucher) => voucher.type === 'percent')?.type || selectedVouchers[0]?.type || undefined,
      note: note ? `${note} (Liên hệ qua: ${contactMethod === 'facebook' ? 'Facebook Messenger' : 'Form Website'})` : `(Liên hệ qua: ${contactMethod === 'facebook' ? 'Facebook Messenger' : 'Form Website'})`,
      items: formattedItems,
      itemDetails,
      totalPrice: totalToRecord,
      totalAmount: totalToRecord,
      source: contactMethod === 'facebook' ? ('facebook' as const) : ('website' as const),
      type: 'standard_order' as const,
      status: 'Chờ xác nhận' as const,
      paymentMethod: 'cod' as const,
      paymentStatus: 'unpaid' as const
    };
  };

  // Option 1: Submit via system form (Shop calls/texts to confirm)
  const handleSubmitSystemOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập Họ và tên người nhận.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 9) {
      alert('Vui lòng nhập Số điện thoại hợp lệ (ít nhất 9 số).');
      return;
    }
    if (!province.trim()) {
      alert('Vui lòng chọn Tỉnh / Thành phố nhận hàng.');
      return;
    }
    if (!district.trim()) {
      alert('Vui lòng chọn Quận / Huyện nhận hàng.');
      return;
    }
    if (!detailedAddress.trim()) {
      alert('Vui lòng nhập Địa chỉ chi tiết (số nhà, tên đường, tòa nhà, phường/xã...).');
      return;
    }
    if (cartItems.length === 0) return;

    setIsSubmitting(true);
    const orderData = createOrderPayload('system');

    try {
      await saveOrderToFirestore(orderData);
    } catch (err: any) {
      console.error('Lỗi khi lưu đơn hàng lên Firebase:', err);
      alert(`Không thể kết nối máy chủ để lưu đơn hàng: ${err?.message || 'Lỗi mạng'}. Quý khách vui lòng thử lại!`);
      setIsSubmitting(false);
      return;
    }

    const local = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
    local.unshift(orderData);
    localStorage.setItem('nak_preorders', JSON.stringify(local));

    onOrderPlaced(orderData);
    trackGA4Purchase(orderData.id, subtotal, orderData.itemDetails, paymentMethod === 'vietqr' ? 'VietQR_Banking' : 'COD_System');
    setIsSubmitting(false);
    setSuccessMode('system');
    setStep('success');
    onClearCart();
  };

  // Option 2: Directly Copy & Open Messenger (No form required!)
  const handleSelectFacebookMethod = async () => {
    if (cartItems.length === 0) return;

    // 1. Copy order summary text to clipboard
    const orderText = buildMessengerOrderText();
    const isCopied = await copyTextToClipboard(orderText);
    setCopiedMessengerOrder(isCopied);

    // 2. Log purchase event / record
    const orderData = createOrderPayload('facebook');
    setIsSubmitting(true);
    try {
      await saveOrderToFirestore(orderData);
    } catch (err) {
      console.warn('Fallback saving for messenger order:', err);
    }
    const local = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
    local.unshift(orderData);
    localStorage.setItem('nak_preorders', JSON.stringify(local));

    trackGA4Purchase(orderData.id, subtotal, orderData.itemDetails, 'Messenger');
    setIsSubmitting(false);

    // 3. Open Messenger link immediately in new tab
    const targetUrl = messengerUrl || facebookUrl;
    const fbWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!fbWindow) {
      // If popup blocked, window.location or fallback link available in success screen
      console.info('Popup blocked by browser, link provided on screen.');
    }

    // 4. Move to success screen with clear guidance (keep cart items intact for the buyer)
    setSuccessMode('facebook');
    setStep('success');
  };

  const handleCloseAndReset = () => {
    setStep('cart');
    setShowClearConfirm(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          id="cart-drawer-overlay"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex justify-end"
          onClick={handleCloseAndReset}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            id="cart-drawer-panel"
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden text-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-950 text-white">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm tracking-wide">
                  {step === 'success' 
                    ? 'Xác nhận đặt hàng' 
                    : step === 'select-method'
                    ? 'Chọn phương thức đặt hàng'
                    : step === 'form-checkout' 
                    ? 'Thông tin nhận hàng' 
                    : 'Giỏ hàng của bạn'}
                </h3>
              </div>
              <button
                id="close-cart-drawer-btn"
                onClick={handleCloseAndReset}
                className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/10"
                aria-label="Đóng giỏ hàng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Content */}
            <div className="p-6 flex-grow overflow-y-auto">
              {/* STEP 1: CART LIST */}
              {step === 'cart' && (
                <>
                  {cartItems.length === 0 ? (
                    <div className="text-center py-20 text-neutral-600 space-y-4">
                      <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-500">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="font-bold text-neutral-950 text-base">Giỏ hàng của bạn đang trống</p>
                        <p className="text-xs text-neutral-600 font-medium mt-1">
                          Hãy khám phá các bộ sưu tập Paracord thủ công độc bản từ NOT A KNOT.
                        </p>
                      </div>
                      <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-neutral-950 text-white text-xs font-semibold rounded-full hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs"
                      >
                        Khám phá bộ sưu tập
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Header giỏ hàng + Nút/Menu xác nhận xóa toàn bộ trực tiếp */}
                      <div className="pb-2.5 border-b border-neutral-200">
                        <div className="flex items-center justify-between text-xs text-neutral-700 font-semibold">
                          <span>{cartItems.length} loại sản phẩm trong giỏ</span>
                          {!showClearConfirm && (
                            <button
                              type="button"
                              onClick={() => setShowClearConfirm(true)}
                              className="text-red-600 hover:text-red-700 hover:underline font-bold cursor-pointer transition-colors"
                            >
                              Xóa toàn bộ
                            </button>
                          )}
                        </div>

                        {/* Inline confirmation menu ngay trong giỏ */}
                        <AnimatePresence>
                          {showClearConfirm && (
                            <motion.div
                              initial={{ opacity: 0, height: 0, marginTop: 0 }}
                              animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                              exit={{ opacity: 0, height: 0, marginTop: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2 text-xs text-red-950 font-bold">
                                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                  <span>Xóa tất cả sản phẩm khỏi giỏ?</span>
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                  <button
                                    type="button"
                                    onClick={() => setShowClearConfirm(false)}
                                    className="px-3 py-1 text-xs font-bold text-neutral-800 bg-white border border-neutral-300 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer shadow-2xs"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClearCart();
                                      setShowClearConfirm(false);
                                    }}
                                    className="px-3 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-full transition-colors cursor-pointer shadow-xs"
                                  >
                                    Xóa hết
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {cartItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="relative rounded-2xl group/item select-none p-3.5 bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-200 shadow-xs transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <LoadingImage
                              src={item.selectedColorImage || item.product.image}
                              alt={item.product.name}
                              containerClassName="w-16 h-16 rounded-xl border border-neutral-200 flex-shrink-0 bg-white"
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                              spinnerSize="sm"
                              spinnerColor="amber"
                            />
                            <div className="flex-grow min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-bold text-xs sm:text-sm text-neutral-950 truncate">
                                  {item.product.name}
                                </h4>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-neutral-400 hover:text-red-600 p-1 -mt-0.5 -mr-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer flex-shrink-0"
                                  title="Xóa món này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="text-xs text-neutral-700 space-y-1 mt-1 font-medium">
                                {item.selectedColor && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-neutral-500 text-[11px]">Màu:</span>
                                    <span className="font-bold text-neutral-900 bg-neutral-100 px-1.5 py-0.5 rounded text-[11px]">
                                      {item.selectedColor}
                                    </span>
                                  </div>
                                )}
                                {((item.selectedCharms && item.selectedCharms.length > 0) || item.selectedCharm) && (
                                  <div className="flex flex-wrap items-center gap-1.5 bg-amber-50/80 border border-amber-200/80 px-2 py-0.5 rounded-lg w-fit">
                                    {item.selectedCharms && item.selectedCharms.length > 0 ? (
                                      <>
                                        {item.selectedCharms.map((c, cIdx) => (
                                          <span key={cIdx} className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900">
                                            {c.image && (
                                              <LoadingImage
                                                src={c.image}
                                                alt={c.name}
                                                containerClassName="w-3.5 h-3.5 rounded-xs shrink-0"
                                                className="w-full h-full object-contain"
                                                spinnerSize="xs"
                                                spinnerColor="amber"
                                              />
                                            )}
                                            {c.name}
                                            {cIdx < item.selectedCharms!.length - 1 ? ',' : ''}
                                          </span>
                                        ))}
                                      </>
                                    ) : (
                                      <>
                                        {item.selectedCharmImage && (
                                          <LoadingImage
                                            src={item.selectedCharmImage}
                                            alt={item.selectedCharm}
                                            containerClassName="w-4 h-4 rounded-xs shrink-0"
                                            className="w-full h-full object-contain"
                                            spinnerSize="xs"
                                            spinnerColor="amber"
                                          />
                                        )}
                                        <span className="text-[11px] font-bold text-amber-900">
                                          {item.product.charmTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Charm'}: {item.selectedCharm}
                                        </span>
                                      </>
                                    )}
                                    {item.selectedCharmPrice && item.selectedCharmPrice > 0 ? (
                                      <span className="text-[10px] text-amber-700 font-semibold">
                                        (+{item.selectedCharmPrice.toLocaleString('vi-VN')}đ)
                                      </span>
                                    ) : null}
                                  </div>
                                )}

                                {item.selectedOmamoris && item.selectedOmamoris.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 bg-rose-50/80 border border-rose-200/80 px-2 py-0.5 rounded-lg w-fit">
                                    <span className="text-[11px] font-bold text-rose-900">
                                      {item.product.omamoriTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Bùa'}:
                                    </span>
                                    {item.selectedOmamoris.map((om, omIdx) => (
                                      <span key={omIdx} className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-900">
                                        {om.image && (
                                          <LoadingImage
                                            src={om.image}
                                            alt={om.name}
                                            containerClassName="w-3.5 h-3.5 rounded-xs shrink-0"
                                            className="w-full h-full object-contain"
                                            spinnerSize="xs"
                                            spinnerColor="rose"
                                          />
                                        )}
                                        {om.name}
                                        {omIdx < item.selectedOmamoris!.length - 1 ? ',' : ''}
                                      </span>
                                    ))}
                                    {item.selectedOmamoriPrice && item.selectedOmamoriPrice > 0 ? (
                                      <span className="text-[10px] text-rose-700 font-semibold">
                                        (+{item.selectedOmamoriPrice.toLocaleString('vi-VN')}đ)
                                      </span>
                                    ) : null}
                                  </div>
                                )}

                                {item.selectedKhoen && (
                                  <div className="flex items-center gap-1.5 bg-sky-50/80 border border-sky-200/80 px-2 py-0.5 rounded-lg w-fit">
                                    {item.selectedKhoenImage && (
                                      <LoadingImage
                                        src={item.selectedKhoenImage}
                                        alt={item.selectedKhoen}
                                        containerClassName="w-3.5 h-3.5 rounded-xs shrink-0"
                                        className="w-full h-full object-contain"
                                        spinnerSize="xs"
                                        spinnerColor="amber"
                                      />
                                    )}
                                    <span className="text-[11px] font-bold text-sky-900">
                                      {item.product.khoenTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Khoen'}: {item.selectedKhoen}
                                    </span>
                                    {item.selectedKhoenPrice && item.selectedKhoenPrice > 0 ? (
                                      <span className="text-[10px] text-sky-700 font-semibold">
                                        (+{item.selectedKhoenPrice.toLocaleString('vi-VN')}đ)
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                                {item.selectedSize && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-neutral-500 text-[11px]">Size:</span>
                                    <span className="font-bold text-neutral-900 text-[11px]">
                                      {item.selectedSize}
                                    </span>
                                  </div>
                                )}
                                {item.customNote && (
                                  <div className="text-neutral-800 truncate font-normal text-[11px]">
                                    Ghi chú: <span className="font-semibold">{item.customNote}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between mt-2.5">
                                <span className="font-black text-neutral-950 text-xs sm:text-sm font-mono">
                                  {((item.product.price + (item.selectedCharmPrice || 0) + (item.selectedOmamoriPrice || 0) + (item.selectedKhoenPrice || 0)) * item.quantity).toLocaleString('vi-VN')}đ
                                </span>

                                 {(() => {
                                  // Do not limit to 1 in cart - allow customers to order multiple quantities freely
                                  const prodStock = typeof item.product.stock === 'number' && item.product.stock > 1 
                                    ? item.product.stock 
                                    : 99;
                                  const totalInCart = cartItems
                                    .filter((ci) => ci.product.id === item.product.id)
                                    .reduce((sum, ci) => sum + ci.quantity, 0);
                                  const isStockMax = totalInCart >= prodStock && prodStock > 1 && prodStock < 99;

                                  return (
                                    <div className="flex items-center gap-1.5">
                                      {isStockMax && (
                                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                          Tồn kho ({prodStock})
                                        </span>
                                      )}
                                      <div className="flex items-center border border-neutral-300 rounded-full bg-white overflow-hidden text-xs shadow-2xs">
                                        <button
                                          type="button"
                                          onClick={() => onUpdateQuantity(idx, Math.max(1, item.quantity - 1))}
                                          className="px-2.5 py-1 hover:bg-neutral-100 font-bold text-neutral-800 cursor-pointer transition-colors"
                                        >
                                          -
                                        </button>
                                        <span className="px-2 font-black text-neutral-950">{item.quantity}</span>
                                        <button
                                          type="button"
                                          disabled={isStockMax}
                                          onClick={() => onUpdateQuantity(idx, item.quantity + 1)}
                                          className="px-2.5 py-1 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white font-bold text-neutral-800 cursor-pointer transition-colors"
                                          title={isStockMax ? `Đã đạt giới hạn (${prodStock} cái)` : 'Tăng số lượng'}
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* STEP 2: SELECT METHOD (TRANG CHỌN CÁCH ĐẶT HÀNG) */}
              {step === 'select-method' && (
                <div className="space-y-4">
                  {/* Order Summary */}
                  <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex items-center justify-between text-xs">
                    <span className="text-neutral-800 font-semibold">Tổng cộng ({cartItems.reduce((a, b) => a + b.quantity, 0)} món):</span>
                    <span className="font-black text-neutral-950 font-mono text-base">
                      {subtotal.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  <p className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                    Chọn cách đặt hàng:
                  </p>

                  {/* 2 Unified Options without icons */}
                  <div className="space-y-3">
                    {/* CÁCH 1 */}
                    <button
                      type="button"
                      onClick={() => setStep('form-checkout')}
                      className="w-full p-4 rounded-xl bg-white hover:bg-neutral-50 border-2 border-neutral-200 hover:border-neutral-950 text-left transition-all group cursor-pointer shadow-xs"
                    >
                      <div className="font-black text-neutral-950 text-sm">
                        Đặt hàng trên Website
                      </div>
                      <p className="text-xs text-neutral-600 font-medium mt-1">
                        Điền thông tin nhận hàng & Shop sẽ liên hệ xác nhận
                      </p>
                    </button>

                    {/* CÁCH 2 */}
                    <button
                      type="button"
                      onClick={handleSelectFacebookMethod}
                      className="w-full p-4 rounded-xl bg-white hover:bg-neutral-50 border-2 border-neutral-200 hover:border-neutral-950 text-left transition-all group cursor-pointer shadow-xs"
                    >
                      <div className="font-black text-neutral-950 text-sm">
                        Đặt qua Messenger
                      </div>
                      <p className="text-xs text-neutral-600 font-medium mt-1">
                        Tự động sao chép đơn & mở chat trực tiếp với Shop
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: FORM CHECKOUT (KHI CHỌN CÁCH 1) */}
              {step === 'form-checkout' && (
                <form onSubmit={handleSubmitSystemOrder} className="space-y-5">
                  <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 text-xs text-neutral-800 leading-relaxed font-medium">
                    <span className="font-bold block text-neutral-950 mb-0.5 text-xs">
                      📋 Đặt hàng trực tiếp trên Website:
                    </span>
                    Vui lòng điền thông tin người nhận. Shop sẽ tự liên hệ với bạn qua số điện thoại để xác nhận đơn hàng.
                  </div>

                  {/* Contact Information Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-950 mb-1.5">
                        Họ và tên <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nhập họ và tên người nhận..."
                        className="w-full px-4 py-3 bg-white border border-neutral-300 hover:border-neutral-400 focus:border-neutral-950 rounded-xl text-sm text-neutral-950 font-medium placeholder:text-neutral-500 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-neutral-950 transition-colors shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-950 mb-1.5">
                        Số điện thoại <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Nhập số điện thoại nhận hàng (ví dụ: 0912...)"
                        className="w-full px-4 py-3 bg-white border border-neutral-300 hover:border-neutral-400 focus:border-neutral-950 rounded-xl text-sm text-neutral-950 font-medium placeholder:text-neutral-500 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-neutral-950 transition-colors shadow-2xs"
                      />
                    </div>

                    {/* Province & District Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-neutral-950 mb-1.5">
                          Tỉnh / Thành phố <span className="text-red-600">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={province}
                            onChange={(e) => handleProvinceChange(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-neutral-300 hover:border-neutral-400 focus:border-neutral-950 rounded-xl text-xs sm:text-sm text-neutral-950 font-medium focus:outline-none focus:ring-1 focus:ring-neutral-950 transition-colors cursor-pointer appearance-none pr-9 shadow-2xs"
                          >
                            <option value="">-- Chọn Tỉnh / TP --</option>
                            {VIETNAM_PROVINCES.map((prov) => (
                              <option key={prov.code} value={prov.name}>
                                {prov.name}
                              </option>
                            ))}
                          </select>
                          <Building2 className="w-4 h-4 text-neutral-400 absolute right-3 top-3.5 pointer-events-none" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-950 mb-1.5">
                          Quận / Huyện <span className="text-red-600">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            disabled={!province || availableDistricts.length === 0}
                            className="w-full px-4 py-3 bg-white border border-neutral-300 hover:border-neutral-400 focus:border-neutral-950 rounded-xl text-xs sm:text-sm text-neutral-950 font-medium focus:outline-none focus:ring-1 focus:ring-neutral-950 transition-colors cursor-pointer appearance-none pr-9 shadow-2xs disabled:opacity-50"
                          >
                            <option value="">-- Chọn Quận / Huyện --</option>
                            {availableDistricts.map((dist) => (
                              <option key={dist} value={dist}>
                                {dist}
                              </option>
                            ))}
                          </select>
                          <MapPin className="w-4 h-4 text-neutral-400 absolute right-3 top-3.5 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Detailed Address */}
                    <div>
                      <label className="block text-xs font-bold text-neutral-950 mb-1.5">
                        Địa chỉ chi tiết <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={detailedAddress}
                        onChange={(e) => setDetailedAddress(e.target.value)}
                        placeholder="Số nhà, tên ngõ/ngách/đường, tòa nhà, phường/xã..."
                        className="w-full px-4 py-3 bg-white border border-neutral-300 hover:border-neutral-400 focus:border-neutral-950 rounded-xl text-sm text-neutral-950 font-medium placeholder:text-neutral-500 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-neutral-950 transition-colors shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-950 mb-1.5">
                        Ghi chú thêm (nếu có)
                      </label>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."
                        className="w-full px-4 py-3 bg-white border border-neutral-300 hover:border-neutral-400 focus:border-neutral-950 rounded-xl text-sm text-neutral-950 font-medium placeholder:text-neutral-500 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-neutral-950 transition-colors shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Voucher Input Box */}
                  <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/60 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                      <Ticket className="w-4 h-4 text-amber-600" />
                      <span>Mã giảm giá / Ưu đãi</span>
                    </div>

                    <p className="text-xs text-slate-600">Có thể dùng cùng lúc 1 mã giảm giá + 1 mã freeship.</p>
                    {selectedVouchers.map((voucher) => (
                      <div key={voucher.type} className="flex items-center justify-between gap-2 bg-amber-50 p-2.5 rounded-xl border border-amber-300">
                        <span className="font-mono font-bold text-xs break-all">{voucher.code}</span>
                        <span className="text-xs text-emerald-700">
                          {voucher.type === 'freeship' ? 'Miễn phí vận chuyển' : `-${voucherDiscountAmount.toLocaleString('vi-VN')}đ`}
                        </span>
                        <button type="button" onClick={() => handleRemoveVoucher(voucher.type)}
                          aria-label={`Gỡ mã ${voucher.code}`} className="text-xs text-rose-600 px-2 py-1">Xóa</button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input type="text" value={voucherInput}
                        onChange={(e) => { setVoucherInput(e.target.value.toUpperCase()); setVoucherError(null); }}
                        placeholder="Nhập mã giảm giá hoặc freeship"
                        aria-label="Mã giảm giá hoặc freeship"
                        className="min-w-0 flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs uppercase" />
                      <button type="button" onClick={handleApplyVoucher}
                        className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs">Áp dụng</button>
                    </div>

                    {voucherError && (
                      <p className="text-[11px] font-bold text-rose-600">{voucherError}</p>
                    )}
                    {voucherSuccessMsg && !voucherError && (
                      <p className="text-[11px] font-bold text-emerald-700">{voucherSuccessMsg}</p>
                    )}
                  </div>

                  {/* Payment Method Banner */}
                  <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs">
                      COD
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-950">Thanh toán khi nhận hàng (COD)</div>
                      <div className="text-[11px] text-neutral-500">Quý khách nhận hàng, kiểm tra sản phẩm và thanh toán tiền mặt trực tiếp cho bưu tá.</div>
                    </div>
                  </div>

                  {/* Order total preview */}
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-neutral-700">
                      <span>Tạm tính ({cartItems.reduce((a, b) => a + b.quantity, 0)} món):</span>
                      <span className="font-bold text-neutral-950 font-mono">{subtotal.toLocaleString('vi-VN')}đ</span>
                    </div>

                    {voucherDiscountAmount > 0 && (
                      <div className="flex justify-between items-center text-emerald-700 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-emerald-600" />
                          Giảm giá Voucher ({appliedVoucher?.code}):
                        </span>
                        <span className="font-bold font-mono">
                          -{voucherDiscountAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-neutral-700">
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-neutral-500" />
                        Phí vận chuyển:
                      </span>
                      <span className="font-bold font-mono text-neutral-950">
                        {shippingInfo.isPending ? 'Chưa tính' : (shippingInfo.isFree || isFreeShippingVoucher) ? '0đ (Miễn phí)' : `${shippingFee.toLocaleString('vi-VN')}đ`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-neutral-200 text-sm">
                      <span className="font-bold text-neutral-950">Tổng thanh toán:</span>
                      <span className="font-black text-neutral-950 text-base font-mono">
                        {grandTotal.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 text-amber-400" />
                    <span>{isSubmitting ? 'Đang gửi đơn...' : 'Xác nhận đặt hàng'}</span>
                  </button>
                </form>
              )}

              {/* STEP 4: SUCCESS CONFIRMATION */}
              {step === 'success' && (
                <div className="text-center py-8 space-y-5">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-inner ${
                    successMode === 'facebook' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {successMode === 'facebook' ? (
                      <MessageCircle className="w-8 h-8" />
                    ) : (
                      <CheckCircle2 className="w-8 h-8" />
                    )}
                  </div>

                  <div>
                    <h4 className="text-xl font-extrabold text-neutral-950">
                      {successMode === 'facebook' ? 'Đã sao chép đơn hàng & Mở Messenger!' : 'Đặt Hàng Thành Công!'}
                    </h4>
                    <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed max-w-sm mx-auto mt-2">
                      {successMode === 'facebook' 
                        ? 'Thông tin danh sách các món trong giỏ hàng đã được sao chép sẵn vào bộ nhớ tạm của bạn.'
                        : 'Cảm ơn bạn đã tin tưởng NOT A KNOT. Chúng tôi sẽ tiến hành kiểm tra số đo và chuẩn bị đan chiếc vòng theo đúng yêu cầu.'}
                    </p>
                  </div>

                  {/* Order Tracking Code Display */}
                  {createdTrackingCode && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-left space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900">
                          Mã tra cứu đơn hàng của bạn:
                        </span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded">
                          Lưu lại mã này
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-amber-200 shadow-2xs">
                        <span className="font-mono font-black text-base sm:text-lg text-slate-900 tracking-wider">
                          {createdTrackingCode}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(createdTrackingCode);
                              setCopiedTrackingCode(true);
                              setTimeout(() => setCopiedTrackingCode(false), 2000);
                            } catch {}
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          title="Sao chép mã"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedTrackingCode ? 'Đã sao chép' : 'Sao chép'}</span>
                        </button>
                      </div>

                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Bạn có thể dùng mã này hoặc số điện thoại để theo dõi tiến độ đan dây & giao hàng bất cứ lúc nào tại mục <strong>Tra Cứu Đơn</strong>.
                      </p>

                      {onOpenOrderTracker && (
                        <button
                          type="button"
                          onClick={() => {
                            const code = createdTrackingCode;
                            handleCloseAndReset();
                            onOpenOrderTracker(code);
                          }}
                          className="w-full py-2.5 px-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Theo dõi tiến độ đơn hàng ngay</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Messenger Mode Details */}
                  {successMode === 'facebook' && (
                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-left text-xs space-y-3">
                      <div className="flex items-center gap-2 text-blue-950 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span>{copiedMessengerOrder ? 'Đã copy sẵn danh sách đơn vào bộ nhớ tạm' : 'Danh sách đơn hàng đã sẵn sàng'}</span>
                      </div>
                      <p className="text-blue-900 font-medium leading-relaxed">
                        👉 Hãy mở khung chat Messenger với <strong>NOT A KNOT</strong> và nhấn <strong>Dán (Paste / Ctrl + V)</strong> để gửi tin nhắn đặt hàng cho shop nhé!
                      </p>
                      
                      <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        <a
                          href={messengerUrl || facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-center inline-flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Mở Messenger</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                        </a>

                        <button
                          type="button"
                          onClick={async () => {
                            const orderText = buildMessengerOrderText();
                            await copyTextToClipboard(orderText);
                            setCopiedMessengerOrder(true);
                            alert('Đã sao chép lại danh sách đơn hàng vào bộ nhớ tạm!');
                          }}
                          className="py-3 px-4 rounded-xl bg-white hover:bg-slate-100 border border-blue-200 text-blue-900 font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép lại đơn</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* System Mode (VietQR or COD) Details */}
                  {successMode === 'system' && (
                    <div className="space-y-3">
                      {paymentMethod === 'vietqr' ? (
                        <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-50/70 to-white border-2 border-amber-300 text-left space-y-3 shadow-xs">
                          <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-950 uppercase tracking-wide">
                              <QrCode className="w-4 h-4 text-amber-600" />
                              <span>Mã QR Chuyển Khoản Thanh Toán</span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Quét tự động
                            </span>
                          </div>

                          {/* VietQR Dynamic Code Preview */}
                          <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-xl border border-amber-200">
                            <div className="w-36 h-36 flex-shrink-0 bg-white rounded-lg p-1.5 border border-neutral-200 shadow-2xs flex items-center justify-center">
                              <img
                                src={`https://img.vietqr.io/image/${bankConfig.bankId || 'VCB'}-${bankConfig.accountNumber}-${bankConfig.qrTemplate || 'compact2'}.png?amount=${confirmedTotalAmount || grandTotal || subtotal}&addInfo=${encodeURIComponent(createdTrackingCode || `NOTAKNOT ${phone}`)}&accountName=${encodeURIComponent(bankConfig.accountHolder || 'NOT A KNOT')}`}
                                alt="Mã VietQR thanh toán"
                                className="w-full h-full object-contain"
                                loading="lazy"
                              />
                            </div>
                            <div className="flex-grow text-xs space-y-2 w-full">
                              <div className="flex items-center justify-between">
                                <span className="text-neutral-500 font-medium">Ngân hàng:</span>
                                <span className="font-bold text-neutral-900">{bankConfig.bankName} ({bankConfig.bankId})</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-neutral-500 font-medium">Chủ tài khoản:</span>
                                <span className="font-bold text-neutral-900 uppercase">{bankConfig.accountHolder}</span>
                              </div>
                              <div className="flex items-center justify-between bg-neutral-50 px-2 py-1 rounded">
                                <span className="text-neutral-500 font-medium">Số tài khoản:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-neutral-950">{bankConfig.accountNumber}</span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await copyTextToClipboard(bankConfig.accountNumber);
                                      setCopiedBankField('acc');
                                      setTimeout(() => setCopiedBankField(null), 2000);
                                    }}
                                    className="p-1 hover:bg-neutral-200 rounded text-neutral-700 transition-colors cursor-pointer"
                                    title="Sao chép STK"
                                  >
                                    {copiedBankField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between bg-neutral-50 px-2 py-1 rounded">
                                <span className="text-neutral-500 font-medium">Số tiền:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-black text-amber-600">{(confirmedTotalAmount || grandTotal || subtotal).toLocaleString('vi-VN')}đ</span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await copyTextToClipboard(String(confirmedTotalAmount || grandTotal || subtotal));
                                      setCopiedBankField('amount');
                                      setTimeout(() => setCopiedBankField(null), 2000);
                                    }}
                                    className="p-1 hover:bg-neutral-200 rounded text-neutral-700 transition-colors cursor-pointer"
                                    title="Sao chép số tiền"
                                  >
                                    {copiedBankField === 'amount' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between bg-neutral-50 px-2 py-1 rounded">
                                <span className="text-neutral-500 font-medium">Nội dung CK:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-neutral-950 truncate max-w-[120px] sm:max-w-none">
                                    {createdTrackingCode || `NOTAKNOT ${phone}`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await copyTextToClipboard(createdTrackingCode || `NOTAKNOT ${phone}`);
                                      setCopiedBankField('memo');
                                      setTimeout(() => setCopiedBankField(null), 2000);
                                    }}
                                    className="p-1 hover:bg-neutral-200 rounded text-neutral-700 transition-colors cursor-pointer"
                                    title="Sao chép cú pháp"
                                  >
                                    {copiedBankField === 'memo' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Advisory Reminder */}
                          <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-300/80 text-[11px] text-amber-950 leading-relaxed font-medium flex items-start gap-2">
                            <span className="text-sm">⚠️</span>
                            <span>
                              <strong>Lưu ý:</strong> Vui lòng chụp lại màn hình giao dịch chuyển khoản thành công để đối chiếu xác nhận khi xưởng chuẩn bị đan dây và gửi hàng nhé!
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-left text-xs space-y-2">
                          <div className="flex items-center gap-2 text-neutral-950 font-bold">
                            <Truck className="w-4 h-4 text-neutral-800" />
                            <span>Hình thức thanh toán: COD (Khi nhận hàng)</span>
                          </div>
                          <p className="text-neutral-700 font-medium leading-relaxed">
                            Quý khách vui lòng chuẩn bị số tiền <strong>{(confirmedTotalAmount || grandTotal || subtotal).toLocaleString('vi-VN')}đ</strong> để gửi cho Shipper khi đơn hàng giao đến.
                          </p>
                        </div>
                      )}

                      <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-left text-xs space-y-2">
                        <div className="flex items-center gap-2 text-neutral-950 font-bold">
                          <PhoneCall className="w-4 h-4 text-amber-600" />
                          <span>Nhân viên shop sẽ liên hệ xác nhận</span>
                        </div>
                        <p className="text-neutral-700 font-medium leading-relaxed">
                          Xưởng NOT A KNOT sẽ gọi điện thoại hoặc gửi tin nhắn SMS để xác nhận thông tin đơn hàng và thông báo mã vận đơn sớm nhất.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 flex justify-center">
                    <button
                      onClick={handleCloseAndReset}
                      className="px-8 py-3.5 bg-neutral-950 text-white font-bold text-xs rounded-full hover:bg-neutral-800 transition-colors shadow-md cursor-pointer"
                    >
                      Tiếp tục mua sắm
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions for step = 'cart' */}
            {step === 'cart' && cartItems.length > 0 && (
              <div className="p-5 border-t border-neutral-200 bg-neutral-50 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Tổng tiền hàng:</span>
                  <span className="text-2xl font-black text-neutral-950 font-mono">
                    {subtotal.toLocaleString('vi-VN')}đ
                  </span>
                </div>

                <button
                  type="button"
                  id="proceed-to-checkout-btn"
                  onClick={() => {
                    trackGA4BeginCheckout(cartItems, subtotal);
                    setStep('select-method');
                  }}
                  className="w-full bg-neutral-950 hover:bg-neutral-800 text-white py-4 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
                >
                  <span>Tiến hành đặt hàng</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-center gap-4 text-xs text-neutral-700 font-medium pt-1">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-neutral-800" />
                    Bảo hành trọn đời
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-neutral-800" />
                    Giao hàng COD toàn quốc
                  </span>
                </div>
              </div>
            )}

            {/* Footer action for step = 'select-method' */}
            {step === 'select-method' && (
              <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="text-xs font-bold text-neutral-800 hover:text-neutral-950 hover:underline cursor-pointer transition-colors"
                >
                  ← Quay lại giỏ hàng
                </button>
              </div>
            )}

            {/* Footer action for step = 'form-checkout' */}
            {step === 'form-checkout' && (
              <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep('select-method')}
                  className="text-xs font-bold text-neutral-800 hover:text-neutral-950 hover:underline cursor-pointer transition-colors"
                >
                  ← Chọn cách đặt hàng khác
                </button>
              </div>
            )}
            {/* Submission Processing Wait Overlay */}
            {isSubmitting && (
              <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 text-center">
                <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center mx-auto mb-3.5">
                    <RefreshCw className="w-7 h-7 animate-spin" />
                  </div>
                  <h4 className="text-base font-black text-slate-900 mb-1.5">
                    Đang Lưu Đơn Hàng...
                  </h4>
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs font-bold leading-relaxed mb-3 text-left">
                    ⚠️ Quý khách vui lòng <strong>chờ ở trang này</strong> trong giây lát cho đến khi đơn hàng được xác nhận đặt thành công!
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Hệ thống đang ghi nhận đơn hàng lên máy chủ Not A Knot...
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
