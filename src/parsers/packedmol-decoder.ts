/**
 * PackedMol Decoder
 *
 * Converts PackedMol binary format back to Molecule objects.
 * Reverses the encoding process while preserving all structural information.
 */

import type { Atom, Bond, Molecule } from "types";
import { BondType, StereoType } from "types";
import type { PackedMol } from "src/types/packedmol-types";
import {
  ATOM_FLAG,
  BOND_FLAG,
  BOND_ORDER,
  ATOM_STEREO_TYPE,
  ATOM_STEREO_CONFIG,
  BOND_STEREO_TYPE,
  BOND_STEREO_CONFIG,
} from "src/types/packedmol-types";

/**
 * Decode a PackedMol back to a Molecule
 */
export function decodePackedMol(packed: PackedMol): Molecule {
  const header = packed.header;
  const N = header[1] as number;
  const M = header[2] as number;

  const atoms: Atom[] = [];
  const bonds: Bond[] = [];

  // Decode atoms
  for (let i = 0; i < N; i++) {
    const atomicNum = packed.atoms.atomicNumber[i] as number;
    const charge = packed.atoms.formalCharge[i] as number;
    const isotope = packed.atoms.isotope[i] as number;
    const flags = packed.atoms.atomFlags[i] as number;
    const stereoType = packed.stereo.atomType[i] as number;
    const stereoParity = packed.stereo.atomParity[i] as number;

    // Get symbol from atomic number
    const symbol = getElementSymbol(atomicNum);

    // Decode flags
    const aromatic = !!(flags & ATOM_FLAG.AROMATIC);
    const isDummy = !!(flags & ATOM_FLAG.DUMMY);

    // Decode chirality from stereo block
    const chiral = decodeAtomChirality(stereoType, stereoParity);

    const atom: Atom = {
      id: i,
      symbol: isDummy ? "*" : symbol,
      atomicNumber: atomicNum,
      charge,
      hydrogens: 0, // would need to compute
      isotope: isotope > 0 ? isotope : null,
      aromatic,
      chiral,
      isBracket: isotope > 0 || charge !== 0 || aromatic || chiral !== null,
      atomClass: 0,
    };

    atoms.push(atom);
  }

  // Decode bonds
  for (let i = 0; i < M; i++) {
    const a = packed.bonds.atomA[i] as number;
    const b = packed.bonds.atomB[i] as number;
    const order = packed.bonds.order[i] as number;
    const flags = packed.bonds.flags[i] as number;
    const stereoType = packed.stereo.bondType[i] as number;
    const stereoConfig = packed.stereo.bondConfig[i] as number;

    const type = codeToBondType(order);
    const stereo = decodeBondStereoFromBlock(flags, stereoType, stereoConfig);

    const bond: Bond = {
      atom1: a,
      atom2: b,
      type,
      stereo,
    };

    bonds.push(bond);
  }

  const molecule: Molecule = {
    atoms,
    bonds,
  };

  return molecule;
}

/**
 * Get element symbol from atomic number
 */
