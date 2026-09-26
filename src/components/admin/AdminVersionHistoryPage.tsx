import React, { useState, useEffect } from 'react';
import { Product, CategoryItem, CollectionInfo, SiteContentConfig, VersionBackup, BackupScheduleConfig } from '../../types';
import { 
  fetchBackupsFromFirestore, 
  saveBackupToFirestore, 
  deleteBackupFromFirestore,
  fetchBackupScheduleFromFirestore,
  saveBackupScheduleToFirestore,
  saveProductsToFirestore,
  saveCategoriesToFirestore,
  saveCollectionsToFirestore,
  pushAndSyncCategoriesToFirestore,
  pushAndSyncCollectionsToFirestore,
  saveSiteContentToFirestore,
  syncLocalBackupsToFirestore
} from '../../firebase';
import { 
  History, 
  Plus, 
  RefreshCw, 
  RotateCcw, 
  Trash2, 
  Download, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  Layers, 
  Package, 
  FolderTree, 
  Layout, 
  Settings, 
  Check,
  Calendar,
  Cloud,
  CloudUpload
} from 'lucide-react';
import { checkAndRunAutoBackup } from '../../utils/autoBackup';

interface AdminVersionHistoryPageProps {
  products: Product[];
  categories: CategoryItem[];
  collections: CollectionInfo[];
  siteContent?: SiteContentConfig;
  onUpdateProducts: (newProducts: Product[]) => void;
  onUpdateCategories: (newCategories: CategoryItem[]) => void;
  onUpdateCollections: (newCollections: CollectionInfo[]) => void;
  onUpdateSiteContent: (newConfig: SiteContentConfig) => void;
  onNotify?: (msg: string) => void;
  onToast?: (msg: string) => void;
  currentSellerName?: string;
}

