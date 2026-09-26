import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { HeroBanners } from './components/HeroBanners';
import { LandingProductsCollection } from './components/LandingProductsCollection';
import { LandingCollectionBanners } from './components/LandingCollectionBanners';
import { LandingBrandStoryBanner } from './components/LandingBrandStoryBanner';
import { LandingSocialGrid } from './components/LandingSocialGrid';
import { LandingFaqCommitments } from './components/LandingFaqCommitments';
import { CartDrawer } from './components/CartDrawer';
import { Footer } from './components/Footer';
import { FlyingProductCartAnimation, FlyingCartItemData } from './components/FlyingProductCartAnimation';
import { PRODUCTS } from './data/products';
import { DEFAULT_CATEGORIES } from './data/categories';
import { COLLECTIONS_DATA } from './data/collections';
import { DEFAULT_SITE_CONTENT } from './data/siteContent';
import { Product, CartItem, CategoryItem, CollectionInfo, SiteContentConfig, SellerUser, ProductCharmOption, ProductOmamoriOption, MaintenanceConfig, ComboItemSelection } from './types';
import { CheckCircle2, ShoppingBag, Sparkles, X, Lock, AlertCircle } from 'lucide-react';
import type { PolicyTab } from './components/LegalPoliciesModal';
import { getInitialMaintenanceConfig, saveMaintenanceConfig, subscribeToMaintenanceConfig } from './utils/maintenanceManager';
import { getAdminSession, clearAdminSession, createDefaultSellers, deduplicateSellers, verifySessionWithServer, isRootAdminUser } from './utils/auth';
import { initDevToolsProtection } from './utils/securityGuard';
import { initGlobalErrorLogging, logClientError } from './utils/logger';
import { useAdminPresence } from './hooks/useAdminPresence';
import { TurnOffMaintenanceConfirmModal } from './components/admin/TurnOffMaintenanceConfirmModal';

