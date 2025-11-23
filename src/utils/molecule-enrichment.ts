import type { Atom, Bond, Molecule, RingInfo as RingInfoType } from "types";
import type { RingInfo } from "src/utils/ring-analysis";
import { analyzeRings } from "./ring-analysis";
import {
  bondKey,
  getBondsForAtom,
  getHeavyNeighborCount,
  hasDoubleBond,
  hasTripleBond,
  hasCarbonylBond,
  hasImineBond,
} from "./bond-utils";
import { MoleculeGraph } from "./molecular-graph";
import { findAllRings } from "./sssr-kekule";

/**
 * Get or compute RingInfo for a molecule, with lazy caching
 */
export function getRingInfo(mol: Molecule, mg?: MoleculeGraph): RingInfo {
  // Return cached value if available
  if (mol._ringInfoCache) {
    return mol._ringInfoCache as unknown as RingInfo;
  }

  const ringInfo = analyzeRings(mol, mg);

  // Cache it on the molecule object (using type assertion since we need to mutate)
  (mol as unknown as { _ringInfoCache: RingInfo })._ringInfoCache = ringInfo;

  return ringInfo;
}

/**
 * Enrich molecule by computing and adding properties to atoms and bonds
 * Returns a new Molecule with enriched atoms/bonds that have computed properties
 */
export function enrichMolecule(mol: Molecule, mg?: MoleculeGraph): Molecule {
  const ringInfo = getRingInfo(mol, mg);

  // For SMARTS [R] primitive, use all cycles (not just SSSR) to match RDKit behavior
  const allCycles = findAllRings(mol.atoms as Atom[], mol.bonds as Bond[]);

  const atomRings = buildAtomRingsMap(allCycles);
  const bondRings = buildBondRingsMap(allCycles, mol.bonds);

  const enrichedAtoms = enrichAtoms(mol, ringInfo, atomRings);
  const enrichedBonds = enrichBonds(mol, ringInfo, bondRings);

  // Build RingInfo in the format expected by Molecule interface
  const rings: ReadonlyArray<readonly number[]> = allCycles;
  const enrichedRingInfo: RingInfoType = {
    atomRings,
    bondRings,
    rings,
  } as unknown as RingInfoType;

  return {
    ...mol,
    atoms: enrichedAtoms,
    bonds: enrichedBonds,
    rings,
    ringInfo: enrichedRingInfo,
  } as Molecule;
}

function buildAtomRingsMap(rings: number[][]): Map<number, Set<number>> {
  const atomRings = new Map<number, Set<number>>();

  rings.forEach((ring, ringIdx) => {
    ring.forEach((atomId) => {
      if (!atomRings.has(atomId)) {
        atomRings.set(atomId, new Set());
      }
      atomRings.get(atomId)!.add(ringIdx);
    });
  });

  return atomRings;
}

function buildBondRingsMap(
  rings: number[][],
  bonds: readonly Bond[],
): Map<string, Set<number>> {
  const bondRings = new Map<string, Set<number>>();

  rings.forEach((ring, ringIdx) => {
    bonds.forEach((bond) => {
      if (ring.includes(bond.atom1) && ring.includes(bond.atom2)) {
        const key = bondKey(bond.atom1, bond.atom2);
        if (!bondRings.has(key)) {
          bondRings.set(key, new Set());
        }
        bondRings.get(key)!.add(ringIdx);
      }
    });
  });

  return bondRings;
}

function enrichAtoms(
  mol: Molecule,
  ringInfo: RingInfo,
  atomRings: Map<number, Set<number>>,
): Atom[] {
  return mol.atoms.map((atom) => {
    const degree = getHeavyNeighborCount(mol.bonds, atom.id, mol.atoms);
    const isInRing = ringInfo.isAtomInRing(atom.id);
    const ringIds = isInRing ? [...(atomRings.get(atom.id) || [])] : [];
    const hybridization = determineHybridization(atom, mol.bonds, mol.atoms);

    return {
      ...atom,
      degree,
      isInRing,
      ringIds,
      hybridization,
    };
  });
}

function enrichBonds(
  mol: Molecule,
  ringInfo: RingInfo,
  bondRings: Map<string, Set<number>>,
): Bond[] {
  return mol.bonds.map((bond) => {
    const key = bondKey(bond.atom1, bond.atom2);
    const isInRing = ringInfo.isBondInRing(bond.atom1, bond.atom2);
    const ringIds = isInRing ? [...(bondRings.get(key) || [])] : [];
    const isRotatable = isRotatableBond(bond, mol, ringInfo);

    return {
      ...bond,
      isInRing,
      ringIds,
      isRotatable,
    };
  });
}

