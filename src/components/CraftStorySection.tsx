import React from 'react';
import { BRAND_VALUES, KNOT_TYPES } from '../data/products';
import { ShieldCheck, Hammer, Sparkles, RefreshCw, Scissors } from 'lucide-react';

interface CraftStorySectionProps {
  onOpenContact?: () => void;
}

export const CraftStorySection: React.FC<CraftStorySectionProps> = ({ onOpenContact }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldCheck':
        return <ShieldCheck className="w-5 h-5 text-white" />;
      case 'Hammer':
        return <Hammer className="w-5 h-5 text-white" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 text-white" />;
      case 'RefreshCw':
        return <RefreshCw className="w-5 h-5 text-white" />;
      default:
        return <Scissors className="w-5 h-5 text-white" />;
    }
  };

  return (
    <section id="craft-story" className="py-24 bg-neutral-950 text-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Brand Story Header (Apple Style) */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest block mb-3">
            NOT A KNOT Craftsmanship
          </span>
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-4">
            Nghệ Thuật Nút Thắt.
          </h2>
          <p className="text-neutral-400 text-base sm:text-lg leading-relaxed font-normal">
            Không chỉ đơn thuần là một nút thắt. NOT A KNOT được tạo nên từ niềm đam mê chế tác phụ kiện EDC thủ công bền bỉ, đồng hành cùng bạn trên mọi hành trình.
          </p>
        </div>

        {/* 4 Brand Pillars (Apple Clean Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {BRAND_VALUES.map((val, idx) => (
            <div
              key={idx}
              className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-4">
                  {getIcon(val.icon)}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{val.title}</h3>
                <p className="text-neutral-400 text-xs sm:text-sm font-normal leading-relaxed">
                  {val.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Knot Guide Showcase (Apple Large Feature Banner) */}
        <div className="bg-neutral-900 rounded-3xl p-8 sm:p-12 border border-neutral-800">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="lg:w-1/2 space-y-4">
              <span className="text-xs font-semibold uppercase text-neutral-400 tracking-wider block">
                Kỹ Thuật Đan Dây Thủ Công
              </span>
              <h3 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Từng Mắt Đan Mang Một Bản Lĩnh Riêng.
              </h3>
              <p className="text-neutral-400 text-sm sm:text-base leading-relaxed font-normal">
                Tất cả sản phẩm được dệt từ chất liệu dây đan cao cấp với cấu trúc sợi bền bỉ. Từng nút đan được siết lực chắc chắn, tạo form dáng cứng cáp, êm ái khi đeo.
              </p>
            </div>

            <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {KNOT_TYPES.map((knot, i) => (
                <div
                  key={i}
                  className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800"
                >
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase block mb-1">
                    {knot.badge}
                  </span>
                  <h4 className="font-bold text-sm text-white mb-1">{knot.name}</h4>
                  <p className="text-neutral-400 text-xs leading-relaxed font-normal">{knot.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
