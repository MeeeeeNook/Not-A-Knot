import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, Send, Edit3, Save, X, RefreshCw, Sparkles, ShieldCheck, KeyRound } from 'lucide-react';
import { ensureGmailDomain, testEmailDelivery } from '../utils/emailService';

export const AdminEmailNotificationCard: React.FC = () => {
  const [status, setStatus] = useState<{
    configured: boolean;
    configuredUser: string;
    maskedPass?: string;
    adminNotificationEmail: string;
    mode: string;
  } | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isEditingPass, setIsEditingPass] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [isSavingPass, setIsSavingPass] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const parseJsonResponse = async (res: Response) => {
    try {
      const text = await res.text();
      const trimmed = text ? text.trim() : '';
      if (!trimmed || trimmed.startsWith('<') || trimmed.startsWith('The page') || trimmed.startsWith('<!DOCTYPE')) {
        return {
          success: false,
          error: `Máy chủ phản hồi không đúng định dạng (${res.status})`
        };
      }
      return JSON.parse(trimmed);
    } catch {
      return {
        success: false,
        error: `Máy chủ phản hồi không đúng định dạng (${res.status})`,
        message: `Máy chủ phản hồi không đúng định dạng (${res.status})`
      };
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/email/status');
      if (res.ok) {
        const data = await parseJsonResponse(res);
        if (data && data.configured !== undefined) {
          setStatus(data);
          setNewEmail(data.adminNotificationEmail || '');
        }
      }
    } catch (err) {
      console.error('Failed to load email status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveEmail = async () => {
    const formattedEmail = ensureGmailDomain(newEmail);
    if (!formattedEmail) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
      return;
    }
    setNewEmail(formattedEmail);
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/email/update-admin-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: formattedEmail })
      });
      const data = await parseJsonResponse(res);
      if (data.success) {
        setStatus((prev) => prev ? { ...prev, adminNotificationEmail: data.adminNotificationEmail } : null);
        setIsEditing(false);
        setFeedback({ type: 'success', message: `Đã đổi email nhận thông báo sang: ${data.adminNotificationEmail}` });
      } else {
        setFeedback({ type: 'error', message: data.error || data.message || 'Không thể cập nhật email' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi mạng' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAppPass = async () => {
    if (!newPass.trim()) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập Mật khẩu ứng dụng Google (16 ký tự).' });
      return;
    }
    setIsSavingPass(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/email/update-smtp-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtpPass: newPass })
      });
      const data = await parseJsonResponse(res);
      if (data.success) {
        setStatus((prev) => prev ? { ...prev, configured: true, maskedPass: data.maskedPass, mode: 'live_smtp' } : null);
        setIsEditingPass(false);
        setNewPass('');
        setFeedback({ type: 'success', message: data.message || 'Đã cập nhật Mật khẩu ứng dụng Google thành công!' });
      } else {
        setFeedback({ type: 'error', message: data.error || data.message || 'Không thể cập nhật Mật khẩu ứng dụng.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi mạng' });
    } finally {
      setIsSavingPass(false);
    }
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    setFeedback(null);
    try {
      const res = await testEmailDelivery(status?.adminNotificationEmail);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || `Đã gửi email kiểm tra thành công tới ${status?.adminNotificationEmail}!`
        });
      } else {
        setFeedback({ type: 'error', message: res.message || 'Gửi email thử nghiệm không thành công.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi kết nối máy chủ' });
    } finally {
      setIsTesting(false);
    }
  };

  if (!status) return null;

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-700">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Hệ Thống Email Thông Báo Đơn Hàng</h3>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                status.configured
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                <CheckCircle2 className="w-3 h-3" />
                {status.configured ? 'Đang Hoạt Động (Google SMTP Live)' : 'Chế độ Xem Trước (Chưa nhập App Pass)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tài khoản gửi: <strong className="text-slate-700">noreply.notaknot@gmail.com</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSendTest}
          disabled={isTesting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          {isTesting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
              <span>Đang gửi thử...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5 text-amber-600" />
              <span>Gửi Email Test Ngay</span>
            </>
          )}
        </button>
      </div>

      {/* Admin Notification Email Row & Change Form */}
      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Email Quản Trị Nhận Thông Báo Đơn Mới:
          </span>
          {!isEditing ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-900">
                {status.adminNotificationEmail}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(true);
                  setNewEmail(status.adminNotificationEmail);
                  setFeedback(null);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md cursor-pointer transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                <span>Đổi email này</span>
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
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3 h-3" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setNewEmail(status.adminNotificationEmail);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Hủy</span>
              </button>
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 max-w-sm">
          Mỗi khi khách đặt đơn, hệ thống sẽ tự động gửi email chi tiết đơn hàng tới địa chỉ này. Bạn có thể đổi sang bất kỳ hòm thư nào bất kỳ lúc nào.
        </div>
      </div>

      {/* Google App Password (Mật khẩu ứng dụng) Management Row */}
      <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
            <KeyRound className="w-3.5 h-3.5 text-amber-700" />
            <span>Mật khẩu ứng dụng Google (Google App Password):</span>
          </div>
          {!isEditingPass ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-800 bg-white px-2.5 py-1 rounded-md border border-amber-200">
                {status.maskedPass || '••••••••••••••••'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsEditingPass(true);
                  setNewPass('');
                  setFeedback(null);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-800 hover:text-amber-900 bg-white hover:bg-amber-100/80 border border-amber-300 rounded-md cursor-pointer transition-colors shadow-2xs"
              >
                <Edit3 className="w-3 h-3" />
                <span>Cập nhật App Code mới</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                type="text"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Dán 16 ký tự mật khẩu ứng dụng..."
                className="px-3 py-1.5 bg-white border border-amber-400 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[280px]"
              />
              <button
                type="button"
                onClick={handleSaveAppPass}
                disabled={isSavingPass}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3 h-3" />
                <span>{isSavingPass ? 'Đang kiểm tra...' : 'Lưu & Kết Nối'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingPass(false);
                  setNewPass('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Hủy</span>
              </button>
            </div>
          )}
        </div>

        <div className="text-[11px] text-amber-900/80 max-w-sm leading-relaxed">
          Mật khẩu ứng dụng là chuỗi 16 ký tự do Google tạo ra tại <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline font-bold text-amber-950">myaccount.google.com/apppasswords</a>. Nếu Google báo lỗi authentication, bạn có thể tạo mã mới và dán vào đây.
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