export const AdminVersionHistoryPage: React.FC<AdminVersionHistoryPageProps> = ({
  products,
  categories,
  collections,
  siteContent,
  onUpdateProducts,
  onUpdateCategories,
  onUpdateCollections,
  onUpdateSiteContent,
  onNotify,
  onToast,
  currentSellerName
}) => {
  const notify = (msg: string) => {
    if (typeof onNotify === 'function') {
      onNotify(msg);
    } else if (typeof onToast === 'function') {
      onToast(msg);
    }
  };
  const [backups, setBackups] = useState<VersionBackup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupNote, setBackupNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Auto-backup schedule state
  const [schedule, setSchedule] = useState<BackupScheduleConfig>({
    enabled: true,
    intervalHours: 6,
    lastBackupAt: undefined
  });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Restore Modal State
  const [restoreCandidate, setRestoreCandidate] = useState<VersionBackup | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Delete Modal State
  const [deleteCandidate, setDeleteCandidate] = useState<VersionBackup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load backups and schedule on mount
  const loadBackupsAndSchedule = async () => {
    setIsLoading(true);
    try {
      const [fetchedBackups, fetchedSchedule] = await Promise.all([
        fetchBackupsFromFirestore(),
        fetchBackupScheduleFromFirestore()
      ]);
      setBackups(fetchedBackups);
      if (fetchedSchedule) {
        setSchedule({
          ...fetchedSchedule,
          lastBackupAt: fetchedSchedule.lastBackupAt || (fetchedBackups.length > 0 ? fetchedBackups[0].createdAt : undefined)
        });
      } else if (fetchedBackups.length > 0) {
        setSchedule((prev) => ({
          ...prev,
          lastBackupAt: fetchedBackups[0].createdAt
        }));
      }
    } catch (err) {
      console.error('Lỗi nạp dữ liệu backup:', err);
      notify('Lỗi tải danh sách bản sao lưu từ Cloud.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBackupsAndSchedule();
  }, []);

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Manual trigger to force sync any local-only backups to Firebase Cloud
  const handleSyncLocalBackups = async () => {
    setIsSyncingCloud(true);
    try {
      const res = await syncLocalBackupsToFirestore();
      if (res.syncedCount > 0) {
        notify(`Đã đồng bộ ${res.syncedCount} bản sao lưu lên Firebase Cloud thành công!`);
        await loadBackupsAndSchedule();
      } else if (res.errors > 0) {
        notify('Không thể đồng bộ một số bản sao lưu lên Firebase do vượt giới hạn dung lượng.');
      } else {
        notify('Tất cả các bản sao lưu đã được lưu trữ đồng bộ trên Firebase Cloud!');
      }
    } catch (e) {
      console.error('Lỗi đồng bộ lên cloud:', e);
      notify('Lỗi đồng bộ bản sao lưu lên Firebase.');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Format date helper
  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const secs = String(d.getSeconds()).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${hours}:${mins}:${secs} - ${day}/${month}/${year}`;
    } catch {
      return isoString;
    }
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      if (diffSecs < 60) return 'Vừa xong';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} ngày trước`;
    } catch {
      return '';
    }
  };

  // Perform a backup (manual or auto)
  const performBackup = async (type: 'manual' | 'auto', noteText?: string) => {
    setIsCreatingBackup(true);
    try {
      const now = new Date();
      const newBackup: VersionBackup = {
        id: `backup_${now.getTime()}`,
        createdAt: now.toISOString(),
        formattedDate: formatDateTime(now.toISOString()),
        createdByName: currentSellerName || (type === 'manual' ? 'Quản trị viên' : 'Hệ thống tự động'),
        backupType: type,
        note: noteText || (type === 'manual' ? 'Sao lưu thủ công' : 'Sao lưu định kỳ tự động'),
        summary: {
          productsCount: products.length,
          categoriesCount: categories.length,
          collectionsCount: collections.length,
          hasSiteContent: !!siteContent
        },
        data: {
          products,
          categories,
          collections,
          siteContent
        }
      };

      // saveBackupToFirestore automatically deletes oldest backups to keep max 5!
      const updatedBackups = await saveBackupToFirestore(newBackup);
      setBackups(updatedBackups);

      // Update schedule lastBackupAt
      const updatedSchedule: BackupScheduleConfig = {
        ...schedule,
        lastBackupAt: now.toISOString()
      };
      setSchedule(updatedSchedule);
      await saveBackupScheduleToFirestore(updatedSchedule);

      notify(
        type === 'manual'
          ? 'Đã tạo bản sao lưu mới thành công trên Firebase (Tối đa 10 bản)!'
          : 'Hệ thống đã tự động sao lưu dữ liệu lên Firebase!'
      );
      setBackupNote('');
      setShowNoteInput(false);
    } catch (err) {
      console.error('Lỗi thực hiện sao lưu:', err);
      notify('Lỗi lưu bản sao lưu lên Firebase. Vui lòng thử lại!');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Check auto-backup schedule automatically
  useEffect(() => {
    checkAndRunAutoBackup().then((didBackup) => {
      if (didBackup) {
        loadBackupsAndSchedule();
      }
    });
  }, []);

  // Handle Save Schedule Settings
  const handleSaveSchedule = async (newSchedule: BackupScheduleConfig) => {
    setIsSavingSchedule(true);
    try {
      const scheduleToSave: BackupScheduleConfig = {
        ...newSchedule,
        lastBackupAt: newSchedule.lastBackupAt || schedule.lastBackupAt || (backups.length > 0 ? backups[0].createdAt : undefined)
      };
      setSchedule(scheduleToSave);
      await saveBackupScheduleToFirestore(scheduleToSave);
      notify('Đã cập nhật cấu hình sao lưu tự động thành công!');
    } catch (err) {
      console.error('Lỗi cập nhật lịch sao lưu:', err);
      notify('Lỗi lưu cấu hình sao lưu tự động.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Handle Delete Backup
  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      await deleteBackupFromFirestore(deleteCandidate.id);
      setBackups((prev) => prev.filter((b) => b.id !== deleteCandidate.id));
      notify('Đã xóa bản sao lưu thành công.');
      setDeleteCandidate(null);
    } catch (err) {
      console.error('Lỗi xóa bản sao lưu:', err);
      notify('Lỗi xóa bản sao lưu từ Cloud.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Restore Backup
  const confirmRestore = async () => {
    if (!restoreCandidate) return;
    setIsRestoring(true);
    try {
      const { data } = restoreCandidate;

      // 1. Restore Products
      if (data.products && Array.isArray(data.products)) {
        onUpdateProducts(data.products);
        await saveProductsToFirestore(data.products);
      }

      // 2. Restore Categories
      if (data.categories && Array.isArray(data.categories)) {
        onUpdateCategories(data.categories);
        await pushAndSyncCategoriesToFirestore(data.categories);
      }

      // 3. Restore Collections
      if (data.collections && Array.isArray(data.collections)) {
        onUpdateCollections(data.collections);
        await pushAndSyncCollectionsToFirestore(data.collections);
      }

      // 4. Restore Site Content
      if (data.siteContent) {
        onUpdateSiteContent(data.siteContent);
        await saveSiteContentToFirestore(data.siteContent);
      }

      notify(`Khôi phục thành công hệ thống về phiên bản lúc ${restoreCandidate.formattedDate}!`);
      setRestoreCandidate(null);
    } catch (err) {
      console.error('Lỗi khôi phục sao lưu:', err);
      notify('Lỗi khôi phục dữ liệu từ bản sao lưu.');
    } finally {
      setIsRestoring(false);
    }
  };

  // Download single backup JSON
  const handleDownloadBackup = (backup: VersionBackup) => {
    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NOT_A_KNOT_Backup_${backup.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('Đã tải file sao lưu về máy tính.');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
            <History className="w-5 h-5 text-indigo-600" />
            <span>Lịch Sử Phiên Bản & Sao Lưu (Version History)</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lưu trữ các điểm khôi phục toàn vẹn dữ liệu (Sản phẩm, Danh mục, Banner, Giao diện) trên Firebase Cloud.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {backups.some((b) => b.syncedToCloud === false) && (
            <button
              onClick={handleSyncLocalBackups}
              disabled={isSyncingCloud}
              className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Đồng bộ các bản sao lưu cục bộ lên Firebase Cloud"
            >
              <CloudUpload className={`w-4 h-4 ${isSyncingCloud ? 'animate-bounce' : ''}`} />
              <span>{isSyncingCloud ? 'Đang đồng bộ...' : 'Đồng bộ Cloud'}</span>
            </button>
          )}

          <button
            onClick={() => loadBackupsAndSchedule()}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Làm mới danh sách từ Cloud"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowNoteInput((prev) => !prev)}
            disabled={isCreatingBackup}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Sao Lưu Ngay (Manual)</span>
          </button>
        </div>
      </div>

      {/* Manual Backup Note Prompt Drawer */}
      {showNoteInput && (
        <div className="bg-indigo-50/70 border border-indigo-200 p-5 rounded-2xl shadow-xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
              <History className="w-4 h-4 text-indigo-600" />
              Tạo bản sao lưu dữ liệu mới ngay bây giờ
            </span>
            <button
              onClick={() => setShowNoteInput(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold"
            >
              Đóng
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              value={backupNote}
              onChange={(e) => setBackupNote(e.target.value)}
              placeholder="Ghi chú cho bản sao lưu (VD: Trước khi cập nhật bảng giá mới, Sau lễ 2/9...)"
              className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => performBackup('manual', backupNote.trim() || undefined)}
              disabled={isCreatingBackup}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold whitespace-nowrap transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isCreatingBackup ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang Sao Lưu...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Xác Nhận Sao Lưu</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Auto-Backup Schedule Config Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-700" />
            <span className="text-xs font-bold text-slate-900">Thiết Lập Tự Động Sao Lưu (Auto Backup)</span>
          </div>
          {schedule.lastBackupAt && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              Lần tự động sao lưu gần nhất: <strong>{getRelativeTime(schedule.lastBackupAt)}</strong> ({formatDateTime(schedule.lastBackupAt)})
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div 
            onClick={() => {
              if (isSavingSchedule) return;
              handleSaveSchedule({
                ...schedule,
                enabled: !schedule.enabled
              });
            }}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={schedule.enabled}
                onChange={() => {}}
                className="sr-only peer"
              />
              <div className={`w-9 h-5 rounded-full transition-colors relative ${
                schedule.enabled ? 'bg-emerald-600' : 'bg-slate-200'
              }`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-[2px] left-[2px] shadow-xs ${
                  schedule.enabled ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
            </div>
            <span className="text-xs font-bold text-slate-800">
              {schedule.enabled ? 'Đang Bật Tự Động Sao Lưu' : 'Đang Tắt Tự Động'}
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Tần suất tự động:
            </label>
            <select
              value={schedule.intervalHours}
              disabled={!schedule.enabled || isSavingSchedule}
              onChange={(e) =>
                handleSaveSchedule({
                  ...schedule,
                  intervalHours: Number(e.target.value)
                })
              }
              className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value={1}>Mỗi 1 giờ (Rất thường xuyên)</option>
              <option value={3}>Mỗi 3 giờ</option>
              <option value={6}>Mỗi 6 giờ (Khuyên dùng)</option>
              <option value={12}>Mỗi 12 giờ</option>
              <option value={24}>Mỗi 24 giờ (Hằng ngày)</option>
            </select>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-600">
            <strong>Quy tắc hệ thống:</strong> Luôn giữ tối đa <strong>10 bản sao lưu</strong> mới nhất trên Firebase. Khi có bản thứ 11, bản cũ nhất sẽ được tự động dọn dẹp.
          </div>
        </div>
      </div>

      {/* Backup Retention Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 p-4 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs text-amber-950 font-medium">
            <strong>Giới hạn lưu trữ:</strong> Hệ thống lưu trữ tối đa <strong>10 điểm khôi phục</strong>. Hiện có <strong>{backups.length}/10</strong> bản sao lưu trên Firebase Cloud.
          </div>
        </div>
        <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900">
          {backups.length}/10
        </span>
      </div>

      {/* Cloud Sync Alert Banner if any backup is local only */}
      {backups.some((b) => b.syncedToCloud === false) && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-950">Phát hiện bản sao lưu chưa đồng bộ lên Firebase Cloud</div>
              <div className="text-[11px] text-amber-800 mt-0.5">
                Một số bản sao lưu đang lưu tạm trên máy này và có thể chưa hiển thị trên thiết bị khác. Bấm nút bên cạnh để đẩy trực tiếp lên Firebase Cloud.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSyncLocalBackups}
            disabled={isSyncingCloud}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold flex items-center gap-2 shrink-0 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <CloudUpload className={`w-4 h-4 ${isSyncingCloud ? 'animate-bounce' : ''}`} />
            <span>{isSyncingCloud ? 'Đang đồng bộ...' : 'Đồng bộ lên Firebase ngay'}</span>
          </button>
        </div>
      )}

      {/* Backups List */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider px-1">
          Danh Sách Các Bản Sao Lưu Đã Lưu ({backups.length})
        </div>

        {isLoading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Đang tải lịch sử sao lưu từ Firebase...</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <History className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-bold">Chưa có bản sao lưu nào được lưu trữ trên Firebase.</p>
            <button
              onClick={() => performBackup('manual', 'Bản sao lưu đầu tiên')}
              disabled={isCreatingBackup}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs"
            >
              Tạo Bản Sao Lưu Đầu Tiên
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((b, index) => (
              <div
                key={b.id}
                className={`bg-white p-4 sm:p-5 rounded-2xl border transition-all shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  index === 0 ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
                }`}
              >
                {/* Left: Info */}
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 font-mono">
                      {b.formattedDate || formatDateTime(b.createdAt)}
                    </span>

                    {index === 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-100 text-indigo-800">
                        Mới nhất
                      </span>
                    )}

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        b.backupType === 'auto'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {b.backupType === 'auto' ? 'Tự Động' : 'Thủ Công'}
                    </span>

                    {/* Cloud vs Local Sync Status Badge */}
                    {b.syncedToCloud !== false ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                        title="Bản sao lưu này đã được lưu trữ an toàn trên Firebase Cloud (sẵn sàng trên mọi thiết bị)"
                      >
                        <Cloud className="w-3 h-3 text-blue-600" />
                        Firebase Cloud
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300"
                        title="Bản sao lưu này đang lưu tạm cục bộ trên trình duyệt này"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Chỉ lưu cục bộ
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400 font-medium">
                      ({getRelativeTime(b.createdAt)})
                    </span>
                  </div>

                  {b.note && (
                    <p className="text-xs text-slate-700 font-medium">
                      <span className="font-semibold text-slate-500">Ghi chú:</span> {b.note}
                    </p>
                  )}

                  {/* Summary badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600 font-medium">
                    <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                      <Package className="w-3 h-3 text-slate-500" />
                      {b.summary.productsCount} Sản phẩm
                    </span>

                    <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                      <FolderTree className="w-3 h-3 text-slate-500" />
                      {b.summary.categoriesCount} Danh mục
                    </span>

                    <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                      <Layers className="w-3 h-3 text-slate-500" />
                      {b.summary.collectionsCount} Bộ sưu tập
                    </span>

                    {b.summary.hasSiteContent && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Layout className="w-3 h-3 text-slate-500" />
                        Giao diện Website
                      </span>
                    )}

                    {b.createdByName && (
                      <span className="text-slate-400 text-[10px]">
                        Bởi: {b.createdByName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                  {b.syncedToCloud === false && (
                    <button
                      onClick={handleSyncLocalBackups}
                      disabled={isSyncingCloud}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                      title="Đẩy bản sao lưu này lên Firebase Cloud ngay"
                    >
                      <CloudUpload className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-bounce' : ''}`} />
                      <span>Đẩy lên Cloud</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDownloadBackup(b)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                    title="Tải về file JSON dự phòng"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setDeleteCandidate(b)}
                    className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer"
                    title="Xóa bản sao lưu này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setRestoreCandidate(b)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Khôi Phục</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RESTORE CONFIRMATION MODAL */}
      {restoreCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-2xl text-amber-700">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Xác Nhận Khôi Phục Dữ Liệu?</h3>
                <p className="text-xs text-slate-500 mt-0.5">Hệ thống sẽ đồng bộ lại về thời điểm này</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <div><strong>Thời điểm:</strong> {restoreCandidate.formattedDate}</div>
              <div><strong>Ghi chú:</strong> {restoreCandidate.note || 'Không có'}</div>
              <div><strong>Nội dung:</strong> {restoreCandidate.summary.productsCount} sản phẩm, {restoreCandidate.summary.categoriesCount} danh mục, {restoreCandidate.summary.collectionsCount} bộ sưu tập.</div>
            </div>

            <div className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200 font-medium">
              ⚠️ Lưu ý: Dữ liệu hiện tại trên web và Firebase sẽ được cập nhật hoàn toàn theo phiên bản này.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRestoreCandidate(null)}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Hủy Bỏ
              </button>

              <button
                onClick={confirmRestore}
                disabled={isRestoring}
                className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang Khôi Phục...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Đồng Ý Khôi Phục</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-2xl text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Xóa Bản Sao Lưu Này?</h3>
                <p className="text-xs text-slate-500 mt-0.5">{deleteCandidate.formattedDate}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Bản sao lưu này sẽ bị xóa vĩnh viễn khỏi Firebase Cloud. Bạn không thể hoàn tác sau khi xóa.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteCandidate(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Hủy
              </button>

              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'Đang Xóa...' : 'Xóa Vĩnh Viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
