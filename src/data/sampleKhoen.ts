import { ProductKhoenOption } from '../types';

/**
 * Standard preset Khoen (Clasps & Rings) for Paracord Keychains & Accessories.
 * Rendered as lightweight, responsive SVG data URIs for instantaneous crisp loading.
 */

const createSvgDataUri = (svgContent: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent.trim())}`;
};

// 1. Khoen Tròn Inox O-Ring (Bạc bóng)
const khoenTronInoxSvg = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="silverRing" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="25%" stop-color="#E2E8F0"/>
      <stop offset="50%" stop-color="#94A3B8"/>
      <stop offset="75%" stop-color="#CBD5E1"/>
      <stop offset="100%" stop-color="#64748B"/>
    </linearGradient>
    <filter id="shadowRing" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="160" height="160" rx="24" fill="#F8FAFC"/>
  <!-- Keyring Coil -->
  <g filter="url(#shadowRing)">
    <circle cx="80" cy="80" r="50" fill="none" stroke="url(#silverRing)" stroke-width="12"/>
    <circle cx="80" cy="80" r="42" fill="none" stroke="#64748B" stroke-width="1.5" opacity="0.6"/>
    <circle cx="80" cy="80" r="58" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.8"/>
    <!-- Split cut indicator -->
    <line x1="80" y1="28" x2="80" y2="40" stroke="#475569" stroke-width="2.5" stroke-linecap="round"/>
  </g>
</svg>
`);

// 2. Khoen Càng Cua Bạc (Lobster Clasp)
const khoenCangCuaSvg = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="lobsterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="30%" stop-color="#CBD5E1"/>
      <stop offset="70%" stop-color="#94A3B8"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
    <filter id="shadowClasp" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="160" height="160" rx="24" fill="#F8FAFC"/>
  <!-- Lobster Clasp Body -->
  <g filter="url(#shadowClasp)" transform="translate(80, 80) rotate(-45) translate(-40, -50)">
    <!-- Bottom Swivel Eye -->
    <circle cx="40" cy="85" r="14" fill="none" stroke="url(#lobsterGrad)" stroke-width="6"/>
    <!-- Swivel Joint -->
    <rect x="34" y="66" width="12" height="8" rx="2" fill="url(#lobsterGrad)"/>
    <!-- Main Hook -->
    <path d="M40,66 C22,66 18,46 18,34 C18,16 32,10 46,10 C60,10 64,24 64,36 C64,48 54,54 44,54" 
          fill="none" stroke="url(#lobsterGrad)" stroke-width="8" stroke-linecap="round"/>
    <!-- Trigger Lever -->
    <path d="M46,38 L54,44" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
    <circle cx="54" cy="44" r="3" fill="#64748B"/>
  </g>
</svg>
`);

// 3. Khoen Trái Tim Bạc (Heart Ring)
const khoenTraiTimSvg = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="heartSilver" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="35%" stop-color="#E2E8F0"/>
      <stop offset="70%" stop-color="#94A3B8"/>
      <stop offset="100%" stop-color="#64748B"/>
    </linearGradient>
    <filter id="shadowHeart" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="160" height="160" rx="24" fill="#FFF1F2"/>
  <g filter="url(#shadowHeart)" transform="translate(0, 4)">
    <path d="M80,126 C68,114 26,82 26,50 C26,30 42,18 60,18 C70,18 76,23 80,28 C84,23 90,18 100,18 C118,18 134,30 134,50 C134,82 92,114 80,126 Z"
          fill="none" stroke="url(#heartSilver)" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M80,126 C68,114 26,82 26,50 C26,30 42,18 60,18 C70,18 76,23 80,28 C84,23 90,18 100,18 C118,18 134,30 134,50 C134,82 92,114 80,126 Z"
          fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.7"/>
  </g>
</svg>
`);

// 4. Khoen Giọt Nước Vintage Đồng (Bronze Tear-drop Ring)
const khoenGiotNuocDongSvg = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="bronzeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="35%" stop-color="#D97706"/>
      <stop offset="70%" stop-color="#92400E"/>
      <stop offset="100%" stop-color="#451A03"/>
    </linearGradient>
    <filter id="shadowTeardrop" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#451A03" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="160" height="160" rx="24" fill="#FEF3C7"/>
  <g filter="url(#shadowTeardrop)" transform="translate(0, 2)">
    <path d="M80,22 C92,42 124,78 124,102 C124,126 104,142 80,142 C56,142 36,126 36,102 C36,78 68,42 80,22 Z"
          fill="none" stroke="url(#bronzeGrad)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Vintage patina highlight -->
    <path d="M80,26 C90,44 118,78 118,100" fill="none" stroke="#FDE68A" stroke-width="1.5" opacity="0.75"/>
  </g>
