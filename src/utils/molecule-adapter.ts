/**
 * Molecule Adapter: Transparent handling of Molecule and PackedMolecule
 *
 * This module provides utilities to work with both Molecule and PackedMolecule
 * seamlessly. All operations prefer PackedMol when available, falling back to
 * Molecule conversion when needed.
 *
 * Key benefits:
 * - Unified API for both Molecule and PackedMolecule
 * - Automatic PackedMol generation and caching via WeakMap
 * - Zero-copy transfers between threads
 * - Transparent optimization for bulk operations
 */

import type { Molecule } from "types";
import type { PackedMol } from "src/types/packedmol-types";
import { PackedMolecule } from "src/utils/packed-molecule";
import { encodePackedMol } from "src/generators/packedmol-encoder";

/**
 * Union type for functions that accept both Molecule and PackedMolecule
 */
export type MoleculeOrPacked = Molecule | PackedMolecule;

/**
 * Extract Molecule from either Molecule or PackedMolecule
 */
export function getMolecule(mol: MoleculeOrPacked): Molecule {
  return mol instanceof PackedMolecule ? mol.molecule : mol;
}

/**
 * Extract PackedMol from either Molecule or PackedMolecule
 *
 * For Molecule: lazily encodes and caches via WeakMap
 * For PackedMolecule: returns the underlying PackedMol immediately
 */
export function getPackedMol(mol: MoleculeOrPacked): PackedMol {
  if (mol instanceof PackedMolecule) {
    return mol.packed;
  }
  return encodePackedMol(mol);
}

/**
 * Wrap a Molecule as PackedMolecule for efficient operations
 *
 * This triggers encoding and WeakMap caching, enabling O(1) access for
 * subsequent operations on the same Molecule object.
 */
export function asPacked(mol: Molecule): PackedMolecule {
  return new PackedMolecule(mol);
}

/**
 * Check if a value is already a PackedMolecule
 */
export function isPacked(value: unknown): value is PackedMolecule {
  return value instanceof PackedMolecule;
}

/**
 * Get metadata without deserializing PackedMol
 *
 * Useful for filtering/searching without full deserialization overhead.
 */
export function getMetadata(mol: MoleculeOrPacked): {
  atomCount: number;
  bondCount: number;
  bufferSize: number;
} {
  if (mol instanceof PackedMolecule) {
    return {
      atomCount: mol.atomCount,
      bondCount: mol.bondCount,
      bufferSize: mol.bufferSize,
    };
  }
  const packed = encodePackedMol(mol);
  return {
    atomCount: packed.header[1] as number,
    bondCount: packed.header[2] as number,
    bufferSize: packed.header[7] as number,
  };
}

/**
 * Convert array of molecules to PackedMolecule array
 *
 * Useful for batch operations where you want to trigger caching upfront.
 */
export function asManyPacked(molecules: Molecule[]): PackedMolecule[] {
  return molecules.map((mol) => new PackedMolecule(mol));
}

/**
 * Extract Molecule array from mixed input
 */
export function asManyMolecules(molecules: MoleculeOrPacked[]): Molecule[] {
  return molecules.map((mol) => getMolecule(mol));
}
