import { ProductCharmOption } from '../types';

/**
 * Standard preset charms matching the customer's catalog photo.
 * Designed with beautiful, cute SVG graphics rendered as data URIs for instant, crisp loading.
 */

const createSvgDataUri = (svgContent: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent.trim())}`;
};

// 1. Sao chuông · Xanh
const charmSaoChuongXanh = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bgGrad1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#EBF5FF"/>
      <stop offset="100%" stop-color="#D0E8FF"/>
    </radialGradient>
    <filter id="shadow1" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#3B82F6" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="200" height="200" rx="36" fill="url(#bgGrad1)"/>
  <!-- Charm ring -->
  <circle cx="100" cy="38" r="14" fill="none" stroke="#94A3B8" stroke-width="4"/>
  <!-- Blue Star -->
  <g filter="url(#shadow1)">
    <polygon points="100,50 114,80 148,84 122,106 130,140 100,122 70,140 78,106 52,84 86,80" fill="#38BDF8" stroke="#0284C7" stroke-width="3" stroke-linejoin="round"/>
    <!-- Star highlight -->
    <polygon points="100,58 110,80 134,83 115,100 120,125 100,112 80,125 85,100 66,83 90,80" fill="#BAE6FD" opacity="0.6"/>
    <!-- Star shine dot -->
    <circle cx="92" cy="74" r="3.5" fill="#FFFFFF"/>
    <circle cx="85" cy="80" r="2" fill="#FFFFFF"/>
  </g>
  <!-- Mini Blue Bell hanging below -->
  <g transform="translate(100, 142)">
    <circle cx="0" cy="18" r="14" fill="#60A5FA" stroke="#2563EB" stroke-width="2.5"/>
    <rect x="-8" y="24" width="16" height="3.5" rx="1.5" fill="#1D4ED8"/>
    <circle cx="0" cy="22" r="3" fill="#1E40AF"/>
    <path d="M-8,14 Q0,8 8,14" fill="none" stroke="#93C5FD" stroke-width="2"/>
  </g>
</svg>
`);

// 2. Sao trong · Xanh
const charmSaoTrongXanh = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bgGrad2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F0F9FF"/>
      <stop offset="100%" stop-color="#E0F2FE"/>
    </radialGradient>
    <radialGradient id="starGlassBlue" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#BAE6FD" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.75"/>
    </radialGradient>
  </defs>
  <rect width="200" height="200" rx="36" fill="url(#bgGrad2)"/>
  <circle cx="100" cy="36" r="14" fill="none" stroke="#CBD5E1" stroke-width="4"/>
  <!-- Clear Acrylic Blue Star -->
  <polygon points="100,52 116,84 150,88 124,112 132,146 100,128 68,146 76,112 50,88 84,84" fill="url(#starGlassBlue)" stroke="#0284C7" stroke-width="4" stroke-linejoin="round"/>
  <!-- Internal acrylic facets -->
  <line x1="100" y1="52" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.7"/>
  <line x1="150" y1="88" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.7"/>
  <line x1="132" y1="146" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.7"/>
  <line x1="68" y1="146" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.7"/>
  <line x1="50" y1="88" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.7"/>
  <circle cx="85" cy="75" r="4" fill="#FFFFFF"/>
</svg>
`);

// 3. Sao trong · Hồng
const charmSaoTrongHong = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bgGrad3" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFF1F2"/>
      <stop offset="100%" stop-color="#FFE4E6"/>
    </radialGradient>
    <radialGradient id="starGlassPink" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#FECDD3" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#FB7185" stop-opacity="0.75"/>
    </radialGradient>
  </defs>
  <rect width="200" height="200" rx="36" fill="url(#bgGrad3)"/>
  <circle cx="100" cy="36" r="14" fill="none" stroke="#FDA4AF" stroke-width="4"/>
  <!-- Clear Acrylic Pink Star -->
  <polygon points="100,52 116,84 150,88 124,112 132,146 100,128 68,146 76,112 50,88 84,84" fill="url(#starGlassPink)" stroke="#E11D48" stroke-width="4" stroke-linejoin="round"/>
  <!-- Facets & shine -->
  <line x1="100" y1="52" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.7"/>
  <line x1="150" y1="88" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.7"/>
  <line x1="132" y1="146" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.7"/>
  <line x1="68" y1="146" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.7"/>
  <line x1="50" y1="88" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.7"/>
  <circle cx="85" cy="75" r="4" fill="#FFFFFF"/>
</svg>
`);

