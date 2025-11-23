import type { Molecule } from "types";
import type { PackedMol } from "src/types/packedmol-types";
import { encodePackedMol } from "src/generators/packedmol-encoder";

/**
 * Ensure a molecule has its PackedMol representation cached.
 *
 * This function caches the binary representation on the molecule object
 * for O(1) access on subsequent operations. Uses a non-enumerable property
 * to avoid affecting serialization.
 *
 * @param mol - Molecule to cache
 * @returns The same molecule with _packedMol populated (or already cached)
 *
 * @internal
 */
export function ensurePackedMolCached(mol: Molecule): Molecule {
  if (mol._packedMol) {
    return mol;
  }

  const packed = encodePackedMol(mol);

  // Store as non-enumerable property to avoid affecting JSON serialization
  Object.defineProperty(mol, "_packedMol", {
    value: packed,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return mol;
}

/**
 * Get the cached PackedMol representation, or compute it if not cached.
 *
 * @param mol - Molecule to get PackedMol for
 * @returns The PackedMol representation (from cache or newly computed)
 *
 * @internal
 */
export function getPackedMol(mol: Molecule): PackedMol {
  if (mol._packedMol) {
    return mol._packedMol as PackedMol;
  }

  const packed = encodePackedMol(mol);

  // Cache it for future access
  try {
    Object.defineProperty(mol, "_packedMol", {
      value: packed,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  } catch (e) {
    // Molecule might be frozen or have property restrictions - just return the packed
    if (process.env.VERBOSE) {
      console.warn("Could not cache PackedMol on molecule:", e);
    }
  }

  return packed;
}

/**
 * Clear the cached PackedMol representation from a molecule.
 *
 * Rarely needed - only use if you want to free memory or force re-computation.
 *
 * @param mol - Molecule to clear cache from
 *
 * @internal
 */
export function clearPackedMolCache(mol: Molecule): void {
  try {
    Object.defineProperty(mol, "_packedMol", {
      value: undefined,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  } catch (e) {
    // Silent failure if molecule is frozen
    if (process.env.VERBOSE) {
      console.warn("Could not clear PackedMol cache:", e);
    }
  }
}
