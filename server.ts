import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { heuristicParseTrip } from './src/services/tripHeuristic.ts';
import { formatPlaceName, shortenDisplayName } from './src/services/geocode.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(express.json());

// Initialize Gemini SDK if API key exists
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (err) {
    console.warn('Failed to init GoogleGenAI client:', err);
  }
}

const MODEL_CHAIN = [
  process.env.GEMINI_MODEL,
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
].filter(Boolean) as string[];

let cachedWorkingModel: string | null = null;
let hasLoggedModel = false;

async function generateWithFallback(params: {
  contents: string | any[];
  config?: any;
}) {
  if (!aiClient) throw new Error('No Gemini API client initialized');

  const modelsToTry = cachedWorkingModel ? [cachedWorkingModel] : MODEL_CHAIN;

  let lastError: any = null;
  for (const modelId of modelsToTry) {
    try {
      const response = await aiClient.models.generateContent({
        model: modelId,
        contents: params.contents,
        config: params.config,
      });
      if (!cachedWorkingModel) {
        cachedWorkingModel = modelId;
      }
      if (!hasLoggedModel) {
        console.log(`[gemini] using model ${modelId}`);
        hasLoggedModel = true;
      }
      return response;
    } catch (err: any) {
      lastError = err;
      const status =
        err?.status ||
        err?.statusCode ||
        (typeof err?.message === 'string' &&
        (err.message.includes('404') ||
          err.message.includes('NOT_FOUND') ||
          err.message.includes('not found') ||
          err.message.includes('unsupported'))
          ? 404
          : null);
      const isNotFoundOrUnsupported =
        status === 404 ||
        (typeof err?.message === 'string' &&
          (err.message.includes('NOT_FOUND') ||
            err.message.includes('not found') ||
            err.message.includes('is not supported') ||
            err.message.includes('models/')));

      // Move to next model ONLY on NOT_FOUND/404/unsupported-model errors (not on quota or auth errors)
      if (isNotFoundOrUnsupported) {
        continue;
      } else {
        throw err;
      }
    }
  }

  throw lastError || new Error('All models in fallback chain failed');
}

// Health check endpoint for debugging
app.get('/api/gemini/health', async (_req, res) => {
  const hasKey = Boolean(apiKey);
  if (!aiClient) {
    return res.json({ hasKey: false, model: null, ok: false, error: 'GEMINI_API_KEY is not set' });
  }

  try {
    await generateWithFallback({
      contents: 'ping',
    });
    return res.json({
      hasKey: true,
      model: cachedWorkingModel || MODEL_CHAIN[0] || 'gemini-3.8-flash',
      ok: true,
    });
  } catch (err: any) {
    return res.json({
      hasKey: true,
      model: cachedWorkingModel,
      ok: false,
      error: err?.message || String(err),
    });
  }
});

// Config endpoint for client map loader and feature flags
app.get('/api/config', (_req, res) => {
  return res.json({
    mapsKey: process.env.GOOGLE_MAPS_API_KEY || null,
    mapId: process.env.GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
    useRoutes: process.env.ENABLE_GOOGLE_ROUTES === 'true',
    useGoogleGeocoding: process.env.ENABLE_GOOGLE_GEOCODING === 'true',
  });
});

// In-memory LRU cache for reverse geocoding (max 500 entries, TTL 24 hours)
interface GeoCacheEntry {
  data: any;
  timestamp: number;
}
const geoServerCache = new Map<string, GeoCacheEntry>();
const GEO_CACHE_MAX = 500;
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getCachedGeo(key: string): any | null {
  const entry = geoServerCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > GEO_CACHE_TTL_MS) {
    geoServerCache.delete(key);
    return null;
  }
  geoServerCache.delete(key);
  geoServerCache.set(key, entry);
  return entry.data;
}

function setCachedGeo(key: string, data: any): void {
  if (geoServerCache.has(key)) {
    geoServerCache.delete(key);
  } else if (geoServerCache.size >= GEO_CACHE_MAX) {
    const oldestKey = geoServerCache.keys().next().value;
    if (oldestKey) geoServerCache.delete(oldestKey);
  }
  geoServerCache.set(key, { data, timestamp: Date.now() });
}

