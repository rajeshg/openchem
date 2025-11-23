/**
 * PackedMolecule: High-level wrapper for PackedMol binary representation
 *
 * Provides convenient lazy deserialization and caching of Molecule objects.
 * Enables efficient re-use of binary data across multiple operations without
 * repeated serialization/deserialization overhead.
 *
 * Usage:
 * ```typescript
 * const mol = parseSMILES("CCO").molecules[0];
 * const packed = new PackedMolecule(mol);
 *
 * // Lazy deserialization on first access
 * const structure = packed.molecule;  // O(1) on repeated calls via cache
 *
 * // Query without deserialization
 * console.log(packed.query.atomCount);           // 3
 * console.log(packed.query.bondCount);           // 2
 * console.log(packed.query.formula);             // { 6: 2, 8: 1 }
 * console.log(packed.query.aromaticAtomCount);   // 0
 *
 * // Direct access to binary representation
 * const buffer = packed.buffer;
 * ```
 */

import type { Molecule } from "types";
import type { PackedMol } from "src/types/packedmol-types";
import { HEADER_INDEX } from "src/types/packedmol-types";
import { decodePackedMol } from "src/parsers/packedmol-decoder";
import { encodePackedMol } from "src/generators/packedmol-encoder";
import {
  getPackedAtomCount,
  getPackedBondCount,
  getPackedAtomicNumber,
  getPackedHydrogens,
  getPackedDegree,
  getPackedNeighbors,
  isPackedAtomAromatic,
  isPackedAtomChiral,
  isPackedAtomDummy,
  getPackedBondAtoms,
  getPackedBondDirection,
  countPackedAtomType,
  countPackedAromaticAtoms,
  countPackedChiralAtoms,
  findPackedAtomsByType,
  getPackedMolecularCharge,
  getPackedTotalHydrogens,
  getPackedMolecularFormula,
} from "src/utils/packedmol-query";

/**
 * Query interface for efficient packed data inspection without deserialization
 */
export interface PackedMoleculeQuery {
  /**
   * Get atom count without deserialization
   */
  get atomCount(): number;

  /**
   * Get bond count without deserialization
   */
  get bondCount(): number;

  /**
   * Get total hydrogen count
   */
  get totalHydrogens(): number;

  /**
   * Get molecular charge
   */
  get molecularCharge(): number;

  /**
   * Get count of aromatic atoms
   */
  get aromaticAtomCount(): number;

  /**
   * Get count of chiral atoms
   */
  get chiralAtomCount(): number;

  /**
   * Get molecular formula as element -> count map
   */
  get formula(): Record<number, number>;

  /**
   * Count atoms of specific atomic number
   */
  countAtomType(atomicNumber: number): number;

  /**
   * Find all atoms of specific atomic number
   */
  findAtomsByType(atomicNumber: number): number[];

  /**
   * Get atomic number for atom at index
   */
  getAtomicNumber(atomIndex: number): number;

  /**
   * Get formal charge for atom at index
   */
  getFormalCharge(atomIndex: number): number;

  /**
   * Get hydrogen count for atom at index
   */
  getHydrogens(atomIndex: number): number;

  /**
   * Get degree (bond count) for atom at index
   */
  getDegree(atomIndex: number): number;

  /**
   * Get neighbors of atom - returns [neighborAtomIndex, bondIndex][]
   */
  getNeighbors(atomIndex: number): Array<[number, number]>;

  /**
   * Check if atom is aromatic
   */
  isAromatic(atomIndex: number): boolean;

  /**
   * Check if atom is chiral
   */
  isChiral(atomIndex: number): boolean;

  /**
   * Check if atom is dummy (*)
   */
  isDummy(atomIndex: number): boolean;

  /**
   * Get atoms connected by bond - returns [atomA, atomB]
   */
  getBondAtoms(bondIndex: number): [number, number];

  /**
   * Get bond direction (wedge/hash)
   */
  getBondDirection(bondIndex: number): "up" | "down" | "none";
}

/**
 * Implementation of PackedMoleculeQuery
 */
class PackedMoleculeQueryImpl implements PackedMoleculeQuery {
  constructor(private packed: PackedMol) {}

  get atomCount(): number {
    return getPackedAtomCount(this.packed);
  }

  get bondCount(): number {
    return getPackedBondCount(this.packed);
  }

  get totalHydrogens(): number {
    return getPackedTotalHydrogens(this.packed);
  }

  get molecularCharge(): number {
    return getPackedMolecularCharge(this.packed);
  }

  get aromaticAtomCount(): number {
    return countPackedAromaticAtoms(this.packed);
  }

  get chiralAtomCount(): number {
    return countPackedChiralAtoms(this.packed);
  }

