export interface CategoryItem {
  id: string;
  label: string;
  description?: string;
  introText?: string;
  bannerImage?: string;
  highlightColor?: string;
  badge?: string;
  isEvent?: boolean;
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
  inStock: boolean;
  stock?: number;
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
  selectedSize?: string;
  customNote?: string;
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
  source?: OrderSource;
  type: 'preorder_0209' | 'standard_order' | 'manual_order';
  status?: 'pending' | 'confirmed' | 'crafting' | 'shipping' | 'completed' | 'cancelled';
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  bankReceiptImage?: string;
  paidAmount?: number;
  bankTransferRef?: string;
}

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
  order?: number;
  buttonText?: string;
  themeStyle?: 'light' | 'dark' | 'event0209';
  customDesignMode?: boolean;
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
  heroSlides: SiteHeroSlide[];
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
    instagram: string;
    threads: string;
    tiktok?: string;
    zalo?: string;
  };
}