function determineHybridization(
  atom: Atom,
  bonds: readonly Bond[],
  atoms: readonly Atom[],
): "sp" | "sp2" | "sp3" | "other" {
  if (atom.aromatic) return "sp2";

  const atomBonds = getBondsForAtom(bonds, atom.id);

  const hasTriple = atomBonds.some((b) => b.type === "triple");
  if (hasTriple) return "sp";

  const hasDouble = atomBonds.some((b) => b.type === "double");
  if (hasDouble) return "sp2";

  const heavyNeighbors = getHeavyNeighborCount(bonds, atom.id, atoms);

  if (heavyNeighbors <= 3) return "sp3";

  return "other";
}

function isRotatableBond(
  bond: Bond,
  mol: Molecule,
  ringInfo: RingInfo,
): boolean {
  if (bond.type !== "single") return false;

  if (ringInfo.isBondInRing(bond.atom1, bond.atom2)) return false;

  const atom1 = mol.atoms.find((a) => a.id === bond.atom1)!;
  const atom2 = mol.atoms.find((a) => a.id === bond.atom2)!;

  if (atom1.symbol === "H" && !atom1.isotope) return false;
  if (atom2.symbol === "H" && !atom2.isotope) return false;

  const heavyNeighbors1 = getHeavyNeighborCount(mol.bonds, atom1.id, mol.atoms);
  const heavyNeighbors2 = getHeavyNeighborCount(mol.bonds, atom2.id, mol.atoms);

  if (heavyNeighbors1 < 2 || heavyNeighbors2 < 2) return false;

  const atom1InRing = ringInfo.isAtomInRing(atom1.id);
  const atom2InRing = ringInfo.isAtomInRing(atom2.id);

  if (
    (atom1InRing && heavyNeighbors2 === 1) ||
    (atom2InRing && heavyNeighbors1 === 1)
  )
    return false;

  if (hasTripleBond(mol.bonds, atom1.id) || hasTripleBond(mol.bonds, atom2.id))
    return false;

  const hasDoubleBond1 = !atom1.aromatic && hasDoubleBond(mol.bonds, atom1.id);
  const hasDoubleBond2 = !atom2.aromatic && hasDoubleBond(mol.bonds, atom2.id);

  if (heavyNeighbors1 >= 4 && !atom1InRing && !hasDoubleBond1) return false;
  if (heavyNeighbors2 >= 4 && !atom2InRing && !hasDoubleBond2) return false;

  const hasCarbonyl1 = hasCarbonylBond(mol.bonds, atom1.id, mol.atoms);
  const hasCarbonyl2 = hasCarbonylBond(mol.bonds, atom2.id, mol.atoms);
  const hasImine1 = hasImineBond(mol.bonds, atom1.id, mol.atoms);
  const hasImine2 = hasImineBond(mol.bonds, atom2.id, mol.atoms);

  const isHeteroatom1 = atom1.symbol !== "C" && atom1.symbol !== "H";
  const isHeteroatom2 = atom2.symbol !== "C" && atom2.symbol !== "H";

  // Check direct conjugation (atom has C=O or C=N and other is heteroatom)
  if (
    (hasCarbonyl1 && isHeteroatom2) ||
    (hasCarbonyl2 && isHeteroatom1) ||
    (hasImine1 && isHeteroatom2) ||
    (hasImine2 && isHeteroatom1)
  )
    return false;

  // Check if heteroatom is bonded to another atom with conjugation
  const neighborHasConjugation = (atomId: number) => {
    const neighborBonds = mol.bonds.filter(
      (b) =>
        b.type === "single" &&
        (b.atom1 === atomId || b.atom2 === atomId) &&
        !(
          (b.atom1 === bond.atom1 && b.atom2 === bond.atom2) ||
          (b.atom1 === bond.atom2 && b.atom2 === bond.atom1)
        ),
    );
    return neighborBonds.some((nb) => {
      const neighborId = nb.atom1 === atomId ? nb.atom2 : nb.atom1;
      return (
        hasCarbonylBond(mol.bonds, neighborId, mol.atoms) ||
        hasImineBond(mol.bonds, neighborId, mol.atoms)
      );
    });
  };

  if (
    (isHeteroatom1 && neighborHasConjugation(atom1.id)) ||
    (isHeteroatom2 && neighborHasConjugation(atom2.id))
  )
    return false;

  return true;
}
