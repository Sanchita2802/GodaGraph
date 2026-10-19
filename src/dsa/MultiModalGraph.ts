/**
 * Multimodal Time-Expanded Weighted Directed Graph
 *
 * Concepts:
 * - Multimodal: Models walking, city bus (Citilinc/MSRTC), seat auto-rickshaws, and cabs.
 * - Adjacency List & Edge List representations for O(1) vertex lookups and O(deg(V)) edge iteration.
 * - Mode Transfer Edges: Switching between transit modes introduces an explicit transfer edge
 *   carrying waiting penalties derived from headway distributions.
 *
 * Asymptotic Complexity:
 * - Graph construction: O(|V| + |E|) time
 * - Storage (Space): O(|V| + |E|) memory
 * - Neighbor exploration: O(deg(u)) for vertex u
 */

import { TransitNode, TransitEdge, BusRouteInfo } from '../types';
import { UnionFind } from './UnionFind';

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class MultiModalGraph {
  public nodes: Map<string, TransitNode> = new Map();
  public adjacencyList: Map<string, TransitEdge[]> = new Map();
  public allEdges: TransitEdge[] = [];

  constructor() {}

  public addNode(node: TransitNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, []);
    }
  }

  public addEdge(edge: TransitEdge): void {
    this.allEdges.push(edge);
    const existing = this.adjacencyList.get(edge.from) || [];
    existing.push(edge);
    this.adjacencyList.set(edge.from, existing);
  }

  public getNeighbors(nodeId: string): TransitEdge[] {
    return this.adjacencyList.get(nodeId) || [];
  }

  public getNode(nodeId: string): TransitNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getAllNodes(): TransitNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Removes all incoming and outgoing edges for a given nodeId.
   * Useful for live GPS node updates and dynamic removals.
   */
  public removeNodeEdges(nodeId: string): void {
    this.allEdges = this.allEdges.filter((e) => e.from !== nodeId && e.to !== nodeId);
    this.adjacencyList.set(nodeId, []);
    // Also remove from any other node's adjacency list
    for (const [key, edges] of this.adjacencyList.entries()) {
      if (key !== nodeId) {
        this.adjacencyList.set(
          key,
          edges.filter((e) => e.to !== nodeId)
        );
      }
    }
  }

  /**
   * Completely removes a node and its edges from the graph.
   */
  public removeNode(nodeId: string): void {
    this.removeNodeEdges(nodeId);
    this.nodes.delete(nodeId);
    this.adjacencyList.delete(nodeId);
  }

  /**
   * Generates pedestrian walking edges between physically close stops (within maxKm, e.g. 1.2km)
   */
  public generateWalkingEdges(walkSpeedKmh: number = 4.8, maxDistanceKm: number = 1.3): void {
    const nodeList = this.getAllNodes();
    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i + 1; j < nodeList.length; j++) {
        const u = nodeList[i];
        const v = nodeList[j];
        const distKm = haversineDistanceKm(u.lat, u.lng, v.lat, v.lng);

        if (distKm <= maxDistanceKm) {
          const walkMinutes = (distKm / walkSpeedKmh) * 60;

          // Edge u -> v
          this.addEdge({
            id: `walk_${u.id}_${v.id}`,
            from: u.id,
            to: v.id,
            mode: 'walk',
            distanceKm: distKm,
            baseMinutes: walkMinutes,
            costInr: 0,
            comfortScore: 0.5,
          });

          // Edge v -> u
          this.addEdge({
            id: `walk_${v.id}_${u.id}`,
            from: v.id,
            to: u.id,
            mode: 'walk',
            distanceKm: distKm,
            baseMinutes: walkMinutes,
            costInr: 0,
            comfortScore: 0.5,
          });
        }
      }
    }
  }

  /**
   * Generates road network edges for Auto-rickshaw and Cab across major arterial connections
   */
  public generateRoadEdges(maxRadiusKm: number = 3.5): void {
    const nodeList = this.getAllNodes();
    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i + 1; j < nodeList.length; j++) {
        const u = nodeList[i];
        const v = nodeList[j];
        const distKm = haversineDistanceKm(u.lat, u.lng, v.lat, v.lng);

        // Filter for local arterial distance
        if (distKm > 0.4 && distKm <= maxRadiusKm) {
          // Average city speeds: Auto ~24 km/h, Cab ~30 km/h
          const autoMinutes = (distKm / 24) * 60;
          const cabMinutes = (distKm / 30) * 60;

          // Auto fare: ~Rs 15.33 per km
          const autoCost = Math.max(26, distKm * 15.33);
          // Cab fare: Rs 60 base + Rs 18/km + Rs 2/min
          const cabCost = 60 + distKm * 18 + cabMinutes * 2;

          // Auto edges
          this.addEdge({
            id: `auto_${u.id}_${v.id}`,
            from: u.id,
            to: v.id,
            mode: 'auto',
            distanceKm: distKm,
            baseMinutes: autoMinutes,
            costInr: Math.round(autoCost),
            comfortScore: 0.7,
          });
          this.addEdge({
            id: `auto_${v.id}_${u.id}`,
            from: v.id,
            to: u.id,
            mode: 'auto',
            distanceKm: distKm,
            baseMinutes: autoMinutes,
            costInr: Math.round(autoCost),
            comfortScore: 0.7,
          });

          // Cab edges
          this.addEdge({
            id: `cab_${u.id}_${v.id}`,
            from: u.id,
            to: v.id,
            mode: 'cab',
            distanceKm: distKm,
            baseMinutes: cabMinutes,
            costInr: Math.round(cabCost),
            comfortScore: 0.95,
          });
          this.addEdge({
            id: `cab_${v.id}_${u.id}`,
            from: v.id,
            to: u.id,
            mode: 'cab',
            distanceKm: distKm,
            baseMinutes: cabMinutes,
            costInr: Math.round(cabCost),
            comfortScore: 0.95,
          });
        }
      }
    }
  }

  /**
   * Generates extended layer edges without all-pairs O(N^2) loops:
   * Uses a uniform spatial grid index (250m cells) to find:
   * 1. Walking edges to the 4 nearest neighbors within 1.2 km for every extended node (bidirectional).
   * 2. Auto and cab edges to the 6 nearest hub stops within 6 km for every extended node.
   * 3. Bus edges for imported bus routes.
   * 4. Enforces connectivity with UnionFind, linking any disconnected node to nearest hub.
   */
  public generateExtendedEdges(
    extendedNodes: TransitNode[],
    hubStops: TransitNode[],
    importedBusRoutes: BusRouteInfo[] = [],
    walkSpeedKmh: number = 4.0
  ): void {
    // 250m cell size in degrees (~0.00225 deg)
    const cellSize = 0.00225;
    const grid = new Map<string, TransitNode[]>();

    const getCellKey = (lat: number, lng: number) => {
      const r = Math.floor(lat / cellSize);
      const c = Math.floor(lng / cellSize);
      return `${r}_${c}`;
    };

    // Index all graph nodes in uniform grid for neighbor searches
    const allGraphNodes = this.getAllNodes();
    for (const node of allGraphNodes) {
      const key = getCellKey(node.lat, node.lng);
      const list = grid.get(key) || [];
      list.push(node);
      grid.set(key, list);
    }

    const existingEdgeKeys = new Set<string>();
    for (const edge of this.allEdges) {
      existingEdgeKeys.add(`${edge.mode}_${edge.from}_${edge.to}`);
    }

    const uf = new UnionFind(allGraphNodes.map((n) => n.id));
    for (const edge of this.allEdges) {
      uf.union(edge.from, edge.to);
    }

    // 1. Walking edges to 4 nearest neighbors within 1.2 km (radius in cells ~ 1.2km / 0.25km = 5 cells)
    const searchRadiusCells = 6;

    for (const extNode of extendedNodes) {
      const centerR = Math.floor(extNode.lat / cellSize);
      const centerC = Math.floor(extNode.lng / cellSize);

      const neighborCandidates: { node: TransitNode; distKm: number }[] = [];

      for (let dr = -searchRadiusCells; dr <= searchRadiusCells; dr++) {
        for (let dc = -searchRadiusCells; dc <= searchRadiusCells; dc++) {
          const cellNodes = grid.get(`${centerR + dr}_${centerC + dc}`);
          if (!cellNodes) continue;

          for (const cand of cellNodes) {
            if (cand.id === extNode.id) continue;
            const distKm = haversineDistanceKm(extNode.lat, extNode.lng, cand.lat, cand.lng);
            if (distKm <= 1.2 && distKm >= 0.005) {
              neighborCandidates.push({ node: cand, distKm });
            }
          }
        }
      }

      neighborCandidates.sort((a, b) => a.distKm - b.distKm);
      const nearestWalk = neighborCandidates.slice(0, 4);

      for (const { node: neighbor, distKm } of nearestWalk) {
        const walkMin = (distKm / walkSpeedKmh) * 60;
        const key1 = `walk_${extNode.id}_${neighbor.id}`;
        const key2 = `walk_${neighbor.id}_${extNode.id}`;

        if (!existingEdgeKeys.has(key1)) {
          this.addEdge({
            id: key1,
            from: extNode.id,
            to: neighbor.id,
            mode: 'walk',
            distanceKm: distKm,
            baseMinutes: walkMin,
            costInr: 0,
            comfortScore: 0.5,
          });
          existingEdgeKeys.add(key1);
        }

        if (!existingEdgeKeys.has(key2)) {
          this.addEdge({
            id: key2,
            from: neighbor.id,
            to: extNode.id,
            mode: 'walk',
            distanceKm: distKm,
            baseMinutes: walkMin,
            costInr: 0,
            comfortScore: 0.5,
          });
          existingEdgeKeys.add(key2);
        }

        uf.union(extNode.id, neighbor.id);
      }

      // 2. Auto and Cab edges to 6 nearest hub stops within 6 km
      const hubCandidates: { hub: TransitNode; distKm: number }[] = [];
      for (const hub of hubStops) {
        if (hub.id === extNode.id) continue;
        const distKm = haversineDistanceKm(extNode.lat, extNode.lng, hub.lat, hub.lng);
        if (distKm <= 6.0 && distKm >= 0.05) {
          hubCandidates.push({ hub, distKm });
        }
      }

      hubCandidates.sort((a, b) => a.distKm - b.distKm);
      const nearestHubs = hubCandidates.slice(0, 6);

      for (const { hub, distKm } of nearestHubs) {
        const autoMin = (distKm / 24) * 60;
        const cabMin = (distKm / 30) * 60;
        const autoCost = Math.round(Math.max(26, distKm * 15.33));
        const cabCost = Math.round(60 + distKm * 18 + cabMin * 2);

        // Auto bidirectional
        const auto1 = `auto_${extNode.id}_${hub.id}`;
        const auto2 = `auto_${hub.id}_${extNode.id}`;
        if (!existingEdgeKeys.has(auto1)) {
          this.addEdge({
            id: auto1,
            from: extNode.id,
            to: hub.id,
            mode: 'auto',
            distanceKm: distKm,
            baseMinutes: autoMin,
            costInr: autoCost,
            comfortScore: 0.7,
          });
          existingEdgeKeys.add(auto1);
        }
        if (!existingEdgeKeys.has(auto2)) {
          this.addEdge({
            id: auto2,
            from: hub.id,
            to: extNode.id,
            mode: 'auto',
            distanceKm: distKm,
            baseMinutes: autoMin,
            costInr: autoCost,
            comfortScore: 0.7,
          });
          existingEdgeKeys.add(auto2);
        }

        // Cab bidirectional
        const cab1 = `cab_${extNode.id}_${hub.id}`;
        const cab2 = `cab_${hub.id}_${extNode.id}`;
        if (!existingEdgeKeys.has(cab1)) {
          this.addEdge({
            id: cab1,
            from: extNode.id,
            to: hub.id,
            mode: 'cab',
            distanceKm: distKm,
            baseMinutes: cabMin,
            costInr: cabCost,
            comfortScore: 0.95,
          });
          existingEdgeKeys.add(cab1);
        }
        if (!existingEdgeKeys.has(cab2)) {
          this.addEdge({
            id: cab2,
            from: hub.id,
            to: extNode.id,
            mode: 'cab',
            distanceKm: distKm,
            baseMinutes: cabMin,
            costInr: cabCost,
            comfortScore: 0.95,
          });
          existingEdgeKeys.add(cab2);
        }

        uf.union(extNode.id, hub.id);
      }
    }

    // 3. Imported bus routes
    for (const route of importedBusRoutes) {
      for (let i = 0; i < route.stops.length - 1; i++) {
        const uId = route.stops[i];
        const vId = route.stops[i + 1];
        const u = this.getNode(uId);
        const v = this.getNode(vId);
        if (u && v) {
          const distKm = Math.max(0.5, haversineDistanceKm(u.lat, u.lng, v.lat, v.lng));
          const travelMinutes = (distKm / 20) * 60 + 1.5;
          const fareCost = Math.round(10 + distKm * 3);

          const bus1 = `osm_bus_${route.id}_${uId}_${vId}`;
          const bus2 = `osm_bus_${route.id}_${vId}_${uId}`;

          if (!existingEdgeKeys.has(bus1)) {
            this.addEdge({
              id: bus1,
              from: uId,
              to: vId,
              mode: 'bus',
              distanceKm: distKm,
              baseMinutes: travelMinutes,
              routeId: route.number,
              routeName: route.name,
              costInr: fareCost,
              comfortScore: 0.65,
              headwayMinutes: route.headwayMinutes || 30,
            });
            existingEdgeKeys.add(bus1);
          }
          if (!existingEdgeKeys.has(bus2)) {
            this.addEdge({
              id: bus2,
              from: vId,
              to: uId,
              mode: 'bus',
              distanceKm: distKm,
              baseMinutes: travelMinutes,
              routeId: route.number,
              routeName: route.name,
              costInr: fareCost,
              comfortScore: 0.65,
              headwayMinutes: route.headwayMinutes || 30,
            });
            existingEdgeKeys.add(bus2);
          }
          uf.union(uId, vId);
        }
      }
    }

    // 4. Ensure connectivity for every node in the extended graph:
    // If any component is stranded from the main hub component, link it to nearest hub by walking edge
    const mainHubId = 'nashik_cbs';
    for (const node of allGraphNodes) {
      if (!uf.connected(node.id, mainHubId)) {
        let bestHub: TransitNode | null = null;
        let bestDist = Infinity;
        for (const hub of hubStops) {
          if (hub.id === node.id) continue;
          if (!uf.connected(hub.id, mainHubId)) continue;
          const d = haversineDistanceKm(node.lat, node.lng, hub.lat, hub.lng);
          if (d < bestDist) {
            bestDist = d;
            bestHub = hub;
          }
        }
        if (bestHub) {
          const walkMin = (bestDist / walkSpeedKmh) * 60;
          this.addEdge({
            id: `walk_stranded_${node.id}_${bestHub.id}`,
            from: node.id,
            to: bestHub.id,
            mode: 'walk',
            distanceKm: bestDist,
            baseMinutes: walkMin,
            costInr: 0,
            comfortScore: 0.5,
          });
          this.addEdge({
            id: `walk_stranded_${bestHub.id}_${node.id}`,
            from: bestHub.id,
            to: node.id,
            mode: 'walk',
            distanceKm: bestDist,
            baseMinutes: walkMin,
            costInr: 0,
            comfortScore: 0.5,
          });
          uf.union(node.id, bestHub.id);
        }
      }
    }
  }
}