  get formula(): Record<number, number> {
    return getPackedMolecularFormula(this.packed);
  }

  countAtomType(atomicNumber: number): number {
    return countPackedAtomType(this.packed, atomicNumber);
  }

  findAtomsByType(atomicNumber: number): number[] {
    return findPackedAtomsByType(this.packed, atomicNumber);
  }

  getAtomicNumber(atomIndex: number): number {
    return getPackedAtomicNumber(this.packed, atomIndex);
  }

  getFormalCharge(atomIndex: number): number {
    const charge = this.packed.atoms.formalCharge[atomIndex];
    return charge ?? 0;
  }

  getHydrogens(atomIndex: number): number {
    return getPackedHydrogens(this.packed, atomIndex);
  }

  getDegree(atomIndex: number): number {
    return getPackedDegree(this.packed, atomIndex);
  }

  getNeighbors(atomIndex: number): Array<[number, number]> {
    return getPackedNeighbors(this.packed, atomIndex);
  }

  isAromatic(atomIndex: number): boolean {
    return isPackedAtomAromatic(this.packed, atomIndex);
  }

  isChiral(atomIndex: number): boolean {
    return isPackedAtomChiral(this.packed, atomIndex);
  }

  isDummy(atomIndex: number): boolean {
    return isPackedAtomDummy(this.packed, atomIndex);
  }

  getBondAtoms(bondIndex: number): [number, number] {
    return getPackedBondAtoms(this.packed, bondIndex);
  }

  getBondDirection(bondIndex: number): "up" | "down" | "none" {
    return getPackedBondDirection(this.packed, bondIndex);
  }
}

export class PackedMolecule {
  private packedData: PackedMol;
  private moleculeCache: Molecule | null = null;
  private queryImpl: PackedMoleculeQuery | null = null;

  constructor(mol: Molecule);
  constructor(packed: PackedMol);
  constructor(molOrPacked: Molecule | PackedMol) {
    // Detect whether input is Molecule or PackedMol
    if (isPackedMol(molOrPacked)) {
      this.packedData = molOrPacked;
    } else {
      this.packedData = encodePackedMol(molOrPacked);
    }
  }

  /**
   * Get the binary representation (lazy-decoded from cache)
   */
  get molecule(): Molecule {
    if (!this.moleculeCache) {
      this.moleculeCache = decodePackedMol(this.packedData);
    }
    return this.moleculeCache;
  }

  /**
   * Query interface for efficient packed data inspection without deserialization
   */
  get query(): PackedMoleculeQuery {
    if (!this.queryImpl) {
      this.queryImpl = new PackedMoleculeQueryImpl(this.packedData);
    }
    return this.queryImpl;
  }

  /**
   * Get the underlying PackedMol binary representation
   */
  get packed(): PackedMol {
    return this.packedData;
  }

  /**
   * Get the ArrayBuffer containing all binary data
   */
  get buffer(): ArrayBuffer {
    return this.packedData.buffer;
  }

  /**
   * Get atom count
   */
  get atomCount(): number {
    return this.packedData.header[HEADER_INDEX.ATOM_COUNT] as number;
  }

  /**
   * Get bond count
   */
  get bondCount(): number {
    return this.packedData.header[HEADER_INDEX.BOND_COUNT] as number;
  }

  /**
   * Get total buffer size in bytes
   */
  get bufferSize(): number {
    return this.packedData.header[HEADER_INDEX.TOTAL_SIZE] as number;
  }

  /**
   * Clear the molecule cache (rarely needed)
   *
   * Useful if you want to free memory after using the molecule object.
   * Subsequent calls to .molecule will trigger re-deserialization.
   */
  clearCache(): void {
    this.moleculeCache = null;
  }

  /**
   * Create a new PackedMolecule from a Molecule
   */
  static fromMolecule(mol: Molecule): PackedMolecule {
    return new PackedMolecule(mol);
  }

  /**
   * Create a new PackedMolecule from PackedMol binary
   */
  static fromPacked(packed: PackedMol): PackedMolecule {
    return new PackedMolecule(packed);
  }

  /**
   * Transfer PackedMolecule data to another context (Web Worker, WASM, GPU)
   *
   * Returns the underlying ArrayBuffer for zero-copy transfer.
   * Can be re-hydrated using fromPacked().
   */
  transfer(): ArrayBuffer {
    return this.packedData.buffer;
  }
}

/**
 * Type guard: check if value is a PackedMol
 */
function isPackedMol(value: unknown): value is PackedMol {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.buffer instanceof ArrayBuffer &&
    v.header instanceof Uint32Array &&
    typeof v.atoms === "object" &&
    typeof v.bonds === "object" &&
    typeof v.graph === "object" &&
    typeof v.stereo === "object"
  );
}
