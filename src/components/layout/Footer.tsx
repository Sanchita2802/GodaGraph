import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Sparkles, ShieldAlert, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="relative w-full border-t border-black/5 dark:border-white/5 bg-[#FFF2E6]/60 dark:bg-[#120F19]/80 backdrop-blur-md pt-12 pb-8 overflow-hidden transition-colors">
      {/* Decorative Godavari Wave Canvas / SVG */}
      <div className="absolute inset-x-0 top-0 h-4 pointer-events-none opacity-40">
        <svg
          viewBox="0 0 1200 24"
          preserveAspectRatio="none"
          className="w-full h-full fill-none stroke-[#E0554B]/30"
          strokeWidth="1.5"
        >
          <path d="M0,12 C150,0 350,24 600,12 C850,0 1050,24 1200,12" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#E0554B] flex items-center justify-center text-white font-bold text-sm shadow-xs">
                G
              </div>
              <span className="font-display font-bold text-xl text-[#3B2F4A] dark:text-[#F2EEF9]">
                GodaGraph <span className="text-xs font-normal text-[#E0554B] ml-1">नाशिक</span>
              </span>
            </div>
            <p className="text-xs text-[#7E708E] dark:text-[#9E94B3] leading-relaxed max-w-md">
              A multimodal transit journey planner and Data Structures & Algorithms showcase named after the sacred Godavari river. Weighing time, fare, walking effort, and comfort across Nashik’s 125+ stops.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-[#E0554B]/10 text-[#E0554B] border border-[#E0554B]/20">
              <Cpu className="w-3.5 h-3.5" />
              <span>DSA Mini Project • 13 Real Algorithms Implemented</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#3B2F4A] dark:text-[#F2EEF9]">
              Navigation
            </h4>
            <ul className="space-y-1.5 text-xs text-[#7E708E] dark:text-[#9E94B3]">
              <li>
                <Link to="/plan" className="hover:text-[#E0554B] transition-colors">
                  Journey Planner (/plan)
                </Link>
              </li>
              <li>
                <Link to="/explore" className="hover:text-[#E0554B] transition-colors">
                  Nashik Discovery (/explore)
                </Link>
              </li>
              <li>
                <Link to="/lab" className="hover:text-[#E0554B] transition-colors">
                  DSA Interactive Lab (/lab)
                </Link>
              </li>
              <li>
                <Link to="/fares" className="hover:text-[#E0554B] transition-colors">
                  Tariff & Timetable Data (/fares)
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#E0554B] transition-colors">
                  About & Viva Q&A (/about)
                </Link>
              </li>
            </ul>
          </div>

          {/* Core Algorithms */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#3B2F4A] dark:text-[#F2EEF9]">
              DSA Concepts
            </h4>
            <ul className="space-y-1.5 text-xs text-[#7E708E] dark:text-[#9E94B3]">
              <li>Pravah Comfort Pareto Routing</li>
              <li>Indexed Min-Heap & Dijkstra</li>
              <li>Admissible Haversine A*</li>
              <li>Multilingual Trie with DP Fuzzy</li>
              <li>2D Spatial k-d Tree for GPS</li>
              <li>LRU Cache & Union-Find</li>
            </ul>
          </div>
        </div>

        {/* Academic / Data Disclaimer */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs mb-8 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Academic Disclaimer:</strong> Transit stop coordinates, bus timetables, and tariffs represent approximate student-curated seed data for educational and research evaluation. GodaGraph has no official affiliation with NMC Citilinc, MSRTC, or app-based taxi aggregators. Always verify schedules locally.
          </p>
        </div>

        {/* Copyright and Kumbh Tribute */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-black/5 dark:border-white/5 text-[11px] text-[#7E708E] dark:text-[#9E94B3]">
          <div>
            Built with <Heart className="w-3.5 h-3.5 inline text-[#E0554B]" /> for Nashik Kumbh Nagari & Data Structures & Algorithms.
          </div>
          <div>© {new Date().getFullYear()} GodaGraph. Open Source Academic Project.</div>
        </div>
      </div>
    </footer>
  );
};
