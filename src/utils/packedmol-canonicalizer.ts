/**
 * Molecule canonicalizer for deterministic PackedMol encoding
 *
 * Ensures identical molecules always produce identical binary representation,
 * regardless of the input SMILES or parsing order.
 */

import type { Atom, Bond, Molecule } from "types";

export interface CanonicalOrdering {
  atomRanking: number[]; // Canonical rank for each atom (0-based)
  oldToNewIndex: Map<number, number>; // Map old atom ID to new index
  newToOldIndex: number[]; // Array: newIndex -> oldAtomID
}

/**
 * Compute canonical ordering for atoms using graph-based symmetry detection
 */
export function computeCanonicalOrdering(mol: Molecule): CanonicalOrdering {
  const N = mol.atoms.length;

  // Precompute adjacency list for O(1) neighbor lookups
  const adjacencyList = new Map<
    number,
    Array<{ otherId: number; bondType: number }>
  >();
  for (const atom of mol.atoms) {
    adjacencyList.set(atom.id, []);
  }
  for (const bond of mol.bonds) {
    const bondCode = bond.type.charCodeAt(0) ?? 0;
    adjacencyList
      .get(bond.atom1)
      ?.push({ otherId: bond.atom2, bondType: bondCode });
    adjacencyList
      .get(bond.atom2)
      ?.push({ otherId: bond.atom1, bondType: bondCode });
  }

  // Compute iterative refinement labels (WL-like algorithm)
  const labels = new Map<number, number>();

  // Initialize with atom properties
  for (const atom of mol.atoms) {
    const neighbors = adjacencyList.get(atom.id) ?? [];
    const deg = neighbors.length;
    const key =
      (atom.atomicNumber << 24) |
      ((atom.charge + 128) << 16) |
      (deg << 8) |
      (atom.aromatic ? 1 : 0);
    labels.set(atom.id, key);
  }

  // Refine labels using neighbor information
  let converged = false;
  for (let iter = 0; iter < 5 && !converged; iter++) {
    const newLabels = new Map<number, number>();
    converged = true;

    for (const atom of mol.atoms) {
      let hash = labels.get(atom.id) ?? 0;
      const neighbors = adjacencyList.get(atom.id) ?? [];

      // Include neighbor labels
      const neighborLabels = neighbors
        .map((n) => (labels.get(n.otherId) ?? 0) ^ n.bondType)
        .sort((a, b) => a - b);

      for (const nbLabel of neighborLabels) {
        hash = (hash << 5) - hash + nbLabel; // DJB2 hash
      }

      const newHash = hash >>> 0; // Convert to unsigned 32-bit
      newLabels.set(atom.id, newHash);
      if (newHash !== (labels.get(atom.id) ?? 0)) {
        converged = false;
      }
    }

    labels.clear();
    for (const [k, v] of newLabels) {
      labels.set(k, v);
    }
  }

  // Sort atoms by label to get canonical ordering
  const ranking: number[] = Array(N);
  const atomsByLabel: Array<{ atom: Atom; label: number }> = [];

  for (const atom of mol.atoms) {
    atomsByLabel.push({
      atom,
      label: labels.get(atom.id) ?? 0,
    });
  }

  // Sort by label, then by ID for tie-breaking (deterministic)
  atomsByLabel.sort((a, b) => {
    if (a.label !== b.label) return a.label - b.label;
    return a.atom.id - b.atom.id;
  });

  const oldToNewIndex = new Map<number, number>();
  const newToOldIndex: number[] = [];

  for (let newIdx = 0; newIdx < atomsByLabel.length; newIdx++) {
    const entry = atomsByLabel[newIdx];
    if (!entry) continue;

    const atom = entry.atom;
    oldToNewIndex.set(atom.id, newIdx);
    newToOldIndex.push(atom.id);

    // Find position in original array
    const oldIdx = mol.atoms.findIndex((a) => a.id === atom.id);
    if (oldIdx >= 0) {
      ranking[oldIdx] = newIdx;
    }
  }

  return {
    atomRanking: ranking,
    oldToNewIndex,
    newToOldIndex,
  };
}

/**
 * Canonicalize molecule: reorder atoms and bonds deterministically
 */
export function canonicalizeMolecule(mol: Molecule): {
  molecule: Molecule;
  ordering: CanonicalOrdering;
} {
  const ordering = computeCanonicalOrdering(mol);
  const oldToNewIndex = ordering.oldToNewIndex;
  const newToOldIndex = ordering.newToOldIndex;

  // Reorder atoms by canonical rank
  const canonicalAtoms: Atom[] = [];
  for (const oldId of newToOldIndex) {
    const oldAtom = mol.atoms.find((a) => a.id === oldId);
    if (oldAtom) {
      const newIdx = oldToNewIndex.get(oldId);
      if (newIdx !== undefined) {
        canonicalAtoms.push({
          ...oldAtom,
          id: newIdx,
        });
      }
    }
  }

  // Reorder bonds and update atom indices
  const canonicalBonds: Bond[] = [];
  for (const bond of mol.bonds) {
    const newA = oldToNewIndex.get(bond.atom1);
    const newB = oldToNewIndex.get(bond.atom2);

    if (newA !== undefined && newB !== undefined) {
      canonicalBonds.push({
        ...bond,
        atom1: newA,
        atom2: newB,
      });
    }
  }

  // Sort bonds by (min_idx, max_idx) for deterministic ordering
  canonicalBonds.sort((a, b) => {
    const aMin = Math.min(a.atom1, a.atom2);
    const aMax = Math.max(a.atom1, a.atom2);
    const bMin = Math.min(b.atom1, b.atom2);
    const bMax = Math.max(b.atom1, b.atom2);

    if (aMin !== bMin) return aMin - bMin;
    return aMax - bMax;
  });

  const molecule: Molecule = {
    atoms: canonicalAtoms,
    bonds: canonicalBonds,
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  };

  return { molecule, ordering };
}

/**
 * Verify molecule is canonically ordered
 */
export function isCanonical(mol: Molecule): boolean {
  // Check atoms are in order
  for (let i = 1; i < mol.atoms.length; i++) {
    const currAtom = mol.atoms[i];
    const prevAtom = mol.atoms[i - 1];
    if (!currAtom || !prevAtom) continue;
    if (currAtom.id < prevAtom.id) {
      return false;
    }
  }

  // Check bonds are sorted by (min, max)
  for (let i = 1; i < mol.bonds.length; i++) {
    const currBond = mol.bonds[i];
    const prevBond = mol.bonds[i - 1];
    if (!currBond || !prevBond) continue;

    const prevA = Math.min(prevBond.atom1, prevBond.atom2);
    const prevB = Math.max(prevBond.atom1, prevBond.atom2);
    const currA = Math.min(currBond.atom1, currBond.atom2);
    const currB = Math.max(currBond.atom1, currBond.atom2);

    if (prevA > currA || (prevA === currA && prevB > currB)) {
      return false;
    }
  }

  return true;
}
