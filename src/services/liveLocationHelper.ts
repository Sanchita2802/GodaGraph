import { haversineDistanceKm } from '../dsa/MultiModalGraph';

export const NASHIK_CENTER_LAT = 19.9975;
export const NASHIK_CENTER_LNG = 73.7898;
export const MAX_DISTANCE_FROM_NASHIK_KM = 40.0;
export const SIGNIFICANT_MOVE_METERS = 75.0;

/**
 * Checks whether coordinates lie within 40 km radius of Nashik city center.
 */
export function isWithinNashikBounds(lat: number, lng: number): boolean {
  const distKm = haversineDistanceKm(lat, lng, NASHIK_CENTER_LAT, NASHIK_CENTER_LNG);
  return distKm <= MAX_DISTANCE_FROM_NASHIK_KM;
}

/**
 * Returns true if the user has moved more than thresholdMeters (default 75m)
 * between two GPS coordinate fixes.
 */
export function hasMovedSignificantly(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  thresholdMeters: number = SIGNIFICANT_MOVE_METERS
): boolean {
  const distKm = haversineDistanceKm(lat1, lng1, lat2, lng2);
  const distMeters = distKm * 1000;
  return distMeters > thresholdMeters;
}

export interface LocationFixState {
  hasReceivedFirstFix: boolean;
  lastLat?: number;
  lastLng?: number;
  lastTime?: number;
}

export interface FixDecision {
  accepted: boolean;
  isFirstFix: boolean;
  reason?: 'first_fix' | 'movement_and_time_threshold_met' | 'out_of_bounds' | 'throttled' | 'not_following';
}

/**
 * Pure evaluation for GPS location fixes:
 * Enforces "first fix wins once", 40 km Nashik boundary, auto-following guard,
 * and 75m / 10s throttling on subsequent fixes.
 */
export function evaluateLocationFix(
  state: LocationFixState,
  newLat: number,
  newLng: number,
  nowTime: number,
  isAutoFollowing: boolean,
  distanceThresholdM: number = SIGNIFICANT_MOVE_METERS,
  timeThresholdMs: number = 10000
): FixDecision {
  if (!isAutoFollowing) {
    return { accepted: false, isFirstFix: false, reason: 'not_following' };
  }
  if (!isWithinNashikBounds(newLat, newLng)) {
    return { accepted: false, isFirstFix: false, reason: 'out_of_bounds' };
  }
  if (!state.hasReceivedFirstFix) {
    return { accepted: true, isFirstFix: true, reason: 'first_fix' };
  }
  // Subsequent fix: must meet both 10s interval and 75m movement
  const timeDiff = state.lastTime !== undefined ? nowTime - state.lastTime : 0;
  const moved =
    state.lastLat !== undefined && state.lastLng !== undefined
      ? hasMovedSignificantly(state.lastLat, state.lastLng, newLat, newLng, distanceThresholdM)
      : true;

  if (timeDiff >= timeThresholdMs && moved) {
    return { accepted: true, isFirstFix: false, reason: 'movement_and_time_threshold_met' };
  }
  return { accepted: false, isFirstFix: false, reason: 'throttled' };
}
