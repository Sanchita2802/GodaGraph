/**
 * Multilingual Trie (Prefix Tree) with Precomputed Top-N Popularity Caching
 * and Dynamic Programming Levenshtein Distance Fuzzy Fallback
 *
 * Concepts:
 * - Multilingual support: Handles English, Marathi, Hindi, and colloquial abbreviations/aliases.
 * - O(L) Prefix Lookup: Each Trie node maintains a precomputed list of the top-N completions
 *   ranked by popularity score, eliminating expensive sub-tree traversals during real-time typing.
 * - Levenshtein Distance (DP): When a prefix yields zero matches (e.g. user types "Shalmar" or "Panchvati"),
 *   a 2D Dynamic Programming edit-distance table evaluates candidates within edit distance <= 2.
 *
 * Asymptotic Complexity:
 * - Insertion:              O(L) where L is the string length.
 * - Prefix Autocomplete:    O(L) time (retrieves precomputed top completions directly from prefix node).
 * - Levenshtein DP Fallback: O(M * N) for comparing query of length M against candidate of length N.
 * - Space:                  O(Sigma * L * |V|)
 */

import { TransitNode } from '../types';

export interface AutocompleteResult {
  node: TransitNode;
  matchedName: string;
  matchedLanguage: 'en' | 'mr' | 'hi' | 'alias';
  score: number;
}

class TrieNode {
  public children: Map<string, TrieNode> = new Map();
  public isEndOfWord: boolean = false;
  public nodeData?: TransitNode;
  public matchedLang?: 'en' | 'mr' | 'hi' | 'alias';
  // Precomputed top completions cached directly at this node
  public topCompletions: AutocompleteResult[] = [];
}

export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  // Initialize DP table of size (m+1) x (n+1)
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1].toLowerCase() === s2[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

export class Trie {
  private root: TrieNode = new TrieNode();
  private allNodesList: TransitNode[] = [];

  constructor() {}

  /**
   * Normalizes strings for index matching
   */
  private normalize(str: string): string {
    return str.toLowerCase().trim().replace(/[\s\-_]+/g, ' ');
  }

  /**
   * Inserts a word and its corresponding TransitNode into the Trie
   */
  public insert(
    word: string,
    node: TransitNode,
    lang: 'en' | 'mr' | 'hi' | 'alias'
  ): void {
    const normalized = this.normalize(word);
    if (!normalized) return;

    let curr = this.root;
    const resultItem: AutocompleteResult = {
      node,
      matchedName: word,
      matchedLanguage: lang,
      score: node.popularity,
    };

    this.updateTopCompletions(curr, resultItem);

    for (const char of normalized) {
      if (!curr.children.has(char)) {
        curr.children.set(char, new TrieNode());
      }
      curr = curr.children.get(char)!;
      this.updateTopCompletions(curr, resultItem);
    }

    curr.isEndOfWord = true;
    curr.nodeData = node;
    curr.matchedLang = lang;
  }

  /**
   * Maintains precomputed top-6 completions sorted by popularity score
   */
  private updateTopCompletions(
    node: TrieNode,
    newItem: AutocompleteResult
  ): void {
    const existingIndex = node.topCompletions.findIndex(
      (item) => item.node.id === newItem.node.id
    );

    if (existingIndex !== -1) {
      if (newItem.score > node.topCompletions[existingIndex].score) {
        node.topCompletions[existingIndex] = newItem;
      }
    } else {
      node.topCompletions.push(newItem);
    }

    // Sort descending by popularity
    node.topCompletions.sort((a, b) => b.score - a.score);

    // Keep top 6 items
    if (node.topCompletions.length > 6) {
      node.topCompletions.pop();
    }
  }

  /**
   * Indexes an entire TransitNode across all languages and aliases
   */
  public indexTransitNode(node: TransitNode): void {
    this.allNodesList.push(node);

    // English name
    this.insert(node.name, node, 'en');

    // Marathi name
    if (node.nameMr) {
      this.insert(node.nameMr, node, 'mr');
    }

    // Hindi name
    if (node.nameHi) {
      this.insert(node.nameHi, node, 'hi');
    }

    // Aliases
    if (node.aliases) {
      for (const alias of node.aliases) {
        this.insert(alias, node, 'alias');
      }
    }
  }

  /**
   * Searches for top completions given a typed prefix.
   * Time Complexity: O(L) where L is prefix length!
   */
  public searchPrefix(prefix: string): AutocompleteResult[] {
    const normalized = this.normalize(prefix);
    if (!normalized) return [];

    let curr = this.root;
    for (const char of normalized) {
      if (!curr.children.has(char)) {
        // No exact prefix match -> trigger Levenshtein DP fuzzy search
        return this.fuzzySearch(normalized, 5);
      }
      curr = curr.children.get(char)!;
    }

    return curr.topCompletions;
  }

  /**
   * Fuzzy fallback using Levenshtein Dynamic Programming table.
   * Activates when user types typos like "Shalmar" or "Panchvati".
   */
  public fuzzySearch(query: string, maxResults: number = 5): AutocompleteResult[] {
    const candidates: { item: AutocompleteResult; dist: number }[] = [];

    for (const node of this.allNodesList) {
      const namesToCheck = [node.name, ...(node.aliases || [])];
      let minDistance = Infinity;
      let bestName = node.name;

      for (const fullName of namesToCheck) {
        // Check full name, individual words, and matching prefix lengths
        const words = fullName.split(/[\s,\-_]+/);
        for (const word of [fullName, ...words]) {
          const dist = levenshteinDistance(query, word);
          if (dist < minDistance) {
            minDistance = dist;
            bestName = fullName;
          }
        }
      }

      // Allow edit distance <= 2 for queries >= 5 chars
      const threshold = query.length <= 4 ? 1 : 2;

      if (minDistance <= threshold) {
        candidates.push({
          item: {
            node,
            matchedName: bestName,
            matchedLanguage: 'en',
            score: node.popularity - minDistance * 10,
          },
          dist: minDistance,
        });
      }
    }

    // Sort first by edit distance ascending, then by popularity descending
    candidates.sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return b.item.score - a.item.score;
    });

    return candidates.slice(0, maxResults).map((c) => c.item);
  }
}
