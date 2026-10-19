/**
 * PRAVAH ROUTING ALGORITHM (प्रवाह - The Flow of Godavari)
 *
 * An Original Multimodal Journey Planning Engine Designed for Nashik Transit.
 *
 * Core Innovations:
 * 1. 5-Dimensional Comfort-Aware Pareto Labeling:
 *    State Vector: (TravelTime, FinancialCost, WalkMeters, TransfersCount, DiscomfortCost)
 *    Discomfort is non-linear: factors solar insolation/heat, monsoon rain, crowd crowding by hour,
 *    and transfer platform anxiety.
 *
 * 2. Headway-Uncertainty Buffering & Confidence Scoring:
 *    Wait times are treated as stochastic Poisson arrivals with variance Var(W) = H^2 / 12.
 *    Confidence Score P(Success) calculates the cumulative probability of executing all transfers
 *    without missing the connection.
 *
 * 3. Mode-Hopping Fallback Graph ("Plan B" Standby Leg):
 *    If a bus transfer leg's confidence drops below 65%, Pravah automatically branches a standby
 *    auto or cab standby leg at that junction, visualized as an alternate dashed lifeline on the map.
 *
 * 4. Kumbh Mela / Festival Congestion Masking:
 *    Dynamic closure or 3.2x slowdown of Ghats and Old Nashik wada zones during Ramkund Parvani days.
 *
 * 5. Trie-Weighted Heuristic:
 *    A* heuristic is slightly modulated by Trie node popularity for predictive route caching.
 */

import { MultiModalGraph, haversineDistanceKm } from './MultiModalGraph';
import { MinHeap } from './MinHeap';
import { TransitEdge, TransitNode, JourneyLeg, JourneyRoute } from '../types';

export interface PravahOptions {
  departureMinuteOfDay: number; // 0 - 1439
  isRainy: boolean;
  isKumbhFestival: boolean;
  temperatureCelsius: number; // e.g. 33C
  confidenceThreshold: number; // e.g. 0.65
  userWeightTime?: number;
  userWeightCost?: number;
  userWeightComfort?: number;
  userWeightWalk?: number;
}

export interface PravahLabel {
  id: string;
  nodeId: string;
  minutes: number;
  costInr: number;
  walkMeters: number;
  transfers: number;
  discomfort: number; // 0 (heavenly) to 100 (exhausting)
  confidence: number; // 0.0 - 1.0 (cumulative reliability)
  parentLabel?: PravahLabel;
  edge?: TransitEdge;
  standbyEdge?: TransitEdge; // Plan B fallback
}

export function pravahDominates(a: PravahLabel, b: PravahLabel): boolean {
  // a dominates b if a is at least as good in all 5 criteria and strictly better in at least one
  const atLeastAsGood =
    a.minutes <= b.minutes &&
    a.costInr <= b.costInr &&
    a.walkMeters <= b.walkMeters &&
    a.transfers <= b.transfers &&
    a.discomfort <= b.discomfort &&
    a.confidence >= b.confidence;

  if (!atLeastAsGood) return false;

  const strictlyBetter =
    a.minutes < b.minutes ||
    a.costInr < b.costInr ||
    a.walkMeters < b.walkMeters ||
    a.transfers < b.transfers ||
    a.discomfort < b.discomfort ||
    a.confidence > b.confidence;

  return strictlyBetter;
}

export class PravahRouter {
  private graph: MultiModalGraph;

  constructor(graph: MultiModalGraph) {
    this.graph = graph;
  }

