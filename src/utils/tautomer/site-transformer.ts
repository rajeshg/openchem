import type { Molecule, Atom, Bond, ParseError } from "types";
import { BondType } from "types";
import type { TransformationSite } from "./site-detector";
import { computeImplicitHydrogens } from "src/utils/implicit-hydrogens";
import { enrichMolecule } from "src/utils/molecule-enrichment";
import { validateValences } from "src/validators/valence-validator";
import { kekulize } from "src/utils/kekulize";

const debugTransform = !!process.env.OPENCHEM_DEBUG_TAUTOMER;

function cloneMolecule(m: Molecule): Molecule {
  const atoms = m.atoms.map((a) => ({ ...a }) as Atom);
  const bonds = m.bonds.map((b) => ({ ...b }) as Bond);
  return {
    atoms,
    bonds,
    rings: m.rings,
    ringInfo: m.ringInfo,
  };
}

function clearAromaticity(atoms: Atom[], bonds: Bond[]): { atoms: Atom[]; bonds: Bond[] } {
  // First kekulize to get proper alternating single/double bonds
  const tempMol = { atoms, bonds } as Molecule;
  const kekulized = kekulize(tempMol);

  // Then clear aromatic flags from atoms
  const clearedAtoms = kekulized.atoms.map((a) => ({ ...a, aromatic: false }) as Atom);

  return { atoms: clearedAtoms, bonds: kekulized.bonds as Bond[] };
}

/**
 * Set up proper cyclohexadienone ring structure for phenol → quinone transformation.
 * Starting from the carbonyl carbon, sets up alternating single/double bonds around the ring.
 * Pattern: C(=O)-C=C-C=C-C where the carbonyl C has two single bonds to ring neighbors.
 */
function setupQuinoneRing(
  mol: Molecule,
  atoms: Atom[],
  bonds: Bond[],
  carbonylIdx: number,
  ring: number[],
): void {
  const carbonyl = atoms[carbonylIdx];
  if (!carbonyl) return;

  // Find position of carbonyl in ring
  const carbonylPos = ring.indexOf(carbonyl.id);
  if (carbonylPos === -1) return;

  const ringSize = ring.length;
  if (ringSize !== 6) return; // Only handle 6-membered rings

  if (debugTransform) {
    console.log(`[setupQuinoneRing] Ring: ${ring.join(",")}, carbonylPos: ${carbonylPos}`);
  }

  // Mark all ring atoms as non-aromatic
  for (const atomId of ring) {
    const atomIdx = atoms.findIndex((a) => a.id === atomId);
    if (atomIdx !== -1 && atoms[atomIdx]) {
      atoms[atomIdx] = { ...atoms[atomIdx], aromatic: false } as Atom;
    }
  }

  // Set up alternating bonds around the ring starting from carbonyl
  // For cyclohexadienone: C(=O)-C=C-C=C-C-
  // Carbonyl has SINGLE bonds to both ring neighbors
  // Then alternating: double, single, double, single around the ring
  for (let offset = 0; offset < ringSize; offset++) {
    const pos1 = (carbonylPos + offset) % ringSize;
    const pos2 = (carbonylPos + offset + 1) % ringSize;
    const atomId1 = ring[pos1];
    const atomId2 = ring[pos2];

    if (atomId1 === undefined || atomId2 === undefined) continue;

    const bondIdx = bonds.findIndex(
      (b) =>
        (b.atom1 === atomId1 && b.atom2 === atomId2) ||
        (b.atom1 === atomId2 && b.atom2 === atomId1),
    );

    if (bondIdx === -1 || !bonds[bondIdx]) continue;

    // Carbonyl's bonds (offset 0 and offset 5) should be SINGLE
    // Others alternate: offset 1 = DOUBLE, 2 = SINGLE, 3 = DOUBLE, 4 = SINGLE
    let bondType: BondType;
    if (offset === 0 || offset === ringSize - 1) {
      // Bonds adjacent to carbonyl are single
      bondType = BondType.SINGLE;
    } else if (offset % 2 === 1) {
      // Odd offsets from carbonyl are double (positions 1, 3)
      bondType = BondType.DOUBLE;
    } else {
      // Even offsets (2, 4) are single
      bondType = BondType.SINGLE;
    }

    if (debugTransform) {
      console.log(
        `[setupQuinoneRing] offset ${offset}: bond ${atomId1}-${atomId2} -> ${bondType === BondType.SINGLE ? "SINGLE" : "DOUBLE"}`,
      );
    }

    bonds[bondIdx] = { ...bonds[bondIdx], type: bondType } as Bond;
  }
}

function findBondIndexBetween(mol: Molecule, atomId1: number, atomId2: number): number {
  return mol.bonds.findIndex(
    (b) =>
      (b.atom1 === atomId1 && b.atom2 === atomId2) || (b.atom1 === atomId2 && b.atom2 === atomId1),
  );
}

export interface TransformationResult {
  success: boolean;
  molecule?: Molecule;
  error?: string;
}

