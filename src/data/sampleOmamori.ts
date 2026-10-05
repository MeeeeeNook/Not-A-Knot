import { ProductOmamoriOption } from '../types';

/**
 * Standard preset Omamori Japanese Amulets.
 * Designed with authentic traditional Japanese Omamori amulet styling (brocade shape, woven knot, tassel, blessing kanji & Vietnamese meaning)
 * rendered as lightweight SVG data URIs for instant crisp loading.
 */

const createSvgDataUri = (svgContent: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent.trim())}`;
};

// 1. Bùa Bình An · Đỏ Truyền Thống (Peace & Safety - An Khang)
const omamoriBinhAnDo = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
  <defs>
    <linearGradient id="omamoriRed" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E11D48"/>
      <stop offset="50%" stop-color="#BE123C"/>
      <stop offset="100%" stop-color="#881337"/>
    </linearGradient>
    <pattern id="goldPattern1" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="8" cy="8" r="1.5" fill="#FDE047" opacity="0.3"/>
      <path d="M0,8 Q8,0 16,8 Q8,16 0,8" fill="none" stroke="#FDE047" stroke-width="0.75" opacity="0.25"/>
    </pattern>
    <filter id="omamoriShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#881337" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- Background Card Base -->
  <rect width="200" height="240" rx="32" fill="#FFF1F2"/>
  
  <!-- Omamori Hanging Cord (Top Loop) -->
  <path d="M100,12 C80,12 85,45 95,50" fill="none" stroke="#FBBF24" stroke-width="3" stroke-linecap="round"/>
  <path d="M100,12 C120,12 115,45 105,50" fill="none" stroke="#FBBF24" stroke-width="3" stroke-linecap="round"/>
  <circle cx="100" cy="12" r="3.5" fill="#D97706"/>

  <!-- Main Pouch Body -->
  <g filter="url(#omamoriShadow)">
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#omamoriRed)"/>
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#goldPattern1)"/>
    <!-- Gold Border Inset -->
    <path d="M72,56 L128,56 L141,77 L141,176 Q141,186 131,186 L69,186 Q59,186 59,176 L59,77 Z" fill="none" stroke="#FDE047" stroke-width="1.5" opacity="0.65"/>
  </g>

  <!-- Traditional Japanese Omamori Knot (Mizuhiki / Musubi) -->
  <g transform="translate(100, 68)">
    <circle cx="0" cy="0" r="5" fill="#F59E0B" stroke="#B45309" stroke-width="1.5"/>
    <!-- Bow loops -->
    <path d="M0,0 C-18,-15 -22,8 0,0" fill="none" stroke="#FDE047" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 C18,-15 22,8 0,0" fill="none" stroke="#FDE047" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 L-10,24" stroke="#FDE047" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M0,0 L10,24" stroke="#FDE047" stroke-width="2.2" stroke-linecap="round"/>
  </g>

  <!-- Central Gold Cartouche / Label -->
  <g transform="translate(100, 134)">
    <rect x="-30" y="-36" width="60" height="72" rx="8" fill="#FFFBEB" stroke="#D97706" stroke-width="2"/>
    <rect x="-26" y="-32" width="52" height="64" rx="5" fill="none" stroke="#F59E0B" stroke-width="0.8"/>
    <!-- Traditional Kanji Character (Bình An) -->
    <text x="0" y="-12" font-family="serif, 'Noto Serif JP'" font-size="16" font-weight="900" fill="#991B1B" text-anchor="middle">御守</text>
    <text x="0" y="8" font-family="sans-serif" font-size="12" font-weight="900" fill="#B91C1C" text-anchor="middle">BÌNH AN</text>
    <text x="0" y="24" font-family="sans-serif" font-size="8.5" font-weight="700" fill="#B45309" text-anchor="middle">An Khang</text>
  </g>
</svg>
`);

