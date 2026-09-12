export interface CategoryItem {
  id: string;
  label: string;
  description?: string;
  introText?: string;
  bannerImage?: string;
  highlightColor?: string;
  badge?: string;
  isEvent?: boolean;
  isHidden?: boolean;
}

export interface ProductColorOption {
  name: string;
  image?: string; // photo linked to this color (when clicked, swaps main product image)
  colorCode?: string; // optional hex for swatch dot, e.g. #FF0000
}

export interface ProductCharmOption {
  id?: string;
  name: string; // e.g. "Sao chuông · Xanh", "Sao trong · Hồng", "Hoa anh đào · Hồng"
  image: string; // thumbnail / photo of the charm
  priceDelta?: number; // optional extra price, default 0
  stock?: number; // Inventory quantity for this specific charm (undefined = unlimited, 0 = out of stock)
}

export interface ProductOmamoriOption {
  id?: string;
  name: string; // e.g. "Bùa Bình An (Đỏ)", "Bùa May Mắn (Vàng)", "Bùa Tình Duyên (Hồng)"
  image: string; // thumbnail / photo of the Omamori amulet
  priceDelta?: number; // optional extra price, default 0
  meaning?: string; // e.g. "Bình an, may mắn"
  stock?: number; // Inventory quantity for this specific amulet (undefined = unlimited, 0 = out of stock)
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  discountBadge?: string;
  image: string;
  images?: string[];
  description: string;
  details: string[];
  isEvent0209?: boolean;
  isEvent2010?: boolean;
  isBestSeller?: boolean;
  isNew?: boolean;
  rating: number;
  reviewsCount: number;
  availableColors?: string[];
  availableSizes?: string[];
  // Dynamic Variation Settings
  enableColorSelection?: boolean;
  colorOptions?: ProductColorOption[];
  // Charms selection settings
  enableCharmSelection?: boolean;
  charmOptions?: ProductCharmOption[];
  charmSelectionRequired?: boolean;
  maxCharmsAllowed?: number; // Maximum selectable charms (default: 1)
  // Omamori amulet selection settings
  enableOmamoriSelection?: boolean;
  omamoriOptions?: ProductOmamoriOption[];
  omamoriSelectionRequired?: boolean;
  maxOmamoriAllowed?: number; // Maximum selectable Omamori amulets (default: 1)
  enableSizeSelection?: boolean;
  inStock: boolean;
  stock?: number;
  soldCount?: number;
  isHidden?: boolean;
  customUrl?: string; // Optional custom redirect link (e.g. Shopee, external landing, affiliate)
  updatedAt?: string;
}

export interface BannerItem {
  id: string;
  tag: string;
  title: string;
  highlight: string;
  subtitle: string;
  bgImage: string;
  bgGradient: string;
  categoryLink: string;
  buttonText: string;
  isEvent0209?: boolean;
  themeColor: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedColorImage?: string;
  selectedCharm?: string;
  selectedCharmImage?: string;
  selectedCharmPrice?: number;
  selectedCharms?: ProductCharmOption[];
  selectedOmamoris?: ProductOmamoriOption[];
  selectedOmamoriPrice?: number;
  selectedSize?: string;
  customNote?: string;
}

export type OrderSource = 'website' | 'facebook' | 'shopee' | 'tiktok' | 'offline' | 'instagram' | 'zalo' | 'hotline' | 'other';

export type PaymentMethod = 'bank_transfer' | 'cod' | 'cash' | 'other';
export type PaymentStatus = 'paid' | 'unpaid' | 'partial';

export interface OrderItemDetail {
  productId: string;
  productName: string;
  category?: string;
  price: number;
  quantity: number;
  selectedColor?: string;
  selectedColorImage?: string;
  selectedCharm?: string;
  selectedCharmImage?: string;
  selectedCharmPrice?: number;
  selectedCharms?: ProductCharmOption[];
  selectedOmamoris?: ProductOmamoriOption[];
  selectedOmamoriPrice?: number;
  selectedSize?: string;
  customNote?: string;
}

export interface SellerUser {
  id: string;
  username: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  isRootAdmin?: boolean;
  role: 'root_admin' | 'member';
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  avatarColor?: string;
  phone?: string;
}

