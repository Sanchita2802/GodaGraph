import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Compass,
  Route,
  FlaskConical,
  Coins,
  Info,
  Sun,
  Moon,
  Globe,
  Sparkles,
  Menu,
  X,
  Gauge,
} from 'lucide-react';
import { ClayButton } from '../clay';

export interface HeaderProps {
  currentLang: 'en' | 'mr' | 'hi';
  onLangChange: (lang: 'en' | 'mr' | 'hi') => void;
  qualityHigh: boolean;
  onQualityToggle: (high: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentLang,
  onLangChange,
  qualityHigh,
  onQualityToggle,
}) => {
  const location = useLocation();
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('godagraph_theme');
      return stored
        ? stored === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('godagraph_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('godagraph_theme', 'light');
      }
    } catch (e) {}
  }, [isDark]);

  const navItems = [
    { path: '/', labelEn: 'Home', labelMr: 'मुख्य', labelHi: 'होम', icon: Sparkles },
    { path: '/plan', labelEn: 'Plan Journey', labelMr: 'मार्ग नियोजन', labelHi: 'यात्रा प्लान', icon: Route },
    { path: '/explore', labelEn: 'Explore Nashik', labelMr: 'नाशिक दर्शन', labelHi: 'नासिक दर्शन', icon: Compass },
    { path: '/lab', labelEn: 'DSA Lab', labelMr: 'डीएसए लॅब', labelHi: 'डीएसए लैब', icon: FlaskConical },
    { path: '/fares', labelEn: 'Fares & Routes', labelMr: 'भाडे व मार्ग', labelHi: 'किराया व रूट', icon: Coins },
    { path: '/about', labelEn: 'About & Viva', labelMr: 'प्रकल्प माहिती', labelHi: 'परियोजना विवरण', icon: Info },
  ];

  const getLabel = (item: (typeof navItems)[0]) => {
    if (currentLang === 'mr') return item.labelMr;
    if (currentLang === 'hi') return item.labelHi;
    return item.labelEn;
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#FFF8F1]/85 dark:bg-[#14121C]/85 border-b border-black/5 dark:border-white/5 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#E0554B] to-[#FF8A7A] flex items-center justify-center text-white shadow-[0_8px_16px_-4px_rgba(224,85,75,0.4),inset_0_2px_4px_rgba(255,255,255,0.6)] group-hover:scale-105 transition-transform">
            <svg
              className="w-6 h-6 stroke-white fill-none"
              viewBox="0 0 24 24"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12c3-4 6-4 9 0s6 4 9 0" />
              <circle cx="12" cy="7" r="2.5" fill="white" />
              <circle cx="6" cy="16" r="2" fill="white" />
              <circle cx="18" cy="16" r="2" fill="white" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-display font-extrabold text-xl tracking-tight text-[#3B2F4A] dark:text-[#F2EEF9] leading-tight">
              Goda<span className="text-[#E0554B] dark:text-[#FF7A6B]">Graph</span>
            </span>
            <span className="text-[10px] font-medium tracking-wider text-[#7E708E] dark:text-[#9E94B3] uppercase">
              Nashik Multimodal DSA
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-black/4 dark:bg-white/4 p-1.5 rounded-full border border-black/5 dark:border-white/5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white dark:bg-[#252033] text-[#E0554B] dark:text-[#FF7A6B] shadow-[0_4px_12px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.8)]'
                    : 'text-[#5E5170] dark:text-[#A79DBA] hover:text-[#3B2F4A] dark:hover:text-[#F2EEF9]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{getLabel(item)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Utility Controls: Language, Theme, Quality */}
        <div className="flex items-center gap-2">
          {/* Quality Mode Toggle (High 3D vs Low Vector) */}
          <button
            onClick={() => onQualityToggle(!qualityHigh)}
            title={qualityHigh ? '3D Cinematic Scene Active' : 'Lite Mode Active'}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold bg-white/70 dark:bg-[#1F1B2B]/70 border border-black/5 dark:border-white/5 text-[#5E5170] dark:text-[#A79DBA] hover:text-[#E0554B] transition-colors"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>{qualityHigh ? '3D High' : 'Lite'}</span>
          </button>

          {/* Language Switcher */}
          <div className="relative inline-flex items-center bg-white/70 dark:bg-[#1F1B2B]/70 border border-black/5 dark:border-white/5 rounded-full p-1 text-xs">
            <Globe className="w-3.5 h-3.5 ml-1.5 mr-1 text-[#7E708E]" />
            {(['en', 'mr', 'hi'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => onLangChange(lang)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase transition-all ${
                  currentLang === lang
                    ? 'bg-[#E0554B] text-white shadow-xs'
                    : 'text-[#7E708E] hover:text-[#3B2F4A] dark:hover:text-[#F2EEF9]'
                }`}
              >
                {lang === 'en' ? 'EN' : lang === 'mr' ? 'मरा' : 'हिं'}
              </button>
            ))}
          </div>

          {/* Dark / Light Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            aria-label="Toggle Dark Mode"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/80 dark:bg-[#1F1B2B]/80 border border-black/5 dark:border-white/5 text-[#3B2F4A] dark:text-[#F2EEF9] shadow-[0_2px_8px_rgba(0,0,0,0.05),inset_0_1px_2px_rgba(255,255,255,0.7)] active:scale-95 transition-all"
          >
            {isDark ? <Sun className="w-4 h-4 text-[#FBBF24]" /> : <Moon className="w-4 h-4 text-[#6366F1]" />}
          </button>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center bg-white/80 dark:bg-[#1F1B2B]/80 border border-black/5 dark:border-white/5 text-[#3B2F4A] dark:text-[#F2EEF9]"
            aria-label="Open Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-black/5 dark:border-white/5 bg-[#FFF8F1]/95 dark:bg-[#14121C]/95 backdrop-blur-md px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-[#E0554B] text-white shadow-sm'
                    : 'text-[#3B2F4A] dark:text-[#F2EEF9] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{getLabel(item)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};
