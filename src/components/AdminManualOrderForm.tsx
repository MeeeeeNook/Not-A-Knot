import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Product,
  PaymentMethod,
  PaymentStatus,
  SellerUser,
  ProductCharmOption,
  ProductOmamoriOption,
  ProductKhoenOption,
  ProductColorOption,
  Voucher
} from '../types';
import { StoredOrder, saveOrderToFirestore, saveProductToFirestore } from '../firebase';
import { formatOrderDateWithoutSeconds, generateTrackingNumber } from '../utils/orderFormatters';
import {
  UserCheck,
  Lock,
  MapPin,
  Building2,
  Tag,
  Percent,
  Check,
  X,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  Flame,
  CircleDot,
  Palette,
  Truck,
  RotateCcw,
  Gift,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { VIETNAM_PROVINCES, getDistrictsByProvince, calculateShippingFee } from '../data/vietnamLocations';
import { getVouchers, validateVoucherCode } from '../utils/voucherManager';
import { DEFAULT_OMAMORI_PRESETS } from '../data/sampleOmamori';
import { DEFAULT_KHOEN_PRESETS } from '../data/sampleKhoen';
import { ProductCharmSelector } from './ProductCharmSelector';
import { ProductOmamoriSelector } from './ProductOmamoriSelector';
import { ProductKhoenSelector } from './ProductKhoenSelector';
import { ProductColorSelector } from './ProductColorSelector';
import { LoadingImage } from './LoadingImage';

interface AdminManualOrderFormProps {
  products: Product[];
  sellers?: SellerUser[];
  currentSeller?: SellerUser | null;
  onUpdateProducts: (newProducts: Product[]) => void;
  onOrderCreated: (newOrder: StoredOrder) => void;
  onNavigateToOrders: () => void;
}

interface ManualOrderItem {
  product: Product;
  quantity: number;
  customNote?: string;
  selectedColor?: string;
  selectedColorImage?: string;
  selectedCharm?: string;
  selectedCharmImage?: string;
  selectedCharmPrice?: number;
  selectedCharms?: ProductCharmOption[];
  selectedOmamoris?: ProductOmamoriOption[];
  selectedOmamoriPrice?: number;
  selectedKhoen?: string;
  selectedKhoenImage?: string;
  selectedKhoenPrice?: number;
  selectedSize?: string;
}

export const AdminManualOrderForm: React.FC<AdminManualOrderFormProps> = ({
  products,
  sellers = [],
  currentSeller,
  onUpdateProducts,
  onOrderCreated,
  onNavigateToOrders
}) => {
  // 1. FILTER OUT HIDDEN PRODUCTS (Ẩn các sản phẩm bị ẩn)
  const activeProducts = useMemo(() => {
    return products.filter((p) => p.isHidden !== true);
  }, [products]);

  // Priority sort sellers list so that the currently logged-in seller is ALWAYS FIRST on the list
  const sortedSellers = useMemo(() => {
    if (!sellers || sellers.length === 0) {
      const defaultNames = [
        'Mạnh Cường',
        'Thu Trang',
        'Hoàng Nam',
        'Minh Anh',
        'Khánh Linh',
        'Việt Anh',
        'Thanh Hương',
        'Quang Huy',
        'Ngọc Mai'
      ];
      if (currentSeller?.name) {
        return [
          currentSeller.name,
          ...defaultNames.filter((n) => n.toLowerCase() !== currentSeller.name.toLowerCase())
        ];
      }
      return defaultNames;
    }

    if (!currentSeller) return sellers.map((s) => s.name);

    const currentName = currentSeller.name.trim().toLowerCase();
    const currentUsername = (currentSeller.username || '').trim().toLowerCase();

    const loggedInList: string[] = [];
    const otherList: string[] = [];

    sellers.forEach((s) => {
      const sName = s.name.trim().toLowerCase();
      const sUser = (s.username || '').trim().toLowerCase();
      if (sName === currentName || (currentUsername && sUser === currentUsername)) {
        loggedInList.push(s.name);
      } else {
        otherList.push(s.name);
      }
    });

    if (loggedInList.length === 0 && currentSeller.name) {
      loggedInList.push(currentSeller.name);
    }

    return [...loggedInList, ...otherList];
  }, [sellers, currentSeller]);

  // Seller assignment state
  const [selectedSellerName, setSelectedSellerName] = useState<string>(() => {
    if (currentSeller?.name) return currentSeller.name;
    if (sellers.length > 0) return sellers[0].name;
    return 'Mạnh Cường';
  });

  useEffect(() => {
    if (currentSeller?.name) {
      setSelectedSellerName(currentSeller.name);
    }
  }, [currentSeller]);

  // Customer info state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [orderSource, setOrderSource] = useState<'website' | 'mạng xã hội' | 'trực tiếp'>('trực tiếp');
  const [orderNote, setOrderNote] = useState('');
  const [orderStatus, setOrderStatus] = useState<'Đã đặt' | 'Đã tiếp nhận' | 'Đã thanh toán' | 'Đã giao'>('Đã đặt');

  // Location & Shipping calculations
  const availableDistricts = useMemo(() => getDistrictsByProvince(province), [province]);
  const calculatedShippingInfo = useMemo(() => calculateShippingFee(province, district), [province, district]);

  const [isFreeship, setIsFreeship] = useState(false);
  const [customShippingFee, setCustomShippingFee] = useState<string>('');
  // Dropdown collapse state for Section 2 (closed by default as requested)
  const [isShippingDiscountOpen, setIsShippingDiscountOpen] = useState(false);

  const baseShippingFee = useMemo(() => {
    if (customShippingFee.trim() !== '') {
      const parsed = parseInt(customShippingFee.replace(/\D/g, ''), 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return calculatedShippingInfo.fee;
  }, [customShippingFee, calculatedShippingInfo.fee]);

  // Voucher & Discount state
  const [availableVouchers, setAvailableVouchers] = useState<Voucher[]>([]);
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherDiscountAmount, setVoucherDiscountAmount] = useState<number>(0);
  const [isFreeShippingVoucher, setIsFreeShippingVoucher] = useState<boolean>(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherSuccessMsg, setVoucherSuccessMsg] = useState<string | null>(null);
  const [manualDiscountInput, setManualDiscountInput] = useState<string>('');

  useEffect(() => {
    getVouchers().then(setAvailableVouchers).catch(() => {});
  }, []);

  const handleProvinceChange = (newProvince: string) => {
    setProvince(newProvince);
    setDistrict('');
  };

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
  const [selectedProductId, setSelectedProductId] = useState<string>(activeProducts[0]?.id || '');
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  // Options state for the CURRENTLY selected product in picker
  const [pickerColor, setPickerColor] = useState<string>('');
  const [pickerColorImage, setPickerColorImage] = useState<string>('');
  const [pickerSize, setPickerSize] = useState<string>('');
  const [pickerCharms, setPickerCharms] = useState<ProductCharmOption[]>([]);
  const [pickerOmamoris, setPickerOmamoris] = useState<ProductOmamoriOption[]>([]);
  const [pickerKhoen, setPickerKhoen] = useState<ProductKhoenOption | null>(null);
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
          let compressedDataUrl = '';
          try {
            compressedDataUrl = canvas.toDataURL('image/webp', 0.95);
            if (!compressedDataUrl || !compressedDataUrl.startsWith('data:image/webp')) {
              compressedDataUrl = canvas.toDataURL('image/jpeg', 0.93);
            }
          } catch {
            compressedDataUrl = canvas.toDataURL('image/jpeg', 0.93);
          }
          setBankReceiptImage(compressedDataUrl);
        } else {
          setBankReceiptImage(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Global paste listener for receipt
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

  // Categories of non-hidden products
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    activeProducts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [activeProducts]);

  // Fast filtered non-hidden products
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return activeProducts.filter((p) => {
      const matchCat = selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter;
      if (!matchCat) return false;
      if (!q) return true;
      const matchName = p.name.toLowerCase().includes(q);
      const matchId = p.id.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q);
      return matchName || matchId || matchDesc;
    });
  }, [activeProducts, productSearch, selectedCategoryFilter]);

  const currentSelectedProduct = useMemo(() => {
    return activeProducts.find((p) => p.id === selectedProductId) || activeProducts[0];
  }, [activeProducts, selectedProductId]);

  // Reset/sync options when selected product changes
  useEffect(() => {
    if (!currentSelectedProduct) return;

    // Reset color
    if (currentSelectedProduct.colorOptions && currentSelectedProduct.colorOptions.length > 0) {
      setPickerColor(currentSelectedProduct.colorOptions[0].name);
      setPickerColorImage(currentSelectedProduct.colorOptions[0].image || '');
    } else if (currentSelectedProduct.availableColors && currentSelectedProduct.availableColors.length > 0) {
      setPickerColor(currentSelectedProduct.availableColors[0]);
      setPickerColorImage('');
    } else {
      setPickerColor('');
      setPickerColorImage('');
    }

    // Reset size
    if (currentSelectedProduct.availableSizes && currentSelectedProduct.availableSizes.length > 0) {
      setPickerSize(currentSelectedProduct.availableSizes[0]);
    } else {
      setPickerSize('');
    }

    // Clear optional accessories
    setPickerCharms([]);
    setPickerOmamoris([]);
    setPickerKhoen(null);
    setPickerQuantity(1);
    setPickerNote('');
  }, [currentSelectedProduct?.id]);

  // Calculate unit price for any manual item (including accessories)
  const getItemUnitPrice = (it: {
    product: Product;
    selectedCharmPrice?: number;
    selectedOmamoriPrice?: number;
    selectedKhoenPrice?: number;
  }) => {
    return (
      it.product.price +
      (it.selectedCharmPrice || 0) +
      (it.selectedOmamoriPrice || 0) +
      (it.selectedKhoenPrice || 0)
    );
  };

  // Subtotal of goods
  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, it) => sum + getItemUnitPrice(it) * it.quantity, 0);
  }, [orderItems]);

  // Effective shipping fee
  const effectiveShippingFee = isFreeship || isFreeShippingVoucher ? 0 : baseShippingFee;

  // Re-validate applied voucher when subtotal or shipping fee changes
  useEffect(() => {
    if (appliedVoucher) {
      const res = validateVoucherCode(appliedVoucher.code, availableVouchers, subtotal, baseShippingFee);
      if (res.isValid) {
        setVoucherDiscountAmount(res.discountAmount);
        setIsFreeShippingVoucher(res.isFreeShipping);
        setVoucherError(null);
      } else {
        setAppliedVoucher(null);
        setVoucherDiscountAmount(0);
        setIsFreeShippingVoucher(false);
        setVoucherError(res.message || 'Voucher không còn thỏa điều kiện.');
        setVoucherSuccessMsg(null);
      }
    }
  }, [subtotal, baseShippingFee, appliedVoucher, availableVouchers]);

  const handleApplyVoucher = (codeToApply?: string) => {
    setVoucherError(null);
    setVoucherSuccessMsg(null);
    const code = (codeToApply || voucherCodeInput).trim().toUpperCase();
    if (!code) {
      setVoucherError('Vui lòng nhập mã voucher.');
      return;
    }
    const res = validateVoucherCode(code, availableVouchers, subtotal, baseShippingFee);
    if (!res.isValid || !res.voucher) {
      setVoucherError(res.message || 'Mã voucher không hợp lệ.');
      return;
    }
    setAppliedVoucher(res.voucher);
    setVoucherDiscountAmount(res.discountAmount);
    setIsFreeShippingVoucher(res.isFreeShipping);
    setVoucherSuccessMsg(res.message || 'Áp dụng voucher thành công!');
    setVoucherCodeInput(code);
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherDiscountAmount(0);
    setIsFreeShippingVoucher(false);
    setVoucherCodeInput('');
    setVoucherError(null);
    setVoucherSuccessMsg(null);
  };

  const parsedManualDiscount = useMemo(() => {
    if (!manualDiscountInput.trim()) return 0;
    const p = parseInt(manualDiscountInput.replace(/\D/g, ''), 10);
    return isNaN(p) ? 0 : p;
  }, [manualDiscountInput]);

  const totalDiscount = voucherDiscountAmount + parsedManualDiscount;
  const grandTotal = Math.max(0, subtotal - totalDiscount) + effectiveShippingFee;

  // Auto-sync paid amount when grand total changes
  useEffect(() => {
    if (paymentStatus === 'paid') {
      setPaidAmountInput(grandTotal > 0 ? grandTotal.toString() : '');
    } else if (paymentStatus === 'unpaid') {
      setPaidAmountInput('0');
    }
  }, [grandTotal, paymentStatus]);

  // Add configured product to order items
  const handleAddItemToOrder = () => {
    if (!currentSelectedProduct) return;

    const availableStock = currentSelectedProduct.stock ?? (currentSelectedProduct.inStock === false ? 0 : 15);
    if (availableStock <= 0 || currentSelectedProduct.inStock === false) {
      alert(`Sản phẩm "${currentSelectedProduct.name}" đã hết hàng trong kho!`);
      return;
    }

    const parsedPickerQty =
      typeof pickerQuantity === 'string' ? parseInt(pickerQuantity, 10) || 1 : pickerQuantity;
    const finalAddQty = Math.max(1, parsedPickerQty);

    const charmExtra = pickerCharms.reduce((s, c) => s + (c.priceDelta || 0), 0);
    const omamoriExtra = pickerOmamoris.reduce((s, o) => s + (o.priceDelta || 0), 0);
    const khoenExtra = pickerKhoen?.priceDelta || 0;

    const newItem: ManualOrderItem = {
      product: currentSelectedProduct,
      quantity: finalAddQty,
      customNote: pickerNote.trim() || undefined,
      selectedColor: pickerColor || undefined,
      selectedColorImage: pickerColorImage || undefined,
      selectedSize: pickerSize || undefined,
      selectedCharms: pickerCharms.length > 0 ? [...pickerCharms] : undefined,
      selectedCharm: pickerCharms.length > 0 ? pickerCharms[0].name : undefined,
      selectedCharmImage: pickerCharms.length > 0 ? pickerCharms[0].image : undefined,
      selectedCharmPrice: charmExtra > 0 ? charmExtra : undefined,
      selectedOmamoris: pickerOmamoris.length > 0 ? [...pickerOmamoris] : undefined,
      selectedOmamoriPrice: omamoriExtra > 0 ? omamoriExtra : undefined,
      selectedKhoen: pickerKhoen ? pickerKhoen.name : undefined,
      selectedKhoenImage: pickerKhoen?.image || undefined,
      selectedKhoenPrice: khoenExtra > 0 ? khoenExtra : undefined
    };

    setOrderItems([...orderItems, newItem]);
    setPickerNote('');
    setPickerQuantity(1);
    setPickerCharms([]);
    setPickerOmamoris([]);
    setPickerKhoen(null);
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
      const orderId = generateTrackingNumber();
      const nowStr = new Date().toLocaleString('vi-VN');
      const nowIso = new Date().toISOString();

      // Format items list for readable notifications/exports
      const formattedItems = orderItems.map((it) => {
        const unitPrice = getItemUnitPrice(it);
        let text = `${it.product.name} (x${it.quantity}) - ${(unitPrice * it.quantity).toLocaleString('vi-VN')}đ`;
        const extras: string[] = [];
        if (it.selectedColor) extras.push(`Màu: ${it.selectedColor}`);
        if (it.selectedSize) extras.push(`Size: ${it.selectedSize}`);
        if (it.selectedCharms && it.selectedCharms.length > 0) {
          const names = it.selectedCharms.map((c) => c.name).join(', ');
          extras.push(`Charm: ${names}`);
        } else if (it.selectedCharm) {
          extras.push(`Charm: ${it.selectedCharm}`);
        }
        if (it.selectedOmamoris && it.selectedOmamoris.length > 0) {
          const names = it.selectedOmamoris.map((o) => o.name).join(', ');
          extras.push(`Bùa: ${names}`);
        }
        if (it.selectedKhoen) {
          extras.push(`Khoen: ${it.selectedKhoen}`);
        }
        if (it.customNote) extras.push(`Note: ${it.customNote}`);
        if (extras.length > 0) {
          text += ` [${extras.join(' | ')}]`;
        }
        return text;
      });

      const itemDetails = orderItems.map((it) => {
        const selectedColorImg = it.selectedColorImage || it.product.colorOptions?.find((c: any) => c.name === it.selectedColor)?.image || '';
        const mainImg = selectedColorImg || it.product.image || (it.product.images && it.product.images[0]) || '';

        return {
          productId: it.product.id,
          productName: it.product.name,
          category: it.product.category,
          imageUrl: mainImg,
          image: mainImg,
          price: getItemUnitPrice(it),
          unitPrice: getItemUnitPrice(it),
          quantity: it.quantity,
          selectedColor: it.selectedColor,
          selectedColorImage: selectedColorImg,
          selectedCharm:
            it.selectedCharms && it.selectedCharms.length > 0
              ? it.selectedCharms[0].name
              : it.selectedCharm,
          selectedCharmImage:
            it.selectedCharms && it.selectedCharms.length > 0
              ? it.selectedCharms[0].image
              : it.selectedCharmImage,
          selectedCharmPrice: it.selectedCharmPrice,
          selectedCharms: it.selectedCharms,
          selectedOmamoris: it.selectedOmamoris,
          selectedOmamoriPrice: it.selectedOmamoriPrice,
          selectedKhoen: it.selectedKhoen,
          selectedKhoenImage: it.selectedKhoenImage,
          selectedKhoenPrice: it.selectedKhoenPrice,
          selectedSize: it.selectedSize,
          customNote: it.customNote
        };
      });

      const finalNote = orderNote.trim();

      const parsedPaid = paidAmountInput
        ? parseInt(paidAmountInput.replace(/\D/g, ''), 10) || 0
        : paymentStatus === 'paid'
        ? grandTotal
        : 0;

      const isLockedSeller = orderSource === 'website' || orderSource === 'mạng xã hội';
      const matchedSellerObj = !isLockedSeller
        ? sellers.find((s) => s.name === selectedSellerName || s.username === selectedSellerName)
        : undefined;
      const finalSellerId = isLockedSeller ? undefined : matchedSellerObj?.id || currentSeller?.id;
      const finalSellerName = isLockedSeller
        ? undefined
        : selectedSellerName || currentSeller?.name || 'Mạnh Cường';

      // Build full address string
      const addrComponents = [detailedAddress.trim(), district.trim(), province.trim()].filter(Boolean);
      const fullAddressString =
        addrComponents.length > 0
          ? addrComponents.join(', ')
          : 'Nhận tại xưởng / Thống nhất qua tin nhắn';

      const newOrderRecord: StoredOrder = {
        id: orderId,
        date: nowStr,
        createdAt: nowIso,
        name: customerName.trim(),
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: fullAddressString,
        province: province || undefined,
        district: district || undefined,
        detailedAddress: detailedAddress.trim() || undefined,
        shippingFee: effectiveShippingFee,
        discountAmount: totalDiscount > 0 ? totalDiscount : undefined,
        voucherCode: appliedVoucher?.code || undefined,
        voucherDiscountAmount: voucherDiscountAmount > 0 ? voucherDiscountAmount : undefined,
        voucherType: appliedVoucher?.type || (isFreeship ? 'freeship' : undefined),
        note: finalNote,
        items: formattedItems,
        itemDetails,
        totalPrice: grandTotal,
        totalAmount: grandTotal,
        source: orderSource,
        type: 'manual_order',
        isManual: true,
        status: orderStatus,
        trackingNumber: orderId,
        paymentMethod: paymentMethod,
        paymentStatus: paymentStatus,
        bankReceiptImage: bankReceiptImage || undefined,
        paidAmount: parsedPaid,
        bankTransferRef: bankTransferRef.trim() || undefined,
        sellerId: finalSellerId,
        sellerName: finalSellerName
      };

      // 1. Save order to Firebase Firestore
      await saveOrderToFirestore(newOrderRecord);

      // 2. Save order to local storage
      const local = JSON.parse(localStorage.getItem('nak_preorders') || '[]');
      local.unshift(newOrderRecord);
      localStorage.setItem('nak_preorders', JSON.stringify(local));

      // 2b. Dismiss order notification for manual orders
      try {
        const dismissedStr = localStorage.getItem('nak_dismissed_order_notifs');
        const dismissedList: string[] = dismissedStr ? JSON.parse(dismissedStr) : [];
        if (!dismissedList.includes(orderId)) {
          dismissedList.push(orderId);
          localStorage.setItem('nak_dismissed_order_notifs', JSON.stringify(dismissedList));
        }
      } catch {
        // ignore
      }

      // 3. Auto-deduct stock for each product, charms, omamori, khoen, colors
      let updatedProducts = [...products];
      for (const it of orderItems) {
        const pIndex = updatedProducts.findIndex((p) => p.id === it.product.id);
        if (pIndex > -1) {
          const currentProd = updatedProducts[pIndex];
          const prevStock = currentProd.stock ?? 15;
          const newStock = Math.max(0, prevStock - it.quantity);

          let updatedCharmOptions = currentProd.charmOptions;
          if (Array.isArray(updatedCharmOptions)) {
            const charmsToDeduct =
              it.selectedCharms && it.selectedCharms.length > 0
                ? it.selectedCharms.map((c) => c.name.trim().toLowerCase())
                : it.selectedCharm
                ? [it.selectedCharm.trim().toLowerCase()]
                : [];

            if (charmsToDeduct.length > 0) {
              updatedCharmOptions = updatedCharmOptions.map((charm) => {
                if (charmsToDeduct.includes(charm.name.trim().toLowerCase())) {
                  if (typeof charm.stock === 'number') {
                    return {
                      ...charm,
                      stock: Math.max(0, charm.stock - it.quantity)
                    };
                  }
                }
                return charm;
              });
            }
          }

          let updatedColorOptions = currentProd.colorOptions;
          if (it.selectedColor && Array.isArray(updatedColorOptions)) {
            updatedColorOptions = updatedColorOptions.map((col) => {
              if (col.name.trim().toLowerCase() === (it.selectedColor || '').trim().toLowerCase()) {
                if (typeof col.stock === 'number') {
                  return {
                    ...col,
                    stock: Math.max(0, col.stock - it.quantity)
                  };
                }
              }
              return col;
            });
          }

          let updatedOmamoriOptions = currentProd.omamoriOptions;
          if (Array.isArray(updatedOmamoriOptions) && it.selectedOmamoris && it.selectedOmamoris.length > 0) {
            const omamorisToDeduct = it.selectedOmamoris.map((o) => o.name.trim().toLowerCase());
            updatedOmamoriOptions = updatedOmamoriOptions.map((omamori) => {
              if (omamorisToDeduct.includes(omamori.name.trim().toLowerCase())) {
                if (typeof omamori.stock === 'number') {
                  return {
                    ...omamori,
                    stock: Math.max(0, omamori.stock - it.quantity)
                  };
                }
              }
              return omamori;
            });
          }

          let updatedKhoenOptions = currentProd.khoenOptions;
          if (it.selectedKhoen && Array.isArray(updatedKhoenOptions)) {
            updatedKhoenOptions = updatedKhoenOptions.map((k) => {
              if (k.name.trim().toLowerCase() === (it.selectedKhoen || '').trim().toLowerCase()) {
                if (typeof k.stock === 'number') {
                  return {
                    ...k,
                    stock: Math.max(0, k.stock - it.quantity)
                  };
                }
              }
              return k;
            });
          }

          const hasColorStocks = Boolean(
            currentProd.enableColorSelection !== false &&
              updatedColorOptions &&
              updatedColorOptions.length > 0 &&
              updatedColorOptions.some((c) => typeof c.stock === 'number')
          );

          const finalStock =
            hasColorStocks && updatedColorOptions
              ? updatedColorOptions.reduce((sum, c) => sum + (typeof c.stock === 'number' ? c.stock : 0), 0)
              : newStock;

          const updatedProd: Product = {
            ...currentProd,
            stock: finalStock,
            inStock: finalStock > 0,
            charmOptions: updatedCharmOptions,
            colorOptions: updatedColorOptions,
            omamoriOptions: updatedOmamoriOptions,
            khoenOptions: updatedKhoenOptions
          };

          updatedProducts[pIndex] = updatedProd;
          await saveProductToFirestore(updatedProd).catch((e) =>
            console.warn('Firestore stock deduct error:', e)
          );
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
      setProvince('');
      setDistrict('');
      setDetailedAddress('');
      setIsFreeship(false);
      setCustomShippingFee('');
      setAppliedVoucher(null);
      setVoucherDiscountAmount(0);
      setIsFreeShippingVoucher(false);
      setVoucherCodeInput('');
      setManualDiscountInput('');
      setOrderSource('trực tiếp');
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

  // Check what options are supported by current selected product
  const hasColors = Boolean(
    currentSelectedProduct &&
      currentSelectedProduct.enableColorSelection !== false &&
      ((currentSelectedProduct.colorOptions && currentSelectedProduct.colorOptions.length > 0) ||
        (currentSelectedProduct.availableColors && currentSelectedProduct.availableColors.length > 0))
  );

  const hasCharms = Boolean(
    currentSelectedProduct &&
      currentSelectedProduct.enableCharmSelection &&
      currentSelectedProduct.charmOptions &&
      currentSelectedProduct.charmOptions.length > 0
  );

  const hasOmamori = Boolean(
    currentSelectedProduct && currentSelectedProduct.enableOmamoriSelection
  );

  const hasKhoen = Boolean(
    currentSelectedProduct && currentSelectedProduct.enableKhoenSelection
  );

  const hasSizes = Boolean(
    currentSelectedProduct &&
      currentSelectedProduct.enableSizeSelection &&
      currentSelectedProduct.availableSizes &&
      currentSelectedProduct.availableSizes.length > 0
  );

  const pickerUnitExtraPrice =
    pickerCharms.reduce((s, c) => s + (c.priceDelta || 0), 0) +
    pickerOmamoris.reduce((s, o) => s + (o.priceDelta || 0), 0) +
    (pickerKhoen?.priceDelta || 0);

  const pickerTotalUnitPrice = (currentSelectedProduct?.price || 0) + pickerUnitExtraPrice;

  return (
    <div id="admin-manual-order-form" className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white text-slate-900 p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold uppercase tracking-wider mb-1 border border-slate-200">
              Nhập đơn thủ công
            </div>
            <h3 className="text-xl font-bold text-slate-900">Tạo Đơn Hàng Mới</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hỗ trợ đầy đủ chọn Charm, Bùa Omamori, Khoen, Màu sắc, Tỉnh/Thành, Phí vận chuyển, Freeship và Voucher giảm giá.
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
              Đã đồng bộ lên Firebase và tự động trừ tồn kho các sản phẩm, charm, bùa và phụ kiện liên quan.
            </p>
          </div>

          <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block">Khách hàng:</span>
              <span className="font-bold text-white text-sm">{submittedOrder.name}</span>
              <span className="text-slate-300 block">{submittedOrder.phone}</span>
              <span className="text-slate-400 text-[11px] block mt-0.5">{submittedOrder.address}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Tổng thanh toán:</span>
              <span className="font-bold text-amber-400 text-base">
                {(submittedOrder.totalPrice || 0).toLocaleString('vi-VN')}đ
              </span>
              <span className="text-slate-400 block text-[11px]">
                Ship: {submittedOrder.shippingFee ? `${submittedOrder.shippingFee.toLocaleString('vi-VN')}đ` : 'Freeship (0đ)'}
              </span>
              {submittedOrder.voucherCode && (
                <span className="text-emerald-400 block text-[11px] font-semibold">
                  Voucher: {submittedOrder.voucherCode} (-{(submittedOrder.voucherDiscountAmount || 0).toLocaleString('vi-VN')}đ)
                </span>
              )}
            </div>
            <div>
              <span className="text-slate-400 block">Thanh toán:</span>
              <span className="font-bold text-white block">
                {submittedOrder.paymentMethod === 'bank_transfer'
                  ? 'Chuyển khoản'
                  : submittedOrder.paymentMethod === 'cash'
                  ? 'Tiền mặt'
                  : 'Thu COD'}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block mt-0.5 ${
                  submittedOrder.paymentStatus === 'paid'
                    ? 'bg-emerald-900 text-emerald-300'
                    : 'bg-amber-900 text-amber-300'
                }`}
              >
                {submittedOrder.paymentStatus === 'paid' ? 'Đã nhận đủ tiền' : 'Chưa thanh toán'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Bill chuyển khoản:</span>
              {submittedOrder.bankReceiptImage ? (
                <button
                  type="button"
                  onClick={() => setPreviewReceiptModal(submittedOrder.bankReceiptImage || null)}
                  className="mt-1 inline-block px-2.5 py-1 rounded bg-slate-700 text-white text-[11px] font-semibold hover:bg-slate-600"
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
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Tiếp tục tạo đơn mới
            </button>
            <button
              onClick={onNavigateToOrders}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-colors border border-slate-700 cursor-pointer"
            >
              Xem trong bảng Đơn Hàng
            </button>
          </div>
        </div>
      )}

      {/* Main Order Entry Form */}
      <form onSubmit={handleSubmitManualOrder} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Customer & Delivery & Payment Info (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Customer Info Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
              <div className="pb-2 border-b border-slate-200">
                <h4 className="font-bold text-sm text-slate-900">1. Thông Tin Khách Hàng</h4>
              </div>

              {/* Source Selection */}
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
                        className={`py-2 px-2.5 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${
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

              {/* Seller / Staff Dropdown */}
              <div>
                {(() => {
                  const isLockedSeller = orderSource === 'website' || orderSource === 'mạng xã hội';
                  return (
                    <>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          {isLockedSeller ? (
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span>
                            Người bán / Nhân viên phụ trách {isLockedSeller ? '(Đã khóa)' : '*'}
                          </span>
                        </span>
                        <span
                          className={`text-[10px] ${
                            isLockedSeller ? 'text-slate-400 font-medium' : 'text-slate-500 font-normal'
                          }`}
                        >
                          {isLockedSeller ? 'Không áp dụng' : 'Ghi nhận doanh số'}
                        </span>
                      </label>
                      <div className="relative">
                        <select
                          disabled={isLockedSeller}
                          value={isLockedSeller ? '' : selectedSellerName}
                          onChange={(e) => setSelectedSellerName(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                            isLockedSeller
                              ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed select-none'
                              : 'bg-amber-50/50 border border-amber-300 text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 cursor-pointer shadow-2xs'
                          }`}
                        >
                          {isLockedSeller ? (
                            <option value="">
                              Đơn {orderSource === 'website' ? 'Website' : 'Mạng xã hội'} — Tự động ghi nhận
                            </option>
                          ) : (
                            sortedSellers.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </>
                  );
                })()}
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
                  placeholder="Ví dụ: Anh Quân (Quân Handmade)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-slate-800"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-slate-800"
                />
              </div>

              {/* Province & District Row */}
              <div className="pt-1 border-t border-slate-100 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tỉnh / Thành phố
                    </label>
                    <div className="relative">
                      <select
                        value={province}
                        onChange={(e) => handleProvinceChange(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-slate-800 cursor-pointer appearance-none pr-8"
                      >
                        <option value="">-- Chọn Tỉnh / TP --</option>
                        {VIETNAM_PROVINCES.map((p) => (
                          <option key={p.code} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <Building2 className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Quận / Huyện
                    </label>
                    <div className="relative">
                      <select
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        disabled={!province || availableDistricts.length === 0}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-slate-800 cursor-pointer appearance-none pr-8 disabled:opacity-50"
                      >
                        <option value="">-- Chọn Quận / Huyện --</option>
                        {availableDistricts.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <MapPin className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Detailed Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Địa chỉ chi tiết (Số nhà, tên ngõ, đường, phường...)
                  </label>
                  <input
                    type="text"
                    value={detailedAddress}
                    onChange={(e) => setDetailedAddress(e.target.value)}
                    placeholder="Ví dụ: Số 25, ngõ 12 Đội Cấn, Ba Đình"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-slate-800"
                  />
                </div>
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

              {/* Initial Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trạng thái đơn khởi tạo
                </label>
                <select
                  value={orderStatus}
                  onChange={(e: any) => setOrderStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="Đã đặt">Đã đặt (Mới tạo)</option>
                  <option value="Đã tiếp nhận">Đã tiếp nhận (Đã xác nhận & Chuẩn bị)</option>
                  <option value="Đã thanh toán">Đã thanh toán (Đã nhận tiền / CK)</option>
                  <option value="Đã giao">Đã giao (Hoàn tất giao hàng)</option>
                </select>
              </div>
            </div>

            {/* Shipping & Discount / Voucher Dropdown Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setIsShippingDiscountOpen(!isShippingDiscountOpen)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      2. Vận Chuyển & Giảm Giá (Voucher)
                    </h4>
                    {!isShippingDiscountOpen ? (
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-2">
                        <span>
                          Ship: <strong className="text-slate-800 font-bold">{isFreeship || isFreeShippingVoucher ? 'Freeship (0đ)' : `${effectiveShippingFee.toLocaleString('vi-VN')}đ`}</strong>
                        </span>
                        {appliedVoucher && (
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            Voucher {appliedVoucher.code} ({appliedVoucher.type === 'freeship' ? 'Freeship' : `-${voucherDiscountAmount.toLocaleString('vi-VN')}đ`})
                          </span>
                        )}
                        {parsedManualDiscount > 0 && (
                          <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Giảm thêm -{parsedManualDiscount.toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tùy chỉnh phí ship, freeship, áp dụng voucher khuyến mãi và chiết khấu
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                    {isShippingDiscountOpen ? 'Thu gọn' : 'Bấm để mở'}
                  </span>
                  <div className={`p-1.5 rounded-lg bg-slate-100 text-slate-600 transition-transform duration-200 ${isShippingDiscountOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </button>

              {isShippingDiscountOpen && (
                <div className="p-5 pt-3 border-t border-slate-100 space-y-4">
                  {/* Shipping Fee Configuration & Freeship Toggle */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Phí vận chuyển</span>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        <input
                          type="checkbox"
                          checked={isFreeship || isFreeShippingVoucher}
                          onChange={(e) => setIsFreeship(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>Miễn phí ship (Freeship 0đ)</span>
                      </label>
                    </div>

                    {!isFreeship && !isFreeShippingVoucher ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">
                            Hệ thống tự tính theo Tỉnh/TP:
                          </span>
                          <div className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-700 border border-slate-200">
                            {calculatedShippingInfo.fee.toLocaleString('vi-VN')}đ
                            <span className="text-[10px] text-slate-500 font-normal ml-1">
                              ({calculatedShippingInfo.label})
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">
                            Hoặc tùy chỉnh phí ship:
                          </span>
                          <input
                            type="text"
                            value={customShippingFee}
                            onChange={(e) => setCustomShippingFee(e.target.value)}
                            placeholder="Để trống = dùng giá tự động"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:bg-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 flex items-center justify-between">
                        <span>Đã bật Freeship cho đơn này</span>
                        <span className="font-extrabold">0đ</span>
                      </div>
                    )}
                  </div>

                  {/* Voucher Code / Selection */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                        <span>Mã Giảm Giá / Voucher</span>
                      </span>
                      {availableVouchers.filter((v) => v.isActive).length > 0 && (
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({availableVouchers.filter((v) => v.isActive).length} voucher khả dụng)
                        </span>
                      )}
                    </label>

                    {/* Voucher Dropdown + Custom Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={voucherCodeInput}
                        onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                        placeholder="Nhập mã voucher (ví dụ: NAKNEW, FREESHIP...)"
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold uppercase text-slate-900 focus:outline-none focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyVoucher()}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Áp dụng
                      </button>
                    </div>

                    {/* Quick Select Pill from Available Active Vouchers */}
                    {availableVouchers.filter((v) => v.isActive).length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                          Gợi ý:
                        </span>
                        {availableVouchers
                          .filter((v) => v.isActive)
                          .slice(0, 5)
                          .map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setVoucherCodeInput(v.code);
                                handleApplyVoucher(v.code);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                                appliedVoucher?.code === v.code
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                              }`}
                            >
                              {v.code} ({v.type === 'freeship' ? 'Freeship' : `-${v.discountPercent}%`})
                            </button>
                          ))}
                      </div>
                    )}

                    {/* Applied Voucher Pill */}
                    {appliedVoucher && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <div>
                            <span className="font-bold text-emerald-900">
                              Voucher {appliedVoucher.code}:
                            </span>
                            <span className="text-emerald-800 ml-1">
                              {appliedVoucher.type === 'freeship'
                                ? 'Miễn phí vận chuyển'
                                : `Giảm ${voucherDiscountAmount.toLocaleString('vi-VN')}đ`}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveVoucher}
                          className="text-xs text-rose-600 hover:text-rose-800 font-bold p-1 cursor-pointer"
                          title="Gỡ voucher"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {voucherError && (
                      <p className="text-[11px] text-rose-600 font-bold">{voucherError}</p>
                    )}
                    {voucherSuccessMsg && !voucherError && (
                      <p className="text-[11px] text-emerald-700 font-semibold">{voucherSuccessMsg}</p>
                    )}

                    {/* Direct / Manual Discount (Giảm giá trực tiếp) */}
                    <div className="pt-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Hoặc giảm giá trực tiếp thêm (VNĐ)
                      </label>
                      <input
                        type="text"
                        value={manualDiscountInput}
                        onChange={(e) => setManualDiscountInput(e.target.value)}
                        placeholder="Ví dụ: 20000 (khách quen, chiết khấu riêng...)"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment & Bill Proof Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-sm text-slate-900">3. Thanh Toán & Bill Chuyển Khoản</h4>
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
                        className={`py-2 px-2 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${
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

              {/* Payment Status & Paid Amount */}
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
                        setPaidAmountInput(String(grandTotal));
                      } else {
                        setPaidAmountInput('0');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
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
                    placeholder={
                      paymentStatus === 'paid' ? `${grandTotal.toLocaleString('vi-VN')}đ` : '0'
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              {/* Bank Transaction Ref */}
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

              {/* Bill Receipt Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Ảnh Bill chuyển khoản (Kéo thả hoặc dán Ctrl+V)
                </label>
                <input
                  ref={receiptFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {!bankReceiptImage || !bankReceiptImage.trim() ? (
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
                      Hoặc nhấn{' '}
                      <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono">
                        Ctrl + V
                      </kbd>{' '}
                      để dán ảnh bill
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50 text-slate-900 rounded-lg p-3 flex items-center justify-between gap-3 border border-slate-200">
                    <div className="flex items-center gap-3">
                      <img
                        src={bankReceiptImage || '/assets/bracelet.jpg'}
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
                            className="text-[11px] text-slate-700 underline font-bold cursor-pointer"
                          >
                            Xem ảnh
                          </button>
                          <button
                            type="button"
                            onClick={() => receiptFileInputRef.current?.click()}
                            className="text-[11px] text-slate-700 underline font-bold cursor-pointer"
                          >
                            Đổi ảnh
                          </button>
                          <button
                            type="button"
                            onClick={() => setBankReceiptImage('')}
                            className="text-[11px] text-rose-600 underline font-bold cursor-pointer"
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

          {/* Right Column: Product Picker with Full Options & Order Items List (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Product Picker & Configurator Card (Luôn mở) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
              {/* Section Header */}
              <div className="w-full p-4 sm:p-5 flex items-center justify-between text-left bg-slate-50/50 border-b border-slate-100 select-none">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      4. Chọn Sản Phẩm & Tùy Chọn (Charm, Bùa, Màu...)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {currentSelectedProduct
                        ? `Đang chọn: ${currentSelectedProduct.name} • Tùy biến charm, bùa Omamori, màu sắc và bấm thêm vào đơn`
                        : 'Chọn sản phẩm, tùy biến charm, bùa Omamori, màu sắc và thêm vào đơn'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Product Picker Content (Luôn hiển thị trực tiếp) */}
              <div className="p-5 pt-4 space-y-4">
                  {/* Fast Search Input Bar */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Tìm nhanh: Lucky Knot, Butterfly Knot, mã sản phẩm..."
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white"
                      />
                      {productSearch && (
                        <button
                          type="button"
                          onClick={() => setProductSearch('')}
                          className="px-2.5 py-1 text-slate-500 hover:text-slate-900 text-xs font-bold cursor-pointer"
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
                        className={`px-2.5 py-1 rounded font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          selectedCategoryFilter === 'all'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tất cả ({activeProducts.length})
                      </button>
                      {availableCategories.map((catKey) => {
                        const count = activeProducts.filter((p) => p.category === catKey).length;
                        return (
                          <button
                            key={catKey}
                            type="button"
                            onClick={() => setSelectedCategoryFilter(catKey)}
                            className={`px-2.5 py-1 rounded font-semibold whitespace-nowrap transition-colors cursor-pointer ${
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
                    <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1 divide-y divide-slate-200">
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
                              onClick={() => setSelectedProductId(p.id)}
                              className={`p-2 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-amber-100/70 border border-amber-400/80 shadow-2xs'
                                  : 'hover:bg-white bg-white/70 border border-transparent'
                              } ${isOutOfStock ? 'opacity-50' : ''}`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <LoadingImage
                                  src={p.image || '/assets/bracelet.jpg'}
                                  alt={p.name}
                                  containerClassName="w-10 h-10 rounded border border-slate-200 shrink-0 bg-white"
                                  className="w-full h-full object-cover"
                                  spinnerSize="xs"
                                  spinnerColor="amber"
                                />
                                <div className="min-w-0">
                                  <span className="font-bold text-xs text-slate-900 block truncate">
                                    {p.name}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    <span className="font-bold text-amber-800">
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
                                  <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-bold rounded shadow-2xs">
                                    Đang chọn
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Selected Product Configurator Card (LIGHT MODE) */}
                    {currentSelectedProduct && (
                      <div className="p-4 bg-slate-50/90 text-slate-900 rounded-xl border border-slate-200 space-y-4 shadow-2xs">
                        {/* Header info */}
                        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
                          <div className="flex items-center gap-3 min-w-0">
                            <LoadingImage
                              src={pickerColorImage || currentSelectedProduct.image || '/assets/bracelet.jpg'}
                              alt={currentSelectedProduct.name}
                              containerClassName="w-12 h-12 rounded-lg border border-slate-200 shrink-0 bg-white shadow-2xs"
                              className="w-full h-full object-cover"
                              spinnerSize="sm"
                              spinnerColor="amber"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-sm text-slate-900 block truncate">
                                {currentSelectedProduct.name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-extrabold text-amber-800 text-sm">
                                  {pickerTotalUnitPrice.toLocaleString('vi-VN')}đ / cái
                                </span>
                                {pickerUnitExtraPrice > 0 && (
                                  <span className="text-[10px] text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">
                                    +{pickerUnitExtraPrice.toLocaleString('vi-VN')}đ phụ kiện
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                            {(currentSelectedProduct.stock ?? 15) > 0 &&
                            currentSelectedProduct.inStock !== false ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded">
                                Còn {currentSelectedProduct.stock ?? 15} cái
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold rounded">
                                Hết hàng
                              </span>
                            )}
                          </div>
                        </div>

                        {/* OPTION 1: Color Selection (Màu sắc) */}
                        {hasColors && (
                          <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <Palette className="w-3.5 h-3.5 text-amber-600" />
                              <span>Màu sắc sản phẩm:</span>
                              <span className="text-amber-700 font-bold">{pickerColor || 'Chưa chọn'}</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {(
                                currentSelectedProduct.colorOptions ||
                                (currentSelectedProduct.availableColors || []).map((c) => ({ name: c }))
                              ).map((colOpt, idx) => {
                                const isSelected =
                                  (pickerColor || '').trim().toLowerCase() === colOpt.name.trim().toLowerCase();
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setPickerColor(colOpt.name);
                                      setPickerColorImage(colOpt.image || '');
                                    }}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                      isSelected
                                        ? 'bg-amber-100 text-amber-950 border-amber-400 font-bold shadow-2xs ring-1 ring-amber-400'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {colOpt.colorCode && (
                                      <span
                                        className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                                        style={{ backgroundColor: colOpt.colorCode }}
                                      />
                                    )}
                                    <span>{colOpt.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* OPTION 2: Charm Selection (Lucky Knot, Butterfly Knot...) */}
                        {hasCharms && currentSelectedProduct.charmOptions && (
                          <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                <span>{currentSelectedProduct.charmTitle || 'Chọn Charm'}:</span>
                                {pickerCharms.length > 0 && (
                                  <span className="text-amber-700 font-semibold">
                                    {pickerCharms.map((c) => c.name).join(', ')}
                                  </span>
                                )}
                              </label>
                              {pickerCharms.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPickerCharms([])}
                                  className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                                >
                                  Bỏ chọn charm
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                              {currentSelectedProduct.charmOptions.map((charm, cIdx) => {
                                const isSelected = pickerCharms.some(
                                  (c) => c.name.trim().toLowerCase() === charm.name.trim().toLowerCase()
                                );
                                const isOut = typeof charm.stock === 'number' && charm.stock <= 0;
                                return (
                                  <div
                                    key={cIdx}
                                    onClick={() => {
                                      if (isOut) return;
                                      const maxAllowed = currentSelectedProduct.maxCharmsAllowed || 1;
                                      if (isSelected) {
                                        setPickerCharms(
                                          pickerCharms.filter(
                                            (c) => c.name.trim().toLowerCase() !== charm.name.trim().toLowerCase()
                                          )
                                        );
                                      } else {
                                        if (maxAllowed === 1) {
                                          setPickerCharms([charm]);
                                        } else {
                                          if (pickerCharms.length >= maxAllowed) {
                                            setPickerCharms([...pickerCharms.slice(1), charm]);
                                          } else {
                                            setPickerCharms([...pickerCharms, charm]);
                                          }
                                        }
                                      }
                                    }}
                                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                                      isSelected
                                        ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-2xs ring-1 ring-amber-400'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    } ${isOut ? 'opacity-40 cursor-not-allowed' : ''}`}
                                  >
                                    <LoadingImage
                                      src={charm.image || '/assets/bracelet.jpg'}
                                      alt={charm.name}
                                      containerClassName="w-9 h-9 rounded border border-slate-200 bg-white shrink-0"
                                      className="w-full h-full object-cover"
                                      spinnerSize="xs"
                                      spinnerColor="amber"
                                    />
                                    <span className="text-[11px] font-bold text-slate-800 line-clamp-1 block">
                                      {charm.name}
                                    </span>
                                    {charm.priceDelta && charm.priceDelta > 0 ? (
                                      <span className="text-[10px] text-amber-700 font-bold">
                                        +{charm.priceDelta.toLocaleString('vi-VN')}đ
                                      </span>
                                    ) : null}
                                    {isSelected && (
                                      <span className="text-[9px] bg-amber-400 text-slate-950 font-bold px-1.5 py-0.2 rounded mt-0.5">
                                        Đã chọn
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* OPTION 3: Bùa Omamori Selection (Bùa may mắn, bình an...) */}
                        {hasOmamori && (
                          <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-rose-600" />
                                <span>{currentSelectedProduct.omamoriTitle || 'Chọn Bùa Omamori'}:</span>
                                {pickerOmamoris.length > 0 && (
                                  <span className="text-rose-700 font-semibold">
                                    {pickerOmamoris.map((o) => o.name).join(', ')}
                                  </span>
                                )}
                              </label>
                              {pickerOmamoris.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPickerOmamoris([])}
                                  className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                                >
                                  Bỏ chọn bùa
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                              {(currentSelectedProduct.omamoriOptions &&
                              currentSelectedProduct.omamoriOptions.length > 0
                                ? currentSelectedProduct.omamoriOptions
                                : DEFAULT_OMAMORI_PRESETS
                              ).map((omamori, oIdx) => {
                                const isSelected = pickerOmamoris.some(
                                  (o) => o.name.trim().toLowerCase() === omamori.name.trim().toLowerCase()
                                );
                                const isOut = typeof omamori.stock === 'number' && omamori.stock <= 0;
                                return (
                                  <div
                                    key={oIdx}
                                    onClick={() => {
                                      if (isOut) return;
                                      const maxAllowed = currentSelectedProduct.maxOmamoriAllowed || 1;
                                      if (isSelected) {
                                        setPickerOmamoris(
                                          pickerOmamoris.filter(
                                            (o) => o.name.trim().toLowerCase() !== omamori.name.trim().toLowerCase()
                                          )
                                        );
                                      } else {
                                        if (maxAllowed === 1) {
                                          setPickerOmamoris([omamori]);
                                        } else {
                                          if (pickerOmamoris.length >= maxAllowed) {
                                            setPickerOmamoris([...pickerOmamoris.slice(1), omamori]);
                                          } else {
                                            setPickerOmamoris([...pickerOmamoris, omamori]);
                                          }
                                        }
                                      }
                                    }}
                                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                                      isSelected
                                        ? 'bg-rose-50 border-rose-400 text-rose-950 shadow-2xs ring-1 ring-rose-400'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    } ${isOut ? 'opacity-40 cursor-not-allowed' : ''}`}
                                  >
                                    <LoadingImage
                                      src={omamori.image || '/assets/bracelet.jpg'}
                                      alt={omamori.name}
                                      containerClassName="w-9 h-9 rounded border border-slate-200 bg-white shrink-0"
                                      className="w-full h-full object-cover"
                                      spinnerSize="xs"
                                      spinnerColor="rose"
                                    />
                                    <span className="text-[11px] font-bold text-slate-800 line-clamp-1 block">
                                      {omamori.name}
                                    </span>
                                    {omamori.priceDelta && omamori.priceDelta > 0 ? (
                                      <span className="text-[10px] text-rose-700 font-bold">
                                        +{omamori.priceDelta.toLocaleString('vi-VN')}đ
                                      </span>
                                    ) : null}
                                    {isSelected && (
                                      <span className="text-[9px] bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded mt-0.5">
                                        Đã chọn
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* OPTION 4: Khoen / Móc Khóa Selection */}
                        {hasKhoen && (
                          <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <CircleDot className="w-3.5 h-3.5 text-blue-600" />
                                <span>{currentSelectedProduct.khoenTitle || 'Chọn Khoen'}:</span>
                                {pickerKhoen && (
                                  <span className="text-blue-700 font-semibold">{pickerKhoen.name}</span>
                                )}
                              </label>
                              {pickerKhoen && (
                                <button
                                  type="button"
                                  onClick={() => setPickerKhoen(null)}
                                  className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                                >
                                  Bỏ chọn khoen
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                              {(currentSelectedProduct.khoenOptions &&
                              currentSelectedProduct.khoenOptions.length > 0
                                ? currentSelectedProduct.khoenOptions
                                : DEFAULT_KHOEN_PRESETS
                              ).map((khoen, kIdx) => {
                                const isSelected =
                                  pickerKhoen?.name.trim().toLowerCase() ===
                                  khoen.name.trim().toLowerCase();
                                const isOut = typeof khoen.stock === 'number' && khoen.stock <= 0;
                                return (
                                  <div
                                    key={kIdx}
                                    onClick={() => {
                                      if (isOut) return;
                                      if (isSelected) {
                                        setPickerKhoen(null);
                                      } else {
                                        setPickerKhoen(khoen);
                                      }
                                    }}
                                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                                      isSelected
                                        ? 'bg-blue-50 border-blue-400 text-blue-950 shadow-2xs ring-1 ring-blue-400'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    } ${isOut ? 'opacity-40 cursor-not-allowed' : ''}`}
                                  >
                                    {khoen.image ? (
                                      <LoadingImage
                                        src={khoen.image}
                                        alt={khoen.name}
                                        containerClassName="w-9 h-9 rounded border border-slate-200 bg-white shrink-0"
                                        className="w-full h-full object-cover"
                                        spinnerSize="xs"
                                        spinnerColor="amber"
                                      />
                                    ) : (
                                      <CircleDot className="w-7 h-7 text-slate-400" />
                                    )}
                                    <span className="text-[11px] font-bold text-slate-800 line-clamp-1 block">
                                      {khoen.name}
                                    </span>
                                    {khoen.priceDelta && khoen.priceDelta > 0 ? (
                                      <span className="text-[10px] text-blue-700 font-bold">
                                        +{khoen.priceDelta.toLocaleString('vi-VN')}đ
                                      </span>
                                    ) : null}
                                    {isSelected && (
                                      <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded mt-0.5">
                                        Đã chọn
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Quantity & Note row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Số lượng đặt
                            </label>
                            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                              <button
                                type="button"
                                onClick={() => {
                                  const curr =
                                    typeof pickerQuantity === 'string'
                                      ? parseInt(pickerQuantity, 10) || 1
                                      : pickerQuantity;
                                  setPickerQuantity(Math.max(1, curr - 1));
                                }}
                                className="px-3 py-1.5 hover:bg-slate-100 font-bold text-xs text-slate-700 cursor-pointer"
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
                                className="w-full text-center bg-transparent font-bold text-xs text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const curr =
                                    typeof pickerQuantity === 'string'
                                      ? parseInt(pickerQuantity, 10) || 1
                                      : pickerQuantity;
                                  setPickerQuantity(
                                    Math.min(currentSelectedProduct?.stock ?? 15, curr + 1)
                                  );
                                }}
                                className="px-3 py-1.5 hover:bg-slate-100 font-bold text-xs text-slate-700 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Ghi chú món này (nếu có)
                            </label>
                            <input
                              type="text"
                              value={pickerNote}
                              onChange={(e) => setPickerNote(e.target.value)}
                              placeholder="Ví dụ: Đóng gói hộp riêng, dây ngắn hơn 1cm..."
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-800 placeholder-slate-400 shadow-2xs"
                            />
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleAddItemToOrder}
                            disabled={
                              !currentSelectedProduct ||
                              (currentSelectedProduct.stock ?? 15) <= 0 ||
                              currentSelectedProduct.inStock === false
                            }
                            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <Plus className="w-4 h-4" />
                            <span>+ Thêm Sản Phẩm Vào Đơn</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            </div>

            {/* Order Items Table & Financial Summary Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-sm text-slate-900">
                  5. Danh Sách Sản Phẩm Trong Đơn ({orderItems.reduce((s, i) => s + i.quantity, 0)} món)
                </h4>

                {orderItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOrderItems([])}
                    className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                  >
                    Xóa tất cả
                  </button>
                )}
              </div>

              {orderItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-1">
                  <p className="text-xs font-medium">Chưa có sản phẩm nào được thêm vào đơn hàng.</p>
                  <p className="text-[11px] text-slate-400">
                    Chọn sản phẩm và các tùy chọn charm, bùa, màu... ở trên rồi nhấn "+ Thêm Sản Phẩm".
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderItems.map((item, idx) => {
                    const unitPrice = getItemUnitPrice(item);
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <LoadingImage
                              src={
                                item.selectedColorImage ||
                                item.product.image ||
                                '/assets/bracelet.jpg'
                              }
                              alt={item.product.name}
                              containerClassName="w-11 h-11 rounded-lg border border-slate-200 shrink-0"
                              className="w-full h-full object-cover"
                              spinnerSize="xs"
                              spinnerColor="amber"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-slate-900 block truncate">
                                {item.product.name}
                              </span>
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mt-0.5">
                                <span>{(unitPrice * item.quantity).toLocaleString('vi-VN')}đ</span>
                                <span className="text-[11px] text-slate-400 font-normal">
                                  ({unitPrice.toLocaleString('vi-VN')}đ x {item.quantity})
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center border border-slate-300 rounded-md bg-white overflow-hidden text-xs">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(idx, item.quantity - 1)}
                                className="px-2 py-0.5 hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-bold text-slate-900 py-0.5">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(idx, item.quantity + 1)}
                                className="px-2 py-0.5 hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md text-xs font-bold cursor-pointer"
                              title="Xóa món này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Selected Options Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                          {item.selectedColor && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-semibold flex items-center gap-1">
                              <Palette className="w-3 h-3 text-slate-600" />
                              <span>Màu: {item.selectedColor}</span>
                            </span>
                          )}

                          {item.selectedSize && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-semibold">
                              Size: {item.selectedSize}
                            </span>
                          )}

                          {item.selectedCharms && item.selectedCharms.length > 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded font-semibold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-700" />
                              <span>Charm: {item.selectedCharms.map((c) => c.name).join(', ')}</span>
                            </span>
                          )}

                          {item.selectedOmamoris && item.selectedOmamoris.length > 0 && (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-200 rounded font-semibold flex items-center gap-1">
                              <Flame className="w-3 h-3 text-rose-700" />
                              <span>Bùa: {item.selectedOmamoris.map((o) => o.name).join(', ')}</span>
                            </span>
                          )}

                          {item.selectedKhoen && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 rounded font-semibold flex items-center gap-1">
                              <CircleDot className="w-3 h-3 text-blue-700" />
                              <span>Khoen: {item.selectedKhoen}</span>
                            </span>
                          )}

                          {item.customNote && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px]">
                              Note: {item.customNote}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Detailed Financial Calculation Breakdown */}
                  <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Tạm tính tiền hàng:</span>
                      <span className="font-semibold text-slate-900">
                        {subtotal.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Phí vận chuyển:</span>
                      </span>
                      <span
                        className={`font-semibold ${
                          effectiveShippingFee === 0 ? 'text-emerald-700 font-bold' : 'text-slate-900'
                        }`}
                      >
                        {effectiveShippingFee === 0
                          ? '0đ (Miễn phí vận chuyển)'
                          : `${effectiveShippingFee.toLocaleString('vi-VN')}đ`}
                      </span>
                    </div>

                    {totalDiscount > 0 && (
                      <div className="flex justify-between items-center text-emerald-700 font-semibold">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" />
                          <span>
                            Giảm giá {appliedVoucher ? `(Voucher ${appliedVoucher.code})` : ''}:
                          </span>
                        </span>
                        <span>-{totalDiscount.toLocaleString('vi-VN')}đ</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Tổng thanh toán:
                      </span>
                      <span className="text-xl font-black text-slate-900">
                        {grandTotal.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || orderItems.length === 0}
                      className="w-full py-3 px-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-sm mt-2"
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
              <span className="font-bold text-sm">Ảnh Bill Chuyển Khoản Khách Hàng</span>
              <button
                type="button"
                onClick={() => setPreviewReceiptModal(null)}
                className="px-2 py-1 text-slate-400 hover:text-white rounded text-xs font-bold cursor-pointer"
              >
                Đóng [X]
              </button>
            </div>
            <div className="p-2 overflow-auto flex-1 flex items-center justify-center">
              {previewReceiptModal && previewReceiptModal.trim() ? (
                <img
                  src={previewReceiptModal}
                  alt="Bill Receipt Preview"
                  className="max-h-[70vh] w-auto rounded object-contain"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
