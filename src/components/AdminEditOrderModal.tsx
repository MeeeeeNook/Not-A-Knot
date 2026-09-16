import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Product, SellerUser, OrderItemDetail, ProductOmamoriOption } from '../types';
import { StoredOrder, saveOrderToFirestore } from '../firebase';
import { 
  formatOrderDateWithoutSeconds, 
  getCleanOrderNote, 
  getOrderTrackingNumber, 
  generateTrackingNumber, 
  getCarrierTrackingUrl,
  normalizeOrderStatus,
  formatToDatetimeLocal,
  safeIsoDateString
} from '../utils/orderFormatters';
import { deduplicateSellers } from '../utils/auth';
import { 
  UserCheck, 
  Lock, 
  Truck, 
  Package, 
  ExternalLink, 
  CheckCircle2, 
  Hammer, 
  ShieldCheck, 
  Clock, 
  Plus, 
  Trash2, 
  Calendar, 
  MapPin, 
  Phone, 
  CreditCard, 
  Tag, 
  FileText, 
  Image as ImageIcon,
  Sparkles,
  ShoppingBag,
  Check,
  X
} from 'lucide-react';

interface EditableOrderItem {
  productId: string;
  productName: string;
  category?: string;
  price: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  selectedColorImage?: string;
  selectedCharm?: string;
  selectedCharmImage?: string;
  selectedCharmPrice?: number;
  selectedKhoen?: string;
  selectedKhoenImage?: string;
  selectedKhoenPrice?: number;
  selectedOmamoris?: ProductOmamoriOption[];
  selectedOmamoriPrice?: number;
  customNote?: string;
}

interface AdminEditOrderModalProps {
  order: StoredOrder;
  products?: Product[];
  allProducts?: Product[];
  sellers?: SellerUser[];
  onClose: () => void;
  onSaved?: (updatedOrder: StoredOrder) => void;
  onSave?: (updatedOrder: StoredOrder) => void;
}

const PROGRESS_STEPS = [
  { step: 1, id: 'received', label: 'Tiếp nhận đơn', desc: 'Đã nhận yêu cầu đan dây', status: 'Chờ xác nhận', icon: Package },
  { step: 2, id: 'confirmed', label: 'Xác nhận đơn', desc: 'Đã chốt mẫu charm & chi tiết', status: 'Đã xác nhận', icon: CheckCircle2 },
  { step: 3, id: 'crafting', label: 'Đang đan Paracord', desc: 'Nghệ nhân thắt dây thủ công', status: 'Knot đang được sản xuất', icon: Hammer },
  { step: 4, id: 'shipping', label: 'Đang giao hàng', desc: 'Đã bàn giao cho bưu tá', status: 'Đang giao hàng', icon: Truck },
  { step: 5, id: 'completed', label: 'Giao thành công', desc: 'Kích hoạt bảo hành trọn đời', status: 'Đơn hàng giao thành công', icon: ShieldCheck },
];

