import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Product, 
  SellerUser, 
  OrderItemDetail, 
  ProductOmamoriOption, 
  ComboItemSelection, 
  ProductColorOption, 
  ProductCharmOption, 
  ProductKhoenOption 
} from '../types';
import { StoredOrder } from '../firebase';
import { 
  formatOrderDateWithoutSeconds, 
  getCleanOrderNote, 
  getOrderTrackingNumber, 
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
  Sparkles, 
  ShoppingBag, 
  Check, 
  X, 
  ChevronDown,
  Palette,
  Layers,
  HeartHandshake,
  ZoomIn
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
  selectedOmamoriText?: string;
  selectedOmamoriPrice?: number;
  selectedComboItems?: ComboItemSelection[];
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
  { step: 3, id: 'crafting', label: 'Đang đan thủ công', desc: 'Nghệ nhân thắt dây thủ công', status: 'Knot đang được sản xuất', icon: Hammer },
  { step: 4, id: 'shipping', label: 'Đang giao hàng', desc: 'Đã bàn giao cho bưu tá', status: 'Đang giao hàng', icon: Truck },
  { step: 5, id: 'completed', label: 'Giao thành công', desc: 'Đơn hàng đã hoàn tất', status: 'Đơn hàng giao thành công', icon: ShieldCheck },
];

/**
 * Intelligent helper to parse raw text item description into structured fields
 * e.g. "Butterfly Knot (x1) - 39.000đ [Màu: Xanh Pastel | Charm: Sao chuông · Xanh | Khoen: Tròn Inox]"
 */
function parseRawItemString(rawStr: string): Partial<EditableOrderItem> {
  let name = rawStr;
  let qty = 1;
  let price = 0;
  let color = '';
  let charm = '';
  let khoen = '';
  let omamori = '';
  let size = '';
  let note = '';

  // Extract [options] block
  const bracketMatch = rawStr.match(/\[(.*?)\]/);
  if (bracketMatch) {
    const optionsText = bracketMatch[1];
    name = rawStr.replace(/\[.*?\]/, '').trim();

    const parts = optionsText.split(/[|,;]/).map(p => p.trim());
    for (const p of parts) {
      const lower = p.toLowerCase();
      if (lower.startsWith('màu:') || lower.startsWith('mau:')) {
        color = p.replace(/^[^:]+:\s*/i, '').trim();
      } else if (lower.startsWith('charm:')) {
        charm = p.replace(/^[^:]+:\s*/i, '').trim();
      } else if (lower.startsWith('khoen:')) {
        khoen = p.replace(/^[^:]+:\s*/i, '').trim();
      } else if (lower.startsWith('bùa:') || lower.startsWith('bua:') || lower.startsWith('omamori:')) {
        omamori = p.replace(/^[^:]+:\s*/i, '').trim();
      } else if (lower.startsWith('size:')) {
        size = p.replace(/^[^:]+:\s*/i, '').trim();
      } else if (lower.startsWith('ghi chú:') || lower.startsWith('note:')) {
        note = p.replace(/^[^:]+:\s*/i, '').trim();
      }
    }
  }

  // Extract quantity (x2) or x2
  const qtyMatch = name.match(/\(x(\d+)\)/i) || name.match(/x(\d+)/i);
  if (qtyMatch) {
    qty = parseInt(qtyMatch[1], 10) || 1;
    name = name.replace(/\(x\d+\)/i, '').replace(/x\d+/i, '').trim();
  }

  // Extract price e.g. - 39.000đ or 39000d
  const priceMatch = name.match(/-\s*([\d\.,]+)\s*đ?/i);
  if (priceMatch) {
    const rawNum = priceMatch[1].replace(/[\.,]/g, '');
    price = parseInt(rawNum, 10) || 0;
    name = name.replace(/-\s*[\d\.,]+\s*đ?/i, '').trim();
  }

  // Clean trailing punctuation or spaces
  name = name.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();

  return {
    productName: name || rawStr,
    quantity: qty,
    price: price,
    selectedColor: color || undefined,
    selectedCharm: charm || undefined,
    selectedKhoen: khoen || undefined,
    selectedOmamoriText: omamori || undefined,
    selectedSize: size || undefined,
    customNote: note || undefined,
  };
}

