# GodaGraph (गोदाग्राफ)
### Nashik Multimodal Journey Planner & Data Structures & Algorithms Engine

> Named after the sacred **Godavari river** that flows through Nashik, GodaGraph is a production-grade, multimodal transit journey planner and comprehensive Data Structures & Algorithms (DSA) showcase.

---

## 1. Project Overview

Navigating transit in a tier-2 Indian metropolis like Nashik involves trade-offs that standard transit apps fail to capture:
- **City Bus (Citilinc NMC):** Highly affordable (₹10–25), but subject to 10–25 minute headways and crowded conditions.
- **Shared Seat Auto Rickshaws:** Frequent (every 3–5 min), fixed corridor pricing (₹15–25), but limited route coverage.
- **Metered Auto / App Cabs (Uber/Ola):** Fastest and sheltered, but significantly more expensive.
- **Pedestrian Walking:** Free, but punitive during hot afternoons (>34°C) or monsoon downpours.

GodaGraph balances these criteria using our custom-engineered **Pravah Routing Algorithm** and provides an interactive visual laboratory for evaluating classical computer science algorithms on real-world transit graphs.

---

## 2. Key Features

- **Cinematic 3D Scroll Landing Page:** Low-poly Godavari river with animated shimmering water, Ramkund ghat steps, floating diyas, marigold petal particle simulations, and layered parallax foreground elements.
- **Live Location Default Source:** Automatic GPS detection on `/plan`, throttled updates (75m movement / 10s interval), auto-follow cancellation upon user choice, 40km Nashik boundary check, and temporary blocked notice without disruptive alerts.
- **Dual Map Engine (Google Maps & Leaflet):** Dynamic switch rendering Google Maps with custom SVG vehicle symbols (bus, shared auto, app auto, cab) when `GOOGLE_MAPS_API_KEY` is configured, falling back seamlessly to Leaflet with Carto tiles. Both engines include ViewportGridIndex culling (400-marker cap) and blue accuracy circle user location dots.
- **Multimodal Route Planning (`/plan`):** Real-time multi-criteria Pareto optimization showing Fastest, Cheapest, Balanced, and Least-Walking options.
- **Pravah Routing Algorithm:** Original 5D Comfort-Aware Pareto Labeling, Poisson headway-uncertainty confidence scoring, and standby "Plan B" auto lifelines.
- **Extended Layer & OSM Pipeline:** Lazily initialized extended graph containing hundreds of Nashik buildings, temples, colleges, hospitals, and local Citilinc bus stops with exact core-to-core regression preservation.
- **Uber / Ola Database (`/fares`):** Rate cards, quick estimator with night surcharge and peak multipliers, screenshot observations recorder, and Ordinary Least Squares (OLS) rate calibration via normal equations and Gaussian elimination.
- **Interactive DSA Lab (`/lab`):** Side-by-side visual race between Dijkstra and A*, Trie prefix visualizer, Indexed Min-Heap inspector, LRU Cache hit meter, Union-Find connectivity checker, and 2D spatial k-d tree partitions.
- **Nashik Discovery (`/explore`):** Heritage circuits with culturally grounded Gemini stories and one-click "Route Me There" shortcuts.
- **Multilingual Support:** English, मराठी (Marathi), and हिंदी (Hindi).

---

## 3. Architecture & Data Structures Implemented

All algorithms and data structures are implemented from scratch in `src/dsa/` without external pathfinding packages:

