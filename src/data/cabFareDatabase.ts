import { CabFareProfile, CabFareObservation } from '../types';

export const STORAGE_KEY_CAB_PROFILES = 'godagraph_cab_profiles_v1';
export const STORAGE_KEY_CAB_OBS = 'godagraph_cab_obs_v1';

export const INITIAL_CAB_PROFILES: CabFareProfile[] = [
  {
    id: 'uber_auto',
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
    peakMultiplierMax: 1.4,
    availabilityInNashik: 'unverified',
    source: 'seed_estimate',
    lastVerified: '',
    notes: 'Placeholder. Replace with real app estimates.',
  },
  {
    id: 'uber_go',
    provider: 'Uber',
    category: 'Mini/Go',
    baseFare: 60,
    includedKm: 0,
    perKm: 16.0,
    perMin: 2.0,
    minFare: 70,
    bookingFee: 15,
    waitingPerMin: 2.0,
    nightSurchargePct: 25,
    nightStartHour: 23,
    nightEndHour: 5,
    peakMultiplierMin: 1.0,
    peakMultiplierMax: 1.5,
    availabilityInNashik: 'unverified',
    source: 'seed_estimate',
    lastVerified: '',
    notes: 'Placeholder. Replace with real app estimates.',
  },
  {
    id: 'uber_premier',
    provider: 'Uber',
    category: 'Sedan/Prime',
    baseFare: 80,
    includedKm: 0,
    perKm: 21.0,
    perMin: 2.5,
    minFare: 100,
    bookingFee: 20,
    waitingPerMin: 2.5,
    nightSurchargePct: 25,
    nightStartHour: 23,
    nightEndHour: 5,
    peakMultiplierMin: 1.0,
    peakMultiplierMax: 1.6,
    availabilityInNashik: 'unverified',
    source: 'seed_estimate',
    lastVerified: '',
    notes: 'Placeholder. Replace with real app estimates.',
  },
  {
    id: 'uber_moto',
    provider: 'Uber',
    category: 'Bike',
    baseFare: 20,
    includedKm: 1.0,
    perKm: 9.0,
    perMin: 1.0,
    minFare: 25,
    bookingFee: 5,
    waitingPerMin: 1.0,
    nightSurchargePct: 20,
    nightStartHour: 23,
    nightEndHour: 5,
    peakMultiplierMin: 1.0,
    peakMultiplierMax: 1.3,
    availabilityInNashik: 'unverified',
    source: 'seed_estimate',
    lastVerified: '',
    notes: 'Placeholder. Replace with real app estimates.',
  },
  {
    id: 'ola_auto',
    provider: 'Ola',
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
    peakMultiplierMax: 1.4,
    availabilityInNashik: 'unverified',
    source: 'seed_estimate',
    lastVerified: '',
    notes: 'Placeholder. Replace with real app estimates.',
  },
  {
    id: 'ola_mini',
    provider: 'Ola',
    category: 'Mini/Go',
    baseFare: 60,
    includedKm: 0,
    perKm: 16.5,
    perMin: 2.0,
    minFare: 70,
    bookingFee: 15,
    waitingPerMin: 2.0,
    nightSurchargePct: 25,
    nightStartHour: 23,
    nightEndHour: 5,
    peakMultiplierMin: 1.0,
    peakMultiplierMax: 1.5,
    availabilityInNashik: 'unverified',
    source: 'seed_estimate',
    lastVerified: '',
    notes: 'Placeholder. Replace with real app estimates.',
  },
  {
    id: 'ola_prime',
    provider: 'Ola',
    category: 'Sedan/Prime',
    baseFare: 85,
    includedKm: 0,
    perKm: 22.0,
    perMin: 2.5,
    minFare: 105,
    bookingFee: 20,
    waitingPerMin: 2.5,
    nightSurchargePct: 25,
    nightStartHour: 23,
    nightEndHour: 5,
    peakMultiplierMin: 1.0,
    peakMultiplierMax: 1.6,
    availabilityInNashik: 'unverified',
    source: 'seed_estimate',
    lastVerified: '',
    notes: 'Placeholder. Replace with real app estimates.',
  },
  {
    id: 'ola_bike',
    provider: 'Ola',
    category: 'Bike',
    baseFare: 20,
    includedKm: 1.0,
    perKm: 9.5,
    perMin: 1.0,
    minFare: 25,
    bookingFee: 5,
    waitingPerMin: 1.0,
    nightSurchargePct: 20,
    nightStartHour: 23,
    nightEndHour: 5,
    peakMultiplierMin: 1.0,
    peakMultiplierMax: 1.3,
    availabilityInNashik: 'unverified',
    source: 'seed_estimate',
    lastVerified: '',
    notes: 'Placeholder. Replace with real app estimates.',
  },
];

