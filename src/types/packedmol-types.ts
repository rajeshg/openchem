/**
 * PackedMol: Compact binary representation of molecular structures
 *
 * A zero-copy, deterministic molecular format optimized for:
 * - High performance cheminformatics
 * - Minimal memory footprint (20-30× smaller than Molecule objects)
 * - Cross-thread transfer (Web Workers, WASM, GPU buffers)
 * - Fast graph traversal (CSR adjacency structure)
 *
 * All data is stored in flat typed arrays that can be transferred without serialization.
 */

/**
 * Header contains metadata and offsets to all data sections
 */
export interface PackedMolHeader {
  version: number;          // Format version (currently 1)
  atomCount: number;        // Number of atoms (N)
  bondCount: number;        // Number of bonds (M)
  offsetAtomBlock: number;  // Byte offset to atom fields
  offsetBondBlock: number;  // Byte offset to bond fields
  offsetGraphBlock: number; // Byte offset to CSR adjacency
  offsetStereoBlock: number; // Byte offset to stereochemistry
}

/**
 * Atom flags bitfield
 */
export const ATOM_FLAG = {
  AROMATIC: 0x0001,        // Bit 0: aromatic atom
  CHIRAL: 0x0002,          // Bit 1: chiral center present
  RADICAL: 0x0004,         // Bit 2: radical center
  DUMMY: 0x0008,           // Bit 3: dummy atom (*)
} as const;

/**
 * Bond flags bitfield
 */
export const BOND_FLAG = {
  DIRECTION_UP: 0x01,       // Bit 0: wedge (/)
  DIRECTION_DOWN: 0x02,     // Bit 1: hash (\)
  STEREOGENIC: 0x04,        // Bit 2: stereogenic double bond
  AROMATIC_OVERRIDE: 0x08,  // Bit 3: aromatic bond override
} as const;

/**
 * Bond order values (matching BondType enum)
 */
export const BOND_ORDER = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  AROMATIC: 4,
} as const;

/**
 * Stereo type values
 */
export const STEREO_TYPE = {
  NONE: 0,
  TETRAHEDRAL: 1,
  CIS_TRANS: 1, // same as tetrahedral (used for double bonds)
} as const;

/**
 * Atom block: fixed-width per-atom typed arrays
 */
export interface PackedAtomBlock {
  atomicNumber: Uint8Array;   // Element (1-118), length N
  formalCharge: Int8Array;    // Integer charge, length N
  isotope: Uint16Array;       // Isotope mass number (0 = natural), length N
  atomFlags: Uint16Array;     // Bitfield (aromatic, chiral, etc), length N
}

/**
 * Bond block: fixed-width per-bond typed arrays
 */
export interface PackedBondBlock {
  atomA: Uint32Array;         // First atom index, length M
  atomB: Uint32Array;         // Second atom index, length M
  order: Uint8Array;          // Bond order (1,2,3,4), length M
  flags: Uint8Array;          // Bitfield (wedge, stereogenic), length M
}

/**
 * Compressed Sparse Row (CSR) adjacency structure
 * Enables O(1) neighbor lookup instead of O(M) scan
 */
export interface PackedGraphBlock {
  degreeOffset: Uint32Array;  // CSR degree offset, length N+1
  bondTargets: Uint32Array;   // CSR bond targets, length 2M
  bondAdj: Uint16Array;       // Bond indices parallel to bondTargets, length 2M
}

/**
 * Stereochemistry block: atom and bond stereo information
 */
export interface PackedStereoBlock {
  atomType: Uint8Array;       // Stereo type (0=none, 1=tetrahedral), length N
  atomParity: Int8Array;      // Atom parity (+1=CW, -1=CCW, 0=unknown), length N
  bondType: Uint8Array;       // Bond stereo type (0=none, 1=cis-trans), length M
  bondConfig: Int8Array;      // Bond config (+1=Z, -1=E, 0=unspecified), length M
}

/**
 * Complete PackedMol representation
 *
 * All data is stored in a single contiguous ArrayBuffer, enabling:
 * - Zero-copy transfer to Web Workers
 * - Direct WASM interop via buffer pointers
 * - GPU buffer upload
 * - Memory-mapped file I/O
 */
export interface PackedMol {
  buffer: ArrayBuffer;        // Single contiguous binary buffer
  header: Uint32Array;        // Header overlay (8 fields, length 8)
  atoms: PackedAtomBlock;     // Atom data overlays
  bonds: PackedBondBlock;     // Bond data overlays
  graph: PackedGraphBlock;    // CSR graph overlays
  stereo: PackedStereoBlock;  // Stereo data overlays
}

/**
 * Metadata about encoding
 */
export interface PackedMolEncodingInfo {
  totalSize: number;           // Total buffer size in bytes
  atomBlockSize: number;       // Size of atom block
  bondBlockSize: number;       // Size of bond block
  graphBlockSize: number;      // Size of graph block
  stereoBlockSize: number;     // Size of stereo block
  compressionRatio: number;    // Original size / packed size
}

/**
 * Canonical ordering information for deterministic encoding
 */
export interface CanonicalOrdering {
  atomRanking: number[];       // Canonical rank for each atom (0-based)
  oldToNewIndex: Map<number, number>;  // Map old atom ID to new index
  newToOldIndex: number[];     // Array: newIndex -> oldAtomID
}
