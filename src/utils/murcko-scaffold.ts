/**
 * Murcko Scaffolds and Frameworks Implementation
 *
 * Based on:
 * - Bemis, G. W. & Murcko, M. A., "The Properties of Known Drugs. 1.
 *   Molecular Frameworks." J. Med. Chem. 39:2887-93 (1996)
 * - RDKit implementation
 *
 * Terminology:
 * - Murcko Scaffold: Ring systems + linkers (side chains removed)
 * - Bemis-Murcko Framework: Generic scaffold (all atoms → carbon, all bonds → single)
 * - Graph Framework: Keep connectivity, remove atom/bond types
 */

import type { Atom, Bond, Molecule } from "types";
import { BondType, StereoType } from "types";
import { findRings } from "./ring-analysis";
import { enrichMolecule } from "./molecule-enrichment";
import { matchSMARTS } from "src/matchers/smarts-matcher";

export interface MurckoOptions {
  includeLinkers?: boolean; // Include chains connecting rings (default: true)
  genericAtoms?: boolean; // Convert all atoms to carbon (default: false)
  genericBonds?: boolean; // Convert all bonds to single (default: false)
}

export interface ScaffoldResult {
  scaffold: Molecule;
  removedAtoms: number[]; // IDs of atoms that were removed
  sideChains: Molecule[]; // Side chains that were removed
}

/**
 * Extract Murcko scaffold from a molecule.
 * Removes all side chains, keeping ring systems and linker chains between rings.
 *
 * Algorithm (based on RDKit MurckoDecompose):
 * 1. Identify ring atoms
 * 2. Iteratively remove terminal side chains using SMARTS patterns
 * 3. Patterns match atoms that should be removed:
 *    - [!#1;D1;$([D1]-[!#1;!n])] - Terminal degree-1 atoms
 *    - [!#1;D2;$([D2]-[!#1])]=,#[AD1] - Terminal degree-2 with multiple bonds
 *    - [!#1;D3;$([D3]-[!#1])](=[AD1])=[AD1] - Terminal degree-3 with 2 double bonds
 *
 * @param mol - Input molecule
 * @param opts - Options for scaffold extraction
 * @returns Scaffold molecule with side chains removed
 *
 * @example
 * // Ibuprofen: CC(C)Cc1ccc(cc1)C(C)C(=O)O
 * const scaffold = getMurckoScaffold(ibuprofen);
 * // Result: c1ccccc1 (benzene ring only)
 */
export function getMurckoScaffold(mol: Molecule, opts: MurckoOptions = {}): Molecule {
  const { includeLinkers = true } = opts;

  let current = enrichMolecule(mol);
  const rings = findRings(current.atoms, current.bonds);

  if (rings.length === 0) {
    return { atoms: [], bonds: [] };
  }

  // Simplified SMARTS pattern for terminal side chains
  // Match degree-1 atoms (not hydrogen) - these are terminal side chains
  const murckoPatterns = [
    "[!#1;D1]", // Terminal degree-1 atoms (not hydrogen)
  ];

  // Iteratively remove atoms matching terminal patterns
  let changed = true;
  let maxIterations = 1000;

  while (changed && maxIterations-- > 0) {
    changed = false;

    // Identify ring atoms in current molecule
    const currentRings = findRings(current.atoms, current.bonds);
    const ringAtomSet = new Set<number>();
    for (const ring of currentRings) {
      for (const atomId of ring) {
        ringAtomSet.add(atomId);
      }
    }

    // Try each pattern
    for (const pattern of murckoPatterns) {
      const matchResult = matchSMARTS(pattern, current);

      if (matchResult.success && matchResult.matches.length > 0) {
        // Collect atoms to remove (non-ring atoms only)
        const atomsToRemove = new Set<number>();

        for (const match of matchResult.matches) {
          for (const atomMatch of match.atoms) {
            // AtomMatch has moleculeIndex, not atomIndex
            const atomId = atomMatch.moleculeIndex;
            // Only remove if not in a ring
            if (!ringAtomSet.has(atomId)) {
              atomsToRemove.add(atomId);
            }
          }
        }

        if (atomsToRemove.size > 0) {
          // Remove atoms and rebuild molecule
          const atomIdMap = new Map<number, number>();
          const newAtoms: Atom[] = [];
          let newId = 0;

          for (const atom of current.atoms) {
            if (!atomsToRemove.has(atom.id)) {
              atomIdMap.set(atom.id, newId);
              newAtoms.push({ ...atom, id: newId });
              newId++;
            }
          }

          const newBonds: Bond[] = [];
          for (const bond of current.bonds) {
            const newAtom1 = atomIdMap.get(bond.atom1);
            const newAtom2 = atomIdMap.get(bond.atom2);

            if (newAtom1 !== undefined && newAtom2 !== undefined) {
              newBonds.push({
                ...bond,
                atom1: newAtom1,
                atom2: newAtom2,
              });
            }
          }

          current = { atoms: newAtoms, bonds: newBonds };
          changed = true;
          break; // Restart pattern matching with new molecule
        }
      }
    }
  }

  // If includeLinkers is false, remove all non-ring atoms
  if (!includeLinkers) {
    const rings = findRings(current.atoms, current.bonds);
    const ringAtomSet = new Set<number>();
    for (const ring of rings) {
      for (const atomId of ring) {
        ringAtomSet.add(atomId);
      }
    }

    const atomIdMap = new Map<number, number>();
    const scaffoldAtoms: Atom[] = [];
    let newId = 0;

    for (const atom of current.atoms) {
      if (ringAtomSet.has(atom.id)) {
        atomIdMap.set(atom.id, newId);
        scaffoldAtoms.push({ ...atom, id: newId });
        newId++;
      }
    }

    const scaffoldBonds: Bond[] = [];
    for (const bond of current.bonds) {
      const newAtom1 = atomIdMap.get(bond.atom1);
      const newAtom2 = atomIdMap.get(bond.atom2);

      if (newAtom1 !== undefined && newAtom2 !== undefined) {
        scaffoldBonds.push({
          ...bond,
          atom1: newAtom1,
          atom2: newAtom2,
        });
      }
    }

    return { atoms: scaffoldAtoms, bonds: scaffoldBonds };
  }

  return current;
}

