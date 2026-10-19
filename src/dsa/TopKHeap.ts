/**
 * Bounded Top-K Heap for Route Ranking
 *
 * Concepts:
 * - Solves the Top-K selection problem in O(N * log K) time instead of O(N * log N) full sort.
 * - Maintains a bounded heap of capacity K.
 * - User-Weighted Scoring Function:
 *     score = w_time * norm(minutes) + w_cost * norm(cost) + w_walk * norm(walk) - w_comfort * comfort
 *   Lower overall score represents a superior journey.
 *
 * Asymptotic Complexity:
 * - Time:  O(N * log K) where N is number of candidate routes and K is desired recommendations.
 * - Space: O(K)
 */

export interface ScoredItem<T = any> {
  id: string;
  score: number; // lower score is better
  data: T;
}

export class TopKHeap<T = any> {
  private heap: ScoredItem<T>[] = [];
  private capacity: number;

  constructor(k: number = 5) {
    this.capacity = k;
  }

  public size(): number {
    return this.heap.length;
  }

  /**
   * Adds an item into the bounded Top-K heap.
   * If heap exceeds capacity, evicts the highest (worst) score.
   */
  public push(id: string, score: number, data: T): void {
    const item: ScoredItem<T> = { id, score, data };

    if (this.heap.length < this.capacity) {
      this.heap.push(item);
      this.bubbleUp(this.heap.length - 1);
    } else {
      // If candidate is better (lower score) than worst in heap (heap[0] for max-heap), replace root
      if (score < this.heap[0].score) {
        this.heap[0] = item;
        this.bubbleDown(0);
      }
    }
  }

  /**
   * Returns items sorted from best (lowest score) to worst.
   */
  public getSortedResults(): ScoredItem<T>[] {
    return [...this.heap].sort((a, b) => a.score - b.score);
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      // Max-heap on score: larger score is parent
      if (this.heap[index].score > this.heap[parent].score) {
        this.swap(index, parent);
        index = parent;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    const len = this.heap.length;
    while (true) {
      let largest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < len && this.heap[left].score > this.heap[largest].score) {
        largest = left;
      }
      if (right < len && this.heap[right].score > this.heap[largest].score) {
        largest = right;
      }

      if (largest !== index) {
        this.swap(index, largest);
        index = largest;
      } else {
        break;
      }
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }
}