export interface OrderRecord {
  id?: string;
  date: string;
  createdAt?: string;
  name: string;
  customerName?: string;
  phone: string;
  address: string;
  note?: string;
  items: string[];
  itemDetails?: OrderItemDetail[];
  totalPrice?: number;
  totalAmount?: number;
  shippingFee?: number;
  discountAmount?: number;
  craftingStageNote?: string;
  source?: OrderSource;
  type: 'preorder_0209' | 'standard_order' | 'manual_order';
  isManual?: boolean;
  status?: 'Chờ xác nhận' | 'Đã xác nhận' | 'Knot đang được sản xuất' | 'Đang giao hàng' | 'Đơn hàng giao thành công' | 'pending' | 'received' | 'confirmed' | 'crafting' | 'shipping' | 'completed' | 'cancelled' | 'Đã đặt' | 'Đã tiếp nhận' | 'Đã thanh toán' | 'Đã giao' | 'Đã hủy';
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  bankReceiptImage?: string;
  paidAmount?: number;
  bankTransferRef?: string;
  sellerId?: string;
  sellerName?: string;
  trackingNumber?: string;
  shippingCarrier?: string;
  shippingCode?: string;
  estimatedDelivery?: string;
  statusHistory?: {
    status: string;
    label: string;
    timestamp: string;
    note?: string;
  }[];
}

export type StoredOrder = OrderRecord;

export interface ContactMessage {
  id: string;
  name: string;
  contactInfo: string;
  email?: string;
  phone?: string;
  message: string;
  createdAt: string;
  timestamp: number;
  isRead?: boolean;
  status?: 'unread' | 'read' | 'replied';
}

export interface CollectionInfo {
  id: string;
  categoryKey: string;
  tag?: string;
  title: string;
  subtitle: string;
  highlight?: string;
  story?: string;
  description?: string;
  craftDetails?: string[];
  bgImage: string;
  bannerImage: string;
  horizontalImage?: string;
  productPageBanner?: string;
  badge?: string;
  isPreorder: boolean;
  status?: 'sold_out' | 'preorder' | 'available' | 'coming_soon';
  soldOutTitle?: string;
  soldOutBadge?: string;
  soldOutRibbon?: string;
  soldOutMessage?: string;
  soldOutNote?: string;
  themeColor?: string;
  accentColor?: string;
  bgColor?: string;
  bannerOverlay?: 'dark' | 'light' | 'gradient' | 'none';
  bannerDisplayMode?: 'cover_hero' | 'featured_card' | 'minimal';
  order?: number;
  buttonText?: string;
  themeStyle?: 'light' | 'dark' | 'event0209';
  customDesignMode?: boolean;
  isHidden?: boolean;
}

export interface CustomElementBlock {
  id: string;
  type: 'banner' | 'announcement' | 'faq' | 'guarantee' | 'custom_card' | 'gallery_quote';
  title: string;
  subtitle?: string;
  badge?: string;
  content: string;
  imageUrl?: string;
  buttonText?: string;
  buttonLink?: string;
  isActive: boolean;
  order: number;
  bgStyle?: 'dark' | 'glass' | 'gold_gradient' | 'minimal';
}

export interface HeroTextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontFamily: 'sans' | 'serif' | 'mono';
  fontSize: number;
  fontWeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface HeroButton {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  visible: boolean;
  destinationType: 'category' | 'event' | 'path' | 'external';
  destination: string;
  backgroundColor: string;
  textColor: string;
  style: 'pill' | 'rounded' | 'square';
}

export interface SiteHeroSlide {
  id: string;
  tag: string;
  title: string;
  highlight: string;
  subtitle: string;
  bgImage: string;
  buttonText: string;
  categoryLink: string;
  order: number;
  isActive: boolean;
  textAlign?: 'left' | 'center' | 'right';
  titleTextAlign?: 'left' | 'center' | 'right';
  subtitleTextAlign?: 'left' | 'center' | 'right';
  textPosition?: 'top-left' | 'center-left' | 'bottom-left' | 'center' | 'center-right' | 'bottom-right' | 'top-center' | 'bottom-center';
  contentMaxWidth?: number;
  disableAnimation?: boolean;
  titleFontSize?: number;
  subtitleFontSize?: number;
  buttonFontSize?: number;
  fontFamily?: 'sans' | 'serif' | 'display' | 'mono';
  titleFontFamily?: 'sans' | 'serif' | 'display' | 'mono';
  subtitleFontFamily?: 'sans' | 'serif' | 'display' | 'mono';
  overlayOpacity?: number;
  titleColor?: string;
  highlightColor?: string;
  subtitleColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  buttonStyle?: 'pill' | 'rounded' | 'square';
  textShadow?: boolean;
  letterSpacing?: 'tight' | 'normal' | 'wide';
  bgPositionX?: number; // 0 to 100% (default 50)
  bgPositionY?: number; // 0 to 100% (default 50)
  bgZoom?: number; // 100 to 250% (default 100)
  showButton?: boolean;
  showText?: boolean;
  hideOverlay?: boolean;
  bgFit?: 'cover' | 'contain' | 'fill';
  aspectRatio?: 'fullscreen' | '16:9' | 'cinematic' | 'contain' | 'auto';
  originalBgImage?: string;
  // Dedicated Mobile / Smartphone Billboard Settings
  bgImageMobile?: string;
  originalBgImageMobile?: string;
  bgPositionXMobile?: number; // 0 to 100% (default 50)
  bgPositionYMobile?: number; // 0 to 100% (default 50)
  bgZoomMobile?: number; // 100 to 250% (default 100)
  bgFitMobile?: 'cover' | 'contain' | 'fill';
  aspectRatioMobile?: 'fullscreen' | '9:16' | '4:5' | '1:1' | '16:9' | 'auto';
  textBoxes?: HeroTextBox[];
  button?: HeroButton;
}

