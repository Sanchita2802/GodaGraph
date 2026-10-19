/**
 * Time-Dependent Dijkstra Algorithm with Traffic Profiling & Timetable Headway
 *
 * Concepts:
 * - Edge traversal time is a non-linear function of departure time: c(e, t).
 * - FIFO Property: For every edge e and departure times t1 <= t2:
 *     t1 + c(e, t1) <= t2 + c(e, t2)
 *   Because traffic and vehicle departures preserve the FIFO property,
 *   Dijkstra's greedy label-setting property remains optimal.
 * - Headway-based wait time:
 *   If a bus has headway H minutes, the expected/scheduled waiting time at arrival time t is:
 *     wait_time = (H - (t % H)) % H
 * - Hourly Traffic Multipliers:
 *   Morning peak (08:00 - 11:00): 1.50x
 *   Evening peak (17:00 - 20:00): 1.65x
 *   Off-peak: 1.00x
 *   Walking edges are unaffected by motor traffic.
 *
 * Asymptotic Complexity:
 * - Time:  O((|V| + |E|) * log |V|)
 * - Space: O(|V| + |E|)
 */

import { MultiModalGraph } from './MultiModalGraph';
import { MinHeap } from './MinHeap';
import { TransitEdge } from '../types';

export function getTrafficMultiplier(minuteOfDay: number): number {
  const hour = minuteOfDay / 60;
  // Morning peak: 8:00 to 11:00
  if (hour >= 8 && hour <= 11) {
    return 1.45;
  }
  // Evening peak: 17:00 to 20:00
  if (hour >= 17 && hour <= 20) {
    return 1.6;
  }
  // Lunch slight bump: 12:30 to 14:00
  if (hour >= 12.5 && hour <= 14) {
    return 1.15;
  }
  // Late night / early morning
  if (hour >= 23 || hour <= 5) {
    return 0.85;
  }
  return 1.0;
}

export function computeEdgeCostAndTime(
  edge: TransitEdge,
  departureMinuteOfDay: number
): { travelMinutes: number; waitMinutes: number; totalMinutes: number } {
  let waitMinutes = 0;
  const trafficMult = edge.mode === 'walk' ? 1.0 : getTrafficMultiplier(departureMinuteOfDay);

  if (edge.mode === 'bus') {
    const headway = edge.headwayMinutes || 15;
    // Wait until next bus departure
    waitMinutes = (headway - (departureMinuteOfDay % headway)) % headway;
    if (waitMinutes === 0) waitMinutes = 2; // minimum boarding buffer
  } else if (edge.mode === 'auto') {
    waitMinutes = 3; // typical wait at auto stand or flagging down
  } else if (edge.mode === 'cab') {
    waitMinutes = 5; // typical dispatch time
  }

  const travelMinutes = edge.baseMinutes * trafficMult;
  return {
    waitMinutes,
    travelMinutes,
    totalMinutes: waitMinutes + travelMinutes,
  };
}

export interface TimeDependentResult {
  arrivalMinutes: Map<string, number>;
  previousEdge: Map<string, TransitEdge>;
  path: string[];
  totalMinutes: number;
  totalWaitMinutes: number;
  totalCostInr: number;
  departureTimeMinute: number;
  arrivalTimeMinute: number;
}

export function runTimeDependentDijkstra(
  graph: MultiModalGraph,
  sourceId: string,
  targetId: string,
  startMinuteOfDay: number // e.g. 540 = 09:00 AM
): TimeDependentResult {
  const heap = new MinHeap<{ nodeId: string }>();
  const arrivalMinutes = new Map<string, number>();
  const previousEdge = new Map<string, TransitEdge>();
  const visited = new Set<string>();

  arrivalMinutes.set(sourceId, startMinuteOfDay);
  heap.insert({ id: sourceId, priority: startMinuteOfDay, data: { nodeId: sourceId } });

  while (!heap.isEmpty()) {
    const minItem = heap.extractMin();
    if (!minItem) break;

    const u = minItem.id;
    const currentArrival = minItem.priority;

    if (visited.has(u)) continue;
    visited.add(u);

    if (u === targetId) break;

    const neighbors = graph.getNeighbors(u);
    for (const edge of neighbors) {
      const v = edge.to;
      if (visited.has(v)) continue;

      const { totalMinutes } = computeEdgeCostAndTime(edge, currentArrival);
      const newArrival = currentArrival + totalMinutes;
      const oldArrival = arrivalMinutes.get(v) ?? Infinity;

      if (newArrival < oldArrival) {
        arrivalMinutes.set(v, newArrival);
        previousEdge.set(v, edge);

        if (heap.contains(v)) {
          heap.decreaseKey(v, newArrival, { nodeId: v });
        } else {
          heap.insert({ id: v, priority: newArrival, data: { nodeId: v } });
        }
      }
    }
  }

  // Reconstruct path
  const path: string[] = [];
  let curr = targetId;
  let totalCost = 0;
  let totalWait = 0;

  if (arrivalMinutes.has(targetId)) {
    path.unshift(curr);
    let currentTime = arrivalMinutes.get(targetId)!;

    while (curr !== sourceId && previousEdge.has(curr)) {
      const edge = previousEdge.get(curr)!;
      totalCost += edge.costInr;
      curr = edge.from;
      path.unshift(curr);
    }
  }

  const finalArrival = arrivalMinutes.get(targetId) ?? startMinuteOfDay;

  return {
    arrivalMinutes,
    previousEdge,
    path,
    totalMinutes: finalArrival - startMinuteOfDay,
    totalWaitMinutes: totalWait,
    totalCostInr: totalCost,
    departureTimeMinute: startMinuteOfDay,
    arrivalTimeMinute: finalArrival,
  };
}
