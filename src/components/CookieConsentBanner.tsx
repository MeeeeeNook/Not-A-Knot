import React, { useState, useEffect, useCallback } from 'react';
import { PolicyTab } from './LegalPoliciesModal';

const COOKIE_CONSENT_KEY = 'nak_cookie_consent_v1';

export interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  preferences: boolean;
  timestamp: number;
}

interface CookieConsentBannerProps {
  onOpenPolicy?: (tab: PolicyTab) => void;
  onToast?: (message: string) => void;
}

export const getStoredCookiePreferences = (): CookiePreferences | null => {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearAllCookieConsent = (): void => {
  try {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name !== 'nak_admin_token') {
        document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
      }
    }
  } catch (err) {
    console.warn('Failed to clear cookie consent:', err);
  }
};

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  onOpenPolicy,
  onToast
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [preferencesEnabled, setPreferencesEnabled] = useState(true);

  useEffect(() => {
    const stored = getStoredCookiePreferences();
    if (!stored) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setAnalyticsEnabled(stored.analytics);
      setPreferencesEnabled(stored.preferences);
    }
  }, []);

  useEffect(() => {
    const handleOpenSettings = () => {
      const stored = getStoredCookiePreferences();
      if (stored) {
        setAnalyticsEnabled(stored.analytics);
        setPreferencesEnabled(stored.preferences);
      }
      setIsVisible(true);
      setIsCustomizeOpen(true);
    };

    window.addEventListener('open-cookie-settings', handleOpenSettings);
    return () => {
      window.removeEventListener('open-cookie-settings', handleOpenSettings);
    };
  }, []);

  const savePreferences = useCallback((analytics: boolean, preferences: boolean) => {
    const pref: CookiePreferences = {
      essential: true,
      analytics,
      preferences,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(pref));
    } catch {}

    setIsVisible(false);
    setIsCustomizeOpen(false);
  }, []);

  const handleAcceptAll = () => {
    savePreferences(true, true);
    if (onToast) {
      onToast('Đã lưu tùy chọn cookie thành công.');
    }
  };

  const handleDecline = () => {
    savePreferences(false, false);
    if (onToast) {
      onToast('Đã từ chối các cookie theo dõi không thiết yếu.');
    }
  };

  const handleSaveCustom = () => {
    savePreferences(analyticsEnabled, preferencesEnabled);
    if (onToast) {
      onToast('Đã lưu tùy chọn riêng tư.');
    }
  };

  const handleClearCookies = () => {
    clearAllCookieConsent();
    setAnalyticsEnabled(false);
    setPreferencesEnabled(false);
    setIsCustomizeOpen(false);
    setIsVisible(false);
    if (onToast) {
      onToast('Đã xóa dữ liệu cookie và cài đặt lại.');
    }
  };

  if (!isVisible) return null;

  return (
    <aside
      id="cookie-consent-banner"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-lg z-50 bg-[#F4F4F4] text-slate-900 border border-slate-300 shadow-2xl p-6 rounded-none sm:rounded-sm transition-all animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="space-y-4">
        <h2
          id="cookie-consent-title"
          className="text-2xl font-bold text-slate-900 tracking-tight leading-tight"
        >
          Thông báo sử dụng Cookie
        </h2>

        <p
          id="cookie-consent-description"
          className="text-sm text-slate-700 leading-relaxed font-normal"
        >
          Website NOT A KNOT sử dụng cookie và các công nghệ lưu trữ nhằm đảm bảo các chức năng mua sắm cơ bản (giỏ hàng, đơn hàng), tối ưu hóa trải nghiệm duyệt web và bảo mật thông tin của bạn.{' '}
          {onOpenPolicy && (
            <button
              type="button"
              onClick={() => onOpenPolicy('privacy')}
              className="inline text-slate-900 font-semibold underline underline-offset-2 hover:text-black cursor-pointer transition-colors"
            >
              Chính sách bảo mật
            </button>
          )}
        </p>

        {isCustomizeOpen && (
          <div className="p-4 bg-white border border-slate-300 space-y-3 text-xs my-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <p className="font-bold text-slate-900">Cookie cần thiết (Bắt buộc)</p>
                <p className="text-slate-500">Duy trì giỏ hàng, bảo mật phiên và xử lý thanh toán đơn hàng.</p>
              </div>
              <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-sm">
                Bắt buộc
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <p className="font-bold text-slate-900">Hiệu suất &amp; Phân tích</p>
                <p className="text-slate-500">Thống kê lưu lượng truy cập và cải thiện tốc độ trang.</p>
              </div>
              <input
                type="checkbox"
                checked={analyticsEnabled}
                onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                className="w-4 h-4 cursor-pointer accent-[#008000]"
              />
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <p className="font-bold text-slate-900">Cá nhân hóa trải nghiệm</p>
                <p className="text-slate-500">Ghi nhớ bộ lọc sản phẩm và tùy chọn hiển thị danh mục.</p>
              </div>
              <input
                type="checkbox"
                checked={preferencesEnabled}
                onChange={(e) => setPreferencesEnabled(e.target.checked)}
                className="w-4 h-4 cursor-pointer accent-[#008000]"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleClearCookies}
                className="text-xs text-rose-700 hover:text-rose-900 font-medium underline cursor-pointer"
              >
                Xóa sạch cookie
              </button>
              <button
                type="button"
                onClick={handleSaveCustom}
                className="px-3 py-1.5 bg-[#008000] hover:bg-[#006e00] text-white font-bold text-xs rounded-sm cursor-pointer transition-colors"
              >
                Lưu lựa chọn
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleAcceptAll}
            className="px-4 py-2 bg-[#008000] hover:bg-[#006e00] active:bg-[#005c00] text-white font-bold text-sm rounded-sm transition-colors cursor-pointer"
          >
            Đồng ý tất cả
          </button>

          <button
            type="button"
            onClick={handleDecline}
            className="px-4 py-2 bg-[#008000] hover:bg-[#006e00] active:bg-[#005c00] text-white font-bold text-sm rounded-sm transition-colors cursor-pointer"
          >
            Từ chối
          </button>

          <button
            type="button"
            onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
            className="px-4 py-2 bg-[#E5E5E5] hover:bg-[#D9D9D9] active:bg-[#CECECE] text-slate-900 font-bold text-sm rounded-sm transition-colors cursor-pointer"
          >
            Tùy chỉnh cài đặt
          </button>
        </div>
      </div>
    </aside>
  );
};
