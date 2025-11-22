/**
 * PackedMol Encoder
 *
 * Converts Molecule objects to compact binary PackedMol format.
 * Encodes all structural information deterministically into typed arrays.
 */

import type { Molecule, BondType } from "types";
import type {
  PackedMol,
  PackedMolEncodingInfo,
} from "src/types/packedmol-types";
import {
  ATOM_FLAG,
  BOND_FLAG,
  BOND_ORDER,
  ATOM_STEREO_TYPE,
  ATOM_STEREO_CONFIG,
  BOND_STEREO_TYPE,
  BOND_STEREO_CONFIG,
  HEADER_INDEX,
} from "src/types/packedmol-types";
import { canonicalizeMolecule } from "src/utils/packedmol-canonicalizer";
import { buildCSRGraph } from "src/utils/csr-graph-builder";
import {
  getCachedPackedMol,
  setCachedPackedMol,
} from "src/utils/packedmol-cache";

const PACKEDMOL_VERSION = 1;

interface MemoryLayout {
  headerSize: number;
  offsetAtomicNumber: number;
  offsetFormalCharge: number;
  offsetHydrogens: number;
  offsetDegree: number;
  offsetIsotope: number;
  offsetAtomFlags: number;
  offsetBondBlock: number;
  offsetBondAtomA: number;
  offsetBondAtomB: number;
  offsetBondOrder: number;
  offsetBondFlags: number;
  offsetGraphBlock: number;
  offsetDegreeOffset: number;
  offsetBondTargets: number;
  offsetBondAdj: number;
  offsetStereoBlock: number;
  offsetStereoAtomType: number;
  offsetStereoAtomParity: number;
  offsetStereoBondType: number;
  offsetStereoBondConfig: number;
  totalSize: number;
}

/**
 * Calculate memory layout for PackedMol encoding
 * Computes aligned offsets for all data blocks (atom, bond, graph, stereo)
 */
function calculateMemoryLayout(N: number, M: number): MemoryLayout {
  const align = (offset: number, alignment: number): number => {
    return Math.ceil(offset / alignment) * alignment;
  };

  const headerSize = 8 * 4;
  let atomOffset = headerSize;

  const offsetAtomicNumber = atomOffset;
  atomOffset += N;

  const offsetFormalCharge = atomOffset;
  atomOffset += N;

  const offsetHydrogens = atomOffset;
  atomOffset += N;

  const offsetDegree = atomOffset;
  atomOffset += N;

  atomOffset = align(atomOffset, 2);
  const offsetIsotope = atomOffset;
  atomOffset += N * 2;

  const offsetAtomFlags = atomOffset;
  atomOffset += N * 2;

  let bondOffset = align(atomOffset, 4);
  const offsetBondBlock = bondOffset;

  const offsetBondAtomA = bondOffset;
  bondOffset += M * 4;

  const offsetBondAtomB = bondOffset;
  bondOffset += M * 4;

  const offsetBondOrder = bondOffset;
  bondOffset += M;

  const offsetBondFlags = bondOffset;
  bondOffset += M;

  let graphOffset = align(bondOffset, 4);
  const offsetGraphBlock = graphOffset;

  const offsetDegreeOffset = graphOffset;
  graphOffset += (N + 1) * 4;

  const offsetBondTargets = graphOffset;
  graphOffset += 2 * M * 4;

  graphOffset = align(graphOffset, 2);
  const offsetBondAdj = graphOffset;
  graphOffset += 2 * M * 2;

  const offsetStereoBlock = graphOffset;
  const offsetStereoAtomType = offsetStereoBlock;
  const offsetStereoAtomParity = offsetStereoBlock + N;
  const offsetStereoBondType = offsetStereoBlock + 2 * N;
  const offsetStereoBondConfig = offsetStereoBlock + 2 * N + M;

  const totalSize = offsetStereoBlock + N + N + M + M;

  return {
    headerSize,
    offsetAtomicNumber,
    offsetFormalCharge,
    offsetHydrogens,
    offsetDegree,
    offsetIsotope,
    offsetAtomFlags,
    offsetBondBlock,
    offsetBondAtomA,
    offsetBondAtomB,
    offsetBondOrder,
    offsetBondFlags,
    offsetGraphBlock,
    offsetDegreeOffset,
    offsetBondTargets,
    offsetBondAdj,
    offsetStereoBlock,
    offsetStereoAtomType,
    offsetStereoAtomParity,
    offsetStereoBondType,
    offsetStereoBondConfig,
    totalSize,
  };
}

/**
 * Encode a molecule into PackedMol binary format
 *
 * Uses WeakMap-based caching for O(1) access on repeated encodes of the same
 * molecule object. Cache is automatically cleaned up when molecule is GC'd.
 */
