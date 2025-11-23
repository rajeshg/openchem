/**
 * Optimized Morgan Fingerprints using PackedMol
 *
 * This module provides accelerated Morgan fingerprint computation
 * supporting both Molecule and PackedMolecule input types.
 */

import type { MoleculeOrPacked } from "src/utils/molecule-adapter";
import { getMolecule } from "src/utils/molecule-adapter";
import {
  computeMorganFingerprint as computeBase,
  tanimotoSimilarity as tanimotoBase,
  getBitsSet as getBitsSetBase,
} from "src/utils/morgan-fingerprint";

/**
 * Compute Morgan fingerprint (accepts both Molecule and PackedMolecule)
 */
export function computeMorganFingerprintOptimized(
  molecule: MoleculeOrPacked,
  radius?: number,
  fpSize?: number,
): Uint8Array {
  const mol = getMolecule(molecule);
  return computeBase(mol, radius, fpSize);
}

/**
 * Compute Tanimoto similarity between two molecules
 */
export function tanimotoSimilarityOptimized(
  mol1: MoleculeOrPacked,
  mol2: MoleculeOrPacked,
  radius?: number,
  fpSize?: number,
): number {
  const m1 = getMolecule(mol1);
  const m2 = getMolecule(mol2);
  const fp1 = computeBase(m1, radius, fpSize);
  const fp2 = computeBase(m2, radius, fpSize);
  return tanimotoBase(fp1, fp2);
}

/**
 * Get count of bits set in fingerprint
 */
export function getBitsSetOptimized(fingerprint: Uint8Array): number {
  return getBitsSetBase(fingerprint);
}

/**
 * Bulk compute fingerprints for multiple molecules
 */
export function bulkComputeFingerprintsOptimized(
  molecules: MoleculeOrPacked[],
  radius?: number,
  fpSize?: number,
): Uint8Array[] {
  return molecules.map((mol) =>
    computeMorganFingerprintOptimized(mol, radius, fpSize),
  );
}

/**
 * Find similar molecules using Tanimoto threshold
 */
export function findSimilarOptimized(
  queryMol: MoleculeOrPacked,
  targetMols: MoleculeOrPacked[],
  threshold: number = 0.85,
  radius?: number,
  fpSize?: number,
): {
  indices: number[];
  similarities: number[];
} {
  const indices: number[] = [];
  const similarities: number[] = [];

  for (let i = 0; i < targetMols.length; i++) {
    const similarity = tanimotoSimilarityOptimized(
      queryMol,
      targetMols[i]!,
      radius,
      fpSize,
    );
    if (similarity >= threshold) {
      indices.push(i);
      similarities.push(similarity);
    }
  }

  return { indices, similarities };
}

/**
 * Compute all-vs-all Tanimoto similarity matrix
 */
export function computeSimilarityMatrixOptimized(
  molecules: MoleculeOrPacked[],
  radius?: number,
  fpSize?: number,
): number[][] {
  const fingerprints = bulkComputeFingerprintsOptimized(
    molecules,
    radius,
    fpSize,
  );
  const n = molecules.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const sim = tanimotoBase(fingerprints[i]!, fingerprints[j]!);
      matrix[i]![j] = sim;
      matrix[j]![i] = sim;
    }
  }

  return matrix;
}