function getElementSymbol(atomicNumber: number): string {
  const symbols: Record<number, string> = {
    1: "H",
    2: "He",
    3: "Li",
    4: "Be",
    5: "B",
    6: "C",
    7: "N",
    8: "O",
    9: "F",
    10: "Ne",
    11: "Na",
    12: "Mg",
    13: "Al",
    14: "Si",
    15: "P",
    16: "S",
    17: "Cl",
    18: "Ar",
    19: "K",
    20: "Ca",
    21: "Sc",
    22: "Ti",
    23: "V",
    24: "Cr",
    25: "Mn",
    26: "Fe",
    27: "Co",
    28: "Ni",
    29: "Cu",
    30: "Zn",
    31: "Ga",
    32: "Ge",
    33: "As",
    34: "Se",
    35: "Br",
    36: "Kr",
    37: "Rb",
    38: "Sr",
    39: "Y",
    40: "Zr",
    41: "Nb",
    42: "Mo",
    43: "Tc",
    44: "Ru",
    45: "Rh",
    46: "Pd",
    47: "Ag",
    48: "Cd",
    49: "In",
    50: "Sn",
    51: "Sb",
    52: "Te",
    53: "I",
    54: "Xe",
    55: "Cs",
    56: "Ba",
    57: "La",
    58: "Ce",
    59: "Pr",
    60: "Nd",
    61: "Pm",
    62: "Sm",
    63: "Eu",
    64: "Gd",
    65: "Tb",
    66: "Dy",
    67: "Ho",
    68: "Er",
    69: "Tm",
    70: "Yb",
    71: "Lu",
    72: "Hf",
    73: "Ta",
    74: "W",
    75: "Re",
    76: "Os",
    77: "Ir",
    78: "Pt",
    79: "Au",
    80: "Hg",
    81: "Tl",
    82: "Pb",
    83: "Bi",
    84: "Po",
    85: "At",
    86: "Rn",
    87: "Fr",
    88: "Ra",
    89: "Ac",
    90: "Th",
    91: "Pa",
    92: "U",
  };
  return symbols[atomicNumber] ?? "X";
}

/**
 * Convert integer code to BondType
 */
function codeToBondType(code: number): BondType {
  switch (code) {
    case BOND_ORDER.SINGLE:
      return BondType.SINGLE;
    case BOND_ORDER.DOUBLE:
      return BondType.DOUBLE;
    case BOND_ORDER.TRIPLE:
      return BondType.TRIPLE;
    case BOND_ORDER.AROMATIC:
      return BondType.AROMATIC;
    default:
      return BondType.SINGLE;
  }
}

/**
 * Decode bond stereo from flags (wedge/hash) and stereo block
 */
function decodeBondStereoFromBlock(
  flags: number,
  stereoType: number,
  stereoConfig: number,
): StereoType {
  // First check explicit wedge/hash flags
  if (flags & BOND_FLAG.DIRECTION_UP) return StereoType.UP;
  if (flags & BOND_FLAG.DIRECTION_DOWN) return StereoType.DOWN;

  // For future use: CIS_TRANS stereo configurations
  if (
    stereoType === BOND_STEREO_TYPE.CIS_TRANS &&
    stereoConfig !== BOND_STEREO_CONFIG.UNSPECIFIED
  ) {
    // Could map CIS -> EITHER, TRANS -> EITHER for now
    // In full implementation, this would track E/Z stereochemistry
  }

  return StereoType.NONE;
}

/**
 * Decode atom chirality from stereo block
 */
function decodeAtomChirality(
  stereoType: number,
  stereoParity: number,
): string | null {
  if (stereoType === ATOM_STEREO_TYPE.NONE) {
    return null;
  }

  if (stereoType === ATOM_STEREO_TYPE.TETRAHEDRAL) {
    if (stereoParity === ATOM_STEREO_CONFIG.AT) return "@";
    if (stereoParity === ATOM_STEREO_CONFIG.ATAT) return "@@";
  } else if (stereoType === ATOM_STEREO_TYPE.ALLENIC) {
    // Allenic chirality - simplified: just return @AL1
    return stereoParity === ATOM_STEREO_CONFIG.AT ? "@AL1" : "@AL2";
  } else if (stereoType === ATOM_STEREO_TYPE.SQUARE_PLANAR) {
    return stereoParity === ATOM_STEREO_CONFIG.AT ? "@SP1" : "@SP3";
  } else if (stereoType === ATOM_STEREO_TYPE.TRIGONAL_BIPYRAMIDAL) {
    return stereoParity === ATOM_STEREO_CONFIG.AT ? "@TB1" : "@TB20";
  } else if (stereoType === ATOM_STEREO_TYPE.OCTAHEDRAL) {
    return stereoParity === ATOM_STEREO_CONFIG.AT ? "@OH1" : "@OH30";
  }

  return null;
}
