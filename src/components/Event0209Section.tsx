import React, { useState } from 'react';
import { Product } from '../types';
import { Flag, CheckCircle2, ArrowRight, ShieldCheck, Truck, Gift, Copy, Search } from 'lucide-react';
import { saveOrderToFirestore } from '../firebase';
import { generateTrackingNumber } from '../utils/orderFormatters';

interface Event0209SectionProps {
  products: Product[];
  onOpenProductDetail: (product: Product) => void;
  onPreorderSuccess: (order: any) => void;
}

export const Event0209Section: React.FC<Event0209SectionProps> = ({
  products,
  onOpenProductDetail,
  onPreorderSuccess
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  // Selected items in preorder form
  const [prodBracelet, setProdBracelet] = useState(true);
  const [qtyBracelet, setQtyBracelet] = useState(1);
  const [prodKeychainBodoi, setProdKeychainBodoi] = useState(false);
  const [qtyKeychainBodoi, setQtyKeychainBodoi] = useState(1);
  const [prodKeychainMucoi, setProdKeychainMucoi] = useState(false);
  const [qtyKeychainMucoi, setQtyKeychainMucoi] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [createdTrackingCode, setCreatedTrackingCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const eventProducts = products.filter((p) => p.category === 'event_0209');

  // Calculate order total
  const totalPrice =
    (prodBracelet ? 39000 * qtyBracelet : 0) +
    (prodKeychainBodoi ? 29000 * qtyKeychainBodoi : 0) +
    (prodKeychainMucoi ? 35000 * qtyKeychainMucoi : 0);

  const handlePreorder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const orderItems: string[] = [];
    if (prodBracelet) orderItems.push(`Vòng tay 02/09 x${qtyBracelet}`);
    if (prodKeychainBodoi) orderItems.push(`Móc Chú bộ đội x${qtyKeychainBodoi}`);
    if (prodKeychainMucoi) orderItems.push(`Móc Mũ cối x${qtyKeychainMucoi}`);

    if (orderItems.length === 0) {
      alert('Vui lòng chọn ít nhất một sản phẩm để đăng ký đặt trước.');
      setIsSubmitting(false);
      return;
    }

    const trackingNumber = generateTrackingNumber();
    setCreatedTrackingCode(trackingNumber);

    const orderData = {
      id: `ord-0209-${Date.now()}`,
      trackingNumber,
      date: new Date().toLocaleString('vi-VN'),
      createdAt: new Date().toLocaleString('vi-VN'),
      name,
      customerName: name,
      phone,
      address,
      note,
      items: orderItems,
      totalPrice,
      totalAmount: totalPrice,
      type: 'preorder_0209' as const,
      status: 'pending'
    };

    try {
      await saveOrderToFirestore(orderData);
    } catch (err) {
      console.warn('Firestore fallback local:', err);
    }

    const local = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
    local.push(orderData);
    localStorage.setItem('nak_preorders', JSON.stringify(local));

    onPreorderSuccess(orderData);
    setSubmitSuccess(true);
    setName('');
    setPhone('');
    setAddress('');
    setNote('');
    setProdBracelet(true);
    setQtyBracelet(1);
    setProdKeychainBodoi(false);
    setQtyKeychainBodoi(1);
    setProdKeychainMucoi(false);
    setQtyKeychainMucoi(1);
    setIsSubmitting(false);

    setTimeout(() => {
      setSubmitSuccess(false);
    }, 6000);
  };

  return (
    <section id="event-0209-section" className="relative py-24 bg-stone-950 text-white overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-brand-red/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Apple-style Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-red-400 text-xs sm:text-sm font-semibold uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
            <Flag className="w-3.5 h-3.5" />
            <span>Phiên Bản Giới Hạn Quốc Khánh 02.09</span>
          </p>
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-4">
            Hào Khí Non Sông.
          </h2>
          <p className="text-neutral-400 text-base sm:text-lg font-normal leading-relaxed">
            Kỷ vật thủ công kỷ niệm ngày Tết Độc Lập 02/09/1945. Mỗi nút thắt Paracord là thông điệp tri ân quá khứ hào hùng và khẳng định bản lĩnh hôm nay.
          </p>
        </div>

        {/* 3 Event Product Cards (Clean Apple Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {eventProducts.map((prod) => (
            <div
              key={prod.id}
              id={`event-product-card-${prod.id}`}
              onClick={() => onOpenProductDetail(prod)}
              className="bg-neutral-900/90 rounded-3xl border border-neutral-800 hover:border-neutral-600 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer"
            >
              {/* Image Container */}
              <div className="relative aspect-[4/3] bg-neutral-850 overflow-hidden">
                <img
                  src={prod.image}
                  alt={prod.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                  decoding="async"
                />
                {prod.discountBadge && (
                  <div className="absolute top-4 left-4 bg-brand-red text-white px-3 py-1 text-xs font-semibold rounded-full shadow-md">
                    {prod.discountBadge}
                  </div>
                )}
              </div>

              {/* Card Body with single clear action */}
              <div className="p-6 flex flex-col flex-grow justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                    Bản giới hạn 02.09
                  </span>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-brand-gold transition-colors">
                    {prod.name}
                  </h3>
                  <p className="text-neutral-400 text-xs sm:text-sm font-normal leading-relaxed line-clamp-2 mb-4">
                    {prod.description}
                  </p>
                </div>

                <div className="border-t border-neutral-800 pt-4 flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-white text-lg">
                      {prod.price.toLocaleString('vi-VN')}đ
                    </span>
                    {prod.originalPrice && (
                      <span className="text-neutral-500 line-through text-xs font-normal">
                        {prod.originalPrice.toLocaleString('vi-VN')}đ
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-semibold text-neutral-300 group-hover:text-white flex items-center gap-1">
                    Xem chi tiết ›
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Preorder Form Container (Apple Minimalist Panel) */}
        <div
          id="order-form-container"
          className="relative max-w-3xl mx-auto bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-800 p-8 sm:p-12 text-white"
        >
          <div className="text-center mb-8">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Đặt Trước Bộ Sưu Tập 02.09
            </h3>
            <p className="text-neutral-400 text-xs sm:text-sm font-normal max-w-md mx-auto">
              Nhận hàng sớm với ưu đãi đặc biệt và quà tặng thiệp kỷ niệm kèm theo cho 500 khách hàng đầu tiên.
            </p>
          </div>

          {submitSuccess && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 space-y-2.5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                <div className="text-xs">
                  <p className="font-semibold text-sm">Đăng ký đặt trước thành công!</p>
                  <p className="text-emerald-300/80">NOT A KNOT sẽ liên hệ qua điện thoại để xác nhận thông tin đơn hàng.</p>
                </div>
              </div>

              {createdTrackingCode && (
                <div className="pt-2 border-t border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-black/40 px-3 py-2 rounded-xl">
                  <div className="text-xs">
                    <span className="text-neutral-400 block text-[10px] uppercase font-bold">Mã tra cứu đơn hàng:</span>
                    <span className="font-mono font-black text-white text-sm">{createdTrackingCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(createdTrackingCode);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      } catch {}
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <form id="preorder-form" onSubmit={handlePreorder} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Họ và tên người nhận
                </label>
                <input
                  id="preorder-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Nguyễn Văn A"
                  className="w-full px-4 py-3 bg-neutral-800/80 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Số điện thoại nhận hàng
                </label>
                <input
                  id="preorder-phone-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="0901234567"
                  className="w-full px-4 py-3 bg-neutral-800/80 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Địa chỉ nhận hàng chi tiết
              </label>
              <input
                id="preorder-address-input"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                placeholder="Số nhà, Tên đường, Phường/Xã, Tỉnh/Thành phố"
                className="w-full px-4 py-3 bg-neutral-800/80 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-white transition-colors"
              />
            </div>

            {/* Product selection items */}
            <div className="bg-neutral-850 p-4 sm:p-5 rounded-2xl border border-neutral-800 space-y-3">
              <span className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Chọn sản phẩm đặt trước
              </span>

              {/* Item 1 */}
              <div className="flex items-center justify-between py-2 border-b border-neutral-800">
                <label className="flex items-center space-x-3 cursor-pointer select-none">
                  <input
                    id="check-prod-bracelet"
                    type="checkbox"
                    checked={prodBracelet}
                    onChange={(e) => setProdBracelet(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-red accent-brand-red cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-xs sm:text-sm text-white block">Vòng Paracord 02/09 Edition</span>
                    <span className="text-neutral-400 text-xs">39.000đ</span>
                  </div>
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-neutral-400">SL:</span>
                  <input
                    id="qty-bracelet-input"
                    type="number"
                    min="1"
                    max="99"
                    value={qtyBracelet}
                    onChange={(e) => setQtyBracelet(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-center font-semibold text-white text-xs focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex items-center justify-between py-2 border-b border-neutral-800">
                <label className="flex items-center space-x-3 cursor-pointer select-none">
                  <input
                    id="check-prod-keychain-bodoi"
                    type="checkbox"
                    checked={prodKeychainBodoi}
                    onChange={(e) => setProdKeychainBodoi(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-red accent-brand-red cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-xs sm:text-sm text-white block">Móc Khóa Chú Bộ Đội</span>
                    <span className="text-neutral-400 text-xs">29.000đ</span>
                  </div>
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-neutral-400">SL:</span>
                  <input
                    id="qty-bodoi-input"
                    type="number"
                    min="1"
                    max="99"
                    value={qtyKeychainBodoi}
                    onChange={(e) => setQtyKeychainBodoi(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-center font-semibold text-white text-xs focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex items-center justify-between py-2">
                <label className="flex items-center space-x-3 cursor-pointer select-none">
                  <input
                    id="check-prod-keychain-mucoi"
                    type="checkbox"
                    checked={prodKeychainMucoi}
                    onChange={(e) => setProdKeychainMucoi(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-red accent-brand-red cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-xs sm:text-sm text-white block">Móc Khóa Mũ Cối</span>
                    <span className="text-neutral-400 text-xs">35.000đ</span>
                  </div>
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-neutral-400">SL:</span>
                  <input
                    id="qty-mucoi-input"
                    type="number"
                    min="1"
                    max="99"
                    value={qtyKeychainMucoi}
                    onChange={(e) => setQtyKeychainMucoi(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-center font-semibold text-white text-xs focus:outline-none focus:border-white"
                  />
                </div>
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Ghi chú thêm (Yêu cầu riêng)
              </label>
              <input
                id="preorder-note-input"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Giao giờ hành chính, gọi trước..."
                className="w-full px-4 py-3 bg-neutral-800/80 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-white transition-colors"
              />
            </div>

            {/* Total summary & Action */}
            <div className="pt-4 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-neutral-400 block">Tạm tính đơn đặt trước</span>
                <span className="text-2xl font-bold text-white">
                  {totalPrice.toLocaleString('vi-VN')}đ
                </span>
              </div>

              <button
                id="preorder-submit-btn"
                type="submit"
                disabled={isSubmitting || totalPrice === 0}
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <span>{isSubmitting ? 'Đang gửi...' : 'Hoàn tất đặt trước'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
