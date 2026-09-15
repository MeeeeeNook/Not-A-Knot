import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { SiteContentConfig } from '../types';

interface AboutPageProps {
  siteContent?: SiteContentConfig;
  onNavigateHome: () => void;
  onOpenCatalog: () => void;
  onOpenContact: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  onNavigateHome,
  onOpenCatalog,
  onOpenContact
}) => {
  // Cinematic yet responsive scroll reveal animation (~1.25s duration)
  const scrollAnim = {
    initial: { opacity: 0, y: 26 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 1.25, ease: [0.16, 1, 0.3, 1] }
  };

  return (
    <div id="about-page-container" className="w-full bg-[#FAF9F6] text-stone-900 min-h-screen selection:bg-stone-900 selection:text-white">
      
      {/* Navigation Header Bar - Aligned to wider container */}
      <header className="bg-[#FAF9F6]/80 backdrop-blur-md border-b border-stone-200/70 sticky top-14 z-30 py-3.5 px-6 sm:px-12 lg:px-16">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-950 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Quay lại Trang Chủ</span>
          </button>
        </div>
      </header>

      {/* Main Narrative Container - Generously widened text area */}
      <main className="max-w-6xl mx-auto px-6 sm:px-12 lg:px-16 py-12 sm:py-20 space-y-14 sm:space-y-18">

        {/* ------------------------------------------------------------------ */}
        {/* PARAGRAPH 1: Ý tưởng đơn giản (Sans-serif) + Biến sợi dây (Serif to hơn) */}
        {/* ------------------------------------------------------------------ */}
        <motion.div {...scrollAnim} className="space-y-3">
          <p className="font-sans text-sm sm:text-base md:text-lg font-medium text-stone-500 tracking-wide">
            Not A Knot bắt đầu từ một ý tưởng đơn giản:
          </p>
          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-normal text-stone-950 leading-[1.2] tracking-tight">
            Biến những sợi dây thành những điều có ý nghĩa.
          </h1>
        </motion.div>

        {/* ------------------------------------------------------------------ */}
        {/* PARAGRAPH 2: Chiếm ~2/3 bề ngang, text-justify, đè lên ảnh có fade */}
        {/* ------------------------------------------------------------------ */}
        <motion.div
          {...scrollAnim}
          className="relative rounded-3xl overflow-hidden bg-stone-100/85 border border-stone-200/80 shadow-2xs min-h-[300px] sm:min-h-[360px] flex items-center p-6 sm:p-10 lg:p-14"
        >
          {/* Khung ảnh nền với gradient fade bên phải và bên trái */}
          <div className="absolute inset-y-0 right-0 w-full sm:w-3/5 lg:w-1/2 overflow-hidden pointer-events-none">
            <img
              src="/assets/about-story.jpg"
              alt="Hình ảnh câu chuyện Not A Knot"
              className="w-full h-full object-cover object-center opacity-85"
            />
            {/* Gradient hòa vào nền bên trái để text luôn sắc nét */}
            <div className="absolute inset-0 bg-gradient-to-r from-stone-100 via-stone-100/85 to-transparent" />
            {/* Gradient fade bên phải theo yêu cầu */}
            <div className="absolute inset-0 bg-gradient-to-l from-stone-100 via-transparent to-transparent" />
            {/* Subtle edge blend */}
            <div className="absolute inset-0 bg-gradient-to-b from-stone-100/40 via-transparent to-stone-100/40" />
          </div>

          {/* Text chiếm khoảng 2/3 bề ngang, căn đều (justify) */}
          <div className="relative z-10 w-full md:w-3/4 lg:w-7/12">
            <p className="font-sans text-base sm:text-lg md:text-xl text-stone-800 leading-relaxed sm:leading-loose text-justify">
              Xuất phát điểm là một nhóm 9 sinh viên cùng chung niềm yêu thích với các sản phẩm thủ công, chúng tôi nhận ra rằng những món phụ kiện nhỏ bé như vòng tay, hay móc khóa hoàn toàn có thể trở thành cách để mỗi người thể hiện cá tính và mang theo một phần câu chuyện của riêng mình, đồng hành cùng ta trong cuộc sống hàng ngày.
            </p>
          </div>
        </motion.div>

        {/* ------------------------------------------------------------------ */}
        {/* PARAGRAPH 3: Tên gọi "Not A Knot" + (xuống dòng) Knot là một nút thắt... */}
        {/* ------------------------------------------------------------------ */}
        <motion.div {...scrollAnim} className="space-y-4">
          <p className="font-serif text-2xl sm:text-3xl md:text-4xl text-stone-950 font-normal leading-snug">
            Tên gọi “Not A Knot” cũng bắt nguồn từ chính tinh thần ấy.
          </p>

          <p className="font-sans text-base sm:text-lg md:text-xl text-stone-700 leading-relaxed sm:leading-loose text-justify pt-1">
            Knot là một nút thắt, nhưng với chúng tôi, nó không đơn thuần chỉ là cách những sợi dây kết nối với nhau. Một nút thắt là sự kết nối giữa con người, giữa những giá trị thủ công và hơi thở hiện đại, giữa người tạo ra sản phẩm và người lựa chọn mang nó bên mình. Vì vậy, Not A Knot không chỉ là “một nút thắt”, mà là một câu chuyện được kết nối.
          </p>
        </motion.div>

        {/* ------------------------------------------------------------------ */}
        {/* PARAGRAPH 4: Chúng tôi tin rằng một sản phẩm handmade... */}
        {/* ------------------------------------------------------------------ */}
        <motion.div {...scrollAnim} className="pt-2">
          <blockquote className="font-serif text-2xl sm:text-3xl md:text-4xl font-normal text-stone-950 leading-relaxed sm:leading-snug italic text-justify sm:text-left">
            “Chúng tôi tin rằng một sản phẩm handmade không chỉ được tạo nên bởi nguyên liệu hay kỹ thuật. Nó được tạo nên bởi thời gian, sự tỉ mỉ và câu chuyện mà người làm gửi gắm vào từng nút thắt.”
          </blockquote>
        </motion.div>

        {/* Bottom Actions */}
        <motion.div
          {...scrollAnim}
          className="pt-8 border-t border-stone-200/80 flex flex-wrap items-center gap-4"
        >
          <button
            onClick={onOpenCatalog}
            className="px-6 py-3 rounded-xl bg-stone-900 text-white font-sans font-bold text-xs sm:text-sm hover:bg-stone-800 transition-colors cursor-pointer shadow-2xs"
          >
            Xem bộ sưu tập
          </button>
          <button
            onClick={onOpenContact}
            className="px-6 py-3 rounded-xl bg-stone-200/80 text-stone-800 font-sans font-bold text-xs sm:text-sm hover:bg-stone-300 transition-colors cursor-pointer"
          >
            Liên hệ tư vấn
          </button>
        </motion.div>

      </main>
    </div>
  );
};
