import React, { useState } from 'react';
import { X, ShieldCheck, FileText, RefreshCw, CreditCard, Info, CheckCircle, ExternalLink } from 'lucide-react';

export type PolicyTab = 'privacy' | 'terms' | 'returns' | 'shipping_payment' | 'transparency';

interface LegalPoliciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: PolicyTab;
}

export const LegalPoliciesModal: React.FC<LegalPoliciesModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy'
}) => {
  const [activeTab, setActiveTab] = useState<PolicyTab>(initialTab);

  if (!isOpen) return null;

  return (
    <div
      id="legal-policies-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="legal-policies-modal-container"
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                Chính Sách & Quy Định Minh Bạch
              </h3>
              <p className="text-xs text-slate-500">
                NOT A KNOT Handmade Studio • Cam kết bảo mật & quyền lợi khách hàng
              </p>
            </div>
          </div>
          <button
            id="close-legal-policies-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-4 overflow-x-auto no-scrollbar">
          <button
            id="tab-policy-privacy"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'privacy'
                ? 'border-amber-600 text-amber-900 bg-amber-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Bảo Mật Thông Tin
          </button>

          <button
            id="tab-policy-terms"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'terms'
                ? 'border-amber-600 text-amber-900 bg-amber-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Điều Khoản Sử Dụng
          </button>

          <button
            id="tab-policy-returns"
            onClick={() => setActiveTab('returns')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'returns'
                ? 'border-amber-600 text-amber-900 bg-amber-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Đổi Trả & Bảo Hành
          </button>

          <button
            id="tab-policy-shipping"
            onClick={() => setActiveTab('shipping_payment')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'shipping_payment'
                ? 'border-amber-600 text-amber-900 bg-amber-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Thanh Toán & Giao Hàng
          </button>

          <button
            id="tab-policy-transparency"
            onClick={() => setActiveTab('transparency')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'transparency'
                ? 'border-amber-600 text-amber-900 bg-amber-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Info className="w-4 h-4" />
            Minh Bạch Dự Án
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm leading-relaxed max-h-[60vh]">
          {/* TAB 1: PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block mb-0.5">Cam Kết Tuân Thủ Pháp Luật & Bảo Mật Tuyệt Đối:</strong>
                  NOT A KNOT cam kết tuân thủ nghiêm ngặt Nghị định số 13/2023/NĐ-CP của Chính phủ Việt Nam về Bảo vệ dữ liệu cá nhân. Toàn bộ thông tin quý khách cung cấp chỉ phục vụ duy nhất mục đích chế tác và chuyển phát đơn hàng.
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-base mb-2">1. Thu Thập Dữ Liệu Khách Hàng</h4>
                <p className="text-slate-600 mb-2">
                  Khi quý khách tiến hành đặt mua phụ kiện thủ công hoặc liên hệ tư vấn, hệ thống chỉ ghi nhận các thông tin cơ bản gồm:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li><strong>Họ và tên</strong>: Để ghi nhãn bưu phẩm chuyển phát.</li>
                  <li><strong>Số điện thoại</strong>: Để nhân viên bưu tá liên lạc khi giao hàng tận nơi.</li>
                  <li><strong>Địa chỉ nhận hàng</strong>: Để định tuyến bưu cục giao phát nhanh.</li>
                  <li><strong>Email (không bắt buộc)</strong>: Để gửi thư xác nhận mã vận đơn tự động.</li>
                </ul>
                <p className="text-slate-600 mt-2">
                  <em>Lưu ý an toàn:</em> NOT A KNOT <strong>không bao giờ</strong> yêu cầu khách hàng cung cấp mật khẩu ngân hàng, mã OTP, số thẻ tín dụng hay bất kỳ thông tin xác thực tài chính nhạy cảm nào.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-base mb-2">2. Mục Đích Sử Dụng Dữ Liệu</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Xác nhận chi tiết đơn hàng (size cổ tay, màu sắc dây đan, charm đính kèm).</li>
                  <li>In hóa đơn chuyển phát và gửi hàng qua các đơn vị bưu chính uy tín (GHTK, Viettel Post).</li>
                  <li>Hỗ trợ tra cứu trạng thái đơn hàng theo mã đơn trực tuyến trên website.</li>
                  <li>Tiếp nhận phản hồi và thực hiện chính sách bảo hành trọn đời đối với dây đan.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-base mb-2">3. Cam Kết Không Chia Sẻ Dữ Liệu</h4>
                <p className="text-slate-600">
                  NOT A KNOT cam đoan tuyệt đối không bán, không cho thuê, không chia sẻ hay phát tán thông tin liên lạc của khách hàng cho bất kỳ bên thứ ba nào vì mục đích quảng cáo hoặc tiếp thị phiền hà.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: TERMS OF SERVICE */}
          {activeTab === 'terms' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="font-bold text-slate-900 text-base mb-2">1. Quy Trình Đặt Hàng & Gia Công Thủ Công</h4>
                <p className="text-slate-600 mb-2">
                  Tất cả các sản phẩm phụ kiện tại NOT A KNOT là sản phẩm được đan tay tỉ mỉ theo yêu cầu kích thước riêng của từng đơn hàng.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Thời gian chuẩn bị và hoàn thiện đan thủ công từ 24h - 48h làm việc.</li>
                  <li>Khách hàng được quyền kiểm tra hàng trước khi thanh toán (Đồng kiểm).</li>
                  <li>Mọi thông tin giá niêm yết trên website đều bằng Việt Nam Đồng (VNĐ) và đã bao gồm công đan hoàn thiện.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-base mb-2">2. Trách Nhiệm Của Khách Hàng</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Cung cấp số điện thoại và địa chỉ nhận hàng chính xác để bưu phẩm giao đúng hạn.</li>
                  <li>Kiểm tra size cổ tay theo hướng dẫn trước khi đặt để sản phẩm vừa vặn nhất.</li>
                  <li>Giữ liên lạc khi bưu tá giao hàng hoặc thông báo đổi thời gian nhận nếu bận.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-base mb-2">3. Quyền Sở Hữu Hình Ảnh & Thương Hiệu</h4>
                <p className="text-slate-600">
                  Toàn bộ hình ảnh sản phẩm chụp thực tế, tài liệu giới thiệu và bộ nhận diện NOT A KNOT được bảo lưu quyền tác giả bởi nhóm sáng tạo NOT A KNOT Studio.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: RETURNS & WARRANTY */}
          {activeTab === 'returns' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
                <strong>Chính sách Bảo Hành Trọn Đời Độc Quyền:</strong> Miễn phí đan lại dây, xử lý mối thắt và làm mới phụ kiện charm đồng trọn đời sản phẩm.
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-base mb-2">1. Đổi Size Miễn Phí Trong 7 Ngày</h4>
                <p className="text-slate-600 mb-2">
                  Nếu bạn nhận vòng tay đeo không vừa cổ tay (quá rộng hoặc quá chật):
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Liên hệ ngay với NOT A KNOT qua Zalo, Messenger hoặc Hotline trong vòng 7 ngày kể từ khi nhận hàng.</li>
                  <li>Shop sẽ hỗ trợ đan lại size vừa vặn miễn phí 100% công chế tác.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-base mb-2">2. Điều Kiện Đổi Trả Hàng Mới</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Sản phẩm giao không đúng mẫu mã, màu sắc hoặc thiếu charm theo đơn đặt.</li>
                  <li>Sản phẩm có lỗi kỹ thuật phát sinh trong quá trình vận chuyển (đứt gãy, trầy xước).</li>
                  <li>Sản phẩm còn mới, chưa qua sử dụng và đầy đủ bao bì đính kèm.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: SHIPPING & PAYMENT */}
          {activeTab === 'shipping_payment' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="font-bold text-slate-900 text-base mb-2">1. Hình Thức Thanh Toán An Toàn</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                    <span className="font-bold text-slate-900 text-xs block mb-1">Thanh toán khi nhận hàng (COD)</span>
                    <p className="text-xs text-slate-600">Khách hàng nhận hàng, kiểm tra sản phẩm tận tay rồi mới thanh toán tiền mặt cho shipper.</p>
                  </div>
                  <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                    <span className="font-bold text-slate-900 text-xs block mb-1">Chuyển khoản QR (VietQR)</span>
                    <p className="text-xs text-slate-600">Quét mã QR qua app ngân hàng bất kỳ. Tự động điền đúng số tiền và cú pháp, an toàn và nhanh chóng.</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-base mb-2">2. Biểu Phí Vận Chuyển Toàn Quốc</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li><strong>Nội thành & Ngoại thành Hà Nội</strong>: Miễn phí giao hàng (0đ) cho tất cả các đơn hàng.</li>
                  <li><strong>Các tỉnh thành khác trên toàn quốc</strong>: Đồng giá hỗ trợ 20.000đ/đơn hàng.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-base mb-2">3. Thời Gian Giao Hàng</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Khu vực Hà Nội: 1 - 2 ngày làm việc.</li>
                  <li>Các tỉnh thành miền Bắc & miền Trung: 2 - 3 ngày làm việc.</li>
                  <li>Các tỉnh thành miền Nam & Tây Nam Bộ: 3 - 4 ngày làm việc.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 5: TRANSPARENCY & ACADEMIC PROJECT DISCLAIMER */}
          {activeTab === 'transparency' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <Info className="w-4 h-4" />
                  Minh Bạch Thông Tin & Bản Chất Dự Án
                </div>
                <p>
                  <strong>NOT A KNOT</strong> cùng hệ thống website chính thức (<span className="font-mono">https://www.notaknot.id.vn</span>) là dự án học tập và bài tập lớn thuộc khuôn khổ môn <em>Quản trị tác nghiệp Thương mại điện tử</em> - <strong>Đại học Kinh tế Quốc dân (NEU)</strong>.
                </p>
                <p>
                  Dự án được xây dựng và vận hành với mục đích nghiên cứu học thuật, trải nghiệm mô hình thương mại điện tử thực tế, áp dụng các tiêu chuẩn thiết kế UI/UX hiện đại và quy trình chăm sóc khách hàng văn minh.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Thông Tin Liên Hệ Xưởng Chế Tác:</h4>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li><strong>Tên xưởng</strong>: NOT A KNOT Handmade Accessories Studio</li>
                  <li><strong>Địa chỉ liên hệ</strong>: 207 Giải Phóng, Phường Đồng Tâm, Quận Hai Bà Trưng, Hà Nội</li>
                  <li><strong>Hotline / Zalo tư vấn</strong>: 0987.654.321</li>
                  <li><strong>Email tiếp nhận</strong>: <span className="font-mono">noreply.notaknot@gmail.com</span></li>
                  <li><strong>Fanpage Facebook</strong>: <a href="https://www.facebook.com/profile.php?id=61593591390851" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline inline-flex items-center gap-1">facebook.com/profile.php?id=61593591390851 <ExternalLink className="w-3 h-3" /></a></li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Áp dụng từ: Năm 2026 • Phiên bản 2.4</span>
          <button
            id="close-legal-policies-modal-bottom-btn"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Đã hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
