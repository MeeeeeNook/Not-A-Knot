import React from 'react';
import { Camera, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface AdminProductCustomPhotoSectionProps {
  formEnableCustomPhoto: boolean;
  setFormEnableCustomPhoto: (val: boolean) => void;
  formCustomPhotoTitle: string;
  setFormCustomPhotoTitle: (val: string) => void;
  formCustomPhotoDescription: string;
  setFormCustomPhotoDescription: (val: string) => void;
  formCustomPhotoPriceDelta: number;
  setFormCustomPhotoPriceDelta: (val: number) => void;
  formCustomPhotoRequired: boolean;
  setFormCustomPhotoRequired: (val: boolean) => void;
  formCustomPhotoAspectRatio: string;
  setFormCustomPhotoAspectRatio: (val: string) => void;
}

export const AdminProductCustomPhotoSection: React.FC<AdminProductCustomPhotoSectionProps> = ({
  formEnableCustomPhoto,
  setFormEnableCustomPhoto,
  formCustomPhotoTitle,
  setFormCustomPhotoTitle,
  formCustomPhotoDescription,
  setFormCustomPhotoDescription,
  formCustomPhotoPriceDelta,
  setFormCustomPhotoPriceDelta,
  formCustomPhotoRequired,
  setFormCustomPhotoRequired,
  formCustomPhotoAspectRatio,
  setFormCustomPhotoAspectRatio,
}) => {
  const TITLE_SUGGESTIONS = [
    'In ảnh theo yêu cầu',
    'Lồng ảnh kỷ niệm',
    'In ảnh Polaroid mini',
    'In ảnh mặt dây / charm',
    'Lồng ảnh thú cưng / người thương'
  ];

  const PRICE_PRESETS = [0, 5000, 10000, 15000, 20000, 25000];

  const ASPECT_RATIO_OPTIONS = [
    { value: 'square', label: 'Vuông (1:1)', desc: 'Phù hợp mặt dây vuông, charm vuông' },
    { value: 'circle', label: 'Tròn (Mặt dây tròn)', desc: 'Phù hợp charm tròn, huy hiệu, locket' },
    { value: 'portrait', label: 'Dọc (3:4)', desc: 'Phù hợp khung ảnh đứng, polaroid mini' },
    { value: 'free', label: 'Tự do', desc: 'Không giới hạn tỷ lệ' }
  ];

  return (
    <div className="p-3.5 bg-rose-50/40 rounded-xl border border-rose-200/70 space-y-3.5">
      {/* Master Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={formEnableCustomPhoto}
            onChange={(e) => {
              setFormEnableCustomPhoto(e.target.checked);
            }}
            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-rose-600" />
              <span>Bật tùy chọn tải/lồng ảnh theo yêu cầu (Custom Photo)</span>
            </span>
            <span className="block text-[11px] text-slate-500">
              Cho phép khách hàng tải ảnh cá nhân (kỷ niệm, chân dung, idol, thú cưng) để thợ thủ công in và lồng vào sản phẩm.
            </span>
          </div>
        </label>

        {formEnableCustomPhoto && (
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer shadow-2xs">
            <input
              type="checkbox"
              checked={formCustomPhotoRequired}
              onChange={(e) => setFormCustomPhotoRequired(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500"
            />
            <span>Bắt buộc tải ảnh khi đặt hàng</span>
          </label>
        )}
      </div>

      {/* Expanded Settings */}
      {formEnableCustomPhoto && (
        <div className="space-y-3 pt-1 border-t border-rose-200/60 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Title */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Tên hiển thị nhóm tùy chọn:
              </label>
              <input
                type="text"
                value={formCustomPhotoTitle}
                onChange={(e) => setFormCustomPhotoTitle(e.target.value)}
                placeholder="VD: In ảnh theo yêu cầu, Lồng ảnh kỷ niệm..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-rose-400 font-semibold text-slate-900 shadow-2xs"
              />
              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {TITLE_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setFormCustomPhotoTitle(sug)}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-rose-700 hover:border-rose-300 transition-colors cursor-pointer"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Delta */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Phụ thu tiền in ảnh (VNĐ):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formCustomPhotoPriceDelta}
                  onChange={(e) => setFormCustomPhotoPriceDelta(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="0 (Miễn phí)"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-rose-400 font-bold text-slate-900 shadow-2xs"
                />
                <span className="text-xs font-bold text-slate-500 shrink-0">đ</span>
              </div>
              {/* Quick price presets */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {PRICE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFormCustomPhotoPriceDelta(p)}
                    className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold transition-colors cursor-pointer ${
                      formCustomPhotoPriceDelta === p
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300'
                    }`}
                  >
                    {p === 0 ? 'Miễn phí' : `+${p.toLocaleString('vi-VN')}đ`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Aspect Ratio / Shape Format */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
              Kiểu dáng khung in hiển thị cho khách:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ASPECT_RATIO_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => setFormCustomPhotoAspectRatio(opt.value)}
                  className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                    formCustomPhotoAspectRatio === opt.value
                      ? 'bg-white border-rose-500 ring-2 ring-rose-400/20 shadow-xs'
                      : 'bg-white/80 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="customPhotoAspectRatio"
                      checked={formCustomPhotoAspectRatio === opt.value}
                      onChange={() => setFormCustomPhotoAspectRatio(opt.value)}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs font-bold text-slate-800">{opt.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Guideline description for customer */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Lời dặn / Hướng dẫn khách tải ảnh:
            </label>
            <textarea
              rows={2}
              value={formCustomPhotoDescription}
              onChange={(e) => setFormCustomPhotoDescription(e.target.value)}
              placeholder="VD: Quý khách vui lòng chọn ảnh rõ nét, chụp chính diện hoặc chân dung để thợ lồng ảnh đẹp nhất..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-rose-400 text-slate-800 shadow-2xs resize-none"
            />
          </div>

          {/* Preview demo badge */}
          <div className="p-2.5 bg-white rounded-xl border border-rose-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Giao diện khách nhìn thấy:</span>
              <strong className="text-slate-900">{formCustomPhotoTitle || 'In ảnh theo yêu cầu'}</strong>
            </span>
            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              {formCustomPhotoPriceDelta > 0
                ? `+${formCustomPhotoPriceDelta.toLocaleString('vi-VN')}đ`
                : 'Miễn phí in ảnh'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