let lastNominatimRequestTime = 0;
let nominatimQueuePromise: Promise<any> = Promise.resolve();

function scheduleNominatim<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const now = Date.now();
    const elapsed = now - lastNominatimRequestTime;
    if (elapsed < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
    }
    lastNominatimRequestTime = Date.now();
    return fn();
  };
  const result = nominatimQueuePromise.then(run, run);
  nominatimQueuePromise = result.catch(() => {});
  return result;
}

// 1A. Reverse Geocoding Proxy Route
app.get('/api/geo/reverse', async (req, res) => {
  const latStr = req.query.lat as string;
  const lngStr = req.query.lng as string;
  const lang = (req.query.lang as string) || 'en';

  const latNum = parseFloat(latStr);
  const lngNum = parseFloat(lngStr);

  // Validate finite numbers inside lat 19.70-20.30, lng 73.40-74.20
  if (
    !Number.isFinite(latNum) ||
    !Number.isFinite(lngNum) ||
    latNum < 19.70 ||
    latNum > 20.30 ||
    lngNum < 73.40 ||
    lngNum > 74.20
  ) {
    return res.status(400).json({ error: 'Coordinates invalid or outside Nashik region' });
  }

  const lat4 = latNum.toFixed(4);
  const lng4 = lngNum.toFixed(4);
  const cacheKey = `${lat4},${lng4},${lang}`;

  const cached = getCachedGeo(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      data: {
        ...cached,
        cached: true,
      },
    });
  }

  if (process.env.GEOCODER_PROVIDER === 'local') {
    return res.json({ success: false, error: 'local-only' });
  }

  try {
    const result = await scheduleNominatim(async () => {
      const contact = process.env.NOMINATIM_CONTACT_EMAIL || 'no-contact-set';
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat4}&lon=${lng4}&accept-language=${encodeURIComponent(lang)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': `GodaGraph/1.0 (student DSA project; ${contact})`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Nominatim HTTP ${response.status}`);
      }
      return response.json();
    });

    const formattedShort = formatPlaceName(result);
    const shortName = formattedShort || shortenDisplayName(result.display_name || '');
    const data = {
      name: result.name || result.display_name || '',
      shortName: shortName || '',
      address: result.address || {},
      source: 'nominatim',
      cached: false,
    };

    setCachedGeo(cacheKey, data);
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.json({ success: false, error: err?.message || String(err) });
  }
});

