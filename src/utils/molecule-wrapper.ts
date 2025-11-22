/**
 * Convert raw Molecule object to PackedMol-backed MoleculeImpl
 *
 * This is used by all parsers to transparently wrap their output in the
 * optimized MoleculeImpl class. Users don't see the difference - they get
 * the same Molecule interface with better performance.
 */

import type { Molecule } from "types";
import type { PackedMol } from "src/types/packedmol-types";
import { MoleculeImpl } from "src/utils/molecule-impl";
import { encodePackedMol } from "src/generators/packedmol-encoder";

/**
 * Wrap a raw Molecule object as PackedMol-backed MoleculeImpl
 *
 * This:
 * 1. Encodes the molecule to compact PackedMol binary
 * 2. Creates a MoleculeImpl wrapping the PackedMol with enriched data
 * 3. The enriched data is kept in memory, preserving all enrichment properties
 * 4. User code doesn't change - they still work with Molecule interface
 *
 * If you want ONLY PackedMol backing (no enriched data in memory), pass skipEnrichment=true
 */
export function wrapMolecule(
  mol: Molecule,
  skipEnrichment = false,
): MoleculeImpl {
  const packed = encodePackedMol(mol);
  // If skipEnrichment is false (default), keep enriched data for fast access
  // If skipEnrichment is true, rely on decoding from PackedMol
  const enrichedData = skipEnrichment ? null : mol;
  return new MoleculeImpl(packed, enrichedData);
}

/**
 * Wrap multiple molecules at once
 */
export function wrapMolecules(mols: Molecule[]): MoleculeImpl[] {
  return mols.map((mol) => wrapMolecule(mol));
}

/**
 * Check if a value is a MoleculeImpl
 */
export function isMoleculeImpl(value: unknown): value is MoleculeImpl {
  return value instanceof MoleculeImpl;
}

/**
 * Extract PackedMol from a Molecule (whether raw or MoleculeImpl)
 */
export function getPackedMolFromMolecule(mol: Molecule): PackedMol {
  if (isMoleculeImpl(mol)) {
    return mol._packedMol;
  }
  return encodePackedMol(mol);
}
