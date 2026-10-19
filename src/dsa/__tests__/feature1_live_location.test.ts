import { describe, it, expect, beforeEach } from 'vitest';
import { RoutingEngine } from '../../services/routing';
import {
  isWithinNashikBounds,
  hasMovedSignificantly,
  evaluateLocationFix,
  NASHIK_CENTER_LAT,
  NASHIK_CENTER_LNG,
} from '../../services/liveLocationHelper';

describe('Feature 1: Live Location Unit Tests', () => {
  let engine: RoutingEngine;

  beforeEach(() => {
    engine = RoutingEngine.getInstance();
    engine.removeLiveNode();
  });

  it('pure function: 40 km rule correctly identifies coordinates within and outside Nashik', () => {
    // Exact center
    expect(isWithinNashikBounds(NASHIK_CENTER_LAT, NASHIK_CENTER_LNG)).toBe(true);

    // Deolali / Nashik Road (~8-10 km away)
    expect(isWithinNashikBounds(19.95, 73.83)).toBe(true);

    // Trimbakeshwar (~28 km away)
    expect(isWithinNashikBounds(19.93, 73.53)).toBe(true);

    // Mumbai (~140 km away)
    expect(isWithinNashikBounds(19.076, 72.8777)).toBe(false);

    // Pune (~160 km away)
    expect(isWithinNashikBounds(18.5204, 73.8567)).toBe(false);

    // Delhi (~1000 km away)
    expect(isWithinNashikBounds(28.6139, 77.209)).toBe(false);
  });

  it('pure function: 75m movement rule thresholds correctly', () => {
    const lat1 = 19.9975;
    const lng1 = 73.7898;

    // Same position -> 0m moved
    expect(hasMovedSignificantly(lat1, lng1, lat1, lng1, 75)).toBe(false);

    // Small jitter (~10m moved: 0.0001 deg ~ 11m)
    expect(hasMovedSignificantly(lat1, lng1, lat1 + 0.0001, lng1, 75)).toBe(false);

    // Moved ~40m
    expect(hasMovedSignificantly(lat1, lng1, lat1 + 0.00035, lng1, 75)).toBe(false);

    // Moved ~110m (0.001 deg ~ 111m)
    expect(hasMovedSignificantly(lat1, lng1, lat1 + 0.001, lng1, 75)).toBe(true);

    // Moved ~200m
    expect(hasMovedSignificantly(lat1, lng1, lat1, lng1 + 0.002, 75)).toBe(true);
  });

  it('pure function: evaluateLocationFix enforces first fix wins once and throttling', () => {
    const lat = 19.9975;
    const lng = 73.7898;
    const t0 = 100000;

    // 1. Initial fix when no fix has been received yet -> accepted as first fix
    const state0 = { hasReceivedFirstFix: false };
    const fix1 = evaluateLocationFix(state0, lat, lng, t0, true);
    expect(fix1.accepted).toBe(true);
    expect(fix1.isFirstFix).toBe(true);

    // 2. Second immediate fix (0ms later, 0m moved) from second path -> throttled
    const state1 = { hasReceivedFirstFix: true, lastLat: lat, lastLng: lng, lastTime: t0 };
    const fix2 = evaluateLocationFix(state1, lat, lng, t0 + 100, true);
    expect(fix2.accepted).toBe(false);
    expect(fix2.reason).toBe('throttled');

    // 3. Moved >75m but within <10s (5s elapsed) -> throttled
    const fix3 = evaluateLocationFix(state1, lat + 0.002, lng, t0 + 5000, true);
    expect(fix3.accepted).toBe(false);

    // 4. Time >10s (12s elapsed) but moved <75m (~10m) -> throttled
    const fix4 = evaluateLocationFix(state1, lat + 0.0001, lng, t0 + 12000, true);
    expect(fix4.accepted).toBe(false);

    // 5. Time >10s and moved >75m -> accepted as subsequent fix
    const fix5 = evaluateLocationFix(state1, lat + 0.002, lng, t0 + 12000, true);
    expect(fix5.accepted).toBe(true);
    expect(fix5.isFirstFix).toBe(false);

    // 6. Fix outside 40km Nashik bounds -> rejected
    const fixOut = evaluateLocationFix(state0, 19.076, 72.8777, t0, true);
    expect(fixOut.accepted).toBe(false);
    expect(fixOut.reason).toBe('out_of_bounds');

    // 7. Fix when auto-following is disabled -> rejected
    const fixNoFollow = evaluateLocationFix(state0, lat, lng, t0, false);
    expect(fixNoFollow.accepted).toBe(false);
    expect(fixNoFollow.reason).toBe('not_following');
  });

  it('upsertLiveNode adds live node with proper id, coordinate fallback name, and bidirectional edges', () => {
    // Near CBS
    const liveNode = engine.upsertLiveNode(19.9945, 73.7878);

    expect(liveNode.id).toBe('my_live_location');
    expect(liveNode.name).toBe('Current location (19.9945, 73.7878)');
    expect(liveNode.type).toBe('landmark');
    expect(liveNode.popularity).toBe(0);

    const liveEdges = engine.extGraph.allEdges.filter(
      (e) => e.from === 'my_live_location' || e.to === 'my_live_location'
    );
    const initialEdgeCount = liveEdges.length;
    expect(initialEdgeCount).toBeGreaterThan(0);

    // setLiveNodeNames changes name without changing edge count
    const updated = engine.setLiveNodeNames({
      name: 'Nashik CBS',
      nameMr: 'नाशिक सीबीएस',
      nameHi: 'नासिक सीबीएस',
    });
    expect(updated?.name).toBe('Nashik CBS');
    expect(updated?.nameMr).toBe('नाशिक सीबीएस');
    expect(updated?.nameHi).toBe('नासिक सीबीएस');

    const edgesAfterNameChange = engine.extGraph.allEdges.filter(
      (e) => e.from === 'my_live_location' || e.to === 'my_live_location'
    );
    expect(edgesAfterNameChange.length).toBe(initialEdgeCount);

    // Verify walking edges exist
    const walkEdges = liveEdges.filter((e) => e.mode === 'walk');
    expect(walkEdges.length).toBeGreaterThan(0);

    // Verify auto/cab edges to hubs exist
    const autoCabEdges = liveEdges.filter((e) => e.mode === 'auto' || e.mode === 'cab');
    expect(autoCabEdges.length).toBeGreaterThan(0);
  });

  it('calling upsertLiveNode a second time replaces previous edges cleanly without duplicates', () => {
    engine.upsertLiveNode(19.9945, 73.7878);
    const count1 = engine.extGraph.allEdges.filter(
      (e) => e.from === 'my_live_location' || e.to === 'my_live_location'
    );

    // Second call at a slightly different location
    engine.upsertLiveNode(20.002, 73.791);
    const count2 = engine.extGraph.allEdges.filter(
      (e) => e.from === 'my_live_location' || e.to === 'my_live_location'
    );

    expect(count2.length).toBeGreaterThan(0);
    // Should not accumulate previous edges
    expect(count2.length).toBeLessThanOrEqual(count1.length + 10);
  });

  it('removeLiveNode cleanly removes live node and all incident edges', () => {
    engine.upsertLiveNode(19.9945, 73.7878);
    expect(engine.extGraph.getNode('my_live_location')).toBeDefined();

    engine.removeLiveNode();
    expect(engine.extGraph.getNode('my_live_location')).toBeUndefined();

    const remainingLiveEdges = engine.extGraph.allEdges.filter(
      (e) => e.from === 'my_live_location' || e.to === 'my_live_location'
    );
    expect(remainingLiveEdges.length).toBe(0);
  });
});
