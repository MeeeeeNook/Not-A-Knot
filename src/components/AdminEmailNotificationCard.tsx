import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, Send, Edit3, Save, X, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';
import { ensureGmailDomain } from '../utils/emailService';

export const AdminEmailNotificationCard: React.FC = () => {
  const [status, setStatus] = useState<{
    configured: boolean;
    configuredUser: string;
    adminNotificationEmail: string;
    mode: string;
  } | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/email/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setNewEmail(data.adminNotificationEmail || '');
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
      const data = await res.json();
      if (data.success) {
        setStatus((prev) => prev ? { ...prev, adminNotificationEmail: data.adminNotificationEmail } : null);
        setIsEditing(false);
        setFeedback({ type: 'success', message: `Đã đổi email nhận thông báo sang: ${data.adminNotificationEmail}` });
      } else {
        setFeedback({ type: 'error', message: data.error || 'Không thể cập nhật email' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi mạng' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/email/test-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: status?.adminNotificationEmail })
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: `Đã gửi email kiểm tra thành công tới ${data.destination}! Vui lòng mở hộp thư kiểm tra.`
        });
      } else {
        setFeedback({ type: 'error', message: data.message || 'Gửi email thử nghiệm không thành công.' });
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
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Đang Hoạt Động (Google SMTP Live)
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
