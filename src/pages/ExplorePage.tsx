import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Sparkles, Navigation, Clock, Star, Info } from 'lucide-react';
import { ClayCard, ClayButton, ClayChip } from '../components/clay';
import { NASHIK_PLACES } from '../data/placesData';
import { geminiService, PlaceStoryResult } from '../services/gemini';
import { PlaceItem } from '../types';

export interface ExplorePageProps {
  currentLang: 'en' | 'mr' | 'hi';
}

export const ExplorePage: React.FC<ExplorePageProps> = ({ currentLang }) => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [aiStories, setAiStories] = useState<Record<string, PlaceStoryResult>>({});
  const [loadingStories, setLoadingStories] = useState<Record<string, boolean>>({});

  const categories = [
    { id: 'all', labelEn: 'All Circuits', labelMr: 'सर्व ठिकाणे', labelHi: 'सभी स्थल' },
    { id: 'temple', labelEn: 'Temples & Mandirs', labelMr: 'मंदिरे', labelHi: 'मंदिर' },
    { id: 'ghat', labelEn: 'Godavari Ghats', labelMr: 'गोदावरी घाट', labelHi: 'गोदावरी घाट' },
    { id: 'winery', labelEn: 'Wineries & Estates', labelMr: 'वाइनयार्ड्स', labelHi: 'वाइनयार्ड्स' },
    { id: 'heritage', labelEn: 'Historic & Caves', labelMr: 'ऐतिहासिक व लेणी', labelHi: 'ऐतिहासिक गुफाएं' },
    { id: 'nature', labelEn: 'Nature & Falls', labelMr: 'धबधबे व निसर्ग', labelHi: 'झरने व प्रकृति' },
    { id: 'market', labelEn: 'Old Nashik Markets', labelMr: 'बाजारपेठा', labelHi: 'बाजार' },
  ];

  const filteredPlaces =
    selectedCategory === 'all'
      ? NASHIK_PLACES
      : NASHIK_PLACES.filter((p) => p.category === selectedCategory);

  const fetchAiStory = async (place: PlaceItem) => {
    if (aiStories[place.id]) return;

    setLoadingStories((prev) => ({ ...prev, [place.id]: true }));
    try {
      const res = await geminiService.getPlaceStory(place.name, place.category, currentLang);
      setAiStories((prev) => ({ ...prev, [place.id]: res }));
    } finally {
      setLoadingStories((prev) => ({ ...prev, [place.id]: false }));
    }
  };

  const getName = (place: PlaceItem) => {
    if (currentLang === 'mr') return place.nameMr;
    if (currentLang === 'hi') return place.nameHi;
    return place.name;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page Title */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase bg-[#E0554B]/10 text-[#E0554B]">
          <Compass className="w-3.5 h-3.5" />
          <span>Nashik Cultural Circuits</span>
        </div>
        <h1 className="font-display font-light text-4xl sm:text-5xl text-[#3B2F4A] dark:text-[#F2EEF9]">
          Discover Sacred & Modern Nashik
        </h1>
        <p className="text-sm text-[#7E708E] dark:text-[#9E94B3] max-w-2xl">
          Explore iconic Ramayana heritage spots, rolling vineyard landscapes, and Buddhist caves with one-click transit route planning.
        </p>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <ClayChip
            key={cat.id}
            label={
              currentLang === 'mr'
                ? cat.labelMr
                : currentLang === 'hi'
                ? cat.labelHi
                : cat.labelEn
            }
            active={selectedCategory === cat.id}
            onClick={() => setSelectedCategory(cat.id)}
          />
        ))}
      </div>

      {/* Places Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlaces.map((place) => {
          const aiStory = aiStories[place.id];
          const isLoadingStory = loadingStories[place.id];

          return (
            <ClayCard key={place.id} variant="default" squishy className="flex flex-col justify-between p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E0554B]/10 text-[#E0554B]">
                    {place.category}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-amber-500" />
                    <span>{place.rating}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-display font-bold text-xl text-[#3B2F4A] dark:text-[#F2EEF9]">
                    {getName(place)}
                  </h3>
                  <p className="text-xs font-semibold text-[#E0554B] mt-0.5">{place.tagline}</p>
                </div>

                <p className="text-xs text-[#7E708E] dark:text-[#9E94B3] leading-relaxed">
                  {aiStory ? aiStory.story : place.description}
                </p>

                {/* Cultural fun fact */}
                <div className="p-3 rounded-2xl bg-black/4 dark:bg-white/5 text-[11px] text-[#5E5170] dark:text-[#B6ACCA] space-y-1">
                  <div className="font-bold flex items-center gap-1 text-[#E0554B]">
                    <Sparkles className="w-3 h-3" />
                    <span>Local Fun Fact</span>
                  </div>
                  <p>{aiStory ? aiStory.funFact : place.funFact}</p>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-[#7E708E]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{place.timing}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-5 flex items-center gap-2 border-t border-black/5 dark:border-white/5 mt-4">
                <ClayButton
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  icon={<Navigation className="w-3.5 h-3.5" />}
                  onClick={() => navigate(`/plan?to=${place.nodeId}`)}
                >
                  Route Me There
                </ClayButton>

                {!aiStory && (
                  <ClayButton
                    variant="secondary"
                    size="sm"
                    disabled={isLoadingStory}
                    onClick={() => fetchAiStory(place)}
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    {isLoadingStory ? 'Loading...' : 'AI Story'}
                  </ClayButton>
                )}
              </div>
            </ClayCard>
          );
        })}
      </div>
    </div>
  );
};