export function encodePackedMol(molecule: Molecule): PackedMol {
  // Check cache first
  const cached = getCachedPackedMol(molecule);
  if (cached) {
    return cached;
  }

  // Canonicalize first - ensures deterministic encoding
  const { molecule: canonical } = canonicalizeMolecule(molecule);

  const N = canonical.atoms.length;
  const M = canonical.bonds.length;

  // Calculate memory layout with proper alignment
  const layout = calculateMemoryLayout(N, M);

  // Destructure for clarity
  const {
    offsetAtomicNumber,
    offsetFormalCharge,
    offsetHydrogens,
    offsetDegree,
    offsetIsotope,
    offsetAtomFlags,
    offsetBondBlock,
    offsetBondAtomA,
    offsetBondAtomB,
    offsetBondOrder,
    offsetBondFlags,
    offsetGraphBlock,
    offsetDegreeOffset,
    offsetBondTargets,
    offsetBondAdj,
    offsetStereoBlock,
    offsetStereoAtomType,
    offsetStereoAtomParity,
    offsetStereoBondType,
    offsetStereoBondConfig,
    totalSize,
  } = layout;

  // Create single buffer
  const buffer = new ArrayBuffer(totalSize);

  // Create header view and write header
  const header = new Uint32Array(buffer, 0, 8);
  header[HEADER_INDEX.VERSION] = PACKEDMOL_VERSION;
  header[HEADER_INDEX.ATOM_COUNT] = N;
  header[HEADER_INDEX.BOND_COUNT] = M;
  header[HEADER_INDEX.OFFSET_ATOM_BLOCK] = offsetAtomicNumber;
  header[HEADER_INDEX.OFFSET_BOND_BLOCK] = offsetBondBlock;
  header[HEADER_INDEX.OFFSET_GRAPH_BLOCK] = offsetGraphBlock;
  header[HEADER_INDEX.OFFSET_STEREO_BLOCK] = offsetStereoBlock;
  header[HEADER_INDEX.TOTAL_SIZE] = totalSize;

  // Create atom block views
  const atomicNumber = new Uint8Array(buffer, offsetAtomicNumber, N);
  const formalCharge = new Int8Array(buffer, offsetFormalCharge, N);
  const hydrogens = new Uint8Array(buffer, offsetHydrogens, N);
  const degree = new Uint8Array(buffer, offsetDegree, N);
  const isotope = new Uint16Array(buffer, offsetIsotope, N);
  const atomFlags = new Uint16Array(buffer, offsetAtomFlags, N);

  // Write atoms
  for (let i = 0; i < N; i++) {
    const atom = canonical.atoms[i];
    if (!atom) continue;

    atomicNumber[i] = atom.atomicNumber;
    formalCharge[i] = atom.charge;
    hydrogens[i] = atom.hydrogens;
    degree[i] = atom.degree ?? 0;
    isotope[i] = atom.isotope ?? 0;

    let flags = 0;
    if (atom.aromatic) flags |= ATOM_FLAG.AROMATIC;
    if (atom.chiral !== null && atom.chiral !== "none")
      flags |= ATOM_FLAG.CHIRAL;
    if (atom.symbol === "*") flags |= ATOM_FLAG.DUMMY;
    atomFlags[i] = flags;
  }

  // Create bond block views
  const bondAtomA = new Uint32Array(buffer, offsetBondAtomA, M);
  const bondAtomB = new Uint32Array(buffer, offsetBondAtomB, M);
  const bondOrder = new Uint8Array(buffer, offsetBondOrder, M);
  const bondFlags = new Uint8Array(buffer, offsetBondFlags, M);

  // Write bonds
  for (let i = 0; i < M; i++) {
    const bond = canonical.bonds[i];
    if (!bond) continue;

    bondAtomA[i] = bond.atom1;
    bondAtomB[i] = bond.atom2;
    bondOrder[i] = bondTypeToCode(bond.type);

    let flags = 0;
    if (bond.stereo === "up") flags |= BOND_FLAG.DIRECTION_UP;
    if (bond.stereo === "down") flags |= BOND_FLAG.DIRECTION_DOWN;
    bondFlags[i] = flags;
  }

  // Build CSR graph
  const atomIndexMap = new Map<number, number>();
  for (let i = 0; i < N; i++) {
    const atom = canonical.atoms[i];
    if (atom) {
      atomIndexMap.set(atom.id, i);
    }
  }

  const csr = buildCSRGraph(N, canonical.bonds, atomIndexMap);

  // Create graph block views
  const degreeOffset = new Uint32Array(buffer, offsetDegreeOffset, N + 1);
  const bondTargets = new Uint32Array(buffer, offsetBondTargets, 2 * M);
  const bondAdj = new Uint16Array(buffer, offsetBondAdj, 2 * M);

  // Copy CSR data
  degreeOffset.set(csr.degreeOffset);
  bondTargets.set(csr.bondTargets);
  bondAdj.set(csr.bondAdj);

  // Create stereo block views
  const stereoAtomType = new Uint8Array(buffer, offsetStereoAtomType, N);
  const stereoAtomParity = new Int8Array(buffer, offsetStereoAtomParity, N);
  const stereoBondType = new Uint8Array(buffer, offsetStereoBondType, M);
  const stereoBondConfig = new Int8Array(buffer, offsetStereoBondConfig, M);

  // Write atom stereochemistry
  for (let i = 0; i < N; i++) {
    const atom = canonical.atoms[i];
    if (!atom) continue;

    stereoAtomType[i] = encodeAtomStereoType(atom.chiral);

    if (atom.chiral === "@") {
      stereoAtomParity[i] = ATOM_STEREO_CONFIG.AT;
    } else if (atom.chiral === "@@") {
      stereoAtomParity[i] = ATOM_STEREO_CONFIG.ATAT;
    } else {
      stereoAtomParity[i] = ATOM_STEREO_CONFIG.UNKNOWN;
    }
  }

  // Write bond stereochemistry
  for (let i = 0; i < M; i++) {
    const bond = canonical.bonds[i];
    if (!bond) continue;

    if (bond.type === "double" && bond.stereo && bond.stereo !== "none") {
      stereoBondType[i] = BOND_STEREO_TYPE.CIS_TRANS;

      if (bond.stereo === "up") {
        stereoBondConfig[i] = BOND_STEREO_CONFIG.TRANS;
      } else if (bond.stereo === "down") {
        stereoBondConfig[i] = BOND_STEREO_CONFIG.CIS;
      } else {
        stereoBondConfig[i] = BOND_STEREO_CONFIG.UNSPECIFIED;
      }
    } else {
      stereoBondType[i] = BOND_STEREO_TYPE.NONE;
      stereoBondConfig[i] = BOND_STEREO_CONFIG.UNSPECIFIED;
    }
  }

  const packed: PackedMol = {
    buffer,
    header: new Uint32Array(buffer, 0, 8),
    atoms: {
      atomicNumber: new Uint8Array(buffer, offsetAtomicNumber, N),
      formalCharge: new Int8Array(buffer, offsetFormalCharge, N),
      hydrogens: new Uint8Array(buffer, offsetHydrogens, N),
      degree: new Uint8Array(buffer, offsetDegree, N),
      isotope: new Uint16Array(buffer, offsetIsotope, N),
      atomFlags: new Uint16Array(buffer, offsetAtomFlags, N),
    },
    bonds: {
      atomA: new Uint32Array(buffer, offsetBondAtomA, M),
      atomB: new Uint32Array(buffer, offsetBondAtomB, M),
      order: new Uint8Array(buffer, offsetBondOrder, M),
      flags: new Uint8Array(buffer, offsetBondFlags, M),
    },
    graph: {
      degreeOffset: new Uint32Array(buffer, offsetDegreeOffset, N + 1),
      bondTargets: new Uint32Array(buffer, offsetBondTargets, 2 * M),
      bondAdj: new Uint16Array(buffer, offsetBondAdj, 2 * M),
    },
    stereo: {
      atomType: new Uint8Array(buffer, offsetStereoAtomType, N),
      atomParity: new Int8Array(buffer, offsetStereoAtomParity, N),
      bondType: new Uint8Array(buffer, offsetStereoBondType, M),
      bondConfig: new Int8Array(buffer, offsetStereoBondConfig, M),
    },
  };

  // Cache the result for O(1) access on repeated encodes
  setCachedPackedMol(molecule, packed);

  return packed;
}

