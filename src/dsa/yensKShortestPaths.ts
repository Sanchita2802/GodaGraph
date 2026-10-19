/**
 * Yen's K-Shortest Loopless Paths Algorithm (K=5)
 *
 * Concepts:
 * - Computes the top K unique loopless paths between source and destination.
 * - Decomposes each candidate path into:
 *     Path = Root Path (from source to spur node) + Spur Path (from spur node to target).
 * - Systematically masks out used edges to avoid duplicate prefixes,
 *   guaranteeing loopless alternate route exploration.
 *
 * Asymptotic Complexity:
 * - Time:  O(K * |V| * (|E| + |V| * log |V|))
 * - Space: O(K * |V|) for storing candidate paths and spur trees
 */

import { MultiModalGraph } from './MultiModalGraph';
import { runDijkstra } from './dijkstra';
import { TransitEdge } from '../types';

export interface YenPath {
  nodes: string[];
  edges: TransitEdge[];
  totalMinutes: number;
  totalDistanceKm: number;
  totalCostInr: number;
}

export function yensKShortestPaths(
  graph: MultiModalGraph,
  sourceId: string,
  targetId: string,
  K: number = 5
): YenPath[] {
  // First shortest path A[0]
  const firstResult = runDijkstra(graph, sourceId, targetId, 'minutes');
  if (firstResult.path.length === 0) return [];

  const buildEdgesFromNodes = (nodeList: string[]): TransitEdge[] => {
    const edges: TransitEdge[] = [];
    for (let i = 0; i < nodeList.length - 1; i++) {
      const u = nodeList[i];
      const v = nodeList[i + 1];
      const neighbors = graph.getNeighbors(u);
      const matched = neighbors.find((e) => e.to === v) || {
        id: `virtual_${u}_${v}`,
        from: u,
        to: v,
        mode: 'walk',
        distanceKm: 0.5,
        baseMinutes: 5,
        costInr: 0,
        comfortScore: 0.5,
      };
      edges.push(matched);
    }
    return edges;
  };

  const calculatePathMetrics = (edges: TransitEdge[]): { minutes: number; km: number; cost: number } => {
    let min = 0, km = 0, cost = 0;
    for (const e of edges) {
      min += e.baseMinutes;
      km += e.distanceKm;
      cost += e.costInr;
    }
    return { minutes: min, km, cost };
  };

  const firstEdges = buildEdgesFromNodes(firstResult.path);
  const firstMetrics = calculatePathMetrics(firstEdges);

  const A: YenPath[] = [
    {
      nodes: firstResult.path,
      edges: firstEdges,
      totalMinutes: firstMetrics.minutes,
      totalDistanceKm: firstMetrics.km,
      totalCostInr: firstMetrics.cost,
    },
  ];

  const B: YenPath[] = []; // Potential candidates pool

  for (let k = 1; k < K; k++) {
    const previousPath = A[k - 1];

    for (let i = 0; i < previousPath.nodes.length - 1; i++) {
      const spurNode = previousPath.nodes[i];
      const rootPathNodes = previousPath.nodes.slice(0, i + 1);

      // Mask out edges that were part of previous paths with same root
      const disabledEdges = new Set<string>();
      for (const p of A) {
        if (p.nodes.length > i && p.nodes.slice(0, i + 1).every((val, idx) => val === rootPathNodes[idx])) {
          const nextNode = p.nodes[i + 1];
          disabledEdges.add(`${spurNode}->${nextNode}`);
        }
      }

      // Create a temporary sub-graph masking disabled edges and root nodes
      const tempGraph = new MultiModalGraph();
      for (const node of graph.getAllNodes()) {
        tempGraph.addNode(node);
      }

      const maskedNodes = new Set(rootPathNodes.slice(0, -1));

      for (const edge of graph.allEdges) {
        if (maskedNodes.has(edge.from) || maskedNodes.has(edge.to)) continue;
        if (disabledEdges.has(`${edge.from}->${edge.to}`)) continue;
        tempGraph.addEdge(edge);
      }

      // Compute spur path from spurNode to target
      const spurResult = runDijkstra(tempGraph, spurNode, targetId, 'minutes');

      if (spurResult.path.length > 0) {
        const totalPathNodes = [...rootPathNodes.slice(0, -1), ...spurResult.path];
        const pathEdges = buildEdgesFromNodes(totalPathNodes);
        const metrics = calculatePathMetrics(pathEdges);

        const candidate: YenPath = {
          nodes: totalPathNodes,
          edges: pathEdges,
          totalMinutes: metrics.minutes,
          totalDistanceKm: metrics.km,
          totalCostInr: metrics.cost,
        };

        // Ensure candidate isn't already in B or A
        const isDuplicate =
          A.some((p) => p.nodes.join('>') === candidate.nodes.join('>')) ||
          B.some((p) => p.nodes.join('>') === candidate.nodes.join('>'));

        if (!isDuplicate) {
          B.push(candidate);
        }
      }
    }

    if (B.length === 0) break;

    // Sort B by totalMinutes and extract best candidate
    B.sort((a, b) => a.totalMinutes - b.totalMinutes);
    const bestCandidate = B.shift()!;
    A.push(bestCandidate);
  }

  return A;
}
