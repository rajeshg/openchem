import type { Atom, Bond, Molecule } from "types";

/**
 * Create a simple Molecule from atoms and bonds
 * The Molecule can optionally be encoded to PackedMol later on-demand
 */
export function createMolecule(atoms: readonly Atom[], bonds: readonly Bond[]): Molecule {
  return {
    atoms,
    bonds,
  };
}
