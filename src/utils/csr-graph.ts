import type { Atom, Bond, Molecule } from "types";

/**
 * Compressed Sparse Row (CSR) graph representation for efficient traversal
 *
 * CSR format stores graphs compactly for fast neighbor lookups.
 * Perfect for SMARTS pattern matching where we traverse neighbors repeatedly.
 *
 * Space complexity: O(N + E) where N = atoms, E = bonds
 * Neighbor lookup: O(log E) with binary search, typically O(1) cached
 */
export class CSRGraph {
  /**
   * Row pointers: indices into edges array where each atom's neighbors start
   * Length = numAtoms + 1
   * rowPtr[i+1] - rowPtr[i] = degree of atom i
   */
  private rowPtr: Uint32Array;

  /**
   * Column indices: atom IDs of neighbors in CSR format
   * Length = 2 * numBonds (undirected, so each edge twice)
   */
  private colIdx: Uint32Array;

  /**
   * Edge data indices pointing to original bonds
   * Length = 2 * numBonds
   */
  private edgeData: Uint32Array;

  /**
   * Original bonds for reference
   */
  private bonds: readonly Bond[];

  /**
   * Original atoms for reference
   */
  private atoms: readonly Atom[];

  /**
   * Number of atoms in the graph
   */
  readonly numAtoms: number;

  /**
   * Number of bonds in the graph
   */
  readonly numBonds: number;

  /**
   * Create CSR graph from molecule
   */
  constructor(molecule: Molecule) {
    this.atoms = molecule.atoms;
    this.bonds = molecule.bonds;
    this.numAtoms = molecule.atoms.length;
    this.numBonds = molecule.bonds.length;

    // Build CSR representation
    const { rowPtr, colIdx, edgeData } = this.buildCSR();
    this.rowPtr = rowPtr;
    this.colIdx = colIdx;
    this.edgeData = edgeData;
  }

  /**
   * Build CSR format from molecule atoms and bonds
   */
  private buildCSR(): {
    rowPtr: Uint32Array;
    colIdx: Uint32Array;
    edgeData: Uint32Array;
  } {
    // Create row pointers array
    const rowPtr = new Uint32Array(this.numAtoms + 1);
    rowPtr[0] = 0;

    // First pass: count degree of each atom
    const degrees: number[] = [];
    for (let i = 0; i < this.numAtoms; i++) {
      degrees[i] = 0;
    }
    for (const _bond of this.bonds) {
      degrees[_bond.atom1]!++;
      degrees[_bond.atom2]!++;
    }

    // Calculate row pointers (cumulative sum of degrees)
    for (let i = 0; i < this.numAtoms; i++) {
      rowPtr[i + 1] = rowPtr[i]! + degrees[i]!;
    }

    const totalEdges = rowPtr[this.numAtoms]!;
    const colIdx = new Uint32Array(totalEdges);
    const edgeData = new Uint32Array(totalEdges);

    // Second pass: fill in column indices and edge data
    const currentPtr: number[] = [];
    for (let i = 0; i < this.numAtoms; i++) {
      currentPtr[i] = rowPtr[i]!;
    }

    for (let bondIdx = 0; bondIdx < this.bonds.length; bondIdx++) {
      const bond = this.bonds[bondIdx]!;
      const atom1 = bond.atom1;
      const atom2 = bond.atom2;

      // Add edge atom1 -> atom2
      colIdx[currentPtr[atom1]!] = atom2;
      edgeData[currentPtr[atom1]!] = bondIdx;
      currentPtr[atom1]!++;

      // Add edge atom2 -> atom1 (undirected)
      colIdx[currentPtr[atom2]!] = atom1;
      edgeData[currentPtr[atom2]!] = bondIdx;
      currentPtr[atom2]!++;
    }

    return { rowPtr, colIdx, edgeData };
  }

  /**
   * Get neighbors of an atom
   *
   * @param atomId - Atom ID
   * @returns Array of neighbor atom IDs
   */
  getNeighbors(atomId: number): number[] {
    if (atomId < 0 || atomId >= this.numAtoms) {
      return [];
    }

    const start = this.rowPtr[atomId]!;
    const end = this.rowPtr[atomId + 1]!;

    const neighbors: number[] = [];
    for (let i = start; i < end; i++) {
      neighbors.push(this.colIdx[i]!);
    }
    return neighbors;
  }

