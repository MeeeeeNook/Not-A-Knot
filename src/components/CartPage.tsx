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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Building2,
  Gift,
  RefreshCw,
  Clock,
  Ticket,
  Tag,
  Mail,
  Eye,
  Camera,
  RotateCw,
  Crop,
  ZoomIn,
  ZoomOut,
  X
} from 'lucide-react';
import { CartItem, Product, SiteContentConfig } from '../types';
import { PhotoCropModal } from './PhotoCropModal';
import { PhotoQuantityConfirmModal } from './PhotoQuantityConfirmModal';
import { PhotoDeleteSelectModal } from './PhotoDeleteSelectModal';
import { saveOrderToFirestore, StoredOrder } from '../firebase';
import { submitOrderToServer } from '../utils/orderService';
import { sendOrderConfirmationEmail, ensureGmailDomain } from '../utils/emailService';
import {
  trackGA4BeginCheckout,
  trackGA4Purchase,
  trackGA4ViewCart,
  trackGA4RemoveFromCart,
  trackGA4ApplyCoupon
} from '../utils/analytics';
import { generateTrackingNumber, removeVietnameseTones } from '../utils/orderFormatters';
import { VIETNAM_PROVINCES, getDistrictsByProvince, calculateShippingFee } from '../data/vietnamLocations';
import { getVouchers, validateVoucherCode, incrementVouchersUsage, Voucher } from '../utils/voucherManager';
import { LoadingImage } from './LoadingImage';

interface CartPageProps {
  cartItems: CartItem[];
  products?: Product[];
  siteContent?: SiteContentConfig;
  facebookUrl?: string;
  messengerUrl?: string;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onOrderPlaced: (orderData: StoredOrder) => void;
  onContinueShopping: () => void;
  onOpenOrderTracker: (trackingCode?: string) => void;
  onUpdateItemPhoto?: (
    index: number,
    newPhotoUrl: string,
    newPhotoNote?: string,
    newPhotoUrls?: string[],
    newQuantity?: number
  ) => void;
}