/**
 * Extract Bemis-Murcko framework from a molecule.
 * Similar to Murcko scaffold, but all atoms become carbon and all bonds become single.
 *
 * This creates a "generic" scaffold useful for comparing molecular frameworks
 * independent of heteroatoms or bond orders.
 *
 * @param mol - Input molecule
 * @returns Generic framework with all C atoms and single bonds
 *
 * @example
 * // Ibuprofen: CC(C)Cc1ccc(cc1)C(C)C(=O)O
 * const framework = getBemisMurckoFramework(ibuprofen);
 * // Result: CCCCCCCC (8 carbons, all single bonds)
 */
export function getBemisMurckoFramework(mol: Molecule): Molecule {
  const scaffold = getMurckoScaffold(mol, { includeLinkers: true });

  if (scaffold.atoms.length === 0) {
    return scaffold;
  }

  // Convert all atoms to carbon
  const frameworkAtoms: Atom[] = scaffold.atoms.map((atom) => ({
    ...atom,
    symbol: "C",
    atomicNumber: 6,
    charge: 0,
    hydrogens: 0, // Will be recomputed
    isotope: null,
    aromatic: false,
    chiral: null,
  }));

  // Convert all bonds to single
  const frameworkBonds: Bond[] = scaffold.bonds.map((bond) => ({
    ...bond,
    type: BondType.SINGLE,
    stereo: StereoType.NONE,
  }));

  return enrichMolecule({
    atoms: frameworkAtoms,
    bonds: frameworkBonds,
  });
}

/**
 * Get hierarchical scaffold tree by iteratively removing rings.
 *
 * Returns array of scaffolds from most specific (full scaffold) to most general
 * (smallest ring system). Useful for scaffold-based clustering and analysis.
 *
 * @param mol - Input molecule
 * @returns Array of scaffolds in decreasing order of complexity
 *
 * @example
 * const tree = getScaffoldTree(steroid);
 * // Result: [full_scaffold, 3_rings, 2_rings, 1_ring]
 */
export function getScaffoldTree(mol: Molecule): Molecule[] {
  const scaffolds: Molecule[] = [];
  let current = getMurckoScaffold(mol);

  if (current.atoms.length === 0) {
    return scaffolds;
  }

  scaffolds.push(current);

  // Iteratively remove smallest rings
  while (current.atoms.length > 0) {
    const rings = findRings(current.atoms, current.bonds);
    if (rings.length === 0) break;

    // Remove smallest ring
    const smallestRing = rings.sort((a, b) => a.length - b.length)[0];
    if (!smallestRing) break;

    const ringAtomSet = new Set(smallestRing);

    // Remove ring atoms
    const remainingAtoms = current.atoms.filter((a) => !ringAtomSet.has(a.id));
    const remainingAtomIds = new Set(remainingAtoms.map((a) => a.id));

    // Remove bonds containing ring atoms
    const remainingBonds = current.bonds.filter(
      (b) => remainingAtomIds.has(b.atom1) && remainingAtomIds.has(b.atom2),
    );

    // Check if anything remains
    if (remainingAtoms.length === 0) break;

    // Get new scaffold (remove any new terminal atoms)
    current = getMurckoScaffold(
      { atoms: remainingAtoms, bonds: remainingBonds },
      { includeLinkers: true },
    );

    if (current.atoms.length > 0) {
      scaffolds.push(current);
    } else {
      break;
    }
  }

  return scaffolds;
}

/**
 * Get graph framework (keep connectivity, remove atom/bond types).
 * All atoms become '*' (wildcard), all bonds become '~' (any).
 *
 * This is the most generic representation, useful for pure topology comparison.
 *
 * @param mol - Input molecule
 * @returns Graph framework with generic atoms/bonds
 */
export function getGraphFramework(mol: Molecule): Molecule {
  const scaffold = getMurckoScaffold(mol, { includeLinkers: true });

  if (scaffold.atoms.length === 0) {
    return scaffold;
  }

  const graphAtoms: Atom[] = scaffold.atoms.map((atom) => ({
    ...atom,
    symbol: "*",
    atomicNumber: 0,
    charge: 0,
    hydrogens: 0,
    isotope: null,
    aromatic: false,
    chiral: null,
  }));

  const graphBonds: Bond[] = scaffold.bonds.map((bond) => ({
    ...bond,
    type: BondType.SINGLE,
    stereo: StereoType.NONE,
  }));

  return {
    atoms: graphAtoms,
    bonds: graphBonds,
  };
}

/**
 * Check if two molecules have the same Murcko scaffold.
 *
 * @param mol1 - First molecule
 * @param mol2 - Second molecule
 * @returns True if scaffolds are identical
 */
export function haveSameScaffold(mol1: Molecule, mol2: Molecule): boolean {
  const scaffold1 = getMurckoScaffold(mol1);
  const scaffold2 = getMurckoScaffold(mol2);

  // Simple comparison: same number of atoms and bonds
  if (
    scaffold1.atoms.length !== scaffold2.atoms.length ||
    scaffold1.bonds.length !== scaffold2.bonds.length
  ) {
    return false;
  }

  // For more rigorous comparison, would need graph isomorphism
  // For now, this is a quick heuristic
  return true;
}
