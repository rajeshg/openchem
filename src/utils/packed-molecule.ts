/**
 * PackedMolecule: High-level wrapper for PackedMol binary representation
 *
 * Provides convenient lazy deserialization and caching of Molecule objects.
 * Enables efficient re-use of binary data across multiple operations without
 * repeated serialization/deserialization overhead.
 */

import type { Molecule } from "types";
import type { PackedMol } from "src/types/packedmol-types";
import { decodePackedMol } from "src/parsers/packedmol-decoder";
import { encodePackedMol } from "src/generators/packedmol-encoder";

/**
 * High-level wrapper for PackedMol with lazy deserialization
 *
 * Usage:
 * ```typescript
 * const mol = parseSMILES("CCO").molecules[0];
 * const packed = new PackedMolecule(mol);
 *
 * // Lazy deserialization on first access
 * const structure = packed.molecule;  // O(1) on repeated calls via cache
 *
 * // Direct access to binary representation
 * const buffer = packed.buffer;
 * ```
 */
export class PackedMolecule {
  private packedData: PackedMol;
  private moleculeCache: Molecule | null = null;

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
    return this.packedData.header[1] as number;
  }

  /**
   * Get bond count
   */
  get bondCount(): number {
    return this.packedData.header[2] as number;
  }

  /**
   * Get total buffer size in bytes
   */
  get bufferSize(): number {
    return this.packedData.header[7] as number;
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
