import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { Product, CategoryItem, CollectionInfo, SiteContentConfig } from '../types';
import { PRODUCTS as DEFAULT_PRODUCTS } from '../data/products';
import { DEFAULT_CATEGORIES } from '../data/categories';
import { COLLECTIONS_DATA } from '../data/collections';
import { DEFAULT_SITE_CONTENT } from '../data/siteContent';
import { AdminManualOrderForm } from './AdminManualOrderForm';
import { AdminDashboard } from './AdminDashboard';
import { AdminAnalyticsDashboard } from './AdminAnalyticsDashboard';
import { AdminOrderDetailsModal } from './AdminOrderDetailsModal';
import { AdminEditOrderModal } from './AdminEditOrderModal';
import { AdminReceiptUploadModal } from './AdminReceiptUploadModal';
import { AdminBannersManager } from './AdminBannersManager';
import { AdminSiteEditor } from './AdminSiteEditor';
import { AdminMessagesManager } from './AdminMessagesManager';
import { AdminBackupManager } from './AdminBackupManager';
import { ExcelExportPromptModal } from './ExcelExportPromptModal';
import { exportOrdersWithImageOption } from '../utils/excelImageExporter';
import {
  subscribeQuotaStats,
  getLatestQuotaStats,
  FirestoreQuotaStats,
  fetchProductsFromFirestore,
  saveProductToFirestore,
  deleteProductFromFirestore,
  fetchCategoriesFromFirestore,
  saveCategoryToFirestore,
  deleteCategoryFromFirestore,
  fetchOrdersFromFirestore,
  deleteOrderFromFirestore,
  updateOrderStatusInFirestore,
  fetchContactMessagesFromFirestore,
  testFirebaseConnection,
  StoredOrder
} from '../firebase';

interface AdminPageProps {
  products: Product[];
  categories?: CategoryItem[];
  collections?: CollectionInfo[];
  siteContent?: SiteContentConfig;
  onUpdateProducts: (newProducts: Product[]) => void;
  onUpdateCategories?: (newCategories: CategoryItem[]) => void;
  onUpdateCollections?: (newCollections: CollectionInfo[]) => void;
  onUpdateSiteContent?: (newConfig: SiteContentConfig) => void;
  onBackToStore: () => void;
}

export type AdminTabType =
  | 'dashboard'
  | 'analytics'
  | 'orders'
  | 'manual_order'
  | 'messages'
  | 'site_editor'
  | 'banners'
  | 'products'
  | 'categories'
  | 'backup'
  | 'firebase';

