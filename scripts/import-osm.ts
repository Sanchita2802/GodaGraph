/**
 * OSM & User Survey Data Import Pipeline for GodaGraph
 *
 * Usage:
 *   npx tsx scripts/import-osm.ts
 *
 * Options:
 *   - Fetches live OSM data from Overpass API if reachable.
 *   - Falls back to local data/osm/nashik-raw.json if present.
 *   - Merges extra-stops.csv and extra-routes.csv from data/user/ if present.
 *   - Deduplicates against the 112 core nodes using 30m spatial cells & Levenshtein similarity.
 *   - Outputs src/data/osmStops.generated.json and src/data/osmBusRoutes.generated.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NASHIK_NODES } from '../src/data/nashikNodes.ts';
import { haversineDistanceKm } from '../src/dsa/MultiModalGraph.ts';
import { levenshteinDistance } from '../src/dsa/Trie.ts';
import { TransitNode } from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const NASHIK_BBOX = {
  south: 19.88,
  west: 73.62,
  north: 20.10,
  east: 73.95,
};

export const OVERPASS_QUERY = `[out:json][timeout:180];
(
  nwr["highway"="bus_stop"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
  nwr["public_transport"~"platform|stop_position"]["name"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
  nwr["amenity"="bus_station"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
  nwr["railway"~"station|halt"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
  nwr["amenity"~"place_of_worship|hospital|clinic|college|university|school|marketplace|bank|cinema|fuel|police|post_office|restaurant|cafe"]["name"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
  nwr["tourism"]["name"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
  nwr["historic"]["name"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
  nwr["leisure"~"park|garden|stadium|sports_centre"]["name"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
  nwr["shop"~"mall|supermarket|department_store"]["name"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
  nwr["building"~"temple|mosque|church|hospital|school|college|university|commercial|retail|hotel"]["name"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
  nwr["office"="government"]["name"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
  relation["route"="bus"](${NASHIK_BBOX.south},${NASHIK_BBOX.west},${NASHIK_BBOX.north},${NASHIK_BBOX.east});
);
out center tags;`;

/**
 * Calculates string similarity using Levenshtein distance
 */
export function calculateStringSimilarity(s1: string, s2: string): number {
  const a = s1.trim().toLowerCase();
  const b = s2.trim().toLowerCase();
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return 1.0 - dist / maxLen;
}

/**
 * Checks if a candidate duplicates an existing node:
 * within 30m (0.03km) and name similarity >= 0.8
 */
export function isDuplicateNode(candidate: TransitNode, existingList: TransitNode[]): boolean {
  for (const ex of existingList) {
    const distKm = haversineDistanceKm(candidate.lat, candidate.lng, ex.lat, ex.lng);
    if (distKm <= 0.030) {
      // 30 meters
      const sim = calculateStringSimilarity(candidate.name, ex.name);
      if (sim >= 0.8 || distKm <= 0.010) {
        return true;
      }
    }
  }
  return false;
}

function printOverpassInstructions(): void {
  console.error('\n========================================================================');
  console.error('[import-osm] ERROR: No OSM raw data available and no user survey CSV rows found.');
  console.error('Neither live Overpass API nor data/osm/nashik-raw.json yielded valid elements.');
  console.error('To download real OpenStreetMap data manually:');
  console.error('  1. Open https://overpass-turbo.eu in your browser.');
  console.error('  2. Paste the query below into the query editor:');
  console.error('------------------------------------------------------------------------');
  console.error(OVERPASS_QUERY);
  console.error('------------------------------------------------------------------------');
  console.error('  3. Click "Run", then click "Export" -> "download as raw OSM data".');
  console.error('  4. Save the downloaded file as "data/osm/nashik-raw.json".');
  console.error('  5. Re-run: npx tsx scripts/import-osm.ts');
  console.error('========================================================================\n');
}

