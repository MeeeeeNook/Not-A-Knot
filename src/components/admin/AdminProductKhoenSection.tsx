import React, { useState } from 'react';
import { Upload, GripVertical, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { ProductKhoenOption } from '../../types';
import { DEFAULT_KHOEN_PRESETS } from '../../data/sampleKhoen';

interface AdminProductKhoenSectionProps {
  formEnableKhoenSelection: boolean;
  setFormEnableKhoenSelection: (val: boolean) => void;
  formKhoenTitle: string;
  setFormKhoenTitle: (val: string) => void;
  formKhoenSelectionRequired: boolean;
  setFormKhoenSelectionRequired: (val: boolean) => void;
  formKhoenOptions: ProductKhoenOption[];
  setFormKhoenOptions: React.Dispatch<React.SetStateAction<ProductKhoenOption[]>>;
  handleBulkKhoenUpload: (files: FileList | File[] | null) => void;
  handleMoveKhoen: (fromIdx: number, toIdx: number) => void;
  processOptionImageFile: (file: File, onDone: (dataUrl: string) => void, maxDim?: number) => void;
  showAdminToast: (msg: string) => void;
}

export const AdminProductKhoenSection: React.FC<AdminProductKhoenSectionProps> = ({
  formEnableKhoenSelection,
  setFormEnableKhoenSelection,
  formKhoenTitle,
  setFormKhoenTitle,
  formKhoenSelectionRequired,
  setFormKhoenSelectionRequired,
  formKhoenOptions,
  setFormKhoenOptions,
  handleBulkKhoenUpload,
  handleMoveKhoen,
  processOptionImageFile,
  showAdminToast,
}) => {
  const [draggedKhoenIndex, setDraggedKhoenIndex] = useState<number | null>(null);
  const [activeKhoenDropIndex, setActiveKhoenDropIndex] = useState<number | null>(null);
  const [dragOverKhoenFileIdx, setDragOverKhoenFileIdx] = useState<number | null>(null);
  const [isBulkKhoenDragOver, setIsBulkKhoenDragOver] = useState(false);

  return (
    <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-200/70 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          onClick={() => {
            const newChecked = !formEnableKhoenSelection;
            setFormEnableKhoenSelection(newChecked);
            if (newChecked && formKhoenOptions.length === 0) {
              setFormKhoenOptions(DEFAULT_KHOEN_PRESETS);
            }
          }}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={formEnableKhoenSelection}
            onChange={(e) => {
              e.stopPropagation();
              const checked = e.target.checked;
              setFormEnableKhoenSelection(checked);
              if (checked && formKhoenOptions.length === 0) {
                setFormKhoenOptions(DEFAULT_KHOEN_PRESETS);
              }
            }}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              🔘 Bật tùy chọn Khoen (Móc khóa / Khoen cài kim loại)
            </span>
            <span className="block text-[11px] text-slate-500">
              Khách hàng có thể chọn loại khoen (Khoen tròn Inox, Càng cua, Trái tim, Giọt nước, Chữ D...) và phụ thu / tồn kho.
            </span>
          </div>
        </div>

        {formEnableKhoenSelection && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={formKhoenSelectionRequired}
                onChange={(e) => setFormKhoenSelectionRequired(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Bắt buộc chọn</span>
            </label>
            {/* Hidden bulk file input for khoen */}
            <input
              type="file"
              id="bulk-khoen-files-input"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleBulkKhoenUpload(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => document.getElementById('bulk-khoen-files-input')?.click()}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              title="Chọn nhiều file ảnh khoen từ máy để nạp cùng lúc"
            >
              <Upload className="w-3 h-3" />
              <span>Tải nhiều ảnh</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFormKhoenOptions(DEFAULT_KHOEN_PRESETS);
              }}
              className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
            >
              Nạp 7 Khoen mẫu
            </button>
            <button
              type="button"
              onClick={() => {
                const newId = `khoen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
                setFormKhoenOptions((prev) => [
                  ...prev,
                  {
                    id: newId,
                    name: `Khoen mới ${prev.length + 1}`,
                    image: DEFAULT_KHOEN_PRESETS[0]?.image || '',
                    priceDelta: 0,
                    stock: 30,
                  },
                ]);
              }}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Thêm Khoen Mới</span>
            </button>
          </div>
        )}
      </div>

      {formEnableKhoenSelection && (
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shadow-2xs">
          <label className="text-xs font-bold text-emerald-950 shrink-0 flex items-center gap-1.5">
            🏷️ Đổi tên tiêu đề hiển thị:
          </label>
          <input
            type="text"
            value={formKhoenTitle}
            onChange={(e) => setFormKhoenTitle(e.target.value)}
            placeholder="Mặc định: Chọn Loại Khoen (vd: Chọn Loại Móc Cài, Chọn Khoen Khóa...)"
            className="w-full flex-1 px-3 py-1.5 bg-white border border-emerald-300/80 rounded-lg text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      )}

      {formEnableKhoenSelection && (
        <div
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setIsBulkKhoenDragOver(true);
            }
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsBulkKhoenDragOver(false);
          }}
          onDrop={(e) => {
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              e.preventDefault();
              setIsBulkKhoenDragOver(false);
              handleBulkKhoenUpload(e.dataTransfer.files);
            }
          }}
          className={`space-y-2 pt-2 border-t border-emerald-200/60 relative transition-all ${
            isBulkKhoenDragOver ? 'ring-2 ring-emerald-500 rounded-xl bg-emerald-50/50 p-2' : ''
          }`}
        >
          {isBulkKhoenDragOver && (
            <div className="p-4 border-2 border-dashed border-emerald-400 bg-emerald-100/70 rounded-xl text-center text-emerald-900 font-bold text-xs flex items-center justify-center gap-2 mb-2 animate-pulse">
              <Upload className="w-4 h-4" />
              <span>Thả các file ảnh vào đây để tự động tạo nhiều khoen mới!</span>
            </div>
          )}

          {formKhoenOptions.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-emerald-200 rounded-xl bg-emerald-50/30 space-y-2">
              <p className="text-xs text-slate-500 font-medium">
                Chưa có mẫu khoen nào. Kéo thả ảnh khoen trực tiếp vào đây hoặc bấm nút phía trên.
              </p>
              <button
                type="button"
                onClick={() => document.getElementById('bulk-khoen-files-input')?.click()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Chọn ảnh tải lên</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {formKhoenOptions.map((khoen, khIdx) => (
                <div
                  key={khoen.id || khIdx}
                  onDragEnter={(e) => {
                    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/uri-list')) {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverKhoenFileIdx(khIdx);
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/uri-list')) {
                      if (dragOverKhoenFileIdx !== khIdx) setDragOverKhoenFileIdx(khIdx);
                    } else if (draggedKhoenIndex !== null && draggedKhoenIndex !== khIdx) {
                      setActiveKhoenDropIndex(khIdx);
                    }
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (dragOverKhoenFileIdx === khIdx) setDragOverKhoenFileIdx(null);
                    if (activeKhoenDropIndex === khIdx) setActiveKhoenDropIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverKhoenFileIdx(null);
                    setActiveKhoenDropIndex(null);

                    // 1. Files dropped directly on this khoen
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      const fileList = (Array.from(files) as File[]).filter((f) => f.type.startsWith('image/'));
                      if (fileList.length > 0) {
                        processOptionImageFile(fileList[0], (imgUrl) => {
                          setFormKhoenOptions((prev) =>
                            prev.map((k, i) => (i === khIdx ? { ...k, image: imgUrl } : k))
                          );
                          showAdminToast(`Đã đổi ảnh cho khoen #${khIdx + 1}`);
                        });
                        if (fileList.length > 1) {
                          handleBulkKhoenUpload(fileList.slice(1));
                        }
                        return;
                      }
                    }

                    // 2. Image URL dropped from browser
                    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                    if (uri && (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:image/'))) {
                      setFormKhoenOptions((prev) =>
                        prev.map((k, i) => (i === khIdx ? { ...k, image: uri.trim() } : k))
                      );
                      showAdminToast(`Đã nhận ảnh URL cho khoen #${khIdx + 1}`);
                      return;
                    }

                    // 3. Card reorder
                    if (draggedKhoenIndex !== null && draggedKhoenIndex !== khIdx) {
                      handleMoveKhoen(draggedKhoenIndex, khIdx);
                    }
                    setDraggedKhoenIndex(null);
                  }}
                  className={`p-2.5 bg-white rounded-xl border transition-all flex flex-col gap-2 shadow-xs relative group ${
                    dragOverKhoenFileIdx === khIdx
                      ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/50'
                      : activeKhoenDropIndex === khIdx
                      ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50/20'
                      : 'border-emerald-200/80'
                  }`}
                >
                  {/* Drag-over feedback overlay */}
                  {dragOverKhoenFileIdx === khIdx && (
                    <div className="absolute inset-0 bg-emerald-600/90 rounded-xl z-20 flex flex-col items-center justify-center text-white font-black text-xs gap-1 pointer-events-none shadow-lg animate-fadeIn">
                      <Upload className="w-5 h-5 animate-bounce" />
                      <span>Thả ảnh vào để đổi ảnh khoen</span>
                    </div>
                  )}

                  {/* Hidden file input for khoen image */}
                  <input
                    type="file"
                    id={`khoen-file-input-${khIdx}`}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        processOptionImageFile(file, (imgUrl) => {
                          setFormKhoenOptions((prev) =>
                            prev.map((k, i) => (i === khIdx ? { ...k, image: imgUrl } : k))
                          );
                          showAdminToast(`Đã tải ảnh cho khoen #${khIdx + 1}`);
                        });
                      }
                      e.target.value = '';
                    }}
                  />

                  {/* Header: Drag handle + Index + Move Up/Down + Delete */}
                  <div className="flex items-center justify-between gap-1 pb-1 border-b border-emerald-100">
                    <div className="flex items-center gap-1">
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', String(khIdx));
                          setDraggedKhoenIndex(khIdx);
                        }}
                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100"
                        title="Giữ và kéo để đổi thứ tự khoen"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-800">
                        #{khIdx + 1}
                      </span>
                      <div className="flex items-center">
                        <button
                          type="button"
                          disabled={khIdx === 0}
                          onClick={() => handleMoveKhoen(khIdx, khIdx - 1)}
                          className="p-0.5 text-slate-400 hover:text-emerald-600 disabled:opacity-20 cursor-pointer"
                          title="Di chuyển lên trước"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={khIdx === formKhoenOptions.length - 1}
                          onClick={() => handleMoveKhoen(khIdx, khIdx + 1)}
                          className="p-0.5 text-slate-400 hover:text-emerald-600 disabled:opacity-20 cursor-pointer"
                          title="Di chuyển xuống sau"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setFormKhoenOptions((prev) => prev.filter((_, i) => i !== khIdx));
                      }}
                      className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-md bg-slate-100 hover:bg-rose-50 text-xs font-bold cursor-pointer transition-colors shrink-0"
                      title="Xóa khoen này"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex items-start gap-2.5">
                    {/* Image Drop Zone & Click to Upload */}
                    <div
                      onClick={() => document.getElementById(`khoen-file-input-${khIdx}`)?.click()}
                      className="w-14 h-14 rounded-lg bg-neutral-50 border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center p-1 relative cursor-pointer group/img hover:border-emerald-500 transition-all shadow-2xs"
                      title="Bấm để tải ảnh hoặc kéo thả ảnh vào đây"
                    >
                      {khoen.image && khoen.image.trim() ? (
                        <img
                          src={khoen.image}
                          alt={khoen.name}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80';
                          }}
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 text-center leading-tight">Chưa có ảnh</span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                        <Upload className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-bold mt-0.5">Đổi ảnh</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <input
                        type="text"
                        value={khoen.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormKhoenOptions((prev) =>
                            prev.map((k, i) => (i === khIdx ? { ...k, name: val } : k))
                          );
                        }}
                        placeholder="Tên loại khoen..."
                        className="w-full px-2 py-0.5 font-bold text-xs text-slate-900 border border-transparent hover:border-slate-200 focus:border-emerald-500 rounded bg-transparent focus:bg-white focus:outline-none"
                      />

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-[11px] text-slate-600">
                          <span>Phụ thu:</span>
                          <input
                            type="number"
                            value={khoen.priceDelta}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setFormKhoenOptions((prev) =>
                                prev.map((k, i) => (i === khIdx ? { ...k, priceDelta: val } : k))
                              );
                            }}
                            className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-emerald-900 focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-[10px] text-slate-400">đ</span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-600">
                          <span>Kho:</span>
                          <input
                            type="number"
                            value={khoen.stock ?? ''}
                            placeholder="∞"
                            onChange={(e) => {
                              const val =
                                e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0);
                              setFormKhoenOptions((prev) =>
                                prev.map((k, i) => (i === khIdx ? { ...k, stock: val } : k))
                              );
                            }}
                            className="w-12 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setFormKhoenOptions((prev) =>
                                prev.map((k, i) => (i === khIdx ? { ...k, stock: undefined } : k))
                              );
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                              khoen.stock === undefined
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            title="Không giới hạn số lượng"
                          >
                            ∞
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={khoen.image}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormKhoenOptions((prev) =>
                          prev.map((k, i) => (i === khIdx ? { ...k, image: val } : k))
                        );
                      }}
                      placeholder="URL hoặc kéo thả ảnh..."
                      className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById(`khoen-file-input-${khIdx}`)?.click()}
                      className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                      title="Tải ảnh từ máy"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Tải</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