// Dynamic code-splitting for non-landing pages & deferred non-critical widgets
const AboutPage = React.lazy(() => import('./components/AboutPage').then((m) => ({ default: m.AboutPage })));
const ContactPage = React.lazy(() => import('./components/ContactPage').then((m) => ({ default: m.ContactPage })));
const CollectionDetailPage = React.lazy(() => import('./components/CollectionDetailPage').then((m) => ({ default: m.CollectionDetailPage })));
const ProductCatalog = React.lazy(() => import('./components/ProductCatalog').then((m) => ({ default: m.ProductCatalog })));
const ProductDetailPage = React.lazy(() => import('./components/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })));
const CartPage = React.lazy(() => import('./components/CartPage').then((m) => ({ default: m.CartPage })));
const OrderTracker = React.lazy(() => import('./components/OrderTracker').then((m) => ({ default: m.OrderTracker })));
const AdminLoginModal = React.lazy(() => import('./components/AdminLoginModal').then((m) => ({ default: m.AdminLoginModal })));
const MaintenanceScreen = React.lazy(() => import('./components/MaintenanceScreen').then((m) => ({ default: m.MaintenanceScreen })));
const LegalPoliciesModal = React.lazy(() => import('./components/LegalPoliciesModal').then((m) => ({ default: m.LegalPoliciesModal })));
const AdminPage = React.lazy(() => import('./components/AdminPage').then((m) => ({ default: m.AdminPage })));
const NotFoundPage = React.lazy(() => import('./components/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const CookieConsentBanner = React.lazy(() => import('./components/CookieConsentBanner').then((m) => ({ default: m.CookieConsentBanner })));
import {
  fetchProductsFromFirestore,
  fetchCategoriesFromFirestore,
  fetchCollectionsFromFirestore,
  fetchSiteContentFromFirestore,
  fetchSellersFromFirestore,
  updateSellerPresence,
  saveSiteContentToFirestore,
  saveCategoryToFirestore,
  saveCollectionToFirestore,
  saveProductToFirestore,
  pushAndSyncProductsToFirestore,
  pushAndSyncCollectionsToFirestore,
  subscribeToProductsFromFirestore,
  subscribeToCategoriesFromFirestore,
  subscribeToCollectionsFromFirestore,
  subscribeToSiteContentFromFirestore,
  StoredOrder
} from './firebase';
import {
  trackGA4PageView,
  trackGA4AddToCart,
  trackGA4Engagement,
  recordSessionHeartbeat,
  recordPageTimeSpent
} from './utils/analytics';
import {
  safeStorageGetItem,
  safeStorageSetItem,
  serializeCartItems,
  deserializeCartItems,
  evictDisposableStorageSpace,
  getProductsFromIDB
} from './utils/storageHelper';
import {
  resetDefaultSEO,
  setCatalogSEO,
  setAboutSEO,
  setContactSEO,
  setOrderTrackerSEO,
  setCartSEO,
  setAdminSEO,
  setNotFoundSEO
} from './utils/seo';
import {
  findProductBySlugOrId,
  getProductSlug,
  getCollectionSlug,
  resolveCollectionId,
  resolveCategoryId,
  slugify
} from './utils/slugify';

const CURRENT_HANOI_SHIPPING_POLICY = 'Miễn phí giao hàng (0đ) cho tất cả đơn hàng trên toàn bộ Hà Nội. Phí vận chuyển đồng giá 20.000đ áp dụng cho các tỉnh thành khác trên toàn quốc.';

const CURRENT_PROJECT_DISCLAIMER_FOOTER =
  'Not A Knot - Even More.\nNot A Knot cùng hệ thống website và các kênh truyền thông liên quan là dự án học tập và bài tập nhóm thuộc khuôn khổ môn Quản trị tác nghiệp Thương mại điện tử - Đại học Kinh tế Quốc dân. Dự án được triển khai hoàn toàn nhằm mục đích nghiên cứu, thực hành môn học và không mang tính chất kinh doanh thương mại.';

function migrateLegacyShippingPolicy(content: SiteContentConfig): SiteContentConfig {
  const legacyPolicyPattern = /Hai Bà Trưng|5\.000\s*đ|các quận huyện Hà Nội khác/i;
  const faqs = Array.isArray(content.faqs)
    ? content.faqs.map((faq) => {
        const isShippingFaq = /phí vận chuyển|chính sách vận chuyển/i.test(faq.q || '');
        if (isShippingFaq && legacyPolicyPattern.test(faq.a || '')) {
          return { ...faq, a: CURRENT_HANOI_SHIPPING_POLICY };
        }
        return faq;
      })
    : content.faqs;

  const isOldParacordFooter =
    !content.footerDescription ||
    /Paracord|EDC|bảo hành nút thắt/i.test(content.footerDescription) ||
    !content.footerDescription.includes('Kinh tế Quốc dân');

  return {
    ...content,
    footerDescription: isOldParacordFooter ? CURRENT_PROJECT_DISCLAIMER_FOOTER : content.footerDescription,
    shippingPolicy:
      !content.shippingPolicy || legacyPolicyPattern.test(content.shippingPolicy)
        ? CURRENT_HANOI_SHIPPING_POLICY
        : content.shippingPolicy,
    ...(faqs ? { faqs } : {})
  };
}

const ViewLoadingFallback = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 bg-neutral-50/50">
    <div className="w-8 h-8 rounded-full border-2 border-neutral-300 border-t-amber-600 animate-spin mb-3" />
    <span className="text-xs font-semibold text-neutral-500 tracking-wide">Đang tải trang...</span>
  </div>
);

export default function App() {
  // Navigation & View State (Landing, Collection Detail, Full Catalog, Standalone About Page, Standalone Contact Page, Standalone Admin Page, Standalone Product Detail Page, Order Tracking Page, Full Cart Page, Custom 404 Page)
  const [currentView, setCurrentView] = useState<'landing' | 'collection' | 'catalog' | 'about' | 'contact' | 'admin' | 'product-detail' | 'order-tracker' | 'cart' | 'not-found'>('landing');
  const [previousView, setPreviousView] = useState<'landing' | 'collection' | 'catalog' | 'about' | 'contact' | 'admin'>('catalog');
  const [activeCollectionId, setActiveCollectionId] = useState<string>('event_0209');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderTrackerInitialCode, setOrderTrackerInitialCode] = useState<string>('');

  // Collections state
  const [collections, setCollections] = useState<CollectionInfo[]>(() => {
    try {
      const saved = localStorage.getItem('nak_collections');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Lỗi đọc BST từ localStorage:", e);
    }
    return COLLECTIONS_DATA;
  });

  // Categories state
  const [categories, setCategories] = useState<CategoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('nak_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out obsolete legacy dummy items if present
          const sanitized = parsed.filter(
            (c: CategoryItem) => !['charm_bracelet', 'everyday', 'keychains', 'lanyards'].includes(c.id)
          );
          if (sanitized.length > 0) return sanitized;
        }
      }
    } catch (e) {
      console.warn("Lỗi đọc danh mục từ localStorage:", e);
    }
    return DEFAULT_CATEGORIES;
  });

  // Products state with fallback to local/hardcoded
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('nak_custom_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Lỗi đọc danh sách sản phẩm từ bộ nhớ:", e);
    }
    return PRODUCTS;
  });

  const [isProductsLoading, setIsProductsLoading] = useState(true);

  const productsRef = useRef<Product[]>(products);
  useEffect(() => {
    productsRef.current = products;
    if (pendingHashProductRef.current && products.length > 0) {
      const targetId = pendingHashProductRef.current;
      const found = findProductBySlugOrId(products, targetId);
      if (found) {
        setSelectedProduct(found);
        pendingHashProductRef.current = null;
      }
    }
  }, [products]);

  // Publicly visible products (filtered to exclude hidden items or items in hidden categories on storefront)
  const visibleProducts = useMemo(() => {
    const hiddenCategoryIds = new Set(
      categories
        .filter((c) => c.isHidden === true || String(c.isHidden) === 'true')
        .map((c) => c.id)
    );
    return products.filter((p) => {
      const isHidden = p.isHidden === true || String(p.isHidden) === 'true';
      const isCatHidden = Boolean(p.category && hiddenCategoryIds.has(p.category));
      return !isHidden && !isCatHidden;
    });
  }, [products, categories]);

  // Site Content Configuration (CMS) state
  const [siteContent, setSiteContent] = useState<SiteContentConfig>(() => {
    try {
      const saved = localStorage.getItem('nak_site_content');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const merged = migrateLegacyShippingPolicy({ ...DEFAULT_SITE_CONTENT, ...parsed });
          if (Array.isArray(merged.customElements)) {
            merged.customElements = merged.customElements.filter(
              (e: any) => e?.type !== 'guarantee' && e?.id !== 'elem-guarantee-1' && e?.id !== 'elem-faq-1'
            );
          }
          return merged;
        }
      }
    } catch (e) {
      console.warn("Lỗi đọc site content từ localStorage:", e);
    }
    return DEFAULT_SITE_CONTENT;
  });

  // Admin Auth & Sellers State
  const [sellers, setSellers] = useState<SellerUser[]>([]);
  const [currentSeller, setCurrentSeller] = useState<SellerUser | null>(() => {
    const session = getAdminSession();
    return session && session.username ? (session as SellerUser) : null;
  });
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalTab, setPolicyModalTab] = useState<PolicyTab>('privacy');

  const handleOpenPolicy = useCallback((tab: PolicyTab = 'privacy') => {
    setPolicyModalTab(tab);
    setIsPolicyModalOpen(true);
  }, []);

  // Real-time Maintenance Mode State (Synced across devices, 100% independent of Firebase Storage)
  const [maintenanceConfig, setMaintenanceConfig] = useState<MaintenanceConfig>(() =>
    getInitialMaintenanceConfig()
  );
  const [isTurnOffMaintenanceModalOpen, setIsTurnOffMaintenanceModalOpen] = useState(false);

  const handleConfirmTurnOffMaintenance = async () => {
    const next = { ...maintenanceConfig, enabled: false };
    await saveMaintenanceConfig(next, currentSeller?.name || 'Quản trị viên');
    setMaintenanceConfig(next);
    showToast('Đã tắt chế độ bảo trì thành công! Website đã mở lại đón khách.');
    setIsTurnOffMaintenanceModalOpen(false);
  };

  useEffect(() => {
    const unsub = subscribeToMaintenanceConfig((cfg) => {
      setMaintenanceConfig(cfg);
    });
    return () => unsub();
  }, []);

  // Check URL query param ?admin=true to allow immediate admin login bypass
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin') === 'true' || params.has('admin')) {
        handleOpenAdmin();
      }
    }
  }, []);

  // Cart state with safe storage initialization
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      evictDisposableStorageSpace();
      const saved = safeStorageGetItem('nak_cart');
      return deserializeCartItems(saved, PRODUCTS);
    } catch {
      return [];
    }
  });

  // Modal visibility states
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Flying product to cart animation states
  const [flyingCartItems, setFlyingCartItems] = useState<FlyingCartItemData[]>([]);
  const [isCartBumping, setIsCartBumping] = useState(false);
  const cartBumpTimerRef = useRef<any>(null);
  const lastPointerPosRef = useRef<{ x: number; y: number }>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const handlePointer = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if ('touches' in e && e.touches.length > 0) {
        lastPointerPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if ('clientX' in e && (e.clientX > 0 || e.clientY > 0)) {
        lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    window.addEventListener('pointerdown', handlePointer, { passive: true, capture: true });
    window.addEventListener('touchstart', handlePointer, { passive: true, capture: true });
    window.addEventListener('click', handlePointer, { passive: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointer, { capture: true } as any);
      window.removeEventListener('touchstart', handlePointer, { capture: true } as any);
      window.removeEventListener('click', handlePointer, { capture: true } as any);
    };
  }, []);

  // Toast notification state
  interface ToastState {
    message: string;
    showCartAction?: boolean;
    type?: 'success' | 'warning' | 'info';
  }
  const [toastInfo, setToastInfo] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Pending target refs for asynchronous direct link resolution (e.g. from SEO / QR codes)
  const pendingHashProductRef = useRef<string | null>(null);
  const pendingHashCollectionRef = useRef<string | null>(null);

  // ========================================================
  // HASH-BASED ROUTING SYSTEM
  // Supports: #home, #products, #product-detail, #cart, #checkout,
  //           #collection, #about, #contact, #admin, #tracker
  // ========================================================
  // Unified Location Router: Supports HTML5 History API Clean URLs & Graceful Hash Fallback
  // ========================================================
  const syncStateFromLocation = useCallback(() => {
    if (typeof window === 'undefined') return;

    const rawPathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
    const rawHash = (window.location.hash || '').replace(/^#\/?/, '');
    const searchParams = new URLSearchParams(window.location.search || '');

    // Support query param ?policy=...
    const searchPolicy = searchParams.get('policy');
    if (searchPolicy) {
      handleOpenPolicy(searchPolicy as PolicyTab);
    }

    // Determine the route path: prefer pathname if non-empty, otherwise hash
    let routePath = rawPathname;
    let queryParams = searchParams;

    if (!routePath && rawHash) {
      const [hPath, hQuery] = rawHash.split('?');
      routePath = hPath;
      if (hQuery) {
        queryParams = new URLSearchParams(hQuery);
      }
    }

    // Automatically normalize ugly hash fragments in the browser address bar to clean paths
    if (window.location.hash) {
      try {
        const cleanPath = '/' + (routePath ? routePath : '') + (window.location.search ? window.location.search : '');
        window.history.replaceState(null, '', cleanPath || '/');
      } catch (e) {}
    }

    // 1. Root / Landing
    if (!routePath || routePath === 'home' || routePath === 'landing') {
      const searchCode = queryParams.get('code') || queryParams.get('tracking') || queryParams.get('order');
      if (searchCode) {
        setOrderTrackerInitialCode(searchCode);
        setCurrentView('order-tracker');
        setIsCartOpen(false);
        return;
      }

      // Check query param navigation for clean SEO URLs
      const searchProduct = queryParams.get('product') || queryParams.get('id');
      if (searchProduct) {
        const found = findProductBySlugOrId(productsRef.current, searchProduct);
        if (found) {
          setSelectedProduct(found);
          setCurrentView('product-detail');
          pendingHashProductRef.current = null;
        } else {
          pendingHashProductRef.current = searchProduct;
          setCurrentView('product-detail');
        }
        setIsCartOpen(false);
        return;
      }

      const searchCollection = queryParams.get('collection');
      if (searchCollection) {
        const targetColId = resolveCollectionId(searchCollection, collections);
        setActiveCollectionId(targetColId);
        setCurrentView('collection');
        setIsCartOpen(false);
        return;
      }

      const searchPage = queryParams.get('page');
      if (searchPage === 'catalog' || searchPage === 'products') {
        setCurrentView('catalog');
        const cat = queryParams.get('category');
        if (cat) {
          setSelectedCategory(resolveCategoryId(cat, categories));
        }
        setIsCartOpen(false);
        return;
      }
      if (searchPage === 'about') {
        setCurrentView('about');
        setIsCartOpen(false);
        return;
      }
      if (searchPage === 'contact') {
        setCurrentView('contact');
        setIsCartOpen(false);
        return;
      }
      if (searchPage === 'cart' || searchPage === 'checkout') {
        setCurrentView('cart');
        setIsCartOpen(false);
        return;
      }
      if (searchPage === 'tracker' || searchPage === 'tracking') {
        setCurrentView('order-tracker');
        setIsCartOpen(false);
        return;
      }

      setCurrentView('landing');
      setIsCartOpen(false);
      setSelectedProduct(null);
      return;
    }

    // 2. Direct paths and clean URLs
    if (routePath === 'privacy' || routePath === 'bao-mat' || routePath === 'policy/privacy') {
      handleOpenPolicy('privacy');
      return;
    }
    if (routePath === 'terms' || routePath === 'dieu-khoan' || routePath === 'policy/terms') {
      handleOpenPolicy('terms');
      return;
    }
    if (routePath === 'returns' || routePath === 'policy' || routePath === 'doi-tra' || routePath === 'bao-hanh' || routePath === 'policy/returns') {
      handleOpenPolicy('returns');
      return;
    }
    if (routePath === 'shipping-payment' || routePath === 'thanh-toan' || routePath === 'van-chuyen' || routePath === 'policy/shipping-payment') {
      handleOpenPolicy('shipping_payment');
      return;
    }
    if (routePath === 'transparency' || routePath === 'minh-bach' || routePath === 'policy/transparency') {
      handleOpenPolicy('transparency');
      return;
    }

    if (routePath === 'admin') {
      const session = getAdminSession();
      if (session && session.username) {
        setCurrentSeller(session as SellerUser);
        setCurrentView('admin');
        setIsAdminLoginModalOpen(false);
        verifySessionWithServer().then((verifiedUser) => {
          if (verifiedUser && verifiedUser.username) {
            setCurrentSeller(verifiedUser as SellerUser);
            setIsAdminLoginModalOpen(false);
          }
        });
      } else {
        setIsAdminLoginModalOpen(true);
        setCurrentView('landing');
      }
      setIsCartOpen(false);
      return;
    }

    if (routePath === 'about' || routePath === 've-chung-toi') {
      setCurrentView('about');
      setIsCartOpen(false);
      return;
    }

    if (routePath === 'contact' || routePath === 'lien-he') {
      setCurrentView('contact');
      setIsCartOpen(false);
      return;
    }

    if (routePath === 'tracking' || routePath === 'tracker' || routePath === 'order-tracker' || routePath === 'tra-cuu' || routePath === 'kiem-tra-don-hang') {
      const code = queryParams.get('code');
      if (code) {
        setOrderTrackerInitialCode(code);
      }
      setCurrentView('order-tracker');
      setIsCartOpen(false);
      return;
    }

    if (routePath === 'cart' || routePath === 'checkout' || routePath === 'gio-hang') {
      setCurrentView('cart');
      setIsCartOpen(false);
      return;
    }

    if (routePath === 'products' || routePath === 'catalog' || routePath === 'san-pham') {
      setCurrentView('catalog');
      const cat = queryParams.get('category');
      if (cat) {
        setSelectedCategory(resolveCategoryId(cat, categories));
      }
      setIsCartOpen(false);
      return;
    }

    if (routePath.startsWith('category/') || routePath.startsWith('danh-muc/')) {
      const rawCat = routePath.replace(/^(category|danh-muc)\//, '');
      setCurrentView('catalog');
      if (rawCat) {
        setSelectedCategory(resolveCategoryId(rawCat, categories));
      }
      setIsCartOpen(false);
      return;
    }

    if (routePath === 'product-detail' || routePath.startsWith('product/') || routePath.startsWith('product-') || routePath.startsWith('san-pham/')) {
      const prodIdentifier = queryParams.get('id') || routePath.replace(/^(product|san-pham)[\/-]/, '');
      if (prodIdentifier) {
        const found = findProductBySlugOrId(productsRef.current, prodIdentifier);
        if (found) {
          setSelectedProduct(found);
          setCurrentView('product-detail');
          pendingHashProductRef.current = null;
        } else {
          // If products haven't loaded from Firestore yet, queue it
          pendingHashProductRef.current = prodIdentifier;
          setCurrentView('product-detail');
        }
      }
      setIsCartOpen(false);
      return;
    }

    if (routePath === 'event_0209' || routePath === 'event-0209' || routePath === 'hao-khi-0209') {
      setActiveCollectionId('event_0209');
      setCurrentView('collection');
      setIsCartOpen(false);
      return;
    }

    if (routePath.startsWith('collection/') || routePath.startsWith('collection-') || routePath.startsWith('bo-suu-tap/') || routePath === 'collection' || routePath === 'collections' || routePath === 'bo-suu-tap') {
      const rawCol = queryParams.get('id') || routePath.replace(/^(collection(s)?|bo-suu-tap)[\/-]?/, '');
      const targetColId = resolveCollectionId(rawCol || 'event_0209', collections);
      setActiveCollectionId(targetColId);
      setCurrentView('collection');
      pendingHashCollectionRef.current = targetColId;
      setIsCartOpen(false);
      return;
    }

    if (routePath === '404' || routePath === 'not-found' || routePath === 'khong-tim-thay') {
      setCurrentView('not-found');
      setIsCartOpen(false);
      return;
    }

    // Default fallback: any unknown route triggers the custom 404 page
    setCurrentView('not-found');
    setIsCartOpen(false);
  }, [categories, collections, handleOpenPolicy]);

  // Initialize anti-inspection, DevTools protection, global client error telemetry & server token verification
  useEffect(() => {
    initGlobalErrorLogging();
    const cleanupProtection = initDevToolsProtection();

    // Verify session token on startup while preserving stored sessions
    verifySessionWithServer().then((verifiedUser) => {
      const activeSession = verifiedUser || getAdminSession();
      if (activeSession && activeSession.username) {
        setCurrentSeller(activeSession as SellerUser);
        setIsAdminLoginModalOpen(false);
      } else {
        setCurrentSeller(null);
        const currentUrl = window.location.pathname + window.location.hash;
        if (currentUrl.includes('/admin') || currentUrl.includes('admin')) {
          setCurrentView('landing');
          setIsAdminLoginModalOpen(true);
        }
      }
    });

    return () => {
      cleanupProtection();
    };
  }, []);

  // Backups run only while staff are using the visible admin dashboard.
  useEffect(() => {
    if (!currentSeller?.id || currentView !== 'admin') return;
    let cancelled = false;
    const checkBackup = async () => {
      if (cancelled || document.hidden) return;
      try {
        const { checkAndRunAutoBackup } = await import('./utils/autoBackup');
        if (!cancelled && !document.hidden) await checkAndRunAutoBackup();
      } catch (err) {
        console.warn('Auto-backup check failed:', err);
      }
    };
    void checkBackup();
    const timer = setInterval(() => { void checkBackup(); }, 15 * 60 * 1000);
    const handleVisibility = () => {
      if (!document.hidden) {
        void checkBackup();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentSeller?.id, currentView]);

  // Listen to browser popstate and hashchange (Back / Forward buttons) & track GA4 page views
  useEffect(() => {
    const handleLocationChange = () => {
      syncStateFromLocation();
      
      const currentPath = window.location.pathname + (window.location.search || '');
      let pageTitle = 'Trang Chủ - NOT A KNOT';
      if (currentPath.includes('/admin') || window.location.hash.includes('admin')) {
        pageTitle = 'Quản Trị Hệ Thống - NOT A KNOT';
      } else if (currentPath.includes('/cart') || currentPath.includes('/checkout')) {
        pageTitle = 'Giỏ Hàng & Thanh Toán';
      } else if (currentPath.includes('/products') || currentPath.includes('/catalog')) {
        pageTitle = 'Tất Cả Sản Phẩm';
      } else if (currentPath.includes('/product/')) {
        const pathProd = currentPath.match(/\/product\/([^/?&#]+)/);
        const prodSlug = pathProd ? pathProd[1] : '';
        const foundProd = findProductBySlugOrId(productsRef.current, prodSlug);
        pageTitle = foundProd ? `${foundProd.name} - Chi Tiết Sản Phẩm` : 'Chi Tiết Sản Phẩm - NOT A KNOT';
      } else if (currentPath.includes('/collection/')) {
        const pathCol = currentPath.match(/\/collection\/([^/?&#]+)/);
        const colSlug = pathCol ? pathCol[1] : '';
        const foundCol = collections.find((c) => c.id === colSlug || slugify(c.title) === colSlug);
        pageTitle = foundCol ? `${foundCol.title} - Bộ Sưu Tập` : 'Bộ Sưu Tập - NOT A KNOT';
      } else if (currentPath.includes('/about')) {
        pageTitle = 'Về Chúng Tôi - NOT A KNOT';
      } else if (currentPath.includes('/contact')) {
        pageTitle = 'Liên Hệ & Showroom';
      } else if (currentPath.includes('/tracker') || currentPath.includes('/tracking')) {
        pageTitle = 'Tra Cứu Đơn Hàng';
      }

      trackGA4PageView(currentPath || '/', pageTitle);
    };

    // Initial check on mount
    handleLocationChange();

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [syncStateFromLocation, collections]);

  // Synchronize Canonical tags, Meta Titles, and Meta Descriptions across all app views
  useEffect(() => {
    if (currentView === 'landing') {
      resetDefaultSEO();
    } else if (currentView === 'catalog') {
      const activeCat = categories.find((c) => c.id === selectedCategory);
      setCatalogSEO(activeCat ? activeCat.name : undefined, selectedCategory);
    } else if (currentView === 'about') {
      setAboutSEO();
    } else if (currentView === 'contact') {
      setContactSEO();
    } else if (currentView === 'order-tracker') {
      setOrderTrackerSEO(orderTrackerInitialCode);
    } else if (currentView === 'cart') {
      setCartSEO();
    } else if (currentView === 'admin') {
      setAdminSEO();
    } else if (currentView === 'not-found') {
      setNotFoundSEO();
    }
  }, [currentView, selectedCategory, categories, orderTrackerInitialCode]);

  // Track session engagement duration and time on page (heartbeat)
  useEffect(() => {
    let sessionSeconds = 0;
    const interval = setInterval(() => {
      // If user tab is visible and active, record engagement
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !document.hidden) {
        sessionSeconds += 20;
        recordSessionHeartbeat(20);
        
        // Track time spent on the current page hash
        const currentHash = window.location.hash || '#home';
        recordPageTimeSpent(currentHash, 20);
        
        // Every 60 seconds, ping GA4 user_engagement event
        if (sessionSeconds % 60 === 0) {
          trackGA4Engagement(sessionSeconds);
        }
      }
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  // Security Guard: Load sellers list ONLY when admin login modal is active or admin is already logged in
  useEffect(() => {
    if (!isAdminLoginModalOpen && !currentSeller) return;

    const initSellers = async () => {
      try {
        const dbSellers = await fetchSellersFromFirestore();
        if (dbSellers && dbSellers.length > 0) {
          const cleanSellersList = deduplicateSellers(dbSellers);
          setSellers(cleanSellersList);
          safeStorageSetItem('nak_sellers_list', JSON.stringify(cleanSellersList));
        } else {
          const local = safeStorageGetItem('nak_sellers_list');
          if (local) {
            try {
              const parsed = JSON.parse(local);
              setSellers(deduplicateSellers(parsed));
            } catch {
              const defaults = await createDefaultSellers();
              setSellers(deduplicateSellers(defaults));
            }
          } else {
            const defaults = await createDefaultSellers();
            const clean = deduplicateSellers(defaults);
            setSellers(clean);
            safeStorageSetItem('nak_sellers_list', JSON.stringify(clean));
          }
        }
      } catch {
        const defaults = await createDefaultSellers();
        setSellers(deduplicateSellers(defaults));
      }
    };
    initSellers();
  }, [isAdminLoginModalOpen, currentSeller]);

  // Synchronize current active seller session with updated sellers list from Firestore
  useEffect(() => {
    if (currentSeller && sellers.length > 0) {
      const matched = sellers.find(
        (s) =>
          (s.username && currentSeller.username && s.username.toLowerCase() === currentSeller.username.toLowerCase()) ||
          (s.id && currentSeller.id && s.id === currentSeller.id)
      );
      if (matched) {
        const isRoleDifferent =
          matched.role !== currentSeller.role ||
          Boolean(matched.isRootAdmin) !== Boolean(currentSeller.isRootAdmin) ||
          matched.name !== currentSeller.name ||
          matched.isActive !== currentSeller.isActive;

        if (isRoleDifferent) {
          const isRoot = isRootAdminUser(matched);
          const updated: SellerUser = {
            ...currentSeller,
            ...matched,
            role: isRoot ? 'root_admin' : (matched.role || 'member'),
            isRootAdmin: isRoot
          };
          setCurrentSeller(updated);
          try {
            localStorage.setItem('notaknot_admin_auth_session', JSON.stringify(updated));
          } catch {}
        }
      }
    }
  }, [sellers, currentSeller]);

  // Re-verify session with server on mount & whenever switching to Admin view
  useEffect(() => {
    if (currentView === 'admin' || currentSeller) {
      verifySessionWithServer().then((freshUser) => {
        if (freshUser && freshUser.username) {
          setCurrentSeller((prev) => {
            if (!prev) return freshUser as SellerUser;
            const isChanged =
              prev.role !== freshUser.role ||
              Boolean(prev.isRootAdmin) !== Boolean(freshUser.isRootAdmin) ||
              prev.name !== freshUser.name;
            return isChanged ? ({ ...prev, ...freshUser } as SellerUser) : prev;
          });
        }
      }).catch(() => {});
    }
  }, [currentView]);

  // Online presence, public IP detection (ipapi.co) and heartbeat for active admin/seller
  useAdminPresence(currentView === 'admin' ? currentSeller : null);

  // Cross-tab / Multi-device Instant Broadcast Synchronization Helper
  const broadcastStoreChange = (type: 'products' | 'categories' | 'collections' | 'siteContent', data: any) => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('nak_store_sync_channel');
        channel.postMessage({ type, data });
        channel.close();
      } catch {}
    }
  };

  // Real-time automatic synchronization with Firestore Cloud & Cross-tab broadcast
  // Updates customer-facing storefront and admin immediately whenever data changes on Cloud
  useEffect(() => {
    let isMounted = true;

    // 0. Instant offline/cached load from IndexedDB (preserves all full-res original photos)
    getProductsFromIDB().then((idbProducts) => {
      if (isMounted && idbProducts && idbProducts.length > 0) {
        setProducts(idbProducts);
        setIsProductsLoading(false);
      }
    });

    // A. Initial direct load from Firestore in parallel with real-time listeners for instant fresh data
    const loadInitialCloudData = async () => {
      try {
        const [cloudProds, cloudCats, cloudCols, cloudSite] = await Promise.all([
          fetchProductsFromFirestore(),
          fetchCategoriesFromFirestore(),
          fetchCollectionsFromFirestore(),
          fetchSiteContentFromFirestore()
        ]);

        if (!isMounted) return;

        if (cloudProds && cloudProds.length > 0) {
          setProducts(cloudProds);
          setSelectedProduct((curr) => {
            if (!curr) return null;
            return cloudProds.find((p) => p.id === curr.id) || curr;
          });
          safeStorageSetItem('nak_custom_products', JSON.stringify(cloudProds));
        }
        if (cloudCats && cloudCats.length > 0) {
          setCategories(cloudCats);
          safeStorageSetItem('nak_categories', JSON.stringify(cloudCats));
        }
        if (cloudCols && cloudCols.length > 0) {
          const sorted = [...cloudCols].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setCollections(sorted);
          safeStorageSetItem('nak_collections', JSON.stringify(sorted));
        }
        if (cloudSite) {
          const migratedCloudSite = migrateLegacyShippingPolicy(cloudSite);
          setSiteContent(migratedCloudSite);
          safeStorageSetItem('nak_site_content', JSON.stringify(migratedCloudSite));
        }
      } catch (err) {
        console.warn('Initial cloud fetch notice:', err);
      } finally {
        if (isMounted) {
          setIsProductsLoading(false);
        }
      }
    };
    loadInitialCloudData();

    // B. Real-time Products listener (auto-syncs products, prices, stock, images live)
    const unsubProducts = subscribeToProductsFromFirestore((realtimeProducts) => {
      if (!isMounted) return;
      setIsProductsLoading(false);
      if (realtimeProducts && realtimeProducts.length > 0) {
        // Safely preserve any freshly created local products that are still completing their cloud upload
        const cloudIds = new Set(realtimeProducts.map((p) => p.id));
        const pendingLocal = (productsRef.current || []).filter(
          (p) => !cloudIds.has(p.id) && p.id.startsWith('nak-prod-')
        );
        const mergedList = [...pendingLocal, ...realtimeProducts];
        setProducts(mergedList);
        setSelectedProduct((curr) => {
          if (!curr) return null;
          const matched = mergedList.find((p) => p.id === curr.id);
          return matched || curr;
        });
        safeStorageSetItem('nak_custom_products', JSON.stringify(mergedList));
      }
    });

    // C. Real-time Categories listener
    const unsubCats = subscribeToCategoriesFromFirestore((realtimeCats) => {
      if (!isMounted) return;
      if (realtimeCats && realtimeCats.length > 0) {
        setCategories(realtimeCats);
        safeStorageSetItem('nak_categories', JSON.stringify(realtimeCats));
      }
    });

    // D. Real-time Collections / Banners listener
    const unsubCols = subscribeToCollectionsFromFirestore((realtimeCols) => {
      if (!isMounted) return;
      if (realtimeCols) {
        const sorted = [...realtimeCols].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setCollections(sorted);
        safeStorageSetItem('nak_collections', JSON.stringify(sorted));
      }
    });

    // E. Real-time Site Content / Visuals listener
    const unsubContent = subscribeToSiteContentFromFirestore((realtimeContent) => {
      if (!isMounted) return;
      if (realtimeContent) {
        const migratedRealtimeContent = migrateLegacyShippingPolicy(realtimeContent);
        setSiteContent(migratedRealtimeContent);
        safeStorageSetItem('nak_site_content', JSON.stringify(migratedRealtimeContent));
      }
    });

    // F. Cross-tab instant auto-sync using BroadcastChannel (0ms delay across tabs)
    let syncChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        syncChannel = new BroadcastChannel('nak_store_sync_channel');
        syncChannel.onmessage = (event) => {
          if (!isMounted) return;
          const { type, data } = event.data || {};
          if (type === 'products' && Array.isArray(data)) {
            setProducts(data);
          } else if (type === 'categories' && Array.isArray(data)) {
            setCategories(data);
          } else if (type === 'collections' && Array.isArray(data)) {
            setCollections(data);
          } else if (type === 'siteContent' && data) {
            setSiteContent(migrateLegacyShippingPolicy(data));
          }
        };
      } catch {}
    }

    // G. Cross-window / Storage event fallback
    const handleStorageChange = (e: StorageEvent) => {
      if (!isMounted) return;
      if (e.key === 'nak_custom_products' && e.newValue) {
        try { setProducts(JSON.parse(e.newValue)); } catch {}
      } else if (e.key === 'nak_categories' && e.newValue) {
        try { setCategories(JSON.parse(e.newValue)); } catch {}
      } else if (e.key === 'nak_collections' && e.newValue) {
        try { setCollections(JSON.parse(e.newValue)); } catch {}
      } else if (e.key === 'nak_site_content' && e.newValue) {
        try { setSiteContent(migrateLegacyShippingPolicy(JSON.parse(e.newValue))); } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      unsubProducts();
      unsubCats();
      unsubCols();
      unsubContent();
      if (syncChannel) syncChannel.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Update site content and sync to Firestore
  const handleUpdateSiteContent = (newConfig: SiteContentConfig) => {
    setSiteContent(newConfig);
    broadcastStoreChange('siteContent', newConfig);
    safeStorageSetItem('nak_site_content', JSON.stringify(newConfig));
    saveSiteContentToFirestore(newConfig).catch((err) => console.warn('Lỗi đồng bộ site_content:', err));
  };

  const handleUpdateCollections = (newCols: CollectionInfo[]) => {
    setCollections(newCols);
    broadcastStoreChange('collections', newCols);
    safeStorageSetItem('nak_collections', JSON.stringify(newCols));
    pushAndSyncCollectionsToFirestore(newCols, true).catch((err) =>
      console.warn('Lỗi đồng bộ collections lên Firebase:', err)
    );
  };

  const handleUpdateCategories = (newCats: CategoryItem[]) => {
    setCategories(newCats);
    broadcastStoreChange('categories', newCats);
    safeStorageSetItem('nak_categories', JSON.stringify(newCats));
    Promise.all(newCats.map((cat) => saveCategoryToFirestore(cat))).catch((err) =>
      console.warn('Lỗi đồng bộ categories lên Firebase:', err)
    );
  };

  const handleUpdateProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    broadcastStoreChange('products', newProducts);
    safeStorageSetItem('nak_custom_products', JSON.stringify(newProducts));
    if (selectedProduct) {
      const updatedCurr = newProducts.find((p) => p.id === selectedProduct.id);
      if (updatedCurr) {
        setSelectedProduct(updatedCurr);
      }
    }
  };

  // Cart Persistence with lightweight serialization
  useEffect(() => {
    try {
      const serialized = serializeCartItems(cartItems);
      safeStorageSetItem('nak_cart', serialized);
    } catch (e) {
      console.warn("Lỗi lưu giỏ hàng:", e);
    }
  }, [cartItems]);

  const showToast = useCallback((
    msg: string,
    options?: { showCartAction?: boolean; type?: 'success' | 'warning' | 'info'; duration?: number }
  ) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastInfo({
      message: msg,
      showCartAction: Boolean(options?.showCartAction),
      type: options?.type || 'success',
    });
    toastTimeoutRef.current = setTimeout(() => {
      setToastInfo(null);
    }, options?.duration ?? 3200);
  }, []);

  const handleAddToCart = (
    product: Product,
    quantity: number = 1,
    selectedColor?: string,
    selectedSize?: string,
    customNote?: string,
    selectedCharm?: string,
    selectedColorImage?: string,
    selectedCharmImage?: string,
    selectedCharmPrice?: number,
    selectedCharms?: ProductCharmOption[],
    selectedOmamoris?: ProductOmamoriOption[],
    selectedOmamoriPrice?: number,
    selectedKhoen?: string,
    selectedKhoenImage?: string,
    selectedKhoenPrice?: number,
    selectedComboItems?: ComboItemSelection[]
  ) => {
    if (product.inStock === false) {
      showToast(`Sản phẩm "${product.name}" hiện đã hết hàng.`, { type: 'warning' });
      return;
    }

    // Check mandatory option selections (Charms, Omamori, Khoen)
    const hasRequiredCharm = Boolean(product.enableCharmSelection && product.charmSelectionRequired);
    const hasRequiredOmamori = Boolean(product.enableOmamoriSelection && product.omamoriSelectionRequired);
    const hasRequiredKhoen = Boolean(product.enableKhoenSelection && product.khoenSelectionRequired);

    if (!selectedComboItems || selectedComboItems.length === 0) {
      if (hasRequiredCharm && (!selectedCharms || selectedCharms.length === 0) && !selectedCharm) {
        setSelectedProduct(product);
        showToast(`Vui lòng chọn ${product.charmTitle?.trim() || 'charm'} trước khi thêm vào giỏ hàng.`, { type: 'warning' });
        return;
      }

      if (hasRequiredOmamori && (!selectedOmamoris || selectedOmamoris.length === 0)) {
        setSelectedProduct(product);
        showToast(`Vui lòng chọn ${product.omamoriTitle?.trim() || 'bùa Omamori'} trước khi thêm vào giỏ hàng.`, { type: 'warning' });
        return;
      }

      if (hasRequiredKhoen && !selectedKhoen) {
        setSelectedProduct(product);
        showToast(`Vui lòng chọn ${product.khoenTitle?.trim() || 'khoen'} trước khi thêm vào giỏ hàng.`, { type: 'warning' });
        return;
      }
    }

    // Determine max available stock for this product
    const maxStock = typeof product.stock === 'number' && product.stock > 0 ? product.stock : 99;
    const currentInCartForProduct = cartItems
      .filter((item) => item.product.id === product.id)
      .reduce((sum, item) => sum + item.quantity, 0);

    const availableToAdd = maxStock - currentInCartForProduct;
    if (availableToAdd <= 0 && maxStock < 99) {
      showToast(`Bạn đã có đủ số lượng tồn kho (${maxStock} cái) của "${product.name}" trong giỏ!`, { type: 'warning' });
      return;
    }

    // Check color stock if color selected
    const selectedColorOpt = selectedColor && product.colorOptions
      ? product.colorOptions.find((c) => c.name.trim().toLowerCase() === selectedColor.trim().toLowerCase())
      : undefined;

    if (selectedColorOpt && typeof selectedColorOpt.stock === 'number') {
      if (selectedColorOpt.stock <= 0) {
        showToast(`Màu "${selectedColorOpt.name}" hiện đã hết hàng trong kho!`, { type: 'warning' });
        return;
      }
      const inCartForThisColor = cartItems
        .filter((item) => item.product.id === product.id && item.selectedColor === selectedColor)
        .reduce((sum, item) => sum + item.quantity, 0);
      const availableForColor = selectedColorOpt.stock - inCartForThisColor;
      if (availableForColor <= 0) {
        showToast(`Bạn đã có đủ toàn bộ số lượng màu "${selectedColorOpt.name}" (${selectedColorOpt.stock} cái) trong giỏ!`, { type: 'warning' });
        return;
      }
    }

    // Check charm stock if charm selected
    if (selectedCharms && selectedCharms.length > 0) {
      for (const ch of selectedCharms) {
        if (typeof ch.stock === 'number' && ch.stock <= 0) {
          showToast(`Mẫu charm "${ch.name}" hiện đã hết hàng trong kho!`, { type: 'warning' });
          return;
        }
      }
    } else if (selectedCharm && product.charmOptions) {
      const charmOpt = product.charmOptions.find(
        (c) => c.name.trim().toLowerCase() === selectedCharm.trim().toLowerCase()
      );
      if (charmOpt && typeof charmOpt.stock === 'number' && charmOpt.stock <= 0) {
        showToast(`Mẫu charm "${selectedCharm}" hiện đã hết hàng trong kho!`, { type: 'warning' });
        return;
      }
    }

    // Check omamori stock if selected
    if (selectedOmamoris && selectedOmamoris.length > 0) {
      for (const om of selectedOmamoris) {
        if (typeof om.stock === 'number' && om.stock <= 0) {
          showToast(`Bùa "${om.name}" hiện đã hết hàng trong kho!`, { type: 'warning' });
          return;
        }
      }
    }

    // Check khoen stock if selected
    if (selectedKhoen && product.khoenOptions) {
      const khoenOpt = product.khoenOptions.find(
        (k) => k.name.trim().toLowerCase() === selectedKhoen.trim().toLowerCase()
      );
      if (khoenOpt && typeof khoenOpt.stock === 'number' && khoenOpt.stock <= 0) {
        showToast(`Khoen "${selectedKhoen}" hiện đã hết hàng trong kho!`, { type: 'warning' });
        return;
      }
    }

    const qtyToAdd = Math.max(1, Math.min(quantity, availableToAdd > 0 ? availableToAdd : quantity));
    const charmsKey = (selectedCharms || []).map((c) => c.name).sort().join(';');
    const omamorisKey = (selectedOmamoris || []).map((o) => o.name).sort().join(';');

    setCartItems((prev) => {
      const existingIdx = prev.findIndex((item) => {
        const itemCharmsKey = (item.selectedCharms || []).map((c) => c.name).sort().join(';');
        const itemOmamorisKey = (item.selectedOmamoris || []).map((o) => o.name).sort().join(';');
        const comboKey = (selectedComboItems || []).map((c) => `${c.itemId}-${c.selectedColor}-${c.selectedSize}`).join('|');
        const itemComboKey = (item.selectedComboItems || []).map((c) => `${c.itemId}-${c.selectedColor}-${c.selectedSize}`).join('|');
        return (
          item.product.id === product.id &&
          item.selectedColor === selectedColor &&
          item.selectedCharm === selectedCharm &&
          item.selectedKhoen === selectedKhoen &&
          item.selectedSize === selectedSize &&
          item.customNote === customNote &&
          charmsKey === itemCharmsKey &&
          omamorisKey === itemOmamorisKey &&
          comboKey === itemComboKey
        );
      });

      if (existingIdx > -1) {
        return prev.map((item, idx) =>
          idx === existingIdx
            ? { ...item, quantity: item.quantity + qtyToAdd }
            : item
        );
      } else {
        return [
          ...prev,
          {
            product,
            quantity: qtyToAdd,
            selectedColor,
            selectedColorImage,
            selectedCharm,
            selectedCharmImage,
            selectedCharmPrice,
            selectedCharms,
            selectedOmamoris,
            selectedOmamoriPrice,
            selectedKhoen,
            selectedKhoenImage,
            selectedKhoenPrice,
            selectedSize,
            customNote,
            selectedComboItems
          }
        ];
      }
    });

    trackGA4AddToCart(product, qtyToAdd, selectedColor, selectedSize);
    showToast(`Đã thêm "${product.name}" vào giỏ hàng!`, { showCartAction: true });

    // Trigger flying product animation to cart icon
    try {
      const cartBtn = document.getElementById('nav-cart-btn');
      let endX = Math.max(20, window.innerWidth - 60);
      let endY = 32;
      if (cartBtn) {
        const rect = cartBtn.getBoundingClientRect();
        endX = rect.left + rect.width / 2;
        endY = rect.top + rect.height / 2;
      }

      let startX = lastPointerPosRef.current.x;
      let startY = lastPointerPosRef.current.y;

      // Fallback to active element if pointer pos is default
      if (startX <= 0 || startY <= 0) {
        if (document.activeElement && document.activeElement !== document.body) {
          const activeRect = document.activeElement.getBoundingClientRect();
          if (activeRect.width > 0 && activeRect.height > 0) {
            startX = activeRect.left + activeRect.width / 2;
            startY = activeRect.top + activeRect.height / 2;
          }
        }
      }

      // Clamp inside screen bounds
      startX = Math.max(30, Math.min(window.innerWidth - 30, startX));
      startY = Math.max(50, Math.min(window.innerHeight - 50, startY));
      endX = Math.max(30, Math.min(window.innerWidth - 30, endX));
      endY = Math.max(20, Math.min(window.innerHeight - 30, endY));

      // Always use the primary product image as requested
      const mainProductImage = product.image || (product.images && product.images[0]) || '/assets/bracelet.jpg';

      const flyingId = `fly-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${Math.round(performance.now())}`;
      const flyItem: FlyingCartItemData = {
        id: flyingId,
        image: mainProductImage,
        startX,
        startY,
        endX,
        endY,
      };

      setFlyingCartItems((prev) => [...prev.slice(-3), flyItem]);
    } catch (e) {
      console.warn('Lỗi hiệu ứng bay vào giỏ:', e);
    }
  };

  const handleFlyingItemComplete = (id: string) => {
    setFlyingCartItems((prev) => prev.filter((it) => it.id !== id));
    setIsCartBumping(true);
    if (cartBumpTimerRef.current) {
      clearTimeout(cartBumpTimerRef.current);
    }
    cartBumpTimerRef.current = setTimeout(() => {
      setIsCartBumping(false);
    }, 450);
  };

  const handleUpdateCartQuantity = (index: number, quantity: number) => {
    setCartItems((prev) => {
      if (!prev[index]) return prev;
      const targetItem = prev[index];
      let maxStock = typeof targetItem.product.stock === 'number' && targetItem.product.stock > 1 
        ? targetItem.product.stock 
        : 99;

      // Check charm stock if charm selected
      if (targetItem.selectedCharm && targetItem.product.charmOptions) {
        const charmOpt = targetItem.product.charmOptions.find(
          (c) => c.name.trim().toLowerCase() === (targetItem.selectedCharm || '').trim().toLowerCase()
        );
        if (charmOpt && typeof charmOpt.stock === 'number') {
          maxStock = Math.min(maxStock, charmOpt.stock);
        }
      }

      // Check color stock if color selected
      if (targetItem.selectedColor && targetItem.product.colorOptions) {
        const colorOpt = targetItem.product.colorOptions.find(
          (c) => c.name.trim().toLowerCase() === (targetItem.selectedColor || '').trim().toLowerCase()
        );
        if (colorOpt && typeof colorOpt.stock === 'number') {
          maxStock = Math.min(maxStock, colorOpt.stock);
        }
      }

      const otherItemsQty = prev
        .filter((item, i) => i !== index && item.product.id === targetItem.product.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      const maxForThisItem = Math.max(1, maxStock - otherItemsQty);

      const updated = [...prev];
      if (quantity > maxForThisItem && maxStock < 99) {
        showToast(`Sản phẩm/Charm chỉ còn ${maxStock} chiếc trong kho.`, { type: 'warning' });
        updated[index].quantity = maxForThisItem;
      } else {
        updated[index].quantity = Math.max(1, quantity);
      }
      return updated;
    });
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
    showToast('Đã xóa sản phẩm khỏi giỏ hàng.');
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleWebsiteOrderPlaced = (orderData: StoredOrder) => {
    showToast('Đơn hàng của bạn đã được ghi nhận!');
    if (!orderData.itemDetails || orderData.itemDetails.length === 0) return;

    setProducts((prevProducts) => {
      let hasChanges = false;
      const updated = prevProducts.map((p) => {
        const matchingItems = orderData.itemDetails?.filter((it) => it.productId === p.id);
        if (!matchingItems || matchingItems.length === 0) return p;

        hasChanges = true;
        let totalDeduct = 0;
        let updatedCharmOptions = p.charmOptions ? [...p.charmOptions] : undefined;
        let updatedColorOptions = p.colorOptions ? [...p.colorOptions] : undefined;

        for (const it of matchingItems) {
          totalDeduct += it.quantity;
          if (it.selectedCharm && updatedCharmOptions) {
            updatedCharmOptions = updatedCharmOptions.map((charm) => {
              if (charm.name.trim().toLowerCase() === (it.selectedCharm || '').trim().toLowerCase()) {
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

          if (it.selectedColor && updatedColorOptions) {
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
        }

        // Aggregate stock: Total product stock is the sum of colors' stock when color options have stock
        const hasColorStocks = Boolean(
          p.enableColorSelection !== false &&
          updatedColorOptions &&
          updatedColorOptions.length > 0 &&
          updatedColorOptions.some((c) => typeof c.stock === 'number')
        );

        let newStock: number;
        if (hasColorStocks && updatedColorOptions) {
          newStock = updatedColorOptions.reduce((sum, c) => sum + (typeof c.stock === 'number' ? c.stock : 0), 0);
        } else {
          const currentStock = typeof p.stock === 'number' ? p.stock : 15;
          newStock = Math.max(0, currentStock - totalDeduct);
        }

        const updatedProd: Product = {
          ...p,
          stock: newStock,
          inStock: newStock > 0,
          charmOptions: updatedCharmOptions,
          colorOptions: updatedColorOptions
        };

        saveProductToFirestore(updatedProd).catch((err) => {
          console.warn('Lỗi cập nhật tồn kho sau đặt hàng web:', err);
        });

        return updatedProd;
      });

      if (hasChanges) {
        safeStorageSetItem('nak_custom_products', JSON.stringify(updated));
        return updated;
      }
      return prevProducts;
    });
  };

  // Immediate Scroll to Top Helper for Page Transitions
  const scrollToPageBeginning = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  // Navigation Handlers with Clean HTML5 URLs
  const navigateTo = useCallback((cleanPath: string) => {
    try {
      const currentFull = window.location.pathname + (window.location.search || '');
      if (currentFull !== cleanPath || window.location.hash) {
        window.history.pushState(null, '', cleanPath);
      }
    } catch (e) {}
    syncStateFromLocation();
    scrollToPageBeginning();
  }, [syncStateFromLocation]);

  const handleSelectCollection = (collectionId: string) => {
    const matchedCol = collections.find((c) => c.id === collectionId);
    const colSlug = getCollectionSlug(collectionId, matchedCol?.title);
    setActiveCollectionId(collectionId);
    setCurrentView('collection');
    navigateTo(`/collection/${colSlug}`);
  };

  const handleOpenAllCatalog = (categoryId: string = 'all', searchQuery?: string) => {
    setSelectedCategory(categoryId);
    setCurrentView('catalog');
    const catSlug = slugify(categoryId);
    if (searchQuery) {
      navigateTo(`/products?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigateTo(categoryId !== 'all' ? `/products?category=${catSlug}` : '/products');
    }
  };

  const handleOpenAbout = () => {
    setCurrentView('about');
    navigateTo('/about');
  };

  const handleOpenContact = () => {
    setCurrentView('contact');
    navigateTo('/contact');
  };

  const handleOpenOrderTracker = (trackingCode?: string) => {
    setOrderTrackerInitialCode(trackingCode || '');
    setCurrentView('order-tracker');
    navigateTo(trackingCode ? `/tracker?code=${encodeURIComponent(trackingCode)}` : '/tracker');
  };

  const handleHeroSlideNavigation = (target: string) => {
    if (!target) return;
    if (target.startsWith('http://') || target.startsWith('https://')) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }
    const cleanTarget = target.replace(/^#\/?/, '');
    if (cleanTarget === 'about') {
      handleOpenAbout();
      return;
    }
    if (cleanTarget === 'contact') {
      handleOpenContact();
      return;
    }
    if (cleanTarget === 'tracking' || cleanTarget === 'order-tracker' || cleanTarget === 'tracker') {
      handleOpenOrderTracker();
      return;
    }
    if (cleanTarget === 'custom-order') {
      setCurrentView('custom-order');
      navigateTo('/custom-order');
      return;
    }
    if (cleanTarget === 'collections') {
      setCurrentView('landing');
      navigateTo('/');
      const el = document.getElementById('collections-showcase-section');
      el?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    // Check if target matches any collection
    const matchedCol = collections.find((c) => c.id === cleanTarget || c.categoryKey === cleanTarget);
    if (matchedCol) {
      handleSelectCollection(matchedCol.id);
      return;
    }
    // Otherwise route to catalog with the category ID
    handleOpenAllCatalog(cleanTarget);
  };

  const handleNavigateLanding = () => {
    setCurrentView('landing');
    navigateTo('/');
  };

  const handleOpenAdmin = () => {
    const session = getAdminSession();
    if (session && session.username) {
      setCurrentSeller(session as SellerUser);
      setCurrentView('admin');
      navigateTo('/admin');
    } else {
      setIsAdminLoginModalOpen(true);
    }
  };

  const handleAdminLoginSuccess = (user: SellerUser) => {
    setCurrentSeller(user);
    setIsAdminLoginModalOpen(false);
    setCurrentView('admin');
    navigateTo('/admin');
    showToast(`Xin chào ${user.name} (@${user.username})!`);
  };

  const handleAdminLogout = () => {
    clearAdminSession();
    setCurrentSeller(null);
    setCurrentView('landing');
    navigateTo('/');
    showToast('Đã đăng xuất khỏi tài khoản quản trị.');
  };

  const handleOpenProductDetail = (p: Product) => {
    if (currentView !== 'product-detail') {
      setPreviousView(currentView as any);
    }
    setSelectedProduct(p);
    setCurrentView('product-detail');
    const slug = getProductSlug(p);
    navigateTo(`/product/${slug}`);
  };

  const handleCloseProductDetail = () => {
    setSelectedProduct(null);
    if (previousView === 'collection' && activeCollectionId && activeCollectionId !== 'all') {
      setCurrentView('collection');
      const matchedCol = collections.find((c) => c.id === activeCollectionId);
      const colSlug = getCollectionSlug(activeCollectionId, matchedCol?.title);
      navigateTo(`/collection/${colSlug}`);
    } else if (previousView === 'landing') {
      handleNavigateLanding();
    } else if (previousView === 'about') {
      handleOpenAbout();
    } else if (previousView === 'contact') {
      handleOpenContact();
    } else {
      // Default to catalog (Trang Sản Phẩm)
      setCurrentView('catalog');
      const catSlug = slugify(selectedCategory || 'all');
      navigateTo(selectedCategory && selectedCategory !== 'all' ? `/products?category=${catSlug}` : '/products');
    }
  };

  const handleOpenCartDrawer = () => {
    setCurrentView('cart');
    setIsCartOpen(false);
    navigateTo('/cart');
  };

  const handleCloseCartDrawer = () => {
    setIsCartOpen(false);
    if (window.location.hash === '#cart' || window.location.hash === '#checkout') {
      window.history.back();
    }
  };

  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const landingProductSections = useMemo(() => {
    let sections: typeof DEFAULT_SITE_CONTENT.landingProductSections = [];
    if (siteContent?.landingProductSections && siteContent.landingProductSections.length > 0) {
      sections = siteContent.landingProductSections;
    } else if (siteContent?.landingProducts) {
      sections = [siteContent.landingProducts];
    } else {
      sections = DEFAULT_SITE_CONTENT.landingProductSections || [];
    }

    const hasActive = sections.some((s) => s.isActive !== false);
    if (!hasActive && sections.length > 0) {
      return sections.map((s, idx) => (idx === 0 ? { ...s, isActive: true } : s));
    }
    return sections;
  }, [siteContent]);

  const handleAnnouncementClick = () => {
    const link = siteContent?.announcementLink?.trim();
    if (!link) return;
    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else if (link.startsWith('/')) {
      navigateTo(link);
    } else if (link.startsWith('#')) {
      navigateTo('/' + link.replace(/^#\/?/, ''));
    } else {
      navigateTo('/' + link);
    }
  };

  if (isProductsLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#FAF9F6] text-slate-900 select-none">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <div className="text-center">
            <h1 className="text-lg font-black tracking-widest text-slate-900">NOT A KNOT</h1>
            <p className="text-xs font-medium text-slate-400 mt-1">Đang tải dữ liệu cửa hàng...</p>
          </div>
        </div>
      </div>
    );
  }

  // Determine if visitor must see maintenance screen (Admin users can bypass to inspect and turn off)
  const isMaintenanceActiveForUser = Boolean(
    maintenanceConfig.enabled && !currentSeller && currentView !== 'admin'
  );
  const isCurrentSellerAdmin = Boolean(isRootAdminUser(currentSeller));

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip relative flex flex-col bg-[#FAF9F6] text-slate-900 selection:bg-amber-400 selection:text-slate-950 font-sans">
      {/* Sticky Admin Notification Bar when Maintenance Mode is ACTIVE */}
      {maintenanceConfig.enabled && currentSeller && (
        <div className="bg-rose-600 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between shadow-lg sticky top-0 z-50 border-b border-rose-700">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm shrink-0 animate-pulse">⚠️</span>
            <span className="truncate">
              <strong>CHẾ ĐỘ BẢO TRÌ ĐANG BẬT:</strong> Khách hàng hiện không thể xem shop ({isCurrentSellerAdmin ? 'Quản trị viên có thể tắt bảo trì để mở lại website.' : 'Chỉ Quản trị viên mới có quyền tắt chế độ bảo trì.'}).
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {/* ONLY Quản trị viên can see and interact with the button to turn off maintenance! */}
            {isCurrentSellerAdmin ? (
              <button
                type="button"
                onClick={() => setIsTurnOffMaintenanceModalOpen(true)}
                className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-black cursor-pointer shadow-xs transition-colors"
              >
                Tắt bảo trì ngay
              </button>
            ) : (
              <span className="px-2.5 py-1 bg-rose-800/80 text-rose-100 rounded-lg text-[11px] font-semibold border border-rose-500/40">
                Chỉ Quản trị viên mới được tắt
              </span>
            )}
            {currentView !== 'admin' && (
              <button
                type="button"
                onClick={() => setCurrentView('admin')}
                className="px-3 py-1 bg-rose-800 hover:bg-rose-900 text-white rounded-lg text-xs font-black cursor-pointer transition-colors"
              >
                Vào Quản Trị
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast notification banner */}
      {toastInfo && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-amber-400/40 flex items-center gap-3 animate-fadeIn max-w-[92vw] sm:max-w-md"
        >
          {toastInfo.type === 'warning' ? (
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-semibold leading-relaxed">{toastInfo.message}</span>
          {toastInfo.showCartAction && (
            <button
              type="button"
              onClick={handleOpenCartDrawer}
              className="ml-2 text-xs font-black text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer shrink-0 px-2 py-1 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Xem giỏ</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setToastInfo(null)}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors ml-1 shrink-0 cursor-pointer"
            aria-label="Đóng thông báo"
            title="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </aside>
      )}

      {/* Landing Page Exclusive Promo Announcement Banner (Full Width Infinite Continuous Loop) */}
      {!isMaintenanceActiveForUser && currentView === 'landing' && Boolean(siteContent?.announcementActive) === true && !announcementDismissed && (
        <aside aria-label="Thông báo ưu đãi" className="bg-red-600 text-white py-2 text-xs font-bold flex items-center justify-between border-b border-red-700/50 transition-all overflow-hidden overflow-x-clip w-full max-w-full relative select-none">
          <div
            onClick={siteContent?.announcementLink ? handleAnnouncementClick : undefined}
            className={`w-full max-w-full overflow-hidden overflow-x-clip whitespace-nowrap ${
              siteContent?.announcementLink ? 'cursor-pointer hover:opacity-95' : ''
            }`}
            title={siteContent?.announcementLink ? `Bấm để mở liên kết: ${siteContent.announcementLink}` : undefined}
          >
            <div className="animate-ticker flex items-center">
              {/* Render 2 identical sets to create a 100% seamless, continuous loop from right to left */}
              {[0, 1].map((setIdx) => (
                <div key={setIdx} className="flex items-center shrink-0">
                  {[0, 1, 2, 3].map((itemIdx) => (
                    <div key={itemIdx} className="flex items-center gap-3 px-8 sm:px-12">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-amber-300 animate-pulse" />
                      <span className="tracking-wide">
                        {siteContent?.announcementText || 'Ưu đãi đặt trước BST Mới: Tặng kèm móc khóa handmade cao cấp cho đơn từ 299k!'}
                      </span>
                      <span className="text-white/40 font-normal px-2">✦</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAnnouncementDismissed(true);
            }}
            className="p-1 hover:bg-black/20 rounded-full text-white transition-colors absolute right-2 z-10 cursor-pointer bg-red-600/90 backdrop-blur-xs shadow-xs"
            title="Đóng thông báo"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </aside>
      )}

      {/* Sleek Minimized Navigation Bar (Hidden in Admin Mode, 404 Page & Maintenance Mode for Users) */}
      {currentView !== 'admin' && currentView !== 'not-found' && !isMaintenanceActiveForUser && (
        <Navbar
          cartCount={totalCartCount}
          isCartBumping={isCartBumping}
          categories={categories}
          collections={collections}
          siteContent={siteContent}
          onOpenCart={handleOpenCartDrawer}
          onNavigateLanding={handleNavigateLanding}
          onSelectCollection={handleSelectCollection}
          onOpenAllCatalog={handleOpenAllCatalog}
          onOpenAbout={handleOpenAbout}
          onOpenContact={handleOpenContact}
          onOpenOrderTracker={() => handleOpenOrderTracker()}
          onOpenAdmin={handleOpenAdmin}
          currentView={currentView}
          activeCollectionId={activeCollectionId}
          currentSeller={currentSeller}
          isAdminLoggedIn={Boolean(currentSeller)}
        />
      )}

      {/* Main Content Router */}
      <main className="flex-grow w-full max-w-full overflow-x-clip relative">
        {/* VIEW: Public Maintenance Mode Screen for Visitors */}
        {isMaintenanceActiveForUser && (
          <React.Suspense fallback={<ViewLoadingFallback />}>
            <MaintenanceScreen
              config={maintenanceConfig}
              brandName={siteContent?.brandName}
              logoUrl={siteContent?.logoUrl}
              onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
            />
          </React.Suspense>
        )}

        {/* VIEW 1: Landing Page */}
        {!isMaintenanceActiveForUser && currentView === 'landing' && (
          <>
            {/* Primary Semantic H1 Heading for Accessibility and SEO Hierarchy */}
            <h1 className="sr-only">
              {siteContent?.brandName || 'NOT A KNOT'} - {siteContent?.tagline || 'Phụ Kiện Vòng Tay Handmade Thủ Công Độc Bản'}
            </h1>

            {/* Hero Carousel */}
            <HeroBanners
              slides={siteContent?.heroSlides}
              onSelectCategory={handleHeroSlideNavigation}
              onNavigateToEvent={() => handleSelectCollection('event_0209')}
              onSelectBannerCategory={handleHeroSlideNavigation}
              onOpen0209Event={() => handleSelectCollection('event_0209')}
              onOpenAbout={handleOpenAbout}
            />

            {/* The Collection(s) - Landing Page Direct Products Grid(s) (e.g. BACK TO SCHOOL / THE COLLECTION) */}
            {landingProductSections.map((secConfig, idx) => (
              <LandingProductsCollection
                key={secConfig.id || `landing-sec-${idx}`}
                config={secConfig}
                products={visibleProducts}
                categories={categories}
                collections={collections}
                sectionIndex={idx}
                zaloPhone={siteContent?.zalo || siteContent?.phone}
                messengerLink={siteContent?.socialLinks?.messenger || siteContent?.socialLinks?.facebook}
                onOpenProductDetail={handleOpenProductDetail}
                onOpenAllCatalog={(cat) => handleOpenAllCatalog(cat || 'all')}
              />
            ))}


            {/* Brand Story Banner positioned directly above Social Grid */}
            <LandingBrandStoryBanner
              onOpenAboutPage={handleOpenAbout}
              brandName={siteContent?.brandName}
            />

            {/* Social Grid & Activity Feed Section */}
            <LandingSocialGrid
              siteContent={siteContent}
            />

            {/* Dedicated FAQ Section positioned at the very bottom of Landing Page */}
            <LandingFaqCommitments
              siteContent={siteContent}
              onOpenAboutPage={handleOpenAbout}
              onOpenContact={handleOpenContact}
            />
          </>
        )}

        {/* VIEW 2: Collection Detail Page */}
        {currentView === 'collection' && (
          <React.Suspense fallback={<ViewLoadingFallback />}>
            <CollectionDetailPage
              collectionId={activeCollectionId}
              products={visibleProducts}
              collections={collections}
              isAdminLoggedIn={Boolean(currentSeller)}
              onUpdateCollections={handleUpdateCollections}
              onBackToLanding={handleNavigateLanding}
              onSelectCollection={handleSelectCollection}
              onOpenProductDetail={handleOpenProductDetail}
              onAddToCart={handleAddToCart}
              onPreorderSuccess={() => showToast('Đăng ký đặt trước 02/09 thành công!')}
            />
          </React.Suspense>
        )}

        {/* VIEW 3: Full Catalog Page (All products store with search & category filters) */}
        {currentView === 'catalog' && (
          <React.Suspense fallback={<ViewLoadingFallback />}>
            <ProductCatalog
              products={visibleProducts}
              categories={categories}
              collections={collections}
              selectedCategory={selectedCategory}
              onSelectCategory={(cat) => setSelectedCategory(cat)}
              onOpenProductDetail={handleOpenProductDetail}
              onAddToCart={(p) => handleAddToCart(p, 1)}
              onBackToHome={handleNavigateLanding}
              isLoading={isProductsLoading}
            />
          </React.Suspense>
        )}

        {/* VIEW 4: Dedicated Standalone About Page */}
        {currentView === 'about' && (
          <React.Suspense fallback={<ViewLoadingFallback />}>
            <AboutPage
              siteContent={siteContent}
              onNavigateHome={handleNavigateLanding}
              onOpenCatalog={() => handleOpenAllCatalog('all')}
              onOpenContact={handleOpenContact}
            />
          </React.Suspense>
        )}

        {/* VIEW 5: Dedicated Standalone Contact Page */}
        {currentView === 'contact' && (
          <React.Suspense fallback={<ViewLoadingFallback />}>
            <ContactPage
              siteContent={siteContent}
              onNavigateHome={handleNavigateLanding}
              onOpenAllCatalog={() => handleOpenAllCatalog('all')}
            />
          </React.Suspense>
        )}

        {/* VIEW 6: Dedicated Standalone Admin Portal Page with Strict Auth Gating */}
        {currentView === 'admin' && (
          currentSeller ? (
            <React.Suspense
              fallback={
                <div className="min-h-[85vh] flex flex-col items-center justify-center p-8 bg-neutral-950 text-white">
                  <div className="w-12 h-12 rounded-2xl border-4 border-amber-500/20 border-t-amber-500 animate-spin mb-4 shadow-lg shadow-amber-500/10" />
                  <p className="text-sm font-bold text-amber-100 tracking-wide">Đang nạp không gian quản trị bảo mật...</p>
                  <span className="text-xs text-slate-400 mt-1">Dữ liệu được bảo vệ và mã hóa theo phiên</span>
                </div>
              }
            >
              <AdminPage
                products={products}
                categories={categories}
                collections={collections}
                siteContent={siteContent}
                currentSeller={currentSeller}
                onUpdateCurrentSeller={setCurrentSeller}
                onUpdateProducts={handleUpdateProducts}
                onUpdateCategories={handleUpdateCategories}
                onUpdateCollections={handleUpdateCollections}
                onUpdateSiteContent={handleUpdateSiteContent}
                onLogout={handleAdminLogout}
                onBackToStore={handleNavigateLanding}
              />
            </React.Suspense>
          ) : (
            <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center bg-slate-50">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Trang Quản Trị Bảo Mật</h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
                Nội dung quản trị được mã hóa và bảo vệ. Vui lòng đăng nhập với tài khoản quản trị viên của NOT A KNOT để truy cập.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleNavigateLanding}
                  className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition-colors cursor-pointer shadow-xs"
                >
                  Về Trang Chủ
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdminLoginModalOpen(true)}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md"
                >
                  Đăng Nhập Quản Trị
                </button>
              </div>
            </div>
          )
        )}

        {/* VIEW 7: Dedicated Standalone Product Detail Page */}
        {currentView === 'product-detail' && selectedProduct && (
          <React.Suspense fallback={<ViewLoadingFallback />}>
            <ProductDetailPage
              product={selectedProduct}
              allProducts={visibleProducts}
              categories={categories}
              collections={collections}
              cartItems={cartItems}
              backLabel={
                previousView === 'catalog'
                  ? 'Quay lại trang sản phẩm'
                  : previousView === 'collection'
                  ? 'Quay lại bộ sưu tập'
                  : previousView === 'landing'
                  ? 'Quay lại trang chủ'
                  : previousView === 'about'
                  ? 'Quay lại Về chúng tôi'
                  : previousView === 'contact'
                  ? 'Quay lại Liên hệ'
                  : 'Quay lại danh mục sản phẩm'
              }
              onBack={handleCloseProductDetail}
              onSelectProduct={handleOpenProductDetail}
              onAddToCart={(p, qty, color, size, note, charm, colorImg, charmImg, charmPrice, charms, omamoris, omamoriPrice, khoen, khoenImg, khoenPrice, comboItems) => {
                handleAddToCart(p, qty, color, size, note, charm, colorImg, charmImg, charmPrice, charms, omamoris, omamoriPrice, khoen, khoenImg, khoenPrice, comboItems);
              }}
              onBuyNow={(p, qty, color, size, note, charm, colorImg, charmImg, charmPrice, charms, omamoris, omamoriPrice, khoen, khoenImg, khoenPrice, comboItems) => {
                handleAddToCart(p, qty, color, size, note, charm, colorImg, charmImg, charmPrice, charms, omamoris, omamoriPrice, khoen, khoenImg, khoenPrice, comboItems);
                handleOpenCartDrawer();
              }}
            />
          </React.Suspense>
        )}

        {/* VIEW 8: Standalone Order Tracking & Progress Page */}
        {currentView === 'order-tracker' && (
          <React.Suspense fallback={<ViewLoadingFallback />}>
            <OrderTracker
              initialTrackingCode={orderTrackerInitialCode}
              siteContent={siteContent}
              onNavigateHome={handleNavigateLanding}
              onNavigateCatalog={() => handleOpenAllCatalog('all')}
            />
          </React.Suspense>
        )}

        {/* VIEW 9: Dedicated Full-Page Cart & Checkout Experience */}
        {currentView === 'cart' && (
          <React.Suspense fallback={<ViewLoadingFallback />}>
            <CartPage
              cartItems={cartItems}
              products={products}
              siteContent={siteContent}
              facebookUrl={siteContent?.socialLinks?.facebook}
              messengerUrl={siteContent?.socialLinks?.messenger || 'https://m.me/61593591390851'}
              onUpdateQuantity={handleUpdateCartQuantity}
              onRemoveItem={handleRemoveCartItem}
              onClearCart={handleClearCart}
              onOrderPlaced={handleWebsiteOrderPlaced}
              onContinueShopping={() => handleOpenAllCatalog('all')}
              onOpenOrderTracker={handleOpenOrderTracker}
            />
          </React.Suspense>
        )}

        {/* VIEW 10: Dedicated Custom 404 Page (Self-contained like Maintenance Page) */}
        {currentView === 'not-found' && (
          <React.Suspense fallback={<ViewLoadingFallback />}>
            <NotFoundPage
              onNavigateHome={handleNavigateLanding}
              onOpenCatalog={(catId, search) => handleOpenAllCatalog(catId || 'all', search)}
              onOpenTracker={() => {
                setCurrentView('order-tracker');
                navigateTo('/tracker');
              }}
              onOpenContact={handleOpenContact}
              brandName={siteContent?.brandName}
              logoUrl={siteContent?.logoUrl}
            />
          </React.Suspense>
        )}
      </main>

      {/* Customer Footer (Rendered across Landing, Collection, Catalog, About, Contact & Order Tracking pages; Hidden on Admin, 404 & Maintenance) */}
      {currentView !== 'admin' && currentView !== 'not-found' && !isMaintenanceActiveForUser && (
        <Footer
          siteContent={siteContent}
          categories={categories}
          onOpenAdmin={handleOpenAdmin}
          onSelectCollection={handleSelectCollection}
          onSelectCategory={(catId) => handleOpenAllCatalog(catId)}
          onOpenAllCatalog={() => handleOpenAllCatalog('all')}
          onOpenAbout={handleOpenAbout}
          onOpenContact={handleOpenContact}
          onOpenOrderTracker={() => handleOpenOrderTracker()}
          onOpenPolicy={handleOpenPolicy}
        />
      )}

      {/* Transparent Legal & Customer Protection Policies Modal (Lazy Loaded on Open) */}
      {isPolicyModalOpen && (
        <React.Suspense fallback={null}>
          <LegalPoliciesModal
            isOpen={isPolicyModalOpen}
            onClose={() => setIsPolicyModalOpen(false)}
            initialTab={policyModalTab}
          />
        </React.Suspense>
      )}

      {/* Admin Login Authentication Gate Modal (Lazy Loaded on Open) */}
      {isAdminLoginModalOpen && (
        <React.Suspense fallback={null}>
          <AdminLoginModal
            isOpen={isAdminLoginModalOpen}
            onClose={() => setIsAdminLoginModalOpen(false)}
            onLoginSuccess={handleAdminLoginSuccess}
            sellers={sellers}
            brandName={siteContent?.brandName}
            logoUrl={siteContent?.logoUrl}
          />
        </React.Suspense>
      )}

      {/* Interactive Fly-To-Cart Dynamic Visual Animation */}
      <FlyingProductCartAnimation
        items={flyingCartItems}
        onItemComplete={handleFlyingItemComplete}
      />

      {/* Clear Cookie Consent & Privacy Transparency Form (Deferred Script Loading) */}
      {currentView !== 'admin' && !isMaintenanceActiveForUser && (
        <React.Suspense fallback={null}>
          <CookieConsentBanner
            onOpenPolicy={handleOpenPolicy}
            onToast={showToast}
          />
        </React.Suspense>
      )}

      {/* Confirmation Screen when turning off Maintenance Mode */}
      <TurnOffMaintenanceConfirmModal
        isOpen={isTurnOffMaintenanceModalOpen}
        onClose={() => setIsTurnOffMaintenanceModalOpen(false)}
        onConfirm={handleConfirmTurnOffMaintenance}
        adminName={currentSeller?.name || 'Quản trị viên'}
        brandName={siteContent?.brandName || 'NOT A KNOT'}
      />
    </div>
  );
}
