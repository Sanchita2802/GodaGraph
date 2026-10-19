/**
 * Multi-Criteria Pareto Labeling Algorithm
 *
 * Concepts:
 * - Multi-objective Optimization: Real multimodal journey decisions involve competing trade-offs:
 *   (1) Travel Time (minutes)
 *   (2) Monetary Cost (Rupees)
 *   (3) Walking Distance (meters)
 *   (4) Number of Transfers (mode switches)
 *
 * Pareto Dominance Definition:
 *   Label L1 dominates L2 (L1 ≺ L2) iff:
 *   L1.minutes <= L2.minutes AND
 *   L1.costInr <= L2.costInr AND
 *   L1.walkMeters <= L2.walkMeters AND
 *   L1.transfers <= L2.transfers AND
 *   at least one inequality is strictly '<'.
 *
 * Label Setting / Correcting with Pruning:
 *   At each node v, we maintain a non-dominated Pareto Front P(v).
 *   A new candidate label is discarded immediately if any existing label dominates it.
 *   Conversely, any existing label dominated by the new candidate is pruned.
 *
 * Asymptotic Complexity:
 * - Time:  O(|E| * |P_max|^2) where |P_max| is the maximum Pareto front size per node.
 * - Space: O(|V| * |P_max|)
 */

import { MultiModalGraph } from './MultiModalGraph';
import { TransitEdge, TransitMode } from '../types';

export interface ParetoLabel {
  id: string;
  nodeId: string;
  minutes: number;
  costInr: number;
  walkMeters: number;
  transfers: number;
  lastMode?: TransitMode;
  parentLabel?: ParetoLabel;
  edge?: TransitEdge;
}

export function dominates(l1: ParetoLabel, l2: ParetoLabel): boolean {
  const atLeastAsGood =
    l1.minutes <= l2.minutes &&
    l1.costInr <= l2.costInr &&
    l1.walkMeters <= l2.walkMeters &&
    l1.transfers <= l2.transfers;

  if (!atLeastAsGood) return false;

  const strictlyBetter =
    l1.minutes < l2.minutes ||
    l1.costInr < l2.costInr ||
    l1.walkMeters < l2.walkMeters ||
    l1.transfers < l2.transfers;

  return strictlyBetter;
}

export interface ParetoResults {
  allParetoLabels: ParetoLabel[];
  fastest?: ParetoLabel;
  cheapest?: ParetoLabel;
  leastWalking?: ParetoLabel;
  balanced?: ParetoLabel;
  alternatives: ParetoLabel[];
}

export function runParetoLabeling(
  graph: MultiModalGraph,
  sourceId: string,
  targetId: string,
  maxFrontierPerNode: number = 25
): ParetoResults {
  const paretoFronts = new Map<string, ParetoLabel[]>();
  for (const node of graph.getAllNodes()) {
    paretoFronts.set(node.id, []);
  }

  // Queue of labels to expand
  const queue: ParetoLabel[] = [];

  const initialLabel: ParetoLabel = {
    id: `label_root_${sourceId}`,
    nodeId: sourceId,
    minutes: 0,
    costInr: 0,
    walkMeters: 0,
    transfers: 0,
  };

  paretoFronts.get(sourceId)!.push(initialLabel);
  queue.push(initialLabel);

  let labelCounter = 1;
  const maxIterations = 3500; // Guard against infinite looping
  let iterations = 0;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const current = queue.shift()!;
    const u = current.nodeId;

    const neighbors = graph.getNeighbors(u);
    for (const edge of neighbors) {
      const v = edge.to;
      const walkDelta = edge.mode === 'walk' ? Math.round(edge.distanceKm * 1000) : 0;
      const isTransfer = current.lastMode && current.lastMode !== edge.mode && edge.mode !== 'walk';
      const transferDelta = isTransfer ? 1 : 0;

      const candidateLabel: ParetoLabel = {
        id: `label_${labelCounter++}`,
        nodeId: v,
        minutes: current.minutes + edge.baseMinutes + (isTransfer ? 4 : 0),
        costInr: current.costInr + edge.costInr,
        walkMeters: current.walkMeters + walkDelta,
        transfers: current.transfers + transferDelta,
        lastMode: edge.mode,
        parentLabel: current,
        edge,
      };

      const frontV = paretoFronts.get(v) || [];

      // Check if candidate is dominated by any label currently in frontV
      let isDominated = false;
      for (const existing of frontV) {
        if (dominates(existing, candidateLabel)) {
          isDominated = true;
          break;
        }
      }

      if (isDominated) continue;

      // Filter out existing labels in frontV that candidate dominates
      const updatedFrontV = frontV.filter((existing) => !dominates(candidateLabel, existing));

      if (updatedFrontV.length < maxFrontierPerNode) {
        updatedFrontV.push(candidateLabel);
        paretoFronts.set(v, updatedFrontV);
        queue.push(candidateLabel);
      }
    }
  }

  const targetLabels = paretoFronts.get(targetId) || [];
  if (targetLabels.length === 0) {
    return { allParetoLabels: [], alternatives: [] };
  }

  // Derive specialized labels
  let fastest = targetLabels[0];
  let cheapest = targetLabels[0];
  let leastWalking = targetLabels[0];

  for (const label of targetLabels) {
    if (label.minutes < fastest.minutes) fastest = label;
    if (label.costInr < cheapest.costInr) cheapest = label;
    if (label.walkMeters < leastWalking.walkMeters) leastWalking = label;
  }

  // Balanced calculation: find label that minimizes normalized composite score
  const maxMin = Math.max(...targetLabels.map((l) => l.minutes), 1);
  const maxCost = Math.max(...targetLabels.map((l) => l.costInr), 1);
  const maxWalk = Math.max(...targetLabels.map((l) => l.walkMeters), 1);

  let bestBalancedScore = Infinity;
  let balanced = targetLabels[0];

  for (const label of targetLabels) {
    const score =
      0.45 * (label.minutes / maxMin) +
      0.35 * (label.costInr / maxCost) +
      0.20 * (label.walkMeters / maxWalk);

    if (score < bestBalancedScore) {
      bestBalancedScore = score;
      balanced = label;
    }
  }

  // Pick remaining distinct alternatives
  const selectedIds = new Set([fastest.id, cheapest.id, leastWalking.id, balanced.id]);
  const alternatives = targetLabels.filter((l) => !selectedIds.has(l.id)).slice(0, 5);

  return {
    allParetoLabels: targetLabels,
    fastest,
    cheapest,
    leastWalking,
    balanced,
    alternatives,
  };
}

/**
 * Reconstructs the sequence of edges and nodes from a Pareto label
 */
export function reconstructParetoPath(label?: ParetoLabel): {
  nodes: string[];
  edges: TransitEdge[];
} {
  if (!label) return { nodes: [], edges: [] };

  const nodes: string[] = [];
  const edges: TransitEdge[] = [];
  let curr: ParetoLabel | undefined = label;

  while (curr) {
    nodes.unshift(curr.nodeId);
    if (curr.edge) {
      edges.unshift(curr.edge);
    }
    curr = curr.parentLabel;
  }

  return { nodes, edges };
}
