export type StopType = 'bus_stop' | 'landmark' | 'railway' | 'junction';

export interface TransitNode {
  id: string;
  name: string;
  nameMr: string;
  nameHi: string;
  lat: number;
  lng: number;
  type: StopType;
  serves: string[]; // route ids
  popularity: number; // 1 - 100
  aliases?: string[];
  description?: string;
  // Extended layer metadata (all optional for backward compatibility)
  source?: 'seed' | 'osm' | 'user';
  osmId?: number | string;
  tier?: 'A' | 'B' | 'C' | 'D';
  confidence?: number; // 0-1
  lastVerified?: string; // ISO date
  nameSource?: 'osm' | 'ai' | 'seed';
  verified?: boolean;
}

export type TransitMode = 'walk' | 'bus' | 'auto' | 'cab' | 'transfer';

export interface TransitEdge {
  id: string;
  from: string;
  to: string;
  mode: TransitMode;
  distanceKm: number;
  baseMinutes: number;
  routeId?: string;
  routeName?: string;
  costInr: number;
  comfortScore: number; // 0 (uncomfortable) to 1 (luxurious/sheltered)
  headwayMinutes?: number; // for buses
  frequencyPerHr?: number;
}

export interface BusRouteInfo {
  id: string;
  name: string;
  number: string;
  origin: string;
  destination: string;
  stops: string[]; // array of node ids
  headwayMinutes: number; // e.g. 15-20 min
  firstBus: string; // e.g. "06:00"
  lastBus: string; // e.g. "22:30"
  color: string;
}

export interface SharedAutoCorridor {
  id: string;
  name: string;
  from: string;
  to: string;
  stops: string[];
  perSeatFare: number;
  frequencyMinutes: number;
}

export interface FareSettings {
  busBaseFare: number;
  busPerStage: number;
  autoMeterBase: number; // e.g. Rs 26 for first 1.5 km
  autoMeterPerKm: number; // e.g. Rs 15.33 / km
  sharedAutoBase: number;
  cabBase: number;
  cabPerKm: number;
  cabPerMin: number;
  surgeMultiplier: number;
  walkSpeedKmh: number;
}

export interface JourneyLeg {
  id: string;
  mode: TransitMode;
  fromNode: TransitNode;
  toNode: TransitNode;
  distanceKm: number;
  minutes: number;
  costInr: number;
  routeId?: string;
  routeName?: string;
  instructions: string;
  confidenceScore: number; // 0.0 - 1.0 (uncertainty buffer)
  comfortRating: number;
  polyline?: [number, number][];
  isStandbyPlanB?: boolean;
}

export interface JourneyRoute {
  id: string;
  type: 'fastest' | 'cheapest' | 'balanced' | 'least_walking' | 'alternative';
  title: string;
  legs: JourneyLeg[];
  totalMinutes: number;
  totalCostInr: number;
  walkMeters: number;
  transfersCount: number;
  comfortScore: number; // 0-100
  confidenceScore: number; // 0-100%
  co2SavedKg: number; // vs single-occupancy cab
  caloriesBurned: number;
  standbyLeg?: JourneyLeg; // Mode-Hopping Plan B standby auto/cab leg
  localFriendTip?: string;
  tags: string[];
}

export interface DsaAlgorithmTraceStep {
  step: number;
  currentNodeId: string;
  visitedNodes: string[];
  frontierNodes: string[];
  relaxedEdges: { from: string; to: string; weight: number }[];
  currentDistanceMap: Record<string, number>;
  heapState: { id: string; priority: number }[];
  description: string;
}

export interface DsaRaceStats {
  algorithm: 'dijkstra' | 'aStar' | 'pravah';
  nodesExpanded: number;
  heapOperations: number;
  runtimeMs: number;
  pathLengthKm: number;
  pathMinutes: number;
  costInr: number;
  foundPath: string[];
}

export interface PlaceCategory {
  id: 'temple' | 'ghat' | 'winery' | 'market' | 'nature' | 'heritage';
  name: string;
  nameMr: string;
  nameHi: string;
  icon: string;
}

export interface PlaceItem {
  id: string;
  name: string;
  nameMr: string;
  nameHi: string;
  category: PlaceCategory['id'];
  lat: number;
  lng: number;
  nodeId: string; // nearest transit node
  rating: number;
  tagline: string;
  description: string;
  timing: string;
  bestTime: string;
  funFact?: string;
  imageUrl?: string;
}

// ================= FEATURE 4: CAB DATABASE & OBSERVATIONS =================

export type CabProvider = 'Uber' | 'Ola' | 'Other';
export type CabCategory = 'Auto' | 'Mini/Go' | 'Sedan/Prime' | 'SUV/XL' | 'Bike';
export type CabAvailability = 'confirmed' | 'unverified' | 'not_available';
export type CabSource = 'seed_estimate' | 'user_screenshot' | 'official';

export interface CabFareProfile {
  id: string;
  provider: CabProvider;
  category: CabCategory;
  baseFare: number;
  includedKm: number;
  perKm: number;
  perMin: number;
  minFare: number;
  bookingFee: number;
  waitingPerMin: number;
  nightSurchargePct: number;
  nightStartHour: number;
  nightEndHour: number;
  peakMultiplierMin: number;
  peakMultiplierMax: number;
  availabilityInNashik: CabAvailability;
  source: CabSource;
  lastVerified: string;
  notes: string;
}

export interface CabFareObservation {
  id: string;
  provider: CabProvider;
  category: CabCategory;
  fromName: string;
  toName: string;
  distanceKm: number;
  durationMin: number;
  hourOfDay: number;
  dayType: 'weekday' | 'weekend';
  quotedFare: number;
  surgeSeen: boolean;
  observedAt: string;
}
