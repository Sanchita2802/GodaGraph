/**
 * Dynamic Programming Algorithms:
 * 1. Budget Mode: 0/1 Knapsack Optimization for Maximizing Reachable Destinations within Rs X.
 * 2. Rainy Day Mode: Walk-Penalizing Cost Formulation.
 *
 * Concepts:
 * - Budget Mode (0/1 Knapsack):
 *   Given an origin and a fixed wallet budget B (in INR), find the subset of reachable Nashik landmarks
 *   that maximizes the total cultural/popularity score without exceeding budget B.
 *   Recurrence relation:
 *     DP[i][w] = max(DP[i-1][w], DP[i-1][w - cost[i]] + value[i])
 *
 * - Rainy Day Mode:
 *   Applies weather-dependent transformation on edge weights. Open walking in tropical monsoon downpours
 *   incurs a high penalty multiplier (lambda = 3.5x), incentivizing roofed city buses and cabs.
 *
 * Asymptotic Complexity:
 * - Knapsack Budget DP:  Time O(N * B), Space O(N * B) (where N is candidates, B is integer budget).
 * - Rainy Day Weighting: Time O(|E|) linear transformation.
 */

import { TransitNode } from '../types';

export interface BudgetDestinationItem {
  node: TransitNode;
  costInr: number;
  value: number; // popularity score
}

export interface KnapsackBudgetResult {
  selectedDestinations: TransitNode[];
  totalCost: number;
  totalScore: number;
  dpTable: number[][]; // For DP matrix visualization in DSA Lab
  candidates: BudgetDestinationItem[];
}

export function solveBudgetKnapsack(
  candidates: BudgetDestinationItem[],
  maxBudgetInr: number
): KnapsackBudgetResult {
  const n = candidates.length;
  const B = Math.max(0, Math.floor(maxBudgetInr));

  // DP table of size (n + 1) x (B + 1)
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(B + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const item = candidates[i - 1];
    const cost = Math.min(B + 1, Math.max(1, Math.round(item.costInr)));
    const value = item.value;

    for (let w = 0; w <= B; w++) {
      if (cost <= w) {
        dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - cost] + value);
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  // Backtrack to find chosen items
  const selected: TransitNode[] = [];
  let w = B;
  let accumulatedCost = 0;

  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      const item = candidates[i - 1];
      selected.unshift(item.node);
      accumulatedCost += Math.round(item.costInr);
      w -= Math.min(B, Math.max(1, Math.round(item.costInr)));
    }
  }

  return {
    selectedDestinations: selected,
    totalCost: accumulatedCost,
    totalScore: dp[n][B],
    dpTable: dp,
    candidates,
  };
}

export function applyRainyDayPenalty(
  baseMinutes: number,
  mode: string,
  isRainy: boolean
): number {
  if (!isRainy) return baseMinutes;

  if (mode === 'walk') {
    // Walking in heavy monsoon rain is heavily penalized (soaked clothes, mud, potholes)
    return baseMinutes * 3.5 + 5;
  }
  if (mode === 'auto') {
    // Shared or open auto rickshaw splash penalty
    return baseMinutes * 1.35;
  }
  if (mode === 'bus') {
    // Bus is sheltered; slight traffic slowdown
    return baseMinutes * 1.15;
  }
  if (mode === 'cab') {
    // Cab is closed AC/sheltered; slight traffic slowdown
    return baseMinutes * 1.15;
  }
  return baseMinutes;
}