function transformKetoEnol(mol: Molecule, site: TransformationSite): TransformationResult {
  const carbonylIdx = site.atoms[0];
  const oxygenIdx = site.atoms[1];
  const alphaIdx = site.atoms[2];

  if (carbonylIdx === undefined || oxygenIdx === undefined || alphaIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const carbonyl = mol.atoms[carbonylIdx];
  const oxygen = mol.atoms[oxygenIdx];
  const alpha = mol.atoms[alphaIdx];

  if (!carbonyl || !oxygen || !alpha) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Check if this is a phenol-quinone transformation (aromatic system)
  const isPhenolQuinone = site.metadata?.isPhenolQuinone === true;
  const is15KetoEnol = site.metadata?.is15KetoEnol === true;

  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  if (is15KetoEnol) {
    // 1,5-keto-enol: C(=O)-C=C-C-H → C(OH)=C-C=C
    const betaIdx = site.atoms[2];
    const gammaIdx = site.atoms[3];
    const deltaIdx = site.atoms[4];

    if (betaIdx === undefined || gammaIdx === undefined || deltaIdx === undefined) {
      return { success: false, error: "Invalid 1,5-keto-enol site atoms" };
    }

    const beta = mol.atoms[betaIdx];
    const gamma = mol.atoms[gammaIdx];
    const delta = mol.atoms[deltaIdx];

    if (!beta || !gamma || !delta) {
      return { success: false, error: "Invalid 1,5-keto-enol atom indices" };
    }

    // Add H to oxygen (C=O → C-OH)
    newAtoms[oxygenIdx] = {
      ...oxygen,
      hydrogens: (oxygen.hydrogens ?? 0) + 1,
    } as Atom;

    // Remove H from delta carbon
    newAtoms[deltaIdx] = {
      ...delta,
      hydrogens: Math.max(0, (delta.hydrogens ?? 0) - 1),
    } as Atom;

    // Change C=O to C-O
    const coBondIdx = findBondIndexBetween(mol, carbonyl.id, oxygen.id);
    if (coBondIdx !== -1) {
      newBonds[coBondIdx] = {
        ...newBonds[coBondIdx],
        type: BondType.SINGLE,
      } as Bond;
    }

    // Change C-beta to C=beta
    const cbBondIdx = findBondIndexBetween(mol, carbonyl.id, beta.id);
    if (cbBondIdx !== -1) {
      newBonds[cbBondIdx] = {
        ...newBonds[cbBondIdx],
        type: BondType.DOUBLE,
      } as Bond;
    }

    // Change beta=gamma to beta-gamma
    const bgBondIdx = findBondIndexBetween(mol, beta.id, gamma.id);
    if (bgBondIdx !== -1) {
      newBonds[bgBondIdx] = {
        ...newBonds[bgBondIdx],
        type: BondType.SINGLE,
      } as Bond;
    }

    // Change gamma-delta to gamma=delta
    const gdBondIdx = findBondIndexBetween(mol, gamma.id, delta.id);
    if (gdBondIdx !== -1) {
      newBonds[gdBondIdx] = {
        ...newBonds[gdBondIdx],
        type: BondType.DOUBLE,
      } as Bond;
    }
  } else if (isPhenolQuinone) {
    // Phenol → Quinone: Ar-OH → Ar=O with proper alternating double bonds
    // This creates cyclohexadienone (O=C1C=CC=CC1) from phenol (Oc1ccccc1)

    // Remove H from oxygen (OH → O)
    newAtoms[oxygenIdx] = {
      ...oxygen,
      hydrogens: Math.max(0, (oxygen.hydrogens ?? 0) - 1),
      isBracket: true,
    } as Atom;

    // Add H to adjacent carbon (alpha carbon gets extra H)
    newAtoms[alphaIdx] = {
      ...alpha,
      hydrogens: (alpha.hydrogens ?? 0) + 1,
      isBracket: true,
    } as Atom;

    // Change C-O to C=O (single → double bond)
    const coBondIdx = findBondIndexBetween(mol, carbonyl.id, oxygen.id);
    if (coBondIdx !== -1) {
      newBonds[coBondIdx] = {
        ...newBonds[coBondIdx],
        type: BondType.DOUBLE,
      } as Bond;
    }

    // Find the 6-membered aromatic ring containing the carbonyl carbon
    const ring = mol.rings?.find((r) => r.length === 6 && r.includes(carbonyl.id));

    if (ring) {
      // Set up proper quinone ring structure with alternating double bonds
      setupQuinoneRing(mol, newAtoms as Atom[], newBonds as Bond[], carbonylIdx, [...ring]);

      // Skip clearAromaticity - we've already set up the correct bond pattern
      const transformed = {
        atoms: newAtoms as readonly Atom[],
        bonds: newBonds as readonly Bond[],
        rings: mol.rings,
        ringInfo: mol.ringInfo,
      } as Molecule;

      const withHydrogens = computeImplicitHydrogens(transformed);
      const final = enrichMolecule(withHydrogens);

      // Validate
      const errors: ParseError[] = [];
      try {
        validateValences(final.atoms, final.bonds, errors);
      } catch (_e) {
        return { success: false, error: "Phenol-quinone valence validation failed" };
      }

      if (errors.length > 0) {
        return { success: false, error: errors[0]?.message ?? "Phenol-quinone validation error" };
      }

      return { success: true, molecule: final };
    }

    // Fallback: if no 6-membered ring found, just mark carbonyl as non-aromatic
    newAtoms[carbonylIdx] = {
      ...carbonyl,
      aromatic: false,
    } as Atom;
  } else {
    // Standard keto-enol: C=O + Ca-H → C-OH + Ca=C

    // Remove H from alpha carbon
    newAtoms[alphaIdx] = {
      ...alpha,
      hydrogens: Math.max(0, (alpha.hydrogens ?? 0) - 1),
    } as Atom;

    // Add H to oxygen
    newAtoms[oxygenIdx] = {
      ...oxygen,
      hydrogens: (oxygen.hydrogens ?? 0) + 1,
    } as Atom;

    // Change C=O to C-O
    const coBondIdx = findBondIndexBetween(mol, carbonyl.id, oxygen.id);
    if (coBondIdx !== -1) {
      newBonds[coBondIdx] = {
        ...newBonds[coBondIdx],
        type: BondType.SINGLE,
      } as Bond;
    }

    // Change C-Ca to C=Ca
    const caBondIdx = findBondIndexBetween(mol, carbonyl.id, alpha.id);
    if (caBondIdx !== -1) {
      newBonds[caBondIdx] = {
        ...newBonds[caBondIdx],
        type: BondType.DOUBLE,
      } as Bond;
    }
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  // Validate
  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformEnolKeto(mol: Molecule, site: TransformationSite): TransformationResult {
  const alphaIdx = site.atoms[0];
  const betaIdx = site.atoms[1];
  const oxygenIdx = site.atoms[2];

  if (alphaIdx === undefined || betaIdx === undefined || oxygenIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const alpha = mol.atoms[alphaIdx];
  const beta = mol.atoms[betaIdx];
  const oxygen = mol.atoms[oxygenIdx];

  if (!alpha || !beta || !oxygen) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: Ca=Cb(OH) → Ca-Cb=O
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Remove H from oxygen
  newAtoms[oxygenIdx] = {
    ...oxygen,
    hydrogens: Math.max(0, (oxygen.hydrogens ?? 0) - 1),
  } as Atom;

  // Add H to alpha carbon
  newAtoms[alphaIdx] = {
    ...alpha,
    hydrogens: (alpha.hydrogens ?? 0) + 1,
  } as Atom;

  // Change Ca=Cb to Ca-Cb
  const ccBondIdx = findBondIndexBetween(mol, alpha.id, beta.id);
  if (ccBondIdx !== -1) {
    newBonds[ccBondIdx] = {
      ...newBonds[ccBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  // Change Cb-O to Cb=O
  const coBondIdx = findBondIndexBetween(mol, beta.id, oxygen.id);
  if (coBondIdx !== -1) {
    newBonds[coBondIdx] = {
      ...newBonds[coBondIdx],
      type: BondType.DOUBLE,
    } as Bond;
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  // Validate
  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformThioneEnethiol(mol: Molecule, site: TransformationSite): TransformationResult {
  // Transform: C-C(=S)-C → C=C(-SH)-C (thione → enethiol)
  // Site atoms: [thiocarbonyl C, S, alpha C]
  const carbonylIdx = site.atoms[0];
  const sulfurIdx = site.atoms[1];
  const alphaIdx = site.atoms[2];

  if (carbonylIdx === undefined || sulfurIdx === undefined || alphaIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const carbonyl = mol.atoms[carbonylIdx];
  const sulfur = mol.atoms[sulfurIdx];
  const alpha = mol.atoms[alphaIdx];

  if (!carbonyl || !sulfur || !alpha) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: Ca-Cb(=S) → Ca=Cb(-SH)
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Add H to sulfur
  newAtoms[sulfurIdx] = {
    ...sulfur,
    hydrogens: (sulfur.hydrogens ?? 0) + 1,
  } as Atom;

  // Remove H from alpha carbon
  newAtoms[alphaIdx] = {
    ...alpha,
    hydrogens: Math.max(0, (alpha.hydrogens ?? 0) - 1),
  } as Atom;

  // Change C=S to C-S
  const csBondIdx = findBondIndexBetween(mol, carbonyl.id, sulfur.id);
  if (csBondIdx !== -1) {
    newBonds[csBondIdx] = {
      ...newBonds[csBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  // Change Ca-Cb to Ca=Cb
  const ccBondIdx = findBondIndexBetween(mol, carbonyl.id, alpha.id);
  if (ccBondIdx !== -1) {
    newBonds[ccBondIdx] = {
      ...newBonds[ccBondIdx],
      type: BondType.DOUBLE,
    } as Bond;
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformEnethiolThione(mol: Molecule, site: TransformationSite): TransformationResult {
  // Transform: C=C(-SH)-C → C-C(=S)-C (enethiol → thione)
  // Site atoms: [alpha C, beta C (has SH), S]
  const alphaIdx = site.atoms[0];
  const betaIdx = site.atoms[1];
  const sulfurIdx = site.atoms[2];

  if (alphaIdx === undefined || betaIdx === undefined || sulfurIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const alpha = mol.atoms[alphaIdx];
  const beta = mol.atoms[betaIdx];
  const sulfur = mol.atoms[sulfurIdx];

  if (!alpha || !beta || !sulfur) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: Ca=Cb(-SH) → Ca-Cb(=S)
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Remove H from sulfur
  newAtoms[sulfurIdx] = {
    ...sulfur,
    hydrogens: Math.max(0, (sulfur.hydrogens ?? 0) - 1),
  } as Atom;

  // Add H to alpha carbon
  newAtoms[alphaIdx] = {
    ...alpha,
    hydrogens: (alpha.hydrogens ?? 0) + 1,
  } as Atom;

  // Change Ca=Cb to Ca-Cb
  const ccBondIdx = findBondIndexBetween(mol, alpha.id, beta.id);
  if (ccBondIdx !== -1) {
    newBonds[ccBondIdx] = {
      ...newBonds[ccBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  // Change Cb-S to Cb=S
  const csBondIdx = findBondIndexBetween(mol, beta.id, sulfur.id);
  if (csBondIdx !== -1) {
    newBonds[csBondIdx] = {
      ...newBonds[csBondIdx],
      type: BondType.DOUBLE,
    } as Bond;
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformLactamLactim(mol: Molecule, site: TransformationSite): TransformationResult {
  const nitrogenIdx = site.atoms[0];
  const carbonIdx = site.atoms[1];
  const oxygenIdx = site.atoms[2];

  if (nitrogenIdx === undefined || carbonIdx === undefined || oxygenIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const nitrogen = mol.atoms[nitrogenIdx];
  const carbon = mol.atoms[carbonIdx];
  const oxygen = mol.atoms[oxygenIdx];

  if (!nitrogen || !carbon || !oxygen) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: N-C=O → N=C-OH
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Remove H from nitrogen
  newAtoms[nitrogenIdx] = {
    ...nitrogen,
    hydrogens: Math.max(0, (nitrogen.hydrogens ?? 0) - 1),
  } as Atom;

  // Add H to oxygen
  newAtoms[oxygenIdx] = {
    ...oxygen,
    hydrogens: (oxygen.hydrogens ?? 0) + 1,
  } as Atom;

  // Change N-C to N=C
  const ncBondIdx = findBondIndexBetween(mol, nitrogen.id, carbon.id);
  if (ncBondIdx !== -1) {
    newBonds[ncBondIdx] = {
      ...newBonds[ncBondIdx],
      type: BondType.DOUBLE,
    } as Bond;
  }

  // Change C=O to C-O
  const coBondIdx = findBondIndexBetween(mol, carbon.id, oxygen.id);
  if (coBondIdx !== -1) {
    newBonds[coBondIdx] = {
      ...newBonds[coBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  // Validate
  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformAminoImine(mol: Molecule, site: TransformationSite): TransformationResult {
  const nitrogenIdx = site.atoms[0];
  const carbonIdx = site.atoms[1];

  if (nitrogenIdx === undefined || carbonIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const nitrogen = mol.atoms[nitrogenIdx];
  const carbon = mol.atoms[carbonIdx];

  if (!nitrogen || !carbon) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: NH2-C-H → NH=C
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Remove H from nitrogen (NH2 → NH)
  newAtoms[nitrogenIdx] = {
    ...nitrogen,
    hydrogens: Math.max(0, (nitrogen.hydrogens ?? 0) - 1),
  } as Atom;

  // Remove H from carbon
  newAtoms[carbonIdx] = {
    ...carbon,
    hydrogens: Math.max(0, (carbon.hydrogens ?? 0) - 1),
  } as Atom;

  // Change N-C to N=C
  const ncBondIdx = findBondIndexBetween(mol, nitrogen.id, carbon.id);
  if (ncBondIdx !== -1) {
    newBonds[ncBondIdx] = {
      ...newBonds[ncBondIdx],
      type: BondType.DOUBLE,
    } as Bond;
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  // Validate
  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformAmidine(mol: Molecule, site: TransformationSite): TransformationResult {
  // Transform: N1(-H)-C=N2 → N1=C-N2(-H) (amidine tautomerism)
  // Site atoms: [N-donor, C, N-acceptor]
  const donorIdx = site.atoms[0];
  const carbonIdx = site.atoms[1];
  const acceptorIdx = site.atoms[2];

  if (donorIdx === undefined || carbonIdx === undefined || acceptorIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const donor = mol.atoms[donorIdx];
  const carbon = mol.atoms[carbonIdx];
  const acceptor = mol.atoms[acceptorIdx];

  if (!donor || !carbon || !acceptor) {
    return { success: false, error: "Invalid atom indices" };
  }

  if ((donor.hydrogens ?? 0) < 1) {
    return { success: false, error: "Donor nitrogen has no H to transfer" };
  }

  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Remove H from donor nitrogen
  newAtoms[donorIdx] = {
    ...donor,
    hydrogens: Math.max(0, (donor.hydrogens ?? 0) - 1),
  } as Atom;

  // Add H to acceptor nitrogen
  newAtoms[acceptorIdx] = {
    ...acceptor,
    hydrogens: (acceptor.hydrogens ?? 0) + 1,
  } as Atom;

  // Find and change the bonds
  const donorCBondIdx = findBondIndexBetween(mol, donor.id, carbon.id);
  const acceptorCBondIdx = findBondIndexBetween(mol, acceptor.id, carbon.id);

  if (donorCBondIdx === -1 || acceptorCBondIdx === -1) {
    return { success: false, error: "Could not find required bonds" };
  }

  const donorCBond = newBonds[donorCBondIdx];
  const acceptorCBond = newBonds[acceptorCBondIdx];

  if (!donorCBond || !acceptorCBond) {
    return { success: false, error: "Bond lookup failed" };
  }

  // Change donor-C bond to double (was single or aromatic)
  newBonds[donorCBondIdx] = {
    ...donorCBond,
    type: BondType.DOUBLE,
  } as Bond;

  // Change acceptor-C bond to single (was double or aromatic)
  newBonds[acceptorCBondIdx] = {
    ...acceptorCBond,
    type: BondType.SINGLE,
  } as Bond;

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformImineEnamine(mol: Molecule, site: TransformationSite): TransformationResult {
  const nitrogenIdx = site.atoms[0];
  const carbonIdx = site.atoms[1];
  const alphaIdx = site.atoms[2];

  if (nitrogenIdx === undefined || carbonIdx === undefined || alphaIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const nitrogen = mol.atoms[nitrogenIdx];
  const carbon = mol.atoms[carbonIdx];
  const alpha = mol.atoms[alphaIdx];

  if (!nitrogen || !carbon || !alpha) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: N=C-Ca-H → NH-C=Ca
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Add H to nitrogen
  newAtoms[nitrogenIdx] = {
    ...nitrogen,
    hydrogens: (nitrogen.hydrogens ?? 0) + 1,
  } as Atom;

  // Remove H from alpha carbon
  newAtoms[alphaIdx] = {
    ...alpha,
    hydrogens: Math.max(0, (alpha.hydrogens ?? 0) - 1),
  } as Atom;

  // Change N=C to N-C
  const ncBondIdx = findBondIndexBetween(mol, nitrogen.id, carbon.id);
  if (ncBondIdx !== -1) {
    newBonds[ncBondIdx] = {
      ...newBonds[ncBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  // Change C-Ca to C=Ca
  const caBondIdx = findBondIndexBetween(mol, carbon.id, alpha.id);
  if (caBondIdx !== -1) {
    newBonds[caBondIdx] = {
      ...newBonds[caBondIdx],
      type: BondType.DOUBLE,
    } as Bond;
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  // Validate
  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformNitrosoOxime(mol: Molecule, site: TransformationSite): TransformationResult {
  const nitrogenIdx = site.atoms[0];
  const oxygenIdx = site.atoms[1];
  const carbonIdx = site.atoms[2];

  if (nitrogenIdx === undefined || oxygenIdx === undefined || carbonIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const nitrogen = mol.atoms[nitrogenIdx];
  const oxygen = mol.atoms[oxygenIdx];
  const carbon = mol.atoms[carbonIdx];

  if (!nitrogen || !oxygen || !carbon) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: C-N=O → C=N-OH
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Remove H from carbon
  newAtoms[carbonIdx] = {
    ...carbon,
    hydrogens: Math.max(0, (carbon.hydrogens ?? 0) - 1),
  } as Atom;

  // Add H to oxygen
  newAtoms[oxygenIdx] = {
    ...oxygen,
    hydrogens: (oxygen.hydrogens ?? 0) + 1,
  } as Atom;

  // Change C-N to C=N
  const cnBondIdx = findBondIndexBetween(mol, carbon.id, nitrogen.id);
  if (cnBondIdx !== -1) {
    newBonds[cnBondIdx] = {
      ...newBonds[cnBondIdx],
      type: BondType.DOUBLE,
    } as Bond;
  }

  // Change N=O to N-O
  const noBondIdx = findBondIndexBetween(mol, nitrogen.id, oxygen.id);
  if (noBondIdx !== -1) {
    newBonds[noBondIdx] = {
      ...newBonds[noBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  // Validate
  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformAromaticHShift(mol: Molecule, site: TransformationSite): TransformationResult {
  const metadata = site.metadata;
  if (!metadata) {
    return { success: false, error: "No metadata for aromatic H-shift" };
  }

  const donorIdx = metadata.donor as number;
  const acceptorIdx = metadata.acceptor as number;

  const donor = mol.atoms[donorIdx];
  const acceptor = mol.atoms[acceptorIdx];

  if (!donor || !acceptor) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: Move H from donor to acceptor
  // [XH]...Y <-> X...[YH] where X,Y are aromatic heteroatoms
  const newAtoms = mol.atoms.map((a) => ({ ...a })) as (Atom & { isBracket?: boolean })[];

  // Remove H from donor - mark as bracket to preserve H count through computeImplicitHydrogens
  newAtoms[donorIdx] = {
    ...donor,
    hydrogens: Math.max(0, (donor.hydrogens ?? 0) - 1),
    isBracket: true,
  } as Atom & { isBracket: boolean };

  // Add H to acceptor - mark as bracket to preserve H count through computeImplicitHydrogens
  newAtoms[acceptorIdx] = {
    ...acceptor,
    hydrogens: (acceptor.hydrogens ?? 0) + 1,
    isBracket: true,
  } as Atom & { isBracket: boolean };

  // For aromatic systems, we typically DON'T want to clear aromaticity
  // because the H-shift maintains the aromatic system

  const transformed = {
    atoms: newAtoms as readonly Atom[],
    bonds: mol.bonds,
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  // Check aromaticity BEFORE modifying
  const aromaticBefore = mol.atoms.filter((a) => a.aromatic).length;

  const withHydrogens = computeImplicitHydrogens(transformed);
  let final = enrichMolecule(withHydrogens);

  // For aromatic H-shifts, we MUST re-perceive aromaticity to validate the transformation
  const { perceiveAromaticity } = require("src/utils/aromaticity-perceiver");
  const { atoms: reperceivedAtoms, bonds: reperceivedBonds } = perceiveAromaticity(
    final.atoms,
    final.bonds,
  );
  final = {
    ...final,
    atoms: reperceivedAtoms,
    bonds: reperceivedBonds,
  } as Molecule;

  // For aromatic H-shifts, verify that aromaticity is maintained
  // Count aromatic atoms after RE-PERCEIVING
  const aromaticAfter = final.atoms.filter((a) => a.aromatic).length;

  if (debugTransform) {
    console.debug(
      `[aromatic-h-shift] Before: ${aromaticBefore} aromatic atoms, After (reperceived): ${aromaticAfter} aromatic atoms`,
    );
  }

  // If we lost all aromaticity, this is likely an invalid transformation
  if (aromaticBefore > 0 && aromaticAfter === 0) {
    if (debugTransform) {
      console.debug(`[aromatic-h-shift] REJECTING: Lost all aromaticity`);
    }
    return { success: false, error: "Aromatic H-shift broke aromaticity" };
  }

  // Validate
  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformFuranone(mol: Molecule, site: TransformationSite): TransformationResult {
  const carbonylCIdx = site.atoms[0];
  const oxygenIdx = site.atoms[1];
  const alphaCIdx = site.atoms[2];

  if (carbonylCIdx === undefined || oxygenIdx === undefined || alphaCIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const carbonylC = mol.atoms[carbonylCIdx];
  const oxygen = mol.atoms[oxygenIdx];
  const alphaC = mol.atoms[alphaCIdx];

  if (!carbonylC || !oxygen || !alphaC) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: O=C-O-C-H → HO-C=O-C (5-membered lactone tautomerism)
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Add H to carbonyl oxygen
  newAtoms[oxygenIdx] = {
    ...oxygen,
    hydrogens: (oxygen.hydrogens ?? 0) + 1,
  } as Atom;

  // Remove H from alpha carbon
  newAtoms[alphaCIdx] = {
    ...alphaC,
    hydrogens: Math.max(0, (alphaC.hydrogens ?? 0) - 1),
  } as Atom;

  // Change C=O to C-O
  const coBondIdx = findBondIndexBetween(mol, carbonylC.id, oxygen.id);
  if (coBondIdx !== -1) {
    newBonds[coBondIdx] = {
      ...newBonds[coBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  // Change C-Ca to C=Ca (assuming ring oxygen is between them)
  const metadata = site.metadata;
  if (metadata?.ringOxygenIdx !== undefined) {
    const ringOxygenIdx = metadata.ringOxygenIdx as number;
    const ringOxygen = mol.atoms[ringOxygenIdx];
    if (ringOxygen) {
      // Change ring O-Ca to O=Ca
      const ocBondIdx = findBondIndexBetween(mol, ringOxygen.id, alphaC.id);
      if (ocBondIdx !== -1) {
        newBonds[ocBondIdx] = {
          ...newBonds[ocBondIdx],
          type: BondType.DOUBLE,
        } as Bond;
      }
    }
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformKetenYnol(mol: Molecule, site: TransformationSite): TransformationResult {
  const carbon1Idx = site.atoms[0];
  const carbon2Idx = site.atoms[1];
  const oxygenIdx = site.atoms[2];

  if (carbon1Idx === undefined || carbon2Idx === undefined || oxygenIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const carbon1 = mol.atoms[carbon1Idx];
  const carbon2 = mol.atoms[carbon2Idx];
  const oxygen = mol.atoms[oxygenIdx];

  if (!carbon1 || !carbon2 || !oxygen) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: C=C=O ⟷ HC≡C-OH (allene/ketene ⟷ alkyne/ynol)
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Add H to terminal carbon
  newAtoms[carbon1Idx] = {
    ...carbon1,
    hydrogens: (carbon1.hydrogens ?? 0) + 1,
  } as Atom;

  // Add H to oxygen
  newAtoms[oxygenIdx] = {
    ...oxygen,
    hydrogens: (oxygen.hydrogens ?? 0) + 1,
  } as Atom;

  // Change C=C to C≡C
  const ccBondIdx = findBondIndexBetween(mol, carbon1.id, carbon2.id);
  if (ccBondIdx !== -1) {
    newBonds[ccBondIdx] = {
      ...newBonds[ccBondIdx],
      type: BondType.TRIPLE,
    } as Bond;
  }

  // Change C=O to C-O
  const coBondIdx = findBondIndexBetween(mol, carbon2.id, oxygen.id);
  if (coBondIdx !== -1) {
    newBonds[coBondIdx] = {
      ...newBonds[coBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformCyanoIsocyanic(mol: Molecule, site: TransformationSite): TransformationResult {
  // Atom order depends on direction (from metadata)
  // Forward (O-C#N → N=C=O): [O, C, N]
  // Reverse (N=C=O → O-C#N): [N, C, O]
  const metadata = site.metadata;

  let carbonIdx: number;
  let nitrogenIdx: number;
  let oxygenIdx: number;

  if (metadata && metadata.direction === "forward") {
    // Forward: [O, C, N]
    oxygenIdx = site.atoms[0]!;
    carbonIdx = site.atoms[1]!;
    nitrogenIdx = site.atoms[2]!;
  } else {
    // Reverse: [N, C, O]
    nitrogenIdx = site.atoms[0]!;
    carbonIdx = site.atoms[1]!;
    oxygenIdx = site.atoms[2]!;
  }

  if (carbonIdx === undefined || nitrogenIdx === undefined || oxygenIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const carbon = mol.atoms[carbonIdx];
  const nitrogen = mol.atoms[nitrogenIdx];
  const oxygen = mol.atoms[oxygenIdx];

  if (!carbon || !nitrogen || !oxygen) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: O=C=NH ⟷ HO-C≡N (isocyanic acid ⟷ cyanic acid)
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Add H to oxygen
  newAtoms[oxygenIdx] = {
    ...oxygen,
    hydrogens: (oxygen.hydrogens ?? 0) + 1,
  } as Atom;

  // Remove H from nitrogen
  newAtoms[nitrogenIdx] = {
    ...nitrogen,
    hydrogens: Math.max(0, (nitrogen.hydrogens ?? 0) - 1),
  } as Atom;

  // Change C=O to C-O
  const coBondIdx = findBondIndexBetween(mol, carbon.id, oxygen.id);
  if (coBondIdx !== -1) {
    newBonds[coBondIdx] = {
      ...newBonds[coBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  // Change C=N to C≡N
  const cnBondIdx = findBondIndexBetween(mol, carbon.id, nitrogen.id);
  if (cnBondIdx !== -1) {
    newBonds[cnBondIdx] = {
      ...newBonds[cnBondIdx],
      type: BondType.TRIPLE,
    } as Bond;
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformOximePhenol(mol: Molecule, site: TransformationSite): TransformationResult {
  const metadata = site.metadata;
  if (!metadata) {
    return { success: false, error: "No metadata for oxime-phenol" };
  }

  const donorIdx = metadata.donor as number;
  const acceptorIdx = metadata.acceptor as number;

  const donor = mol.atoms[donorIdx];
  const acceptor = mol.atoms[acceptorIdx];

  if (!donor || !acceptor) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: Move H from phenolic OH to oxime N via conjugated path
  const newAtoms = mol.atoms.slice();

  // Remove H from donor (phenolic OH)
  newAtoms[donorIdx] = {
    ...donor,
    hydrogens: Math.max(0, (donor.hydrogens ?? 0) - 1),
  } as Atom;

  // Add H to acceptor (oxime N)
  newAtoms[acceptorIdx] = {
    ...acceptor,
    hydrogens: (acceptor.hydrogens ?? 0) + 1,
  } as Atom;

  const transformed = {
    atoms: newAtoms as readonly Atom[],
    bonds: mol.bonds,
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformPhosphonicAcid(mol: Molecule, site: TransformationSite): TransformationResult {
  const phosphorusIdx = site.atoms[0];
  const oxygenIdx = site.atoms[1];

  if (phosphorusIdx === undefined || oxygenIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const phosphorus = mol.atoms[phosphorusIdx];
  const oxygen = mol.atoms[oxygenIdx];

  if (!phosphorus || !oxygen) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: P=O ⟷ P-OH
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Add H to oxygen
  newAtoms[oxygenIdx] = {
    ...oxygen,
    hydrogens: (oxygen.hydrogens ?? 0) + 1,
  } as Atom;

  // Change P=O to P-O
  const poBondIdx = findBondIndexBetween(mol, phosphorus.id, oxygen.id);
  if (poBondIdx !== -1) {
    newBonds[poBondIdx] = {
      ...newBonds[poBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  const transformed = {
    atoms: newAtoms as readonly Atom[],
    bonds: newBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformFormamidineSulfinic(
  mol: Molecule,
  site: TransformationSite,
): TransformationResult {
  const sulfurIdx = site.atoms[0];
  const oxygenIdx = site.atoms[1];

  if (sulfurIdx === undefined || oxygenIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const sulfur = mol.atoms[sulfurIdx];
  const oxygen = mol.atoms[oxygenIdx];

  if (!sulfur || !oxygen) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: S=O ⟷ S-OH (sulfinic acid tautomerism)
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Add H to oxygen
  newAtoms[oxygenIdx] = {
    ...oxygen,
    hydrogens: (oxygen.hydrogens ?? 0) + 1,
  } as Atom;

  // Change S=O to S-O
  const soBondIdx = findBondIndexBetween(mol, sulfur.id, oxygen.id);
  if (soBondIdx !== -1) {
    newBonds[soBondIdx] = {
      ...newBonds[soBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  const transformed = {
    atoms: newAtoms as readonly Atom[],
    bonds: newBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformIsocyanide(mol: Molecule, site: TransformationSite): TransformationResult {
  const carbonIdx = site.atoms[0];
  const nitrogenIdx = site.atoms[1];

  if (carbonIdx === undefined || nitrogenIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const carbon = mol.atoms[carbonIdx];
  const nitrogen = mol.atoms[nitrogenIdx];

  if (!carbon || !nitrogen) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: [C-]#[N+] ⟷ C=[N] (isocyanide ⟷ nitrile with charge)
  // Note: This involves formal charge handling
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Toggle charges: C- to C, N+ to N or vice versa
  const carbonCharge = carbon.charge ?? 0;
  const nitrogenCharge = nitrogen.charge ?? 0;

  if (carbonCharge === -1 && nitrogenCharge === 1) {
    // [C-]#[N+] → C=N
    newAtoms[carbonIdx] = { ...carbon, charge: 0 } as Atom;
    newAtoms[nitrogenIdx] = { ...nitrogen, charge: 0 } as Atom;

    // Change C#N to C=N
    const cnBondIdx = findBondIndexBetween(mol, carbon.id, nitrogen.id);
    if (cnBondIdx !== -1) {
      newBonds[cnBondIdx] = {
        ...newBonds[cnBondIdx],
        type: BondType.DOUBLE,
      } as Bond;
    }
  } else {
    // C=N → [C-]#[N+]
    newAtoms[carbonIdx] = { ...carbon, charge: -1 } as Atom;
    newAtoms[nitrogenIdx] = { ...nitrogen, charge: 1 } as Atom;

    // Change C=N to C#N
    const cnBondIdx = findBondIndexBetween(mol, carbon.id, nitrogen.id);
    if (cnBondIdx !== -1) {
      newBonds[cnBondIdx] = {
        ...newBonds[cnBondIdx],
        type: BondType.TRIPLE,
      } as Bond;
    }
  }

  const transformed = {
    atoms: newAtoms as readonly Atom[],
    bonds: newBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformSpecialImine(mol: Molecule, site: TransformationSite): TransformationResult {
  // Special imine cases (RDKit rules 7, 8, 9)
  // Pattern: [N!H0]-[C]=[C] ↔ [N]=[C]-[C!H0]
  // Site atoms: [nitrogenIdx, carbon1Idx, carbon2Idx]
  const nitrogenIdx = site.atoms[0];
  const carbon1Idx = site.atoms[1];
  const carbon2Idx = site.atoms[2];

  if (nitrogenIdx === undefined || carbon1Idx === undefined || carbon2Idx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const nitrogen = mol.atoms[nitrogenIdx];
  const carbon1 = mol.atoms[carbon1Idx];
  const carbon2 = mol.atoms[carbon2Idx];

  if (!nitrogen || !carbon1 || !carbon2) {
    return { success: false, error: "Invalid atom indices" };
  }

  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Determine transformation direction based on current state
  const ncBondIdx = findBondIndexBetween(mol, nitrogen.id, carbon1.id);
  const ccBondIdx = findBondIndexBetween(mol, carbon1.id, carbon2.id);

  if (ncBondIdx === -1 || ccBondIdx === -1) {
    return { success: false, error: "Required bonds not found" };
  }

  const ncBond = newBonds[ncBondIdx];
  const ccBond = newBonds[ccBondIdx];

  if (!ncBond || !ccBond) {
    return { success: false, error: "Bond objects not found" };
  }

  // Forward: NH2-C=C → =NH-C-CH (N loses H, far C gains H)
  // Reverse: =NH-C-CH → NH2-C=C (N gains H, far C loses H)
  if (ncBond.type === BondType.SINGLE && ccBond.type === BondType.DOUBLE) {
    // Forward transformation: NH2-C=C → =NH-C-CH
    if ((nitrogen.hydrogens ?? 0) === 0) {
      return { success: false, error: "Nitrogen has no H to donate" };
    }

    // Remove H from nitrogen
    newAtoms[nitrogenIdx] = {
      ...nitrogen,
      hydrogens: Math.max(0, (nitrogen.hydrogens ?? 0) - 1),
    } as Atom;

    // Add H to far carbon
    newAtoms[carbon2Idx] = {
      ...carbon2,
      hydrogens: (carbon2.hydrogens ?? 0) + 1,
    } as Atom;

    // N-C single → N=C double
    newBonds[ncBondIdx] = { ...ncBond, type: BondType.DOUBLE } as Bond;

    // C=C double → C-C single
    newBonds[ccBondIdx] = { ...ccBond, type: BondType.SINGLE } as Bond;
  } else if (ncBond.type === BondType.DOUBLE && ccBond.type === BondType.SINGLE) {
    // Reverse transformation: =NH-C-CH → NH2-C=C
    if ((carbon2.hydrogens ?? 0) === 0) {
      return { success: false, error: "Far carbon has no H to donate" };
    }

    // Add H to nitrogen
    newAtoms[nitrogenIdx] = {
      ...nitrogen,
      hydrogens: (nitrogen.hydrogens ?? 0) + 1,
    } as Atom;

    // Remove H from far carbon
    newAtoms[carbon2Idx] = {
      ...carbon2,
      hydrogens: Math.max(0, (carbon2.hydrogens ?? 0) - 1),
    } as Atom;

    // N=C double → N-C single
    newBonds[ncBondIdx] = { ...ncBond, type: BondType.SINGLE } as Bond;

    // C-C single → C=C double
    newBonds[ccBondIdx] = { ...ccBond, type: BondType.DOUBLE } as Bond;
  } else {
    return {
      success: false,
      error: `Unexpected bond types: N-C=${ncBond.type}, C-C=${ccBond.type}`,
    };
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformAmideImidol(mol: Molecule, site: TransformationSite): TransformationResult {
  const carbonIdx = site.atoms[0];
  const oxygenIdx = site.atoms[1];
  const nitrogenIdx = site.atoms[2];

  if (carbonIdx === undefined || oxygenIdx === undefined || nitrogenIdx === undefined) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const carbon = mol.atoms[carbonIdx];
  const oxygen = mol.atoms[oxygenIdx];
  const nitrogen = mol.atoms[nitrogenIdx];

  if (!carbon || !oxygen || !nitrogen) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: R-CO-NH2 ⟷ R-C(OH)=NH (amide ⟷ imidol)
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Remove H from nitrogen
  newAtoms[nitrogenIdx] = {
    ...nitrogen,
    hydrogens: Math.max(0, (nitrogen.hydrogens ?? 0) - 1),
  } as Atom;

  // Add H to oxygen
  newAtoms[oxygenIdx] = {
    ...oxygen,
    hydrogens: (oxygen.hydrogens ?? 0) + 1,
  } as Atom;

  // Change C=O to C-O
  const coBondIdx = findBondIndexBetween(mol, carbon.id, oxygen.id);
  if (coBondIdx !== -1) {
    newBonds[coBondIdx] = {
      ...newBonds[coBondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  // Change C-N to C=N
  const cnBondIdx = findBondIndexBetween(mol, carbon.id, nitrogen.id);
  if (cnBondIdx !== -1) {
    newBonds[cnBondIdx] = {
      ...newBonds[cnBondIdx],
      type: BondType.DOUBLE,
    } as Bond;
  }

  const { atoms: clearedAtoms, bonds: clearedBonds } = clearAromaticity(newAtoms, newBonds);

  const transformed = {
    atoms: clearedAtoms as readonly Atom[],
    bonds: clearedBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

function transformNitroAci(mol: Molecule, site: TransformationSite): TransformationResult {
  const nitrogenIdx = site.atoms[0];
  const oxygen1Idx = site.atoms[1];
  const oxygen2Idx = site.atoms[2];
  const carbonIdx = site.atoms[3];

  if (
    nitrogenIdx === undefined ||
    oxygen1Idx === undefined ||
    oxygen2Idx === undefined ||
    carbonIdx === undefined
  ) {
    return { success: false, error: "Invalid site atoms array" };
  }

  const nitrogen = mol.atoms[nitrogenIdx];
  const oxygen1 = mol.atoms[oxygen1Idx];
  const oxygen2 = mol.atoms[oxygen2Idx];
  const carbon = mol.atoms[carbonIdx];

  if (!nitrogen || !oxygen1 || !oxygen2 || !carbon) {
    return { success: false, error: "Invalid atom indices" };
  }

  // Transform: R-NO2 ⟷ R-N(O)OH (nitro ⟷ aci-nitro)
  const newAtoms = mol.atoms.slice();
  const newBonds = mol.bonds.slice();

  // Remove H from carbon
  newAtoms[carbonIdx] = {
    ...carbon,
    hydrogens: Math.max(0, (carbon.hydrogens ?? 0) - 1),
  } as Atom;

  // Add H to one oxygen
  newAtoms[oxygen1Idx] = {
    ...oxygen1,
    hydrogens: (oxygen1.hydrogens ?? 0) + 1,
  } as Atom;

  // Change C-N to C=N
  const cnBondIdx = findBondIndexBetween(mol, carbon.id, nitrogen.id);
  if (cnBondIdx !== -1) {
    newBonds[cnBondIdx] = {
      ...newBonds[cnBondIdx],
      type: BondType.DOUBLE,
    } as Bond;
  }

  // Change N=O to N-O for the oxygen getting H
  const no1BondIdx = findBondIndexBetween(mol, nitrogen.id, oxygen1.id);
  if (no1BondIdx !== -1) {
    newBonds[no1BondIdx] = {
      ...newBonds[no1BondIdx],
      type: BondType.SINGLE,
    } as Bond;
  }

  const transformed = {
    atoms: newAtoms as readonly Atom[],
    bonds: newBonds as readonly Bond[],
    rings: mol.rings,
    ringInfo: mol.ringInfo,
  } as Molecule;

  const withHydrogens = computeImplicitHydrogens(transformed);
  const final = enrichMolecule(withHydrogens);

  const errors: ParseError[] = [];
  try {
    validateValences(final.atoms, final.bonds, errors);
  } catch (_e) {
    return { success: false, error: "Valence validation failed" };
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0]?.message ?? "Validation error" };
  }

  return { success: true, molecule: final };
}

export function applySiteTransformation(
  mol: Molecule,
  site: TransformationSite,
): TransformationResult {
  const cloned = cloneMolecule(mol);

  let result: TransformationResult;

  switch (site.type) {
    case "keto-enol":
      result = transformKetoEnol(cloned, site);
      break;
    case "enol-keto":
      result = transformEnolKeto(cloned, site);
      break;
    case "thione-enethiol":
      result = transformThioneEnethiol(cloned, site);
      break;
    case "enethiol-thione":
      result = transformEnethiolThione(cloned, site);
      break;
    case "lactam-lactim":
      result = transformLactamLactim(cloned, site);
      break;
    case "amino-imine":
      result = transformAminoImine(cloned, site);
      break;
    case "amidine":
      result = transformAmidine(cloned, site);
      break;
    case "imine-enamine":
      result = transformImineEnamine(cloned, site);
      break;
    case "nitroso-oxime":
      result = transformNitrosoOxime(cloned, site);
      break;
    case "aromatic-h-shift":
      result = transformAromaticHShift(cloned, site);
      break;
    case "furanone":
      result = transformFuranone(cloned, site);
      break;
    case "keten-ynol":
      result = transformKetenYnol(cloned, site);
      break;
    case "cyano-isocyanic":
      result = transformCyanoIsocyanic(cloned, site);
      break;
    case "oxime-phenol":
      result = transformOximePhenol(cloned, site);
      break;
    case "phosphonic-acid":
      result = transformPhosphonicAcid(cloned, site);
      break;
    case "formamidine-sulfinic":
      result = transformFormamidineSulfinic(cloned, site);
      break;
    case "isocyanide":
      result = transformIsocyanide(cloned, site);
      break;
    case "special-imine":
      result = transformSpecialImine(cloned, site);
      break;
    case "amide-imidol":
      result = transformAmideImidol(cloned, site);
      break;
    case "nitro-aci":
      result = transformNitroAci(cloned, site);
      break;
    default:
      return { success: false, error: `Unknown transformation type: ${site.type}` };
  }

  if (debugTransform && result.success) {
    console.debug(
      `[site-transformer] Applied ${site.type} transformation at atoms [${site.atoms.join(",")}]`,
    );
  }

  return result;
}

export function applyMultiSiteTransformation(
  mol: Molecule,
  sites: TransformationSite[],
  mask: number,
): TransformationResult {
  let currentMol = cloneMolecule(mol);
  const appliedSites: number[] = [];

  for (let i = 0; i < sites.length; i++) {
    if (mask & (1 << i)) {
      const site = sites[i];
      if (!site) continue;
      const result = applySiteTransformation(currentMol, site);
      if (!result.success) {
        if (debugTransform) {
          console.debug(
            `[site-transformer] Multi-site transformation failed at site ${i}: ${result.error}`,
          );
        }
        return { success: false, error: result.error };
      }
      currentMol = result.molecule!;
      appliedSites.push(i);
    }
  }

  if (debugTransform && appliedSites.length > 1) {
    console.debug(
      `[site-transformer] Applied multi-site transformation: sites [${appliedSites.join(",")}]`,
    );
  }

  return { success: true, molecule: currentMol };
}