// 2. Bùa May Mắn · Vàng Kim (Good Luck & Fortune - Khai Vận)
const omamoriMayManVang = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
  <defs>
    <linearGradient id="omamoriYellow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="50%" stop-color="#D97706"/>
      <stop offset="100%" stop-color="#92400E"/>
    </linearGradient>
    <pattern id="goldPattern2" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M0,7 L7,0 L14,7 L7,14 Z" fill="none" stroke="#FEF08A" stroke-width="0.75" opacity="0.35"/>
    </pattern>
    <filter id="omamoriShadow2" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#78350F" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="200" height="240" rx="32" fill="#FEFCE8"/>
  
  <path d="M100,12 C80,12 85,45 95,50" fill="none" stroke="#DC2626" stroke-width="3" stroke-linecap="round"/>
  <path d="M100,12 C120,12 115,45 105,50" fill="none" stroke="#DC2626" stroke-width="3" stroke-linecap="round"/>
  <circle cx="100" cy="12" r="3.5" fill="#991B1B"/>

  <g filter="url(#omamoriShadow2)">
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#omamoriYellow)"/>
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#goldPattern2)"/>
    <path d="M72,56 L128,56 L141,77 L141,176 Q141,186 131,186 L69,186 Q59,186 59,176 L59,77 Z" fill="none" stroke="#FEF08A" stroke-width="1.5" opacity="0.75"/>
  </g>

  <!-- Traditional Knot (Red cords on gold) -->
  <g transform="translate(100, 68)">
    <circle cx="0" cy="0" r="5" fill="#DC2626" stroke="#991B1B" stroke-width="1.5"/>
    <path d="M0,0 C-18,-15 -22,8 0,0" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 C18,-15 22,8 0,0" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 L-10,24" stroke="#EF4444" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M0,0 L10,24" stroke="#EF4444" stroke-width="2.2" stroke-linecap="round"/>
  </g>

  <g transform="translate(100, 134)">
    <rect x="-30" y="-36" width="60" height="72" rx="8" fill="#FFFFFF" stroke="#B45309" stroke-width="2"/>
    <rect x="-26" y="-32" width="52" height="64" rx="5" fill="none" stroke="#F59E0B" stroke-width="0.8"/>
    <text x="0" y="-12" font-family="serif, 'Noto Serif JP'" font-size="16" font-weight="900" fill="#B45309" text-anchor="middle">開運</text>
    <text x="0" y="8" font-family="sans-serif" font-size="11.5" font-weight="900" fill="#92400E" text-anchor="middle">MAY MẮN</text>
    <text x="0" y="24" font-family="sans-serif" font-size="8.5" font-weight="700" fill="#DC2626" text-anchor="middle">Khai Vận</text>
  </g>
