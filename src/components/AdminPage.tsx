import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Menu, Eye, EyeOff, Edit3, Trash2, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, ChevronDown, SlidersHorizontal, ArrowLeft, RefreshCw, Plus, Search, Filter, Lock, CloudUpload, Phone, MapPin, LayoutDashboard, ShoppingBag, Package, Mail, CheckCircle2, Smartphone, Table as TableIcon, RotateCcw, RotateCw, ExternalLink, Database, Server, HardDrive, Activity, ArrowUpRight, BarChart3, Sparkles, Upload, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { Product, CategoryItem, CollectionInfo, SiteContentConfig, ContactMessage, SellerUser, ProductColorOption, ProductCharmOption, ProductOmamoriOption } from '../types';
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
import { AdminSellersManager } from './AdminSellersManager';
import { AdminNotifications } from './AdminNotifications';
import { AdminHeader } from './admin/AdminHeader';
import { AdminSidebar } from './admin/AdminSidebar';
import { AdminBankAccountPage } from './admin/AdminBankAccountPage';
import { AdminVersionHistoryPage } from './admin/AdminVersionHistoryPage';
import { ExcelExportPromptModal } from './ExcelExportPromptModal';
import { exportOrdersWithImageOption } from '../utils/excelImageExporter';
import { 
  formatOrderDateWithoutSeconds, 
  getSourceBadgeConfig, 
  getStatusBadgeConfig, 
  getCleanOrderNote,
  getOrderTrackingNumber,
  normalizeOrderStatus,
  NormalizedOrderStatus
} from '../utils/orderFormatters';
import { createDefaultSellers, deduplicateSellers } from '../utils/auth';
import { DEFAULT_CHARM_PRESETS } from '../data/sampleCharms';
import { DEFAULT_OMAMORI_PRESETS } from '../data/sampleOmamori';
import {
  subscribeQuotaStats,
  getLatestQuotaStats,
  resetFirestoreQuotaStats,
  recalculateFirestoreStorage,
  FirestoreQuotaStats,
  fetchProductsFromFirestore,
  saveProductToFirestore,
  saveProductsToFirestore,
  pushAndSyncProductsToFirestore,
  deleteProductFromFirestore,
  fetchCategoriesFromFirestore,
  saveCategoryToFirestore,
  saveCategoriesToFirestore,
  pushAndSyncCategoriesToFirestore,
  deleteCategoryFromFirestore,
  fetchOrdersFromFirestore,
  saveOrderToFirestore,
  saveOrdersToFirestore,
  subscribeToOrdersFromFirestore,
  deleteOrderFromFirestore,
  deleteOrdersBatchFromFirestore,
  updateOrderStatusInFirestore,
  fetchContactMessagesFromFirestore,
  subscribeToContactMessagesFromFirestore,
  updateContactMessageStatusInFirestore,
  fetchSellersFromFirestore,
  saveSellerToFirestore,
  deleteSellerFromFirestore,
  testFirebaseConnection,
  saveCollectionsToFirestore,
  saveSiteContentToFirestore,
  StoredOrder
} from '../firebase';
import { safeStorageSetItem, safeStorageGetItem } from '../utils/storageHelper';

interface HistoryAction {
  id: string;
  description: string;
  type: 'products' | 'categories' | 'orders';
  undoState: any;
  redoState: any;
}

interface AdminPageProps {
  products: Product[];
  categories?: CategoryItem[];
  collections?: CollectionInfo[];
  siteContent?: SiteContentConfig;
  currentSeller?: SellerUser;
  onUpdateProducts: (newProducts: Product[]) => void;
  onUpdateCategories?: (newCategories: CategoryItem[]) => void;
  onUpdateCollections?: (newCollections: CollectionInfo[]) => void;
  onUpdateSiteContent?: (newConfig: SiteContentConfig) => void;
  onLogout?: () => void;
  onBackToStore: () => void;
}

export type AdminTabType =
  | 'dashboard'
  | 'analytics'
  | 'orders'
  | 'manual_order'
  | 'sellers'
  | 'messages'
  | 'site_editor'
  | 'bank_account'
  | 'banners'
  | 'products'
  | 'categories'
  | 'version_history'
  | 'backup'
  | 'firebase';

