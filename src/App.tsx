import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { AdminPage } from './components/AdminPage';
import { Footer } from './components/Footer';
import { PRODUCTS } from './data/products';
import { DEFAULT_CATEGORIES } from './data/categories';
import { COLLECTIONS_DATA } from './data/collections';
import { DEFAULT_SITE_CONTENT } from './data/siteContent';
import { Product, CartItem, CategoryItem, CollectionInfo, SiteContentConfig } from './types';
import { CheckCircle2, ShoppingBag, Sparkles, X } from 'lucide-react';
import {
  fetchProductsFromFirestore,
  fetchCategoriesFromFirestore,
  fetchCollectionsFromFirestore,
  fetchSiteContentFromFirestore,
  saveSiteContentToFirestore
} from './firebase';
import {
  trackGA4PageView,
  trackGA4AddToCart,
  trackGA4Engagement,
  recordSessionHeartbeat,
  recordPageTimeSpent
} from './utils/analytics';

export default function App() {
  // Navigation & View State (Landing, Collection Detail, Full Catalog, Standalone About Page, Standalone Contact Page, Standalone Admin Page, Standalone Product Detail Page)
  const [currentView, setCurrentView] = useState<'landing' | 'collection' | 'catalog' | 'about' | 'contact' | 'admin' | 'product-detail'>('landing');
  const [previousView, setPreviousView] = useState<'landing' | 'collection' | 'catalog' | 'about' | 'contact' | 'admin'>('catalog');
  const [activeCollectionId, setActiveCollectionId] = useState<string>('event_0209');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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
      setCurrentView('admin');
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

    if (pathPart === 'cart' || pathPart === 'checkout') {
      setIsCartOpen(true);
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
      else if (currentHash.includes('#products')) pageTitle = 'Danh Mục Sản Phẩm Thủ Công';
      else if (currentHash.includes('#product-detail')) pageTitle = 'Chi Tiết Sản Phẩm';
      else if (currentHash.includes('#collection')) pageTitle = 'Bộ Sưu Tập Thủ Công';
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

  // Sync initial products, categories, collections & site content from Firestore
  useEffect(() => {
    let isMounted = true;
    const loadDbData = async () => {
      try {
        const [dbProducts, dbCats, dbCols, dbContent] = await Promise.all([
          fetchProductsFromFirestore(),
          fetchCategoriesFromFirestore(),
          fetchCollectionsFromFirestore(),
          fetchSiteContentFromFirestore()
        ]);
        if (!isMounted) return;

        if (dbProducts && dbProducts.length > 0) {
          setProducts(dbProducts);
          localStorage.setItem('nak_custom_products', JSON.stringify(dbProducts));
        }
        if (dbCats && dbCats.length > 0) {
          setCategories(dbCats);
          localStorage.setItem('nak_categories', JSON.stringify(dbCats));
        }
        if (dbCols && dbCols.length > 0) {
          setCollections(dbCols);
          localStorage.setItem('nak_collections', JSON.stringify(dbCols));
        }
        if (dbContent) {
          setSiteContent(dbContent);
          localStorage.setItem('nak_site_content', JSON.stringify(dbContent));
        }
      } catch (e) {
        console.warn("Firestore data sync fallback:", e);
      }
    };
    loadDbData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update site content and sync to Firestore
  const handleUpdateSiteContent = (newConfig: SiteContentConfig) => {
    setSiteContent(newConfig);
    try {
      localStorage.setItem('nak_site_content', JSON.stringify(newConfig));
      saveSiteContentToFirestore(newConfig).catch((err) => console.warn('Lỗi đồng bộ site_content:', err));
    } catch (e) {
      console.warn('Lỗi lưu site_content:', e);
    }
  };

  const handleUpdateCollections = (newCols: CollectionInfo[]) => {
    setCollections(newCols);
    try {
      localStorage.setItem('nak_collections', JSON.stringify(newCols));
    } catch (e) {
      console.error("Lỗi lưu collections:", e);
    }
  };

  const handleUpdateCategories = (newCats: CategoryItem[]) => {
    setCategories(newCats);
    try {
      localStorage.setItem('nak_categories', JSON.stringify(newCats));
    } catch (e) {
      console.error("Lỗi lưu danh mục:", e);
    }
  };

  const handleUpdateProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    try {
      localStorage.setItem('nak_custom_products', JSON.stringify(newProducts));
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
    customNote?: string
  ) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.selectedColor === selectedColor &&
          item.selectedSize === selectedSize &&
          item.customNote === customNote
      );

      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += quantity;
        return updated;
      } else {
        return [
          ...prev,
          {
            product,
            quantity,
            selectedColor,
            selectedSize,
            customNote
          }
        ];
      }
    });

    // Track E-commerce event in GA4 and internal analytics
    trackGA4AddToCart(product, quantity, selectedColor, selectedSize);

    showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
  };

  const handleUpdateCartQuantity = (index: number, quantity: number) => {
    setCartItems((prev) => {
      const updated = [...prev];
      updated[index].quantity = quantity;
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

  // Navigation Handlers with Hash Updates
  const handleSelectCollection = (collectionId: string) => {
    setActiveCollectionId(collectionId);
    setCurrentView('collection');
    window.location.hash = `#collection/${collectionId}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAllCatalog = (categoryId: string = 'all') => {
    setSelectedCategory(categoryId);
    setCurrentView('catalog');
    window.location.hash = categoryId !== 'all' ? `#products?category=${categoryId}` : '#products';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAbout = () => {
    setCurrentView('about');
    window.location.hash = '#about';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenContact = () => {
    setCurrentView('contact');
    window.location.hash = '#contact';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateLanding = () => {
    setCurrentView('landing');
    window.location.hash = '#home';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAdmin = () => {
    setCurrentView('admin');
    window.location.hash = '#admin';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenProductDetail = (p: Product) => {
    if (currentView !== 'product-detail') {
      setPreviousView(currentView as any);
    }
    setSelectedProduct(p);
    setCurrentView('product-detail');
    window.location.hash = `#product/${p.id}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCartDrawer = () => {
    setIsCartOpen(true);
    window.location.hash = '#cart';
  };

  const handleCloseCartDrawer = () => {
    setIsCartOpen(false);
    if (window.location.hash === '#cart' || window.location.hash === '#checkout') {
      window.history.back();
    }
  };

  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-slate-900 selection:bg-amber-400 selection:text-slate-950 font-sans">
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

      {/* Landing Page Exclusive Promo Announcement Banner (Shown ONLY on Landing Page) */}
      {currentView === 'landing' && siteContent?.announcementActive !== false && !announcementDismissed && (
        <aside aria-label="Thông báo ưu đãi" className="bg-red-600 text-white py-1.5 text-xs font-bold flex items-center justify-between border-b border-red-700/50 transition-all overflow-hidden relative">
          <div className="flex-grow whitespace-nowrap overflow-hidden">
            <div className="inline-flex items-center gap-2 animate-marquee">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
              <span>
                {siteContent?.announcementText || 'Ưu đãi đặt trước BST Mới: Tặng kèm móc khóa Paracord EDC cao cấp cho đơn từ 299k!'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setAnnouncementDismissed(true)}
            className="p-1 hover:bg-black/20 rounded-full text-white transition-colors absolute right-2 z-10 cursor-pointer bg-red-600"
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
          onOpenAdmin={handleOpenAdmin}
          currentView={currentView}
          activeCollectionId={activeCollectionId}
        />
      )}

      {/* Main Content Router */}
      <main className="flex-grow">
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
              onSelectCategory={(cat) => handleOpenAllCatalog(cat)}
              onNavigateToEvent={() => handleSelectCollection('event_0209')}
              onSelectBannerCategory={(cat) => handleOpenAllCatalog(cat)}
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
            products={products}
            collections={collections}
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
            products={products}
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

        {/* VIEW 6: Dedicated Standalone Admin Portal Page with Site Editor */}
        {currentView === 'admin' && (
          <AdminPage
            products={products}
            categories={categories}
            collections={collections}
            siteContent={siteContent}
            onUpdateProducts={handleUpdateProducts}
            onUpdateCategories={handleUpdateCategories}
            onUpdateCollections={handleUpdateCollections}
            onUpdateSiteContent={handleUpdateSiteContent}
            onBackToStore={handleNavigateLanding}
          />
        )}

        {/* VIEW 7: Dedicated Standalone Product Detail Page */}
        {currentView === 'product-detail' && selectedProduct && (
          <ProductDetailPage
            product={selectedProduct}
            allProducts={products}
            categories={categories}
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
            onAddToCart={(p, qty, color, size) => {
              handleAddToCart(p, qty, color, size);
            }}
            onBuyNow={(p, qty, color, size) => {
              handleAddToCart(p, qty, color, size);
              setIsCartOpen(true);
            }}
          />
        )}
      </main>

      {/* Customer Footer (Rendered across Landing, Collection, Catalog, About & Contact pages) */}
      {currentView !== 'admin' && (
        <Footer
          siteContent={siteContent}
          onOpenAdmin={handleOpenAdmin}
          onSelectCollection={handleSelectCollection}
          onOpenAllCatalog={() => handleOpenAllCatalog('all')}
          onOpenAbout={handleOpenAbout}
          onOpenContact={handleOpenContact}
        />
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={handleCloseCartDrawer}
        cartItems={cartItems}
        facebookUrl={siteContent?.socialLinks?.facebook}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onOrderPlaced={() => showToast('Đơn hàng của bạn đã được ghi nhận!')}
      />
    </div>
  );
}