async function runImport() {
  console.log('[import-osm] Starting GodaGraph OSM import pipeline...');

  let rawData: any = null;
  const localOsmPath = path.join(ROOT_DIR, 'data', 'osm', 'nashik-raw.json');

  if (fs.existsSync(localOsmPath)) {
    console.log(`[import-osm] Reading local raw OSM data from ${localOsmPath}`);
    try {
      rawData = JSON.parse(fs.readFileSync(localOsmPath, 'utf-8'));
    } catch (err) {
      console.warn('[import-osm] Could not parse local OSM json:', err);
    }
  }

  if (!rawData || !Array.isArray(rawData.elements) || rawData.elements.length === 0) {
    console.log('[import-osm] Attempting live Overpass API query...');
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
      });
      if (response.ok) {
        rawData = await response.json();
        console.log(`[import-osm] Live Overpass returned ${rawData?.elements?.length || 0} elements`);
      } else {
        console.warn(`[import-osm] Overpass API returned HTTP ${response.status}`);
      }
    } catch (err: any) {
      console.warn('[import-osm] Live Overpass API network request failed:', err?.message);
    }
  }

  // Load user CSVs if present
  const userStopsCsvPath = path.join(ROOT_DIR, 'data', 'user', 'extra-stops.csv');
  const userStops: TransitNode[] = [];
  if (fs.existsSync(userStopsCsvPath)) {
    console.log(`[import-osm] Reading user stops from ${userStopsCsvPath}`);
    const lines = fs.readFileSync(userStopsCsvPath, 'utf-8').split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length >= 5) {
        const [name, nameMr, nameHi, lat, lng, type, aliases] = parts.map((p) => p.trim());
        userStops.push({
          id: `user_stop_${i}`,
          name: name || `Survey Stop ${i}`,
          nameMr: nameMr || name,
          nameHi: nameHi || name,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          type: (type as any) || 'bus_stop',
          serves: [],
          popularity: 50,
          aliases: aliases ? aliases.split(';').map((a) => a.trim()) : [],
          source: 'user',
          confidence: 0.9,
          tier: 'B',
          lastVerified: new Date().toISOString().slice(0, 10),
          nameSource: 'seed',
          verified: true,
        });
      }
    }
  }

  const rawElements = (rawData && Array.isArray(rawData.elements)) ? rawData.elements : [];

  // Issue 3.1: If rawData is empty/missing AND there are no user CSV rows, print error and exit 1
  if (rawElements.length === 0 && userStops.length === 0) {
    printOverpassInstructions();
    process.exit(1);
  }

  const existingNodes = [...NASHIK_NODES];
  const extendedNodes: TransitNode[] = [...userStops];

  // First pass: extract all named elements from OSM to use for naming unnamed stops
  const namedOsmElements: { name: string; nameMr?: string; nameHi?: string; lat: number; lng: number }[] = [];
  for (const elem of rawElements) {
    const tags = elem.tags || {};
    const lat = elem.lat || elem.center?.lat;
    const lng = elem.lon || elem.center?.lon;
    const name = tags['name:en'] || tags.name;
    if (lat && lng && name) {
      namedOsmElements.push({
        name,
        nameMr: tags['name:mr'] || name,
        nameHi: tags['name:hi'] || name,
        lat,
        lng,
      });
    }
  }

  // Also include core nodes as reference places
  for (const node of NASHIK_NODES) {
    namedOsmElements.push({
      name: node.name,
      nameMr: node.nameMr,
      nameHi: node.nameHi,
      lat: node.lat,
      lng: node.lng,
    });
  }

  // Second pass: process elements into extended nodes
  for (const elem of rawElements) {
    if (elem.type === 'relation' && elem.tags?.route === 'bus') {
      continue;
    }

    const tags = elem.tags || {};
    const lat = elem.lat || elem.center?.lat;
    const lng = elem.lon || elem.center?.lon;
    if (!lat || !lng) continue;

    let name = tags['name:en'] || tags.name;
    let nameMr = tags['name:mr'] || name || '';
    let nameHi = tags['name:hi'] || name || '';

    const isBusStop = tags.highway === 'bus_stop' || tags.public_transport === 'platform';

    // Issue 3.3: Never emit placeholder names like "Citilinc Bus Stop".
    // For unnamed bus stops use "Bus Stop near <nearest named place>" within 500m, else skip
    if (!name) {
      if (isBusStop) {
        let nearestNamed: { name: string; nameMr?: string; nameHi?: string; distKm: number } | null = null;
        for (const named of namedOsmElements) {
          const d = haversineDistanceKm(lat, lng, named.lat, named.lng);
          if (d <= 0.5) {
            if (!nearestNamed || d < nearestNamed.distKm) {
              nearestNamed = { ...named, distKm: d };
            }
          }
        }
        if (nearestNamed) {
          name = `Bus Stop near ${nearestNamed.name}`;
          nameMr = `बस थांबा (${nearestNamed.nameMr || nearestNamed.name} जवळ)`;
          nameHi = `बस स्टॉप (${nearestNamed.nameHi || nearestNamed.name} के पास)`;
        } else {
          continue; // No named place within 500m, skip stop
        }
      } else {
        continue; // Non-transit unnamed element, skip
      }
    }

    // Determine tier and type
    let tier: 'B' | 'C' | 'D' = 'D';
    let nodeType: 'bus_stop' | 'landmark' | 'railway' | 'junction' = 'landmark';
    let popularity = 20;

    if (isBusStop || tags.amenity === 'bus_station' || tags.railway === 'station') {
      tier = 'B';
      nodeType = tags.railway === 'station' ? 'railway' : 'bus_stop';
      popularity = tags.railway === 'station' ? 70 : 50;
    } else if (
      tags.amenity === 'place_of_worship' ||
      tags.tourism ||
      tags.historic ||
      tags.amenity === 'hospital' ||
      tags.amenity === 'college' ||
      tags.amenity === 'marketplace' ||
      tags.shop === 'mall' ||
      tags.leisure === 'park'
    ) {
      tier = 'C';
      nodeType = 'landmark';
      popularity = 45;
    } else {
      tier = 'D';
      nodeType = 'landmark';
      popularity = 25;
    }

    // Issue 3.4: Real imports must set source 'osm', nameSource 'osm', verified false, confidence 0.7, keep real osmId
    const candidate: TransitNode = {
      id: `osm_${elem.type}_${elem.id}`,
      name,
      nameMr: nameMr || name,
      nameHi: nameHi || name,
      lat,
      lng,
      type: nodeType,
      serves: [],
      popularity,
      source: 'osm',
      osmId: elem.id,
      tier,
      confidence: 0.7,
      verified: false,
      nameSource: 'osm',
    };

    // Check duplicates against core and extended
    if (!isDuplicateNode(candidate, existingNodes) && !isDuplicateNode(candidate, extendedNodes)) {
      extendedNodes.push(candidate);
    }
  }

  // Issue 3.2: If data exists but zero elements pass the filters, exit 1 and write nothing
  if (extendedNodes.length === 0) {
    console.error('[import-osm] ERROR: Elements were provided, but zero nodes passed deduplication and validity filters.');
    process.exit(1);
  }

  // Cap at 3000 nodes, prioritizing B, then C, then D by popularity
  extendedNodes.sort((a, b) => {
    const tierWeight = { B: 3, C: 2, D: 1, A: 4 };
    const twA = tierWeight[a.tier || 'D'];
    const twB = tierWeight[b.tier || 'D'];
    if (twA !== twB) return twB - twA;
    return (b.popularity || 0) - (a.popularity || 0);
  });

  const cappedNodes = extendedNodes.slice(0, 3000);

  const tierCounts = {
    A: existingNodes.length,
    B: cappedNodes.filter((n) => n.tier === 'B').length,
    C: cappedNodes.filter((n) => n.tier === 'C').length,
    D: cappedNodes.filter((n) => n.tier === 'D').length,
  };

  const outputPayload = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'OpenStreetMap',
      attribution: '© OpenStreetMap contributors (ODbL License)',
      bbox: NASHIK_BBOX,
      totalCount: cappedNodes.length,
      tierCounts,
    },
    nodes: cappedNodes,
  };

  const outStopsFile = path.join(ROOT_DIR, 'src', 'data', 'osmStops.generated.json');
  fs.writeFileSync(outStopsFile, JSON.stringify(outputPayload, null, 2) + '\n');
  console.log(`[import-osm] Wrote ${cappedNodes.length} extended nodes to ${outStopsFile}`);
  console.log('[import-osm] Tier counts:', tierCounts);

  // Issue 3.5: Import route=bus relations into osmBusRoutes.generated.json when present
  const importedRoutes: any[] = [];
  for (const elem of rawElements) {
    if (elem.type === 'relation' && elem.tags?.route === 'bus') {
      const tags = elem.tags || {};
      const ref = tags.ref || tags.name || `Route ${elem.id}`;
      const name = tags.name || `Bus ${ref}`;
      const routeId = `osm_bus_${elem.id}`;
      const headwayMinutes = tags.interval ? parseInt(tags.interval, 10) || 20 : 20;
      const headwayAssumed = !tags.interval;

      // Extract stop node ids
      const stops = (elem.members || [])
        .filter((m: any) => m.role === 'stop' || m.role === 'platform' || !m.role)
        .map((m: any) => `osm_node_${m.ref}`);

      importedRoutes.push({
        id: routeId,
        number: String(ref),
        name,
        origin: tags.from || 'Origin',
        destination: tags.to || 'Destination',
        stops,
        headwayMinutes,
        headwayAssumed,
        firstBus: tags.opening_hours || '06:00',
        lastBus: '22:00',
        color: '#E0554B',
      });
    }
  }

  const busRoutesPayload = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'Citilinc & OpenStreetMap',
      attribution: '© OpenStreetMap contributors (ODbL License)',
      routesCount: importedRoutes.length,
    },
    routes: importedRoutes,
  };
  const outRoutesFile = path.join(ROOT_DIR, 'src', 'data', 'osmBusRoutes.generated.json');
  fs.writeFileSync(outRoutesFile, JSON.stringify(busRoutesPayload, null, 2) + '\n');
  console.log(`[import-osm] Wrote ${importedRoutes.length} bus routes to ${outRoutesFile}`);
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runImport().catch((err) => {
    console.error('[import-osm] Unhandled error:', err);
    process.exit(1);
  });
}
