/**
 * Breadth-First Search (BFS) for Minimizing Transit Transfers
 *
 * Concepts:
 * - Unweighted transfer-layer graph traversal.
 * - Queue-based level-order exploration guarantees the minimum number of mode switches/transfers.
 * - Explores all paths with 0 transfers before any 1-transfer path, etc.
 *
 * Asymptotic Complexity:
 * - Time Complexity:  O(|V| + |E|) linear time
 * - Space Complexity: O(|V|) queue and visited map
 */

import { MultiModalGraph } from './MultiModalGraph';
import { TransitEdge } from '../types';

export interface BfsTransferResult {
  path: string[];
  edges: TransitEdge[];
  transfersCount: number;
  totalMinutes: number;
}

export function runFewestTransfersBfs(
  graph: MultiModalGraph,
  sourceId: string,
  targetId: string
): BfsTransferResult {
  interface State {
    nodeId: string;
    parentEdge?: TransitEdge;
    prevState?: State;
    transfers: number;
    currentMode?: string;
  }

  const queue: State[] = [
    {
      nodeId: sourceId,
      transfers: 0,
      currentMode: undefined,
    },
  ];

  // Map of nodeId -> minimum transfers to reach
  const visitedTransfers = new Map<string, number>();
  visitedTransfers.set(sourceId, 0);

  let finalState: State | null = null;

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.nodeId === targetId) {
      finalState = current;
      break;
    }

    const neighbors = graph.getNeighbors(current.nodeId);
    for (const edge of neighbors) {
      const isTransfer = current.currentMode && current.currentMode !== edge.mode && edge.mode !== 'walk';
      const nextTransfers = current.transfers + (isTransfer ? 1 : 0);

      const existingMin = visitedTransfers.get(edge.to) ?? Infinity;
      if (nextTransfers < existingMin) {
        visitedTransfers.set(edge.to, nextTransfers);

        queue.push({
          nodeId: edge.to,
          parentEdge: edge,
          prevState: current,
          transfers: nextTransfers,
          currentMode: edge.mode,
        });
      }
    }
  }

  // Reconstruct path
  const path: string[] = [];
  const edges: TransitEdge[] = [];
  let curr: State | undefined = finalState || undefined;
  let totalMin = 0;

  while (curr) {
    path.unshift(curr.nodeId);
    if (curr.parentEdge) {
      edges.unshift(curr.parentEdge);
      totalMin += curr.parentEdge.baseMinutes;
    }
    curr = curr.prevState;
  }

  return {
    path,
    edges,
    transfersCount: finalState ? finalState.transfers : 0,
    totalMinutes: totalMin,
  };
}
