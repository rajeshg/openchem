import type { Molecule, Atom } from "types";

const debugValidator = !!process.env.OPENCHEM_DEBUG_TAUTOMER;

export interface TautomerValidationResult {
  isValid: boolean;
  reasons: string[];
}

export function isValidTautomer(mol: Molecule): boolean {
  return validateTautomer(mol).isValid;
}

export function validateTautomer(mol: Molecule): TautomerValidationResult {
  const reasons: string[] = [];

  // Check for charged atoms (protonation states, not tautomers)
  const chargedAtoms = mol.atoms.filter((a) => (a.charge ?? 0) !== 0);
  if (chargedAtoms.length > 0) {
    reasons.push(
      `charged atoms: ${chargedAtoms.map((a) => `${a.symbol}(${a.charge})`).join(", ")}`,
    );
  }

  // Check for triple bonds to nitrogen in rings (chemically unreasonable)
  const tripleBondsToN = mol.bonds.filter((b) => {
    if (b.type !== "triple") return false;
    const atom1 = mol.atoms[b.atom1];
    const atom2 = mol.atoms[b.atom2];
    if (!atom1 || !atom2) return false;
    // Triple bond where at least one atom is nitrogen
    return atom1.symbol === "N" || atom2.symbol === "N";
  });
  if (tripleBondsToN.length > 0) {
    reasons.push(`triple bonds to nitrogen: ${tripleBondsToN.length}`);
  }

  // Check for allenes (=C=) - consecutive double bonds on same carbon
  const alleneAtoms = findAlleneAtoms(mol);
  if (alleneAtoms.length > 0) {
    reasons.push(`allene carbons: ${alleneAtoms.length}`);
  }

  // Check for invalid valences (overly bonded atoms)
  const invalidValenceAtoms = findInvalidValenceAtoms(mol);
  if (invalidValenceAtoms.length > 0) {
    reasons.push(
      `invalid valences: ${invalidValenceAtoms.map((a) => `${a.symbol}@${a.id}`).join(", ")}`,
    );
  }

  const isValid = reasons.length === 0;

  if (debugValidator && !isValid) {
    console.debug(`[tautomer-validator] Invalid tautomer: ${reasons.join("; ")}`);
  }

  return { isValid, reasons };
}

function getBondOrder(type: string): number {
  switch (type) {
    case "single":
      return 1;
    case "double":
      return 2;
    case "triple":
      return 3;
    case "quadruple":
      return 4;
    case "aromatic":
      return 1.5;
    default:
      return 1;
  }
}

function findAlleneAtoms(mol: Molecule): Atom[] {
  const allenes: Atom[] = [];

  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (!atom || atom.symbol !== "C") continue;

    // Count double bonds to this carbon
    const doubleBonds = mol.bonds.filter(
      (b) => (b.atom1 === i || b.atom2 === i) && b.type === "double",
    );

    // Allene: carbon with 2+ double bonds
    if (doubleBonds.length >= 2) {
      allenes.push(atom);
    }
  }

  return allenes;
}

function findInvalidValenceAtoms(mol: Molecule): Atom[] {
  const invalid: Atom[] = [];

  // Standard max valences for common atoms
  const maxValences: Record<string, number> = {
    C: 4,
    N: 4, // Can be 4 with positive charge
    O: 3, // Can be 3 in some cases (e.g., oxonium)
    S: 6,
    P: 5,
    F: 1,
    Cl: 1,
    Br: 1,
    I: 1,
  };

  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (!atom) continue;

    const maxValence = maxValences[atom.symbol];
    if (maxValence === undefined) continue; // Unknown atom, skip

    // Calculate current valence (bond order sum)
    let valence = 0;
    for (const bond of mol.bonds) {
      if (bond.atom1 === i || bond.atom2 === i) {
        valence += getBondOrder(bond.type);
      }
    }

    // Add implicit hydrogens
    valence += atom.hydrogens ?? 0;

    if (valence > maxValence) {
      invalid.push(atom);
    }
  }

  return invalid;
}

export function filterValidTautomers<T extends { molecule: Molecule }>(tautomers: T[]): T[] {
  return tautomers.filter((t) => isValidTautomer(t.molecule));
}
