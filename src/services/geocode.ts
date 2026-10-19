/**
 * Reverse Geocoding and Place Name Resolution Services
 * Pure functions importable by both Node.js (server) and browser (client).
 */

import { haversineDistanceKm } from '../dsa/MultiModalGraph.ts';

export interface NominatimAddress {
  amenity?: string;
  tourism?: string;
  shop?: string;
  building?: string;
  leisure?: string;
  historic?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  quarter?: string;
  village?: string;
  city?: string;
  town?: string;
  house_number?: string;
  postcode?: string;
  state?: string;
  country?: string;
  [key: string]: any;
}

export interface NominatimResult {
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
  [key: string]: any;
}

/**
 * Strips house numbers, 6-digit postcodes, state/country suffix, and noise
 */
function cleanSegment(str: string): string {
  if (!str) return '';
  return str
    .replace(/\b\d{6}\b/g, '') // Indian 6-digit PIN code
    .replace(/^#?\d+[\w/-]*,?\s*/, '') // Leading house number like "12/A, "
    .replace(/,\s*(?:Maharashtra|India)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Assembles primary, area, and city into a compact place name up to maxLen chars,
 * without cutting words.
 */
export function assembleAndTrimParts(
  primary: string,
  area: string,
  city: string = 'Nashik',
  maxLen: number = 48
): string {
  const norm = (s: string) => s.toLowerCase().trim();

  const cleanP = cleanSegment(primary);
  const cleanA = cleanSegment(area);
  const cleanC = cleanSegment(city);

  const hasP = Boolean(cleanP);
  const hasA = Boolean(cleanA);
  const hasC = Boolean(cleanC);

  const pEqualsA = hasP && hasA && norm(cleanP) === norm(cleanA);
  const pEqualsC = hasP && hasC && norm(cleanP) === norm(cleanC);
  const aEqualsC = hasA && hasC && norm(cleanA) === norm(cleanC);

  let candidate = '';

  // Prefer "<primary>, <area>", then "<primary>, <city>", then "<area>, <city>"
  if (hasP && hasA && !pEqualsA) {
    candidate = `${cleanP}, ${cleanA}`;
  } else if (hasP && hasC && !pEqualsC) {
    candidate = `${cleanP}, ${cleanC}`;
  } else if (hasA && hasC && !aEqualsC) {
    candidate = `${cleanA}, ${cleanC}`;
  } else if (hasP) {
    candidate = cleanP;
  } else if (hasA) {
    candidate = cleanA;
  } else if (hasC) {
    candidate = cleanC;
  } else {
    return '';
  }

  // Remove duplicate parts like "Panchavati, Panchavati" or repeated tokens
  const parts = candidate.split(',').map((p) => p.trim());
  const deduped: string[] = [];
  for (const part of parts) {
    if (!deduped.some((d) => d.toLowerCase() === part.toLowerCase())) {
      deduped.push(part);
    }
  }
  candidate = deduped.join(', ');

  if (candidate.length <= maxLen) {
    return candidate;
  }

  // Trim to maxLen without cutting a word
  const truncated = candidate.slice(0, maxLen);
  const lastBreak = Math.max(truncated.lastIndexOf(' '), truncated.lastIndexOf(','));
  if (lastBreak > 0) {
    return truncated.slice(0, lastBreak).replace(/[, -]+$/, '').trim();
  }

  // If a single word exceeds maxLen, return empty as specified
  return '';
}

/**
 * 1B. formatPlaceName(nominatimJson, maxLen = 48):
 * primary = first of result.name, address.amenity, tourism, shop, building, leisure, historic, road;
 * area = first of neighbourhood, suburb, city_district, quarter, village;
 * city = address.city or town (default "Nashik").
 * Prefer "<primary>, <area>", then "<primary>, <city>", then "<area>, <city>".
 * Remove duplicates, house numbers, postcodes, state and country.
 * Trim to maxLen without cutting a word. Return "" if nothing usable.
 */
export function formatPlaceName(nominatimJson: any, maxLen: number = 48): string {
  if (!nominatimJson || typeof nominatimJson !== 'object') {
    return '';
  }

  const address: NominatimAddress = nominatimJson.address || {};

  // primary = first of result.name, address.amenity, tourism, shop, building, leisure, historic, road
  const primaryCandidates = [
    nominatimJson.name,
    address.amenity,
    address.tourism,
    address.shop,
    address.building,
    address.leisure,
    address.historic,
    address.road,
  ];
  const primary = primaryCandidates.find((c) => typeof c === 'string' && c.trim().length > 0) || '';

  // area = first of neighbourhood, suburb, city_district, quarter, village
  const areaCandidates = [
    address.neighbourhood,
    address.suburb,
    address.city_district,
    address.quarter,
    address.village,
  ];
  const area = areaCandidates.find((c) => typeof c === 'string' && c.trim().length > 0) || '';

  // If neither primary nor area exists, return "" as there is nothing usable
  if (!primary && !area) {
    return '';
  }

  // city = address.city or town (default "Nashik")
  const city = address.city || address.town || 'Nashik';

  return assembleAndTrimParts(primary, area, city, maxLen);
}

/**
 * 1B. resolveNearestKnownPlace(lat, lng, candidates):
 * nearest candidate by haversineDistanceKm.
 * <= 60 m -> "<name>"; <= 400 m -> "Near <name>"; else null.
 */
export function resolveNearestKnownPlace(
  lat: number,
  lng: number,
  candidates: { id?: string; name: string; lat: number; lng: number; [key: string]: any }[]
): string | null {
  if (!candidates || candidates.length === 0) return null;

  let nearest: { name: string; distKm: number } | null = null;

  for (const c of candidates) {
    if (c.id === 'my_live_location') continue;
    if (typeof c.lat !== 'number' || typeof c.lng !== 'number' || !c.name) continue;
    const distKm = haversineDistanceKm(lat, lng, c.lat, c.lng);
    if (!nearest || distKm < nearest.distKm) {
      nearest = { name: c.name, distKm };
    }
  }

  if (!nearest) return null;

  const distMeters = nearest.distKm * 1000;
  if (distMeters <= 60) {
    return nearest.name;
  }
  if (distMeters <= 400) {
    return `Near ${nearest.name}`;
  }
  return null;
}

/**
 * 3.2 isEligibleForLocationName(node):
 * Excludes any node where node.source === 'seed' && node.verified === false.
 * Core nodes (which have no source field) and real imported OSM or user nodes
 * (source 'osm' or 'user') stay eligible.
 */
export function isEligibleForLocationName(
  node: { source?: string; verified?: boolean; [key: string]: any } | null | undefined
): boolean {
  if (!node) return false;
  if (node.source === 'seed' && node.verified === false) {
    return false;
  }
  return true;
}

/**
 * 4.1 shortenDisplayName(displayName, maxLen = 48):
 * Takes the first two comma-separated parts of display_name,
 * drops any part that is entirely digits or equals "India" or a state name (Maharashtra),
 * joins with ", " and trims to maxLen characters on a word boundary.
 * If the result is still empty, returns ''.
 */
export function shortenDisplayName(displayName: string, maxLen: number = 48): string {
  if (!displayName || typeof displayName !== 'string') return '';

  const isExcluded = (part: string) => {
    const p = part.trim().toLowerCase();
    if (!p) return true;
    if (/^\d+$/.test(p)) return true;
    if (p === 'india' || p === 'maharashtra') return true;
    return false;
  };

  const rawParts = displayName.split(',').map((s) => s.trim()).filter(Boolean);
  const candidateParts = rawParts.slice(0, 2);
  const validParts = candidateParts.filter((part) => !isExcluded(part));

  if (validParts.length === 0) {
    return '';
  }

  const joined = validParts.join(', ');
  if (joined.length <= maxLen) {
    return joined;
  }

  const truncated = joined.slice(0, maxLen);
  const lastBreak = Math.max(truncated.lastIndexOf(' '), truncated.lastIndexOf(','));
  if (lastBreak > 0) {
    return truncated.slice(0, lastBreak).replace(/[, -]+$/, '').trim();
  }

  return '';
}

/**
 * 1B. coordinateFallbackName(lat, lng):
 * "Current location (19.9975, 73.7898)" with 4 decimals.
 * This is the last resort and must still never say "My Live Location".
 */
export function coordinateFallbackName(lat: number, lng: number): string {
  const latStr = lat.toFixed(4);
  const lngStr = lng.toFixed(4);
  return `Current location (${latStr}, ${lngStr})`;
}

/**
 * Client-side in-memory Map cache for reverse geocoding (max 200 items, with TTL)
 */
export class MemoryLruCache<T> {
  private map = new Map<string, { value: T; expiresAt: number }>();
  private maxItems: number;
  private ttlMs: number;

  constructor(maxItems: number = 200, ttlMs: number = 24 * 60 * 60 * 1000) {
    this.maxItems = maxItems;
    this.ttlMs = ttlMs;
  }

  public get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    // Refresh LRU order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  public set(key: string, value: T): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxItems) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) this.map.delete(oldestKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  public size(): number {
    return this.map.size;
  }

  public clear(): void {
    this.map.clear();
  }
}

export const clientGeocodeCache = new MemoryLruCache<string>(200, 24 * 60 * 60 * 1000);

/**
 * 1B. async reverseGeocode(lat, lng, lang):
 * round to 4 decimals, check a client Map cache (max 200),
 * fetch /api/geo/reverse with an 8 s timeout, return data.shortName or null.
 * Never throw.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  lang: string = 'en'
): Promise<string | null> {
  try {
    const lat4 = lat.toFixed(4);
    const lng4 = lng.toFixed(4);
    const cacheKey = `${lat4},${lng4},${lang}`;

    const cached = clientGeocodeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `/api/geo/reverse?lat=${encodeURIComponent(lat4)}&lng=${encodeURIComponent(lng4)}&lang=${encodeURIComponent(lang)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    if (json.success && json.data?.shortName) {
      const shortName = String(json.data.shortName);
      clientGeocodeCache.set(cacheKey, shortName);
      return shortName;
    }

    return null;
  } catch {
    return null;
  }
}