export const AdminPage: React.FC<AdminPageProps> = ({
  products,
  categories = DEFAULT_CATEGORIES,
  collections = COLLECTIONS_DATA,
  siteContent = DEFAULT_SITE_CONTENT,
  currentSeller,
  onUpdateProducts,
  onUpdateCategories,
  onUpdateCollections,
  onUpdateSiteContent,
  onLogout,
  onBackToStore
}) => {
  const [activeTab, setActiveTab] = useState<AdminTabType>('dashboard');
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<'all' | 'website' | 'event_0209' | 'facebook' | 'workshop'>('all');
  const [orderViewMode, setOrderViewMode] = useState<'cards' | 'table'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return 'cards';
    return 'table';
  });
  const [productViewMode, setProductViewMode] = useState<'cards' | 'table'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'cards';
    return 'table';
  });

  const isRootAdmin = Boolean(currentSeller && (currentSeller.isRootAdmin || currentSeller.username === 'manhcuong'));

  // Switch tab with simulated enterprise loading transition
  const handleSwitchTab = (tab: AdminTabType) => {
    if (tab === 'sellers' && !isRootAdmin) {
      alert('Chỉ Admin Gốc mới có quyền truy cập trang Quản trị.');
      return;
    }
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
      safeStorageSetItem('nak_categories', JSON.stringify(newCats));
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
      safeStorageSetItem('nak_collections', JSON.stringify(newCols));
    } catch (e) {
      console.warn('Lỗi lưu collections vào localStorage:', e);
    }
  };

  // Orders state & filters (3 sources, 2 payment types, 3 statuses)
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderFilterType, setOrderFilterType] = useState<'all' | '0209' | 'standard'>('all');
  const [orderSourceFilter, setOrderSourceFilter] = useState<'all' | 'website' | 'mạng xã hội' | 'trực tiếp'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | NormalizedOrderStatus>('all');
  const [orderPaymentStatusFilter, setOrderPaymentStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [orderHasReceiptFilter, setOrderHasReceiptFilter] = useState<'all' | 'has_receipt' | 'no_receipt'>('all');
  const [orderSellerFilter, setOrderSellerFilter] = useState<string>('all');
  const [orderCategoryFilter, setOrderCategoryFilter] = useState<string>('all');
  const [orderSortBy, setOrderSortBy] = useState<
    'date_desc' | 'date_asc' | 'seller_asc' | 'seller_desc' | 'total_desc' | 'total_asc' | 'name_asc' | 'category_asc' | 'category_desc'
  >('date_desc');

  // Sellers / Team Members State (9 Team Members)
  const [sellers, setSellers] = useState<SellerUser[]>([]);

  // Order Pagination State
  const [orderPageSize, setOrderPageSize] = useState<number | 'all'>(() => {
    try {
      const saved = localStorage.getItem('nak_admin_order_page_size');
      if (saved === 'all') return 'all';
      if (saved && !isNaN(parseInt(saved, 10))) return parseInt(saved, 10);
    } catch {}
    return 10;
  });
  const [orderCurrentPage, setOrderCurrentPage] = useState<number>(1);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Bulk Selection & Editing Modal States
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [tableZoom, setTableZoom] = useState<number>(100);
  const [editingOrder, setEditingOrder] = useState<StoredOrder | null>(null);
  const [receiptPromptModal, setReceiptPromptModal] = useState<{ order: StoredOrder; isPromptOnPaid?: boolean } | null>(null);
  const [orderContextMenu, setOrderContextMenu] = useState<{ x: number; y: number; order: StoredOrder } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Order toolbar compact search & extra filters slide dropdown
  const [isOrderSearchExpanded, setIsOrderSearchExpanded] = useState<boolean>(false);
  const [showOrderExtraFilters, setShowOrderExtraFilters] = useState<boolean>(false);
  const orderExtraFiltersRef = useRef<HTMLDivElement>(null);
  const orderSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (orderExtraFiltersRef.current && !orderExtraFiltersRef.current.contains(e.target as Node)) {
        setShowOrderExtraFilters(false);
      }
    };
    if (showOrderExtraFilters) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOrderExtraFilters]);

  const activeOrderExtraFiltersCount = useMemo(() => {
    let count = 0;
    if (orderSortBy !== 'date_desc') count++;
    if (orderSellerFilter !== 'all') count++;
    if (orderPaymentStatusFilter !== 'all') count++;
    if (orderHasReceiptFilter !== 'all') count++;
    return count;
  }, [orderSortBy, orderSellerFilter, orderPaymentStatusFilter, orderHasReceiptFilter]);

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
  const [formSoldCount, setFormSoldCount] = useState<number>(0);
  const [formIsEvent0209, setFormIsEvent0209] = useState(false);
  const [formIsBestSeller, setFormIsBestSeller] = useState(false);
  const [formIsNew, setFormIsNew] = useState(false);
  const [formIsHidden, setFormIsHidden] = useState(false);
  const [formCustomUrl, setFormCustomUrl] = useState('');
  const [isExpandedHiddenBox, setIsExpandedHiddenBox] = useState(true);

  // Dynamic Product Variations (Colors with photos, Charms with photos, Omamori, Sizes)
  const [formEnableColorSelection, setFormEnableColorSelection] = useState(false);
  const [formColorOptions, setFormColorOptions] = useState<ProductColorOption[]>([]);
  // Charm / Accessory 1 states
  const [formEnableCharmSelection, setFormEnableCharmSelection] = useState(false);
  const [formCharmTitle, setFormCharmTitle] = useState('');
  const [formCharmSelectionRequired, setFormCharmSelectionRequired] = useState(false);
  const [formMaxCharmsAllowed, setFormMaxCharmsAllowed] = useState(1);
  const [formCharmOptions, setFormCharmOptions] = useState<ProductCharmOption[]>([]);
  // Omamori / Accessory 2 states
  const [formEnableOmamoriSelection, setFormEnableOmamoriSelection] = useState(false);
  const [formOmamoriTitle, setFormOmamoriTitle] = useState('');
  const [formOmamoriSelectionRequired, setFormOmamoriSelectionRequired] = useState(false);
  const [formMaxOmamoriAllowed, setFormMaxOmamoriAllowed] = useState(1);
  const [formOmamoriOptions, setFormOmamoriOptions] = useState<ProductOmamoriOption[]>([]);
  const [draggedCharmIndex, setDraggedCharmIndex] = useState<number | null>(null);
  const [draggedOmamoriIndex, setDraggedOmamoriIndex] = useState<number | null>(null);
  const [activeCharmDropIndex, setActiveCharmDropIndex] = useState<number | null>(null);
  const [activeOmamoriDropIndex, setActiveOmamoriDropIndex] = useState<number | null>(null);
  const [dragOverCharmFileIdx, setDragOverCharmFileIdx] = useState<number | null>(null);
  const [dragOverOmamoriFileIdx, setDragOverOmamoriFileIdx] = useState<number | null>(null);
  const [isBulkCharmDragOver, setIsBulkCharmDragOver] = useState(false);
  const [isBulkOmamoriDragOver, setIsBulkOmamoriDragOver] = useState(false);

  const cleanNameFromFileName = (fileName: string) => {
    const withoutExt = fileName.replace(/\.[^/.]+$/, '');
    return withoutExt
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleBulkCharmUpload = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      showAdminToast('Không tìm thấy file hình ảnh hợp lệ.');
      return;
    }

    let processedCount = 0;
    const newCharms: ProductCharmOption[] = [];

    fileArray.forEach((file, i) => {
      processOptionImageFile(file, (dataUrl) => {
        const charmName = cleanNameFromFileName(file.name) || `Charm ${formCharmOptions.length + i + 1}`;
        newCharms.push({
          id: `charm-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          name: charmName,
          image: dataUrl,
          priceDelta: 0,
          stock: 10
        });
        processedCount++;
        if (processedCount === fileArray.length) {
          setFormCharmOptions(prev => [...prev, ...newCharms]);
          showAdminToast(`Đã thêm ${newCharms.length} charm từ ảnh thành công!`);
        }
      });
    });
  };

  const handleBulkOmamoriUpload = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      showAdminToast('Không tìm thấy file hình ảnh hợp lệ.');
      return;
    }

    let processedCount = 0;
    const newOmamoris: ProductOmamoriOption[] = [];

    fileArray.forEach((file, i) => {
      processOptionImageFile(file, (dataUrl) => {
        const omamoriName = cleanNameFromFileName(file.name) || `Bùa may mắn ${formOmamoriOptions.length + i + 1}`;
        newOmamoris.push({
          id: `omamori-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          name: omamoriName,
          image: dataUrl,
          priceDelta: 25000,
          meaning: 'Bình an & may mắn',
          stock: 20
        });
        processedCount++;
        if (processedCount === fileArray.length) {
          setFormOmamoriOptions(prev => [...prev, ...newOmamoris]);
          showAdminToast(`Đã thêm ${newOmamoris.length} bùa Omamori từ ảnh thành công!`);
        }
      });
    });
  };

  const handleMoveCharm = (fromIdx: number, toIdx: number) => {
    setFormCharmOptions((prev) => {
      if (toIdx < 0 || toIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const handleMoveOmamori = (fromIdx: number, toIdx: number) => {
    setFormOmamoriOptions((prev) => {
      if (toIdx < 0 || toIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };
  // Size states
  const [formEnableSizeSelection, setFormEnableSizeSelection] = useState(false);
  const [formAvailableSizes, setFormAvailableSizes] = useState<string[]>([
    '14cm - 15cm',
    '15cm - 16cm (Chuẩn)',
    '16cm - 17cm',
    '17cm - 18cm',
    'Custom theo yêu cầu'
  ]);

  // Category Manager State (Add / Edit category)
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [catFormId, setCatFormId] = useState('');
  const [catFormLabel, setCatFormLabel] = useState('');
  const [catFormDescription, setCatFormDescription] = useState('');
  const [catFormColor, setCatFormColor] = useState('#B41C1A');
  const [catFormBadge, setCatFormBadge] = useState('');
  const [catFormIsEvent, setCatFormIsEvent] = useState(false);
  const [catFormIsHidden, setCatFormIsHidden] = useState(false);

  // Search & Filter in Admin Products
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('all');
  const [adminStockFilter, setAdminStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');

  // UI Layout & Drag-Drop states
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [isImageDragging, setIsImageDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

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

  // Recalculate Firestore storage when data collections change
  useEffect(() => {
    if (products.length > 0 || orders.length > 0) {
      recalculateFirestoreStorage(products, orders, localCategories, localCollections, siteContent);
    }
  }, [products, orders, localCategories, localCollections, siteContent]);

  const handleRecalculateStorage = () => {
    const bytes = recalculateFirestoreStorage(products, orders, localCategories, localCollections, siteContent);
    const formatted = bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
    showAdminToast(`Đã tính lại dung lượng dữ liệu Firestore: ~${formatted}`);
  };

  const handleResetQuotaSession = () => {
    resetFirestoreQuotaStats();
    showAdminToast('Đã đặt lại bộ đếm phiên làm việc về 0.');
  };

  // No-op history tracker preserving call signatures
  const pushHistoryAction = (_description?: string, _type?: string, _undoState?: any, _redoState?: any) => {};

  // Fetch sellers from Firestore or defaults
  const loadSellers = async () => {
    try {
      const dbSellers = await fetchSellersFromFirestore();
      if (dbSellers && dbSellers.length > 0) {
        const clean = deduplicateSellers(dbSellers);
        setSellers(clean);
        try {
          safeStorageSetItem('nak_sellers_list', JSON.stringify(clean));
        } catch {
          // ignore
        }
      } else {
        const local = localStorage.getItem('nak_sellers_list');
        if (local) {
          try {
            setSellers(deduplicateSellers(JSON.parse(local)));
          } catch {
            const defaults = await createDefaultSellers();
            setSellers(deduplicateSellers(defaults));
          }
        } else {
          const defaults = await createDefaultSellers();
          const clean = deduplicateSellers(defaults);
          setSellers(clean);
          try {
            safeStorageSetItem('nak_sellers_list', JSON.stringify(clean));
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi tải danh sách sellers:', e);
      const defaults = await createDefaultSellers();
      setSellers(deduplicateSellers(defaults));
    }
  };

  const handleUpdateSellers = (newSellers: SellerUser[]) => {
    const clean = deduplicateSellers(newSellers);
    setSellers(clean);
    try {
      safeStorageSetItem('nak_sellers_list', JSON.stringify(clean));
    } catch (e) {
      console.warn('Lỗi lưu sellers:', e);
    }
  };

  useEffect(() => {
    if (!currentSeller) return;
    loadSellers();
  }, [currentSeller]);

  // Check connection to Firestore on mount
  useEffect(() => {
    if (!currentSeller) return;
    const checkConn = async () => {
      const ok = await testFirebaseConnection();
      setCloudConnected(ok);
    };
    checkConn();
  }, [currentSeller]);

  // Fetch orders from Firestore or localStorage
  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const dbOrders = await fetchOrdersFromFirestore();
      if (dbOrders && dbOrders.length > 0) {
        setOrders(dbOrders);
        safeStorageSetItem('nak_preorders', JSON.stringify(dbOrders));
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

  // Fetch unread messages count & messages list from Firestore / Local cache
  const loadMessagesCount = async () => {
    try {
      const msgs = await fetchContactMessagesFromFirestore();
      setContactMessages(msgs);
      const unread = msgs.filter((m) => !m.isRead).length;
      setUnreadMessagesCount(unread);
    } catch {
      // ignore
    }
  };

  const handleMarkMessageRead = async (msg: ContactMessage) => {
    const updated = contactMessages.map((m) =>
      m.id === msg.id ? { ...m, isRead: true, status: 'read' as const } : m
    );
    setContactMessages(updated);
    setUnreadMessagesCount(updated.filter((m) => !m.isRead).length);
    try {
      await updateContactMessageStatusInFirestore(msg.id, true);
    } catch (e) {
      console.warn('Lỗi cập nhật trạng thái tin nhắn:', e);
    }
  };

  useEffect(() => {
    if (!currentSeller) return;
    loadOrders();
    loadMessagesCount();
    const unsubscribeOrders = subscribeToOrdersFromFirestore((realtimeOrders) => {
      if (realtimeOrders && realtimeOrders.length > 0) {
        setOrders(realtimeOrders);
        safeStorageSetItem('nak_preorders', JSON.stringify(realtimeOrders));
      }
    });
    const unsubscribeMessages = subscribeToContactMessagesFromFirestore((realtimeMessages) => {
      if (realtimeMessages) {
        setContactMessages(realtimeMessages);
        setUnreadMessagesCount(realtimeMessages.filter((m) => !m.isRead).length);
        try {
          safeStorageSetItem('nak_contact_messages', JSON.stringify(realtimeMessages));
        } catch {
          // ignore
        }
      }
    });
    return () => {
      unsubscribeOrders();
      unsubscribeMessages();
    };
  }, [currentSeller]);

  // Auto-load orders on initial mount and when switching to dashboard or orders tab
  useEffect(() => {
    if (!currentSeller) return;
    if (activeTab === 'dashboard' || activeTab === 'orders') {
      loadOrders();
    }
    if (activeTab === 'messages') {
      loadMessagesCount();
    }
  }, [activeTab, currentSeller]);

  // Đồng Bộ từ Cloud về máy (Kéo dữ liệu từ Firestore về Local)
  const handleFetchFromCloud = async () => {
    setIsCloudSyncing(true);
    setCloudSyncMessage('🔄 Đang đồng bộ / kéo dữ liệu mới nhất từ Firebase Firestore về máy...');
    try {
      const [cloudProds, cloudCats] = await Promise.all([
        fetchProductsFromFirestore(),
        fetchCategoriesFromFirestore()
      ]);

      if (cloudProds && cloudProds.length > 0) {
        onUpdateProducts(cloudProds);
        try {
          safeStorageSetItem('nak_custom_products', JSON.stringify(cloudProds));
        } catch {
          // ignore
        }
      }
      if (cloudCats && cloudCats.length > 0) {
        setLocalCategories(cloudCats);
        onUpdateCategories?.(cloudCats);
        try {
          safeStorageSetItem('nak_categories', JSON.stringify(cloudCats));
        } catch {
          // ignore
        }
      }
      const count = cloudProds ? cloudProds.length : 0;
      setCloudConnected(true);
      setCloudSyncMessage(`✅ Đã đồng bộ thành công ${count} sản phẩm & ${cloudCats ? cloudCats.length : 0} danh mục từ Firebase về máy!`);
      showAdminToast(`Đã đồng bộ ${count} sản phẩm từ Cloud về máy thành công.`);
      setTimeout(() => setCloudSyncMessage(null), 4000);
    } catch (e: any) {
      console.error('Lỗi tải từ Firebase:', e);
      setCloudSyncMessage(`Lỗi kết nối Firebase: ${e?.message || 'Vui lòng thử lại.'}`);
      setTimeout(() => setCloudSyncMessage(null), 4000);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Đẩy dữ liệu lên Cloud (Local -> Cloud: ghi đè và xóa các sản phẩm cũ trên Cloud để khớp 100% với máy)
  const handlePushAllToCloud = async () => {
    if (!products.length && !localCategories.length) {
      showAdminToast('Không có sản phẩm để đẩy lên Cloud.');
      return;
    }

    setIsCloudSyncing(true);
    setCloudSyncMessage(`☁️ Đang đẩy ${products.length} sản phẩm lên Firebase Cloud (và dọn dẹp các sản phẩm đã xóa)...`);
    try {
      // 1. Đẩy và dọn dẹp sản phẩm trên Firestore
      const prodResult = await pushAndSyncProductsToFirestore(products, true);
      
      // 2. Đẩy và dọn dẹp danh mục trên Firestore
      const catResult = await pushAndSyncCategoriesToFirestore(localCategories, true);

      // 3. Đồng bộ lại localStorage
      try {
        safeStorageSetItem('nak_custom_products', JSON.stringify(products));
        safeStorageSetItem('nak_categories', JSON.stringify(localCategories));
      } catch {
        // ignore
      }

      setCloudConnected(true);
      const cleanMsg = prodResult.deleted > 0 ? ` (đã xóa ${prodResult.deleted} sản phẩm cũ khỏi Cloud)` : '';
      setCloudSyncMessage(`✅ ĐÃ ĐẨY LÊN CLOUD THÀNH CÔNG! Đã lưu ${prodResult.saved} sản phẩm${cleanMsg}. Khi bạn làm mới (F5), dữ liệu sẽ giữ nguyên đúng ${prodResult.saved} sản phẩm này!`);
      showAdminToast(`Đã đẩy ${prodResult.saved} sản phẩm lên Firebase Cloud thành công!`);
      setTimeout(() => setCloudSyncMessage(null), 6000);
    } catch (e: any) {
      console.error('Lỗi push lên Firebase:', e);
      setCloudSyncMessage(`Lỗi khi đẩy lên Firebase: ${e?.message || 'Kiểm tra kết nối'}`);
      showAdminToast(`Lỗi khi đẩy lên Cloud: ${e?.message || 'Thử lại sau'}`);
      setTimeout(() => setCloudSyncMessage(null), 4000);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Reset to default sample products
  const handleResetDefaults = () => {
    setDeleteConfirmModal({
      title: 'Khôi phục dữ liệu gốc',
      message: 'Bạn có chắc chắn muốn khôi phục danh sách sản phẩm và danh mục về mặc định?',
      submessage: 'Các chỉnh sửa tùy biến thủ công sẽ được đặt lại theo mẫu tiêu chuẩn.',
      confirmLabel: 'Khôi phục mặc định',
      onConfirm: async () => {
        onUpdateProducts(DEFAULT_PRODUCTS);
        setLocalCategories(DEFAULT_CATEGORIES);
        onUpdateCategories?.(DEFAULT_CATEGORIES);
        safeStorageSetItem('nak_custom_products', JSON.stringify(DEFAULT_PRODUCTS));
        safeStorageSetItem('nak_categories', JSON.stringify(DEFAULT_CATEGORIES));
        setDeleteConfirmModal(null);
        showAdminToast('Đã khôi phục sản phẩm & danh mục mặc định thành công.');
      }
    });
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
    const targetOrders = selectedOrderIds.length > 0
      ? orders.filter((o) => o.id && selectedOrderIds.includes(o.id))
      : (filteredOrders.length > 0 ? filteredOrders : orders);

    if (targetOrders.length === 0) {
      showAdminToast('Chưa có đơn hàng nào để xuất file.');
      return;
    }
    setShowOrdersExcelPrompt(true);
  };

  const handleConfirmExportOrdersExcel = async (includeImages: boolean, onProgress: (msg: string) => void) => {
    const targetOrders = selectedOrderIds.length > 0
      ? orders.filter((o) => o.id && selectedOrderIds.includes(o.id))
      : (filteredOrders.length > 0 ? filteredOrders : orders);

    await exportOrdersWithImageOption({
      orders: targetOrders,
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
    setFormSoldCount(0);
    setFormIsEvent0209(false);
    setFormIsBestSeller(false);
    setFormIsNew(true);
    setFormIsHidden(false);
    setFormCustomUrl('');
    // Variations initialization
    setFormEnableColorSelection(false);
    setFormColorOptions([]);
    setFormEnableCharmSelection(false);
    setFormCharmTitle('');
    setFormCharmSelectionRequired(false);
    setFormMaxCharmsAllowed(1);
    setFormCharmOptions([]);
    setFormEnableOmamoriSelection(false);
    setFormOmamoriTitle('');
    setFormOmamoriSelectionRequired(false);
    setFormMaxOmamoriAllowed(1);
    setFormOmamoriOptions(DEFAULT_OMAMORI_PRESETS);
    setFormEnableSizeSelection(false);
    setFormAvailableSizes(['14cm - 15cm', '15cm - 16cm (Chuẩn)', '16cm - 17cm', '17cm - 18cm', 'Custom theo yêu cầu']);
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
    setFormSoldCount(prod.soldCount || 0);
    setFormIsEvent0209(!!prod.isEvent0209);
    setFormIsBestSeller(!!prod.isBestSeller);
    setFormIsNew(!!prod.isNew);
    setFormIsHidden(Boolean(prod.isHidden));
    setFormCustomUrl(prod.customUrl || '');
    // Variations loading
    setFormEnableColorSelection(Boolean(prod.enableColorSelection));
    const loadedColors: ProductColorOption[] = (prod.colorOptions && prod.colorOptions.length > 0)
      ? prod.colorOptions
      : (prod.availableColors || []).map((c) => ({ name: c }));
    setFormColorOptions(loadedColors);
    setFormEnableCharmSelection(Boolean(prod.enableCharmSelection));
    setFormCharmTitle(prod.charmTitle || '');
    setFormCharmSelectionRequired(Boolean(prod.charmSelectionRequired));
    setFormMaxCharmsAllowed(prod.maxCharmsAllowed && prod.maxCharmsAllowed > 0 ? prod.maxCharmsAllowed : 1);
    setFormCharmOptions(prod.charmOptions || []);
    setFormEnableOmamoriSelection(Boolean(prod.enableOmamoriSelection));
    setFormOmamoriTitle(prod.omamoriTitle || '');
    setFormOmamoriSelectionRequired(Boolean(prod.omamoriSelectionRequired));
    setFormMaxOmamoriAllowed(prod.maxOmamoriAllowed && prod.maxOmamoriAllowed > 0 ? prod.maxOmamoriAllowed : 1);
    const loadedOmamoris: ProductOmamoriOption[] = (prod.omamoriOptions && prod.omamoriOptions.length > 0)
      ? prod.omamoriOptions
      : DEFAULT_OMAMORI_PRESETS;
    setFormOmamoriOptions(loadedOmamoris);
    setFormEnableSizeSelection(Boolean(prod.enableSizeSelection));
    setFormAvailableSizes(
      prod.availableSizes && prod.availableSizes.length > 0
        ? prod.availableSizes
        : ['14cm - 15cm', '15cm - 16cm (Chuẩn)', '16cm - 17cm', '17cm - 18cm', 'Custom theo yêu cầu']
    );
    setIsAddingNew(true);
  };

  // Image Drag & Drop / File Upload handler with automatic resizing & compression (Base64)
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, JPEG, WEBP, SVG).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert('Dung lượng ảnh tối đa là 15MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawResult = event.target?.result;
      if (typeof rawResult === 'string') {
        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 2048;
            let width = img.width || 800;
            let height = img.height || 800;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, width, height);
              
              let compressed = '';
              try {
                compressed = canvas.toDataURL('image/webp', 0.95);
                if (!compressed || !compressed.startsWith('data:image/webp')) {
                  compressed = canvas.toDataURL('image/jpeg', 0.94);
                }
              } catch {
                compressed = canvas.toDataURL('image/jpeg', 0.94);
              }

              setFormImages((prev) => {
                const updated = [...prev, compressed];
                if (!formImage || prev.length === 0) {
                  setFormImage(compressed);
                }
                return updated;
              });
              return;
            }
          } catch (e) {
            console.warn('Image canvas compression fallback:', e);
          }
          // Fallback if canvas context fails
          setFormImages((prev) => {
            const updated = [...prev, rawResult];
            if (!formImage || prev.length === 0) {
              setFormImage(rawResult);
            }
            return updated;
          });
        };
        img.onerror = () => {
          setFormImages((prev) => {
            const updated = [...prev, rawResult];
            if (!formImage || prev.length === 0) {
              setFormImage(rawResult);
            }
            return updated;
          });
        };
        img.src = rawResult;
      }
    };
    reader.readAsDataURL(file);
  };

  // Dedicated image file processor for Charm & Omamori options (optimized thumbnail ~500px)
  const processOptionImageFile = (file: File, onDone: (dataUrl: string) => void, maxDim = 500) => {
    if (!file.type.startsWith('image/')) {
      showAdminToast('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, JPEG, WEBP, SVG).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showAdminToast('Dung lượng ảnh tối đa là 15MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawResult = event.target?.result;
      if (typeof rawResult === 'string') {
        const img = new Image();
        img.onload = () => {
          try {
            let width = img.width || 400;
            let height = img.height || 400;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, width, height);
              let compressed = '';
              try {
                compressed = canvas.toDataURL('image/webp', 0.92);
                if (!compressed || !compressed.startsWith('data:image/webp')) {
                  compressed = canvas.toDataURL('image/jpeg', 0.90);
                }
              } catch {
                compressed = canvas.toDataURL('image/jpeg', 0.90);
              }
              onDone(compressed || rawResult);
              return;
            }
          } catch (e) {
            console.warn('Option image canvas compression fallback:', e);
          }
          onDone(rawResult);
        };
        img.onerror = () => onDone(rawResult);
        img.src = rawResult;
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
        enableColorSelection: formEnableColorSelection,
        colorOptions: formEnableColorSelection ? formColorOptions : [],
        availableColors: formEnableColorSelection && formColorOptions.length > 0 ? formColorOptions.map((c) => c.name) : undefined,
        enableCharmSelection: formEnableCharmSelection,
        charmTitle: formEnableCharmSelection ? (formCharmTitle.trim() || undefined) : undefined,
        charmSelectionRequired: formEnableCharmSelection && formCharmSelectionRequired,
        maxCharmsAllowed: formEnableCharmSelection ? (formMaxCharmsAllowed > 0 ? formMaxCharmsAllowed : 1) : undefined,
        charmOptions: formEnableCharmSelection ? formCharmOptions : [],
        enableOmamoriSelection: formEnableOmamoriSelection,
        omamoriTitle: formEnableOmamoriSelection ? (formOmamoriTitle.trim() || undefined) : undefined,
        omamoriSelectionRequired: formEnableOmamoriSelection && formOmamoriSelectionRequired,
        maxOmamoriAllowed: formEnableOmamoriSelection ? (formMaxOmamoriAllowed > 0 ? formMaxOmamoriAllowed : 1) : undefined,
        omamoriOptions: formEnableOmamoriSelection ? (formOmamoriOptions && formOmamoriOptions.length > 0 ? formOmamoriOptions : DEFAULT_OMAMORI_PRESETS) : [],
        enableSizeSelection: formEnableSizeSelection,
        availableSizes: formEnableSizeSelection ? formAvailableSizes : undefined,
        stock: stockNumber,
        inStock: calculatedInStock,
        soldCount: formSoldCount > 0 ? formSoldCount : undefined,
        isEvent0209: formIsEvent0209,
        isBestSeller: formIsBestSeller,
        isNew: formIsNew,
        isHidden: formIsHidden,
        customUrl: formCustomUrl.trim() || undefined,
        updatedAt: new Date().toISOString()
      };

      const updatedList = products.map((p) => (p.id === editingProduct.id ? updatedItem : p));
      pushHistoryAction(`Cập nhật sản phẩm "${updatedItem.name}"`, 'products', products, updatedList);
      onUpdateProducts(updatedList);
      try {
        safeStorageSetItem('nak_custom_products', JSON.stringify(updatedList));
      } catch (e) {
        console.warn("Lỗi lưu localStorage:", e);
      }
      setIsAddingNew(false);
      setEditingProduct(null);
      showAdminToast(`Đang lưu và đồng bộ "${updatedItem.name}" lên Firebase...`);

      // Push to Firestore in background
      saveProductToFirestore(updatedItem)
        .then(() => {
          showAdminToast(`Đã đồng bộ "${updatedItem.name}" lên Firebase Cloud thành công!`);
        })
        .catch((err) => {
          console.error('Firestore update error:', err);
          showAdminToast(`Đã lưu cục bộ. Lỗi đồng bộ Firebase: ${err?.message || 'Kiểm tra kết nối'}`);
        });
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
        enableColorSelection: formEnableColorSelection,
        colorOptions: formEnableColorSelection ? formColorOptions : [],
        availableColors: formEnableColorSelection && formColorOptions.length > 0 ? formColorOptions.map((c) => c.name) : undefined,
        enableCharmSelection: formEnableCharmSelection,
        charmTitle: formEnableCharmSelection ? (formCharmTitle.trim() || undefined) : undefined,
        charmSelectionRequired: formEnableCharmSelection && formCharmSelectionRequired,
        maxCharmsAllowed: formEnableCharmSelection ? (formMaxCharmsAllowed > 0 ? formMaxCharmsAllowed : 1) : undefined,
        charmOptions: formEnableCharmSelection ? formCharmOptions : [],
        enableOmamoriSelection: formEnableOmamoriSelection,
        omamoriTitle: formEnableOmamoriSelection ? (formOmamoriTitle.trim() || undefined) : undefined,
        omamoriSelectionRequired: formEnableOmamoriSelection && formOmamoriSelectionRequired,
        maxOmamoriAllowed: formEnableOmamoriSelection ? (formMaxOmamoriAllowed > 0 ? formMaxOmamoriAllowed : 1) : undefined,
        omamoriOptions: formEnableOmamoriSelection ? (formOmamoriOptions && formOmamoriOptions.length > 0 ? formOmamoriOptions : DEFAULT_OMAMORI_PRESETS) : [],
        enableSizeSelection: formEnableSizeSelection,
        availableSizes: formEnableSizeSelection ? formAvailableSizes : undefined,
        stock: stockNumber,
        inStock: calculatedInStock,
        soldCount: formSoldCount > 0 ? formSoldCount : undefined,
        isEvent0209: formIsEvent0209,
        isBestSeller: formIsBestSeller,
        isNew: formIsNew,
        isHidden: formIsHidden,
        customUrl: formCustomUrl.trim() || undefined,
        rating: 5.0,
        reviewsCount: 1,
        updatedAt: new Date().toISOString()
      };

      const updatedList = [newItem, ...products];
      pushHistoryAction(`Thêm sản phẩm mới "${newItem.name}"`, 'products', products, updatedList);
      onUpdateProducts(updatedList);
      try {
        safeStorageSetItem('nak_custom_products', JSON.stringify(updatedList));
      } catch (e) {
        console.warn("Lỗi lưu localStorage:", e);
      }
      setIsAddingNew(false);
      showAdminToast(`Đang tạo và đồng bộ "${newItem.name}" lên Firebase...`);

      // Push to Firestore in background
      saveProductToFirestore(newItem)
        .then(() => {
          showAdminToast(`Đã tạo và đồng bộ "${newItem.name}" lên Firebase Cloud thành công!`);
        })
        .catch((err) => {
          console.error('Firestore save error:', err);
          showAdminToast(`Đã lưu cục bộ. Lỗi đồng bộ Firebase: ${err?.message || 'Kiểm tra kết nối'}`);
        });
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
        setDeleteConfirmModal(null);
        const updatedList = products.filter((p) => p.id !== id);
        pushHistoryAction(`Xóa sản phẩm "${name}"`, 'products', products, updatedList);
        onUpdateProducts(updatedList);
        try {
          safeStorageSetItem('nak_custom_products', JSON.stringify(updatedList));
          await deleteProductFromFirestore(id);
        } catch (err) {
          console.warn('Firestore delete error:', err);
        }
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
    pushHistoryAction(`Điều chỉnh tồn kho "${prod.name}": ${newStock}`, 'products', products, updatedList);
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
    pushHistoryAction(`Đổi trạng thái kho "${prod.name}": ${newStockState ? 'Còn hàng' : 'Hết hàng'}`, 'products', products, updatedList);
    onUpdateProducts(updatedList);
    saveProductToFirestore(updatedProd).catch((e) => console.warn('Firestore stock toggle:', e));
  };

  // Quick toggle product visibility (Hide / Unhide)
  const handleToggleProductVisibility = async (prod: Product) => {
    const nextHiddenState = !prod.isHidden;
    const updatedProd = { ...prod, isHidden: nextHiddenState, updatedAt: new Date().toISOString() };
    const updatedList = products.map((p) => (p.id === prod.id ? updatedProd : p));
    pushHistoryAction(
      nextHiddenState ? `Ẩn sản phẩm "${prod.name}"` : `Hiện lại sản phẩm "${prod.name}"`,
      'products',
      products,
      updatedList
    );
    onUpdateProducts(updatedList);
    try {
      safeStorageSetItem('nak_custom_products', JSON.stringify(updatedList));
    } catch {}
    saveProductToFirestore(updatedProd).catch((e) => console.warn('Firestore product visibility toggle:', e));
    showAdminToast(
      nextHiddenState
        ? `Đã ẩn sản phẩm "${prod.name}" (chuyển sang Hộp sản phẩm đã ẩn).`
        : `Đã hiện lại sản phẩm "${prod.name}" trên website.`
    );
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
    setCatFormIsHidden(false);
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
    setCatFormIsHidden(!!cat.isHidden);
    setIsAddingCategory(true);
  };

  const handleToggleCategoryVisibility = async (category: CategoryItem) => {
    const nextHiddenState = !category.isHidden;
    const updatedCategory: CategoryItem = {
      ...category,
      isHidden: nextHiddenState
    };
    const updatedCats = localCategories.map((c) =>
      c.id === category.id ? updatedCategory : c
    );
    pushHistoryAction(
      nextHiddenState ? `Ẩn danh mục "${category.label}"` : `Hiện danh mục "${category.label}"`,
      'categories',
      localCategories,
      updatedCats
    );
    setLocalCategories(updatedCats);
    onUpdateCategories?.(updatedCats);

    const statusMsg = nextHiddenState
      ? `Đã ẩn danh mục "${category.label}" khỏi website.`
      : `Đã hiển thị danh mục "${category.label}" trên website.`;
    showAdminToast(statusMsg);

    try {
      safeStorageSetItem('nak_categories', JSON.stringify(updatedCats));
      Promise.all(updatedCats.map((c) => saveCategoryToFirestore(c)))
        .then(() => showAdminToast(`Đã đồng bộ trạng thái danh mục lên Firebase Cloud!`))
        .catch((err) => {
          console.warn('Firestore save category error:', err);
        });
    } catch (e) {
      console.warn('Lỗi lưu danh mục:', e);
    }
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
      isEvent: catFormIsEvent,
      isHidden: catFormIsHidden
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

    pushHistoryAction(
      editingCategory ? `Cập nhật danh mục "${catPayload.label}"` : `Tạo mới danh mục "${catPayload.label}"`,
      'categories',
      localCategories,
      updatedCats
    );
    setLocalCategories(updatedCats);
    onUpdateCategories?.(updatedCats);
    setIsAddingCategory(false);
    setEditingCategory(null);
    showAdminToast(`Đã lưu danh mục "${catPayload.label}" thành công.`);

    // Save to Firestore & local storage
    try {
      safeStorageSetItem('nak_categories', JSON.stringify(updatedCats));
      saveCategoryToFirestore(catPayload)
        .then(() => showAdminToast(`Đã lưu danh mục "${catPayload.label}" lên Firebase Cloud!`))
        .catch((err) => {
          console.warn('Firestore save category error:', err);
          showAdminToast(`Lưu danh mục cục bộ xong. Lỗi đồng bộ Firebase: ${err?.message || ''}`);
        });
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
        setDeleteConfirmModal(null);
        const updatedCats = localCategories.filter((c) => c.id !== catId);
        const fallbackCatId = updatedCats[0]?.id || 'bracelets';

        // Reassign products if any belonged to this category
        if (count > 0) {
          const updatedProds = products.map((p) =>
            p.category === catId ? { ...p, category: fallbackCatId } : p
          );
          onUpdateProducts(updatedProds);
          try {
            safeStorageSetItem('nak_custom_products', JSON.stringify(updatedProds));
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

        pushHistoryAction(`Xóa danh mục "${catLabel}"`, 'categories', localCategories, updatedCats);
        setLocalCategories(updatedCats);
        onUpdateCategories?.(updatedCats);
        try {
          safeStorageSetItem('nak_categories', JSON.stringify(updatedCats));
          await deleteCategoryFromFirestore(catId);
        } catch (err) {
          console.warn('Firestore delete category error:', err);
        }

        showAdminToast(`Đã xóa danh mục "${catLabel}" thành công.`);
      }
    });
  };

  /**
   * Helper: Check if an order is already in production, shipping, or completed.
   * If true: Materials/products were already crafted/delivered, so deleting the order must NOT restore stock.
   * If false: Order was not yet produced, so deleting it restores the reserved stock back to the inventory.
   */
  const isOrderProducedOrCompleted = (ord: StoredOrder): boolean => {
    const normalized = normalizeOrderStatus(ord.status);
    if (
      normalized === 'Knot đang được sản xuất' ||
      normalized === 'Đang giao hàng' ||
      normalized === 'Đơn hàng giao thành công'
    ) {
      return true;
    }
    const raw = (ord.status || '').toLowerCase().trim();
    if (
      raw.includes('sản xuất') ||
      raw.includes('crafting') ||
      raw.includes('in_production') ||
      raw.includes('đang giao') ||
      raw.includes('shipping') ||
      raw.includes('vận chuyển') ||
      raw.includes('giao thành công') ||
      raw.includes('hoàn thành') ||
      raw.includes('completed') ||
      raw.includes('delivered') ||
      raw.includes('đã giao')
    ) {
      return true;
    }
    return false;
  };

  /**
   * Helper: Restore product and charm stock for orders deleted prior to production.
   */
  const restoreStockFromDeletedOrders = async (ordersToRestore: StoredOrder[]): Promise<{ restoredCount: number; productsUpdated: number }> => {
    if (ordersToRestore.length === 0) return { restoredCount: 0, productsUpdated: 0 };

    const productQuantityMap = new Map<string, number>();
    const charmQuantityMap = new Map<string, number>();
    let totalRestoredUnits = 0;

    for (const ord of ordersToRestore) {
      if (ord.itemDetails && ord.itemDetails.length > 0) {
        for (const item of ord.itemDetails) {
          if (!item.productId) continue;
          const qty = item.quantity || 1;
          productQuantityMap.set(item.productId, (productQuantityMap.get(item.productId) || 0) + qty);
          totalRestoredUnits += qty;

          if (item.selectedCharm) {
            const charmKey = `${item.productId}:::${item.selectedCharm.trim().toLowerCase()}`;
            charmQuantityMap.set(charmKey, (charmQuantityMap.get(charmKey) || 0) + qty);
          }
        }
      } else if (ord.items && ord.items.length > 0) {
        for (const itemStr of ord.items) {
          const matchedProd = products.find(
            (p) => p.id === itemStr || itemStr.toLowerCase().includes(p.name.toLowerCase())
          );
          if (matchedProd) {
            const qtyMatch = itemStr.match(/\(x(\d+)\)/);
            const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
            productQuantityMap.set(matchedProd.id, (productQuantityMap.get(matchedProd.id) || 0) + qty);
            totalRestoredUnits += qty;
          }
        }
      }
    }

    if (productQuantityMap.size === 0) return { restoredCount: 0, productsUpdated: 0 };

    let updatedCount = 0;
    const updatedProducts = products.map((prod) => {
      const qtyToAdd = productQuantityMap.get(prod.id);
      if (!qtyToAdd) return prod;

      updatedCount++;
      const currentStock = typeof prod.stock === 'number' ? prod.stock : 0;
      const newStock = currentStock + qtyToAdd;

      let updatedCharms = prod.charmOptions ? [...prod.charmOptions] : undefined;
      if (updatedCharms) {
        updatedCharms = updatedCharms.map((charm) => {
          const charmKey = `${prod.id}:::${charm.name.trim().toLowerCase()}`;
          const charmQtyToAdd = charmQuantityMap.get(charmKey);
          if (charmQtyToAdd && typeof charm.stock === 'number') {
            return {
              ...charm,
              stock: charm.stock + charmQtyToAdd
            };
          }
          return charm;
        });
      }

      const updatedProd: Product = {
        ...prod,
        stock: newStock,
        inStock: newStock > 0,
        charmOptions: updatedCharms
      };

      // Sync updated stock to Firestore
      saveProductToFirestore(updatedProd).catch((err) => {
        console.warn('Lỗi hoàn tồn kho lên Firebase:', err);
      });

      return updatedProd;
    });

    onUpdateProducts(updatedProducts);
    try {
      safeStorageSetItem('nak_products', JSON.stringify(updatedProducts));
    } catch (e) {
      console.warn('Lỗi lưu tồn kho local:', e);
    }

    return { restoredCount: totalRestoredUnits, productsUpdated: updatedCount };
  };

  // Delete an order with modal and smart stock management
  const handleDeleteOrder = (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const isProduced = targetOrder ? isOrderProducedOrCompleted(targetOrder) : false;

    setDeleteConfirmModal({
      title: 'Xóa đơn hàng',
      message: `Bạn có chắc chắn muốn xóa đơn hàng #${orderId}?`,
      submessage: isProduced
        ? 'Đơn hàng này đã/đang sản xuất hoặc hoàn tất nên số lượng tồn kho sẽ được giữ nguyên (không hoàn kho).'
        : 'Đơn hàng này chưa được xác nhận sản xuất. Khi xóa, hệ thống sẽ tự động hoàn lại số lượng sản phẩm vào tồn kho.',
      confirmLabel: 'Xóa đơn hàng',
      onConfirm: async () => {
        setDeleteConfirmModal(null);
        const updated = orders.filter((o) => o.id !== orderId);
        setOrders(updated);
        try {
          safeStorageSetItem('nak_preorders', JSON.stringify(updated));
          await deleteOrderFromFirestore(orderId);
        } catch (err) {
          console.warn('Delete order error:', err);
        }

        // If order was NOT produced, restore stock
        if (targetOrder && !isProduced) {
          const { restoredCount } = await restoreStockFromDeletedOrders([targetOrder]);
          if (restoredCount > 0) {
            showAdminToast(`Đã xóa đơn #${orderId} và tự động hoàn lại ${restoredCount} sản phẩm về tồn kho.`);
            return;
          }
        }

        showAdminToast(`Đã xóa đơn hàng #${orderId} thành công.`);
      }
    });
  };

  // Normalization Helpers for 3 Sources, 2 Payment Types, 4 Statuses
  const getNormalizedSource = (src?: string): 'website' | 'mạng xã hội' | 'trực tiếp' => {
    if (!src || src === 'website') return 'website';
    const s = src.toLowerCase();
    if (['facebook', 'zalo', 'instagram', 'tiktok', 'mạng xã hội', 'social'].includes(s)) return 'mạng xã hội';
    if (['hotline', 'phone', 'direct', 'trực tiếp', 'offline', 'store', 'other', 'cash'].includes(s)) return 'trực tiếp';
    return 'website';
  };

  const getNormalizedStatus = (st?: string): NormalizedOrderStatus => {
    return normalizeOrderStatus(st);
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
    const isPaidStatus = status === 'Đã thanh toán';
    
    // If status is Đã thanh toán and no receipt is attached yet, prompt popup
    if (isPaidStatus && !targetOrder.bankReceiptImage && !skipPrompt) {
      setReceiptPromptModal({ order: { ...targetOrder, status: normalizedSt, paymentStatus: 'paid' }, isPromptOnPaid: true });
      return;
    }

    const updated = orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: normalizedSt,
            paymentStatus: isPaidStatus ? 'paid' : o.paymentStatus || 'unpaid',
            paidAmount: isPaidStatus ? (o.totalPrice || o.totalAmount || 0) : o.paidAmount
          }
        : o
    );
    pushHistoryAction(`Đổi trạng thái đơn #${orderId} sang "${normalizedSt}"`, 'orders', orders, updated);
    setOrders(updated);
    safeStorageSetItem('nak_preorders', JSON.stringify(updated));
    const targetModOrder = updated.find((o) => o.id === orderId);
    if (targetModOrder) {
      await saveOrderToFirestore(targetModOrder);
    } else {
      await updateOrderStatusInFirestore(orderId, normalizedSt);
    }
    showAdminToast(`Đã chuyển đơn #${orderId} sang "${normalizedSt}".`);
  };

  // Save edited order
  const handleSaveEditedOrder = async (updatedOrder: StoredOrder) => {
    const updated = orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
    setOrders(updated);
    safeStorageSetItem('nak_preorders', JSON.stringify(updated));
    setEditingOrder(null);
    showAdminToast(`Đang đồng bộ đơn #${updatedOrder.id} lên Firebase...`);
    try {
      await saveOrderToFirestore(updatedOrder);
      showAdminToast(`Đã lưu & đồng bộ đơn hàng #${updatedOrder.id} lên Firebase!`);
    } catch (err: any) {
      console.warn('Lỗi lưu đơn hàng:', err);
      showAdminToast(`Đã lưu cục bộ. Lỗi Firebase: ${err?.message || 'Kiểm tra mạng'}`);
    }
  };

  // Save receipt image
  const handleSaveReceipt = async (orderId: string, receiptUrl: string, paymentStatus: 'paid' | 'unpaid') => {
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
    safeStorageSetItem('nak_preorders', JSON.stringify(updated));
    setReceiptPromptModal(null);
    const ordToSync = updated.find((o) => o.id === orderId);
    if (ordToSync) {
      try {
        await saveOrderToFirestore(ordToSync);
        showAdminToast(`Đã lưu & đồng bộ ảnh bill chuyển khoản cho đơn #${orderId}!`);
      } catch (e) {
        showAdminToast(`Đã lưu ảnh bill chuyển khoản cho đơn #${orderId}!`);
      }
    }
  };

  // Bulk Deletion with smart stock management
  const handleBulkDelete = () => {
    if (selectedOrderIds.length === 0) return;
    const count = selectedOrderIds.length;
    const idsToDelete = [...selectedOrderIds];
    const targetOrders = orders.filter((o) => o.id && idsToDelete.includes(o.id));
    const unproducedOrders = targetOrders.filter((o) => !isOrderProducedOrCompleted(o));
    const producedOrders = targetOrders.filter((o) => isOrderProducedOrCompleted(o));

    setDeleteConfirmModal({
      title: `Xác nhận xóa ${count} đơn hàng`,
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${count} đơn hàng đã chọn?`,
      submessage: unproducedOrders.length > 0
        ? `Có ${unproducedOrders.length} đơn chưa sản xuất (sẽ tự động hoàn tồn kho), và ${producedOrders.length} đơn đã/đang sản xuất hoặc hoàn tất (giữ nguyên tồn kho).`
        : 'Các đơn đã chọn đều đã/đang sản xuất hoặc hoàn tất nên số lượng tồn kho sẽ được giữ nguyên (không hoàn kho).',
      confirmLabel: `Xóa ${count} Đơn`,
      onConfirm: async () => {
        setDeleteConfirmModal(null);
        setSelectedOrderIds([]);
        const remaining = orders.filter((o) => o.id && !idsToDelete.includes(o.id));
        setOrders(remaining);
        try {
          safeStorageSetItem('nak_preorders', JSON.stringify(remaining));
        } catch (e) {
          console.warn('Lỗi lưu đơn local:', e);
        }

        // Batch delete on Firestore in a single atomic commit
        try {
          await deleteOrdersBatchFromFirestore(idsToDelete);
        } catch (e) {
          console.error('Lỗi xóa đơn bulk Firestore:', e);
        }

        // Restore stock only for unproduced orders
        if (unproducedOrders.length > 0) {
          const { restoredCount } = await restoreStockFromDeletedOrders(unproducedOrders);
          if (restoredCount > 0) {
            showAdminToast(`Đã xóa ${count} đơn hàng và hoàn lại ${restoredCount} sản phẩm về tồn kho.`);
            return;
          }
        }

        showAdminToast(`Đã xóa ${count} đơn hàng thành công.`);
      }
    });
  };

  // Bulk Status Update
  const handleBulkUpdateStatus = async (newStatus: NormalizedOrderStatus) => {
    if (selectedOrderIds.length === 0) return;
    const updated = orders.map((o) =>
      o.id && selectedOrderIds.includes(o.id)
        ? {
            ...o,
            status: newStatus
          }
        : o
    );
    setOrders(updated);
    safeStorageSetItem('nak_preorders', JSON.stringify(updated));
    const toSync = updated.filter((o) => o.id && selectedOrderIds.includes(o.id));
    for (const ord of toSync) {
      try {
        await saveOrderToFirestore(ord);
      } catch (e) {
        console.error('Lỗi bulk update status:', ord.id, e);
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
    safeStorageSetItem('nak_preorders', JSON.stringify(updated));
    const toSync = updated.filter((o) => o.id && selectedOrderIds.includes(o.id));
    for (const ord of toSync) {
      try {
        await saveOrderToFirestore(ord);
      } catch (e) {
        console.warn('Lỗi bulk sync payment:', e);
      }
    }
    showAdminToast(`Đã cập nhật & đồng bộ thanh toán cho ${selectedOrderIds.length} đơn.`);
    setSelectedOrderIds([]);
  };

  // Calculate sold count for each product from real orders + manual initial sold count
  const productSoldMap = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((ord) => {
      const st = (ord.status || '').toLowerCase();
      if (st.includes('hủy') || st.includes('cancel')) return;

      // Check item strings (e.g. "Vòng Tay Non Sông x 2")
      if (ord.items && Array.isArray(ord.items)) {
        ord.items.forEach((itemStr) => {
          products.forEach((p) => {
            if (
              itemStr.toLowerCase().includes(p.name.toLowerCase()) ||
              (p.id && itemStr.toLowerCase().includes(p.id.toLowerCase()))
            ) {
              const matchQty = itemStr.match(/x\s*(\d+)/i) || itemStr.match(/\b(\d+)\s*(cái|chiếc|sp|mẫu)/i);
              const qty = matchQty ? parseInt(matchQty[1], 10) : 1;
              map[p.id] = (map[p.id] || 0) + (isNaN(qty) ? 1 : qty);
            }
          });
        });
      }

      // Check structured cart items if present
      if ((ord as any).cart && Array.isArray((ord as any).cart)) {
        (ord as any).cart.forEach((cItem: any) => {
          const prodId = cItem.product?.id || cItem.productId;
          const qty = cItem.quantity || 1;
          if (prodId) {
            map[prodId] = (map[prodId] || 0) + (typeof qty === 'number' ? qty : 1);
          }
        });
      }
    });

    return map;
  }, [orders, products]);

  const totalSoldProducts = useMemo(() => {
    return products.reduce((acc, p) => {
      const sold = (productSoldMap[p.id] || 0) + (p.soldCount || 0);
      return acc + sold;
    }, 0);
  }, [products, productSoldMap]);

  // Filtered Products in Admin Table
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(adminSearch.toLowerCase());
      const matchesCategory =
        adminCategoryFilter === 'all' || p.category === adminCategoryFilter;
      
      const stockCount = p.stock ?? 15;
      const isAvailable = p.inStock !== false && stockCount > 0;
      let matchesStock = true;
      if (adminStockFilter === 'in_stock') {
        matchesStock = isAvailable;
      } else if (adminStockFilter === 'out_of_stock') {
        matchesStock = !isAvailable;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, adminSearch, adminCategoryFilter, adminStockFilter]);

  // Set of category IDs that are marked as hidden
  const hiddenCategoryIds = useMemo(() => {
    return new Set(localCategories.filter((c) => c.isHidden).map((c) => c.id));
  }, [localCategories]);

  // A product is considered hidden if it is explicitly hidden OR belongs to a hidden category
  const isProductHidden = (p: Product) => {
    return Boolean(p.isHidden) || Boolean(hiddenCategoryIds.has(p.category));
  };

  // Separate active (visible) products from hidden products
  const filteredActiveProducts = useMemo(() => {
    return filteredProducts.filter((p) => !isProductHidden(p));
  }, [filteredProducts, hiddenCategoryIds]);

  const allHiddenProducts = useMemo(() => {
    return products.filter((p) => isProductHidden(p));
  }, [products, hiddenCategoryIds]);

  const filteredHiddenProducts = useMemo(() => {
    return allHiddenProducts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(adminSearch.toLowerCase());
      const matchesCategory =
        adminCategoryFilter === 'all' || p.category === adminCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [allHiddenProducts, adminSearch, adminCategoryFilter]);

  // Filtered Orders with multi-dimensional criteria (category filter, 3 sources, 2 payment types, 3 statuses, seller filter & dynamic sort)
  const filteredOrders = useMemo(() => {
    const getOrderCategoryIds = (o: any): string[] => {
      const cats = new Set<string>();
      if (o.isEvent0209 || o.type === 'preorder_0209') {
        cats.add('event_0209');
      }
      if (o.itemDetails && Array.isArray(o.itemDetails) && o.itemDetails.length > 0) {
        o.itemDetails.forEach((it: any) => {
          if (it.productId) {
            const p = products.find((prod) => prod.id === it.productId);
            if (p?.category) cats.add(p.category);
          }
          if (it.productName || it.name) {
            const nameToFind = (it.productName || it.name || '').trim().toLowerCase();
            const p = products.find((prod) => prod.name.trim().toLowerCase() === nameToFind);
            if (p?.category) cats.add(p.category);
          }
        });
      }
      if (o.items && Array.isArray(o.items) && o.items.length > 0) {
        o.items.forEach((itemStr: string) => {
          const lower = itemStr.toLowerCase();
          const p = products.find((prod) => lower.includes(prod.name.toLowerCase()));
          if (p?.category) cats.add(p.category);
        });
      }
      return Array.from(cats);
    };

    const getPrimaryCategoryLabel = (o: any): string => {
      const catIds = getOrderCategoryIds(o);
      if (catIds.length === 0) return 'Khác';
      const cat = localCategories.find((c) => c.id === catIds[0]);
      return cat ? cat.label : catIds[0];
    };

    const list = orders.filter((o) => {
      const q = orderSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.name && o.name.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.phone && o.phone.toLowerCase().includes(q)) ||
        (o.address && o.address.toLowerCase().includes(q)) ||
        ((Array.isArray(o.items) && o.items.some((i) => typeof i === 'string' && i.toLowerCase().includes(q))) || (typeof o.items === 'string' && (o.items as string).toLowerCase().includes(q))) ||
        (o.note && o.note.toLowerCase().includes(q)) ||
        (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q)) ||
        (o.shippingCode && o.shippingCode.toLowerCase().includes(q)) ||
        (o.shippingCarrier && o.shippingCarrier.toLowerCase().includes(q)) ||
        (o.sellerName && o.sellerName.toLowerCase().includes(q)) ||
        (o.bankTransferRef && o.bankTransferRef.toLowerCase().includes(q));

      const matchType =
        orderFilterType === 'all' ||
        (orderFilterType === '0209' && (o.isEvent0209 || o.type === 'preorder_0209')) ||
        (orderFilterType === 'standard' && !o.isEvent0209 && o.type !== 'preorder_0209');

      const matchCategory = (() => {
        if (orderCategoryFilter === 'all') return true;
        const catIds = getOrderCategoryIds(o);
        return catIds.includes(orderCategoryFilter);
      })();

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

      const matchSeller = (() => {
        if (orderSellerFilter === 'all') return true;
        const isLockedSource = o.source === 'website' || o.source === 'mạng xã hội' || o.source === 'facebook' || o.source === 'tiktok' || o.source === 'instagram' || o.source === 'zalo' || o.source === 'shopee';
        const sName = (o.sellerName || '').trim().toLowerCase();
        if (orderSellerFilter === 'website') {
          return o.source === 'website' || (!o.sellerId && (!sName || sName === 'website'));
        }
        if (orderSellerFilter === 'social') {
          return o.source === 'mạng xã hội' || o.source === 'facebook' || o.source === 'tiktok' || o.source === 'instagram' || o.source === 'zalo';
        }
        if (orderSellerFilter === 'unassigned') {
          return isLockedSource || (!o.sellerId && (!sName || sName === 'website' || sName === 'mạng xã hội'));
        }
        // Specific seller selected - locked sources are never assigned to individual salespeople
        if (isLockedSource) return false;
        return (
          o.sellerId === orderSellerFilter ||
          (o.sellerName && o.sellerName.toLowerCase() === orderSellerFilter.toLowerCase())
        );
      })();

      return matchSearch && matchType && matchCategory && matchSource && matchStatus && matchPaymentStatus && matchReceipt && matchSeller;
    });

    // Dynamic Multi-field Sorting
    return list.sort((a, b) => {
      if (orderSortBy === 'date_desc') {
        const timeA = new Date(a.date || a.createdAt || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || 0).getTime();
        return timeB - timeA;
      }
      if (orderSortBy === 'date_asc') {
        const timeA = new Date(a.date || a.createdAt || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || 0).getTime();
        return timeA - timeB;
      }
      if (orderSortBy === 'category_asc') {
        const cA = getPrimaryCategoryLabel(a).toLowerCase();
        const cB = getPrimaryCategoryLabel(b).toLowerCase();
        return cA.localeCompare(cB, 'vi');
      }
      if (orderSortBy === 'category_desc') {
        const cA = getPrimaryCategoryLabel(a).toLowerCase();
        const cB = getPrimaryCategoryLabel(b).toLowerCase();
        return cB.localeCompare(cA, 'vi');
      }
      if (orderSortBy === 'seller_asc') {
        const isLockedA = a.source === 'website' || a.source === 'mạng xã hội';
        const isLockedB = b.source === 'website' || b.source === 'mạng xã hội';
        const sA = isLockedA ? '' : (a.sellerName || '').toLowerCase();
        const sB = isLockedB ? '' : (b.sellerName || '').toLowerCase();
        return sA.localeCompare(sB, 'vi');
      }
      if (orderSortBy === 'seller_desc') {
        const isLockedA = a.source === 'website' || a.source === 'mạng xã hội';
        const isLockedB = b.source === 'website' || b.source === 'mạng xã hội';
        const sA = isLockedA ? '' : (a.sellerName || '').toLowerCase();
        const sB = isLockedB ? '' : (b.sellerName || '').toLowerCase();
        return sB.localeCompare(sA, 'vi');
      }
      if (orderSortBy === 'total_desc') {
        const tA = a.totalPrice || a.totalAmount || 0;
        const tB = b.totalPrice || b.totalAmount || 0;
        return tB - tA;
      }
      if (orderSortBy === 'total_asc') {
        const tA = a.totalPrice || a.totalAmount || 0;
        const tB = b.totalPrice || b.totalAmount || 0;
        return tA - tB;
      }
      if (orderSortBy === 'name_asc') {
        const nA = (a.name || a.customerName || '').toLowerCase();
        const nB = (b.name || b.customerName || '').toLowerCase();
        return nA.localeCompare(nB, 'vi');
      }
      return 0;
    });
  }, [
    orders,
    products,
    localCategories,
    orderSearchQuery,
    orderFilterType,
    orderCategoryFilter,
    orderSourceFilter,
    orderStatusFilter,
    orderPaymentStatusFilter,
    orderHasReceiptFilter,
    orderSellerFilter,
    orderSortBy
  ]);

  // Reset page to 1 when filters or query change
  useEffect(() => {
    setOrderCurrentPage(1);
  }, [
    orderSearchQuery,
    orderFilterType,
    orderCategoryFilter,
    orderSourceFilter,
    orderStatusFilter,
    orderPaymentStatusFilter,
    orderHasReceiptFilter,
    orderSellerFilter,
    orderSortBy
  ]);

  // Order Table Pagination Calculations
  const pageSizeNum = orderPageSize === 'all' ? (filteredOrders.length || 1) : Number(orderPageSize);
  const totalOrderPages = orderPageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredOrders.length / (pageSizeNum || 10)));
  const safeOrderPage = Math.min(Math.max(1, orderCurrentPage), totalOrderPages);
  const orderStartIndex = orderPageSize === 'all' ? 0 : (safeOrderPage - 1) * pageSizeNum;
  const orderEndIndex = orderPageSize === 'all' ? filteredOrders.length : Math.min(filteredOrders.length, orderStartIndex + pageSizeNum);
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice(orderStartIndex, orderEndIndex);
  }, [filteredOrders, orderStartIndex, orderEndIndex]);

  // Summary Metrics
  const inStockCount = products.filter((p) => p.inStock !== false && (p.stock ?? 15) > 0).length;
  const outOfStockCount = products.filter((p) => p.inStock === false || (p.stock ?? 0) === 0).length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || o.totalAmount || 0), 0);

  const getTabDisplayName = (): string => {
    switch (activeTab) {
      case 'dashboard':
        return 'Tổng quan';
      case 'analytics':
        return 'Truy cập & GA4';
      case 'orders':
        return 'Đơn hàng';
      case 'manual_order':
        return 'Tạo đơn hàng';
      case 'messages':
        return 'Hộp thư liên hệ';
      case 'products':
        return 'Sản phẩm';
      case 'categories':
        return 'Danh mục';
      case 'site_editor':
        return 'Sửa giao diện';
      case 'bank_account':
        return 'Tài khoản ngân hàng';
      case 'banners':
        return 'Banners & Bộ sưu tập';
      case 'version_history':
        return 'Lịch sử phiên bản';
      case 'backup':
        return 'Sao lưu & Phục hồi';
      case 'sellers':
        return 'Quản trị viên';
      case 'firebase':
        return 'Dung lượng Firebase';
      default:
        return 'Quản trị';
    }
  };

  const currentTabTitle = getTabDisplayName();

  return (
    <div id="admin-full-page" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row font-sans">
      {/* Sidebar Navigation */}
      <AdminSidebar
        activeTab={activeTab}
        onSwitchTab={handleSwitchTab}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        desktopSidebarCollapsed={desktopSidebarCollapsed}
        onToggleDesktopSidebar={() => setDesktopSidebarCollapsed((prev) => !prev)}
        siteContent={siteContent}
        currentSeller={currentSeller}
        isRootAdmin={isRootAdmin}
        unreadMessagesCount={unreadMessagesCount}
        ordersCount={orders.length}
        productsCount={products.length}
        categoriesCount={localCategories.length}
        collectionsCount={localCollections.length}
        sellersCount={sellers.length}
        onBackToStore={onBackToStore}
        onLogout={onLogout}
        onOpenSwitchSellerModal={() => {
          if (isRootAdmin) {
            handleSwitchTab('sellers');
          } else if (onLogout) {
            onLogout();
          }
        }}
      />

      {/* ======================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Content Header Bar */}
        <AdminHeader
          pageTitle={currentTabTitle}
          desktopSidebarCollapsed={desktopSidebarCollapsed}
          onToggleDesktopSidebar={() => setDesktopSidebarCollapsed((prev) => !prev)}
          onOpenMobileSidebar={() => setSidebarOpen(true)}
          orders={orders}
          contactMessages={contactMessages}
          productsCount={products.length}
          categoriesCount={localCategories.length}
          unreadMessagesCount={unreadMessagesCount}
          onInspectOrder={(ord) => setInspectingOrder(ord)}
          onNavigateToOrders={() => handleSwitchTab('orders')}
          onNavigateToMessages={() => handleSwitchTab('messages')}
          onNavigateToProducts={() => handleSwitchTab('products')}
          onNavigateToCategories={() => handleSwitchTab('categories')}
          onUpdateOrderStatus={(orderId, status) => handleUpdateOrderStatus(orderId, status)}
          onMarkMessageRead={handleMarkMessageRead}
          onRefreshData={() => {
            loadOrders();
            loadMessagesCount();
            showAdminToast('Đã làm mới dữ liệu đơn hàng & hộp thư.');
          }}
          isCloudSyncing={isCloudSyncing}
          onPushAllToCloud={handlePushAllToCloud}
          onFetchFromCloud={() => {
            showAdminToast('Đang làm mới & đồng bộ dữ liệu từ Firestore...');
            handleFetchFromCloud();
            loadOrders();
            loadMessagesCount();
          }}
          onBackToStore={onBackToStore}
        />

        {/* Cloud Sync Status Banner */}
        {cloudSyncMessage && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 text-amber-900 text-xs font-semibold flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2 w-full">
              <span>{cloudSyncMessage}</span>
            </div>
          </div>
        )}

        {/* Main Workspace Tabs Container (Full width for maximum table space, with extra pb for mobile bottom nav) */}
        <main className="flex-grow w-full px-2.5 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-4 pb-24 lg:pb-6">
        
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
            categories={categories}
            collections={collections}
            products={products}
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
        {/* TAB: TÀI KHOẢN NGÂN HÀNG (VIETQR) */}
        {/* ======================================================== */}
        {activeTab === 'bank_account' && (
          <AdminBankAccountPage
            siteContent={siteContent}
            onUpdateSiteContent={onUpdateSiteContent}
            onToast={showAdminToast}
          />
        )}

        {/* ======================================================== */}
        {/* TAB: VERSION HISTORY (LỊCH SỬ PHIÊN BẢN & AUTO BACKUP) */}
        {/* ======================================================== */}
        {activeTab === 'version_history' && (
          <AdminVersionHistoryPage
            products={products}
            categories={localCategories}
            collections={localCollections}
            siteContent={siteContent}
            onUpdateProducts={onUpdateProducts}
            onUpdateCategories={(newCats) => {
              setLocalCategories(newCats);
              onUpdateCategories?.(newCats);
            }}
            onUpdateCollections={(newColls) => {
              setLocalCollections(newColls);
              onUpdateCollections?.(newColls);
            }}
            onUpdateSiteContent={(newCfg) => {
              onUpdateSiteContent?.(newCfg);
            }}
            onNotify={showAdminToast}
            currentSellerName={currentSeller?.displayName || currentSeller?.username}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 1: SẢN PHẨM & TỒN KHO */}
        {/* ======================================================== */}
        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
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
                <span className="text-xs text-slate-500 block font-medium">Tạm Hết Hàng</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-rose-600">{outOfStockCount}</span>
                  <span className="text-xs text-rose-700">cần thêm</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 block font-medium">Tổng Đã Bán</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-amber-600">{totalSoldProducts}</span>
                  <span className="text-xs text-amber-700">sản phẩm</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
                <span className="text-xs text-slate-500 block font-medium">Tổng Doanh Số Đơn</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl sm:text-2xl font-black text-slate-900">
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
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <span>+ Thêm Sản Phẩm Mới</span>
                </button>

                <button
                  onClick={() => handleSwitchTab('categories')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
                >
                  <span>Sửa Danh Mục BST</span>
                </button>

                <button
                  onClick={handlePushAllToCloud}
                  disabled={isCloudSyncing}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  title="Đẩy danh sách sản phẩm hiện tại lên Firebase Cloud (Dọn sạch các sản phẩm đã xóa trên Cloud để Cloud khớp chính xác với máy bạn)"
                >
                  <CloudUpload className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
                  <span>{isCloudSyncing ? 'Đang Đẩy...' : 'Đẩy Lên Cloud'}</span>
                </button>

                <button
                  onClick={handleFetchFromCloud}
                  disabled={isCloudSyncing}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
                  title="Kéo dữ liệu sản phẩm từ Firebase Firestore về máy"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                  <span>Đồng Bộ Từ Cloud</span>
                </button>

                <button
                  onClick={handleExportProductsJSON}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
                  title="Xuất file JSON sao lưu"
                >
                  <span>Sao Lưu JSON</span>
                </button>

                <button
                  onClick={handleResetDefaults}
                  className="px-3 py-2 text-slate-500 hover:text-rose-600 text-xs font-medium transition-colors cursor-pointer"
                  title="Khôi phục danh sách gốc"
                >
                  Khôi phục gốc
                </button>
              </div>

              {/* Search & Dynamic Filters (Category + Stock status) + View Switcher */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* View Mode Toggle: Cards vs Table */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setProductViewMode('cards')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      productViewMode === 'cards'
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Xem dạng thẻ (tối ưu điện thoại)"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Thẻ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductViewMode('table')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      productViewMode === 'table'
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Xem dạng bảng"
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Bảng</span>
                  </button>
                </div>

                <div className="relative flex-grow sm:flex-grow-0">
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Tìm tên, mã sản phẩm..."
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white w-full sm:w-48"
                  />
                </div>

                <select
                  value={adminCategoryFilter}
                  onChange={(e) => setAdminCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                >
                  <option value="all">Tất cả BST ({products.length})</option>
                  {localCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label} ({products.filter((p) => p.category === cat.id).length})
                    </option>
                  ))}
                </select>

                <select
                  value={adminStockFilter}
                  onChange={(e: any) => setAdminStockFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                >
                  <option value="all">Tất cả trạng thái ({products.length})</option>
                  <option value="in_stock">🟢 Còn hàng ({inStockCount})</option>
                  <option value="out_of_stock">🔴 Hết hàng ({outOfStockCount})</option>
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

                      {/* FIXED PRICE & STOCK & SOLD INPUTS: Resilient 4-column layout */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Số lượng đã bán
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formSoldCount}
                            onChange={(e) => setFormSoldCount(Math.max(0, Number(e.target.value) || 0))}
                            placeholder="0"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                          />
                          <span className="text-[10px] text-slate-400 block mt-1">
                            Khởi tạo / cộng dồn
                          </span>
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

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                          <span>Link liên kết riêng của sản phẩm (Tùy chọn)</span>
                          <span className="text-[10px] text-slate-400 font-normal">Shopee, TikTok Shop, Web ngoài...</span>
                        </label>
                        <input
                          type="url"
                          value={formCustomUrl}
                          onChange={(e) => setFormCustomUrl(e.target.value)}
                          placeholder="https://shopee.vn/... (nút Chi tiết trên bộ sưu tập sẽ bay đến đây nếu bật)"
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
                              Tải ảnh trực tiếp từ máy tính hoặc kéo thả ảnh vào khung. Ảnh đầu tiên (#1) là <span className="font-bold text-amber-700">ảnh đại diện</span>.
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

                        {/* Drag and Drop Zone for multiple files */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsImageDragging(true);
                          }}
                          onDragLeave={() => setIsImageDragging(false)}
                          onDrop={handleImageDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 group ${
                            isImageDragging
                              ? 'border-amber-500 bg-amber-100/90 scale-[1.01] ring-4 ring-amber-400/30'
                              : 'border-amber-300/80 bg-amber-50/50 hover:border-amber-500 hover:bg-amber-50/90'
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
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                              <Upload className="w-6 h-6 text-amber-700" />
                            </div>
                            <div>
                              <div className="text-sm font-black text-slate-900">
                                Kéo thả ảnh vào đây hoặc <span className="text-amber-700 underline underline-offset-2">Bấm để tải từ máy</span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                Hỗ trợ PNG, JPG, JPEG, WEBP • Có thể chọn & kéo thả nhiều ảnh cùng lúc
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Images list with reordering */}
                        {formImages.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[11px] font-bold text-slate-700">
                              Danh sách ảnh đã tải ({formImages.length} ảnh) — dùng ← → để đổi thứ tự:
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
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
                                      src={imgSrc || '/assets/bracelet.jpg'}
                                      alt={`Ảnh ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-1.5 left-1.5">
                                      {idx === 0 ? (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-500 text-slate-950 shadow-xs">
                                          ★ Đại diện (#1)
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
                          </div>
                        )}

                        {/* Collapsible secondary URL option */}
                        <div className="pt-0.5">
                          {!showUrlInput ? (
                            <button
                              type="button"
                              onClick={() => setShowUrlInput(true)}
                              className="text-[11px] text-slate-400 hover:text-amber-700 font-medium transition-colors"
                            >
                              + Dán link URL ảnh nếu có
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                              <input
                                type="text"
                                value={newImageUrlInput}
                                onChange={(e) => setNewImageUrlInput(e.target.value)}
                                placeholder="Dán URL ảnh trực tiếp (https://...)"
                                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                              />
                              <button
                                type="button"
                                onClick={handleAddImageUrl}
                                disabled={!newImageUrlInput.trim()}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-lg text-xs font-bold shrink-0 transition-colors"
                              >
                                + Thêm Link
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowUrlInput(false)}
                                className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs font-semibold"
                              >
                                Đóng
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Badges and check flags */}
                      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100">
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

                        <label className="flex items-center gap-2 text-xs font-bold text-rose-700 cursor-pointer bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors">
                          <input
                            type="checkbox"
                            checked={formIsHidden}
                            onChange={(e) => setFormIsHidden(e.target.checked)}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span>Ẩn sản phẩm khỏi website</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Product Variations Section (Colors with linked images, Charms with photos, Sizes) */}
                  <div className="pt-5 border-t border-slate-200 space-y-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          Tùy chọn phân loại sản phẩm (Màu sắc, Charm, Kích thước)
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Bật hoặc tắt từng phân loại tùy theo từng sản phẩm. Mỗi màu có thể liên kết 1 hình ảnh riêng (khách bấm màu sẽ tự động đổi sang ảnh đó), mỗi charm có ảnh đại diện và phụ thu riêng.
                      </p>
                    </div>

                    {/* 1. COLOR OPTIONS */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formEnableColorSelection}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormEnableColorSelection(checked);
                              if (checked && formColorOptions.length === 0) {
                                setFormColorOptions([
                                  { name: 'Đỏ Hào Khí', colorCode: '#B41C1A', image: formImages[0] || '' },
                                  { name: 'Đen Tactical', colorCode: '#1E293B', image: formImages[1] || formImages[0] || '' }
                                ]);
                              }
                            }}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900">
                              🎨 Bật tùy chọn Màu sắc (Color Options)
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              Cho phép khách hàng chọn màu sắc với ảnh liên kết tương ứng
                            </span>
                          </div>
                        </label>

                        {formEnableColorSelection && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setFormColorOptions([
                                  { name: 'Đỏ Hào Khí', colorCode: '#B41C1A', image: formImages[0] || '' },
                                  { name: 'Đen Tactical', colorCode: '#1E293B', image: formImages[1] || '' },
                                  { name: 'Xanh Rêu EDC', colorCode: '#3F6212', image: formImages[2] || '' },
                                  { name: 'Xanh Navy', colorCode: '#1E3A8A', image: formImages[3] || '' },
                                  { name: 'Cát Sa Mạc', colorCode: '#D97706', image: formImages[4] || '' }
                                ]);
                              }}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              ⚡ Nạp 5 màu mẫu
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormColorOptions((prev) => [
                                  ...prev,
                                  { name: `Màu ${prev.length + 1}`, colorCode: '#B41C1A', image: '' }
                                ]);
                              }}
                              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Thêm Màu</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {formEnableColorSelection && (
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          {formColorOptions.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2 text-center">
                              Chưa có màu nào. Bấm "+ Thêm Màu" hoặc "Nạp 5 màu mẫu" ở trên.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {formColorOptions.map((col, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col gap-2 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="color"
                                        value={col.colorCode || '#B41C1A'}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setFormColorOptions((prev) =>
                                            prev.map((c, i) => (i === cIdx ? { ...c, colorCode: val } : c))
                                          );
                                        }}
                                        className="w-7 h-7 rounded-lg border border-slate-300 p-0.5 cursor-pointer bg-transparent"
                                        title="Chọn mã màu hiển thị"
                                      />
                                      <input
                                        type="text"
                                        value={col.name}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setFormColorOptions((prev) =>
                                            prev.map((c, i) => (i === cIdx ? { ...c, name: val } : c))
                                          );
                                        }}
                                        placeholder="Tên màu (vd: Đỏ Hào Khí)"
                                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 w-36"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormColorOptions((prev) => prev.filter((_, i) => i !== cIdx));
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg text-xs"
                                      title="Xóa màu này"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  {/* Linked Photo for this color with file upload & drop */}
                                  <div
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      const file = e.dataTransfer.files?.[0];
                                      if (file) {
                                        processOptionImageFile(file, (dataUrl) => {
                                          setFormColorOptions((prev) =>
                                            prev.map((c, i) => (i === cIdx ? { ...c, image: dataUrl } : c))
                                          );
                                        }, 800);
                                      }
                                    }}
                                    className="flex items-center gap-2 pt-1 border-t border-slate-100"
                                  >
                                    <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 group">
                                      {col.image && col.image.trim() ? (
                                        <>
                                          <img
                                            src={col.image}
                                            alt={col.name}
                                            className="w-full h-full object-cover"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFormColorOptions((prev) =>
                                                prev.map((c, i) => (i === cIdx ? { ...c, image: '' } : c))
                                              );
                                            }}
                                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity"
                                            title="Gỡ ảnh màu"
                                          >
                                            ✕
                                          </button>
                                        </>
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400">
                                          Không ảnh
                                        </div>
                                      )}
                                    </div>
                                    <input
                                      id={`color-file-${cIdx}`}
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          processOptionImageFile(file, (dataUrl) => {
                                            setFormColorOptions((prev) =>
                                              prev.map((c, i) => (i === cIdx ? { ...c, image: dataUrl } : c))
                                            );
                                          }, 800);
                                        }
                                        e.target.value = '';
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => document.getElementById(`color-file-${cIdx}`)?.click()}
                                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                                      title="Tải ảnh riêng cho màu này từ máy"
                                    >
                                      <Upload className="w-3 h-3 text-amber-700" />
                                      <span>{col.image ? 'Đổi ảnh' : 'Tải ảnh máy'}</span>
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <input
                                        type="text"
                                        value={col.image || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setFormColorOptions((prev) =>
                                            prev.map((c, i) => (i === cIdx ? { ...c, image: val } : c))
                                          );
                                        }}
                                        placeholder="URL ảnh riêng khi chọn màu này..."
                                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                                      />
                                    </div>
                                    {formImages.length > 0 && (
                                      <select
                                        onChange={(e) => {
                                          const selectedImg = e.target.value;
                                          if (selectedImg) {
                                            setFormColorOptions((prev) =>
                                              prev.map((c, i) => (i === cIdx ? { ...c, image: selectedImg } : c))
                                            );
                                          }
                                        }}
                                        value=""
                                        className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold text-slate-700 cursor-pointer"
                                        title="Gán nhanh từ ảnh sản phẩm đã tải lên"
                                      >
                                        <option value="" disabled>Gán từ ảnh SP</option>
                                        {formImages.map((imgUrl, imgIdx) => (
                                          <option key={imgIdx} value={imgUrl}>
                                            Ảnh #{imgIdx + 1}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. CHARM OPTIONS */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formEnableCharmSelection}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormEnableCharmSelection(checked);
                              if (checked && formCharmOptions.length === 0) {
                                setFormCharmOptions(DEFAULT_CHARM_PRESETS);
                              }
                            }}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900">
                              ✨ Bật tùy chọn Phụ kiện 1 (Mặc định: Charm - Có thể đổi tên)
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              Khách hàng có thể chọn mẫu charm/phụ kiện kèm theo có ảnh trực quan và quản lý tồn kho từng món
                            </span>
                          </div>
                        </label>

                        {formEnableCharmSelection && (
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formCharmSelectionRequired}
                                onChange={(e) => setFormCharmSelectionRequired(e.target.checked)}
                                className="rounded text-amber-600 focus:ring-amber-500"
                              />
                              <span>Bắt buộc chọn</span>
                            </label>
                            <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                              <span>Tối đa chọn:</span>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={formMaxCharmsAllowed}
                                onChange={(e) => setFormMaxCharmsAllowed(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="w-12 px-1 py-0.5 border border-slate-200 rounded text-center font-bold text-amber-900 focus:outline-none focus:border-amber-500 text-xs"
                              />
                              <span>món</span>
                            </label>
                            {/* Hidden bulk file input for charms */}
                            <input
                              type="file"
                              id="bulk-charm-files-input"
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                handleBulkCharmUpload(e.target.files);
                                e.target.value = '';
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => document.getElementById('bulk-charm-files-input')?.click()}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="Chọn nhiều file ảnh từ máy để nạp charm cùng lúc"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Tải nhiều ảnh</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormCharmOptions(DEFAULT_CHARM_PRESETS);
                              }}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              ⚡ Nạp 8 Charm mẫu có kho
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newId = `charm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
                                setFormCharmOptions((prev) => [
                                  ...prev,
                                  { 
                                    id: newId, 
                                    name: `Mẫu mới ${prev.length + 1}`, 
                                    image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=300&auto=format&fit=crop&q=80', 
                                    priceDelta: 0,
                                    stock: 10
                                  }
                                ]);
                              }}
                              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Thêm Mẫu Mới</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {formEnableCharmSelection && (
                        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shadow-2xs">
                          <label className="text-xs font-bold text-amber-950 shrink-0 flex items-center gap-1.5">
                            🏷️ Đổi tên tiêu đề hiển thị:
                          </label>
                          <input
                            type="text"
                            value={formCharmTitle}
                            onChange={(e) => setFormCharmTitle(e.target.value)}
                            placeholder="Mặc định: Chọn Charm (vd: Chọn Charm, Chọn Phụ Kiện, Chọn Mặt Dây, Khóa Cài...)"
                            className="w-full flex-1 px-3 py-1.5 bg-white border border-amber-300/80 rounded-lg text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      )}

                      {formEnableCharmSelection && (
                        <div
                          onDragOver={(e) => {
                            if (e.dataTransfer.types.includes('Files')) {
                              e.preventDefault();
                              setIsBulkCharmDragOver(true);
                            }
                          }}
                          onDragLeave={(e) => {
                            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                            setIsBulkCharmDragOver(false);
                          }}
                          onDrop={(e) => {
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              e.preventDefault();
                              setIsBulkCharmDragOver(false);
                              handleBulkCharmUpload(e.dataTransfer.files);
                            }
                          }}
                          className={`space-y-2 pt-2 border-t border-slate-200 relative transition-all ${
                            isBulkCharmDragOver ? 'ring-2 ring-amber-500 rounded-xl bg-amber-50/40 p-2' : ''
                          }`}
                        >
                          {isBulkCharmDragOver && (
                            <div className="p-4 border-2 border-dashed border-amber-400 bg-amber-100/70 rounded-xl text-center text-amber-900 font-bold text-xs flex items-center justify-center gap-2 mb-2 animate-pulse">
                              <Upload className="w-4 h-4" />
                              <span>Thả các file ảnh vào đây để tự động tạo nhiều charm mới!</span>
                            </div>
                          )}

                          {formCharmOptions.length === 0 ? (
                            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
                              <p className="text-xs text-slate-500 font-medium">
                                Chưa có mẫu charm nào. Kéo thả ảnh charm trực tiếp vào đây hoặc bấm nút phía trên.
                              </p>
                              <button
                                type="button"
                                onClick={() => document.getElementById('bulk-charm-files-input')?.click()}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Chọn ảnh tải lên</span>
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {formCharmOptions.map((charm, chIdx) => (
                                <div
                                  key={charm.id || chIdx}
                                  onDragEnter={(e) => {
                                    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/uri-list')) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setDragOverCharmFileIdx(chIdx);
                                    }
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/uri-list')) {
                                      if (dragOverCharmFileIdx !== chIdx) setDragOverCharmFileIdx(chIdx);
                                    } else if (draggedCharmIndex !== null && draggedCharmIndex !== chIdx) {
                                      setActiveCharmDropIndex(chIdx);
                                    }
                                  }}
                                  onDragLeave={(e) => {
                                    e.preventDefault();
                                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                    if (dragOverCharmFileIdx === chIdx) setDragOverCharmFileIdx(null);
                                    if (activeCharmDropIndex === chIdx) setActiveCharmDropIndex(null);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverCharmFileIdx(null);
                                    setActiveCharmDropIndex(null);

                                    // 1. Files dropped directly on this charm
                                    const files = e.dataTransfer.files;
                                    if (files && files.length > 0) {
                                      const fileList = (Array.from(files) as File[]).filter((f) => f.type.startsWith('image/'));
                                      if (fileList.length > 0) {
                                        processOptionImageFile(fileList[0], (imgUrl) => {
                                          setFormCharmOptions((prev) =>
                                            prev.map((c, i) => (i === chIdx ? { ...c, image: imgUrl } : c))
                                          );
                                          showAdminToast(`Đã đổi ảnh cho charm #${chIdx + 1}`);
                                        });
                                        if (fileList.length > 1) {
                                          handleBulkCharmUpload(fileList.slice(1));
                                        }
                                        return;
                                      }
                                    }

                                    // 2. Image URL dropped from browser
                                    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                                    if (uri && (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:image/'))) {
                                      setFormCharmOptions((prev) =>
                                        prev.map((c, i) => (i === chIdx ? { ...c, image: uri.trim() } : c))
                                      );
                                      showAdminToast(`Đã nhận ảnh URL cho charm #${chIdx + 1}`);
                                      return;
                                    }

                                    // 3. Card reorder
                                    if (draggedCharmIndex !== null && draggedCharmIndex !== chIdx) {
                                      handleMoveCharm(draggedCharmIndex, chIdx);
                                    }
                                    setDraggedCharmIndex(null);
                                  }}
                                  className={`p-2.5 bg-white rounded-xl border transition-all flex flex-col gap-2 shadow-2xs relative group ${
                                    dragOverCharmFileIdx === chIdx
                                      ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/50'
                                      : activeCharmDropIndex === chIdx
                                      ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-50/20'
                                      : charm.stock !== undefined && charm.stock <= 0
                                      ? 'border-rose-300 bg-rose-50/20'
                                      : 'border-slate-200'
                                  }`}
                                >
                                  {/* Drag-over feedback overlay */}
                                  {dragOverCharmFileIdx === chIdx && (
                                    <div className="absolute inset-0 bg-amber-600/90 rounded-xl z-20 flex flex-col items-center justify-center text-white font-black text-xs gap-1 pointer-events-none shadow-lg animate-fadeIn">
                                      <Upload className="w-5 h-5 animate-bounce" />
                                      <span>Thả ảnh vào để đổi ảnh charm</span>
                                    </div>
                                  )}

                                  {/* Hidden file input for charm image */}
                                  <input
                                    type="file"
                                    id={`charm-file-input-${chIdx}`}
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        processOptionImageFile(file, (imgUrl) => {
                                          setFormCharmOptions((prev) =>
                                            prev.map((c, i) => (i === chIdx ? { ...c, image: imgUrl } : c))
                                          );
                                          showAdminToast(`Đã tải ảnh cho charm #${chIdx + 1}`);
                                        });
                                      }
                                      e.target.value = '';
                                    }}
                                  />

                                  {/* Header: Drag handle + Index + Move Up/Down + Delete */}
                                  <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-100">
                                    <div className="flex items-center gap-1">
                                      <div
                                        draggable
                                        onDragStart={(e) => {
                                          e.stopPropagation();
                                          e.dataTransfer.setData('text/plain', String(chIdx));
                                          setDraggedCharmIndex(chIdx);
                                        }}
                                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100"
                                        title="Giữ và kéo để đổi thứ tự charm"
                                      >
                                        <GripVertical className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="text-[10px] font-mono font-bold text-slate-400">
                                        #{chIdx + 1}
                                      </span>
                                      <div className="flex items-center">
                                        <button
                                          type="button"
                                          disabled={chIdx === 0}
                                          onClick={() => handleMoveCharm(chIdx, chIdx - 1)}
                                          className="p-0.5 text-slate-400 hover:text-amber-600 disabled:opacity-20 cursor-pointer"
                                          title="Di chuyển lên trước"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={chIdx === formCharmOptions.length - 1}
                                          onClick={() => handleMoveCharm(chIdx, chIdx + 1)}
                                          className="p-0.5 text-slate-400 hover:text-amber-600 disabled:opacity-20 cursor-pointer"
                                          title="Di chuyển xuống sau"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormCharmOptions((prev) => prev.filter((_, i) => i !== chIdx));
                                      }}
                                      className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-md bg-slate-100 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                                      title="Xóa charm này"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2.5">
                                    {/* Image Drop Zone & Click to Upload */}
                                    <div
                                      onClick={() => document.getElementById(`charm-file-input-${chIdx}`)?.click()}
                                      className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative cursor-pointer group/img hover:border-amber-500 transition-all shadow-2xs"
                                      title="Bấm để tải ảnh hoặc kéo thả ảnh vào đây"
                                    >
                                      <img
                                        src={charm.image || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=300&auto=format&fit=crop&q=80'}
                                        alt={charm.name}
                                        className={`w-full h-full object-cover ${
                                          charm.stock !== undefined && charm.stock <= 0 ? 'opacity-60 grayscale-[30%]' : ''
                                        }`}
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=300&auto=format&fit=crop&q=80';
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                                        <Upload className="w-3.5 h-3.5" />
                                        <span className="text-[8px] font-bold mt-0.5">Tải/Đổi ảnh</span>
                                      </div>
                                      {charm.stock !== undefined && charm.stock <= 0 && (
                                        <div className="absolute inset-0 bg-rose-950/40 flex items-center justify-center pointer-events-none">
                                          <span className="text-[8px] font-black text-white bg-rose-600 px-1 py-0.5 rounded">HẾT</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <input
                                        type="text"
                                        value={charm.name}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setFormCharmOptions((prev) =>
                                            prev.map((c, i) => (i === chIdx ? { ...c, name: val } : c))
                                          );
                                        }}
                                        placeholder="Tên charm..."
                                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                                      />

                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                                        {/* Phụ thu */}
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] text-slate-400 font-semibold">Phụ thu:</span>
                                          <input
                                            type="number"
                                            value={charm.priceDelta ?? 0}
                                            onChange={(e) => {
                                              const val = Math.max(0, Number(e.target.value) || 0);
                                              setFormCharmOptions((prev) =>
                                                prev.map((c, i) => (i === chIdx ? { ...c, priceDelta: val } : c))
                                              );
                                            }}
                                            placeholder="0"
                                            className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono font-bold text-amber-900 focus:outline-none focus:border-amber-500"
                                          />
                                          <span className="text-[10px] text-slate-400">đ</span>
                                        </div>

                                        {/* Tồn kho (Stock) */}
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] text-slate-500 font-bold">SL:</span>
                                          <input
                                            type="number"
                                            value={charm.stock ?? ''}
                                            onChange={(e) => {
                                              const val = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0);
                                              setFormCharmOptions((prev) =>
                                                prev.map((c, i) => (i === chIdx ? { ...c, stock: val } : c))
                                              );
                                            }}
                                            placeholder="∞"
                                            title="Tồn kho charm. Để trống = Vô hạn, 0 = Hết hàng"
                                            className={`w-14 px-1.5 py-0.5 border rounded text-[11px] font-mono font-bold focus:outline-none ${
                                              charm.stock !== undefined && charm.stock <= 0
                                                ? 'bg-rose-50 border-rose-300 text-rose-700'
                                                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500'
                                            }`}
                                          />
                                        </div>
                                      </div>

                                      {/* Quick Stock Buttons */}
                                      <div className="flex items-center gap-1 mt-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFormCharmOptions((prev) =>
                                              prev.map((c, i) => (i === chIdx ? { ...c, stock: 0 } : c))
                                            );
                                          }}
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                                            charm.stock !== undefined && charm.stock <= 0
                                              ? 'bg-rose-600 text-white shadow-2xs'
                                              : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                                          }`}
                                          title="Báo hết hàng ngay lập tức"
                                        >
                                          Hết (0)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFormCharmOptions((prev) =>
                                              prev.map((c, i) => (i === chIdx ? { ...c, stock: (typeof c.stock === 'number' ? c.stock : 0) + 10 } : c))
                                            );
                                          }}
                                          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer transition-colors"
                                          title="Cộng thêm 10 vào kho"
                                        >
                                          +10
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFormCharmOptions((prev) =>
                                              prev.map((c, i) => (i === chIdx ? { ...c, stock: undefined } : c))
                                            );
                                          }}
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                                            charm.stock === undefined
                                              ? 'bg-amber-600 text-white shadow-2xs'
                                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                          }`}
                                          title="Không giới hạn số lượng"
                                        >
                                          Vô hạn (∞)
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={charm.image}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setFormCharmOptions((prev) =>
                                          prev.map((c, i) => (i === chIdx ? { ...c, image: val } : c))
                                        );
                                      }}
                                      placeholder="URL hoặc kéo thả ảnh..."
                                      className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => document.getElementById(`charm-file-input-${chIdx}`)?.click()}
                                      className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                                      title="Tải ảnh từ máy"
                                    >
                                      <Upload className="w-3 h-3" />
                                      <span>Tải</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* SECTION 3: OMAMORI AMULETS */}
                    <div className="p-3 bg-red-50/40 rounded-xl border border-red-200/70 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div 
                          onClick={() => {
                            const newChecked = !formEnableOmamoriSelection;
                            setFormEnableOmamoriSelection(newChecked);
                            if (newChecked && formOmamoriOptions.length === 0) {
                              setFormOmamoriOptions(DEFAULT_OMAMORI_PRESETS);
                            }
                          }}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={formEnableOmamoriSelection}
                            onChange={(e) => {
                              e.stopPropagation();
                              const checked = e.target.checked;
                              setFormEnableOmamoriSelection(checked);
                              if (checked && formOmamoriOptions.length === 0) {
                                setFormOmamoriOptions(DEFAULT_OMAMORI_PRESETS);
                              }
                            }}
                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              📿 Bật tùy chọn Phụ kiện 2 (Mặc định: Bùa Omamori - Có thể đổi tên)
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              Khách hàng có thể chọn nhiều mẫu bùa may mắn / quà tặng kèm và quản lý tồn kho. Admin có thể đổi tên hiển thị tùy ý.
                            </span>
                          </div>
                        </div>

                        {formEnableOmamoriSelection && (
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formOmamoriSelectionRequired}
                                onChange={(e) => setFormOmamoriSelectionRequired(e.target.checked)}
                                className="rounded text-red-600 focus:ring-red-500"
                              />
                              <span>Bắt buộc chọn</span>
                            </label>
                            <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                              <span>Tối đa chọn:</span>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={formMaxOmamoriAllowed}
                                onChange={(e) => setFormMaxOmamoriAllowed(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="w-12 px-1 py-0.5 border border-slate-200 rounded text-center font-bold text-red-900 focus:outline-none focus:border-red-500 text-xs"
                              />
                              <span>món</span>
                            </label>
                            {/* Hidden bulk file input for omamori */}
                            <input
                              type="file"
                              id="bulk-omamori-files-input"
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                handleBulkOmamoriUpload(e.target.files);
                                e.target.value = '';
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => document.getElementById('bulk-omamori-files-input')?.click()}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="Chọn nhiều file ảnh bùa từ máy để nạp cùng lúc"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Tải nhiều ảnh</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormOmamoriOptions(DEFAULT_OMAMORI_PRESETS);
                              }}
                              className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              Nạp 6 Bùa Omamori mẫu
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newId = `omamori-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
                                setFormOmamoriOptions((prev) => [
                                  ...prev,
                                  { 
                                    id: newId, 
                                    name: `Món mới ${prev.length + 1}`, 
                                    image: DEFAULT_OMAMORI_PRESETS[0]?.image || '', 
                                    priceDelta: 25000,
                                    meaning: 'Bình an & may mắn',
                                    stock: 20
                                  }
                                ]);
                              }}
                              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Thêm Món Mới</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {formEnableOmamoriSelection && (
                        <div className="bg-red-50/80 border border-red-200/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shadow-2xs">
                          <label className="text-xs font-bold text-red-950 shrink-0 flex items-center gap-1.5">
                            🏷️ Đổi tên tiêu đề hiển thị:
                          </label>
                          <input
                            type="text"
                            value={formOmamoriTitle}
                            onChange={(e) => setFormOmamoriTitle(e.target.value)}
                            placeholder="Mặc định: Chọn Bùa Omamori (vd: Chọn Bùa May Mắn, Quà Tặng Kèm, Túi Thơm...)"
                            className="w-full flex-1 px-3 py-1.5 bg-white border border-red-300/80 rounded-lg text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500"
                          />
                        </div>
                      )}

                      {formEnableOmamoriSelection && (
                        <div
                          onDragOver={(e) => {
                            if (e.dataTransfer.types.includes('Files')) {
                              e.preventDefault();
                              setIsBulkOmamoriDragOver(true);
                            }
                          }}
                          onDragLeave={(e) => {
                            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                            setIsBulkOmamoriDragOver(false);
                          }}
                          onDrop={(e) => {
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              e.preventDefault();
                              setIsBulkOmamoriDragOver(false);
                              handleBulkOmamoriUpload(e.dataTransfer.files);
                            }
                          }}
                          className={`space-y-2 pt-2 border-t border-red-200/60 relative transition-all ${
                            isBulkOmamoriDragOver ? 'ring-2 ring-red-500 rounded-xl bg-red-50/50 p-2' : ''
                          }`}
                        >
                          {isBulkOmamoriDragOver && (
                            <div className="p-4 border-2 border-dashed border-red-400 bg-red-100/70 rounded-xl text-center text-red-900 font-bold text-xs flex items-center justify-center gap-2 mb-2 animate-pulse">
                              <Upload className="w-4 h-4" />
                              <span>Thả các file ảnh vào đây để tự động tạo nhiều bùa mới!</span>
                            </div>
                          )}

                          {formOmamoriOptions.length === 0 ? (
                            <div className="text-center py-6 border-2 border-dashed border-red-200 rounded-xl bg-red-50/30 space-y-2">
                              <p className="text-xs text-slate-500 font-medium">
                                Chưa có mẫu bùa nào. Kéo thả ảnh bùa trực tiếp vào đây hoặc bấm nút phía trên.
                              </p>
                              <button
                                type="button"
                                onClick={() => document.getElementById('bulk-omamori-files-input')?.click()}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Chọn ảnh tải lên</span>
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {formOmamoriOptions.map((omamori, omIdx) => (
                                <div
                                  key={omamori.id || omIdx}
                                  onDragEnter={(e) => {
                                    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/uri-list')) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setDragOverOmamoriFileIdx(omIdx);
                                    }
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/uri-list')) {
                                      if (dragOverOmamoriFileIdx !== omIdx) setDragOverOmamoriFileIdx(omIdx);
                                    } else if (draggedOmamoriIndex !== null && draggedOmamoriIndex !== omIdx) {
                                      setActiveOmamoriDropIndex(omIdx);
                                    }
                                  }}
                                  onDragLeave={(e) => {
                                    e.preventDefault();
                                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                    if (dragOverOmamoriFileIdx === omIdx) setDragOverOmamoriFileIdx(null);
                                    if (activeOmamoriDropIndex === omIdx) setActiveOmamoriDropIndex(null);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverOmamoriFileIdx(null);
                                    setActiveOmamoriDropIndex(null);

                                    // 1. Files dropped directly on this omamori
                                    const files = e.dataTransfer.files;
                                    if (files && files.length > 0) {
                                      const fileList = (Array.from(files) as File[]).filter((f) => f.type.startsWith('image/'));
                                      if (fileList.length > 0) {
                                        processOptionImageFile(fileList[0], (imgUrl) => {
                                          setFormOmamoriOptions((prev) =>
                                            prev.map((o, i) => (i === omIdx ? { ...o, image: imgUrl } : o))
                                          );
                                          showAdminToast(`Đã đổi ảnh cho bùa #${omIdx + 1}`);
                                        });
                                        if (fileList.length > 1) {
                                          handleBulkOmamoriUpload(fileList.slice(1));
                                        }
                                        return;
                                      }
                                    }

                                    // 2. Image URL dropped from browser
                                    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                                    if (uri && (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:image/'))) {
                                      setFormOmamoriOptions((prev) =>
                                        prev.map((o, i) => (i === omIdx ? { ...o, image: uri.trim() } : o))
                                      );
                                      showAdminToast(`Đã nhận ảnh URL cho bùa #${omIdx + 1}`);
                                      return;
                                    }

                                    // 3. Card reorder
                                    if (draggedOmamoriIndex !== null && draggedOmamoriIndex !== omIdx) {
                                      handleMoveOmamori(draggedOmamoriIndex, omIdx);
                                    }
                                    setDraggedOmamoriIndex(null);
                                  }}
                                  className={`p-2.5 bg-white rounded-xl border transition-all flex flex-col gap-2 shadow-xs relative group ${
                                    dragOverOmamoriFileIdx === omIdx
                                      ? 'ring-2 ring-red-500 border-red-500 bg-red-50/50'
                                      : activeOmamoriDropIndex === omIdx
                                      ? 'ring-2 ring-red-500 border-red-400 bg-red-50/20'
                                      : 'border-red-200/80'
                                  }`}
                                >
                                  {/* Drag-over feedback overlay */}
                                  {dragOverOmamoriFileIdx === omIdx && (
                                    <div className="absolute inset-0 bg-red-600/90 rounded-xl z-20 flex flex-col items-center justify-center text-white font-black text-xs gap-1 pointer-events-none shadow-lg animate-fadeIn">
                                      <Upload className="w-5 h-5 animate-bounce" />
                                      <span>Thả ảnh vào để đổi ảnh bùa</span>
                                    </div>
                                  )}

                                  {/* Hidden file input for omamori image */}
                                  <input
                                    type="file"
                                    id={`omamori-file-input-${omIdx}`}
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        processOptionImageFile(file, (imgUrl) => {
                                          setFormOmamoriOptions((prev) =>
                                            prev.map((o, i) => (i === omIdx ? { ...o, image: imgUrl } : o))
                                          );
                                          showAdminToast(`Đã tải ảnh cho bùa #${omIdx + 1}`);
                                        });
                                      }
                                      e.target.value = '';
                                    }}
                                  />

                                  {/* Header: Drag handle + Index + Move Up/Down + Delete */}
                                  <div className="flex items-center justify-between gap-1 pb-1 border-b border-red-100">
                                    <div className="flex items-center gap-1">
                                      <div
                                        draggable
                                        onDragStart={(e) => {
                                          e.stopPropagation();
                                          e.dataTransfer.setData('text/plain', String(omIdx));
                                          setDraggedOmamoriIndex(omIdx);
                                        }}
                                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100"
                                        title="Giữ và kéo để đổi thứ tự bùa"
                                      >
                                        <GripVertical className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="text-[10px] font-mono font-bold text-red-800">
                                        #{omIdx + 1}
                                      </span>
                                      <div className="flex items-center">
                                        <button
                                          type="button"
                                          disabled={omIdx === 0}
                                          onClick={() => handleMoveOmamori(omIdx, omIdx - 1)}
                                          className="p-0.5 text-slate-400 hover:text-red-600 disabled:opacity-20 cursor-pointer"
                                          title="Di chuyển lên trước"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={omIdx === formOmamoriOptions.length - 1}
                                          onClick={() => handleMoveOmamori(omIdx, omIdx + 1)}
                                          className="p-0.5 text-slate-400 hover:text-red-600 disabled:opacity-20 cursor-pointer"
                                          title="Di chuyển xuống sau"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormOmamoriOptions((prev) => prev.filter((_, i) => i !== omIdx));
                                      }}
                                      className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-red-600 rounded-md bg-slate-100 hover:bg-red-50 text-xs font-bold cursor-pointer transition-colors shrink-0"
                                      title="Xóa bùa này"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  <div className="flex items-start gap-2.5">
                                    {/* Image Drop Zone & Click to Upload */}
                                    <div
                                      onClick={() => document.getElementById(`omamori-file-input-${omIdx}`)?.click()}
                                      className="w-14 h-14 rounded-lg bg-neutral-50 border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center p-1 relative cursor-pointer group/img hover:border-red-500 transition-all shadow-2xs"
                                      title="Bấm để tải ảnh hoặc kéo thả ảnh vào đây"
                                    >
                                      {omamori.image && omamori.image.trim() ? (
                                        <img
                                          src={omamori.image}
                                          alt={omamori.name}
                                          className="w-full h-full object-contain"
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80';
                                          }}
                                        />
                                      ) : (
                                        <span className="text-[10px] text-slate-400 text-center leading-tight">Chưa có ảnh</span>
                                      )}
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                                        <Upload className="w-3.5 h-3.5" />
                                        <span className="text-[8px] font-bold mt-0.5">Đổi ảnh</span>
                                      </div>
                                    </div>

                                    <div className="flex-1 min-w-0 space-y-1">
                                      <input
                                        type="text"
                                        value={omamori.name}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setFormOmamoriOptions((prev) =>
                                            prev.map((o, i) => (i === omIdx ? { ...o, name: val } : o))
                                          );
                                        }}
                                        placeholder="Tên bùa Omamori..."
                                        className="w-full px-2 py-0.5 font-bold text-xs text-slate-900 border border-transparent hover:border-slate-200 focus:border-red-500 rounded bg-transparent focus:bg-white focus:outline-none"
                                      />

                                      <input
                                        type="text"
                                        value={omamori.meaning || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setFormOmamoriOptions((prev) =>
                                            prev.map((o, i) => (i === omIdx ? { ...o, meaning: val } : o))
                                          );
                                        }}
                                        placeholder="Ý nghĩa bùa (ví dụ: Bình an, Tài lộc)..."
                                        className="w-full px-2 py-0.5 text-[10px] text-slate-600 border border-slate-100 focus:border-red-400 rounded bg-slate-50 focus:bg-white focus:outline-none"
                                      />

                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 text-[11px] text-slate-600">
                                          <span>Phụ thu:</span>
                                          <input
                                            type="number"
                                            value={omamori.priceDelta}
                                            onChange={(e) => {
                                              const val = Number(e.target.value) || 0;
                                              setFormOmamoriOptions((prev) =>
                                                prev.map((o, i) => (i === omIdx ? { ...o, priceDelta: val } : o))
                                              );
                                            }}
                                            className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-red-900 focus:outline-none focus:border-red-500"
                                          />
                                          <span className="text-[10px] text-slate-400">đ</span>
                                        </div>

                                        <div className="flex items-center gap-1 text-[11px] text-slate-600">
                                          <span>Kho:</span>
                                          <input
                                            type="number"
                                            value={omamori.stock ?? ''}
                                            placeholder="∞"
                                            onChange={(e) => {
                                              const val = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0);
                                              setFormOmamoriOptions((prev) =>
                                                prev.map((o, i) => (i === omIdx ? { ...o, stock: val } : o))
                                              );
                                            }}
                                            className="w-12 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:border-red-500"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFormOmamoriOptions((prev) =>
                                                prev.map((o, i) => (i === omIdx ? { ...o, stock: undefined } : o))
                                              );
                                            }}
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                                              omamori.stock === undefined
                                                ? 'bg-red-600 text-white shadow-2xs'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                            title="Không giới hạn số lượng"
                                          >
                                            ∞
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={omamori.image}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setFormOmamoriOptions((prev) =>
                                          prev.map((o, i) => (i === omIdx ? { ...o, image: val } : o))
                                        );
                                      }}
                                      placeholder="URL hoặc kéo thả ảnh..."
                                      className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-red-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => document.getElementById(`omamori-file-input-${omIdx}`)?.click()}
                                      className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                                      title="Tải ảnh từ máy"
                                    >
                                      <Upload className="w-3 h-3" />
                                      <span>Tải</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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

            {/* Products Display: Cards or Table based on productViewMode */}
            {productViewMode === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredActiveProducts.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
                    Không tìm thấy sản phẩm đang hiển thị nào phù hợp bộ lọc.
                  </div>
                ) : (
                  filteredActiveProducts.map((p) => {
                    const stockCount = p.stock ?? 15;
                    const isAvailable = p.inStock !== false && stockCount > 0;
                    const catObj = localCategories.find((c) => c.id === p.category);
                    const sold = (productSoldMap[p.id] || 0) + (p.soldCount || 0);

                    return (
                      <div
                        key={p.id}
                        className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3 shadow-xs hover:border-amber-300 hover:shadow-md transition-all"
                      >
                        {/* Top: Image, Name, Category, Badges */}
                        <div className="flex items-start gap-3">
                          <img
                            src={p.image || '/assets/bracelet.jpg'}
                            alt={p.name}
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <span className="font-extrabold text-sm text-slate-900 block line-clamp-2 leading-snug">
                              {p.name}
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                {catObj?.label || p.category}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                #{p.id}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {p.isEvent0209 && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-red-100 text-red-700 border border-red-200">
                                  02.09
                                </span>
                              )}
                              {p.isBestSeller && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                  HOT
                                </span>
                              )}
                              {p.discountBadge && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {p.discountBadge}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Pricing & Sold */}
                        <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Giá bán</span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-extrabold text-sm text-amber-700">
                                {p.price.toLocaleString('vi-VN')}đ
                              </span>
                              {p.originalPrice && (
                                <span className="text-[10px] text-slate-400 line-through">
                                  {p.originalPrice.toLocaleString('vi-VN')}đ
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Đã bán</span>
                            <span className="text-xs font-black text-slate-800 font-mono">
                              {sold} <span className="text-[10px] text-slate-500 font-normal">sp</span>
                            </span>
                          </div>
                        </div>

                        {/* Stock Controls & Quick Stock Toggle */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-600 mr-1">SL:</span>
                            <button
                              type="button"
                              onClick={() => handleQuickAdjustStock(p, -1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
                              title="Giảm 1 cái"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-black text-xs text-slate-900">{stockCount}</span>
                            <button
                              type="button"
                              onClick={() => handleQuickAdjustStock(p, +1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
                              title="Tăng 1 cái"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleStock(p)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                              isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {isAvailable ? 'Còn Hàng' : 'Hết Hàng'}
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleToggleProductVisibility(p)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800 rounded-xl text-xs font-semibold transition-colors border border-slate-200 flex items-center gap-1 cursor-pointer"
                            title="Ẩn sản phẩm khỏi website (chuyển vào Hộp sản phẩm đã ẩn)"
                          >
                            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                            <span>Ẩn</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditForm(p)}
                            className="flex-1 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-colors border border-amber-200 text-center cursor-pointer"
                          >
                            Sửa sản phẩm
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-semibold transition-colors border border-slate-200 cursor-pointer"
                            title="Xóa sản phẩm"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Products Table */
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-4">Sản phẩm</th>
                        <th className="p-4">Danh mục / BST</th>
                        <th className="p-4">Giá bán</th>
                        <th className="p-4">Tồn kho</th>
                        <th className="p-4 text-center">Đã bán</th>
                        <th className="p-4">Trạng thái</th>
                        <th className="p-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredActiveProducts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-400">
                            Không tìm thấy sản phẩm đang hiển thị nào phù hợp bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        filteredActiveProducts.map((p) => {
                          const stockCount = p.stock ?? 15;
                          const isAvailable = p.inStock !== false && stockCount > 0;
                          const catObj = localCategories.find((c) => c.id === p.category);
                          const sold = (productSoldMap[p.id] || 0) + (p.soldCount || 0);

                          return (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 flex items-center gap-3">
                                <img
                                  src={p.image || '/assets/bracelet.jpg'}
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
                                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
                                    title="Giảm 1 cái"
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center font-bold text-slate-900">{stockCount}</span>
                                  <button
                                    onClick={() => handleQuickAdjustStock(p, +1)}
                                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
                                    title="Tăng 1 cái"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>

                              {/* Đã bán */}
                              <td className="p-4 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-950 font-bold">
                                  <span className="text-xs font-mono font-black">{sold}</span>
                                  <span className="text-[10px] text-amber-800/80 font-semibold">sp</span>
                                </div>
                              </td>

                              <td className="p-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleToggleStock(p)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                                    isAvailable
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                  }`}
                                >
                                  {isAvailable ? 'Còn Hàng' : 'Hết Hàng'}
                                </button>
                              </td>

                              <td className="p-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleProductVisibility(p)}
                                    className="px-2 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800 hover:border-amber-300 rounded-lg text-xs font-semibold transition-colors border border-slate-200 flex items-center gap-1 cursor-pointer"
                                    title="Ẩn sản phẩm khỏi website (chuyển vào Hộp sản phẩm đã ẩn)"
                                  >
                                    <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Ẩn</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditForm(p)}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 text-amber-700 hover:border-amber-300 rounded-lg text-xs font-semibold transition-colors border border-slate-200 cursor-pointer"
                                    title="Chỉnh sửa sản phẩm"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(p.id, p.name)}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 hover:border-rose-300 rounded-lg text-xs font-semibold transition-colors border border-slate-200 cursor-pointer"
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
            )}

            {/* ======================================================== */}
            {/* BOX RIÊNG BIỆT: HỘP SẢN PHẨM ĐÃ ẨN (HOẶC THUỘC DANH MỤC ĐÃ ẨN) */}
            {/* ======================================================== */}
            <div className="mt-8 rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100/90 text-amber-800 flex items-center justify-center font-bold flex-shrink-0 border border-amber-200/80">
                    <EyeOff className="w-5 h-5 text-amber-800" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900">Hộp Sản Phẩm Đã Ẩn</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                        {allHiddenProducts.length} sản phẩm
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Sản phẩm bị ẩn chỉ không hiển thị trên website bán hàng. Toàn bộ doanh thu & số lượng từng bán vẫn được hệ thống ghi nhận đầy đủ vào báo cáo & thống kê.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsExpandedHiddenBox((prev) => !prev)}
                  className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-bold text-xs border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>{isExpandedHiddenBox ? 'Thu gọn' : 'Mở rộng xem danh sách'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpandedHiddenBox ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {isExpandedHiddenBox && (
                <div className="p-4 sm:p-5 bg-slate-50/60 border-t border-slate-200 animate-fadeIn">
                  {filteredHiddenProducts.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
                      {allHiddenProducts.length === 0
                        ? 'Chưa có sản phẩm nào bị ẩn. Khi bạn ẩn sản phẩm hoặc ẩn danh mục, chúng sẽ tự động tách vào hộp này.'
                        : 'Không có sản phẩm đã ẩn nào khớp với bộ lọc tìm kiếm hiện tại.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {filteredHiddenProducts.map((p) => {
                        const catObj = localCategories.find((c) => c.id === p.category);
                        const isCatHidden = hiddenCategoryIds.has(p.category);
                        const isDirectlyHidden = Boolean(p.isHidden);
                        const sold = (productSoldMap[p.id] || 0) + (p.soldCount || 0);
                        const revenue = sold * p.price;

                        return (
                          <div
                            key={`hidden-${p.id}`}
                            className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-3.5 space-y-3 shadow-2xs relative"
                          >
                            <div className="flex items-start gap-3">
                              <div className="relative flex-shrink-0">
                                <img
                                  src={p.image || '/assets/bracelet.jpg'}
                                  alt={p.name}
                                  className="w-14 h-14 rounded-xl object-cover border border-slate-200 bg-slate-100 opacity-80"
                                />
                                <div className="absolute inset-0 bg-slate-900/10 rounded-xl flex items-center justify-center">
                                  <EyeOff className="w-4 h-4 text-slate-600" />
                                </div>
                              </div>

                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  {isDirectlyHidden && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                                      Ẩn thủ công
                                    </span>
                                  )}
                                  {isCatHidden && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                      Danh mục ẩn ({catObj?.label || p.category})
                                    </span>
                                  )}
                                </div>

                                <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-snug">
                                  {p.name}
                                </h4>

                                <div className="flex items-center justify-between pt-0.5">
                                  <span className="text-amber-700 font-extrabold text-xs">
                                    {p.price.toLocaleString('vi-VN')}đ
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    #{p.id}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Revenue & Sales display for hidden product */}
                            <div className="flex items-center justify-between text-[11px] py-1 px-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-600">
                              <span>Đã bán: <strong className="text-slate-900 font-bold">{sold}</strong> sp</span>
                              <span>Doanh số: <strong className="text-amber-700 font-bold">{revenue.toLocaleString('vi-VN')}đ</strong></span>
                            </div>

                            {/* Hidden Card Actions */}
                            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleToggleProductVisibility(p)}
                                className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-colors border border-emerald-200 flex items-center justify-center gap-1 cursor-pointer"
                                title="Hiện lại sản phẩm này trên website"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{isDirectlyHidden ? 'Hiện lại' : 'Bật hiển thị'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditForm(p)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 rounded-xl text-xs font-semibold transition-colors border border-slate-200 cursor-pointer"
                                title="Chỉnh sửa sản phẩm"
                              >
                                Sửa
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-semibold transition-colors border border-slate-200 cursor-pointer"
                                title="Xóa vĩnh viễn"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
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

                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      id="cat-form-is-hidden"
                      type="checkbox"
                      checked={catFormIsHidden}
                      onChange={(e) => setCatFormIsHidden(e.target.checked)}
                      className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400 cursor-pointer"
                    />
                    <label htmlFor="cat-form-is-hidden" className="text-xs font-bold text-slate-700 cursor-pointer select-none flex-1">
                      <span>Ẩn danh mục này khỏi website</span>
                      <span className="block text-[11px] font-normal text-slate-500 mt-0.5">
                        Khi bật, khách hàng sẽ không thấy danh mục này và các sản phẩm thuộc danh mục trên thanh điều hướng và bộ lọc sản phẩm.
                      </span>
                    </label>
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
                    className={`p-5 rounded-3xl border shadow-xs hover:shadow-md transition-all space-y-3 ${
                      cat.isHidden
                        ? 'bg-slate-50/80 border-dashed border-slate-300 opacity-85'
                        : 'bg-white border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-4 h-4 rounded-full border border-slate-300 shadow-xs"
                          style={{ backgroundColor: cat.highlightColor || '#B41C1A' }}
                        />
                        <span className="font-bold text-sm text-slate-900">{cat.label}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {cat.isHidden && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <EyeOff className="w-3 h-3" />
                            <span>Đang ẩn</span>
                          </span>
                        )}
                        {cat.badge && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                            {cat.badge}
                          </span>
                        )}
                      </div>
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
                          type="button"
                          onClick={() => handleToggleCategoryVisibility(cat)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border ${
                            cat.isHidden
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                          title={cat.isHidden ? 'Hiện danh mục lên website' : 'Ẩn danh mục khỏi website'}
                        >
                          {cat.isHidden ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Hiện</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                              <span>Ẩn</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditCategory(cat)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-amber-50 text-amber-800 hover:border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-slate-200"
                        >
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
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
            sellers={sellers}
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
            sellers={sellers}
            currentSeller={currentSeller}
            onUpdateProducts={onUpdateProducts}
            onOrderCreated={(newOrd) => {
              setOrders([newOrd, ...orders]);
            }}
            onNavigateToOrders={() => handleSwitchTab('orders')}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 3: QUẢN LÝ NGƯỜI BÁN & ĐỘI NGŨ (9 THÀNH VIÊN) */}
        {/* ======================================================== */}
        {activeTab === 'sellers' && (
          <AdminSellersManager
            sellers={sellers}
            orders={orders}
            currentAdmin={currentSeller || (sellers[0] || null)}
            onUpdateSellers={handleUpdateSellers}
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
                  { id: 'Chờ xác nhận', label: 'Chờ xác nhận', count: orders.filter((o) => getNormalizedStatus(o.status) === 'Chờ xác nhận').length },
                  { id: 'Đã xác nhận', label: 'Đã xác nhận', count: orders.filter((o) => getNormalizedStatus(o.status) === 'Đã xác nhận').length },
                  { id: 'Knot đang được sản xuất', label: 'Đang làm/Sản xuất', count: orders.filter((o) => getNormalizedStatus(o.status) === 'Knot đang được sản xuất').length },
                  { id: 'Đang giao hàng', label: 'Đang giao', count: orders.filter((o) => getNormalizedStatus(o.status) === 'Đang giao hàng').length },
                  { id: 'Đơn hàng giao thành công', label: 'Giao thành công', count: orders.filter((o) => getNormalizedStatus(o.status) === 'Đơn hàng giao thành công').length }
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
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              {/* Left group: View Modes, Multi-Select, Export Excel, Table Zoom */}
              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Toggle: Cards vs Table */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setOrderViewMode('cards')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      orderViewMode === 'cards'
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Xem dạng thẻ (tối ưu điện thoại di động)"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Thẻ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderViewMode('table')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      orderViewMode === 'table'
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Xem dạng bảng Excel đầy đủ"
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Bảng</span>
                  </button>
                </div>

                {/* Multi-Select Button: "chọn nhiều đơn hàng chuyển thành chọn nhiều" */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectionMode((prev) => {
                      const next = !prev;
                      showAdminToast(
                        next
                          ? 'Đã bật chế độ chọn nhiều: Bạn có thể chọn hoặc bỏ chọn từng đơn bằng cách bấm trực tiếp vào hàng.'
                          : 'Đã tắt chế độ chọn nhiều.'
                      );
                      return next;
                    });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                    isSelectionMode
                      ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500 font-extrabold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                  title="Bật hoặc tắt chế độ chọn nhiều"
                >
                  <span className={`w-2 h-2 rounded-full ${isSelectionMode ? 'bg-slate-950 animate-pulse' : 'bg-slate-400'}`} />
                  <span>{isSelectionMode ? '✓ Đang chọn nhiều' : '☑ Chọn nhiều'}</span>
                </button>

                {/* Export Excel Button: "xuất file excel chuyển thành Export Excel" */}
                <button
                  onClick={handleExportOrdersExcel}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-200 cursor-pointer shadow-2xs"
                  title="Xuất danh sách đơn hàng sang bảng tính Excel .xlsx"
                >
                  <span>📊 Export Excel</span>
                </button>

                {tableZoom !== 100 && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold">
                    Thu phóng: {tableZoom}%
                  </span>
                )}
              </div>

              {/* Right group: Search icon (expands on click), Categories filter, Source filter, and "Bộ lọc khác" slide dropdown */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search: "Nút tìm kiếm chuyển thành Icon Search, khi ấn vào mới hiện to ra" */}
                {!isOrderSearchExpanded && !orderSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOrderSearchExpanded(true);
                      setTimeout(() => orderSearchInputRef.current?.focus(), 50);
                    }}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
                    title="Tìm kiếm đơn hàng"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                    <input
                      ref={orderSearchInputRef}
                      type="text"
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      placeholder="Tìm tên, SĐT, mã đơn..."
                      className="pl-8 pr-7 py-1.5 bg-white border border-amber-400 focus:border-amber-500 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none w-48 sm:w-60 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOrderSearchQuery('');
                        setIsOrderSearchExpanded(false);
                      }}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer text-xs font-bold"
                      title="Đóng tìm kiếm"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Product Category Filter */}
                <select
                  id="admin-order-filter-category"
                  value={orderCategoryFilter}
                  onChange={(e: any) => setOrderCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer max-w-[140px] sm:max-w-none truncate"
                  title="Lọc đơn hàng theo danh mục sản phẩm"
                >
                  <option value="all">Tất cả danh mục</option>
                  {localCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      🏷️ {cat.label}
                    </option>
                  ))}
                </select>

                {/* Source Filter */}
                <select
                  value={orderSourceFilter}
                  onChange={(e: any) => setOrderSourceFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                  title="Lọc đơn hàng theo nguồn đơn"
                >
                  <option value="all">Tất cả nguồn</option>
                  <option value="website">Website</option>
                  <option value="mạng xã hội">Mạng xã hội</option>
                  <option value="trực tiếp">Trực tiếp</option>
                </select>

                {/* "Bộ lọc khác" Slide Dropdown Menu */}
                <div className="relative" ref={orderExtraFiltersRef}>
                  <button
                    type="button"
                    onClick={() => setShowOrderExtraFilters((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      showOrderExtraFilters || activeOrderExtraFiltersCount > 0
                        ? 'bg-amber-100 text-amber-950 border-amber-300 shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                    title="Bộ lọc khác: Sắp xếp, Người bán, Thanh toán, Bill chuyển khoản"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Bộ lọc khác</span>
                    {activeOrderExtraFiltersCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                        {activeOrderExtraFiltersCount}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showOrderExtraFilters ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown panel */}
                  {showOrderExtraFilters && (
                    <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-40 space-y-3.5 animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs font-black text-slate-900">Bộ lọc khác</span>
                        </div>
                        {activeOrderExtraFiltersCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setOrderSortBy('date_desc');
                              setOrderSellerFilter('all');
                              setOrderPaymentStatusFilter('all');
                              setOrderHasReceiptFilter('all');
                            }}
                            className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                          >
                            Đặt lại ({activeOrderExtraFiltersCount})
                          </button>
                        )}
                      </div>

                      {/* 1. Mới nhất / Sắp xếp */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Sắp xếp đơn hàng:
                        </label>
                        <select
                          id="admin-order-sort-selector"
                          value={orderSortBy}
                          onChange={(e: any) => setOrderSortBy(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                        >
                          <option value="date_desc">⏳ Mới nhất trước</option>
                          <option value="date_asc">⌛ Cũ nhất trước</option>
                          <option value="category_asc">🏷️ Danh mục SP (A → Z)</option>
                          <option value="category_desc">🏷️ Danh mục SP (Z → A)</option>
                          <option value="seller_asc">👤 Người bán (A → Z)</option>
                          <option value="seller_desc">👤 Người bán (Z → A)</option>
                          <option value="total_desc">💰 Tổng tiền (Cao → Thấp)</option>
                          <option value="total_asc">💵 Tổng tiền (Thấp → Cao)</option>
                          <option value="name_asc">🔤 Tên KH (A → Z)</option>
                        </select>
                      </div>

                      {/* 2. Người bán */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Người bán phụ trách:
                        </label>
                        <select
                          id="admin-order-filter-seller"
                          value={orderSellerFilter}
                          onChange={(e) => setOrderSellerFilter(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                        >
                          <option value="all">👤 Tất cả người bán ({sellers.length} người)</option>
                          <option value="website">🌐 Đơn Website (Tự động / Không người bán)</option>
                          <option value="social">📱 Đơn Mạng xã hội (Không người bán)</option>
                          <option value="unassigned">🔒 Đơn không tính người bán (Website + MXH)</option>
                          {deduplicateSellers(sellers).map((s, idx) => (
                            <option key={`admin-seller-filter-${s.id}-${idx}`} value={s.id}>
                              👤 {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 3. Thanh toán */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Trạng thái thanh toán:
                        </label>
                        <select
                          value={orderPaymentStatusFilter}
                          onChange={(e: any) => setOrderPaymentStatusFilter(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                        >
                          <option value="all">Tất cả thanh toán</option>
                          <option value="paid">Đã thanh toán</option>
                          <option value="unpaid">Chưa thanh toán</option>
                        </select>
                      </div>

                      {/* 4. Bill chuyển khoản */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Ảnh bill chuyển khoản:
                        </label>
                        <select
                          value={orderHasReceiptFilter}
                          onChange={(e: any) => setOrderHasReceiptFilter(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                        >
                          <option value="all">Bill CK: Tất cả</option>
                          <option value="has_receipt">Có ảnh Bill CK</option>
                          <option value="no_receipt">Chưa có ảnh Bill</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
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
                    onClick={() => handleBulkUpdateStatus('Đã xác nhận')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Đánh dấu Đã xác nhận
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateStatus('Knot đang được sản xuất')}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Đánh dấu Đang sản xuất
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateStatus('Đang giao hàng')}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Đánh dấu Đang giao
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateStatus('Đơn hàng giao thành công')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Đánh dấu Giao thành công
                  </button>
                  <button
                    type="button"
                    onClick={handleExportOrdersExcel}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Xuất các đơn đã chọn sang Excel theo mẫu chuẩn"
                  >
                    <span>📊 Xuất Excel ({selectedOrderIds.length})</span>
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

            {/* Mobile Horizontal Scroll Helper Banner (Only in Table Mode) */}
            {orderViewMode === 'table' && (
              <div className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900 shadow-xs">
                <span className="flex items-center gap-1.5">
                  <span>👉</span>
                  <span>Vuốt ngang bảng để xem tất cả cột thông tin</span>
                </span>
                <span className="text-[10px] bg-amber-200/70 text-amber-950 px-2 py-0.5 rounded-full font-bold">
                  Chạm dòng để xem
                </span>
              </div>
            )}

            {/* Orders Container - Cards or Responsive Excel Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs relative">
              {/* Top Table Control Bar with Quick Scroll & Pagination Summary */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">
                    {orderViewMode === 'cards' ? 'Danh Sách Đơn Hàng' : 'Bảng Đơn Hàng'}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">
                    Trang <strong className="text-slate-800 font-bold">{safeOrderPage}</strong> / {totalOrderPages}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">
                    Hiển thị <strong className="text-slate-800 font-bold">{filteredOrders.length === 0 ? 0 : orderStartIndex + 1}–{orderEndIndex}</strong> trong <strong className="text-slate-800 font-bold">{filteredOrders.length}</strong> đơn
                  </span>
                </div>

                {/* View Switcher & Horizontal Scroll Quick Buttons */}
                <div className="flex items-center gap-2.5">
                  {/* Mode switcher */}
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setOrderViewMode('cards')}
                      className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        orderViewMode === 'cards'
                          ? 'bg-amber-400 text-slate-950 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Smartphone className="w-3 h-3" />
                      <span>Thẻ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderViewMode('table')}
                      className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        orderViewMode === 'table'
                          ? 'bg-amber-400 text-slate-950 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon className="w-3 h-3" />
                      <span>Bảng</span>
                    </button>
                  </div>

                  {orderViewMode === 'table' && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (tableContainerRef.current) {
                            tableContainerRef.current.scrollBy({ left: -360, behavior: 'smooth' });
                          }
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        title="Cuộn bảng sang trái"
                      >
                        <span>◀ Cuộn trái</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (tableContainerRef.current) {
                            tableContainerRef.current.scrollBy({ left: 360, behavior: 'smooth' });
                          }
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        title="Cuộn bảng sang phải"
                      >
                        <span>Cuộn phải ▶</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {orderViewMode === 'cards' ? (
                <div className="p-3 sm:p-4 space-y-3 bg-slate-50/70">
                  {paginatedOrders.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                      Không tìm thấy đơn hàng nào phù hợp bộ lọc.
                    </div>
                  ) : (
                    paginatedOrders.map((ord, index) => {
                      const orderKey = ord.id || ord.orderCode || '';
                      const isSelected = Boolean(orderKey && selectedOrderIds.includes(orderKey));
                      const currentStatus = getNormalizedStatus(ord.status);
                      const currentPayment = getNormalizedPayment(ord.paymentStatus, ord.status);
                      const srcConf = getSourceBadgeConfig(ord.source);
                      const statusConf = getStatusBadgeConfig(currentStatus);
                      const totalQty = ord.itemDetails && ord.itemDetails.length > 0
                        ? ord.itemDetails.reduce((sum, it) => sum + (it.quantity || 1), 0)
                        : (ord.items || []).length || 1;
                      const totalAmount = ord.totalPrice || ord.totalAmount || 0;
                      
                      const sName = ord.sellerName?.trim();
                      const matchedSeller = sellers.find(
                        (s) =>
                          s.id === ord.sellerId ||
                          (sName && s.name.toLowerCase() === sName.toLowerCase()) ||
                          (sName && s.username.toLowerCase() === sName.toLowerCase())
                      );
                      const displayName = matchedSeller ? matchedSeller.name : (sName || 'Website');

                      return (
                        <div
                          key={orderKey || index}
                          onClick={() => {
                            if (isSelectionMode && orderKey) {
                              toggleSelectOrder(orderKey);
                            }
                          }}
                          className={`bg-white rounded-2xl border transition-all p-3.5 sm:p-4 space-y-3 shadow-xs ${
                            isSelected
                              ? 'border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/30'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Card Top: Order Code, Date, Source, Selection Checkbox */}
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              {isSelectionMode && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => orderKey && toggleSelectOrder(orderKey)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300 cursor-pointer"
                                />
                              )}
                              <span className="text-[11px] font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">
                                #{ord.id?.slice(-8) || ord.orderCode || 'ORD'}
                              </span>
                              <span 
                                className="text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg font-mono font-bold cursor-pointer inline-flex items-center gap-1"
                                title="Bấm để sao chép mã tra cứu đơn hàng"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const code = getOrderTrackingNumber(ord);
                                  try {
                                    await navigator.clipboard.writeText(code);
                                    alert(`Đã sao chép mã tra cứu: ${code}`);
                                  } catch {}
                                }}
                              >
                                🚚 {getOrderTrackingNumber(ord)}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${srcConf.badgeClass}`}>
                                {srcConf.shortLabel}
                              </span>
                            </div>

                            <span className="text-[11px] text-slate-500 font-medium">
                              {formatOrderDateWithoutSeconds(ord.date || ord.createdAt)}
                            </span>
                          </div>

                          {/* Customer Info & Direct Call Action */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <div className="font-extrabold text-sm text-slate-900 truncate">
                                {ord.name || ord.customerName || 'Khách vãng lai'}
                              </div>
                              {ord.phone ? (
                                <a
                                  href={`tel:${ord.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors"
                                  title="Gọi điện trực tiếp cho khách"
                                >
                                  <Phone className="w-3 h-3 text-amber-700" />
                                  <span className="font-mono">{ord.phone}</span>
                                  <span className="text-[10px] text-amber-600 font-normal">(Gọi)</span>
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Chưa có SĐT</span>
                              )}
                              {ord.address && (
                                <div className="flex items-start gap-1 text-[11px] text-slate-600 pt-0.5 line-clamp-2">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                  <span>{ord.address}</span>
                                </div>
                              )}
                            </div>

                            {/* Seller Badge */}
                            <div className="text-right shrink-0">
                              <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                👤 {displayName}
                              </span>
                            </div>
                          </div>

                          {/* Items Preview */}
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                              <span>Sản phẩm ({totalQty} món)</span>
                              <span className="text-slate-900 font-black text-sm text-amber-700">
                                {totalAmount.toLocaleString('vi-VN')}đ
                              </span>
                            </div>
                            {ord.itemDetails && ord.itemDetails.length > 0 ? (
                              <div className="space-y-1.5">
                                {ord.itemDetails.slice(0, 3).map((item, itIdx) => (
                                  <div key={itIdx} className="space-y-0.5 text-slate-700 text-[11px]">
                                    <div className="flex items-center justify-between">
                                      <span className="truncate pr-2 font-medium">• {item.name || item.productName || 'Sản phẩm'}</span>
                                      <span className="shrink-0 font-bold text-slate-700">x{item.quantity || 1}</span>
                                    </div>
                                    {(item.selectedColor || item.selectedCharm || item.selectedSize) && (
                                      <div className="flex flex-wrap items-center gap-1 text-[10px] pl-2 text-slate-600">
                                        {item.selectedColor && (
                                          <span className="inline-flex items-center px-1.5 py-0.2 bg-amber-50 text-amber-900 border border-amber-200 rounded">
                                            🎨 {item.selectedColor}
                                          </span>
                                        )}
                                        {item.selectedCharm && (
                                          <span className="inline-flex items-center px-1.5 py-0.2 bg-purple-50 text-purple-900 border border-purple-200 rounded">
                                            ✨ {typeof item.selectedCharm === 'object' ? item.selectedCharm.name : item.selectedCharm}
                                          </span>
                                        )}
                                        {item.selectedSize && (
                                          <span className="inline-flex items-center px-1.5 py-0.2 bg-blue-50 text-blue-900 border border-blue-200 rounded">
                                            📏 {item.selectedSize}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {ord.itemDetails.length > 3 && (
                                  <div className="text-[10px] text-slate-400 italic">
                                    + {ord.itemDetails.length - 3} sản phẩm khác...
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-600 truncate">
                                {(ord.items || []).join(', ') || 'Không có mô tả sản phẩm'}
                              </div>
                            )}
                            {ord.note && getCleanOrderNote(ord.note) && (
                              <div className="text-[11px] text-amber-900 bg-amber-100/60 px-2 py-1 rounded-md mt-1 italic">
                                Note: {getCleanOrderNote(ord.note)}
                              </div>
                            )}
                          </div>

                          {/* Status & Payment Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              {/* Quick Mobile Status Select */}
                              <select
                                value={currentStatus}
                                onChange={(e) => {
                                  if (ord.id) handleUpdateOrderStatus(ord.id, e.target.value);
                                }}
                                className={`text-xs font-bold px-2 py-1.5 rounded-xl border cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 ${statusConf.badgeClass}`}
                              >
                                <option value="Chờ xác nhận">Chờ xác nhận</option>
                                <option value="Đã xác nhận">Đã xác nhận</option>
                                <option value="Knot đang được sản xuất">Knot đang được sản xuất</option>
                                <option value="Đang giao hàng">Đang giao hàng</option>
                                <option value="Đơn hàng giao thành công">Đơn hàng giao thành công</option>
                              </select>

                              {/* Quick Toggle Button for Knot đang được sản xuất */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (ord.id) {
                                    const nextSt = currentStatus === 'Knot đang được sản xuất' ? 'Đã xác nhận' : 'Knot đang được sản xuất';
                                    handleUpdateOrderStatus(ord.id, nextSt);
                                  }
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                                  currentStatus === 'Knot đang được sản xuất'
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                    : 'bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-800 border-slate-300'
                                }`}
                                title={currentStatus === 'Knot đang được sản xuất' ? 'Đang làm Knot - Bấm để chuyển về Đã xác nhận' : 'Bấm để đánh dấu: Knot đang được sản xuất'}
                              >
                                {currentStatus === 'Knot đang được sản xuất' ? '✓ Đang làm' : 'Làm Knot'}
                              </button>

                              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${
                                currentPayment === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {currentPayment === 'paid' ? 'Đã TT' : 'Chưa TT'}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {/* Bill button */}
                              {ord.bankReceiptImage ? (
                                <button
                                  type="button"
                                  onClick={() => setZoomReceiptImage(ord.bankReceiptImage!)}
                                  className="px-2 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 text-xs font-bold"
                                  title="Xem bill chuyển khoản"
                                >
                                  Bill ✓
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setReceiptPromptModal({ order: ord })}
                                  className="px-2 py-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs"
                                  title="Tải bill"
                                >
                                  + Bill
                                </button>
                              )}

                              {/* Sửa đơn */}
                              <button
                                type="button"
                                onClick={() => setEditingOrder(ord)}
                                className="p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200"
                                title="Chỉnh sửa đơn hàng"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Chi tiết */}
                              <button
                                type="button"
                                onClick={() => setInspectingOrder(ord)}
                                className="p-2 text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl border border-sky-200"
                                title="Chi tiết đơn hàng"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Xóa */}
                              <button
                                type="button"
                                onClick={() => ord.id && handleDeleteOrder(ord.id)}
                                className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200"
                                title="Xóa đơn hàng"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div
                  ref={tableContainerRef}
                  className="overflow-x-auto min-h-[360px] transition-all touch-pan-x"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    zoom: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : `${tableZoom}%`
                  }}
                >
                <table className="w-full text-left text-xs text-slate-800 border-separate border-spacing-0 min-w-[1450px]">
                  <thead className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      {/* Col 0: Checkbox Header */}
                      <th className="p-3 md:sticky md:left-0 z-30 w-[42px] min-w-[42px] max-w-[42px] bg-slate-100 border-r border-b border-slate-300 text-center">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả đơn hàng trên trang này"
                          checked={
                            paginatedOrders.length > 0 &&
                            paginatedOrders.every((o) => {
                              const key = o.id || o.orderCode;
                              return Boolean(key && selectedOrderIds.includes(key));
                            })
                          }
                          onChange={(e) => {
                            const pageKeys = paginatedOrders
                              .map((o) => o.id || o.orderCode || '')
                              .filter(Boolean);
                            if (e.target.checked) {
                              setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...pageKeys])));
                            } else {
                              setSelectedOrderIds((prev) => prev.filter((id) => !pageKeys.includes(id)));
                            }
                          }}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300 cursor-pointer"
                          title="Chọn / Bỏ chọn tất cả đơn hàng trên trang hiện tại"
                        />
                      </th>

                      {/* Col 1: STT */}
                      <th className="p-3 md:sticky md:left-[42px] z-30 w-[48px] min-w-[48px] max-w-[48px] bg-slate-100 border-r border-b border-slate-300 text-center font-bold">
                        STT
                      </th>

                      {/* Col 2: Ngày đặt */}
                      <th className="p-3 md:sticky md:left-[90px] z-30 w-[130px] min-w-[130px] max-w-[130px] bg-slate-100 border-r border-b border-slate-300 whitespace-nowrap overflow-hidden">
                        Ngày đặt
                      </th>

                      {/* Col 3: Tên KH */}
                      <th className="p-3 md:sticky md:left-[220px] z-30 w-[150px] min-w-[150px] max-w-[150px] bg-slate-100 border-r border-b border-slate-300 whitespace-nowrap overflow-hidden">
                        Tên khách hàng
                      </th>

                      {/* Col 4: SĐT */}
                      <th className="p-3 md:sticky md:left-[370px] z-30 w-[120px] min-w-[120px] max-w-[120px] bg-slate-100 border-r-2 border-b border-slate-300 md:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap overflow-hidden">
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
                      <th className="p-3 min-w-[140px] max-w-xs border-r border-b border-slate-300 bg-slate-100">Ghi chú</th>

                      {/* Col 12: Người bán (Click header to toggle sort) */}
                      <th
                        className="p-3 min-w-[140px] border-r border-b border-slate-300 bg-slate-100 whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors select-none"
                        onClick={() => {
                          setOrderSortBy((prev) => (prev === 'seller_asc' ? 'seller_desc' : 'seller_asc'));
                        }}
                        title="Bấm để sắp xếp theo người bán (A-Z hoặc Z-A)"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Người bán</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {orderSortBy === 'seller_asc' ? '▲' : orderSortBy === 'seller_desc' ? '▼' : '⇅'}
                          </span>
                        </div>
                      </th>

                      {/* Col 13: Thao tác (Chi tiết / Sửa / Xóa) */}
                      <th className="p-3 min-w-[110px] text-center border-b border-slate-300 bg-slate-100 sticky right-0 z-30 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingOrders ? (
                      <tr>
                        <td colSpan={14} className="p-12 text-center text-slate-500 border-b border-slate-200">
                          <span>Đang tải danh sách đơn hàng từ cơ sở dữ liệu...</span>
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-12 text-center text-slate-400 border-b border-slate-200">
                          Chưa có đơn hàng nào phù hợp bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map((ord, index) => {
                        const orderKey = ord.id || ord.orderCode || '';
                        const isSelected = Boolean(orderKey && selectedOrderIds.includes(orderKey));
                        const currentStatus = getNormalizedStatus(ord.status);
                        const statusConf = getStatusBadgeConfig(currentStatus);
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
                            key={orderKey || index}
                            onClick={() => {
                              if (isSelectionMode && orderKey) {
                                toggleSelectOrder(orderKey);
                              } else {
                                setInspectingOrder(ord);
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
                            className={`group transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-sky-100/70 font-medium'
                                : index % 2 === 1
                                ? 'bg-slate-50/60 hover:bg-amber-50/50'
                                : 'bg-white hover:bg-amber-50/50'
                            }`}
                          >
                            {/* Col 0: Checkbox Cell */}
                            <td
                              className={`p-3 md:sticky md:left-0 z-20 w-[42px] min-w-[42px] max-w-[42px] border-r border-b border-slate-300 text-center cursor-pointer ${rowBgClass}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (orderKey) toggleSelectOrder(orderKey);
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (orderKey) toggleSelectOrder(orderKey);
                                }}
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300 cursor-pointer"
                              />
                            </td>

                            {/* Col 1: STT */}
                            <td className={`p-3 md:sticky md:left-[42px] z-20 w-[48px] min-w-[48px] max-w-[48px] border-r border-b border-slate-300 text-center font-bold text-slate-700 ${rowBgClass}`}>
                              <span className="text-xs font-mono">{orderStartIndex + index + 1}</span>
                            </td>

                            {/* Col 2: Ngày đặt */}
                            <td className={`p-3 md:sticky md:left-[90px] z-20 w-[140px] min-w-[140px] max-w-[140px] border-r border-b border-slate-300 whitespace-nowrap overflow-hidden ${rowBgClass}`}>
                              <span className="font-semibold text-slate-900 block text-xs truncate">
                                {formatOrderDateWithoutSeconds(ord.date || ord.createdAt)}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span 
                                  className="text-[9px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1 py-0.2 rounded font-mono font-bold cursor-pointer inline-flex items-center gap-0.5"
                                  title="Bấm để sao chép mã tra cứu"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const code = getOrderTrackingNumber(ord);
                                    try {
                                      await navigator.clipboard.writeText(code);
                                      alert(`Đã sao chép mã tra cứu: ${code}`);
                                    } catch {}
                                  }}
                                >
                                  🚚 {getOrderTrackingNumber(ord)}
                                </span>
                                {(() => {
                                  const srcConf = getSourceBadgeConfig(ord.source);
                                  return (
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] ${srcConf.badgeClass} shadow-2xs`}>
                                      {srcConf.shortLabel}
                                    </span>
                                  );
                                })()}
                              </div>
                            </td>

                            {/* Col 3: Tên KH */}
                            <td className={`p-3 md:sticky md:left-[220px] z-20 w-[150px] min-w-[150px] max-w-[150px] border-r border-b border-slate-300 whitespace-nowrap overflow-hidden ${rowBgClass}`}>
                              <span className="font-bold text-slate-900 block text-xs truncate" title={ord.name || ord.customerName}>
                                {ord.name || ord.customerName || 'Khách vãng lai'}
                              </span>
                            </td>

                            {/* Col 4: SĐT */}
                            <td className={`p-3 md:sticky md:left-[370px] z-20 w-[120px] min-w-[120px] max-w-[120px] border-r-2 border-b border-slate-300 md:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap overflow-hidden ${rowBgClass}`}>
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
                                    <div key={idx} className="text-xs text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded space-y-0.5">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-medium truncate text-slate-800">
                                          {it.productName || it.name}
                                        </span>
                                        <span className="font-bold text-slate-900 text-[11px] shrink-0">x{it.quantity}</span>
                                      </div>
                                      {(it.selectedColor || it.selectedCharm || it.selectedSize) && (
                                        <div className="flex flex-wrap items-center gap-1 text-[10px] pt-0.5">
                                          {it.selectedColor && (
                                            <span className="inline-flex items-center px-1.5 py-0.2 bg-amber-50 text-amber-900 border border-amber-200 rounded font-medium">
                                              🎨 {it.selectedColor}
                                            </span>
                                          )}
                                          {it.selectedCharm && (
                                            <span className="inline-flex items-center px-1.5 py-0.2 bg-purple-50 text-purple-900 border border-purple-200 rounded font-medium">
                                              ✨ {typeof it.selectedCharm === 'object' ? it.selectedCharm.name : it.selectedCharm}
                                            </span>
                                          )}
                                          {it.selectedSize && (
                                            <span className="inline-flex items-center px-1.5 py-0.2 bg-blue-50 text-blue-900 border border-blue-200 rounded font-medium">
                                              📏 {it.selectedSize}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  (Array.isArray(ord.items) ? ord.items : ord.items ? [String(ord.items)] : []).map((it, idx) => (
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
                            <td
                              className="p-3 whitespace-nowrap border-r border-b border-slate-200"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={currentStatus}
                                  onChange={(e) => handleUpdateOrderStatus(ord.id!, e.target.value)}
                                  className={`px-2 py-1 rounded-lg text-xs font-bold focus:outline-none cursor-pointer border transition-colors ${statusConf.selectClass || statusConf.badgeClass}`}
                                >
                                  <option value="Chờ xác nhận">Chờ xác nhận</option>
                                  <option value="Đã xác nhận">Đã xác nhận</option>
                                  <option value="Knot đang được sản xuất">Knot đang được sản xuất</option>
                                  <option value="Đang giao hàng">Đang giao hàng</option>
                                  <option value="Đơn hàng giao thành công">Đơn hàng giao thành công</option>
                                </select>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (ord.id) {
                                      const nextSt = currentStatus === 'Knot đang được sản xuất' ? 'Đã xác nhận' : 'Knot đang được sản xuất';
                                      handleUpdateOrderStatus(ord.id, nextSt);
                                    }
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                                    currentStatus === 'Knot đang được sản xuất'
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                      : 'bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-800 border-slate-300'
                                  }`}
                                  title={currentStatus === 'Knot đang được sản xuất' ? 'Đang làm Knot - Bấm để chuyển về Đã xác nhận' : 'Bấm để đánh dấu: Knot đang được sản xuất'}
                                >
                                  {currentStatus === 'Knot đang được sản xuất' ? '✓ Đang làm' : 'Làm Knot'}
                                </button>
                              </div>
                            </td>

                            {/* Col 10: Bill */}
                            <td
                              className="p-3 w-20 min-w-[80px] text-center whitespace-nowrap border-r border-b border-slate-200"
                              onClick={(e) => e.stopPropagation()}
                            >
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
                            <td className="p-3 max-w-xs border-r border-b border-slate-200">
                              {(() => {
                                const cleanNote = getCleanOrderNote(ord.note);
                                return cleanNote ? (
                                  <p className="text-xs text-slate-600 italic line-clamp-2" title={cleanNote}>
                                    {cleanNote}
                                  </p>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">-</span>
                                );
                              })()}
                            </td>

                            {/* Col 12: Người bán (Seller Display) */}
                            <td
                              className="p-3 whitespace-nowrap border-r border-b border-slate-200"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(() => {
                                const isWebsite = ord.source === 'website';
                                const isSocial = ord.source === 'mạng xã hội' || ord.source === 'facebook' || ord.source === 'tiktok' || ord.source === 'instagram' || ord.source === 'zalo';
                                const isLockedSource = isWebsite || isSocial;

                                if (isLockedSource) {
                                  return (
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100/90 border border-slate-200 rounded-lg text-slate-600 max-w-[150px]">
                                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <div className="min-w-0">
                                        <span className="font-bold text-xs text-slate-700 block truncate">
                                          {isWebsite ? 'Website' : 'Mạng xã hội'}
                                        </span>
                                        <span className="text-[9px] text-slate-400 block font-medium">
                                          Đã khóa người bán
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }

                                const sName = ord.sellerName?.trim();
                                const matchedSeller = sellers.find(
                                  (s) =>
                                    s.id === ord.sellerId ||
                                    (sName && s.name.toLowerCase() === sName.toLowerCase()) ||
                                    (sName && s.username.toLowerCase() === sName.toLowerCase())
                                );
                                const displayName = matchedSeller ? matchedSeller.name : (sName || 'Website');
                                const avatarBg = matchedSeller?.avatarColor || '#D97706';

                                return (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-2xs"
                                      style={{ backgroundColor: avatarBg }}
                                    >
                                      {displayName.slice(0, 1).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="font-bold text-xs text-slate-900 block truncate">
                                        {displayName}
                                      </span>
                                      {matchedSeller ? (
                                        <span className="text-[10px] text-slate-400 block font-mono">
                                          @{matchedSeller.username}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Col 13: Thao tác */}
                            <td
                              className={`p-2.5 whitespace-nowrap text-center border-b border-slate-200 sticky right-0 z-20 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] ${rowBgClass}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setInspectingOrder(ord)}
                                  className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg border border-sky-200 transition-colors cursor-pointer"
                                  title="Xem chi tiết đơn hàng & In hóa đơn"
                                  aria-label="Xem chi tiết đơn hàng"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingOrder(ord)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                  title="Chỉnh sửa đơn hàng"
                                  aria-label="Chỉnh sửa đơn hàng"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (ord.id) handleDeleteOrder(ord.id);
                                  }}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                                  title="Xóa đơn hàng này"
                                  aria-label="Xóa đơn hàng này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
            )}

            {/* Pagination Bar (Matching Requested UI) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 text-xs text-slate-600 select-none">
                {/* Left side: Range summary & bulk select info */}
                <div className="flex items-center gap-3">
                  <span className="text-slate-600">
                    Hiển thị <strong>{filteredOrders.length === 0 ? 0 : orderStartIndex + 1}–{orderEndIndex}</strong> trong tổng <strong>{filteredOrders.length}</strong> đơn hàng
                  </span>
                  {selectedOrderIds.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]">
                      Đã chọn {selectedOrderIds.length} đơn
                    </span>
                  )}
                </div>

                {/* Right side: Rows per page selector + Range + Navigation arrows */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 ml-auto">
                  {/* Rows per page */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium whitespace-nowrap">Số dòng mỗi trang:</span>
                    <div className="relative">
                      <select
                        id="admin-orders-page-size"
                        value={orderPageSize}
                        onChange={(e) => {
                          const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                          setOrderPageSize(val);
                          setOrderCurrentPage(1);
                          try {
                            safeStorageSetItem('nak_admin_order_page_size', String(val));
                          } catch {}
                        }}
                        className="appearance-none pl-3 pr-7 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer transition-colors"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value="all">Tất cả ({filteredOrders.length})</option>
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-slate-500">
                        ▼
                      </span>
                    </div>
                  </div>

                  {/* Range display: 1-10 trong 36 */}
                  <span className="font-semibold text-slate-700 whitespace-nowrap">
                    {filteredOrders.length === 0
                      ? '0-0 trong 0'
                      : `${orderStartIndex + 1}-${orderEndIndex} trong ${filteredOrders.length}`}
                  </span>

                  {/* Navigation Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={safeOrderPage <= 1}
                      onClick={() => setOrderCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition-colors cursor-pointer"
                      title="Trang trước"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-xs font-bold text-slate-800 whitespace-nowrap">
                      {safeOrderPage} / {totalOrderPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeOrderPage >= totalOrderPages}
                      onClick={() => setOrderCurrentPage((p) => Math.min(totalOrderPages, p + 1))}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition-colors cursor-pointer"
                      title="Trang sau"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
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
            {/* Top Connected Account & Main Actions Banner */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Database className="w-5 h-5 text-red-600" />
                    <span>Cơ Sở Dữ Liệu Google Firebase Cloud</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {cloudConnected ? 'Đã Kết Nối Trực Tuyến (Online)' : 'Đang Kiểm Tra Kết Nối'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Tài khoản Google: <strong className="text-slate-800 font-mono">nhunhuhao71@gmail.com</strong></span>
                  <span>•</span>
                  <span>Project ID: <strong className="text-slate-800 font-mono">jittery-study-nzp2g</strong></span>
                  <span>•</span>
                  <span>Khu vực: <strong className="text-slate-800 font-mono">asia-southeast1 (Singapore)</strong></span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href="https://console.firebase.google.com/project/jittery-study-nzp2g/firestore/usage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  title="Mở bảng điều khiển Firebase Console chính thức của Google để xem thống kê chính xác 100% từ máy chủ"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Mở Firebase Console (Chính Thức)</span>
                </a>
                <button
                  type="button"
                  onClick={handleRecalculateStorage}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="Tính toán lại dung lượng toàn bộ hình ảnh và dữ liệu"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tính Lại Dung Lượng</span>
                </button>
                <button
                  type="button"
                  onClick={handlePushAllToCloud}
                  disabled={isCloudSyncing}
                  className="px-3.5 py-2.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Đẩy dữ liệu hiện tại trên máy lên Firebase Cloud"
                >
                  <CloudUpload className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
                  <span>{isCloudSyncing ? 'Đang đẩy...' : 'Đẩy Lên Cloud'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleFetchFromCloud}
                  disabled={isCloudSyncing}
                  className="px-3.5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Đồng bộ / kéo dữ liệu mới nhất từ Firebase Firestore về máy"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                  <span>{isCloudSyncing ? 'Đang kéo...' : 'Đồng Bộ Về'}</span>
                </button>
              </div>
            </div>

            {/* Quick Navigation into Official Google Firebase Console */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Firestore Quota & Usage */}
              <a
                href="https://console.firebase.google.com/project/jittery-study-nzp2g/firestore/usage"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-gradient-to-br from-amber-500/10 via-white to-white p-5 rounded-2xl border border-amber-200/80 hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                      <BarChart3 className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Thời Gian Thực (Google)
                    </span>
                  </div>
                  <h4 className="text-base font-black text-slate-900 group-hover:text-amber-700 transition-colors flex items-center gap-1.5">
                    <span>Thống Kê Reads / Writes (Usage)</span>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Xem biểu đồ tổng lượt Đọc, Ghi, Xóa trực tiếp từ máy chủ Google Firebase với độ chính xác tuyệt đối.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-700">
                  <span>Mở trang Thống Kê Firestore</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </a>

              {/* Card 2: Firestore Database Explorer */}
              <a
                href="https://console.firebase.google.com/project/jittery-study-nzp2g/firestore/databases"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-gradient-to-br from-sky-500/10 via-white to-white p-5 rounded-2xl border border-sky-200/80 hover:border-sky-400 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-sky-600 text-white shadow-xs">
                      <Database className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md">
                      Duyệt & Quản Lý
                    </span>
                  </div>
                  <h4 className="text-base font-black text-slate-900 group-hover:text-sky-700 transition-colors flex items-center gap-1.5">
                    <span>Trình Duyệt Dữ Liệu Cloud</span>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Trực tiếp xem các bảng documents <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded">products</code>, <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded">orders</code>, <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded">sellers</code> trên Cloud.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-700">
                  <span>Mở Firestore Database Explorer</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </a>

              {/* Card 3: Project Billing & Spark Plan Limits */}
              <a
                href="https://console.firebase.google.com/project/jittery-study-nzp2g/usage"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-gradient-to-br from-emerald-500/10 via-white to-white p-5 rounded-2xl border border-emerald-200/80 hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                      <Server className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                      Gói Spark Miễn Phí
                    </span>
                  </div>
                  <h4 className="text-base font-black text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                    <span>Hạn Mức & Băng Thông Dự Án</span>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Theo dõi 1.0 GB dung lượng lưu trữ miễn phí vĩnh viễn, 10 GB băng thông hàng tháng và tình trạng vận hành dự án.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                  <span>Mở Tổng Quan Gói Dự Án</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </a>
            </div>

            {/* Storage Quota Card - Dynamically Computed */}
            {(() => {
              const currentBytes = quotaStats.estimatedStorageBytes || 845000;
              const storageMB = currentBytes / (1024 * 1024);
              const storagePercent = (currentBytes / (1024 * 1024 * 1024)) * 100;
              const remainingMB = Math.max(0, 1024 - storageMB).toFixed(1);
              let productsBytes = 0;
              let ordersBytes = 0;
              let configBytes = 0;
              try {
                productsBytes = new TextEncoder().encode(JSON.stringify(products)).length;
                ordersBytes = new TextEncoder().encode(JSON.stringify(orders)).length;
                configBytes = new TextEncoder().encode(JSON.stringify({ c: localCategories, coll: localCollections, s: siteContent })).length;
              } catch {
                productsBytes = JSON.stringify(products).length;
                ordersBytes = JSON.stringify(orders).length;
              }

              return (
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Dung Lượng Dữ Liệu & Ảnh Firestore</span>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Gói Miễn Phí Spark Plan (1,024 MB)
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">
                          {storageMB < 1 ? `~${(currentBytes / 1024).toFixed(0)} KB` : `~${storageMB.toFixed(2)} MB`}
                        </span>
                        <span className="text-xs text-slate-500">/ 1.0 GB Free vĩnh viễn (Còn lại ~{remainingMB} MB trống)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0.8, storagePercent))}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 block">
                        Đã dùng {storagePercent < 0.01 ? '< 0.01%' : `${storagePercent.toFixed(2)}%`} tổng dung lượng 1,024 MB miễn phí của Google Firebase
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Băng Thông Mạng (Egress Bandwidth)</span>
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                          10.0 GB Miễn Phí / Tháng
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">~14.2 MB</span>
                        <span className="text-xs text-slate-500">/ 10.0 GB Free mỗi tháng (Còn lại 99.86% trống)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full w-[1.4%]" />
                      </div>
                      <span className="text-[11px] text-slate-400 block">
                        Tự động làm mới chu kỳ 10 GB miễn phí vào ngày đầu tiên mỗi tháng
                      </span>
                    </div>
                  </div>

                  {/* Detailed Storage Breakdown Card */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs space-y-3">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-slate-600" />
                      <span>Chi Tiết Phân Bổ Dung Lượng Thực Tế Trong Cơ Sở Dữ Liệu</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-slate-500 block text-[11px] font-medium">Sản phẩm & Ảnh tải lên:</span>
                        <span className="text-base font-black text-slate-900 mt-1 block">
                          ~{(productsBytes / (1024 * 1024)).toFixed(2)} MB
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{products.length} sản phẩm trên web</span>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-slate-500 block text-[11px] font-medium">Đơn hàng & Hóa đơn:</span>
                        <span className="text-base font-black text-slate-900 mt-1 block">
                          ~{(ordersBytes / 1024).toFixed(1)} KB
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{orders.length} đơn hàng đã lưu</span>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-slate-500 block text-[11px] font-medium">Giao diện, Danh mục & Banner:</span>
                        <span className="text-base font-black text-slate-900 mt-1 block">
                          ~{(configBytes / 1024).toFixed(1)} KB
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{localCategories.length} danh mục, {localCollections.length} BST</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Session Activity Counters */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>Lượt Đọc / Ghi Ước Tính Trong Phiên Làm Việc Hiện Tại</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Bộ đếm này chỉ ghi nhận các truy vấn đọc/ghi thực hiện trên trình duyệt của bạn trong phiên hiện tại.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetQuotaSession}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  title="Đặt lại bộ đếm phiên này về 0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Đặt Lại Bộ Đếm Phiên</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider block">Lượt Đọc (Reads / phiên)</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-slate-900">{quotaStats.reads || 0}</span>
                    <span className="text-xs text-slate-400">/ 50,000 free/ngày</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider block">Lượt Ghi (Writes / phiên)</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-slate-900">{quotaStats.writes || 0}</span>
                    <span className="text-xs text-slate-400">/ 20,000 free/ngày</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider block">Lượt Xóa (Deletes / phiên)</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-slate-900">{quotaStats.deletes || 0}</span>
                    <span className="text-xs text-slate-400">/ 20,000 free/ngày</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                <span className="text-sm shrink-0">💡</span>
                <div>
                  <strong>Hướng dẫn xem thống kê chính thức từ Google:</strong> Thống kê reads/writes của toàn bộ khách hàng ghé thăm website được Google Firebase cập nhật liên tục trên Google Cloud Console. Để xem báo cáo chi tiết nhất với đồ thị thời gian thực, bạn vui lòng nhấp vào nút <strong>"Mở Firebase Console (Chính Thức)"</strong> ở trên hoặc <a href="https://console.firebase.google.com/project/jittery-study-nzp2g/firestore/usage" target="_blank" rel="noopener noreferrer" className="underline font-bold text-amber-950 hover:text-amber-800">truy cập trực tiếp tại đây ↗</a>.
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
          onDelete={(orderId) => {
            setInspectingOrder(null);
            handleDeleteOrder(orderId);
          }}
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
          sellers={sellers}
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
                onClick={async () => {
                  const onConfirmFn = deleteConfirmModal.onConfirm;
                  setDeleteConfirmModal(null);
                  try {
                    await onConfirmFn();
                  } catch (err) {
                    console.error('Lỗi khi thực hiện xác nhận xóa:', err);
                  }
                }}
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

      {/* ======================================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR (Visible on screens < lg) */}
      {/* ======================================================== */}
      <nav
        id="admin-mobile-bottom-nav"
        aria-label="Thanh điều hướng nhanh quản trị viên trên di động"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* Dashboard */}
          <button
            type="button"
            onClick={() => handleSwitchTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-amber-700 font-extrabold scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Tổng quan</span>
          </button>

          {/* Orders */}
          <button
            type="button"
            onClick={() => handleSwitchTab('orders')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative cursor-pointer ${
              activeTab === 'orders'
                ? 'text-amber-700 font-extrabold scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5" />
              {orders.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-amber-500 text-slate-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {orders.length > 99 ? '99+' : orders.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Đơn hàng</span>
          </button>

          {/* Products */}
          <button
            type="button"
            onClick={() => handleSwitchTab('products')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'products'
                ? 'text-amber-700 font-extrabold scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Package className="w-5 h-5" />
              {products.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-slate-800 text-white text-[9px] font-bold px-1 py-0.5 rounded flex items-center justify-center shadow-xs font-mono">
                  {products.length > 99 ? '99+' : products.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Sản phẩm</span>
          </button>

          {/* Messages */}
          <button
            type="button"
            onClick={() => handleSwitchTab('messages')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative cursor-pointer ${
              activeTab === 'messages'
                ? 'text-amber-700 font-extrabold scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Mail className="w-5 h-5" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-xs">
                  {unreadMessagesCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Tin nhắn</span>
          </button>

          {/* Menu Drawer Toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
              sidebarOpen
                ? 'text-amber-700 font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Menu</span>
          </button>
        </div>
      </nav>
      </div>
    </div>
  );
};
