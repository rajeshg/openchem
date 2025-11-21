/**
 * CSR (Compressed Sparse Row) graph builder
 *
 * Converts adjacency lists to CSR format for O(1) neighbor lookup:
 * - degreeOffset: prefix sum of degrees
 * - bondTargets: concatenated neighbor lists
 * - bondAdj: parallel bond indices
 */

import type { Bond } from "types";

export interface CSRGraph {
  degreeOffset: Uint32Array;  // N+1 elements
  bondTargets: Uint32Array;   // 2M elements
  bondAdj: Uint16Array;       // 2M elements
}

/**
 * Build CSR adjacency structure from bond list
 *
 * For each bond A-B, we store:
 *   A → B in bondTargets with bond index in bondAdj
 *   B → A in bondTargets with bond index in bondAdj
 *
 * This enables:
 *   neighbors(atomIdx) = bondTargets[degreeOffset[atomIdx] ... degreeOffset[atomIdx+1]-1]
 *   bond_indices = bondAdj[degreeOffset[atomIdx] ... degreeOffset[atomIdx+1]-1]
 */
export function buildCSRGraph(
  atomCount: number,
  bonds: readonly Bond[],
  atomIndexMap: Map<number, number>,
): CSRGraph {
  const N = atomCount;
  const M = bonds.length;

  // Step 1: Count degree for each atom
  const degree = new Uint32Array(N);
  for (const bond of bonds) {
    const a = atomIndexMap.get(bond.atom1);
    const b = atomIndexMap.get(bond.atom2);

    if (a !== undefined && b !== undefined) {
      const aVal = degree[a] as number;
      const bVal = degree[b] as number;
      degree[a] = aVal + 1;
      degree[b] = bVal + 1;
    }
  }

  // Step 2: Build degreeOffset (prefix sum)
  const degreeOffset = new Uint32Array(N + 1);
  for (let i = 0; i < N; i++) {
    const prev = degreeOffset[i] as number;
    const deg = degree[i] as number;
    degreeOffset[i + 1] = prev + deg;
  }

  // Step 3: Fill bondTargets and bondAdj
  const bondTargets = new Uint32Array(2 * M);
  const bondAdj = new Uint16Array(2 * M);
  const position = new Uint32Array(N); // temp counter for current position

  for (let bondIdx = 0; bondIdx < M; bondIdx++) {
    const bond = bonds[bondIdx];
    if (!bond) continue;

    const a = atomIndexMap.get(bond.atom1);
    const b = atomIndexMap.get(bond.atom2);

    if (a !== undefined && b !== undefined) {
      // Add A → B
      const aOffset = degreeOffset[a] as number;
      const aPos = aOffset + (position[a] as number);
      bondTargets[aPos] = b;
      bondAdj[aPos] = bondIdx;
      const aPosVal = position[a] as number;
      position[a] = aPosVal + 1;

      // Add B → A
      const bOffset = degreeOffset[b] as number;
      const bPos = bOffset + (position[b] as number);
      bondTargets[bPos] = a;
      bondAdj[bPos] = bondIdx;
      const bPosVal = position[b] as number;
      position[b] = bPosVal + 1;
    }
  }

  return { degreeOffset, bondTargets, bondAdj };
}

/**
 * Get neighbors of an atom using CSR structure
 */
export function getNeighborsCSR(
  atomIdx: number,
  csr: CSRGraph,
): number[] {
  const start = csr.degreeOffset[atomIdx] as number;
  const end = csr.degreeOffset[atomIdx + 1] as number;
  return Array.from(csr.bondTargets.slice(start, end));
}

/**
 * Get bond indices for neighbors using CSR structure
 */
export function getBondIndicesCSR(
  atomIdx: number,
  csr: CSRGraph,
): number[] {
  const start = csr.degreeOffset[atomIdx] as number;
  const end = csr.degreeOffset[atomIdx + 1] as number;
  return Array.from(csr.bondAdj.slice(start, end));
}

/**
 * Get degree (number of neighbors) for an atom
 */
export function getDegreeCSR(
  atomIdx: number,
  csr: CSRGraph,
): number {
  const end = csr.degreeOffset[atomIdx + 1] as number;
  const start = csr.degreeOffset[atomIdx] as number;
  return end - start;
}