export const AdminPage: React.FC<AdminPageProps> = ({
  products,
  categories = DEFAULT_CATEGORIES,
  collections = COLLECTIONS_DATA,
  siteContent = DEFAULT_SITE_CONTENT,
  onUpdateProducts,
  onUpdateCategories,
  onUpdateCollections,
  onUpdateSiteContent,
  onBackToStore
}) => {
  const [activeTab, setActiveTab] = useState<AdminTabType>('dashboard');
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<'all' | 'website' | 'event_0209' | 'facebook' | 'workshop'>('all');

  // Switch tab with simulated enterprise loading transition
  const handleSwitchTab = (tab: AdminTabType) => {
    if (tab === activeTab && !isAddingNew && !isAddingCategory) return;
    setIsTabLoading(true);
    setIsAddingNew(false);
    setIsAddingCategory(false);
    setEditingProduct(null);
    setEditingCategory(null);
    setSidebarOpen(false);

    setTimeout(() => {
      setActiveTab(tab);
      setIsTabLoading(false);
    }, 240);
  };

  // Internal categories state synchronized with props
  const [localCategories, setLocalCategories] = useState<CategoryItem[]>(categories);

  useEffect(() => {
    setLocalCategories((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(categories)) {
        return categories;
      }
      return prev;
    });
  }, [categories]);

  const handleUpdateCategoriesInternal = (newCats: CategoryItem[]) => {
    setLocalCategories(newCats);
    if (onUpdateCategories) {
      onUpdateCategories(newCats);
    }
    try {
      localStorage.setItem('nak_categories', JSON.stringify(newCats));
    } catch (e) {
      console.warn('Lỗi lưu categories vào localStorage:', e);
    }
  };

  // Internal collections / banners state synchronized with props
  const [localCollections, setLocalCollections] = useState<CollectionInfo[]>(collections);

  useEffect(() => {
    setLocalCollections((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(collections)) {
        return collections;
      }
      return prev;
    });
  }, [collections]);

  const handleUpdateCollectionsInternal = (newCols: CollectionInfo[]) => {
    setLocalCollections(newCols);
    if (onUpdateCollections) {
      onUpdateCollections(newCols);
    }
    try {
      localStorage.setItem('nak_collections', JSON.stringify(newCols));
    } catch (e) {
      console.warn('Lỗi lưu collections vào localStorage:', e);
    }
  };

  // Orders state & filters (3 sources, 2 payment types, 3 statuses)
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderFilterType, setOrderFilterType] = useState<'all' | '0209' | 'standard'>('all');
  const [orderSourceFilter, setOrderSourceFilter] = useState<'all' | 'website' | 'mạng xã hội' | 'trực tiếp'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'Đã đặt' | 'Đã thanh toán' | 'Đã giao'>('all');
  const [orderPaymentStatusFilter, setOrderPaymentStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [orderHasReceiptFilter, setOrderHasReceiptFilter] = useState<'all' | 'has_receipt' | 'no_receipt'>('all');

  // Bulk Selection & Editing Modal States
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [tableZoom, setTableZoom] = useState<number>(100);
  const [editingOrder, setEditingOrder] = useState<StoredOrder | null>(null);
  const [receiptPromptModal, setReceiptPromptModal] = useState<{ order: StoredOrder; isPromptOnPaid?: boolean } | null>(null);
  const [orderContextMenu, setOrderContextMenu] = useState<{ x: number; y: number; order: StoredOrder } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Calculate pixel-perfect clamped context menu position right at cursor
  const getClampedContextMenuPos = (clientX: number, clientY: number) => {
    const MENU_WIDTH = 224;
    const MENU_HEIGHT = 280;
    const PADDING = 10;

    const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
    const vh = window.innerHeight || document.documentElement.clientHeight || 768;

    let left = clientX;
    let top = clientY;

    // Flip left if overflows right viewport boundary
    if (left + MENU_WIDTH > vw - PADDING) {
      left = Math.max(PADDING, clientX - MENU_WIDTH);
    }

    // Flip upward if overflows bottom viewport boundary
    if (top + MENU_HEIGHT > vh - PADDING) {
      top = Math.max(PADDING, clientY - MENU_HEIGHT);
    }

    // Strict boundaries
    left = Math.max(PADDING, Math.min(left, vw - MENU_WIDTH - PADDING));
    top = Math.max(PADDING, Math.min(top, vh - MENU_HEIGHT - PADDING));

    return { top, left };
  };

  // Toggle single order selection
  const toggleSelectOrder = (orderId?: string) => {
    if (!orderId) return;
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!orderContextMenu) return;
    const handleClose = (e: MouseEvent | Event) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target as Node)) {
        return;
      }
      setOrderContextMenu(null);
    };

    window.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [orderContextMenu]);

  // Modal inspection & receipt zoom
  const [inspectingOrder, setInspectingOrder] = useState<StoredOrder | null>(null);
  const [zoomReceiptImage, setZoomReceiptImage] = useState<string | null>(null);
  const [showOrdersExcelPrompt, setShowOrdersExcelPrompt] = useState(false);

  // Firebase Quota & Cloud Sync State
  const [quotaStats, setQuotaStats] = useState<FirestoreQuotaStats>(getLatestQuotaStats());
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string | null>(null);
  const [cloudConnected, setCloudConnected] = useState<boolean | null>(null);

  // Form State for Adding / Editing Product
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState('');
  const [formPriceInput, setFormPriceInput] = useState<string>('0');
  const [formOriginalPriceInput, setFormOriginalPriceInput] = useState<string>('');
  const [formCategory, setFormCategory] = useState(categories[0]?.id || 'event_0209');
  const [formDescription, setFormDescription] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [newImageUrlInput, setNewImageUrlInput] = useState('');
  const [formDiscountBadge, setFormDiscountBadge] = useState('');
  const [formDetailsText, setFormDetailsText] = useState('');
  const [formStock, setFormStock] = useState<number>(15);
  const [formInStock, setFormInStock] = useState(true);
  const [formIsEvent0209, setFormIsEvent0209] = useState(false);
  const [formIsBestSeller, setFormIsBestSeller] = useState(false);
  const [formIsNew, setFormIsNew] = useState(false);

  // Category Manager State (Add / Edit category)
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [catFormId, setCatFormId] = useState('');
  const [catFormLabel, setCatFormLabel] = useState('');
  const [catFormDescription, setCatFormDescription] = useState('');
  const [catFormColor, setCatFormColor] = useState('#B41C1A');
  const [catFormBadge, setCatFormBadge] = useState('');
  const [catFormIsEvent, setCatFormIsEvent] = useState(false);

  // Search & Filter in Admin Products
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('all');

  // UI Layout & Drag-Drop states
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [isImageDragging, setIsImageDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to parse price cleanly
  const parsePrice = (val: string | number): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const cleanStr = String(val).replace(/[^0-9]/g, '');
    const num = parseInt(cleanStr, 10);
    return isNaN(num) ? 0 : num;
  };

  // Helper to format currency preview
  const formatCurrency = (num: number): string => {
    return `${num.toLocaleString('vi-VN')}đ`;
  };

  // Subscribe to real-time Firebase Quota metrics
  useEffect(() => {
    const unsubscribe = subscribeQuotaStats((stats) => {
      setQuotaStats(stats);
    });
    return () => unsubscribe();
  }, []);

  // Check connection to Firestore on mount
  useEffect(() => {
    const checkConn = async () => {
      const ok = await testFirebaseConnection();
      setCloudConnected(ok);
    };
    checkConn();
  }, []);

  // Fetch orders from Firestore or localStorage
  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const dbOrders = await fetchOrdersFromFirestore();
      if (dbOrders && dbOrders.length > 0) {
        setOrders(dbOrders);
        localStorage.setItem('nak_preorders', JSON.stringify(dbOrders));
      } else {
        const local = localStorage.getItem('nak_preorders');
        if (local) {
          setOrders(JSON.parse(local));
        } else {
          setOrders([]);
        }
      }
    } catch (e) {
      console.warn('Lỗi khi tải đơn hàng:', e);
      const local = localStorage.getItem('nak_preorders');
      if (local) setOrders(JSON.parse(local));
    } finally {
      setLoadingOrders(false);
    }
  };

  // Fetch unread messages count from Firestore / Local cache
  const loadMessagesCount = async () => {
    try {
      const msgs = await fetchContactMessagesFromFirestore();
      const unread = msgs.filter((m) => !m.isRead).length;
      setUnreadMessagesCount(unread);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadMessagesCount();
    const interval = setInterval(loadMessagesCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-load orders on initial mount and when switching to dashboard or orders tab
  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'orders') {
      loadOrders();
    }
    if (activeTab === 'messages') {
      loadMessagesCount();
    }
  }, [activeTab]);

  // Sync Products & Categories from Cloud
  const handleFetchFromCloud = async () => {
    setIsCloudSyncing(true);
    setCloudSyncMessage('Đang kéo dữ liệu từ Firebase Firestore...');
    try {
      const [cloudProds, cloudCats] = await Promise.all([
        fetchProductsFromFirestore(),
        fetchCategoriesFromFirestore()
      ]);

      if (cloudProds && cloudProds.length > 0) {
        onUpdateProducts(cloudProds);
      }
      if (cloudCats && cloudCats.length > 0) {
        setLocalCategories(cloudCats);
        onUpdateCategories?.(cloudCats);
      }
      setCloudSyncMessage(`Đã đồng bộ thành công từ Firebase Firestore!`);
      setTimeout(() => setCloudSyncMessage(null), 3500);
    } catch (e) {
      console.error('Lỗi tải từ Firebase:', e);
      setCloudSyncMessage('Lỗi kết nối Firebase. Vui lòng thử lại.');
      setTimeout(() => setCloudSyncMessage(null), 4000);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Push all products and categories to Cloud
  const handlePushAllToCloud = async () => {
    setIsCloudSyncing(true);
    setCloudSyncMessage('Đang đồng bộ toàn bộ dữ liệu lên Firebase Firestore...');
    try {
      let count = 0;
      for (const prod of products) {
        await saveProductToFirestore(prod);
        count++;
      }
      for (const cat of localCategories) {
        await saveCategoryToFirestore(cat);
      }
      setCloudSyncMessage(`Đã đẩy ${count} sản phẩm & ${localCategories.length} danh mục lên Firebase!`);
      setTimeout(() => setCloudSyncMessage(null), 3500);
    } catch (e) {
      console.error('Lỗi push lên Firebase:', e);
      setCloudSyncMessage('Lỗi khi tải lên Firebase.');
      setTimeout(() => setCloudSyncMessage(null), 4000);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Reset to default sample products
  const handleResetDefaults = async () => {
    if (window.confirm('Khôi phục danh sách sản phẩm và danh mục gốc? Các chỉnh sửa thủ công sẽ được đặt lại.')) {
      onUpdateProducts(DEFAULT_PRODUCTS);
      setLocalCategories(DEFAULT_CATEGORIES);
      onUpdateCategories?.(DEFAULT_CATEGORIES);
      localStorage.setItem('nak_custom_products', JSON.stringify(DEFAULT_PRODUCTS));
      localStorage.setItem('nak_categories', JSON.stringify(DEFAULT_CATEGORIES));
      alert('Đã khôi phục dữ liệu mặc định.');
    }
  };

  // Export products to JSON file
  const handleExportProductsJSON = () => {
    const dataStr = JSON.stringify({ products, categories: localCategories }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notaknot-database-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export orders to Excel (.xlsx) file with detailed data & column formatting
  const handleExportOrdersExcel = () => {
    if (orders.length === 0) {
      showAdminToast('Chưa có đơn hàng nào để xuất file.');
      return;
    }
    setShowOrdersExcelPrompt(true);
  };

  const handleConfirmExportOrdersExcel = async (includeImages: boolean, onProgress: (msg: string) => void) => {
    await exportOrdersWithImageOption({
      orders,
      products,
      includeImages,
      onProgress
    });
    showAdminToast(includeImages ? 'Đã xuất file ZIP kèm toàn bộ hình ảnh thành công!' : 'Đã xuất file Excel (.xlsx) thành công!');
  };

  // Open form for adding new product
  const handleOpenAddForm = () => {
    setEditingProduct(null);
    setFormName('');
    setFormPriceInput('150000');
    setFormOriginalPriceInput('220000');
    setFormCategory(localCategories[0]?.id || 'event_0209');
    setFormDescription('');
    setFormImage('/assets/hero-bg.png');
    setFormImages(['/assets/hero-bg.png']);
    setNewImageUrlInput('');
    setFormDiscountBadge('');
    setFormDetailsText('Dây Paracord 550 Type III 7 lõi chịu lực\nKhóa kim loại titan chống rỉ sét');
    setFormStock(15);
    setFormInStock(true);
    setFormIsEvent0209(false);
    setFormIsBestSeller(false);
    setFormIsNew(true);
    setIsAddingNew(true);
  };

  // Open form for editing existing product
  const handleOpenEditForm = (prod: Product) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormPriceInput(String(prod.price || 0));
    setFormOriginalPriceInput(prod.originalPrice ? String(prod.originalPrice) : '');
    setFormCategory(prod.category || localCategories[0]?.id || 'event_0209');
    setFormDescription(prod.description || '');
    setFormImage(prod.image || '');
    const initialImages = (prod.images && prod.images.length > 0) ? prod.images : (prod.image ? [prod.image] : []);
    setFormImages(initialImages);
    setNewImageUrlInput('');
    setFormDiscountBadge(prod.discountBadge || '');
    setFormDetailsText((prod.details || []).join('\n'));
    setFormStock(prod.stock ?? 15);
    setFormInStock(prod.inStock !== false);
    setFormIsEvent0209(!!prod.isEvent0209);
    setFormIsBestSeller(!!prod.isBestSeller);
    setFormIsNew(!!prod.isNew);
    setIsAddingNew(true);
  };

  // Image Drag & Drop / File Upload handler (Base64) - appends to formImages
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, JPEG, WEBP, SVG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Dung lượng ảnh tối đa là 5MB để đảm bảo hiệu suất tốt nhất.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const newImg = reader.result;
        setFormImages((prev) => {
          const updated = [...prev, newImg];
          if (!formImage || prev.length === 0) {
            setFormImage(newImg);
          }
          return updated;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddImageUrl = () => {
    if (!newImageUrlInput.trim()) return;
    const url = newImageUrlInput.trim();
    setFormImages((prev) => {
      const updated = [...prev, url];
      if (!formImage || prev.length === 0) {
        setFormImage(url);
      }
      return updated;
    });
    setNewImageUrlInput('');
  };

  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    setFormImages((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      if (copy[0]) {
        setFormImage(copy[0]);
      }
      return copy;
    });
  };

  const handleSetDefaultImage = (index: number) => {
    if (index === 0) return;
    handleMoveImage(index, 0);
  };

  const handleRemoveImage = (index: number) => {
    setFormImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated[0]) {
        setFormImage(updated[0]);
      } else {
        setFormImage('');
      }
      return updated;
    });
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (file) {
          processImageFile(file);
        }
      }
    }
    e.target.value = '';
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsImageDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (file) {
          processImageFile(file);
        }
      }
    }
  };

  // Save product (Add or Edit) - FIXED VALIDATION
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Vui lòng nhập tên sản phẩm.');
      return;
    }

    const priceNum = parsePrice(formPriceInput);
    if (priceNum <= 0) {
      alert('Vui lòng nhập giá bán sản phẩm hợp lệ (lớn hơn 0đ). Ví dụ: 150000');
      return;
    }

    const originalPriceNum = formOriginalPriceInput.trim() ? parsePrice(formOriginalPriceInput) : undefined;

    const detailsArray = formDetailsText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const stockNumber = Math.max(0, Number(formStock) || 0);
    const calculatedInStock = stockNumber > 0 && formInStock;

    const finalImages = formImages.length > 0 ? formImages : (formImage ? [formImage] : ['/assets/hero-bg.png']);
    const defaultImage = finalImages[0] || formImage || '/assets/hero-bg.png';

    if (editingProduct) {
      // Update existing
      const updatedItem: Product = {
        ...editingProduct,
        name: formName.trim(),
        price: priceNum,
        originalPrice: originalPriceNum,
        category: formCategory,
        description: formDescription.trim() || 'Mẫu phụ kiện Paracord thủ công độc đáo.',
        image: defaultImage,
        images: finalImages,
        discountBadge: formDiscountBadge.trim() || undefined,
        details: detailsArray.length > 0 ? detailsArray : ['Dây Paracord 550 cao cấp'],
        availableColors: undefined,
        availableSizes: undefined,
        stock: stockNumber,
        inStock: calculatedInStock,
        isEvent0209: formIsEvent0209,
        isBestSeller: formIsBestSeller,
        isNew: formIsNew
      };

      const updatedList = products.map((p) => (p.id === editingProduct.id ? updatedItem : p));
      onUpdateProducts(updatedList);
      setIsAddingNew(false);
      setEditingProduct(null);

      // Push to Firestore in background
      saveProductToFirestore(updatedItem).catch((err) => console.warn('Firestore update error:', err));
    } else {
      // Create new
      const newId = `nak-prod-${Date.now()}`;
      const newItem: Product = {
        id: newId,
        name: formName.trim(),
        price: priceNum,
        originalPrice: originalPriceNum,
        category: formCategory,
        description: formDescription.trim() || 'Mẫu phụ kiện Paracord thủ công độc quyền từ NOT A KNOT.',
        image: defaultImage,
        images: finalImages,
        discountBadge: formDiscountBadge.trim() || undefined,
        details: detailsArray.length > 0 ? detailsArray : ['Dây Paracord 550 Type III', 'Khóa kim loại chống gỉ'],
        availableColors: undefined,
        availableSizes: undefined,
        stock: stockNumber,
        inStock: calculatedInStock,
        isEvent0209: formIsEvent0209,
        isBestSeller: formIsBestSeller,
        isNew: formIsNew,
        rating: 5.0,
        reviewsCount: 1
      };

      const updatedList = [newItem, ...products];
      onUpdateProducts(updatedList);
      setIsAddingNew(false);

      // Push to Firestore in background
      saveProductToFirestore(newItem).catch((err) => console.warn('Firestore save error:', err));
    }
  };

  // Delete confirmation modal state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    title: string;
    message: string;
    submessage?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // Admin toast notification
  const [adminToast, setAdminToast] = useState<string | null>(null);

  const showAdminToast = (msg: string) => {
    setAdminToast(msg);
    setTimeout(() => {
      setAdminToast(null);
    }, 3500);
  };

  // Delete product with custom UI modal
  const handleDeleteProduct = (id: string, name: string) => {
    setDeleteConfirmModal({
      title: 'Xóa sản phẩm',
      message: `Bạn có chắc chắn muốn xóa sản phẩm "${name}"?`,
      submessage: 'Hành động này sẽ xóa sản phẩm khỏi danh mục hiển thị và cơ sở dữ liệu.',
      confirmLabel: 'Xóa sản phẩm',
      onConfirm: async () => {
        const updatedList = products.filter((p) => p.id !== id);
        onUpdateProducts(updatedList);
        try {
          localStorage.setItem('nak_custom_products', JSON.stringify(updatedList));
          await deleteProductFromFirestore(id);
        } catch (err) {
          console.warn('Firestore delete error:', err);
        }
        setDeleteConfirmModal(null);
        showAdminToast(`Đã xóa sản phẩm "${name}" thành công.`);
      }
    });
  };

  // Quick adjust stock count (+ / -)
  const handleQuickAdjustStock = (prod: Product, delta: number) => {
    const currentStock = prod.stock ?? (prod.inStock === false ? 0 : 15);
    const newStock = Math.max(0, currentStock + delta);
    const newInStock = newStock > 0;
    const updatedProd = { ...prod, stock: newStock, inStock: newInStock };
    const updatedList = products.map((p) => (p.id === prod.id ? updatedProd : p));
    onUpdateProducts(updatedList);
    saveProductToFirestore(updatedProd).catch((e) => console.warn('Firestore quick stock adjustment:', e));
  };

  // Quick toggle in-stock status
  const handleToggleStock = (prod: Product) => {
    const currentStock = prod.stock ?? (prod.inStock === false ? 0 : 15);
    const newStockState = prod.inStock === false || currentStock <= 0;
    const nextStock = newStockState ? Math.max(10, currentStock) : 0;
    const updatedProd = { ...prod, stock: nextStock, inStock: newStockState };
    const updatedList = products.map((p) => (p.id === prod.id ? updatedProd : p));
    onUpdateProducts(updatedList);
    saveProductToFirestore(updatedProd).catch((e) => console.warn('Firestore stock toggle:', e));
  };

  // ==========================================
  // CATEGORY MANAGEMENT HANDLERS
  // ==========================================
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatFormId(`cat_${Date.now()}`);
    setCatFormLabel('');
    setCatFormDescription('');
    setCatFormColor('#D97706');
    setCatFormBadge('');
    setCatFormIsEvent(false);
    setIsAddingCategory(true);
  };

  const handleOpenEditCategory = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setCatFormId(cat.id);
    setCatFormLabel(cat.label);
    setCatFormDescription(cat.description || '');
    setCatFormColor(cat.highlightColor || '#B41C1A');
    setCatFormBadge(cat.badge || '');
    setCatFormIsEvent(!!cat.isEvent);
    setIsAddingCategory(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormLabel.trim()) {
      showAdminToast('Vui lòng nhập tên danh mục / BST.');
      return;
    }
    if (!catFormId.trim()) {
      showAdminToast('Vui lòng nhập mã định danh danh mục.');
      return;
    }

    const catPayload: CategoryItem = {
      id: catFormId.trim().toLowerCase().replace(/\s+/g, '_'),
      label: catFormLabel.trim(),
      description: catFormDescription.trim(),
      highlightColor: catFormColor,
      badge: catFormBadge.trim() || undefined,
      isEvent: catFormIsEvent
    };

    let updatedCats: CategoryItem[];
    if (editingCategory) {
      updatedCats = localCategories.map((c) => (c.id === editingCategory.id ? catPayload : c));
    } else {
      // Check if ID already exists
      if (localCategories.some((c) => c.id === catPayload.id)) {
        showAdminToast('Mã danh mục này đã tồn tại. Vui lòng chọn mã khác.');
        return;
      }
      updatedCats = [...localCategories, catPayload];
    }

    setLocalCategories(updatedCats);
    onUpdateCategories?.(updatedCats);
    setIsAddingCategory(false);
    setEditingCategory(null);
    showAdminToast(`Đã lưu danh mục "${catPayload.label}" thành công.`);

    // Save to Firestore & local storage
    try {
      localStorage.setItem('nak_categories', JSON.stringify(updatedCats));
      saveCategoryToFirestore(catPayload).catch((err) => console.warn('Firestore save category error:', err));
    } catch (e) {
      console.warn('Lỗi lưu danh mục:', e);
    }
  };

  const handleDeleteCategory = (catId: string, catLabel: string) => {
    const prodsInCat = products.filter((p) => p.category === catId);
    const count = prodsInCat.length;

    setDeleteConfirmModal({
      title: 'Xóa danh mục',
      message: `Bạn có chắc chắn muốn xóa danh mục "${catLabel}"?`,
      submessage:
        count > 0
          ? `Danh mục này đang có ${count} sản phẩm. Các sản phẩm này sẽ được tự động gán vào danh mục mặc định.`
          : 'Danh mục sẽ bị xóa vĩnh viễn khỏi danh sách hiển thị và quản trị.',
      confirmLabel: 'Xóa danh mục',
      onConfirm: async () => {
        const updatedCats = localCategories.filter((c) => c.id !== catId);
        const fallbackCatId = updatedCats[0]?.id || 'bracelets';

        // Reassign products if any belonged to this category
        if (count > 0) {
          const updatedProds = products.map((p) =>
            p.category === catId ? { ...p, category: fallbackCatId } : p
          );
          onUpdateProducts(updatedProds);
          try {
            localStorage.setItem('nak_custom_products', JSON.stringify(updatedProds));
            // Save updated products
            prodsInCat.forEach((p) => {
              saveProductToFirestore({ ...p, category: fallbackCatId }).catch((err) =>
                console.warn('Reassign product category err:', err)
              );
            });
          } catch (e) {
            console.warn('Lỗi cập nhật sản phẩm:', e);
          }
        }

        setLocalCategories(updatedCats);
        onUpdateCategories?.(updatedCats);
        try {
          localStorage.setItem('nak_categories', JSON.stringify(updatedCats));
          await deleteCategoryFromFirestore(catId);
        } catch (err) {
          console.warn('Firestore delete category error:', err);
        }

        setDeleteConfirmModal(null);
        showAdminToast(`Đã xóa danh mục "${catLabel}" thành công.`);
      }
    });
  };

  // Delete an order with modal
  const handleDeleteOrder = (orderId: string) => {
    setDeleteConfirmModal({
      title: 'Xóa đơn hàng',
      message: `Bạn có chắc chắn muốn xóa đơn hàng #${orderId}?`,
      submessage: 'Dữ liệu đơn hàng này sẽ bị xóa khỏi hệ thống quản lý.',
      confirmLabel: 'Xóa đơn hàng',
      onConfirm: async () => {
        const updated = orders.filter((o) => o.id !== orderId);
        setOrders(updated);
        try {
          localStorage.setItem('nak_preorders', JSON.stringify(updated));
          await deleteOrderFromFirestore(orderId);
        } catch (err) {
          console.warn('Delete order error:', err);
        }
        setDeleteConfirmModal(null);
        showAdminToast(`Đã xóa đơn hàng #${orderId} thành công.`);
      }
    });
  };

  // Normalization Helpers for 3 Sources, 2 Payment Types, 3 Statuses
  const getNormalizedSource = (src?: string): 'website' | 'mạng xã hội' | 'trực tiếp' => {
    if (!src || src === 'website') return 'website';
    const s = src.toLowerCase();
    if (['facebook', 'zalo', 'instagram', 'tiktok', 'mạng xã hội', 'social'].includes(s)) return 'mạng xã hội';
    if (['hotline', 'phone', 'direct', 'trực tiếp', 'offline', 'store', 'other', 'cash'].includes(s)) return 'trực tiếp';
    return 'website';
  };

  const getNormalizedStatus = (st?: string): 'Đã đặt' | 'Đã thanh toán' | 'Đã giao' => {
    if (!st) return 'Đã đặt';
    const s = st.toLowerCase();
    if (['đã giao', 'shipping', 'completed', 'delivered', 'đang giao', 'hoàn thành'].includes(s)) return 'Đã giao';
    if (['đã thanh toán', 'paid'].includes(s)) return 'Đã thanh toán';
    return 'Đã đặt';
  };

  const getNormalizedPayment = (ps?: string, st?: string): 'paid' | 'unpaid' => {
    if (ps === 'paid' || st === 'Đã thanh toán' || st === 'paid') return 'paid';
    return 'unpaid';
  };

  // Update order status with prompt if changed to "Đã thanh toán"
  const handleUpdateOrderStatus = async (orderId: string, status: string, skipPrompt = false) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const normalizedSt = getNormalizedStatus(status);
    
    // If status is Đã thanh toán and no receipt is attached yet, prompt popup
    if (normalizedSt === 'Đã thanh toán' && !targetOrder.bankReceiptImage && !skipPrompt) {
      setReceiptPromptModal({ order: { ...targetOrder, status: 'Đã thanh toán', paymentStatus: 'paid' }, isPromptOnPaid: true });
      return;
    }

    const updated = orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: normalizedSt,
            paymentStatus: normalizedSt === 'Đã thanh toán' ? 'paid' : o.paymentStatus || 'unpaid',
            paidAmount: normalizedSt === 'Đã thanh toán' ? (o.totalPrice || o.totalAmount || 0) : o.paidAmount
          }
        : o
    );
    setOrders(updated);
    localStorage.setItem('nak_preorders', JSON.stringify(updated));
    await updateOrderStatusInFirestore(orderId, normalizedSt);
    showAdminToast(`Đã chuyển đơn #${orderId} sang "${normalizedSt}".`);
  };

  // Save edited order
  const handleSaveEditedOrder = (updatedOrder: StoredOrder) => {
    const updated = orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
    setOrders(updated);
    localStorage.setItem('nak_preorders', JSON.stringify(updated));
    setEditingOrder(null);
    showAdminToast(`Đã cập nhật đơn hàng #${updatedOrder.id} thành công!`);
  };

  // Save receipt image
  const handleSaveReceipt = (orderId: string, receiptUrl: string, paymentStatus: 'paid' | 'unpaid') => {
    const updated = orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            bankReceiptImage: receiptUrl,
            paymentStatus,
            paidAmount: paymentStatus === 'paid' ? (o.totalPrice || o.totalAmount || 0) : o.paidAmount,
            status: paymentStatus === 'paid' ? 'Đã thanh toán' : o.status
          }
        : o
    );
    setOrders(updated);
    localStorage.setItem('nak_preorders', JSON.stringify(updated));
    setReceiptPromptModal(null);
    showAdminToast(`Đã lưu ảnh bill chuyển khoản cho đơn #${orderId}!`);
  };

  // Bulk Deletion
  const handleBulkDelete = () => {
    if (selectedOrderIds.length === 0) return;
    setDeleteConfirmModal({
      title: `Xác nhận xóa ${selectedOrderIds.length} đơn hàng`,
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedOrderIds.length} đơn hàng đã chọn?`,
      submessage: 'Dữ liệu sau khi xóa trên Firestore và hệ thống không thể khôi phục lại.',
      confirmLabel: `Xóa ${selectedOrderIds.length} Đơn`,
      onConfirm: async () => {
        const remaining = orders.filter((o) => o.id && !selectedOrderIds.includes(o.id));
        setOrders(remaining);
        localStorage.setItem('nak_preorders', JSON.stringify(remaining));
        for (const id of selectedOrderIds) {
          try {
            await deleteOrderFromFirestore(id);
          } catch (e) {
            console.error('Lỗi xóa đơn bulk:', id, e);
          }
        }
        showAdminToast(`Đã xóa ${selectedOrderIds.length} đơn hàng thành công.`);
        setSelectedOrderIds([]);
        setDeleteConfirmModal(null);
      }
    });
  };

  // Bulk Status Update
  const handleBulkUpdateStatus = async (newStatus: 'Đã đặt' | 'Đã thanh toán' | 'Đã giao') => {
    if (selectedOrderIds.length === 0) return;
    const updated = orders.map((o) =>
      o.id && selectedOrderIds.includes(o.id)
        ? {
            ...o,
            status: newStatus,
            paymentStatus: newStatus === 'Đã thanh toán' ? 'paid' : o.paymentStatus || 'unpaid',
            paidAmount: newStatus === 'Đã thanh toán' ? (o.totalPrice || o.totalAmount || 0) : o.paidAmount
          }
        : o
    );
    setOrders(updated);
    localStorage.setItem('nak_preorders', JSON.stringify(updated));
    for (const id of selectedOrderIds) {
      try {
        await updateOrderStatusInFirestore(id, newStatus);
      } catch (e) {
        console.error('Lỗi bulk update status:', id, e);
      }
    }
    showAdminToast(`Đã chuyển ${selectedOrderIds.length} đơn sang "${newStatus}".`);
    setSelectedOrderIds([]);
  };

  // Bulk Payment Update
  const handleBulkUpdatePayment = async (newPayment: 'paid' | 'unpaid') => {
    if (selectedOrderIds.length === 0) return;
    const updated = orders.map((o) =>
      o.id && selectedOrderIds.includes(o.id)
        ? {
            ...o,
            paymentStatus: newPayment,
            status: newPayment === 'paid' ? 'Đã thanh toán' : o.status || 'Đã đặt',
            paidAmount: newPayment === 'paid' ? (o.totalPrice || o.totalAmount || 0) : 0
          }
        : o
    );
    setOrders(updated);
    localStorage.setItem('nak_preorders', JSON.stringify(updated));
    showAdminToast(`Đã cập nhật trạng thái thanh toán cho ${selectedOrderIds.length} đơn.`);
    setSelectedOrderIds([]);
  };

  // Filtered Products in Admin Table
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(adminSearch.toLowerCase());
      const matchesCategory =
        adminCategoryFilter === 'all' || p.category === adminCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, adminSearch, adminCategoryFilter]);

  // Filtered Orders with multi-dimensional criteria (3 sources, 2 payment types, 3 statuses)
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = orderSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.name && o.name.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.phone && o.phone.toLowerCase().includes(q)) ||
        (o.address && o.address.toLowerCase().includes(q)) ||
        (o.items && o.items.some((i) => i.toLowerCase().includes(q))) ||
        (o.note && o.note.toLowerCase().includes(q)) ||
        (o.bankTransferRef && o.bankTransferRef.toLowerCase().includes(q));

      const matchType =
        orderFilterType === 'all' ||
        (orderFilterType === '0209' && (o.isEvent0209 || o.type === 'preorder_0209')) ||
        (orderFilterType === 'standard' && !o.isEvent0209 && o.type !== 'preorder_0209');

      const normSource = getNormalizedSource(o.source);
      const matchSource =
        orderSourceFilter === 'all' ||
        normSource === orderSourceFilter;

      const normStatus = getNormalizedStatus(o.status);
      const matchStatus =
        orderStatusFilter === 'all' ||
        normStatus === orderStatusFilter;

      const normPayment = getNormalizedPayment(o.paymentStatus, o.status);
      const matchPaymentStatus =
        orderPaymentStatusFilter === 'all' ||
        normPayment === orderPaymentStatusFilter;

      const matchReceipt =
        orderHasReceiptFilter === 'all' ||
        (orderHasReceiptFilter === 'has_receipt' && !!o.bankReceiptImage) ||
        (orderHasReceiptFilter === 'no_receipt' && !o.bankReceiptImage);

      return matchSearch && matchType && matchSource && matchStatus && matchPaymentStatus && matchReceipt;
    });
  }, [
    orders,
    orderSearchQuery,
    orderFilterType,
    orderSourceFilter,
    orderStatusFilter,
    orderPaymentStatusFilter,
    orderHasReceiptFilter
  ]);

  // Summary Metrics
  const inStockCount = products.filter((p) => p.inStock !== false && (p.stock ?? 15) > 0).length;
  const outOfStockCount = products.filter((p) => p.inStock === false || (p.stock ?? 0) === 0).length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || o.totalAmount || 0), 0);

  const getTabDisplayName = () => {
    switch (activeTab) {
      case 'dashboard':
        return { section: 'Tổng Quan', title: 'Bảng Điều Khiển & Doanh Thu' };
      case 'analytics':
        return { section: 'Tổng Quan', title: 'Thống Kê Truy Cập & Google Analytics' };
      case 'orders':
        return { section: 'Bán Hàng & Đơn Hàng', title: `Danh Sách Đơn Hàng (${orders.length})` };
      case 'manual_order':
        return { section: 'Bán Hàng & Đơn Hàng', title: 'Tạo Đơn Hàng Mới' };
      case 'messages':
        return { section: 'Bán Hàng & Đơn Hàng', title: 'Hộp Thư Liên Hệ Khách Hàng' };
      case 'products':
        return { section: 'Sản Phẩm & Kho', title: `Quản Lý Sản Phẩm (${products.length})` };
      case 'categories':
        return { section: 'Sản Phẩm & Kho', title: `Danh Mục Sản Phẩm (${localCategories.length})` };
      case 'site_editor':
        return { section: 'Giao Diện & Nội Dung', title: 'Sửa Giao Diện & Nội Dung Website' };
      case 'banners':
        return { section: 'Giao Diện & Nội Dung', title: `Banners & Bộ Sưu Tập (${localCollections.length})` };
      case 'backup':
        return { section: 'Sao Lưu & Backup', title: 'Sao Lưu & Phục Hồi Dữ Liệu Toàn Hệ Thống' };
      case 'firebase':
        return { section: 'Sao Lưu & Backup', title: 'Tài Khoản & Dung Lượng Firebase Cloud Quota' };
      default:
        return { section: 'Quản Trị', title: 'Hệ Thống' };
    }
  };

  const currentTabInfo = getTabDisplayName();

  return (
    <div id="admin-full-page" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row font-sans">
      
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* ======================================================== */}
      {/* SIDEBAR NAVIGATION (Sections to & nhỏ) */}
      {/* ======================================================== */}
      <aside
        id="admin-sidebar"
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 shadow-sm ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${desktopSidebarCollapsed ? 'lg:w-0 lg:overflow-hidden lg:border-r-0 lg:p-0' : 'lg:w-64 w-72'}`}
      >
        {/* Top Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
          
          {/* 1. App Monogram & Role Header - Clean Minimalist Typography */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              {siteContent?.logoUrl ? (
                <img
                  src={siteContent.logoUrl}
                  alt="Logo"
                  className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200 p-1 shadow-2xs shrink-0"
                />
              ) : null}
              <div className="min-w-0">
                <div className="font-black text-sm text-slate-900 tracking-wider leading-tight flex items-center gap-1.5 uppercase">
                  <span className="truncate">{siteContent?.brandName || 'NOT A KNOT'}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium leading-none mt-1">
                  Quản trị hệ thống
                </div>
              </div>
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              className="px-2 py-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 lg:hidden text-xs font-bold"
            >
              Đóng
            </button>
          </div>

          {/* 3. Grouped Navigation Sections */}
          <nav className="p-3 space-y-4">
            
            {/* SECTION 1: TỔNG QUAN */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                TỔNG QUAN
              </div>
              <button
                id="admin-sidebar-tab-dashboard"
                onClick={() => handleSwitchTab('dashboard')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Bảng điều khiển</span>
              </button>

              <button
                id="admin-sidebar-tab-analytics"
                onClick={() => handleSwitchTab('analytics')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Truy cập & GA4</span>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                  activeTab === 'analytics' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  GA4 Live
                </span>
              </button>
            </div>

            {/* SECTION 2: BÁN HÀNG & ĐƠN HÀNG */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                BÁN HÀNG & ĐƠN HÀNG
              </div>

              <button
                id="admin-sidebar-tab-orders"
                onClick={() => handleSwitchTab('orders')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'orders'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Quản lý đơn hàng</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {orders.length}
                </span>
              </button>

              <button
                id="admin-sidebar-tab-manual-order"
                onClick={() => handleSwitchTab('manual_order')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'manual_order'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-sky-700 hover:bg-sky-50'
                }`}
              >
                <span>Nhập đơn thủ công</span>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                  activeTab === 'manual_order' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'
                }`}>
                  + Mới
                </span>
              </button>

              <button
                id="admin-sidebar-tab-messages"
                onClick={() => handleSwitchTab('messages')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'messages'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Hộp thư liên hệ</span>
                {unreadMessagesCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse shadow-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
                    <span>{unreadMessagesCount} mới</span>
                  </span>
                ) : (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    activeTab === 'messages' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    0
                  </span>
                )}
              </button>
            </div>

            {/* SECTION 3: SẢN PHẨM & KHO */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                SẢN PHẨM & KHO
              </div>

              <button
                id="admin-sidebar-tab-products"
                onClick={() => handleSwitchTab('products')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'products'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Danh sách sản phẩm</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  activeTab === 'products' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {products.length}
                </span>
              </button>

              <button
                id="admin-sidebar-tab-categories"
                onClick={() => handleSwitchTab('categories')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'categories'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Danh mục sản phẩm</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  activeTab === 'categories' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {localCategories.length}
                </span>
              </button>
            </div>

            {/* SECTION 4: GIAO DIỆN & NỘI DUNG */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                GIAO DIỆN & NỘI DUNG
              </div>

              <button
                id="admin-sidebar-tab-site-editor"
                onClick={() => handleSwitchTab('site_editor')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'site_editor'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <span>Sửa Website & Nội dung</span>
              </button>

              <button
                id="admin-sidebar-tab-banners"
                onClick={() => handleSwitchTab('banners')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'banners'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Banners & Bộ sưu tập</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  activeTab === 'banners' ? 'bg-slate-950 text-amber-300' : 'bg-slate-100 text-slate-600'
                }`}>
                  {localCollections.length}
                </span>
              </button>
            </div>

            {/* SECTION 5: SAO LƯU & BACKUP */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                SAO LƯU & BACKUP
              </div>

              <button
                id="admin-sidebar-tab-backup"
                onClick={() => handleSwitchTab('backup')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'backup'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Sao Lưu & Dữ Liệu</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 font-black">v2.0</span>
              </button>

              <button
                id="admin-sidebar-tab-firebase"
                onClick={() => handleSwitchTab('firebase')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'firebase'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <span>Tài Khoản & Quota Firebase</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </button>
            </div>

          </nav>
        </div>

        {/* Bottom Profile & Exit Area */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2">
          
          {/* User Info Tile */}
          <div className="p-2.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0">
                AD
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">{siteContent?.brandName || 'NOT A KNOT Studio'}</div>
                <div className="text-[10px] text-amber-700 font-semibold">Quản trị viên tối cao</div>
              </div>
            </div>
          </div>

          {/* Quick Exit to Store Button */}
          <button
            id="admin-sidebar-btn-back-to-store"
            onClick={onBackToStore}
            className="w-full px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <span>← Về Cửa Hàng</span>
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Top Content Header Bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 shadow-xs">
          
          {/* Left: Mobile Drawer Trigger & Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold lg:hidden cursor-pointer"
              title="Mở menu quản trị"
            >
              Menu
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <span>Quản trị</span>
                <span>/</span>
                <span className="text-slate-700">{currentTabInfo.section}</span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                {currentTabInfo.title}
              </h1>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDesktopSidebarCollapsed((prev) => !prev)}
              className="hidden lg:flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
              title={desktopSidebarCollapsed ? 'Mở lại menu bên trái' : 'Thu gọn menu bên trái để mở rộng bảng'}
            >
              <span>{desktopSidebarCollapsed ? '» Mở Menu' : '« Thu Gọn Menu'}</span>
            </button>

            <button
              onClick={() => {
                showAdminToast('Đang làm mới dữ liệu từ Firestore...');
                handleFetchFromCloud();
                loadOrders();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center"
              title="Làm mới dữ liệu từ Firestore"
            >
              <span>Làm Mới</span>
            </button>
          </div>
        </header>

        {/* Cloud Sync Status Banner */}
        {cloudSyncMessage && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 text-amber-900 text-xs font-semibold flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2 w-full">
              <span>{cloudSyncMessage}</span>
            </div>
          </div>
        )}

        {/* Main Workspace Tabs Container (Full width for maximum table space) */}
        <main className="flex-grow w-full px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        
        {/* Fake Loading Delay Indicator for Smooth Tab Switching */}
        {isTabLoading && (
          <div className="py-20 flex flex-col items-center justify-center space-y-4 animate-fadeIn">
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-slate-800">Đang tải phân hệ quản trị...</p>
              <p className="text-xs text-slate-500">Đang đồng bộ hóa dữ liệu thời gian thực</p>
            </div>
          </div>
        )}

        {!isTabLoading && (
          <>
        {/* ======================================================== */}
        {/* TAB 0: SITE EDITOR (VISUAL & CONTENT BUILDER) */}
        {/* ======================================================== */}
        {activeTab === 'site_editor' && (
          <AdminSiteEditor
            initialConfig={siteContent}
            onSaveConfig={(newCfg) => {
              if (onUpdateSiteContent) {
                onUpdateSiteContent(newCfg);
              }
              showAdminToast('Đã lưu và cập nhật cấu hình nội dung website thành công!');
            }}
            onPreviewWebsite={onBackToStore}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 1: SẢN PHẨM & TỒN KHO */}
        {/* ======================================================== */}
        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 block font-medium">Tổng Sản Phẩm</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-slate-900">{products.length}</span>
                  <span className="text-xs text-slate-500">mẫu</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 block font-medium">Đang Còn Hàng</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-emerald-600">{inStockCount}</span>
                  <span className="text-xs text-emerald-700">sẵn sàng</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 block font-medium">Tạm Hết Hàng (Stock 0)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-rose-600">{outOfStockCount}</span>
                  <span className="text-xs text-rose-700">cần đan thêm</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 block font-medium">Tổng Doanh Số Đơn</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl sm:text-2xl font-black text-amber-600">
                    {totalRevenue.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
            </div>

            {/* Product Control Action Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  id="admin-add-product-btn"
                  onClick={handleOpenAddForm}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm"
                >
                  <span>+ Thêm Sản Phẩm Mới</span>
                </button>

                <button
                  onClick={() => handleSwitchTab('categories')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                >
                  <span>Sửa Danh Mục BST</span>
                </button>

                <button
                  onClick={handlePushAllToCloud}
                  disabled={isCloudSyncing}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                  title="Tải toàn bộ sản phẩm lên Firebase Firestore"
                >
                  <span>Đồng Bộ Lên Cloud</span>
                </button>

                <button
                  onClick={handleFetchFromCloud}
                  disabled={isCloudSyncing}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                  title="Tải sản phẩm từ Firebase Firestore về máy"
                >
                  <span>Kéo Từ Cloud</span>
                </button>

                <button
                  onClick={handleExportProductsJSON}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                  title="Xuất file JSON sao lưu"
                >
                  <span>Sao Lưu JSON</span>
                </button>

                <button
                  onClick={handleResetDefaults}
                  className="px-3 py-2 text-slate-500 hover:text-rose-600 text-xs font-medium transition-colors"
                  title="Khôi phục danh sách gốc"
                >
                  Khôi phục gốc
                </button>
              </div>

              {/* Search & Dynamic Category Filter */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-grow sm:flex-grow-0">
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Tìm tên, mã sản phẩm..."
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white w-full sm:w-56"
                  />
                </div>

                <select
                  value={adminCategoryFilter}
                  onChange={(e) => setAdminCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                >
                  <option value="all">Tất cả BST ({products.length})</option>
                  {localCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label} ({products.filter((p) => p.category === cat.id).length})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add / Edit Form Modal/Drawer Area */}
            {isAddingNew && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-amber-400 shadow-xl space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-black text-lg text-slate-900">
                      {editingProduct ? `Chỉnh Sửa Sản Phẩm #${editingProduct.id}` : 'Thêm Sản Phẩm Mới Vào Hệ Thống'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Thông tin sẽ tự động đồng bộ lên Firebase Firestore và cập nhật ngay vào cửa hàng.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setIsAddingNew(false);
                      setEditingProduct(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Hủy Bỏ
                  </button>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Core Product Info */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Tên sản phẩm *
                        </label>
                        <input
                          type="text"
                          required
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="Ví dụ: Vòng Tay Paracord 02.09 Hào Khí Non Sông"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </div>

                      {/* FIXED PRICE INPUTS: Resilient, no browser HTML5 step error */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Giá bán (VNĐ) *
                          </label>
                          <input
                            type="text"
                            required
                            value={formPriceInput}
                            onChange={(e) => setFormPriceInput(e.target.value)}
                            placeholder="150000"
                            className="w-full px-3.5 py-2.5 bg-amber-50/50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                          />
                          <span className="text-[10px] text-amber-700 block mt-1 font-mono font-medium">
                            → {formatCurrency(parsePrice(formPriceInput))}
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Giá gốc niêm yết
                          </label>
                          <input
                            type="text"
                            value={formOriginalPriceInput}
                            onChange={(e) => setFormOriginalPriceInput(e.target.value)}
                            placeholder="220000"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white"
                          />
                          {formOriginalPriceInput && (
                            <span className="text-[10px] text-slate-400 block mt-1 line-through font-mono">
                              → {formatCurrency(parsePrice(formOriginalPriceInput))}
                            </span>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-amber-800 mb-1.5">
                            Số lượng tồn kho *
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={formStock}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setFormStock(val);
                              setFormInStock(val > 0);
                            }}
                            className="w-full px-3.5 py-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs font-black text-amber-900 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Dynamic Category Selector & Inline Manager */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-bold text-slate-700">
                              Bộ sưu tập / Phân loại *
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingNew(false);
                                handleSwitchTab('categories');
                              }}
                              className="text-[10px] text-amber-700 hover:underline font-bold"
                            >
                              Sửa BST
                            </button>
                          </div>
                          <select
                            value={formCategory}
                            onChange={(e) => setFormCategory(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                          >
                            {localCategories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Huy hiệu giảm giá / Tag
                          </label>
                          <input
                            type="text"
                            value={formDiscountBadge}
                            onChange={(e) => setFormDiscountBadge(e.target.value)}
                            placeholder="Ví dụ: -20% hoặc Pre-order"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Mô tả ngắn sản phẩm
                        </label>
                        <textarea
                          rows={3}
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          placeholder="Mô tả phong cách, ý nghĩa và chất liệu..."
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Right Column: Specs, Image */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Đặc điểm chế tác (mỗi dòng 1 đặc điểm)
                        </label>
                        <textarea
                          rows={3}
                          value={formDetailsText}
                          onChange={(e) => setFormDetailsText(e.target.value)}
                          placeholder="Dây Paracord 550 Type III 7 lõi&#10;Khóa kim loại titan chống gỉ"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white font-mono text-[11px]"
                        />
                      </div>

                      {/* Image Upload & Reorder Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-xs font-bold text-slate-800">
                              Hình ảnh sản phẩm & Thứ tự hiển thị *
                            </label>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Ảnh đầu tiên (#1) là <span className="font-bold text-amber-700">ảnh mặc định</span>. Có thể tải nhiều ảnh hoặc nhập link và sắp xếp thứ tự.
                            </p>
                          </div>
                          {formImages.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormImages([]);
                                setFormImage('');
                              }}
                              className="text-[11px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                            >
                              Xóa tất cả ({formImages.length} ảnh)
                            </button>
                          )}
                        </div>

                        {/* Images list with reordering */}
                        {formImages.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                            {formImages.map((imgSrc, idx) => (
                              <div
                                key={idx}
                                className={`relative rounded-xl overflow-hidden border p-1.5 transition-all ${
                                  idx === 0
                                    ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-400/40'
                                    : 'bg-white border-slate-200'
                                }`}
                              >
                                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-100">
                                  <img
                                    src={imgSrc}
                                    alt={`Ảnh ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute top-1.5 left-1.5">
                                    {idx === 0 ? (
                                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-500 text-slate-950 shadow-xs">
                                        ★ Mặc định (#1)
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900/80 text-white">
                                        #{idx + 1}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Reorder & Action buttons */}
                                <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-slate-100">
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleMoveImage(idx, idx - 1)}
                                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-[10px] text-slate-700 font-bold"
                                      title="Dời lên trước"
                                    >
                                      ←
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === formImages.length - 1}
                                      onClick={() => handleMoveImage(idx, idx + 1)}
                                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-[10px] text-slate-700 font-bold"
                                      title="Dời xuống sau"
                                    >
                                      →
                                    </button>
                                  </div>

                                  {idx !== 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetDefaultImage(idx)}
                                      className="text-[10px] font-bold text-amber-800 hover:underline px-1"
                                      title="Đặt ảnh này làm ảnh mặc định"
                                    >
                                      Làm ảnh chính
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveImage(idx)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded text-[10px] font-bold"
                                    title="Xóa ảnh này"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add image by URL or file */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newImageUrlInput}
                            onChange={(e) => setNewImageUrlInput(e.target.value)}
                            placeholder="Hoặc dán URL ảnh trực tiếp (https://...)"
                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                          />
                          <button
                            type="button"
                            onClick={handleAddImageUrl}
                            disabled={!newImageUrlInput.trim()}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 rounded-xl text-xs font-bold shrink-0 transition-colors"
                          >
                            + Thêm Link
                          </button>
                        </div>

                        {/* Drag and Drop Zone for multiple files */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsImageDragging(true);
                          }}
                          onDragLeave={() => setIsImageDragging(false)}
                          onDrop={handleImageDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 ${
                            isImageDragging
                              ? 'border-amber-500 bg-amber-50/80 scale-[1.01]'
                              : 'border-slate-300 bg-slate-50/70 hover:border-amber-400 hover:bg-amber-50/30'
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                          <div className="py-2 space-y-1">
                            <div className="text-xs font-bold text-slate-800">
                              + Tải thêm ảnh từ máy tính (Có thể chọn nhiều ảnh cùng lúc)
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Kéo thả file ảnh hoặc <span className="text-amber-700 font-bold underline">nhấp vào đây</span> (PNG, JPG, WEBP)
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Badges and check flags */}
                      <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formIsEvent0209}
                            onChange={(e) => setFormIsEvent0209(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Bộ Sưu Tập Quốc Khánh 02.09</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formIsBestSeller}
                            onChange={(e) => setFormIsBestSeller(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Gắn nhãn Best Seller</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formIsNew}
                            onChange={(e) => setFormIsNew(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Gắn nhãn Mới</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Form Submit Button */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNew(false);
                        setEditingProduct(null);
                      }}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                    >
                      Hủy
                    </button>

                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md flex items-center gap-2"
                    >
                      <span>{editingProduct ? 'Lưu Thay Đổi Sản Phẩm' : 'Tạo Sản Phẩm Mới'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Products Table */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-4">Sản phẩm</th>
                      <th className="p-4">Danh mục / BST</th>
                      <th className="p-4">Giá bán</th>
                      <th className="p-4">Tồn kho</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-400">
                          Không tìm thấy sản phẩm nào phù hợp bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const stockCount = p.stock ?? 15;
                        const isAvailable = p.inStock !== false && stockCount > 0;
                        const catObj = localCategories.find((c) => c.id === p.category);

                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 flex items-center gap-3">
                              <img
                                src={p.image}
                                alt={p.name}
                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block truncate">{p.name}</span>
                                <span className="text-[10px] text-slate-400 block font-mono">ID: {p.id}</span>
                                <div className="flex gap-1 mt-1">
                                  {p.isEvent0209 && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-700 border border-red-200">
                                      02.09
                                    </span>
                                  )}
                                  {p.isBestSeller && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                      HOT
                                    </span>
                                  )}
                                  {p.discountBadge && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      {p.discountBadge}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                                {catObj?.label || p.category}
                              </span>
                            </td>

                            <td className="p-4 whitespace-nowrap">
                              <span className="font-bold text-amber-700 block">
                                {p.price.toLocaleString('vi-VN')}đ
                              </span>
                              {p.originalPrice && (
                                <span className="text-[10px] text-slate-400 line-through block">
                                  {p.originalPrice.toLocaleString('vi-VN')}đ
                                </span>
                              )}
                            </td>

                            <td className="p-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleQuickAdjustStock(p, -1)}
                                  className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors"
                                  title="Giảm 1 cái"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center font-bold text-slate-900">{stockCount}</span>
                                <button
                                  onClick={() => handleQuickAdjustStock(p, +1)}
                                  className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors"
                                  title="Tăng 1 cái"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            <td className="p-4 whitespace-nowrap">
                              <button
                                onClick={() => handleToggleStock(p)}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                                  isAvailable
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                }`}
                              >
                                {isAvailable ? 'Còn Hàng' : 'Hết Hàng'}
                              </button>
                            </td>

                            <td className="p-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenEditForm(p)}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 text-amber-700 hover:border-amber-300 rounded-lg text-xs font-semibold transition-colors border border-slate-200"
                                  title="Chỉnh sửa sản phẩm"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(p.id, p.name)}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 hover:border-rose-300 rounded-lg text-xs font-semibold transition-colors border border-slate-200"
                                  title="Xóa sản phẩm"
                                >
                                  Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: QUẢN LÝ DANH MỤC / BỘ SƯU TẬP (NEW FEATURE) */}
        {/* ======================================================== */}
        {activeTab === 'categories' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header & Actions */}
            <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 p-6 rounded-3xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-200/80 text-amber-900 text-xs font-bold uppercase tracking-wider mb-2 border border-amber-300">
                  <span>Quản Lý Phân Loại & Bộ Sưu Tập</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Danh Mục Sản Phẩm ({localCategories.length})
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-xl">
                  Thêm, sửa tên, đổi màu nhận diện, và cập nhật mô tả các Bộ sưu tập Paracord. Các thay đổi sẽ cập nhật tức thì trên toàn bộ Cửa Hàng và Bộ Lọc.
                </p>
              </div>

              <button
                onClick={handleOpenAddCategory}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm self-start sm:self-auto"
              >
                <span>+ Thêm Danh Mục Mới</span>
              </button>
            </div>

            {/* Category Add/Edit Modal/Drawer */}
            {isAddingCategory && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-amber-400 shadow-xl space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="text-base font-bold text-slate-900">
                    <span>{editingCategory ? `Chỉnh Sửa Danh Mục: ${editingCategory.label}` : 'Thêm Danh Mục / BST Mới'}</span>
                  </h4>
                  <button
                    onClick={() => {
                      setIsAddingCategory(false);
                      setEditingCategory(null);
                    }}
                    className="px-2.5 py-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 text-xs font-bold"
                  >
                    Đóng
                  </button>
                </div>

                <form onSubmit={handleSaveCategory} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Mã danh mục *
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!!editingCategory}
                        value={catFormId}
                        onChange={(e) => setCatFormId(e.target.value)}
                        placeholder="Ví dụ: tactical_gear, summer_2026..."
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tên hiển thị danh mục *
                      </label>
                      <input
                        type="text"
                        required
                        value={catFormLabel}
                        onChange={(e) => setCatFormLabel(e.target.value)}
                        placeholder="Ví dụ: BST Tactical Chiến Thuật, Vòng Dạ Quang..."
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Màu chủ đạo / Badge màu
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={catFormColor}
                          onChange={(e) => setCatFormColor(e.target.value)}
                          className="w-10 h-8 rounded-lg bg-transparent cursor-pointer border border-slate-200"
                        />
                        <input
                          type="text"
                          value={catFormColor}
                          onChange={(e) => setCatFormColor(e.target.value)}
                          className="w-full px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Huy hiệu nổi bật
                      </label>
                      <input
                        type="text"
                        value={catFormBadge}
                        onChange={(e) => setCatFormBadge(e.target.value)}
                        placeholder="Ví dụ: 02.09, HOT, EDC, NEW..."
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mô tả ngắn về ý nghĩa / phong cách
                    </label>
                    <textarea
                      rows={2}
                      value={catFormDescription}
                      onChange={(e) => setCatFormDescription(e.target.value)}
                      placeholder="Mô tả phong cách đan, chất liệu và nguồn cảm hứng..."
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCategory(false);
                        setEditingCategory(null);
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-sm"
                    >
                      {editingCategory ? 'Lưu Thay Đổi' : 'Thêm Danh Mục'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Categories Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localCategories.map((cat) => {
                const productCount = products.filter((p) => p.category === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-amber-300 shadow-xs hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-4 h-4 rounded-full border border-slate-300 shadow-xs"
                          style={{ backgroundColor: cat.highlightColor || '#B41C1A' }}
                        />
                        <span className="font-bold text-sm text-slate-900">{cat.label}</span>
                      </div>

                      {cat.badge && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                          {cat.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {cat.description || 'Chưa có mô tả cho danh mục này.'}
                    </p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">
                        {productCount} sản phẩm
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditCategory(cat)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-amber-50 text-amber-800 hover:border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-slate-200"
                        >
                          <span>Sửa</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id, cat.label)}
                          className="px-2.5 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-xs font-bold"
                          title="Xóa danh mục"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: DASHBOARD & REVENUE METRICS */}
        {/* ======================================================== */}
        {activeTab === 'dashboard' && (
          <AdminDashboard
            orders={orders}
            products={products}
            categories={localCategories}
            onNavigateToOrders={() => handleSwitchTab('orders')}
            onNavigateToManualOrder={() => handleSwitchTab('manual_order')}
          />
        )}

        {/* ======================================================== */}
        {/* TAB: INTERNAL ANALYTICS & GA4 DASHBOARD */}
        {/* ======================================================== */}
        {activeTab === 'analytics' && (
          <AdminAnalyticsDashboard
            products={products}
            orders={orders}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 2: NHẬP ĐƠN THỦ CÔNG */}
        {/* ======================================================== */}
        {activeTab === 'manual_order' && (
          <AdminManualOrderForm
            products={products}
            onUpdateProducts={onUpdateProducts}
            onOrderCreated={(newOrd) => {
              setOrders([newOrd, ...orders]);
            }}
            onNavigateToOrders={() => handleSwitchTab('orders')}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 3: QUẢN LÝ ĐƠN HÀNG & THANH TOÁN */}
        {/* ======================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Quick Status Funnel Bar & Top "Tạo Đơn" Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
                {[
                  { id: 'all', label: 'Tất cả đơn', count: orders.length },
                  { id: 'Đã đặt', label: 'Đã đặt', count: orders.filter((o) => getNormalizedStatus(o.status) === 'Đã đặt').length },
                  { id: 'Đã thanh toán', label: 'Đã thanh toán', count: orders.filter((o) => getNormalizedStatus(o.status) === 'Đã thanh toán').length },
                  { id: 'Đã giao', label: 'Đã giao', count: orders.filter((o) => getNormalizedStatus(o.status) === 'Đã giao').length }
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setOrderStatusFilter(st.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                      orderStatusFilter === st.id
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{st.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${orderStatusFilter === st.id ? 'bg-black/15 text-slate-950 font-black' : 'bg-slate-100 text-slate-500'}`}>
                      {st.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Right Button: "Tạo Đơn" */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitchTab('manual_order')}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  <span>+ Tạo đơn</span>
                </button>
              </div>
            </div>

            {/* Filter & Controls Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200">
                  {filteredOrders.length} / {orders.length} đơn hàng
                </span>

                {/* Prominent Selection Mode Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectionMode((prev) => {
                      const next = !prev;
                      showAdminToast(
                        next
                          ? 'Đã bật chế độ chọn nhiều đơn hàng: Bạn có thể chọn hoặc bỏ chọn từng đơn bằng cách bấm trực tiếp vào hàng.'
                          : 'Đã tắt chế độ chọn nhiều đơn hàng.'
                      );
                      return next;
                    });
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
                    isSelectionMode
                      ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500 font-extrabold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                  }`}
                  title="Bật hoặc tắt chế độ chọn nhiều để tích chọn nhanh các hàng"
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${isSelectionMode ? 'bg-slate-950 animate-pulse' : 'bg-slate-400'}`} />
                  <span>{isSelectionMode ? '✓ Đang chọn nhiều đơn' : '☑ Chọn nhiều đơn hàng'}</span>
                </button>

                <button
                  onClick={handleExportOrdersExcel}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-200 cursor-pointer shadow-2xs"
                  title="Xuất danh sách đơn hàng sang bảng tính Excel .xlsx"
                >
                  <span>📊 Xuất File Excel (.xlsx)</span>
                </button>

                {tableZoom !== 100 && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold">
                    Thu phóng: {tableZoom}%
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Box */}
                <div className="relative flex-grow sm:flex-grow-0">
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="Tìm tên, SĐT, mã đơn, bill, note..."
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white w-full sm:w-56"
                  />
                </div>

                {/* Source Filter */}
                <select
                  value={orderSourceFilter}
                  onChange={(e: any) => setOrderSourceFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                >
                  <option value="all">Tất cả nguồn đơn</option>
                  <option value="website">Website</option>
                  <option value="mạng xã hội">Mạng xã hội</option>
                  <option value="trực tiếp">Trực tiếp</option>
                </select>

                {/* Payment Status Filter */}
                <select
                  value={orderPaymentStatusFilter}
                  onChange={(e: any) => setOrderPaymentStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                >
                  <option value="all">Tất cả thanh toán</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="unpaid">Chưa thanh toán</option>
                </select>

                {/* Has Receipt Filter */}
                <select
                  value={orderHasReceiptFilter}
                  onChange={(e: any) => setOrderHasReceiptFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                >
                  <option value="all">Bill chuyển khoản: Tất cả</option>
                  <option value="has_receipt">Có ảnh Bill CK</option>
                  <option value="no_receipt">Chưa có ảnh Bill</option>
                </select>
              </div>
            </div>

            {/* Bulk Selection Bar (Shows when 1 or more rows selected via Multiple Selection) */}
            {selectedOrderIds.length > 0 && (
              <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center">
                    {selectedOrderIds.length}
                  </span>
                  <span className="text-xs font-bold">
                    Đã chọn {selectedOrderIds.length} / {filteredOrders.length} đơn hàng
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateStatus('Đã thanh toán')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Đánh dấu Đã thanh toán
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateStatus('Đã giao')}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Đánh dấu Đã giao
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Xóa {selectedOrderIds.length} đơn đã chọn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds([])}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>
            )}

            {/* Orders Table - Excel Style with Zoom & Frozen 4 Columns */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs relative">
              <div
                className="overflow-x-auto min-h-[400px] transition-all"
                style={{ zoom: `${tableZoom}%` }}
              >
                <table className="w-full text-left text-xs text-slate-800 border-separate border-spacing-0 min-w-[1350px]">
                  <thead className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      {/* Col 0: Checkbox Header (Sticky 0) */}
                      <th className="p-3 sticky left-0 z-30 w-[42px] min-w-[42px] max-w-[42px] bg-slate-100 border-r border-b border-slate-300 text-center">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả đơn hàng"
                          checked={filteredOrders.length > 0 && filteredOrders.every((o) => o.id && selectedOrderIds.includes(o.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrderIds(filteredOrders.map((o) => o.id!).filter(Boolean));
                            } else {
                              setSelectedOrderIds([]);
                            }
                          }}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300 cursor-pointer"
                          title="Chọn / Bỏ chọn tất cả đơn hàng đang hiển thị"
                        />
                      </th>

                      {/* Col 1: STT (Sticky 1) */}
                      <th className="p-3 sticky left-[42px] z-30 w-[48px] min-w-[48px] max-w-[48px] bg-slate-100 border-r border-b border-slate-300 text-center font-bold">
                        STT
                      </th>

                      {/* Col 2: Ngày đặt (Sticky 2) */}
                      <th className="p-3 sticky left-[90px] z-30 w-[130px] min-w-[130px] max-w-[130px] bg-slate-100 border-r border-b border-slate-300 whitespace-nowrap overflow-hidden">
                        Ngày đặt
                      </th>

                      {/* Col 3: Tên KH (Sticky 3) */}
                      <th className="p-3 sticky left-[220px] z-30 w-[150px] min-w-[150px] max-w-[150px] bg-slate-100 border-r border-b border-slate-300 whitespace-nowrap overflow-hidden">
                        Tên khách hàng
                      </th>

                      {/* Col 4: SĐT (Sticky 4) */}
                      <th className="p-3 sticky left-[370px] z-30 w-[120px] min-w-[120px] max-w-[120px] bg-slate-100 border-r-2 border-b border-slate-300 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap overflow-hidden">
                        SĐT
                      </th>

                      {/* Col 5: Địa chỉ */}
                      <th className="p-3 min-w-[180px] max-w-[240px] border-r border-b border-slate-300 bg-slate-100">Địa chỉ</th>

                      {/* Col 6: Sản phẩm đặt */}
                      <th className="p-3 min-w-[200px] max-w-sm border-r border-b border-slate-300 bg-slate-100">Sản phẩm</th>

                      {/* Col 7: SL */}
                      <th className="p-3 w-12 min-w-[48px] text-center border-r border-b border-slate-300 bg-slate-100">SL</th>

                      {/* Col 8: Tổng tiền */}
                      <th className="p-3 min-w-[120px] whitespace-nowrap text-right border-r border-b border-slate-300 bg-slate-100">Tổng tiền</th>

                      {/* Col 9: Trạng thái */}
                      <th className="p-3 min-w-[135px] whitespace-nowrap border-r border-b border-slate-300 bg-slate-100">Trạng thái</th>

                      {/* Col 10: Bill */}
                      <th className="p-3 w-20 min-w-[80px] text-center whitespace-nowrap border-r border-b border-slate-300 bg-slate-100">Bill</th>

                      {/* Col 11: Note */}
                      <th className="p-3 min-w-[140px] max-w-xs border-b border-slate-300 bg-slate-100">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingOrders ? (
                      <tr>
                        <td colSpan={12} className="p-12 text-center text-slate-500 border-b border-slate-200">
                          <span>Đang tải danh sách đơn hàng từ cơ sở dữ liệu...</span>
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-12 text-center text-slate-400 border-b border-slate-200">
                          Chưa có đơn hàng nào phù hợp bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord, index) => {
                        const isSelected = ord.id ? selectedOrderIds.includes(ord.id) : false;
                        const currentStatus = getNormalizedStatus(ord.status);
                        const currentPayment = getNormalizedPayment(ord.paymentStatus, ord.status);
                        const currentSource = getNormalizedSource(ord.source);
                        const totalQty = ord.itemDetails && ord.itemDetails.length > 0
                          ? ord.itemDetails.reduce((sum, it) => sum + (it.quantity || 1), 0)
                          : (ord.items || []).length || 1;

                        const rowBgClass = isSelected
                          ? 'bg-sky-100'
                          : index % 2 === 1
                          ? 'bg-slate-50'
                          : 'bg-white';

                        return (
                          <tr
                            key={ord.id || index}
                            onClick={() => {
                              if (isSelectionMode && ord.id) {
                                toggleSelectOrder(ord.id);
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const pos = getClampedContextMenuPos(e.clientX, e.clientY);
                              setContextMenuPos(pos);
                              setOrderContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                order: ord
                              });
                            }}
                            className={`group transition-colors ${
                              isSelectionMode ? 'cursor-pointer' : 'cursor-default'
                            } ${
                              isSelected
                                ? 'bg-sky-100/70 font-medium'
                                : index % 2 === 1
                                ? 'bg-slate-50/60 hover:bg-amber-50/50'
                                : 'bg-white hover:bg-amber-50/50'
                            }`}
                          >
                            {/* Col 0: Checkbox Cell (Sticky 0) */}
                            <td
                              className={`p-3 sticky left-0 z-20 w-[42px] min-w-[42px] max-w-[42px] border-r border-b border-slate-300 text-center ${rowBgClass}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (ord.id) toggleSelectOrder(ord.id);
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (ord.id) toggleSelectOrder(ord.id);
                                }}
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300 cursor-pointer"
                              />
                            </td>

                            {/* Col 1: STT (Sticky 1) */}
                            <td className={`p-3 sticky left-[42px] z-20 w-[48px] min-w-[48px] max-w-[48px] border-r border-b border-slate-300 text-center font-bold text-slate-700 ${rowBgClass}`}>
                              <span className="text-xs font-mono">{index + 1}</span>
                            </td>

                            {/* Col 2: Ngày đặt (Sticky 2) */}
                            <td className={`p-3 sticky left-[90px] z-20 w-[130px] min-w-[130px] max-w-[130px] border-r border-b border-slate-300 whitespace-nowrap overflow-hidden ${rowBgClass}`}>
                              <span className="font-semibold text-slate-900 block text-xs truncate">
                                {ord.date || ord.createdAt || 'N/A'}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  #{ord.id?.slice(-6) || 'ORD'}
                                </span>
                                {currentSource === 'website' && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Web
                                  </span>
                                )}
                                {currentSource === 'mạng xã hội' && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    MXH
                                  </span>
                                )}
                                {currentSource === 'trực tiếp' && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    Trực tiếp
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Col 3: Tên KH (Sticky 3) */}
                            <td className={`p-3 sticky left-[220px] z-20 w-[150px] min-w-[150px] max-w-[150px] border-r border-b border-slate-300 whitespace-nowrap overflow-hidden ${rowBgClass}`}>
                              <span className="font-bold text-slate-900 block text-xs truncate" title={ord.name || ord.customerName}>
                                {ord.name || ord.customerName || 'Khách vãng lai'}
                              </span>
                            </td>

                            {/* Col 4: SĐT (Sticky 4) */}
                            <td className={`p-3 sticky left-[370px] z-20 w-[120px] min-w-[120px] max-w-[120px] border-r-2 border-b border-slate-300 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap overflow-hidden ${rowBgClass}`}>
                              {ord.phone ? (
                                <span className="text-amber-800 font-bold text-xs block font-mono truncate">
                                  {ord.phone}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs italic">-</span>
                              )}
                            </td>

                            {/* Col 5: Địa chỉ */}
                            <td className="p-3 max-w-[240px] border-r border-b border-slate-200">
                              <p className="text-slate-700 text-xs line-clamp-2 leading-relaxed" title={ord.address}>
                                {ord.address || 'Tại xưởng / Thoả thuận'}
                              </p>
                            </td>

                            {/* Col 6: Sản phẩm đặt */}
                            <td className="p-3 max-w-sm border-r border-b border-slate-200">
                              <div className="space-y-1">
                                {ord.itemDetails && ord.itemDetails.length > 0 ? (
                                  ord.itemDetails.map((it, idx) => (
                                    <div key={idx} className="text-xs text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded flex items-center justify-between gap-1">
                                      <span className="font-medium truncate text-slate-800">
                                        {it.productName}
                                      </span>
                                      <span className="font-bold text-slate-900 text-[11px] shrink-0">x{it.quantity}</span>
                                    </div>
                                  ))
                                ) : (
                                  (ord.items || []).map((it, idx) => (
                                    <div key={idx} className="text-xs text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                      {it}
                                    </div>
                                  ))
                                )}
                              </div>
                            </td>

                            {/* Col 7: SL (Số lượng) */}
                            <td className="p-3 w-12 min-w-[48px] text-center font-bold text-slate-800 text-xs border-r border-b border-slate-200">
                              {totalQty}
                            </td>

                            {/* Col 8: Tổng tiền */}
                            <td className="p-3 whitespace-nowrap text-right border-r border-b border-slate-200">
                              <span className="font-bold text-amber-800 text-xs block">
                                {(ord.totalPrice || ord.totalAmount || 0).toLocaleString('vi-VN')}đ
                              </span>
                              <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold mt-0.5 ${
                                currentPayment === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {currentPayment === 'paid' ? 'Đã TT' : 'Chưa TT'}
                              </span>
                            </td>

                            {/* Col 9: Trạng thái */}
                            <td className="p-3 whitespace-nowrap border-r border-b border-slate-200">
                              <select
                                value={currentStatus}
                                onChange={(e) => handleUpdateOrderStatus(ord.id!, e.target.value)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold focus:outline-none cursor-pointer border transition-colors ${
                                  currentStatus === 'Đã thanh toán'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : currentStatus === 'Đã giao'
                                    ? 'bg-sky-50 text-sky-800 border-sky-300'
                                    : 'bg-amber-50 text-amber-900 border-amber-300'
                                }`}
                              >
                                <option value="Đã đặt">Đã đặt</option>
                                <option value="Đã thanh toán">Đã thanh toán</option>
                                <option value="Đã giao">Đã giao</option>
                              </select>
                            </td>

                            {/* Col 10: Bill */}
                            <td className="p-3 w-20 min-w-[80px] text-center whitespace-nowrap border-r border-b border-slate-200">
                              {ord.bankReceiptImage ? (
                                <button
                                  type="button"
                                  onClick={() => setZoomReceiptImage(ord.bankReceiptImage!)}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-300 cursor-pointer"
                                  title="Xem ảnh Bill chuyển khoản"
                                >
                                  Xem Bill
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setReceiptPromptModal({ order: ord })}
                                  className="px-2 py-1 bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-900 rounded-lg text-[10px] font-semibold border border-slate-200 cursor-pointer"
                                  title="Nộp ảnh chuyển khoản"
                                >
                                  + Bill
                                </button>
                              )}
                            </td>

                            {/* Col 11: Note */}
                            <td className="p-3 max-w-xs border-b border-slate-200">
                              {ord.note ? (
                                <p className="text-xs text-slate-600 italic line-clamp-2" title={ord.note}>
                                  {ord.note}
                                </p>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right-click Context Menu (Portaled to document.body for 100% position accuracy) */}
            {orderContextMenu && typeof document !== 'undefined' && createPortal(
              <div
                ref={contextMenuRef}
                className="fixed z-[99999] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 py-1.5 w-56 animate-fadeIn text-xs divide-y divide-slate-100 select-none pointer-events-auto"
                style={{
                  top: `${contextMenuPos.top}px`,
                  left: `${contextMenuPos.left}px`
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-3.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-slate-900">
                  <span className="text-amber-700">Đơn #{orderContextMenu.order.id?.slice(-6)}</span>
                  <span className="text-slate-500 font-medium truncate max-w-[100px]">
                    {orderContextMenu.order.name || orderContextMenu.order.customerName}
                  </span>
                </div>

                {/* 1. Chi tiết (trong menu chi tiết có thể sửa và in) */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectingOrder(orderContextMenu.order);
                      setOrderContextMenu(null);
                    }}
                    className="w-full px-3.5 py-2 text-left font-bold text-slate-800 hover:bg-slate-50 hover:text-amber-700 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>Chi tiết</span>
                    <span className="text-[10px] text-slate-400 font-normal">Sửa & In</span>
                  </button>
                </div>

                {/* 2. Chọn nhiều */}
                <div className="py-1">
                  <div className="px-3.5 py-1 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                    Chọn nhiều
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const orderId = orderContextMenu.order.id;
                      if (orderId) {
                        if (selectedOrderIds.includes(orderId)) {
                          setSelectedOrderIds(selectedOrderIds.filter((id) => id !== orderId));
                        } else {
                          setSelectedOrderIds([...selectedOrderIds, orderId]);
                        }
                      }
                      setOrderContextMenu(null);
                    }}
                    className="w-full px-3.5 py-1.5 text-left font-semibold hover:bg-slate-50 text-amber-800 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>
                      {orderContextMenu.order.id && selectedOrderIds.includes(orderContextMenu.order.id)
                        ? '✓ Bỏ chọn dòng này'
                        : '+ Chọn dòng này'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderIds(filteredOrders.map((o) => o.id!).filter(Boolean));
                      setOrderContextMenu(null);
                    }}
                    className="w-full px-3.5 py-1.5 text-left font-medium hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                  >
                    Chọn tất cả ({filteredOrders.length} đơn)
                  </button>

                  {selectedOrderIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrderIds([]);
                        setOrderContextMenu(null);
                      }}
                      className="w-full px-3.5 py-1.5 text-left font-medium hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      Bỏ chọn tất cả ({selectedOrderIds.length})
                    </button>
                  )}
                </div>

                {/* 3. Thu phóng */}
                <div className="py-1.5 px-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                    <span>Thu phóng</span>
                    <span className="text-slate-700 font-mono font-bold">{tableZoom}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTableZoom((prev) => Math.max(70, prev - 10))}
                      className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-center text-sm font-black transition-colors cursor-pointer"
                      title="Thu nhỏ 10%"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableZoom(100)}
                      className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-center text-xs font-bold transition-colors cursor-pointer"
                      title="Đặt lại 100%"
                    >
                      100%
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableZoom((prev) => Math.min(150, prev + 10))}
                      className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-center text-sm font-black transition-colors cursor-pointer"
                      title="Phóng to 10%"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 4. Xóa */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const orderId = orderContextMenu.order.id;
                      setOrderContextMenu(null);
                      if (orderId) handleDeleteOrder(orderId);
                    }}
                    className="w-full px-3.5 py-2 text-left font-bold text-rose-600 hover:bg-rose-50 rounded-b-xl transition-colors cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              </div>,
              document.body
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: FIREBASE ACCOUNT & FREE QUOTA MONITOR */}
        {/* ======================================================== */}
        {activeTab === 'firebase' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Connected Account & Status Banner */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-lg font-black text-slate-900">
                    Tài Khoản & Quota Firebase Cloud
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {cloudConnected ? 'Đã Kết Nối Trực Tuyến' : 'Đang Kiểm Tra Kết Nối'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Tài khoản Google kết nối: <span className="font-bold text-slate-800 font-mono">nhunhuhao71@gmail.com</span> • Project ID: <span className="font-bold text-slate-800 font-mono">568259be-650e-436a-a9cc-8f8dfeee8687</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePushAllToCloud}
                  disabled={isCloudSyncing}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>{isCloudSyncing ? '⏳ Đang đồng bộ...' : '☁️ Đồng Bộ Dữ Liệu Lên Cloud'}</span>
                </button>
              </div>
            </div>

            {/* Quota Progress Cards (Daily Free Tier: 50k reads, 20k writes, 20k deletes, 1GB Storage) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Reads */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider">Lượt Đọc (Reads / ngày)</span>
                  <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
                    Còn {(50000 - (quotaStats.readsToday || 0)).toLocaleString('vi-VN')} lượt free
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">{quotaStats.readsToday || 0}</span>
                  <span className="text-xs text-slate-400 font-medium">/ 50,000 free mỗi ngày</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(1, ((quotaStats.readsToday || 0) / 50000) * 100))}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-400 block">Đã dùng {(((quotaStats.readsToday || 0) / 50000) * 100).toFixed(2)}% dung lượng đọc hôm nay</span>
              </div>

              {/* Writes */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider">Lượt Ghi (Writes / ngày)</span>
                  <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
                    Còn {(20000 - (quotaStats.writesToday || 0)).toLocaleString('vi-VN')} lượt free
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">{quotaStats.writesToday || 0}</span>
                  <span className="text-xs text-slate-400 font-medium">/ 20,000 free mỗi ngày</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(1, ((quotaStats.writesToday || 0) / 20000) * 100))}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-400 block">Đã dùng {(((quotaStats.writesToday || 0) / 20000) * 100).toFixed(2)}% dung lượng ghi hôm nay</span>
              </div>

              {/* Deletes */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider">Lượt Xóa (Deletes / ngày)</span>
                  <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
                    Còn {(20000 - (quotaStats.deletesToday || 0)).toLocaleString('vi-VN')} lượt free
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">{quotaStats.deletesToday || 0}</span>
                  <span className="text-xs text-slate-400 font-medium">/ 20,000 free mỗi ngày</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(1, ((quotaStats.deletesToday || 0) / 20000) * 100))}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-400 block">Đã dùng {(((quotaStats.deletesToday || 0) / 20000) * 100).toFixed(2)}% dung lượng xóa hôm nay</span>
              </div>
            </div>

            {/* Storage Quota Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Dung Lượng Bộ Nhớ Firestore</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">~1.4 MB</span>
                  <span className="text-xs text-slate-500">/ 1.0 GB Free vĩnh viễn (Còn lại 99.86% trống)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full w-[1.4%]" />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Băng Thông Truyền Tải Mạng</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">~12.8 MB</span>
                  <span className="text-xs text-slate-500">/ 10.0 GB Free mỗi tháng (Còn lại 99.87% trống)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full w-[1.2%]" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: BACKUP & RESTORE */}
        {/* ======================================================== */}
        {activeTab === 'backup' && (
          <AdminBackupManager
            orders={orders}
            products={products}
            categories={localCategories}
            collections={localCollections}
            siteContent={siteContent}
            onUpdateOrders={(newOrders) => {
              setOrders(newOrders);
              showAdminToast('Đã phục hồi danh sách đơn hàng thành công.');
            }}
            onUpdateProducts={onUpdateProducts}
            onUpdateCategories={handleUpdateCategoriesInternal}
            onUpdateCollections={handleUpdateCollectionsInternal}
            onUpdateSiteContent={(newConfig) => {
              if (onUpdateSiteContent) onUpdateSiteContent(newConfig);
              showAdminToast('Đã phục hồi cấu hình giao diện & thông tin web thành công.');
            }}
            onNotify={showAdminToast}
          />
        )}

        {/* ======================================================== */}
        {/* TAB: BANNERS & APPLE SHOWCASE MANAGER */}
        {/* ======================================================== */}
        {activeTab === 'banners' && (
          <AdminBannersManager
            collections={localCollections}
            categories={localCategories}
            onUpdateCollections={handleUpdateCollectionsInternal}
          />
        )}

        {/* ======================================================== */}
        {/* TAB: CUSTOMER CONTACT MESSAGES */}
        {/* ======================================================== */}
        {activeTab === 'messages' && (
          <AdminMessagesManager
            onNotify={showAdminToast}
            onUpdateUnreadCount={(cnt) => setUnreadMessagesCount(cnt)}
          />
        )}

          </>
        )}

      </main>

      {/* ======================================================== */}
      {/* MODAL: ORDER DETAILS & PACKING SLIP */}
      {/* ======================================================== */}
      {inspectingOrder && (
        <AdminOrderDetailsModal
          order={inspectingOrder}
          onClose={() => setInspectingOrder(null)}
          onUpdateStatus={(orderId, status) => {
            handleUpdateOrderStatus(orderId, status);
            setInspectingOrder((prev) => prev ? { ...prev, status } : null);
          }}
          onZoomReceipt={(img) => setZoomReceiptImage(img)}
          onEdit={(ord) => setEditingOrder(ord)}
        />
      )}

      {/* ======================================================== */}
      {/* LIGHTBOX: ZOOM BILL RECEIPT IMAGE */}
      {/* ======================================================== */}
      {zoomReceiptImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setZoomReceiptImage(null)}
        >
          <div
            className="relative max-w-xl w-full bg-white p-4 rounded-3xl border border-slate-200 shadow-2xl space-y-3 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-xs text-emerald-700">
                Ảnh Chụp Bill Chuyển Khoản Ngân Hàng
              </span>
              <button
                type="button"
                onClick={() => setZoomReceiptImage(null)}
                className="px-2 py-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 text-xs font-bold"
              >
                Đóng [X]
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-50 rounded-2xl p-2 border border-slate-100">
              <img
                src={zoomReceiptImage}
                alt="Bill chuyển khoản phóng to"
                className="max-h-[70vh] w-auto rounded-xl object-contain shadow-md"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setZoomReceiptImage(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT ORDER DIALOG */}
      {/* ======================================================== */}
      {editingOrder && (
        <AdminEditOrderModal
          order={editingOrder}
          products={products}
          allProducts={products}
          onClose={() => setEditingOrder(null)}
          onSave={handleSaveEditedOrder}
          onSaved={handleSaveEditedOrder}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL: RECEIPT PROMPT & UPLOAD (FOR BANK TRANSFER) */}
      {/* ======================================================== */}
      {receiptPromptModal && (
        <AdminReceiptUploadModal
          order={receiptPromptModal.order}
          isPromptOnPaid={receiptPromptModal.isPromptOnPaid}
          onClose={() => setReceiptPromptModal(null)}
          onSaved={(updatedOrder) => {
            handleSaveEditedOrder(updatedOrder);
            setReceiptPromptModal(null);
          }}
          onSave={(updatedOrder) => {
            handleSaveEditedOrder(updatedOrder);
            setReceiptPromptModal(null);
          }}
          onSaveReceipt={handleSaveReceipt}
          onSkip={() => {
            if (receiptPromptModal.isPromptOnPaid) {
              handleUpdateOrderStatus(receiptPromptModal.order.id!, 'Đã thanh toán', true);
            }
            setReceiptPromptModal(null);
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL: DELETE CONFIRMATION DIALOG (Works in all iframe/browser environments) */}
      {/* ======================================================== */}
      {deleteConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmModal(null)}
        >
          <div
            className="relative max-w-md w-full bg-white p-6 rounded-3xl border border-rose-200 shadow-2xl space-y-4 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div>
                <h3 className="font-bold text-base text-slate-900">{deleteConfirmModal.title}</h3>
                <p className="text-xs text-slate-500">Hành động cần xác nhận</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
              <p className="text-sm font-semibold text-slate-800">{deleteConfirmModal.message}</p>
              {deleteConfirmModal.submessage && (
                <p className="text-xs text-slate-500 leading-relaxed">
                  {deleteConfirmModal.submessage}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => deleteConfirmModal.onConfirm()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-rose-600/20 cursor-pointer"
              >
                <span>{deleteConfirmModal.confirmLabel || 'Xác nhận xóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TOAST: ADMIN NOTIFICATION BANNER */}
      {/* ======================================================== */}
      {adminToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-amber-400/40 flex items-center gap-3 animate-fadeIn">
          <span className="text-xs font-bold">{adminToast}</span>
          <button
            onClick={() => setAdminToast(null)}
            className="px-2 py-0.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white ml-1 text-xs"
          >
            ✕
          </button>
        </div>
      )}
      {/* ======================================================== */}
      {/* MODAL: EXCEL ORDERS EXPORT PROMPT */}
      {/* ======================================================== */}
      <ExcelExportPromptModal
        isOpen={showOrdersExcelPrompt}
        onClose={() => setShowOrdersExcelPrompt(false)}
        title="Xuất Danh Sách Đơn Hàng"
        description="Bạn có muốn tải về toàn bộ ảnh chụp bill chuyển khoản của khách và ảnh sản phẩm đính kèm cùng file Excel (.xlsx) không?"
        itemCountInfo={`Đang có ${orders.length} đơn hàng trong hệ thống`}
        onConfirm={handleConfirmExportOrdersExcel}
      />
      </div>
    </div>
  );
};
