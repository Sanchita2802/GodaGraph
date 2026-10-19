/**
 * Least Recently Used (LRU) Cache
 *
 * Data Structures:
 * - Hash Map (Map<string, DListNode>): Provides O(1) key-to-node lookup.
 * - Doubly Linked List (DLL) with dummy head and tail:
 *   Provides O(1) node detachment and O(1) front insertion.
 *
 * Cache Replacement Policy:
 * - On get(key): If present, move node to head of DLL (marked Most Recently Used).
 * - On put(key, value): If key exists, update value and move to head.
 *   If key does not exist and capacity is exceeded, evict the tail node (Least Recently Used) in O(1).
 *
 * Asymptotic Complexity:
 * - get(key):           O(1) time
 * - put(key, value):    O(1) time
 * - evict():            O(1) time
 * - Space Complexity:   O(Capacity)
 */

export class DListNode<K, V> {
  public key: K;
  public value: V;
  public prev: DListNode<K, V> | null = null;
  public next: DListNode<K, V> | null = null;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}

export class LruCache<K = string, V = any> {
  private capacity: number;
  private map: Map<K, DListNode<K, V>> = new Map();
  private head: DListNode<K, V>;
  private tail: DListNode<K, V>;

  public hits: number = 0;
  public misses: number = 0;

  constructor(capacity: number = 50) {
    this.capacity = capacity;

    // Sentinel dummy nodes
    this.head = new DListNode<K, V>(null as any, null as any);
    this.tail = new DListNode<K, V>(null as any, null as any);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  public size(): number {
    return this.map.size;
  }

  public get(key: K): V | null {
    const node = this.map.get(key);
    if (!node) {
      this.misses++;
      return null;
    }

    this.hits++;
    // Move to front (MRU)
    this.removeNode(node);
    this.addToHead(node);
    return node.value;
  }

  public put(key: K, value: V): void {
    const existingNode = this.map.get(key);
    if (existingNode) {
      existingNode.value = value;
      this.removeNode(existingNode);
      this.addToHead(existingNode);
      return;
    }

    const newNode = new DListNode<K, V>(key, value);
    this.map.set(key, newNode);
    this.addToHead(newNode);

    // Evict least recently used if over capacity
    if (this.map.size > this.capacity) {
      const lruNode = this.tail.prev!;
      this.removeNode(lruNode);
      this.map.delete(lruNode.key);
    }
  }

  public delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  public deletePrefix(prefix: string): void {
    for (const key of Array.from(this.map.keys())) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        this.delete(key);
      }
    }
  }

  public clear(): void {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.hits = 0;
    this.misses = 0;
  }

  public getStats(): { hits: number; misses: number; hitRate: number; size: number; capacity: number } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate),
      size: this.map.size,
      capacity: this.capacity,
    };
  }

  public getKeysInOrder(): K[] {
    const keys: K[] = [];
    let curr = this.head.next;
    while (curr && curr !== this.tail) {
      keys.push(curr.key);
      curr = curr.next;
    }
    return keys;
  }

  private removeNode(node: DListNode<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private addToHead(node: DListNode<K, V>): void {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next!.prev = node;
    this.head.next = node;
  }
}