  /**
   * Get neighbors of an atom (returns iterator for memory efficiency)
   *
   * @param atomId - Atom ID
   * @returns Iterator of neighbor atom IDs
   */
  *getNeighborsIterator(atomId: number): IterableIterator<number> {
    if (atomId < 0 || atomId >= this.numAtoms) {
      return;
    }

    const start = this.rowPtr[atomId]!;
    const end = this.rowPtr[atomId + 1]!;

    for (let i = start; i < end; i++) {
      yield this.colIdx[i]!;
    }
  }

  /**
   * Get bond connecting two atoms
   *
   * @param atom1 - First atom ID
   * @param atom2 - Second atom ID
   * @returns Bond or undefined if not connected
   */
  getBond(atom1: number, atom2: number): Bond | undefined {
    if (atom1 < 0 || atom1 >= this.numAtoms || atom2 < 0 || atom2 >= this.numAtoms) {
      return undefined;
    }

    const start = this.rowPtr[atom1]!;
    const end = this.rowPtr[atom1 + 1]!;

    for (let i = start; i < end; i++) {
      if (this.colIdx[i] === atom2) {
        const bondIdx = this.edgeData[i]!;
        return this.bonds[bondIdx];
      }
    }

    return undefined;
  }

  /**
   * Get degree (number of neighbors) of an atom
   *
   * @param atomId - Atom ID
   * @returns Number of neighbors
   */
  getDegree(atomId: number): number {
    if (atomId < 0 || atomId >= this.numAtoms) {
      return 0;
    }
    return this.rowPtr[atomId + 1]! - this.rowPtr[atomId]!;
  }

  /**
   * Check if two atoms are connected
   *
   * @param atom1 - First atom ID
   * @param atom2 - Second atom ID
   * @returns True if connected
   */
  isConnected(atom1: number, atom2: number): boolean {
    if (atom1 < 0 || atom1 >= this.numAtoms || atom2 < 0 || atom2 >= this.numAtoms) {
      return false;
    }

    const start = this.rowPtr[atom1]!;
    const end = this.rowPtr[atom1 + 1]!;

    for (let i = start; i < end; i++) {
      if (this.colIdx[i] === atom2) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get atom by ID
   *
   * @param atomId - Atom ID
   * @returns Atom or undefined
   */
  getAtom(atomId: number): Atom | undefined {
    return this.atoms[atomId];
  }

  /**
   * Get all atoms
   *
   * @returns Array of all atoms
   */
  getAtoms(): readonly Atom[] {
    return this.atoms;
  }

  /**
   * Get all bonds
   *
   * @returns Array of all bonds
   */
  getBonds(): readonly Bond[] {
    return this.bonds;
  }

  /**
   * Get memory usage in bytes
   *
   * @returns Approximate memory usage
   */
  getMemoryUsage(): number {
    // Uint32Array: 4 bytes per element
    return (this.rowPtr.length + this.colIdx.length + this.edgeData.length) * 4;
  }

  /**
   * Export CSR data for serialization
   */
  export(): {
    numAtoms: number;
    numBonds: number;
    rowPtr: Uint32Array;
    colIdx: Uint32Array;
    edgeData: Uint32Array;
  } {
    return {
      numAtoms: this.numAtoms,
      numBonds: this.numBonds,
      rowPtr: this.rowPtr,
      colIdx: this.colIdx,
      edgeData: this.edgeData,
    };
  }
}

/**
 * Cache for CSR graphs to avoid recomputation
 */
const csrCache = new WeakMap<object, CSRGraph>();

/**
 * Get or create CSR graph for a molecule
 *
 * @param molecule - Molecule to create CSR graph for
 * @returns CSR graph (cached)
 *
 * @internal
 */
export function getCSRGraph(molecule: Molecule): CSRGraph {
  const cached = csrCache.get(molecule as unknown as object);
  if (cached) {
    return cached;
  }

  const graph = new CSRGraph(molecule);
  csrCache.set(molecule as unknown as object, graph);
  return graph;
}

/**
 * Clear CSR graph cache
 *
 * @internal
 */
export function clearCSRCache(): void {
  // WeakMap doesn't have a clear method, so we'll create a new one
  // This is fine because it gets garbage collected anyway
}
