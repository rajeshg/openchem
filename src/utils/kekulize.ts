import type { Molecule, Bond } from "types";
import { BondType } from "types";

type MutableBond = { -readonly [K in keyof Bond]: Bond[K] };

/**
 * Kekulize aromatic bonds using a global matching algorithm.
 * This properly handles fused ring systems like pyrene and coronene.
 *
 * The algorithm:
 * 1. Find all aromatic atoms and aromatic bonds
 * 2. Each aromatic atom needs exactly one double bond
 * 3. Use backtracking to find a valid assignment of SINGLE/DOUBLE to all aromatic bonds
 */
export function kekulize(molecule: Molecule): Molecule {
  const mutableBonds: MutableBond[] = molecule.bonds.map((b) => ({ ...b }));

  // Find all aromatic bonds
  const aromaticBondIndices: number[] = [];
  for (let i = 0; i < mutableBonds.length; i++) {
    if (mutableBonds[i]!.type === BondType.AROMATIC) {
      aromaticBondIndices.push(i);
    }
  }

  if (aromaticBondIndices.length === 0) {
    return molecule;
  }

  // Find all aromatic atoms
  const aromaticAtomIds = new Set<number>();
  for (const idx of aromaticBondIndices) {
    const bond = mutableBonds[idx]!;
    aromaticAtomIds.add(bond.atom1);
    aromaticAtomIds.add(bond.atom2);
  }

  // Build atom info: check if atom can form a double bond and how many it needs
  const atomInfo = new Map<number, { needsDouble: boolean; currentDoubles: number }>();
  for (const atomId of aromaticAtomIds) {
    const atom = molecule.atoms.find((a) => a.id === atomId);
    if (!atom) continue;

    // Check for existing exocyclic double bonds
    const atomBonds = mutableBonds.filter((b) => b.atom1 === atomId || b.atom2 === atomId);
    const exocyclicDoubleBonds = atomBonds.filter((b) => {
      const otherId = b.atom1 === atomId ? b.atom2 : b.atom1;
      return !aromaticAtomIds.has(otherId) && b.type === BondType.DOUBLE;
    });

    // Count ring bonds (aromatic bonds within the aromatic system)
    const ringBonds = atomBonds.filter((b) => {
      const otherId = b.atom1 === atomId ? b.atom2 : b.atom1;
      return aromaticAtomIds.has(otherId);
    });

    // Count exocyclic single bonds (bonds to atoms outside the aromatic system)
    const exocyclicSingleBonds = atomBonds.filter((b) => {
      const otherId = b.atom1 === atomId ? b.atom2 : b.atom1;
      return !aromaticAtomIds.has(otherId) && b.type === BondType.SINGLE;
    });

    // N-H in ring (pyrrole-like) doesn't need a double bond - contributes 2 π-electrons from lone pair
    const isPyrrolicNH = atom.symbol === "N" && atom.hydrogens > 0;

    // N with 3 bonds (2 ring + 1 exocyclic single bond like N-CH3) is also pyrrole-like
    // It contributes 2 π-electrons from lone pair, doesn't need a double bond
    // Example: N-methyl groups in caffeine, imidazole N-substituents
    const isPyrrolicNSubstituted =
      atom.symbol === "N" &&
      atom.hydrogens === 0 &&
      ringBonds.length === 2 &&
      exocyclicSingleBonds.length >= 1;

    // O and S in aromatic rings contribute 2 π-electrons from lone pair, don't need double bond
    // (furan, thiophene, etc.)
    const isFuranLikeHetero = (atom.symbol === "O" || atom.symbol === "S") && atom.hydrogens === 0;

    // Atom with exocyclic double bond doesn't need another one
    const needsDouble =
      exocyclicDoubleBonds.length === 0 &&
      !isPyrrolicNH &&
      !isPyrrolicNSubstituted &&
      !isFuranLikeHetero;

    atomInfo.set(atomId, { needsDouble, currentDoubles: 0 });
  }

  // Backtracking to assign SINGLE/DOUBLE to all aromatic bonds
  function backtrack(bondIdx: number): boolean {
    if (bondIdx >= aromaticBondIndices.length) {
      // Check if all atoms that need a double bond have exactly one
      for (const [_atomId, info] of atomInfo) {
        if (info.needsDouble && info.currentDoubles !== 1) {
          return false;
        }
      }
      return true;
    }

    const bondIndex = aromaticBondIndices[bondIdx]!;
    const bond = mutableBonds[bondIndex]!;
    const atom1Info = atomInfo.get(bond.atom1);
    const atom2Info = atomInfo.get(bond.atom2);

    if (!atom1Info || !atom2Info) {
      // Shouldn't happen, but handle gracefully
      bond.type = BondType.SINGLE;
      return backtrack(bondIdx + 1);
    }

    // Try assigning DOUBLE first if both atoms can accept it
    const canAssignDouble =
      atom1Info.currentDoubles === 0 &&
      atom2Info.currentDoubles === 0 &&
      atom1Info.needsDouble &&
      atom2Info.needsDouble;

    if (canAssignDouble) {
      bond.type = BondType.DOUBLE;
      atom1Info.currentDoubles = 1;
      atom2Info.currentDoubles = 1;

      if (backtrack(bondIdx + 1)) {
        return true;
      }

      // Backtrack
      atom1Info.currentDoubles = 0;
      atom2Info.currentDoubles = 0;
    }

    // Try SINGLE
    bond.type = BondType.SINGLE;
    if (backtrack(bondIdx + 1)) {
      return true;
    }

    // Reset to AROMATIC if nothing works
    bond.type = BondType.AROMATIC;
    return false;
  }

  const success = backtrack(0);

  if (!success) {
    // Fallback: reset all to aromatic (shouldn't happen for valid aromatic systems)
    for (const idx of aromaticBondIndices) {
      mutableBonds[idx]!.type = BondType.AROMATIC;
    }
  }

  return { ...molecule, bonds: mutableBonds };
}
