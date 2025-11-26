import type { Molecule } from "types";
import type { MatchResult, SMARTSPattern } from "src/types/smarts-types";
import { matchSMARTS } from "src/matchers/smarts-matcher";
import { computeLogP } from "src/utils/logp";
import {
  checkLipinskiRuleOfFive,
  checkVeberRules,
  checkBBBPenetration,
} from "src/utils/molecular-properties";
import { computeMorganFingerprint, tanimotoSimilarity } from "src/utils/morgan-fingerprint";

/**
 * Bulk SMARTS matching results for a set of molecules
 */
export interface BulkSMARTSResult {
  pattern: string;
  moleculeMatches: Array<{
    moleculeIndex: number;
    matches: MatchResult["matches"];
  }>;
}

/**
 * Bulk molecular property results
 */
export interface BulkPropertiesResult {
  moleculeIndex: number;
  logp: number;
  lipinski: {
    passed: boolean;
    violations: string[];
  };
  veber: {
    passed: boolean;
    violations: string[];
  };
  bbb: {
    passed: boolean;
  };
}

/**
 * Bulk fingerprint comparison result
 */
export interface BulkFingerprintResult {
  queryIndex: number;
  targetIndex: number;
  similarity: number;
}

/**
 * Perform SMARTS matching on multiple molecules efficiently
 *
 * @param pattern SMARTS pattern string or compiled pattern
 * @param molecules Array of molecules to match against
 * @returns Bulk SMARTS results with matches for each molecule
 *
 * @example
 * ```typescript
 * const molecules = [mol1, mol2, mol3];
 * const results = bulkMatchSMARTS("[#6]~[#8]", molecules);
 * // Results include matches for each molecule
 * ```
 */
export function bulkMatchSMARTS(
  pattern: string | SMARTSPattern,
  molecules: Molecule[],
): BulkSMARTSResult {
  const patternStr = typeof pattern === "string" ? pattern : "";

  const moleculeMatches = molecules.map((mol, index) => ({
    moleculeIndex: index,
    matches: matchSMARTS(pattern, mol).matches,
  }));

  return {
    pattern: patternStr,
    moleculeMatches,
  };
}

/**
 * Compute molecular properties for multiple molecules efficiently
 *
 * @param molecules Array of molecules to analyze
 * @returns Bulk properties results including LogP and drug-likeness checks
 *
 * @example
 * ```typescript
 * const molecules = [aspirin, ibuprofen, caffeine];
 * const results = bulkComputeProperties(molecules);
 * // Results include LogP, Lipinski, Veber, and BBB penetration for each
 * ```
 */
export function bulkComputeProperties(molecules: Molecule[]): BulkPropertiesResult[] {
  return molecules.map((mol, index) => {
    const logp = computeLogP(mol);
    const lipinski = checkLipinskiRuleOfFive(mol);
    const veber = checkVeberRules(mol);
    const bbb = checkBBBPenetration(mol);

    return {
      moleculeIndex: index,
      logp,
      lipinski: {
        passed: lipinski.passes,
        violations: lipinski.violations,
      },
      veber: {
        passed: veber.passes,
        violations: veber.violations,
      },
      bbb: {
        passed: bbb.likelyPenetration,
      },
    };
  });
}

/**
 * Compute pairwise fingerprint similarities for molecules
 *
 * @param molecules Array of molecules to compare
 * @param radius Morgan fingerprint radius (default 2)
 * @param fpSize Fingerprint size in bits (default 2048)
 * @returns Pairwise similarity matrix results
 *
 * @example
 * ```typescript
 * const molecules = [mol1, mol2, mol3];
 * const similarities = bulkComputeSimilarities(molecules, 2, 512);
 * // Results include pairwise Tanimoto similarities
 * ```
 */
