/**
 * Dijkstra's Single-Source Shortest Path Algorithm
 *
 * Implementation:
 * - Uses our custom Binary Min-Heap with Indexed Decrease-Key.
 * - Extracts minimal tentative distance node in O(log |V|).
 * - Relaxes incident edges and triggers decreaseKey in O(log |V|).
 * - Exposes detailed execution traces for the DSA Lab animation.
 *
 * Asymptotic Complexity:
 * - Time Complexity:  O((|V| + |E|) * log |V|)
 * - Space Complexity: O(|V| + |E|) for distance table, parent pointers, heap and trace
 */

import { MultiModalGraph } from './MultiModalGraph';
import { MinHeap } from './MinHeap';
import { DsaAlgorithmTraceStep, TransitEdge } from '../types';

export interface DijkstraResult {
  distances: Map<string, number>;
  previousEdge: Map<string, TransitEdge>;
  path: string[];
  totalDistanceKm: number;
  totalMinutes: number;
  nodesExpanded: number;
  heapOperations: number;
  runtimeMs: number;
  trace: DsaAlgorithmTraceStep[];
}

export function runDijkstra(
  graph: MultiModalGraph,
  sourceId: string,
  targetId: string,
  metric: 'minutes' | 'distance' | 'cost' = 'minutes'
): DijkstraResult {
  const startTime = performance.now();
  const heap = new MinHeap<{ nodeId: string }>();
  const distances = new Map<string, number>();
  const previousEdge = new Map<string, TransitEdge>();
  const visited = new Set<string>();
  const trace: DsaAlgorithmTraceStep[] = [];

  let nodesExpanded = 0;

  // Initialize source
  distances.set(sourceId, 0);
  heap.insert({ id: sourceId, priority: 0, data: { nodeId: sourceId } });

  // Initial trace step
  trace.push({
    step: 0,
    currentNodeId: sourceId,
    visitedNodes: [],
    frontierNodes: [sourceId],
    relaxedEdges: [],
    currentDistanceMap: { [sourceId]: 0 },
    heapState: heap.getSnapshot(),
    description: `Initialized Dijkstra from source "${sourceId}". Tentative distance is 0.`,
  });

  while (!heap.isEmpty()) {
    const minItem = heap.extractMin();
    if (!minItem) break;

    const u = minItem.id;
    const currentDist = minItem.priority;

    if (visited.has(u)) continue;
    visited.add(u);
    nodesExpanded++;

    // Early termination if target reached
    if (u === targetId) {
      trace.push({
        step: trace.length,
        currentNodeId: u,
        visitedNodes: Array.from(visited),
        frontierNodes: heap.getSnapshot().map((h) => h.id),
        relaxedEdges: [],
        currentDistanceMap: Object.fromEntries(distances.entries()),
        heapState: heap.getSnapshot(),
        description: `Target destination "${targetId}" reached with optimal cost ${currentDist.toFixed(1)}.`,
      });
      break;
    }

    const relaxedInThisStep: { from: string; to: string; weight: number }[] = [];
    const neighbors = graph.getNeighbors(u);

    for (const edge of neighbors) {
      const v = edge.to;
      if (visited.has(v)) continue;

      let edgeWeight = edge.baseMinutes;
      if (metric === 'distance') edgeWeight = edge.distanceKm;
      else if (metric === 'cost') edgeWeight = edge.costInr;

      const newDist = currentDist + edgeWeight;
      const oldDist = distances.get(v) ?? Infinity;

      if (newDist < oldDist) {
        distances.set(v, newDist);
        previousEdge.set(v, edge);
        relaxedInThisStep.push({ from: u, to: v, weight: edgeWeight });

        if (heap.contains(v)) {
          heap.decreaseKey(v, newDist, { nodeId: v });
        } else {
          heap.insert({ id: v, priority: newDist, data: { nodeId: v } });
        }
      }
    }

    // Add trace frame
    trace.push({
      step: trace.length,
      currentNodeId: u,
      visitedNodes: Array.from(visited),
      frontierNodes: heap.getSnapshot().map((h) => h.id),
      relaxedEdges: relaxedInThisStep,
      currentDistanceMap: Object.fromEntries(distances.entries()),
      heapState: heap.getSnapshot(),
      description: `Expanded node "${u}". Relaxed ${relaxedInThisStep.length} outgoing edges.`,
    });
  }

  // Reconstruct path
  const path: string[] = [];
  let curr = targetId;
  let totalKm = 0;
  let totalMin = 0;

  if (distances.has(targetId)) {
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
    distances,
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
