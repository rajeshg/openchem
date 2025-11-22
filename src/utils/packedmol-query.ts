/**
 * PackedMol Query API
 *
 * Efficient utilities for querying PackedMol binary data without full deserialization.
 * Enables fast lookups of specific atoms/bonds, neighbor discovery, and structural analysis.
 */

import type { PackedMol } from "src/types/packedmol-types";
import { HEADER_INDEX } from "src/types/packedmol-types";

/**
 * Get atom count without deserialization
 */
export function getPackedAtomCount(packed: PackedMol): number {
  return packed.header[HEADER_INDEX.ATOM_COUNT] as number;
}

/**
 * Get bond count without deserialization
 */
export function getPackedBondCount(packed: PackedMol): number {
  return packed.header[HEADER_INDEX.BOND_COUNT] as number;
}

/**
 * Get atomic number of atom at index
 */
export function getPackedAtomicNumber(
  packed: PackedMol,
  atomIndex: number,
): number {
  return packed.atoms.atomicNumber[atomIndex] ?? 0;
}

/**
 * Get formal charge of atom at index
 */
export function getPackedFormalCharge(
  packed: PackedMol,
  atomIndex: number,
): number {
  return packed.atoms.formalCharge[atomIndex] ?? 0;
}

/**
 * Get hydrogen count for atom at index
 */
export function getPackedHydrogens(
  packed: PackedMol,
  atomIndex: number,
): number {
  return packed.atoms.hydrogens[atomIndex] ?? 0;
}

/**
 * Get degree (bond count) for atom at index
 */
export function getPackedDegree(packed: PackedMol, atomIndex: number): number {
  return packed.atoms.degree[atomIndex] ?? 0;
}

/**
 * Get neighbors of atom at index using CSR graph
 * Returns array of [neighborAtomIndex, neighborBondIndex]
 */
export function getPackedNeighbors(
  packed: PackedMol,
  atomIndex: number,
): Array<[number, number]> {
  const N = getPackedAtomCount(packed);
  if (atomIndex < 0 || atomIndex >= N) {
    return [];
  }

  const degreeOffset = packed.graph.degreeOffset;
  const bondTargets = packed.graph.bondTargets;

  const startIdx = degreeOffset[atomIndex] ?? 0;
  const endIdx = degreeOffset[atomIndex + 1] ?? 0;

  const neighbors: Array<[number, number]> = [];
  for (let i = startIdx; i < endIdx; i++) {
    const neighborAtom = bondTargets[i * 2] ?? 0;
    const bondIdx = bondTargets[i * 2 + 1] ?? 0;
    neighbors.push([neighborAtom, bondIdx]);
  }

  return neighbors;
}

/**
 * Check if atom is aromatic
 */
export function isPackedAtomAromatic(
  packed: PackedMol,
  atomIndex: number,
): boolean {
  const AROMATIC_FLAG = 1; // ATOM_FLAG.AROMATIC = 1
  return (packed.atoms.atomFlags[atomIndex] ?? 0) & AROMATIC_FLAG
    ? true
    : false;
}

/**
 * Check if atom is chiral
 */
export function isPackedAtomChiral(
  packed: PackedMol,
  atomIndex: number,
): boolean {
  const CHIRAL_FLAG = 2; // ATOM_FLAG.CHIRAL = 2
  return (packed.atoms.atomFlags[atomIndex] ?? 0) & CHIRAL_FLAG ? true : false;
}

/**
 * Check if atom is dummy (*) atom
 */
export function isPackedAtomDummy(
  packed: PackedMol,
  atomIndex: number,
): boolean {
  const DUMMY_FLAG = 4; // ATOM_FLAG.DUMMY = 4
  return (packed.atoms.atomFlags[atomIndex] ?? 0) & DUMMY_FLAG ? true : false;
}

/**
 * Get bond type code
 */
export function getPackedBondType(
  packed: PackedMol,
  bondIndex: number,
): number {
  return packed.bonds.order[bondIndex] ?? 0;
}

/**
 * Get atoms connected by bond
 */
export function getPackedBondAtoms(
  packed: PackedMol,
  bondIndex: number,
): [number, number] {
  return [
    packed.bonds.atomA[bondIndex] ?? 0,
    packed.bonds.atomB[bondIndex] ?? 0,
  ];
}

/**
 * Check if bond has wedge/hash stereo
 */
export function getPackedBondDirection(
  packed: PackedMol,
  bondIndex: number,
): "up" | "down" | "none" {
  const flags = packed.bonds.flags[bondIndex] ?? 0;
  const UP_FLAG = 1; // BOND_FLAG.DIRECTION_UP = 1
  const DOWN_FLAG = 2; // BOND_FLAG.DIRECTION_DOWN = 2

  if (flags & UP_FLAG) return "up";
  if (flags & DOWN_FLAG) return "down";
  return "none";
}

/**
 * Count atoms with specific atomic number
 */
export function countPackedAtomType(
  packed: PackedMol,
  atomicNumber: number,
): number {
  let count = 0;
  const N = getPackedAtomCount(packed);
  for (let i = 0; i < N; i++) {
    if (getPackedAtomicNumber(packed, i) === atomicNumber) {
      count++;
    }
  }
  return count;
}

/**
 * Count aromatic atoms
 */
export function countPackedAromaticAtoms(packed: PackedMol): number {
  let count = 0;
  const N = getPackedAtomCount(packed);
  for (let i = 0; i < N; i++) {
    if (isPackedAtomAromatic(packed, i)) {
      count++;
    }
  }
  return count;
}

/**
 * Count chiral atoms
 */
export function countPackedChiralAtoms(packed: PackedMol): number {
  let count = 0;
  const N = getPackedAtomCount(packed);
  for (let i = 0; i < N; i++) {
    if (isPackedAtomChiral(packed, i)) {
      count++;
    }
  }
  return count;
}

/**
 * Find all atoms with specific atomic number
 */
export function findPackedAtomsByType(
  packed: PackedMol,
  atomicNumber: number,
): number[] {
  const result: number[] = [];
  const N = getPackedAtomCount(packed);
  for (let i = 0; i < N; i++) {
    if (getPackedAtomicNumber(packed, i) === atomicNumber) {
      result.push(i);
    }
  }
  return result;
}

/**
 * Get total formal charge of molecule
 */
export function getPackedMolecularCharge(packed: PackedMol): number {
  let totalCharge = 0;
  const N = getPackedAtomCount(packed);
  for (let i = 0; i < N; i++) {
    totalCharge += getPackedFormalCharge(packed, i);
  }
  return totalCharge;
}

/**
 * Get total hydrogen count
 */
export function getPackedTotalHydrogens(packed: PackedMol): number {
  let totalH = 0;
  const N = getPackedAtomCount(packed);
  for (let i = 0; i < N; i++) {
    totalH += getPackedHydrogens(packed, i);
  }
  return totalH;
}

/**
 * Get molecular formula (counts of each atom type)
 */
export function getPackedMolecularFormula(
  packed: PackedMol,
): Record<number, number> {
  const formula: Record<number, number> = {};
  const N = getPackedAtomCount(packed);

  for (let i = 0; i < N; i++) {
    const atomicNum = getPackedAtomicNumber(packed, i);
    formula[atomicNum] = (formula[atomicNum] ?? 0) + 1;
  }

  return formula;
}
