import { TransitNode } from '../types';

export interface LatLngBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * 2D Spatial Grid Index for Viewport Culling of Transit Markers
 *
 * Partitions geographic space into grid cells for fast range queries.
 * Applies zoom-tier filtering and priority capping:
 * - Zoom <= 13 : Hubs only (railway, major junctions, tier A)
 * - Zoom 14-15 : Hubs + Bus stops (Citilinc/MSRTC stops, tier B)
 * - Zoom >= 16 : All places inside bounds (landmarks, shops, tier C/D)
 *
 * Result is capped at maxCap (default 400) to keep rendering smooth.
 */
export class ViewportGridIndex {
  private cellSize: number;
  private grid: Map<string, TransitNode[]> = new Map();
  private allNodesCount: number = 0;

  /**
   * @param cellSize Cell dimension in degrees (~0.02 deg ~ 2.2 km)
   */
  constructor(cellSize: number = 0.02) {
    this.cellSize = cellSize;
  }

  private getKey(lat: number, lng: number): string {
    const r = Math.floor(lat / this.cellSize);
    const c = Math.floor(lng / this.cellSize);
    return `${r}_${c}`;
  }

  public insert(node: TransitNode): void {
    const key = this.getKey(node.lat, node.lng);
    const cell = this.grid.get(key);
    if (cell) {
      cell.push(node);
    } else {
      this.grid.set(key, [node]);
    }
    this.allNodesCount++;
  }

  public insertMany(nodes: TransitNode[]): void {
    for (const node of nodes) {
      this.insert(node);
    }
  }

  public clear(): void {
    this.grid.clear();
    this.allNodesCount = 0;
  }

  public size(): number {
    return this.allNodesCount;
  }

  public isHub(node: TransitNode): boolean {
    return (
      node.type === 'railway' ||
      node.type === 'junction' ||
      node.tier === 'A' ||
      (node.popularity !== undefined && node.popularity >= 85)
    );
  }

  public isBusStopOrHub(node: TransitNode): boolean {
    if (this.isHub(node)) return true;
    return (
      node.type === 'bus_stop' ||
      node.tier === 'B' ||
      (node.serves && node.serves.length > 0)
    );
  }

  /**
   * Query nodes inside bounding box filtered by zoom level tiers:
   * - zoom <= 13: hubs only
   * - zoom 14-15: hubs + bus stops
   * - zoom >= 16: everything inside bounds
   * Output is capped at maxCap (default 400).
   */
  public queryBounds(
    bounds: LatLngBounds,
    zoom: number,
    maxCap: number = 400
  ): TransitNode[] {
    const minRow = Math.floor(bounds.south / this.cellSize);
    const maxRow = Math.floor(bounds.north / this.cellSize);
    const minCol = Math.floor(bounds.west / this.cellSize);
    const maxCol = Math.floor(bounds.east / this.cellSize);

    const candidates: TransitNode[] = [];
    const seenIds = new Set<string>();

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = this.grid.get(`${r}_${c}`);
        if (!cell) continue;

        for (const node of cell) {
          if (seenIds.has(node.id)) continue;

          // Check precise bounding box
          if (
            node.lat >= bounds.south &&
            node.lat <= bounds.north &&
            node.lng >= bounds.west &&
            node.lng <= bounds.east
          ) {
            seenIds.add(node.id);

            // Zoom tier filtering
            if (zoom <= 13) {
              if (this.isHub(node)) {
                candidates.push(node);
              }
            } else if (zoom <= 15) {
              if (this.isBusStopOrHub(node)) {
                candidates.push(node);
              }
            } else {
              candidates.push(node);
            }
          }
        }
      }
    }

    if (candidates.length <= maxCap) {
      return candidates;
    }

    // Sort to prioritize hubs first, then bus stops, then popularity
    candidates.sort((a, b) => {
      const aHub = this.isHub(a) ? 1 : 0;
      const bHub = this.isHub(b) ? 1 : 0;
      if (aHub !== bHub) return bHub - aHub;

      const aBus = this.isBusStopOrHub(a) ? 1 : 0;
      const bBus = this.isBusStopOrHub(b) ? 1 : 0;
      if (aBus !== bBus) return bBus - aBus;

      return (b.popularity || 0) - (a.popularity || 0);
    });

    return candidates.slice(0, maxCap);
  }
}
