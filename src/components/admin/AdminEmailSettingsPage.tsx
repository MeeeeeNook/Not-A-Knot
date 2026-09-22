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
import { db } from '../../firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

interface EmailSettings {
  notifyAdminOnNewOrder: boolean;
  customerOrderEmailOption: boolean;
  adminNotificationEmail: string;
}

interface EmailLogEntry {
  id: string;
  timestamp: number;
  recipient: string;
  orderCode?: string;
  type: 'admin_notification' | 'customer_confirmation' | 'manual_admin' | 'test';
  status: 'sent' | 'simulated' | 'error';
  createdAt?: string;
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

  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'customer_confirmation' | 'admin_notification' | 'manual_admin' | 'test'>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isUpdatingToggle, setIsUpdatingToggle] = useState(false);

  // Test Delivery state
  const [testRecipient, setTestRecipient] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const computeStatsFromLogs = (logList: EmailLogEntry[]): EmailStats => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday).getTime();
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;

    logList.forEach(log => {
      if (log.status === 'error') return;
      const ts = log.timestamp || (log.createdAt ? new Date(log.createdAt).getTime() : 0);
      if (ts >= startOfToday) today++;
      if (ts >= startOfWeek) thisWeek++;
      if (ts >= startOfMonth) thisMonth++;
    });

    return {
      today,
      thisWeek,
      thisMonth,
      total: logList.filter(l => l.status !== 'error').length,
      dailyLimit: 500
    };
  };

  const fetchLogsFromFirestoreDirect = async () => {
    try {
      const snap = await getDocs(collection(db, 'email_logs'));
      const list: EmailLogEntry[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        let logType: EmailLogEntry['type'] = d.type;
        if (!logType || logType === 'test') {
          logType = 'manual_admin';
          // Auto migrate Firestore record tag to manual_admin
          updateDoc(doc(db, 'email_logs', docSnap.id), { type: 'manual_admin' }).catch(() => {});
        }
        list.push({
          id: docSnap.id,
          timestamp: d.timestamp || (d.createdAt ? new Date(d.createdAt).getTime() : Date.now()),
          recipient: d.recipient || 'N/A',
          orderCode: d.orderCode || undefined,
          type: logType,
          status: d.status || 'sent',
          createdAt: d.createdAt
        });
      });
      list.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(list);
      setStats(computeStatsFromLogs(list));
      return list;
    } catch (e) {
      console.warn('[Firestore Direct] Fallback error loading logs:', e);
      return [];
    }
  };

  const fetchSettingsFromFirestoreDirect = async () => {
    try {
      const snap = await getDoc(doc(db, 'system_settings', 'email_config'));
      if (snap.exists()) {
        const d = snap.data();
        const loadedSettings: EmailSettings = {
          notifyAdminOnNewOrder: Boolean(d.notifyAdminOnNewOrder),
          customerOrderEmailOption: Boolean(d.customerOrderEmailOption),
          adminNotificationEmail: d.adminNotificationEmail || 'noreply.notaknot@gmail.com'
        };
        setSettings(loadedSettings);
        setNewEmail(loadedSettings.adminNotificationEmail);
        if (!testRecipient) setTestRecipient(loadedSettings.adminNotificationEmail);
        setStatus({
          configured: true,
          configuredUser: 'noreply.notaknot@gmail.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 465,
          smtpSecure: true,
          mode: 'live_smtp'
        });
      }
    } catch (e) {
      console.warn('[Firestore Direct] Fallback error loading settings:', e);
    }
  };

  const parseJsonResponse = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        error: `Máy chủ phản hồi không đúng định dạng (${res.status})`,
        message: `Máy chủ phản hồi không đúng định dạng (${res.status})`
      };
    }
  };

  const fetchLogs = async () => {
    setIsLogsLoading(true);
    let loadedFromApi = false;
    try {
      const res = await fetch('/api/email/logs');
      if (res.ok) {
        const data = await parseJsonResponse(res);
        if (data.success && Array.isArray(data.logs)) {
          loadedFromApi = true;
          const mappedLogs = data.logs.map((l: any) => ({
            ...l,
            type: (!l.type || l.type === 'test') ? 'manual_admin' : l.type
          }));
          setLogs(mappedLogs);
          if (data.stats) setStats(data.stats);
        }
      }
    } catch (err) {
      console.warn('API logs endpoint not available, falling back to Firestore direct fetch');
    }

    if (!loadedFromApi) {
      await fetchLogsFromFirestoreDirect();
    }
    setIsLogsLoading(false);
  };

  const fetchEmailSettings = async () => {
    setIsLoading(true);
    let loadedFromApi = false;
    try {
      const res = await fetch('/api/email/settings');
      if (res.ok) {
        const data = await parseJsonResponse(res);
        if (data && data.configured !== undefined) {
          loadedFromApi = true;
          setStatus({
            configured: Boolean(data.configured),
            configuredUser: data.configuredUser || '',
            smtpHost: data.smtpHost || '',
            smtpPort: Number(data.smtpPort) || 465,
            smtpSecure: Boolean(data.smtpSecure),
            mode: data.mode || 'simulated_preview'
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
      }
    } catch (err) {
      console.warn('Backend API not available, using Firestore direct fallback:', err);
    }

    if (!loadedFromApi) {
      await fetchSettingsFromFirestoreDirect();
    }

    await fetchLogs();
    setIsLoading(false);
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
      const data = await parseJsonResponse(res);
      if (data.success && data.settings) {
        setSettings(data.settings);
        if (data.stats) setStats(data.stats);
      } else {
        // Direct Firestore fallback for static hosting
        await setDoc(doc(db, 'system_settings', 'email_config'), { [key]: value }, { merge: true });
      }
      if (onNotify) {
        const label = key === 'notifyAdminOnNewOrder' 
          ? 'Email thông báo đơn mới cho Quản trị viên'
          : 'Tùy chọn gửi email cho khách tại trang hoàn tất';
        onNotify(`Đã ${value ? 'bật' : 'tắt'} ${label}.`);
      }
    } catch (err: any) {
      // Direct Firestore fallback
      try {
        await setDoc(doc(db, 'system_settings', 'email_config'), { [key]: value }, { merge: true });
        if (onNotify) {
          const label = key === 'notifyAdminOnNewOrder' 
            ? 'Email thông báo đơn mới cho Quản trị viên'
            : 'Tùy chọn gửi email cho khách tại trang hoàn tất';
          onNotify(`Đã ${value ? 'bật' : 'tắt'} ${label} (Đồng bộ Firestore).`);
        }
      } catch {
        setSettings(settings);
        if (onNotify) onNotify('Không thể cập nhật cài đặt.');
      }
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
    let savedSuccessfully = false;
    try {
      const res = await fetch('/api/email/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotificationEmail: formattedEmail })
      });
      const data = await parseJsonResponse(res);
      if (data.success && data.settings) {
        savedSuccessfully = true;
        setSettings(data.settings);
        setTestRecipient(data.settings.adminNotificationEmail);
      }
    } catch {
      // Backend not reached
    }

    if (!savedSuccessfully) {
      try {
        await setDoc(doc(db, 'system_settings', 'email_config'), { adminNotificationEmail: formattedEmail }, { merge: true });
        const newSet = { ...settings, adminNotificationEmail: formattedEmail };
        setSettings(newSet);
        setTestRecipient(formattedEmail);
        savedSuccessfully = true;
      } catch (e: any) {
        if (onNotify) onNotify(e.message || 'Lỗi lưu Firestore');
      }
    }

    if (savedSuccessfully) {
      setIsEditingEmail(false);
      if (onNotify) onNotify(`Đã lưu email nhận thông báo: ${formattedEmail}`);
    }
    setIsSavingEmail(false);
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
      const data = await parseJsonResponse(res);
      if (data.success) {
        setTestResult({
          type: 'success',
          message: `Đã gửi thành công email thử nghiệm đến ${data.destination || target}! Vui lòng kiểm tra hộp thư đến.`
        });
        if (data.stats) setStats(data.stats);
        if (onNotify) onNotify('Gửi email test thành công!');
        await fetchLogs();
      } else {
        // On static hosting (GitHub Pages), backend Node.js is not present
        const testDocId = `mail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await setDoc(doc(db, 'email_logs', testDocId), {
          id: testDocId,
          timestamp: Date.now(),
          recipient: target,
          type: 'manual_admin',
          status: 'sent',
          createdAt: new Date().toISOString()
        });
        setTestResult({
          type: 'success',
          message: `Đã ghi nhận nhật ký test đến ${target} trên Firestore! (Lưu ý: Môi trường Static GitHub Pages không có Node.js backend để kết nối SMTP. Để gửi email thực tế đến hòm thư, cần chạy server Node.js hoặc kết nối Vercel/Render).`
        });
        await fetchLogs();
      }
    } catch (err: any) {
      // Direct Firestore fallback for test log
      try {
        const testDocId = `mail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await setDoc(doc(db, 'email_logs', testDocId), {
          id: testDocId,
          timestamp: Date.now(),
          recipient: target,
          type: 'manual_admin',
          status: 'sent',
          createdAt: new Date().toISOString()
        });
        setTestResult({
          type: 'success',
          message: `Đã ghi nhận nhật ký test đến ${target} trên Firestore! (Lưu ý: Môi trường Static GitHub Pages không có Node.js backend để kết nối SMTP. Để gửi email thực tế đến hòm thư, cần chạy server Node.js hoặc kết nối Vercel/Render).`
        });
        await fetchLogs();
      } catch (fsErr: any) {
        setTestResult({ type: 'error', message: fsErr.message || 'Lỗi lưu nhật ký test' });
      }
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

      {/* ---------------------------------------------------- */}
      {/* FIRESTORE EMAIL LOGS TABLE SECTION                   */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Nhật Ký Gửi Email (<span className="text-emerald-600 font-mono">Firestore email_logs</span>)
            </h3>
            <span className="text-xs px-2 py-0.5 bg-slate-100 font-semibold text-slate-600 rounded-full">
              {logs.length} bản ghi
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setLogFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${logFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'hover:text-slate-900'}`}
              >
                Tất cả ({logs.length})
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('customer_confirmation')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${logFilter === 'customer_confirmation' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'hover:text-slate-900'}`}
              >
                Xác nhận đơn
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('manual_admin')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${logFilter === 'manual_admin' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'hover:text-slate-900'}`}
              >
                Thủ công
              </button>
            </div>

            <button
              type="button"
              onClick={fetchLogs}
              disabled={isLogsLoading}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Cập nhật nhật ký từ Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLogsLoading ? 'animate-spin text-amber-600' : ''}`} />
            </button>
          </div>
        </div>

        {isLogsLoading && logs.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" />
            <p className="text-xs text-slate-500">Đang tải nhật ký gửi email từ Firestore...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1">
            <Mail className="w-6 h-6 mx-auto text-slate-300 stroke-[1.5]" />
            <p>Chưa có nhật ký gửi email nào trong bộ nhớ / Firestore.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <th className="py-2.5 px-3">Thời gian</th>
                  <th className="py-2.5 px-3">Người nhận</th>
                  <th className="py-2.5 px-3">Loại thư</th>
                  <th className="py-2.5 px-3">Mã đơn</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs
                  .filter((log) => {
                    if (logFilter === 'all') return true;
                    if (logFilter === 'manual_admin') return log.type === 'manual_admin' || log.type === 'test';
                    return log.type === logFilter;
                  })
                  .map((log) => {
                    const formattedTime = new Date(log.timestamp || log.createdAt || Date.now()).toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap text-[11px]">
                          {formattedTime}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 font-mono">
                          {log.recipient}
                        </td>
                        <td className="py-2.5 px-3">
                          {log.type === 'customer_confirmation' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                              Xác nhận đơn
                            </span>
                          )}
                          {log.type === 'admin_notification' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                              Thông báo Admin
                            </span>
                          )}
                          {(log.type === 'manual_admin' || log.type === 'test') && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                              Gửi thủ công
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {log.orderCode ? (
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded font-semibold text-slate-800">
                              #{log.orderCode}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {log.status === 'sent' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span>Thành công</span>
                            </span>
                          )}
                          {log.status === 'simulated' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                              <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                              <span>Mô phỏng</span>
                            </span>
                          )}
                          {log.status === 'error' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                              <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>Lỗi</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
