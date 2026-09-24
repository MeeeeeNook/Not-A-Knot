import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench,
  Power,
  Upload,
  Link,
  ExternalLink,
  Eye,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Clock,
  Sparkles,
  Smartphone,
  Monitor,
  Phone,
  MessageSquare
} from 'lucide-react';
import { MaintenanceConfig } from '../../types';
import {
  compressImageFileToBase64,
  generateStandaloneMaintenanceHtml,
  DEFAULT_MAINTENANCE_CONFIG
} from '../../utils/maintenanceManager';
import { MaintenanceScreen } from '../MaintenanceScreen';
import { TurnOffMaintenanceConfirmModal } from './TurnOffMaintenanceConfirmModal';

interface AdminMaintenanceTabProps {
  maintenanceConfig: MaintenanceConfig;
  onSave: (config: MaintenanceConfig) => Promise<boolean | void>;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  brandName?: string;
  logoUrl?: string;
  adminName?: string;
}

export const AdminMaintenanceTab: React.FC<AdminMaintenanceTabProps> = ({
  maintenanceConfig,
  onSave,
  onNotify,
  brandName = 'NOT A KNOT',
  logoUrl,
  adminName = 'Quản trị viên'
}) => {
  const [formConfig, setFormConfig] = useState<MaintenanceConfig>(() => ({
    ...DEFAULT_MAINTENANCE_CONFIG,
    ...maintenanceConfig
  }));

  // Keep formConfig synchronized when maintenanceConfig updates from outside / Firestore
  useEffect(() => {
    if (maintenanceConfig) {
      setFormConfig((prev) => ({
        ...prev,
        ...maintenanceConfig
      }));
    }
  }, [maintenanceConfig]);

  const [isSaving, setIsSaving] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isTurnOffConfirmOpen, setIsTurnOffConfirmOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleEnabled = async () => {
    if (isSaving) return;

    // If maintenance is currently ON, require confirmation screen before turning OFF
    if (formConfig.enabled) {
      setIsTurnOffConfirmOpen(true);
      return;
    }

    // Turning ON
    const nextConfig: MaintenanceConfig = {
      ...formConfig,
      enabled: true
    };

    setFormConfig(nextConfig);

    try {
      setIsSaving(true);
      await onSave(nextConfig);
      onNotify?.('Đã BẬT chế độ bảo trì! (Khách hàng sẽ thấy màn hình bảo trì)', 'success');
    } catch (err: any) {
      console.error('Lỗi khi bật bảo trì:', err);
      setFormConfig(formConfig);
      onNotify?.('Lỗi khi lưu trạng thái bảo trì lên hệ thống', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmTurnOffMaintenance = async () => {
    const nextConfig: MaintenanceConfig = {
      ...formConfig,
      enabled: false
    };

    setFormConfig(nextConfig);

    try {
      setIsSaving(true);
      await onSave(nextConfig);
      onNotify?.('Đã TẮT chế độ bảo trì thành công! (Website đã mở lại bình thường)', 'success');
      setIsTurnOffConfirmOpen(false);
    } catch (err: any) {
      console.error('Lỗi khi tắt bảo trì:', err);
      setFormConfig(formConfig);
      onNotify?.('Lỗi khi lưu trạng thái bảo trì lên hệ thống', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh (PNG, JPG, WEBP)!');
      return;
    }

    try {
      setIsUploadingImage(true);
      const base64 = await compressImageFileToBase64(file, 1200, 900, 0.82);
      setFormConfig((prev) => ({
        ...prev,
        showImage: true,
        imageBase64: base64
      }));
      onNotify?.('Đã nén ảnh sang Base64 thành công (Không cần Firebase Storage)!', 'success');
    } catch (err: any) {
      console.error('Lỗi nén ảnh base64:', err);
      onNotify?.(err?.message || 'Không thể xử lý ảnh tải lên', 'error');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setFormConfig((prev) => ({
      ...prev,
      showImage: false,
      imageBase64: ''
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(formConfig);
      onNotify?.('Đã lưu cấu hình chế độ bảo trì thành công!', 'success');
    } catch (err: any) {
      console.error('Lỗi lưu cấu hình bảo trì:', err);
      onNotify?.('Lỗi khi lưu cấu hình bảo trì', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadStandaloneHtml = () => {
    try {
      const htmlContent = generateStandaloneMaintenanceHtml(formConfig);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `maintenance-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify?.('Đã tải xuống file HTML độc lập (Standalone)', 'success');
    } catch (err: any) {
      console.error('Lỗi xuất file HTML độc lập:', err);
      onNotify?.('Không thể tạo file HTML độc lập', 'error');
    }
  };

  const calculateBase64SizeKb = (base64Str?: string) => {
    if (!base64Str) return 0;
    return Math.round((base64Str.length * 0.75) / 1024);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              formConfig.enabled
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900">Chế độ bảo trì (Maintenance mode)</h1>
              <button
                type="button"
                onClick={handleToggleEnabled}
                disabled={isSaving}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                  formConfig.enabled
                    ? 'bg-rose-500 text-white shadow-xs hover:bg-rose-600'
                    : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                }`}
                title="Bấm để Bật/Tắt chế độ bảo trì"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    formConfig.enabled ? 'bg-white animate-pulse' : 'bg-slate-400'
                  }`}
                />
                <span>{formConfig.enabled ? 'Đang bật (Khách bị chặn)' : 'Đang tắt (Web mở)'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kiểm soát trạng thái hiển thị của website khi cần nâng cấp, sửa chữa hoặc bảo trì khẩn cấp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPreviewModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
          >
            <Eye className="w-4 h-4 text-slate-500" />
            <span>Xem trước (Preview)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadStandaloneHtml}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
            title="Tải về file HTML độc lập có thể lưu hoặc mở offline"
          >
            <FileCode className="w-4 h-4 text-amber-600" />
            <span>Tải file HTML khẩn cấp</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{isSaving ? 'Đang lưu...' : 'Lưu cài đặt'}</span>
          </button>
        </div>
      </div>

      {/* Main Switch Alert Banner */}
      <div
        className={`rounded-3xl p-5 border transition-all ${
          formConfig.enabled
            ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-sm'
            : 'bg-emerald-50 border-emerald-300 text-emerald-950'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                formConfig.enabled ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              <Power className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base">
                {formConfig.enabled
                  ? 'Chế độ bảo trì ĐANG BẬT: Khách hàng KHÔNG THỂ truy cập website!'
                  : 'Chế độ bảo trì ĐANG TẮT: Website đang mở và hoạt động bình thường.'}
              </h2>
              <p className="text-xs opacity-80 mt-0.5">
                {formConfig.enabled
                  ? 'Tất cả khách truy cập sẽ được chuyển đến màn hình thông báo bảo trì. Quản trị viên vẫn có thể đăng nhập bằng tài khoản Admin.'
                  : 'Khách hàng truy cập bình thường, có thể xem sản phẩm và đặt hàng.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* iOS-style toggle slider */}
            <button
              type="button"
              onClick={handleToggleEnabled}
              disabled={isSaving}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                formConfig.enabled ? 'bg-rose-600' : 'bg-slate-300'
              } ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
              title={formConfig.enabled ? 'Gạt để tắt bảo trì' : 'Gạt để bật bảo trì'}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  formConfig.enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>

            {/* Action button */}
            <button
              type="button"
              onClick={handleToggleEnabled}
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 shrink-0 ${
                formConfig.enabled
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              } ${isSaving ? 'opacity-60 cursor-wait' : ''}`}
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              <span>
                {isSaving
                  ? 'Đang cập nhật...'
                  : formConfig.enabled
                  ? 'TẮT BẢO TRÌ NGAY'
                  : 'BẬT CHẾ ĐỘ BẢO TRÌ'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Settings Form & Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Configuration (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Content Information */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Nội Dung Hiển Thị Trên Màn Hình Bảo Trì
              </h2>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tiêu đề thông báo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formConfig.title}
                onChange={(e) => setFormConfig({ ...formConfig, title: e.target.value })}
                placeholder="Ví dụ: Hệ Thống Đang Được Nâng Cấp & Bảo Trì"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[11px] text-slate-400">Gợi ý nhanh:</span>
                {[
                  'Website Đang Tạm Đóng Để Bảo Trì',
                  'We are under maintenance',
                  'Bảo Trì Hệ Thống Định Kỳ'
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFormConfig({ ...formConfig, title: preset })}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-600 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nội dung chi tiết (Message) <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={formConfig.message}
                onChange={(e) => setFormConfig({ ...formConfig, message: e.target.value })}
                placeholder="Nhập thông điệp gửi đến khách hàng..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-y"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Có thể gõ xuống dòng để chia đoạn. Khách hàng sẽ đọc được chính xác nội dung này.
              </p>
            </div>

            {/* Estimated Completion Time */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Thời gian dự kiến mở lại (Không bắt buộc)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formConfig.estimatedEndTime || ''}
                  onChange={(e) => setFormConfig({ ...formConfig, estimatedEndTime: e.target.value })}
                  placeholder="Ví dụ: 15:30 hôm nay, hoặc Khoảng 30 phút nữa"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Action Button & Clickable Link */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                  Nút Chuyển Hướng Sang Trang Khác
                </h2>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formConfig.showButton}
                  onChange={(e) => setFormConfig({ ...formConfig, showButton: e.target.checked })}
                  className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700">Bật nút chuyển hướng</span>
              </label>
            </div>

            {formConfig.showButton && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tên hiển thị trên nút
                  </label>
                  <input
                    type="text"
                    value={formConfig.buttonText}
                    onChange={(e) => setFormConfig({ ...formConfig, buttonText: e.target.value })}
                    placeholder="Ghé Thăm Fanpage Facebook"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Đường dẫn liên kết (URL)
                  </label>
                  <input
                    type="url"
                    value={formConfig.buttonUrl}
                    onChange={(e) => setFormConfig({ ...formConfig, buttonUrl: e.target.value })}
                    placeholder="https://facebook.com/..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Clickable Image (Base64 - 100% Zero Firebase Storage) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-500" />
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    Ảnh Thông Báo Có Thể Bấm Vào (Base64)
                  </h2>
                  <span className="text-[11px] text-emerald-600 font-bold">
                    ✓ Lưu trực tiếp dạng Base64 - Hoàn toàn không phụ thuộc Firebase Storage
                  </span>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formConfig.showImage}
                  onChange={(e) => setFormConfig({ ...formConfig, showImage: e.target.checked })}
                  className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700">Hiện ảnh</span>
              </label>
            </div>

            {formConfig.showImage && (
              <div className="space-y-4">
                {/* Upload or Dropzone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tải ảnh từ máy tính (Tự động nén thành Base64 siêu nhẹ)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="maintenance-image-upload"
                    />
                    <label
                      htmlFor="maintenance-image-upload"
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{isUploadingImage ? 'Đang nén ảnh...' : 'Chọn ảnh tải lên'}</span>
                    </label>

                    {formConfig.imageBase64 && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="px-3 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Xóa ảnh</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Direct Image URL input (alternative) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Hoặc nhập URL ảnh trực tiếp (nếu có sẵn link bên ngoài)
                  </label>
                  <input
                    type="text"
                    value={formConfig.imageBase64?.startsWith('data:') ? '' : formConfig.imageBase64 || ''}
                    onChange={(e) => setFormConfig({ ...formConfig, imageBase64: e.target.value })}
                    placeholder="https://example.com/banner-maintenance.jpg"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 font-mono"
                  />
                </div>

                {/* Target URL when user clicks image */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Đường dẫn khi khách bấm vào ảnh (Clickable Target URL)
                  </label>
                  <div className="relative">
                    <ExternalLink className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="url"
                      value={formConfig.imageUrlTarget || ''}
                      onChange={(e) => setFormConfig({ ...formConfig, imageUrlTarget: e.target.value })}
                      placeholder="https://facebook.com/..., Shopee, hoặc trang web phụ của bạn"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Khi khách click chuột hoặc chạm vào ảnh, trình duyệt sẽ tự động mở trang web này.
                  </p>
                </div>

                {/* Image Preview Box */}
                {formConfig.imageBase64 && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
                      <span>Xem trước ảnh thông báo:</span>
                      <span className="font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Dung lượng: ~{calculateBase64SizeKb(formConfig.imageBase64)} KB
                      </span>
                    </div>
                    <div className="max-h-56 overflow-hidden rounded-xl border border-slate-200 bg-black/5 flex items-center justify-center">
                      <img
                        src={formConfig.imageBase64}
                        alt="Preview"
                        className="max-h-56 w-auto object-contain rounded-xl"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 4: Auto Redirect & Emergency Contacts */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <RefreshCw className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Tự Động Chuyển Hướng & Liên Hệ Khẩn Cấp
              </h2>
            </div>

            {/* Auto Redirect Settings */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(formConfig.autoRedirect)}
                  onChange={(e) => setFormConfig({ ...formConfig, autoRedirect: e.target.checked })}
                  className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  Tự động chuyển hướng khách sau vài giây (Auto-Redirect)
                </span>
              </label>

              {formConfig.autoRedirect && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Đếm ngược (giây)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={formConfig.autoRedirectSeconds || 5}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, autoRedirectSeconds: Number(e.target.value) || 5 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Link tự động chuyển hướng đến
                    </label>
                    <input
                      type="url"
                      value={formConfig.autoRedirectUrl || ''}
                      onChange={(e) => setFormConfig({ ...formConfig, autoRedirectUrl: e.target.value })}
                      placeholder="https://facebook.com/..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Emergency Hotline & Zalo */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-amber-600" />
                  <span>Số Hotline hiển thị khi bảo trì</span>
                </label>
                <input
                  type="text"
                  value={formConfig.emergencyContactPhone || ''}
                  onChange={(e) => setFormConfig({ ...formConfig, emergencyContactPhone: e.target.value })}
                  placeholder="0342 938 174"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                  <span>Số Zalo tư vấn</span>
                </label>
                <input
                  type="text"
                  value={formConfig.emergencyContactZalo || ''}
                  onChange={(e) => setFormConfig({ ...formConfig, emergencyContactZalo: e.target.value })}
                  placeholder="0342938174"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Mini Live Preview & Resilience Advice (1 Col) */}
        <div className="space-y-6">
          {/* Advice Card: Explaining the Storage Independence */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-3xl p-6 border border-amber-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Cơ chế bảo vệ & Chống lỗi 100%</span>
            </div>
            <div className="text-xs text-amber-950/80 leading-relaxed space-y-2">
              <p>
                <strong>1. Hoàn toàn không dùng Firebase Storage:</strong> Mọi hình ảnh bạn tải lên ở đây được chuyển đổi trực tiếp thành mã Base64 nhúng trong JSON, vì vậy dù Firebase Storage có bị gián đoạn hay lỗi quy tắc thì màn hình bảo trì này vẫn hoạt động trơn tru.
              </p>
              <p>
                <strong>2. Bộ nhớ đệm LocalStorage tức thời:</strong> Cấu hình được sao lưu ngay vào bộ nhớ trình duyệt, mở ra là thấy ngay không độ trễ.
              </p>
              <p>
                <strong>3. Không sợ bị khóa ngoài:</strong> Trên màn hình bảo trì có sẵn nút "Quản trị viên đăng nhập" ở góc dưới, giúp bạn luôn có thể đăng nhập lại để mở website bất cứ lúc nào.
              </p>
            </div>
          </div>

          {/* Mini Interactive Preview Frame */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Xem Trước Thực Tế
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1 rounded cursor-pointer ${
                    previewDevice === 'desktop' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-400'
                  }`}
                  title="Giao diện máy tính"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1 rounded cursor-pointer ${
                    previewDevice === 'mobile' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-400'
                  }`}
                  title="Giao diện điện thoại"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Preview Container */}
            <div
              className={`mx-auto border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-[#FAF9F6] transition-all ${
                previewDevice === 'mobile' ? 'max-w-[320px]' : 'w-full'
              }`}
            >
              <div className="scale-90 origin-top">
                <MaintenanceScreen
                  config={formConfig}
                  brandName={brandName}
                  logoUrl={logoUrl}
                  onOpenAdminLogin={() => alert('Mở popup đăng nhập Admin')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-between overflow-y-auto">
          <div className="p-4 flex items-center justify-between bg-stone-900/90 border-b border-stone-800 text-white">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-sm">Chế độ xem trước toàn màn hình</span>
            </div>
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(false)}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs cursor-pointer shadow-md"
            >
              Đóng xem trước
            </button>
          </div>

          <div className="flex-1">
            <MaintenanceScreen
              config={formConfig}
              brandName={brandName}
              logoUrl={logoUrl}
              onOpenAdminLogin={() => {
                setIsPreviewModalOpen(false);
                onNotify?.('Đây là nút đăng nhập dành cho quản trị viên', 'info');
              }}
            />
          </div>
        </div>
      )}

      {/* Confirmation Screen when turning off Maintenance Mode */}
      <TurnOffMaintenanceConfirmModal
        isOpen={isTurnOffConfirmOpen}
        onClose={() => setIsTurnOffConfirmOpen(false)}
        onConfirm={handleConfirmTurnOffMaintenance}
        adminName={adminName}
        brandName={brandName}
      />
    </div>
  );
};
