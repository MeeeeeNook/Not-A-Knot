import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CartItem } from '../types';
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
  PhoneCall
} from 'lucide-react';
import { saveOrderToFirestore } from '../firebase';
import { trackGA4BeginCheckout, trackGA4Purchase } from '../utils/analytics';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  facebookUrl?: string;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onOrderPlaced: (orderData: any) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  facebookUrl = 'https://www.facebook.com/profile.php?id=61593591390851',
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderPlaced
}) => {
  // Steps: 'cart' -> 'select-method' -> 'form-checkout' (if method 1) -> 'success'
  const [step, setStep] = useState<'cart' | 'select-method' | 'form-checkout' | 'success'>('cart');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedMessengerOrder, setCopiedMessengerOrder] = useState(false);
  const [successMode, setSuccessMode] = useState<'system' | 'facebook'>('system');

  const subtotal = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  const formatCartItemsText = () => {
    return cartItems.map((item) => {
      let desc = `${item.product.name} (x${item.quantity}) - ${(item.product.price * item.quantity).toLocaleString('vi-VN')}đ`;
      const extras = [];
      if (item.selectedColor) extras.push(`Màu: ${item.selectedColor}`);
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
      let line = `${idx + 1}. ${item.product.name} - SL: ${item.quantity} - ${(item.product.price * item.quantity).toLocaleString('vi-VN')}đ`;
      const extras = [];
      if (item.selectedColor) extras.push(`Màu: ${item.selectedColor}`);
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
      price: item.product.price,
      quantity: item.quantity,
      selectedColor: item.selectedColor,
      selectedSize: item.selectedSize,
      customNote: item.customNote
    }));

    return {
      id: `ord-web-${Date.now()}`,
      date: new Date().toLocaleString('vi-VN'),
      createdAt: new Date().toISOString(),
      name: name || 'Khách Facebook Messenger',
      customerName: name || 'Khách Facebook Messenger',
      phone: phone || '',
      address: address || '',
      note: note ? `${note} (Liên hệ qua: ${contactMethod === 'facebook' ? 'Facebook Messenger' : 'Form Hệ Thống'})` : `(Liên hệ qua: ${contactMethod === 'facebook' ? 'Facebook Messenger' : 'Form Hệ Thống'})`,
      items: formattedItems,
      itemDetails,
      totalPrice: subtotal,
      totalAmount: subtotal,
      source: contactMethod === 'facebook' ? ('facebook' as const) : ('website' as const),
      type: 'standard_order' as const,
      status: 'pending' as const
    };
  };

  // Option 1: Submit via system form (Shop calls/texts to confirm)
  const handleSubmitSystemOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !phone.trim() || !address.trim()) {
      alert('Vui lòng điền đầy đủ Họ tên, Số điện thoại và Địa chỉ nhận hàng.');
      return;
    }
    if (cartItems.length === 0) return;

    setIsSubmitting(true);
    const orderData = createOrderPayload('system');

    try {
      await saveOrderToFirestore(orderData);
    } catch (err) {
      console.warn('Fallback to local storage for cart order:', err);
    }

    const local = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
    local.push(orderData);
    localStorage.setItem('nak_preorders', JSON.stringify(local));

    onOrderPlaced(orderData);
    trackGA4Purchase(orderData.id, subtotal, orderData.itemDetails, 'COD_System');
    setIsSubmitting(false);
    setSuccessMode('system');
    setStep('success');
    onClearCart();
  };

  // Option 2: Directly Copy & Open Facebook Fanpage (No form required!)
  const handleSelectFacebookMethod = async () => {
    if (cartItems.length === 0) return;

    // 1. Copy order summary text to clipboard
    const orderText = buildMessengerOrderText();
    const isCopied = await copyTextToClipboard(orderText);
    setCopiedMessengerOrder(isCopied);

    // 2. Log purchase event / record
    const orderData = createOrderPayload('facebook');
    try {
      await saveOrderToFirestore(orderData);
    } catch (err) {
      console.warn('Fallback saving for messenger order:', err);
    }
    const local = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
    local.push(orderData);
    localStorage.setItem('nak_preorders', JSON.stringify(local));

    trackGA4Purchase(orderData.id, subtotal, orderData.itemDetails, 'Messenger');

    // 3. Open Facebook Fanpage immediately in new tab
    const fbWindow = window.open(facebookUrl, '_blank', 'noopener,noreferrer');
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
                    <div className="text-center py-20 text-neutral-500 space-y-4">
                      <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="font-bold text-neutral-900 text-base">Giỏ hàng của bạn đang trống</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          Hãy khám phá các bộ sưu tập Paracord thủ công độc bản từ NOT A KNOT.
                        </p>
                      </div>
                      <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-neutral-950 text-white text-xs font-semibold rounded-full hover:bg-neutral-800 transition-colors cursor-pointer shadow-sm"
                      >
                        Khám phá bộ sưu tập
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-neutral-500 pb-2 border-b border-neutral-200">
                        <span>{cartItems.length} loại sản phẩm trong giỏ</span>
                        <button
                          onClick={onClearCart}
                          className="text-red-600 hover:underline font-semibold cursor-pointer"
                        >
                          Xóa toàn bộ
                        </button>
                      </div>

                      {cartItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200"
                        >
                          <img
                            src={item.product.image}
                            alt={item.product.name}
                            className="w-16 h-16 rounded-xl object-cover border border-neutral-200 flex-shrink-0"
                          />
                          <div className="flex-grow min-w-0">
                            <h4 className="font-bold text-xs text-neutral-900 truncate">
                              {item.product.name}
                            </h4>
                            <div className="text-[11px] text-neutral-500 space-y-0.5 mt-0.5">
                              {item.selectedColor && <div>Màu: <span className="font-medium text-neutral-700">{item.selectedColor}</span></div>}
                              {item.selectedSize && <div>Size: <span className="font-medium text-neutral-700">{item.selectedSize}</span></div>}
                              {item.customNote && <div className="text-neutral-700 truncate">Ghi chú: {item.customNote}</div>}
                            </div>
                            <div className="flex items-center justify-between mt-2.5">
                              <span className="font-black text-neutral-950 text-xs font-mono">
                                {(item.product.price * item.quantity).toLocaleString('vi-VN')}đ
                              </span>

                              <div className="flex items-center border border-neutral-300 rounded-full bg-white overflow-hidden text-xs">
                                <button
                                  type="button"
                                  onClick={() => onUpdateQuantity(idx, Math.max(1, item.quantity - 1))}
                                  className="px-2 py-0.5 hover:bg-neutral-100 font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="px-2 font-bold text-neutral-800">{item.quantity}</span>
                                <button
                                  type="button"
                                  disabled={item.quantity >= (item.product.stock ?? 15)}
                                  onClick={() => onUpdateQuantity(idx, Math.min(item.product.stock ?? 15, item.quantity + 1))}
                                  className="px-2 py-0.5 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(idx)}
                            className="text-neutral-400 hover:text-red-600 p-2 cursor-pointer transition-colors"
                            title="Xóa món này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                  <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 flex items-center justify-between text-xs">
                    <span className="text-neutral-600">Tổng cộng ({cartItems.reduce((a, b) => a + b.quantity, 0)} món):</span>
                    <span className="font-black text-neutral-950 font-mono text-sm">
                      {subtotal.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-neutral-700">
                    Chọn cách đặt hàng:
                  </p>

                  {/* 2 Unified Options without icons */}
                  <div className="space-y-3">
                    {/* CÁCH 1 */}
                    <button
                      type="button"
                      onClick={() => setStep('form-checkout')}
                      className="w-full p-4 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-300 hover:border-neutral-950 text-left transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-neutral-950 text-sm">
                            Cách 1: Đặt hàng trên Website
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Điền thông tin & Shop sẽ liên hệ với bạn
                          </p>
                        </div>
                        <span className="text-xs font-bold text-neutral-400 group-hover:text-neutral-950 transition-colors flex-shrink-0">
                          Tiếp tục →
                        </span>
                      </div>
                    </button>

                    {/* CÁCH 2 */}
                    <button
                      type="button"
                      onClick={handleSelectFacebookMethod}
                      className="w-full p-4 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-300 hover:border-neutral-950 text-left transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-neutral-950 text-sm">
                            Cách 2: Đặt qua Fanpage Facebook
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Tự động copy đơn & mở chat trực tiếp với Shop
                          </p>
                        </div>
                        <span className="text-xs font-bold text-neutral-400 group-hover:text-neutral-950 transition-colors flex-shrink-0">
                          Mở Facebook →
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: FORM CHECKOUT (KHI CHỌN CÁCH 1) */}
              {step === 'form-checkout' && (
                <form onSubmit={handleSubmitSystemOrder} className="space-y-5">
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 text-xs text-neutral-700">
                    <span className="font-bold block text-neutral-950 mb-0.5">Đặt hàng trên Website:</span>
                    Vui lòng điền thông tin người nhận. Shop sẽ tự liên hệ với bạn để xác nhận đơn hàng.
                  </div>

                  {/* Contact Information Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                        Họ và tên *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nhập họ và tên..."
                        className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                        Số điện thoại *
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Nhập số điện thoại..."
                        className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                        Địa chỉ *
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Nhập địa chỉ nhận hàng..."
                        className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                        Ghi chú
                      </label>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Ghi chú thêm (nếu có)..."
                        className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Order total preview */}
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 space-y-1.5 text-xs text-neutral-600">
                    <div className="flex justify-between">
                      <span>Số lượng:</span>
                      <span className="font-bold text-neutral-900">{cartItems.reduce((a, b) => a + b.quantity, 0)} món</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-neutral-200 text-sm">
                      <span className="font-bold text-neutral-950">Tổng thanh toán:</span>
                      <span className="font-black text-neutral-950 text-base font-mono">{subtotal.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <p className="text-[11px] text-neutral-500 pt-1">
                      Shop sẽ tự liên hệ với bạn để xác nhận đơn hàng.
                    </p>
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
                      {successMode === 'facebook' ? 'Đã sao chép đơn hàng & Mở Fanpage!' : 'Đặt Hàng Thành Công!'}
                    </h4>
                    <p className="text-xs text-neutral-600 leading-relaxed max-w-sm mx-auto mt-2">
                      {successMode === 'facebook' 
                        ? 'Thông tin danh sách các món trong giỏ hàng đã được sao chép sẵn vào bộ nhớ tạm của bạn.'
                        : 'Cảm ơn bạn đã tin tưởng NOT A KNOT. Chúng tôi sẽ tiến hành kiểm tra số đo và chuẩn bị đan chiếc vòng theo đúng yêu cầu.'}
                    </p>
                  </div>

                  {/* Facebook Messenger Mode Details */}
                  {successMode === 'facebook' && (
                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-left text-xs space-y-3">
                      <div className="flex items-center gap-2 text-blue-900 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span>{copiedMessengerOrder ? 'Đã copy sẵn danh sách đơn vào bộ nhớ tạm' : 'Danh sách đơn hàng đã sẵn sàng'}</span>
                      </div>
                      <p className="text-blue-700 leading-relaxed">
                        👉 Hãy mở khung chat Messenger với <strong>NOT A KNOT</strong> và nhấn <strong>Dán (Paste / Ctrl + V)</strong> để gửi tin nhắn đặt hàng cho shop nhé!
                      </p>
                      
                      <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        <a
                          href={facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-center inline-flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Mở Fanpage Facebook</span>
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
                          className="py-3 px-4 rounded-xl bg-white hover:bg-slate-100 border border-blue-200 text-blue-800 font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép lại đơn</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* System COD Mode Details */}
                  {successMode === 'system' && (
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-left text-xs space-y-2">
                      <div className="flex items-center gap-2 text-neutral-900 font-bold">
                        <PhoneCall className="w-4 h-4 text-amber-600" />
                        <span>Nhân viên shop sẽ liên hệ xác nhận</span>
                      </div>
                      <p className="text-neutral-600 leading-relaxed">
                        Xưởng NOT A KNOT sẽ gọi điện thoại hoặc gửi tin nhắn SMS để xác nhận thông tin đơn hàng và thông báo mã vận đơn sớm nhất.
                      </p>
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
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Tổng tiền hàng:</span>
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

                <div className="flex items-center justify-center gap-4 text-[11px] text-neutral-500 pt-1">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-neutral-700" />
                    Bảo hành trọn đời
                  </span>
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-neutral-700" />
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
                  className="text-xs font-bold text-neutral-600 hover:text-neutral-950 cursor-pointer"
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
                  className="text-xs font-bold text-neutral-600 hover:text-neutral-950 cursor-pointer"
                >
                  ← Chọn cách đặt hàng khác
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
