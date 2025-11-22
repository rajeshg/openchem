// Core types for SMILES parsing

import type { StructuralSubstituent } from "src/iupac-engine/types";
import type { PackedMol } from "src/types/packedmol-types";

export enum BondType {
  SINGLE = "single",
  DOUBLE = "double",
  TRIPLE = "triple",
  QUADRUPLE = "quadruple",
  AROMATIC = "aromatic",
}

export enum StereoType {
  NONE = "none",
  UP = "up", // /
  DOWN = "down", // \
  EITHER = "either",
}

/**
 * Atom in a molecule.
 * After parsing, all atoms are enriched with pre-computed properties.
 * Molecules are immutable post-parse - never mutate atoms directly.
 */
export interface Atom {
  readonly id: number;
  readonly symbol: string;
  readonly atomicNumber: number;
  readonly charge: number;
  readonly hydrogens: number;
  readonly isotope: number | null;
  readonly aromatic: boolean;
  readonly chiral: string | null;
  readonly isBracket: boolean;
  readonly atomClass: number;
  readonly degree?: number;
  readonly isInRing?: boolean;
  readonly ringIds?: readonly number[];
  readonly hybridization?: "sp" | "sp2" | "sp3" | "other";
}

/**
 * Bond between two atoms.
 * After parsing, all bonds are enriched with pre-computed properties.
 * Molecules are immutable post-parse - never mutate bonds directly.
 */
export interface Bond {
  readonly atom1: number;
  readonly atom2: number;
  readonly type: BondType;
  readonly stereo: StereoType;
  readonly isInRing?: boolean;
  readonly ringIds?: readonly number[];
  readonly isRotatable?: boolean;
}

/**
 * Molecule representation.
 * Can have PackedMol backing (efficient binary graph) with optional lazy-computed ring information.
 * Molecules are immutable post-parse - create new molecules instead of mutating.
 *
 * PackedMol fields: buffer, header, atoms, bonds, graph, stereo (optional - only when encoded)
 * RingInfo: computed on-demand and cached for repeated access
 */
export interface Molecule {
  readonly atoms: readonly Atom[];
  readonly bonds: readonly Bond[];
  readonly rings?: readonly (readonly number[])[];
  readonly ringInfo?: Readonly<RingInfo>;
  /** @internal Ring info cache - lazily computed and cached */
  readonly _ringInfoCache?: RingInfo;
  /** PackedMol backing - optional, only populated when encoded */
  readonly buffer?: ArrayBuffer;
  readonly header?: Uint32Array;
  readonly graph?: {
    degreeOffset: Uint32Array;
    bondTargets: Uint32Array;
    bondAdj: Uint16Array;
  };
  readonly stereo?: {
    atomType: Uint8Array;
    atomParity: Int8Array;
    bondType: Uint8Array;
    bondConfig: Int8Array;
  };
  /** @internal Alternate PackedMol structure for full details */
  readonly _packedMol?: PackedMol;
}

export interface RingInfo {
  readonly atomRings: ReadonlyMap<number, ReadonlySet<number>>;
  readonly bondRings: ReadonlyMap<string, ReadonlySet<number>>;
  readonly rings: readonly (readonly number[])[];
}

export interface ParseError {
  message: string;
  position: number; // character position in SMILES string (0-based)
}

export interface ParseResult {
  molecules: Molecule[];
  errors: ParseError[]; // any parsing errors with position info
}

// IUPAC engine types
export interface Chain {
  atoms: Atom[];
  bonds: Bond[];
  length: number;
  multipleBonds: MultipleBond[];
  substituents: StructuralSubstituent[];
  locants: number[];
}

export interface MultipleBond {
  atoms: Atom[];
  bond: Bond;
  type: "double" | "triple";
  locant: number;
}

// Molecular descriptors
export interface DescriptorOptions {
  includeImplicitH?: boolean;
  includeIsotopes?: boolean;
}

export interface DescriptorResult {
  atomCount: number;
  bondCount: number;
  formalCharge: number;
  elementCounts: Record<string, number>;
  heavyAtomFraction: number;
}