</svg>
`);

// 5. Khoen Đen Nhám Matte Tactical (Matte Black EDC)
const khoenDenNhamSvg = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="blackMatte" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="50%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#090D16"/>
    </linearGradient>
    <filter id="shadowBlack" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="160" height="160" rx="24" fill="#F1F5F9"/>
  <g filter="url(#shadowBlack)">
    <circle cx="80" cy="80" r="50" fill="none" stroke="url(#blackMatte)" stroke-width="13"/>
    <circle cx="80" cy="80" r="43" fill="none" stroke="#334155" stroke-width="1"/>
    <!-- Subtle tactical edge bevel -->
    <circle cx="80" cy="80" r="57" fill="none" stroke="#64748B" stroke-width="0.75" opacity="0.6"/>
  </g>
</svg>
`);

// 6. Khoen Mạ Vàng Sang Trọng (Polished Gold Ring)
const khoenMaVangSvg = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="goldLuxe" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A"/>
      <stop offset="30%" stop-color="#FACC15"/>
      <stop offset="60%" stop-color="#CA8A04"/>
      <stop offset="85%" stop-color="#EAB308"/>
      <stop offset="100%" stop-color="#A16207"/>
    </linearGradient>
    <filter id="shadowGold" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#713F12" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="160" height="160" rx="24" fill="#FEFCE8"/>
  <g filter="url(#shadowGold)">
    <circle cx="80" cy="80" r="50" fill="none" stroke="url(#goldLuxe)" stroke-width="12"/>
    <circle cx="80" cy="80" r="43" fill="none" stroke="#A16207" stroke-width="1.5" opacity="0.5"/>
    <circle cx="80" cy="80" r="57" fill="none" stroke="#FEF9C3" stroke-width="1.2" opacity="0.9"/>
  </g>
</svg>
`);

// 7. Khoen Chữ D Inox (D-Ring)
const khoenChuDSvg = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="dRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="35%" stop-color="#E2E8F0"/>
      <stop offset="70%" stop-color="#94A3B8"/>
      <stop offset="100%" stop-color="#64748B"/>
    </linearGradient>
    <filter id="shadowDRing" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="160" height="160" rx="24" fill="#F8FAFC"/>
  <g filter="url(#shadowDRing)" transform="translate(0, 0)">
    <path d="M48,32 L48,128 C96,128 116,108 116,80 C116,52 96,32 48,32 Z" 
          fill="none" stroke="url(#dRingGrad)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M48,32 L48,128 C96,128 116,108 116,80 C116,52 96,32 48,32 Z" 
          fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.7"/>
  </g>
</svg>
`);

export const DEFAULT_KHOEN_PRESETS: ProductKhoenOption[] = [
  {
    id: 'khoen_tron_inox',
    name: 'Khoen Tròn Inox O-Ring (Bạc)',
    image: khoenTronInoxSvg,
    priceDelta: 0,
    stock: undefined,
  },
  {
    id: 'khoen_cang_cua_bac',
    name: 'Khoen Càng Cua Bạc (Lobster Clasp)',
    image: khoenCangCuaSvg,
    priceDelta: 0,
    stock: undefined,
  },
  {
    id: 'khoen_trai_tim_bac',
    name: 'Khoen Trái Tim Hợp Kim (Bạc)',
    image: khoenTraiTimSvg,
    priceDelta: 5000,
    stock: 50,
  },
  {
    id: 'khoen_giot_nuoc_dong',
    name: 'Khoen Giọt Nước Vintage Đồng',
    image: khoenGiotNuocDongSvg,
    priceDelta: 5000,
    stock: 50,
  },
  {
    id: 'khoen_den_nham_matte',
    name: 'Khoen Đen Nhám Matte Tactical',
    image: khoenDenNhamSvg,
    priceDelta: 5000,
    stock: 50,
  },
  {
    id: 'khoen_ma_vang_sang_trong',
    name: 'Khoen Mạ Vàng Sang Trọng (Gold Ring)',
    image: khoenMaVangSvg,
    priceDelta: 10000,
    stock: 30,
  },
  {
    id: 'khoen_chu_d_inox',
    name: 'Khoen Chữ D D-Ring Inox',
    image: khoenChuDSvg,
    priceDelta: 0,
    stock: undefined,
  },
];
