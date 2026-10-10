import React, { useState } from 'react';
import { X, ArrowLeft, AlertCircle, HelpCircle, Lock } from 'lucide-react';
import { SellerUser } from '../types';
import { signInWithGoogle } from '../utils/auth';

interface AdminLoginPageProps {
  onLoginSuccess: (user: SellerUser) => void;
  onBackToStore: () => void;
  brandName?: string;
  logoUrl?: string;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onBackToStore,
  brandName = 'Not A Knot',
  logoUrl = '/assets/logo.png'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await signInWithGoogle();
      if (res.success && res.user) {
        onLoginSuccess(res.user as SellerUser);
      } else {
        // Sanitize error message to never expose internal sensitive details
        let userSafeError = res.error || 'Đăng nhập không thành công. Vui lòng thử lại sau.';
        if (userSafeError.includes('đã được đóng') || userSafeError.includes('cancelled-popup-request')) {
          userSafeError = '';
        } else if (
          userSafeError.includes('Tổng bí thư') ||
          userSafeError.includes('authorized_sellers') ||
          userSafeError.includes('@gmail.com')
        ) {
          userSafeError = 'Tài khoản Google này chưa được cấp quyền truy cập hệ thống quản trị.';
        }
        setErrorMessage(userSafeError);
      }
    } catch (err: any) {
      const isNormalCancel =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request';

      if (!isNormalCancel) {
        console.warn('Google Sign-In Notice:', err?.message || err);
      }

      let userSafeError = '';
      if (!isNormalCancel) {
        userSafeError = 'Đăng nhập không thành công. Vui lòng thử lại sau.';
        if (err?.code === 'auth/popup-blocked') {
          userSafeError = 'Trình duyệt đã chặn popup. Vui lòng cho phép mở cửa sổ đăng nhập.';
        } else if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
          userSafeError = 'Đăng nhập không thành công trên tên miền này. Vui lòng liên hệ quản trị viên.';
        }
      }
      setErrorMessage(userSafeError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] w-full flex-grow relative flex flex-col items-center justify-between p-4 sm:p-8 select-none bg-cover bg-center overflow-y-auto"
      style={{
        backgroundImage: "url('/assets/admin-login-bg.jpg')",
        backgroundColor: '#0a160f'
      }}
    >
      {/* Dark Ambient Vignette Overlay for Depth & Contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80 pointer-events-none" />

      {/* Top Header Row with Brand Logo & Back Quick Action */}
      <div className="relative z-20 w-full max-w-4xl flex items-center justify-between mb-4 sm:mb-6">
        <button
          type="button"
          onClick={onBackToStore}
          className="flex items-center gap-3 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/90 hover:text-white px-3.5 py-2 rounded-full border border-white/10 transition-all cursor-pointer group"
          title="Trở về trang chủ cửa hàng"
        >
          <div className="w-8 h-8 rounded-full bg-white/95 p-1 flex items-center justify-center shrink-0 shadow-sm">
            <img
              src={logoUrl}
              alt={brandName}
              className="w-full h-full object-contain rounded-full group-hover:scale-105 transition-transform"
            />
          </div>
          <span className="text-xs sm:text-sm font-normal text-white/90 group-hover:text-white pr-2">
            {brandName} Studio
          </span>
        </button>
      </div>

      {/* Spacious Card (Comfortable responsive padding, no awkward cropping) */}
      <div className="relative z-10 w-full max-w-xl sm:max-w-2xl bg-white rounded-3xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.8)] border border-neutral-100/90 overflow-hidden my-auto p-6 sm:p-9 md:p-11 animate-scaleUp">
        {/* Top-Right Close Button (X) */}
        <button
          type="button"
          onClick={onBackToStore}
          className="absolute top-5 right-5 sm:top-6 sm:right-6 w-10 h-10 rounded-full text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
          title="Đóng / Trở về cửa hàng"
          aria-label="Đóng / Trở về cửa hàng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Card Header with clean, readable, non-bold typography */}
        <div className="mb-6 pr-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-neutral-900 tracking-tight leading-snug">
            Đăng nhập hệ thống
          </h1>
          <p className="text-sm sm:text-base text-neutral-500 font-normal mt-1.5 leading-relaxed">
            Vui lòng sử dụng tài khoản Google đã được cấp quyền quản trị để tiếp tục.
          </p>
        </div>

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-normal leading-relaxed">
              {errorMessage}
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              className="text-rose-400 hover:text-rose-700 p-0.5 rounded-md cursor-pointer shrink-0"
              title="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Google-Only Login Action Area with gentle, easily readable font weight and comfortable sizing */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-3.5 sm:py-4 px-6 bg-white hover:bg-neutral-50 active:bg-neutral-100 active:scale-[0.99] border border-neutral-300 hover:border-neutral-400 rounded-2xl text-neutral-800 font-medium text-base sm:text-lg shadow-xs flex items-center justify-center gap-3.5 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
                <span className="text-neutral-700 font-medium text-base sm:text-lg">Đang kết nối Google...</span>
              </>
            ) : (
              <>
                {/* Official Full-Color Google SVG Icon */}
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
                <span className="font-medium text-neutral-800 text-base sm:text-lg">
                  Tiếp tục với Google
                </span>
              </>
            )}
          </button>

          {/* Remember me & Need help row */}
          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 text-neutral-800 focus:ring-neutral-400 cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-neutral-600 font-normal">
                Ghi nhớ phiên đăng nhập
              </span>
            </label>

            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="text-xs sm:text-sm text-neutral-500 hover:text-neutral-900 font-normal hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              Cần trợ giúp?
            </button>
          </div>

          {/* Customer navigation fallback */}
          <div className="pt-3 pb-1 text-center border-t border-neutral-100">
            <p className="text-xs sm:text-sm text-neutral-600 font-normal">
              Bạn là khách đi lạc?{' '}
              <button
                type="button"
                onClick={onBackToStore}
                className="text-amber-800 hover:text-amber-950 font-semibold underline underline-offset-4 transition-colors cursor-pointer ml-1"
              >
                Trở về cửa hàng
              </button>
            </p>
          </div>
        </div>

        {/* Security notice */}
        <div className="mt-7 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-start gap-3 text-neutral-500 text-xs sm:text-sm">
          <Lock className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
          <p className="font-normal leading-relaxed text-xs sm:text-sm">
            Phiên làm việc được bảo mật mã hóa SSL 256-bit. Chỉ tài khoản Gmail được quản trị viên chỉ định mới có quyền truy cập.
          </p>
        </div>
      </div>

      {/* Subtle Page Footer */}
      <div className="relative z-20 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between text-[11px] sm:text-xs font-normal text-white/50 pt-4 pb-1 text-center sm:text-left gap-1">
        <span>© 2026 {brandName} Studio. Toàn bộ quyền được bảo lưu.</span>
        <span>Hỗ trợ kỹ thuật: admin@notaknot.id.vn • Trụ sở Hà Nội</span>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative border border-neutral-100 animate-scaleUp">
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 mb-3 text-neutral-900 font-medium text-base">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              <span>Hướng dẫn đăng nhập</span>
            </div>
            <p className="text-xs text-neutral-600 font-normal leading-relaxed mb-4">
              Khu vực này dành riêng cho nhân viên và quản trị viên của {brandName}. Nếu bạn là thành viên nhưng tài khoản chưa được kích hoạt quyền hoặc gặp lỗi khi kết nối Google, vui lòng liên hệ trực tiếp người quản trị để được thêm vào danh sách ủy quyền.
            </p>
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 mb-5 text-[11px] text-neutral-500 font-normal space-y-1">
              <div>• Đảm bảo popup trình duyệt không bị chặn</div>
              <div>• Sử dụng đúng địa chỉ Gmail đã được đăng ký</div>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs transition-colors cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