// 8.1 Natural Language Trip Parser
app.post('/api/gemini/parse-trip', async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  if (!aiClient) {
    const fallback = heuristicParseTrip(query);
    return res.json({
      success: true,
      data: fallback,
    });
  }

  try {
    const response = await generateWithFallback({
      contents: `You are GodaGraph's NLP intent parser for Nashik transit journeys.
Given this natural language trip request: "${query}"
Extract the source landmark/stop, destination landmark/stop, budget in INR if specified, deadline time if specified (HH:MM 24h format), and primary preference (fastest, cheapest, balanced, or least_walking).
Source and destination should be landmark or stop names in Nashik (e.g. Dwarka, Panchavati, CBS, Nashik Road, College Road, Sula, Pandavleni, etc.).
Return valid JSON.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            source: { type: Type.STRING },
            destination: { type: Type.STRING },
            budget: { type: Type.NUMBER, nullable: true },
            deadline: { type: Type.STRING, nullable: true },
            preferences: { 
              type: Type.STRING, 
              enum: ['fastest', 'cheapest', 'balanced', 'least_walking'] 
            },
          },
          required: ['source', 'destination', 'preferences'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const hasSource = Boolean(parsed.source && String(parsed.source).trim());
    const hasDest = Boolean(parsed.destination && String(parsed.destination).trim());

    if (!hasSource && !hasDest) {
      const fallback = heuristicParseTrip(query);
      return res.json({
        success: true,
        data: {
          ...fallback,
          error: 'Model returned empty stops; applied heuristic fallback.',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        source: parsed.source || '',
        destination: parsed.destination || '',
        budget: parsed.budget ?? null,
        deadline: parsed.deadline ?? null,
        preferences: parsed.preferences || 'balanced',
        usedAi: true,
      },
    });
  } catch (err: any) {
    console.error('[parse-trip]', err?.status, err?.message);
    const fallback = heuristicParseTrip(query);
    return res.json({
      success: true,
      data: {
        ...fallback,
        error: err?.message || 'Gemini parse failed, applied heuristic fallback.',
      },
    });
  }
});

// 8.2 Fare Estimator
app.post('/api/gemini/fare-estimate', async (req, res) => {
  const defaultFares = {
    busBaseFare: 10,
    busPerStage: 3,
    autoMeterBase: 26,
    autoMeterPerKm: 15.33,
    sharedAutoBase: 15,
    cabBase: 60,
    cabPerKm: 18,
    cabPerMin: 2,
    confidence: 0.92,
    notes: 'Standard Nashik RTO notified tariffs (City Bus Citilinc NMC and metered 3-seater autos).',
    usedAi: false,
  };

  if (!aiClient) {
    return res.json({ success: true, data: defaultFares });
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Provide the latest realistic transit tariffs for Nashik, Maharashtra:
- Citilinc NMC City Bus (base fare and incremental stage fare)
- Nashik 3-wheeler Auto Rickshaw (metered base fare for first 1.5km, subsequent per km rate)
- Shared/seat auto typical corridor fare
- App cab (Uber/Ola Hatchback base, per km, per minute)
Include your confidence score between 0.0 and 1.0 and a brief explanatory note.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            busBaseFare: { type: Type.NUMBER },
            busPerStage: { type: Type.NUMBER },
            autoMeterBase: { type: Type.NUMBER },
            autoMeterPerKm: { type: Type.NUMBER },
            sharedAutoBase: { type: Type.NUMBER },
            cabBase: { type: Type.NUMBER },
            cabPerKm: { type: Type.NUMBER },
            cabPerMin: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER },
            notes: { type: Type.STRING },
          },
          required: [
            'busBaseFare',
            'busPerStage',
            'autoMeterBase',
            'autoMeterPerKm',
            'sharedAutoBase',
            'cabBase',
            'cabPerKm',
            'cabPerMin',
            'confidence',
            'notes',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      data: {
        ...parsed,
        usedAi: true,
      },
    });
  } catch (err: any) {
    console.error('Gemini fare estimator error:', err);
    return res.json({ success: true, data: defaultFares });
  }
});

// 8.3 "Local Friend" Route Explanation
app.post('/api/gemini/local-friend', async (req, res) => {
  const { routeSummary, language = 'en' } = req.body;
  const validLang = (language === 'mr' || language === 'hi' || language === 'en') ? language : 'en';

  const defaultTips: Record<string, string> = {
    en: 'Take this route for a smooth ride through Nashik. If crossing Godavari river at Ramkund or CBS during evening peak hours, keep 5 minutes buffer. Keep small change ready for the bus conductor.',
    mr: 'हा मार्ग नाशिकमधील प्रवासासाठी अतिशय सोयीचा आहे. संध्याकाळी सीबीएस किंवा रविवार कारंजा परिसरात गर्दी असते, त्यामुळे ५ मिनिटे जास्त हातात ठेवा. बस प्रवासासाठी सुट्टे पैसे जवळ बाळगा.',
    hi: 'यह रूट नासिक में यात्रा के लिए सबसे सुविधाजनक है। शाम के समय सीबीएस या रामकुंड के पास थोड़ी भीड़ हो सकती है, इसलिए 5 मिनट का बफर रखें। बस में खुले पैसे साथ रखें।',
  };

  if (!aiClient) {
    return res.json({
      success: true,
      data: { explanation: defaultTips[validLang] || defaultTips.en, usedAi: false },
    });
  }

  try {
    const langPrompt =
      validLang === 'mr'
        ? 'Write in warm, authentic Marathi (मराठी).'
        : validLang === 'hi'
        ? 'Write in warm, friendly Hindi (हिंदी).'
        : 'Write in friendly English with authentic local Nashik flavor.';

    const response = await generateWithFallback({
      contents: `You are GodaGraph's "Clever Local Friend" in Nashik, Maharashtra.
The user has selected this transit route:
${JSON.stringify(routeSummary)}

Write EXACTLY 3 friendly sentences:
1. Concise summary of the transfer and journey.
2. A very specific, insider Nashik tip for this specific route (e.g., Godavari view on Ramkund bridge, misal spot near Panchavati, avoid CBS traffic bottlenecks, or auto stands at Dwarka).
3. Practical advice (carrying cash for Citilinc/seat autos, boarding tips).
${langPrompt}
Do not use bullet points or markdown headers. Return plain text only.`,
    });

    const text = response.text?.trim();
    if (!text) {
      return res.json({
        success: true,
        data: {
          explanation: defaultTips[validLang] || defaultTips.en,
          usedAi: false,
          error: 'Empty model response; returned default tip.',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        explanation: text,
        usedAi: true,
      },
    });
  } catch (err: any) {
    console.error('[local-friend]', err?.status, err?.message);
    return res.json({
      success: true,
      data: {
        explanation: defaultTips[validLang] || defaultTips.en,
        usedAi: false,
        error: err?.message || 'Gemini local friend failed; returned default tip.',
      },
    });
  }
});

// 8.4 Place Stories for Explore
app.post('/api/gemini/place-story', async (req, res) => {
  const { placeName, category, language = 'en' } = req.body;

  if (!placeName) {
    return res.status(400).json({ error: 'placeName is required' });
  }

  if (!aiClient) {
    return res.json({
      success: true,
      data: {
        story: `${placeName} is one of Nashik's notable landmarks, revered for its heritage and cultural significance on the banks of sacred Godavari.`,
        funFact: 'Known as the spiritual heartland of Maharashtra, attracting pilgrims and travelers alike.',
        usedAi: false,
      },
    });
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Provide a short, culturally accurate, grounded story (under 60 words) and one fun fact about the Nashik landmark: "${placeName}" (${category}). Language: ${language}.
Output valid JSON.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            story: { type: Type.STRING },
            funFact: { type: Type.STRING },
          },
          required: ['story', 'funFact'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      data: {
        ...parsed,
        usedAi: true,
      },
    });
  } catch (err: any) {
    console.error('Gemini place story error:', err);
    return res.json({
      success: true,
      data: {
        story: `${placeName} is a celebrated site in Nashik with rich heritage and easy transit access.`,
        funFact: 'Part of the historic Godavari circuit.',
        usedAi: false,
      },
    });
  }
});

