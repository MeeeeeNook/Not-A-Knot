import React, { useState } from 'react';
import {
  ShieldCheck,
  Award,
  Sparkles,
  ArrowRight,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  MapPin,
  ArrowLeft
} from 'lucide-react';
import { SiteContentConfig } from '../types';

interface AboutPageProps {
  siteContent?: SiteContentConfig;
  onNavigateHome: () => void;
  onOpenCatalog: () => void;
  onOpenContact: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  siteContent,
  onNavigateHome,
  onOpenCatalog,
  onOpenContact
}) => {
  const brandName = siteContent?.brandName || 'NOT A KNOT';
  const facebookUrl = siteContent?.socialLinks?.facebook || 'https://www.facebook.com/profile.php?id=61593591390851';

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const defaultFaqs = [
    {
      id: 'faq-1',
      q: 'Dây Paracord 550 có bị phai màu hay ẩm mốc khi dính nước không?',
      a: 'Dây Paracord 550 Type III được dệt từ sợi tổng hợp cao cấp kèm 7 lõi dù xoắn kép, có đặc tính kháng nước, nhanh khô và bền màu. Bạn có thể sử dụng thoải mái trong các hoạt động hằng ngày, đi mưa hay chơi thể thao.'
    },
    {
      id: 'faq-2',
      q: 'Làm thế nào để chọn đúng kích cỡ vòng tay vừa vặn?',
      a: 'Bạn có thể dùng thước dây hoặc một sợi chỉ quấn quanh cổ tay rồi đo chiều dài trên thước kẻ (đo sát cổ tay không cần trừ hao). Khi đặt hàng, hãy gửi số đo đó để xưởng đan theo đúng chu vi tay của bạn.'
    },
    {
      id: 'faq-3',
      q: 'Thời gian hoàn thiện và nhận hàng mất bao lâu?',
      a: 'Vì sản phẩm được đan thủ công, thời gian hoàn thiện thường từ 1 - 2 ngày làm việc. Thời gian giao hàng toàn quốc từ 2 - 4 ngày. Khách hàng được kiểm tra hàng trước khi thanh toán.'
    },
    {
      id: 'faq-4',
      q: 'Xưởng có hỗ trợ đan theo màu sắc và yêu cầu riêng không?',
      a: 'Có. Chúng tớ nhận phối màu theo sở thích và tùy biến kiểu nút thắt. Bạn có thể nhắn tin trực tiếp qua Facebook, Instagram hoặc Threads của xưởng để trao đổi chi tiết.'
    }
  ];

  const faqs = siteContent?.faqs && siteContent.faqs.length > 0 ? siteContent.faqs : defaultFaqs;
  const faqTitle = siteContent?.faqTitle || 'Câu Hỏi Thường Gặp';
  const faqSubtitle = siteContent?.faqSubtitle || 'Giải đáp các thắc mắc phổ biến của khách hàng';

  const coreCommitments = [
    {
      icon: <Sparkles className="w-5 h-5 text-slate-900" />,
      title: 'Đan Tay Tỉ Mỉ',
      desc: 'Từng nút thắt được nghệ nhân siết lực đều đặn, đảm bảo form dáng chắc chắn, đầm tay và tinh xảo.'
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-slate-900" />,
      title: 'Paracord 550 Type III',
      desc: 'Cấu trúc 7 lõi dù bền bỉ, không co rút, chịu lực tốt và thích ứng với mọi điều kiện thời tiết.'
    },
    {
      icon: <Award className="w-5 h-5 text-slate-900" />,
      title: 'Phụ Kiện Chống Gỉ',
      desc: 'Khóa Shackle, Inox và hợp kim đúc nguyên khối chống oxy hóa, giữ độ thẩm mỹ bền lâu.'
    },
    {
      icon: <MapPin className="w-5 h-5 text-slate-900" />,
      title: 'Chế Tác Tại Hà Nội',
      desc: 'Xưởng thủ công đặt tại khu vực NEU - Đại học Kinh tế Quốc dân, hỗ trợ giao hàng toàn quốc.'
    }
  ];

  return (
    <div id="about-page-container" className="w-full bg-slate-50 text-slate-900 min-h-screen font-sans pb-24 selection:bg-slate-900 selection:text-white">
      
      {/* 1. Header Navigation Bar (Clean Light Mode, No Dark Breadcrumbs) */}
      <header className="bg-white border-b border-slate-200/80 sticky top-14 z-30 py-3.5 px-4 sm:px-8 shadow-2xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Trang Chủ</span>
          </button>

          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Về {brandName}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 space-y-12 sm:space-y-16">

        {/* 1. Brand Introduction */}
        <section className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Nghệ Thuật Nút Thắt & Tinh Thần Bền Bỉ
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl">
            <strong className="text-slate-900">{brandName}</strong> là xưởng thủ công chuyên chế tác vòng tay và phụ kiện từ dây dù Paracord 550 quân sự tại Hà Nội. Chúng tớ trân trọng sự tỉ mỉ của đôi bàn tay và cá tính riêng trong từng sản phẩm.
          </p>
        </section>

        {/* 2. Story Card & Workshop Image */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Text Box */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Ý nghĩa tên gọi &quot;NOT A KNOT&quot;</span>
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">
                Tên gọi <strong>NOT A KNOT</strong> thể hiện góc nhìn của chúng tớ: một chiếc vòng tay không chỉ là những nút thắt dây đơn thuần, mà là sự gắn kết của phong cách cá nhân, sự chỉn chu và độ bền đồng hành cùng bạn mỗi ngày.
              </p>
              <p className="text-slate-600 text-sm leading-relaxed">
                Thay vì sản xuất công nghiệp đại trà, từng mẫu vòng đều được đan thủ công theo số đo cổ tay và phối màu bạn mong muốn.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={onOpenCatalog}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs sm:text-sm hover:bg-slate-800 transition-all flex items-center gap-2 shadow-2xs"
              >
                <span>Xem bộ sưu tập</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenContact}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition-all flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-slate-600" />
                <span>Liên hệ tư vấn</span>
              </button>
            </div>
          </div>

          {/* Right Visual Box */}
          <div className="lg:col-span-5 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-2xs relative group min-h-[260px] flex flex-col">
            <img
              src="/assets/bracelet.jpg"
              alt="Chế tác NOT A KNOT"
              className="w-full h-full object-cover object-center flex-1"
            />
            <div className="p-4 bg-white border-t border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <MapPin className="w-3.5 h-3.5 text-slate-700" />
                <span>Khuôn viên NEU (Đại học Kinh tế Quốc dân), Hà Nội</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Chế tác và kiểm tra thủ công từng sản phẩm trước khi giao.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Core Values Grid */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Đặc Điểm Sản Phẩm
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Những tiêu chí quan trọng trong từng sản phẩm xuất xưởng
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {coreCommitments.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    {item.title}
                  </h3>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Material Focus */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-2xs space-y-6">
          <div className="max-w-2xl space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
              Chất liệu cốt lõi
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Dây Dù Paracord 550 Type III
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Dây Paracord 550 là chuẩn dây dù quân đội nổi tiếng trong giới EDC và sinh tồn nhờ sự dẻo dai, không mục nát và độ thẩm mỹ cao.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-xs sm:text-sm text-slate-900">7 Lõi Dù Xoắn Kép</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bên trong mỗi sợi là 7 lõi sợi nhỏ bện đôi, mang lại độ bền cơ học cao và form vòng đầm chắc.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-xs sm:text-sm text-slate-900">Kháng Nước & Mau Khô</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Không giữ ẩm mốc, dễ dàng rửa sạch với nước và xà phòng sau thời gian dài sử dụng.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-xs sm:text-sm text-slate-900">Khóa Kim Loại Chống Gỉ</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sử dụng các loại khóa Titan, Inox và hợp kim chịu lực có độ bền màu và chống oxy hóa.
              </p>
            </div>
          </div>
        </section>

        {/* 5. FAQ (Câu hỏi thường gặp) Section */}
        <section id="faq-section" className="space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {faqTitle}
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              {faqSubtitle}
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-slate-900"
                  >
                    <span>{faq.q}</span>
                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-600">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 6. Simple Bottom Connect Section */}
        <section className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-base sm:text-lg font-black text-white">
              Cần trao đổi thêm về mẫu vòng?
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              Bạn có thể nhắn tin trực tiếp qua fanpage hoặc để lại lời nhắn tại trang liên hệ.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-[#1877F2] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Facebook</span>
            </a>

            <button
              onClick={onOpenContact}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors border border-white/20"
            >
              <span>Trang liên hệ</span>
            </button>
          </div>
        </section>

      </main>
    </div>
  );
};
