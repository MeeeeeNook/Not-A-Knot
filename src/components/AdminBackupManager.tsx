import React, { useState } from 'react';
import { Product, CategoryItem, CollectionInfo, SiteContentConfig, ContactMessage } from '../types';
import { Download, Upload, Check, Database, FileSpreadsheet, HardDrive, RefreshCw, AlertCircle, ShieldCheck, FileJson, CheckCircle2, FileText } from 'lucide-react';
import { StoredOrder, saveSiteContentToFirestore, saveCategoriesToFirestore, saveCollectionsToFirestore, saveProductsToFirestore, saveOrdersToFirestore } from '../firebase';
import { ExcelExportPromptModal } from './ExcelExportPromptModal';
import { exportMasterBackupWithImageOption } from '../utils/excelImageExporter';
import { safeStorageSetItem } from '../utils/storageHelper';
import { safeIsoDateString, formatOrderDateWithoutSeconds } from '../utils/orderFormatters';

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
  onNotify?: (msg: string) => void;
  onToast?: (msg: string) => void;
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
  onNotify,
  onToast
}) => {
  const notify = (msg: string) => {
    if (typeof onNotify === 'function') {
      onNotify(msg);
    } else if (typeof onToast === 'function') {
      onToast(msg);
    }
  };
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
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const restoreFileInputRef = React.useRef<HTMLInputElement | null>(null);

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
      notify('Vui lòng chọn ít nhất 1 loại dữ liệu cần xuất.');
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

      notify(`Đã xuất file sao lưu JSON v2.0 thành công (${selectedCount} mục).`);
    } catch (e: any) {
      console.error(e);
      notify('Lỗi khi xuất file JSON: ' + (e.message || 'Thử lại sau'));
    } finally {
      setIsExporting(false);
    }
  };

  // ----------------------------------------------------
  // 2. Export Multi-Sheet Excel Spreadsheet (.xlsx)
  // ----------------------------------------------------
  const handleExportExcel = () => {
    if (selectedCount === 0) {
      notify('Vui lòng chọn ít nhất 1 loại dữ liệu cần xuất.');
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
    notify(includeImages ? 'Đã xuất file ZIP kèm toàn bộ hình ảnh thành công!' : 'Đã xuất file Excel đa sheet (.xlsx) thành công!');
  };

  // ----------------------------------------------------
  // 3. Helper Sanitizers for Edited / Imported JSON
  // ----------------------------------------------------
  const sanitizeImportedProducts = (rawList: any[]): Product[] => {
    if (!Array.isArray(rawList)) return [];
    return rawList
      .filter((item) => item && typeof item === 'object')
      .map((item, idx) => {
        const id = item.id ? String(item.id).trim() : `prod_${Date.now()}_${idx}`;
        const name = item.name ? String(item.name).trim() : `Sản phẩm ${idx + 1}`;
        const price = Number(item.price) >= 0 ? Number(item.price) : 0;
        const originalPrice = item.originalPrice !== undefined && Number(item.originalPrice) >= 0 
          ? Number(item.originalPrice) 
          : undefined;
        
        let images: string[] = [];
        if (Array.isArray(item.images) && item.images.length > 0) {
          images = item.images.map((img: any) => String(img).trim()).filter(Boolean);
        } else if (item.image) {
          images = [String(item.image).trim()];
        }
        if (images.length === 0) {
          images = ['/assets/hero-bg.png'];
        }

        return {
          ...item,
          id,
          name,
          price,
          originalPrice,
          category: item.category ? String(item.category).trim() : 'all',
          image: images[0],
          images,
          stock: item.stock !== undefined ? Number(item.stock) : 50,
          inStock: item.inStock !== undefined ? Boolean(item.inStock) : true,
          soldCount: item.soldCount !== undefined ? Number(item.soldCount) : 0,
          isNew: item.isNew !== undefined ? Boolean(item.isNew) : false,
          isBestSeller: item.isBestSeller !== undefined ? Boolean(item.isBestSeller) : false,
          detailsText: item.detailsText || item.description || ''
        } as Product;
      });
  };

  const sanitizeImportedOrders = (rawList: any[]): StoredOrder[] => {
    if (!Array.isArray(rawList)) return [];
    return rawList
      .filter((item) => item && typeof item === 'object')
      .map((item, idx) => {
        const id = item.id ? String(item.id).trim() : `NAK-${Date.now()}-${idx}`;
        const safeIso = safeIsoDateString(item.createdAt || item.date);
        const safeDisplayDate = item.date ? formatOrderDateWithoutSeconds(item.date) : formatOrderDateWithoutSeconds(safeIso);
        
        return {
          ...item,
          id,
          date: safeDisplayDate,
          createdAt: safeIso,
          name: item.name || item.customerName || 'Khách hàng',
          customerName: item.customerName || item.name || 'Khách hàng',
          phone: item.phone ? String(item.phone).trim() : '',
          total: Number(item.total) >= 0 ? Number(item.total) : 0,
          status: item.status || 'Chờ xác nhận',
          paymentStatus: item.paymentStatus || 'unpaid',
          source: item.source || 'website',
          itemDetails: Array.isArray(item.itemDetails) ? item.itemDetails : []
        } as StoredOrder;
      });
  };

  const sanitizeImportedCategories = (rawList: any[]): CategoryItem[] => {
    if (!Array.isArray(rawList)) return [];
    return rawList
      .filter((item) => item && typeof item === 'object' && (item.id || item.name))
      .map((item, idx) => ({
        ...item,
        id: item.id ? String(item.id).trim() : `cat_${idx + 1}`,
        name: item.name ? String(item.name).trim() : `Danh mục ${idx + 1}`
      }));
  };

  // ----------------------------------------------------
  // 4. Handle File Upload & Drag-and-Drop for Restore
  // ----------------------------------------------------
  const processBackupFile = (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json' && file.type !== 'text/json') {
      alert('Vui lòng chọn file sao lưu định dạng .JSON');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        if (!content || !content.trim()) {
          alert('File JSON trống. Vui lòng kiểm tra lại nội dung file.');
          return;
        }

        const parsed = JSON.parse(content);

        // Normalize payload from various JSON formats:
        // 1. Unified v2 format: { schemaVersion: "2.0.0", payload: { ... } }
        // 2. Version history format: { id: "backup_...", data: { ... } }
        // 3. Database export: { products: [...], categories: [...] }
        // 4. Direct array of products or orders: [ {...}, {...} ]
        let payload: any = {};
        if (parsed.payload && typeof parsed.payload === 'object') {
          payload = parsed.payload;
        } else if (parsed.data && typeof parsed.data === 'object') {
          payload = parsed.data;
        } else if (Array.isArray(parsed)) {
          // Detect if array contains orders or products
          if (parsed.length > 0 && (parsed[0].phone !== undefined || parsed[0].itemDetails !== undefined || parsed[0].status !== undefined)) {
            payload = { orders: parsed };
          } else {
            payload = { products: parsed };
          }
        } else if (typeof parsed === 'object') {
          payload = parsed;
        }

        const rawOrders = Array.isArray(payload.orders) ? payload.orders : [];
        const rawProducts = Array.isArray(payload.products) ? payload.products : [];
        const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
        const rawCollections = Array.isArray(payload.collections) ? payload.collections : [];
        const rawSiteContent = payload.siteContent && typeof payload.siteContent === 'object' ? payload.siteContent : null;
        const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];

        // Validate that at least one recognizable data field exists
        if (
          rawOrders.length === 0 &&
          rawProducts.length === 0 &&
          rawCategories.length === 0 &&
          rawCollections.length === 0 &&
          !rawSiteContent &&
          rawMessages.length === 0
        ) {
          alert('File không chứa dữ liệu hợp lệ của hệ thống NOT A KNOT (Không tìm thấy đơn hàng, sản phẩm, danh mục hoặc giao diện).');
          return;
        }

        const sanitizedPayload = {
          orders: sanitizeImportedOrders(rawOrders),
          products: sanitizeImportedProducts(rawProducts),
          categories: sanitizeImportedCategories(rawCategories),
          collections: rawCollections,
          siteContent: rawSiteContent,
          messages: rawMessages
        };

        setRestorePreview({
          fileName: file.name,
          fileSize: (file.size / 1024).toFixed(1) + ' KB',
          version: parsed.schemaVersion || (parsed.id?.startsWith('backup_') ? 'Version History' : '1.0 / Custom'),
          exportedAt: parsed.exportedAt || parsed.createdAt || 'Tùy chỉnh (Đã chỉnh sửa)',
          ordersCount: sanitizedPayload.orders.length,
          productsCount: sanitizedPayload.products.length,
          categoriesCount: sanitizedPayload.categories.length,
          collectionsCount: sanitizedPayload.collections.length,
          hasSiteContent: !!sanitizedPayload.siteContent,
          hasMessages: sanitizedPayload.messages.length,
          rawPayload: sanitizedPayload
        });
        notify(`Đã nạp file "${file.name}" thành công. Xem chi tiết bên dưới để xác nhận.`);
      } catch (err: any) {
        console.error('Lỗi đọc JSON:', err);
        alert(`Không thể đọc file JSON (Lỗi cú pháp: ${err.message || 'Sai định dạng'}). Hãy kiểm tra các dấu ngoặc hoặc dấu phẩy nếu bạn vừa sửa file thủ công.`);
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processBackupFile(file);
    }
    // Reset value so the user can select the same file again if needed
    e.target.value = '';
  };

  const handleRestoreDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleRestoreDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleRestoreDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processBackupFile(files[0]);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restorePreview || !restorePreview.rawPayload) return;
    setIsRestoring(true);

    try {
      const payload = restorePreview.rawPayload;
      const restoredItemsList: string[] = [];

      // 1. Orders
      if (payload.orders && Array.isArray(payload.orders) && payload.orders.length > 0) {
        let nextOrders: StoredOrder[] = [];
        if (restoreMode === 'replace') {
          nextOrders = payload.orders;
        } else {
          // Merge mode: replace matching by ID, append new ones
          const existingMap = new Map<string, StoredOrder>(orders.map((o) => [o.id || '', o]));
          payload.orders.forEach((o: StoredOrder) => existingMap.set(o.id, o));
          nextOrders = Array.from(existingMap.values());
        }
        onUpdateOrders(nextOrders);
        safeStorageSetItem('nak_orders', JSON.stringify(nextOrders));
        await saveOrdersToFirestore(nextOrders);
        restoredItemsList.push(`${nextOrders.length} đơn hàng`);
      }

      // 2. Products
      if (payload.products && Array.isArray(payload.products) && payload.products.length > 0) {
        let nextProds: Product[] = [];
        if (restoreMode === 'replace') {
          nextProds = payload.products;
        } else {
          // Merge mode: replace matching by ID, append new ones
          const existingMap = new Map<string, Product>(products.map((p) => [p.id, p]));
          payload.products.forEach((p: Product) => existingMap.set(p.id, p));
          nextProds = Array.from(existingMap.values());
        }
        onUpdateProducts(nextProds);
        safeStorageSetItem('nak_admin_products', JSON.stringify(nextProds));
        safeStorageSetItem('nak_custom_products', JSON.stringify(nextProds));
        await saveProductsToFirestore(nextProds);
        restoredItemsList.push(`${nextProds.length} sản phẩm`);
      }

      // 3. Categories
      if (payload.categories && Array.isArray(payload.categories) && payload.categories.length > 0) {
        onUpdateCategories(payload.categories);
        safeStorageSetItem('nak_categories', JSON.stringify(payload.categories));
        await saveCategoriesToFirestore(payload.categories);
        restoredItemsList.push(`${payload.categories.length} danh mục`);
      }

      // 4. Collections
      if (payload.collections && Array.isArray(payload.collections) && payload.collections.length > 0) {
        onUpdateCollections(payload.collections);
        safeStorageSetItem('nak_collections', JSON.stringify(payload.collections));
        await saveCollectionsToFirestore(payload.collections);
        restoredItemsList.push(`${payload.collections.length} banner`);
      }

      // 5. Site Content
      if (payload.siteContent && typeof payload.siteContent === 'object') {
        onUpdateSiteContent(payload.siteContent);
        safeStorageSetItem('nak_site_content', JSON.stringify(payload.siteContent));
        await saveSiteContentToFirestore(payload.siteContent);
        restoredItemsList.push('giao diện website');
      }

      // 6. Messages
      if (payload.messages && Array.isArray(payload.messages) && payload.messages.length > 0) {
        safeStorageSetItem('nak_contact_messages', JSON.stringify(payload.messages));
        restoredItemsList.push(`${payload.messages.length} tin nhắn`);
      }

      notify(`Khôi phục thành công (${restoredItemsList.join(', ')}). Dữ liệu đã đồng bộ lên Firebase!`);
      setRestorePreview(null);
    } catch (e: any) {
      console.error('Lỗi khôi phục:', e);
      notify('Lỗi trong quá trình khôi phục: ' + (e.message || 'Vui lòng thử lại'));
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
            <div
              onDragOver={handleRestoreDragOver}
              onDragLeave={handleRestoreDragLeave}
              onDrop={handleRestoreDrop}
              onClick={() => restoreFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                isDraggingFile
                  ? 'border-amber-500 bg-amber-100/70 scale-[1.02] shadow-md ring-2 ring-amber-400/50'
                  : 'border-slate-200 hover:border-amber-400 bg-slate-50/50 hover:bg-amber-50/30'
              }`}
            >
              <Upload className={`w-8 h-8 mb-2 transition-transform duration-200 ${isDraggingFile ? 'text-amber-600 scale-110 animate-bounce' : 'text-amber-500'}`} />
              <span className="text-xs font-bold text-slate-800 block">
                {isDraggingFile ? 'Thả file .JSON vào đây để mở' : 'Chọn hoặc thả file sao lưu .JSON'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Kéo thả file vào đây hoặc <span className="text-amber-700 font-semibold underline">bấm để duyệt file</span>
              </span>
              <input
                ref={restoreFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreFileSelected}
                className="hidden"
              />
            </div>

            {/* Preview Box if file selected */}
            {restorePreview && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-amber-900 block">Chi Tiết Bản Sao Lưu</span>
                    {restorePreview.fileName && (
                      <span className="text-[11px] text-amber-800 font-medium truncate max-w-[200px] flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span className="truncate">{restorePreview.fileName}</span> ({restorePreview.fileSize})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-950">
                      Bản {restorePreview.version}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRestorePreview(null)}
                      className="text-[10px] font-bold text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-amber-100 transition-colors cursor-pointer"
                      title="Hủy file này và chọn file khác"
                    >
                      ✕ Đổi file
                    </button>
                  </div>
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
