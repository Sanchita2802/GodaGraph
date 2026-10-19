/**
 * A* Heuristic Search Algorithm
 *
 * Concepts:
 * - Evaluation function: f(n) = g(n) + h(n)
 *   where g(n) is the exact cost from source to n,
 *   and h(n) is the admissible Haversine distance heuristic.
 * - Admissibility & Consistency:
 *   h(n) = (haversineDistanceKm(n, target) / MAX_SPEED_KMH) * 60 minutes
 *   Because real transit never exceeds MAX_SPEED_KMH (60 km/h in city traffic),
 *   h(n) <= true remaining time h*(n), guaranteeing that A* finds the optimal shortest path.
 *
 * Asymptotic Complexity:
 * - Worst-case Time:  O((|V| + |E|) * log |V|) (identical to Dijkstra)
 * - Typical Time:     O(b^d) with substantially lower branching factor 'b' due to directed goal-directed pruning.
 * - Space Complexity: O(|V|)
 */

import { MultiModalGraph, haversineDistanceKm } from './MultiModalGraph';
import { MinHeap } from './MinHeap';
import { DsaAlgorithmTraceStep, TransitEdge } from '../types';

export interface AStarResult {
  distances: Map<string, number>; // g-scores
  fScores: Map<string, number>;
  previousEdge: Map<string, TransitEdge>;
  path: string[];
  totalDistanceKm: number;
  totalMinutes: number;
  nodesExpanded: number;
  heapOperations: number;
  runtimeMs: number;
  trace: DsaAlgorithmTraceStep[];
}

export function runAStar(
  graph: MultiModalGraph,
  sourceId: string,
  targetId: string,
  maxSpeedKmh: number = 60
): AStarResult {
  const startTime = performance.now();
  const targetNode = graph.getNode(targetId);
  const sourceNode = graph.getNode(sourceId);

  const heap = new MinHeap<{ nodeId: string }>();
  const gScores = new Map<string, number>();
  const fScores = new Map<string, number>();
  const previousEdge = new Map<string, TransitEdge>();
  const visited = new Set<string>();
  const trace: DsaAlgorithmTraceStep[] = [];

  let nodesExpanded = 0;

  // Heuristic function: Admissible time lower-bound in minutes
  const heuristic = (nodeId: string): number => {
    if (!targetNode) return 0;
    const node = graph.getNode(nodeId);
    if (!node) return 0;
    const distKm = haversineDistanceKm(node.lat, node.lng, targetNode.lat, targetNode.lng);
    return (distKm / maxSpeedKmh) * 60; // minutes
  };

  const initialH = heuristic(sourceId);
  gScores.set(sourceId, 0);
  fScores.set(sourceId, initialH);
  heap.insert({ id: sourceId, priority: initialH, data: { nodeId: sourceId } });

  trace.push({
    step: 0,
    currentNodeId: sourceId,
    visitedNodes: [],
    frontierNodes: [sourceId],
    relaxedEdges: [],
    currentDistanceMap: { [sourceId]: 0 },
    heapState: heap.getSnapshot(),
    description: `Initialized A* search. Source "${sourceId}", Heuristic h = ${initialH.toFixed(1)}m.`,
  });

  while (!heap.isEmpty()) {
    const minItem = heap.extractMin();
    if (!minItem) break;

    const u = minItem.id;
    const currentG = gScores.get(u) ?? Infinity;

    if (visited.has(u)) continue;
    visited.add(u);
    nodesExpanded++;

    if (u === targetId) {
      trace.push({
        step: trace.length,
        currentNodeId: u,
        visitedNodes: Array.from(visited),
        frontierNodes: heap.getSnapshot().map((h) => h.id),
        relaxedEdges: [],
        currentDistanceMap: Object.fromEntries(gScores.entries()),
        heapState: heap.getSnapshot(),
        description: `Goal "${targetId}" reached! A* pruned search space using Haversine heuristic.`,
      });
      break;
    }

    const relaxedInThisStep: { from: string; to: string; weight: number }[] = [];
    const neighbors = graph.getNeighbors(u);

    for (const edge of neighbors) {
      const v = edge.to;
      if (visited.has(v)) continue;

      const tentativeG = currentG + edge.baseMinutes;
      const oldG = gScores.get(v) ?? Infinity;

      if (tentativeG < oldG) {
        gScores.set(v, tentativeG);
        const fScore = tentativeG + heuristic(v);
        fScores.set(v, fScore);
        previousEdge.set(v, edge);
        relaxedInThisStep.push({ from: u, to: v, weight: edge.baseMinutes });

        if (heap.contains(v)) {
          heap.decreaseKey(v, fScore, { nodeId: v });
        } else {
          heap.insert({ id: v, priority: fScore, data: { nodeId: v } });
        }
      }
    }

    trace.push({
      step: trace.length,
      currentNodeId: u,
      visitedNodes: Array.from(visited),
      frontierNodes: heap.getSnapshot().map((h) => h.id),
      relaxedEdges: relaxedInThisStep,
      currentDistanceMap: Object.fromEntries(gScores.entries()),
      heapState: heap.getSnapshot(),
      description: `Expanded "${u}" (f = ${minItem.priority.toFixed(1)}m). Relaxed ${relaxedInThisStep.length} edges toward target.`,
    });
  }

  // Path reconstruction
  const path: string[] = [];
  let curr = targetId;
  let totalKm = 0;
  let totalMin = 0;

  if (gScores.has(targetId)) {
    path.unshift(curr);
    while (curr !== sourceId && previousEdge.has(curr)) {
      const edge = previousEdge.get(curr)!;
      totalKm += edge.distanceKm;
      totalMin += edge.baseMinutes;
      curr = edge.from;
      path.unshift(curr);
    }
  }

  const endTime = performance.now();

  return {
    distances: gScores,
    fScores,
    previousEdge,
    path,
    totalDistanceKm: totalKm,
    totalMinutes: totalMin,
    nodesExpanded,
    heapOperations: heap.operationCount,
    runtimeMs: Math.max(0.1, Number((endTime - startTime).toFixed(2))),
    trace,
  };
}
