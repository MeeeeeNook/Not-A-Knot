import React, { useState, useEffect } from 'react';
import {
  Mail,
  CheckCircle2,
  Send,
  Edit3,
  Save,
  X,
  RefreshCw,
  Server,
  KeyRound,
  AlertCircle,
  Calendar,
  Clock,
  BarChart3,
  Bell,
  Sliders
} from 'lucide-react';
import { ensureGmailDomain } from '../../utils/emailService';

interface EmailSettings {
  notifyAdminOnNewOrder: boolean;
  customerOrderEmailOption: boolean;
  adminNotificationEmail: string;
}

interface EmailStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  dailyLimit: number;
}

interface AdminEmailSettingsPageProps {
  onNotify?: (message: string) => void;
}

export const AdminEmailSettingsPage: React.FC<AdminEmailSettingsPageProps> = ({ onNotify }) => {
  const [status, setStatus] = useState<{
    configured: boolean;
    configuredUser: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    mode: string;
  } | null>(null);

  const [settings, setSettings] = useState<EmailSettings>({
    notifyAdminOnNewOrder: false,
    customerOrderEmailOption: true,
    adminNotificationEmail: ''
  });

  const [stats, setStats] = useState<EmailStats>({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    total: 0,
    dailyLimit: 500
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isUpdatingToggle, setIsUpdatingToggle] = useState(false);

  // Test Delivery state
  const [testRecipient, setTestRecipient] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchEmailSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/email/settings');
      if (res.ok) {
        const data = await res.json();
        setStatus({
          configured: data.configured,
          configuredUser: data.configuredUser,
          smtpHost: data.smtpHost,
          smtpPort: data.smtpPort,
          smtpSecure: data.smtpSecure,
          mode: data.mode
        });
        if (data.settings) {
          setSettings(data.settings);
          setNewEmail(data.settings.adminNotificationEmail || '');
          if (!testRecipient) {
            setTestRecipient(data.settings.adminNotificationEmail || '');
          }
        }
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Lỗi tải cài đặt Email:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailSettings();
  }, []);

  const handleToggle = async (key: 'notifyAdminOnNewOrder' | 'customerOrderEmailOption', value: boolean) => {
    setIsUpdatingToggle(true);
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);

    try {
      const res = await fetch('/api/email/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        if (data.stats) setStats(data.stats);
        if (onNotify) {
          const label = key === 'notifyAdminOnNewOrder' 
            ? 'Email thông báo đơn mới cho Quản trị viên'
            : 'Tùy chọn gửi email cho khách tại trang hoàn tất';
          onNotify(`Đã ${value ? 'bật' : 'tắt'} ${label}.`);
        }
      } else {
        // Revert on failure
        setSettings(settings);
        if (onNotify) onNotify(data.error || 'Không thể lưu cài đặt.');
      }
    } catch (err: any) {
      setSettings(settings);
      if (onNotify) onNotify(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsUpdatingToggle(false);
    }
  };

  const handleSaveEmail = async () => {
    const formattedEmail = ensureGmailDomain(newEmail);
    if (!formattedEmail) {
      if (onNotify) onNotify('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    setNewEmail(formattedEmail);
    setIsSavingEmail(true);
    try {
      const res = await fetch('/api/email/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotificationEmail: formattedEmail })
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        setTestRecipient(data.settings.adminNotificationEmail);
        setIsEditingEmail(false);
        if (onNotify) onNotify(`Đã lưu email nhận thông báo: ${data.settings.adminNotificationEmail}`);
      } else {
        if (onNotify) onNotify(data.error || 'Không thể lưu email');
      }
    } catch (err: any) {
      if (onNotify) onNotify(err.message || 'Lỗi mạng');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSendTest = async () => {
    const target = ensureGmailDomain(testRecipient || settings.adminNotificationEmail || '');
    if (!target) {
      setTestResult({ type: 'error', message: 'Vui lòng nhập địa chỉ email hợp lệ để nhận thư thử nghiệm.' });
      return;
    }
    setTestRecipient(target);
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/email/test-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: target })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          type: 'success',
          message: `Đã gửi thành công email thử nghiệm đến ${data.destination}! Vui lòng kiểm tra hộp thư đến (và mục Spam nếu có).`
        });
        if (data.stats) setStats(data.stats);
        if (onNotify) onNotify('Gửi email test thành công!');
      } else {
        setTestResult({ type: 'error', message: data.message || 'Gửi email thử nghiệm không thành công.' });
      }
    } catch (err: any) {
      setTestResult({ type: 'error', message: err.message || 'Lỗi kết nối máy chủ' });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[350px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-amber-500 animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Đang tải cấu hình email...</span>
        </div>
      </div>
    );
  }

  const todayPercentage = Math.min(100, Math.round((stats.today / (stats.dailyLimit || 500)) * 100));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Clean Minimal Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Cài Đặt Email & Gửi Thư</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý gửi thư xác nhận đơn hàng, bộ lọc thông báo và giám sát hạn mức gửi hàng ngày.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchEmailSettings}
          className="self-start sm:self-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* Usage Counters / Quota Cards */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <BarChart3 className="w-4 h-4 text-slate-500" />
          <span>Thống kê số lượng email đã gửi (Hạn mức Free Tier)</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Stat 1: Today */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Hôm nay
              </span>
              <span className="text-[11px] font-mono text-slate-400">/ {stats.dailyLimit || 500}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 font-mono">{stats.today}</span>
              <span className="text-xs text-slate-500">email</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  todayPercentage > 85 ? 'bg-rose-500' : todayPercentage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(4, todayPercentage)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 block">
              {todayPercentage}% hạn mức gửi trong ngày
            </span>
          </div>

          {/* Stat 2: This Week */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-sky-500" />
                Tuần này
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 font-mono">{stats.thisWeek}</span>
              <span className="text-xs text-slate-500">email</span>
            </div>
            <span className="text-[10px] text-slate-400 block pt-1">
              Tính từ đầu tuần (Thứ Hai)
            </span>
          </div>

          {/* Stat 3: This Month */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                Tháng này
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 font-mono">{stats.thisMonth}</span>
              <span className="text-xs text-slate-500">email</span>
            </div>
            <span className="text-[10px] text-slate-400 block pt-1">
              Tính từ ngày 1 của tháng
            </span>
          </div>

          {/* Stat 4: Total */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Tổng đã gửi
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 font-mono">{stats.total}</span>
              <span className="text-xs text-slate-500">lượt thư</span>
            </div>
            <span className="text-[10px] text-slate-400 block pt-1">
              Lưu trữ và theo dõi liên tục
            </span>
          </div>
        </div>
      </div>

      {/* Email Toggles (Bật/Tắt các loại thư) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sliders className="w-4 h-4 text-slate-700" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Bật / Tắt Các Loại Thư</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {/* Toggle 1: Admin order notification */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Email thông báo khi có đơn hàng mới (Dành cho Quản trị viên)</span>
                {settings.notifyAdminOnNewOrder ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Đang bật
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    Đang tắt
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Tự động gửi một bản sao chi tiết đơn hàng về email quản trị mỗi khi khách hoàn tất mua sắm trên web.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.notifyAdminOnNewOrder}
                disabled={isUpdatingToggle}
                onChange={(e) => handleToggle('notifyAdminOnNewOrder', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Toggle 2: Customer order email option on success screen */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Ô gửi thông tin đơn hàng qua Email tại màn hình đặt hàng thành công</span>
                {settings.customerOrderEmailOption ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Hiển thị
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    Đã ẩn
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Cho phép khách hàng tự nhập email và bấm gửi xác nhận đơn hàng sau khi đặt thành công. Tắt mục này sẽ ẩn hoàn toàn phần nhập email.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.customerOrderEmailOption}
                disabled={isUpdatingToggle}
                onChange={(e) => handleToggle('customerOrderEmailOption', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 2-Column: Sender Info & Admin Email / Test Email */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Configuration & Receiver */}
        <div className="space-y-4">
          {/* Card: Admin Notification Receiver */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <KeyRound className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">Email Quản Trị Nhận Thông Báo</h3>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-slate-500">Địa chỉ email nhận thông báo:</span>
              {!isEditingEmail ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    {settings.adminNotificationEmail || 'Chưa thiết lập'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingEmail(true);
                      setNewEmail(settings.adminNotificationEmail || '');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Thay đổi</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Nhập email mới..."
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 min-w-[240px]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveEmail}
                    disabled={isSavingEmail}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    <span>{isSavingEmail ? 'Lưu...' : 'Lưu'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingEmail(false);
                      setNewEmail(settings.adminNotificationEmail || '');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Hủy</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card: SMTP Server Details */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Máy Chủ Gửi (Google SMTP)</h3>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đang hoạt động
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Tài khoản gửi</span>
                <p className="font-mono font-semibold text-slate-800">noreply.notaknot@gmail.com</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Cổng & Giao thức</span>
                <p className="font-mono font-semibold text-slate-800">smtp.gmail.com : 465 (SSL)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Test Tool */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Send className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">Gửi Thử Email Kiểm Tra</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Địa chỉ email nhận thư thử nghiệm:
              </label>
              <input
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="Nhập email cần nhận..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-400 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSendTest}
              disabled={isTesting}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang gửi thử nghiệm...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi Thư Thử Nghiệm</span>
                </>
              )}
            </button>

            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border space-y-0.5 ${
                  testResult.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {testResult.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  )}
                  <span>{testResult.type === 'success' ? 'Đã gửi thành công' : 'Có lỗi phát sinh'}</span>
                </div>
                <p className="leading-relaxed">{testResult.message}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
