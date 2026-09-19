import React, { useState, useRef } from 'react';
import { CollectionInfo } from '../types';
import { saveCollectionToFirestore } from '../firebase';
import { THEME_PRESETS, compressImageFile } from './CollectionDetailPage';
import { 
  Sparkles, 
  Layers, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Eye, 
  Heart, 
  Plus, 
  Trash2, 
  Palette, 
  FileText, 
  ArrowRight,
  Info,
  Clock,
  ShieldCheck,
  Flag,
  Lock,
  UploadCloud,
  Camera,
  Loader2
} from 'lucide-react';

interface AdminCollectionPageEditorProps {
  collections: CollectionInfo[];
  onUpdateCollections: (collections: CollectionInfo[]) => void;
  onPreviewCollection?: (collectionId: string) => void;
}

export const AdminCollectionPageEditor: React.FC<AdminCollectionPageEditorProps> = ({
  collections,
  onUpdateCollections,
  onPreviewCollection
}) => {
  const [selectedId, setSelectedId] = useState<string>(collections[0]?.id || 'event_0209');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentCollection = collections.find((c) => c.id === selectedId) || collections[0];

  // Editable local state for the active collection
  const [formData, setFormData] = useState<CollectionInfo>(currentCollection);

  // Switch active collection
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const dataUrl = await compressImageFile(file);
      handleChange('bannerImage', dataUrl);
      handleChange('bgImage', dataUrl);
    } catch (err) {
      console.error('Lỗi upload ảnh banner:', err);
      alert('Không thể đọc file ảnh, vui lòng thử lại ảnh khác.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSelectCollection = (id: string) => {
    const found = collections.find((c) => c.id === id);
    if (found) {
      setSelectedId(id);
      setFormData(found);
      setSaveSuccess(false);
    }
  };

  const handleChange = (key: keyof CollectionInfo, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleCraftDetailChange = (index: number, value: string) => {
    const currentList = [...(formData.craftDetails || [])];
    currentList[index] = value;
    handleChange('craftDetails', currentList);
  };

  const handleAddCraftDetail = () => {
    const currentList = [...(formData.craftDetails || [])];
    currentList.push('Chi tiết chế tác thủ công mới...');
    handleChange('craftDetails', currentList);
  };

  const handleRemoveCraftDetail = (index: number) => {
    const currentList = [...(formData.craftDetails || [])].filter((_, i) => i !== index);
    handleChange('craftDetails', currentList);
  };

  const handleSave = async () => {
    const updatedCollections = collections.map((col) =>
      col.id === formData.id ? { ...formData } : col
    );

    // If new
    if (!collections.some((c) => c.id === formData.id)) {
      updatedCollections.push(formData);
    }

    onUpdateCollections(updatedCollections);
    localStorage.setItem('nak_collections', JSON.stringify(updatedCollections));
    localStorage.setItem('nak_collections_data', JSON.stringify(updatedCollections));
    try {
      await saveCollectionToFirestore(formData);
    } catch (err) {
      console.warn('Lỗi lưu collection lên Firestore:', err);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCreateNewCollection = () => {
    const newId = `collection_${Date.now()}`;
    const newCol: CollectionInfo = {
      id: newId,
      categoryKey: newId,
      tag: 'BỘ SƯU TẬP MỚI',
      title: 'Tên Bộ Sưu Tập Mới',
      highlight: 'Tuyệt Tác Thủ Công Giới Hạn',
      subtitle: 'Mô tả ngắn gọn về tinh thần và sự độc đáo của bộ sưu tập...',
      story: 'Chia sẻ câu chuyện thương hiệu và nguồn cảm hứng chế tác nên bộ sưu tập này...',
      craftDetails: [
        'Chất liệu dây đan cao cấp chịu tải trọng lớn',
        'Đan thủ công 100% từng nút thắt tỉ mỉ',
        'Phụ kiện charm hợp kim không gỉ sáng bóng'
      ],
      bgImage: '/assets/hero-bg.png',
      bannerImage: '/assets/hero-bg.png',
      isPreorder: false,
      status: 'available',
      badge: 'MỚI RA MẮT',
      themeColor: '#B41C1A',
      accentColor: 'from-neutral-950 via-neutral-900 to-black',
      buttonText: 'Khám Phá Bộ Sưu Tập',
      themeStyle: 'light',
      customDesignMode: true
    };

    const nextList = [...collections, newCol];
    onUpdateCollections(nextList);
    setSelectedId(newId);
    setFormData(newCol);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-stone-900 to-slate-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-black tracking-wider uppercase">
            <Layers className="w-3.5 h-3.5" />
            <span>Quản Lý & Thiết Kế Trang Riêng BST</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Tùy Chỉnh Giao Diện Bộ Sưu Tập
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Mỗi Bộ Sưu Tập có thể có trang thiết kế riêng biệt, cấu hình trạng thái <strong>Đã SOLD OUT</strong>, <strong>Mở Pre-Order</strong> hoặc <strong>Mở bán trực tiếp</strong>, cùng thông điệp tri ân độc quyền.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleCreateNewCollection}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center gap-2 border border-slate-700 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Thêm BST mới</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Lưu tất cả thay đổi</span>
          </button>
        </div>
      </div>

      {/* Save Success Alert */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-5 py-3 rounded-xl flex items-center gap-3 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Đã lưu thành công cấu hình trang Bộ Sưu Tập vào hệ thống!</span>
        </div>
      )}

      {/* Collection Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {collections.map((col) => {
          const isCurrent = col.id === selectedId;
          const isSoldOut = col.status === 'sold_out';
          const isPreorder = col.status === 'preorder' || col.isPreorder;

          return (
            <button
              key={col.id}
              type="button"
              onClick={() => handleSelectCollection(col.id)}
              className={`px-4 py-3 rounded-xl text-left transition-all shrink-0 border cursor-pointer flex items-center gap-3 ${
                isCurrent
                  ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-md font-bold'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black">{col.title}</span>
                  {isSoldOut ? (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isCurrent ? 'bg-slate-950 text-rose-400' : 'bg-rose-100 text-rose-700'}`}>
                      SOLD OUT
                    </span>
                  ) : isPreorder ? (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isCurrent ? 'bg-slate-950 text-amber-300' : 'bg-amber-100 text-amber-800'}`}>
                      PRE-ORDER
                    </span>
                  ) : (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isCurrent ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-100 text-emerald-800'}`}>
                      MỞ BÁN
                    </span>
                  )}
                </div>
                <p className={`text-[10px] truncate max-w-[180px] ${isCurrent ? 'text-slate-800' : 'text-slate-400'}`}>
                  {col.tag || col.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* MAIN FORM GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Configuration Controls (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* 1. STATUS & PRE-ORDER / SOLD OUT MODE */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs">01</span>
                <h3 className="text-sm font-bold text-slate-900">Trạng Thái Bán Hàng & Chế Độ Pre-Order</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono font-medium">ID: {formData.id}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: SOLD OUT */}
              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                  formData.status === 'sold_out'
                    ? 'border-rose-500 bg-rose-50/50 text-rose-950 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-700">★ ĐÃ SOLD OUT</span>
                  <input
                    type="radio"
                    name="status_radio"
                    checked={formData.status === 'sold_out'}
                    onChange={() => {
                      handleChange('status', 'sold_out');
                      handleChange('isPreorder', false);
                      handleChange('badge', 'ĐÃ SOLD OUT');
                    }}
                    className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                  />
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Đã hết slot / Hết hàng. Tắt form đăng ký và hiển thị khung thông báo tri ân đặc biệt.
                </p>
              </label>

              {/* Option 2: PRE-ORDER */}
              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                  formData.status === 'preorder' || (formData.isPreorder && formData.status !== 'sold_out')
                    ? 'border-amber-500 bg-amber-50/50 text-amber-950 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-700">ĐĂNG KÝ ĐẶT TRƯỚC</span>
                  <input
                    type="radio"
                    name="status_radio"
                    checked={formData.status === 'preorder' || (formData.isPreorder && formData.status !== 'sold_out')}
                    onChange={() => {
                      handleChange('status', 'preorder');
                      handleChange('isPreorder', true);
                      handleChange('badge', 'Đăng Ký Đặt Trước');
                    }}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Mở form nhận đăng ký thông tin đặt trước sớm kèm đồng hồ đếm ngược.
                </p>
              </label>

              {/* Option 3: AVAILABLE */}
              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                  formData.status === 'available' && !formData.isPreorder
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-700">MỞ BÁN TRỰC TIẾP</span>
                  <input
                    type="radio"
                    name="status_radio"
                    checked={formData.status === 'available' && !formData.isPreorder}
                    onChange={() => {
                      handleChange('status', 'available');
                      handleChange('isPreorder', false);
                      handleChange('badge', 'SẴN HÀNG');
                    }}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Khách hàng có thể thêm vào giỏ hàng và thanh toán trực tiếp bình thường.
                </p>
              </label>
            </div>

            {/* IF SOLD OUT: CUSTOMIZE SOLD OUT MESSAGE ACCORDING TO USER'S POST */}
            {formData.status === 'sold_out' && (
              <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-rose-50 via-stone-50 to-amber-50 border border-rose-200 space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                  <Heart className="w-4 h-4 text-rose-600 fill-rose-600" />
                  <span>Nội Dung Thông Báo Sold Out & Tri Ân (Theo bài đăng)</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tiêu đề thông báo Sold Out
                    </label>
                    <input
                      type="text"
                      value={formData.soldOutTitle || '[PRE-ORDER 02.09] SOLD OUT! ❤️'}
                      onChange={(e) => handleChange('soldOutTitle', e.target.value)}
                      placeholder="[PRE-ORDER 02.09] SOLD OUT! ❤️"
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-rose-300 rounded-lg outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Huy hiệu phụ & Dải ruy băng vinh danh
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={formData.soldOutBadge || 'THÔNG BÁO CHÍNH THỨC'}
                        onChange={(e) => handleChange('soldOutBadge', e.target.value)}
                        placeholder="THÔNG BÁO CHÍNH THỨC"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        value={formData.soldOutRibbon || '★ TOÀN BỘ DANH MỤC ★'}
                        onChange={(e) => handleChange('soldOutRibbon', e.target.value)}
                        placeholder="★ TOÀN BỘ DANH MỤC ★"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nội dung thư tri ân gửi khách hàng
                    </label>
                    <textarea
                      rows={3}
                      value={formData.soldOutMessage || 'Bộ sưu tập Hào Khí 02.09 đã chính thức SOLD OUT chỉ sau một thời gian ngắn mở bán. Not A Knot xin gửi lời cảm ơn chân thành nhất đến bạn vì đã lựa chọn mang theo tinh thần Việt Nam trên mỗi hành trình. Sự yêu thương của mọi người chính là niềm tự hào lớn nhất của chúng mình! ✨'}
                      onChange={(e) => handleChange('soldOutMessage', e.target.value)}
                      placeholder="Nhập thông điệp tri ân cảm ơn khách hàng..."
                      className="w-full px-3 py-2 text-xs bg-white border border-rose-300 rounded-lg outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Lời kết / Hẹn ước BST tiếp theo
                    </label>
                    <input
                      type="text"
                      value={formData.soldOutNote || 'Hẹn gặp lại bạn trong những BST tiếp theo nhé!'}
                      onChange={(e) => handleChange('soldOutNote', e.target.value)}
                      placeholder="Hẹn gặp lại bạn trong những BST tiếp theo nhé!"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-amber-500 font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. HERO & BASIC INFORMATION */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs">02</span>
              <h3 className="text-sm font-bold text-slate-900">Tiêu Đề & Ảnh Nền Hero Banner</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Tên BST (Title)</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Ví dụ: Hào Khí Non Sông"
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Thẻ định danh (Tag)</label>
                <input
                  type="text"
                  value={formData.tag || ''}
                  onChange={(e) => handleChange('tag', e.target.value)}
                  placeholder="Ví dụ: KỶ VẬT QUỐC KHÁNH 02/09"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Khẩu hiệu / Highlight</label>
                <input
                  type="text"
                  value={formData.highlight || ''}
                  onChange={(e) => handleChange('highlight', e.target.value)}
                  placeholder="Ví dụ: Kỷ Vật Tự Hào Dân Tộc — Tết Độc Lập"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Nút bấm CTA</label>
                <input
                  type="text"
                  value={formData.buttonText || ''}
                  onChange={(e) => handleChange('buttonText', e.target.value)}
                  placeholder="Xem Chi Tiết & Đặt Trước"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Mô tả chi tiết bộ sưu tập (Description) — Hiển thị ngay dưới tên BST
                </label>
                <textarea
                  rows={3}
                  value={formData.description || formData.story || ''}
                  onChange={(e) => {
                    handleChange('description', e.target.value);
                    if (!formData.story) handleChange('story', e.target.value);
                  }}
                  placeholder="Nhập mô tả giới thiệu bộ sưu tập (ví dụ: Chào đón mùa tựu trường cùng BST Back To School từ NOT A KNOT! Mang phong cách trẻ trung, bền bỉ với những nút thắt thủ công năng động...)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500 leading-relaxed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Mô tả ngắn gọn (Subtitle)</label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => handleChange('subtitle', e.target.value)}
                  placeholder="Kỷ vật phụ kiện thủ công phiên bản giới hạn..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              {/* Banner Image & Upload from Device */}
              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Ảnh Banner / Ảnh Bìa Bộ Sưu Tập (bannerImage / bgImage)
                  </label>
                  <span className="text-[10px] text-slate-500">Tải ảnh từ máy hoặc nhập URL</span>
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.bannerImage || formData.bgImage || ''}
                    onChange={(e) => {
                      handleChange('bannerImage', e.target.value);
                      handleChange('bgImage', e.target.value);
                    }}
                    placeholder="/assets/hero-bg.png hoặc URL ảnh..."
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {isUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5" />
                    )}
                    <span>Tải tệp từ máy</span>
                  </button>
                  {(formData.bannerImage || formData.bgImage) && (
                    <img
                      src={formData.bannerImage || formData.bgImage}
                      alt="Thumbnail"
                      className="w-9 h-9 object-cover rounded-lg border border-slate-200 shrink-0"
                    />
                  )}
                </div>

                {/* Banner Display Mode */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[11px] font-bold text-slate-600">Kiểu hiển thị banner:</span>
                  <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="banner_mode"
                      checked={formData.bannerDisplayMode !== 'featured_card'}
                      onChange={() => handleChange('bannerDisplayMode', 'cover_hero')}
                      className="text-amber-600"
                    />
                    <span>Ảnh nền Hero tràn viền</span>
                  </label>
                  <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="banner_mode"
                      checked={formData.bannerDisplayMode === 'featured_card'}
                      onChange={() => handleChange('bannerDisplayMode', 'featured_card')}
                      className="text-amber-600"
                    />
                    <span>Thẻ ảnh bìa tạp chí</span>
                  </label>
                </div>
              </div>

              {/* Background Color Customization */}
              <div className="sm:col-span-2 space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-amber-600" />
                    <span>Màu Nền Trang Bộ Sưu Tập (bgColor)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Màu nền dịu mắt làm nổi bật sản phẩm</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {THEME_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        handleChange('bgColor', p.bg);
                        handleChange('themeStyle', p.isDark ? 'dark' : 'light');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        (formData.bgColor || '#FAF7F2').toLowerCase() === p.bg.toLowerCase()
                          ? 'border-amber-500 ring-2 ring-amber-500 bg-amber-50 text-amber-950 font-bold'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: p.bg }} />
                      <span>{p.name}</span>
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[11px] text-slate-500">Tự chọn:</span>
                    <input
                      type="color"
                      value={formData.bgColor?.startsWith('#') ? formData.bgColor : '#FAF7F2'}
                      onChange={(e) => handleChange('bgColor', e.target.value)}
                      className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={formData.bgColor || '#FAF7F2'}
                      onChange={(e) => handleChange('bgColor', e.target.value)}
                      className="w-20 px-2 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded text-center"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. STORY & CRAFT DETAILS */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs">03</span>
              <h3 className="text-sm font-bold text-slate-900">Câu Chuyện Thương Hiệu & Điểm Chế Tác</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nội dung câu chuyện (Story Paragraph)
                </label>
                <textarea
                  rows={4}
                  value={formData.story || ''}
                  onChange={(e) => handleChange('story', e.target.value)}
                  placeholder="Kể về nguồn cảm hứng, lịch sử và ý nghĩa của từng nút thắt..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500 leading-relaxed"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-slate-700">
                    Danh sách đặc điểm chế tác thủ công ({formData.craftDetails?.length || 0})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCraftDetail}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm dòng</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(formData.craftDetails || []).map((detail, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={detail}
                        onChange={(e) => handleCraftDetailChange(idx, e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCraftDetail(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Xóa dòng này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Card Preview & Details (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Visual Preview Card */}
          <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-lg border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Xem Trước Thẻ BST</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-amber-400">Preview</span>
            </div>

            {/* Card Mockup */}
            <div className="relative rounded-xl overflow-hidden aspect-[4/3] border border-white/10 bg-slate-950 flex flex-col justify-end p-4">
              {formData.bgImage && (
                <img
                  src={formData.bgImage}
                  alt={formData.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              {/* Status Badge */}
              <div className="relative z-10 space-y-1.5">
                {formData.status === 'sold_out' ? (
                  <span className="inline-block px-2.5 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-sm">
                    ★ ĐÃ SOLD OUT
                  </span>
                ) : formData.isPreorder ? (
                  <span className="inline-block px-2.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full uppercase tracking-wider shadow-sm">
                    PRE-ORDER
                  </span>
                ) : (
                  <span className="inline-block px-2.5 py-0.5 bg-emerald-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-sm">
                    MỞ BÁN
                  </span>
                )}

                <h4 className="font-black text-white text-base leading-tight">
                  {formData.title}
                </h4>
                <p className="text-slate-300 text-[11px] line-clamp-2 leading-relaxed">
                  {formData.subtitle}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu BST này</span>
              </button>

              {onPreviewCollection && (
                <button
                  type="button"
                  onClick={() => onPreviewCollection(formData.id)}
                  className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Xem trang thực tế trên Web</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Guide Card */}
          <div className="bg-amber-50/80 rounded-2xl p-5 border border-amber-200/80 text-amber-950 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-amber-900">
              <Info className="w-4 h-4 text-amber-600" />
              <span>Ghi Chú Hướng Dẫn</span>
            </div>
            <p className="text-xs text-amber-900/90 leading-relaxed">
              • <strong>BST 02/09 (Hào Khí Non Sông):</strong> Đã được chuyển sang trạng thái <strong>Đã SOLD OUT</strong> và tắt form đăng ký đặt trước theo đúng thông báo trên Facebook.
            </p>
            <p className="text-xs text-amber-900/90 leading-relaxed">
              • <strong>Các BST tương lai:</strong> Bạn có thể tạo thêm nhiều bộ sưu tập mới với trang thiết kế riêng biệt bất cứ lúc nào.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
