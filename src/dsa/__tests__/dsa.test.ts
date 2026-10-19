import { describe, it, expect } from 'vitest';
import { MinHeap } from '../MinHeap';
import { Trie, levenshteinDistance } from '../Trie';
import { LruCache } from '../LruCache';
import { UnionFind } from '../UnionFind';
import { KdTree } from '../KdTree';
import { MultiModalGraph } from '../MultiModalGraph';
import { runDijkstra } from '../dijkstra';
import { runAStar } from '../aStar';
import { solveBudgetKnapsack } from '../DynamicProgramming';
import { PravahRouter } from '../PravahRouter';
import { TransitNode } from '../../types';

describe('MinHeap DSA Unit Tests', () => {
  it('should insert items and extract minimum priority in order', () => {
    const heap = new MinHeap();
    heap.insert({ id: 'c', priority: 30 });
    heap.insert({ id: 'a', priority: 10 });
    heap.insert({ id: 'b', priority: 20 });

    expect(heap.size()).toBe(3);
    expect(heap.extractMin()?.id).toBe('a');
    expect(heap.extractMin()?.id).toBe('b');
    expect(heap.extractMin()?.id).toBe('c');
    expect(heap.isEmpty()).toBe(true);
  });

  it('should support O(log N) decreaseKey via index map', () => {
    const heap = new MinHeap();
    heap.insert({ id: 'x', priority: 50 });
    heap.insert({ id: 'y', priority: 25 });

    expect(heap.decreaseKey('x', 15)).toBe(true);
    expect(heap.extractMin()?.id).toBe('x');
    expect(heap.extractMin()?.id).toBe('y');
  });
});

describe('Trie DSA & Levenshtein DP Tests', () => {
  const dummyNode1: TransitNode = {
    id: 'shalimar',
    name: 'Shalimar Chowk',
    nameMr: 'शालीमार चौक',
    nameHi: 'शालीमार चौक',
    lat: 19.9945,
    lng: 73.7878,
    type: 'junction',
    serves: ['R1'],
    popularity: 95,
  };

  it('should index and find prefix in O(L) time', () => {
    const trie = new Trie();
    trie.indexTransitNode(dummyNode1);

    const matches = trie.searchPrefix('shal');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].node.id).toBe('shalimar');
  });

  it('should calculate Levenshtein distance and perform fuzzy search for typos', () => {
    expect(levenshteinDistance('shalmar', 'shalimar')).toBe(1);

    const trie = new Trie();
    trie.indexTransitNode(dummyNode1);

    // Typo "shalmar" should match "Shalimar" via fuzzy DP fallback
    const fuzzyMatches = trie.searchPrefix('shalmar');
    expect(fuzzyMatches.length).toBeGreaterThan(0);
    expect(fuzzyMatches[0].node.id).toBe('shalimar');
  });
});

describe('LRU Cache DSA Tests', () => {
  it('should evict least recently used item when capacity is exceeded', () => {
    const cache = new LruCache<string, string>(2);
    cache.put('a', 'alpha');
    cache.put('b', 'beta');

    expect(cache.get('a')).toBe('alpha'); // 'a' becomes MRU, 'b' is LRU
    cache.put('c', 'gamma'); // Should evict 'b'

    expect(cache.get('b')).toBeNull();
    expect(cache.get('a')).toBe('alpha');
    expect(cache.get('c')).toBe('gamma');
  });
});

describe('Union-Find DSA Tests', () => {
  it('should track connected components with path compression', () => {
    const uf = new UnionFind(['A', 'B', 'C', 'D']);
    expect(uf.numComponents).toBe(4);

    uf.union('A', 'B');
    uf.union('B', 'C');
    expect(uf.connected('A', 'C')).toBe(true);
    expect(uf.connected('A', 'D')).toBe(false);
    expect(uf.numComponents).toBe(2);
  });
});

describe('Spatial 2D k-d Tree Tests', () => {
  it('should locate the nearest stop using geometric bounding cuts', () => {
    const nodes: TransitNode[] = [
      { id: 'n1', name: 'Stop 1', nameMr: '', nameHi: '', lat: 20.0, lng: 73.8, type: 'bus_stop', serves: [], popularity: 50 },
      { id: 'n2', name: 'Stop 2', nameMr: '', nameHi: '', lat: 20.05, lng: 73.85, type: 'bus_stop', serves: [], popularity: 60 },
    ];

    const tree = new KdTree(nodes);
    const nearest = tree.findKNearest(20.001, 73.801, 1);
    expect(nearest.length).toBe(1);
    expect(nearest[0].node.id).toBe('n1');
  });
});

describe('Knapsack Dynamic Programming Budget Tests', () => {
  it('should maximize destination popularity within budget', () => {
    const candidates = [
      {
        node: { id: 'ramkund', name: 'Ramkund', nameMr: '', nameHi: '', lat: 20.0, lng: 73.8, type: 'landmark', serves: [], popularity: 99 } as TransitNode,
        costInr: 15,
        value: 99,
      },
      {
        node: { id: 'sula', name: 'Sula', nameMr: '', nameHi: '', lat: 20.0, lng: 73.7, type: 'landmark', serves: [], popularity: 95 } as TransitNode,
        costInr: 45,
        value: 95,
      },
    ];

    const res = solveBudgetKnapsack(candidates, 30);
    expect(res.selectedDestinations.length).toBe(1);
    expect(res.selectedDestinations[0].id).toBe('ramkund');
    expect(res.totalCost).toBeLessThanOrEqual(30);
  });
});
