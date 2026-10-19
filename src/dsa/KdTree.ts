/**
 * 2-Dimensional Spatial k-d Tree (k=2: Latitude, Longitude)
 *
 * Concepts:
 * - Geometric space-partitioning binary tree.
 * - Alternates axis at each depth:
 *     depth % 2 === 0 splits on Latitude (North-South)
 *     depth % 2 === 1 splits on Longitude (East-West)
 * - Nearest Neighbor Search: Prunes entire subtrees whose bounding plane distance
 *   exceeds current best candidate distance.
 *
 * Asymptotic Complexity:
 * - Tree Construction:           O(N * log N) time
 * - Nearest Neighbor Query (NN): O(log N) expected time (worst-case O(N))
 * - Space Complexity:            O(N) storage
 */

import { TransitNode } from '../types';
import { haversineDistanceKm } from './MultiModalGraph';

export interface KdSplitLine {
  depth: number;
  axis: 'lat' | 'lng';
  coord: number;
  node: TransitNode;
}

export class KdNode {
  public node: TransitNode;
  public left: KdNode | null = null;
  public right: KdNode | null = null;
  public depth: number;

  constructor(node: TransitNode, depth: number) {
    this.node = node;
    this.depth = depth;
  }
}

export class KdTree {
  public root: KdNode | null = null;
  public splitLines: KdSplitLine[] = [];

  constructor(nodes?: TransitNode[]) {
    if (nodes && nodes.length > 0) {
      this.root = this.buildTree([...nodes], 0);
    }
  }

  private buildTree(nodes: TransitNode[], depth: number): KdNode | null {
    if (nodes.length === 0) return null;

    const axis = depth % 2 === 0 ? 'lat' : 'lng';

    // Sort along the chosen dimension
    nodes.sort((a, b) => a[axis] - b[axis]);

    const mid = Math.floor(nodes.length / 2);
    const medianNode = nodes[mid];

    const kdNode = new KdNode(medianNode, depth);

    // Save split line for DSA Lab visualization
    this.splitLines.push({
      depth,
      axis,
      coord: medianNode[axis],
      node: medianNode,
    });

    kdNode.left = this.buildTree(nodes.slice(0, mid), depth + 1);
    kdNode.right = this.buildTree(nodes.slice(mid + 1), depth + 1);

    return kdNode;
  }

  /**
   * Finds the K nearest transit stops to target coordinates (lat, lng).
   * Time Complexity: O(log N) average.
   */
  public findKNearest(lat: number, lng: number, k: number = 3): { node: TransitNode; distanceKm: number }[] {
    const bestCandidates: { node: TransitNode; distanceKm: number }[] = [];

    const search = (current: KdNode | null) => {
      if (!current) return;

      const dist = haversineDistanceKm(lat, lng, current.node.lat, current.node.lng);

      // Insert candidate into sorted list
      this.insertCandidate(bestCandidates, current.node, dist, k);

      const axis = current.depth % 2 === 0 ? 'lat' : 'lng';
      const targetCoord = axis === 'lat' ? lat : lng;
      const nodeCoord = current.node[axis];

      // Approximate plane distance in km (1 deg lat ~ 111 km, 1 deg lng ~ 104 km at Nashik 20 deg N)
      const kmPerDegree = axis === 'lat' ? 111 : 104;
      const planeDistKm = Math.abs(targetCoord - nodeCoord) * kmPerDegree;

      const goLeftFirst = targetCoord < nodeCoord;
      const firstBranch = goLeftFirst ? current.left : current.right;
      const secondBranch = goLeftFirst ? current.right : current.left;

      // Search closer half-space first
      search(firstBranch);

      // Only search second branch if cutting plane is closer than worst candidate in best list
      const worstDist = bestCandidates.length < k ? Infinity : bestCandidates[bestCandidates.length - 1].distanceKm;

      if (planeDistKm < worstDist) {
        search(secondBranch);
      }
    };

    search(this.root);
    return bestCandidates;
  }

  private insertCandidate(
    candidates: { node: TransitNode; distanceKm: number }[],
    node: TransitNode,
    dist: number,
    k: number
  ): void {
    candidates.push({ node, distanceKm: dist });
    candidates.sort((a, b) => a.distanceKm - b.distanceKm);
    if (candidates.length > k) {
      candidates.pop();
    }
  }
}
