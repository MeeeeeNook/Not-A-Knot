import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MessageCircle
} from 'lucide-react';
import { SiteContentConfig } from '../types';

interface LandingFaqCommitmentsProps {
  siteContent?: SiteContentConfig;
  onOpenAboutPage?: () => void;
  onOpenContact: () => void;
}

export const LandingFaqCommitments: React.FC<LandingFaqCommitmentsProps> = ({
  siteContent,
  onOpenContact
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const defaultFaqs = [
    {
      id: 'faq-1',
      q: 'Dây đan thủ công có bị xù lông, phai màu hay ẩm mốc khi đi mưa hoặc tắm không?',
      a: 'Hoàn toàn không. 100% sản phẩm tại NOT A KNOT sử dụng chất liệu dây đan cao cấp chịu lực, bền bỉ. Lớp vỏ bện ngoài kháng nước, nhanh ráo nước, không xù lông và giữ màu sắc nguyên bản theo thời gian.'
    },
    {
      id: 'faq-2',
      q: 'Kích cỡ và kiểu dáng sản phẩm như thế nào?',
      a: 'Tất cả sản phẩm đều được thiết kế và chế tác hoàn chỉnh theo chuẩn form dáng cố định tối ưu nhất, ôm tay thoải mái và dễ đeo cho hầu hết người dùng. Bạn chỉ cần chọn mẫu ưng ý và đặt hàng trực tiếp.'
    },
    {
      id: 'faq-3',
      q: 'Thời gian hoàn thiện và giao hàng là bao lâu?',
      a: 'Mỗi sản phẩm đều sẵn sàng xuất xưởng nhanh chóng từ 1 - 2 ngày làm việc. Thời gian giao hàng toàn quốc từ 2 - 4 ngày. Bạn được quyền kiểm tra hàng trước khi thanh toán.'
    },
    {
      id: 'faq-4',
      q: 'Chính sách bảo hành nút đan và đổi trả sản phẩm như thế nào?',
      a: 'NOT A KNOT áp dụng chính sách Bảo hành nút thắt trọn đời: hỗ trợ vệ sinh và làm mới miễn phí. Nếu nhận hàng có lỗi kỹ thuật từ nhà sản xuất, bạn được hỗ trợ đổi mới miễn phí trong 7 ngày đầu tiên.'
    }
  ];

  const faqs = siteContent?.faqs && siteContent.faqs.length > 0 ? siteContent.faqs : defaultFaqs;
  const title = siteContent?.faqTitle || 'Câu Hỏi Thường Gặp';

  return (
    <section id="landing-faq-section" className="py-10 sm:py-14 bg-slate-50 text-slate-900 border-t border-slate-200/80 font-sans">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            {title}
          </h2>
          {siteContent?.faqSubtitle && siteContent.faqSubtitle.trim().length > 0 && (
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              {siteContent.faqSubtitle}
            </p>
          )}
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-2.5">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isOpen
                    ? 'bg-white border-amber-400 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-4 sm:p-4.5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-slate-900 cursor-pointer"
                >
                  <span className="leading-snug">{faq.q}</span>
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-600">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-amber-700" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 sm:px-4.5 pb-4 pt-0 text-xs sm:text-sm text-slate-700 leading-relaxed border-t border-slate-100">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Help Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-xs font-bold">
          <button
            onClick={onOpenContact}
            className="px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-amber-400" />
            <span>Liên hệ tư vấn & đặt hàng</span>
          </button>
        </div>

      </div>
    </section>
  );
};
