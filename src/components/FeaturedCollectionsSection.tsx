import React from 'react';
import { ArrowRight, Sparkles, Heart, Compass, ShieldCheck } from 'lucide-react';
import { Product } from '../types';
import { LoadingImage } from './LoadingImage';

interface FeaturedCollectionsSectionProps {
  products: Product[];
  onNavigateToCatalog: (category?: string) => void;
  onOpenProductDetail: (product: Product) => void;
}

export const FeaturedCollectionsSection: React.FC<FeaturedCollectionsSectionProps> = ({
  products,
  onNavigateToCatalog,
  onOpenProductDetail
}) => {
  // Get sample items for quick previews
  const event2010Item = products.find((p) => p.category === 'event_2010') || products[0];
  const charmItem = products.find((p) => p.category === 'charm_bracelet') || products[1];
  const everydayItem = products.find((p) => p.category === 'everyday') || products[2];

  return (
    <section className="py-20 bg-white text-neutral-900 border-t border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-neutral-950">
            Nghệ Thuật Nút Thắt & Phong Cách
          </h2>
          <p className="text-neutral-500 text-xs sm:text-base mt-3 leading-relaxed">
            Mỗi thiết kế tại NOT A KNOT được sinh ra từ niềm đam mê chất liệu Paracord 550 siêu bền và tư duy thẩm mỹ tối giản, tinh tế.
          </p>
        </div>

        {/* Featured 3-Column Bento Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          
          {/* Card 1: BST 20/10 */}
          <div className="bg-gradient-to-b from-rose-50 to-white rounded-3xl p-6 sm:p-8 border border-rose-200/80 flex flex-col justify-between group hover:shadow-lg transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center mb-4 shadow-sm">
                <Heart className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block mb-1">
                Phiên Bản Quà Tặng Nàng
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-950 mb-2">
                20/10 Yêu Thương
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-6">
                Những nút thắt Paracord kết hợp charm bạc và ngọc nữ tính, đi kèm hộp quà nắp nam châm và thiệp viết tay trang trọng.
              </p>
            </div>

            <div className="space-y-4">
              {event2010Item && (
                <div
                  onClick={() => onOpenProductDetail(event2010Item)}
                  className="bg-white/90 p-3 rounded-2xl border border-rose-100 flex items-center gap-3 cursor-pointer hover:border-rose-300 transition-colors"
                >
                  <LoadingImage
                    src={event2010Item.image || '/assets/bracelet.jpg'}
                    alt={event2010Item.name}
                    containerClassName="w-14 h-14 rounded-xl flex-shrink-0"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    spinnerSize="xs"
                    spinnerColor="rose"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-xs font-bold text-neutral-900 truncate">{event2010Item.name}</p>
                    <p className="text-xs font-semibold text-rose-600 font-mono">{event2010Item.price.toLocaleString('vi-VN')}đ</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => onNavigateToCatalog('event_2010')}
                className="w-full py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>Khám phá 20/10</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: Charm Bracelet Collection */}
          <div className="bg-gradient-to-b from-purple-50 to-white rounded-3xl p-6 sm:p-8 border border-purple-200/80 flex flex-col justify-between group hover:shadow-lg transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-purple-900 text-white flex items-center justify-center mb-4 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block mb-1">
                Biểu Tượng & Ý Nghĩa
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-950 mb-2">
                Charm Bracelet Collection
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-6">
                Các mẫu vòng phối hạt charm 12 Cung Hoàng Đạo và charm ký tự đúc sắc nét trên nền Paracord bện kép bền bỉ.
              </p>
            </div>

            <div className="space-y-4">
              {charmItem && (
                <div
                  onClick={() => onOpenProductDetail(charmItem)}
                  className="bg-white/90 p-3 rounded-2xl border border-purple-100 flex items-center gap-3 cursor-pointer hover:border-purple-300 transition-colors"
                >
                  <LoadingImage
                    src={charmItem.image || '/assets/bracelet.jpg'}
                    alt={charmItem.name}
                    containerClassName="w-14 h-14 rounded-xl flex-shrink-0"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    spinnerSize="xs"
                    spinnerColor="amber"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-xs font-bold text-neutral-900 truncate">{charmItem.name}</p>
                    <p className="text-xs font-semibold text-purple-800 font-mono">{charmItem.price.toLocaleString('vi-VN')}đ</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => onNavigateToCatalog('charm_bracelet')}
                className="w-full py-3 rounded-full bg-purple-900 hover:bg-purple-950 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
              >
                <span>Khám phá Vòng Charm</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: Everyday Wear & Paracord 550 */}
          <div className="bg-gradient-to-b from-stone-100 to-white rounded-3xl p-6 sm:p-8 border border-neutral-200 flex flex-col justify-between group hover:shadow-lg transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-4 shadow-sm">
                <Compass className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Tối Giản & Bền Bỉ
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-950 mb-2">
                Everyday Wear & Paracord 550
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-6">
                Những mẫu vòng tay, móc khóa EDC chịu lực 250kg, chống nước tuyệt đối, phù hợp đi làm, đi chơi hay hoạt động dã ngoại.
              </p>
            </div>

            <div className="space-y-4">
              {everydayItem && (
                <div
                  onClick={() => onOpenProductDetail(everydayItem)}
                  className="bg-white/90 p-3 rounded-2xl border border-neutral-200 flex items-center gap-3 cursor-pointer hover:border-neutral-400 transition-colors"
                >
                  <LoadingImage
                    src={everydayItem.image || '/assets/bracelet.jpg'}
                    alt={everydayItem.name}
                    containerClassName="w-14 h-14 rounded-xl flex-shrink-0"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    spinnerSize="xs"
                    spinnerColor="neutral"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-xs font-bold text-neutral-900 truncate">{everydayItem.name}</p>
                    <p className="text-xs font-semibold text-neutral-900 font-mono">{everydayItem.price.toLocaleString('vi-VN')}đ</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => onNavigateToCatalog('everyday')}
                className="w-full py-3 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-neutral-300"
              >
                <span>Xem Dòng Everyday</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {/* Big Central Gateway CTA to Dedicated Catalog Page */}
        <div className="bg-neutral-950 text-white rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl border border-neutral-800">
          <div className="max-w-2xl mx-auto relative z-10">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-gold block mb-2">
              NOT A KNOT Catalog
            </span>
            <h3 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              Khám Phá Toàn Bộ Cửa Hàng
            </h3>
            <p className="text-neutral-400 text-xs sm:text-sm mb-8 leading-relaxed">
              Truy cập trang danh mục riêng biệt với đầy đủ bộ lọc phân loại, công cụ tìm kiếm, size chart và tính năng đặt hàng trực tuyến nhanh chóng.
            </p>
            <button
              id="landing-goto-catalog-btn"
              onClick={() => onNavigateToCatalog('all')}
              className="inline-flex items-center gap-2.5 px-8 py-4 bg-white hover:bg-neutral-100 text-neutral-950 rounded-full font-bold text-sm transition-all duration-200 hover:scale-105 shadow-lg"
            >
              <span>Vào Cửa Hàng (Xem Tất Cả Sản Phẩm)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-8 pt-8 border-t border-neutral-800 flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Chính Hãng Paracord 550 7 Lõi</span>
            </span>
            <span>•</span>
            <span>Đan Thủ Công Theo Số Đo</span>
            <span>•</span>
            <span>Giao Hàng Toàn Quốc (Kiểm Tra Hàng)</span>
          </div>
        </div>

      </div>
    </section>
  );
};
