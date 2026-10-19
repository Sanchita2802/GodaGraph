/**
 * Keyless raster tile providers for Leaflet basemap.
 * Ordered list with automatic failover support.
 *
 * Rules:
 * 1. Only completely keyless, CORS-enabled, reliable public raster tile providers.
 * 2. No CARTO (which now requires an API key and watermarks "API KEY REQUIRED").
 * 3. No Stadia, MapTiler, Mapbox, or Thunderforest.
 */

export interface TileProviderConfig {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  subdomains?: string | string[];
}

export const TILE_PROVIDERS: TileProviderConfig[] = [
  {
    id: 'osm',
    name: 'OpenStreetMap Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: 'esri',
    name: 'Esri World Street Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS',
    maxZoom: 19,
  },
  {
    id: 'opentopo',
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC-BY-SA), &copy; OpenStreetMap contributors',
    maxZoom: 17,
    subdomains: ['a', 'b', 'c'],
  },
];

/**
 * Pure function to evaluate whether a tile provider has encountered sufficient
 * consecutive errors without successful tile loads in a rolling time window to trigger failover.
 *
 * @param currentIndex Current index in TILE_PROVIDERS
 * @param errorsInWindow Number of tileerror events in the rolling window
 * @param loadsInWindow Number of tileload events in the rolling window
 * @param thresholdErrors Number of errors needed to trigger failover (default: 6)
 * @param totalProviders Total number of configured providers (default: TILE_PROVIDERS.length)
 */
export function evaluateTileFailover(
  currentIndex: number,
  errorsInWindow: number,
  loadsInWindow: number,
  thresholdErrors: number = 6,
  totalProviders: number = TILE_PROVIDERS.length
): { shouldFailover: boolean; nextIndex: number | null; allFailed: boolean } {
  if (errorsInWindow >= thresholdErrors && loadsInWindow === 0) {
    const next = currentIndex + 1;
    if (next < totalProviders) {
      return { shouldFailover: true, nextIndex: next, allFailed: false };
    }
    return { shouldFailover: false, nextIndex: null, allFailed: true };
  }
  return { shouldFailover: false, nextIndex: null, allFailed: false };
}
