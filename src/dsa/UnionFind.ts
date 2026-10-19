/**
 * Disjoint Set Union (Union-Find) with Path Compression & Union by Rank
 *
 * Concepts:
 * - Data Structure: Partitions elements into disjoint connected component sets.
 * - Path Compression: Flattens tree on find(x) so that every traversed node points directly to the set representative.
 * - Union by Rank: Attaches tree of smaller depth under root of tree with greater depth.
 * - Application in GodaGraph:
 *   Validates transit network connectivity. Detects isolated stops or disjoint network clusters.
 *
 * Asymptotic Complexity:
 * - Find(x):             O(alpha(N)) nearly O(1) amortized (inverse Ackermann function <= 4)
 * - Union(x, y):         O(alpha(N)) nearly O(1) amortized
 * - Connected(x, y):     O(alpha(N))
 * - Space Complexity:    O(N) for parent and rank arrays
 */

export class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();
  private setSize: Map<string, number> = new Map();
  public numComponents: number = 0;

  constructor(elements?: string[]) {
    if (elements) {
      for (const el of elements) {
        this.add(el);
      }
    }
  }

  public add(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
      this.setSize.set(x, 1);
      this.numComponents++;
    }
  }

  /**
   * Finds the representative root of the set containing x with Path Compression.
   * Amortized Time: O(alpha(N))
   */
  public find(x: string): string {
    if (!this.parent.has(x)) {
      this.add(x);
      return x;
    }

    if (this.parent.get(x) !== x) {
      // Path compression: point directly to the set root
      const root = this.find(this.parent.get(x)!);
      this.parent.set(x, root);
    }

    return this.parent.get(x)!;
  }

  /**
   * Unites the sets containing x and y using Union by Rank.
   * Amortized Time: O(alpha(N))
   */
  public union(x: string, y: string): boolean {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return false; // Already in same component

    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;
    const sizeX = this.setSize.get(rootX) || 1;
    const sizeY = this.setSize.get(rootY) || 1;

    // Attach smaller rank tree under larger rank tree
    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
      this.setSize.set(rootY, sizeX + sizeY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
      this.setSize.set(rootX, sizeX + sizeY);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
      this.setSize.set(rootX, sizeX + sizeY);
    }

    this.numComponents--;
    return true;
  }

  public connected(x: string, y: string): boolean {
    return this.find(x) === this.find(y);
  }

  public getComponentSize(x: string): number {
    const root = this.find(x);
    return this.setSize.get(root) || 1;
  }

  /**
   * Groups all elements into their respective connected components
   */
  public getAllComponents(): Map<string, string[]> {
    const components = new Map<string, string[]>();

    for (const el of this.parent.keys()) {
      const root = this.find(el);
      const group = components.get(root) || [];
      group.push(el);
      components.set(root, group);
    }

    return components;
  }
}
