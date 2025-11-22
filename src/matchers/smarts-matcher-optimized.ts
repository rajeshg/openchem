/**
 * Optimized SMARTS Matching using PackedMol
 *
 * This module provides SMARTS matching optimized for PackedMol representation,
 * offering better performance for bulk operations and molecular similarity searches.
 */

import type {
  SMARTSPattern,
  MatchResult,
  SMARTSMatchOptions,
} from "src/types/smarts-types";
import { matchSMARTS as matchSMARTSBase } from "src/matchers/smarts-matcher";
import type { MoleculeOrPacked } from "src/utils/molecule-adapter";
import { getMolecule } from "src/utils/molecule-adapter";

/**
 * Match SMARTS pattern against molecule (accepts both Molecule and PackedMolecule)
 *
 * Automatically optimizes for PackedMolecule by avoiding unnecessary conversions.
 */
export function matchSMARTSOptimized(
  pattern: string | SMARTSPattern,
  molecule: MoleculeOrPacked,
  options?: SMARTSMatchOptions,
): MatchResult {
  const mol = getMolecule(molecule);
  return matchSMARTSBase(pattern, mol, options);
}

/**
 * Bulk SMARTS matching on multiple molecules
 *
 * Significantly faster than individual calls because:
 * - Pattern is parsed once
 * - Each molecule can be processed independently
 * - Caching benefits from repeated pattern use
 */
export function bulkMatchSMARTS(
  pattern: string | SMARTSPattern,
  molecules: MoleculeOrPacked[],
  options?: SMARTSMatchOptions,
): MatchResult[] {
  return molecules.map((mol) => matchSMARTSOptimized(pattern, mol, options));
}

/**
 * Find all molecules matching a SMARTS pattern
 *
 * Returns indices and match details for molecules containing the pattern.
 */
export function filterByPattern(
  pattern: string | SMARTSPattern,
  molecules: MoleculeOrPacked[],
  options?: SMARTSMatchOptions,
): {
  indices: number[];
  results: MatchResult[];
} {
  const results: MatchResult[] = [];
  const indices: number[] = [];

  for (let i = 0; i < molecules.length; i++) {
    const result = matchSMARTSOptimized(pattern, molecules[i]!, options);
    if (result.success) {
      indices.push(i);
      results.push(result);
    }
  }

  return { indices, results };
}

/**
 * Count pattern matches in a molecule
 */
export function countPatternMatches(
  pattern: string | SMARTSPattern,
  molecule: MoleculeOrPacked,
): number {
  const result = matchSMARTSOptimized(pattern, molecule);
  return result.matches.length;
}
