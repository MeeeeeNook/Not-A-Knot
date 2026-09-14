import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SiteContentConfig } from '../types';

interface AboutUsSectionProps {
  content?: SiteContentConfig['aboutSection'];
  onOpenFullAbout?: () => void;
  onOpenAboutPage?: () => void;
  onOpenContact?: () => void;
  onOpenCatalog: () => void;
}

export const AboutUsSection: React.FC<AboutUsSectionProps> = ({
  content,
  onOpenFullAbout,
  onOpenAboutPage
}) => {
  const handleOpenAbout = onOpenFullAbout || onOpenAboutPage || (() => {
    window.location.hash = '#about';
  });
  const title = content?.title || 'Hành Trình Gắn Kết Những Nút Thắt Bản Lĩnh';
  const subtitle = content?.subtitle || 'Xưởng chế tác phụ kiện dây dù Paracord 550 & EDC thủ công hàng đầu tại Việt Nam.';
  const storyP1 = content?.storyParagraph1 || 'NOT A KNOT ra đời từ niềm đam mê chế tác thủ công bền bỉ. Tên gọi NOT A KNOT mang thông điệp: mỗi chiếc vòng tay không đơn thuần chỉ là những nút thắt vô tri, mà là sự gắn kết của tinh thần kiên cường, kỷ luật và phong cách cá nhân.';
  const quote = content?.quote || '“Một chiếc vòng bền bỉ không chỉ là phụ kiện làm đẹp, mà là người bạn đồng hành tin cậy trên mọi cung đường.”';

  const stats = content?.stats || [
    { label: 'Sản Phẩm Xuất Xưởng', value: '10.000+', desc: 'Đan thủ công tỉ mỉ' },
    { label: 'Chuẩn Paracord 550', value: '100%', desc: '7 lõi dù Type III bền bỉ' },
    { label: 'Bảo Hành Nút Thắt', value: 'Trọn Đời', desc: 'Vệ sinh & đan lại miễn phí' },
    { label: 'Đánh Giá Hài Lòng', value: '4.9/5★', desc: 'Khách hàng toàn quốc' }
  ];

  return (
    <section id="about-us-section" className="py-10 sm:py-14 bg-white text-slate-900 relative overflow-hidden border-t border-slate-200/80 font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8 sm:space-y-10">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-950 leading-tight">
            {title}
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-normal">
            {subtitle}
          </p>
        </div>

        {/* 2-Column Editorial Story Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Left Column: Story Highlight */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-50 p-6 sm:p-7 rounded-3xl border border-slate-200 space-y-3.5 shadow-2xs">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Câu Chuyện Thương Hiệu NOT A KNOT
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                {storyP1}
              </p>
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs italic font-medium">
                {quote}
              </div>
            </div>

            {/* Action Button */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                id="about-cta-full-page-btn"
                onClick={handleOpenAbout}
                className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-xs sm:text-sm hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Xem chi tiết về chúng tôi</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Column: Visual Image */}
          <div className="lg:col-span-5 relative">
            <div className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 shadow-lg relative group">
              <img
                src={content?.imageUrl || '/assets/bracelet.jpg'}
                alt="Chế tác NOT A KNOT"
                className="w-full h-64 sm:h-72 object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
              
              <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5">
                <p className="text-amber-300 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Xưởng Chế Tác NEU · Hà Nội</span>
                </p>
                <h4 className="text-sm sm:text-base font-bold text-white mb-0.5">
                  NOT A KNOT Handmade Studio
                </h4>
                <p className="text-slate-200 text-[11px] leading-relaxed">
                  Đại học Kinh tế Quốc dân (NEU), Trần Đại Nghĩa, Hà Nội.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="bg-slate-50 rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            {stats.map((stat, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="text-lg sm:text-2xl font-black text-amber-600 tracking-tight">
                  {stat.value}
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {stat.label}
                </div>
                <div className="text-[11px] text-slate-500">
                  {stat.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