</svg>
`);

// 3. Bùa Tình Duyên · Hồng Sakura (Love & Relationship - Duyên Lành)
const omamoriTinhDuyenHong = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
  <defs>
    <linearGradient id="omamoriPink" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F472B6"/>
      <stop offset="50%" stop-color="#EC4899"/>
      <stop offset="100%" stop-color="#BE185D"/>
    </linearGradient>
    <pattern id="sakuraPattern" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="9" cy="9" r="1.8" fill="#FCE7F3" opacity="0.5"/>
      <path d="M9,5 C7,7 7,11 9,13 C11,11 11,7 9,5" fill="#FCE7F3" opacity="0.35"/>
    </pattern>
    <filter id="omamoriShadow3" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#831843" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="200" height="240" rx="32" fill="#FDF2F8"/>
  
  <path d="M100,12 C80,12 85,45 95,50" fill="none" stroke="#F43F5E" stroke-width="3" stroke-linecap="round"/>
  <path d="M100,12 C120,12 115,45 105,50" fill="none" stroke="#F43F5E" stroke-width="3" stroke-linecap="round"/>
  <circle cx="100" cy="12" r="3.5" fill="#BE123C"/>

  <g filter="url(#omamoriShadow3)">
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#omamoriPink)"/>
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#sakuraPattern)"/>
    <path d="M72,56 L128,56 L141,77 L141,176 Q141,186 131,186 L69,186 Q59,186 59,176 L59,77 Z" fill="none" stroke="#FDF2F8" stroke-width="1.5" opacity="0.75"/>
  </g>

  <g transform="translate(100, 68)">
    <circle cx="0" cy="0" r="5" fill="#FFF1F2" stroke="#E11D48" stroke-width="1.5"/>
    <path d="M0,0 C-18,-15 -22,8 0,0" fill="none" stroke="#FFF1F2" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 C18,-15 22,8 0,0" fill="none" stroke="#FFF1F2" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 L-10,24" stroke="#FFF1F2" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M0,0 L10,24" stroke="#FFF1F2" stroke-width="2.2" stroke-linecap="round"/>
  </g>

  <g transform="translate(100, 134)">
    <rect x="-30" y="-36" width="60" height="72" rx="8" fill="#FFF5F7" stroke="#DB2777" stroke-width="2"/>
    <rect x="-26" y="-32" width="52" height="64" rx="5" fill="none" stroke="#F472B6" stroke-width="0.8"/>
    <text x="0" y="-12" font-family="serif, 'Noto Serif JP'" font-size="16" font-weight="900" fill="#9D174D" text-anchor="middle">縁結</text>
    <text x="0" y="8" font-family="sans-serif" font-size="11" font-weight="900" fill="#BE185D" text-anchor="middle">TÌNH DUYÊN</text>
    <text x="0" y="24" font-family="sans-serif" font-size="8.5" font-weight="700" fill="#E11D48" text-anchor="middle">Kết Duyên</text>
  </g>
</svg>
`);

// 4. Bùa Tài Lộc · Xanh Lục Ngọc (Wealth & Prosperity - Chiêu Tài)
const omamoriTaiLocXanh = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
  <defs>
    <linearGradient id="omamoriGreen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="50%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#064E3B"/>
    </linearGradient>
    <pattern id="coinPattern" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="8" cy="8" r="3" fill="none" stroke="#FDE047" stroke-width="0.8" opacity="0.3"/>
      <rect x="6.5" y="6.5" width="3" height="3" fill="none" stroke="#FDE047" stroke-width="0.6" opacity="0.3"/>
    </pattern>
    <filter id="omamoriShadow4" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#064E3B" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="200" height="240" rx="32" fill="#ECFDF5"/>
  
  <path d="M100,12 C80,12 85,45 95,50" fill="none" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
  <path d="M100,12 C120,12 115,45 105,50" fill="none" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
  <circle cx="100" cy="12" r="3.5" fill="#D97706"/>

  <g filter="url(#omamoriShadow4)">
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#omamoriGreen)"/>
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#coinPattern)"/>
    <path d="M72,56 L128,56 L141,77 L141,176 Q141,186 131,186 L69,186 Q59,186 59,176 L59,77 Z" fill="none" stroke="#FDE047" stroke-width="1.5" opacity="0.75"/>
  </g>

  <g transform="translate(100, 68)">
    <circle cx="0" cy="0" r="5" fill="#FDE047" stroke="#D97706" stroke-width="1.5"/>
    <path d="M0,0 C-18,-15 -22,8 0,0" fill="none" stroke="#FDE047" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 C18,-15 22,8 0,0" fill="none" stroke="#FDE047" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 L-10,24" stroke="#FDE047" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M0,0 L10,24" stroke="#FDE047" stroke-width="2.2" stroke-linecap="round"/>
  </g>

  <g transform="translate(100, 134)">
    <rect x="-30" y="-36" width="60" height="72" rx="8" fill="#FFFBEB" stroke="#059669" stroke-width="2"/>
    <rect x="-26" y="-32" width="52" height="64" rx="5" fill="none" stroke="#10B981" stroke-width="0.8"/>
    <text x="0" y="-12" font-family="serif, 'Noto Serif JP'" font-size="16" font-weight="900" fill="#047857" text-anchor="middle">金運</text>
    <text x="0" y="8" font-family="sans-serif" font-size="12" font-weight="900" fill="#065F46" text-anchor="middle">TÀI LỘC</text>
    <text x="0" y="24" font-family="sans-serif" font-size="8.5" font-weight="700" fill="#D97706" text-anchor="middle">Chiêu Tài</text>
  </g>
