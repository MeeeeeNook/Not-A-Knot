import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Product, CategoryItem, CollectionInfo, SiteContentConfig, ContactMessage } from '../types';
import { Download, Upload, Check, Database, FileSpreadsheet, HardDrive, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { StoredOrder, saveSiteContentToFirestore, saveCategoriesToFirestore, saveCollectionsToFirestore, saveProductsToFirestore, saveOrdersToFirestore } from '../firebase';
import { ExcelExportPromptModal } from './ExcelExportPromptModal';
import { exportMasterBackupWithImageOption } from '../utils/excelImageExporter';

interface AdminBackupManagerProps {
  orders: StoredOrder[];
  products: Product[];
  categories: CategoryItem[];
  collections: CollectionInfo[];
  siteContent?: SiteContentConfig;
  onUpdateOrders: (orders: StoredOrder[]) => void;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateCategories: (categories: CategoryItem[]) => void;
  onUpdateCollections: (collections: CollectionInfo[]) => void;
  onUpdateSiteContent: (config: SiteContentConfig) => void;
  onNotify: (msg: string) => void;
}

export const AdminBackupManager: React.FC<AdminBackupManagerProps> = ({
  orders,
  products,
  categories,
  collections,
  siteContent,
  onUpdateOrders,
  onUpdateProducts,
  onUpdateCategories,
  onUpdateCollections,
  onUpdateSiteContent,
  onNotify
}) => {
  // Selection checklist state
  const [selectedTypes, setSelectedTypes] = useState<{
    orders: boolean;
    products: boolean;
    categories: boolean;
    banners: boolean;
    siteContent: boolean;
    messages: boolean;
  }>({
    orders: true,
    products: true,
    categories: true,
    banners: true,
    siteContent: true,
    messages: true
  });

  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorePreview, setRestorePreview] = useState<any | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('replace');
  const [showExcelPrompt, setShowExcelPrompt] = useState(false);

  const toggleAll = (checked: boolean) => {
    setSelectedTypes({
      orders: checked,
      products: checked,
      categories: checked,
      banners: checked,
      siteContent: checked,
      messages: checked
    });
  };

  const selectedCount = Object.values(selectedTypes).filter(Boolean).length;

  // Retrieve contact messages from localStorage for export
  const getSavedMessages = (): ContactMessage[] => {
    try {
      const raw = localStorage.getItem('nak_contact_messages');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  // ----------------------------------------------------
  // 1. Export Standard Unified JSON Snapshot (v2.0)
  // ----------------------------------------------------
  const handleExportJSON = () => {
    if (selectedCount === 0) {
      onNotify('Vui lòng chọn ít nhất 1 loại dữ liệu cần xuất.');
      return;
    }

    setIsExporting(true);
    try {
      const now = new Date();
      const timestampStr = now.toISOString();
      const dateStr = now.toISOString().slice(0, 10);

      const backupData: any = {
        schemaVersion: '2.0.0',
        exportedAt: timestampStr,
        appName: siteContent?.brandName || 'NOT A KNOT Studio',
        environment: 'ai-studio-production',
        meta: {
          totalOrders: selectedTypes.orders ? orders.length : 0,
          totalProducts: selectedTypes.products ? products.length : 0,
          totalCategories: selectedTypes.categories ? categories.length : 0,
          totalCollections: selectedTypes.banners ? collections.length : 0,
          hasSiteContent: selectedTypes.siteContent
        },
        payload: {}
      };

      if (selectedTypes.orders) backupData.payload.orders = orders;
      if (selectedTypes.products) backupData.payload.products = products;
      if (selectedTypes.categories) backupData.payload.categories = categories;
      if (selectedTypes.banners) backupData.payload.collections = collections;
      if (selectedTypes.siteContent && siteContent) backupData.payload.siteContent = siteContent;
      if (selectedTypes.messages) backupData.payload.messages = getSavedMessages();

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `NOT_A_KNOT_Backup_Unified_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onNotify(`Đã xuất file sao lưu JSON v2.0 thành công (${selectedCount} mục).`);
    } catch (e: any) {
      console.error(e);
      onNotify('Lỗi khi xuất file JSON: ' + (e.message || 'Thử lại sau'));
    } finally {
      setIsExporting(false);
    }
  };

  // ----------------------------------------------------
  // 2. Export Multi-Sheet Excel Spreadsheet (.xlsx)
  // ----------------------------------------------------
  const handleExportExcel = () => {
    if (selectedCount === 0) {
      onNotify('Vui lòng chọn ít nhất 1 loại dữ liệu cần xuất.');
      return;
    }
    setShowExcelPrompt(true);
  };

  const handleConfirmExportExcel = async (includeImages: boolean, onProgress: (msg: string) => void) => {
    await exportMasterBackupWithImageOption({
      orders,
      products,
      categories,
      collections,
      siteContent,
      selectedTypes,
      includeImages,
      onProgress
    });
    onNotify(includeImages ? 'Đã xuất file ZIP kèm toàn bộ hình ảnh thành công!' : 'Đã xuất file Excel đa sheet (.xlsx) thành công!');
  };

  // ----------------------------------------------------
  // 3. Handle File Upload for Restore
  // ----------------------------------------------------
  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);

        // Validate structure
        if (!parsed.payload && !parsed.orders && !parsed.products) {
          alert('File không đúng định dạng sao lưu của hệ thống NOT A KNOT.');
          return;
        }

        const payload = parsed.payload || parsed;
        setRestorePreview({
          version: parsed.schemaVersion || '1.0',
          exportedAt: parsed.exportedAt || 'Không rõ',
          ordersCount: payload.orders ? payload.orders.length : 0,
          productsCount: payload.products ? payload.products.length : 0,
          categoriesCount: payload.categories ? payload.categories.length : 0,
          collectionsCount: payload.collections ? payload.collections.length : 0,
          hasSiteContent: !!payload.siteContent,
          hasMessages: payload.messages ? payload.messages.length : 0,
          rawPayload: payload
        });
      } catch {
        alert('Không thể đọc file JSON. Vui lòng kiểm tra lại tính toàn vẹn của file.');
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restorePreview || !restorePreview.rawPayload) return;
    setIsRestoring(true);

    try {
      const payload = restorePreview.rawPayload;

      // 1. Orders
      if (payload.orders && Array.isArray(payload.orders)) {
        const nextOrders = restoreMode === 'replace' ? payload.orders : [...payload.orders, ...orders.filter(o => !payload.orders.some((p: any) => p.id === o.id))];
        onUpdateOrders(nextOrders);
        localStorage.setItem('nak_orders', JSON.stringify(nextOrders));
        await saveOrdersToFirestore(nextOrders);
      }

      // 2. Products
      if (payload.products && Array.isArray(payload.products)) {
        const nextProds = restoreMode === 'replace' ? payload.products : [...payload.products, ...products.filter(p => !payload.products.some((np: any) => np.id === p.id))];
        onUpdateProducts(nextProds);
        localStorage.setItem('nak_admin_products', JSON.stringify(nextProds));
        await saveProductsToFirestore(nextProds);
      }

      // 3. Categories
      if (payload.categories && Array.isArray(payload.categories)) {
        onUpdateCategories(payload.categories);
        localStorage.setItem('nak_categories', JSON.stringify(payload.categories));
        await saveCategoriesToFirestore(payload.categories);
      }

      // 4. Collections
      if (payload.collections && Array.isArray(payload.collections)) {
        onUpdateCollections(payload.collections);
        localStorage.setItem('nak_collections', JSON.stringify(payload.collections));
        await saveCollectionsToFirestore(payload.collections);
      }

      // 5. Site Content
      if (payload.siteContent && typeof payload.siteContent === 'object') {
        onUpdateSiteContent(payload.siteContent);
        localStorage.setItem('nak_site_content', JSON.stringify(payload.siteContent));
        await saveSiteContentToFirestore(payload.siteContent);
      }

      // 6. Messages
      if (payload.messages && Array.isArray(payload.messages)) {
        localStorage.setItem('nak_contact_messages', JSON.stringify(payload.messages));
      }

      onNotify('Khôi phục dữ liệu từ bản sao lưu thành công!');
      setRestorePreview(null);
    } catch (e: any) {
      console.error(e);
      onNotify('Lỗi trong quá trình khôi phục: ' + (e.message || 'Thử lại'));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Top Banner: Clean System Backup Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-black text-slate-900 tracking-tight">
            Sao Lưu Dữ Liệu & Xuất Báo Cáo
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Xuất file Excel báo cáo kèm ảnh hoặc tải file JSON sao lưu toàn bộ đơn hàng, sản phẩm và giao diện website.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Tài khoản Cloud</span>
            <span className="text-xs font-bold text-slate-800 font-mono">nhunhuhao71@gmail.com</span>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" title="Cloud Realtime Active" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Data Type Selection Checklist (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">1. Chọn Loại Dữ Liệu Cần Xuất / Sao Lưu</h3>
              <p className="text-xs text-slate-400 mt-0.5">Tùy chọn trích xuất từng thành phần hoặc toàn bộ hệ thống</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAll(true)}
                className="px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Bỏ chọn
              </button>
            </div>
          </div>

          {/* Checklist Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* 1. Orders */}
            <label className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
              selectedTypes.orders ? 'border-amber-400 bg-amber-50/50 shadow-2xs' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}>
              <input
                type="checkbox"
                checked={selectedTypes.orders}
                onChange={(e) => setSelectedTypes({ ...selectedTypes, orders: e.target.checked })}
                className="mt-1 rounded text-amber-600 focus:ring-0 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900">Đơn Hàng & Giao Dịch</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold">{orders.length}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Chi tiết món đặt, bill chuyển khoản, trạng thái giao, người nhận.</p>
              </div>
            </label>

            {/* 2. Products */}
            <label className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
              selectedTypes.products ? 'border-amber-400 bg-amber-50/50 shadow-2xs' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}>
              <input
                type="checkbox"
                checked={selectedTypes.products}
                onChange={(e) => setSelectedTypes({ ...selectedTypes, products: e.target.checked })}
                className="mt-1 rounded text-amber-600 focus:ring-0 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900">Sản Phẩm & Kho Bãi</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold">{products.length}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Danh mục sản phẩm, tồn kho, giá bán, chất liệu, hình ảnh.</p>
              </div>
            </label>

            {/* 3. Categories */}
            <label className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
              selectedTypes.categories ? 'border-amber-400 bg-amber-50/50 shadow-2xs' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}>
              <input
                type="checkbox"
                checked={selectedTypes.categories}
                onChange={(e) => setSelectedTypes({ ...selectedTypes, categories: e.target.checked })}
                className="mt-1 rounded text-amber-600 focus:ring-0 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900">Danh Mục Sản Phẩm</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold">{categories.length}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Tên phân loại, mã định danh, mô tả, màu sắc nhận diện.</p>
              </div>
            </label>

            {/* 4. Slides & Banners */}
            <label className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
              selectedTypes.banners ? 'border-amber-400 bg-amber-50/50 shadow-2xs' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}>
              <input
                type="checkbox"
                checked={selectedTypes.banners}
                onChange={(e) => setSelectedTypes({ ...selectedTypes, banners: e.target.checked })}
                className="mt-1 rounded text-amber-600 focus:ring-0 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900">Hero Slides & Banners</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold">{collections.length}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Toàn bộ slide trình diễn Billboard đầu trang và banner BST.</p>
              </div>
            </label>

            {/* 5. Site Content & Logo */}
            <label className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
              selectedTypes.siteContent ? 'border-amber-400 bg-amber-50/50 shadow-2xs' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}>
              <input
                type="checkbox"
                checked={selectedTypes.siteContent}
                onChange={(e) => setSelectedTypes({ ...selectedTypes, siteContent: e.target.checked })}
                className="mt-1 rounded text-amber-600 focus:ring-0 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900">Cấu Hình Website & Logo</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-bold">Chuẩn</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Logo, Hotline, Zalo, địa chỉ, khối tùy chỉnh, chính sách.</p>
              </div>
            </label>

            {/* 6. Messages */}
            <label className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
              selectedTypes.messages ? 'border-amber-400 bg-amber-50/50 shadow-2xs' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}>
              <input
                type="checkbox"
                checked={selectedTypes.messages}
                onChange={(e) => setSelectedTypes({ ...selectedTypes, messages: e.target.checked })}
                className="mt-1 rounded text-amber-600 focus:ring-0 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900">Hộp Thư Khách Hàng</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold">{getSavedMessages().length}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Tin nhắn liên hệ, phản hồi khách hàng từ website.</p>
              </div>
            </label>

          </div>

          {/* Action Buttons for Export */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              disabled={isExporting || selectedCount === 0}
              onClick={handleExportJSON}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Xuất File Sao Lưu Hệ Thống (.JSON v2.0)</span>
            </button>

            <button
              type="button"
              disabled={isExporting || selectedCount === 0}
              onClick={handleExportExcel}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Xuất Bảng Tính Excel Đa Sheet (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Right Column: Restore & Import from Backup (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900">2. Khôi Phục Dữ Liệu Từ File Sao Lưu</h3>
              <p className="text-xs text-slate-400 mt-0.5">Nhập file .json đã xuất trước đó để phục hồi nhanh</p>
            </div>

            {/* Drag & Drop / File Select Box */}
            <label className="border-2 border-dashed border-slate-200 hover:border-amber-400 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-amber-50/30">
              <Upload className="w-8 h-8 text-amber-500 mb-2" />
              <span className="text-xs font-bold text-slate-800 block">Chọn file sao lưu .JSON</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Kéo thả file vào đây hoặc bấm để duyệt file</span>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFileSelected}
                className="hidden"
              />
            </label>

            {/* Preview Box if file selected */}
            {restorePreview && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900">Chi Tiết Bản Sao Lưu</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-950">
                    Bản {restorePreview.version}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <div>Đơn hàng: <b>{restorePreview.ordersCount}</b></div>
                  <div>Sản phẩm: <b>{restorePreview.productsCount}</b></div>
                  <div>Danh mục: <b>{restorePreview.categoriesCount}</b></div>
                  <div>Banners: <b>{restorePreview.collectionsCount}</b></div>
                  <div>Giao diện: <b>{restorePreview.hasSiteContent ? 'Có' : 'Không'}</b></div>
                  <div>Hộp thư: <b>{restorePreview.hasMessages} tin</b></div>
                </div>

                {/* Restore Mode Option */}
                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 text-[11px]">Chế độ khôi phục:</span>
                  <select
                    value={restoreMode}
                    onChange={(e: any) => setRestoreMode(e.target.value)}
                    className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="replace">Ghi đè hoàn toàn (Khuyên dùng)</option>
                    <option value="merge">Gộp thêm dữ liệu</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={handleExecuteRestore}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                  <span>{isRestoring ? 'Đang Khôi Phục...' : 'Bắt Đầu Khôi Phục Dữ Liệu'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Security & Reliability Guarantee */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-[11px] text-slate-500 leading-tight">
              Tất cả các bản sao lưu đều được tự động gắn mã phiên bản cấu trúc (schemaVersion) giúp bạn an tâm chuyển đổi hoặc nâng cấp website mà không lo hỏng dữ liệu.
            </span>
          </div>
        </div>

      </div>
      
      {/* Excel Export Prompt Modal */}
      <ExcelExportPromptModal
        isOpen={showExcelPrompt}
        onClose={() => setShowExcelPrompt(false)}
        title="Xuất Dữ Liệu Excel Đa Sheet"
        description="Bạn có muốn tải về toàn bộ hình ảnh đính kèm (Ảnh sản phẩm, Bill chuyển khoản, Banner, Logo) được sắp xếp theo từng thư mục cùng file Excel không?"
        itemCountInfo={`Đã chọn ${selectedCount} loại dữ liệu (${products.length} SP, ${orders.length} đơn)`}
        onConfirm={handleConfirmExportExcel}
      />
    </div>
  );
};
