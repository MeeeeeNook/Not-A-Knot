import React from 'react';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { MaintenanceIllustration } from './MaintenanceIllustration';

interface NotFoundPageProps {
  onNavigateHome: () => void;
  onOpenCatalog?: (categoryId?: string, searchQuery?: string) => void;
  onOpenTracker?: () => void;
  onOpenContact?: () => void;
  brandName?: string;
  logoUrl?: string;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  onNavigateHome,
  onOpenCatalog,
  brandName = 'NOT A KNOT',
  logoUrl
}) => {
  const displayLogo = logoUrl || '/assets/logo.jpg';

  return (
    <div
      id="custom-404-page"
      role="main"
      className="min-h-screen bg-[#FAF9F6] text-slate-900 flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-amber-400 selection:text-slate-950"
    >
      {/* 1. Top Branded Bar Matching Maintenance Layout */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between py-3 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <img
            src={displayLogo}
            alt={brandName}
            className="h-10 sm:h-12 w-auto object-contain rounded-xl border border-slate-200/90 shadow-2xs bg-white p-1"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wider text-slate-900 uppercase leading-none">
              {brandName}
            </h2>
          </div>
        </div>
      </header>

      {/* 2. Main Content (2-Column Responsive Layout with Construction Illustration) */}
      <main className="w-full max-w-6xl mx-auto my-auto py-8 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-10 lg:gap-16">
          {/* Column A: Construction Illustration */}
          <div className="lg:col-span-6 flex justify-center order-1 lg:order-1">
            <div className="w-full max-w-lg lg:max-w-none">
              <MaintenanceIllustration className="w-full h-auto" />
            </div>
          </div>

          {/* Column B: 404 Message Content */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left order-2 lg:order-2">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                404 - Không Tìm Thấy Trang
              </h1>
              <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0 whitespace-pre-line">
                Đường dẫn bạn đang tìm kiếm không tồn tại, đã bị gỡ bỏ hoặc tạm thời không khả dụng. Hãy quay về trang chủ để tiếp tục khám phá các bộ sưu tập vòng tay và phụ kiện thủ công độc bản.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <button
                type="button"
                onClick={onNavigateHome}
                className="w-full sm:w-auto min-w-[200px] inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 font-black text-sm sm:text-base transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Về Trang Chủ</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              {onOpenCatalog && (
                <button
                  type="button"
                  onClick={() => onOpenCatalog()}
                  className="w-full sm:w-auto min-w-[180px] inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm sm:text-base transition-all shadow-xs cursor-pointer"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>Xem Sản Phẩm</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 3. Bottom Minimal Copyright Footer */}
      <footer className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 pb-2 text-slate-400 text-xs border-t border-slate-200/80">
        <div>
          <span>© {new Date().getFullYear()} {brandName}. Tất cả quyền được bảo lưu.</span>
        </div>
      </footer>
    </div>
  );
};
