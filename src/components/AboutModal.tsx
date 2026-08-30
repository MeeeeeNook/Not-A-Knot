import React from 'react';
import { X, ShieldCheck, Award, HeartHandshake, Sparkles, Check, PhoneCall, MessageCircle, MapPin, Clock, Mail } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenContact: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  onOpenContact
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        id="about-us-modal"
        className="bg-[#12141C] text-neutral-100 border border-white/15 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#12141C]/95 backdrop-blur-md border-b border-white/10 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">Về Chúng Tôi · NOT A KNOT</h2>
              <p className="text-[11px] text-neutral-400">Xưởng Chế Tác Phụ Kiện Paracord & EDC Thủ Công</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-xs text-neutral-300 leading-relaxed font-normal">
          {/* Story intro */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Câu Chuyện & Tinh Thần Thương Hiệu
            </h3>
            <p>
              NOT A KNOT là xưởng chế tác thủ công chuyên sâu về các dòng phụ kiện dây dù Paracord 550 và phụ kiện EDC (Everyday Carry) tại Việt Nam.
            </p>
            <p>
              Tên gọi <strong className="text-amber-300 font-semibold">NOT A KNOT</strong> mang ý nghĩa: một chiếc vòng tay không đơn thuần chỉ là những nút thắt vô tri, mà là sự gắn kết của tinh thần bền bỉ và bản lĩnh của người mang nó.
            </p>
          </div>

          {/* Core Values */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>100% Đan Thủ Công Tỉ Mỉ</span>
              </div>
              <p className="text-neutral-400 text-[11px]">
                Từng sản phẩm được nghệ nhân đan thủ công theo chuẩn mực hoàn thiện cao nhất của từng mẫu thiết kế, đảm bảo form dáng đan chắc chắn và bền đẹp.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>Dây Paracord 550 Chuẩn</span>
              </div>
              <p className="text-neutral-400 text-[11px]">
                Dây dù Type III lõi 7 sợi tiêu chuẩn chịu tải 250kg, chống mài mòn, không xơ xước, không phai màu khi tiếp xúc với nước.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Award className="w-4 h-4 flex-shrink-0" />
                <span>Phụ Kiện Kim Loại Cao Cấp</span>
              </div>
              <p className="text-neutral-400 text-[11px]">
                Khóa titan, inox 316L và hợp kim đúc nguyên khối chống gỉ sét, mạ điện phân bền bỉ với thời gian.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <HeartHandshake className="w-4 h-4 flex-shrink-0" />
                <span>Bảo Hành Nút Thắt Trọn Đời</span>
              </div>
              <p className="text-neutral-400 text-[11px]">
                Hỗ trợ vệ sinh, làm mới và thắt lại nút dây miễn phí trọn đời cho toàn bộ sản phẩm xuất xưởng từ NOT A KNOT.
              </p>
            </div>
          </div>

          {/* Quality commitment */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-neutral-300 space-y-2">
            <div className="text-amber-300 font-bold text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tiêu Chuẩn Sản Phẩm Hoàn Thiện</span>
            </div>
            <p className="text-[11px] text-neutral-300">
              Mỗi sản phẩm đều được kiểm định kỹ lưỡng về độ bền kéo, màu sắc và khóa chốt trước khi đóng gói gửi tới khách hàng.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0E1017] rounded-b-3xl">
          <div className="text-[11px] text-neutral-400">
            Cần hỗ trợ thông tin sản phẩm?
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => {
                onClose();
                onOpenContact();
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Liên Hệ Chúng Tôi</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
