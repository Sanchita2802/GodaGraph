import { describe, it, expect } from 'vitest';
import {
  formatPlaceName,
  resolveNearestKnownPlace,
  coordinateFallbackName,
  MemoryLruCache,
  isEligibleForLocationName,
  shortenDisplayName,
} from '../geocode';

describe('Geocoding Services Unit Tests (Issue 1E)', () => {
  describe('formatPlaceName', () => {
    it('formats a temple result correctly with primary and area', () => {
      const payload = {
        name: 'Kalaram Mandir',
        address: {
          amenity: 'place_of_worship',
          suburb: 'Panchavati',
          city: 'Nashik',
        },
      };
      const formatted = formatPlaceName(payload);
      expect(formatted).toBe('Kalaram Mandir, Panchavati');
    });

    it('formats a road-only result correctly', () => {
      const payload = {
        address: {
          road: 'Gangapur Road',
          suburb: 'Anandvalli',
          city: 'Nashik',
        },
      };
      const formatted = formatPlaceName(payload);
      expect(formatted).toBe('Gangapur Road, Anandvalli');
    });

    it('removes house numbers, postcodes, state, and country', () => {
      const payload = {
        address: {
          house_number: '12/A',
          road: '#12/A, MG Road',
          suburb: 'Ravivar Peth',
          city: 'Nashik',
          postcode: '422001',
          state: 'Maharashtra',
          country: 'India',
        },
      };
      const formatted = formatPlaceName(payload);
      expect(formatted).toBe('MG Road, Ravivar Peth');
      expect(formatted).not.toContain('422001');
      expect(formatted).not.toContain('12/A');
      expect(formatted).not.toContain('Maharashtra');
      expect(formatted).not.toContain('India');
    });

    it('handles primary equal to area by falling back to city to avoid duplicates', () => {
      const payload = {
        name: 'Panchavati',
        address: {
          suburb: 'Panchavati',
          city: 'Nashik',
        },
      };
      const formatted = formatPlaceName(payload);
      expect(formatted).toBe('Panchavati, Nashik');
      expect(formatted).not.toBe('Panchavati, Panchavati');
    });

    it('returns empty string for empty or invalid payload', () => {
      expect(formatPlaceName({})).toBe('');
      expect(formatPlaceName(null)).toBe('');
      expect(formatPlaceName(undefined)).toBe('');
      expect(formatPlaceName({ address: {} })).toBe('');
    });

    it('trims to maxLen without cutting a word', () => {
      const payload = {
        name: 'Shree Kalaram Sansthan Mandir Complex Panchavati',
        address: {
          suburb: 'Panchavati Spiritual Heritage Zone',
          city: 'Nashik',
        },
      };
      const formatted = formatPlaceName(payload, 30);
      expect(formatted.length).toBeLessThanOrEqual(30);
      // Shouldn't cut in the middle of a word
      expect(formatted.endsWith(' ')).toBe(false);
      expect(formatted.endsWith(',')).toBe(false);
    });
  });

  describe('resolveNearestKnownPlace', () => {
    const candidates = [
      { id: 'cbs', name: 'Nashik CBS', lat: 19.9945, lng: 73.7878 },
      { id: 'ramkund', name: 'Ramkund', lat: 20.0078, lng: 73.7915 },
    ];

    it('returns exact name when <= 60 meters (e.g. 20 m away)', () => {
      // 0.00018 deg lat ~ 20 meters
      const lat20m = 19.9945 + 0.00018;
      const lng20m = 73.7878;
      const result = resolveNearestKnownPlace(lat20m, lng20m, candidates);
      expect(result).toBe('Nashik CBS');
    });

    it('returns "Near <name>" when <= 400 meters (e.g. 200 m away)', () => {
      // 0.0018 deg lat ~ 200 meters
      const lat200m = 19.9945 + 0.0018;
      const lng200m = 73.7878;
      const result = resolveNearestKnownPlace(lat200m, lng200m, candidates);
      expect(result).toBe('Near Nashik CBS');
    });

    it('returns null when > 400 meters (e.g. 900 m away)', () => {
      // 0.008 deg lat ~ 890-900 meters
      const lat900m = 19.9945 + 0.008;
      const lng900m = 73.7878;
      const result = resolveNearestKnownPlace(lat900m, lng900m, candidates);
      expect(result).toBeNull();
    });

    it('always skips candidates with id "my_live_location"', () => {
      // live node at 0m, real place at ~150m (0.00135 deg lat ~ 150m)
      const listWithLive = [
        { id: 'my_live_location', name: 'Current location (19.9945, 73.7878)', lat: 19.9945, lng: 73.7878 },
        { id: 'cbs', name: 'Nashik CBS', lat: 19.9945 + 0.00135, lng: 73.7878 },
      ];
      expect(resolveNearestKnownPlace(19.9945, 73.7878, listWithLive)).toBe('Near Nashik CBS');

      const onlyLive = [
        { id: 'my_live_location', name: 'Current location (19.9945, 73.7878)', lat: 19.9945, lng: 73.7878 },
      ];
      expect(resolveNearestKnownPlace(19.9945, 73.7878, onlyLive)).toBeNull();
    });
  });

  describe('coordinateFallbackName', () => {
    it('formats coordinates with 4 decimal places without "My Live Location"', () => {
      const name = coordinateFallbackName(19.9975432, 73.7898123);
      expect(name).toBe('Current location (19.9975, 73.7898)');
      expect(name).not.toContain('My Live Location');
    });
  });

  describe('MemoryLruCache (LRU eviction and expiry)', () => {
    it('evicts the oldest entry when capacity is exceeded', () => {
      const cache = new MemoryLruCache<string>(3, 60000);
      cache.set('k1', 'v1');
      cache.set('k2', 'v2');
      cache.set('k3', 'v3');

      expect(cache.get('k1')).toBe('v1');
      // k1 accessed, so k2 is now the oldest
      cache.set('k4', 'v4'); // Should evict k2

      expect(cache.get('k2')).toBeNull();
      expect(cache.get('k1')).toBe('v1');
      expect(cache.get('k3')).toBe('v3');
      expect(cache.get('k4')).toBe('v4');
    });

    it('expires entries after TTL', () => {
      // 50ms TTL
      const cache = new MemoryLruCache<string>(5, 50);
      cache.set('temp', 'val');
      expect(cache.get('temp')).toBe('val');

      // Wait 60ms for expiration
      const start = Date.now();
      while (Date.now() - start < 60) {
        // busy wait
      }
      expect(cache.get('temp')).toBeNull();
    });

    it('produces equal cache keys for points a few metres apart when rounded to 4 decimals', () => {
      const lat1 = 19.99751;
      const lng1 = 73.78981;
      const lat2 = 19.99754;
      const lng2 = 73.78983;

      const key1 = `${lat1.toFixed(4)},${lng1.toFixed(4)},en`;
      const key2 = `${lat2.toFixed(4)},${lng2.toFixed(4)},en`;

      expect(key1).toBe('19.9975,73.7898,en');
      expect(key2).toBe('19.9975,73.7898,en');
      expect(key1).toBe(key2);
    });
  });

  describe('isEligibleForLocationName (Issue 3.2)', () => {
    it('allows core nodes without source field', () => {
      const coreNode = { id: 'dwarka_circle', name: 'Dwarka Circle', lat: 19.9885, lng: 73.8012 };
      expect(isEligibleForLocationName(coreNode)).toBe(true);
    });

    it('rejects unverified placeholder nodes (source: seed, verified: false)', () => {
      const placeholderNode = {
        id: 'osm_node_100000',
        name: 'Placeholder Bus Stop',
        source: 'seed',
        verified: false,
        confidence: 0.3,
      };
      expect(isEligibleForLocationName(placeholderNode)).toBe(false);
    });

    it('allows verified seed nodes', () => {
      const verifiedSeedNode = {
        id: 'seed_verified_1',
        name: 'Verified Stop',
        source: 'seed',
        verified: true,
      };
      expect(isEligibleForLocationName(verifiedSeedNode)).toBe(true);
    });

    it('allows imported osm nodes (source: osm)', () => {
      const osmNode = {
        id: 'osm_node_200000',
        name: 'Real OSM Bus Stop',
        source: 'osm',
        verified: false,
      };
      expect(isEligibleForLocationName(osmNode)).toBe(true);
    });

    it('allows user custom nodes (source: user)', () => {
      const userNode = {
        id: 'user_node_1',
        name: 'My House',
        source: 'user',
        verified: false,
      };
      expect(isEligibleForLocationName(userNode)).toBe(true);
    });

    it('handles null or undefined gracefully', () => {
      expect(isEligibleForLocationName(null)).toBe(false);
      expect(isEligibleForLocationName(undefined)).toBe(false);
    });
  });

  describe('shortenDisplayName (Issue 4.3)', () => {
    it('shortens a long display_name with postcode and country into a 1-2 part name', () => {
      const longName = 'Kalaram Mandir, Panchavati, Nashik, Maharashtra, 422003, India';
      const shortened = shortenDisplayName(longName);
      expect(shortened).toBe('Kalaram Mandir, Panchavati');
      expect(shortened.length).toBeLessThanOrEqual(48);
    });

    it('returns empty string when display_name is made only of a postcode and India', () => {
      expect(shortenDisplayName('422001, India')).toBe('');
      expect(shortenDisplayName('422001, Maharashtra, India')).toBe('');
    });

    it('drops digit parts and Maharashtra/India while keeping valid parts', () => {
      expect(shortenDisplayName('Dwarka Circle, 422001, India')).toBe('Dwarka Circle');
      expect(shortenDisplayName('Dwarka Circle, Maharashtra')).toBe('Dwarka Circle');
    });

    it('handles empty or non-string input safely', () => {
      expect(shortenDisplayName('')).toBe('');
      expect(shortenDisplayName(null as any)).toBe('');
      expect(shortenDisplayName(undefined as any)).toBe('');
    });
  });
});
