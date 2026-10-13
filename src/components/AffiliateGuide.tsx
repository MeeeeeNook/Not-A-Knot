import React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { AffiliateSystemConfig, Product, SellerUser } from '../types';
import { getAffiliateCommissionDisplay } from '../utils/affiliateCommissionDisplay';

interface AffiliateGuideProps {
  affiliate: SellerUser | null;
  config: AffiliateSystemConfig;
  products: Product[];
  onOpenLinks: () => void;
  onOpenSettings: () => void;
  onOpenOrders: () => void;
}

const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`;
const card = 'bg-white rounded-2xl border border-neutral-200/80 shadow-2xs p-5 sm:p-8 space-y-4';

export function AffiliateGuide({ affiliate, config, products, onOpenLinks, onOpenSettings, onOpenOrders }: AffiliateGuideProps) {
  const days = affiliate?.cookieDurationDays || config.cookieDurationDays || 30;
  const rate = affiliate?.commissionRate ?? config.defaultCommissionRate;
  const commissionDisplay = getAffiliateCommissionDisplay(affiliate, config.defaultCommissionRate);
  const maxOrders = affiliate?.maxOrdersPerCookieSession ?? 1;
  const model = affiliate?.commissionModel || 'standard';
  const modelLabel = model === 'by_product' ? 'Theo từng sản phẩm' : model === 'tiered' ? 'Theo giá trị từng đơn' : 'Tỷ lệ cố định';
  const limitLabel = maxOrders === 0 ? 'Không giới hạn trong thời hạn cookie' : maxOrders === 1 ? '1 đơn đầu tiên' : `Tối đa ${maxOrders} đơn mỗi lượt giới thiệu`;
  const productRates = affiliate?.productCommissions || [];
  const tiers = [...(affiliate?.tieredCommissions || [])].sort((a, b) => a.minAmount - b.minAmount);

  return (
    <div className="space-y-6 max-w-5xl text-sm text-neutral-600 leading-relaxed">
      <section className={card}>
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-rose-700 shrink-0" />
          <h2 className="text-lg font-bold text-neutral-900">Hướng dẫn dành cho đối tác Not A Knot</h2>
        </div>
        <p>Tạo liên kết, chia sẻ sản phẩm và theo dõi hoa hồng ngay trong tài khoản của bạn. Các thông số dưới đây là cấu hình hiện tại của tài khoản.</p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ['Thời hạn ghi nhận', `${days} ngày`],
            ['Số đơn trong thời hạn cookie', limitLabel],
            ['Cách tính hoa hồng', modelLabel],
            [commissionDisplay.label, commissionDisplay.value]
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-rose-50/60 border border-rose-100 p-4">
              <dt className="text-xs text-neutral-500">{label}</dt>
              <dd className="mt-1 font-semibold text-neutral-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={card}>
        <h3 className="text-base font-bold text-neutral-900">1. Bắt đầu chia sẻ</h3>
        <ol className="list-decimal pl-5 space-y-3">
          <li>Vào <strong>Cài đặt → Thông tin thanh toán</strong>, chọn ngân hàng, nhập số tài khoản và chủ tài khoản. Nhấn <strong>Lưu thay đổi</strong>. Bạn có thể chọn số tiền trong phạm vi hoa hồng ghi nhận, tạo VietQR rồi tải ảnh hoặc sao chép link gửi quản trị viên để đối soát.</li>
          <li>Mở <strong>Link &amp; Công cụ</strong>. Sao chép link trang chủ hoặc chọn danh mục, bộ sưu tập hay sản phẩm muốn giới thiệu. Danh sách lấy từ dữ liệu đang hiển thị trên cửa hàng.</li>
          <li>Dùng nút mở liên kết để kiểm tra đúng trang đích. Khi chia sẻ, giữ nguyên phần <strong>ref=</strong> kèm mã đối tác trong link để hệ thống nhận diện bạn.</li>
          <li>Nếu cần QR, chọn <strong>Tạo mã QR</strong> trên sản phẩm hoặc dùng QR trang chủ, rồi tải ảnh PNG. QR chứa liên kết giới thiệu; khách cần mở liên kết sau khi quét để ghi nhận lượt truy cập.</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onOpenLinks} className="inline-flex items-center gap-1 rounded-xl bg-rose-700 px-4 py-2 text-white font-semibold text-xs">Tạo link &amp; QR <ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={onOpenSettings} className="rounded-xl border border-neutral-200 px-4 py-2 text-neutral-800 font-semibold text-xs">Kiểm tra thông tin nhận hoa hồng</button>
        </div>
      </section>

      <section className={card}>
        <h3 className="text-base font-bold text-neutral-900">2. Đơn hàng được ghi nhận cho ai?</h3>
        <p><strong>Ưu tiên lượt nhấp cuối (Last-click):</strong> nếu khách mở link của nhiều đối tác, mã trong link được mở gần nhất sẽ thay thế mã trước đó. Thời hạn và số đơn được lưu riêng cho từng đối tác, tính từ lần mở link đầu tiên. Bấm lại cùng link khi thời hạn đó còn hiệu lực không reset bộ đếm hoặc kéo dài thời hạn.</p>
        <p><strong>Thời hạn của bạn: {days} ngày.</strong> Cookie lưu mã giới thiệu trong trình duyệt khách đã mở link. Khách quay lại bằng cùng trình duyệt vẫn có thể được ghi nhận khi cookie còn hạn và còn lượt đơn. Đổi thiết bị, đổi trình duyệt hoặc xóa/chặn cookie có thể làm mất thông tin giới thiệu.</p>
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
          <p className="font-semibold text-neutral-900">Số đơn áp dụng: {limitLabel}</p>
          <p className="mt-1">{maxOrders === 0
            ? 'Các đơn tiếp tục được ghi nhận đến ngày hết hạn tính từ lần mở link đầu tiên. Bấm lại cùng link không đổi ngày hết hạn.'
            : maxOrders === 1
              ? 'Chỉ đơn đầu tiên được ghi nhận trong thời hạn này. Bấm lại cùng link vẫn không được ghi nhận thêm; phải hết thời hạn cũ mới bắt đầu kỳ mới.'
              : `Mỗi lần đặt đơn thành công sử dụng một lượt. Khi đủ ${maxOrders} đơn thì ngừng ghi nhận, dù khách bấm lại cùng link; đặt thêm đơn không tự kéo dài thời hạn.`}</p>
        </div>
        <p>Số lượt đơn được tính khi đặt hàng thành công, không phải khi giao hàng. Hủy đơn sau đó không tự khôi phục lượt đã dùng. Đơn do nhân sự đặt qua luồng quản trị không được ghi nhận hoa hồng tiếp thị.</p>
      </section>

      <section className={card}>
        <h3 className="text-base font-bold text-neutral-900">3. Hoa hồng được tính như thế nào?</h3>
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-neutral-900 font-medium">
          Giá trị tính hoa hồng = tiền sản phẩm − giảm giá trên đơn, tối thiểu bằng 0. Không tính phí vận chuyển.
        </div>
        <p>Cơ chế đang áp dụng cho bạn: <strong>{modelLabel}</strong>. Số tiền được làm tròn đến đồng và lưu trên đơn tại thời điểm đặt hàng. Thay đổi cấu hình sau đó không tự tính lại hoa hồng đã lưu.</p>
        <div className="space-y-3">
          {model === 'standard' && <p><strong>Tỷ lệ cố định:</strong> giá trị tính hoa hồng × tỷ lệ cố định. Ví dụ với cấu hình hiện tại: tiền sản phẩm 200.000đ, giảm giá 20.000đ → 180.000đ × {rate}% = <strong>{money(Math.round(180000 * rate / 100))}</strong>. Phí giao hàng không làm tăng số này.</p>}
          {model === 'by_product' && <p><strong>Theo từng sản phẩm:</strong> mỗi sản phẩm dùng tỷ lệ riêng nếu có; sản phẩm chưa có tỷ lệ riêng dùng tỷ lệ mặc định {rate}%. Giảm giá đơn được phân bổ theo tỷ trọng tiền sản phẩm, sau đó tính và làm tròn hoa hồng từng dòng rồi cộng lại.</p>}
          {model === 'tiered' && <p><strong>Theo giá trị từng đơn:</strong> hệ thống chọn bậc từ giá trị sản phẩm sau giảm giá của chính đơn đó và áp dụng tỷ lệ của bậc cho toàn bộ giá trị tính hoa hồng. Đây không phải bậc doanh thu cộng dồn theo tháng, cũng không phải cách tính lũy tiến từng phần.</p>}
        </div>
        {model === 'by_product' && productRates.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left text-xs">
              <caption className="text-left p-3 font-semibold text-neutral-900">Tỷ lệ riêng hiện tại</caption>
              <thead className="bg-neutral-50"><tr><th className="p-3">Sản phẩm</th><th className="p-3">Hoa hồng</th></tr></thead>
              <tbody>{productRates.map((item) => <tr key={item.productId} className="border-t border-neutral-100"><td className="p-3">{products.find((p) => p.id === item.productId)?.name || item.productName || item.productId}</td><td className="p-3 font-semibold">{item.rate}%</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {model === 'tiered' && tiers.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left text-xs">
              <caption className="text-left p-3 font-semibold text-neutral-900">Các bậc giá trị đơn hiện tại</caption>
              <thead className="bg-neutral-50"><tr><th className="p-3">Giá trị sau giảm giá</th><th className="p-3">Hoa hồng</th></tr></thead>
              <tbody>{tiers.map((tier, index) => <tr key={index} className="border-t border-neutral-100"><td className="p-3">Từ {money(tier.minAmount)}{tier.maxAmount ? ` đến dưới ${money(tier.maxAmount)}` : ' trở lên'}</td><td className="p-3 font-semibold">{tier.rate}%</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {((model === 'by_product' && productRates.length === 0) || (model === 'tiered' && tiers.length === 0)) && <p>Chưa có bảng tỷ lệ riêng; hiện sử dụng tỷ lệ cơ bản {rate}%.</p>}
      </section>

      <section className={card}>
        <h3 className="text-base font-bold text-neutral-900">4. Theo dõi đơn và đối soát</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Tổng quan / Thống kê:</strong> theo dõi lượt nhấp, số đơn, giá trị sản phẩm và hoa hồng theo khoảng thời gian đã chọn.</li>
          <li><strong>Đơn hàng:</strong> tra mã đơn, xem trạng thái, giá trị ghi nhận và hoa hồng. Thông tin cá nhân khách hàng được ẩn.</li>
          <li>Đơn bị hủy hoặc xóa bị loại khỏi tổng hoa hồng. Hoa hồng đang hiển thị không đồng nghĩa với tiền đã được chuyển cho bạn.</li>
          <li><strong>Sổ hoa hồng</strong> hiển thị tổng ghi nhận, số admin đã đánh dấu trả và số còn có thể nhận. Chọn <strong>Xem đơn đã trả hoa hồng</strong> để xem mã đơn, số tiền và ngày trả. Admin chỉ đánh dấu sau khi chuyển khoản; nếu đánh dấu nhầm có thể bỏ tích.</li>
          <li>Trong <strong>Cài đặt → Thông tin thanh toán</strong>, chọn số tiền không vượt quá hoa hồng đang có hoặc chọn <strong>Tất cả</strong> rồi tạo QR gửi admin. Tạo QR không tự chuyển tiền, không đánh dấu đơn đã trả và không tự trừ số dư.</li>
        </ul>
        <button type="button" onClick={onOpenOrders} className="inline-flex items-center gap-1 font-semibold text-rose-700 text-xs">Xem đơn hàng của bạn <ChevronRight className="h-4 w-4" /></button>
      </section>

      <section className={card}>
        <h3 className="text-base font-bold text-neutral-900">5. Chưa thấy đơn hoặc số tiền chưa như dự kiến?</h3>
        <p>Kiểm tra khoảng ngày đang lọc, mã <strong>ref</strong> trong link, thời hạn cookie và giới hạn số đơn. Khách có thể đã mở link đối tác khác, đổi trình duyệt hoặc đặt đơn sau khi cookie hết hạn. Tỷ lệ riêng của sản phẩm, bậc giá trị đơn và voucher cũng làm hoa hồng thực tế khác số ước tính trên công cụ.</p>
        <p>Nếu vẫn cần kiểm tra, gửi Not A Knot mã đơn và link bạn đã chia sẻ để đối chiếu.</p>
      </section>
    </div>
  );
}
