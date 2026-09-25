import React from 'react';

interface LandingBrandStoryBannerProps {
  onOpenAboutPage: () => void;
  brandName?: string;
}

export const LandingBrandStoryBanner: React.FC<LandingBrandStoryBannerProps> = ({
  onOpenAboutPage,
  brandName = 'NOT A KNOT'
}) => {
  return (
    <section 
      id="landing-brand-story" 
      aria-label="Câu chuyện thương hiệu Not A Knot" 
      className="w-full bg-[#F6F3ED] py-14 sm:py-16 md:py-20 text-stone-900 font-sans"
    >
      <div className="max-w-4xl mx-auto px-7 sm:px-12 md:px-16">
        
        {/* Centered Section Header - Exactly identical typography & uppercase tracking to collection headers */}
        <div className="flex flex-col items-center justify-center text-center mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-sm sm:text-base md:text-lg font-semibold tracking-[0.22em] uppercase text-stone-900">
            CÂU CHUYỆN THƯƠNG HIỆU
          </h2>
        </div>

        {/* Story Content: Beautifully centered, generous padding away from phone borders, no image */}
        <div className="max-w-2xl mx-auto text-center space-y-6 sm:space-y-7">
          
          {/* Main Headline with Stylized & Bold Emphasis on "những điều có ý nghĩa" */}
          <h3 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-[40px] text-stone-950 font-normal leading-[1.35] tracking-tight">
            Biến những sợi dây thành{' '}
            <span className="font-bold italic text-amber-900/90 relative inline-block">
              những điều có ý nghĩa.
            </span>
          </h3>

          {/* Story Paragraph - Justified text as requested, with comfortable line height */}
          <p className="font-sans text-sm sm:text-base md:text-lg text-stone-700 leading-relaxed sm:leading-loose font-normal text-justify">
            Knot là một nút thắt, nhưng với chúng tôi, nó không đơn thuần chỉ là cách những sợi dây kết nối với nhau. Một nút thắt là sự kết nối giữa con người, giữa những giá trị thủ công và hơi thở hiện đại, giữa người tạo ra sản phẩm và người lựa chọn mang nó bên mình. Vì vậy, Not A Knot không chỉ là “một nút thắt”, mà là một câu chuyện được kết nối.
          </p>

          {/* CTA Button: Identical outlined style to "XEM TẤT CẢ" without arrow */}
          <div className="pt-2 sm:pt-4 flex justify-center items-center">
            <button
              type="button"
              onClick={onOpenAboutPage}
              className="inline-flex items-center justify-center px-8 sm:px-12 py-3 border text-xs sm:text-sm font-semibold tracking-widest uppercase transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md bg-white hover:bg-stone-950 text-stone-900 hover:text-white border-stone-300 hover:border-stone-950"
            >
              <span>Tìm hiểu thêm</span>
            </button>
          </div>

        </div>

      </div>
    </section>
  );
};

