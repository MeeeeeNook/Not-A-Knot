import React, { useState, useRef } from 'react';
import { 
  Share2, 
  Save, 
  Upload, 
  ExternalLink, 
  Eye, 
  RefreshCw, 
  Sparkles, 
  Layers, 
  Image as ImageIcon,
  CheckCircle2,
  Sliders,
  Smartphone,
  Monitor,
  CloudUpload,
  Check
} from 'lucide-react';
import { SiteContentConfig, SocialFeedConfig, SocialFeedPost } from '../../types';
import { saveSiteContentToFirestore, uploadBase64ToStorage } from '../../firebase';

interface AdminSocialFeedManagerProps {
  siteContent: SiteContentConfig;
  onUpdateSiteContent: (newConfig: SiteContentConfig) => void;
}

export const AdminSocialFeedManager: React.FC<AdminSocialFeedManagerProps> = ({
  siteContent,
  onUpdateSiteContent
}) => {
  const [feedConfig, setFeedConfig] = useState<SocialFeedConfig>(() => {
    return siteContent.socialFeed || {
      title: 'GÓC TIN TỨC',
      subtitle: 'Theo dõi chúng tôi trên Facebook & Instagram để cập nhật các mẫu thiết kế mới, câu chuyện hậu trường và ưu đãi độc quyền.',
      badge: 'MẠNG XÃ HỘI & HOẠT ĐỘNG',
      isActive: true,
      posts: [
        {
          id: 'post-1',
          image: '/assets/about-story.jpg',
          caption: 'Hậu trường chế tác từng nút thắt thủ công tỉ mỉ cho bộ sưu tập độc bản Not A Knot.\n\nMỗi sản phẩm là một câu chuyện kết nối.',
          url: 'https://www.facebook.com/profile.php?id=61593591390851',
          gradient: 'bg-white/85',
          borderColor: 'border-black'
        },
        {
          id: 'post-2',
          image: '/assets/img_4_NOT_A_KNOT.jpg',
          caption: 'BST Nàng Thơ 20/10 — Sự hòa quyện giữa charm hoa ngọt ngào và dây đan pastel dịu êm.',
          url: 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==',
          gradient: 'bg-white/85',
          borderColor: 'border-black'
        },
        {
          id: 'post-3',
          image: '/assets/hero-bg.png',
          caption: 'Phiên bản đặc biệt 02/09 — Năng lượng tự hào non sông trong từng nét đan thủ công.',
          url: 'https://www.facebook.com/profile.php?id=61593591390851',
          gradient: 'bg-white/85',
          borderColor: 'border-black'
        },
        {
          id: 'post-4',
          image: '/assets/img_0.jpg',
          caption: 'Gợi ý phối vòng charm phong cách tối giản cho outfit dạo phố cuối tuần thêm nổi bật.',
          url: 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==',
          gradient: 'bg-white/85',
          borderColor: 'border-black'
        },
        {
          id: 'post-5',
          image: '/assets/image_4.jpg',
          caption: 'Dây đeo Everyday Wear êm ái, bền chắc trên cổ tay suốt ngày dài học tập và làm việc.',
          url: 'https://www.facebook.com/profile.php?id=61593591390851',
          gradient: 'bg-white/85',
          borderColor: 'border-black'
        }
      ]
    };
  });

  const [selectedCardIdx, setSelectedCardIdx] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentPost = feedConfig.posts[selectedCardIdx] || feedConfig.posts[0];

  const handleUpdatePostField = (field: keyof SocialFeedPost, val: string) => {
    setFeedConfig((prev) => {
      const nextPosts = [...prev.posts];
      nextPosts[selectedCardIdx] = {
        ...nextPosts[selectedCardIdx],
        [field]: val
      };
      return { ...prev, posts: nextPosts };
    });
  };

  const handleFileProcess = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn hoặc thả file hình ảnh (PNG, JPG, WEBP)!');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert('File ảnh quá lớn (> 25MB). Vui lòng chọn ảnh dung lượng nhỏ hơn.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          try {
            const cloudUrl = await uploadBase64ToStorage(
              base64,
              `social_feed/card_${selectedCardIdx + 1}_${Date.now()}.png`
            );
            handleUpdatePostField('image', cloudUrl);
          } catch (cloudErr) {
            console.warn('Lỗi tải ảnh lên đám mây, dùng fallback base64:', cloudErr);
            handleUpdatePostField('image', base64);
          }
        }
        setIsUploadingImage(false);
      };
      reader.onerror = () => {
        setIsUploadingImage(false);
        alert('Không thể đọc file ảnh đã chọn.');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Lỗi xử lý file ảnh:', err);
      setIsUploadingImage(false);
    }
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      const updatedSiteContent: SiteContentConfig = {
        ...siteContent,
        socialFeed: feedConfig
      };

      onUpdateSiteContent(updatedSiteContent);
      await saveSiteContentToFirestore(updatedSiteContent);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Lỗi lưu cấu hình Social Feed:', err);
      alert('Đã xảy ra lỗi khi lưu cấu hình lên máy chủ.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-sans pb-16">
      
      {/* Top Banner Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-600">
            <Share2 className="w-4 h-4" />
            <span>Quản trị Trang Chủ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Quản Lý Góc Tin Tức
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>Đã lưu và đồng bộ thành công cấu hình bản tin mạng xã hội lên hệ thống!</span>
        </div>
      )}

      {/* Main Grid: Card Selector + Form Editor + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* LEFT COLUMN: Section Settings & Card Form (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* 1. Global Section Info */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-500" />
              <span>Tiêu Đề & Hiển Thị Section</span>
            </h2>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Kích hoạt hiển thị trên Trang Chủ</span>
                <span className="text-[11px] text-slate-500">Bật/tắt toàn bộ section mạng xã hội trên landing page</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={feedConfig.isActive !== false}
                  onChange={(e) => setFeedConfig((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tiêu đề chính Section (Đồng bộ font & size chuẩn thương hiệu)
              </label>
              <input
                type="text"
                value={feedConfig.title || ''}
                onChange={(e) => setFeedConfig((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold uppercase tracking-wider focus:outline-none focus:border-amber-500"
                placeholder="GÓC TIN TỨC"
              />
            </div>
          </div>

          {/* 2. Choose Card to Edit (Tabs 1 to 5) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>Chọn Ô Cần Chỉnh Sửa ({selectedCardIdx + 1}/5)</span>
              </h2>
              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                {selectedCardIdx === 0 ? 'Ô Lớn Nổi Bật (Bên Trái)' : `Ô Phụ Nhỏ #${selectedCardIdx + 1}`}
              </span>
            </div>

            {/* Visual 5-Card Grid Selector Button */}
            <div className="grid grid-cols-5 gap-2 select-none">
              {feedConfig.posts.map((post, idx) => (
                <button
                  key={post.id || idx}
                  type="button"
                  onClick={() => setSelectedCardIdx(idx)}
                  className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedCardIdx === idx
                      ? 'border-black bg-slate-900 text-white shadow-xs font-black'
                      : 'border-slate-200 hover:border-slate-400 bg-white text-slate-700 font-semibold'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={post.image} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[11px]">Card {idx + 1}</span>
                </button>
              ))}
            </div>

            <hr className="border-slate-100" />

            {/* Individual Card Form */}
            <div className="space-y-4">
              
              {/* Photo Upload & Drag-and-Drop Zone */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">Ảnh bài viết</label>
                
                {/* Drag and Drop Box */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-4 transition-all cursor-pointer flex flex-col sm:flex-row items-center gap-4 ${
                    isDraggingOver
                      ? 'border-amber-500 bg-amber-50 scale-[1.01]'
                      : 'border-slate-200 hover:border-amber-400 bg-slate-50/70 hover:bg-amber-50/20'
                  }`}
                >
                  {/* Current image preview */}
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 bg-white shrink-0 shadow-2xs relative">
                    <img
                      src={currentPost.image}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).setAttribute('src', '/assets/about-story.jpg');
                      }}
                    />
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                        <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                      </div>
                    )}
                  </div>

                  {/* Dropzone text */}
                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-slate-800">
                      <CloudUpload className="w-4 h-4 text-amber-600" />
                      <span>{isUploadingImage ? 'Đang xử lý tải ảnh...' : 'Kéo thả ảnh vào đây hoặc bấm để chọn'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Hỗ trợ định dạng PNG, JPG, WEBP. Ảnh hiển thị trọn vẹn theo phong cách kính mờ.
                    </p>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageFileUpload}
                    className="hidden"
                  />
                </div>

                {/* Direct image link input */}
                <div>
                  <input
                    type="text"
                    value={currentPost.image}
                    onChange={(e) => handleUpdatePostField('image', e.target.value)}
                    placeholder="Hoặc dán URL ảnh trực tiếp (https://..., /assets/...)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Caption / Description with Line Break Support */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800">Lời dẫn bài viết (Caption & Mô tả chi tiết)</label>
                  <span className="text-[11px] text-slate-400">Hỗ trợ xuống dòng (Enter) thoải mái</span>
                </div>
                <textarea
                  rows={4}
                  value={currentPost.caption}
                  onChange={(e) => handleUpdatePostField('caption', e.target.value)}
                  placeholder="Nhập mô tả bài viết. Bạn có thể nhấn phím Enter để xuống dòng theo ý muốn..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-amber-500 resize-y whitespace-pre-line leading-relaxed"
                />
              </div>

              {/* Link URL */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Đường dẫn liên kết khi nhấn vào ô (Facebook / Instagram Post URL)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={currentPost.url}
                    onChange={(e) => handleUpdatePostField('url', e.target.value)}
                    placeholder="https://www.facebook.com/..."
                    className="w-full px-3.5 py-2.5 pr-9 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                  <a
                    href={currentPost.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-600"
                    title="Mở thử liên kết"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Styling note */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 block">Định dạng hiển thị chuẩn:</span>
                <p className="text-[11px] text-slate-500">
                  Tất cả các card được tự động áp dụng lớp kính mờ trắng tinh tế (<code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">white tinted glass</code>) với đường viền đen sắc nét (<code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">black border</code>), không còn dải gradient màu mè.
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Live Interactive Preview (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4 sticky top-20">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-500" />
              <span>Xem Trước Trực Tiếp</span>
            </h2>

            {/* Toggle Desktop vs Mobile Preview */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  previewMode === 'desktop' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>PC (1+2×2)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  previewMode === 'mobile' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile (3 Card)</span>
              </button>
            </div>
          </div>

          {/* PREVIEW CONTAINER */}
          <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-black/80 overflow-hidden space-y-3">
            {/* Header Preview - Line-free, matching exact typography */}
            <div className="text-center py-1">
              <h3 className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-stone-900">
                {feedConfig.title || 'GÓC TIN TỨC'}
              </h3>
            </div>

            {previewMode === 'desktop' ? (
              /* Desktop 1+2x2 Preview */
              <div className="grid grid-cols-12 gap-2.5 h-[280px]">
                {/* Card 1 */}
                <div 
                  onClick={() => setSelectedCardIdx(0)}
                  className={`col-span-5 h-full relative rounded-2xl overflow-hidden border border-black bg-white/85 backdrop-blur-md cursor-pointer transition-all ${
                    selectedCardIdx === 0 ? 'ring-2 ring-amber-500 shadow-md' : ''
                  }`}
                >
                  <div className="w-full h-full flex items-center justify-center p-1">
                    <img src={feedConfig.posts[0]?.image} alt="" className="w-full h-full max-w-full max-h-full object-contain" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/45 to-transparent p-2.5 flex flex-col justify-end text-white">
                    <p className="text-[10px] font-medium whitespace-pre-line leading-tight text-stone-100 max-h-[75%] overflow-y-auto">
                      {feedConfig.posts[0]?.caption}
                    </p>
                  </div>
                </div>

                {/* Cards 2..5 */}
                <div className="col-span-7 grid grid-cols-2 gap-2.5 h-full">
                  {feedConfig.posts.slice(1, 5).map((p, i) => {
                    const realIdx = i + 1;
                    return (
                      <div
                        key={p.id || realIdx}
                        onClick={() => setSelectedCardIdx(realIdx)}
                        className={`h-[132px] relative rounded-2xl overflow-hidden border border-black bg-white/85 backdrop-blur-md cursor-pointer transition-all ${
                          selectedCardIdx === realIdx ? 'ring-2 ring-amber-500 shadow-md' : ''
                        }`}
                      >
                        <div className="w-full h-full flex items-center justify-center p-1">
                          <img src={p.image} alt="" className="w-full h-full max-w-full max-h-full object-contain" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/45 to-transparent p-2 flex flex-col justify-end text-white">
                          <p className="text-[9px] font-medium whitespace-pre-line leading-tight text-stone-100 max-h-[75%] overflow-y-auto">
                            {p.caption}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Mobile 3-Card Balanced Full-Height Preview */
              <div className="flex items-center justify-center gap-2.5 min-h-[200px] relative overflow-hidden py-2">
                {/* Left Card (Prev) - Full Height with soft blur */}
                <div 
                  onClick={() => setSelectedCardIdx((selectedCardIdx - 1 + feedConfig.posts.length) % feedConfig.posts.length)}
                  className="w-[50px] h-[170px] rounded-2xl overflow-hidden opacity-70 hover:opacity-90 border border-black shadow-sm shrink-0 cursor-pointer transition-all relative flex items-center justify-center bg-white/70 backdrop-blur-md"
                  title="Xem ô trước"
                >
                  <img 
                    src={feedConfig.posts[(selectedCardIdx - 1 + feedConfig.posts.length) % feedConfig.posts.length]?.image} 
                    alt="" 
                    className="w-full h-full object-cover object-center blur-[0.5px] scale-102" 
                  />
                  <div className="absolute inset-0 bg-stone-950/10" />
                </div>

                {/* Center Active Card - Pure Square */}
                <div className="w-[170px] h-[170px] aspect-square rounded-3xl overflow-hidden border-2 border-black shadow-xl z-20 shrink-0 relative bg-white/90 backdrop-blur-xl flex items-center justify-center">
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none z-30" />
                  <img src={currentPost.image} alt="" className="w-full h-full object-cover object-center" />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/45 to-transparent p-3 flex flex-col justify-end text-white">
                    <p className="text-[10px] font-medium whitespace-pre-line leading-tight mb-1 max-h-[70%] overflow-y-auto">
                      {currentPost.caption}
                    </p>
                    <span className="text-[9px] font-bold bg-white/25 px-2 py-0.5 rounded-md text-center">Xem bài viết ↗</span>
                  </div>
                </div>

                {/* Right Card (Next) - Full Height with soft blur */}
                <div 
                  onClick={() => setSelectedCardIdx((selectedCardIdx + 1) % feedConfig.posts.length)}
                  className="w-[50px] h-[170px] rounded-2xl overflow-hidden opacity-70 hover:opacity-90 border border-black shadow-sm shrink-0 cursor-pointer transition-all relative flex items-center justify-center bg-white/70 backdrop-blur-md"
                  title="Xem ô sau"
                >
                  <img 
                    src={feedConfig.posts[(selectedCardIdx + 1) % feedConfig.posts.length]?.image} 
                    alt="" 
                    className="w-full h-full object-cover object-center blur-[0.5px] scale-102" 
                  />
                  <div className="absolute inset-0 bg-stone-950/10" />
                </div>
              </div>
            )}
          </div>

          <div className="text-center">
            <span className="text-xs text-slate-400">
              Nhấn trực tiếp vào bất kỳ ô nào trong khung xem trước để chuyển nhanh sang chỉnh sửa ô đó.
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};