</svg>
`);

// 5. Bùa Học Tập / Thi Cử · Xanh Lam (Academic Success - Đỗ Đạt)
const omamoriHocTapLam = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
  <defs>
    <linearGradient id="omamoriBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="50%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
    <pattern id="wavePattern" width="16" height="10" patternUnits="userSpaceOnUse">
      <path d="M0,5 Q4,0 8,5 T16,5" fill="none" stroke="#E0F2FE" stroke-width="0.8" opacity="0.35"/>
    </pattern>
    <filter id="omamoriShadow5" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#0369A1" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="200" height="240" rx="32" fill="#F0F9FF"/>
  
  <path d="M100,12 C80,12 85,45 95,50" fill="none" stroke="#FDE047" stroke-width="3" stroke-linecap="round"/>
  <path d="M100,12 C120,12 115,45 105,50" fill="none" stroke="#FDE047" stroke-width="3" stroke-linecap="round"/>
  <circle cx="100" cy="12" r="3.5" fill="#EAB308"/>

  <g filter="url(#omamoriShadow5)">
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#omamoriBlue)"/>
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#wavePattern)"/>
    <path d="M72,56 L128,56 L141,77 L141,176 Q141,186 131,186 L69,186 Q59,186 59,176 L59,77 Z" fill="none" stroke="#E0F2FE" stroke-width="1.5" opacity="0.75"/>
  </g>

  <g transform="translate(100, 68)">
    <circle cx="0" cy="0" r="5" fill="#E0F2FE" stroke="#0284C7" stroke-width="1.5"/>
    <path d="M0,0 C-18,-15 -22,8 0,0" fill="none" stroke="#E0F2FE" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 C18,-15 22,8 0,0" fill="none" stroke="#E0F2FE" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 L-10,24" stroke="#E0F2FE" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M0,0 L10,24" stroke="#E0F2FE" stroke-width="2.2" stroke-linecap="round"/>
  </g>

  <g transform="translate(100, 134)">
    <rect x="-30" y="-36" width="60" height="72" rx="8" fill="#FFFFFF" stroke="#0284C7" stroke-width="2"/>
    <rect x="-26" y="-32" width="52" height="64" rx="5" fill="none" stroke="#38BDF8" stroke-width="0.8"/>
    <text x="0" y="-12" font-family="serif, 'Noto Serif JP'" font-size="16" font-weight="900" fill="#0369A1" text-anchor="middle">学業</text>
    <text x="0" y="8" font-family="sans-serif" font-size="12" font-weight="900" fill="#075985" text-anchor="middle">HỌC TẬP</text>
    <text x="0" y="24" font-family="sans-serif" font-size="8.5" font-weight="700" fill="#0284C7" text-anchor="middle">Đỗ Đạt</text>
  </g>
</svg>
`);

