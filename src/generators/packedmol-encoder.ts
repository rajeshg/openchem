/**
 * PackedMol Encoder
 *
 * Converts Molecule objects to compact binary PackedMol format.
 * Encodes all structural information deterministically into typed arrays.
 */

import type { Molecule, BondType, StereoType } from "types";
import type { PackedMol, PackedMolEncodingInfo } from "src/types/packedmol-types";
import {
  ATOM_FLAG,
  BOND_FLAG,
  BOND_ORDER,
  STEREO_TYPE,
} from "src/types/packedmol-types";
import { canonicalizeMolecule } from "src/utils/packedmol-canonicalizer";
import { buildCSRGraph } from "src/utils/csr-graph-builder";
import {
  getCachedPackedMol,
  setCachedPackedMol,
} from "src/utils/packedmol-cache";

const PACKEDMOL_VERSION = 1;

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
  const { molecule: canonical, ordering } = canonicalizeMolecule(molecule);

  const N = canonical.atoms.length;
  const M = canonical.bonds.length;

  // Helper function for alignment
  const align = (offset: number, alignment: number): number => {
    return Math.ceil(offset / alignment) * alignment;
  };

  // Calculate section sizes with proper alignment
  const headerSize = 8 * 4; // 8 Uint32 fields

  // Atom block layout:
  // - Uint8Array (atomicNumber): N bytes, starts at headerSize
  // - Int8Array (formalCharge): N bytes, starts at +N
  // - Uint16Array (isotope): N * 2 bytes, needs 2-byte alignment
  // - Uint16Array (atomFlags): N * 2 bytes, needs 2-byte alignment
  const atomBlockStartSize = headerSize; // Where atom block starts
  let atomOffset = atomBlockStartSize;

  const offsetAtomicNumber = atomOffset;
  atomOffset += N; // Uint8Array

  const offsetFormalCharge = atomOffset;
  atomOffset += N; // Int8Array (no alignment needed after Uint8)

  // Uint16Array needs 2-byte alignment
  atomOffset = align(atomOffset, 2);
  const offsetIsotope = atomOffset;
  atomOffset += N * 2; // Uint16Array

  const offsetAtomFlags = atomOffset;
  atomOffset += N * 2; // Uint16Array

  const atomBlockSize = atomOffset - atomBlockStartSize;

  // Bond block needs 4-byte alignment for Uint32Array
  let bondOffset = align(atomOffset, 4);
  const offsetBondBlock = bondOffset;

  const offsetBondAtomA = bondOffset;
  bondOffset += M * 4; // Uint32Array

  const offsetBondAtomB = bondOffset;
  bondOffset += M * 4; // Uint32Array

  const offsetBondOrder = bondOffset;
  bondOffset += M; // Uint8Array

  const offsetBondFlags = bondOffset;
  bondOffset += M; // Uint8Array

  const bondBlockSize = bondOffset - offsetBondBlock;

  // Graph block needs 4-byte alignment for Uint32Array
  let graphOffset = align(bondOffset, 4);
  const offsetGraphBlock = graphOffset;

  const offsetDegreeOffset = graphOffset;
  graphOffset += (N + 1) * 4; // Uint32Array

  const offsetBondTargets = graphOffset;
  graphOffset += 2 * M * 4; // Uint32Array

  // Uint16Array needs 2-byte alignment
  graphOffset = align(graphOffset, 2);
  const offsetBondAdj = graphOffset;
  graphOffset += 2 * M * 2; // Uint16Array

  const graphBlockSize = graphOffset - offsetGraphBlock;

  // Stereo block (all Uint8 and Int8, no alignment needed)
  const offsetStereoBlock = graphOffset;
  const offsetStereoAtomType = offsetStereoBlock;
  const offsetStereoAtomParity = offsetStereoBlock + N;
  const offsetStereoBondType = offsetStereoBlock + 2 * N;
  const offsetStereoBondConfig = offsetStereoBlock + 2 * N + M;

  const stereoBlockSize = N + N + M + M;

  const totalSize = offsetStereoBlock + stereoBlockSize;

  // Create single buffer
  const buffer = new ArrayBuffer(totalSize);

  // Create header view and write header
  const header = new Uint32Array(buffer, 0, 8);
  header[0] = PACKEDMOL_VERSION;
  header[1] = N;
  header[2] = M;
  header[3] = offsetAtomicNumber; // Store actual offset for atom block start
  header[4] = offsetBondBlock;
  header[5] = offsetGraphBlock;
  header[6] = offsetStereoBlock;
  header[7] = totalSize;

  // Create atom block views
  const atomicNumber = new Uint8Array(buffer, offsetAtomicNumber, N);
  const formalCharge = new Int8Array(buffer, offsetFormalCharge, N);
  const isotope = new Uint16Array(buffer, offsetIsotope, N);
  const atomFlags = new Uint16Array(buffer, offsetAtomFlags, N);

  // Write atoms
  for (let i = 0; i < N; i++) {
    const atom = canonical.atoms[i];
    if (!atom) continue;

    atomicNumber[i] = atom.atomicNumber;
    formalCharge[i] = atom.charge;
    isotope[i] = atom.isotope ?? 0;

    // Build flags
    let flags = 0;
    if (atom.aromatic) flags |= ATOM_FLAG.AROMATIC;
    if (atom.chiral !== null && atom.chiral !== "none") flags |= ATOM_FLAG.CHIRAL;
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

    // Build bond flags
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
  const degreeOffset = new Uint32Array(
    buffer,
    offsetDegreeOffset,
    N + 1,
  );
  const bondTargets = new Uint32Array(
    buffer,
    offsetBondTargets,
    2 * M,
  );
  const bondAdj = new Uint16Array(
    buffer,
    offsetBondAdj,
    2 * M,
  );

  // Copy CSR data
  degreeOffset.set(csr.degreeOffset);
  bondTargets.set(csr.bondTargets);
  bondAdj.set(csr.bondAdj);

  // Create stereo block views
  const stereoAtomType = new Uint8Array(buffer, offsetStereoAtomType, N);
  const stereoAtomParity = new Int8Array(buffer, offsetStereoAtomParity, N);
  const stereoBondType = new Uint8Array(buffer, offsetStereoBondType, M);
  const stereoBondConfig = new Int8Array(buffer, offsetStereoBondConfig, M);

  // Write stereo (all zero for now - basic support)
  // TODO: Implement full stereo conversion in Phase 2

  const packed: PackedMol = {
    buffer,
    header: new Uint32Array(buffer, 0, 8),
    atoms: {
      atomicNumber: new Uint8Array(buffer, offsetAtomicNumber, N),
      formalCharge: new Int8Array(buffer, offsetFormalCharge, N),
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
      bondAdj: new Uint16Array(
        buffer,
        offsetBondAdj,
        2 * M,
      ),
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
  const N = header[1] as number;
  const M = header[2] as number;
  const totalSize = header[7] as number;

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
    compressionRatio: NaN, // Would need original size
  };
}
