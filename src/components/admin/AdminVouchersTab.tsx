import React, { useState, useEffect } from 'react';
import { Voucher, VoucherType } from '../../types';
import {
  getVouchers,
  saveVoucher,
  deleteVoucher,
  verifyVoucherIntegrity,
  generateVoucherEncryption
} from '../../utils/voucherManager';
import {
  Ticket,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Percent,
  Truck,
  Calendar,
  AlertCircle,
  RefreshCw,
  Search,
  Check
} from 'lucide-react';

export const AdminVouchersTab: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);

  // Verification status map: voucherId -> boolean
  const [integrityMap, setIntegrityMap] = useState<Record<string, boolean>>({});

  // Form states
  const [code, setCode] = useState<string>('');
  const [type, setType] = useState<VoucherType>('percent');
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [minOrderValue, setMinOrderValue] = useState<number>(0);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const data = await getVouchers();
      setVouchers(data);

      // Verify integrity for all vouchers
      const map: Record<string, boolean> = {};
      for (const v of data) {
        map[v.id] = await verifyVoucherIntegrity(v);
      }
      setIntegrityMap(map);
    } catch (err) {
      console.error('Lỗi tải mã giảm giá:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVouchers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingVoucher(null);
    setCode('');
    setType('percent');
    setDiscountPercent(10);
    setMinOrderValue(100000);
    setMaxDiscountAmount(50000);
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    // Default 30 days from now
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    setEndDate(nextMonth.toISOString().split('T')[0]);
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (v: Voucher) => {
    setEditingVoucher(v);
    setCode(v.code);
    setType(v.type);
    setDiscountPercent(v.discountPercent || 10);
    setMinOrderValue(v.minOrderValue || 0);
    setMaxDiscountAmount(v.maxDiscountAmount || 0);
    setStartDate(v.startDate ? v.startDate.split('T')[0] : '');
    setEndDate(v.endDate ? v.endDate.split('T')[0] : '');
    setIsActive(v.isActive);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setFormError('Vui lòng nhập mã giảm giá.');
      return;
    }

    if (type === 'percent' && (discountPercent <= 0 || discountPercent > 100)) {
      setFormError('Phần trăm giảm giá phải từ 1% đến 100%.');
      return;
    }

    setIsSaving(true);
    try {
      const voucherId = editingVoucher ? editingVoucher.id : `VOUCHER_${Date.now()}`;
      const payloadWithoutEncrypt: Omit<Voucher, 'encryptedData'> = {
        id: voucherId,
        code: cleanCode,
        type,
        discountPercent: type === 'percent' ? Number(discountPercent) : 0,
        minOrderValue: Number(minOrderValue) || 0,
        maxDiscountAmount: type === 'percent' ? Number(maxDiscountAmount) || 0 : 0,
        startDate,
        endDate,
        isActive,
        createdAt: editingVoucher?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const encryptedData = await generateVoucherEncryption(payloadWithoutEncrypt);
      const finalVoucher: Voucher = {
        ...payloadWithoutEncrypt,
        encryptedData
      };

      await saveVoucher(finalVoucher);
      setIsModalOpen(false);
      await loadVouchers();
    } catch (err) {
      console.error('Lỗi khi lưu voucher:', err);
      setFormError('Không thể lưu mã giảm giá. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (v: Voucher) => {
    try {
      const updated = { ...v, isActive: !v.isActive };
      await saveVoucher(updated);
      await loadVouchers();
    } catch (err) {
      alert('Không thể cập nhật trạng thái mã.');
    }
  };

  const handleDelete = async (voucherId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mã giảm giá này?')) return;
    try {
      await deleteVoucher(voucherId);
      await loadVouchers();
    } catch (err) {
      alert('Không thể xóa mã giảm giá.');
    }
  };

  const filteredVouchers = vouchers.filter((v) =>
    v.code.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
            <Ticket className="w-5 h-5 text-amber-800" />
          </div>
          <div>
            <h2 className="text-lg font-black text-neutral-950">Quản Lý Mã Giảm Giá</h2>
            <p className="text-xs text-neutral-500 font-medium">
              Tạo và phân quyền mã ưu đãi với lớp mã hóa checksum bảo mật tuyệt đối.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadVouchers}
            className="p-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-colors cursor-pointer"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Tạo Mã Mới</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm theo mã voucher..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-medium focus:outline-none focus:border-neutral-950 transition-colors shadow-2xs"
        />
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3 pointer-events-none" />
      </div>

      {/* Vouchers Grid / Table */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-xs text-neutral-500 font-medium">Đang tải danh sách voucher mã hóa...</p>
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-3">
          <Ticket className="w-10 h-10 text-neutral-300 mx-auto" />
          <p className="text-sm font-bold text-neutral-700">Chưa có mã giảm giá nào</p>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Bấm "Tạo Mã Mới" để tạo chương trình khuyến mãi giảm giá hoặc miễn phí vận chuyển cho khách hàng.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVouchers.map((v) => {
            const isVerified = integrityMap[v.id] ?? false;
            const now = new Date();
            const isExpired = v.endDate && new Date(v.endDate).setHours(23, 59, 59, 999) < now.getTime();
            const isNotStartedYet = v.startDate && new Date(v.startDate).setHours(0, 0, 0, 0) > now.getTime();

            return (
              <div
                key={v.id}
                className={`bg-white rounded-2xl border ${
                  v.isActive && !isExpired ? 'border-neutral-200 shadow-2xs' : 'border-neutral-200/60 opacity-75 bg-neutral-50/50'
                } p-5 space-y-4 flex flex-col justify-between relative overflow-hidden transition-all`}
              >
                {/* Header Tag */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-lg text-neutral-950 tracking-wider bg-amber-100 text-amber-950 px-3 py-1 rounded-lg border border-amber-300">
                        {v.code}
                      </span>
                      {v.type === 'freeship' ? (
                        <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-sky-200">
                          <Truck className="w-3 h-3 text-sky-600" />
                          Freeship
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                          <Percent className="w-3 h-3 text-emerald-600" />
                          Giảm {v.discountPercent}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(v)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      v.isActive
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                    }`}
                  >
                    {v.isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-neutral-500" />}
                    <span>{v.isActive ? 'Đang bật' : 'Tắt'}</span>
                  </button>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs text-neutral-600 bg-neutral-50/80 p-3 rounded-xl border border-neutral-100">
                  {v.type === 'percent' && (
                    <div className="flex justify-between">
                      <span>Mức giảm tối đa:</span>
                      <strong className="text-neutral-900 font-mono">
                        {v.maxDiscountAmount ? `${v.maxDiscountAmount.toLocaleString('vi-VN')}đ` : 'Không giới hạn'}
                      </strong>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Đơn tối thiểu:</span>
                    <strong className="text-neutral-900 font-mono">
                      {v.minOrderValue ? `${v.minOrderValue.toLocaleString('vi-VN')}đ` : '0đ'}
                    </strong>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-neutral-200/60">
                    <span className="flex items-center gap-1 text-neutral-500">
                      <Calendar className="w-3 h-3" /> Hạn dùng:
                    </span>
                    <span className="font-medium text-neutral-800">
                      {v.startDate ? new Date(v.startDate).toLocaleDateString('vi-VN') : 'Từ nay'} -{' '}
                      {v.endDate ? new Date(v.endDate).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                    </span>
                  </div>
                </div>

                {/* Status Badges & Security Check */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    {isVerified ? (
                      <span
                        className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                        title="Dữ liệu mã checksum mã hóa toàn vẹn"
                      >
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Checksum hợp lệ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        Cần cập nhật mã hóa
                      </span>
                    )}

                    {isExpired && (
                      <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-bold border border-rose-200">
                        Đã hết hạn
                      </span>
                    )}
                    {isNotStartedYet && (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold border border-amber-200">
                        Chưa đến ngày
                      </span>
                    )}
                  </div>

                  {/* Edit / Delete buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(v)}
                      className="p-1.5 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                      title="Sửa voucher"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa voucher"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT VOUCHER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-black text-neutral-950">
                  {editingVoucher ? 'Chỉnh Sửa Mã Giảm Giá' : 'Tạo Mã Giảm Giá Mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-950 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Code */}
              <div>
                <label className="block font-bold text-neutral-950 mb-1">
                  Mã Voucher (viết hoa không dấu, ví dụ: KNOT10) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="VÍ DỤ: BANMOI2026"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-mono font-bold uppercase tracking-wider text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                />
              </div>

              {/* Type */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('percent')}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    type === 'percent'
                      ? 'border-amber-400 bg-amber-50 text-amber-950 shadow-2xs'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <Percent className="w-4 h-4 text-amber-600" />
                  <span>Giảm %</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('freeship')}
                  className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    type === 'freeship'
                      ? 'border-sky-400 bg-sky-50 text-sky-950 shadow-2xs'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <Truck className="w-4 h-4 text-sky-600" />
                  <span>Freeship</span>
                </button>
              </div>

              {/* Percent Discount value */}
              {type === 'percent' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-neutral-950 mb-1">% Giảm giá:</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none pr-8"
                      />
                      <span className="absolute right-3 top-2.5 font-bold text-neutral-400">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-950 mb-1">Mức giảm tối đa (VNĐ):</label>
                    <input
                      type="number"
                      min={0}
                      value={maxDiscountAmount}
                      onChange={(e) => setMaxDiscountAmount(Number(e.target.value))}
                      placeholder="0 = không giới hạn"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Min Order Value */}
              <div>
                <label className="block font-bold text-neutral-950 mb-1">Đơn hàng tối thiểu (VNĐ):</label>
                <input
                  type="number"
                  min={0}
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(Number(e.target.value))}
                  placeholder="Ví dụ: 200000"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                />
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-950 mb-1">Ngày bắt đầu:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-medium text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-950 mb-1">Ngày kết thúc:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-medium text-neutral-950 focus:bg-white focus:border-neutral-950 focus:outline-none"
                  />
                </div>
              </div>

              {/* Is Active */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="voucher-is-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="voucher-is-active" className="font-bold text-neutral-900 cursor-pointer">
                  Kích hoạt mã giảm giá ngay lập tức
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 font-bold text-neutral-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-amber-400" />}
                  <span>{isSaving ? 'Đang lưu...' : 'Lưu Voucher'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