// 8.5 Data Helper: Clean raw stops
app.post('/api/gemini/clean-stops', async (req, res) => {
  const { rawText } = req.body;
  if (!rawText) return res.status(400).json({ error: 'rawText is required' });

  if (!aiClient) {
    // Basic text cleaner
    const lines = rawText.split('\n').filter((l: string) => l.trim().length > 0);
    const cleaned = lines.map((name: string, idx: number) => ({
      id: `custom_${idx + 1}`,
      name: name.replace(/^\d+[\.\)\-]\s*/, '').trim(),
      nameMr: '',
      nameHi: '',
      lat: 19.9975 + (idx * 0.003 - 0.01),
      lng: 73.7898 + (idx * 0.003 - 0.01),
      type: 'bus_stop',
      serves: ['Custom_Route'],
      popularity: 60,
    }));
    return res.json({ success: true, data: cleaned, usedAi: false });
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Parse and clean this raw text containing transit stops in Nashik into structured JSON:
"${rawText}"
For each stop, provide id, name (clean English), nameMr (Marathi script), nameHi (Hindi script), approximate lat, lng in Nashik (lat ~19.95-20.05, lng ~73.70-73.88), type (bus_stop, landmark, railway, or junction), serves (array of route strings), and popularity (1-100).`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              nameMr: { type: Type.STRING },
              nameHi: { type: Type.STRING },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ['bus_stop', 'landmark', 'railway', 'junction'] },
              serves: { type: Type.ARRAY, items: { type: Type.STRING } },
              popularity: { type: Type.NUMBER },
            },
            required: ['id', 'name', 'lat', 'lng', 'type', 'serves', 'popularity'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    return res.json({ success: true, data: parsed, usedAi: true });
  } catch (err: any) {
    console.error('Gemini clean stops error:', err);
    return res.status(500).json({ error: 'Failed to clean stops' });
  }
});

// Vite middleware integration for full-stack dev / prod
async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GodaGraph server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
});
