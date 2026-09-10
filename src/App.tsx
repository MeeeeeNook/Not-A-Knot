import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { HeroBanners } from './components/HeroBanners';
import { LandingCollectionBanners } from './components/LandingCollectionBanners';
import { AboutUsSection } from './components/AboutUsSection';
import { LandingFaqCommitments } from './components/LandingFaqCommitments';
import { AboutPage } from './components/AboutPage';
import { ContactPage } from './components/ContactPage';
import { DynamicCustomElements } from './components/DynamicCustomElements';
import { CollectionDetailPage } from './components/CollectionDetailPage';
import { ProductCatalog } from './components/ProductCatalog';
import { ProductDetailPage } from './components/ProductDetailPage';
import { CartDrawer } from './components/CartDrawer';
import { CartPage } from './components/CartPage';
import { OrderTracker } from './components/OrderTracker';
import { AdminPage } from './components/AdminPage';
import { Footer } from './components/Footer';
import { PRODUCTS } from './data/products';
import { DEFAULT_CATEGORIES } from './data/categories';
import { COLLECTIONS_DATA } from './data/collections';
import { DEFAULT_SITE_CONTENT } from './data/siteContent';
import { Product, CartItem, CategoryItem, CollectionInfo, SiteContentConfig, SellerUser } from './types';
import { CheckCircle2, ShoppingBag, Sparkles, X, Lock } from 'lucide-react';
import { AdminLoginModal } from './components/AdminLoginModal';
import { getAdminSession, clearAdminSession, createDefaultSellers, deduplicateSellers } from './utils/auth';
import {
  fetchProductsFromFirestore,
  fetchCategoriesFromFirestore,
  fetchCollectionsFromFirestore,
  fetchSiteContentFromFirestore,
  fetchSellersFromFirestore,
  saveSiteContentToFirestore,
  saveCategoryToFirestore,
  saveCollectionToFirestore,
  saveProductToFirestore,
  pushAndSyncProductsToFirestore,
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

export default function App() {
  // Navigation & View State (Landing, Collection Detail, Full Catalog, Standalone About Page, Standalone Contact Page, Standalone Admin Page, Standalone Product Detail Page, Order Tracking Page, Full Cart Page)
  const [currentView, setCurrentView] = useState<'landing' | 'collection' | 'catalog' | 'about' | 'contact' | 'admin' | 'product-detail' | 'order-tracker' | 'cart'>('landing');
  const [previousView, setPreviousView] = useState<'landing' | 'collection' | 'catalog' | 'about' | 'contact' | 'admin'>('catalog');
  const [activeCollectionId, setActiveCollectionId] = useState<string>('event_0209');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderTrackerInitialCode, setOrderTrackerInitialCode] = useState<string>('');

  // Collections state
  const [collections, setCollections] = useState<CollectionInfo[]>(() => {
    try {
      const saved = localStorage.getItem('nak_collections');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
          return parsed;
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

  const productsRef = useRef<Product[]>(products);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Publicly visible products (filtered to exclude hidden items or items in hidden categories on storefront)
  const visibleProducts = useMemo(() => {
    const hiddenCategoryIds = new Set(categories.filter((c) => c.isHidden).map((c) => c.id));
    return products.filter((p) => !p.isHidden && !hiddenCategoryIds.has(p.category));
  }, [products, categories]);

  // Site Content Configuration (CMS) state
  const [siteContent, setSiteContent] = useState<SiteContentConfig>(() => {
    try {
      const saved = localStorage.getItem('nak_site_content');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const merged = { ...DEFAULT_SITE_CONTENT, ...parsed };
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

  // Cart state with localStorage initialization
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('nak_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal visibility states
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ========================================================
  // HASH-BASED ROUTING SYSTEM
  // Supports: #home, #products, #product-detail, #cart, #checkout,
  //           #collection, #about, #contact, #admin
  // ========================================================
  const syncStateFromHash = useCallback((hashString: string) => {
    const rawHash = hashString.replace(/^#\/?/, '');
    if (!rawHash || rawHash === 'home' || rawHash === 'landing') {
      setCurrentView('landing');
      setIsCartOpen(false);
      setSelectedProduct(null);
      return;
    }

    // Parse path and params
    const [pathPart, queryPart] = rawHash.split('?');
    const params = new URLSearchParams(queryPart || '');

    if (pathPart === 'admin') {
      const session = getAdminSession();
      if (session && session.username) {
        setCurrentSeller(session as SellerUser);
        setCurrentView('admin');
      } else {
        setIsAdminLoginModalOpen(true);
        setCurrentView('landing');
      }
      setIsCartOpen(false);
      return;
    }

    if (pathPart === 'about') {
      setCurrentView('about');
      setIsCartOpen(false);
      return;
    }

    if (pathPart === 'contact') {
      setCurrentView('contact');
      setIsCartOpen(false);
      return;
    }

    if (pathPart === 'tracking' || pathPart === 'order-tracker' || pathPart === 'tra-cuu') {
      const code = params.get('code');
      if (code) {
        setOrderTrackerInitialCode(code);
      }
      setCurrentView('order-tracker');
      setIsCartOpen(false);
      return;
    }

    if (pathPart === 'cart' || pathPart === 'checkout' || pathPart === 'gio-hang') {
      setCurrentView('cart');
      setIsCartOpen(false);
      return;
    }

    if (pathPart === 'products' || pathPart === 'catalog') {
      setCurrentView('catalog');
      const cat = params.get('category');
      if (cat) {
        setSelectedCategory(cat);
      }
      setIsCartOpen(false);
      return;
    }

    if (pathPart === 'product-detail' || pathPart.startsWith('product/')) {
      const prodId = params.get('id') || pathPart.replace('product/', '');
      if (prodId) {
        const found = productsRef.current.find((p) => p.id === prodId);
        if (found) {
          setSelectedProduct(found);
          setCurrentView('product-detail');
        }
      }
      setIsCartOpen(false);
      return;
    }

    if (pathPart.startsWith('collection/') || pathPart.startsWith('collection-')) {
      const colId = pathPart.replace(/^collection[\/-]/, '');
      if (colId) {
        setActiveCollectionId(colId);
        setCurrentView('collection');
      }
      return;
    }

    // Default fallback
    if (pathPart === 'home') {
      setCurrentView('landing');
    }
  }, []);

  // Listen to browser hash changes (Back / Forward buttons) & track GA4 page views
  useEffect(() => {
    const handleHashChange = () => {
      const currentHash = window.location.hash || '#home';
      syncStateFromHash(currentHash);
      
      // Determine readable title for GA4
      let pageTitle = 'Trang Chủ - NOT A KNOT';
      if (currentHash.includes('#admin')) pageTitle = 'Quản Trị Hệ Thống - NOT A KNOT';
      else if (currentHash.includes('#cart') || currentHash.includes('#checkout')) pageTitle = 'Giỏ Hàng & Thanh Toán';
      else if (currentHash.includes('#products')) pageTitle = 'Tất Cả Sản Phẩm';
      else if (currentHash.includes('#product-detail')) pageTitle = 'Chi Tiết Sản Phẩm';
      else if (currentHash.includes('#collection')) pageTitle = 'Bộ Sưu Tập';
      else if (currentHash.includes('#about')) pageTitle = 'Về Chúng Tôi - NOT A KNOT';
      else if (currentHash.includes('#contact')) pageTitle = 'Liên Hệ & Showroom';

      trackGA4PageView(currentHash, pageTitle);
    };

    // Initial check on mount
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [syncStateFromHash]);

  // Track session engagement duration and time on page (heartbeat)
  useEffect(() => {
    let sessionSeconds = 0;
    const interval = setInterval(() => {
      // If user tab is visible, record engagement
      if (document.visibilityState === 'visible') {
        sessionSeconds += 5;
        recordSessionHeartbeat(5);
        
        // Track time spent on the current page hash
        const currentHash = window.location.hash || '#home';
        recordPageTimeSpent(currentHash, 5);
        
        // Every 30 seconds, ping GA4 user_engagement event
        if (sessionSeconds % 30 === 0) {
          trackGA4Engagement(sessionSeconds);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Security Guard: Load sellers list ONLY when admin login modal is active or admin is already logged in
  useEffect(() => {
    if (!isAdminLoginModalOpen && !currentSeller) return;

    const initSellers = async () => {
      try {
        const dbSellers = await fetchSellersFromFirestore();
        if (dbSellers && dbSellers.length > 0) {
          const clean = deduplicateSellers(dbSellers);
          setSellers(clean);
          try {
            localStorage.setItem('nak_sellers_list', JSON.stringify(clean));
          } catch {
            // ignore
          }
        } else {
          const local = localStorage.getItem('nak_sellers_list');
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
            try {
              localStorage.setItem('nak_sellers_list', JSON.stringify(clean));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        const defaults = await createDefaultSellers();
        setSellers(deduplicateSellers(defaults));
      }
    };
    initSellers();
  }, [isAdminLoginModalOpen, currentSeller]);

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
          try {
            localStorage.setItem('nak_custom_products', JSON.stringify(cloudProds));
          } catch {}
        }
        if (cloudCats && cloudCats.length > 0) {
          setCategories(cloudCats);
          try {
            localStorage.setItem('nak_categories', JSON.stringify(cloudCats));
          } catch {}
        }
        if (cloudCols && cloudCols.length > 0) {
          const sorted = [...cloudCols].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setCollections(sorted);
          try {
            localStorage.setItem('nak_collections', JSON.stringify(sorted));
          } catch {}
        }
        if (cloudSite) {
          setSiteContent(cloudSite);
          try {
            localStorage.setItem('nak_site_content', JSON.stringify(cloudSite));
          } catch {}
        }
      } catch (err) {
        console.warn('Initial cloud fetch notice:', err);
      }
    };
    loadInitialCloudData();

    // B. Real-time Products listener (auto-syncs products, prices, stock, images live)
    const unsubProducts = subscribeToProductsFromFirestore((realtimeProducts) => {
      if (!isMounted) return;
      if (realtimeProducts && realtimeProducts.length > 0) {
        setProducts(realtimeProducts);
        setSelectedProduct((curr) => {
          if (!curr) return null;
          const matched = realtimeProducts.find((p) => p.id === curr.id);
          return matched || curr;
        });
        try {
          localStorage.setItem('nak_custom_products', JSON.stringify(realtimeProducts));
        } catch (e) {
          console.warn("Lỗi lưu local products từ real-time sync:", e);
        }
      }
    });

    // C. Real-time Categories listener
    const unsubCats = subscribeToCategoriesFromFirestore((realtimeCats) => {
      if (!isMounted) return;
      if (realtimeCats && realtimeCats.length > 0) {
        setCategories(realtimeCats);
        try {
          localStorage.setItem('nak_categories', JSON.stringify(realtimeCats));
        } catch {}
      }
    });

    // D. Real-time Collections / Banners listener
    const unsubCols = subscribeToCollectionsFromFirestore((realtimeCols) => {
      if (!isMounted) return;
      if (realtimeCols && realtimeCols.length > 0) {
        const sorted = [...realtimeCols].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setCollections(sorted);
        try {
          localStorage.setItem('nak_collections', JSON.stringify(sorted));
        } catch (e) {
          console.warn("Lỗi lưu local collections từ real-time sync:", e);
        }
      }
    });

    // E. Real-time Site Content / Visuals listener
    const unsubContent = subscribeToSiteContentFromFirestore((realtimeContent) => {
      if (!isMounted) return;
      if (realtimeContent) {
        setSiteContent(realtimeContent);
        try {
          localStorage.setItem('nak_site_content', JSON.stringify(realtimeContent));
        } catch (e) {
          console.warn("Lỗi lưu local site_content từ real-time sync:", e);
        }
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
            setSiteContent(data);
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
        try { setSiteContent(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // H. Background silent periodic sync (ensures latest stock and changes without any user button click)
    const periodicTimer = setInterval(() => {
      if (!isMounted) return;
      fetchProductsFromFirestore().then((latest) => {
        if (isMounted && latest && latest.length > 0) {
          setProducts((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(latest)) {
              try { localStorage.setItem('nak_custom_products', JSON.stringify(latest)); } catch {}
              return latest;
            }
            return prev;
          });
        }
      }).catch(() => {});
    }, 25000);

    return () => {
      isMounted = false;
      unsubProducts();
      unsubCats();
      unsubCols();
      unsubContent();
      if (syncChannel) syncChannel.close();
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(periodicTimer);
    };
  }, []);

  // Update site content and sync to Firestore
  const handleUpdateSiteContent = (newConfig: SiteContentConfig) => {
    setSiteContent(newConfig);
    broadcastStoreChange('siteContent', newConfig);
    try {
      localStorage.setItem('nak_site_content', JSON.stringify(newConfig));
      saveSiteContentToFirestore(newConfig).catch((err) => console.warn('Lỗi đồng bộ site_content:', err));
    } catch (e) {
      console.warn('Lỗi lưu site_content:', e);
    }
  };

  const handleUpdateCollections = (newCols: CollectionInfo[]) => {
    setCollections(newCols);
    broadcastStoreChange('collections', newCols);
    try {
      localStorage.setItem('nak_collections', JSON.stringify(newCols));
      Promise.all(newCols.map((c) => saveCollectionToFirestore(c))).catch((err) =>
        console.warn('Lỗi đồng bộ collections lên Firebase:', err)
      );
    } catch (e) {
      console.error("Lỗi lưu collections:", e);
    }
  };

  const handleUpdateCategories = (newCats: CategoryItem[]) => {
    setCategories(newCats);
    broadcastStoreChange('categories', newCats);
    try {
      localStorage.setItem('nak_categories', JSON.stringify(newCats));
      Promise.all(newCats.map((cat) => saveCategoryToFirestore(cat))).catch((err) =>
        console.warn('Lỗi đồng bộ categories lên Firebase:', err)
      );
    } catch (e) {
      console.error("Lỗi lưu danh mục:", e);
    }
  };

  const handleUpdateProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    broadcastStoreChange('products', newProducts);
    try {
      localStorage.setItem('nak_custom_products', JSON.stringify(newProducts));
      // Tự động sao lưu và đồng bộ danh sách sản phẩm lên Firestore Cloud (xóa các item thừa để luôn khớp 100%)
      pushAndSyncProductsToFirestore(newProducts, true).catch((err) =>
        console.warn('Lỗi tự động sao lưu sản phẩm lên Firestore:', err)
      );
    } catch (e) {
      console.error("Lỗi lưu sản phẩm vào bộ nhớ:", e);
    }
    if (selectedProduct) {
      const updatedCurr = newProducts.find((p) => p.id === selectedProduct.id);
      if (updatedCurr) {
        setSelectedProduct(updatedCurr);
      }
    }
  };

  // Cart Persistence
  useEffect(() => {
    try {
      localStorage.setItem('nak_cart', JSON.stringify(cartItems));
    } catch (e) {
      console.error("Lỗi lưu giỏ hàng vào localStorage:", e);
    }
  }, [cartItems]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleAddToCart = (
    product: Product,
    quantity: number = 1,
    selectedColor?: string,
    selectedSize?: string,
    customNote?: string,
    selectedCharm?: string,
    selectedColorImage?: string,
    selectedCharmImage?: string,
    selectedCharmPrice?: number
  ) => {
    // Do not cap cart quantity at 1. If stock is 1 or unset, allow standard ordering up to 99
    const maxStock = typeof product.stock === 'number' && product.stock > 1 ? product.stock : 99;
    if (product.inStock === false) {
      showToast(`Sản phẩm "${product.name}" hiện đã hết hàng.`);
      return;
    }

    let addedSuccessfully = false;

    setCartItems((prev) => {
      const currentInCartForProduct = prev
        .filter((item) => item.product.id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      const availableToAdd = maxStock - currentInCartForProduct;
      if (availableToAdd <= 0 && maxStock < 99) {
        showToast(`Bạn đã có đủ số lượng tồn kho (${maxStock} cái) của "${product.name}" trong giỏ!`);
        return prev;
      }

      // Check charm stock if charm selected
      if (selectedCharm && product.charmOptions) {
        const charmOpt = product.charmOptions.find(
          (c) => c.name.trim().toLowerCase() === selectedCharm.trim().toLowerCase()
        );
        if (charmOpt && typeof charmOpt.stock === 'number') {
          if (charmOpt.stock <= 0) {
            showToast(`Mẫu charm "${selectedCharm}" hiện đã hết hàng trong kho!`);
            return prev;
          }
          const currentInCartForCharm = prev
            .filter((it) => it.product.id === product.id && (it.selectedCharm || '').trim().toLowerCase() === selectedCharm.trim().toLowerCase())
            .reduce((sum, it) => sum + it.quantity, 0);
          if (currentInCartForCharm + quantity > charmOpt.stock) {
            showToast(`Mẫu charm "${selectedCharm}" chỉ còn ${charmOpt.stock} cái trong kho.`);
            return prev;
          }
        }
      }

      const qtyToAdd = Math.max(1, Math.min(quantity, availableToAdd > 0 ? availableToAdd : quantity));

      const existingIdx = prev.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.selectedColor === selectedColor &&
          item.selectedCharm === selectedCharm &&
          item.selectedSize === selectedSize &&
          item.customNote === customNote
      );

      addedSuccessfully = true;

      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += qtyToAdd;
        return updated;
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
            selectedSize,
            customNote
          }
        ];
      }
    });

    if (addedSuccessfully) {
      trackGA4AddToCart(product, quantity, selectedColor, selectedSize);
      showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
    }
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

      const otherItemsQty = prev
        .filter((item, i) => i !== index && item.product.id === targetItem.product.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      const maxForThisItem = Math.max(1, maxStock - otherItemsQty);

      const updated = [...prev];
      if (quantity > maxForThisItem && maxStock < 99) {
        showToast(`Sản phẩm/Charm chỉ còn ${maxStock} chiếc trong kho.`);
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
        }

        const currentStock = typeof p.stock === 'number' ? p.stock : 15;
        const newStock = Math.max(0, currentStock - totalDeduct);

        const updatedProd: Product = {
          ...p,
          stock: newStock,
          inStock: newStock > 0,
          charmOptions: updatedCharmOptions
        };

        saveProductToFirestore(updatedProd).catch((err) => {
          console.warn('Lỗi cập nhật tồn kho sau đặt hàng web:', err);
        });

        return updatedProd;
      });

      if (hasChanges) {
        try {
          localStorage.setItem('nak_products', JSON.stringify(updated));
        } catch {
          // ignore
        }
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

  // Navigation Handlers with Hash Updates
  const handleSelectCollection = (collectionId: string) => {
    setActiveCollectionId(collectionId);
    setCurrentView('collection');
    window.location.hash = `#collection/${collectionId}`;
    scrollToPageBeginning();
  };

  const handleOpenAllCatalog = (categoryId: string = 'all') => {
    setSelectedCategory(categoryId);
    setCurrentView('catalog');
    window.location.hash = categoryId !== 'all' ? `#products?category=${categoryId}` : '#products';
    scrollToPageBeginning();
  };

  const handleOpenAbout = () => {
    setCurrentView('about');
    window.location.hash = '#about';
    scrollToPageBeginning();
  };

  const handleOpenContact = () => {
    setCurrentView('contact');
    window.location.hash = '#contact';
    scrollToPageBeginning();
  };

  const handleOpenOrderTracker = (trackingCode?: string) => {
    setOrderTrackerInitialCode(trackingCode || '');
    setCurrentView('order-tracker');
    window.location.hash = trackingCode ? `#tracking?code=${encodeURIComponent(trackingCode)}` : '#tracking';
    scrollToPageBeginning();
  };

  const handleHeroSlideNavigation = (target: string) => {
    if (!target) return;
    if (target.startsWith('http://') || target.startsWith('https://')) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }
    if (target.startsWith('#')) {
      window.location.hash = target;
      return;
    }
    if (target === 'about') {
      handleOpenAbout();
      return;
    }
    if (target === 'contact') {
      handleOpenContact();
      return;
    }
    if (target === 'tracking' || target === 'order-tracker') {
      handleOpenOrderTracker();
      return;
    }
    if (target === 'custom-order') {
      setCurrentView('custom-order');
      window.location.hash = '#custom-order';
      scrollToPageBeginning();
      return;
    }
    if (target === 'collections') {
      setCurrentView('landing');
      window.location.hash = '#collections';
      const el = document.getElementById('collections-showcase-section');
      el?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    // Check if target matches any collection
    const matchedCol = collections.find((c) => c.id === target || c.categoryKey === target);
    if (matchedCol) {
      handleSelectCollection(matchedCol.id);
      return;
    }
    // Otherwise route to catalog with the category ID
    handleOpenAllCatalog(target);
  };

  const handleNavigateLanding = () => {
    setCurrentView('landing');
    window.location.hash = '#home';
    scrollToPageBeginning();
  };

  const handleOpenAdmin = () => {
    const session = getAdminSession();
    if (session && session.username) {
      setCurrentSeller(session as SellerUser);
      setCurrentView('admin');
      window.location.hash = '#admin';
      scrollToPageBeginning();
    } else {
      setIsAdminLoginModalOpen(true);
    }
  };

  const handleAdminLoginSuccess = (user: SellerUser) => {
    setCurrentSeller(user);
    setIsAdminLoginModalOpen(false);
    setCurrentView('admin');
    window.location.hash = '#admin';
    scrollToPageBeginning();
    showToast(`Xin chào ${user.name} (@${user.username})!`);
  };

  const handleAdminLogout = () => {
    clearAdminSession();
    setCurrentSeller(null);
    setCurrentView('landing');
    window.location.hash = '#home';
    scrollToPageBeginning();
    showToast('Đã đăng xuất khỏi tài khoản quản trị.');
  };

  const handleOpenProductDetail = (p: Product) => {
    if (currentView !== 'product-detail') {
      setPreviousView(currentView as any);
    }
    setSelectedProduct(p);
    setCurrentView('product-detail');
    window.location.hash = `#product/${p.id}`;
    scrollToPageBeginning();
  };

  const handleCloseProductDetail = () => {
    setSelectedProduct(null);
    if (previousView === 'collection' && activeCollectionId && activeCollectionId !== 'all') {
      setCurrentView('collection');
      window.location.hash = `#collection/${activeCollectionId}`;
    } else if (previousView === 'landing') {
      handleNavigateLanding();
    } else if (previousView === 'about') {
      handleOpenAbout();
    } else if (previousView === 'contact') {
      handleOpenContact();
    } else {
      // Default to catalog (Trang Sản Phẩm)
      setCurrentView('catalog');
      window.location.hash = selectedCategory && selectedCategory !== 'all' ? `#products?category=${selectedCategory}` : '#products';
    }
    scrollToPageBeginning();
  };

  const handleOpenCartDrawer = () => {
    setCurrentView('cart');
    setIsCartOpen(false);
    window.location.hash = '#cart';
    scrollToPageBeginning();
  };

  const handleCloseCartDrawer = () => {
    setIsCartOpen(false);
    if (window.location.hash === '#cart' || window.location.hash === '#checkout') {
      window.history.back();
    }
  };

  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const handleAnnouncementClick = () => {
    const link = siteContent?.announcementLink?.trim();
    if (!link) return;
    if (link.startsWith('#')) {
      window.location.hash = link;
    } else if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      window.location.hash = link;
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip relative flex flex-col bg-[#FAF9F6] text-slate-900 selection:bg-amber-400 selection:text-slate-950 font-sans">
      {/* Toast notification banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-amber-400/40 flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
          <button
            onClick={handleOpenCartDrawer}
            className="ml-2 text-xs font-black text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Xem giỏ</span>
          </button>
        </div>
      )}

      {/* Landing Page Exclusive Promo Announcement Banner (Full Width Infinite Continuous Loop) */}
      {currentView === 'landing' && siteContent?.announcementActive !== false && !announcementDismissed && (
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
                        {siteContent?.announcementText || 'Ưu đãi đặt trước BST Mới: Tặng kèm móc khóa Paracord EDC cao cấp cho đơn từ 299k!'}
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

      {/* Sleek Minimized Navigation Bar (Hidden in Admin Mode) */}
      {currentView !== 'admin' && (
        <Navbar
          cartCount={totalCartCount}
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
        {/* VIEW 1: Landing Page */}
        {currentView === 'landing' && (
          <>
            {/* Top Custom Dynamic Elements (if any created in Site Editor) */}
            <DynamicCustomElements
              elements={siteContent?.customElements}
              position="top"
              onActionClick={(url) => {
                if (url.startsWith('#')) {
                  window.location.hash = url;
                } else {
                  window.open(url, '_blank');
                }
              }}
            />

            {/* Hero Carousel */}
            <HeroBanners
              slides={siteContent?.heroSlides}
              onSelectCategory={handleHeroSlideNavigation}
              onNavigateToEvent={() => handleSelectCollection('event_0209')}
              onSelectBannerCategory={handleHeroSlideNavigation}
              onOpen0209Event={() => handleSelectCollection('event_0209')}
              onOpenAbout={handleOpenAbout}
            />

            {/* Middle Custom Dynamic Elements */}
            <DynamicCustomElements
              elements={siteContent?.customElements}
              position="middle"
              onActionClick={(url) => {
                if (url.startsWith('#')) {
                  window.location.hash = url;
                } else {
                  window.open(url, '_blank');
                }
              }}
            />

            {/* Collection Showcase Cards */}
            <LandingCollectionBanners
              collections={collections}
              onSelectCollection={handleSelectCollection}
              onOpenAllCatalog={() => handleOpenAllCatalog('all')}
            />

            {/* About Us Brand Teaser & Craftsmanship Narrative */}
            <AboutUsSection
              content={siteContent?.aboutUs}
              onOpenContact={handleOpenContact}
              onOpenCatalog={() => handleOpenAllCatalog('all')}
              onOpenFullAbout={handleOpenAbout}
            />

            {/* Bottom Custom Dynamic Elements */}
            <DynamicCustomElements
              elements={siteContent?.customElements}
              position="bottom"
              onActionClick={(url) => {
                if (url.startsWith('#')) {
                  window.location.hash = url;
                } else {
                  window.open(url, '_blank');
                }
              }}
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
        )}

        {/* VIEW 3: Full Catalog Page (All products store with search & category filters) */}
        {currentView === 'catalog' && (
          <ProductCatalog
            products={visibleProducts}
            categories={categories}
            collections={collections}
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => setSelectedCategory(cat)}
            onOpenProductDetail={handleOpenProductDetail}
            onAddToCart={(p) => handleAddToCart(p, 1)}
            onBackToHome={handleNavigateLanding}
          />
        )}

        {/* VIEW 4: Dedicated Standalone About Page */}
        {currentView === 'about' && (
          <AboutPage
            siteContent={siteContent}
            onNavigateHome={handleNavigateLanding}
            onOpenCatalog={() => handleOpenAllCatalog('all')}
            onOpenContact={handleOpenContact}
          />
        )}

        {/* VIEW 5: Dedicated Standalone Contact Page */}
        {currentView === 'contact' && (
          <ContactPage
            siteContent={siteContent}
            onNavigateHome={handleNavigateLanding}
            onOpenAllCatalog={() => handleOpenAllCatalog('all')}
          />
        )}

        {/* VIEW 6: Dedicated Standalone Admin Portal Page with Strict Auth Gating */}
        {currentView === 'admin' && (
          currentSeller ? (
            <AdminPage
              products={products}
              categories={categories}
              collections={collections}
              siteContent={siteContent}
              currentSeller={currentSeller}
              onUpdateProducts={handleUpdateProducts}
              onUpdateCategories={handleUpdateCategories}
              onUpdateCollections={handleUpdateCollections}
              onUpdateSiteContent={handleUpdateSiteContent}
              onLogout={handleAdminLogout}
              onBackToStore={handleNavigateLanding}
            />
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
          <ProductDetailPage
            product={selectedProduct}
            allProducts={visibleProducts}
            categories={categories}
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
            onAddToCart={(p, qty, color, size, note, charm, colorImg, charmImg, charmPrice) => {
              handleAddToCart(p, qty, color, size, note, charm, colorImg, charmImg, charmPrice);
            }}
            onBuyNow={(p, qty, color, size, note, charm, colorImg, charmImg, charmPrice) => {
              handleAddToCart(p, qty, color, size, note, charm, colorImg, charmImg, charmPrice);
              handleOpenCartDrawer();
            }}
          />
        )}

        {/* VIEW 8: Standalone Order Tracking & Progress Page */}
        {currentView === 'order-tracker' && (
          <OrderTracker
            initialTrackingCode={orderTrackerInitialCode}
            siteContent={siteContent}
            onNavigateHome={handleNavigateLanding}
            onNavigateCatalog={() => handleOpenAllCatalog('all')}
          />
        )}

        {/* VIEW 9: Dedicated Full-Page Cart & Checkout Experience */}
        {currentView === 'cart' && (
          <CartPage
            cartItems={cartItems}
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
        )}
      </main>

      {/* Customer Footer (Rendered across Landing, Collection, Catalog, About, Contact & Order Tracking pages) */}
      {currentView !== 'admin' && (
        <Footer
          siteContent={siteContent}
          onOpenAdmin={handleOpenAdmin}
          onSelectCollection={handleSelectCollection}
          onOpenAllCatalog={() => handleOpenAllCatalog('all')}
          onOpenAbout={handleOpenAbout}
          onOpenContact={handleOpenContact}
          onOpenOrderTracker={() => handleOpenOrderTracker()}
        />
      )}

      {/* Admin Login Authentication Gate Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
        sellers={sellers}
        brandName={siteContent?.brandName}
        logoUrl={siteContent?.logoUrl}
      />
    </div>
  );
}