// 4. Sao trong · Vàng
const charmSaoTrongVang = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bgGrad4" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FEFCE8"/>
      <stop offset="100%" stop-color="#FEF08A"/>
    </radialGradient>
    <radialGradient id="starGlassYellow" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#FEF08A" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#FACC15" stop-opacity="0.8"/>
    </radialGradient>
  </defs>
  <rect width="200" height="200" rx="36" fill="url(#bgGrad4)"/>
  <circle cx="100" cy="36" r="14" fill="none" stroke="#EAB308" stroke-width="4"/>
  <!-- Clear Acrylic Yellow Star -->
  <polygon points="100,52 116,84 150,88 124,112 132,146 100,128 68,146 76,112 50,88 84,84" fill="url(#starGlassYellow)" stroke="#CA8A04" stroke-width="4" stroke-linejoin="round"/>
  <line x1="100" y1="52" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.75"/>
  <line x1="150" y1="88" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.75"/>
  <line x1="132" y1="146" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.75"/>
  <line x1="68" y1="146" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.75"/>
  <line x1="50" y1="88" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.75"/>
  <circle cx="85" cy="75" r="4" fill="#FFFFFF"/>
</svg>
`);

// 5. Sao trong · Tím
const charmSaoTrongTim = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bgGrad5" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FAF5FF"/>
      <stop offset="100%" stop-color="#F3E8FF"/>
    </radialGradient>
    <radialGradient id="starGlassPurple" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#E9D5FF" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#C084FC" stop-opacity="0.8"/>
    </radialGradient>
  </defs>
  <rect width="200" height="200" rx="36" fill="url(#bgGrad5)"/>
  <circle cx="100" cy="36" r="14" fill="none" stroke="#C084FC" stroke-width="4"/>
  <!-- Clear Acrylic Purple Star -->
  <polygon points="100,52 116,84 150,88 124,112 132,146 100,128 68,146 76,112 50,88 84,84" fill="url(#starGlassPurple)" stroke="#9333EA" stroke-width="4" stroke-linejoin="round"/>
  <line x1="100" y1="52" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.75"/>
  <line x1="150" y1="88" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.75"/>
  <line x1="132" y1="146" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.75"/>
  <line x1="68" y1="146" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.75"/>
  <line x1="50" y1="88" x2="100" y2="108" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.75"/>
  <circle cx="85" cy="75" r="4" fill="#FFFFFF"/>
</svg>
`);

// 6. Gấu bi · Xanh
const charmGauBiXanh = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bgGrad6" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F0FDF4"/>
      <stop offset="100%" stop-color="#DCFCE7"/>
    </radialGradient>
    <radialGradient id="bearAqua" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#A7F3D0"/>
      <stop offset="100%" stop-color="#10B981"/>
    </radialGradient>
  </defs>
  <rect width="200" height="200" rx="36" fill="url(#bgGrad6)"/>
  <!-- Charm ring -->
  <circle cx="100" cy="34" r="14" fill="none" stroke="#6EE7B7" stroke-width="4"/>
  <!-- Gummy Bear Ears -->
  <circle cx="76" cy="68" r="14" fill="url(#bearAqua)" stroke="#059669" stroke-width="3"/>
  <circle cx="124" cy="68" r="14" fill="url(#bearAqua)" stroke="#059669" stroke-width="3"/>
  <!-- Gummy Bear Head & Body -->
  <ellipse cx="100" cy="94" rx="28" ry="24" fill="url(#bearAqua)" stroke="#059669" stroke-width="3"/>
  <ellipse cx="100" cy="136" rx="32" ry="32" fill="url(#bearAqua)" stroke="#059669" stroke-width="3"/>
  <!-- Belly glow -->
  <ellipse cx="100" cy="138" rx="18" ry="18" fill="#D1FAE5" opacity="0.6"/>
  <!-- Cute Face -->
  <circle cx="90" cy="90" r="3.5" fill="#064E3B"/>
  <circle cx="110" cy="90" r="3.5" fill="#064E3B"/>
  <ellipse cx="100" cy="98" rx="8" ry="6" fill="#D1FAE5"/>
  <ellipse cx="100" cy="96" rx="4" ry="3" fill="#064E3B"/>
  <!-- Paws -->
  <circle cx="68" cy="130" r="11" fill="url(#bearAqua)" stroke="#059669" stroke-width="2.5"/>
  <circle cx="132" cy="130" r="11" fill="url(#bearAqua)" stroke="#059669" stroke-width="2.5"/>
  <circle cx="80" cy="164" r="12" fill="url(#bearAqua)" stroke="#059669" stroke-width="2.5"/>
  <circle cx="120" cy="164" r="12" fill="url(#bearAqua)" stroke="#059669" stroke-width="2.5"/>
