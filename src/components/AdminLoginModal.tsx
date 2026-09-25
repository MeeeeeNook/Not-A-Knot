import React, { useState, useEffect } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { SellerUser } from '../types';
import { loginWithServer, ROOT_ADMIN_USERNAME, isRootAdminUsername, hashUsername } from '../utils/auth';
import { getClientGeoLocation, getClientDeviceInfo, GeoLocationInfo } from '../utils/ipGeo';
import { logAdminLogin } from '../utils/logger';
import { updateSellerPresence, fetchSellerByUsername } from '../firebase';
import { safeStorageGetItem } from '../utils/storageHelper';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: SellerUser) => void;
  sellers: SellerUser[];
  brandName?: string;
  logoUrl?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  sellers,
  brandName = 'NOT A KNOT',
  logoUrl
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [clientGeo, setClientGeo] = useState<GeoLocationInfo | null>(null);

  useEffect(() => {
    if (isOpen) {
      getClientGeoLocation().then(setClientGeo).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername) {
      setErrorMessage('Vui lòng nhập tên đăng nhập.');
      return;
    }
    if (!cleanPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Fetch or reuse IP Geolocation (instant if already cached)
      const geo = clientGeo || await getClientGeoLocation();
      if (!clientGeo) {
        setClientGeo(geo);
      }

      // Security check: Only allow admin logins originating from Vietnam (or root admin when roaming)
      const isRoot = isRootAdminUsername(cleanUsername);
      if (!geo.isVietnam && !isRoot) {
        await logAdminLogin({
          username: cleanUsername,
          status: 'blocked_geo',
          customGeo: geo,
          reason: `Truy cập quản trị từ ngoài lãnh thổ Việt Nam (${geo.countryCode}) bị chặn`
        });

        setErrorMessage(
          `Đăng nhập bị từ chối: Quyền truy cập cổng quản trị chỉ dành cho địa chỉ IP thuộc Việt Nam (VN). Vị trí IP hiện tại của bạn: ${geo.country || 'Nước ngoài'} (${geo.countryCode || 'Quốc tế'}).`
        );
        setIsLoading(false);
        return;
      }

      // Find seller in list (supports matching by plain username or hashed username)
      const cleanUsernameHash = await hashUsername(cleanUsername);
      let matchedSeller = sellers.find(
        (s) => s.username.toLowerCase() === cleanUsername || (s.usernameHash && s.usernameHash === cleanUsernameHash)
      );

      // Query Firestore directly for freshest seller credentials (with safe 3.5s timeout)
      try {
        const freshSeller = await fetchSellerByUsername(cleanUsername);
        if (freshSeller) {
          matchedSeller = freshSeller;
        }
      } catch (e) {
        console.warn('Could not fetch fresh seller from Firestore:', e);
      }

      // If still not found, check local storage
      if (!matchedSeller) {
        try {
          const cached = safeStorageGetItem('nak_sellers_list');
          if (cached) {
            const list: SellerUser[] = JSON.parse(cached);
            matchedSeller = list.find(
              (s) => s.username.toLowerCase() === cleanUsername || (s.usernameHash && s.usernameHash === cleanUsernameHash)
            );
          }
        } catch {}
      }

      // Perform authentication (Rate-limited, authoritative bcrypt & salted SHA256)
      const loginRes = await loginWithServer(cleanUsername, cleanPassword, matchedSeller, rememberMe);

      if (!loginRes.success || !loginRes.user) {
        await logAdminLogin({
          username: cleanUsername,
          name: matchedSeller?.name || cleanUsername,
          status: 'failed_password',
          customGeo: geo,
          reason: loginRes.error || 'Mật khẩu hoặc tài khoản không hợp lệ'
        });
        setErrorMessage(loginRes.error || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
        setIsLoading(false);
        return;
      }

      // Success authenticated
      const devInfo = getClientDeviceInfo();
      const nowIso = new Date().toISOString();
      const authenticatedUser: SellerUser = {
        ...(matchedSeller || {
          id: loginRes.user.id || `seller-${cleanUsername}`,
          username: cleanUsername,
          name: loginRes.user.name || cleanUsername,
          role: loginRes.user.role || (loginRes.user.isRootAdmin ? 'root_admin' : 'member'),
          isRootAdmin: Boolean(loginRes.user.isRootAdmin),
          isActive: true,
          createdAt: nowIso,
          avatarColor: loginRes.user.avatarColor || '#B41C1A'
        }),
        ...(loginRes.user as any),
        lastLoginAt: nowIso,
        lastSeenAt: nowIso,
        lastLoginIp: geo.ip,
        lastLoginCity: geo.city || geo.region || 'Hà Nội',
        lastLoginCountry: geo.country || 'Vietnam',
        lastDevice: `${devInfo.browser} trên ${devInfo.os}`
      };

      logAdminLogin({
        username: authenticatedUser.username,
        name: authenticatedUser.name,
        isRoot: Boolean(authenticatedUser.isRootAdmin),
        status: 'success',
        customGeo: geo
      }).catch(() => {});

      updateSellerPresence(authenticatedUser.id, {
        lastLoginAt: nowIso,
        lastSeenAt: nowIso,
        lastLoginIp: geo.ip,
        lastLoginCity: geo.city || geo.region || 'Hà Nội',
        lastLoginCountry: geo.country || 'Vietnam',
        lastDevice: `${devInfo.browser} trên ${devInfo.os}`
      }).catch(() => {});

      setIsLoading(false);
      onLoginSuccess(authenticatedUser);
    } catch {
      setErrorMessage('Có lỗi xảy ra khi xác thực. Vui lòng thử lại.');
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background accents */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header with Logo */}
        <div className="relative text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-600/20 border border-amber-500/30 text-amber-400 mb-3 shadow-inner">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="w-10 h-10 object-contain" />
            ) : (
              <ShieldCheck className="w-7 h-7" />
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Cổng Quản Trị & Người Bán
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Đăng nhập tài khoản nội bộ {brandName}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 relative">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Tên đăng nhập
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập"
                autoComplete="username"
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 bg-neutral-950/80 border border-neutral-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl text-sm text-white placeholder-neutral-500 transition-all outline-hidden"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-2.5 bg-neutral-950/80 border border-neutral-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl text-sm text-white placeholder-neutral-500 transition-all outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me & Helper */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-neutral-300 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded-sm border-neutral-700 bg-neutral-950 text-amber-500 focus:ring-amber-500/40 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Ghi nhớ đăng nhập trên máy này</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-amber-500/20 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Đăng nhập hệ thống</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Confidential Security Status - IP is verified silently without displaying on screen */}
        <div className="mt-4 p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Xác thực hệ thống nội bộ bảo mật</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Mã hóa & Kín đáo
          </span>
        </div>

        {/* Footer info & Cancel */}
        <div className="mt-4 pt-4 border-t border-neutral-800 text-center flex items-center justify-between text-xs text-neutral-400">
          <button
            type="button"
            onClick={onClose}
            className="hover:text-white transition-colors cursor-pointer"
          >
            ← Trở về trang chủ
          </button>
          <span className="text-[11px] text-neutral-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500/60" /> Bảo mật đa tầng
          </span>
        </div>
      </div>
    </div>
  );
};
