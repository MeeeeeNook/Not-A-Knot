import React from 'react';
import { Lock } from 'lucide-react';
import { CategoryItem, SiteContentConfig } from '../types';
import { slugify } from '../utils/slugify';

interface FooterProps {
  siteContent?: SiteContentConfig;
  categories?: CategoryItem[];
  onOpenAdmin: () => void;
  onSelectCollection?: (colId: string) => void;
  onSelectCategory?: (categoryId: string) => void;
  onOpenAllCatalog?: () => void;
  onOpenAbout?: () => void;
  onOpenContact?: () => void;
  onOpenOrderTracker?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  siteContent,
  categories = [],
  onOpenAdmin,
  onSelectCollection,
  onSelectCategory,
  onOpenAllCatalog,
  onOpenAbout,
  onOpenContact,
  onOpenOrderTracker
}) => {
  const brandName = siteContent?.brandName || 'NOT A KNOT';
  const tagline = siteContent?.brandTagline || 'Phụ kiện handmade thủ công cao cấp';
  const facebookUrl = siteContent?.socialLinks?.facebook || 'https://www.facebook.com/profile.php?id=61593591390851';
  const instagramUrl = siteContent?.socialLinks?.instagram || 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==';
  const threadsUrl = siteContent?.socialLinks?.threads || 'https://www.threads.com/@notaknot.handmade?igshid=NTc4MTIwNjQ2YQ==';
  const copyrightText = siteContent?.footer?.copyrightText || `© ${new Date().getFullYear()} ${brandName} Handmade Studio. Tự hào chế tác thủ công tại Việt Nam.`;

  // Filter visible categories to display current active product groups
  const visibleCategories = categories.filter((c) => !c.isHidden && c.id !== 'all' && c.id !== 'event_0209');

  return (
    <footer
      id="not-a-knot-footer"
      role="contentinfo"
      itemScope
      itemType="https://schema.org/OnlineStore"
      className="bg-slate-950 text-slate-400 border-t border-slate-800/80 pt-10 pb-8 text-xs font-sans"
    >
      {/* Hidden Rich Semantic Microdata for Search Engines (GoogleBot / Bing) */}
      <div className="sr-only">
        <h2 itemProp="name">NOT A KNOT - Phụ Kiện Vòng Tay Handmade Thủ Công</h2>
        <p itemProp="description">
          NOT A KNOT chuyên chế tác thủ công các dòng vòng tay handmade nam nữ, móc khóa thời trang, phụ kiện đan tay cao cấp, charm đồng và titan nguyên khối độc bản. Nhận custom phối màu và kích thước theo yêu cầu toàn quốc.
        </p>
        <span itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
          <span itemProp="addressCountry">Việt Nam</span>
        </span>
        <span itemProp="priceRange">80.000đ - 500.000đ</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Multi-Column Internal Links & Brand Bio */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-slate-800/80">
          
          {/* Col 1 & 2: Brand Story & Socials */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              {siteContent?.logoUrl ? (
                <img
                  src={siteContent.logoUrl}
                  alt={`${brandName} - Logo thương hiệu phụ kiện handmade`}
                  itemProp="image"
                  width="40"
                  height="40"
                  className="h-10 w-10 object-contain rounded-lg border border-slate-800 bg-slate-900 p-1"
                />
              ) : null}
              <div>
                <span className="font-black text-base text-white tracking-wider uppercase block">
                  {brandName}
                </span>
                <span className="text-xs text-amber-400 font-medium">
                  {tagline}
                </span>
              </div>
            </div>

            {/* Project Academic Disclaimer & Brand Motto */}
            {(() => {
              const text = siteContent?.footerDescription || '';
              const isOldParacord = /Paracord|EDC|bảo hành nút thắt/i.test(text);
              const hasDisclaimer = text.includes('Kinh tế Quốc dân');

              if (!text || isOldParacord || !hasDisclaimer) {
                return (
                  <div className="space-y-1.5 text-xs text-slate-400 leading-relaxed pr-4">
                    <p className="font-bold text-amber-400 tracking-wide">
                      Not A Knot - Even More.
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                      Not A Knot cùng hệ thống website và các kênh truyền thông liên quan là dự án học tập và bài tập nhóm thuộc khuôn khổ môn Quản trị tác nghiệp Thương mại điện tử - Đại học Kinh tế Quốc dân. Dự án được triển khai hoàn toàn nhằm mục đích nghiên cứu, thực hành môn học và không mang tính chất kinh doanh thương mại.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-1 text-xs text-slate-400 leading-relaxed pr-4 whitespace-pre-line">
                  {text}
                </div>
              );
            })()}
          </div>

          {/* Col 3: Sản Phẩm Internal Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Sản Phẩm
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="#catalog"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.hash = '#catalog';
                    onOpenAllCatalog?.();
                  }}
                  className="hover:text-amber-400 transition-colors inline-block font-medium"
                >
                  Tất cả sản phẩm
                </a>
              </li>
              {visibleCategories.length > 0 ? (
                visibleCategories.map((cat) => {
                  const catSlug = slugify(cat.id);
                  return (
                    <li key={cat.id}>
                      <a
                        href={`#catalog?category=${catSlug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.hash = `#catalog?category=${catSlug}`;
                          if (onSelectCategory) {
                            onSelectCategory(cat.id);
                          } else {
                            onOpenAllCatalog?.();
                          }
                        }}
                        className="hover:text-amber-400 transition-colors inline-block"
                      >
                        {cat.label}
                      </a>
                    </li>
                  );
                })
              ) : (
                <>
                  <li>
                    <a
                      href="#catalog?category=bracelets"
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.hash = '#catalog?category=bracelets';
                        onOpenAllCatalog?.();
                      }}
                      className="hover:text-amber-400 transition-colors inline-block"
                    >
                      Vòng tay handmade
                    </a>
                  </li>
                  <li>
                    <a
                      href="#catalog?category=keychain"
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.hash = '#catalog?category=keychain';
                        onOpenAllCatalog?.();
                      }}
                      className="hover:text-amber-400 transition-colors inline-block"
                    >
                      Móc khóa handmade
                    </a>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Col 4: Hỗ Trợ & Tra Cứu */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Hỗ Trợ & Tra Cứu
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="#tracker"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.hash = '#tracker';
                    onOpenOrderTracker?.();
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold inline-block"
                >
                  Tra cứu đơn hàng
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.hash = '#faq';
                  }}
                  className="hover:text-amber-400 transition-colors inline-block"
                >
                  Câu hỏi thường gặp (FAQ)
                </a>
              </li>
              <li>
                <a
                  href="#policy"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.hash = '#policy';
                  }}
                  className="hover:text-amber-400 transition-colors inline-block"
                >
                  Chính sách bảo hành & đổi trả
                </a>
              </li>
            </ul>
          </div>

          {/* Col 5: Về Chúng Tôi & Social Media */}
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Về Chúng Tôi
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <a
                    href="#about"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.hash = '#about';
                      onOpenAbout?.();
                    }}
                    className="hover:text-amber-400 transition-colors inline-block"
                  >
                    Câu chuyện thương hiệu
                  </a>
                </li>
                <li>
                  <a
                    href="#contact"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.hash = '#contact';
                      onOpenContact?.();
                    }}
                    className="hover:text-amber-400 transition-colors inline-block"
                  >
                    Liên hệ
                  </a>
                </li>
                <li>
                  <a
                    href="#contact"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.hash = '#contact';
                      onOpenContact?.();
                    }}
                    className="hover:text-amber-400 transition-colors inline-block"
                  >
                    Đặt hàng số lượng lớn / Quà tặng
                  </a>
                </li>
              </ul>
            </div>

            {/* Social Media Logos (Moved to the Right) */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                Kênh kết nối
              </span>
              <div className="flex items-center gap-2.5">
                <a
                  id="footer-social-facebook"
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  itemProp="sameAs"
                  className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-[#1877F2] border border-slate-800 hover:border-[#1877F2] text-slate-300 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xs"
                  title={`Facebook ${brandName}`}
                  aria-label="Facebook Fanpage NOT A KNOT"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>

                <a
                  id="footer-social-instagram"
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  itemProp="sameAs"
                  className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-[#E1306C] border border-slate-800 hover:border-[#E1306C] text-slate-300 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xs"
                  title={`Instagram ${brandName}`}
                  aria-label="Instagram NOT A KNOT"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>

                <a
                  id="footer-social-threads"
                  href={threadsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  itemProp="sameAs"
                  className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-white border border-slate-800 hover:border-white flex items-center justify-center transition-all duration-200 p-2 group cursor-pointer shadow-xs"
                  title={`Threads ${brandName}`}
                  aria-label="Threads NOT A KNOT"
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/9/9d/Threads_%28app%29_logo.svg"
                    alt="Threads Logo - NOT A KNOT"
                    width="16"
                    height="16"
                    className="w-3.5 h-3.5 object-contain invert group-hover:invert-0 transition-all"
                    referrerPolicy="no-referrer"
                  />
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Minimal Copyright & Admin Access */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <span>
            {copyrightText}
          </span>

          <div className="flex items-center gap-4">
            <button
              onClick={onOpenAdmin}
              className="text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cổng quản trị"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Quản trị hệ thống</span>
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};