| Concept | File | Time Complexity | Space Complexity | Real-World Application |
|---|---|---|---|---|
| **Multimodal Directed Graph** | `MultiModalGraph.ts` | $O(\|V\| + \|E\|)$ | $O(\|V\| + \|E\|)$ | Models stops, road edges, extended uniform grid links, and intermodal transfers. |
| **Indexed Binary Min-Heap** | `MinHeap.ts` | $O(\log N)$ decreaseKey | $O(N)$ | Custom priority queue with index map for fast Dijkstra relaxation. |
| **Dijkstra Algorithm** | `dijkstra.ts` | $O((\|V\| + \|E\|) \log \|V\|)$ | $O(\|V\| + \|E\|)$ | Uniform-cost single-source shortest path with trace generation. |
| **Admissible Haversine A\*** | `aStar.ts` | $O((\|V\| + \|E\|) \log \|V\|)$ | $O(\|V\|)$ | Goal-directed search with admissible velocity lower bound. |
| **Time-Dependent Dijkstra** | `timeDependentDijkstra.ts` | $O((\|V\| + \|E\|) \log \|V\|)$ | $O(\|V\| + \|E\|)$ | Schedule-aware routing preserving FIFO property under traffic. |
| **Multi-Criteria Pareto Labeling** | `paretoLabeling.ts` | $O(\|E\| \cdot \|P_{\max}\|^2)$ | $O(\|V\| \cdot \|P_{\max}\|)$ | Pruning dominated states across time, money, walk, transfers. |
| **Yen's K-Shortest Loopless Paths** | `yensKShortestPaths.ts` | $O(K \cdot \|V\| \cdot (\|E\| + \|V\| \log \|V\|))$ | $O(K \cdot \|V\|)$ | Computes $K=5$ alternate loopless paths via spur node deviations. |
| **Multilingual Trie** | `Trie.ts` | $O(L)$ prefix lookup | $O(\Sigma \cdot L \cdot \|V\|)$ | Prefix tree with precomputed top completions & Levenshtein DP. |
| **LRU Cache** | `LruCache.ts` | $O(1)$ get & put | $O(\text{Capacity})$ | Doubly linked list + Map for instantaneous route recall with prefix invalidation. |
| **Union-Find (Disjoint Set)** | `UnionFind.ts` | $O(\alpha(N))$ amortized | $O(N)$ | Validates full graph connectivity and detects isolated stops. |
| **2D Spatial k-d Tree** | `KdTree.ts` | $O(\log N)$ NN search | $O(N)$ | Binary spatial partitioning for nearest-stop GPS lookups. |
| **Spatial Viewport Grid Index** | `ViewportGridIndex.ts` | $O(K)$ bounded range | $O(\|V\|)$ | Zoom-tier culling (hubs $\le 13$, bus stops $14-15$, all $\ge 16$) with 400-marker cap. |
| **OLS Fare Calibration** | `FareCalibration.ts` | $O(N + D^3)$ | $O(D^2)$ | Fits rate parameters via normal equations $(X^TX)\beta = X^TY$ using Gaussian elimination. |
| **Top-K Bounded Heap** | `TopKHeap.ts` | $O(N \log K)$ | $O(K)$ | Bounded priority queue for user-weighted route ranking. |
| **0/1 Knapsack Budget DP** | `DynamicProgramming.ts` | $O(N \cdot B)$ | $O(N \cdot B)$ | Maximizes reachable landmark popularity within wallet ₹X. |
| **Pravah Routing Algorithm** | `PravahRouter.ts` | $O(\|E\| \cdot \|P_{\max}\|^2)$ | $O(\|V\| \cdot \|P_{\max}\|)$ | Comfort Pareto + Poisson confidence + standby Plan B auto lifelines. |

---

## 4. Google Maps Platform Setup & API Keys

GodaGraph supports dual mapping: **Leaflet (Carto/OSM)** is active out-of-the-box with zero keys required. To enable the **Google Maps Platform** with live vehicle rotation and dark mode integration:

1. **Create an API Key:**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - Create or select your Google Cloud project.
   - Enable the **Maps JavaScript API**.
   - (Optional) Enable the **Routes API** if you wish to compute real road polylines (`ENABLE_GOOGLE_ROUTES="true"`).

2. **Enable Billing & Restrict Key:**
   - Link a valid billing account to your Google Cloud project.
   - In **Credentials**, edit your Maps API key.
   - Under **Application restrictions**, select **Websites** (HTTP referrers) and restrict to your AI Studio domain and `http://localhost:3000/*`.
   - Under **API restrictions**, select **Maps JavaScript API** (and optionally **Routes API**).

3. **Configure Environment Variables:**
   - In AI Studio, open the **Secrets** panel or configure your local `.env`:
   ```env
   GOOGLE_MAPS_API_KEY="AIzaSy..."
   GOOGLE_MAPS_MAP_ID="DEMO_MAP_ID"
   ENABLE_GOOGLE_ROUTES="false"
   ```

> **License Compliance Notice:** In accordance with Google Maps Platform Terms of Service, Google Maps tiles and APIs must **never** be loaded inside Leaflet or combined with non-Google mapping SDKs. GodaGraph cleanly partitions the two engines: `GoogleLiveMap` uses official Google Maps JavaScript API SDK only, while `LeafletLiveMap` uses Carto/OpenStreetMap tiles only.

---

## 5. Data Sources, Provenance & Accuracy

All spatial coordinates and transit networks in GodaGraph are structured in multi-tier provenance layers:

| Layer / Tier | Description | Typical Popularity | Source | Count |
|---|---|---|---|---|
| **Tier A (Core)** | Core transit hubs, junctions, railway station & major spiritual anchors (CBS, Ramkund, Shalimar, Dwarka) | 80–100 | Hand-surveyed seed (`nashikNodes.ts`) | 112 |
| **Tier B (Extended)** | Citilinc bus stops, bus shelters & suburban halts | 40–70 | Seed placeholders / OSM (`extra-stops.csv`) | 25 |
| **Tier C (Extended)** | Temples, ghats, hospitals, colleges, schools, markets, malls, heritage sites | 20–60 | Seed placeholders / OSM (`amenity`, `tourism`) | 29 |
| **Tier D (Extended)** | Local buildings, misal eateries, banks, cafes, residential areas, and live GPS node | 5–25 | Seed placeholders / OSM & GPS fix | 15 |

> **Data Honesty & Provenance Notice:**
> The 69 extended stops currently in `src/data/osmStops.generated.json` are unverified placeholder stops (`source: 'seed'`, `verified: false`, confidence $0.30$) and were **not** fetched directly from OpenStreetMap. Real OpenStreetMap data appears only after running `scripts/import-osm.ts` with live Overpass API access or a local `data/osm/nashik-raw.json` file.
>
> **Overpass Turbo Export Steps:**
> 1. Open [https://overpass-turbo.eu](https://overpass-turbo.eu).
> 2. Paste the `OVERPASS_QUERY` query constant from `scripts/import-osm.ts`.
> 3. Click **Run**, then select **Export** -> download as raw OSM data.
> 4. Save the downloaded file as `data/osm/nashik-raw.json`.
> 5. Run `npx tsx scripts/import-osm.ts` to generate real OSM stops and bus routes.

### OpenStreetMap Attribution
When real OpenStreetMap data is ingested, spatial data is licensed under the [Open Data Commons Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/) by the OpenStreetMap Foundation (OSMF):  
`© OpenStreetMap contributors`

### Data Pipeline & Verification Workflow
- Run `npx tsx scripts/import-osm.ts` to ingest live Overpass elements or read local `data/osm/nashik-raw.json`. If neither is available and no user survey CSV rows exist, the script exits safely with code 1 without overwriting data files.
- The pipeline deduplicates against core nodes using 30-meter spatial cells and Levenshtein string similarity ($\ge 0.8$). Core nodes always take precedence.
- User surveyed stops can be supplied via `data/user/extra-stops.csv` (source `user`, confidence $0.9$).
- Confidence scores range from $0.3$ (unverified placeholder seed), $0.7$ (real OSM unverified), to $0.9$ (survey-verified).

### Privacy & Geocoding Architecture
- When live GPS is enabled, coordinates are rounded to 4 decimal places (~11 meters resolution) before querying reverse geocoding services.
- Rounded coordinates are queried through a server proxy (`/api/geo/reverse`) against OpenStreetMap Nominatim with an in-memory 24-hour LRU cache (500 items) and strict 1 request/second throttling.
- Coordinates are never logged to browser consoles or server logs, and no user location history is stored on any database or server disk.
- An optional Google Maps Geocoder option (`ENABLE_GOOGLE_GEOCODING="true"`) is available and turned off by default.

---

## 6. Setup & Running Locally

### Environment Variables
Configure `.env` or use AI Studio user secrets:
```env
# Required for Gemini AI intent parsing and local friend tips
GEMINI_API_KEY="your_api_key_here"

# Host URL
APP_URL="http://localhost:3000"

# Optional Google Maps configuration
GOOGLE_MAPS_API_KEY=""
GOOGLE_MAPS_MAP_ID="DEMO_MAP_ID"
ENABLE_GOOGLE_ROUTES="false"

# Optional Reverse Geocoding configuration
NOMINATIM_CONTACT_EMAIL=""
GEOCODER_PROVIDER="auto"       # auto | nominatim | local
ENABLE_GOOGLE_GEOCODING="false"
```

### Installation & Execution
```bash
# Install dependencies
npm install

# Run full-stack dev server (Express + Vite) on port 3000
npm run dev

# Run Vitest test suite
npm test

# Run TypeScript linter
npm run lint

# Build for production
npm run build
```

---

## 7. Deploying to Vercel

GodaGraph is configured for seamless deployment to Vercel as a hybrid application: the React frontend builds statically via Vite, while the Express backend runs as a Vercel Serverless Function via `api/index.ts` and `vercel.json`.

### Environment Variables on Vercel
Set the following variables in the **Vercel Project Settings → Environment Variables** (for **Production**, **Preview**, and **Development**):

| Variable | Required? | Type | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | **Recommended** | Server-only | Required for AI NLP queries, Local Friend tips, and fare fits |
| `GEMINI_MODEL` | Optional | Server-only | Override default Gemini model (defaults to `gemini-2.5-flash`) |
| `GOOGLE_MAPS_API_KEY` | Optional | Server-only | Google Maps JavaScript API key; if omitted, Leaflet OSM runs automatically |
| `GOOGLE_MAPS_MAP_ID` | Optional | Server-only | Google Maps vector Map ID (defaults to `DEMO_MAP_ID`) |
| `ENABLE_GOOGLE_ROUTES` | Optional | Server-only | Set to `"true"` to enable real road geometry via Google Routes |
| `ENABLE_GOOGLE_GEOCODING` | Optional | Server-only | Set to `"true"` to enable Google client geocoder fallback |
| `NOMINATIM_CONTACT_EMAIL` | Optional | Server-only | Contact email for OpenStreetMap Nominatim User-Agent |
| `GEOCODER_PROVIDER` | Optional | Server-only | `auto` (default) \| `nominatim` \| `local` |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional | Public/Client | Direct build-time fallback if `/api/config` is unavailable |

> **IMPORTANT**: After adding or modifying environment variables in the Vercel dashboard, you **must trigger a new deployment** (select **Redeploy** with **Clear build cache** unchecked or checked) for the changes to take effect in serverless functions.

### Restricting Your Google Maps API Key
Browser API keys are inherently visible in client network traffic. Always protect your key in the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials):
1. **Application restrictions**: Select **Websites (HTTP referrers)** and add:
   - `https://<your-project>.vercel.app/*`
   - `https://*.vercel.app/*`
   - `https://your-custom-domain.com/*` (if using a custom domain)
   - `http://localhost:*` (for local development)
