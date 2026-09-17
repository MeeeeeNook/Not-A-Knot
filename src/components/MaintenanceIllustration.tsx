import React from 'react';

interface MaintenanceIllustrationProps {
  className?: string;
}

export const MaintenanceIllustration: React.FC<MaintenanceIllustrationProps> = ({
  className = 'w-full max-w-lg h-auto'
}) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 520 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-sm"
      >
        {/* Decorative Background Plus Signs */}
        <g opacity="0.35" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round">
          <path d="M 70 215 L 82 215 M 76 209 L 76 221" />
          <path d="M 445 125 L 457 125 M 451 119 L 451 131" />
          <path d="M 495 245 L 507 245 M 501 239 L 501 251" />
          <path d="M 270 395 L 282 395 M 276 389 L 276 401" />
        </g>

        {/* Construction Crane in Background */}
        <g opacity="0.45" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {/* Crane Tower */}
          <path d="M 295 120 L 295 40" />
          <path d="M 315 120 L 315 40" />
          <path d="M 295 110 L 315 95 M 295 95 L 315 80 M 295 80 L 315 65 M 295 65 L 315 50" />
          {/* Crane Top Jib & Arm */}
          <path d="M 200 65 L 370 65" strokeWidth="3" />
          <path d="M 305 40 L 200 65" />
          <path d="M 305 40 L 335 65" />
          <path d="M 305 40 L 305 65" />
          <rect x="335" y="60" width="35" height="18" fill="#93C5FD" stroke="none" />
          {/* Cable & Hook */}
          <path d="M 210 65 L 210 110" strokeDasharray="3 3" />
          <circle cx="210" cy="113" r="3" fill="#60A5FA" />
        </g>

        {/* Top-Right Orange Gear */}
        <g transform="translate(425, 95)">
          <circle cx="28" cy="28" r="24" fill="#F97316" />
          {/* Gear teeth */}
          <rect x="24" y="0" width="8" height="6" rx="1.5" fill="#F97316" />
          <rect x="24" y="50" width="8" height="6" rx="1.5" fill="#F97316" />
          <rect x="0" y="24" width="6" height="8" rx="1.5" fill="#F97316" />
          <rect x="50" y="24" width="6" height="8" rx="1.5" fill="#F97316" />
          <circle cx="28" cy="28" r="10" fill="#FFFFFF" />
        </g>

        {/* Bottom-Left Yellow Gear */}
        <g transform="translate(30, 260)">
          <circle cx="28" cy="28" r="22" fill="#EAB308" />
          <rect x="24" y="2" width="8" height="6" rx="1.5" fill="#EAB308" />
          <rect x="24" y="48" width="8" height="6" rx="1.5" fill="#EAB308" />
          <rect x="2" y="24" width="6" height="8" rx="1.5" fill="#EAB308" />
          <rect x="48" y="24" width="6" height="8" rx="1.5" fill="#EAB308" />
          <circle cx="28" cy="28" r="9" fill="#FFFFFF" />
        </g>

        {/* Laptop Shadow */}
        <ellipse cx="260" cy="355" rx="205" ry="14" fill="#0F172A" opacity="0.08" />

        {/* Laptop Screen Body Frame */}
        <rect
          x="108"
          y="120"
          width="344"
          height="195"
          rx="14"
          fill="#1E293B"
          stroke="#0F172A"
          strokeWidth="3"
        />

        {/* Inner Monitor Display */}
        <rect x="118" y="130" width="324" height="175" rx="8" fill="#F0F9FF" />

        {/* Display UI Wireframe Mock Elements */}
        <g opacity="0.7">
          <rect x="130" y="142" width="95" height="150" rx="4" fill="#E2E8F0" />
          <rect x="236" y="142" width="195" height="38" rx="4" fill="#E2E8F0" />
          <rect x="236" y="188" width="195" height="38" rx="4" fill="#E2E8F0" />
          <rect x="236" y="234" width="195" height="58" rx="4" fill="#E2E8F0" />
        </g>

        {/* Yellow & Black Diagonal Caution Barrier Tape Across the Screen */}
        <g transform="translate(100, 185) rotate(-1)">
          {/* Tape Shadow */}
          <rect x="0" y="4" width="360" height="42" rx="4" fill="#0F172A" opacity="0.18" />
          {/* Tape Background */}
          <clipPath id="tapeClip">
            <rect x="0" y="0" width="360" height="40" rx="4" />
          </clipPath>
          <g clipPath="url(#tapeClip)">
            <rect x="0" y="0" width="360" height="40" fill="#FACC15" />
            {/* Repeating diagonal black hazard stripes */}
            {[0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352].map((x) => (
              <polygon
                key={x}
                points={`${x},40 ${x + 18},40 ${x + 36},0 ${x + 18},0`}
                fill="#1E293B"
              />
            ))}
          </g>
          {/* Border line on tape */}
          <rect x="0" y="0" width="360" height="40" rx="4" stroke="#CA8A04" strokeWidth="1.5" fill="none" />
        </g>

        {/* Laptop Base & Keyboard Stand */}
        {/* Base Bottom Deck */}
        <path
          d="M 68 348 L 452 348 C 458 348 463 344 461 338 L 444 286 L 76 286 L 59 338 C 57 344 62 348 68 348 Z"
          fill="#E2E8F0"
          stroke="#CBD5E1"
          strokeWidth="2"
        />
        {/* Keyboard Inset */}
        <path
          d="M 100 292 L 420 292 L 434 322 L 86 322 Z"
          fill="#334155"
        />
        {/* Keyboard Key Grids Mock */}
        <g fill="#475569">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((i) => (
            <rect key={`row1-${i}`} x={108 + i * 21} y="295" width="18" height="6" rx="1.5" />
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => (
            <rect key={`row2-${i}`} x={104 + i * 22.5} y="303" width="19.5" height="7" rx="1.5" />
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <rect key={`row3-${i}`} x={100 + i * 24} y="312" width="21" height="7" rx="1.5" />
          ))}
        </g>
        {/* Trackpad */}
        <rect x="228" y="328" width="64" height="15" rx="3" fill="#CBD5E1" />

        {/* Orange & White Traffic Cone on Keyboard Left */}
        <g transform="translate(116, 245)">
          {/* Cone Base */}
          <polygon points="15,82 85,82 75,88 25,88" fill="#EA580C" />
          {/* Cone Body */}
          <polygon points="50,0 20,82 80,82" fill="#F97316" />
          {/* White Stripes */}
          <polygon points="38,32 62,32 67,46 33,46" fill="#FFFFFF" />
          <polygon points="28,58 72,58 76,70 24,70" fill="#FFFFFF" />
        </g>

        {/* Worker 1: Sitting on top edge of laptop with small laptop */}
        <g transform="translate(68, 65)">
          {/* Hardhat Helmet */}
          <path d="M 44 26 C 44 18 56 18 58 26 Z" fill="#FACC15" />
          <rect x="42" y="25" width="18" height="2" rx="1" fill="#EAB308" />
          {/* Face */}
          <circle cx="50" cy="30" r="5" fill="#FBCFE8" />
          {/* Torso & Orange Shirt */}
          <path d="M 46 35 L 56 35 L 68 62 L 54 62 Z" fill="#EA580C" />
          {/* Legs sitting on laptop top frame */}
          <path d="M 54 62 L 68 62 L 60 76 L 40 85" fill="none" stroke="#1E293B" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          {/* Boots */}
          <rect x="34" y="80" width="10" height="9" rx="2" fill="#0F172A" />
          {/* Mini Laptop */}
          <polygon points="70,55 86,55 82,67 66,67" fill="#64748B" />
          <polygon points="70,55 76,42 88,42 86,55" fill="#94A3B8" />
        </g>

        {/* Worker 2: Standing on bottom right holding megaphone & clipboard */}
        <g transform="translate(425, 250)">
          {/* Hardhat Helmet */}
          <path d="M 45 15 C 45 6 59 6 61 15 Z" fill="#FACC15" />
          <rect x="42" y="14" width="22" height="2.5" rx="1" fill="#EAB308" />
          {/* Head */}
          <circle cx="53" cy="20" r="6" fill="#FDE68A" />
          {/* Body & Orange Uniform */}
          <path d="M 46 26 L 60 26 L 64 68 L 44 68 Z" fill="#EA580C" />
          {/* Legs */}
          <rect x="46" y="68" width="7" height="42" rx="2" fill="#334155" />
          <rect x="56" y="68" width="7" height="42" rx="2" fill="#334155" />
          {/* Shoes */}
          <rect x="40" y="106" width="14" height="6" rx="2" fill="#0F172A" />
          <rect x="56" y="106" width="14" height="6" rx="2" fill="#0F172A" />
          {/* Arm holding Megaphone */}
          <path d="M 46 32 L 28 22" stroke="#EA580C" strokeWidth="6" strokeLinecap="round" />
          {/* Megaphone */}
          <polygon points="26,18 26,26 12,32 10,12" fill="#F97316" />
          <polygon points="12,12 12,32 6,35 6,9" fill="#EA580C" />
          {/* Hand holding clipboard */}
          <rect x="62" y="42" width="12" height="16" rx="1.5" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
};