/**
 * Convert BondType enum to integer code
 */
function bondTypeToCode(type: BondType): number {
  switch (type) {
    case "single":
      return BOND_ORDER.SINGLE;
    case "double":
      return BOND_ORDER.DOUBLE;
    case "triple":
      return BOND_ORDER.TRIPLE;
    case "aromatic":
      return BOND_ORDER.AROMATIC;
    default:
      return BOND_ORDER.SINGLE;
  }
}

/**
 * Get encoding information for a PackedMol
 */
export function getEncodingInfo(packed: PackedMol): PackedMolEncodingInfo {
  const header = packed.header;
  const N = header[HEADER_INDEX.ATOM_COUNT] as number;
  const M = header[HEADER_INDEX.BOND_COUNT] as number;
  const totalSize = header[HEADER_INDEX.TOTAL_SIZE] as number;

  const atomBlockSize = N * 6;
  const bondBlockSize = M * 9;
  const graphBlockSize = (N + 1) * 4 + 2 * M * 6;
  const stereoBlockSize = N * 2 + M * 2;

  return {
    totalSize,
    atomBlockSize,
    bondBlockSize,
    graphBlockSize,
    stereoBlockSize,
    compressionRatio: NaN,
  };
}

/**
 * Encode atom stereochemistry (chiral notation) to stereo type
 */
function encodeAtomStereoType(chiral: string | null): number {
  if (!chiral) return ATOM_STEREO_TYPE.NONE;

  if (chiral === "@" || chiral === "@@") {
    return ATOM_STEREO_TYPE.TETRAHEDRAL;
  } else if (chiral.startsWith("@AL")) {
    return ATOM_STEREO_TYPE.ALLENIC;
  } else if (chiral.startsWith("@SP")) {
    return ATOM_STEREO_TYPE.SQUARE_PLANAR;
  } else if (chiral.startsWith("@TB")) {
    return ATOM_STEREO_TYPE.TRIGONAL_BIPYRAMIDAL;
  } else if (chiral.startsWith("@OH")) {
    return ATOM_STEREO_TYPE.OCTAHEDRAL;
  }

  return ATOM_STEREO_TYPE.NONE;
}