// 6. Bùa Sức Khỏe · Tím Hoàng Gia (Health & Longevity - Khang Kiện)
const omamoriSucKhoeTim = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
  <defs>
    <linearGradient id="omamoriPurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A855F7"/>
      <stop offset="50%" stop-color="#7E22CE"/>
      <stop offset="100%" stop-color="#581C87"/>
    </linearGradient>
    <pattern id="flowerPattern" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="7" cy="7" r="1.5" fill="#F3E8FF" opacity="0.4"/>
      <circle cx="2" cy="2" r="1" fill="#F3E8FF" opacity="0.3"/>
    </pattern>
    <filter id="omamoriShadow6" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#581C87" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="200" height="240" rx="32" fill="#FAF5FF"/>
  
  <path d="M100,12 C80,12 85,45 95,50" fill="none" stroke="#FDE047" stroke-width="3" stroke-linecap="round"/>
  <path d="M100,12 C120,12 115,45 105,50" fill="none" stroke="#FDE047" stroke-width="3" stroke-linecap="round"/>
  <circle cx="100" cy="12" r="3.5" fill="#D97706"/>

  <g filter="url(#omamoriShadow6)">
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#omamoriPurple)"/>
    <path d="M68,52 L132,52 L146,75 L146,180 Q146,192 134,192 L66,192 Q54,192 54,180 L54,75 Z" fill="url(#flowerPattern)"/>
    <path d="M72,56 L128,56 L141,77 L141,176 Q141,186 131,186 L69,186 Q59,186 59,176 L59,77 Z" fill="none" stroke="#F3E8FF" stroke-width="1.5" opacity="0.75"/>
  </g>

  <g transform="translate(100, 68)">
    <circle cx="0" cy="0" r="5" fill="#FDE047" stroke="#9333EA" stroke-width="1.5"/>
    <path d="M0,0 C-18,-15 -22,8 0,0" fill="none" stroke="#FDE047" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 C18,-15 22,8 0,0" fill="none" stroke="#FDE047" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M0,0 L-10,24" stroke="#FDE047" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M0,0 L10,24" stroke="#FDE047" stroke-width="2.2" stroke-linecap="round"/>
  </g>

  <g transform="translate(100, 134)">
    <rect x="-30" y="-36" width="60" height="72" rx="8" fill="#FFFFFF" stroke="#7E22CE" stroke-width="2"/>
    <rect x="-26" y="-32" width="52" height="64" rx="5" fill="none" stroke="#A855F7" stroke-width="0.8"/>
    <text x="0" y="-12" font-family="serif, 'Noto Serif JP'" font-size="16" font-weight="900" fill="#6B21A8" text-anchor="middle">健康</text>
    <text x="0" y="8" font-family="sans-serif" font-size="11.5" font-weight="900" fill="#581C87" text-anchor="middle">SỨC KHỎE</text>
    <text x="0" y="24" font-family="sans-serif" font-size="8.5" font-weight="700" fill="#7E22CE" text-anchor="middle">Khang Kiện</text>
  </g>
</svg>
`);

export const DEFAULT_OMAMORI_PRESETS: ProductOmamoriOption[] = [
  {
    id: 'omamori-binh-an-do',
    name: 'Bùa Bình An · Đỏ',
    image: omamoriBinhAnDo,
    priceDelta: 0,
    stock: 20
  },
  {
    id: 'omamori-may-man-vang',
    name: 'Bùa May Mắn · Vàng',
    image: omamoriMayManVang,
    priceDelta: 0,
    stock: 20
  },
  {
    id: 'omamori-tinh-duyen-hong',
    name: 'Bùa Tình Duyên · Sakura',
    image: omamoriTinhDuyenHong,
    priceDelta: 0,
    stock: 15
  },
  {
    id: 'omamori-tai-loc-xanh',
    name: 'Bùa Tài Lộc · Lục Bảo',
    image: omamoriTaiLocXanh,
    priceDelta: 0,
    stock: 18
  },
  {
    id: 'omamori-hoc-tap-lam',
    name: 'Bùa Đỗ Đạt · Lam',
    image: omamoriHocTapLam,
    priceDelta: 0,
    stock: 16
  },
  {
    id: 'omamori-suc-khoe-tim',
    name: 'Bùa Sức Khỏe · Tím',
    image: omamoriSucKhoeTim,
    priceDelta: 0,
    stock: 14
  }
];
