import { describe, it, expect } from 'vitest';
import { ViewportGridIndex } from '../ViewportGridIndex';
import { TransitNode } from '../../types';

describe('Feature 2: ViewportGridIndex Unit Tests', () => {
  const sampleNodes: TransitNode[] = [
    {
      id: 'hub_railway',
      name: 'Nashik Road Railway Station',
      nameMr: 'नाशिक रोड रेल्वे स्टेशन',
      nameHi: 'नासिक रोड रेलवे स्टेशन',
      lat: 19.9542,
      lng: 73.8345,
      type: 'railway',
      tier: 'A',
      popularity: 98,
      serves: ['R1', 'R2'],
    },
    {
      id: 'hub_junction',
      name: 'Dwarka Circle',
      nameMr: 'द्वारका सर्कल',
      nameHi: 'द्वारका सर्कल',
      lat: 19.9885,
      lng: 73.8012,
      type: 'junction',
      tier: 'A',
      popularity: 95,
      serves: ['R1', 'R3'],
    },
    {
      id: 'bus_stop_1',
      name: 'Prasad Circle Citilinc Stop',
      nameMr: 'प्रसाद सर्कल बस थांबा',
      nameHi: 'प्रसाद सर्कल बस स्टॉप',
      lat: 20.0042,
      lng: 73.7612,
      type: 'bus_stop',
      tier: 'B',
      popularity: 58,
      serves: ['R4'],
    },
    {
      id: 'bus_stop_2',
      name: 'Model Colony Bus Stop',
      nameMr: 'मॉडेल कॉलनी बस थांबा',
      nameHi: 'मॉडल कॉलोनी बस स्टॉप',
      lat: 20.0011,
      lng: 73.7548,
      type: 'bus_stop',
      tier: 'B',
      popularity: 50,
      serves: ['R4'],
    },
    {
      id: 'landmark_temple',
      name: 'Navshya Ganpati Temple',
      nameMr: 'नवश्या गणपती मंदिर',
      nameHi: 'नवश्या गणपति मंदिर',
      lat: 20.0125,
      lng: 73.7512,
      type: 'landmark',
      tier: 'C',
      popularity: 70,
      serves: [],
    },
    {
      id: 'cafe_shop',
      name: 'The Daily Beans Gangapur Road',
      nameMr: 'द डेली बीन्स गंगापूर रोड',
      nameHi: 'द डेली बीन्स',
      lat: 20.0142,
      lng: 73.7595,
      type: 'landmark',
      tier: 'D',
      popularity: 28,
      serves: [],
    },
  ];

  it('inserts nodes and accurately tracks total size and clear', () => {
    const grid = new ViewportGridIndex(0.02);
    expect(grid.size()).toBe(0);

    grid.insert(sampleNodes[0]);
    expect(grid.size()).toBe(1);

    grid.insertMany(sampleNodes.slice(1));
    expect(grid.size()).toBe(sampleNodes.length);

    grid.clear();
    expect(grid.size()).toBe(0);
  });

  it('queries within bounds and ignores nodes outside bounding box', () => {
    const grid = new ViewportGridIndex(0.02);
    grid.insertMany(sampleNodes);

    // Box containing only Prasad Circle and Model Colony (~lat 20.00 to 20.005, lng 73.75 to 73.765)
    const localBounds = {
      south: 20.0,
      north: 20.005,
      west: 73.75,
      east: 73.765,
    };

    const results = grid.queryBounds(localBounds, 16);
    const ids = results.map((n) => n.id);

    expect(ids).toContain('bus_stop_1');
    expect(ids).toContain('bus_stop_2');
    expect(ids).not.toContain('hub_railway'); // Far outside
    expect(ids).not.toContain('hub_junction'); // Far outside
  });

  it('enforces Zoom Tier 1: zoom <= 13 returns only hubs', () => {
    const grid = new ViewportGridIndex(0.05);
    grid.insertMany(sampleNodes);

    const wideBounds = {
      south: 19.8,
      north: 20.2,
      west: 73.6,
      east: 73.9,
    };

    const results = grid.queryBounds(wideBounds, 12);
    const ids = results.map((n) => n.id);

    // Hubs should be present
    expect(ids).toContain('hub_railway');
    expect(ids).toContain('hub_junction');

    // Bus stops and Tier C/D landmarks should NOT be present at zoom 12
    expect(ids).not.toContain('bus_stop_1');
    expect(ids).not.toContain('bus_stop_2');
    expect(ids).not.toContain('landmark_temple');
    expect(ids).not.toContain('cafe_shop');
  });

  it('enforces Zoom Tier 2: zoom 14-15 returns hubs and bus stops', () => {
    const grid = new ViewportGridIndex(0.05);
    grid.insertMany(sampleNodes);

    const wideBounds = {
      south: 19.8,
      north: 20.2,
      west: 73.6,
      east: 73.9,
    };

    const results = grid.queryBounds(wideBounds, 14);
    const ids = results.map((n) => n.id);

    expect(ids).toContain('hub_railway');
    expect(ids).toContain('hub_junction');
    expect(ids).toContain('bus_stop_1');
    expect(ids).toContain('bus_stop_2');

    // Tier C/D landmarks should NOT be present at zoom 14
    expect(ids).not.toContain('landmark_temple');
    expect(ids).not.toContain('cafe_shop');
  });

  it('enforces Zoom Tier 3: zoom >= 16 returns all places inside bounds', () => {
    const grid = new ViewportGridIndex(0.05);
    grid.insertMany(sampleNodes);

    const wideBounds = {
      south: 19.8,
      north: 20.2,
      west: 73.6,
      east: 73.9,
    };

    const results = grid.queryBounds(wideBounds, 16);
    expect(results.length).toBe(sampleNodes.length);
  });

  it('caps visible markers at maxCap (default 400)', () => {
    const grid = new ViewportGridIndex(0.05);
    const manyNodes: TransitNode[] = [];
    for (let i = 0; i < 450; i++) {
      manyNodes.push({
        id: `node_${i}`,
        name: `Stop ${i}`,
        nameMr: '',
        nameHi: '',
        lat: 19.99 + (i % 20) * 0.001,
        lng: 73.78 + Math.floor(i / 20) * 0.001,
        type: 'bus_stop',
        tier: 'B',
        popularity: 40,
        serves: [],
      });
    }
    grid.insertMany(manyNodes);

    const wideBounds = { south: 19.8, north: 20.2, west: 73.6, east: 73.9 };
    const res = grid.queryBounds(wideBounds, 16, 400);
    expect(res.length).toBe(400);
  });
});
