import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateCabFareEstimate,
  INITIAL_CAB_PROFILES,
  getStoredCabProfiles,
  saveStoredCabProfiles,
  getStoredCabObservations,
  saveStoredCabObservations,
} from '../../data/cabFareDatabase';
import { fitCabRatesOLS } from '../FareCalibration';
import { CabFareProfile, CabFareObservation } from '../../types';

describe('Feature 4: Cab Database, Fare Formulas & OLS Calibration Tests', () => {
  const sampleProfile: CabFareProfile = {
    id: 'test_uber_auto',
    provider: 'Uber',
    category: 'Auto',
    baseFare: 30,
    includedKm: 1.5,
    perKm: 15.0,
    perMin: 1.2,
    minFare: 30,
    bookingFee: 5,
    waitingPerMin: 1.5,
    nightSurchargePct: 25,
    nightStartHour: 23,
    nightEndHour: 5,
    peakMultiplierMin: 1.0,
    peakMultiplierMax: 1.5,
    availabilityInNashik: 'confirmed',
    source: 'seed_estimate',
    lastVerified: '2026-10-18',
    notes: 'Test profile',
  };

  it('calculates daytime standard fare formula accurately', () => {
    // 5 km, 15 min at 2 PM (hour = 14, daytime)
    // chargeableKm = max(0, 5 - 1.5) = 3.5 km
    // raw = 30 + (3.5 * 15.0) + (15 * 1.2) + 5 = 30 + 52.5 + 18 + 5 = 105.5
    // baseCalc = max(30, 105.5) = 105.5 -> 106
    // low = 105.5 * 1.0 = 106
    // high = 105.5 * 1.5 = 158.25 -> 158
    const est = calculateCabFareEstimate(sampleProfile, 5.0, 15, 14);
    expect(est.isNight).toBe(false);
    expect(est.baseCalc).toBe(106);
    expect(est.low).toBe(106);
    expect(est.high).toBe(158);
  });

  it('applies night surcharge correctly during nighttime hours', () => {
    // 5 km, 15 min at 1 AM (hour = 1, night)
    // baseCalc = 105.5
    // night surcharge +25% -> 105.5 * 1.25 = 131.875
    // low = 131.875 * 1.0 -> 132
    // high = 131.875 * 1.5 -> 198
    const est = calculateCabFareEstimate(sampleProfile, 5.0, 15, 1);
    expect(est.isNight).toBe(true);
    expect(est.low).toBe(132);
    expect(est.high).toBe(198);
  });

  it('OLS calibration recovers exact known coefficients from synthetic dataset within 1e-6', () => {
    // Known linear model: Fare = 42.0 + 16.5 * km + 2.5 * min
    const trueIntercept = 42.0;
    const trueA = 16.5;
    const trueB = 2.5;

    const syntheticData: { km: number; min: number }[] = [
      { km: 1.5, min: 6 },
      { km: 3.0, min: 10 },
      { km: 4.8, min: 16 },
      { km: 6.5, min: 22 },
      { km: 8.0, min: 28 },
      { km: 10.5, min: 35 },
      { km: 12.0, min: 40 },
    ];

    const observations: CabFareObservation[] = syntheticData.map((pt, idx) => ({
      id: `syn_${idx}`,
      provider: 'Uber',
      category: 'Auto',
      fromName: `Stop A${idx}`,
      toName: `Stop B${idx}`,
      distanceKm: pt.km,
      durationMin: pt.min,
      hourOfDay: 14,
      dayType: 'weekday',
      quotedFare: trueIntercept + trueA * pt.km + trueB * pt.min,
      surgeSeen: false,
      observedAt: '2026-10-18T12:00:00Z',
    }));

    const result = fitCabRatesOLS(observations);

    expect(result.n).toBe(7);
    expect(Math.abs(result.intercept - trueIntercept)).toBeLessThan(1e-6);
    expect(Math.abs(result.a - trueA)).toBeLessThan(1e-6);
    expect(Math.abs(result.b - trueB)).toBeLessThan(1e-6);
    expect(result.mae).toBeLessThan(1e-6);
    expect(result.mape).toBeLessThan(1e-6);
  });

  it('round-trip persists cab profiles and observations to localStorage', () => {
    // Create an in-memory mock for localStorage if running in Node
    const mockStorage: Record<string, string> = {};
    const originalLocalStorage = globalThis.localStorage;

    globalThis.localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        for (const k of Object.keys(mockStorage)) delete mockStorage[k];
      },
      length: 0,
      key: () => null,
    };

    try {
      const customProfile: CabFareProfile = {
        ...sampleProfile,
        id: 'custom_ola_bike',
        baseFare: 22,
        notes: 'Custom calibrated bike',
      };
      saveStoredCabProfiles([customProfile]);

      const loadedProfiles = getStoredCabProfiles();
      expect(loadedProfiles.length).toBe(1);
      expect(loadedProfiles[0].id).toBe('custom_ola_bike');
      expect(loadedProfiles[0].baseFare).toBe(22);

      const customObs: CabFareObservation = {
        id: 'obs_custom_1',
        provider: 'Ola',
        category: 'Bike',
        fromName: 'CBS',
        toName: 'Shalimar',
        distanceKm: 1.8,
        durationMin: 6,
        hourOfDay: 15,
        dayType: 'weekday',
        quotedFare: 35,
        surgeSeen: false,
        observedAt: '2026-10-18T15:00:00Z',
      };
      saveStoredCabObservations([customObs]);

      const loadedObs = getStoredCabObservations();
      expect(loadedObs.length).toBe(1);
      expect(loadedObs[0].id).toBe('obs_custom_1');
      expect(loadedObs[0].quotedFare).toBe(35);
    } finally {
      globalThis.localStorage = originalLocalStorage;
    }
  });
});
