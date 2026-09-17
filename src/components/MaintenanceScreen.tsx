import React, { useEffect, useState } from 'react';
import { ArrowRight, Phone, MessageSquare, Lock, ExternalLink, ShieldAlert } from 'lucide-react';
import { MaintenanceConfig } from '../types';
import { MaintenanceIllustration } from './MaintenanceIllustration';

interface MaintenanceScreenProps {
  config: MaintenanceConfig;
  brandName?: string;
  logoUrl?: string;
  onOpenAdminLogin?: () => void;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  config,
  brandName = 'NOT A KNOT',
  logoUrl,
  onOpenAdminLogin
}) => {
  const [countdown, setCountdown] = useState<number | null>(() => {
    if (config.autoRedirect && config.autoRedirectUrl && (config.autoRedirectSeconds || 0) > 0) {
      return config.autoRedirectSeconds || 5;
    }
    return null;
  });

  useEffect(() => {
    if (!config.autoRedirect || !config.autoRedirectUrl) return;
    const initialSec = config.autoRedirectSeconds || 5;
    setCountdown(initialSec);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (config.autoRedirectUrl) {
            window.location.href = config.autoRedirectUrl;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [config.autoRedirect, config.autoRedirectUrl, config.autoRedirectSeconds]);

  const handleImageClick = () => {
    if (config.imageUrlTarget) {
      window.open(config.imageUrlTarget, '_blank', 'noopener,noreferrer');
    }
  };

  const handleButtonClick = () => {
    if (config.buttonUrl) {
      window.open(config.buttonUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const cleanPhone = config.emergencyContactPhone?.replace(/\s+/g, '');
  const cleanZalo = config.emergencyContactZalo?.replace(/\s+/g, '');
  const displayLogo = logoUrl || '/assets/logo.jpg';

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* 1. TOP HEADER WITH NOT A KNOT LOGO */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between py-3 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <img
            src={displayLogo}
            alt={brandName}
            className="h-10 sm:h-12 w-auto object-contain rounded-xl border border-slate-200/90 shadow-2xs bg-white p-1"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wider text-slate-900 uppercase leading-none">
              {brandName}
            </h2>
          </div>
        </div>
      </header>

      {/* 2. MAIN SPACIOUS CONTENT (2-COLUMN RESPONSIVE LAYOUT, NO CRAMPED BOX) */}
      <main className="w-full max-w-6xl mx-auto my-auto py-8 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-10 lg:gap-16">
          {/* Column A: Modern Illustration matching user's reference */}
          <div className="lg:col-span-6 flex justify-center order-1 lg:order-1">
            {config.showImage && config.imageBase64 ? (
              <div
                onClick={config.imageUrlTarget ? handleImageClick : undefined}
                className={`group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg p-2 transition-transform ${
                  config.imageUrlTarget ? 'cursor-pointer hover:scale-[1.01]' : ''
                }`}
                title={config.imageUrlTarget ? `Bấm để mở: ${config.imageUrlTarget}` : undefined}
              >
                <img
                  src={config.imageBase64}
                  alt={config.imageAlt || 'Thông báo bảo trì'}
                  className="w-full max-h-[420px] object-contain rounded-2xl mx-auto"
                />
                {config.imageUrlTarget && (
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-sm font-bold text-white backdrop-blur-2xs rounded-2xl">
                    <span>Mở trang liên kết</span>
                    <ExternalLink className="w-4 h-4" />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full max-w-lg lg:max-w-none">
                <MaintenanceIllustration className="w-full h-auto" />
              </div>
            )}
          </div>

          {/* Column B: Clear, Clean, Minimal Content */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left order-2 lg:order-2">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                {config.title || 'Website Đang Tạm Đóng Để Bảo Trì'}
              </h1>
              <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0 whitespace-pre-line">
                {config.message ||
                  'Website đang tạm dừng hoạt động để bảo trì và nâng cấp. Quý khách vui lòng ghé thăm Fanpage Facebook hoặc liên hệ hotline để được hỗ trợ đặt hàng nhanh nhất!'}
              </p>
            </div>

            {/* Estimated Completion Time Badge */}
            {config.estimatedEndTime && config.estimatedEndTime.trim() && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-slate-700 text-xs sm:text-sm font-semibold">
                <span className="text-amber-600 font-bold">⏱️ Thời gian dự kiến:</span>
                <strong className="text-slate-900 font-black">{config.estimatedEndTime}</strong>
              </div>
            )}

            {/* Main Action Button */}
            {config.showButton && config.buttonUrl && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <button
                  type="button"
                  onClick={handleButtonClick}
                  className="w-full sm:w-auto min-w-[240px] inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 font-black text-sm sm:text-base transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>{config.buttonText || 'Ghé Thăm Fanpage Facebook'}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Auto-redirect Countdown */}
            {countdown !== null && countdown > 0 && config.autoRedirectUrl && (
              <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs sm:text-sm text-amber-950 flex items-center justify-between gap-3 max-w-md mx-auto lg:mx-0">
                <div className="flex items-center gap-2.5 text-left">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                  <span>
                    Tự động chuyển hướng sau <strong className="text-amber-700 font-mono font-black text-sm">{countdown}s</strong>...
                  </span>
                </div>
                <a
                  href={config.autoRedirectUrl}
                  className="text-amber-700 hover:text-amber-800 font-black underline shrink-0"
                >
                  Chuyển ngay
                </a>
              </div>
            )}

            {/* Emergency Contact Information */}
            {(cleanPhone || cleanZalo) && (
              <div className="pt-4 border-t border-slate-200/80 text-xs sm:text-sm text-slate-500 space-y-2.5">
                <p className="font-bold text-slate-700">
                  {config.emergencyContactText || 'Cần hỗ trợ đơn hàng gấp? Liên hệ trực tiếp qua:'}
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 sm:gap-3">
                  {cleanPhone && (
                    <a
                      href={`tel:${cleanPhone}`}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/90 font-bold shadow-2xs transition-colors"
                    >
                      <Phone className="w-4 h-4 text-amber-500" />
                      <span>Hotline: {config.emergencyContactPhone}</span>
                    </a>
                  )}
                  {cleanZalo && (
                    <a
                      href={`https://zalo.me/${cleanZalo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/90 font-bold shadow-2xs transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-sky-600" />
                      <span>Zalo: {config.emergencyContactZalo}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 3. BOTTOM FOOTER WITH CLEAN ADMIN BYPASS LINK */}
      <footer className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 pb-2 text-slate-400 text-xs border-t border-slate-200/80">
        <div>
          <span>© {new Date().getFullYear()} {brandName}. Tất cả quyền được bảo lưu.</span>
        </div>

        {onOpenAdminLogin && (
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-800 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-200/60 cursor-pointer"
            title="Đăng nhập trang quản trị để mở lại website"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="font-semibold text-xs">Quản trị viên đăng nhập</span>
          </button>
        )}
      </footer>
    </div>
  );
};
