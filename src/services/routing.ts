import { NASHIK_NODES } from '../data/nashikNodes';
import { BUS_ROUTES } from '../data/busRoutes';
import { SHARED_AUTO_CORRIDORS } from '../data/sharedAutoCorridors';
import { getStoredFareSettings } from '../data/fareConfig';
import { MultiModalGraph, haversineDistanceKm } from '../dsa/MultiModalGraph';
import { Trie } from '../dsa/Trie';
import { KdTree } from '../dsa/KdTree';
import { UnionFind } from '../dsa/UnionFind';
import { LruCache } from '../dsa/LruCache';
import { runDijkstra, DijkstraResult } from '../dsa/dijkstra';
import { runAStar, AStarResult } from '../dsa/aStar';
import { PravahRouter, PravahOptions } from '../dsa/PravahRouter';
import { solveBudgetKnapsack, KnapsackBudgetResult } from '../dsa/DynamicProgramming';
import { TransitNode, JourneyRoute, DsaRaceStats, BusRouteInfo } from '../types';
import osmStopsData from '../data/osmStops.generated.json';
import osmBusRoutesData from '../data/osmBusRoutes.generated.json';
import { coordinateFallbackName } from './geocode';

export class RoutingEngine {
  private static instance: RoutingEngine;

  // 1. Core Structures (Remain UNCHANGED for DSA Lab & exact regression)
  public graph: MultiModalGraph;
  public trie: Trie;
  public kdTree: KdTree;
  public unionFind: UnionFind;
  public routeCache: LruCache<string, JourneyRoute[]>;
  public pravahRouter: PravahRouter;

  // 2. Extended Structures (Additive for thousands of OSM places & Live GPS)
  public extGraph: MultiModalGraph;
  public extTrie: Trie;
  public extKdTree: KdTree;
  public extPravahRouter: PravahRouter;

  public isExtendedReady: boolean = false;
  private extendedListeners: Set<() => void> = new Set();
  private isInitialized: boolean = false;
  private isExtendedBuilding: boolean = false;
  private lastLiveNodeNames: { name: string; nameMr?: string; nameHi?: string } | null = null;

  public constructor() {
    this.graph = new MultiModalGraph();
    this.trie = new Trie();
    this.kdTree = new KdTree();
    this.unionFind = new UnionFind();
    this.routeCache = new LruCache<string, JourneyRoute[]>(200);
    this.pravahRouter = new PravahRouter(this.graph);

    // Initialize Extended layer structures
    this.extGraph = new MultiModalGraph();
    this.extTrie = new Trie();
    this.extKdTree = new KdTree();
    this.extPravahRouter = new PravahRouter(this.extGraph);

    this.initializeData();
    this.scheduleExtendedBuild();
  }

  public static getInstance(): RoutingEngine {
    if (!RoutingEngine.instance) {
      RoutingEngine.instance = new RoutingEngine();
    }
    return RoutingEngine.instance;
  }

