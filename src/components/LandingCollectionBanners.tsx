import React from 'react';
import { CollectionInfo } from '../types';
import { COLLECTIONS_DATA } from '../data/collections';
import { ArrowRight } from 'lucide-react';

interface LandingCollectionBannersProps {
  collections?: CollectionInfo[];
  onSelectCollection: (collectionId: string) => void;
  onOpenAllCatalog?: () => void;
}

export const LandingCollectionBanners: React.FC<LandingCollectionBannersProps> = ({
  collections = COLLECTIONS_DATA,
  onSelectCollection,
  onOpenAllCatalog
}) => {
  // Sort collections by order and filter out hidden collections
  const activeBanners = [...collections]
    .filter((c) => !c.isHidden)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (!activeBanners || activeBanners.length === 0) return null;

  return (
    <section id="landing-collections-showcase" className="w-full bg-[#FAF8F5] text-slate-900 py-8 sm:py-12 font-sans border-t border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 tracking-tight">
            Bộ Sưu Tập NOT A KNOT
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Mỗi bộ sưu tập là một câu chuyện riêng biệt, kết tinh từ niềm đam mê dây dù Paracord 550 chuẩn quân đội và nghệ thuật đan tay thủ công tỉ mỉ.
          </p>
        </div>

        {/* Stacked Collection Banners */}
        <div className="space-y-4 sm:space-y-6">
          {activeBanners.map((banner, index) => {
            const isEven = index % 2 === 1;
            const bannerImg = banner.bannerImage || banner.bgImage || '/assets/hero-bg.png';

            return (
              <div
                key={banner.id}
                id={`landing-collection-banner-${banner.id}`}
                onClick={() => onSelectCollection(banner.id)}
                className="relative rounded-3xl overflow-hidden shadow-md border border-slate-200 bg-slate-950 text-white min-h-[240px] sm:min-h-[300px] md:min-h-[340px] flex flex-col justify-end p-5 sm:p-10 cursor-pointer group transition-all duration-300 hover:shadow-xl hover:border-amber-400/50"
              >
                {/* Background Image */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                  <img
                    src={bannerImg}
                    alt={banner.title}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out brightness-95"
                    loading="lazy"
                    decoding="async"
                  />
                  {/* Gradient Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                  <div className={`absolute inset-0 ${isEven ? 'bg-gradient-to-l' : 'bg-gradient-to-r'} from-slate-950/80 via-slate-950/20 to-transparent hidden md:block`} />
                </div>

                {/* Banner Content */}
                <div className={`relative z-10 max-w-2xl space-y-2 ${isEven ? 'md:ml-auto md:text-right' : ''}`}>
                  {/* Tags */}
                  <div className={`flex flex-wrap items-center gap-2 ${isEven ? 'md:justify-end' : ''}`}>
                    {banner.tag && (
                      <span className="text-amber-400 font-bold text-xs tracking-wider uppercase drop-shadow">
                        {banner.tag}
                      </span>
                    )}
                    {banner.isPreorder && (
                      <span className="text-rose-400 font-bold text-xs tracking-wider uppercase drop-shadow">
                        • Pre-order
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md">
                    {banner.title}
                  </h3>

                  {/* Subtitle */}
                  {banner.subtitle && (
                    <p className="text-xs sm:text-sm text-slate-200 font-normal leading-relaxed line-clamp-2 drop-shadow max-w-xl">
                      {banner.subtitle}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Catalog Action */}
        {onOpenAllCatalog && (
          <div className="text-center pt-2">
            <button
              onClick={onOpenAllCatalog}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all duration-200 shadow-md cursor-pointer"
            >
              <span>Xem Toàn Bộ Danh Mục Sản Phẩm</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </section>
  );
};
