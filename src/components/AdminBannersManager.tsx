import React, { useState, useRef } from 'react';
import { CollectionInfo, CategoryItem } from '../types';
import { COLLECTIONS_DATA } from '../data/collections';
import { saveCollectionToFirestore, deleteCollectionFromFirestore } from '../firebase';
import { Eye, Monitor, Smartphone, X, ArrowRight, Sparkles } from 'lucide-react';

interface AdminBannersManagerProps {
  collections: CollectionInfo[];
  categories: CategoryItem[];
  onUpdateCollections: (newCollections: CollectionInfo[]) => void;
  onCloudNotify?: (msg: string) => void;
}

export const AdminBannersManager: React.FC<AdminBannersManagerProps> = ({
  collections,
  categories,
  onUpdateCollections,
  onCloudNotify
}) => {
  // Sort collections by order
  const sortedCollections = [...collections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const [isEditing, setIsEditing] = useState(false);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<CollectionInfo | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formBadge, setFormBadge] = useState('');
  const [formTag, setFormTag] = useState('');
  const [formButtonText, setFormButtonText] = useState('Khám Phá Bộ Sưu Tập');
  const [formCategoryKey, setFormCategoryKey] = useState(categories[0]?.id || 'event_0209');
  const [formThemeStyle, setFormThemeStyle] = useState<'light' | 'dark' | 'event0209'>('light');
  const [formIsPreorder, setFormIsPreorder] = useState(false);
  const [formIsHidden, setFormIsHidden] = useState(false);
  const [collectionVisibilityFilter, setCollectionVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [formImage, setFormImage] = useState('');
  const [formHorizontalImage, setFormHorizontalImage] = useState('');
  const [formProductPageBanner, setFormProductPageBanner] = useState('');
  const [formStory, setFormStory] = useState('');

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDraggingMain, setIsDraggingMain] = useState(false);
  const [isDraggingHoriz, setIsDraggingHoriz] = useState(false);
  const [isDraggingProdBanner, setIsDraggingProdBanner] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const horizFileInputRef = useRef<HTMLInputElement>(null);
  const prodBannerFileInputRef = useRef<HTMLInputElement>(null);

  const processFileToState = (file: File, setter: (val: string) => void) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP, SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 2560;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          let compressed = '';
          try {
            compressed = canvas.toDataURL('image/webp', 0.95);
            if (!compressed || !compressed.startsWith('data:image/webp')) {
              compressed = canvas.toDataURL('image/jpeg', 0.94);
            }
          } catch {
            compressed = canvas.toDataURL('image/jpeg', 0.94);
          }
          setter(compressed);
        } else {
          setter(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Open Form to Add New Banner
  const handleOpenAdd = () => {
    setEditingColId(null);
    setFormTitle('');
    setFormSubtitle('');
    setFormBadge('');
    setFormTag('');
    setFormButtonText('Khám Phá Bộ Sưu Tập');
    setFormCategoryKey(categories[0]?.id || 'event_0209');
    setFormThemeStyle('light');
    setFormIsPreorder(false);
    setFormIsHidden(false);
    setFormImage('');
    setFormHorizontalImage('');
    setFormProductPageBanner('');
    setFormStory('');
    setIsEditing(true);
  };

  // Open Form to Edit Existing Banner
  const handleOpenEdit = (col: CollectionInfo) => {
    setEditingColId(col.id);
    setFormTitle(col.title || '');
    setFormSubtitle(col.subtitle || '');
    setFormBadge(col.badge || '');
    setFormTag(col.tag || '');
    setFormButtonText(col.buttonText || 'Khám Phá Bộ Sưu Tập');
    setFormCategoryKey(col.categoryKey || categories[0]?.id || 'event_0209');
    setFormThemeStyle(col.themeStyle || 'light');
    setFormIsPreorder(!!col.isPreorder);
    setFormIsHidden(!!col.isHidden);
    setFormImage(col.bannerImage || col.bgImage || '');
    setFormHorizontalImage(col.horizontalImage || col.bannerImage || col.bgImage || '');
    setFormProductPageBanner(col.productPageBanner || col.bannerImage || col.bgImage || '');
    setFormStory(col.story || '');
    setIsEditing(true);
  };

  // Quick 1-touch toggle visibility for collection
  const handleToggleHideCollection = async (col: CollectionInfo) => {
    const nextHidden = !col.isHidden;
    const updated = collections.map((c) => (c.id === col.id ? { ...c, isHidden: nextHidden } : c));
    onUpdateCollections(updated);
    try {
      const updatedItem = updated.find((c) => c.id === col.id);
      if (updatedItem) {
        await saveCollectionToFirestore(updatedItem);
      }
      const msg = nextHidden
        ? `Đã ẩn bộ sưu tập "${col.title}". Khách hàng sẽ không thấy trên trang chủ & menu.`
        : `Đã hiện bộ sưu tập "${col.title}" trở lại cửa hàng.`;
      setSuccessMsg(msg);
      if (onCloudNotify) onCloudNotify(msg);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (e) {
      console.warn('Firestore toggle collection hide error:', e);
    }
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP).');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 2560;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            let compressed = '';
            try {
              compressed = canvas.toDataURL('image/webp', 0.95);
              if (!compressed || !compressed.startsWith('data:image/webp')) {
                compressed = canvas.toDataURL('image/jpeg', 0.94);
              }
            } catch {
              compressed = canvas.toDataURL('image/jpeg', 0.94);
            }
            setFormImage(compressed);
          } else {
            setFormImage(event.target?.result as string);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Save / Update Banner
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề bộ sưu tập.');
      return;
    }
    if (!formImage.trim()) {
      setErrorMsg('Vui lòng cung cấp link hình ảnh hoặc tải ảnh lên.');
      return;
    }

    try {
      const finalMainImage = formImage.trim();
      const finalHorizImage = formHorizontalImage.trim() || finalMainImage;
      const finalProdBanner = formProductPageBanner.trim() || finalMainImage;

      if (editingColId) {
        // Edit existing
        const updated = collections.map((col) => {
          if (col.id === editingColId) {
            return {
              ...col,
              title: formTitle.trim(),
              subtitle: formSubtitle.trim(),
              badge: formBadge.trim() || undefined,
              tag: formTag.trim() || undefined,
              buttonText: formButtonText.trim(),
              categoryKey: formCategoryKey,
              themeStyle: formThemeStyle,
              isPreorder: formIsPreorder,
              isHidden: formIsHidden,
              bannerImage: finalMainImage,
              bgImage: finalMainImage,
              horizontalImage: finalHorizImage,
              productPageBanner: finalProdBanner,
              story: formStory.trim() || undefined
            };
          }
          return col;
        });

        onUpdateCollections(updated);
        const editedItem = updated.find((c) => c.id === editingColId);
        if (editedItem) {
          await saveCollectionToFirestore(editedItem);
        }
        setSuccessMsg(`Đã cập nhật banner "${formTitle}".`);
      } else {
        // Add new
        const newId = `col-${Date.now()}`;
        const newCol: CollectionInfo = {
          id: newId,
          title: formTitle.trim(),
          subtitle: formSubtitle.trim(),
          badge: formBadge.trim() || undefined,
          tag: formTag.trim() || undefined,
          buttonText: formButtonText.trim(),
          categoryKey: formCategoryKey,
          themeStyle: formThemeStyle,
          isPreorder: formIsPreorder,
          isHidden: formIsHidden,
          bannerImage: finalMainImage,
          bgImage: finalMainImage,
          horizontalImage: finalHorizImage,
          productPageBanner: finalProdBanner,
          order: collections.length,
          story: formStory.trim() || undefined
        };

        const updated = [...collections, newCol];
        onUpdateCollections(updated);
        await saveCollectionToFirestore(newCol);
        setSuccessMsg(`Đã thêm banner "${formTitle}" mới.`);
      }

      setIsEditing(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg('Lỗi lưu banner: ' + err.message);
    }
  };

  // Reorder Banners: Move Up
  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const items = [...sortedCollections];
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;

    const updated = items.map((item, idx) => ({ ...item, order: idx }));
    onUpdateCollections(updated);

    try {
      await Promise.all(updated.map((item) => saveCollectionToFirestore(item)));
      setSuccessMsg('Đã đổi vị trí banner thành công!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      console.warn('Lỗi sync Firestore reorder:', e);
    }
  };

  // Reorder Banners: Move Down
  const handleMoveDown = async (index: number) => {
    if (index >= sortedCollections.length - 1) return;
    const items = [...sortedCollections];
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;

    const updated = items.map((item, idx) => ({ ...item, order: idx }));
    onUpdateCollections(updated);

    try {
      await Promise.all(updated.map((item) => saveCollectionToFirestore(item)));
      setSuccessMsg('Đã đổi vị trí banner thành công!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      console.warn('Lỗi sync Firestore reorder:', e);
    }
  };

  // Delete Banner Click (Opens in-app confirmation modal)
  const handleDelete = (col: CollectionInfo) => {
    if (collections.length <= 1) {
      setErrorMsg('Hệ thống cần giữ ít nhất 1 banner bộ sưu tập trên trang chủ.');
      return;
    }
    setDeleteConfirmModal(col);
  };

  // Confirm delete handler (No window.confirm, 100% reliable in iframe)
  const handleConfirmDelete = async () => {
    if (!deleteConfirmModal) return;
    const colToDelete = deleteConfirmModal;
    
    try {
      const remaining = collections.filter((c) => c.id !== colToDelete.id);
      const reordered = remaining.map((item, idx) => ({ ...item, order: idx }));
      onUpdateCollections(reordered);

      await deleteCollectionFromFirestore(colToDelete.id);
      setSuccessMsg(`Đã xóa banner "${colToDelete.title}" thành công.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg('Lỗi xóa banner: ' + err.message);
    } finally {
      setDeleteConfirmModal(null);
    }
  };

  // Reset to default 3 showcases
  const handleResetDefaults = () => {
    setShowResetModal(true);
  };

  // Confirm Reset Defaults handler
  const handleConfirmReset = async () => {
    onUpdateCollections(COLLECTIONS_DATA);
    try {
      await Promise.all(COLLECTIONS_DATA.map((c) => saveCollectionToFirestore(c)));
      setSuccessMsg('Đã khôi phục 3 banner mặc định thành công!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.warn('Lỗi reset Firestore:', err);
      setErrorMsg('Lỗi khôi phục mặc định: ' + err.message);
    } finally {
      setShowResetModal(false);
    }
  };

  return (
    <div id="admin-banners-manager-container" className="space-y-5">
      
      {/* Header Info & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Quản Lý Banners & Bộ Sưu Tập
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Thay đổi vị trí (thứ tự), hình ảnh thumbnail, tiêu đề và màu sắc các banner lớn trên trang chủ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Live Preview Button */}
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-all shadow-xs flex items-center gap-1.5"
            title="Xem trực tiếp giao diện hiển thị các bộ sưu tập trên trang chủ"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Xem Trước Banner</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200"
          >
            Mặc Định
          </button>
          
          <button
            id="btn-add-new-banner"
            type="button"
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-all shadow-xs"
          >
            + Thêm Banner Mới
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Add / Edit Banner Form */}
      {isEditing && (
        <div id="banner-edit-modal-form" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              {editingColId ? 'Chỉnh Sửa Banner' : 'Thêm Banner Mới'}
            </h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100"
            >
              Đóng [X]
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              {/* 1. Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu Đề Lớn *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ví dụ: Hào Khí Non Sông, Nàng Thơ..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white font-bold"
                />
              </div>

              {/* 2. Badge */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Huy Hiệu / Tag Nhỏ Trên Cùng
                </label>
                <input
                  type="text"
                  value={formBadge}
                  onChange={(e) => setFormBadge(e.target.value)}
                  placeholder="Ví dụ: KỶ VẬT QUỐC KHÁNH 02/09..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              {/* 3. Subtitle */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Khẩu Hiệu / Phụ Đề
                </label>
                <input
                  type="text"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="Ví dụ: Kỷ vật phụ kiện Paracord thủ công..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              {/* 4. Button Text */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chữ Trên Nút Bấm
                </label>
                <input
                  type="text"
                  value={formButtonText}
                  onChange={(e) => setFormButtonText(e.target.value)}
                  placeholder="Ví dụ: Khám Phá BST..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              {/* 5. Target Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Liên Kết Danh Mục Sản Phẩm
                </label>
                <select
                  value={formCategoryKey}
                  onChange={(e) => setFormCategoryKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-white text-slate-900">
                      {cat.label} ({cat.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Theme Style */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kiểu Giao Diện Banner
                </label>
                <select
                  value={formThemeStyle}
                  onChange={(e) => setFormThemeStyle(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white font-semibold"
                >
                  <option value="light" className="bg-white text-slate-900">
                    Trắng Sáng Tinh Tế (Mặc định)
                  </option>
                  <option value="dark" className="bg-white text-slate-900">
                    Đen Huyền Bí (EDC / Tactical)
                  </option>
                  <option value="event0209" className="bg-white text-slate-900">
                    Huy Hoàng 02.09 (Red & Gold)
                  </option>
                </select>
              </div>

              {/* 7. Pre-order Switch & Visibility Switch */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2 md:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="form-is-preorder-cb"
                    checked={formIsPreorder}
                    onChange={(e) => setFormIsPreorder(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Kích hoạt luồng Đặt Trước (Pre-order nhận cọc)
                  </span>
                </label>

                <div className="h-4 w-px bg-slate-300 hidden sm:block" />

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="form-is-hidden-cb"
                    checked={formIsHidden}
                    onChange={(e) => setFormIsHidden(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer text-rose-500 focus:ring-rose-400"
                  />
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>🙈 Ẩn bộ sưu tập này</span>
                    <span className="text-[10px] font-normal text-slate-500">(Khách hàng không thấy trên website)</span>
                  </span>
                </label>
              </div>

              {/* 8. Image Uploads - 3 Distinct Upload Zones */}
              {/* Zone A: Horizontal Showcase Image for Landing */}
              <div className="md:col-span-2 space-y-2 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      1. Ảnh Thiết Kế Hàng Ngang (Hiển thị khi hover chuột ở Landing page)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Tỷ lệ khung ảnh ngang dài (16:7 hoặc 21:9) — Đổi ảnh tự động khi rê chuột ngoài Trang chủ.
                    </span>
                  </div>
                  {formHorizontalImage && (
                    <button
                      type="button"
                      onClick={() => setFormHorizontalImage('')}
                      className="text-[11px] text-rose-600 hover:underline font-bold"
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingHoriz(true);
                  }}
                  onDragLeave={() => setIsDraggingHoriz(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingHoriz(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processFileToState(file, setFormHorizontalImage);
                  }}
                  onClick={() => horizFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    isDraggingHoriz
                      ? 'border-amber-500 bg-amber-50'
                      : formHorizontalImage
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-300 bg-white/70 hover:border-amber-400'
                  }`}
                >
                  <input
                    type="file"
                    ref={horizFileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processFileToState(file, setFormHorizontalImage);
                      e.target.value = '';
                    }}
                    accept="image/*"
                    className="hidden"
                  />

                  {formHorizontalImage ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <div className="w-full sm:w-56 h-20 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center shrink-0">
                        <img src={formHorizontalImage} alt="Horizontal Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-800 block">Đã nạp ảnh thiết kế hàng ngang</span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">Kéo thả ảnh mới vào đây hoặc nhấp để đổi ảnh</span>
                        <span className="inline-block mt-1 px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-700">
                          Chọn ảnh khác
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 space-y-1">
                      <p className="text-xs font-bold text-slate-800">Kéo & Thả ảnh ngang vào đây</p>
                      <p className="text-[11px] text-slate-500">
                        hoặc <span className="text-amber-700 font-bold underline">nhấp chuột để chọn ảnh từ máy</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Zone B: Banner for Product Page */}
              <div className="md:col-span-2 space-y-2 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      2. Ảnh Banner Bộ Sưu Tập tại Trang Sản Phẩm
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Hiển thị đầu trang sản phẩm khi khách chọn bộ sưu tập này.
                    </span>
                  </div>
                  {formProductPageBanner && (
                    <button
                      type="button"
                      onClick={() => setFormProductPageBanner('')}
                      className="text-[11px] text-rose-600 hover:underline font-bold"
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingProdBanner(true);
                  }}
                  onDragLeave={() => setIsDraggingProdBanner(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingProdBanner(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processFileToState(file, setFormProductPageBanner);
                  }}
                  onClick={() => prodBannerFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    isDraggingProdBanner
                      ? 'border-amber-500 bg-amber-50'
                      : formProductPageBanner
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-300 bg-white/70 hover:border-amber-400'
                  }`}
                >
                  <input
                    type="file"
                    ref={prodBannerFileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processFileToState(file, setFormProductPageBanner);
                      e.target.value = '';
                    }}
                    accept="image/*"
                    className="hidden"
                  />

                  {formProductPageBanner ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <div className="w-full sm:w-56 h-20 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center shrink-0">
                        <img src={formProductPageBanner} alt="Product Page Banner Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-800 block">Đã nạp banner trang sản phẩm</span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">Kéo thả ảnh mới vào đây hoặc nhấp để đổi ảnh</span>
                        <span className="inline-block mt-1 px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-700">
                          Chọn ảnh khác
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 space-y-1">
                      <p className="text-xs font-bold text-slate-800">Kéo & Thả banner trang sản phẩm vào đây</p>
                      <p className="text-[11px] text-slate-500">
                        hoặc <span className="text-amber-700 font-bold underline">nhấp chuột để chọn ảnh từ máy</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Zone C: Main Artwork / Thumbnail */}
              <div className="md:col-span-2 space-y-2 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      3. Ảnh Nền & Thumbnail Chính Của Bộ Sưu Tập *
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Ảnh gốc chất lượng cao dùng cho danh mục, chi tiết và làm dự phòng.
                    </span>
                  </div>
                  {formImage && (
                    <button
                      type="button"
                      onClick={() => setFormImage('')}
                      className="text-[11px] text-rose-600 hover:underline font-bold"
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingMain(true);
                  }}
                  onDragLeave={() => setIsDraggingMain(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingMain(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processFileToState(file, setFormImage);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    isDraggingMain
                      ? 'border-amber-500 bg-amber-50'
                      : formImage
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-300 bg-white/70 hover:border-amber-400'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processFileToState(file, setFormImage);
                      e.target.value = '';
                    }}
                    accept="image/*"
                    className="hidden"
                  />

                  {formImage ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <div className="w-full sm:w-44 h-24 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <img src={formImage} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-800 block">Đã nạp hình ảnh chính</span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">Kéo thả ảnh mới vào đây hoặc nhấp để đổi ảnh</span>
                        <span className="inline-block mt-2 px-3 py-1 bg-white border border-slate-200 rounded text-[11px] font-bold text-slate-700 shadow-xs">
                          Chọn ảnh khác từ máy
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3 space-y-1">
                      <p className="text-xs font-bold text-slate-800">Kéo & Thả ảnh chính vào đây</p>
                      <p className="text-[11px] text-slate-500">
                        hoặc <span className="text-amber-700 font-bold underline">nhấp chuột để chọn ảnh từ máy</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Form Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                Hủy Bỏ
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-all"
              >
                {editingColId ? 'Lưu Thay Đổi' : 'Tạo Banner'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Banners List Header & Visibility Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">Hiển thị:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setCollectionVisibilityFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                collectionVisibilityFilter === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({collections.length})
            </button>
            <button
              type="button"
              onClick={() => setCollectionVisibilityFilter('visible')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                collectionVisibilityFilter === 'visible'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đang hiện ({collections.filter((c) => !c.isHidden).length})
            </button>
            <button
              type="button"
              onClick={() => setCollectionVisibilityFilter('hidden')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                collectionVisibilityFilter === 'hidden'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đang ẩn ({collections.filter((c) => !!c.isHidden).length})
            </button>
          </div>
        </div>

        <span className="text-[11px] text-slate-500 font-medium">
          Mẹo: Dùng nút <strong>Ẩn/Hiện</strong> để ẩn tạm thời BST chưa sẵn sàng mà không cần xóa.
        </span>
      </div>

      {/* Banners List */}
      <div className="space-y-3">
        {sortedCollections
          .filter((c) => {
            if (collectionVisibilityFilter === 'visible') return !c.isHidden;
            if (collectionVisibilityFilter === 'hidden') return !!c.isHidden;
            return true;
          })
          .map((col, index) => {
          const isTop = index === 0;
          const isBottom = index === sortedCollections.length - 1;

          return (
            <div
              key={col.id}
              id={`admin-banner-row-${col.id}`}
              className={`bg-white rounded-xl border p-4 transition-all shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                col.isHidden ? 'border-dashed border-rose-300 bg-rose-50/20' : 'border-slate-200'
              }`}
            >
              {/* Order & Position Controls */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="w-7 h-7 rounded bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center font-mono border border-slate-200 shrink-0">
                  #{index + 1}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={isTop}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold border border-slate-200"
                    title="Lên"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={isBottom}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold border border-slate-200"
                    title="Xuống"
                  >
                    ↓
                  </button>
                </div>

                {/* Thumbnail Image */}
                <div className="w-20 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 ml-1 relative">
                  <img
                    src={col.bannerImage || col.bgImage || '/assets/bracelet.jpg'}
                    alt={col.title}
                    className={`w-full h-full object-cover ${col.isHidden ? 'opacity-60 grayscale' : ''}`}
                  />
                  {col.isHidden && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[10px] text-white font-bold">
                      Đã ẩn
                    </div>
                  )}
                </div>

                {/* Banner Metadata Info */}
                <div className="space-y-0.5 min-w-0 flex-1 ml-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {col.title}
                    </span>
                    {col.isHidden ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        Đang ẩn
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Đang hiển thị
                      </span>
                    )}
                    {col.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {col.badge}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {col.subtitle || 'Không có phụ đề'}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                    <span>Kiểu: <strong className="text-slate-800">{col.themeStyle || 'Sáng'}</strong></span>
                    <span>•</span>
                    <span>Nút: <strong className="text-slate-800">{col.buttonText || 'Khám phá'}</strong></span>
                    <span>•</span>
                    <span>Danh mục: <strong className="text-slate-800">{col.categoryKey}</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleHideCollection(col)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    col.isHidden
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                  title={col.isHidden ? 'Hiển thị lại bộ sưu tập này trên website' : 'Ẩn bộ sưu tập khỏi website'}
                >
                  {col.isHidden ? 'Hiện BST' : 'Ẩn BST'}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(col)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-200"
                >
                  Sửa
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(col)}
                  className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors border border-transparent hover:border-rose-200"
                >
                  Xóa
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* ----------------------------------------------------
          LIVE PREVIEW MODAL FOR BANNERS & COLLECTIONS
         ---------------------------------------------------- */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl border border-slate-700 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                <span className="font-bold text-sm text-white">Xem Trước Banner Bộ Sưu Tập Trang Chủ (Live Preview)</span>
              </div>

              {/* Viewport switch & close */}
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-1 rounded-lg flex items-center gap-1 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                      previewDevice === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Máy tính</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                      previewDevice === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Điện thoại</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Mock Website Showcase */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-950 p-4 sm:p-6 flex justify-center">
              <div
                className={`transition-all duration-300 bg-[#0C0D11] text-white rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden flex flex-col p-4 sm:p-8 space-y-6 ${
                  previewDevice === 'mobile' ? 'w-[375px] my-auto min-h-[640px]' : 'w-full max-w-4xl'
                }`}
              >
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                    Khám Phá Các Bộ Sưu Tập Thủ Công
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    Bộ Sưu Tập Nổi Bật Trên Trang Chủ
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-md mx-auto">
                    Mỗi mẫu thắt mang một bản sắc độc bản và câu chuyện riêng biệt.
                  </p>
                </div>

                {/* Banner Cards Grid */}
                <div className={`grid gap-4 ${previewDevice === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {sortedCollections.map((col, idx) => (
                    <div
                      key={col.id}
                      className="group relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-lg aspect-[16/10] flex flex-col justify-end p-5 transition-all hover:border-amber-400/40"
                    >
                      <img
                        src={col.horizontalImage || col.bannerImage || col.bgImage || '/assets/bracelet.jpg'}
                        alt={col.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />

                      <div className="relative z-10 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                            #{idx + 1} {col.tag || 'Bộ Sưu Tập'}
                          </span>
                          {col.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400 text-neutral-950">
                              {col.badge}
                            </span>
                          )}
                        </div>

                        <h4 className="text-base sm:text-lg font-black text-white leading-snug">
                          {col.title}
                        </h4>

                        <p className="text-[11px] text-neutral-300 line-clamp-1">
                          {col.subtitle || 'Dây dù paracord 550lb chuẩn quân nhu chịu lực 250kg.'}
                        </p>

                        <div className="pt-1">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 border border-white/20"
                          >
                            <span>{col.buttonText || 'Khám Phá'}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
              <span className="text-slate-400">
                Hiển thị thứ tự và hình ảnh các banner theo thiết lập thực tế.
              </span>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE BANNER */}
      {deleteConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setDeleteConfirmModal(null)}
        >
          <div
            className="relative max-w-md w-full bg-white p-6 rounded-2xl border border-rose-200 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-base text-slate-900">Xóa Banner Bộ Sưu Tập</h3>
              <p className="text-xs text-slate-500 mt-0.5">Hành động cần xác nhận</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                Bạn có chắc chắn muốn xóa banner <span className="text-rose-600 font-bold">"{deleteConfirmModal.title}"</span> khỏi trang chủ?
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Banner sẽ bị gỡ bỏ khỏi giao diện hiển thị trang chủ và danh sách quản trị.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                id="btn-confirm-delete-banner"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM RESET DEFAULTS */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowResetModal(false)}
        >
          <div
            className="relative max-w-md w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-base text-slate-900">Khôi Phục Banner Mặc Định</h3>
              <p className="text-xs text-slate-500 mt-0.5">Đặt lại 3 banner gốc của hệ thống</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                Khôi phục lại 3 Banner Showcase mặc định (02/09, 20/10, Paracord EDC)?
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tất cả các banner tùy chỉnh hiện tại sẽ được thay thế bằng 3 bộ sưu tập chuẩn ban đầu.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Xác nhận khôi phục
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