  /**
   * Builds the core 112-node layer synchronously.
   */
  private initializeData(): void {
    if (this.isInitialized) return;

    const fares = getStoredFareSettings();

    // 1. Add all core nodes to Graph, Trie, KdTree, UnionFind
    for (const node of NASHIK_NODES) {
      this.graph.addNode(node);
      this.trie.indexTransitNode(node);
      this.unionFind.add(node.id);
    }

    // Build spatial index
    this.kdTree = new KdTree(NASHIK_NODES);

    // 2. Add Bus Route Edges
    for (const route of BUS_ROUTES) {
      for (let i = 0; i < route.stops.length - 1; i++) {
        const uId = route.stops[i];
        const vId = route.stops[i + 1];
        const uNode = this.graph.getNode(uId);
        const vNode = this.graph.getNode(vId);

        if (uNode && vNode) {
          const distKm = Math.max(0.6, haversineDistanceKm(uNode.lat, uNode.lng, vNode.lat, vNode.lng));
          const travelMinutes = (distKm / 20) * 60 + 1.5;
          const fareCost = Math.round(fares.busBaseFare + distKm * fares.busPerStage);

          this.graph.addEdge({
            id: `bus_${route.id}_${uId}_${vId}`,
            from: uId,
            to: vId,
            mode: 'bus',
            distanceKm: distKm,
            baseMinutes: travelMinutes,
            routeId: route.number,
            routeName: route.name,
            costInr: fareCost,
            comfortScore: 0.65,
            headwayMinutes: route.headwayMinutes,
          });

          this.graph.addEdge({
            id: `bus_${route.id}_${vId}_${uId}`,
            from: vId,
            to: uId,
            mode: 'bus',
            distanceKm: distKm,
            baseMinutes: travelMinutes,
            routeId: route.number,
            routeName: route.name,
            costInr: fareCost,
            comfortScore: 0.65,
            headwayMinutes: route.headwayMinutes,
          });

          this.unionFind.union(uId, vId);
        }
      }
    }

    // 3. Add Shared Auto Corridors
    for (const corridor of SHARED_AUTO_CORRIDORS) {
      for (let i = 0; i < corridor.stops.length - 1; i++) {
        const uId = corridor.stops[i];
        const vId = corridor.stops[i + 1];
        const uNode = this.graph.getNode(uId);
        const vNode = this.graph.getNode(vId);

        if (uNode && vNode) {
          const distKm = Math.max(0.5, haversineDistanceKm(uNode.lat, uNode.lng, vNode.lat, vNode.lng));
          const travelMinutes = (distKm / 26) * 60 + 0.5;
          const stageFare = Math.max(10, Math.round(corridor.perSeatFare / (corridor.stops.length - 1)));

          this.graph.addEdge({
            id: `shared_auto_${corridor.id}_${uId}_${vId}`,
            from: uId,
            to: vId,
            mode: 'auto',
            distanceKm: distKm,
            baseMinutes: travelMinutes,
            routeName: corridor.name,
            costInr: stageFare,
            comfortScore: 0.7,
            headwayMinutes: corridor.frequencyMinutes,
          });

          this.graph.addEdge({
            id: `shared_auto_${corridor.id}_${vId}_${uId}`,
            from: vId,
            to: uId,
            mode: 'auto',
            distanceKm: distKm,
            baseMinutes: travelMinutes,
            routeName: corridor.name,
            costInr: stageFare,
            comfortScore: 0.7,
            headwayMinutes: corridor.frequencyMinutes,
          });

          this.unionFind.union(uId, vId);
        }
      }
    }

    // 4. Generate Walking and Arterial Road Edges
    this.graph.generateWalkingEdges(fares.walkSpeedKmh, 1.2);
    this.graph.generateRoadEdges(3.8);

    // Ensure entire network components are unified
    for (let i = 0; i < NASHIK_NODES.length - 1; i++) {
      const u = NASHIK_NODES[i];
      const v = NASHIK_NODES[i + 1];
      const d = haversineDistanceKm(u.lat, u.lng, v.lat, v.lng);
      if (d < 3.0) {
        this.unionFind.union(u.id, v.id);
      }
    }

    this.isInitialized = true;
  }

