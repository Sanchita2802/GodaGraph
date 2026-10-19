import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, Sparkles, Route, Cpu, ShieldCheck, Flame } from 'lucide-react';
import { ClayButton, ClayCard, ClayInput } from '../components/clay';
import { Nashik3DCanvas } from '../three/Nashik3DCanvas';
import { LayeredForeground } from '../components/parallax/LayeredForeground';
import { NASHIK_NODES } from '../data/nashikNodes';
import { useIsDark } from '../hooks/useIsDark';

export interface HomePageProps {
  currentLang: 'en' | 'mr' | 'hi';
  qualityHigh: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({ currentLang, qualityHigh }) => {
  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [miniSource, setMiniSource] = useState('dwarka_circle');
  const [miniDestination, setMiniDestination] = useState('ramkund');

  const isDarkMode = useIsDark();

  // Track window scroll progress for 3D camera timeline & parallax
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const progress = Math.min(1, Math.max(0, window.scrollY / scrollHeight));
        setScrollProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMiniSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/plan?from=${miniSource}&to=${miniDestination}`);
  };

  const copy = {
    en: {
      heroTag: 'NASHIK MULTIMODAL TRANSIT & DSA ENGINE',
      heroHeadline: 'Every road in Nashik, one clever path.',
      heroSub:
        'A multimodal journey planner named after the sacred Godavari. Balancing city bus headways, seat rickshaws, cabs, and walking with real algorithmic rigor.',
      ctaPlan: 'Plan My Journey',
      ctaLab: 'Explore DSA Lab',
      scene1Title: 'Dawn at Ramkund',
      scene1Desc: 'Floating diyas, marigold petals, and stone steps where ancient Godavari meets modern urban transit.',
      scene2Title: 'The Temple Skyline',
      scene2Desc: 'From Kalaram Mandir and Sita Gufaa to Sula vineyards and Pandavleni caves.',
      scene3Title: 'Streets, Circles & Flyovers',
      scene3Desc: 'Dwarka rotary, Mumbai Naka flyover, College Road student hubs, and CBS Central Bus Stand.',
      scene4Title: 'The Graph Awakens',
      scene4Desc: 'Every stop becomes a glowing node; A* waves expand across the city and the optimal Pareto frontier lights up.',
      tryTitle: 'Quick Journey Search',
      fromLabel: 'From Stop / Landmark',
      toLabel: 'To Destination',
      findRoutes: 'Find Optimal Routes',
    },
    mr: {
      heroTag: 'नाशिक मल्टिमोडल ट्रॅव्हल व अल्गोरिदम इंजिन',
      heroHeadline: 'नाशिकमधील प्रत्येक रस्ता, एक हुशार मार्ग.',
      heroSub:
        'पवित्र गोदावरीच्या नावाने प्रेरित नाशिकचा स्मार्ट प्रवास मार्गदर्शक. सिटी बस, शेअर रिक्षा, कॅब आणि पायी चालणे यांचा योग्य समतोल.',
      ctaPlan: 'प्रवास नियोजन करा',
      ctaLab: 'डीएसए लॅब पहा',
      scene1Title: 'रामकुंडावर प्रभात',
      scene1Desc: 'गोदावरीच्या पात्रात तरंगणारे दिवे, झेंडूची फुले आणि ऐतिहासिक दगडी पायऱ्या.',
      scene2Title: 'मंदिर व टेकड्यांची क्षितिजरेषा',
      scene2Desc: 'काळाराम मंदिर, सीता गुंफा, सुला वाइनयार्ड्स ते पांडवलेणी बौद्ध लेणी.',
      scene3Title: 'रस्ते, चौक व उड्डाणपूल',
      scene3Desc: 'द्वारका चौक, मुंबई नाका उड्डाणपूल, कॉलेज रोड आणि सीबीएस बस स्थानक.',
      scene4Title: 'ग्राफचे प्रकटीकरण',
      scene4Desc: 'प्रत्येक थांबा बनतो प्रकाशमान नोड; A* आणि दिज्कस्त्रा लहरी नाशिकभर पसरतात.',
      tryTitle: 'जलद प्रवास शोध',
      fromLabel: 'प्रस्थान ठिकाण',
      toLabel: 'गंतव्य ठिकाण',
      findRoutes: 'मार्ग शोधा',
    },
    hi: {
      heroTag: 'नासिक मल्टीमोडल यात्रा एवं डीएसए इंजन',
      heroHeadline: 'नासिक का हर रास्ता, एक समझदार सफर।',
      heroSub:
        'पवित्र गोदावरी के नाम पर आधारित यात्रा योजनाकार। सिटी बस, शेयर ऑटो, टैक्सी और पैदल चलने का सटीक गणितीय संतुलन।',
      ctaPlan: 'यात्रा प्लान करें',
      ctaLab: 'डीएसए लैब देखें',
      scene1Title: 'रामकुंड की भोर',
      scene1Desc: 'गोदावरी की लहरों पर तैरते दिए, गेंदे के फूल और प्राचीन घाट।',
      scene2Title: 'मंदिरों और पहाड़ियों का क्षितिज',
      scene2Desc: 'कालाराम मंदिर, सीता गुफा से लेकर सुला वाइनयार्ड्स और पांडवलेनी गुफाएं।',
      scene3Title: 'सड़कें, चौक और फ्लाईओवर',
      scene3Desc: 'द्वारका सर्कल, मुंबई नाका, कॉलेज रोड और सीबीएस बस अड्डा।',
      scene4Title: 'ग्राफ का जागरण',
      scene4Desc: 'हर स्टॉप चमकता हुआ नोड बनता है और A* तरंगें शहर पर फैलती हैं।',
      tryTitle: 'त्वरित यात्रा खोज',
      fromLabel: 'कहाँ से',
      toLabel: 'कहाँ तक',
      findRoutes: 'मार्ग खोजें',
    },
  }[currentLang];

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden">
      {/* 3D Diorama Canvas Background (or vector fallback in Lite mode) */}
      {qualityHigh ? (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <Nashik3DCanvas scrollProgress={scrollProgress} isDark={isDarkMode} />
        </div>
      ) : (
        <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#FFF5EC] via-[#FFEBE0] to-[#FFF8F1] dark:from-[#14121C] dark:via-[#1A1624] dark:to-[#14121C] opacity-70" />
      )}

      {/* Layered Parallax Foreground Elements (Kage Style) */}
      <LayeredForeground scrollProgress={scrollProgress} />

      {/* Scrollable Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* ================= SCENE 1: HERO / DAWN AT RAMKUND ================= */}
        <section className="min-h-[92vh] flex flex-col justify-center pt-16 pb-24">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase bg-[#E0554B]/10 text-[#E0554B] border border-[#E0554B]/20 backdrop-blur-md shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{copy.heroTag}</span>
            </div>

            <h1 className="font-display font-light text-5xl sm:text-7xl lg:text-8xl tracking-tight text-[#3B2F4A] dark:text-[#F2EEF9] leading-[1.05]">
              {copy.heroHeadline}
            </h1>

            <p className="text-base sm:text-xl text-[#6B5E7C] dark:text-[#B6ACCA] leading-relaxed max-w-2xl font-normal">
              {copy.heroSub}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <ClayButton
                variant="primary"
                size="lg"
                icon={<ArrowRight className="w-5 h-5" />}
                onClick={() => navigate('/plan')}
              >
                {copy.ctaPlan}
              </ClayButton>

              <ClayButton
                variant="secondary"
                size="lg"
                icon={<Cpu className="w-5 h-5" />}
                onClick={() => navigate('/lab')}
              >
                {copy.ctaLab}
              </ClayButton>
            </div>
          </div>

          {/* Scene 1 Caption Card */}
          <div className="mt-16 sm:mt-24 max-w-md">
            <ClayCard variant="accent" squishy className="backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-bold text-[#E0554B] uppercase tracking-wider mb-1">
                <Flame className="w-3.5 h-3.5" />
                <span>Scene 01</span>
              </div>
              <h3 className="font-display text-xl font-bold text-[#3B2F4A] dark:text-[#F2EEF9] mb-1">
                {copy.scene1Title}
              </h3>
              <p className="text-xs text-[#7E708E] dark:text-[#B6ACCA] leading-relaxed">
                {copy.scene1Desc}
              </p>
            </ClayCard>
          </div>
        </section>

        {/* ================= SCENE 2: TEMPLE SKYLINE ================= */}
        <section className="min-h-[85vh] flex flex-col justify-center py-24">
          <div className="ml-auto max-w-lg">
            <ClayCard variant="sunlit" squishy className="backdrop-blur-md p-8">
              <div className="flex items-center gap-2 text-xs font-bold text-[#D97706] uppercase tracking-wider mb-2">
                <Compass className="w-4 h-4" />
                <span>Scene 02 • Heritage Diorama</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#3B2F4A] dark:text-[#F2EEF9] mb-3">
                {copy.scene2Title}
              </h2>
              <p className="text-sm text-[#7E708E] dark:text-[#B6ACCA] leading-relaxed mb-6">
                {copy.scene2Desc}
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="px-3 py-1 rounded-full bg-white/70 dark:bg-white/10 text-[#78350F] dark:text-[#FDE68A]">
                  Kalaram Mandir
                </span>
                <span className="px-3 py-1 rounded-full bg-white/70 dark:bg-white/10 text-[#78350F] dark:text-[#FDE68A]">
                  Trimbakeshwar
                </span>
                <span className="px-3 py-1 rounded-full bg-white/70 dark:bg-white/10 text-[#78350F] dark:text-[#FDE68A]">
                  Sula Vineyards
                </span>
                <span className="px-3 py-1 rounded-full bg-white/70 dark:bg-white/10 text-[#78350F] dark:text-[#FDE68A]">
                  Pandavleni Caves
                </span>
              </div>
            </ClayCard>
          </div>
        </section>

        {/* ================= SCENE 3: STREETS & MARKETS ================= */}
        <section className="min-h-[85vh] flex flex-col justify-center py-24">
          <div className="max-w-lg">
            <ClayCard variant="default" squishy className="backdrop-blur-md p-8">
              <div className="flex items-center gap-2 text-xs font-bold text-[#E0554B] uppercase tracking-wider mb-2">
                <Route className="w-4 h-4" />
                <span>Scene 03 • Transit Arteries</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#3B2F4A] dark:text-[#F2EEF9] mb-3">
                {copy.scene3Title}
              </h2>
              <p className="text-sm text-[#7E708E] dark:text-[#B6ACCA] leading-relaxed mb-6">
                {copy.scene3Desc}
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-[#3B2F4A] dark:text-[#F2EEF9]">
                <div className="p-3 rounded-2xl bg-black/4 dark:bg-white/5 border border-black/5 dark:border-white/5">
                  <span className="text-[#E0554B] font-bold block mb-1">Citilinc Buses</span>
                  12 Key Routes • 10-25m Headway
                </div>
                <div className="p-3 rounded-2xl bg-black/4 dark:bg-white/5 border border-black/5 dark:border-white/5">
                  <span className="text-[#F59E0B] font-bold block mb-1">Shared Autos</span>
                  8 Corridors • Fixed ₹15-25 Seats
                </div>
              </div>
            </ClayCard>
          </div>
        </section>

        {/* ================= SCENE 4: THE GRAPH AWAKENS ================= */}
        <section className="min-h-[85vh] flex flex-col justify-center py-24">
          <div className="mx-auto max-w-2xl text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 backdrop-blur-md">
              <Cpu className="w-3.5 h-3.5" />
              <span>Scene 04 • The Algorithmic City</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-light text-[#3B2F4A] dark:text-[#F2EEF9]">
              {copy.scene4Title}
            </h2>
            <p className="text-base text-[#6B5E7C] dark:text-[#B6ACCA] leading-relaxed max-w-xl mx-auto">
              {copy.scene4Desc}
            </p>
            <div className="pt-4">
              <ClayButton
                variant="mint"
                size="md"
                icon={<ArrowRight className="w-4 h-4" />}
                onClick={() => navigate('/lab')}
              >
                Watch Visual Race in DSA Lab
              </ClayButton>
            </div>
          </div>
        </section>

        {/* ================= SCENE 5: TRY IT / MINI PLANNER ================= */}
        <section className="min-h-[75vh] flex flex-col justify-center py-24">
          <div className="max-w-2xl mx-auto w-full">
            <ClayCard variant="accent" className="backdrop-blur-md p-8 sm:p-10 shadow-2xl">
              <div className="flex items-center gap-2 text-xs font-bold text-[#E0554B] uppercase tracking-wider mb-2">
                <Sparkles className="w-4 h-4" />
                <span>Scene 05 • Interactive Departure</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#3B2F4A] dark:text-[#F2EEF9] mb-6">
                {copy.tryTitle}
              </h2>

              <form onSubmit={handleMiniSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#7E708E] dark:text-[#9E94B3] mb-1.5 uppercase">
                      {copy.fromLabel}
                    </label>
                    <select
                      value={miniSource}
                      onChange={(e) => setMiniSource(e.target.value)}
                      className="w-full py-3.5 px-4 rounded-[20px] bg-white dark:bg-[#252033] border border-[#E0554B]/20 text-[#3B2F4A] dark:text-[#F2EEF9] text-sm font-semibold shadow-inner focus:outline-none focus:ring-2 focus:ring-[#E0554B]"
                    >
                      {NASHIK_NODES.slice(0, 45).map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#7E708E] dark:text-[#9E94B3] mb-1.5 uppercase">
                      {copy.toLabel}
                    </label>
                    <select
                      value={miniDestination}
                      onChange={(e) => setMiniDestination(e.target.value)}
                      className="w-full py-3.5 px-4 rounded-[20px] bg-white dark:bg-[#252033] border border-[#E0554B]/20 text-[#3B2F4A] dark:text-[#F2EEF9] text-sm font-semibold shadow-inner focus:outline-none focus:ring-2 focus:ring-[#E0554B]"
                    >
                      {NASHIK_NODES.slice(0, 45).map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <ClayButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    icon={<ArrowRight className="w-5 h-5" />}
                  >
                    {copy.findRoutes}
                  </ClayButton>
                </div>
              </form>
            </ClayCard>
          </div>
        </section>
      </div>
    </div>
  );
};
