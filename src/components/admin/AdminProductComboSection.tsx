import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Image as ImageIcon,
  Upload,
  Search,
  Check,
  Package,
  X,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  Palette
} from 'lucide-react';
import { ComboItemConfig, Product, ProductColorOption, ProductCharmOption, ProductOmamoriOption, ProductKhoenOption } from '../../types';
import { DEFAULT_CHARM_PRESETS } from '../../data/sampleCharms';
import { DEFAULT_OMAMORI_PRESETS } from '../../data/sampleOmamori';
import { DEFAULT_KHOEN_PRESETS } from '../../data/sampleKhoen';

interface AdminProductComboSectionProps {
  formIsCombo: boolean;
  setFormIsCombo: (val: boolean) => void;
  formComboItems: ComboItemConfig[];
  setFormComboItems: React.Dispatch<React.SetStateAction<ComboItemConfig[]>>;
  availableProductImages?: string[];
  existingProducts?: Product[];
  onImportProductImages?: (images: string[]) => void;
  processOptionImageFile: (file: File, onDone: (dataUrl: string) => void, maxDim?: number) => void;
  showAdminToast: (msg: string) => void;
}

export const AdminProductComboSection: React.FC<AdminProductComboSectionProps> = ({
  formIsCombo,
  setFormIsCombo,
  formComboItems,
  setFormComboItems,
  availableProductImages = [],
  existingProducts = [],
  onImportProductImages,
  processOptionImageFile,
  showAdminToast,
}) => {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // State for Product Picker Modal (selecting from existing store products)
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productPickerTargetItemId, setProductPickerTargetItemId] = useState<string | null>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');

  // Filtered store products for the picker modal
  const filteredExistingProducts = useMemo(() => {
    const q = pickerSearchQuery.trim().toLowerCase();
    if (!q) return existingProducts;
    return existingProducts.filter((p) => {
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const catMatch = (p.category || '').toLowerCase().includes(q);
      const idMatch = (p.id || '').toLowerCase().includes(q);
      return nameMatch || catMatch || idMatch;
    });
  }, [existingProducts, pickerSearchQuery]);

  // Apply chosen product to a new or existing combo item
  const handleApplyExistingProduct = (product: Product, targetItemId?: string | null) => {
    // Gather all images from the selected product (main image, gallery, and color variant images)
    const allProdImages: string[] = [];
    if (product.image && typeof product.image === 'string' && product.image.trim()) {
      allProdImages.push(product.image.trim());
    }
    if (Array.isArray(product.images)) {
      product.images.forEach((img) => {
        if (img && typeof img === 'string' && img.trim() && !allProdImages.includes(img.trim())) {
          allProdImages.push(img.trim());
        }
      });
    }
    if (Array.isArray(product.colorOptions)) {
      product.colorOptions.forEach((c) => {
        if (c?.image && typeof c.image === 'string' && c.image.trim() && !allProdImages.includes(c.image.trim())) {
          allProdImages.push(c.image.trim());
        }
      });
    }

    // Convert colors properly preserving images, stocks, and colorCodes
    const convertedColors: ProductColorOption[] = (product.colorOptions && product.colorOptions.length > 0)
      ? product.colorOptions.map((c, cIdx) => ({
          name: c.name,
          image: c.image || product.images?.[cIdx] || product.image || allProdImages[0] || '',
          colorCode: c.colorCode || '#DC2626',
          stock: typeof c.stock === 'number' ? c.stock : 15,
        }))
      : (product.availableColors && product.availableColors.length > 0)
      ? product.availableColors.map((cName, cIdx) => ({
          name: cName,
          image: product.images?.[cIdx] || product.image || allProdImages[0] || '',
          colorCode: '#DC2626',
          stock: 15,
        }))
      : [{ name: 'Màu Tiêu Chuẩn', image: product.image || allProdImages[0] || '', stock: 15, colorCode: '#DC2626' }];

    const convertedCharms: ProductCharmOption[] = (product.charmOptions && product.charmOptions.length > 0)
      ? product.charmOptions.map((ch) => ({
          id: ch.id || `charm-${Math.random().toString(36).substring(2, 7)}`,
          name: ch.name,
          image: ch.image || '',
          priceDelta: ch.priceDelta || 0,
          stock: typeof ch.stock === 'number' ? ch.stock : 10,
        }))
      : [];

    const convertedOmamoris: ProductOmamoriOption[] = (product.omamoriOptions && product.omamoriOptions.length > 0)
      ? product.omamoriOptions.map((o) => ({
          id: o.id || `omamori-${Math.random().toString(36).substring(2, 7)}`,
          name: o.name,
          image: o.image || '',
          priceDelta: o.priceDelta || 0,
          stock: typeof o.stock === 'number' ? o.stock : 10,
        }))
      : [];

    const convertedKhoens: ProductKhoenOption[] = (product.khoenOptions && product.khoenOptions.length > 0)
      ? product.khoenOptions.map((k) => ({
          id: k.id || `khoen-${Math.random().toString(36).substring(2, 7)}`,
          name: k.name,
          image: k.image || '',
          priceDelta: k.priceDelta || 0,
          stock: typeof k.stock === 'number' ? k.stock : 10,
        }))
      : [];

    const itemData: Partial<ComboItemConfig> = {
      title: product.name,
      subtitle: ((product as any).subtitle || product.description || product.category || 'Sản phẩm hoàn thiện thủ công').trim(),
      image: product.image || allProdImages[0] || '',
      images: allProdImages.length > 0 ? allProdImages : undefined,
      linkedProductId: product.id,
      enableColorSelection: convertedColors.length > 0,
      colorOptions: convertedColors,
      enableCharmSelection: !!product.enableCharmSelection || convertedCharms.length > 0,
      charmTitle: product.charmTitle || 'Chọn Charm',
      charmSelectionRequired: product.charmSelectionRequired || false,
      maxCharmsAllowed: product.maxCharmsAllowed || 1,
      charmOptions: convertedCharms.length > 0 ? convertedCharms : undefined,
      enableOmamoriSelection: !!product.enableOmamoriSelection || convertedOmamoris.length > 0,
      omamoriTitle: product.omamoriTitle || 'Chọn Bùa Omamori',
      omamoriSelectionRequired: product.omamoriSelectionRequired || false,
      maxOmamoriAllowed: product.maxOmamoriAllowed || 1,
      omamoriOptions: convertedOmamoris.length > 0 ? convertedOmamoris : undefined,
      enableKhoenSelection: !!product.enableKhoenSelection || convertedKhoens.length > 0,
      khoenTitle: product.khoenTitle || 'Chọn Khoen Móc Khóa',
      khoenSelectionRequired: product.khoenSelectionRequired || false,
      khoenOptions: convertedKhoens.length > 0 ? convertedKhoens : undefined,
      enableSizeSelection: false,
      availableSizes: undefined,
    };

    // Propagate all imported product images into the parent combo form
    if (allProdImages.length > 0 && typeof onImportProductImages === 'function') {
      onImportProductImages(allProdImages);
    }

    if (targetItemId) {
      updateItem(targetItemId, itemData);
      showAdminToast(`✓ Đã nạp đầy đủ ảnh, màu sắc & phụ kiện từ "${product.name}"!`);
    } else {
      const newItem: ComboItemConfig = {
        id: `combo-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: product.name,
        ...itemData,
      } as ComboItemConfig;
      setFormComboItems((prev) => [...prev, newItem]);
      setExpandedItemId(newItem.id);
      showAdminToast(`✓ Đã thêm món mới từ sản phẩm "${product.name}"!`);
    }

    setIsProductPickerOpen(false);
    setProductPickerTargetItemId(null);
  };

  const handleAddBlankItem = () => {
    const newIdx = formComboItems.length + 1;
    const newItem: ComboItemConfig = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: `Món ${newIdx}: Tên sản phẩm tùy biến`,
      subtitle: `Tùy chọn màu sắc & phụ kiện cho món thứ ${newIdx}`,
      enableColorSelection: true,
      colorOptions: [
        { name: 'Đỏ May Mắn', stock: 15, colorCode: '#DC2626' },
        { name: 'Đen', stock: 15, colorCode: '#18181B' }
      ],
      enableCharmSelection: true,
      charmTitle: 'Chọn Charm',
      charmSelectionRequired: false,
      maxCharmsAllowed: 1,
      charmOptions: DEFAULT_CHARM_PRESETS.slice(0, 4).map((c) => ({ ...c, stock: 10 })),
    };
    setFormComboItems((prev) => [...prev, newItem]);
    setExpandedItemId(newItem.id);
  };

  const handleRemoveSubItem = (itemId: string) => {
    if (formComboItems.length <= 1) {
      showAdminToast('Sản phẩm Combo cần có ít nhất 1 món!');
      return;
    }
    setFormComboItems((prev) => prev.filter((it) => it.id !== itemId));
    if (expandedItemId === itemId) {
      setExpandedItemId(null);
    }
  };

  const updateItem = (itemId: string, patch: Partial<ComboItemConfig>) => {
    setFormComboItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    );
  };

  return (
    <div className="bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/40 p-5 rounded-3xl border-2 border-purple-300 space-y-5 shadow-sm">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-black text-purple-950 uppercase tracking-wide">
              Danh Sách Các Món Trong Combo ({formComboItems.length} món)
            </h4>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Mỗi món có thể liên kết trực tiếp với sản phẩm có sẵn hoặc tự tạo riêng. Khách hàng sẽ chọn lần lượt từng món theo từng bước.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {existingProducts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setProductPickerTargetItemId(null);
                setPickerSearchQuery('');
                setIsProductPickerOpen(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
              title="Chọn một sản phẩm đã có trong shop (nạp tự động toàn bộ ảnh, màu sắc, charm và tồn kho)"
            >
              <Package className="w-3.5 h-3.5" />
              <span>+ Chọn Từ SP Có Sẵn</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleAddBlankItem}
            className="px-3.5 py-2 bg-white hover:bg-purple-50 text-purple-900 border border-purple-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Tự nhập tay một món mới từ đầu"
          >
            <Plus className="w-3.5 h-3.5 text-purple-700" />
            <span>+ Tự Nhập Món Mới</span>
          </button>
        </div>
      </div>

      {/* Sub-items list */}
      <div className="space-y-4">
        {formComboItems.length === 0 ? (
          <div className="p-8 text-center bg-white/80 rounded-2xl border-2 border-dashed border-purple-200">
            <Package className="w-12 h-12 text-purple-400 mx-auto mb-3" />
            <h5 className="text-sm font-black text-slate-800">Chưa có món nào trong Combo này</h5>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Hãy bấm <strong>"+ Chọn Từ SP Có Sẵn"</strong> để đưa các sản phẩm có sẵn vào combo hoặc <strong>"+ Tự Nhập Món Mới"</strong>.
            </p>
            <div className="flex items-center justify-center gap-2">
              {existingProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setProductPickerTargetItemId(null);
                    setPickerSearchQuery('');
                    setIsProductPickerOpen(true);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Chọn Sản Phẩm Có Sẵn</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleAddBlankItem}
                className="px-4 py-2 bg-white border border-purple-300 text-purple-900 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-purple-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tự Nhập Món Mới</span>
              </button>
            </div>
          </div>
        ) : (
          formComboItems.map((item, idx) => {
            const isExpanded = expandedItemId === item.id || (expandedItemId === null && idx === 0);
            const linkedProduct = item.linkedProductId
              ? existingProducts.find((p) => p.id === item.linkedProductId)
              : null;
            const currentImgIdx = availableProductImages.indexOf(item.image || '');

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border-2 border-purple-200/90 shadow-2xs overflow-hidden transition-all"
              >
                {/* Item Header */}
                <div
                  onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                  className="p-3.5 bg-slate-50 hover:bg-purple-50/60 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors border-b border-slate-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    {item.image ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="text-xs font-black text-slate-900 truncate">
                          {item.title || `Món #${idx + 1}`}
                        </h5>
                        {linkedProduct && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[10px] font-extrabold border border-purple-300 shrink-0 inline-flex items-center gap-1">
                            <LinkIcon className="w-2.5 h-2.5" />
                            <span>SP: {linkedProduct.name}</span>
                          </span>
                        )}
                        {item.colorOptions && item.colorOptions.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold shrink-0">
                            {item.colorOptions.length} màu
                          </span>
                        )}
                        {item.charmOptions && item.charmOptions.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold shrink-0">
                            {item.charmOptions.length} charm
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.subtitle || 'Bấm để cấu hình chi tiết (màu sắc, ảnh màu, charm, bùa, khoen, stock)...'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSubItem(item.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Xóa món này khỏi combo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="p-1 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Item Configuration */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-5">
                    {/* Linked Product Banner */}
                    {linkedProduct ? (
                      <div className="p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl overflow-hidden border border-purple-300 bg-white shrink-0">
                            <img src={linkedProduct.image || '/assets/bracelet.jpg'} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 font-black text-[9px] uppercase tracking-wider">
                                Đang liên kết SP có sẵn
                              </span>
                              <span className="text-xs font-black text-purple-950 truncate">
                                {linkedProduct.name}
                              </span>
                            </div>
                            <p className="text-[11px] text-purple-800 mt-0.5">
                              Giá gốc: {linkedProduct.price.toLocaleString('vi-VN')}đ • {linkedProduct.colorOptions?.length || linkedProduct.availableColors?.length || 0} màu • {linkedProduct.charmOptions?.length || 0} charm
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApplyExistingProduct(linkedProduct, item.id)}
                            className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-900 border border-purple-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            title="Nạp lại toàn bộ ảnh, màu sắc và charm từ sản phẩm gốc"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Đồng bộ lại</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProductPickerTargetItemId(item.id);
                              setPickerSearchQuery('');
                              setIsProductPickerOpen(true);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-900 border border-purple-300 rounded-lg text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                          >
                            Đổi SP khác
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { linkedProductId: undefined })}
                            className="px-2 py-1 text-slate-500 hover:text-slate-800 rounded-lg text-[11px] font-semibold cursor-pointer"
                            title="Tách liên kết để tự chỉnh tự do độc lập"
                          >
                            Tách liên kết
                          </button>
                        </div>
                      </div>
                    ) : (
                      existingProducts.length > 0 && (
                        <div className="flex items-center justify-between p-3 bg-purple-50/50 rounded-2xl border border-purple-200">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            <span className="text-xs text-purple-950 font-semibold">
                              Món này đang thiết lập thủ công. Bạn có thể nạp nhanh từ sản phẩm có sẵn:
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setProductPickerTargetItemId(item.id);
                              setPickerSearchQuery('');
                              setIsProductPickerOpen(true);
                            }}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors shadow-2xs"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>Nạp từ SP có sẵn</span>
                          </button>
                        </div>
                      )
                    )}

                    {/* Title & Subtitle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Tiêu đề bước / Tên món *
                        </label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateItem(item.id, { title: e.target.value })}
                          placeholder="Ví dụ: Món 1: Vòng Lucky Đỏ May Mắn"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-700">
                            Mô tả chi tiết / Ý nghĩa món này:
                          </label>
                          {item.linkedProductId && (
                            <button
                              type="button"
                              onClick={() => {
                                const linked = existingProducts.find((p) => p.id === item.linkedProductId);
                                if (linked) {
                                  const fullText = (linked.subtitle || linked.description || linked.category || '').trim();
                                  updateItem(item.id, { subtitle: fullText });
                                  showAdminToast(`✓ Đã nạp lại mô tả đầy đủ từ "${linked.name}"!`);
                                }
                              }}
                              className="text-[10px] text-purple-600 hover:text-purple-800 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              Lấy lại mô tả gốc
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          value={item.subtitle || ''}
                          onChange={(e) => updateItem(item.id, { subtitle: e.target.value })}
                          placeholder="Ví dụ: Nút Cát Tường biểu tượng may mắn, bình an và thuận lợi..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white resize-none leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* Item Cover Photo */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <label className="block text-xs font-bold text-slate-700">
                        Ảnh đại diện cho Món này:
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.image ? (
                          <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-purple-400 bg-white shrink-0 relative group shadow-2xs">
                            <img src={item.image} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}

                        <label className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Tải ảnh máy</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                processOptionImageFile(file, (dataUrl) => {
                                  updateItem(item.id, { image: dataUrl });
                                  showAdminToast('✓ Đã tải ảnh cho món thành công!');
                                });
                              }
                            }}
                          />
                        </label>

                        {availableProductImages.length > 0 && (
                          <select
                            onChange={(e) => updateItem(item.id, { image: e.target.value })}
                            value={availableProductImages.includes(item.image || '') ? (item.image || '') : ''}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                              availableProductImages.includes(item.image || '')
                                ? 'bg-amber-100 border-amber-400 text-amber-950 font-black'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <option value="">-- Gán từ ảnh SP --</option>
                            {availableProductImages.map((imgUrl, imgIdx) => (
                              <option key={imgIdx} value={imgUrl}>
                                {item.image === imgUrl ? `✓ Ảnh #${imgIdx + 1} (Đang gắn)` : `Ảnh #${imgIdx + 1}`}
                              </option>
                            ))}
                          </select>
                        )}

                        <input
                          type="text"
                          value={item.image || ''}
                          onChange={(e) => updateItem(item.id, { image: e.target.value })}
                          placeholder="Hoặc dán URL ảnh món..."
                          className="flex-1 min-w-[150px] px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-purple-500"
                        />

                        {item.image && (
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { image: '' })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                            title="Gỡ ảnh món"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ========================================================= */}
                    {/* SECTION 1: MÀU SẮC / MẪU DÂY (COLOR OPTIONS WITH PHOTO & STOCK) */}
                    {/* ========================================================= */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={item.enableColorSelection ?? true}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              updateItem(item.id, {
                                enableColorSelection: checked,
                                colorOptions: checked && (!item.colorOptions || item.colorOptions.length === 0)
                                  ? [{ name: 'Đỏ May Mắn', stock: 15, colorCode: '#DC2626' }, { name: 'Đen', stock: 15, colorCode: '#18181B' }]
                                  : item.colorOptions,
                              });
                            }}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                              <Palette className="w-4 h-4 text-purple-600" />
                              <span>Tùy chọn Màu sắc / Mẫu dây ({item.colorOptions?.length || 0} màu)</span>
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Mỗi màu có ảnh riêng (khách click tự chuyển ảnh) và số lượng tồn kho riêng.
                            </span>
                          </div>
                        </label>

                        {item.enableColorSelection && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const newColor: ProductColorOption = {
                                  name: `Màu mới #${(item.colorOptions?.length || 0) + 1}`,
                                  stock: 15,
                                  colorCode: '#DC2626',
                                };
                                updateItem(item.id, {
                                  colorOptions: [...(item.colorOptions || []), newColor],
                                });
                              }}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Thêm Màu</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const presets: ProductColorOption[] = [
                                  { name: 'Đỏ May Mắn', stock: 20, colorCode: '#DC2626' },
                                  { name: 'Đen Huyền Bí', stock: 20, colorCode: '#18181B' },
                                  { name: 'Hồng Pastel', stock: 20, colorCode: '#F472B6' },
                                  { name: 'Xanh Rêu', stock: 20, colorCode: '#15803D' },
                                  { name: 'Trắng Sữa', stock: 20, colorCode: '#F8FAFC' },
                                ];
                                updateItem(item.id, { colorOptions: presets });
                                showAdminToast('✓ Đã nạp 5 màu cơ bản cho món!');
                              }}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                              title="Nạp nhanh 5 màu phổ biến"
                            >
                              + Nạp 5 màu mẫu
                            </button>
                          </div>
                        )}
                      </div>

                      {item.enableColorSelection && (
                        <div className="space-y-2 pt-2">
                          {(item.colorOptions || []).map((col, cIdx) => (
                            <div
                              key={cIdx}
                              className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 hover:border-purple-300 transition-colors"
                            >
                              {/* Left: Index & Image Preview */}
                              <div className="flex items-center gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-900 text-[10px] font-black flex items-center justify-center shrink-0">
                                  {cIdx + 1}
                                </span>
                                {col.image ? (
                                  <div className="w-11 h-11 rounded-lg overflow-hidden border border-purple-300 bg-slate-50 shrink-0 relative shadow-2xs">
                                    <img src={col.image} alt={col.name} className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div
                                    className="w-11 h-11 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: col.colorCode || '#F1F5F9' }}
                                  >
                                    <span className="text-[9px] font-extrabold text-slate-700 bg-white/80 px-1 py-0.5 rounded shadow-2xs">
                                      {col.name.slice(0, 3)}
                                    </span>
                                  </div>
                                )}

                                {/* Color name input */}
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Tên màu
                                  </label>
                                  <input
                                    type="text"
                                    value={col.name}
                                    onChange={(e) => {
                                      const updated = [...(item.colorOptions || [])];
                                      updated[cIdx] = { ...updated[cIdx], name: e.target.value };
                                      updateItem(item.id, { colorOptions: updated });
                                    }}
                                    placeholder="Vd: Đỏ May Mắn, Trắng..."
                                    className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 w-36 focus:outline-none focus:border-purple-500 focus:bg-white"
                                  />
                                </div>
                              </div>

                              {/* Center: Stock & Hex Code */}
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Tồn kho (Stock)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={col.stock ?? 15}
                                    onChange={(e) => {
                                      const updated = [...(item.colorOptions || [])];
                                      updated[cIdx] = { ...updated[cIdx], stock: parseInt(e.target.value, 10) || 0 };
                                      updateItem(item.id, { colorOptions: updated });
                                    }}
                                    placeholder="Kho"
                                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 w-20 text-center focus:outline-none focus:border-purple-500 focus:bg-white"
                                    title="Số lượng tồn kho của riêng màu này"
                                  />
                                </div>

                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Mã màu HEX
                                  </label>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="color"
                                      value={col.colorCode || '#DC2626'}
                                      onChange={(e) => {
                                        const updated = [...(item.colorOptions || [])];
                                        updated[cIdx] = { ...updated[cIdx], colorCode: e.target.value };
                                        updateItem(item.id, { colorOptions: updated });
                                      }}
                                      className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5 bg-white"
                                    />
                                    <input
                                      type="text"
                                      value={col.colorCode || '#DC2626'}
                                      onChange={(e) => {
                                        const updated = [...(item.colorOptions || [])];
                                        updated[cIdx] = { ...updated[cIdx], colorCode: e.target.value };
                                        updateItem(item.id, { colorOptions: updated });
                                      }}
                                      placeholder="#HEX"
                                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 w-20 text-center"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Right: Upload Photo / Pick from product images / Delete */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <label className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                                  <Upload className="w-3 h-3" />
                                  <span>Tải ảnh</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        processOptionImageFile(file, (dataUrl) => {
                                          const updated = [...(item.colorOptions || [])];
                                          updated[cIdx] = { ...updated[cIdx], image: dataUrl };
                                          updateItem(item.id, { colorOptions: updated });
                                          showAdminToast(`✓ Đã cập nhật ảnh cho màu "${col.name}"!`);
                                        }, 600);
                                      }
                                    }}
                                  />
                                </label>

                                {availableProductImages.length > 0 && (
                                  <select
                                    onChange={(e) => {
                                      const updated = [...(item.colorOptions || [])];
                                      updated[cIdx] = { ...updated[cIdx], image: e.target.value };
                                      updateItem(item.id, { colorOptions: updated });
                                    }}
                                    value={availableProductImages.includes(col.image || '') ? (col.image || '') : ''}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                                      availableProductImages.includes(col.image || '')
                                        ? 'bg-amber-100 border-amber-400 text-amber-950 font-black'
                                        : 'bg-white border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <option value="">-- Gán từ ảnh SP --</option>
                                    {availableProductImages.map((imgUrl, imgIdx) => (
                                      <option key={imgIdx} value={imgUrl}>
                                        {col.image === imgUrl ? `✓ Ảnh #${imgIdx + 1} (Đang gắn)` : `Ảnh #${imgIdx + 1}`}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                {col.image && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...(item.colorOptions || [])];
                                      updated[cIdx] = { ...updated[cIdx], image: '' };
                                      updateItem(item.id, { colorOptions: updated });
                                    }}
                                    className="px-1.5 py-1 text-slate-400 hover:text-rose-600 rounded text-[10px] font-bold cursor-pointer"
                                    title="Gỡ ảnh màu này"
                                  >
                                    Gỡ ảnh
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    if ((item.colorOptions || []).length <= 1) {
                                      showAdminToast('Món cần có ít nhất 1 màu!');
                                      return;
                                    }
                                    const updated = (item.colorOptions || []).filter((_, i) => i !== cIdx);
                                    updateItem(item.id, { colorOptions: updated });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Xóa màu này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ========================================================= */}
                    {/* SECTION 2: CHARM / PHỤ KIỆN (WITH PHOTO, PRICE DELTA & STOCK) */}
                    {/* ========================================================= */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={item.enableCharmSelection ?? false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              updateItem(item.id, {
                                enableCharmSelection: checked,
                                charmOptions: checked && (!item.charmOptions || item.charmOptions.length === 0)
                                  ? DEFAULT_CHARM_PRESETS.slice(0, 4).map((c) => ({ ...c, stock: 10 }))
                                  : item.charmOptions,
                              });
                            }}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-500" />
                              <span>✨ Tùy chọn Charm / Phụ kiện ({item.charmOptions?.length || 0} mẫu)</span>
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Mỗi charm có ảnh đại diện, giá phụ thu và số lượng tồn kho riêng.
                            </span>
                          </div>
                        </label>

                        {item.enableCharmSelection && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const newCharm: ProductCharmOption = {
                                  id: `charm-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                                  name: `Charm mới #${(item.charmOptions?.length || 0) + 1}`,
                                  priceDelta: 0,
                                  stock: 10,
                                };
                                updateItem(item.id, {
                                  charmOptions: [...(item.charmOptions || []), newCharm],
                                });
                              }}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Thêm Charm</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const sampleCharms: ProductCharmOption[] = DEFAULT_CHARM_PRESETS.slice(0, 8).map((c) => ({
                                  ...c,
                                  stock: 15,
                                }));
                                updateItem(item.id, { charmOptions: sampleCharms });
                                showAdminToast('✓ Đã nạp 8 mẫu Charm chuẩn cho món!');
                              }}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              + Nạp 8 Charm mẫu
                            </button>
                          </div>
                        )}
                      </div>

                      {item.enableCharmSelection && (
                        <div className="space-y-3 pt-2">
                          {/* Title and Settings for Charms */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200">
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Tiêu đề hiển thị nhóm Charm
                              </label>
                              <input
                                type="text"
                                value={item.charmTitle || ''}
                                onChange={(e) => updateItem(item.id, { charmTitle: e.target.value })}
                                placeholder="Vd: Chọn Charm Món 1 (hoặc Chọn Mặt Dây)..."
                                className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Tối đa chọn
                                </label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={item.maxCharmsAllowed || 1}
                                    onChange={(e) =>
                                      updateItem(item.id, {
                                        maxCharmsAllowed: Math.max(1, parseInt(e.target.value, 10) || 1),
                                      })
                                    }
                                    className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-center"
                                  />
                                  <span className="text-xs text-slate-500">món</span>
                                </div>
                              </div>
                              <label className="flex items-center gap-1.5 cursor-pointer mt-4 select-none">
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.charmSelectionRequired)}
                                  onChange={(e) => updateItem(item.id, { charmSelectionRequired: e.target.checked })}
                                  className="rounded text-amber-500 focus:ring-amber-400 w-3.5 h-3.5"
                                />
                                <span className="text-xs font-bold text-slate-700">Bắt buộc chọn</span>
                              </label>
                            </div>
                          </div>

                          {/* List of Charms */}
                          <div className="space-y-2">
                            {(item.charmOptions || []).map((charm, chIdx) => (
                              <div
                                key={charm.id || chIdx}
                                className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 hover:border-amber-300 transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black flex items-center justify-center shrink-0">
                                    {chIdx + 1}
                                  </span>
                                  {charm.image ? (
                                    <div className="w-11 h-11 rounded-lg overflow-hidden border border-amber-300 bg-slate-50 shrink-0 shadow-2xs">
                                      <img src={charm.image} alt={charm.name} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-11 h-11 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                      <Sparkles className="w-4 h-4 text-amber-400" />
                                    </div>
                                  )}

                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Tên Charm
                                    </label>
                                    <input
                                      type="text"
                                      value={charm.name}
                                      onChange={(e) => {
                                        const updated = [...(item.charmOptions || [])];
                                        updated[chIdx] = { ...updated[chIdx], name: e.target.value };
                                        updateItem(item.id, { charmOptions: updated });
                                      }}
                                      placeholder="Vd: Mèo Thần Tài, Cỏ 4 Lá..."
                                      className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 w-36 focus:outline-none focus:border-amber-500 focus:bg-white"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Phụ thu (+đ)
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1000}
                                      value={charm.priceDelta ?? 0}
                                      onChange={(e) => {
                                        const updated = [...(item.charmOptions || [])];
                                        updated[chIdx] = { ...updated[chIdx], priceDelta: parseInt(e.target.value, 10) || 0 };
                                        updateItem(item.id, { charmOptions: updated });
                                      }}
                                      placeholder="0"
                                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-amber-700 w-24 text-center focus:outline-none focus:border-amber-500 focus:bg-white"
                                    />
                                  </div>

                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Tồn kho (Stock)
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={charm.stock ?? 10}
                                      onChange={(e) => {
                                        const updated = [...(item.charmOptions || [])];
                                        updated[chIdx] = { ...updated[chIdx], stock: parseInt(e.target.value, 10) || 0 };
                                        updateItem(item.id, { charmOptions: updated });
                                      }}
                                      placeholder="Kho"
                                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 w-20 text-center focus:outline-none focus:border-amber-500 focus:bg-white"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <label className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                                    <Upload className="w-3 h-3" />
                                    <span>Tải ảnh</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          processOptionImageFile(file, (dataUrl) => {
                                            const updated = [...(item.charmOptions || [])];
                                            updated[chIdx] = { ...updated[chIdx], image: dataUrl };
                                            updateItem(item.id, { charmOptions: updated });
                                            showAdminToast(`✓ Đã cập nhật ảnh cho charm "${charm.name}"!`);
                                          }, 400);
                                        }
                                      }}
                                    />
                                  </label>

                                  {availableProductImages.length > 0 && (
                                    <select
                                      onChange={(e) => {
                                        const updated = [...(item.charmOptions || [])];
                                        updated[chIdx] = { ...updated[chIdx], image: e.target.value };
                                        updateItem(item.id, { charmOptions: updated });
                                      }}
                                      value={availableProductImages.includes(charm.image || '') ? (charm.image || '') : ''}
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                                        availableProductImages.includes(charm.image || '')
                                          ? 'bg-amber-100 border-amber-400 text-amber-950 font-black'
                                          : 'bg-white border-slate-200 text-slate-700'
                                      }`}
                                    >
                                      <option value="">-- Gán từ ảnh SP --</option>
                                      {availableProductImages.map((imgUrl, imgIdx) => (
                                        <option key={imgIdx} value={imgUrl}>
                                          {charm.image === imgUrl ? `✓ Ảnh #${imgIdx + 1}` : `Ảnh #${imgIdx + 1}`}
                                        </option>
                                      ))}
                                    </select>
                                  )}

                                  {charm.image && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...(item.charmOptions || [])];
                                        updated[chIdx] = { ...updated[chIdx], image: '' };
                                        updateItem(item.id, { charmOptions: updated });
                                      }}
                                      className="px-1.5 py-1 text-slate-400 hover:text-rose-600 rounded text-[10px] font-bold cursor-pointer"
                                    >
                                      Gỡ ảnh
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (item.charmOptions || []).filter((_, i) => i !== chIdx);
                                      updateItem(item.id, { charmOptions: updated });
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Xóa charm này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ========================================================= */}
                    {/* SECTION 3: BÙA OMAMORI MAY MẮN (WITH PHOTO, PRICE & STOCK) */}
                    {/* ========================================================= */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={item.enableOmamoriSelection ?? false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              updateItem(item.id, {
                                enableOmamoriSelection: checked,
                                omamoriOptions: checked && (!item.omamoriOptions || item.omamoriOptions.length === 0)
                                  ? DEFAULT_OMAMORI_PRESETS.slice(0, 4).map((o) => ({ ...o, stock: 10 }))
                                  : item.omamoriOptions,
                              });
                            }}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                              <span>Tùy chọn Bùa Omamori May Mắn ({item.omamoriOptions?.length || 0} loại)</span>
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Mỗi bùa có ảnh minh họa, phụ thu và tồn kho riêng.
                            </span>
                          </div>
                        </label>

                        {item.enableOmamoriSelection && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const newOmamori: ProductOmamoriOption = {
                                  id: `omamori-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                                  name: `Bùa mới #${(item.omamoriOptions?.length || 0) + 1}`,
                                  priceDelta: 0,
                                  stock: 10,
                                };
                                updateItem(item.id, {
                                  omamoriOptions: [...(item.omamoriOptions || []), newOmamori],
                                });
                              }}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Thêm Bùa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateItem(item.id, {
                                  omamoriOptions: DEFAULT_OMAMORI_PRESETS.map((o) => ({ ...o, stock: 10 })),
                                });
                                showAdminToast('✓ Đã nạp mẫu Bùa Omamori chuẩn!');
                              }}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              + Nạp Bùa mẫu
                            </button>
                          </div>
                        )}
                      </div>

                      {item.enableOmamoriSelection && (
                        <div className="space-y-3 pt-2">
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Tiêu đề nhóm Bùa Omamori
                            </label>
                            <input
                              type="text"
                              value={item.omamoriTitle || ''}
                              onChange={(e) => updateItem(item.id, { omamoriTitle: e.target.value })}
                              placeholder="Vd: Chọn Bùa Omamori May Mắn..."
                              className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                            />
                          </div>

                          <div className="space-y-2">
                            {(item.omamoriOptions || []).map((omamori, omIdx) => (
                              <div
                                key={omamori.id || omIdx}
                                className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 hover:border-rose-300 transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-900 text-[10px] font-black flex items-center justify-center shrink-0">
                                    {omIdx + 1}
                                  </span>
                                  {omamori.image ? (
                                    <div className="w-11 h-11 rounded-lg overflow-hidden border border-rose-300 bg-slate-50 shrink-0 shadow-2xs">
                                      <img src={omamori.image} alt={omamori.name} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-11 h-11 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                      <Sparkles className="w-4 h-4 text-slate-400" />
                                    </div>
                                  )}

                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Tên Bùa
                                    </label>
                                    <input
                                      type="text"
                                      value={omamori.name}
                                      onChange={(e) => {
                                        const updated = [...(item.omamoriOptions || [])];
                                        updated[omIdx] = { ...updated[omIdx], name: e.target.value };
                                        updateItem(item.id, { omamoriOptions: updated });
                                      }}
                                      placeholder="Vd: Bình An, May Mắn, Học Tập..."
                                      className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 w-36 focus:outline-none focus:border-rose-500 focus:bg-white"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Phụ thu (+đ)
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1000}
                                      value={omamori.priceDelta ?? 0}
                                      onChange={(e) => {
                                        const updated = [...(item.omamoriOptions || [])];
                                        updated[omIdx] = { ...updated[omIdx], priceDelta: parseInt(e.target.value, 10) || 0 };
                                        updateItem(item.id, { omamoriOptions: updated });
                                      }}
                                      placeholder="0"
                                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-rose-700 w-24 text-center focus:outline-none focus:border-rose-500 focus:bg-white"
                                    />
                                  </div>

                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Tồn kho (Stock)
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={omamori.stock ?? 10}
                                      onChange={(e) => {
                                        const updated = [...(item.omamoriOptions || [])];
                                        updated[omIdx] = { ...updated[omIdx], stock: parseInt(e.target.value, 10) || 0 };
                                        updateItem(item.id, { omamoriOptions: updated });
                                      }}
                                      placeholder="Kho"
                                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 w-20 text-center focus:outline-none focus:border-rose-500 focus:bg-white"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <label className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                                    <Upload className="w-3 h-3" />
                                    <span>Tải ảnh</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          processOptionImageFile(file, (dataUrl) => {
                                            const updated = [...(item.omamoriOptions || [])];
                                            updated[omIdx] = { ...updated[omIdx], image: dataUrl };
                                            updateItem(item.id, { omamoriOptions: updated });
                                            showAdminToast(`✓ Đã cập nhật ảnh cho bùa "${omamori.name}"!`);
                                          }, 400);
                                        }
                                      }}
                                    />
                                  </label>

                                  {omamori.image && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...(item.omamoriOptions || [])];
                                        updated[omIdx] = { ...updated[omIdx], image: '' };
                                        updateItem(item.id, { omamoriOptions: updated });
                                      }}
                                      className="px-1.5 py-1 text-slate-400 hover:text-rose-600 rounded text-[10px] font-bold cursor-pointer"
                                    >
                                      Gỡ ảnh
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (item.omamoriOptions || []).filter((_, i) => i !== omIdx);
                                      updateItem(item.id, { omamoriOptions: updated });
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Xóa bùa này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ========================================================= */}
                    {/* SECTION 4: KHOEN MÓC KHÓA (WITH PHOTO, PRICE & STOCK) */}
                    {/* ========================================================= */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={item.enableKhoenSelection ?? false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              updateItem(item.id, {
                                enableKhoenSelection: checked,
                                khoenOptions: checked && (!item.khoenOptions || item.khoenOptions.length === 0)
                                  ? DEFAULT_KHOEN_PRESETS.slice(0, 4).map((k) => ({ ...k, stock: 10 }))
                                  : item.khoenOptions,
                              });
                            }}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                              <span>Tùy chọn Khoen Móc Khóa ({item.khoenOptions?.length || 0} loại)</span>
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Mỗi loại khoen có ảnh minh họa, phụ thu và tồn kho riêng.
                            </span>
                          </div>
                        </label>

                        {item.enableKhoenSelection && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const newKhoen: ProductKhoenOption = {
                                  id: `khoen-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                                  name: `Khoen mới #${(item.khoenOptions?.length || 0) + 1}`,
                                  priceDelta: 0,
                                  stock: 10,
                                };
                                updateItem(item.id, {
                                  khoenOptions: [...(item.khoenOptions || []), newKhoen],
                                });
                              }}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Thêm Khoen</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateItem(item.id, {
                                  khoenOptions: DEFAULT_KHOEN_PRESETS.map((k) => ({ ...k, stock: 10 })),
                                });
                                showAdminToast('✓ Đã nạp mẫu Khoen Móc Khóa chuẩn!');
                              }}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              + Nạp Khoen mẫu
                            </button>
                          </div>
                        )}
                      </div>

                      {item.enableKhoenSelection && (
                        <div className="space-y-3 pt-2">
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Tiêu đề nhóm Khoen Móc Khóa
                            </label>
                            <input
                              type="text"
                              value={item.khoenTitle || ''}
                              onChange={(e) => updateItem(item.id, { khoenTitle: e.target.value })}
                              placeholder="Vd: Chọn Loại Khoen Cài / Móc Khóa..."
                              className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                            />
                          </div>

                          <div className="space-y-2">
                            {(item.khoenOptions || []).map((khoen, kIdx) => (
                              <div
                                key={khoen.id || kIdx}
                                className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 hover:border-sky-300 transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-900 text-[10px] font-black flex items-center justify-center shrink-0">
                                    {kIdx + 1}
                                  </span>
                                  {khoen.image ? (
                                    <div className="w-11 h-11 rounded-lg overflow-hidden border border-sky-300 bg-slate-50 shrink-0 shadow-2xs">
                                      <img src={khoen.image} alt={khoen.name} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-11 h-11 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                      <LinkIcon className="w-4 h-4 text-slate-400" />
                                    </div>
                                  )}

                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Tên Khoen
                                    </label>
                                    <input
                                      type="text"
                                      value={khoen.name}
                                      onChange={(e) => {
                                        const updated = [...(item.khoenOptions || [])];
                                        updated[kIdx] = { ...updated[kIdx], name: e.target.value };
                                        updateItem(item.id, { khoenOptions: updated });
                                      }}
                                      placeholder="Vd: Khoen Tròn Inox, Khoen Càng Cua..."
                                      className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 w-36 focus:outline-none focus:border-sky-500 focus:bg-white"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Phụ thu (+đ)
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1000}
                                      value={khoen.priceDelta ?? 0}
                                      onChange={(e) => {
                                        const updated = [...(item.khoenOptions || [])];
                                        updated[kIdx] = { ...updated[kIdx], priceDelta: parseInt(e.target.value, 10) || 0 };
                                        updateItem(item.id, { khoenOptions: updated });
                                      }}
                                      placeholder="0"
                                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-sky-700 w-24 text-center focus:outline-none focus:border-sky-500 focus:bg-white"
                                    />
                                  </div>

                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Tồn kho (Stock)
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={khoen.stock ?? 10}
                                      onChange={(e) => {
                                        const updated = [...(item.khoenOptions || [])];
                                        updated[kIdx] = { ...updated[kIdx], stock: parseInt(e.target.value, 10) || 0 };
                                        updateItem(item.id, { khoenOptions: updated });
                                      }}
                                      placeholder="Kho"
                                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 w-20 text-center focus:outline-none focus:border-sky-500 focus:bg-white"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <label className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                                    <Upload className="w-3 h-3" />
                                    <span>Tải ảnh</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          processOptionImageFile(file, (dataUrl) => {
                                            const updated = [...(item.khoenOptions || [])];
                                            updated[kIdx] = { ...updated[kIdx], image: dataUrl };
                                            updateItem(item.id, { khoenOptions: updated });
                                            showAdminToast(`✓ Đã cập nhật ảnh cho khoen "${khoen.name}"!`);
                                          }, 400);
                                        }
                                      }}
                                    />
                                  </label>

                                  {khoen.image && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...(item.khoenOptions || [])];
                                        updated[kIdx] = { ...updated[kIdx], image: '' };
                                        updateItem(item.id, { khoenOptions: updated });
                                      }}
                                      className="px-1.5 py-1 text-slate-400 hover:text-rose-600 rounded text-[10px] font-bold cursor-pointer"
                                    >
                                      Gỡ ảnh
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (item.khoenOptions || []).filter((_, i) => i !== kIdx);
                                      updateItem(item.id, { khoenOptions: updated });
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Xóa khoen này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Product Picker Modal: Choose from Existing Products in Store */}
      {isProductPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-purple-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">
                    {productPickerTargetItemId ? 'Đổi sang sản phẩm khác' : 'Chọn sản phẩm có sẵn trong cửa hàng để gộp vào Combo'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Hệ thống sẽ tự động nạp ảnh, tên, toàn bộ phân loại màu sắc (kèm ảnh & tồn kho), charm và bùa của sản phẩm này.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsProductPickerOpen(false);
                  setProductPickerTargetItemId(null);
                }}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Box */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearchQuery}
                  onChange={(e) => setPickerSearchQuery(e.target.value)}
                  placeholder="Tìm sản phẩm theo tên, danh mục hoặc mã..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredExistingProducts.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Không tìm thấy sản phẩm nào phù hợp với từ khóa "{pickerSearchQuery}".
                </div>
              ) : (
                filteredExistingProducts.map((p) => {
                  const colorCount = p.colorOptions?.length || p.availableColors?.length || 0;
                  const charmCount = p.charmOptions?.length || 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleApplyExistingProduct(p, productPickerTargetItemId)}
                      className="p-3 rounded-2xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/40 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 group-hover:scale-105 transition-transform">
                          <img
                            src={p.image || '/assets/bracelet.jpg'}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-black text-slate-900 group-hover:text-purple-700 transition-colors truncate">
                            {p.name}
                          </h5>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-xs font-bold text-amber-700">
                              {p.price.toLocaleString('vi-VN')}đ
                            </span>
                            {p.category && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                                {p.category}
                              </span>
                            )}
                            {colorCount > 0 && (
                              <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded font-semibold">
                                {colorCount} màu (có ảnh & stock)
                              </span>
                            )}
                            {charmCount > 0 && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-semibold">
                                {charmCount} charm
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-3.5 py-1.5 bg-purple-600 group-hover:bg-purple-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-2xs transition-colors"
                      >
                        Chọn SP này ➔
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                Hiển thị {filteredExistingProducts.length} sản phẩm
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsProductPickerOpen(false);
                  setProductPickerTargetItemId(null);
                }}
                className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
