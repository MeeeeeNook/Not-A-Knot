import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, Lock, ExternalLink, Globe, CheckCircle2, ArrowRight } from 'lucide-react';
import { GeoLocationInfo, getClientGeoLocation } from '../utils/ipGeo';

interface GeoAccessRestrictionScreenProps {
  geoInfo: GeoLocationInfo | null;
  onRefreshGeo: () => Promise<void>;
  onOpenAdminLogin: () => void;
  brandName?: string;
  logoUrl?: string;
  contactZalo?: string;
  facebookUrl?: string;
}

export const GeoAccessRestrictionScreen: React.FC<GeoAccessRestrictionScreenProps> = ({
  geoInfo,
  onRefreshGeo,
  onOpenAdminLogin,
  brandName = 'NOT A KNOT',
  logoUrl = '/assets/logo.png',
  contactZalo = '0342938174',
  facebookUrl = 'https://www.facebook.com/profile.php?id=61593591390851'
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshGeo();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const getCountryFlag = (code?: string) => {
    if (!code) return '🌐';
    const cleanCode = code.toUpperCase().trim();
    if (cleanCode === 'VN') return '🇻🇳';
    if (cleanCode === 'NL') return '🇳🇱';
    if (cleanCode === 'US') return '🇺🇸';
    if (cleanCode === 'SG') return '🇸🇬';
    if (cleanCode === 'JP') return '🇯🇵';
    if (cleanCode === 'KR') return '🇰🇷';
    if (cleanCode === 'GB') return '🇬🇧';
    if (cleanCode === 'DE') return '🇩🇪';
    if (cleanCode === 'FR') return '🇫🇷';
    if (cleanCode === 'AU') return '🇦🇺';
    return '🌐';
  };

  const detectedCountry = geoInfo?.country || 'Nước ngoài / VPN';
  const detectedCode = geoInfo?.countryCode || 'INTL';
  const detectedIp = geoInfo?.ip || 'Chưa xác định';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 font-sans relative overflow-hidden select-none">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={brandName}
              className="w-9 h-9 object-contain rounded-xl bg-slate-900 border border-slate-700/50 p-1"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center font-black text-white text-sm shadow-md">
              NK
            </div>
          )}
          <div>
            <span className="font-black tracking-wider text-base uppercase text-white block">
              {brandName}
            </span>
            <span className="text-[10px] font-semibold tracking-widest text-red-400 uppercase block -mt-0.5">
              Geo-blocking Defense Active
            </span>
          </div>
        </div>

        <button
          onClick={onOpenAdminLogin}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs font-bold text-amber-400 hover:text-amber-300 transition-all cursor-pointer shadow-xs"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Đăng nhập Admin</span>
        </button>
      </header>

      {/* Main Restriction Card */}
      <main className="max-w-2xl w-full mx-auto my-auto py-8 relative z-10">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold mb-6">
            <ShieldAlert className="w-4 h-4 animate-pulse" />
            <span>Giới Hạn Tùy Chỉnh Theo Quốc Gia (Vietnam IP Only)</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-3">
            Rất tiếc! Truy cập bị giới hạn từ Quốc Gia của bạn
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
            Hệ thống nhận diện địa chỉ IP của bạn xuất phát từ ngoài lãnh thổ Việt Nam. Theo chính sách bảo mật & phục vụ thị trường nội địa, website <strong className="text-amber-400">{brandName}</strong> hiện chỉ cho phép truy cập từ địa chỉ IP Việt Nam (🇻🇳).
          </p>

          {/* Detected IP Info Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-6 space-y-3 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-slate-400 font-medium">Địa chỉ IP phát hiện:</span>
              <span className="font-mono font-bold text-red-400 bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-900/50">
                {detectedIp}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-slate-400 font-medium">Quốc gia / Khu vực:</span>
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="text-base">{getCountryFlag(detectedCode)}</span>
                <span>{detectedCountry} ({detectedCode})</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Yêu cầu hệ thống:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <span>🇻🇳 Việt Nam (VN IP)</span>
              </span>
            </div>
          </div>

          {/* User Instructions */}
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 mb-8 text-xs sm:text-sm text-amber-200/90 leading-relaxed space-y-2">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <span>💡 Cách khắc phục để tiếp tục mua sắm:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
              <li><strong>Tắt VPN / Proxy:</strong> Nếu bạn đang bật VPN (máy chủ Hà Lan, Mỹ, Singapore...), vui lòng ngắt kết nối VPN và ngắt kết nối Proxy.</li>
              <li><strong>Sử dụng mạng di động / Wi-Fi Việt Nam:</strong> Đảm bảo bạn đang kết nối mạng Internet nội địa Việt Nam.</li>
              <li><strong>Nhấn nút kiểm tra lại:</strong> Sau khi tắt VPN, nhấn nút "Kiểm Tra Lại IP" bên dưới để hệ thống cập nhật lại vị trí.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-sm transition-all cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Đang kiểm tra lại...' : 'Kiểm Tra Lại IP'}</span>
            </button>

            <button
              onClick={onOpenAdminLogin}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm transition-all cursor-pointer"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Đăng Nhập Admin</span>
            </button>
          </div>

          {/* Contact Support */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span>Cần hỗ trợ trực tiếp?</span>
            <div className="flex items-center gap-3">
              {contactZalo && (
                <a
                  href={`https://zalo.me/${contactZalo.replace(/\s+/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline font-bold inline-flex items-center gap-1"
                >
                  <span>💬 Zalo ({contactZalo})</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {facebookUrl && (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline font-bold inline-flex items-center gap-1"
                >
                  <span>🌐 Fanpage Facebook</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center py-4 border-t border-slate-800/80 text-xs text-slate-500 relative z-10">
        © {new Date().getFullYear()} {brandName}. Hệ thống bảo mật & giới hạn truy cập tự động theo IP.
      </footer>
    </div>
  );
};