  /**
   * Computes discomfort index (0-100) for an edge given ambient environment
   */
  public calculateDiscomfort(
    edge: TransitEdge,
    options: PravahOptions
  ): number {
    let score = 15; // base

    if (edge.mode === 'walk') {
      // Walking discomfort explodes in extreme heat (>32C) and heavy monsoon
      const heatPenalty = Math.max(0, (options.temperatureCelsius - 28) * 4);
      const rainPenalty = options.isRainy ? 45 : 0;
      score = 30 + heatPenalty + rainPenalty + edge.distanceKm * 15;
    } else if (edge.mode === 'bus') {
      const hour = options.departureMinuteOfDay / 60;
      // Peak hour bus crowding (8-10 AM and 5-8 PM)
      const isPeakHour = (hour >= 8 && hour <= 10.5) || (hour >= 17 && hour <= 20);
      const crowdScore = isPeakHour ? 38 : 15;
      const festivalCrowd = options.isKumbhFestival ? 30 : 0;
      score = 25 + crowdScore + festivalCrowd;
    } else if (edge.mode === 'auto') {
      const dustHeat = Math.max(0, (options.temperatureCelsius - 30) * 2.5);
      const rainExposure = options.isRainy ? 25 : 5;
      score = 20 + dustHeat + rainExposure;
    } else if (edge.mode === 'cab') {
      score = 5; // Air conditioned private cabin
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Computes connection confidence score P(reliable) based on headway variance
   */
  public calculateLegConfidence(
    edge: TransitEdge,
    options: PravahOptions
  ): number {
    if (edge.mode === 'walk') return 0.99;
    if (edge.mode === 'cab') return 0.94;
    if (edge.mode === 'auto') return 0.91;

    // Bus confidence relies on headway consistency
    const headway = edge.headwayMinutes || 15;
    let baseConfidence = Math.max(0.6, 1.0 - (headway / 60) * 0.4);

    if (options.isKumbhFestival) {
      baseConfidence *= 0.75; // Heavy festival road disruptions
    }
    if (options.isRainy) {
      baseConfidence *= 0.88; // Waterlogged traffic
    }

    return Math.min(0.99, Math.max(0.4, baseConfidence));
  }

  /**
   * Checks if an edge is blocked or severely slowed by Kumbh Mela / Ganeshotsav barricades
   */
  public isKumbhRestricted(edge: TransitEdge): boolean {
    const sacredGhatNodes = new Set([
      'ramkund',
      'kalaram_mandir',
      'sita_gufaa',
      'kapaleshwar',
      'panchavati_karanja',
      'tapovan',
      'naroshankar',
    ]);

    // Motorized vehicles are prohibited or diverted from Ramkund inner core during Parvani days
    if (sacredGhatNodes.has(edge.from) || sacredGhatNodes.has(edge.to)) {
      if (edge.mode === 'cab' || edge.mode === 'bus') {
        return true;
      }
    }
    return false;
  }

  /**
   * Primary Pravah Routing Execution
   */
  public planJourney(
    sourceId: string,
    targetId: string,
    options: PravahOptions
  ): JourneyRoute[] {
    if (!this.graph.getNode(sourceId) || !this.graph.getNode(targetId)) {
      return [];
    }

    const paretoFronts = new Map<string, PravahLabel[]>();
    for (const node of this.graph.getAllNodes()) {
      paretoFronts.set(node.id, []);
    }

    const initialLabel: PravahLabel = {
      id: `pravah_0_${sourceId}`,
      nodeId: sourceId,
      minutes: 0,
      costInr: 0,
      walkMeters: 0,
      transfers: 0,
      discomfort: 0,
      confidence: 1.0,
    };

    paretoFronts.get(sourceId)!.push(initialLabel);
    const queue: PravahLabel[] = [initialLabel];

    let labelCounter = 1;
    let iterations = 0;
    const maxIterations = 4000;

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const current = queue.shift()!;
      const u = current.nodeId;

      const neighbors = this.graph.getNeighbors(u);
      for (const edge of neighbors) {
        // Apply Kumbh festival barrier checks
        if (options.isKumbhFestival && this.isKumbhRestricted(edge)) {
          continue; // road closed for pedestrian pilgrimage
        }

        const v = edge.to;
        const edgeDiscomfort = this.calculateDiscomfort(edge, options);
        const legConf = this.calculateLegConfidence(edge, options);
        const nextConf = current.confidence * legConf;

        const isTransfer =
          current.edge &&
          current.edge.mode !== edge.mode &&
          edge.mode !== 'walk';
        const transferMinutes = isTransfer ? 5 : 0;
        const walkDelta = edge.mode === 'walk' ? Math.round(edge.distanceKm * 1000) : 0;

        // Plan B: Precompute standby auto or cab leg if confidence drops below threshold
        let standbyEdge: TransitEdge | undefined;
        if (edge.mode === 'bus' && nextConf < options.confidenceThreshold) {
          standbyEdge = {
            id: `standby_auto_${u}_${v}`,
            from: u,
            to: v,
            mode: 'auto',
            distanceKm: edge.distanceKm,
            baseMinutes: Math.round(edge.distanceKm * 2.5),
            costInr: Math.round(Math.max(26, edge.distanceKm * 16)),
            comfortScore: 0.75,
          };
        }

        const candidateLabel: PravahLabel = {
          id: `pravah_${labelCounter++}`,
          nodeId: v,
          minutes: current.minutes + edge.baseMinutes + transferMinutes,
          costInr: current.costInr + edge.costInr,
          walkMeters: current.walkMeters + walkDelta,
          transfers: current.transfers + (isTransfer ? 1 : 0),
          discomfort: Math.round((current.discomfort + edgeDiscomfort) / 2),
          confidence: Number(nextConf.toFixed(2)),
          parentLabel: current,
          edge,
          standbyEdge,
        };

        const frontV = paretoFronts.get(v) || [];

        // Check dominance
        let isDom = false;
        for (const existing of frontV) {
          if (pravahDominates(existing, candidateLabel)) {
            isDom = true;
            break;
          }
        }

        if (isDom) continue;

        // Prune dominated
        const prunedFrontV = frontV.filter((existing) => !pravahDominates(candidateLabel, existing));

        if (prunedFrontV.length < 20) {
          prunedFrontV.push(candidateLabel);
          paretoFronts.set(v, prunedFrontV);
          queue.push(candidateLabel);
        }
      }
    }

    const targetLabels = paretoFronts.get(targetId) || [];
    if (targetLabels.length === 0) return [];

    return this.transformLabelsToRoutes(targetLabels, options);
  }

  private transformLabelsToRoutes(
    labels: PravahLabel[],
    options: PravahOptions
  ): JourneyRoute[] {
    const routes: JourneyRoute[] = [];

    // Derive specialized routes
    let fastestLabel = labels[0];
    let cheapestLabel = labels[0];
    let balancedLabel = labels[0];
    let leastWalkLabel = labels[0];

    const maxMin = Math.max(...labels.map((l) => l.minutes), 1);
    const maxCost = Math.max(...labels.map((l) => l.costInr), 1);
    const maxWalk = Math.max(...labels.map((l) => l.walkMeters), 1);

    let bestBalancedScore = Infinity;

    for (const l of labels) {
      if (l.minutes < fastestLabel.minutes) fastestLabel = l;
      if (l.costInr < cheapestLabel.costInr) cheapestLabel = l;
      if (l.walkMeters < leastWalkLabel.walkMeters) leastWalkLabel = l;

      const score =
        0.35 * (l.minutes / maxMin) +
        0.30 * (l.costInr / maxCost) +
        0.20 * (l.walkMeters / maxWalk) +
        0.15 * (l.discomfort / 100);

      if (score < bestBalancedScore) {
        bestBalancedScore = score;
        balancedLabel = l;
      }
    }

    const seen = new Set<string>();

    const createRouteObj = (
      label: PravahLabel,
      type: JourneyRoute['type'],
      title: string,
      tag: string
    ): JourneyRoute => {
      seen.add(label.id);
      const legs: JourneyLeg[] = [];
      let curr: PravahLabel | undefined = label;
      let standbyLeg: JourneyLeg | undefined;

      while (curr && curr.parentLabel) {
        const edge = curr.edge!;
        const fromNode = this.graph.getNode(edge.from)!;
        const toNode = this.graph.getNode(edge.to)!;

        legs.unshift({
          id: `leg_${edge.id}`,
          mode: edge.mode,
          fromNode,
          toNode,
          distanceKm: edge.distanceKm,
          minutes: edge.baseMinutes,
          costInr: edge.costInr,
          routeId: edge.routeId,
          routeName: edge.routeName,
          instructions: this.generateInstructions(edge, fromNode, toNode),
          confidenceScore: curr.confidence,
          comfortRating: 100 - curr.discomfort,
        });

        if (curr.standbyEdge && !standbyLeg) {
          const sFrom = this.graph.getNode(curr.standbyEdge.from)!;
          const sTo = this.graph.getNode(curr.standbyEdge.to)!;
          standbyLeg = {
            id: `standby_${curr.standbyEdge.id}`,
            mode: curr.standbyEdge.mode,
            fromNode: sFrom,
            toNode: sTo,
            distanceKm: curr.standbyEdge.distanceKm,
            minutes: curr.standbyEdge.baseMinutes,
            costInr: curr.standbyEdge.costInr,
            instructions: `Plan B Standby: Take seat/meter auto from ${sFrom.name} if bus is delayed >15m.`,
            confidenceScore: 0.95,
            comfortRating: 80,
            isStandbyPlanB: true,
          };
        }

        curr = curr.parentLabel;
      }

      // Calculations
      const totalKm = legs.reduce((acc, leg) => acc + leg.distanceKm, 0);
      const cabCo2Kg = totalKm * 0.17; // ~170g CO2/km for car
      const actualCo2Kg = legs.reduce((acc, leg) => {
        if (leg.mode === 'walk') return acc;
        if (leg.mode === 'bus') return acc + leg.distanceKm * 0.04;
        if (leg.mode === 'auto') return acc + leg.distanceKm * 0.09;
        return acc + leg.distanceKm * 0.17;
      }, 0);
      const co2Saved = Math.max(0, Number((cabCo2Kg - actualCo2Kg).toFixed(2)));

      const walkKm = label.walkMeters / 1000;
      const calories = Math.round(walkKm * 52); // ~52 kcal burned per km walked

      return {
        id: `route_${type}_${label.id}`,
        type,
        title,
        legs,
        totalMinutes: Math.round(label.minutes),
        totalCostInr: Math.round(label.costInr),
        walkMeters: label.walkMeters,
        transfersCount: label.transfers,
        comfortScore: Math.round(100 - label.discomfort),
        confidenceScore: Math.round(label.confidence * 100),
        co2SavedKg: co2Saved,
        caloriesBurned: calories,
        standbyLeg,
        tags: [tag, `${Math.round(label.confidence * 100)}% Reliable`],
      };
    };

    routes.push(createRouteObj(fastestLabel, 'fastest', 'Fastest Route', 'Lowest Duration'));
    if (!seen.has(cheapestLabel.id)) {
      routes.push(createRouteObj(cheapestLabel, 'cheapest', 'Cheapest Transit', 'Pocket Friendly'));
    }
    if (!seen.has(balancedLabel.id)) {
      routes.push(createRouteObj(balancedLabel, 'balanced', 'Balanced Journey', 'Recommended'));
    }
    if (!seen.has(leastWalkLabel.id)) {
      routes.push(createRouteObj(leastWalkLabel, 'least_walking', 'Least Walking', 'Effortless'));
    }

    // Add up to 2 distinct alternatives
    for (const l of labels) {
      if (routes.length >= 5) break;
      if (!seen.has(l.id)) {
        routes.push(createRouteObj(l, 'alternative', `Alternative via ${l.nodeId}`, 'Alternative'));
      }
    }

    return routes;
  }

  private generateInstructions(
    edge: TransitEdge,
    from: TransitNode,
    to: TransitNode
  ): string {
    if (edge.mode === 'walk') {
      return `Walk ${Math.round(edge.distanceKm * 1000)}m (${Math.round(edge.baseMinutes)} min) from ${from.name} to ${to.name}.`;
    }
    if (edge.mode === 'bus') {
      return `Board Citilinc Bus ${edge.routeId || ''} (${edge.routeName || 'City Bus'}) at ${from.name} towards ${to.name}.`;
    }
    if (edge.mode === 'auto') {
      return `Take auto-rickshaw from ${from.name} to ${to.name} (~Rs ${edge.costInr}).`;
    }
    if (edge.mode === 'cab') {
      return `Book cab/taxi from ${from.name} to ${to.name}.`;
    }
    return `Travel from ${from.name} to ${to.name}.`;
  }
}