export const AdminEditOrderModal: React.FC<AdminEditOrderModalProps> = ({
  order,
  products: propProducts,
  allProducts,
  sellers = [],
  onClose,
  onSaved,
  onSave
}) => {
  const products = useMemo(() => propProducts || allProducts || [], [propProducts, allProducts]);

  // Aggregate shop-wide options from active products in store (as catalog fallbacks)
  const shopCatalogOptions = useMemo(() => {
    const colorSet = new Set<string>();
    const charmMap = new Map<string, ProductCharmOption>();
    const khoenMap = new Map<string, ProductKhoenOption>();
    const omamoriMap = new Map<string, ProductOmamoriOption>();

    products.forEach((p) => {
      p.colorOptions?.forEach((c) => {
        if (c.name) colorSet.add(c.name.trim());
      });
      p.availableColors?.forEach((c) => {
        if (c) colorSet.add(c.trim());
      });
      p.charmOptions?.forEach((c) => {
        if (c.name && !charmMap.has(c.name.trim())) {
          charmMap.set(c.name.trim(), c);
        }
      });
      p.khoenOptions?.forEach((k) => {
        if (k.name && !khoenMap.has(k.name.trim())) {
          khoenMap.set(k.name.trim(), k);
        }
      });
      p.omamoriOptions?.forEach((o) => {
        if (o.name && !omamoriMap.has(o.name.trim())) {
          omamoriMap.set(o.name.trim(), o);
        }
      });
    });

    return {
      colors: Array.from(colorSet),
      charms: Array.from(charmMap.values()),
      khoens: Array.from(khoenMap.values()),
      omamoris: Array.from(omamoriMap.values()),
    };
  }, [products]);

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

  // 4. Products List initialization with smart matching against catalog products
  const [items, setItems] = useState<EditableOrderItem[]>(() => {
    // A) If order.itemDetails already exists
    if (order.itemDetails && Array.isArray(order.itemDetails) && order.itemDetails.length > 0) {
      return order.itemDetails.map((it) => {
        let omamoriText = '';
        if (it.selectedOmamoris && it.selectedOmamoris.length > 0) {
          omamoriText = it.selectedOmamoris.map(o => o.name).join(', ');
        } else if (it.selectedOmamoriText) {
          omamoriText = it.selectedOmamoriText;
        }

        // Try to match productId with catalog product
        let pId = it.productId;
        let matched = products.find(p => p.id === pId);
        if (!matched && it.productName) {
          const cleanPName = it.productName.trim().toLowerCase();
          matched = products.find(p => p.name.trim().toLowerCase() === cleanPName)
            || products.find(p => cleanPName.includes(p.name.trim().toLowerCase()))
            || products.find(p => p.name.trim().toLowerCase().includes(cleanPName));
          if (matched) {
            pId = matched.id;
          }
        }

        return {
          productId: pId || 'custom',
          productName: matched?.name || it.productName || 'Sản phẩm thủ công',
          category: it.category || matched?.category || 'Thủ công',
          price: it.price || it.unitPrice || matched?.price || 0,
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
          selectedOmamoriText: omamoriText,
          selectedOmamoriPrice: it.selectedOmamoriPrice,
          selectedComboItems: it.selectedComboItems,
          customNote: it.customNote || ''
        };
      });
    }

    // B) If order has raw string items: parse each into structured fields
    if (order.items) {
      const itemsArr = Array.isArray(order.items)
        ? order.items
        : typeof order.items === 'string'
        ? [order.items]
        : [];

      if (itemsArr.length > 0) {
        return itemsArr.map((itStr) => {
          const parsed = parseRawItemString(String(itStr));
          const cleanPName = (parsed.productName || '').trim().toLowerCase();

          // Try finding product in catalog
          const matched = products.find(p => p.name.trim().toLowerCase() === cleanPName)
            || products.find(p => cleanPName.includes(p.name.trim().toLowerCase()))
            || products.find(p => p.name.trim().toLowerCase().includes(cleanPName));

          return {
            productId: matched ? matched.id : 'custom',
            productName: matched ? matched.name : (parsed.productName || 'Sản phẩm thủ công'),
            category: matched?.category || 'Thủ công',
            price: parsed.price && parsed.price > 0 ? parsed.price : (matched ? matched.price : (order.totalPrice ? Math.round(order.totalPrice / itemsArr.length) : 36000)),
            quantity: parsed.quantity || 1,
            selectedSize: parsed.selectedSize || '',
            selectedColor: parsed.selectedColor || (matched?.colorOptions?.[0]?.name || matched?.availableColors?.[0] || ''),
            selectedCharm: parsed.selectedCharm || '',
            selectedKhoen: parsed.selectedKhoen || '',
            selectedOmamoriText: parsed.selectedOmamoriText || '',
            customNote: parsed.customNote || ''
          };
        });
      }
    }

    // C) Fallback
    const firstProd = products[0];
    return [
      {
        productId: firstProd ? firstProd.id : 'custom',
        productName: firstProd ? firstProd.name : 'Sản phẩm thủ công',
        price: firstProd ? firstProd.price : 36000,
        quantity: 1,
        selectedSize: '',
        selectedColor: firstProd?.colorOptions?.[0]?.name || firstProd?.availableColors?.[0] || '',
        selectedCharm: '',
        selectedKhoen: '',
        selectedOmamoriText: '',
        customNote: ''
      }
    ];
  });

  // Track fields where the user explicitly switched to "Tự gõ tùy biến khác"
  // Key: `${index}_${field}` -> boolean
  const [customInputMode, setCustomInputMode] = useState<Record<string, boolean>>({});

  const isCustomInput = (index: number, field: string) => !!customInputMode[`${index}_${field}`];
  const setCustomInput = (index: number, field: string, val: boolean) => {
    setCustomInputMode(prev => ({
      ...prev,
      [`${index}_${field}`]: val
    }));
  };

  // 5. Payment & Financials
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>(
    order.paymentStatus === 'paid' ? 'paid' : 'unpaid'
  );
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cod' | 'cash' | 'other'>(
    order.paymentMethod || 'bank_transfer'
  );
  const [bankReceiptImage, setBankReceiptImage] = useState<string>(order.bankReceiptImage || '');
  const [bankTransferRef, setBankTransferRef] = useState<string>(order.bankTransferRef || '');
  const [shippingFee, setShippingFee] = useState<number>(order.shippingFee || 0);
  const [discountAmount, setDiscountAmount] = useState<number>(
    order.discountAmount || order.voucherDiscountAmount || 0
  );
  const [voucherCode, setVoucherCode] = useState<string>(order.voucherCode || '');

  // 6. Partner Shipping Carrier
  const [shippingCarrier, setShippingCarrier] = useState<string>(order.shippingCarrier || 'GHTK');
  const [shippingCode, setShippingCode] = useState<string>(order.shippingCode || '');
  const [estimatedDelivery, setEstimatedDelivery] = useState<string>(order.estimatedDelivery || '');

  // 7. Seller Assignment
  const uniqueSellers = useMemo(() => deduplicateSellers(sellers), [sellers]);
  const [sellerName, setSellerName] = useState<string>(order.sellerName || '');

  // 8. Modals & UI States
  const [isSaving, setIsSaving] = useState(false);
  const [zoomReceipt, setZoomReceipt] = useState<string | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // New product addition drawer state
  const [selectedAddProductId, setSelectedAddProductId] = useState<string>(products[0]?.id || 'custom');
  const [customAddName, setCustomAddName] = useState('');
  const [addPrice, setAddPrice] = useState<number>(products[0]?.price || 36000);
  const [addQty, setAddQty] = useState<number>(1);
  const [addColor, setAddColor] = useState('');
  const [addCharm, setAddCharm] = useState('');
  const [addKhoen, setAddKhoen] = useState('');
  const [addOmamori, setAddOmamori] = useState('');
  const [addCustomNote, setAddCustomNote] = useState('');

  // Update addition drawer defaults when product changes
  useEffect(() => {
    if (selectedAddProductId && selectedAddProductId !== 'custom') {
      const p = products.find(x => x.id === selectedAddProductId);
      if (p) {
        setCustomAddName(p.name);
        setAddPrice(p.price);
        setAddColor(p.colorOptions?.[0]?.name || p.availableColors?.[0] || '');
        setAddCharm('');
        setAddKhoen('');
        setAddOmamori('');
      }
    }
  }, [selectedAddProductId, products]);

  // Derived financial summary
  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const unit = (Number(it.price) || 0) + 
        (Number(it.selectedCharmPrice) || 0) + 
        (Number(it.selectedKhoenPrice) || 0) + 
        (Number(it.selectedOmamoriPrice) || 0);
      return sum + unit * (Number(it.quantity) || 1);
    }, 0);
  }, [items]);

  const finalCalculatedTotal = useMemo(() => {
    return Math.max(0, itemsSubtotal - (Number(discountAmount) || 0)) + (Number(shippingFee) || 0);
  }, [itemsSubtotal, discountAmount, shippingFee]);

  const totalItemQuantity = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
  }, [items]);

  // Handlers for modifying order items
  const handleUpdateItemField = (index: number, field: keyof EditableOrderItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSelectProductForItem = (index: number, newProductId: string) => {
    if (newProductId === '__custom__') {
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          productId: 'custom',
        };
        return updated;
      });
      return;
    }

    const p = products.find((x) => x.id === newProductId);
    if (!p) return;

    setItems((prev) => {
      const updated = [...prev];
      const defaultColor = p.colorOptions?.[0]?.name || p.availableColors?.[0] || '';
      const defaultColorImg = p.colorOptions?.[0]?.image || p.image || '';

      updated[index] = {
        ...updated[index],
        productId: p.id,
        productName: p.name,
        category: p.category,
        price: p.price,
        selectedColor: defaultColor,
        selectedColorImage: defaultColorImg,
        selectedCharm: '',
        selectedCharmImage: undefined,
        selectedCharmPrice: undefined,
        selectedKhoen: '',
        selectedKhoenImage: undefined,
        selectedKhoenPrice: undefined,
        selectedOmamoriText: '',
        selectedOmamoris: undefined,
        selectedOmamoriPrice: undefined,
        selectedSize: p.availableSizes?.[0] || ''
      };
      return updated;
    });

    // Reset any custom text input modes for this item
    setCustomInput(index, 'color', false);
    setCustomInput(index, 'charm', false);
    setCustomInput(index, 'khoen', false);
    setCustomInput(index, 'omamori', false);
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
      alert('Vui lòng chọn hoặc nhập tên sản phẩm.');
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
        selectedColor: addColor.trim() || undefined,
        selectedCharm: addCharm.trim() || undefined,
        selectedKhoen: addKhoen.trim() || undefined,
        selectedOmamoriText: addOmamori.trim() || undefined,
        customNote: addCustomNote.trim() || undefined
      }
    ]);

    setIsAddingProduct(false);
    setSelectedAddProductId(products[0]?.id || 'custom');
    setCustomAddName('');
    setAddPrice(36000);
    setAddQty(1);
    setAddColor('');
    setAddCharm('');
    setAddKhoen('');
    setAddOmamori('');
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
        itemDetails: items.map((it) => {
          const omamoris = it.selectedOmamoriText?.trim()
            ? [{ id: 'omamori-opt', name: it.selectedOmamoriText.trim(), priceDelta: 0 }]
            : it.selectedOmamoris;

          return {
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
            selectedOmamoris: omamoris,
            selectedOmamoriPrice: it.selectedOmamoriPrice || undefined,
            selectedComboItems: it.selectedComboItems || undefined,
            customNote: it.customNote || undefined
          };
        }),
        items: items.map((it) => {
          const omamoriLabel = it.selectedOmamoriText?.trim()
            ? `Bùa: ${it.selectedOmamoriText.trim()}`
            : it.selectedOmamoris && it.selectedOmamoris.length > 0
            ? `Bùa: ${it.selectedOmamoris.map((o) => o.name).join(', ')}`
            : '';

          const specs = [
            it.selectedSize ? `Size: ${it.selectedSize}` : '',
            it.selectedColor ? `Màu: ${it.selectedColor}` : '',
            it.selectedCharm ? `Charm: ${it.selectedCharm}` : '',
            it.selectedKhoen ? `Khoen: ${it.selectedKhoen}` : '',
            omamoriLabel,
            it.selectedComboItems && it.selectedComboItems.length > 0
              ? `Combo: ${it.selectedComboItems.map((ci, i) => `[${ci.itemTitle || `Món ${i + 1}`}: ${[ci.selectedColor ? `Màu: ${ci.selectedColor}` : '', ci.selectedCharms && ci.selectedCharms.length > 0 ? `Charm: ${ci.selectedCharms.map(c => c.name).join(', ')}` : '', ci.selectedOmamoris && ci.selectedOmamoris.length > 0 ? `Bùa: ${ci.selectedOmamoris.map(o => o.name).join(', ')}` : ''].filter(Boolean).join(', ')}]`).join(' + ')}`
              : ''
          ].filter(Boolean).join(', ');
          return `${it.productName}${specs ? ` (${specs})` : ''} x${it.quantity}`;
        })
      };

      if (typeof onSaved === 'function') {
        await onSaved(updatedOrder);
      } else if (typeof onSave === 'function') {
        await onSave(updatedOrder);
      }
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi lưu đơn hàng:', err);
      alert('Có lỗi xảy ra khi lưu: ' + (err.message || 'Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div
        className="relative w-full max-w-4xl bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================ */}
        {/* MODAL HEADER                                                 */}
        {/* ============================================================ */}
        <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  Chỉnh Sửa Chi Tiết Đơn Hàng
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  #{order.id}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Toàn bộ màu sắc, charm, bùa và khoen được lấy trực tiếp từ sản phẩm đã cài đặt
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ============================================================ */}
        {/* MODAL SCROLLABLE BODY                                        */}
        {/* ============================================================ */}
        <form onSubmit={handleSaveOrder} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="space-y-6">

            {/* ============================================================ */}
            {/* SECTION 1: CORE ORDER INFO & TRACKING                        */}
            {/* ============================================================ */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-600" />
                  <span>1. Thông Tin Chung & Mã Tra Cứu</span>
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  Mã đơn: <strong className="text-slate-700 font-mono">#{order.id}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Tracking code */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Mã vận đơn / Tra cứu:</span>
                    <span className="text-[10px] text-amber-700 font-semibold">Khách dùng tra đơn</span>
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="VD: NAK-889922..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 shadow-2xs"
                  />
                </div>

                {/* Order Date with quick presets */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>Ngày giờ tạo đơn:</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Chọn lịch hoặc bấm nhanh</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 shadow-2xs"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const pad = (n: number) => n < 10 ? '0' + n : n;
                        setOrderDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
                      }}
                      className="text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      Bây giờ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const pad = (n: number) => n < 10 ? '0' + n : n;
                        setOrderDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T09:00`);
                      }}
                      className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      Hôm nay 09:00
                    </button>
                  </div>
                </div>

                {/* Source */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Kênh đặt hàng:
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 cursor-pointer shadow-2xs"
                  >
                    <option value="website">Website (Online)</option>
                    <option value="mạng xã hội">Mạng xã hội (Facebook/Zalo/TikTok)</option>
                    <option value="trực tiếp">Trực tiếp tại xưởng / Hotline</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 2: 5-STEP CRAFTING PROGRESS                          */}
            {/* ============================================================ */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-100 gap-2">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>2. Tiến Trình Chế Tác & Vận Chuyển (5 Bước)</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-amber-50 text-amber-900 border border-amber-200 self-start sm:self-auto">
                  Đang ở: {status}
                </span>
              </div>

              {/* 5 Step Selector Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PROGRESS_STEPS.map((step) => {
                  const Icon = step.icon;
                  const isCurrent = status === step.status;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setStatus(step.status)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                        isCurrent
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs ring-2 ring-amber-300'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          isCurrent ? 'bg-black/20 text-slate-950 font-black' : 'bg-slate-200 text-slate-600'
                        }`}>
                          Bước {step.step}
                        </span>
                        <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-slate-950' : 'text-slate-400'}`} />
                      </div>
                      <div className="font-extrabold text-[11px] leading-tight">
                        {step.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Stage Note */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Ghi chú chi tiết công đoạn chế tác (Nội bộ):
                </label>
                <input
                  type="text"
                  value={craftingStageNote}
                  onChange={(e) => setCraftingStageNote(e.target.value)}
                  placeholder="VD: Nghệ nhân đã thắt xong vòng, chờ gắn charm..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500"
                />
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 3: PRODUCTS IN ORDER (REAL CONFIGURED OPTIONS ONLY)  */}
            {/* ============================================================ */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    3. Sản Phẩm Trong Đơn Hàng ({totalItemQuantity} món)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingProduct(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-950" />
                  <span>Thêm sản phẩm</span>
                </button>
              </div>

              {/* Add Product Drawer */}
              {isAddingProduct && (
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/70">
                    <span className="font-black text-xs text-amber-950 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-amber-700" />
                      <span>Thêm Món Mới Vào Đơn</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="text-slate-500 hover:text-slate-900 text-xs font-bold cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Chọn từ sản phẩm của shop:
                      </label>
                      <select
                        value={selectedAddProductId}
                        onChange={(e) => setSelectedAddProductId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 cursor-pointer"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.price.toLocaleString('vi-VN')}đ
                          </option>
                        ))}
                        <option value="custom">✏️ Tự nhập sản phẩm tùy biến...</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Tên hiển thị:
                      </label>
                      <input
                        type="text"
                        value={customAddName}
                        onChange={(e) => setCustomAddName(e.target.value)}
                        placeholder="VD: Butterfly Knot, Lucky Knot..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Màu sắc:</label>
                      <input
                        type="text"
                        value={addColor}
                        onChange={(e) => setAddColor(e.target.value)}
                        placeholder="VD: Xanh pastel, Đỏ..."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Charm:</label>
                      <input
                        type="text"
                        value={addCharm}
                        onChange={(e) => setAddCharm(e.target.value)}
                        placeholder="VD: Sao chuông..."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Khoen:</label>
                      <input
                        type="text"
                        value={addKhoen}
                        onChange={(e) => setAddKhoen(e.target.value)}
                        placeholder="VD: Tròn inox..."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Đơn giá (đ):</label>
                      <input
                        type="number"
                        min="0"
                        value={addPrice}
                        onChange={(e) => setAddPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono"
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

              {/* Items List Cards */}
              <div className="space-y-4">
                {items.map((it, idx) => {
                  const lineTotal = (Number(it.price) || 0) * (Number(it.quantity) || 1);
                  
                  // Match product in catalog
                  const matchedProduct = products.find(
                    (p) => p.id === it.productId || p.name.trim().toLowerCase() === it.productName.trim().toLowerCase()
                  );

                  // 1. Color Options: Strictly from matched product (or shop catalog fallback if custom)
                  const rawColors: string[] = [];
                  if (matchedProduct?.colorOptions && matchedProduct.colorOptions.length > 0) {
                    matchedProduct.colorOptions.forEach(c => {
                      if (c.name) rawColors.push(c.name.trim());
                    });
                  } else if (matchedProduct?.availableColors && matchedProduct.availableColors.length > 0) {
                    matchedProduct.availableColors.forEach(c => {
                      if (c) rawColors.push(c.trim());
                    });
                  } else if (!matchedProduct && shopCatalogOptions.colors.length > 0) {
                    rawColors.push(...shopCatalogOptions.colors);
                  }
                  if (it.selectedColor && !rawColors.includes(it.selectedColor.trim())) {
                    rawColors.unshift(it.selectedColor.trim());
                  }
                  const itemColorList = Array.from(new Set(rawColors)).filter(Boolean);

                  // 2. Charm Options: Strictly from matched product (or shop catalog fallback)
                  const rawCharms: Array<{ name: string; priceDelta?: number; image?: string }> = [];
                  if (matchedProduct?.charmOptions && matchedProduct.charmOptions.length > 0) {
                    matchedProduct.charmOptions.forEach(c => {
                      if (c.name) rawCharms.push(c);
                    });
                  } else if (!matchedProduct && shopCatalogOptions.charms.length > 0) {
                    rawCharms.push(...shopCatalogOptions.charms);
                  }
                  if (it.selectedCharm && !rawCharms.some(c => c.name.trim() === it.selectedCharm?.trim())) {
                    rawCharms.unshift({ name: it.selectedCharm.trim(), priceDelta: it.selectedCharmPrice || 0 });
                  }

                  // 3. Khoen Options: Strictly from matched product (or shop catalog fallback)
                  const rawKhoens: Array<{ name: string; priceDelta?: number; image?: string }> = [];
                  if (matchedProduct?.khoenOptions && matchedProduct.khoenOptions.length > 0) {
                    matchedProduct.khoenOptions.forEach(k => {
                      if (k.name) rawKhoens.push(k);
                    });
                  } else if (!matchedProduct && shopCatalogOptions.khoens.length > 0) {
                    rawKhoens.push(...shopCatalogOptions.khoens);
                  }
                  if (it.selectedKhoen && !rawKhoens.some(k => k.name.trim() === it.selectedKhoen?.trim())) {
                    rawKhoens.unshift({ name: it.selectedKhoen.trim(), priceDelta: it.selectedKhoenPrice || 0 });
                  }

                  // 4. Omamori Options: Strictly from matched product (or shop catalog fallback)
                  const rawOmamoris: Array<{ name: string; priceDelta?: number; meaning?: string; image?: string }> = [];
                  if (matchedProduct?.omamoriOptions && matchedProduct.omamoriOptions.length > 0) {
                    matchedProduct.omamoriOptions.forEach(o => {
                      if (o.name) rawOmamoris.push(o);
                    });
                  } else if (!matchedProduct && shopCatalogOptions.omamoris.length > 0) {
                    rawOmamoris.push(...shopCatalogOptions.omamoris);
                  }
                  if (it.selectedOmamoriText && !rawOmamoris.some(o => o.name.trim() === it.selectedOmamoriText?.trim())) {
                    rawOmamoris.unshift({ name: it.selectedOmamoriText.trim(), priceDelta: it.selectedOmamoriPrice || 0 });
                  }

                  // Check if product enables each option
                  const hasColorFeature = matchedProduct ? (matchedProduct.enableColorSelection !== false && itemColorList.length > 0) : itemColorList.length > 0;
                  const hasCharmFeature = matchedProduct ? (matchedProduct.enableCharmSelection !== false && rawCharms.length > 0) : rawCharms.length > 0;
                  const hasKhoenFeature = matchedProduct ? (matchedProduct.enableKhoenSelection !== false && rawKhoens.length > 0) : rawKhoens.length > 0;
                  const hasOmamoriFeature = matchedProduct ? (matchedProduct.enableOmamoriSelection !== false && rawOmamoris.length > 0) : rawOmamoris.length > 0;

                  // Product image preview
                  const colorImg = matchedProduct?.colorOptions?.find(c => c.name.trim().toLowerCase() === (it.selectedColor || '').trim().toLowerCase())?.image;
                  const displayImg = colorImg || it.selectedColorImage || matchedProduct?.image || (matchedProduct?.images && matchedProduct.images[0]) || '';

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3.5 shadow-xs"
                    >
                      {/* CARD HEADER: Món # badge, Product title & Delete button */}
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          {displayImg ? (
                            <img
                              src={displayImg}
                              alt={it.productName}
                              className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 font-black text-xs">
                              #{idx + 1}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black uppercase text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                                Món #{idx + 1}
                              </span>
                              <span className="text-sm font-black text-slate-900 truncate">
                                {it.productName}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                              {matchedProduct ? `Sản phẩm kho: ${matchedProduct.name}` : 'Món thủ công tự đặt'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                          title="Xóa món này khỏi đơn"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* ROW 1: Product Selector Dropdown */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                          <span>Sản phẩm trong kho:</span>
                          {matchedProduct && (
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Đã kết nối dữ liệu mẫu
                            </span>
                          )}
                        </label>
                        <select
                          value={matchedProduct ? matchedProduct.id : '__custom__'}
                          onChange={(e) => handleSelectProductForItem(idx, e.target.value)}
                          className="w-full font-bold text-xs text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.price.toLocaleString('vi-VN')}đ)
                            </option>
                          ))}
                          <option value="__custom__">✏️ Tự đặt tên khác (Tùy biến ngoài danh mục)...</option>
                        </select>

                        {(!matchedProduct || it.productId === 'custom') && (
                          <input
                            type="text"
                            value={it.productName}
                            onChange={(e) => handleUpdateItemField(idx, 'productName', e.target.value)}
                            placeholder="Nhập tên sản phẩm..."
                            className="w-full mt-2 font-bold text-xs text-slate-900 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl focus:outline-none focus:border-amber-500 shadow-2xs"
                          />
                        )}
                      </div>

                      {/* ROW 2: Quantity, Unit Price & Line Total */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50/90 rounded-xl border border-slate-100 text-xs">
                        {/* Quantity Stepper */}
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 block mb-1">Số lượng:</span>
                          <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemField(idx, 'quantity', Math.max(1, (Number(it.quantity) || 1) - 1))}
                              className="w-8 h-8 flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer text-sm font-bold"
                              title="Giảm số lượng"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => handleUpdateItemField(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className="w-10 h-8 text-center font-bold text-xs border-x border-slate-200 focus:outline-none bg-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItemField(idx, 'quantity', (Number(it.quantity) || 1) + 1)}
                              className="w-8 h-8 flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer text-sm font-bold"
                              title="Tăng số lượng"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Unit price */}
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 block mb-1">Đơn giá cơ bản:</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={it.price}
                              onChange={(e) => handleUpdateItemField(idx, 'price', Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="w-24 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-right"
                            />
                            <span className="text-slate-400 font-bold text-xs">đ</span>
                          </div>
                        </div>

                        {/* Line total */}
                        <div className="col-span-2 sm:col-span-1 flex flex-col justify-center sm:items-end pt-1 sm:pt-0">
                          <span className="text-[11px] font-bold text-slate-500">Thành tiền món:</span>
                          <span className="font-mono font-black text-amber-900 text-sm sm:text-base">
                            {lineTotal.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      </div>

                      {/* Combo breakdown preview if applicable */}
                      {it.selectedComboItems && it.selectedComboItems.length > 0 && (
                        <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200/90 space-y-1.5 text-xs">
                          <span className="font-black text-amber-950 block">
                            CÁC MÓN TRONG COMBO ({it.selectedComboItems.length} MÓN):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {it.selectedComboItems.map((ci, cIdx) => (
                              <div key={cIdx} className="bg-white p-2.5 rounded-lg border border-amber-200/60 shadow-2xs space-y-1">
                                <span className="font-bold text-slate-900 block">{ci.itemTitle || `Món ${cIdx + 1}`}</span>
                                <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
                                  {ci.selectedColor && <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-medium">Màu: {ci.selectedColor}</span>}
                                  {ci.selectedCharms && ci.selectedCharms.length > 0 && <span className="bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded font-medium">Charm: {ci.selectedCharms.map(c => c.name).join(', ')}</span>}
                                  {ci.selectedOmamoris && ci.selectedOmamoris.length > 0 && <span className="bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded font-medium">Bùa: {ci.selectedOmamoris.map(o => o.name).join(', ')}</span>}
                                  {ci.selectedKhoen && <span className="bg-sky-100 text-sky-900 px-1.5 py-0.5 rounded font-medium">Khoen: {ci.selectedKhoen}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ============================================================ */}
                      {/* ROW 3: REFINED 100% SELECT DROPDOWNS (REAL STORE DATA ONLY)  */}
                      {/* ============================================================ */}
                      <div className="pt-2 border-t border-slate-100 space-y-3">
                        <div className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>Tùy chọn chi tiết theo cấu hình sản phẩm:</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          
                          {/* 1. MÀU SẮC */}
                          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5 text-amber-600" />
                                <span>Màu sắc:</span>
                              </label>
                              {itemColorList.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setCustomInput(idx, 'color', !isCustomInput(idx, 'color'))}
                                  className="text-[10px] text-amber-800 hover:text-amber-950 font-bold cursor-pointer"
                                >
                                  {isCustomInput(idx, 'color') ? '← Chọn từ mẫu' : '✏️ Nhập khác'}
                                </button>
                              )}
                            </div>

                            {isCustomInput(idx, 'color') || itemColorList.length === 0 ? (
                              <input
                                type="text"
                                value={it.selectedColor || ''}
                                onChange={(e) => handleUpdateItemField(idx, 'selectedColor', e.target.value)}
                                placeholder="Nhập màu sắc..."
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                              />
                            ) : (
                              <select
                                value={it.selectedColor || ''}
                                onChange={(e) => {
                                  if (e.target.value === '__custom__') {
                                    setCustomInput(idx, 'color', true);
                                  } else {
                                    handleUpdateItemField(idx, 'selectedColor', e.target.value);
                                  }
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
                              >
                                <option value="">-- Chọn màu sắc --</option>
                                {itemColorList.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                                <option value="__custom__">✏️ Nhập màu tùy biến khác...</option>
                              </select>
                            )}
                          </div>

                          {/* 2. CHARM ĐÍNH KÈM */}
                          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                <span>{matchedProduct?.charmTitle || 'Charm đính kèm'}:</span>
                              </label>
                              {rawCharms.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setCustomInput(idx, 'charm', !isCustomInput(idx, 'charm'))}
                                  className="text-[10px] text-amber-800 hover:text-amber-950 font-bold cursor-pointer"
                                >
                                  {isCustomInput(idx, 'charm') ? '← Chọn từ mẫu' : '✏️ Nhập khác'}
                                </button>
                              )}
                            </div>

                            {isCustomInput(idx, 'charm') || (!hasCharmFeature && rawCharms.length === 0) ? (
                              <input
                                type="text"
                                value={it.selectedCharm || ''}
                                onChange={(e) => handleUpdateItemField(idx, 'selectedCharm', e.target.value)}
                                placeholder="Nhập tên charm..."
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                              />
                            ) : (
                              <select
                                value={it.selectedCharm || ''}
                                onChange={(e) => {
                                  if (e.target.value === '__custom__') {
                                    setCustomInput(idx, 'charm', true);
                                  } else {
                                    const selected = rawCharms.find(c => c.name === e.target.value);
                                    handleUpdateItemField(idx, 'selectedCharm', e.target.value);
                                    handleUpdateItemField(idx, 'selectedCharmPrice', selected?.priceDelta || 0);
                                  }
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
                              >
                                <option value="">❌ Không gắn charm</option>
                                {rawCharms.map((ch) => (
                                  <option key={ch.name} value={ch.name}>
                                    {ch.name} {ch.priceDelta && ch.priceDelta > 0 ? `(+${ch.priceDelta.toLocaleString('vi-VN')}đ)` : ''}
                                  </option>
                                ))}
                                <option value="__custom__">✏️ Nhập charm tùy biến khác...</option>
                              </select>
                            )}
                          </div>

                          {/* 3. KHOEN ĐÍNH KÈM */}
                          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-sky-600" />
                                <span>{matchedProduct?.khoenTitle || 'Khoen móc khóa'}:</span>
                              </label>
                              {rawKhoens.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setCustomInput(idx, 'khoen', !isCustomInput(idx, 'khoen'))}
                                  className="text-[10px] text-amber-800 hover:text-amber-950 font-bold cursor-pointer"
                                >
                                  {isCustomInput(idx, 'khoen') ? '← Chọn từ mẫu' : '✏️ Nhập khác'}
                                </button>
                              )}
                            </div>

                            {isCustomInput(idx, 'khoen') || (!hasKhoenFeature && rawKhoens.length === 0) ? (
                              <input
                                type="text"
                                value={it.selectedKhoen || ''}
                                onChange={(e) => handleUpdateItemField(idx, 'selectedKhoen', e.target.value)}
                                placeholder="Nhập tên khoen..."
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                              />
                            ) : (
                              <select
                                value={it.selectedKhoen || ''}
                                onChange={(e) => {
                                  if (e.target.value === '__custom__') {
                                    setCustomInput(idx, 'khoen', true);
                                  } else {
                                    const selected = rawKhoens.find(k => k.name === e.target.value);
                                    handleUpdateItemField(idx, 'selectedKhoen', e.target.value);
                                    handleUpdateItemField(idx, 'selectedKhoenPrice', selected?.priceDelta || 0);
                                  }
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
                              >
                                <option value="">❌ Không dùng khoen</option>
                                {rawKhoens.map((kh) => (
                                  <option key={kh.name} value={kh.name}>
                                    {kh.name} {kh.priceDelta && kh.priceDelta > 0 ? `(+${kh.priceDelta.toLocaleString('vi-VN')}đ)` : ''}
                                  </option>
                                ))}
                                <option value="__custom__">✏️ Nhập khoen tùy biến khác...</option>
                              </select>
                            )}
                          </div>

                          {/* 4. BÙA OMAMORI */}
                          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <HeartHandshake className="w-3.5 h-3.5 text-rose-600" />
                                <span>{matchedProduct?.omamoriTitle || 'Bùa (Omamori)'}:</span>
                              </label>
                              {rawOmamoris.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setCustomInput(idx, 'omamori', !isCustomInput(idx, 'omamori'))}
                                  className="text-[10px] text-amber-800 hover:text-amber-950 font-bold cursor-pointer"
                                >
                                  {isCustomInput(idx, 'omamori') ? '← Chọn từ mẫu' : '✏️ Nhập khác'}
                                </button>
                              )}
                            </div>

                            {isCustomInput(idx, 'omamori') || (!hasOmamoriFeature && rawOmamoris.length === 0) ? (
                              <input
                                type="text"
                                value={it.selectedOmamoriText || ''}
                                onChange={(e) => handleUpdateItemField(idx, 'selectedOmamoriText', e.target.value)}
                                placeholder="Nhập tên bùa..."
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                              />
                            ) : (
                              <select
                                value={it.selectedOmamoriText || ''}
                                onChange={(e) => {
                                  if (e.target.value === '__custom__') {
                                    setCustomInput(idx, 'omamori', true);
                                  } else {
                                    const selected = rawOmamoris.find(o => o.name === e.target.value);
                                    handleUpdateItemField(idx, 'selectedOmamoriText', e.target.value);
                                    handleUpdateItemField(idx, 'selectedOmamoriPrice', selected?.priceDelta || 0);
                                  }
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
                              >
                                <option value="">❌ Không kèm bùa</option>
                                {rawOmamoris.map((om) => (
                                  <option key={om.name} value={om.name}>
                                    {om.name} {om.meaning ? `(${om.meaning})` : ''} {om.priceDelta && om.priceDelta > 0 ? `(+${om.priceDelta.toLocaleString('vi-VN')}đ)` : ''}
                                  </option>
                                ))}
                                <option value="__custom__">✏️ Nhập bùa tùy biến khác...</option>
                              </select>
                            )}
                          </div>
                        </div>

                        {/* Ghi chú xưởng cho món này */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Ghi chú chế tác riêng cho món này (Nội bộ xưởng):
                          </label>
                          <input
                            type="text"
                            value={it.customNote || ''}
                            onChange={(e) => handleUpdateItemField(idx, 'customNote', e.target.value)}
                            placeholder="VD: Cắt ngắn dây 1cm, charm thắt chặt..."
                            className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 4: CUSTOMER CONTACT & DELIVERY ADDRESS               */}
            {/* ============================================================ */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <MapPin className="w-4 h-4 text-amber-600" />
                <span>4. Thông Tin Người Nhận & Địa Chỉ Giao Hàng</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tên khách hàng *:
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Họ và tên người nhận..."
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Số điện thoại *:</span>
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Gọi khách</span>
                      </a>
                    )}
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Số điện thoại nhận hàng..."
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Địa chỉ giao hàng đầy đủ:
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Ghi chú từ khách hàng:
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Lời dặn của khách khi giao hàng..."
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 5: PAYMENT & FINANCIAL DETAILS                       */}
            {/* ============================================================ */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <span>5. Thanh Toán & Tài Chính</span>
              </span>

              {/* Status Segmented Buttons */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Trạng thái thanh toán:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('unpaid')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      paymentStatus === 'unpaid'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs ring-2 ring-amber-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>⏳ Chờ thanh toán / Chưa thanh toán</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('paid')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      paymentStatus === 'paid'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span> Đã thanh toán đủ</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Method */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Phương thức thanh toán:
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 cursor-pointer shadow-2xs"
                  >
                    <option value="bank_transfer">Chuyển khoản ngân hàng (VietQR)</option>
                    <option value="cod">Thu hộ tiền mặt (COD)</option>
                    <option value="cash">Tiền mặt tại xưởng</option>
                    <option value="other">Phương thức khác</option>
                  </select>
                </div>

                {/* Shipping Fee */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Phí vận chuyển (đ):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 shadow-2xs"
                  />
                </div>

                {/* Discount */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Giảm giá / Voucher (đ):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Bill Transfer Proof Image */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>Ảnh chụp bill chuyển khoản (Kèm đơn):</span>
                  <span className="text-[10px] text-slate-500">Kéo thả hoặc dán Ctrl+V</span>
                </label>

                {bankReceiptImage ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <img
                      src={bankReceiptImage}
                      alt="Bill CK"
                      onClick={() => setZoomReceipt(bankReceiptImage)}
                      className="w-16 h-16 rounded-lg object-cover border border-slate-300 cursor-pointer shadow-xs hover:opacity-90"
                    />
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đã có ảnh chụp bill chuyển khoản</span>
                      </span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setZoomReceipt(bankReceiptImage)}
                          className="text-amber-800 font-bold hover:underline cursor-pointer"
                        >
                          Phóng to xem
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setBankReceiptImage('')}
                          className="text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          Gỡ ảnh
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          processImageFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      id="upload-receipt-edit"
                    />
                    <label
                      htmlFor="upload-receipt-edit"
                      className="text-xs font-bold text-amber-800 hover:underline cursor-pointer"
                    >
                      Bấm vào đây để tải ảnh bill lên
                    </label>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      hoặc sao chép ảnh chụp màn hình và nhấn Ctrl + V
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 6: SHIPPING CARRIER & SELLER                         */}
            {/* ============================================================ */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>6. Vận Chuyển Đối Tác & Phân Bổ Nhân Viên</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Carrier */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Đơn vị vận chuyển:
                  </label>
                  <select
                    value={shippingCarrier}
                    onChange={(e) => setShippingCarrier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 cursor-pointer shadow-2xs"
                  >
                    <option value="GHTK">Giao Hàng Tiết Kiệm (GHTK)</option>
                    <option value="GHN">Giao Hàng Nhanh (GHN)</option>
                    <option value="ViettelPost">Viettel Post</option>
                    <option value="ShopeeExpress">Shopee Xpress (SPX)</option>
                    <option value="J&T">J&T Express</option>
                    <option value="GrabExpress">GrabExpress / Be</option>
                    <option value="Khác">Khác / Tự giao</option>
                  </select>
                </div>

                {/* Tracking Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Mã vận đơn đối tác:</span>
                    {shippingCode && (
                      <a
                        href={getCarrierTrackingUrl(shippingCarrier, shippingCode)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-amber-800 hover:text-amber-950 font-bold flex items-center gap-0.5"
                      >
                        <span>Tra cứu</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </label>
                  <input
                    type="text"
                    value={shippingCode}
                    onChange={(e) => setShippingCode(e.target.value)}
                    placeholder="VD: S123456789.VTP..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 shadow-2xs"
                  />
                </div>

                {/* Seller Assignment */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                      <span>Nhân viên phụ trách:</span>
                    </span>
                  </label>
                  <select
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 cursor-pointer shadow-2xs"
                  >
                    <option value="">-- Chưa phân bổ nhân viên --</option>
                    {uniqueSellers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.username})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

          </div>

          {/* ============================================================ */}
          {/* MODAL STICKY FOOTER                                          */}
          {/* ============================================================ */}
          <div className="sticky bottom-0 bg-white -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 p-4 sm:p-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg z-20">
            <div>
              <div className="text-[11px] text-slate-500 font-bold">
                Tổng thanh toán ({totalItemQuantity} món):
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-900 font-mono leading-none">
                {finalCalculatedTotal.toLocaleString('vi-VN')}đ
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Đang lưu đơn...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-slate-950" />
                    <span>Lưu & Cập Nhật Đơn Hàng</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Bill Zoom Modal */}
        {zoomReceipt && (
          <div
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setZoomReceipt(null)}
          >
            <div className="relative max-w-2xl w-full bg-white rounded-3xl p-4 space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900">Chi tiết ảnh Bill chuyển khoản</span>
                <button
                  type="button"
                  onClick={() => setZoomReceipt(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto flex items-center justify-center">
                <img
                  src={zoomReceipt}
                  alt="Bill chuyển khoản phóng to"
                  className="max-h-[68vh] w-auto object-contain rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
