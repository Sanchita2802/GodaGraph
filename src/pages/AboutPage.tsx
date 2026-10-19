import React from 'react';
import { Cpu, BookOpen, HelpCircle, ShieldCheck, CheckCircle2, ChevronRight, Layers } from 'lucide-react';
import { ClayCard } from '../components/clay';

export const AboutPage: React.FC = () => {
  const dsaConcepts = [
    {
      concept: 'Multimodal Time-Expanded Graph',
      module: 'MultiModalGraph.ts',
      timeComplexity: 'O(|V| + |E|)',
      spaceComplexity: 'O(|V| + |E|)',
      description: 'Adjacency list representation supporting bus, shared auto, cab, and pedestrian transfer edges.',
    },
    {
      concept: 'Indexed Binary Min-Heap',
      module: 'MinHeap.ts',
      timeComplexity: 'O(log N) decreaseKey',
      spaceComplexity: 'O(N)',
      description: 'Custom complete binary tree with a hash-index map achieving O(log N) decrease-key instead of O(N).',
    },
    {
      concept: 'Dijkstra Single-Source Shortest Path',
      module: 'dijkstra.ts',
      timeComplexity: 'O((|V| + |E|) log |V|)',
      spaceComplexity: 'O(|V| + |E|)',
      description: 'Greedy label-setting algorithm with complete trace logging for DSA Lab animations.',
    },
    {
      concept: 'Admissible A* Heuristic Search',
      module: 'aStar.ts',
      timeComplexity: 'O((|V| + |E|) log |V|)',
      spaceComplexity: 'O(|V|)',
      description: 'Goal-directed pruning using admissible Haversine lower bound divided by max velocity (60 km/h).',
    },
    {
      concept: 'Time-Dependent Dijkstra',
      module: 'timeDependentDijkstra.ts',
      timeComplexity: 'O((|V| + |E|) log |V|)',
      spaceComplexity: 'O(|V| + |E|)',
      description: 'Edge weights are non-linear functions of departure minute; preserves FIFO property under hourly traffic.',
    },
    {
      concept: 'Multi-Criteria Pareto Labeling',
      module: 'paretoLabeling.ts',
      timeComplexity: 'O(|E| · |P_max|²)',
      spaceComplexity: 'O(|V| · |P_max|)',
      description: 'Maintains non-dominated label frontier per node across (time, money, walk, transfers).',
    },
    {
      concept: "Yen's K-Shortest Loopless Paths",
      module: 'yensKShortestPaths.ts',
      timeComplexity: 'O(K · |V| · (|E| + |V| log |V|))',
      spaceComplexity: 'O(K · |V|)',
      description: 'Computes K=5 loopless alternate paths using root and spur paths with masked edge deviations.',
    },
    {
      concept: 'Multilingual Trie with Levenshtein DP',
      module: 'Trie.ts',
      timeComplexity: 'O(L) prefix / O(M·N) DP',
      spaceComplexity: 'O(Σ · L · |V|)',
      description: 'Prefix tree indexing English, Marathi, Hindi and aliases with precomputed top-6 completions and typo tolerance.',
    },
    {
      concept: 'LRU Cache (DLL + Hash Map)',
      module: 'LruCache.ts',
      timeComplexity: 'O(1) get & put',
      spaceComplexity: 'O(Capacity)',
      description: 'Doubly linked list with sentinel dummy nodes and Map for instant sub-millisecond route recalls.',
    },
    {
      concept: 'Disjoint Set Union (Union-Find)',
      module: 'UnionFind.ts',
      timeComplexity: 'O(α(N)) amortized',
      spaceComplexity: 'O(N)',
      description: 'Path compression and union-by-rank validating transit connectivity and detecting isolated stops.',
    },
    {
      concept: '2D Spatial k-d Tree',
      module: 'KdTree.ts',
      timeComplexity: 'O(log N) NN search',
      spaceComplexity: 'O(N)',
      description: 'Binary space partitioning alternating Latitude and Longitude to find nearest stops to user GPS.',
    },
    {
      concept: 'Top-K Bounded Ranking Heap',
      module: 'TopKHeap.ts',
      timeComplexity: 'O(N log K)',
      spaceComplexity: 'O(K)',
      description: 'Ranks candidate routes by user-weighted preference score in O(N log K) without full sorting.',
    },
    {
      concept: '0/1 Knapsack Budget DP',
      module: 'DynamicProgramming.ts',
      timeComplexity: 'O(N · B)',
      spaceComplexity: 'O(N · B)',
      description: 'Dynamic programming table maximizing cumulative destination popularity reachable within wallet ₹X.',
    },
    {
      concept: 'Pravah Routing Algorithm',
      module: 'PravahRouter.ts',
      timeComplexity: 'O(|E| · |P_max|²)',
      spaceComplexity: 'O(|V| · |P_max|)',
      description: 'Original algorithm: 5D Comfort Pareto + Poisson headway confidence + standby Plan B auto lifelines.',
    },
  ];

  const vivaQuestions = [
    {
      q: '1. Why is Haversine distance scaled by max speed admissible for A* in transit routing?',
      a: 'An A* heuristic h(n) is admissible if h(n) <= h*(n) for all nodes n, where h*(n) is the true remaining cost. Since no vehicle can physically travel faster than MAX_SPEED_KMH (60 km/h in city traffic), distance / MAX_SPEED is a strict lower bound on real travel time. Therefore, h never overestimates and A* is guaranteed to find the true optimal shortest path.',
    },
    {
      q: '2. How does custom MinHeap achieve O(log N) decrease-key instead of JavaScript arrays?',
      a: 'We maintain an internal index Map<string, number> that maps each node ID to its current index in the complete binary heap array. When relaxing an edge to node v, looking up v’s position in the heap takes O(1) time. We then update its priority and bubble it up towards the root in O(log N) time.',
    },
    {
      q: '3. What is the FIFO property in Time-Dependent Dijkstra, and why is it essential?',
      a: 'The FIFO (First-In, First-Out) property states that if commuter A departs node u before commuter B along edge (u, v), commuter A will not arrive at node v after commuter B: t1 <= t2 implies t1 + c(e, t1) <= t2 + c(e, t2). Because traffic delays and bus schedules preserve FIFO, Dijkstra’s greedy label-setting property remains mathematically optimal without needing all-pairs shortest paths.',
    },
    {
      q: '4. How does Multi-Criteria Pareto Labeling avoid an exponential state explosion?',
      a: 'We define Pareto dominance: Label A dominates Label B if A is at least as good in all criteria (time, cost, walk distance, transfers) and strictly better in at least one. Any candidate label dominated by an existing label in the node’s Pareto set is immediately pruned. We also bound the frontier size per node (|P_max| <= 25), preserving polynomial runtime O(|E| * |P_max|^2).',
    },
    {
      q: '5. How does the Trie autocomplete achieve O(L) lookup independent of vocabulary size?',
      a: 'Instead of doing a full Depth-First Search over the subtree after finding the prefix node of length L, each Trie node maintains a precomputed array of the top-6 completions sorted by popularity score. The autocomplete simply traverses the prefix of length L and immediately returns the cached array in O(L) time.',
    },
    {
      q: '6. When does the Levenshtein DP fallback activate in the Trie?',
      a: 'When a typed prefix fails to match any children in the Trie (such as a typo "Shalmar" or "Panchvati"), the system falls back to a 2D dynamic programming Levenshtein table of size (M+1) x (N+1) to calculate minimum edit distance <= 2, providing typo tolerance.',
    },
    {
      q: '7. How does a 2D k-d tree accelerate GPS nearest-stop queries compared to a linear scan?',
      a: 'A linear scan checks all N stops in O(N) time. The k-d tree partitions 2D space alternating on Latitude and Longitude. During search, it evaluates the cutting plane distance; if the distance from the query to the splitting line exceeds the current best candidate, the entire opposite subtree is pruned, achieving O(log N) expected query time.',
    },
    {
      q: '8. Explain the core novelty of the Pravah Routing algorithm.',
      a: 'Pravah integrates environmental discomfort (heat, rain, crowding) as a 5th Pareto dimension alongside time and cost. It models bus wait times as stochastic Poisson intervals with headway variance, computing an end-to-end connection confidence score. If confidence drops below threshold, Pravah automatically branches a standby auto/cab fallback ("Plan B") on the map.',
    },
    {
      q: '9. Why use an LRU Cache with a Doubly Linked List rather than a plain JavaScript Map?',
      a: 'While a Map provides O(1) key lookups, evicting the least recently used element from arbitrary positions in an array requires O(N) time. By pairing a Hash Map with a Doubly Linked List having dummy head and tail sentinels, node detachment and MRU front insertion take O(1) time, ensuring zero performance degradation under high query volume.',
    },
    {
      q: '10. How does Union-Find with path compression validate the transit dataset?',
      a: 'Union-Find groups stops into equivalence classes connected by walking or transit edges. Path compression flattens tree depth during find(), while union-by-rank keeps tree height logarithmic. If the total number of connected components equals 1, the entire city graph is verified as reachable without disconnected transit islands.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Hero */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-[#E0554B]/10 text-[#E0554B]">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Academic Project & Viva Preparation</span>
        </div>
        <h1 className="font-display font-light text-4xl sm:text-5xl text-[#3B2F4A] dark:text-[#F2EEF9]">
          GodaGraph DSA Architecture & Viva Guide
        </h1>
        <p className="text-sm text-[#7E708E] dark:text-[#9E94B3] max-w-2xl leading-relaxed">
          GodaGraph is a multimodal transit journey planner for Nashik engineered from scratch as a Data Structures & Algorithms showcase. Every algorithm is implemented without third-party pathfinding libraries.
        </p>
      </div>

      {/* System Architecture Card */}
      <ClayCard variant="default" className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#E0554B] uppercase tracking-wider">
          <Layers className="w-4 h-4" />
          <span>Architecture & Module Flow</span>
        </div>
        <h2 className="font-display font-bold text-2xl text-[#3B2F4A] dark:text-[#F2EEF9]">
          End-to-End System Pipeline
        </h2>
        <div className="p-4 rounded-2xl bg-black/4 dark:bg-white/5 font-mono text-xs leading-relaxed overflow-x-auto text-[#3B2F4A] dark:text-[#F2EEF9]">
          <pre>{`[User Query / Voice Mic]
      │
      ▼
[Gemini 3.8 Flash NLP Proxy] ──> Structured Intent { source, dest, budget, pref }
      │
      ▼
[Multilingual Trie (O(L))] ─────> Stop Validation & Fuzzy Typo Resolution
      │
      ▼
[LRU Cache (DLL + Map)] ───────> Cache Hit? (Return instant route < 1ms)
      │ (Cache Miss)
      ▼
[Pravah Multi-Criteria Engine]
  ├── 5D Pareto Front Optimization (Time, ₹ Cost, Walk, Transfers, Discomfort)
  ├── Stochastic Headway-Uncertainty Buffering (Poisson Reliability %)
  ├── Mode-Hopping Standby Graph Generator ("Plan B" Lifeline)
  └── Kumbh / Festival Dynamic Edge Reweighting
      │
      ▼
[Top-K Heap Selection (O(N log K))] ──> Ranked Journey Cards
      │
      ▼
[Leaflet Live Map & Animated Simulators] ──> Color-Coded Polylines & Live Buses`}</pre>
        </div>
      </ClayCard>

      {/* Comprehensive DSA Asymptotic Complexity Table */}
      <ClayCard variant="default" className="p-6 space-y-4 overflow-x-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-2xl text-[#3B2F4A] dark:text-[#F2EEF9]">
              DSA Concept & Complexity Reference Table
            </h2>
            <p className="text-xs text-[#7E708E]">
              All 14 algorithms implemented from scratch in src/dsa/
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E0554B]/10 text-[#E0554B]">
            14 Custom Modules
          </span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10 text-[#7E708E] uppercase tracking-wider">
              <th className="py-3 px-3">Algorithm / Concept</th>
              <th className="py-3 px-3">Source Module</th>
              <th className="py-3 px-3">Time Complexity</th>
              <th className="py-3 px-3">Space Complexity</th>
              <th className="py-3 px-3">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5 font-medium">
            {dsaConcepts.map((item, idx) => (
              <tr key={idx} className="hover:bg-black/2 dark:hover:bg-white/2">
                <td className="py-3 px-3 font-bold text-[#3B2F4A] dark:text-[#F2EEF9]">
                  {item.concept}
                </td>
                <td className="py-3 px-3 font-mono text-[#E0554B] text-[11px]">{item.module}</td>
                <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {item.timeComplexity}
                </td>
                <td className="py-3 px-3 font-mono text-[#8B5CF6]">{item.spaceComplexity}</td>
                <td className="py-3 px-3 text-[#7E708E] dark:text-[#9E94B3] max-w-xs leading-relaxed">
                  {item.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ClayCard>

      {/* 10 Examiner Viva Q&A Accordion */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#E0554B]" />
          <h2 className="font-display font-bold text-2xl text-[#3B2F4A] dark:text-[#F2EEF9]">
            Viva Examination Q&A (10 Questions & Solutions)
          </h2>
        </div>

        <div className="space-y-3">
          {vivaQuestions.map((viva, idx) => (
            <ClayCard key={idx} variant="default" className="p-5 space-y-2">
              <h4 className="font-bold text-sm text-[#3B2F4A] dark:text-[#F2EEF9]">
                {viva.q}
              </h4>
              <p className="text-xs text-[#6B5E7C] dark:text-[#B6ACCA] leading-relaxed pl-3 border-l-2 border-[#E0554B]">
                {viva.a}
              </p>
            </ClayCard>
          ))}
        </div>
      </div>
    </div>
  );
};