export interface FaqItem {
  id?: string;
  q: string;
  a: string;
}

export interface BankAccountConfig {
  bankId: string; // e.g. 'VCB', 'TPB', 'MB', 'BIDV', 'TCB', 'ACB', 'VPB', 'VIB', 'STB'
  bankName: string; // e.g. 'Vietcombank', 'TPBank', 'MBBank', 'BIDV'
  accountNumber: string; // e.g. '1028394859'
  accountHolder: string; // e.g. 'VU NGOC MANH CUONG'
  branch?: string;
  qrTemplate?: 'compact' | 'compact2' | 'qr_only' | 'print';
}

export type LandingDetailActionType =
  | 'product_detail'     // Mở xem chi tiết sản phẩm (Mặc định)
  | 'custom_url'         // Chuyển hướng đến liên kết ngoài / URL tùy chỉnh
  | 'product_custom_url' // Ưu tiên mở link riêng của sản phẩm (nếu có)
  | 'category'           // Chuyển đến trang danh mục sản phẩm
  | 'zalo'               // Nhắn tin Zalo tư vấn về sản phẩm
  | 'messenger';         // Nhắn tin Messenger tư vấn về sản phẩm

export interface LandingCollectionProductsConfig {
  id?: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  viewAllText?: string;
  detailButtonText?: string;
  detailActionType?: LandingDetailActionType;
  detailCustomUrl?: string;
  detailOpenNewTab?: boolean;
  isActive: boolean;
  displayLimit: number;
  filterCategory: string;
  selectedProductIds?: string[];
  gridColumns?: number;
  layoutMode?: 'grid' | 'carousel' | 'auto';
  backgroundColor?: string;
  backgroundImage?: string;
  bgImageOpacity?: number;
  textColor?: 'dark' | 'light' | 'auto';
}

export interface SiteContentConfig {
  logoUrl?: string;
  brandName: string;
  brandTagline: string;
  announcementText: string;
  announcementLink?: string;
  announcementActive: boolean;
  phone: string;
  zalo: string;
  address: string;
  email: string;
  bankAccount?: BankAccountConfig;
  heroSlides: SiteHeroSlide[];
  landingProducts?: LandingCollectionProductsConfig;
  landingProductSections?: LandingCollectionProductsConfig[];
  faqTitle?: string;
  faqSubtitle?: string;
  faqs?: FaqItem[];
  aboutSection: {
    badge: string;
    title: string;
    subtitle: string;
    storyParagraph1: string;
    storyParagraph2: string;
    quote: string;
    stats: { label: string; value: string; desc: string }[];
    coreValues: { id: string; title: string; desc: string; icon: string }[];
    imageUrl?: string;
  };
  aboutUs?: {
    badge: string;
    title: string;
    subtitle: string;
    storyParagraph1: string;
    storyParagraph2: string;
    quote: string;
    stats: { label: string; value: string; desc: string }[];
    coreValues: { id: string; title: string; desc: string; icon: string }[];
    imageUrl?: string;
  };
  customElements: CustomElementBlock[];
  footerDescription: string;
  copyrightText: string;
  warrantyPolicy: string;
  shippingPolicy: string;
  socialLinks: {
    facebook: string;
    messenger?: string;
    instagram: string;
    threads: string;
    tiktok?: string;
    zalo?: string;
  };
}

export interface VersionBackup {
  id: string;
  createdAt: string; // ISO string
  formattedDate: string; // e.g. "15:30:25 11/09/2026"
  createdByName?: string;
  backupType: 'auto' | 'manual';
  note?: string;
  syncedToCloud?: boolean; // Indicates if document exists in Firebase Firestore Cloud
  summary: {
    productsCount: number;
    categoriesCount: number;
    collectionsCount: number;
    ordersCount?: number;
    hasSiteContent: boolean;
  };
  data: {
    products: Product[];
    categories: CategoryItem[];
    collections: CollectionInfo[];
    siteContent?: SiteContentConfig;
  };
}

export interface BackupScheduleConfig {
  enabled: boolean;
  intervalHours: number; // e.g. 1, 6, 12, 24
  lastBackupAt?: string;
}
