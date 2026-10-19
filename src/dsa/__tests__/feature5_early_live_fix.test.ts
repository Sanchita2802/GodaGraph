import { describe, it, expect } from 'vitest';
import { RoutingEngine } from '../../services/routing';

describe('Feature 5: Early Live Fix and Non-Core Safety Tests (Issue 1.4)', () => {
  it('a) returns empty array when live node is planned before extended layer is ready, and returns routes after ready', async () => {
    const engine = new RoutingEngine();
    expect(engine.isExtendedReady).toBe(false);

    // Upsert live node at a valid Nashik point
    engine.upsertLiveNode(19.9945, 73.7878);

    // Early journey planning for non-core live node must return [] without throwing
    let earlyRoutes: any[] | null = null;
    expect(() => {
      earlyRoutes = engine.planJourney('my_live_location', 'ramkund_ghat');
    }).not.toThrow();
    expect(earlyRoutes).toEqual([]);

    // Wait until the extended layer becomes ready
    await new Promise<void>((resolve) => {
      engine.onExtendedReady(() => resolve());
    });
    expect(engine.isExtendedReady).toBe(true);

    // Second call after layer is ready returns at least one route
    const readyRoutes = engine.planJourney('my_live_location', 'ramkund_ghat');
    expect(readyRoutes.length).toBeGreaterThan(0);
  });

  it('b) planJourney with an unknown id returns [] and does not throw for both source and target', async () => {
    const engine = new RoutingEngine();
    await new Promise<void>((resolve) => {
      engine.onExtendedReady(() => resolve());
    });

    expect(() => {
      const res = engine.planJourney('unknown_source_xyz', 'ramkund');
      expect(res).toEqual([]);
    }).not.toThrow();

    expect(() => {
      const res = engine.planJourney('ramkund', 'unknown_target_xyz');
      expect(res).toEqual([]);
    }).not.toThrow();

    expect(() => {
      const res = engine.planJourney('unknown_source_xyz', 'unknown_target_xyz');
      expect(res).toEqual([]);
    }).not.toThrow();
  });

  it('c) a core-to-core journey still equals the snapshot used by the existing regression test', async () => {
    const engine = new RoutingEngine();
    await new Promise<void>((resolve) => {
      engine.onExtendedReady(() => resolve());
    });

    const EXPECTED_SNAPSHOT = [
      { s: 'dwarka_circle', d: 'ramkund', minutes: 4, fare: 108 },
      { s: 'nashik_cbs', d: 'nashik_road_stn', minutes: 15, fare: 347 },
      { s: 'panchavati_karanja', d: 'ramkund', minutes: 2, fare: 10 },
      { s: 'nashik_cbs', d: 'dwarka_circle', minutes: 4, fare: 104 },
      { s: 'ramkund', d: 'kalaram_mandir', minutes: 3, fare: 71 },
    ];

    for (const exp of EXPECTED_SNAPSHOT) {
      const routes = engine.planJourney(exp.s, exp.d);
      expect(routes.length).toBeGreaterThan(0);
      const best = routes[0];
      expect(best.totalMinutes).toBe(exp.minutes);
      expect(best.totalCostInr).toBe(exp.fare);
    }
  });
});
