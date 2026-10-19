import React from 'react';

export interface LayeredForegroundProps {
  scrollProgress: number; // 0 to 1
}

export const LayeredForeground: React.FC<LayeredForegroundProps> = ({ scrollProgress }) => {
  // Different parallax motion factors
  const yFast = scrollProgress * -180;
  const yMedium = scrollProgress * -90;
  const ySlow = scrollProgress * -40;
  const rotBells = Math.sin(scrollProgress * Math.PI * 4) * 12;

  return (
    <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden">
      {/* 1. Panchavati Banyan Leaves Canopy (Top Left & Top Right) */}
      <div
        className="absolute -top-12 -left-12 w-64 h-64 opacity-75 dark:opacity-60 transition-transform duration-75"
        style={{ transform: `translate3d(0, ${ySlow}px, 0)` }}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full fill-[#2D6A4F] dark:fill-[#1B4332]">
          <path d="M0,0 Q60,20 80,80 Q40,110 0,60 Z" opacity="0.9" />
          <path d="M40,0 Q120,40 140,120 Q90,140 20,80 Z" opacity="0.8" />
          <path d="M10,40 Q90,90 110,170 Q50,170 10,100 Z" opacity="0.85" />
        </svg>
      </div>

      {/* 2. Marigold Garland (Parallax Right Swag) */}
      <div
        className="absolute top-10 right-0 w-36 h-96 opacity-85 transition-transform duration-75"
        style={{ transform: `translate3d(0, ${yMedium}px, 0)` }}
      >
        <svg viewBox="0 0 100 300" className="w-full h-full">
          {[0, 35, 70, 105, 140, 175, 210, 245].map((y, idx) => (
            <g key={idx} transform={`translate(${50 + Math.sin(idx) * 15}, ${y})`}>
              <circle r="14" fill="#FF8800" />
              <circle r="10" fill="#FFAA00" />
              <circle r="6" fill="#FFCC00" />
              <circle r="2" fill="#78350F" />
            </g>
          ))}
          <path
            d="M50,0 Q35,100 60,200 Q40,250 50,300"
            stroke="#15803D"
            strokeWidth="3"
            fill="none"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* 3. Temple Brass Bells (Hanging with Gentle Sway) */}
      <div
        className="absolute top-0 left-1/4 w-18 h-36 transition-transform duration-75"
        style={{
          transform: `translate3d(0, ${ySlow * 0.8}px, 0) rotate(${rotBells}deg)`,
          transformOrigin: 'top center',
        }}
      >
        <svg viewBox="0 0 60 120" className="w-full h-full drop-shadow-md">
          {/* Bell chain */}
          <line x1="30" y1="0" x2="30" y2="40" stroke="#B45309" strokeWidth="2" strokeDasharray="3,3" />
          {/* Brass Bell Body */}
          <path
            d="M20,40 C20,25 40,25 40,40 L45,65 C48,72 54,75 54,80 L6,80 C6,75 12,72 15,65 Z"
            fill="url(#brassGrad)"
          />
          {/* Bell clapper */}
          <circle cx="30" cy="85" r="4" fill="#78350F" />
          <defs>
            <linearGradient id="brassGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="50%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#CA8A04" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* 4. Clay Diya with Flickering Glow (Bottom Left) */}
      <div
        className="absolute bottom-12 left-8 w-24 h-24 opacity-90 transition-transform duration-75"
        style={{ transform: `translate3d(0, ${yFast}px, 0)` }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_8px_16px_rgba(255,100,0,0.4)]">
          {/* Diya Base */}
          <path d="M15,55 Q50,85 85,55 Q50,65 15,55 Z" fill="#9A3412" />
          <ellipse cx="50" cy="55" rx="35" ry="10" fill="#C2410C" />
          {/* Oil puddle */}
          <ellipse cx="50" cy="55" rx="28" ry="6" fill="#7C2D12" />
          {/* Floating Wick Flame */}
          <path
            d="M72,52 Q74,38 72,28 Q78,38 75,52 Z"
            fill="#FACC15"
            className="animate-pulse"
          />
          <circle cx="73" cy="38" r="3" fill="#FFFFFF" />
        </svg>
      </div>

      {/* 5. Nashik Wada Wooden Doorway Carving Silhouette (Bottom Right) */}
      <div
        className="absolute -bottom-16 -right-8 w-48 h-72 opacity-40 dark:opacity-25 transition-transform duration-75"
        style={{ transform: `translate3d(0, ${yFast * 0.7}px, 0)` }}
      >
        <svg viewBox="0 0 150 250" className="w-full h-full fill-[#451A03]">
          <rect x="10" y="10" width="130" height="230" rx="16" fill="none" stroke="#78350F" strokeWidth="6" />
          <path d="M25,25 Q75,60 125,25 L125,225 L25,225 Z" opacity="0.3" />
          <circle cx="75" cy="125" r="10" fill="#B45309" />
        </svg>
      </div>
    </div>
  );
};