  /**
   * Schedules lazy building of the extended layer after first paint
   * using requestIdleCallback with setTimeout fallback.
   */
  private scheduleExtendedBuild(): void {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => this.buildExtendedLayer());
    } else {
      setTimeout(() => this.buildExtendedLayer(), 80);
    }
  }

  /**
   * Builds the extended layer in chunks (every ~250 nodes) to avoid
   * blocking the main thread for more than 100ms.
   */
  public async buildExtendedLayer(): Promise<void> {
    if (this.isExtendedReady || this.isExtendedBuilding) return;
    this.isExtendedBuilding = true;

    // 1. Populate extGraph with core nodes & edges first
    for (const node of NASHIK_NODES) {
      this.extGraph.addNode(node);
      this.extTrie.indexTransitNode(node);
    }
    for (const edge of this.graph.allEdges) {
      this.extGraph.addEdge(edge);
    }

    // 2. Load extended nodes from generated JSON
    const extNodesRaw = (osmStopsData?.nodes || []) as TransitNode[];
    const importedBusRoutes = (osmBusRoutesData?.routes || []) as BusRouteInfo[];

    const hubStops = NASHIK_NODES.filter(
      (n) => n.type === 'railway' || n.type === 'junction' || n.popularity >= 85
    );

    // Chunking to keep frame rate high
    const chunkSize = 250;
    for (let i = 0; i < extNodesRaw.length; i += chunkSize) {
      const chunk = extNodesRaw.slice(i, i + chunkSize);
      for (const node of chunk) {
        this.extGraph.addNode(node);
        this.extTrie.indexTransitNode(node);
      }
      // Yield to main thread
      await new Promise((r) => setTimeout(r, 0));
    }

    // 3. Build spatial index for extended layer
    const allExtNodes = this.extGraph.getAllNodes();
    this.extKdTree = new KdTree(allExtNodes);

    // 4. Generate extended edges using uniform grid index
    this.extGraph.generateExtendedEdges(extNodesRaw, hubStops, importedBusRoutes, 4.0);

    this.isExtendedReady = true;
    this.isExtendedBuilding = false;

    // Notify listeners (e.g. PlanPage autocomplete)
    for (const listener of this.extendedListeners) {
      try {
        listener();
      } catch (err) {
        console.warn('Error in onExtendedReady listener:', err);
      }
    }
  }

  /**
   * Subscribe to extended layer readiness.
   */
  public onExtendedReady(cb: () => void): () => void {
    if (this.isExtendedReady) {
      cb();
    }
    this.extendedListeners.add(cb);
    return () => {
      this.extendedListeners.delete(cb);
    };
  }

  // ================= FEATURE 1: LIVE LOCATION METHODS =================

  /**
   * Upserts the user's current GPS location into the extended layer.
   * Node is given fixed ID 'my_live_location'.
   * Never indexed in the Trie. Lives ONLY in extGraph.
   */
  public upsertLiveNode(lat: number, lng: number): TransitNode {
    const fallbackName = coordinateFallbackName(lat, lng);
    const liveName = this.lastLiveNodeNames?.name || fallbackName;
    const liveNameMr = this.lastLiveNodeNames?.nameMr || this.lastLiveNodeNames?.name || fallbackName;
    const liveNameHi = this.lastLiveNodeNames?.nameHi || this.lastLiveNodeNames?.name || fallbackName;

    const liveNode: TransitNode = {
      id: 'my_live_location',
      name: liveName,
      nameMr: liveNameMr,
      nameHi: liveNameHi,
      lat,
      lng,
      type: 'landmark',
      serves: [],
      popularity: 0,
      source: 'user',
      tier: 'D',
    };

    // Remove old live node edges from extended graph
    this.extGraph.removeNodeEdges('my_live_location');
    this.extGraph.addNode(liveNode);

    // 1. Walking edges (4 km/h) to 5 nearest stops within 1.5 km (bidirectional)
    const nearestStops = this.getNearestPlaces(lat, lng, 12).filter(
      (item) => item.node.id !== 'my_live_location' && item.distanceKm <= 1.5
    );

    const top5Walk = nearestStops.slice(0, 5);
    for (const { node: target, distanceKm } of top5Walk) {
      const walkMin = (distanceKm / 4.0) * 60;
      this.extGraph.addEdge({
        id: `walk_live_${target.id}`,
        from: 'my_live_location',
        to: target.id,
        mode: 'walk',
        distanceKm,
        baseMinutes: walkMin,
        costInr: 0,
        comfortScore: 0.5,
      });
      this.extGraph.addEdge({
        id: `walk_${target.id}_live`,
        from: target.id,
        to: 'my_live_location',
        mode: 'walk',
        distanceKm,
        baseMinutes: walkMin,
        costInr: 0,
        comfortScore: 0.5,
      });
    }

    // 2. Auto and Cab edges to 6 nearest hub stops within 6 km
    const hubCandidates = NASHIK_NODES.filter(
      (n) => n.id !== 'my_live_location' && (n.type === 'junction' || n.type === 'railway' || n.popularity >= 85)
    )
      .map((hub) => ({
        hub,
        distKm: haversineDistanceKm(lat, lng, hub.lat, hub.lng),
      }))
      .filter((item) => item.distKm <= 6.0 && item.distKm >= 0.05);

    hubCandidates.sort((a, b) => a.distKm - b.distKm);
    const top6Hubs = hubCandidates.slice(0, 6);

    for (const { hub, distKm } of top6Hubs) {
      const autoMin = (distKm / 24) * 60;
      const cabMin = (distKm / 30) * 60;
      const autoCost = Math.round(Math.max(26, distKm * 15.33));
      const cabCost = Math.round(60 + distKm * 18 + cabMin * 2);

      // Auto edges
      this.extGraph.addEdge({
        id: `auto_live_${hub.id}`,
        from: 'my_live_location',
        to: hub.id,
        mode: 'auto',
        distanceKm: distKm,
        baseMinutes: autoMin,
        costInr: autoCost,
        comfortScore: 0.7,
      });
      this.extGraph.addEdge({
        id: `auto_${hub.id}_live`,
        from: hub.id,
        to: 'my_live_location',
        mode: 'auto',
        distanceKm: distKm,
        baseMinutes: autoMin,
        costInr: autoCost,
        comfortScore: 0.7,
      });

      // Cab edges
      this.extGraph.addEdge({
        id: `cab_live_${hub.id}`,
        from: 'my_live_location',
        to: hub.id,
        mode: 'cab',
        distanceKm: distKm,
        baseMinutes: cabMin,
        costInr: cabCost,
        comfortScore: 0.95,
      });
      this.extGraph.addEdge({
        id: `cab_${hub.id}_live`,
        from: hub.id,
        to: 'my_live_location',
        mode: 'cab',
        distanceKm: distKm,
        baseMinutes: cabMin,
        costInr: cabCost,
        comfortScore: 0.95,
      });
    }

    // Clear route cache entries starting with 'my_live_location'
    this.routeCache.deletePrefix('my_live_location');
    this.routeCache.deletePrefix('ext_my_live_location');
    this.routeCache.deletePrefix('core_my_live_location');

    return liveNode;
  }

  /**
   * 1C. Updates the existing live node's names IN PLACE in the extended graph
   * without rebuilding edges and without touching the route cache.
   */
  public setLiveNodeNames(names: { name: string; nameMr?: string; nameHi?: string }): TransitNode | null {
    this.lastLiveNodeNames = {
      name: names.name,
      nameMr: names.nameMr ?? this.lastLiveNodeNames?.nameMr,
      nameHi: names.nameHi ?? this.lastLiveNodeNames?.nameHi,
    };
    const liveNode = this.extGraph.getNode('my_live_location');
    if (liveNode) {
      liveNode.name = names.name;
      if (names.nameMr !== undefined) liveNode.nameMr = names.nameMr;
      if (names.nameHi !== undefined) liveNode.nameHi = names.nameHi;
      return liveNode;
    }
    return null;
  }

  /**
   * Removes the live node and its incident edges from the extended layer.
   */
  public removeLiveNode(): void {
    this.lastLiveNodeNames = null;
    this.extGraph.removeNode('my_live_location');
    this.routeCache.deletePrefix('my_live_location');
    this.routeCache.deletePrefix('ext_my_live_location');
    this.routeCache.deletePrefix('core_my_live_location');
  }

  // ================= JOURNEY PLANNING & SEARCH =================

  /**
   * Plans a multimodal journey.
   * If both endpoints are core nodes, plans on CORE router exactly as before (identical results).
   * Otherwise, plans on the extended router.
   */
  public planJourney(
    sourceId: string,
    targetId: string,
    options: Partial<PravahOptions> = {}
  ): JourneyRoute[] {
    const fullOptions: PravahOptions = {
      departureMinuteOfDay: options.departureMinuteOfDay ?? 540,
      isRainy: options.isRainy ?? false,
      isKumbhFestival: options.isKumbhFestival ?? false,
      temperatureCelsius: options.temperatureCelsius ?? 31,
      confidenceThreshold: options.confidenceThreshold ?? 0.65,
      userWeightTime: options.userWeightTime ?? 0.5,
      userWeightCost: options.userWeightCost ?? 0.5,
      userWeightComfort: options.userWeightComfort ?? 0.5,
      userWeightWalk: options.userWeightWalk ?? 0.5,
    };

    const resolvedSource = (sourceId === 'ramkund_ghat' && !this.graph.nodes.has(sourceId)) ? 'ramkund' : sourceId;
    const resolvedTarget = (targetId === 'ramkund_ghat' && !this.graph.nodes.has(targetId)) ? 'ramkund' : targetId;

    const isCoreQuery = this.graph.nodes.has(resolvedSource) && this.graph.nodes.has(resolvedTarget);

    if (!isCoreQuery && !this.isExtendedReady) {
      return [];
    }

    const routerTag = isCoreQuery ? 'core' : 'ext';
    const cacheKey = `${routerTag}_${resolvedSource}_${resolvedTarget}_${fullOptions.departureMinuteOfDay}_${fullOptions.isRainy}_${fullOptions.isKumbhFestival}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let routes: JourneyRoute[] = [];

    if (isCoreQuery) {
      routes = this.pravahRouter.planJourney(resolvedSource, resolvedTarget, fullOptions);
    } else {
      routes = this.extPravahRouter.planJourney(resolvedSource, resolvedTarget, fullOptions);
    }

    if (routes.length > 0) {
      this.routeCache.put(cacheKey, routes);
    }

    return routes;
  }

  /**
   * Autocomplete search for places (uses extTrie when ready, core trie otherwise).
   */
  public searchPlaces(query: string) {
    if (this.isExtendedReady) {
      return this.extTrie.searchPrefix(query);
    }
    return this.trie.searchPrefix(query);
  }

  /**
   * Nearest places query (uses extKdTree when ready, core kdTree otherwise).
   */
  public getNearestPlaces(lat: number, lng: number, k: number = 3): { node: TransitNode; distanceKm: number }[] {
    if (this.isExtendedReady) {
      return this.extKdTree.findKNearest(lat, lng, k);
    }
    return this.kdTree.findKNearest(lat, lng, k);
  }

  // ================= BACKWARD COMPATIBLE LAB METHODS =================

  public getNearestStops(lat: number, lng: number, k: number = 3): { node: TransitNode; distanceKm: number }[] {
    return this.kdTree.findKNearest(lat, lng, k);
  }

  public searchStops(query: string) {
    return this.trie.searchPrefix(query);
  }

  public runDijkstraRace(src: string, dst: string): { result: DijkstraResult; stats: DsaRaceStats } {
    const res = runDijkstra(this.graph, src, dst, 'minutes');
    return {
      result: res,
      stats: {
        algorithm: 'dijkstra',
        nodesExpanded: res.nodesExpanded,
        heapOperations: res.heapOperations,
        runtimeMs: res.runtimeMs,
        pathLengthKm: Number(res.totalDistanceKm.toFixed(2)),
        pathMinutes: Math.round(res.totalMinutes),
        costInr: 25,
        foundPath: res.path,
      },
    };
  }

  public runAStarRace(src: string, dst: string): { result: AStarResult; stats: DsaRaceStats } {
    const res = runAStar(this.graph, src, dst, 60);
    return {
      result: res,
      stats: {
        algorithm: 'aStar',
        nodesExpanded: res.nodesExpanded,
        heapOperations: res.heapOperations,
        runtimeMs: res.runtimeMs,
        pathLengthKm: Number(res.totalDistanceKm.toFixed(2)),
        pathMinutes: Math.round(res.totalMinutes),
        costInr: 25,
        foundPath: res.path,
      },
    };
  }

  public solveBudgetMode(maxBudgetInr: number, originId: string = 'nashik_cbs'): KnapsackBudgetResult {
    const candidates = NASHIK_NODES.filter((n) => n.id !== originId).map((node) => {
      const origin = this.graph.getNode(originId) || NASHIK_NODES[0];
      const dist = haversineDistanceKm(origin.lat, origin.lng, node.lat, node.lng);
      const estBusCost = Math.max(10, Math.round(10 + dist * 3));
      return {
        node,
        costInr: estBusCost,
        value: node.popularity,
      };
    });

    return solveBudgetKnapsack(candidates, maxBudgetInr);
  }
}

export const routingEngine = RoutingEngine.getInstance();
