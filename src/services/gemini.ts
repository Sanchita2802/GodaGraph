/**
 * Gemini Client Service
 * Calls server-side proxy routes (/api/gemini/*) to keep API keys secure on server.
 * Implements graceful offline fallbacks and error handling.
 */

import { heuristicParseTrip } from './tripHeuristic';

export interface ParsedTripQuery {
  source: string;
  destination: string;
  budget: number | null;
  deadline: string | null;
  preferences: 'fastest' | 'cheapest' | 'balanced' | 'least_walking';
  usedAi: boolean;
}

export interface FareEstimateResult {
  busBaseFare: number;
  busPerStage: number;
  autoMeterBase: number;
  autoMeterPerKm: number;
  sharedAutoBase: number;
  cabBase: number;
  cabPerKm: number;
  cabPerMin: number;
  confidence: number;
  notes: string;
  usedAi: boolean;
}

export interface PlaceStoryResult {
  story: string;
  funFact: string;
  usedAi: boolean;
}

class GeminiService {
  private localFriendCache = new Map<string, string>();
  private placeStoryCache = new Map<string, PlaceStoryResult>();

  /**
   * 8.1 Natural Language Trip Input Parser
   */
  public async parseTripQuery(query: string): Promise<ParsedTripQuery> {
    try {
      const res = await fetch('/api/gemini/parse-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      console.warn('Gemini parse trip failed, using heuristic:', err);
      return heuristicParseTrip(query);
    }
  }

  /**
   * 8.2 Fare Estimator
   */
  public async getFareEstimates(): Promise<FareEstimateResult> {
    try {
      const res = await fetch('/api/gemini/fare-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      console.warn('Gemini fare estimator failed, using standard tariffs:', err);
      return {
        busBaseFare: 10,
        busPerStage: 3,
        autoMeterBase: 26,
        autoMeterPerKm: 15.33,
        sharedAutoBase: 15,
        cabBase: 60,
        cabPerKm: 18,
        cabPerMin: 2,
        confidence: 0.9,
        notes: 'Official Nashik RTO Tariffs (Standard).',
        usedAi: false,
      };
    }
  }

  /**
   * 8.3 "Local Friend" Route Explanation
   */
  public async getLocalFriendExplanation(
    routeSummary: any,
    language: 'en' | 'mr' | 'hi' = 'en'
  ): Promise<string> {
    const key = `${JSON.stringify(routeSummary)}_${language}`;
    if (this.localFriendCache.has(key)) {
      return this.localFriendCache.get(key)!;
    }

    const defaults: Record<string, string> = {
      en: 'Take this route for a smooth ride through Nashik. If crossing Godavari river at Ramkund or CBS during evening peak hours, keep 5 minutes buffer. Keep small change ready for the bus conductor.',
      mr: 'हा मार्ग नाशिकमधील प्रवासासाठी अतिशय सोयीचा आहे. संध्याकाळी सीबीएस किंवा रविवार कारंजा परिसरात गर्दी असते, त्यामुळे ५ मिनिटे जास्त हातात ठेवा. बस प्रवासासाठी सुट्टे पैसे जवळ बाळगा.',
      hi: 'यह रूट नासिक में यात्रा के लिए सबसे सुविधाजनक है। शाम के समय सीबीएस या रामकुंड के पास थोड़ी भीड़ हो सकती है, इसलिए 5 मिनट का बफर रखें। बस में खुले पैसे साथ रखें।',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch('/api/gemini/local-friend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeSummary, language }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const exp = json.data?.explanation || '';
      const usedAi = Boolean(json.data?.usedAi);

      // ONLY cache the explanation when usedAi is true and the text is non-empty. Never cache fallback.
      if (usedAi && exp) {
        this.localFriendCache.set(key, exp);
      }
      return exp || (defaults[language] || defaults.en);
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Gemini local friend failed, using local advice:', err);
      // On timeout/any error return existing default text without caching it
      return defaults[language] || defaults.en;
    }
  }

  /**
   * 8.4 Place Stories for Explore
   */
  public async getPlaceStory(
    placeName: string,
    category: string,
    language: 'en' | 'mr' | 'hi' = 'en'
  ): Promise<PlaceStoryResult> {
    const key = `${placeName}_${language}`;
    if (this.placeStoryCache.has(key)) {
      return this.placeStoryCache.get(key)!;
    }

    try {
      const res = await fetch('/api/gemini/place-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeName, category, language }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      this.placeStoryCache.set(key, json.data);
      return json.data;
    } catch (err) {
      console.warn('Gemini place story failed, using offline story:', err);
      const fallback: PlaceStoryResult = {
        story: `${placeName} is a quintessential Nashik landmark steeped in regional heritage and pilgrimage culture.`,
        funFact: 'Celebrated as an essential stop on the Godavari pilgrimage route.',
        usedAi: false,
      };
      return fallback;
    }
  }

  /**
   * 8.5 Data Helper: Clean raw stop lines
   */
  public async cleanRawStops(rawText: string): Promise<any[]> {
    const res = await fetch('/api/gemini/clean-stops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data;
  }
}

export const geminiService = new GeminiService();