export const AdminEditOrderModal: React.FC<AdminEditOrderModalProps> = ({
  order,
  products: propProducts,
  allProducts,
  sellers = [],
  onClose,
  onSaved,
  onSave
}) => {
  const products = propProducts || allProducts || [];

  // Normalize source
  const normalizeSource = (s?: string): 'website' | 'mạng xã hội' | 'trực tiếp' => {
    if (!s || s === 'website') return 'website';
    if (s === 'facebook' || s === 'zalo' || s === 'instagram' || s === 'tiktok' || s === 'mạng xã hội' || s === 'social') return 'mạng xã hội';
    return 'trực tiếp';
  };

  // 1. Core Header & Tracking
  const [trackingNumber, setTrackingNumber] = useState<string>(
    order.trackingNumber || getOrderTrackingNumber(order)
  );
  const [orderDate, setOrderDate] = useState<string>(() => {
    return formatToDatetimeLocal(order.createdAt) || formatToDatetimeLocal(order.date) || '';
  });
  const [source, setSource] = useState<'website' | 'mạng xã hội' | 'trực tiếp'>(normalizeSource(order.source));

  // 2. Customer & Delivery Info
  const [customerName, setCustomerName] = useState(order.name || order.customerName || '');
  const [phone, setPhone] = useState(order.phone || '');
  const [address, setAddress] = useState(order.address || '');
  const [note, setNote] = useState(getCleanOrderNote(order.note));

  // 3. Status & 5-Step Crafting Progress
  const [status, setStatus] = useState<string>(normalizeOrderStatus(order.status) || 'Chờ xác nhận');
  const [craftingStageNote, setCraftingStageNote] = useState<string>(order.craftingStageNote || '');

  // 4. Products List
  const [items, setItems] = useState<EditableOrderItem[]>(() => {
    if (order.itemDetails && order.itemDetails.length > 0) {
      return order.itemDetails.map((it) => ({
        productId: it.productId || 'custom',
        productName: it.productName,
        category: it.category || 'Khác',
        price: it.unitPrice || it.price || 0,
        quantity: it.quantity || 1,
        selectedSize: it.selectedSize || '',
        selectedColor: it.selectedColor || '',
        selectedColorImage: it.selectedColorImage,
        selectedCharm: typeof it.selectedCharm === 'object' ? (it.selectedCharm as any).name : (it.selectedCharm || ''),
        selectedCharmImage: it.selectedCharmImage,
        selectedCharmPrice: it.selectedCharmPrice,
        selectedKhoen: it.selectedKhoen || '',
        selectedKhoenImage: it.selectedKhoenImage,
        selectedKhoenPrice: it.selectedKhoenPrice,
        selectedOmamoris: it.selectedOmamoris,
        selectedOmamoriPrice: it.selectedOmamoriPrice,
        customNote: it.customNote || ''
      }));
    }
    if (order.items) {
      const itemsArr = Array.isArray(order.items)
        ? order.items
        : typeof order.items === 'string'
        ? [order.items]
        : [];
      if (itemsArr.length > 0) {
        return itemsArr.map((itStr, idx) => ({
          productId: `item-${idx}`,
          productName: String(itStr),
          price: order.totalPrice ? Math.round(order.totalPrice / itemsArr.length) : 39000,
          quantity: 1,
          selectedSize: '',
          selectedColor: '',
          selectedCharm: '',
          selectedKhoen: '',
          customNote: ''
        }));
      }
    }
    return [
      {
        productId: 'custom-1',
        productName: 'Vòng Paracord Thủ Công',
        price: 39000,
        quantity: 1,
        selectedSize: '16cm',
        selectedColor: 'Đỏ son & Vàng kim',
        selectedCharm: 'Charm Hào Khí',
        selectedKhoen: '',
        customNote: ''
      }
    ];
  });

  // 5. Payment & Financials
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>(
    order.paymentStatus === 'paid' ? 'paid' : 'unpaid'
  );
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'cod'>(
    (order.paymentMethod as any) || (order.bankReceiptImage ? 'bank_transfer' : 'cod')
  );
  const [shippingFee, setShippingFee] = useState<number>(order.shippingFee || 0);
  const [discountAmount, setDiscountAmount] = useState<number>(order.discountAmount || 0);
  const [voucherCode, setVoucherCode] = useState<string>(order.voucherCode || '');
  const [customTotalOverride, setCustomTotalOverride] = useState<string>(
    order.totalPrice !== undefined && order.totalPrice !== null ? String(order.totalPrice) : ''
  );
  const [isManualTotal, setIsManualTotal] = useState<boolean>(false);
  const [bankReceiptImage, setBankReceiptImage] = useState<string>(order.bankReceiptImage || '');
  const [bankTransferRef, setBankTransferRef] = useState<string>(order.bankTransferRef || '');

  // 6. Shipping Partner Details
  const [shippingCarrier, setShippingCarrier] = useState<string>(order.shippingCarrier || '');
  const [shippingCode, setShippingCode] = useState<string>(order.shippingCode || '');
  const [estimatedDelivery, setEstimatedDelivery] = useState<string>(order.estimatedDelivery || '');

  // 7. Seller / Handcrafter Assignment
  const [sellerName, setSellerName] = useState<string>(order.sellerName || 'Mạnh Cường');

  // UI state
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedAddProductId, setSelectedAddProductId] = useState<string>(products[0]?.id || 'custom');
  const [customAddName, setCustomAddName] = useState('');
  const [addPrice, setAddPrice] = useState<number>(39000);
  const [addQty, setAddQty] = useState<number>(1);
  const [addSize, setAddSize] = useState('');
  const [addColor, setAddColor] = useState('');
  const [addCharm, setAddCharm] = useState('');
  const [addCustomNote, setAddCustomNote] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [previewZoomReceipt, setPreviewZoomReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subtotal calculation of products
  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  }, [items]);

  // Final Total Price
  const finalCalculatedTotal = useMemo(() => {
    if (isManualTotal && customTotalOverride.trim() !== '') {
      return Math.max(0, parseInt(customTotalOverride, 10) || 0);
    }
    return Math.max(0, itemsSubtotal + (Number(shippingFee) || 0) - (Number(discountAmount) || 0));
  }, [itemsSubtotal, shippingFee, discountAmount, isManualTotal, customTotalOverride]);

  // When items change and not in manual mode, update customTotalOverride placeholder
  useEffect(() => {
    if (!isManualTotal) {
      setCustomTotalOverride(String(itemsSubtotal + (Number(shippingFee) || 0) - (Number(discountAmount) || 0)));
    }
  }, [itemsSubtotal, shippingFee, discountAmount, isManualTotal]);

  // Handle product item changes
  const handleUpdateItemField = (index: number, field: keyof EditableOrderItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('Đơn hàng phải có ít nhất 1 sản phẩm.');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddProductToItems = () => {
    let name = customAddName.trim();
    let cat = 'Thủ công';
    let price = addPrice;

    if (selectedAddProductId !== 'custom') {
      const prod = products.find((p) => p.id === selectedAddProductId);
      if (prod) {
        name = prod.name;
        cat = prod.category;
        price = prod.price;
      }
    }

    if (!name) {
      alert('Vui lòng nhập tên sản phẩm.');
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        productId: selectedAddProductId,
        productName: name,
        category: cat,
        price: Math.max(0, price),
        quantity: Math.max(1, addQty),
        selectedSize: addSize.trim() || undefined,
        selectedColor: addColor.trim() || undefined,
        selectedCharm: addCharm.trim() || undefined,
        customNote: addCustomNote.trim() || undefined
      }
    ]);

    // Reset add dialog
    setIsAddingProduct(false);
    setCustomAddName('');
    setAddPrice(39000);
    setAddQty(1);
    setAddSize('');
    setAddColor('');
    setAddCharm('');
    setAddCustomNote('');
  };

  // Image upload handling for bill receipt
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
        const maxDim = 2048;
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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          let compressed = '';
          try {
            compressed = canvas.toDataURL('image/webp', 0.92);
            if (!compressed || !compressed.startsWith('data:image/webp')) {
              compressed = canvas.toDataURL('image/jpeg', 0.92);
            }
          } catch {
            compressed = canvas.toDataURL('image/jpeg', 0.92);
          }
          setBankReceiptImage(compressed);
        } else {
          setBankReceiptImage(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Clipboard paste support for receipt
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

  // Save Order
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Vui lòng nhập tên khách nhận hàng.');
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
      const matchedSellerObj = sellerName
        ? sellers.find((s) => s.name === sellerName || s.username === sellerName)
        : undefined;
      const finalSellerId = matchedSellerObj?.id || order.sellerId || undefined;
      const finalSellerName = sellerName.trim() || order.sellerName || undefined;

      const finalTotal = finalCalculatedTotal;

      const safeIso = safeIsoDateString(orderDate, order.createdAt || order.date);
      const safeDisplayDate = formatOrderDateWithoutSeconds(safeIso);

      const updatedOrder: StoredOrder = {
        ...order,
        date: safeDisplayDate,
        createdAt: safeIso,
        name: customerName.trim(),
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        note: note.trim(),
        source,
        status: status as any,
        craftingStageNote: craftingStageNote.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
        shippingCarrier: shippingCarrier.trim() || undefined,
        shippingCode: shippingCode.trim() || undefined,
        estimatedDelivery: estimatedDelivery.trim() || undefined,
        paymentStatus,
        paymentMethod,
        bankReceiptImage: bankReceiptImage || undefined,
        bankTransferRef: bankTransferRef.trim() || undefined,
        shippingFee: Number(shippingFee) || 0,
        discountAmount: Number(discountAmount) || 0,
        voucherCode: voucherCode.trim() ? voucherCode.trim().toUpperCase() : undefined,
        voucherDiscountAmount: Number(discountAmount) || undefined,
        voucherType: order.voucherType,
        totalPrice: finalTotal,
        totalAmount: finalTotal,
        paidAmount: paymentStatus === 'paid' ? finalTotal : 0,
        sellerId: finalSellerId,
        sellerName: finalSellerName,
        itemDetails: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          category: it.category,
          unitPrice: Number(it.price) || 0,
          price: Number(it.price) || 0,
          quantity: Number(it.quantity) || 1,
          selectedSize: it.selectedSize || undefined,
          selectedColor: it.selectedColor || undefined,
          selectedColorImage: it.selectedColorImage || undefined,
          selectedCharm: it.selectedCharm || undefined,
          selectedCharmImage: it.selectedCharmImage || undefined,
          selectedCharmPrice: it.selectedCharmPrice || undefined,
          selectedKhoen: it.selectedKhoen || undefined,
          selectedKhoenImage: it.selectedKhoenImage || undefined,
          selectedKhoenPrice: it.selectedKhoenPrice || undefined,
          selectedOmamoris: it.selectedOmamoris || undefined,
          selectedOmamoriPrice: it.selectedOmamoriPrice || undefined,
          customNote: it.customNote || undefined
        })),
        items: items.map((it) => {
          const specs = [
            it.selectedSize ? `Size: ${it.selectedSize}` : '',
            it.selectedColor ? `Màu: ${it.selectedColor}` : '',
            it.selectedCharm ? `Charm: ${it.selectedCharm}` : '',
            it.selectedKhoen ? `Khoen: ${it.selectedKhoen}` : '',
            it.selectedOmamoris && it.selectedOmamoris.length > 0 ? `Bùa: ${it.selectedOmamoris.map((o) => o.name).join(', ')}` : ''
          ].filter(Boolean).join(', ');
          return `${it.productName}${specs ? ` (${specs})` : ''} x${it.quantity}`;
        })
      };

      // Notify parent immediately so local state & storage update without blocking
      if (typeof onSaved === 'function') {
        onSaved(updatedOrder);
      } else if (typeof onSave === 'function') {
        onSave(updatedOrder);
      }
      onClose();

      // Sync to Firestore
      saveOrderToFirestore(updatedOrder).catch((err) => {
        console.warn('Lỗi đồng bộ Firebase từ modal sửa đơn:', err);
      });
    } catch (err) {
      console.error('Lỗi khi lưu chỉnh sửa đơn hàng:', err);
      alert('Có lỗi xảy ra khi lưu đơn hàng. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] overflow-hidden flex flex-col border border-slate-200 shadow-2xl relative my-auto animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-black text-lg text-slate-900">
                  Chỉnh Sửa Chi Tiết Đơn Hàng
                </h3>
                <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded-lg">
                  {trackingNumber || order.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Mọi thông tin chỉnh sửa tại đây sẽ cập nhật trực tiếp lên trang tra cứu đơn của khách và hệ thống xưởng.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSaveOrder} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-xs text-slate-700">
            
            {/* ============================================================ */}
            {/* SECTION 1: HEADER, TRACKING CODE & SOURCE                    */}
            {/* ============================================================ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-600" />
                  <span>1. Mã Đơn Hàng, Ngày Tạo & Nguồn Đơn</span>
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  (Hiển thị trên đầu trang tra cứu)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Tracking Number */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      Mã đơn / Tra cứu *
                    </label>
                    <button
                      type="button"
                      onClick={() => setTrackingNumber(generateTrackingNumber())}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                    >
                      Tạo mã NAK mới
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                    placeholder="NAK-260909-2065"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-950 focus:outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>

                {/* Order Date & Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Thời gian tạo đơn
                  </label>
                  <input
                    type="datetime-local"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-950 focus:outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>

                {/* Order Source */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Kênh đặt hàng (Nguồn đơn)
                  </label>
                  <select
                    value={source}
                    onChange={(e: any) => setSource(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-950 focus:outline-none focus:bg-white focus:border-amber-500 cursor-pointer"
                  >
                    <option value="website">Website (Online)</option>
                    <option value="mạng xã hội">Mạng xã hội (Facebook/Zalo/TikTok)</option>
                    <option value="trực tiếp">Trực tiếp tại xưởng / Hotline</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 2: 5-STEP CRAFTING PROGRESS (TIẾN TRÌNH CHẾ TÁC)     */}
            {/* ============================================================ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>2. Tiến Trình Chế Tác & Vận Chuyển Thủ Công (5 Bước)</span>
                </span>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                  Đang ở: {status}
                </span>
              </div>

              {/* Interactive Stepper Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Bấm để chọn bước hiện tại của đơn:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {PROGRESS_STEPS.map((step) => {
                    const IconComp = step.icon;
                    const isSelected = status === step.status;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setStatus(step.status)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-50 border-amber-400 shadow-xs ring-2 ring-amber-300/40'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black text-slate-400">
                            BƯỚC 0{step.step}
                          </span>
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                            isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-200 text-slate-500'
                          }`}>
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div>
                          <span className={`block font-black text-xs leading-tight ${isSelected ? 'text-amber-950' : 'text-slate-800'}`}>
                            {step.label}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                            {step.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dropdown status backup & Cancel option */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Trạng thái đơn hàng tổng quát
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Chờ xác nhận">Bước 1: Chờ xác nhận (Tiếp nhận đơn)</option>
                    <option value="Đã xác nhận">Bước 2: Đã xác nhận (Xác nhận số đo)</option>
                    <option value="Knot đang được sản xuất">Bước 3: Knot đang được sản xuất (Đang đan Paracord)</option>
                    <option value="Đang giao hàng">Bước 4: Đang giao hàng (Bàn giao bưu tá)</option>
                    <option value="Đơn hàng giao thành công">Bước 5: Đơn hàng giao thành công (Kích hoạt bảo hành)</option>
                    <option value="Đã hủy">Đã hủy đơn hàng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ghi chú chi tiết tiến trình chế tác (Hiển thị cho khách)
                  </label>
                  <input
                    type="text"
                    value={craftingStageNote}
                    onChange={(e) => setCraftingStageNote(e.target.value)}
                    placeholder="VD: Đang đan mắt Snake Knot bản 16mm, charm mỏ neo titan..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 3: PRODUCTS IN ORDER (SẢN PHẨM CHẾ TÁC)              */}
            {/* ============================================================ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                  <span>3. Danh Sách Sản Phẩm Chế Tác Trong Đơn</span>
                </span>
                
                <button
                  type="button"
                  onClick={() => setIsAddingProduct(!isAddingProduct)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Thêm sản phẩm</span>
                </button>
              </div>

              {/* Add Product Modal Form */}
              {isAddingProduct && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/70">
                    <span className="font-black text-xs text-amber-950">
                      Thêm Món Mới Vào Đơn Hàng
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="text-amber-900 hover:text-black text-xs font-bold cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Chọn từ kho sản phẩm có sẵn:
                      </label>
                      <select
                        value={selectedAddProductId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedAddProductId(val);
                          if (val !== 'custom') {
                            const p = products.find((x) => x.id === val);
                            if (p) {
                              setCustomAddName(p.name);
                              setAddPrice(p.price);
                            }
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                      >
                        <option value="custom">+ Tự nhập tên & món tùy biến</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.price.toLocaleString('vi-VN')}đ
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Tên sản phẩm chế tác *:
                      </label>
                      <input
                        type="text"
                        value={customAddName}
                        onChange={(e) => setCustomAddName(e.target.value)}
                        placeholder="VD: Vòng Paracord 02/09 Edition"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Màu sắc:</label>
                      <input
                        type="text"
                        value={addColor}
                        onChange={(e) => setAddColor(e.target.value)}
                        placeholder="VD: Đỏ son & Vàng kim"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Charm đính kèm:</label>
                      <input
                        type="text"
                        value={addCharm}
                        onChange={(e) => setAddCharm(e.target.value)}
                        placeholder="VD: Charm Bạc 925"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Đơn giá (đ):</label>
                      <input
                        type="number"
                        min="0"
                        value={addPrice}
                        onChange={(e) => setAddPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAddProductToItems}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                    >
                      Xác nhận thêm món
                    </button>
                  </div>
                </div>
              )}

              {/* Items List Table */}
              <div className="space-y-3">
                {items.map((it, idx) => {
                  const lineTotal = (Number(it.price) || 0) * (Number(it.quantity) || 1);

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/70">
                        <div className="flex-1">
                          <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">
                            Món #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={it.productName}
                            onChange={(e) => handleUpdateItemField(idx, 'productName', e.target.value)}
                            placeholder="Tên sản phẩm..."
                            className="w-full font-black text-sm text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Quantity */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-500">SL:</span>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => handleUpdateItemField(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                            />
                          </div>

                          {/* Unit Price */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-500">Đơn giá:</span>
                            <input
                              type="number"
                              min="0"
                              value={it.price}
                              onChange={(e) => handleUpdateItemField(idx, 'price', Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right"
                            />
                            <span className="text-xs text-slate-500 font-bold">đ</span>
                          </div>

                          {/* Subtotal */}
                          <span className="font-mono font-black text-slate-950 text-sm min-w-[90px] text-right">
                            {lineTotal.toLocaleString('vi-VN')}đ
                          </span>

                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa món này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Custom Attributes: Color, Charm, Khoen, Custom Note */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Màu sắc:</label>
                          <input
                            type="text"
                            value={it.selectedColor || ''}
                            onChange={(e) => handleUpdateItemField(idx, 'selectedColor', e.target.value)}
                            placeholder="VD: Đen rằn ri"
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Charm đính kèm:</label>
                          <input
                            type="text"
                            value={it.selectedCharm || ''}
                            onChange={(e) => handleUpdateItemField(idx, 'selectedCharm', e.target.value)}
                            placeholder="VD: Bạc 925"
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Khoen đính kèm:</label>
                          <input
                            type="text"
                            value={it.selectedKhoen || ''}
                            onChange={(e) => handleUpdateItemField(idx, 'selectedKhoen', e.target.value)}
                            placeholder="VD: Khoen D-Ring Titan"
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Ghi chú xưởng:</label>
                          <input
                            type="text"
                            value={it.customNote || ''}
                            onChange={(e) => handleUpdateItemField(idx, 'customNote', e.target.value)}
                            placeholder="VD: Thắt lỏng 0.5cm..."
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 4: CUSTOMER & DELIVERY ADDRESS                       */}
            {/* ============================================================ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  <span>4. Địa Chỉ & Người Nhận Kiện Hàng</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Người nhận (Họ tên khách) *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-950 focus:outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Số điện thoại nhận hàng *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="VD: 0987654321"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-950 focus:outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Địa chỉ nhận kiện hàng chi tiết
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-950 focus:outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Ghi chú của khách hàng (Note)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú thời gian giao hoặc yêu cầu riêng của khách..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-950 focus:outline-none focus:bg-white focus:border-amber-500"
                />
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 5: PAYMENT, SHIPPING FEE & FINANCIALS                */}
            {/* ============================================================ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <span>5. Thanh Toán & Hóa Đơn Chi Tiết</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Hình thức thanh toán
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 cursor-pointer"
                  >
                    <option value="cod">Thanh toán COD khi nhận hàng</option>
                    <option value="bank_transfer">Chuyển khoản VietQR</option>
                    <option value="cash">Tiền mặt tại xưởng</option>
                  </select>
                </div>

                {/* Payment Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Trạng thái thanh toán
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentStatus('unpaid')}
                      className={`py-2 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                        paymentStatus === 'unpaid'
                          ? 'bg-amber-100 text-amber-950 border-amber-300 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Chờ thanh toán
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentStatus('paid')}
                      className={`py-2 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                        paymentStatus === 'paid'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Đã thanh toán đủ
                    </button>
                  </div>
                </div>
              </div>

              {/* Shipping Fee, Discount & Total Amount Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                {/* Voucher display & edit row */}
                <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-amber-950">Mã giảm giá (Voucher) sử dụng:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      placeholder="Mã voucher (VD: KNOT10)"
                      className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-mono uppercase font-black text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    {order.voucherType && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 shrink-0">
                        {order.voucherType === 'freeship' ? 'Freeship' : 'Giảm %'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tổng tiền hàng (Sản phẩm):
                    </label>
                    <span className="font-mono font-black text-slate-900 text-sm block py-1.5">
                      {itemsSubtotal.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Phí giao hàng (0 = Freeship):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={shippingFee}
                        onChange={(e) => setShippingFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono"
                      />
                      <span className="text-xs font-bold text-slate-500">đ</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Giảm giá / Chiết khấu:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-emerald-700"
                      />
                      <span className="text-xs font-bold text-slate-500">đ</span>
                    </div>
                  </div>
                </div>

                {/* Final Total */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-900">
                      TỔNG TIỀN ĐƠN HÀNG:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsManualTotal(!isManualTotal)}
                      className="text-[10px] font-bold text-amber-600 hover:underline cursor-pointer"
                    >
                      {isManualTotal ? 'Quay lại tính tự động' : 'Tùy chỉnh số tiền thủ công'}
                    </button>
                  </div>

                  {isManualTotal ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={customTotalOverride}
                        onChange={(e) => setCustomTotalOverride(e.target.value)}
                        className="w-36 px-3 py-1.5 bg-white border-2 border-amber-400 rounded-xl text-base font-black font-mono text-amber-900 text-right"
                      />
                      <span className="text-sm font-bold text-slate-700">đ</span>
                    </div>
                  ) : (
                    <span className="text-xl sm:text-2xl font-black font-mono text-amber-900">
                      {finalCalculatedTotal.toLocaleString('vi-VN')}đ
                    </span>
                  )}
                </div>
              </div>

              {/* Bank Transfer Details / Receipt Image */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã GD / Nội dung chuyển khoản ngân hàng
                  </label>
                  <input
                    type="text"
                    value={bankTransferRef}
                    onChange={(e) => setBankTransferRef(e.target.value)}
                    placeholder="VD: MB-883921 hoặc NGUYEN VAN A"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ảnh Bill chuyển khoản (Hóa đơn)
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

                  {bankReceiptImage && bankReceiptImage.trim() ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={bankReceiptImage}
                          alt="Bill Receipt"
                          className="w-12 h-12 rounded-lg object-cover border border-slate-300 cursor-pointer"
                          onClick={() => setPreviewZoomReceipt(true)}
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Đã có ảnh bill</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <button
                              type="button"
                              onClick={() => setPreviewZoomReceipt(true)}
                              className="text-[11px] text-slate-600 hover:text-slate-900 font-bold underline"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-[11px] text-amber-700 hover:text-amber-900 font-bold underline"
                            >
                              Đổi
                            </button>
                            <button
                              type="button"
                              onClick={() => setBankReceiptImage('')}
                              className="text-[11px] text-rose-600 hover:text-rose-800 font-bold underline"
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
                      className="border-2 border-dashed border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-white p-3 rounded-xl text-center cursor-pointer transition-colors"
                    >
                      <span className="text-xs font-bold text-slate-600 block">
                        + Tải ảnh Bill hoặc dán Ctrl+V
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 6: SHIPPING CARRIER & PARTNER CODE                   */}
            {/* ============================================================ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>6. Thông Tin Vận Chuyển Đối Tác</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Đơn vị vận chuyển
                  </label>
                  <input
                    type="text"
                    list="carrier-suggestions"
                    value={shippingCarrier}
                    onChange={(e) => setShippingCarrier(e.target.value)}
                    placeholder="Viettel Post, GHTK, GHN..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-950 focus:outline-none focus:bg-white focus:border-amber-500"
                  />
                  <datalist id="carrier-suggestions">
                    <option value="Viettel Post" />
                    <option value="Giao Hàng Tiết Kiệm (GHTK)" />
                    <option value="Giao Hàng Nhanh (GHN)" />
                    <option value="J&T Express" />
                    <option value="VNPost (Bưu Điện)" />
                    <option value="Grab / Ahamove hỏa tốc" />
                  </datalist>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      Mã vận đơn đối tác
                    </label>
                    {shippingCode && getCarrierTrackingUrl(shippingCarrier, shippingCode) && (
                      <a
                        href={getCarrierTrackingUrl(shippingCarrier, shippingCode)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Tra cứu</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    value={shippingCode}
                    onChange={(e) => setShippingCode(e.target.value)}
                    placeholder="VD: 198273645"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-950 focus:outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Thời gian dự kiến giao
                  </label>
                  <input
                    type="text"
                    value={estimatedDelivery}
                    onChange={(e) => setEstimatedDelivery(e.target.value)}
                    placeholder="VD: 1-2 ngày, hoặc 15/09/2026"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-950 focus:outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 7: SELLER / HANDCRAFTER IN CHARGE                    */}
            {/* ============================================================ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-600" />
                <span>7. Nhân Viên / Nghệ Nhân Phụ Trách Đơn Hàng</span>
              </span>

              {(() => {
                const isLockedSeller = source === 'website' || source === 'mạng xã hội';
                return (
                  <div>
                    <select
                      disabled={isLockedSeller}
                      value={isLockedSeller ? '' : sellerName}
                      onChange={(e) => setSellerName(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isLockedSeller
                          ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 cursor-pointer'
                      }`}
                    >
                      {isLockedSeller ? (
                        <option value="">🔒 Đơn từ {source === 'website' ? 'Website' : 'Mạng xã hội'} — Tự động phân bổ xưởng</option>
                      ) : sellers.length > 0 ? (
                        deduplicateSellers(sellers).map((s, idx) => (
                          <option key={`edit-order-seller-${s.id || s.username}-${idx}`} value={s.name}>
                            {s.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Mạnh Cường">Mạnh Cường</option>
                          <option value="Thu Trang">Thu Trang</option>
                          <option value="Hoàng Nam">Hoàng Nam</option>
                          <option value="Minh Anh">Minh Anh</option>
                        </>
                      )}
                    </select>
                  </div>
                );
              })()}
            </div>

          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-slate-500 hidden sm:inline">
              Đảm bảo đã kiểm tra chi tiết đơn hàng trước khi lưu.
            </span>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition-colors cursor-pointer shadow-2xs"
              >
                Hủy Bỏ
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSaving ? 'Đang Lưu...' : 'Lưu Thay Đổi Đơn Hàng'}
              </button>
            </div>
          </div>
        </form>

        {/* Zoom Lightbox */}
        {previewZoomReceipt && bankReceiptImage && bankReceiptImage.trim() && (
          <div
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setPreviewZoomReceipt(false)}
          >
            <div className="relative max-w-xl w-full bg-white p-4 rounded-3xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
                <span className="text-xs font-black text-slate-900">Ảnh Bill Hóa Đơn Chuyển Khoản</span>
                <button
                  onClick={() => setPreviewZoomReceipt(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <img
                src={bankReceiptImage}
                alt="Bill Full"
                className="max-h-[70vh] w-auto mx-auto rounded-xl object-contain shadow-md"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