export function bulkComputeSimilarities(
  molecules: Molecule[],
  radius: number = 2,
  fpSize: number = 2048,
): BulkFingerprintResult[] {
  // Precompute all fingerprints
  const fingerprints = molecules.map((mol) => computeMorganFingerprint(mol, radius, fpSize));

  // Compute pairwise similarities
  const results: BulkFingerprintResult[] = [];
  for (let i = 0; i < molecules.length; i++) {
    for (let j = i + 1; j < molecules.length; j++) {
      const similarity = tanimotoSimilarity(fingerprints[i]!, fingerprints[j]!);
      results.push({
        queryIndex: i,
        targetIndex: j,
        similarity,
      });
    }
  }

  return results;
}

/**
 * Find molecules similar to a query using fingerprints
 *
 * @param queryMolecule Query molecule
 * @param targetMolecules Array of target molecules to search
 * @param threshold Similarity threshold (0-1, default 0.7)
 * @param radius Morgan fingerprint radius (default 2)
 * @param fpSize Fingerprint size in bits (default 2048)
 * @returns Array of similar molecules with their similarity scores
 *
 * @example
 * ```typescript
 * const query = aspirin;
 * const similar = bulkFindSimilar(query, drugLibrary, 0.8);
 * // Results include all molecules in drugLibrary with similarity >= 0.8
 * ```
 */
export function bulkFindSimilar(
  queryMolecule: Molecule,
  targetMolecules: Molecule[],
  threshold: number = 0.7,
  radius: number = 2,
  fpSize: number = 2048,
): Array<{
  targetIndex: number;
  similarity: number;
}> {
  const queryFingerprint = computeMorganFingerprint(queryMolecule, radius, fpSize);

  const results: Array<{ targetIndex: number; similarity: number }> = [];

  for (let i = 0; i < targetMolecules.length; i++) {
    const targetFingerprint = computeMorganFingerprint(targetMolecules[i]!, radius, fpSize);
    const similarity = tanimotoSimilarity(queryFingerprint, targetFingerprint);

    if (similarity >= threshold) {
      results.push({
        targetIndex: i,
        similarity,
      });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  return results;
}

/**
 * Filter molecules by drug-likeness rules
 *
 * @param molecules Array of molecules to filter
 * @returns Object containing molecules passing each filter
 *
 * @example
 * ```typescript
 * const candidates = bulkFilterDrugLike(compounds);
 * const lipinskiPassers = candidates.lipinskiPassers;
 * const veberPassers = candidates.veberPassers;
 * const bbbPassers = candidates.bbbPassers;
 * ```
 */
export function bulkFilterDrugLike(molecules: Molecule[]): {
  lipinskiPassers: Array<{ index: number; molecule: Molecule }>;
  veberPassers: Array<{ index: number; molecule: Molecule }>;
  bbbPassers: Array<{ index: number; molecule: Molecule }>;
  allPassers: Array<{ index: number; molecule: Molecule }>;
} {
  const lipinskiPassers: Array<{ index: number; molecule: Molecule }> = [];
  const veberPassers: Array<{ index: number; molecule: Molecule }> = [];
  const bbbPassers: Array<{ index: number; molecule: Molecule }> = [];
  const allPassers: Array<{ index: number; molecule: Molecule }> = [];

  for (let i = 0; i < molecules.length; i++) {
    const mol = molecules[i]!;
    const lipinski = checkLipinskiRuleOfFive(mol);
    const veber = checkVeberRules(mol);
    const bbb = checkBBBPenetration(mol);

    if (lipinski.passes) {
      lipinskiPassers.push({ index: i, molecule: mol });
    }
    if (veber.passes) {
      veberPassers.push({ index: i, molecule: mol });
    }
    if (bbb.likelyPenetration) {
      bbbPassers.push({ index: i, molecule: mol });
    }

    if (lipinski.passes && veber.passes && bbb.likelyPenetration) {
      allPassers.push({ index: i, molecule: mol });
    }
  }

  return {
    lipinskiPassers,
    veberPassers,
    bbbPassers,
    allPassers,
  };
}
