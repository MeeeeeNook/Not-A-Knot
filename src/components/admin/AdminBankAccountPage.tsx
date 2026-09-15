import React, { useState } from 'react';
import { SiteContentConfig, BankAccountConfig } from '../../types';
import { CreditCard, QrCode, Check, Building2, User, Hash, ShieldCheck, AlertCircle } from 'lucide-react';
import { saveSiteContentToFirestore } from '../../firebase';

interface AdminBankAccountPageProps {
  siteContent?: SiteContentConfig;
  onUpdateSiteContent: (config: SiteContentConfig) => void;
  onNotify?: (msg: string) => void;
  onToast?: (msg: string) => void;
}

const POPULAR_BANKS = [
  { id: 'VCB', name: 'Vietcombank (Ngoại Thương Việt Nam)' },
  { id: 'TPB', name: 'TPBank (Tiên Phong)' },
  { id: 'MB', name: 'MBBank (Quân Đội)' },
  { id: 'TCB', name: 'Techcombank (Kỹ Thương)' },
  { id: 'BIDV', name: 'BIDV (Đầu Tư & Phát Triển)' },
  { id: 'CTG', name: 'VietinBank (Công Thương)' },
  { id: 'ACB', name: 'ACB (Á Châu)' },
  { id: 'VPB', name: 'VPBank (Việt Nam Thịnh Vượng)' },
  { id: 'STB', name: 'Sacombank (Sài Gòn Thương Tín)' },
  { id: 'VIB', name: 'VIB (Quốc Tế)' },
  { id: 'SHB', name: 'SHB (Sài Gòn - Hà Nội)' },
  { id: 'HDB', name: 'HDBank (Phát Triển TP.HCM)' },
  { id: 'MSB', name: 'MSB (Hàng Hải)' },
  { id: 'OCB', name: 'OCB (Phương Đông)' },
  { id: 'SEAB', name: 'SeABank (Đông Nam Á)' }
];

