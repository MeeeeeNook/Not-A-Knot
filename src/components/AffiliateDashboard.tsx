import React, { useState, useMemo, useEffect } from 'react';
import { 
  Link2, Copy, Check, TrendingUp, ShoppingBag, Percent, 
  Wallet, ShieldCheck, ArrowLeft, LogOut, Search, Calendar,
  Sparkles, ExternalLink, AlertCircle, HelpCircle, User, Lock
} from 'lucide-react';
import { SellerUser, StoredOrder, AffiliateSystemConfig } from '../types';
import { 
  calculateAffiliateStats, 
  getAffiliateReferralUrl, 
  fetchAffiliateSystemConfig, 
  DEFAULT_AFFILIATE_CONFIG 
} from '../utils/affiliateManager';
import { signInWithGoogleForAffiliate, getAdminSession } from '../utils/auth';
import { fetchOrdersFromFirestore } from '../firebase';

interface AffiliateDashboardProps {
  currentSeller: SellerUser | null;
  orders?: StoredOrder[];
  onLoginSuccess: (user: SellerUser) => void;
  onLogout: () => void;
  onNavigateHome: () => void;
  brandName?: string;
  logoUrl?: string;
}

export const AffiliateDashboard: React.FC<AffiliateDashboardProps> = ({
  currentSeller,
  orders,
  onLoginSuccess,
  onLogout,
  onNavigateHome,
  brandName = 'NOT A KNOT',
  logoUrl
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [systemConfig, setSystemConfig] = useState<AffiliateSystemConfig>(DEFAULT_AFFILIATE_CONFIG);
  const [fetchedOrders, setFetchedOrders] = useState<StoredOrder[]>(orders || []);

  // Embedded login states for unauthenticated users visiting /affiliate
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Load system config for cookie duration
  useEffect(() => {
    fetchAffiliateSystemConfig().then(setSystemConfig).catch(() => {});
  }, []);

  // Fetch or sync orders from Firestore
  useEffect(() => {
    if (orders && orders.length > 0) {
      setFetchedOrders(orders);
    } else {
      fetchOrdersFromFirestore().then((res) => {
        if (res && res.length > 0) {
          setFetchedOrders(res as any);
        }
      }).catch(() => {});
    }
  }, [orders]);

  const affiliateUser = useMemo(() => {
    if (!currentSeller) return null;
    return currentSeller;
  }, [currentSeller]);

  const activeOrdersList = useMemo(() => {
    return orders && orders.length > 0 ? orders : fetchedOrders;
  }, [orders, fetchedOrders]);

  // Derive affiliate statistics dynamically from active orders (excludes soft-deleted & cancelled orders)
  const stats = useMemo(() => {
    if (!affiliateUser) {
      return { totalOrders: 0, totalMerchandiseValue: 0, totalCommission: 0, attributedOrders: [] };
    }
    return calculateAffiliateStats(affiliateUser, activeOrdersList);
  }, [affiliateUser, activeOrdersList]);

  // Filter attributed orders by search query & date filter
  const filteredOrders = useMemo(() => {
    return stats.attributedOrders.filter((ord) => {
      // 1. Search filter
      const q = searchQuery.toLowerCase().trim().replace(/^#/, '');
      if (q && !(ord.id && ord.id.toLowerCase().includes(q))) {
        return false;
      }

      // 2. Time filter
      if (timeFilter !== 'all') {
        const ordTime = new Date(ord.createdAt || ord.date || 0).getTime();
        const now = Date.now();
        if (timeFilter === 'today') {
          const oneDay = 24 * 60 * 60 * 1000;
          if (now - ordTime > oneDay) return false;
        } else if (timeFilter === '7days') {
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          if (now - ordTime > sevenDays) return false;
        } else if (timeFilter === '30days') {
          const thirtyDays = 30 * 24 * 60 * 60 * 1000;
          if (now - ordTime > thirtyDays) return false;
        }
      }

      return true;
    });
  }, [stats.attributedOrders, searchQuery, timeFilter]);

  // Affiliate code and referral URL
  const affiliateCode = useMemo(() => {
    if (!affiliateUser) return 'AN001';
    return (affiliateUser.affiliateCode || affiliateUser.username || 'AN001').toUpperCase().trim();
  }, [affiliateUser]);

  const referralUrl = useMemo(() => {
    return getAffiliateReferralUrl(affiliateCode);
  }, [affiliateCode]);

  const handleCopyLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = referralUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.warn('Copy link error:', err);
    }
  };

  // Handle primary Google login via Firebase Authentication
  const handleGoogleLogin = async () => {
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await signInWithGoogleForAffiliate();
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setLoginError(res.error || 'Đăng nhập Google qua Firebase thất bại.');
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Lỗi xác thực Google qua Firebase.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ----------------------------------------------------
  // UNAUTHENTICATED VIEW: Affiliate Portal Login Card
  // ----------------------------------------------------
  if (!affiliateUser) {
    return (
      <div className="min-h-screen bg-neutral-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
        {/* Top Minimal Nav */}
        <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md px-4 py-3 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="w-8 h-8 object-contain rounded-lg shadow-sm" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-rose-700 flex items-center justify-center font-black text-white text-xs">
                NK
              </div>
            )}
            <div>
              <span className="font-extrabold text-sm tracking-wide text-white block">NOT A KNOT</span>
              <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block">Affiliate Partner Portal</span>
            </div>
          </div>
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về cửa hàng</span>
          </button>
        </header>

        {/* Login Container */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-44 h-44 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-600/20 border border-amber-500/30 text-amber-400 mb-3 shadow-inner">
                <Sparkles className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-black text-white tracking-tight">Cổng Đối Tác Affiliate</h1>
              <p className="text-xs text-neutral-400 mt-1">
                Đăng nhập bằng tài khoản Google qua Firebase để nhận liên kết giới thiệu và quản lý hoa hồng
              </p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{loginError}</span>
              </div>
            )}

            {/* PRIMARY & EXCLUSIVE ACTION: Sign in with Google via Firebase Authentication */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full py-4 px-5 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl active:scale-98 transition-all cursor-pointer border border-neutral-200"
              >
                {isLoggingIn ? (
                  <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Đăng nhập bằng tài khoản Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400 font-medium text-center">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Xác thực qua Firebase Authentication & Google Cloud</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-800 text-center space-y-2">
              <p className="text-xs text-neutral-300 font-medium">
                Đăng nhập tức thì chỉ với tài khoản Google.
              </p>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Hệ thống tự động liên kết tài khoản và tạo mã tiếp thị độc quyền cho bạn. Bắt đầu chia sẻ liên kết và nhận hoa hồng lên tới {systemConfig.defaultCommissionRate || 10}% trên mỗi đơn hàng!
              </p>
            </div>
          </div>
        </div>

        {/* Minimal Footer */}
        <footer className="border-t border-neutral-900 py-3 text-center text-[11px] text-neutral-600">
          Not a Knot &copy; {new Date().getFullYear()} &bull; Hệ thống Tiếp thị liên kết chính thức
        </footer>
      </div>
    );
  }

  // ----------------------------------------------------
  // AUTHENTICATED VIEW: Affiliate Dashboard
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-rose-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-xs backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="w-9 h-9 object-contain rounded-xl shadow-xs" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-rose-900 text-amber-300 font-black text-sm flex items-center justify-center shadow-xs">
                NK
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 block">NOT A KNOT</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Đối Tác Tiếp Thị
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block">
                Cổng thông tin hiệu suất & hoa hồng
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* User Profile Tag */}
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
              <div 
                className="w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0"
                style={{ backgroundColor: affiliateUser.avatarColor || '#991B1B' }}
              >
                {affiliateUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {affiliateUser.name}
                </div>
                <div className="text-[10px] font-mono text-slate-500 leading-tight">
                  Mã: <strong className="text-rose-700 font-black">{affiliateCode}</strong>
                </div>
              </div>
            </div>

            {/* Back to store */}
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              title="Về trang chủ mua sắm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Về cửa hàng</span>
            </button>

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Đăng xuất khỏi tài khoản"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* HERO & REFERRAL LINK CARD */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-950 via-neutral-900 to-rose-900 text-white p-6 sm:p-8 shadow-xl border border-rose-900/30">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-rose-600/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Chương trình Tiếp Thị Liên Kết Not a Knot</span>
            </div>
            
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white mb-2">
              Xin chào, {affiliateUser.name}!
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mb-6">
              Chia sẻ liên kết giới thiệu độc quyền của bạn để nhận <strong className="text-amber-400 font-extrabold">{affiliateUser.commissionRate || systemConfig.defaultCommissionRate}%</strong> hoa hồng trên giá trị sản phẩm sau giảm giá cho đơn hàng đầu tiên hợp lệ của khách hàng.
            </p>

            {/* Unique Referral Link Box */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-amber-300">
                Liên kết tiếp thị độc quyền của bạn
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 sm:p-2 rounded-2xl bg-black/40 border border-white/15 backdrop-blur-md">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-mono text-amber-200 select-all overflow-x-auto whitespace-nowrap">
                  <Link2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{referralUrl}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md ${
                      copiedLink
                        ? 'bg-emerald-500 text-white scale-98 shadow-emerald-500/20'
                        : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20 active:scale-98'
                    }`}
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Đã sao chép!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Sao chép liên kết</span>
                      </>
                    )}
                  </button>
                  <a
                    href={referralUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Mở liên kết thử nghiệm"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-400 pt-1">
                <span>&bull; Thời hạn lưu cookie: <strong className="text-white">{systemConfig.cookieDurationDays} ngày</strong></span>
                <span>&bull; Cơ chế: <strong className="text-white">Last-Click</strong> (ưu tiên cú nhấp gần nhất)</span>
                <span>&bull; Áp dụng: <strong className="text-white">Đơn hàng đầu tiên</strong> sau khi nhấn link</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 STAT CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Commission Rate */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tỷ lệ hoa hồng cá nhân
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {affiliateUser.commissionRate !== undefined ? affiliateUser.commissionRate : systemConfig.defaultCommissionRate}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Được áp dụng cố định trên giá trị sản phẩm sau giảm giá
            </p>
          </div>

          {/* Card 2: Total Attributed Orders */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tổng đơn ghi nhận
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {stats.totalOrders}
              </span>
              <span className="text-xs font-bold text-slate-500">đơn</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Chỉ tính các đơn hàng thành công, không tính đơn đã xóa
            </p>
          </div>

          {/* Card 3: Total Merchandise Revenue */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Doanh thu sản phẩm
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
                {stats.totalMerchandiseValue.toLocaleString('vi-VN')}
              </span>
              <span className="text-xs font-bold text-slate-500">đ</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Giá trị hàng hoá sau trừ voucher, không tính phí vận chuyển
            </p>
          </div>

          {/* Card 4: Total Commission Earned (HIGHLIGHT) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                Tổng hoa hồng tích lũy
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center font-bold shadow-xs">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-rose-800 tracking-tight font-mono">
                {stats.totalCommission.toLocaleString('vi-VN')}
              </span>
              <span className="text-xs font-bold text-rose-800">đ</span>
            </div>
            <p className="text-[11px] text-amber-800 font-semibold mt-2">
              Đối soát & thanh toán thủ công định kỳ bởi ban quản trị
            </p>
          </div>
        </div>

        {/* ATTRIBUTED ORDERS TABLE & LIST */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header of Table */}
          <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Danh Sách Đơn Hàng Ghi Nhận</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 font-mono">
                  {filteredOrders.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Theo dõi chi tiết giá trị sản phẩm và số tiền hoa hồng thực tế trên từng đơn hàng
              </p>
            </div>

            {/* Filter and Search controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm mã đơn (NAK-...)"
                  className="w-full sm:w-48 pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 outline-none transition-colors"
                />
              </div>

              {/* Time filter selector */}
              <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setTimeFilter('all')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    timeFilter === 'all' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter('today')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    timeFilter === 'today' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter('7days')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    timeFilter === '7days' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  7 ngày
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter('30days')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    timeFilter === '30days' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  30 ngày
                </button>
              </div>
            </div>
          </div>

          {/* Privacy Note Banner */}
          <div className="px-5 sm:px-6 py-2.5 bg-slate-50/70 border-b border-slate-200/60 text-[11px] text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              Để bảo vệ quyền riêng tư cá nhân của khách hàng, bảng chỉ hiển thị mã đơn, ngày mua, giá trị hàng hóa và mức hoa hồng tương ứng.
            </span>
          </div>

          {/* Orders List / Table */}
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mb-3">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Chưa có đơn hàng nào</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery || timeFilter !== 'all'
                  ? 'Không tìm thấy đơn hàng phù hợp với bộ lọc hiện tại. Thử chọn thời gian khác hoặc xóa từ khóa tìm kiếm.'
                  : 'Hãy chia sẻ liên kết tiếp thị của bạn lên Facebook, TikTok, Instagram hoặc mạng xã hội để khách hàng ghé thăm và đặt đơn!'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 sm:px-6">Mã Đơn Hàng</th>
                    <th className="py-3 px-4">Ngày Đặt</th>
                    <th className="py-3 px-4">Trạng Thái Đơn</th>
                    <th className="py-3 px-4 text-right">Giá Trị Tính Hoa Hồng</th>
                    <th className="py-3 px-4 text-center">Tỷ Lệ Áp Dụng</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Hoa Hồng Ghi Nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredOrders.map((ord) => {
                    const merchVal = typeof ord.affiliateMerchandiseValue === 'number'
                      ? ord.affiliateMerchandiseValue
                      : Math.max(0, (ord.subtotal || ord.totalPrice || 0) - (ord.discountAmount || 0));

                    const commRate = typeof ord.affiliateCommissionRate === 'number'
                      ? ord.affiliateCommissionRate
                      : (affiliateUser.commissionRate || 10);

                    const commAmount = typeof ord.affiliateCommissionAmount === 'number'
                      ? ord.affiliateCommissionAmount
                      : Math.round((merchVal * commRate) / 100);

                    const displayStatus = ord.status || 'Chờ xác nhận';
                    const isSuccess = displayStatus.toLowerCase().includes('giao') || displayStatus.toLowerCase().includes('hoàn tất') || displayStatus.toLowerCase().includes('thành công');

                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-slate-900">
                          {ord.id}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }) : (ord.date || '—')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {displayStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                          {merchVal.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold font-mono text-[11px] border border-purple-200">
                            {commRate}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-black text-rose-800 text-sm">
                          +{commAmount.toLocaleString('vi-VN')}đ
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TRANSPARENT POLICY ACCORDION / GUIDE */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-black text-base">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            <span>Quy Định & Cơ Chế Hoạt Động Của Chương Trình Tiếp Thị</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
              <span className="font-bold text-slate-900 block">1. Cơ chế Cookie & Thời hạn hiệu lực</span>
              <p>
                Khi khách hàng nhấp vào liên kết của bạn (VD: <code className="text-rose-700 font-mono">?ref={affiliateCode}</code>), trình duyệt sẽ tự động ghi nhớ mã trong {systemConfig.cookieDurationDays} ngày mà không cần đăng nhập.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
              <span className="font-bold text-slate-900 block">2. Nguyên tắc Last-Click Attribution</span>
              <p>
                Nếu khách hàng nhấp vào nhiều liên kết tiếp thị khác nhau, đối tác được nhấp vào gần nhất trước khi mua hàng sẽ là người được ghi nhận hoa hồng.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
              <span className="font-bold text-slate-900 block">3. Đơn hàng đầu tiên & Tính hoa hồng</span>
              <p>
                Hoa hồng chỉ được tính cho đơn hàng đầu tiên hợp lệ của lượt click đó. Công thức: <strong className="text-slate-900">Hoa hồng = Giá trị sản phẩm sau giảm giá (đã trừ voucher) × Tỷ lệ hoa hồng</strong>. Phí vận chuyển không tính hoa hồng.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
              <span className="font-bold text-slate-900 block">4. Quyền mua sắm & Thanh toán</span>
              <p>
                Đối tác được phép tự mua hàng qua liên kết của chính mình để nhận chiết khấu hoa hồng. Thanh toán được bộ phận kế toán của Not a Knot đối soát và chuyển khoản thủ công định kỳ.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Not a Knot &bull; Cổng Đối Tác Tiếp Thị Liên Kết &bull; All Rights Reserved
      </footer>
    </div>
  );
};
