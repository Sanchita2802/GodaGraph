/**
 * Custom Binary Min-Heap with Indexed Decrease-Key Support
 *
 * Data Structure:
 * - A complete binary tree represented as a flat array.
 * - An internal index Map (nodeId -> arrayIndex) to achieve O(log N) decrease-key.
 *
 * Asymptotic Complexity:
 * - Insert (Push):           O(log N) time
 * - Extract-Min (Pop):       O(log N) time
 * - Decrease-Key:            O(log N) time (vs O(N) without index map)
 * - Peek-Min:                O(1) time
 * - Contains / Lookup:       O(1) time
 * - Space Complexity:        O(N) memory for heap array + O(N) for index map
 *
 * Invariant:
 * - For any index i > 0, priority(parent(i)) <= priority(i).
 */

export interface HeapItem<T = any> {
  id: string;
  priority: number;
  data?: T;
}

export class MinHeap<T = any> {
  private heap: HeapItem<T>[] = [];
  private indexMap: Map<string, number> = new Map();
  public operationCount: number = 0;

  constructor(items?: HeapItem<T>[]) {
    if (items) {
      for (const item of items) {
        this.insert(item);
      }
    }
  }

  public size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public contains(id: string): boolean {
    return this.indexMap.has(id);
  }

  public getPriority(id: string): number | undefined {
    const idx = this.indexMap.get(id);
    if (idx !== undefined) {
      return this.heap[idx].priority;
    }
    return undefined;
  }

  public peek(): HeapItem<T> | null {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  /**
   * Inserts a new element or decreases key if already present.
   * Time: O(log N)
   */
  public insert(item: HeapItem<T>): void {
    this.operationCount++;
    if (this.indexMap.has(item.id)) {
      this.decreaseKey(item.id, item.priority, item.data);
      return;
    }

    const index = this.heap.length;
    this.heap.push(item);
    this.indexMap.set(item.id, index);
    this.bubbleUp(index);
  }

  /**
   * Extracts and returns the item with the minimum priority.
   * Time: O(log N)
   */
  public extractMin(): HeapItem<T> | null {
    this.operationCount++;
    if (this.heap.length === 0) return null;

    const minItem = this.heap[0];
    const lastItem = this.heap.pop()!;
    this.indexMap.delete(minItem.id);

    if (this.heap.length > 0) {
      this.heap[0] = lastItem;
      this.indexMap.set(lastItem.id, 0);
      this.bubbleDown(0);
    }

    return minItem;
  }

  /**
   * Updates an existing node's priority to a smaller value.
   * Time: O(log N)
   */
  public decreaseKey(id: string, newPriority: number, newData?: T): boolean {
    this.operationCount++;
    const idx = this.indexMap.get(id);
    if (idx === undefined) return false;

    if (newPriority >= this.heap[idx].priority) {
      // Heap only decreases key for Dijkstra/A*
      if (newData !== undefined) {
        this.heap[idx].data = newData;
      }
      return false;
    }

    this.heap[idx].priority = newPriority;
    if (newData !== undefined) {
      this.heap[idx].data = newData;
    }

    this.bubbleUp(idx);
    return true;
  }

  /**
   * Snapshot of heap state for UI visualization
   */
  public getSnapshot(): { id: string; priority: number }[] {
    return this.heap.map((item) => ({ id: item.id, priority: item.priority }));
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[index].priority < this.heap[parentIndex].priority) {
        this.swap(index, parentIndex);
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      let smallest = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (
        leftChild < length &&
        this.heap[leftChild].priority < this.heap[smallest].priority
      ) {
        smallest = leftChild;
      }

      if (
        rightChild < length &&
        this.heap[rightChild].priority < this.heap[smallest].priority
      ) {
        smallest = rightChild;
      }

      if (smallest !== index) {
        this.swap(index, smallest);
        index = smallest;
      } else {
        break;
      }
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
    this.indexMap.set(this.heap[i].id, i);
    this.indexMap.set(this.heap[j].id, j);
  }
}
