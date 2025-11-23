/**
 * PackedMol Caching Helper
 *
 * Implements lazy caching of PackedMol representations using WeakMap.
 * This enables O(1) access to binary representations on subsequent operations.
 */

import type { Molecule } from "types";
import type { PackedMol } from "src/types/packedmol-types";

// WeakMap stores cached PackedMol for each Molecule object
// Automatically cleaned up when Molecule is garbage collected
const packedMolCache = new WeakMap<Molecule, PackedMol>();

/**
 * Get cached PackedMol or return null if not cached
 */
export function getCachedPackedMol(molecule: Molecule): PackedMol | null {
  return packedMolCache.get(molecule) ?? null;
}

/**
 * Cache a PackedMol representation for a molecule
 */
export function setCachedPackedMol(
  molecule: Molecule,
  packed: PackedMol,
): void {
  packedMolCache.set(molecule, packed);
}

/**
 * Clear cache for a specific molecule (rarely needed)
 */
export function clearCachedPackedMol(molecule: Molecule): void {
  packedMolCache.delete(molecule);
}
