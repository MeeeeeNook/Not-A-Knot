import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { Lock } from './common/LockIcon';
import { SellerUser } from '../types';
import { signInWithGoogle } from '../utils/auth';
import { getClientGeoLocation, getClientDeviceInfo, GeoLocationInfo } from '../utils/ipGeo';
import { logAdminLogin } from '../utils/logger';
import { updateSellerPresence } from '../firebase';

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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [clientGeo, setClientGeo] = useState<GeoLocationInfo | null>(null);

  useEffect(() => {
    if (isOpen) {
      getClientGeoLocation().then(setClientGeo).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      const geo = clientGeo || await getClientGeoLocation().catch(() => null);
      if (geo && !clientGeo) {
        setClientGeo(geo);
      }

      const res = await signInWithGoogle();
      if (!res.success || !res.user) {
        setErrorMessage(res.error || 'Đăng nhập Google qua Firebase thất bại.');
        setIsLoading(false);
        return;
      }

      const authenticatedUser: SellerUser = res.user;
      const devInfo = getClientDeviceInfo();
      const nowIso = new Date().toISOString();

      logAdminLogin({
        username: authenticatedUser.username,
        name: authenticatedUser.name,
        isRoot: Boolean(authenticatedUser.isRootAdmin),
        status: 'success',
        customGeo: geo || undefined
      }).catch(() => {});

      updateSellerPresence(authenticatedUser.id, {
        lastLoginAt: nowIso,
        lastSeenAt: nowIso,
        lastLoginIp: geo?.ip || '127.0.0.1',
        lastLoginCity: geo?.city || geo?.region || 'Hà Nội',
        lastLoginCountry: geo?.country || 'Vietnam',
        lastDevice: `${devInfo.browser} trên ${devInfo.os}`
      }).catch(() => {});

      setIsLoading(false);
      onLoginSuccess(authenticatedUser);
    } catch (err: any) {
      setErrorMessage(err.message || 'Có lỗi xảy ra khi xác thực Google. Vui lòng thử lại.');
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
          <h2 className="text-xl sm:text-2xl font-semibold tracking-normal text-white">
            Cổng Quản Trị & Người Bán
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 font-normal">
            Đăng nhập tài khoản nội bộ {brandName} (Firebase Authentication)
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in slide-in-from-top-1 font-normal">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Primary & Exclusive Authentication Method: Google Sign-In via Firebase Auth */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-white hover:bg-neutral-100 text-neutral-800 font-medium text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 active:scale-[0.99] border border-neutral-200"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.67v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.16z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{isLoading ? 'Đang xác thực Google...' : 'Đăng nhập bằng tài khoản Google'}</span>
          </button>

          {/* Access Policy Explainer Card */}
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs space-y-2 text-neutral-300">
            <div className="font-medium text-amber-400 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Cơ chế bảo mật Google Firebase Authentication</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed font-normal">
              Hệ thống xác thực tài khoản Google Cloud. Chỉ các tài khoản quản trị viên được ủy quyền mới có thể truy cập hệ thống.
            </p>
          </div>
        </div>

        {/* Security Status */}
        <div className="mt-5 p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-neutral-400 font-normal">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Xác thực RSA Token mã hóa cấp Google Cloud</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> 100% Google Auth
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