export const AdminBankAccountPage: React.FC<AdminBankAccountPageProps> = ({
  siteContent,
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

  const [bankAccount, setBankAccount] = useState<BankAccountConfig>(() => {
    return siteContent?.bankAccount || {
      bankId: 'VCB',
      bankName: 'Vietcombank',
      accountNumber: '',
      accountHolder: '',
      branch: '',
      qrTemplate: 'compact2'
    };
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleBankChange = (bankId: string) => {
    const found = POPULAR_BANKS.find((b) => b.id === bankId);
    setBankAccount((prev) => ({
      ...prev,
      bankId,
      bankName: found ? found.name.split(' (')[0] : bankId
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedConfig: SiteContentConfig = {
        ...(siteContent || ({} as any)),
        bankAccount
      };

      onUpdateSiteContent(updatedConfig);
      await saveSiteContentToFirestore(updatedConfig);

      setSaveSuccess(true);
      notify('Đã lưu thông tin tài khoản ngân hàng & VietQR thành công!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Lỗi lưu tài khoản ngân hàng:', err);
      notify('Lỗi lưu dữ liệu lên Cloud. Vui lòng kiểm tra lại kết nối!');
    } finally {
      setIsSaving(false);
    }
  };

  const qrImageUrl = bankAccount.bankId && bankAccount.accountNumber
    ? `https://img.vietqr.io/image/${bankAccount.bankId}-${bankAccount.accountNumber}-${bankAccount.qrTemplate || 'compact2'}.png?amount=250000&addInfo=${encodeURIComponent('NOT A KNOT DEMO')}&accountName=${encodeURIComponent(bankAccount.accountHolder || 'NOT A KNOT')}`
    : '';

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Header Description */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
            <CreditCard className="w-5 h-5 text-amber-500" />
            <span>Cấu Hình Tài Khoản Ngân Hàng (VietQR)</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Thiết lập thông tin nhận thanh toán chuyển khoản qua ngân hàng. Hệ thống sẽ tự động tạo mã QR động cho khách hàng khi đặt hàng.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{isSaving ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Thông tin tài khoản ngân hàng đã được cập nhật thành công lên hệ thống và Cloud!</span>
        </div>
      )}

      {/* Main Grid: Form + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: Bank Details */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800">Thông Tin Tài Khoản Nhận Tiền</h2>
            <p className="text-xs text-slate-500 mt-0.5">Nhập chính xác để khách hàng quét mã VietQR tự động điền đầy đủ</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Ngân hàng thụ hưởng *</span>
              </label>
              <select
                value={bankAccount.bankId}
                onChange={(e) => handleBankChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {POPULAR_BANKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} - {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-500" />
                  <span>Số tài khoản *</span>
                </label>
                <input
                  type="text"
                  value={bankAccount.accountNumber}
                  onChange={(e) =>
                    setBankAccount((prev) => ({
                      ...prev,
                      accountNumber: e.target.value.replace(/\s+/g, '')
                    }))
                  }
                  placeholder="VD: 1028394859"
                  className="w-full px-3.5 py-2.5 text-xs font-mono font-bold tracking-wider border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tên chủ tài khoản *</span>
                </label>
                <input
                  type="text"
                  value={bankAccount.accountHolder}
                  onChange={(e) =>
                    setBankAccount((prev) => ({
                      ...prev,
                      accountHolder: e.target.value.toUpperCase()
                    }))
                  }
                  placeholder="VD: NGUYEN VAN A"
                  className="w-full px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chi nhánh (Không bắt buộc)
                </label>
                <input
                  type="text"
                  value={bankAccount.branch || ''}
                  onChange={(e) =>
                    setBankAccount((prev) => ({
                      ...prev,
                      branch: e.target.value
                    }))
                  }
                  placeholder="VD: Sở Giao Dịch TP.HCM..."
                  className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mẫu hiển thị VietQR (Template)
                </label>
                <select
                  value={bankAccount.qrTemplate || 'compact2'}
                  onChange={(e: any) =>
                    setBankAccount((prev) => ({
                      ...prev,
                      qrTemplate: e.target.value
                    }))
                  }
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="compact2">Gọn gàng (Có logo & số tiền - Khuyên dùng)</option>
                  <option value="compact">Gọn vừa (Compact)</option>
                  <option value="qr_only">Chỉ mã QR (Không khung viền)</option>
                  <option value="print">Bản in chuẩn (Print)</option>
                </select>
              </div>
            </div>

            {/* Practical Notes */}
            <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-xl space-y-2 mt-4">
              <span className="text-xs font-bold text-amber-900 block flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Quy trình tự động hóa thanh toán VietQR:
              </span>
              <ul className="text-xs text-amber-950 space-y-1 pl-5 list-disc font-medium">
                <li>
                  <strong>Số tiền:</strong> Hệ thống tự động điền đúng tổng tiền đơn hàng của khách.
                </li>
                <li>
                  <strong>Nội dung chuyển khoản:</strong> Tự động gán mã tra cứu đơn hoặc tên khách và SĐT để shop dễ dàng đối soát.
                </li>
                <li>
                  <strong>Khách hàng:</strong> Chỉ cần dùng app ngân hàng bất kỳ quét mã là chuyển khoản được ngay lập tức không sợ sai số tài khoản.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Preview: Live VietQR */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center text-center space-y-4">
          <div className="w-full border-b border-slate-100 pb-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-emerald-600" />
              Xem Trước Mã VietQR Thực Tế
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Live Preview
            </span>
          </div>

          {qrImageUrl ? (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 inline-block w-full max-w-[300px]">
              <img
                src={qrImageUrl}
                alt="VietQR Preview"
                className="w-full h-auto rounded-xl object-contain mx-auto shadow-2xs"
                onError={(e: any) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="mt-3 text-left space-y-1 text-xs border-t border-slate-200 pt-2 text-slate-700">
                <div>
                  <strong>Ngân hàng:</strong> {bankAccount.bankName || bankAccount.bankId}
                </div>
                <div>
                  <strong>Số TK:</strong>{' '}
                  <span className="font-mono font-bold text-slate-900">{bankAccount.accountNumber}</span>
                </div>
                <div>
                  <strong>Chủ TK:</strong>{' '}
                  <span className="font-bold uppercase text-slate-900">
                    {bankAccount.accountHolder || 'Chưa nhập'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 px-4 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 w-full">
              Vui lòng nhập Số tài khoản và Tên chủ tài khoản để tạo bản xem trước VietQR.
            </div>
          )}

          <div className="w-full text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 text-left">
            Sau khi nhấn <strong>"Lưu Thay Đổi"</strong>, thông tin này sẽ được áp dụng ngay lập tức cho màn hình thanh toán của khách mua hàng trên website.
          </div>
        </div>
      </div>
    </div>
  );
};