</svg>
`);

// 7. Hoa anh đào · Hồng
const charmHoaAnhDaoHong = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bgGrad7" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFF1F2"/>
      <stop offset="100%" stop-color="#FCE7F3"/>
    </radialGradient>
    <linearGradient id="sakuraPink" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="40%" stop-color="#FBCFE8"/>
      <stop offset="100%" stop-color="#F43F5E"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="36" fill="url(#bgGrad7)"/>
  <circle cx="100" cy="32" r="14" fill="none" stroke="#FB7185" stroke-width="4"/>
  <!-- 5 Petals Sakura -->
  <g transform="translate(100, 108)">
    <!-- 5 petals rotated -->
    <path d="M0,-12 C-22,-35 -30,-65 -8,-74 C-2,-76 0,-70 2,-70 C4,-70 6,-76 12,-74 C34,-65 26,-35 0,-12 Z" fill="url(#sakuraPink)" stroke="#E11D48" stroke-width="2.5"/>
    <g transform="rotate(72)">
      <path d="M0,-12 C-22,-35 -30,-65 -8,-74 C-2,-76 0,-70 2,-70 C4,-70 6,-76 12,-74 C34,-65 26,-35 0,-12 Z" fill="url(#sakuraPink)" stroke="#E11D48" stroke-width="2.5"/>
    </g>
    <g transform="rotate(144)">
      <path d="M0,-12 C-22,-35 -30,-65 -8,-74 C-2,-76 0,-70 2,-70 C4,-70 6,-76 12,-74 C34,-65 26,-35 0,-12 Z" fill="url(#sakuraPink)" stroke="#E11D48" stroke-width="2.5"/>
    </g>
    <g transform="rotate(216)">
      <path d="M0,-12 C-22,-35 -30,-65 -8,-74 C-2,-76 0,-70 2,-70 C4,-70 6,-76 12,-74 C34,-65 26,-35 0,-12 Z" fill="url(#sakuraPink)" stroke="#E11D48" stroke-width="2.5"/>
    </g>
    <g transform="rotate(288)">
      <path d="M0,-12 C-22,-35 -30,-65 -8,-74 C-2,-76 0,-70 2,-70 C4,-70 6,-76 12,-74 C34,-65 26,-35 0,-12 Z" fill="url(#sakuraPink)" stroke="#E11D48" stroke-width="2.5"/>
    </g>
    <!-- Flower core / pistils -->
    <circle cx="0" cy="0" r="14" fill="#FFF1F2" stroke="#BE123C" stroke-width="2"/>
    <circle cx="0" cy="0" r="6" fill="#E11D48"/>
    <circle cx="-5" cy="-5" r="2" fill="#F43F5E"/>
    <circle cx="5" cy="-4" r="2" fill="#F43F5E"/>
    <circle cx="-4" cy="5" r="2" fill="#F43F5E"/>
    <circle cx="4" cy="5" r="2" fill="#F43F5E"/>
  </g>
</svg>
`);