export const INITIAL_CAB_OBSERVATIONS: CabFareObservation[] = [
  {
    id: 'obs_1',
    provider: 'Uber',
    category: 'Auto',
    fromName: 'Dwarka Circle',
    toName: 'Ramkund',
    distanceKm: 3.2,
    durationMin: 12,
    hourOfDay: 14,
    dayType: 'weekday',
    quotedFare: 75,
    surgeSeen: false,
    observedAt: '2026-10-15T14:30:00Z',
  },
  {
    id: 'obs_2',
    provider: 'Uber',
    category: 'Auto',
    fromName: 'Nashik CBS',
    toName: 'Nashik Road Station',
    distanceKm: 8.5,
    durationMin: 25,
    hourOfDay: 11,
    dayType: 'weekday',
    quotedFare: 165,
    surgeSeen: false,
    observedAt: '2026-10-15T11:15:00Z',
  },
  {
    id: 'obs_3',
    provider: 'Uber',
    category: 'Auto',
    fromName: 'College Road',
    toName: 'City Centre Mall',
    distanceKm: 4.0,
    durationMin: 15,
    hourOfDay: 17,
    dayType: 'weekday',
    quotedFare: 90,
    surgeSeen: false,
    observedAt: '2026-10-16T17:00:00Z',
  },
  {
    id: 'obs_4',
    provider: 'Uber',
    category: 'Auto',
    fromName: 'Mumbai Naka',
    toName: 'Panchavati Karanja',
    distanceKm: 4.8,
    durationMin: 18,
    hourOfDay: 19,
    dayType: 'weekday',
    quotedFare: 105,
    surgeSeen: true,
    observedAt: '2026-10-16T19:30:00Z',
  },
  {
    id: 'obs_5',
    provider: 'Uber',
    category: 'Auto',
    fromName: 'Ramkund',
    toName: 'Tapovan',
    distanceKm: 2.8,
    durationMin: 10,
    hourOfDay: 10,
    dayType: 'weekend',
    quotedFare: 68,
    surgeSeen: false,
    observedAt: '2026-10-17T10:00:00Z',
  },
  {
    id: 'obs_6',
    provider: 'Uber',
    category: 'Auto',
    fromName: 'Indira Nagar',
    toName: 'CBS',
    distanceKm: 6.2,
    durationMin: 20,
    hourOfDay: 9,
    dayType: 'weekday',
    quotedFare: 130,
    surgeSeen: false,
    observedAt: '2026-10-17T09:20:00Z',
  },
];

/**
 * Calculates fare estimate range for a given profile, distance, duration, and hour.
 * Formula: max(minFare, base + max(0, km - includedKm) * perKm + min * perMin + bookingFee)
 * with night surcharge and peak multipliers applied.
 */
export function calculateCabFareEstimate(
  profile: CabFareProfile,
  distanceKm: number,
  durationMin: number,
  hourOfDay: number = 12
): { baseCalc: number; low: number; high: number; isNight: boolean } {
  const chargeableKm = Math.max(0, distanceKm - profile.includedKm);
  const rawFare =
    profile.baseFare +
    chargeableKm * profile.perKm +
    durationMin * profile.perMin +
    profile.bookingFee;
  const baseCalc = Math.max(profile.minFare, rawFare);

  let isNight = false;
  if (profile.nightStartHour > profile.nightEndHour) {
    isNight = hourOfDay >= profile.nightStartHour || hourOfDay < profile.nightEndHour;
  } else {
    isNight = hourOfDay >= profile.nightStartHour && hourOfDay < profile.nightEndHour;
  }

  const nightMultiplier = isNight ? 1 + profile.nightSurchargePct / 100 : 1.0;
  const fareWithNight = baseCalc * nightMultiplier;

  const low = Math.round(fareWithNight * profile.peakMultiplierMin);
  const high = Math.round(fareWithNight * profile.peakMultiplierMax);

  return {
    baseCalc: Math.round(baseCalc),
    low,
    high,
    isNight,
  };
}

export function getStoredCabProfiles(): CabFareProfile[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_CAB_PROFILES);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.warn('Could not read cab profiles from localStorage:', err);
  }
  return INITIAL_CAB_PROFILES;
}

export function saveStoredCabProfiles(profiles: CabFareProfile[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CAB_PROFILES, JSON.stringify(profiles));
    }
  } catch (err) {
    console.warn('Could not save cab profiles:', err);
  }
}

export function getStoredCabObservations(): CabFareObservation[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_CAB_OBS);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.warn('Could not read cab observations from localStorage:', err);
  }
  return INITIAL_CAB_OBSERVATIONS;
}

export function saveStoredCabObservations(obs: CabFareObservation[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CAB_OBS, JSON.stringify(obs));
    }
  } catch (err) {
    console.warn('Could not save cab observations:', err);
  }
}
