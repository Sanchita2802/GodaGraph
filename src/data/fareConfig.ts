import { FareSettings } from '../types';

export const INITIAL_FARE_SETTINGS: FareSettings = {
  busBaseFare: 10,
  busPerStage: 3,
  autoMeterBase: 26, // Base for first 1.5 km
  autoMeterPerKm: 15.33,
  sharedAutoBase: 15,
  cabBase: 60,
  cabPerKm: 18,
  cabPerMin: 2,
  surgeMultiplier: 1.0,
  walkSpeedKmh: 4.8,
};

export const STORAGE_KEY_FARES = 'godagraph_fare_settings_v1';

export function getStoredFareSettings(): FareSettings {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_FARES);
      if (raw) {
        return { ...INITIAL_FARE_SETTINGS, ...JSON.parse(raw) };
      }
    }
  } catch (err) {
    console.warn('Could not read fare settings from localStorage:', err);
  }
  return INITIAL_FARE_SETTINGS;
}

export function saveStoredFareSettings(settings: FareSettings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_FARES, JSON.stringify(settings));
    }
  } catch (err) {
    console.warn('Could not save fare settings:', err);
  }
}
