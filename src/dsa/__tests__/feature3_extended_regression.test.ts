import { describe, it, expect, beforeAll } from 'vitest';
import { RoutingEngine } from '../../services/routing';
import { MultiModalGraph, haversineDistanceKm } from '../MultiModalGraph';
import { UnionFind } from '../UnionFind';
import { isDuplicateNode } from '../../../scripts/import-osm';
import { TransitNode } from '../../types';

describe('Feature 3: Extended Layer & Core Regression Tests', () => {
  let engine: RoutingEngine;

  beforeAll(async () => {
    engine = RoutingEngine.getInstance();
    await engine.buildExtendedLayer();
  });

  it('(a) core regression: core graph edge count equals exactly 7166 captured before changes', () => {
    expect(engine.graph.allEdges.length).toBe(7166);
    expect(engine.graph.getAllNodes().length).toBe(112);
  });

  it('(a) core regression: snapshot of 10 fixed core-to-core journeys matches pre-change values', () => {
    const EXPECTED_SNAPSHOT = [
      { s: 'dwarka_circle', d: 'ramkund', minutes: 4, fare: 108 },
      { s: 'nashik_cbs', d: 'nashik_road_stn', minutes: 15, fare: 347 },
      { s: 'panchavati_karanja', d: 'ramkund', minutes: 2, fare: 10 },
      { s: 'nashik_cbs', d: 'dwarka_circle', minutes: 4, fare: 104 },
      { s: 'ramkund', d: 'kalaram_mandir', minutes: 3, fare: 71 },
      { s: 'city_centre_mall', d: 'nashik_road_stn', minutes: 19, fare: 384 },
      { s: 'mumbai_naka', d: 'nashik_cbs', minutes: 3, fare: 89 },
      { s: 'shalimar', d: 'dwarka_circle', minutes: 3, fare: 91 },
      { s: 'kalaram_mandir', d: 'sita_gufaa', minutes: 2, fare: 0 },
      { s: 'ashok_stambh', d: 'panchavati_karanja', minutes: 2, fare: 84 },
    ];

    for (const exp of EXPECTED_SNAPSHOT) {
      const routes = engine.planJourney(exp.s, exp.d);
      expect(routes.length).toBeGreaterThan(0);
      const best = routes[0];
      expect(best.totalMinutes).toBe(exp.minutes);
      expect(best.totalCostInr).toBe(exp.fare);
    }
  });

  it('(b) grid edge builder never links nodes farther than specified thresholds (walk <= 1.2km, road <= 6.0km)', () => {
    const extGraph = engine.extGraph;
    for (const edge of extGraph.allEdges) {
      if (edge.mode === 'walk') {
        // Normal walking edges generated for extended nodes are <= 1.2 km
        // (with a small floating point margin)
        if (!edge.id.includes('stranded')) {
          expect(edge.distanceKm).toBeLessThanOrEqual(1.205);
        }
      } else if (edge.mode === 'auto' || edge.mode === 'cab') {
        expect(edge.distanceKm).toBeLessThanOrEqual(6.05);
      }
    }
  });

  it('(c) deduplication merges 10m duplicate and preserves core node', () => {
    const coreNode: TransitNode = {
      id: 'core_dwarka',
      name: 'Dwarka Circle',
      nameMr: 'द्वारका सर्कल',
      nameHi: 'द्वारका सर्कल',
      lat: 19.9885,
      lng: 73.8012,
      type: 'junction',
      serves: [],
      popularity: 90,
    };

    // A candidate 10 meters away with identical/similar name
    const candidateWithin10m: TransitNode = {
      id: 'osm_dwarka_candidate',
      name: 'Dwarka Circle Bus Stop',
      nameMr: 'द्वारका सर्कल',
      nameHi: '',
      lat: 19.98855, // ~6 meters North
      lng: 73.80125, // ~5 meters East
      type: 'bus_stop',
      serves: [],
      popularity: 50,
    };

    expect(isDuplicateNode(candidateWithin10m, [coreNode])).toBe(true);

    // Another candidate 500m away -> not duplicate
    const candidateFar: TransitNode = {
      id: 'osm_far_stop',
      name: 'Dwarka Circle East Side',
      nameMr: '',
      nameHi: '',
      lat: 19.993,
      lng: 73.8012,
      type: 'bus_stop',
      serves: [],
      popularity: 50,
    };
    expect(isDuplicateNode(candidateFar, [coreNode])).toBe(false);
  });

  it('(d) extended graph is one connected component', () => {
    const allNodes = engine.extGraph.getAllNodes();
    expect(allNodes.length).toBeGreaterThan(112);

    const uf = new UnionFind(allNodes.map((n) => n.id));
    for (const edge of engine.extGraph.allEdges) {
      uf.union(edge.from, edge.to);
    }

    // All nodes should be connected to the root hub 'nashik_cbs'
    const rootHub = 'nashik_cbs';
    for (const node of allNodes) {
      expect(uf.connected(node.id, rootHub)).toBe(true);
    }
    expect(uf.numComponents).toBe(1);
  });
});
