import { describe, it, expect } from 'vitest';
import { TILE_PROVIDERS, evaluateTileFailover } from '../tileProviders';

describe('Tile Providers and Failover Logic (Task 1 & Task 4)', () => {
  it('contains ordered keyless tile providers without CARTO or key-required providers', () => {
    expect(TILE_PROVIDERS.length).toBeGreaterThanOrEqual(3);

    // Primary provider is OSM
    expect(TILE_PROVIDERS[0].id).toBe('osm');
    expect(TILE_PROVIDERS[0].url).toContain('tile.openstreetmap.org');

    // No CARTO, Mapbox, Stadia, or key parameters in any provider URL
    for (const provider of TILE_PROVIDERS) {
      expect(provider.url).not.toContain('cartocdn.com');
      expect(provider.url).not.toContain('mapbox.com');
      expect(provider.url).not.toContain('stadiamaps.com');
      expect(provider.url).not.toContain('api_key');
      expect(provider.url).not.toContain('{key}');
    }
  });

  describe('evaluateTileFailover', () => {
    it('does not trigger failover when errors are below threshold', () => {
      const result = evaluateTileFailover(0, 5, 0, 6, 3);
      expect(result.shouldFailover).toBe(false);
      expect(result.nextIndex).toBeNull();
      expect(result.allFailed).toBe(false);
    });

    it('does not trigger failover when errors meet threshold but successful tile loads occurred', () => {
      const result = evaluateTileFailover(0, 8, 2, 6, 3);
      expect(result.shouldFailover).toBe(false);
      expect(result.nextIndex).toBeNull();
      expect(result.allFailed).toBe(false);
    });

    it('triggers failover to next provider when threshold reached with zero loads', () => {
      const result = evaluateTileFailover(0, 6, 0, 6, 3);
      expect(result.shouldFailover).toBe(true);
      expect(result.nextIndex).toBe(1);
      expect(result.allFailed).toBe(false);
    });

    it('triggers failover from second provider to third provider', () => {
      const result = evaluateTileFailover(1, 6, 0, 6, 3);
      expect(result.shouldFailover).toBe(true);
      expect(result.nextIndex).toBe(2);
      expect(result.allFailed).toBe(false);
    });

    it('marks allFailed when last provider fails and never loops indefinitely', () => {
      const result = evaluateTileFailover(2, 6, 0, 6, 3);
      expect(result.shouldFailover).toBe(false);
      expect(result.nextIndex).toBeNull();
      expect(result.allFailed).toBe(true);
    });
  });
});