2. **API restrictions**: Select **Restrict key** and enable **ONLY**:
   - `Maps JavaScript API`

### Architecture & Routing on Vercel
- **Serverless API**: `vercel.json` routes `/api/(.*)` requests directly to `api/index.ts`, which runs the Express application with all Gemini endpoints, configuration handlers, and reverse geocoding proxies.
- **SPA Deep Linking**: A catch-all rewrite sends all non-API paths (`/((?!api/).*)`) to `/index.html`, allowing React Router routes (`/plan`, `/explore`, `/fares`, `/lab`, `/about`) to refresh cleanly without 404s.
- **In-Memory Caches**: Note that `geoServerCache` and Gemini model health state persist per warm serverless container instance.

### Troubleshooting

| Issue | Root Cause | Solution |
|---|---|---|
| **Watermark "API KEY REQUIRED"** | Legacy CARTO tiles required paid credentials | Resolved: Basemap now uses keyless OpenStreetMap, Esri World Street Map, and OpenTopoMap with automated failover. |
| **Flat Grey Map** | Google Maps key missing, invalid, or referrer-restricted | Check browser console. If `gm_authFailure` triggers, GodaGraph automatically falls back to keyless Leaflet. For Google Maps, verify HTTP referrer settings in Google Cloud Console. |
| **`/api/config` returns HTML (DOCTYPE)** | Express server didn't run on Vercel; SPA catch-all caught `/api` | Ensure `vercel.json` is deployed in the repo root. Verify that `/api/(.*)` rewrite targets `/api`. |
| **404 on page refresh on `/plan` or `/explore`** | Static hosting lacking SPA rewrite rules | Handled by `vercel.json` catch-all rule `{ "source": "/((?!api/).*)", "destination": "/index.html" }`. |
| **Gemini features return fallback results** | `GEMINI_API_KEY` not configured in Vercel dashboard | Add `GEMINI_API_KEY` in Vercel Project Settings → Environment Variables and trigger a **Redeploy**. |
| **Debug Mode Inspection** | Need to verify active map renderer and tile status | Append `?debugmap=1` to any URL (e.g. `/plan?debugmap=1`) to view a live diagnostic overlay showing renderer, config status, active tile provider, and error counts. |

---

## 8. Academic Disclaimer

Transit stop coordinates, bus timetables, and fares represent student-collected seed data for educational and research evaluation. GodaGraph has no affiliation with NMC Citilinc, MSRTC, Uber, or Ola. All vehicle symbols and brand mentions are strictly for informational academic study.