export const CartPage: React.FC<CartPageProps> = ({
  cartItems,
  products = [],
  siteContent,
  facebookUrl = 'https://www.facebook.com/profile.php?id=61593591390851',
  messengerUrl = 'https://m.me/61593591390851',
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderPlaced,
  onContinueShopping,
  onOpenOrderTracker,
  onUpdateItemPhoto
}) => {
  // Page Steps: 'checkout' (Cart & Form) | 'success' (Order Placed & VietQR)
  const [step, setStep] = useState<'checkout' | 'success'>('checkout');

  // Check product existence and active status
  const isProductItemAvailable = React.useCallback((item: CartItem): boolean => {
    if (!products || products.length === 0) return true;
    const match = products.find(p => p.id === item.product.id);
    if (!match) return false;
    if (match.isHidden === true || String(match.isHidden) === 'true') return false;
    return true;
  }, [products]);

  const availableCartItems = React.useMemo(() => {
    return cartItems.filter(item => isProductItemAvailable(item));
  }, [cartItems, isProductItemAvailable]);

  const unavailableCartItems = React.useMemo(() => {
    return cartItems.filter(item => !isProductItemAvailable(item));
  }, [cartItems, isProductItemAvailable]);

  const hasUnavailableItems = unavailableCartItems.length > 0;

  const handleRemoveAllUnavailable = () => {
    for (let i = cartItems.length - 1; i >= 0; i--) {
      if (!isProductItemAvailable(cartItems[i])) {
        onRemoveItem(i);
      }
    }
  };

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'vietqr'>('cod');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<'idle' | 'preparing' | 'syncing' | 'confirmed' | 'error'>('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [priceChangeWarning, setPriceChangeWarning] = useState<{ oldTotal: number; newTotal: number; message: string } | null>(null);

  // Placed Order Details for Success Screen (persists even after onClearCart)
  const [placedOrder, setPlacedOrder] = useState<StoredOrder | null>(null);
  const [placedTotal, setPlacedTotal] = useState<number>(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [cartPhotoPreview, setCartPhotoPreview] = useState<{
    index?: number;
    url: string;
    title: string;
    note?: string;
    isCustomPhoto?: boolean;
    urls?: string[];
    activePhotoIdx?: number;
  } | null>(null);
  const [photoRotation, setPhotoRotation] = useState<number>(0);
  const [photoZoomScale, setPhotoZoomScale] = useState<number>(1);
  const [cartCropData, setCartCropData] = useState<{
    isOpen: boolean;
    imageSrc?: string;
    imageSrcs?: string[];
    targetIdx: number;
    aspectRatio: string;
    mode: 'replace' | 'append';
  } | null>(null);
  const [confirmModalItemIndex, setConfirmModalItemIndex] = useState<number | null>(null);
  const [isReplacingPhoto, setIsReplacingPhoto] = useState<boolean>(false);
  const [replaceSuccessToast, setReplaceSuccessToast] = useState<string | null>(null);
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);
  const [editNoteValue, setEditNoteValue] = useState<string>('');
  const replaceFileInputRef = React.useRef<HTMLInputElement>(null);
  const appendFileInputRef = React.useRef<HTMLInputElement>(null);
  const targetReplaceIdxRef = React.useRef<number | null>(null);
  const targetAppendIdxRef = React.useRef<number | null>(null);

  const [deleteModalItemIndex, setDeleteModalItemIndex] = useState<number | null>(null);

  const handleDecreaseCartQuantity = (targetIdx: number) => {
    const item = cartItems[targetIdx];
    if (!item) return;
    if (item.quantity <= 1) {
      onRemoveItem(targetIdx);
      return;
    }
    const pList = item.customPhotoUrls && item.customPhotoUrls.length > 0
      ? item.customPhotoUrls
      : (item.customPhotoUrl ? [item.customPhotoUrl] : []);

    const uniquePhotos = Array.from(new Set(pList.filter(Boolean)));

    // Nếu chỉ có 1 file ảnh dùng chung cho nhiều sản phẩm (hoặc số lượng món > số ảnh, hoặc tất cả ảnh trùng nhau):
    // Chỉ giảm số lượng sản phẩm xuống 1, và GIỮ NGUYÊN ảnh in cho các sản phẩm còn lại! Tuyệt đối không xóa ảnh!
    if (uniquePhotos.length <= 1 || item.quantity > pList.length) {
      const newQty = item.quantity - 1;
      let updatedUrls = pList;
      if (pList.length > newQty && newQty > 0) {
        updatedUrls = pList.slice(0, newQty);
      } else if (pList.length === 1) {
        updatedUrls = [pList[0]];
      }
      const finalMainUrl = updatedUrls[0] || item.customPhotoUrl || (pList[0] || '');
      if (onUpdateItemPhoto) {
        onUpdateItemPhoto(targetIdx, finalMainUrl, item.customPhotoNote, updatedUrls, newQty);
      } else {
        onUpdateQuantity(targetIdx, newQty);
      }
      return;
    }

    // Chỉ khi có nhiều ảnh KHÁC NHAU và mỗi sản phẩm ứng với 1 ảnh riêng, mới mở modal để khách chọn bỏ bớt ảnh
    setDeleteModalItemIndex(targetIdx);
  };

  const handleDeletePhotoDirect = (targetIdx: number, photoIdx: number) => {
    if (!cartItems[targetIdx]) return;
    const item = cartItems[targetIdx];
    const prevList = item.customPhotoUrls && item.customPhotoUrls.length > 0
      ? item.customPhotoUrls
      : (item.customPhotoUrl ? [item.customPhotoUrl] : []);
    const updatedUrls = prevList.filter((_, i) => i !== photoIdx);
    const newQty = Math.max(1, item.quantity - 1);

    // BẢO VỆ UX: Nếu giảm số lượng mà sản phẩm vẫn còn (newQty >= 1), không bao giờ để sản phẩm bị mất sạch ảnh!
    const finalUrls = updatedUrls.length > 0 ? updatedUrls : (prevList.length > 0 ? [prevList[0]] : []);
    const finalMainUrl = finalUrls[0] || item.customPhotoUrl || (prevList[0] || '');

    if (onUpdateItemPhoto) {
      onUpdateItemPhoto(targetIdx, finalMainUrl, item.customPhotoNote, finalUrls, newQty);
    } else {
      onUpdateQuantity(targetIdx, newQty);
    }
    if (cartPhotoPreview && cartPhotoPreview.index === targetIdx) {
      if (updatedUrls.length > 0) {
        const nextActiveIdx = Math.min(photoIdx, updatedUrls.length - 1);
        setCartPhotoPreview((prev) => prev ? {
          ...prev,
          url: updatedUrls[nextActiveIdx],
          urls: updatedUrls,
          activePhotoIdx: nextActiveIdx
        } : null);
      } else {
        setCartPhotoPreview(null);
      }
    }
    setReplaceSuccessToast('Đã xóa 1 ảnh in theo yêu cầu.');
    setTimeout(() => setReplaceSuccessToast(null), 2500);
  };

  const handleDeletePhotoFromCartItem = (photoIdx: number) => {
    if (deleteModalItemIndex === null || !cartItems[deleteModalItemIndex]) return;
    handleDeletePhotoDirect(deleteModalItemIndex, photoIdx);
    setDeleteModalItemIndex(null);
  };

  const handleIncreaseCartQuantity = (targetIdx: number) => {
    const item = cartItems[targetIdx];
    if (!item) return;
    if (item.customPhotoUrl || (item.customPhotoUrls && item.customPhotoUrls.length > 0)) {
      setConfirmModalItemIndex(targetIdx);
    } else {
      onUpdateQuantity(targetIdx, item.quantity + 1);
    }
  };

  const handleTriggerReplacePhoto = (targetIndex: number) => {
    targetReplaceIdxRef.current = targetIndex;
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = '';
      replaceFileInputRef.current.click();
    }
  };

  const handleTriggerAppendPhoto = (targetIndex: number) => {
    targetAppendIdxRef.current = targetIndex;
    if (appendFileInputRef.current) {
      appendFileInputRef.current.value = '';
      appendFileInputRef.current.click();
    }
  };

  const handleReplacePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetIdx = targetReplaceIdxRef.current !== null 
      ? targetReplaceIdxRef.current 
      : (typeof cartPhotoPreview?.index === 'number' ? cartPhotoPreview.index : null);
    if (targetIdx === null || !cartItems[targetIdx]) return;

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Dung lượng ảnh vượt quá 10MB. Vui lòng chọn ảnh có dung lượng tối đa 10MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCartPhotoPreview(null);
      const src = ev.target?.result as string;
      const targetAspectRatio = cartItems[targetIdx].product.customPhotoAspectRatio || 'square';
      setCartCropData({
        isOpen: true,
        imageSrc: src,
        targetIdx,
        aspectRatio: targetAspectRatio,
        mode: 'replace'
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAppendPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const targetIdx = targetAppendIdxRef.current;
    if (targetIdx === null || !cartItems[targetIdx]) return;

    const fileList = Array.from(files);
    const readers = fileList.map((file) => {
      return new Promise<string>((resolve) => {
        if (file.size > 10 * 1024 * 1024) {
          resolve('');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => resolve((ev.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((newUrls) => {
      const valid = newUrls.filter(Boolean);
      if (valid.length > 0) {
        const targetAspectRatio = cartItems[targetIdx].product.customPhotoAspectRatio || 'square';
        setCartCropData({
          isOpen: true,
          imageSrcs: valid,
          targetIdx,
          aspectRatio: targetAspectRatio,
          mode: 'append'
        });
      }
    });
    e.target.value = '';
  };

  const handleCartCropConfirmMultiple = async (croppedDataUrls: string[]) => {
    if (!cartCropData || !croppedDataUrls || croppedDataUrls.length === 0) return;
    const targetIdx = cartCropData.targetIdx;
    const currentNote = cartItems[targetIdx]?.customPhotoNote || cartPhotoPreview?.note;
    const isAppendMode = cartCropData.mode === 'append';

    setCartCropData(null);
    targetReplaceIdxRef.current = null;
    targetAppendIdxRef.current = null;

    if (isAppendMode) {
      const prevUrls = cartItems[targetIdx]?.customPhotoUrls && cartItems[targetIdx].customPhotoUrls.length > 0
        ? cartItems[targetIdx].customPhotoUrls
        : (cartItems[targetIdx]?.customPhotoUrl ? [cartItems[targetIdx].customPhotoUrl] : []);
      const updatedUrls = [...prevUrls, ...croppedDataUrls];
      const newQty = (cartItems[targetIdx]?.quantity || 1) + croppedDataUrls.length;

      setCartPhotoPreview({
        index: targetIdx,
        url: croppedDataUrls[0],
        title: cartItems[targetIdx]?.product.name || 'Ảnh in custom',
        note: currentNote,
        isCustomPhoto: true,
        urls: updatedUrls,
        activePhotoIdx: updatedUrls.length - 1
      });
      setPhotoRotation(0);
      setPhotoZoomScale(1);

      if (onUpdateItemPhoto) {
        onUpdateItemPhoto(targetIdx, updatedUrls[0], currentNote, updatedUrls, newQty);
      }
      setReplaceSuccessToast(`Đã thêm ${croppedDataUrls.length} ảnh in mới! Số lượng sản phẩm đã tăng lên ${newQty}. ✨`);
    } else {
      const updatedUrls = croppedDataUrls;
      setCartPhotoPreview({
        index: targetIdx,
        url: updatedUrls[0],
        title: cartItems[targetIdx]?.product.name || 'Ảnh in custom',
        note: currentNote,
        isCustomPhoto: true,
        urls: updatedUrls,
        activePhotoIdx: 0
      });
      setPhotoRotation(0);
      setPhotoZoomScale(1);

      if (onUpdateItemPhoto) {
        onUpdateItemPhoto(targetIdx, updatedUrls[0], currentNote, updatedUrls);
      }
      setReplaceSuccessToast('Đã lưu ảnh in và căn chỉnh thành công!');
    }
    setTimeout(() => setReplaceSuccessToast(null), 3000);

    // Upload to Firebase Storage in background
    try {
      const { uploadCustomPhotoImmediately } = await import('../firebase');
      const cloudUploadPromises = croppedDataUrls.map((u) =>
        uploadCustomPhotoImmediately(u, 'cart_photos').catch(() => u)
      );
      const uploadedUrls = await Promise.all(cloudUploadPromises);
      if (uploadedUrls.some((u) => u && u.startsWith('http')) && onUpdateItemPhoto) {
        if (isAppendMode) {
          const currentList = cartItems[targetIdx]?.customPhotoUrls || croppedDataUrls;
          const replacedList = currentList.map((u) => {
            const matchIdx = croppedDataUrls.indexOf(u);
            return matchIdx !== -1 && uploadedUrls[matchIdx] ? uploadedUrls[matchIdx] : u;
          });
          onUpdateItemPhoto(targetIdx, replacedList[0], currentNote, replacedList);
        } else {
          onUpdateItemPhoto(targetIdx, uploadedUrls[0] || croppedDataUrls[0], currentNote, uploadedUrls);
        }
      }
    } catch (uploadErr) {
      console.warn('[CartPage] Cloud upload notice:', uploadErr);
    }
  };

  const handleCartCropConfirm = async (croppedDataUrl: string) => {
    return handleCartCropConfirmMultiple([croppedDataUrl]);
  };

  // Customer Email Option on Success Screen (Toggleable via Admin Settings)
  const [showEmailOption, setShowEmailOption] = useState<boolean>(true);
  const [successEmailInput, setSuccessEmailInput] = useState<string>('');
  const [isSendingSuccessEmail, setIsSendingSuccessEmail] = useState<boolean>(false);
  const [isSuccessEmailSent, setIsSuccessEmailSent] = useState<boolean>(false);
  const [successEmailError, setSuccessEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'success') {
      fetch('/api/email/settings')
        .then((res) => res.text())
        .then((text) => {
          try {
            const data = JSON.parse(text);
            if (data && data.settings) {
              setShowEmailOption(Boolean(data.settings.customerOrderEmailOption));
            }
          } catch {
            // ignore non-json
          }
        })
        .catch(() => {});
    }
  }, [step]);

  const handleSendSuccessEmail = async () => {
    const formattedEmail = ensureGmailDomain(successEmailInput);
    if (!formattedEmail) {
      setSuccessEmailError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (!placedOrder) return;

    setSuccessEmailInput(formattedEmail);
    setIsSendingSuccessEmail(true);
    setSuccessEmailError(null);
    try {
      const payload: StoredOrder = {
        ...placedOrder,
        email: formattedEmail,
        customerEmail: formattedEmail
      };
      const data = await sendOrderConfirmationEmail(payload);
      if (data.success) {
        setIsSuccessEmailSent(true);
      } else {
        setSuccessEmailError(data.error || data.message || 'Không thể gửi email lúc này.');
      }
    } catch (err: any) {
      setSuccessEmailError(err.message || 'Lỗi mạng khi gửi email.');
    } finally {
      setIsSendingSuccessEmail(false);
    }
  };

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

  // Available districts for chosen province
  const availableDistricts = getDistrictsByProvince(province);

  // Calculate Real-time Shipping Fee based on Vietnam Administrative rules (only when address chosen)
  const shippingInfo = calculateShippingFee(province, district);
  const shippingFee = shippingInfo.fee;

  const handleProvinceChange = (newProvince: string) => {
    setProvince(newProvince);
    setDistrict('');
  };

  // Calculate Subtotal & Total (only for available products)
  const subtotal = React.useMemo(() => {
    return availableCartItems.reduce(
      (acc, item) =>
        acc +
        (item.product.price + (item.selectedCharmPrice || 0) + (item.selectedOmamoriPrice || 0) + (item.selectedKhoenPrice || 0) + (item.customPhotoPrice || 0)) *
          item.quantity,
      0
    );
  }, [availableCartItems]);

  // Validate each slot independently against the original merchandise subtotal.
  const discountResult = appliedVoucher
    ? validateVoucherCode(appliedVoucher.code, availableVouchers, subtotal, shippingFee, availableCartItems) : null;
  const shippingResult = shippingVoucher
    ? validateVoucherCode(shippingVoucher.code, availableVouchers, subtotal, shippingFee, availableCartItems) : null;
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
    if (invalidDiscount || invalidShipping) {
      if (invalidDiscount) setAppliedVoucher(null);
      if (invalidShipping) setShippingVoucher(null);
      setVoucherError('Voucher không tồn tại/đã hết lượt sử dụng');
      setVoucherSuccessMsg(null);
    }
  }, [subtotal, shippingFee, appliedVoucher?.code, shippingVoucher?.code, availableVouchers.length, availableCartItems]);


  const handleApplyVoucher = () => {
    setVoucherError(null);
    setVoucherSuccessMsg(null);
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      setVoucherError('Vui lòng nhập mã voucher.');
      return;
    }
    if (code === 'GIAM100K') {
      setVoucherError('Đây chỉ là ví dụ thôi hahahahaha');
      return;
    }
    const res = validateVoucherCode(code, availableVouchers, subtotal, shippingFee, availableCartItems);
    if (!res.isValid || !res.voucher) {
      setVoucherError('Voucher không tồn tại/đã hết lượt sử dụng');
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

  // Track View Cart & Begin Checkout on mount if items exist (guarded to run cleanly once)
  const hasTrackedCheckoutRef = React.useRef(false);
  useEffect(() => {
    if (availableCartItems.length > 0 && step === 'checkout' && !hasTrackedCheckoutRef.current) {
      hasTrackedCheckoutRef.current = true;
      trackGA4ViewCart(availableCartItems, subtotal);
      trackGA4BeginCheckout(availableCartItems, subtotal);
    }
  }, [availableCartItems.length, step, subtotal]);

  const handleRemoveItem = (index: number) => {
    const itemToRemove = availableCartItems[index] || cartItems[index];
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
        item.product.price + (item.selectedCharmPrice || 0) + (item.selectedOmamoriPrice || 0) + (item.selectedKhoenPrice || 0) + (item.customPhotoPrice || 0);
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
      if (item.customPhotoUrl) {
        const photoLabel = item.product.customPhotoTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Ảnh in custom';
        extras.push(
          `${photoLabel}: [Đã tải ảnh]${item.customPhotoNote ? ` (Ghi chú: ${item.customPhotoNote})` : ''}${
            item.customPhotoPrice ? ` (+${item.customPhotoPrice.toLocaleString('vi-VN')}đ)` : ''
          }`
        );
      }
      if (item.selectedComboItems && item.selectedComboItems.length > 0) {
        const comboSummary = item.selectedComboItems.map((ci, i) => {
          const parts = [];
          if (ci.selectedColor) parts.push(`Màu: ${ci.selectedColor}`);
          if (ci.selectedCharms && ci.selectedCharms.length > 0) parts.push(`Charm: ${ci.selectedCharms.map(c => c.name).join(', ')}`);
          if (ci.selectedOmamoris && ci.selectedOmamoris.length > 0) parts.push(`Bùa: ${ci.selectedOmamoris.map(o => o.name).join(', ')}`);
          if (ci.selectedKhoen) parts.push(`Khoen: ${ci.selectedKhoen}`);
          if (ci.selectedSize) parts.push(`Size: ${ci.selectedSize}`);
          return `[${ci.itemTitle || `Món ${i + 1}`}: ${parts.join(', ')}]`;
        }).join(' + ');
        extras.push(`Combo: ${comboSummary}`);
      }
      if (item.selectedSize) extras.push(`Size: ${item.selectedSize}`);
      if (item.customNote) extras.push(`Ghi chú: ${item.customNote}`);
      if (extras.length > 0) desc += ` [${extras.join(', ')}]`;
      return desc;
    });
  };

  // Handle Order Submit
  const handleCheckoutSubmit = async (e?: React.FormEvent, confirmedPriceVal?: number) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    setFormError(null);
    setPriceChangeWarning(null);

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanProvince = province.trim();
    const cleanDistrict = district.trim();
    const cleanDetail = detailedAddress.trim();

    if (!cleanName) {
      setFormError('Vui lòng nhập Họ và tên người nhận.');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 9) {
      setFormError('Vui lòng nhập Số điện thoại hợp lệ (ít nhất 9 chữ số).');
      return;
    }
    if (!cleanProvince) {
      setFormError('Vui lòng chọn Tỉnh / Thành phố nhận hàng.');
      return;
    }
    if (!cleanDistrict) {
      setFormError('Vui lòng chọn Quận / Huyện nhận hàng.');
      return;
    }
    if (!cleanDetail) {
      setFormError('Vui lòng nhập Địa chỉ chi tiết (số nhà, tên đường, ngõ ngách, tòa nhà...).');
      return;
    }
    if (cartItems.length === 0) {
      setFormError('Giỏ hàng của bạn đang trống.');
      return;
    }
    if (availableCartItems.length === 0) {
      setFormError('Giỏ hàng chỉ chứa sản phẩm không tồn tại. Vui lòng chọn sản phẩm khác.');
      return;
    }
    if (hasUnavailableItems) {
      setFormError('Giỏ hàng có sản phẩm không còn kinh doanh. Vui lòng xóa các sản phẩm đó trước khi đặt hàng.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionStep('preparing');
    setSubmissionError(null);

    const fullAddress = `${cleanDetail}, ${cleanDistrict}, ${cleanProvince}`;
    const trackingCode = generateTrackingNumber();
    const currentOrderTotal = grandTotal;

    const itemDetails = availableCartItems.map((item) => {
      const pImage =
        item.selectedColorImage ||
        item.product.colorOptions?.find((c: any) => c.name === item.selectedColor)?.image ||
        item.product.image ||
        (item.product.images && item.product.images[0]) ||
        '';

      return {
        productId: item.product.id,
        productName: item.product.name,
        category: item.product.category,
        imageUrl: pImage,
        image: pImage,
        price: item.product.price + (item.selectedCharmPrice || 0) + (item.selectedOmamoriPrice || 0) + (item.selectedKhoenPrice || 0) + (item.customPhotoPrice || 0),
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
        customNote: item.customNote,
        customPhotoUrl: item.customPhotoUrl || item.customPhotoUrls?.[0] || undefined,
        customPhotoUrls: item.customPhotoUrls && item.customPhotoUrls.length > 0
          ? item.customPhotoUrls
          : (item.customPhotoUrl ? [item.customPhotoUrl] : undefined),
        customPhotoNote: item.customPhotoNote,
        customPhotoPrice: item.customPhotoPrice,
        selectedComboItems: item.selectedComboItems
      };
    });

    const orderData: StoredOrder = {
      id: trackingCode,
      trackingNumber: trackingCode,
      date: new Date().toLocaleString('vi-VN'),
      createdAt: new Date().toISOString(),
      name: cleanName,
      customerName: cleanName,
      phone: cleanPhone,
      email: customerEmail.trim() ? ensureGmailDomain(customerEmail) : undefined,
      customerEmail: customerEmail.trim() ? ensureGmailDomain(customerEmail) : undefined,
      address: fullAddress,
      province: cleanProvince,
      district: cleanDistrict,
      detailedAddress: cleanDetail,
      shippingFee: effectiveShippingFee,
      voucherCode: selectedVouchers.map((voucher) => voucher.code).join(' + ') || undefined,
      voucherDiscountAmount: voucherDiscountAmount > 0 ? voucherDiscountAmount : undefined,
      voucherType: selectedVouchers.find((voucher) => voucher.type === 'percent')?.type || selectedVouchers[0]?.type || undefined,
      note: note.trim() ? note.trim() : undefined,
      items: formatCartItemsText(),
      itemDetails,
      totalPrice: currentOrderTotal,
      totalAmount: currentOrderTotal,
      source: 'website' as const,
      type: 'standard_order' as const,
      status: 'Chờ xác nhận' as const,
      paymentMethod: 'cod' as const,
      paymentStatus: 'unpaid' as const
    };

    setSubmissionStep('syncing');

    try {
      let confirmedOrder: StoredOrder | undefined;

      // 0. Upload any customer-uploaded custom print photos directly to Firebase Storage first
      try {
        const { uploadOrderCustomPhotosToStorage } = await import('../firebase');
        if (orderData.itemDetails && orderData.itemDetails.length > 0) {
          orderData.itemDetails = await uploadOrderCustomPhotosToStorage(trackingCode, orderData.itemDetails);
        }
      } catch (photoErr) {
        console.warn('Upload custom photo to storage notice:', photoErr);
      }

      // 1. Try server endpoint first
      try {
        const result = await submitOrderToServer(orderData, {
          expectedTotal: currentOrderTotal,
          confirmedPrice: confirmedPriceVal
        });

        if (result.requiresConfirmation) {
          setIsSubmitting(false);
          setSubmissionStep('idle');
          setPriceChangeWarning({
            oldTotal: result.oldTotal || currentOrderTotal,
            newTotal: result.newTotal || currentOrderTotal,
            message: result.error || 'Giá sản phẩm hoặc mức khuyến mãi có sự thay đổi.'
          });
          return;
        }

        if (result.success && result.order) {
          confirmedOrder = result.order;
        }
      } catch (serverErr) {
        console.warn('[CartPage] Server submit notice, trying fallback save:', serverErr);
      }

      // 2. Fallback to direct saveOrderToFirestore if server was unreachable
      if (!confirmedOrder) {
        try {
          await saveOrderToFirestore(orderData);
          confirmedOrder = orderData;
        } catch (directErr: any) {
          console.error('[CartPage] Both server and direct save failed:', directErr);
          setSubmissionStep('error');
          setSubmissionError(directErr?.message || 'Chưa thể ghi nhận đơn hàng vào hệ thống. Quý khách vui lòng thử lại!');
          return;
        }
      }

      setSubmissionStep('confirmed');

      // Dispatch order confirmation email asynchronously using verified order
      sendOrderConfirmationEmail(confirmedOrder).catch((e) => {
        console.warn('[CartPage] Email notification background notice:', e);
      });

      // Increment voucher usage count
      if (selectedVouchers.length > 0) {
        incrementVouchersUsage(selectedVouchers.map((v) => v.code));
      }

      // Retain authoritative state for success view BEFORE clearing cart
      setPlacedOrder(confirmedOrder);
      setPlacedTotal(confirmedOrder.totalPrice || currentOrderTotal);
      onOrderPlaced(confirmedOrder);
      trackGA4Purchase(
        confirmedOrder.id || trackingCode,
        confirmedOrder.totalPrice || currentOrderTotal,
        confirmedOrder.itemDetails,
        paymentMethod === 'vietqr' ? 'VietQR_Banking' : 'COD_System'
      );

      // Brief delay to let the customer see the confirmation checkmark
      setTimeout(() => {
        setIsSubmitting(false);
        setStep('success');
        onClearCart();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 700);
    } catch (err: any) {
      console.error('Lỗi khi gửi đơn hàng lên máy chủ:', err);
      setSubmissionStep('error');
      setSubmissionError(err?.message || 'Không thể tạo đơn hàng trên máy chủ lúc này. Quý khách vui lòng thử lại!');
    }
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
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
            <button
              onClick={onContinueShopping}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-amber-800 transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-slate-500 group-hover:text-amber-700" />
              <span>Tiếp tục chọn phụ kiện</span>
            </button>
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
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-6 font-display">
                  Giỏ hàng của bạn đang trống
                </h2>
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
                          Sản phẩm trong giỏ ({availableCartItems.reduce((s, i) => s + i.quantity, 0)})
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
                        const isAvailable = isProductItemAvailable(item);
                        const unitPrice =
                          item.product.price +
                          (item.selectedCharmPrice || 0) +
                          (item.selectedOmamoriPrice || 0) +
                          (item.selectedKhoenPrice || 0) +
                          (item.customPhotoPrice || 0);
                        const lineSubtotal = unitPrice * item.quantity;
                        const itemImage = item.selectedColorImage || item.product.image;

                        return (
                          <div 
                            key={index} 
                            className={`py-4 sm:py-5 first:pt-0 last:pb-0 flex gap-4 sm:gap-5 ${
                              !isAvailable ? 'opacity-65' : ''
                            }`}
                          >
                            {/* Product Thumbnail */}
                            <div className="flex flex-col items-center shrink-0">
                              <div 
                                onClick={() => {
                                  if (itemImage) {
                                    setCartPhotoPreview({
                                      url: itemImage,
                                      title: item.product.name,
                                      isCustomPhoto: false
                                    });
                                    setPhotoRotation(0);
                                  }
                                }}
                                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 border border-slate-200/80 overflow-hidden relative group/thumb cursor-pointer shadow-2xs ${!isAvailable ? 'grayscale-[50%]' : ''}`}
                                title="Bấm để xem ảnh sản phẩm phóng to"
                              >
                                <LoadingImage
                                  src={itemImage}
                                  alt={item.product.name}
                                  containerClassName="w-full h-full"
                                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                                  referrerPolicy="no-referrer"
                                  spinnerSize="sm"
                                  spinnerColor="amber"
                                />
                                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                  <Eye className="w-5 h-5 text-white drop-shadow-sm" />
                                </div>
                                {!isAvailable && (
                                  <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center p-1 text-center">
                                    <span className="text-[10px] font-bold text-white bg-rose-700/90 px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                                      Không tồn tại
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h3 className={`text-sm sm:text-base font-black leading-snug ${!isAvailable ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                      {item.product.name}
                                    </h3>
                                    {!isAvailable && (
                                      <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200/70 text-rose-700 text-[11px] font-bold">
                                        <AlertCircle className="w-3 h-3 text-rose-600 flex-shrink-0" />
                                        <span>Sản phẩm không tồn tại</span>
                                      </div>
                                    )}

                                    {Boolean(item.product.enableCustomPhoto || item.product.customPhotoTitle) && !item.customPhotoUrl && (
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() => handleTriggerReplacePhoto(index)}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-dashed border-rose-300 hover:border-rose-400 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                                          title="Tải ảnh in theo yêu cầu cho sản phẩm này"
                                        >
                                          <Camera className="w-3.5 h-3.5 text-rose-500" />
                                          <span>Thêm ảnh in theo yêu cầu</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(index)}
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer flex-shrink-0"
                                    title="Xóa sản phẩm này"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Custom Attributes: Wrist Size, Color, Charms, Omamori, Khoen */}
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
                                      {item.product.charmTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Charm'}: {item.selectedCharms.map((c) => c.name).join(', ')} {item.selectedCharmPrice ? `(+${item.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''}
                                    </span>
                                  ) : item.selectedCharm ? (
                                    <span className="bg-amber-50 text-amber-800 border border-amber-200/60 px-2.5 py-0.5 rounded-md font-medium text-[11px]">
                                      {item.product.charmTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Charm'}: {item.selectedCharm} {item.selectedCharmPrice ? `(+${item.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''}
                                    </span>
                                  ) : null}

                                  {item.selectedOmamoris && item.selectedOmamoris.length > 0 && (
                                    <span className="inline-flex flex-wrap items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200/60 px-2.5 py-0.5 rounded-md font-medium text-[11px]">
                                      {item.product.omamoriTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Bùa Omamori'}: {item.selectedOmamoris.map((o) => o.name).join(', ')} {item.selectedOmamoriPrice ? `(+${item.selectedOmamoriPrice.toLocaleString('vi-VN')}đ)` : ''}
                                    </span>
                                  )}

                                  {item.selectedKhoen && (
                                    <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-900 border border-sky-200/60 px-2.5 py-0.5 rounded-md font-medium text-[11px]">
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
                                      {item.product.khoenTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'Khoen'}: {item.selectedKhoen} {item.selectedKhoenPrice ? `(+${item.selectedKhoenPrice.toLocaleString('vi-VN')}đ)` : ''}
                                    </span>
                                  )}

                                  {(item.customPhotoUrl || (item.customPhotoUrls && item.customPhotoUrls.length > 0)) && (() => {
                                    const pList = item.customPhotoUrls && item.customPhotoUrls.length > 0
                                      ? item.customPhotoUrls
                                      : [item.customPhotoUrl!];
                                    return (
                                      <div className="inline-flex items-center gap-1.5 flex-wrap bg-gradient-to-r from-rose-50 to-pink-50 text-rose-900 border border-rose-200/90 px-2.5 py-1 rounded-xl font-medium text-[11px] shadow-2xs">
                                        <div className="flex items-center -space-x-1.5">
                                          {pList.map((u, pIdx) => (
                                            <div key={pIdx} className="relative group/custompic shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setCartPhotoPreview({
                                                    index,
                                                    url: u,
                                                    title: item.product.name,
                                                    note: item.customPhotoNote,
                                                    isCustomPhoto: true,
                                                    urls: pList,
                                                    activePhotoIdx: pIdx
                                                  });
                                                  setPhotoRotation(0);
                                                  setPhotoZoomScale(1);
                                                }}
                                                className="relative cursor-pointer shrink-0 block"
                                                title={`Xem ảnh #${pIdx + 1}`}
                                              >
                                                <img
                                                  src={u}
                                                  alt=""
                                                  className="w-5 h-5 rounded-md object-cover border border-rose-300 shadow-2xs group-hover/custompic:scale-110 transition-transform bg-white"
                                                />
                                              </button>
                                              {pList.length > 1 && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeletePhotoDirect(index, pIdx);
                                                  }}
                                                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover/custompic:opacity-100 transition-opacity shadow-xs cursor-pointer z-10"
                                                  title={`Xóa ảnh #${pIdx + 1}`}
                                                >
                                                  <X className="w-2 h-2 stroke-[3]" />
                                                </button>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                        <span className="font-bold">
                                          {pList.length > 1
                                            ? `In ${pList.length} ảnh theo yêu cầu`
                                            : (item.product.customPhotoTitle?.replace(/^(Chọn\s+|Chọn\s*)/i, '').trim() || 'In ảnh theo yêu cầu')}
                                        </span>
                                        {item.customPhotoPrice && item.customPhotoPrice > 0 ? (
                                          <span className="text-rose-700 font-bold bg-white/70 px-1 py-0.2 rounded text-[10px]">
                                            (+{item.customPhotoPrice.toLocaleString('vi-VN')}đ{pList.length > 1 ? `/ảnh` : ''})
                                          </span>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCartPhotoPreview({
                                              index,
                                              url: pList[0],
                                              title: item.product.name,
                                              note: item.customPhotoNote,
                                              isCustomPhoto: true,
                                              urls: pList,
                                              activePhotoIdx: 0
                                            });
                                            setPhotoRotation(0);
                                            setPhotoZoomScale(1);
                                          }}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-md text-[11px] font-bold shadow-2xs transition-all cursor-pointer hover:shadow-xs active:scale-95 ml-0.5"
                                          title="Xem ảnh in bạn đã tải lên"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          <span>{pList.length > 1 ? `Xem ${pList.length} ảnh` : 'Xem ảnh'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleTriggerReplacePhoto(index)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-800 border border-rose-300 hover:border-rose-400 rounded-md text-[11px] font-bold shadow-2xs transition-all cursor-pointer hover:shadow-xs active:scale-95 ml-0.5"
                                          title="Thay ảnh in khác cho sản phẩm này"
                                        >
                                          <Camera className="w-3.5 h-3.5 text-rose-600" />
                                          <span>Thay ảnh</span>
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </div>

                                {item.customPhotoNote && (
                                  <p className="text-xs text-rose-800 bg-rose-50/70 p-2 rounded-xl border border-rose-200/50 mt-1.5">
                                    <span className="font-bold">Yêu cầu in:</span> "{item.customPhotoNote}"
                                  </p>
                                )}

                                {item.customNote && (
                                  <p className="text-xs text-amber-800 bg-amber-50/70 p-2 rounded-xl border border-amber-200/50 mt-2 italic">
                                    Ghi chú thợ đan: "{item.customNote}"
                                  </p>
                                )}
                              </div>

                              {/* Price and Quantity Adjuster */}
                              <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                                {isAvailable ? (
                                  <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() => handleDecreaseCartQuantity(index)}
                                      className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors font-bold text-sm cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <span className="w-10 text-center text-xs font-black text-slate-900 font-mono">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleIncreaseCartQuantity(index)}
                                      className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors font-bold text-sm cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 font-medium">
                                    Số lượng: {item.quantity}
                                  </span>
                                )}

                                <div className="text-right">
                                  <span className={`text-sm sm:text-base font-black font-mono ${!isAvailable ? 'line-through text-slate-400' : 'text-slate-900'}`}>
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

                      {/* Province & District Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Province / City */}
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                            Tỉnh / Thành phố <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <select
                              value={province}
                              onChange={(e) => handleProvinceChange(e.target.value)}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 focus:outline-hidden transition-colors cursor-pointer appearance-none pr-10"
                            >
                              <option value="">-- Chọn Tỉnh / Thành phố --</option>
                              {VIETNAM_PROVINCES.map((prov) => (
                                <option key={prov.code} value={prov.name}>
                                  {prov.name}
                                </option>
                              ))}
                            </select>
                            <Building2 className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                          </div>
                        </div>

                        {/* District */}
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                            Quận / Huyện <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <select
                              value={district}
                              onChange={(e) => setDistrict(e.target.value)}
                              disabled={!province || availableDistricts.length === 0}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 focus:outline-hidden transition-colors cursor-pointer appearance-none pr-10 disabled:opacity-50"
                            >
                              <option value="">-- Chọn Quận / Huyện --</option>
                              {availableDistricts.map((dist) => (
                                <option key={dist} value={dist}>
                                  {dist}
                                </option>
                              ))}
                            </select>
                            <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      {/* Detailed Address */}
                      <div>
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                          Địa chỉ chi tiết <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={detailedAddress}
                          onChange={(e) => setDetailedAddress(e.target.value)}
                          placeholder="Số nhà, tên ngõ/ngách/đường, tòa nhà, phường/xã..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 focus:outline-hidden transition-colors"
                        />
                      </div>

                      {/* Note */}
                      <div>
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                          Ghi chú thêm (nếu có)
                        </label>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 focus:outline-hidden transition-colors"
                        />
                        <p className="mt-2 text-xs text-slate-400 leading-normal">
                          Thông tin của bạn được bảo mật và chỉ được thu thập nhằm phục vụ mục đích xử lý đơn hàng.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section C: Payment Method Selection */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
                    <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100">
                      <CreditCard className="w-5 h-5 text-amber-600" />
                      <h2 className="text-base sm:text-lg font-black text-slate-900">
                        Phương thức thanh toán
                      </h2>
                    </div>

                    <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 font-extrabold text-xs tracking-wider">
                        COD
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-950">Thanh toán khi nhận hàng (Ship COD)</div>
                        <div className="text-xs text-emerald-700 mt-0.5">Quý khách nhận hàng, kiểm tra sản phẩm và thanh toán tiền mặt trực tiếp cho bưu tá.</div>
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

                      {/* Voucher Input Box */}
                      <div className="pt-3 pb-2 border-t border-b border-slate-100 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <Ticket className="w-4 h-4 text-amber-600" />
                          <span>Mã giảm giá / Ưu đãi</span>
                        </div>

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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.keyCode === 13) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleApplyVoucher();
                          }
                        }}
                        placeholder="Ví dụ: GIAM100K"
                        aria-label="Ví dụ: GIAM100K"
                        className="min-w-0 flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs uppercase placeholder:normal-case" />
                      <button type="button" onClick={handleApplyVoucher}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors">Áp dụng</button>
                    </div>

                    {voucherError && (
                          <p className="text-[11px] font-bold text-rose-600">{voucherError}</p>
                        )}
                        {voucherSuccessMsg && !voucherError && (
                          <p className="text-[11px] font-bold text-emerald-700">{voucherSuccessMsg}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-slate-600">
                        <span className="whitespace-nowrap font-medium">Phí vận chuyển</span>
                        <span className="font-mono font-bold text-slate-900 whitespace-nowrap">
                          {shippingInfo.isPending ? 'Chưa tính' : (shippingInfo.isFree || isFreeShippingVoucher) ? '0đ (Miễn phí)' : `${shippingFee.toLocaleString('vi-VN')}đ`}
                        </span>
                      </div>

                      {voucherDiscountAmount > 0 && (
                        <div className="flex items-center justify-between gap-2 text-emerald-700 font-bold">
                          <span className="whitespace-nowrap flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-emerald-600" />
                            Giảm giá Voucher
                          </span>
                          <span className="font-mono font-black whitespace-nowrap">
                            -{voucherDiscountAmount.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      )}

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
                          {grandTotal.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>

                    {/* Price Drift Confirmation Banner */}
                    {priceChangeWarning && (
                      <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-2.5 animate-fadeIn">
                        <div className="flex items-start gap-2 font-bold text-amber-900">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <span>{priceChangeWarning.message}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between font-mono text-xs">
                          <span className="text-slate-500 line-through">Giá cũ: {priceChangeWarning.oldTotal.toLocaleString('vi-VN')}đ</span>
                          <span className="text-amber-700 font-extrabold text-sm">Giá mới: {priceChangeWarning.newTotal.toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleCheckoutSubmit(undefined, priceChangeWarning.newTotal)}
                            className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
                          >
                            Xác nhận & Tiếp tục đặt
                          </button>
                          <button
                            type="button"
                            onClick={() => setPriceChangeWarning(null)}
                            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition-colors cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    )}

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
                      disabled={isSubmitting || (cartItems.length > 0 && availableCartItems.length === 0)}
                      onClick={handleCheckoutSubmit}
                      className="w-full mt-6 py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-slate-200"
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
        {/* VIEW 2: ORDER PLACED & SUCCESS DISPLAY                       */}
        {/* ============================================================ */}
        {step === 'success' && placedOrder && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
            
            {/* Top Success Banner */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-9 shadow-xs text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 stroke-[2]" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
                Đặt Hàng Thành Công!
              </h1>
              <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-lg mx-auto leading-relaxed">
                Cảm ơn bạn đã lựa chọn NOT A KNOT. Đơn hàng của bạn đã được ghi nhận trên hệ thống.
              </p>

              {/* Tracking Code Highlight Box */}
              <div className="mt-6 inline-flex flex-col sm:flex-row items-center gap-3 bg-amber-50 border border-amber-200/90 px-6 py-3.5 rounded-2xl">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900">
                  Mã tra cứu đơn hàng:
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-lg sm:text-xl text-slate-950 tracking-wider">
                    {placedOrder.trackingNumber || placedOrder.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(placedOrder.trackingNumber || placedOrder.id || '', 'trackingCode')}
                    className="p-2 rounded-xl bg-white border border-amber-200 text-slate-700 hover:text-amber-800 transition-colors cursor-pointer shadow-2xs"
                    title="Sao chép mã tra cứu"
                  >
                    {copiedField === 'trackingCode' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Email Option Card (Spacious & Comfortable) */}
              {showEmailOption && (
                <div className="mt-6 p-4 sm:p-5 bg-slate-50 border border-slate-200/90 rounded-2xl max-w-lg mx-auto text-left shadow-2xs">
                  <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-slate-800">
                    <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Nhận thông tin đơn hàng qua Email:</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                    <input
                      type="email"
                      value={successEmailInput}
                      onChange={(e) => {
                        setSuccessEmailInput(e.target.value);
                        if (successEmailError) setSuccessEmailError(null);
                      }}
                      onBlur={() => {
                        if (successEmailInput) {
                          setSuccessEmailInput(ensureGmailDomain(successEmailInput));
                        }
                      }}
                      disabled={isSendingSuccessEmail || isSuccessEmailSent}
                      placeholder="Nhập địa chỉ email của bạn..."
                      className="w-full flex-1 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none disabled:opacity-60 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={handleSendSuccessEmail}
                      disabled={isSendingSuccessEmail || isSuccessEmailSent}
                      className={`w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs flex items-center justify-center gap-2 shrink-0 ${
                        isSuccessEmailSent
                          ? 'bg-emerald-600 text-white cursor-default'
                          : 'bg-slate-900 hover:bg-slate-800 active:bg-black text-white disabled:opacity-50'
                      }`}
                    >
                      {isSendingSuccessEmail ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                          <span>Đang gửi...</span>
                        </>
                      ) : isSuccessEmailSent ? (
                        '✓ Đã gửi email'
                      ) : (
                        'Email'
                      )}
                    </button>
                  </div>
                  {successEmailError && (
                    <p className="text-xs text-rose-600 mt-2 font-medium">
                      {successEmailError}
                    </p>
                  )}
                </div>
              )}
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
                      Hình thức: Thu tiền khi nhận hàng (COD)
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                      Đơn hàng của bạn sẽ được xưởng đan tay và đóng gói cẩn thận. Bưu tá sẽ liên hệ theo số điện thoại <strong>{placedOrder.phone}</strong> trước khi giao. Vui lòng chuẩn bị số tiền <strong>{(placedOrder.totalPrice || 0).toLocaleString('vi-VN')}đ</strong> khi nhận hàng.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons (Primary: Theo Dõi Tiến Độ Đơn Hàng) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => onOpenOrderTracker(placedOrder.trackingNumber || placedOrder.id)}
                className="w-full sm:w-auto px-7 py-3.5 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 font-black text-sm rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2.5"
              >
                <Search className="w-5 h-5 text-slate-950" />
                <span>Theo Dõi Tiến Độ Đơn Hàng</span>
              </button>

              <button
                type="button"
                onClick={onContinueShopping}
                className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-sm rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Tiếp tục mua sắm</span>
              </button>

              <a
                href={messengerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4.5 h-4.5 text-amber-400" />
                <span>Hỗ trợ Messenger</span>
              </a>
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* SUBMISSION PROCESSING OVERLAY (MANDATORY WAIT)               */}
        {/* ============================================================ */}
        {isSubmitting && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center animate-scaleUp">
              {submissionStep !== 'error' ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center mx-auto mb-4">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 font-display">
                    Đang Xử Lý & Lưu Đơn Hàng...
                  </h3>
                  
                  {/* Critical Wait Banner */}
                  <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs sm:text-sm font-bold mb-5 flex items-start gap-2.5 text-left">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-amber-950 block mb-0.5">LƯU Ý QUAN TRỌNG:</strong>
                      Quý khách vui lòng <strong>chờ ở trang này trong giây lát</strong> và <strong>không tắt trình duyệt / không tải lại trang</strong> cho đến khi đơn hàng được xác nhận đặt thành công!
                    </span>
                  </div>

                  {/* Progress Stages */}
                  <div className="space-y-2 text-left text-xs">
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 font-medium ${submissionStep === 'preparing' ? 'bg-amber-50 border-amber-200 text-amber-800 font-bold' : 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'}`}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>1. Chuẩn bị và kiểm tra thông tin đơn hàng</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 font-medium ${submissionStep === 'syncing' ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold animate-pulse' : submissionStep === 'confirmed' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      {submissionStep === 'confirmed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0" />
                      )}
                      <span>2. Ghi nhận tức thì vào hệ thống quản lý Not A Knot</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 font-medium ${submissionStep === 'confirmed' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      {submissionStep === 'confirmed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>3. Xác nhận đặt hàng thành công & tạo mã vận đơn</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 font-display">
                    Chưa Thể Lưu Đơn Hàng
                  </h3>
                  <div className="text-xs text-rose-800 bg-rose-50 p-4 rounded-2xl border border-rose-200 mb-5 text-left leading-relaxed font-medium space-y-2">
                    <p>
                      {submissionError || 'Sau 10 giây hệ thống chưa ghi nhận được đơn hàng. Quý khách vui lòng tải lại trang và đặt lại.'}
                    </p>
                    <p className="text-slate-700 text-[11px]">
                      Nếu sự cố vẫn tiếp diễn, vui lòng liên lạc với chúng tớ qua Messenger để được hỗ trợ đặt hàng trực tiếp nhé!
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Tải lại trang & đặt lại</span>
                    </button>
                    <a
                      href={messengerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 text-slate-950" />
                      <span>Liên hệ Messenger</span>
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubmitting(false);
                      setSubmissionStep('idle');
                    }}
                    className="w-full mt-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-medium cursor-pointer"
                  >
                    ← Quay lại kiểm tra thông tin đặt hàng
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Customer Custom Photo / Product Image Zoom Lightbox Modal */}
        {cartPhotoPreview && (
          <div
            className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setCartPhotoPreview(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-700/40 flex flex-col animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Lightbox Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  {cartPhotoPreview.isCustomPhoto ? (
                    <Camera className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span className="font-bold text-sm truncate">
                    {cartPhotoPreview.isCustomPhoto
                      ? `Ảnh In Theo Yêu Cầu - ${cartPhotoPreview.title}`
                      : `Ảnh Sản Phẩm - ${cartPhotoPreview.title}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCartPhotoPreview(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Lightbox Image Preview with Zoom & Rotate */}
              <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[260px] max-h-[55vh] overflow-hidden relative select-none">
                {cartPhotoPreview.urls && cartPhotoPreview.urls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const urls = cartPhotoPreview.urls!;
                        const cur = cartPhotoPreview.activePhotoIdx ?? 0;
                        const nextIdx = (cur - 1 + urls.length) % urls.length;
                        setCartPhotoPreview((prev) =>
                          prev ? { ...prev, activePhotoIdx: nextIdx, url: urls[nextIdx] } : null
                        );
                        setPhotoRotation(0);
                        setPhotoZoomScale(1);
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 active:scale-95 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer"
                      title="Ảnh trước"
                    >
                      <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const urls = cartPhotoPreview.urls!;
                        const cur = cartPhotoPreview.activePhotoIdx ?? 0;
                        const nextIdx = (cur + 1) % urls.length;
                        setCartPhotoPreview((prev) =>
                          prev ? { ...prev, activePhotoIdx: nextIdx, url: urls[nextIdx] } : null
                        );
                        setPhotoRotation(0);
                        setPhotoZoomScale(1);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 active:scale-95 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer"
                      title="Ảnh tiếp theo"
                    >
                      <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-y-0 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/70 text-amber-300 text-xs font-mono font-bold backdrop-blur-xs border border-white/20">
                      Ảnh {(cartPhotoPreview.activePhotoIdx ?? 0) + 1} / {cartPhotoPreview.urls.length}
                    </div>
                  </>
                )}
                <img
                  src={cartPhotoPreview.url}
                  alt=""
                  style={{ transform: `rotate(${photoRotation}deg) scale(${photoZoomScale})` }}
                  className="max-h-[50vh] max-w-full object-contain rounded-none shadow-lg transition-transform duration-200"
                />
                {photoZoomScale !== 1 && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-bold backdrop-blur-xs border border-white/20">
                    {Math.round(photoZoomScale * 100)}%
                  </div>
                )}
              </div>

              {/* Toast Message on replacement */}
              {replaceSuccessToast && (
                <div className="mx-4 mt-3 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{replaceSuccessToast}</span>
                </div>
              )}

              {/* Note & Details with Edit Capability */}
              {cartPhotoPreview.isCustomPhoto && (
                <div className="p-3 bg-rose-50 border-t border-rose-100 text-xs text-rose-950">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-rose-900 text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <FileText className="w-3 h-3 text-rose-600" />
                      <span>Ghi chú của bạn:</span>
                    </span>
                    {!isEditingNote && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditNoteValue(cartPhotoPreview.note || '');
                          setIsEditingNote(true);
                        }}
                        className="text-[11px] text-rose-700 hover:text-rose-900 underline font-bold cursor-pointer"
                      >
                        {cartPhotoPreview.note ? 'Sửa ghi chú' : '+ Thêm ghi chú in'}
                      </button>
                    )}
                  </div>
                  {isEditingNote ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <input
                        type="text"
                        value={editNoteValue}
                        onChange={(e) => setEditNoteValue(e.target.value)}
                        placeholder="Nhập ghi chú in ảnh (ví dụ: Lỗ tròn, in 2 mặt...)..."
                        className="flex-1 px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs text-rose-950 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setIsEditingNote(false);
                            setCartPhotoPreview((prev) => (prev ? { ...prev, note: editNoteValue } : null));
                            if (onUpdateItemPhoto && cartPhotoPreview && typeof cartPhotoPreview.index === 'number') {
                              onUpdateItemPhoto(cartPhotoPreview.index, cartPhotoPreview.url, editNoteValue);
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingNote(false);
                          setCartPhotoPreview((prev) => (prev ? { ...prev, note: editNoteValue } : null));
                          if (onUpdateItemPhoto && cartPhotoPreview && typeof cartPhotoPreview.index === 'number') {
                            onUpdateItemPhoto(cartPhotoPreview.index, cartPhotoPreview.url, editNoteValue);
                          }
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                      >
                        Lưu
                      </button>
                    </div>
                  ) : (
                    <p className="font-medium italic text-rose-950">
                      "{cartPhotoPreview.note || 'Không có ghi chú'}"
                    </p>
                  )}
                </div>
              )}

              {/* Lightbox Actions */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {cartPhotoPreview.isCustomPhoto && (
                    <>
                      <button
                        type="button"
                        disabled={isReplacingPhoto}
                        onClick={() => {
                          if (typeof cartPhotoPreview.index === 'number') {
                            handleTriggerReplacePhoto(cartPhotoPreview.index);
                          } else {
                            replaceFileInputRef.current?.click();
                          }
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white border border-rose-600 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                        title="Chọn ảnh khác thay thế từ máy của bạn"
                      >
                        {isReplacingPhoto ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang đổi ảnh...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-3.5 h-3.5" />
                            <span>Thay ảnh</span>
                          </>
                        )}
                      </button>

                      {typeof cartPhotoPreview.index === 'number' && (
                        <button
                          type="button"
                          onClick={() => {
                            const itemIdx = cartPhotoPreview.index!;
                            const curPhotoIdx = cartPhotoPreview.activePhotoIdx ?? 0;
                            handleDeletePhotoDirect(itemIdx, curPhotoIdx);
                          }}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                          title="Xóa ảnh đang xem khỏi sản phẩm này"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Xóa ảnh này</span>
                        </button>
                      )}
                    </>
                  )}

                  {/* Zoom controls */}
                  <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/60">
                    <button
                      type="button"
                      onClick={() => setPhotoZoomScale((s) => Math.max(0.75, s - 0.25))}
                      className="p-1.5 hover:bg-white rounded-md text-slate-700 transition-colors cursor-pointer"
                      title="Thu nhỏ"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoZoomScale(1)}
                      className="px-1.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-white rounded-md transition-colors cursor-pointer"
                      title="Đặt lại kích thước 100%"
                    >
                      {Math.round(photoZoomScale * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoZoomScale((s) => Math.min(3, s + 0.25))}
                      className="p-1.5 hover:bg-white rounded-md text-slate-700 transition-colors cursor-pointer"
                      title="Phóng to"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Rotate */}
                  <button
                    type="button"
                    onClick={() => setPhotoRotation((r) => (r + 90) % 360)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    title="Xoay ảnh 90 độ"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-slate-600" />
                    <span>Xoay ảnh</span>
                  </button>

                  {/* Delete this photo button if custom photo */}
                  {cartPhotoPreview.isCustomPhoto && (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof cartPhotoPreview.index === 'number') {
                          const itemIdx = cartPhotoPreview.index;
                          const photoIdx = cartPhotoPreview.activePhotoIdx ?? 0;
                          handleDeletePhotoDirect(itemIdx, photoIdx);
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      title="Xóa ảnh in này"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Xóa ảnh này</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setCartPhotoPreview(null)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs ml-auto"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Photo Crop & Zoom Adjustment Modal */}
        {cartCropData && (
          <PhotoCropModal
            isOpen={cartCropData.isOpen}
            imageSrc={cartCropData.imageSrc}
            imageSrcs={cartCropData.imageSrcs}
            aspectRatio={cartCropData.aspectRatio}
            onConfirm={handleCartCropConfirm}
            onConfirmMultiple={handleCartCropConfirmMultiple}
            onCancel={() => {
              setCartCropData(null);
              targetReplaceIdxRef.current = null;
              targetAppendIdxRef.current = null;
            }}
          />
        )}

        {/* Modal hỏi dùng lại ảnh hay thêm ảnh mới khi tăng số lượng */}
        {confirmModalItemIndex !== null && cartItems[confirmModalItemIndex] && (
          <PhotoQuantityConfirmModal
            isOpen={true}
            onClose={() => setConfirmModalItemIndex(null)}
            photoUrl={
              cartItems[confirmModalItemIndex].customPhotoUrl ||
              cartItems[confirmModalItemIndex].customPhotoUrls?.[0]
            }
            photosCount={
              cartItems[confirmModalItemIndex].customPhotoUrls?.length ||
              (cartItems[confirmModalItemIndex].customPhotoUrl ? 1 : 0)
            }
            productName={cartItems[confirmModalItemIndex].product.name}
            onReusePhoto={() => {
              const idx = confirmModalItemIndex;
              setConfirmModalItemIndex(null);
              if (idx !== null && cartItems[idx]) {
                onUpdateQuantity(idx, cartItems[idx].quantity + 1);
              }
            }}
            onAddNewPhoto={() => {
              const idx = confirmModalItemIndex;
              setConfirmModalItemIndex(null);
              if (idx !== null) {
                handleTriggerAppendPhoto(idx);
              }
            }}
          />
        )}

        {/* Modal chọn xóa ảnh khi giảm số lượng */}
        {deleteModalItemIndex !== null && cartItems[deleteModalItemIndex] && (
          <PhotoDeleteSelectModal
            isOpen={true}
            onClose={() => setDeleteModalItemIndex(null)}
            photos={
              cartItems[deleteModalItemIndex].customPhotoUrls && cartItems[deleteModalItemIndex].customPhotoUrls!.length > 0
                ? cartItems[deleteModalItemIndex].customPhotoUrls!
                : (cartItems[deleteModalItemIndex].customPhotoUrl ? [cartItems[deleteModalItemIndex].customPhotoUrl!] : [])
            }
            productName={cartItems[deleteModalItemIndex].product.name}
            itemQuantity={cartItems[deleteModalItemIndex].quantity}
            onDeletePhoto={handleDeletePhotoFromCartItem}
            onDecreaseQuantityOnly={() => {
              const idx = deleteModalItemIndex;
              if (idx !== null && cartItems[idx]) {
                onUpdateQuantity(idx, cartItems[idx].quantity - 1);
              }
            }}
          />
        )}

        {/* Global hidden file inputs for custom print photos */}
        <input
          type="file"
          ref={replaceFileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleReplacePhotoFile}
        />

        <input
          type="file"
          ref={appendFileInputRef}
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleAppendPhotoFile}
        />

      </div>
    </div>
  );
};