// 8. Hoa anh đào · Xanh
const charmHoaAnhDaoXanh = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bgGrad8" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F0F9FF"/>
      <stop offset="100%" stop-color="#E0F2FE"/>
    </radialGradient>
    <linearGradient id="sakuraBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="40%" stop-color="#BAE6FD"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="36" fill="url(#bgGrad8)"/>
  <circle cx="100" cy="32" r="14" fill="none" stroke="#38BDF8" stroke-width="4"/>
  <!-- 5 Petals Blue Sakura -->
  <g transform="translate(100, 108)">
    <path d="M0,-12 C-22,-35 -30,-65 -8,-74 C-2,-76 0,-70 2,-70 C4,-70 6,-76 12,-74 C34,-65 26,-35 0,-12 Z" fill="url(#sakuraBlue)" stroke="#0369A1" stroke-width="2.5"/>
    <g transform="rotate(72)">
      <path d="M0,-12 C-22,-35 -30,-65 -8,-74 C-2,-76 0,-70 2,-70 C4,-70 6,-76 12,-74 C34,-65 26,-35 0,-12 Z" fill="url(#sakuraBlue)" stroke="#0369A1" stroke-width="2.5"/>
    </g>
    <g transform="rotate(144)">
      <path d="M0,-12 C-22,-35 -30,-65 -8,-74 C-2,-76 0,-70 2,-70 C4,-70 6,-76 12,-74 C34,-65 26,-35 0,-12 Z" fill="url(#sakuraBlue)" stroke="#0369A1" stroke-width="2.5"/>
    </g>
    <g transform="rotate(216)">
      <path d="M0,-12 C-22,-35 -30,-65 -8,-74 C-2,-76 0,-70 2,-70 C4,-70 6,-76 12,-74 C34,-65 26,-35 0,-12 Z" fill="url(#sakuraBlue)" stroke="#0369A1" stroke-width="2.5"/>
    </g>
    <g transform="rotate(288)">
      <path d="M0,-12 C-22,-35 -30,-65 -8,-74 C-2,-76 0,-70 2,-70 C4,-70 6,-76 12,-74 C34,-65 26,-35 0,-12 Z" fill="url(#sakuraBlue)" stroke="#0369A1" stroke-width="2.5"/>
    </g>
    <!-- Flower core -->
    <circle cx="0" cy="0" r="14" fill="#F0F9FF" stroke="#0369A1" stroke-width="2"/>
    <circle cx="0" cy="0" r="6" fill="#0284C7"/>
    <circle cx="-5" cy="-5" r="2" fill="#38BDF8"/>
    <circle cx="5" cy="-4" r="2" fill="#38BDF8"/>
    <circle cx="-4" cy="5" r="2" fill="#38BDF8"/>
    <circle cx="4" cy="5" r="2" fill="#38BDF8"/>
  </g>
</svg>
`);

export const DEFAULT_CHARM_PRESETS: ProductCharmOption[] = [
  {
    id: 'charm-sao-chuong-xanh',
    name: 'Sao chuông · Xanh',
    image: charmSaoChuongXanh,
    priceDelta: 0,
    stock: 20
  },
  {
    id: 'charm-sao-trong-xanh',
    name: 'Sao trong · Xanh',
    image: charmSaoTrongXanh,
    priceDelta: 0,
    stock: 15
  },
  {
    id: 'charm-sao-trong-hong',
    name: 'Sao trong · Hồng',
    image: charmSaoTrongHong,
    priceDelta: 0,
    stock: 12
  },
  {
    id: 'charm-sao-trong-vang',
    name: 'Sao trong · Vàng',
    image: charmSaoTrongVang,
    priceDelta: 0,
    stock: 8
  },
  {
    id: 'charm-sao-trong-tim',
    name: 'Sao trong · Tím',
    image: charmSaoTrongTim,
    priceDelta: 0,
    stock: 10
  },
  {
    id: 'charm-gau-bi-xanh',
    name: 'Gấu bi · Xanh',
    image: charmGauBiXanh,
    priceDelta: 0,
    stock: 14
  },
  {
    id: 'charm-hoa-anh-dao-hong',
    name: 'Hoa anh đào · Hồng',
    image: charmHoaAnhDaoHong,
    priceDelta: 0,
    stock: 18
  },
  {
    id: 'charm-hoa-anh-dao-xanh',
    name: 'Hoa anh đào · Xanh',
    image: charmHoaAnhDaoXanh,
    priceDelta: 0,
    stock: 16
  }
];
